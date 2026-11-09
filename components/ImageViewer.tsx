import { ForwardChatPicker } from "@/components/imageViewer/ForwardChatPicker";
import { ImagePager } from "@/components/imageViewer/ImagePager";
import { ViewerFooter } from "@/components/imageViewer/ViewerFooter";
import { ViewerHeader } from "@/components/imageViewer/ViewerHeader";
import {
  ViewerMenu,
  type ViewerMenuItem,
} from "@/components/imageViewer/ViewerMenu";
import {
  OVER_MEDIA_BACKDROP,
  OVER_MEDIA_FOREGROUND,
  OVER_MEDIA_SURFACE,
} from "@/components/imageViewer/overMediaColors";
import type { MemberProfile } from "@/hooks/useMemberProfiles";
import { formatViewerTimestamp } from "@/lib/formatMessageTime";
import { ImageGalleryRepository } from "@/lib/ImageGalleryRepository";
import {
  readImageFileAsBase64,
  resolveMessageImageFile,
} from "@/lib/messageImageFile";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { fontSizes, radius, spacing } from "@/theme/tokens";
import type { Message, Reaction } from "@/types/chat";
import * as Clipboard from "expo-clipboard";
import * as Sharing from "expo-sharing";
import React, { useCallback, useEffect, useRef, useState } from "react";
import {
  Dimensions,
  Keyboard,
  Modal,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Animated, {
  useAnimatedStyle,
  useSharedValue,
  withTiming,
} from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";

interface ImageViewerProps {
  visible: boolean;
  images: Message[];
  initialMessageId: string | null;
  currentUserId: string;
  readOnly: boolean;
  canReply: boolean;
  reactions: Record<string, Reaction[]>;
  memberProfiles: Record<string, MemberProfile>;
  getSenderName: (message: Message) => string;
  canDelete: (message: Message) => boolean;
  onClose: () => void;
  onSendReply: (message: Message, text: string) => void;
  onReact: (messageId: string, emoji: string) => void;
  onShowInChat: (messageId: string) => void;
  onDelete: (message: Message) => void;
  onForward: (message: Message, targetChatId: string) => Promise<boolean>;
}

const FEEDBACK_DURATION_MS = 2000;
const CHROME_FADE_MS = 160;

export function ImageViewer({
  visible,
  images,
  initialMessageId,
  currentUserId,
  readOnly,
  canReply,
  reactions,
  memberProfiles,
  getSenderName,
  canDelete,
  onClose,
  onSendReply,
  onReact,
  onShowInChat,
  onDelete,
  onForward,
}: ImageViewerProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);

  const [currentMessageId, setCurrentMessageId] = useState<string | null>(
    initialMessageId
  );
  const [chromeVisible, setChromeVisible] = useState(true);
  const [menuOpen, setMenuOpen] = useState(false);
  const [forwardOpen, setForwardOpen] = useState(false);
  const [feedback, setFeedback] = useState<string | null>(null);
  const feedbackTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastIndexRef = useRef(0);
  const chromeOpacity = useSharedValue(1);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const bottomInsetRef = useRef(insets.bottom);
  bottomInsetRef.current = insets.bottom;

  useEffect(() => {
    const showEvent =
      Platform.OS === "ios" ? "keyboardWillShow" : "keyboardDidShow";
    const hideEvent =
      Platform.OS === "ios" ? "keyboardWillHide" : "keyboardDidHide";
    const showSubscription = Keyboard.addListener(showEvent, (event) => {
      const { height, screenY } = event.endCoordinates;
      if (Platform.OS !== "android") {
        setKeyboardHeight(height);
        return;
      }
      const fromTopEdge = Dimensions.get("screen").height - screenY;
      setKeyboardHeight(
        Math.max(height + bottomInsetRef.current, fromTopEdge)
      );
    });
    const hideSubscription = Keyboard.addListener(hideEvent, () => {
      setKeyboardHeight(0);
    });
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, []);

  const openKey = visible ? initialMessageId : null;
  const [syncedOpenKey, setSyncedOpenKey] = useState<string | null>(openKey);
  if (openKey !== syncedOpenKey) {
    setSyncedOpenKey(openKey);
    if (openKey !== null) setCurrentMessageId(openKey);
  }

  useEffect(() => {
    if (!visible) return;
    setChromeVisible(true);
    setMenuOpen(false);
    setForwardOpen(false);
    setFeedback(null);
  }, [visible, initialMessageId]);

  useEffect(() => {
    chromeOpacity.value = withTiming(chromeVisible ? 1 : 0, {
      duration: CHROME_FADE_MS,
    });
  }, [chromeVisible, chromeOpacity]);

  useEffect(
    () => () => {
      if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    },
    []
  );

  const foundIndex = images.findIndex(
    (message) => message.id === currentMessageId
  );
  if (foundIndex >= 0) lastIndexRef.current = foundIndex;
  const index =
    foundIndex >= 0
      ? foundIndex
      : Math.min(lastIndexRef.current, images.length - 1);
  const currentMessage = index >= 0 ? images[index] : undefined;

  useEffect(() => {
    if (!visible) return;
    if (images.length === 0) {
      onClose();
      return;
    }
    if (foundIndex < 0 && currentMessage) {
      setCurrentMessageId(currentMessage.id);
    }
  }, [visible, images.length, foundIndex, currentMessage, onClose]);

  const showFeedback = useCallback((text: string) => {
    if (feedbackTimer.current) clearTimeout(feedbackTimer.current);
    setFeedback(text);
    feedbackTimer.current = setTimeout(() => {
      feedbackTimer.current = null;
      setFeedback(null);
    }, FEEDBACK_DURATION_MS);
  }, []);

  const handleIndexChange = useCallback(
    (nextIndex: number) => {
      const next = images[nextIndex];
      if (next) setCurrentMessageId(next.id);
    },
    [images]
  );

  const toggleChrome = useCallback(() => {
    if (keyboardHeight > 0) {
      Keyboard.dismiss();
      return;
    }
    setMenuOpen(false);
    setChromeVisible((value) => !value);
  }, [keyboardHeight]);

  const withImageFile = useCallback(
    async (message: Message, action: (fileUri: string) => Promise<void>) => {
      const fileUri = await resolveMessageImageFile(message).catch(() => null);
      if (!fileUri) {
        showFeedback("Imagem indisponível no momento");
        return;
      }
      await action(fileUri);
    },
    [showFeedback]
  );

  const handleSave = useCallback(() => {
    if (!currentMessage) return;
    void withImageFile(currentMessage, async (fileUri) => {
      const saved = await ImageGalleryRepository.saveToGallery({
        messageId: currentMessage.id,
        fileUri,
      });
      showFeedback(saved ? "Imagem salva na galeria" : "Não foi possível salvar");
    });
  }, [currentMessage, withImageFile, showFeedback]);

  const handleShare = useCallback(() => {
    if (!currentMessage) return;
    void withImageFile(currentMessage, async (fileUri) => {
      const available = await Sharing.isAvailableAsync().catch(() => false);
      if (!available) {
        showFeedback("Compartilhamento indisponível");
        return;
      }
      await Sharing.shareAsync(fileUri).catch(() => {});
    });
  }, [currentMessage, withImageFile, showFeedback]);

  const handleCopy = useCallback(() => {
    if (!currentMessage) return;
    void withImageFile(currentMessage, async (fileUri) => {
      try {
        const base64 = await readImageFileAsBase64(fileUri);
        await Clipboard.setImageAsync(base64);
        showFeedback("Imagem copiada");
      } catch {
        showFeedback("Não foi possível copiar");
      }
    });
  }, [currentMessage, withImageFile, showFeedback]);

  const handleForwardSelect = useCallback(
    (targetChatId: string) => {
      if (!currentMessage) return;
      setForwardOpen(false);
      showFeedback("Encaminhando imagem…");
      void onForward(currentMessage, targetChatId).then((forwarded) => {
        showFeedback(
          forwarded ? "Imagem encaminhada" : "Não foi possível encaminhar"
        );
      });
    },
    [currentMessage, onForward, showFeedback]
  );

  const handleSendReply = useCallback(
    (text: string) => {
      if (!currentMessage) return;
      onSendReply(currentMessage, text);
      showFeedback("Resposta enviada");
    },
    [currentMessage, onSendReply, showFeedback]
  );

  const handleReact = useCallback(
    (emoji: string) => {
      if (!currentMessage) return;
      onReact(currentMessage.id, emoji);
    },
    [currentMessage, onReact]
  );

  const handleRequestClose = useCallback(() => {
    if (forwardOpen) {
      setForwardOpen(false);
      return;
    }
    if (menuOpen) {
      setMenuOpen(false);
      return;
    }
    onClose();
  }, [forwardOpen, menuOpen, onClose]);

  const chromeStyle = useAnimatedStyle(() => ({
    opacity: chromeOpacity.value,
  }));

  const menuItems: ViewerMenuItem[] = currentMessage
    ? [
        {
          key: "show-in-chat",
          label: "Mostrar na conversa",
          icon: "chatbubble-outline",
          onPress: () => {
            onClose();
            onShowInChat(currentMessage.id);
          },
        },
        {
          key: "share",
          label: "Compartilhar",
          icon: "share-social-outline",
          onPress: handleShare,
        },
        {
          key: "copy",
          label: "Copiar imagem",
          icon: "copy-outline",
          onPress: handleCopy,
        },
        ...(!readOnly && canDelete(currentMessage)
          ? [
              {
                key: "delete",
                label: "Apagar",
                icon: "trash-outline" as const,
                destructive: true,
                onPress: () => onDelete(currentMessage),
              },
            ]
          : []),
      ]
    : [];

  const ownReaction = currentMessage
    ? (reactions[currentMessage.id] ?? []).find(
        (reaction) => reaction.userId === currentUserId
      )?.emoji ?? null
    : null;

  const senderName = currentMessage
    ? currentMessage.senderId === currentUserId
      ? "Você"
      : getSenderName(currentMessage)
    : "";

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={handleRequestClose}
    >
      <GestureHandlerRootView style={styles.root}>
        {currentMessage ? (
          <ImagePager
            images={images}
            index={index}
            onIndexChange={handleIndexChange}
            onToggleChrome={toggleChrome}
          />
        ) : null}
        {currentMessage ? (
          <Animated.View
            style={[styles.top, chromeStyle]}
            pointerEvents={chromeVisible ? "box-none" : "none"}
          >
            <ViewerHeader
              topInset={insets.top}
              title={senderName}
              subtitle={formatViewerTimestamp(currentMessage.timestamp)}
              onBack={onClose}
              onSave={handleSave}
              onForward={() => setForwardOpen(true)}
              onOpenMenu={() => setMenuOpen(true)}
            />
          </Animated.View>
        ) : null}
        {currentMessage && !readOnly ? (
          <Animated.View
            style={[styles.bottom, { bottom: keyboardHeight }, chromeStyle]}
            pointerEvents={chromeVisible ? "box-none" : "none"}
          >
            <ViewerFooter
              key={currentMessage.id}
              bottomInset={keyboardHeight > 0 ? 0 : insets.bottom}
              ownReaction={ownReaction}
              onSendReply={canReply ? handleSendReply : undefined}
              onReact={handleReact}
            />
          </Animated.View>
        ) : null}
        {feedback ? (
          <View
            style={[styles.feedback, { bottom: (keyboardHeight > 0 ? keyboardHeight : insets.bottom) + 96 }]}
            pointerEvents="none"
            accessibilityLiveRegion="polite"
          >
            <Text style={styles.feedbackText}>{feedback}</Text>
          </View>
        ) : null}
        {menuOpen && currentMessage ? (
          <ViewerMenu
            topInset={insets.top}
            items={menuItems}
            onClose={() => setMenuOpen(false)}
          />
        ) : null}
        {forwardOpen ? (
          <ForwardChatPicker
            topInset={insets.top}
            bottomInset={insets.bottom}
            memberProfiles={memberProfiles}
            onSelect={handleForwardSelect}
            onClose={() => setForwardOpen(false)}
          />
        ) : null}
      </GestureHandlerRootView>
    </Modal>
  );
}

const createStyles = () =>
  StyleSheet.create({
    root: {
      flex: 1,
      backgroundColor: OVER_MEDIA_BACKDROP,
    },
    top: {
      position: "absolute",
      top: 0,
      left: 0,
      right: 0,
    },
    bottom: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
    },
    feedback: {
      position: "absolute",
      alignSelf: "center",
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      borderRadius: radius.pill,
      backgroundColor: OVER_MEDIA_SURFACE,
    },
    feedbackText: {
      color: OVER_MEDIA_FOREGROUND,
      fontSize: fontSizes.subhead,
    },
  });
