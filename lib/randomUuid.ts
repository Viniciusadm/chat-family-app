import * as Crypto from "expo-crypto";

export function randomUuid(): string {
  // react-native-get-random-values only installs crypto.getRandomValues, so on native
  // globalThis.crypto.randomUUID is undefined and expo-crypto is the real path here.
  // Message and device ids must never come from Math.random: a collision makes the
  // backend silently drop a message, or delivers key shares to the wrong device.
  const c = globalThis.crypto;
  if (c && typeof c.randomUUID === "function") {
    return c.randomUUID();
  }
  return Crypto.randomUUID();
}
