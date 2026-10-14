import * as Notifications from "expo-notifications";
import * as TaskManager from "expo-task-manager";
import { Platform } from "react-native";
import { listMessages } from "@/src/api/chats";
import { listMembers } from "@/src/api/members";
import { AdminRepository } from "./AdminRepository";
import { decryptIncomingMessage } from "./encryptedMessages";
import { MessageRepository } from "./MessageRepository";

export const BACKGROUND_NOTIFICATION_TASK = "e2e-background-notification";

// TODO(iOS): Showing decrypted previews on iOS requires a Notification Service
// Extension (mutable-content payload) that decrypts using a shared SecureStore
// (Keychain access group). For now we register the task on iOS too, but iOS will
// only update the notification AFTER the app is opened. Android delivers
// data-only pushes to this task in the background.

type BackgroundData = {
  chatId?: unknown;
  messageId?: unknown;
  senderId?: unknown;
  tenantId?: unknown;
  type?: unknown;
  ciphertext?: unknown;
  iv?: unknown;
};

function readPayload(input: unknown): BackgroundData {
  if (input && typeof input === "object" && "data" in input) {
    const inner = (input as { data?: unknown }).data;
    if (inner && typeof inner === "object") return inner as BackgroundData;
  }
  if (input && typeof input === "object") return input as BackgroundData;
  return {};
}

/// The member list is already mirrored locally, so the common path resolves the sender
/// without a round trip; the network is only touched when this device has never synced.
async function resolveSenderName(memberId: string): Promise<string> {
  if (!memberId) return "Família";
  try {
    const cached = await AdminRepository.getMemberById(memberId);
    if (cached?.name) return cached.name;
  } catch {
    // Fall through to the remote lookup.
  }
  try {
    const members = await listMembers();
    const member = members.find((item) => item.id === memberId);
    return member?.name || "Família";
  } catch {
    return "Família";
  }
}

const ANDROID_TRIGGER =
  Platform.OS === "android" ? ({ channelId: "messages-v2" } as const) : null;

async function scheduleNotification(
  title: string,
  body: string,
  chatId: string,
  messageId: string,
) {
  await Notifications.scheduleNotificationAsync({
    content: { title, body, data: { chatId, messageId } },
    trigger: ANDROID_TRIGGER,
  });
}

async function scheduleFallback(chatId: string, messageId: string, senderName: string) {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: senderName || "Família",
      body: "Nova mensagem",
      data: { chatId, messageId },
    },
    trigger: ANDROID_TRIGGER,
  });
}

const MAX_BODY_LENGTH = 120;
const SNAPSHOT_PAGE_SIZE = 50;

function truncateBody(text: string): string {
  if (text.length <= MAX_BODY_LENGTH) return text;
  return text.slice(0, MAX_BODY_LENGTH) + "...";
}

TaskManager.defineTask(BACKGROUND_NOTIFICATION_TASK, async ({ data, error }) => {
  if (error) return;
  try {
    const payload = readPayload(data);
    const chatId = typeof payload.chatId === "string" ? payload.chatId : "";
    const messageId = typeof payload.messageId === "string" ? payload.messageId : "";
    const senderId = typeof payload.senderId === "string" ? payload.senderId : "";
    if (!chatId || !messageId) return;

    const senderName = await resolveSenderName(senderId);
    const payloadType = typeof payload.type === "string" ? payload.type : "";

    if (payloadType === "audio") {
      await scheduleNotification(senderName, "Áudio", chatId, messageId);
      return;
    }

    let plaintext: string | null = null;

    const payloadCiphertext = typeof payload.ciphertext === "string" ? payload.ciphertext : null;
    const payloadIv = typeof payload.iv === "string" ? payload.iv : null;

    if (payloadCiphertext && payloadIv) {
      plaintext = await decryptIncomingMessage(chatId, {
        ciphertext: payloadCiphertext,
        iv: payloadIv,
        text: null,
      });
    }

    // The push payload only carries the ciphertext while it is small enough, so a long
    // message still needs one lookup. It has to start from the local sync cursor: the
    // listing is ordered oldest first, so an unbounded page would never reach the message
    // that just arrived in a long conversation.
    if (plaintext === null) {
      const syncState = await MessageRepository.getMessageSyncState(chatId).catch(() => null);
      const messages = await listMessages(chatId, {
        after: syncState?.newestMessageAt?.toISOString(),
        limit: SNAPSHOT_PAGE_SIZE,
      });
      const message = messages.find((item) => item.id === messageId);
      if (!message) {
        await scheduleFallback(chatId, messageId, senderName);
        return;
      }
      if (message.audio_url) {
        await scheduleNotification(senderName, "Áudio", chatId, messageId);
        return;
      }
      plaintext = await decryptIncomingMessage(chatId, {
        ciphertext: message.ciphertext ?? null,
        iv: message.iv ?? null,
        text: null,
      });
    }

    if (plaintext === null || plaintext.trim().length === 0) {
      await scheduleFallback(chatId, messageId, senderName);
      return;
    }

    await scheduleNotification(senderName, truncateBody(plaintext), chatId, messageId);
  } catch {
    // A push must never crash the task runner; the in-app sync repairs the state.
  }
});

export async function registerBackgroundNotificationTask(): Promise<void> {
  if (Platform.OS === "web") return;
  try {
    await Notifications.registerTaskAsync(BACKGROUND_NOTIFICATION_TASK);
  } catch {
    // Already registered or unsupported environment.
  }
}
