import { setRecordingSessionActive } from "@/lib/audioSession";
import { lightImpact } from "@/lib/haptics";
import {
  RecordingPresets,
  requestRecordingPermissionsAsync,
  setAudioModeAsync,
  useAudioRecorder,
} from "expo-audio";
import { useCallback, useEffect, useLayoutEffect, useRef, useState } from "react";

const MIN_RECORDING_MS = 1000;

export interface VoiceRecording {
  uri: string;
  durationMillis: number;
}

const restorePlaybackMode = async () => {
  setRecordingSessionActive(false);
  try {
    await setAudioModeAsync({
      allowsRecording: false,
      playsInSilentMode: true,
    });
  } catch {
    //
  }
};

export function useVoiceRecorder() {
  const audioRecorder = useAudioRecorder(RecordingPresets.HIGH_QUALITY);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingSeconds, setRecordingSeconds] = useState(0);
  const recordingActiveRef = useRef(false);
  const recordSessionRef = useRef(0);
  const recordingStartMsRef = useRef(0);

  useEffect(() => {
    if (!isRecording) return;

    const updateElapsed = () => {
      setRecordingSeconds(
        Math.floor((Date.now() - recordingStartMsRef.current) / 1000)
      );
    };

    updateElapsed();
    const interval = setInterval(updateElapsed, 250);
    return () => {
      clearInterval(interval);
    };
  }, [isRecording]);

  const resetRecordingState = useCallback(() => {
    recordingActiveRef.current = false;
    recordingStartMsRef.current = 0;
    setIsRecording(false);
    setRecordingSeconds(0);
  }, []);

  const isRecordingActive = useCallback(() => recordingActiveRef.current, []);

  const startRecording = async () => {
    if (isRecording) return;
    const session = ++recordSessionRef.current;
    try {
      const perm = await requestRecordingPermissionsAsync();
      if (!perm.granted || recordSessionRef.current !== session) return;
      setRecordingSessionActive(true);
      await setAudioModeAsync({
        allowsRecording: true,
        playsInSilentMode: true,
        shouldPlayInBackground: false,
      });
      await audioRecorder.prepareToRecordAsync();
      if (recordSessionRef.current !== session) {
        await restorePlaybackMode();
        return;
      }
      audioRecorder.record();
      if (recordSessionRef.current !== session) {
        await audioRecorder.stop().catch(() => {});
        resetRecordingState();
        await restorePlaybackMode();
        return;
      }
      recordingActiveRef.current = true;
      recordingStartMsRef.current = Date.now();
      setRecordingSeconds(0);
      setIsRecording(true);
      lightImpact();
    } catch {
      if (recordSessionRef.current === session) {
        resetRecordingState();
      }
      await restorePlaybackMode();
    }
  };

  const stopRecording = async (
    onRecorded: (recording: VoiceRecording) => Promise<void>
  ) => {
    recordSessionRef.current += 1;
    const wasRecording = recordingActiveRef.current;
    const startedAtMs = recordingStartMsRef.current;
    resetRecordingState();
    if (!wasRecording) return;
    lightImpact();
    try {
      const durationMillis = audioRecorder.getStatus().durationMillis;
      await audioRecorder.stop();
      const elapsedMs =
        durationMillis > 0 ? durationMillis : Date.now() - startedAtMs;
      const uri = audioRecorder.uri;
      if (!uri || elapsedMs < MIN_RECORDING_MS) {
        await restorePlaybackMode();
        return;
      }
      await onRecorded({ uri, durationMillis });
    } catch {
      //
    }
    await restorePlaybackMode();
  };

  useLayoutEffect(() => {
    return () => {
      recordSessionRef.current += 1;
      if (!recordingActiveRef.current) return;
      recordingActiveRef.current = false;
      setRecordingSessionActive(false);
      void audioRecorder
        .stop()
        .catch(() => {})
        .finally(() => {
          void setAudioModeAsync({
            allowsRecording: false,
            playsInSilentMode: true,
          }).catch(() => {});
        });
    };
  }, [audioRecorder]);

  return {
    isRecording,
    recordingSeconds,
    isRecordingActive,
    startRecording,
    stopRecording,
  };
}
