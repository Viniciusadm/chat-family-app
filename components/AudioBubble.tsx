import { isRemoteUrl, mediaAuthHeaders } from "@/src/api/client";
import { useTheme } from "@/theme/ThemeContext";
import { useThemedStyles } from "@/theme/useThemedStyles";
import {
  fontSizes,
  fontWeights,
  maxFontScale,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { Ionicons } from "@expo/vector-icons";
import { ensurePlaybackAudioMode } from "@/lib/audioSession";
import {
  type AudioSource,
  useAudioPlayer,
  useAudioPlayerStatus,
} from "expo-audio";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ActivityIndicator,
  LayoutChangeEvent,
  PanResponder,
  Pressable,
  StyleSheet,
  Text,
  useWindowDimensions,
  View,
} from "react-native";

interface AudioBubbleProps {
  messageId: string;
  audioUrl: string;
  audioDuration?: number;
  isSelf: boolean;
  shouldPlay: boolean;
  nextInSequenceId?: string;
  playbackRate: 1 | 1.5 | 2;
  onRequestPlay: (messageId: string) => void;
  onAudioFinished: (nextMessageId?: string) => void;
  onPlaybackRateChange: (rate: 1 | 1.5 | 2) => void;
}

function formatTime(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, "0")}`;
}

const PLAYBACK_RATES: (1 | 1.5 | 2)[] = [1, 1.5, 2];
const ROW_PREFERRED_MIN_WIDTH = 240;
const BUBBLE_MAX_WIDTH_RATIO = 0.8;
const BUBBLE_CHROME_WIDTH = 80;
const SEEK_STEP_SECONDS = 5;

function buildAudioSource(audioUrl: string): AudioSource {
  return {
    uri: audioUrl,
    headers: isRemoteUrl(audioUrl) ? mediaAuthHeaders() : undefined,
  };
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    row: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    playBtn: {
      width: 42,
      height: 42,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
    },
    playSelf: {
      backgroundColor: t.primaryTintStrong,
    },
    playOther: {
      backgroundColor: t.muted,
    },
    playDisabled: {
      opacity: 0.7,
    },
    trackCol: {
      flex: 1,
      gap: spacing.xxs,
    },
    rateBtn: {
      minWidth: 34,
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.md,
      backgroundColor: t.progressTrack,
    },
    rateText: {
      fontSize: fontSizes.caption,
      fontWeight: fontWeights.semibold,
      color: t.timestamp,
    },
    trackHitArea: {
      height: 28,
      justifyContent: "center",
    },
    track: {
      height: 6,
      borderRadius: radius.pill,
      backgroundColor: t.border,
      overflow: "hidden",
    },
    fill: {
      height: "100%",
      borderRadius: radius.pill,
      backgroundColor: t.audioProgress,
    },
    knob: {
      position: "absolute",
      top: 7,
      width: 14,
      height: 14,
      marginLeft: -7,
      borderRadius: radius.pill,
      backgroundColor: t.audioProgress,
      borderWidth: 2,
      borderColor: t.background,
      shadowColor: t.shadow,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: t.shadowOpacity * 2,
      shadowRadius: 2,
      elevation: 2,
    },
    time: {
      fontSize: fontSizes.caption,
      color: t.timestamp,
    },
  });

export function AudioBubble({
  messageId,
  audioUrl,
  audioDuration,
  isSelf,
  shouldPlay,
  nextInSequenceId,
  playbackRate,
  onRequestPlay,
  onAudioFinished,
  onPlaybackRateChange,
}: AudioBubbleProps) {
  const { theme } = useTheme();
  const { width: windowWidth } = useWindowDimensions();
  const rowMinWidth = Math.min(
    ROW_PREFERRED_MIN_WIDTH,
    Math.round(windowWidth * BUBBLE_MAX_WIDTH_RATIO - BUBBLE_CHROME_WIDTH)
  );
  const styles = useThemedStyles(createStyles);
  const [initialSource] = useState(() => buildAudioSource(audioUrl));
  const player = useAudioPlayer(initialSource, { updateInterval: 200 });
  const status = useAudioPlayerStatus(player);
  const loadedAudioUrlRef = useRef(audioUrl);
  const isActiveRef = useRef(shouldPlay);
  const finishHandledRef = useRef(false);
  const onAudioFinishedRef = useRef(onAudioFinished);
  const [waitingForPlayback, setWaitingForPlayback] = useState(false);
  const [trackWidth, setTrackWidth] = useState(0);
  const playbackTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoPlayAttemptedRef = useRef(false);
  const trackRef = useRef<View>(null);
  const trackMetricsRef = useRef({ x: 0, width: 0 });

  const stopWaitingForPlayback = useCallback(() => {
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
      playbackTimeoutRef.current = null;
    }
    setWaitingForPlayback(false);
  }, []);

  const startWaitingForPlayback = useCallback(() => {
    if (playbackTimeoutRef.current) {
      clearTimeout(playbackTimeoutRef.current);
    }
    setWaitingForPlayback(true);
    playbackTimeoutRef.current = setTimeout(() => {
      playbackTimeoutRef.current = null;
      setWaitingForPlayback(false);
    }, 8000);
  }, []);

  useEffect(() => {
    onAudioFinishedRef.current = onAudioFinished;
  }, [onAudioFinished]);

  useEffect(() => {
    if (loadedAudioUrlRef.current === audioUrl) return;
    if (status.playing || waitingForPlayback || status.currentTime > 0) return;
    loadedAudioUrlRef.current = audioUrl;
    player.replace(buildAudioSource(audioUrl));
    player.setPlaybackRate(playbackRate);
  }, [audioUrl, player, playbackRate, status.currentTime, status.playing, waitingForPlayback]);

  useEffect(() => {
    return () => {
      if (playbackTimeoutRef.current) {
        clearTimeout(playbackTimeoutRef.current);
      }
    };
  }, []);

  useEffect(() => {
    player.setPlaybackRate(playbackRate);
  }, [playbackRate, player]);

  useEffect(() => {
    const wasActive = isActiveRef.current;
    isActiveRef.current = shouldPlay;
    if (wasActive && !shouldPlay) {
      player.pause();
    }
  }, [player, shouldPlay]);

  useEffect(() => {
    if (!shouldPlay) {
      autoPlayAttemptedRef.current = false;
      return;
    }
    if (status.playing || waitingForPlayback || autoPlayAttemptedRef.current) return;

    autoPlayAttemptedRef.current = true;
    startWaitingForPlayback();
    void ensurePlaybackAudioMode().then(() => {
      if (!isActiveRef.current) {
        stopWaitingForPlayback();
        return;
      }
      try {
        player.play();
      } catch {
        stopWaitingForPlayback();
      }
    });
  }, [
    player,
    shouldPlay,
    startWaitingForPlayback,
    status.playing,
    stopWaitingForPlayback,
    waitingForPlayback,
  ]);

  useEffect(() => {
    if (status.playing || status.didJustFinish || !shouldPlay) {
      stopWaitingForPlayback();
    }
  }, [shouldPlay, status.didJustFinish, status.playing, stopWaitingForPlayback]);

  useEffect(() => {
    if (!status.didJustFinish) {
      finishHandledRef.current = false;
      return;
    }
    if (finishHandledRef.current) return;
    finishHandledRef.current = true;
    player.pause();
    onAudioFinishedRef.current(nextInSequenceId);
  }, [nextInSequenceId, player, status.didJustFinish]);

  const togglePlay = useCallback(async () => {
    if (status.playing) {
      stopWaitingForPlayback();
      player.pause();
    } else {
      if (status.didJustFinish || status.currentTime >= status.duration) {
        await player.seekTo(0);
      }
      onRequestPlay(messageId);
      startWaitingForPlayback();
      await ensurePlaybackAudioMode();
      try {
        await player.play();
      } catch {
        stopWaitingForPlayback();
      }
    }
  }, [
    messageId,
    onRequestPlay,
    player,
    startWaitingForPlayback,
    status.currentTime,
    status.didJustFinish,
    status.duration,
    status.playing,
    stopWaitingForPlayback,
  ]);

  const cyclePlaybackRate = useCallback(() => {
    const index = PLAYBACK_RATES.indexOf(playbackRate);
    const nextRate = PLAYBACK_RATES[(index + 1) % PLAYBACK_RATES.length];
    onPlaybackRateChange(nextRate);
  }, [onPlaybackRateChange, playbackRate]);

  const statusDuration = Number.isFinite(status.duration) ? status.duration : 0;
  const persistedDuration =
    typeof audioDuration === "number" && Number.isFinite(audioDuration)
      ? audioDuration
      : 0;
  const duration = statusDuration > 0 ? statusDuration : persistedDuration;
  const progress = duration > 0 ? Math.min(status.currentTime / duration, 1) : 0;
  const currentTime = duration ? progress * duration : 0;
  const isPlaying = status.playing;
  const isLoading = waitingForPlayback && !isPlaying;
  const canSeek = duration > 0 && trackWidth > 0;

  const measureTrack = useCallback(() => {
    trackRef.current?.measureInWindow((x, _y, width) => {
      trackMetricsRef.current = { x, width };
      setTrackWidth(width);
    });
  }, []);

  const handleTrackLayout = useCallback((event: LayoutChangeEvent) => {
    const width = event.nativeEvent.layout.width;
    trackMetricsRef.current = { ...trackMetricsRef.current, width };
    setTrackWidth(width);
    measureTrack();
  }, [measureTrack]);

  const seekToPagePosition = useCallback((pageX: number) => {
    const { x, width } = trackMetricsRef.current;
    if (!canSeek || width <= 0) return;

    const nextProgress = Math.min(Math.max((pageX - x) / width, 0), 1);
    stopWaitingForPlayback();
    void player.seekTo(nextProgress * duration).catch(() => {});
  }, [canSeek, duration, player, stopWaitingForPlayback]);

  const syncTrackPositionFromTouch = useCallback((pageX: number, locationX: number) => {
    const width = trackMetricsRef.current.width || trackWidth;
    trackMetricsRef.current = { x: pageX - locationX, width };
  }, [trackWidth]);

  const trackPanResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => canSeek,
        onMoveShouldSetPanResponder: () => canSeek,
        onPanResponderGrant: (event) => {
          measureTrack();
          syncTrackPositionFromTouch(
            event.nativeEvent.pageX,
            event.nativeEvent.locationX,
          );
          seekToPagePosition(event.nativeEvent.pageX);
        },
        onPanResponderMove: (_event, gestureState) => {
          seekToPagePosition(gestureState.moveX);
        },
        onPanResponderTerminationRequest: () => true,
      }),
    [canSeek, measureTrack, seekToPagePosition, syncTrackPositionFromTouch],
  );

  const seekBy = (deltaSeconds: number) => {
    if (duration <= 0) return;
    const target = Math.min(Math.max(currentTime + deltaSeconds, 0), duration);
    stopWaitingForPlayback();
    void player.seekTo(target).catch(() => {});
  };

  return (
    <View style={[styles.row, { minWidth: rowMinWidth }]}>
      <Pressable
        onPress={() => void togglePlay()}
        disabled={isLoading}
        accessibilityRole="button"
        accessibilityLabel={
          isLoading
            ? "Carregando áudio"
            : isPlaying
              ? "Pausar áudio"
              : "Reproduzir áudio"
        }
        accessibilityState={{ disabled: isLoading, busy: isLoading }}
        style={[
          styles.playBtn,
          isSelf ? styles.playSelf : styles.playOther,
          isLoading ? styles.playDisabled : undefined,
        ]}
      >
        {isLoading ? (
          <ActivityIndicator size="small" color={theme.primary} />
        ) : (
          <Ionicons
            name={isPlaying ? "pause" : "play"}
            size={20}
            color={theme.primary}
            style={isPlaying ? undefined : { marginLeft: spacing.xxs }}
          />
        )}
      </Pressable>
      <Pressable
        onPress={cyclePlaybackRate}
        style={styles.rateBtn}
        hitSlop={{ top: 11, bottom: 11, left: 6, right: 6 }}
        accessibilityRole="button"
        accessibilityLabel={`Velocidade ${playbackRate.toFixed(1).replace(".", ",")}x`}
        accessibilityHint="Altera a velocidade de reprodução"
      >
        <Text
          style={styles.rateText}
          maxFontSizeMultiplier={maxFontScale.compact}
        >
          {playbackRate.toFixed(1)}x
        </Text>
      </Pressable>
      <View style={styles.trackCol}>
        <View
          ref={trackRef}
          style={styles.trackHitArea}
          onLayout={handleTrackLayout}
          accessible
          accessibilityRole="adjustable"
          accessibilityLabel="Posição do áudio"
          accessibilityValue={{
            text: `${formatTime(currentTime)} de ${formatTime(duration)}`,
          }}
          accessibilityActions={[
            { name: "increment", label: "Avançar" },
            { name: "decrement", label: "Voltar" },
          ]}
          onAccessibilityAction={(event) => {
            if (event.nativeEvent.actionName === "increment") {
              seekBy(SEEK_STEP_SECONDS);
            } else if (event.nativeEvent.actionName === "decrement") {
              seekBy(-SEEK_STEP_SECONDS);
            }
          }}
          {...trackPanResponder.panHandlers}
        >
          <View style={styles.track}>
            <View style={[styles.fill, { width: `${progress * 100}%` }]} />
          </View>
          <View
            pointerEvents="none"
            style={[
              styles.knob,
              { left: `${progress * 100}%` },
            ]}
          />
        </View>
        <Text style={styles.time}>
          {isPlaying ? formatTime(currentTime) : formatTime(duration ?? 0)}
        </Text>
      </View>
    </View>
  );
}
