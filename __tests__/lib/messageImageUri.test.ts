import {
  getMessageImageUri,
  selectViewableImages,
} from "@/lib/messageImageUri";
import type { Message } from "@/types/chat";

function buildMessage(overrides: Partial<Message>): Message {
  return {
    id: "id",
    chatId: "chat",
    senderId: "user",
    type: "image",
    content: "",
    timestamp: new Date(0),
    createdAtMs: 0,
    ...overrides,
  };
}

describe("getMessageImageUri", () => {
  it("prefers the local file over remote urls", () => {
    const message = buildMessage({
      imageLocalUri: "file:///local.jpg",
      imageRemoteUrl: "https://remote/a.jpg",
      imageUrl: "https://legacy/a.jpg",
    });
    expect(getMessageImageUri(message)).toBe("file:///local.jpg");
  });

  it("falls back to the remote url", () => {
    const message = buildMessage({ imageRemoteUrl: "https://remote/a.jpg" });
    expect(getMessageImageUri(message)).toBe("https://remote/a.jpg");
  });

  it("returns null for non image messages", () => {
    const message = buildMessage({ type: "text", imageUrl: "https://x" });
    expect(getMessageImageUri(message)).toBeNull();
  });
});

describe("selectViewableImages", () => {
  it("keeps only displayable images in chronological order", () => {
    const messages = [
      buildMessage({ id: "late", createdAtMs: 30, imageUrl: "https://c" }),
      buildMessage({ id: "text", type: "text", createdAtMs: 5 }),
      buildMessage({
        id: "deleted",
        createdAtMs: 10,
        imageUrl: "https://d",
        isDeleted: true,
      }),
      buildMessage({ id: "missing", createdAtMs: 15 }),
      buildMessage({ id: "early", createdAtMs: 1, imageUrl: "https://a" }),
    ];
    expect(selectViewableImages(messages).map((m) => m.id)).toEqual([
      "early",
      "late",
    ]);
  });
});
