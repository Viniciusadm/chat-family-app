import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";

const ALBUM_NAME = "ChatFamily";
const inFlightSaves = new Set<string>();

async function ensurePermission(): Promise<boolean> {
  try {
    const current = await MediaLibrary.getPermissionsAsync();
    if (current.granted) return true;
    if (!current.canAskAgain) return false;
    const requested = await MediaLibrary.requestPermissionsAsync();
    return requested.granted;
  } catch {
    return false;
  }
}

export const ImageGalleryRepository = {
  /**
   * Salva o arquivo local no álbum público "ChatFamily".
   * Android: /Pictures/ChatFamily/. iOS: álbum "ChatFamily" no app Fotos.
   * Permissão negada ou erro: retorna silenciosamente.
   */
  async saveToGallery({
    messageId,
    fileUri,
  }: {
    messageId: string;
    fileUri: string;
  }): Promise<boolean> {
    if (inFlightSaves.has(messageId)) return false;
    inFlightSaves.add(messageId);
    try {
      const granted = await ensurePermission();
      if (!granted) return false;

      const album = await MediaLibrary.getAlbumAsync(ALBUM_NAME);
      if (Platform.OS === "android") {
        // Creating directly in the destination avoids moving an existing asset,
        // which triggers Android's per-photo modification consent dialog.
        if (album) {
          await MediaLibrary.createAssetAsync(fileUri, album);
        } else {
          await MediaLibrary.createAlbumAsync(ALBUM_NAME, undefined, true, fileUri);
        }
        return true;
      }

      const asset = await MediaLibrary.createAssetAsync(fileUri);
      if (album) {
        await MediaLibrary.addAssetsToAlbumAsync([asset], album, false);
      } else {
        await MediaLibrary.createAlbumAsync(ALBUM_NAME, asset, false);
      }
      return true;
    } catch {
      // Permissão negada ou erro — não quebra envio.
      return false;
    } finally {
      inFlightSaves.delete(messageId);
    }
  },
};
