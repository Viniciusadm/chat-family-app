import { pbkdf2Sync } from "crypto";
import {
  PASSWORD_MIN_LENGTH,
  checkPasswordVerifier,
  decryptConversationKeyWithKek,
  deriveKeyFromPassword,
  encryptConversationKeyWithKek,
  generatePasswordSalt,
  makePasswordVerifier,
  validatePasswordStrength,
} from "@/lib/crypto/passwordKey";
import { base64ToBytes } from "@/lib/crypto/encoding";
import { generateConversationKey } from "@/lib/crypto/symmetric";

function randomKek(): Uint8Array {
  return generateConversationKey();
}

describe("generatePasswordSalt", () => {
  it("returns 16 random bytes encoded as base64", () => {
    const salt = generatePasswordSalt();
    expect(base64ToBytes(salt)).toHaveLength(16);
    expect(generatePasswordSalt()).not.toBe(salt);
  });
});

describe("deriveKeyFromPassword on native", () => {
  it("rejects an empty password", async () => {
    await expect(deriveKeyFromPassword("", generatePasswordSalt())).rejects.toThrow(
      "Empty password",
    );
  });

  it("derives a 32-byte PBKDF2-SHA256 key with 600k iterations and reports start and end progress", async () => {
    const salt = generatePasswordSalt();
    const progress: number[] = [];
    const kek = await deriveKeyFromPassword("Senha#Forte1", salt, (p) =>
      progress.push(p),
    );
    const expected = pbkdf2Sync(
      "Senha#Forte1",
      Buffer.from(base64ToBytes(salt)),
      600_000,
      32,
      "sha256",
    );
    expect(kek).toEqual(new Uint8Array(expected));
    expect(progress).toEqual([0, 1]);
  });
});

describe("password verifier", () => {
  it("accepts the kek that created the verifier", () => {
    const kek = randomKek();
    expect(checkPasswordVerifier(kek, makePasswordVerifier(kek))).toBe(true);
  });

  it("rejects a different kek without throwing", () => {
    const verifier = makePasswordVerifier(randomKek());
    expect(checkPasswordVerifier(randomKek(), verifier)).toBe(false);
  });

  it("rejects a malformed verifier without throwing", () => {
    expect(
      checkPasswordVerifier(randomKek(), { ciphertext: "AAAA", iv: "AAAA" }),
    ).toBe(false);
  });

  it("uses a 12-byte random iv for each verifier", () => {
    const kek = randomKek();
    const first = makePasswordVerifier(kek);
    const second = makePasswordVerifier(kek);
    expect(base64ToBytes(first.iv)).toHaveLength(12);
    expect(first.iv).not.toBe(second.iv);
  });
});

describe("conversation key encryption with kek", () => {
  it("roundtrips the conversation key with the same kek", () => {
    const kek = randomKek();
    const conversationKey = generateConversationKey();
    const { ciphertext, iv } = encryptConversationKeyWithKek(kek, conversationKey);
    expect(decryptConversationKeyWithKek(kek, ciphertext, iv)).toEqual(
      conversationKey,
    );
  });

  it("throws when decrypting with a different kek", () => {
    const { ciphertext, iv } = encryptConversationKeyWithKek(
      randomKek(),
      generateConversationKey(),
    );
    expect(() => decryptConversationKeyWithKek(randomKek(), ciphertext, iv)).toThrow();
  });

  it("uses a 12-byte iv", () => {
    const { iv } = encryptConversationKeyWithKek(
      randomKek(),
      generateConversationKey(),
    );
    expect(base64ToBytes(iv)).toHaveLength(12);
  });
});

describe("validatePasswordStrength", () => {
  it("accepts a password meeting every rule", () => {
    expect(validatePasswordStrength("Senha#Forte1")).toBeNull();
  });

  it.each([
    ["too short", "Ab1!", `A senha precisa ter pelo menos ${PASSWORD_MIN_LENGTH} caracteres.`],
    ["missing lowercase", "SENHA#FORTE1", "Inclua pelo menos uma letra minúscula."],
    ["missing uppercase", "senha#forte1", "Inclua pelo menos uma letra maiúscula."],
    ["missing digit", "Senha#Forte", "Inclua pelo menos um número."],
    ["missing special character", "SenhaForte1", "Inclua pelo menos um caractere especial (ex.: !@#$%)."],
  ])("rejects a password %s", (_label, password, message) => {
    expect(validatePasswordStrength(password)).toBe(message);
  });
});
