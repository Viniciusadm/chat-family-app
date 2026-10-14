import {
  decryptText,
  encryptText,
  generateConversationKey,
} from "@/lib/crypto/symmetric";
import { base64ToBytes } from "@/lib/crypto/encoding";

describe("generateConversationKey", () => {
  it("returns a 32-byte key", () => {
    expect(generateConversationKey()).toHaveLength(32);
  });

  it("returns a different key on each call", () => {
    expect(generateConversationKey()).not.toEqual(generateConversationKey());
  });
});

describe("encryptText and decryptText", () => {
  it("roundtrips plaintext with the same key", () => {
    const key = generateConversationKey();
    const { ciphertext, iv } = encryptText(key, "mensagem secreta");
    expect(decryptText(key, ciphertext, iv)).toBe("mensagem secreta");
  });

  it("roundtrips non-ascii and emoji plaintext", () => {
    const key = generateConversationKey();
    const text = "Bom dia, família! ☀️👨‍👩‍👧 ação";
    const { ciphertext, iv } = encryptText(key, text);
    expect(decryptText(key, ciphertext, iv)).toBe(text);
  });

  it("roundtrips an empty string", () => {
    const key = generateConversationKey();
    const { ciphertext, iv } = encryptText(key, "");
    expect(decryptText(key, ciphertext, iv)).toBe("");
  });

  it("does not expose the plaintext in the ciphertext", () => {
    const key = generateConversationKey();
    const { ciphertext } = encryptText(key, "plaintext");
    expect(ciphertext).not.toContain("plaintext");
    expect(Buffer.from(ciphertext, "base64").toString()).not.toContain(
      "plaintext",
    );
  });

  it("throws when decrypting with a different key", () => {
    const { ciphertext, iv } = encryptText(generateConversationKey(), "oi");
    expect(() => decryptText(generateConversationKey(), ciphertext, iv)).toThrow();
  });

  it("throws when the ciphertext was tampered with", () => {
    const key = generateConversationKey();
    const { ciphertext, iv } = encryptText(key, "oi");
    const bytes = base64ToBytes(ciphertext);
    bytes[0] ^= 1;
    const tampered = Buffer.from(bytes).toString("base64");
    expect(() => decryptText(key, tampered, iv)).toThrow();
  });

  it("throws when decrypting with a different iv", () => {
    const key = generateConversationKey();
    const { ciphertext } = encryptText(key, "oi");
    const otherIv = encryptText(key, "outro").iv;
    expect(() => decryptText(key, ciphertext, otherIv)).toThrow();
  });

  it("uses a 12-byte iv", () => {
    const { iv } = encryptText(generateConversationKey(), "oi");
    expect(base64ToBytes(iv)).toHaveLength(12);
  });

  it("uses a fresh random iv and ciphertext for each encryption of the same text", () => {
    const key = generateConversationKey();
    const first = encryptText(key, "mesmo texto");
    const second = encryptText(key, "mesmo texto");
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
  });
});
