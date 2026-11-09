jest.mock("expo-media-library", () => ({
  getPermissionsAsync: jest.fn(),
  requestPermissionsAsync: jest.fn(),
  getAlbumAsync: jest.fn(),
  createAssetAsync: jest.fn(),
  createAlbumAsync: jest.fn(),
  addAssetsToAlbumAsync: jest.fn(),
}));

import * as MediaLibrary from "expo-media-library";
import { Platform } from "react-native";
import { ImageGalleryRepository } from "@/lib/ImageGalleryRepository";

const album = { id: "album", title: "ChatFamily", assetCount: 1, startTime: 0, endTime: 0 };
const fileUri = "file:///app/image-cache/photo.jpg";

beforeEach(() => {
  jest.clearAllMocks();
  jest.replaceProperty(Platform, "OS", "android");
  jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValue({ granted: true } as never);
  jest.mocked(MediaLibrary.getAlbumAsync).mockResolvedValue(album);
  jest.mocked(MediaLibrary.createAssetAsync).mockResolvedValue({ id: "asset" } as never);
});

afterEach(() => jest.restoreAllMocks());

it("creates an Android photo inside the existing album without requesting an asset move", async () => {
  await ImageGalleryRepository.saveToGallery({ messageId: "existing-album", fileUri });
  expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith(fileUri, album);
  expect(MediaLibrary.addAssetsToAlbumAsync).not.toHaveBeenCalled();
  expect(MediaLibrary.createAlbumAsync).not.toHaveBeenCalled();
});

it("creates the first Android album directly from the local file", async () => {
  jest.mocked(MediaLibrary.getAlbumAsync).mockResolvedValue(null as never);
  await ImageGalleryRepository.saveToGallery({ messageId: "new-album", fileUri });
  expect(MediaLibrary.createAlbumAsync).toHaveBeenCalledWith("ChatFamily", undefined, true, fileUri);
  expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled();
  expect(MediaLibrary.addAssetsToAlbumAsync).not.toHaveBeenCalled();
});

it("keeps the iOS album association flow", async () => {
  jest.replaceProperty(Platform, "OS", "ios");
  await ImageGalleryRepository.saveToGallery({ messageId: "ios", fileUri });
  expect(MediaLibrary.createAssetAsync).toHaveBeenCalledWith(fileUri);
  expect(MediaLibrary.addAssetsToAlbumAsync).toHaveBeenCalledWith([{ id: "asset" }], album, false);
});

it("does not write to the gallery when permission was denied", async () => {
  jest.mocked(MediaLibrary.getPermissionsAsync).mockResolvedValue({ granted: false, canAskAgain: false } as never);
  await ImageGalleryRepository.saveToGallery({ messageId: "denied", fileUri });
  expect(MediaLibrary.createAssetAsync).not.toHaveBeenCalled();
  expect(MediaLibrary.createAlbumAsync).not.toHaveBeenCalled();
});
