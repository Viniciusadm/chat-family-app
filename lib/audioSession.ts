import { setAudioModeAsync } from "expo-audio";

let recordingSessionActive = false;

export function setRecordingSessionActive(active: boolean) {
  recordingSessionActive = active;
}

export function isRecordingSessionActive() {
  return recordingSessionActive;
}

export async function ensurePlaybackAudioMode() {
  if (recordingSessionActive) return;
  await setAudioModeAsync({
    allowsRecording: false,
    playsInSilentMode: true,
    shouldPlayInBackground: false,
  }).catch(() => {});
}
