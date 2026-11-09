import { ImageCacheRepository } from "@/lib/ImageCacheRepository";
import type { Message } from "@/types/chat";
import * as FileSystem from "expo-file-system/legacy";
import { Image } from "react-native";

export async function resolveMessageImageFile(
  message: Message
): Promise<string | null> {
  if (message.type !== "image") return null;
  const remoteUrl = message.imageRemoteUrl ?? message.imageUrl;
  if (remoteUrl) {
    return ImageCacheRepository.ensureMessageImageCache({
      chatId: message.chatId,
      messageId: message.id,
      remoteUrl,
      localUri: message.imageLocalUri,
      download: true,
    });
  }
  const localUri = message.imageLocalUri ?? message.imagePendingSourceUri;
  if (!localUri) return null;
  const info = await FileSystem.getInfoAsync(localUri).catch(() => null);
  return info?.exists ? localUri : null;
}

export async function readImageFileAsBase64(fileUri: string): Promise<string> {
  return FileSystem.readAsStringAsync(fileUri, {
    encoding: FileSystem.EncodingType.Base64,
  });
}

export function getImageFileSize(
  fileUri: string
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    Image.getSize(
      fileUri,
      (width, height) => resolve({ width, height }),
      reject
    );
  });
}
