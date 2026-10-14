import {
  base64ToBytes,
  bytesToBase64,
  utf8Decode,
  utf8Encode,
} from "@/lib/crypto/encoding";

describe("utf8 encoding", () => {
  it.each([
    ["empty string", ""],
    ["ascii", "hello world"],
    ["portuguese accents", "ação, coração, você"],
    ["emoji", "família 👨‍👩‍👧‍👦 🎉"],
    ["cjk", "你好世界"],
  ])("roundtrips %s", (_label, text) => {
    expect(utf8Decode(utf8Encode(text))).toBe(text);
  });

  it("encodes multi-byte characters with the expected byte length", () => {
    expect(utf8Encode("é")).toHaveLength(2);
    expect(utf8Encode("🎉")).toHaveLength(4);
  });
});

describe("base64 encoding", () => {
  it("encodes bytes to the standard base64 representation", () => {
    expect(bytesToBase64(utf8Encode("hello"))).toBe("aGVsbG8=");
    expect(bytesToBase64(new Uint8Array([]))).toBe("");
  });

  it("decodes standard base64 into bytes", () => {
    expect(Array.from(base64ToBytes("AP8Q"))).toEqual([0, 255, 16]);
  });

  it("roundtrips every possible byte value", () => {
    const allBytes = Uint8Array.from({ length: 256 }, (_, i) => i);
    expect(base64ToBytes(bytesToBase64(allBytes))).toEqual(allBytes);
  });

  it("roundtrips non-ascii text through utf8 and base64", () => {
    const text = "Olá, mãe! ❤️ 😀";
    expect(utf8Decode(base64ToBytes(bytesToBase64(utf8Encode(text))))).toBe(
      text,
    );
  });

  it("matches node's base64 output for emoji text", () => {
    const text = "🚀 ção";
    expect(bytesToBase64(utf8Encode(text))).toBe(
      Buffer.from(text, "utf8").toString("base64"),
    );
  });
});
