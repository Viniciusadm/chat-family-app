jest.mock("expo-crypto", () => {
  const nodeCrypto: typeof import("crypto") = jest.requireActual("crypto");
  return {
    getRandomBytes: (length: number) =>
      new Uint8Array(nodeCrypto.randomBytes(length)),
  };
});

jest.mock("react-native-quick-crypto", () => {
  const nodeCrypto: typeof import("crypto") = jest.requireActual("crypto");
  return {
    __esModule: true,
    default: { pbkdf2: nodeCrypto.pbkdf2 },
  };
});
