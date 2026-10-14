import { mediaAuthHeaders, refreshApiSession } from "@/src/api/client";
import * as FileSystem from "expo-file-system/legacy";

export async function downloadProtectedMedia(
  remoteUrl: string,
  fileUri: string
): Promise<FileSystem.FileSystemDownloadResult> {
  const result = await FileSystem.downloadAsync(remoteUrl, fileUri, {
    headers: mediaAuthHeaders(),
  });
  if (result.status !== 401) return result;

  const refreshed = await refreshApiSession();
  if (!refreshed) return result;

  return FileSystem.downloadAsync(remoteUrl, fileUri, {
    headers: mediaAuthHeaders(),
  });
}
