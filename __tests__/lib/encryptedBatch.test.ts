jest.mock("@/lib/conversationKeys", () => ({ getConversationKey: jest.fn() }));

import { getConversationKey } from "@/lib/conversationKeys";
import { encryptText } from "@/lib/crypto/symmetric";
import { decryptIncomingMessages } from "@/lib/encryptedMessages";

const key = new Uint8Array(32).fill(7);

beforeEach(() => jest.resetAllMocks());

it("reads the conversation key once for a 100-message page", async () => {
  jest.mocked(getConversationKey).mockResolvedValue(key);
  const messages = Array.from({ length: 100 }, (_, i) => encryptText(key, `message ${i}`));
  const result = await decryptIncomingMessages("chat", messages);
  expect(result).toEqual(Array.from({ length: 100 }, (_, i) => `message ${i}`));
  expect(getConversationKey).toHaveBeenCalledTimes(1);
});

it("isolates a corrupted message and does not retain an old key between batches", async () => {
  const message = encryptText(key, "private");
  jest.mocked(getConversationKey).mockResolvedValueOnce(key).mockResolvedValueOnce(null);
  expect(await decryptIncomingMessages("chat", [message, { ciphertext: "bad", iv: "bad" }])).toEqual(["private", null]);
  expect(await decryptIncomingMessages("chat", [message])).toEqual([null]);
});

it("does not consult SecureStore for an empty or unencrypted batch", async () => {
  expect(await decryptIncomingMessages("chat", [])).toEqual([]);
  expect(await decryptIncomingMessages("chat", [{ text: "legacy" }, {}])).toEqual(["legacy", null]);
  expect(getConversationKey).not.toHaveBeenCalled();
});
