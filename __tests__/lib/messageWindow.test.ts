jest.mock("@/context/AuthContext", () => ({
  useAuth: () => ({ currentUser: { id: "me", role: "adult" }, tenantId: "tenant", deviceId: "device" }),
}));
jest.mock("@/hooks/useConnectivity", () => ({ useConnectivity: () => ({ isOnline: true }) }));
jest.mock("@/lib/AudioCacheRepository", () => ({}));
jest.mock("@/lib/ImageCacheRepository", () => ({}));
jest.mock("@/lib/ImageGalleryRepository", () => ({}));
jest.mock("@/src/api/realtime", () => ({ realtimeClient: { subscribe: () => () => {} } }));
jest.mock("@/lib/offlineSync", () => ({
  hasOlderRemoteMessages: () => true,
  loadOlderRemoteMessages: async () => 0,
  syncChatHistory: async () => {},
  syncPendingAudioMessages: async () => {},
  syncPendingImageMessages: async () => {},
  syncPendingOps: async () => {},
  syncPendingReactions: async () => {},
  syncPendingTextMessages: async () => {},
}));
jest.mock("@/lib/MessageRepository", () => ({
  MessageRepository: {
    getLocalMessages: jest.fn(),
    hasLocalMessagesBefore: async () => false,
    getOlderWindowStart: async () => null,
    getClearMark: async () => null,
    subscribe: jest.fn(),
  },
}));

import { createElement } from "react";
import { useMessages } from "@/hooks/useMessages";
import { MessageRepository } from "@/lib/MessageRepository";
import type { Message } from "@/types/chat";

const { act, create } = jest.requireActual("react-test-renderer");

it("keeps a newly sent message visible when the server confirms an earlier timestamp", async () => {
  (globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true;
  let message = {
    id: "message", chatId: "chat", senderId: "me", type: "text", content: "Hello",
    status: "loading", timestamp: new Date("2026-11-09T10:00:00.200Z"),
  } as Message;
  let changed: (() => void) | undefined;
  let latest: ReturnType<typeof useMessages> | undefined;
  jest.mocked(MessageRepository.getLocalMessages).mockImplementation(async (_, window = {}) =>
    !window.since || message.timestamp.toISOString() >= window.since ? [message] : []
  );
  jest.mocked(MessageRepository.subscribe).mockImplementation((_, listener) => {
    changed = listener;
    return () => {};
  });
  function Harness() {
    latest = useMessages("chat");
    return null;
  }
  let root: { unmount: () => void };
  await act(async () => { root = create(createElement(Harness)); });
  expect(latest!.hasOlder).toBe(true);
  await act(async () => { await latest!.loadOlder(); });
  message = { ...message, status: "sent", timestamp: new Date("2026-11-09T10:00:00.100Z") };
  await act(async () => { changed!(); });
  expect(latest!.messages.map((row) => row.id)).toEqual(["message"]);
  await act(async () => { root.unmount(); });
});
