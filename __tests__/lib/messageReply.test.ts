import { createReplySnapshot, replyPreviewForType } from "@/lib/messageReply";
import type { Message } from "@/types/chat";

describe("replyPreviewForType", () => {
  it("labels audio messages regardless of content", () => {
    expect(replyPreviewForType("audio", "https://example.com/a.m4a")).toBe("Áudio");
  });

  it("labels image messages regardless of content", () => {
    expect(replyPreviewForType("image", "https://example.com/a.jpg")).toBe("Imagem");
  });

  it("returns short text unchanged", () => {
    expect(replyPreviewForType("text", "Oi, tudo bem?")).toBe("Oi, tudo bem?");
  });

  it("trims and collapses whitespace including newlines and tabs", () => {
    expect(replyPreviewForType("text", "  Oi\n\n  tudo\tbem?  ")).toBe("Oi tudo bem?");
  });

  it("falls back to a generic label for blank text", () => {
    expect(replyPreviewForType("text", "")).toBe("Mensagem");
    expect(replyPreviewForType("text", " \n\t ")).toBe("Mensagem");
  });

  it("keeps text of exactly 90 characters intact", () => {
    const text = "a".repeat(90);
    expect(replyPreviewForType("text", text)).toBe(text);
  });

  it("truncates text longer than 90 characters to 89 characters plus an ellipsis", () => {
    const preview = replyPreviewForType("text", "b".repeat(91));
    expect(preview).toBe(`${"b".repeat(89)}…`);
    expect(preview).toHaveLength(90);
  });

  it("measures truncation after collapsing whitespace", () => {
    const text = Array.from({ length: 45 }, () => "x").join("     ");
    expect(replyPreviewForType("text", text)).toBe(Array.from({ length: 45 }, () => "x").join(" "));
  });
});

describe("createReplySnapshot", () => {
  it("copies identity fields and builds the preview from the message", () => {
    const message = {
      id: "m1",
      chatId: "c1",
      senderId: "u1",
      type: "text",
      content: "  Olá\n mundo ",
    } as Message;
    expect(createReplySnapshot(message, "Maria")).toEqual({
      id: "m1",
      senderId: "u1",
      senderName: "Maria",
      type: "text",
      preview: "Olá mundo",
    });
  });
});
