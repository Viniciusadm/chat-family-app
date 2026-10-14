import {
  generateDeviceKeyPair,
  publicKeyFromPrivate,
  unwrapKeyFromShare,
  wrapKeyForDevice,
} from "@/lib/crypto/asymmetric";
import { base64ToBytes, bytesToBase64 } from "@/lib/crypto/encoding";
import { generateConversationKey } from "@/lib/crypto/symmetric";

describe("generateDeviceKeyPair", () => {
  it("returns 32-byte x25519 keys", () => {
    const { privateKey, publicKey } = generateDeviceKeyPair();
    expect(privateKey).toHaveLength(32);
    expect(publicKey).toHaveLength(32);
  });

  it("derives the same public key from the private key", () => {
    const { privateKey, publicKey } = generateDeviceKeyPair();
    expect(publicKeyFromPrivate(privateKey)).toEqual(publicKey);
  });

  it("returns distinct key pairs on each call", () => {
    expect(generateDeviceKeyPair().privateKey).not.toEqual(
      generateDeviceKeyPair().privateKey,
    );
  });
});

describe("wrapKeyForDevice and unwrapKeyFromShare", () => {
  it("roundtrips the conversation key for the target device", () => {
    const device = generateDeviceKeyPair();
    const conversationKey = generateConversationKey();
    const share = wrapKeyForDevice(bytesToBase64(device.publicKey), conversationKey);
    expect(unwrapKeyFromShare(device.privateKey, share)).toEqual(conversationKey);
  });

  it("throws when unwrapping with a different device private key", () => {
    const device = generateDeviceKeyPair();
    const otherDevice = generateDeviceKeyPair();
    const share = wrapKeyForDevice(
      bytesToBase64(device.publicKey),
      generateConversationKey(),
    );
    expect(() => unwrapKeyFromShare(otherDevice.privateKey, share)).toThrow();
  });

  it("uses a fresh ephemeral key and 12-byte iv for each share", () => {
    const device = generateDeviceKeyPair();
    const conversationKey = generateConversationKey();
    const publicKeyB64 = bytesToBase64(device.publicKey);
    const first = wrapKeyForDevice(publicKeyB64, conversationKey);
    const second = wrapKeyForDevice(publicKeyB64, conversationKey);
    expect(first.ephemeralPublicKey).not.toBe(second.ephemeralPublicKey);
    expect(first.iv).not.toBe(second.iv);
    expect(first.ciphertext).not.toBe(second.ciphertext);
    expect(base64ToBytes(first.iv)).toHaveLength(12);
  });

  it("throws when the share ciphertext was tampered with", () => {
    const device = generateDeviceKeyPair();
    const share = wrapKeyForDevice(
      bytesToBase64(device.publicKey),
      generateConversationKey(),
    );
    const bytes = base64ToBytes(share.ciphertext);
    bytes[bytes.length - 1] ^= 1;
    expect(() =>
      unwrapKeyFromShare(device.privateKey, {
        ...share,
        ciphertext: bytesToBase64(bytes),
      }),
    ).toThrow();
  });
});
