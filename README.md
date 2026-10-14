# Chat Family

Chat Family is a closed group messenger for a family, where the server carries the conversations without being able to read them. This repository holds the mobile app, built with Expo and React Native.

| Part | What it is |
| --- | --- |
| [`chat-family-app`](https://github.com/Viniciusadm/chat-family-app) | This repository. The Expo app: screens, local storage, end-to-end encryption of text messages and the realtime client. |
| [`chat-family-api`](https://github.com/Viniciusadm/chat-family-api) | The Rust backend: accounts, devices, chats, media, key exchange and the realtime hub. |

## What the app does

Adults sign in with e-mail and password; children sign in with a login code. A new device waits on a screen (`aguardando`) until an adult approves it from the admin screen.

Text messages are encrypted on the device with a per-chat AES-GCM key (`@noble/ciphers`). To give another device access to a chat, the app wraps that key for the device's X25519 public key, using an ephemeral key pair and HKDF-SHA256, and uploads the result as a key share. Each user can also keep a backup of their chat keys encrypted with a key derived from a password (PBKDF2-SHA256, 600,000 iterations), which restores the conversations on a new device. Keys stay in `expo-secure-store`.

Messages are kept in a local SQLite database (`expo-sqlite`) and synced with the API. The chat screen supports replies, editing, reactions, voice messages, images, search, read receipts and day separators. Push notifications come through Expo.

Audio and images are not end-to-end encrypted; the API protects them only by authorization.

## Requirements

- Node.js and npm
- Expo SDK **54** (React Native 0.81, React 19.1)
- A running [`chat-family-api`](https://github.com/Viniciusadm/chat-family-api)
- Android Studio or Xcode for development builds; the app uses native modules (`react-native-quick-crypto`, `expo-sqlite`, `expo-secure-store`), so Expo Go is not enough

## Running locally

Copy the environment file and point it at the API:

```bash
cp .env.example .env
```

| Variable | Default | Purpose |
| --- | --- | --- |
| `EXPO_PUBLIC_API_BASE_URL` | `http://localhost:3000` | HTTP API |
| `EXPO_PUBLIC_API_WS_URL` | `ws://localhost:3000/realtime` | Realtime WebSocket |
| `EXPO_PUBLIC_MEDIA_BASE_URL` | `http://localhost:3000` | Base of media URLs |

On a physical device, use the machine's LAN address instead of `localhost` and start the API with `BIND_ADDR=0.0.0.0:3000`.

Install the dependencies and build the app on a device or emulator:

```bash
npm install
npm run android
```

`npm run ios` does the same for iOS. After the first build, `npm start` serves the JavaScript to the installed development build.

Check the code with ESLint:

```bash
npm run lint
```

## Structure

```
app/          screens (expo-router): login, waiting for approval, chat list, chat, admin, profile, encryption
components/   chat bubbles, input, reactions, image viewer and other UI pieces
hooks/        data hooks for chats, messages, reactions, members and permissions
lib/          local database, sync, media cache, push tokens and the crypto in lib/crypto
src/api/      HTTP and WebSocket clients for chat-family-api
theme/        theme tokens and the light/dark picker
```

EAS build profiles live in `eas.json`.
