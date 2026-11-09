import { getMessageImageUri } from "@/lib/messageImageUri";
import { MessageRepository } from "@/lib/MessageRepository";
import type { Message } from "@/types/chat";
import { useEffect, useState } from "react";

export function useChatMedia(chatId: string) {
  const [images, setImages] = useState<Message[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!chatId) {
      setImages([]);
      setLoading(false);
      return;
    }
    let active = true;
    const load = async () => {
      const rows = await MessageRepository.getImageMessages(chatId).catch(
        () => [],
      );
      if (!active) return;
      setImages(rows.filter((message) => getMessageImageUri(message) !== null));
      setLoading(false);
    };
    void load();
    const unsubscribe = MessageRepository.subscribe(chatId, () => {
      void load();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [chatId]);

  return { images, loading };
}
