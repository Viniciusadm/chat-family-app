import type { ChatListItem } from "@/lib/chatListItems";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import type { FlatList } from "react-native";

interface UseChatJumpOptions {
  chatId: string | undefined;
  chatListData: ChatListItem[];
  deepLinkMessageId: string | undefined;
  listRef: RefObject<FlatList<ChatListItem> | null>;
  revealMessage: (messageId: string) => Promise<boolean>;
}

export function useChatJump({
  chatId,
  chatListData,
  deepLinkMessageId,
  listRef,
  revealMessage,
}: UseChatJumpOptions) {
  const [highlightedMessageId, setHighlightedMessageId] = useState<string | null>(null);
  const highlightTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingScrollIndexRef = useRef<number | null>(null);
  const pendingDeepLinkMessageIdRef = useRef<string | null>(null);
  const consumedDeepLinkRef = useRef<string | null>(null);
  const chatListDataRef = useRef(chatListData);

  useEffect(() => {
    chatListDataRef.current = chatListData;
  }, [chatListData]);

  useEffect(() => {
    setHighlightedMessageId(null);
  }, [chatId]);

  useEffect(() => {
    return () => {
      if (highlightTimeoutRef.current) {
        clearTimeout(highlightTimeoutRef.current);
      }
    };
  }, []);

  const highlightMessage = useCallback((messageId: string) => {
    setHighlightedMessageId(messageId);
    if (highlightTimeoutRef.current) {
      clearTimeout(highlightTimeoutRef.current);
    }
    highlightTimeoutRef.current = setTimeout(() => {
      setHighlightedMessageId((current) =>
        current === messageId ? null : current
      );
      highlightTimeoutRef.current = null;
    }, 1600);
  }, []);

  const jumpToMessage = useCallback(
    (messageId: string) => {
      const index = chatListDataRef.current.findIndex(
        (entry) => entry.type === "message" && entry.message.id === messageId
      );
      if (index < 0) {
        pendingDeepLinkMessageIdRef.current = messageId;
        void revealMessage(messageId);
        return;
      }

      pendingScrollIndexRef.current = index;
      listRef.current?.scrollToIndex({
        index,
        animated: true,
        viewPosition: 0.5,
      });
      highlightMessage(messageId);
    },
    [highlightMessage, listRef, revealMessage]
  );

  useEffect(() => {
    if (typeof deepLinkMessageId !== "string" || deepLinkMessageId.length === 0) {
      return;
    }
    if (consumedDeepLinkRef.current === deepLinkMessageId) return;
    pendingDeepLinkMessageIdRef.current = deepLinkMessageId;
  }, [deepLinkMessageId]);

  useEffect(() => {
    const target = pendingDeepLinkMessageIdRef.current;
    if (!target) return;
    const exists = chatListData.some(
      (entry) => entry.type === "message" && entry.message.id === target
    );
    if (!exists) return;
    const handle = setTimeout(() => {
      jumpToMessage(target);
      consumedDeepLinkRef.current = target;
      pendingDeepLinkMessageIdRef.current = null;
    }, 120);
    return () => clearTimeout(handle);
  }, [chatListData, jumpToMessage]);

  const handleScrollToIndexFailed = useCallback(
    (info: { index: number; averageItemLength: number }) => {
      listRef.current?.scrollToOffset({
        offset: info.averageItemLength * info.index,
        animated: true,
      });
      const retryIndex = pendingScrollIndexRef.current;
      if (retryIndex == null) return;
      setTimeout(() => {
        listRef.current?.scrollToIndex({
          index: retryIndex,
          animated: true,
          viewPosition: 0.5,
        });
      }, 80);
    },
    [listRef]
  );

  return { highlightedMessageId, jumpToMessage, handleScrollToIndexFailed };
}
