import { useAuth } from "@/context/AuthContext";
import * as Notifications from "expo-notifications";
import { usePathname, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";

interface ChatNotificationTarget {
  chatId: string;
  messageId?: string;
}

function chatTargetFromResponse(
  response: Notifications.NotificationResponse
): ChatNotificationTarget | null {
  const data = response.notification.request.content.data as
    | Record<string, unknown>
    | undefined;
  const chatId = data && typeof data.chatId === "string" ? data.chatId : null;
  if (!chatId) return null;
  const messageId = typeof data?.messageId === "string" ? data.messageId : undefined;
  return { chatId, messageId };
}

export function NotificationNavigation() {
  const router = useRouter();
  const pathname = usePathname();
  const {
    currentUser,
    deviceApproved,
    loading,
    sessionReady,
    needsPasswordRestore,
  } = useAuth();
  const [pendingTarget, setPendingTarget] = useState<ChatNotificationTarget | null>(null);
  const handledResponseIds = useRef(new Set<string>());

  const canNavigate =
    !loading &&
    sessionReady &&
    currentUser != null &&
    deviceApproved === true &&
    !needsPasswordRestore;

  useEffect(() => {
    let active = true;

    const acceptResponse = (response: Notifications.NotificationResponse) => {
      const responseId = `${response.notification.request.identifier}:${response.notification.date}`;
      if (handledResponseIds.current.has(responseId)) return;
      handledResponseIds.current.add(responseId);
      void Notifications.clearLastNotificationResponseAsync().catch(() => {});
      const target = chatTargetFromResponse(response);
      if (target && active) setPendingTarget(target);
    };

    void Notifications.getLastNotificationResponseAsync()
      .then((response) => {
        if (response) acceptResponse(response);
      })
      .catch(() => {});

    const sub = Notifications.addNotificationResponseReceivedListener(acceptResponse);

    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!pendingTarget || !canNavigate) return;
    const { chatId, messageId } = pendingTarget;
    setPendingTarget(null);

    if (pathname === `/chat/${chatId}`) {
      if (messageId) router.setParams({ messageId });
      return;
    }

    router.push({
      pathname: "/(protected)/chat/[chatId]",
      params: messageId ? { chatId, messageId } : { chatId },
    });
  }, [canNavigate, pathname, pendingTarget, router]);

  return null;
}
