import { decryptText, encryptText } from "./crypto/symmetric";
import { getConversationKey } from "./conversationKeys";

function decryptWithKey(key: Uint8Array | null, msg: IncomingEncryptedMessage): string | null {
  if (msg.ciphertext && msg.iv) {
    if (!key) return null;
    try {
      return decryptText(key, msg.ciphertext, msg.iv);
    } catch {
      return null;
    }
  }
  return msg.text ?? null;
}

export async function encryptMessageText(
  chatId: string,
  plaintext: string,
): Promise<{ ciphertext: string; iv: string } | null> {
  const key = await getConversationKey(chatId);
  if (!key) return null;
  return encryptText(key, plaintext);
}

export type IncomingEncryptedMessage = {
  ciphertext?: string | null;
  iv?: string | null;
  text?: string | null;
};

export async function decryptIncomingMessage(
  chatId: string,
  msg: IncomingEncryptedMessage,
): Promise<string | null> {
  const key = msg.ciphertext && msg.iv ? await getConversationKey(chatId) : null;
  return decryptWithKey(key, msg);
}

// Keep the key scoped to this batch, rather than repeatedly reading SecureStore
// or retaining keys in a process-wide cache after logout/key replacement.
export async function decryptIncomingMessages(
  chatId: string,
  messages: IncomingEncryptedMessage[],
): Promise<(string | null)[]> {
  const needsKey = messages.some((message) => message.ciphertext && message.iv);
  const key = needsKey ? await getConversationKey(chatId) : null;
  return messages.map((message) => decryptWithKey(key, message));
}
