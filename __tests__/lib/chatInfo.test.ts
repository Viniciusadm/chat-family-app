import { formatBytes } from "@/lib/chatStorage";
import { isClearedByMark } from "@/lib/clearMarks";
import { findCommonGroups } from "@/lib/commonGroups";
import {
  exportFileName,
  formatConversationExport,
} from "@/lib/conversationExport";
import type { Chat } from "@/types/chat";

jest.mock("expo-file-system/legacy", () => ({
  documentDirectory: "file:///docs/",
}));

function chat(overrides: Partial<Chat>): Chat {
  return {
    id: "chat",
    tenantId: "tenant",
    participants: [],
    isGroup: true,
    name: "Grupo",
    unreadCount: 0,
    ...overrides,
  };
}

describe("formatConversationExport", () => {
  it("writes one line per message with placeholders for media", () => {
    const names: Record<string, string> = { a: "Ana", b: "Beto" };
    const text = formatConversationExport(
      [
        {
          senderId: "a",
          type: "text",
          content: "Oi!",
          timestamp: new Date(2026, 10, 9, 8, 5),
        },
        {
          senderId: "b",
          type: "image",
          content: "",
          timestamp: new Date(2026, 10, 9, 8, 6),
        },
        {
          senderId: "b",
          type: "audio",
          content: "",
          timestamp: new Date(2026, 10, 9, 8, 7),
        },
        {
          senderId: "a",
          type: "text",
          content: "",
          decryptionFailed: true,
          timestamp: new Date(2026, 10, 9, 8, 8),
        },
        {
          senderId: "a",
          type: "text",
          content: "Corrigido",
          isEdited: true,
          timestamp: new Date(2026, 10, 9, 8, 9),
        },
      ],
      (id) => names[id],
    );
    expect(text.split("\n")).toEqual([
      "09/11/2026 08:05 - Ana: Oi!",
      "09/11/2026 08:06 - Beto: <imagem>",
      "09/11/2026 08:07 - Beto: <áudio>",
      "09/11/2026 08:08 - Ana: <mensagem indisponível>",
      "09/11/2026 08:09 - Ana: Corrigido <editada>",
    ]);
  });

  it("builds a safe file name", () => {
    expect(exportFileName("Família / Casa?")).toBe(
      "Conversa com Família Casa.txt",
    );
    expect(exportFileName("  ")).toBe("Conversa com família.txt");
  });
});

describe("formatBytes", () => {
  it("formats sizes in pt-BR", () => {
    expect(formatBytes(0)).toBe("0 B");
    expect(formatBytes(512)).toBe("512 B");
    expect(formatBytes(1536)).toBe("1,5 KB");
    expect(formatBytes(99_500_000)).toBe("94,9 MB");
    expect(formatBytes(300 * 1024 * 1024)).toBe("300 MB");
  });
});

describe("findCommonGroups", () => {
  it("returns only groups with both members, sorted by name", () => {
    const chats = [
      chat({ id: "1", name: "Viagem", participants: ["me", "kid"] }),
      chat({ id: "2", name: "Casa", participants: ["me", "kid", "mom"] }),
      chat({ id: "3", name: "Escola", participants: ["me", "mom"] }),
      chat({ id: "4", name: "", isGroup: false, participants: ["me", "kid"] }),
    ];
    expect(findCommonGroups(chats, "me", "kid").map((c) => c.id)).toEqual([
      "2",
      "1",
    ]);
  });
});

describe("isClearedByMark", () => {
  it("drops messages created up to the mark", () => {
    const mark = "2026-11-09T12:00:00.000Z";
    expect(isClearedByMark(new Date("2026-11-09T11:59:59Z"), mark)).toBe(true);
    expect(isClearedByMark(new Date("2026-11-09T12:00:00Z"), mark)).toBe(true);
    expect(isClearedByMark(new Date("2026-11-09T12:00:01Z"), mark)).toBe(false);
    expect(isClearedByMark(new Date("2020-01-01T00:00:00Z"), null)).toBe(false);
  });
});
