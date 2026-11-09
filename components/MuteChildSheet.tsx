import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { useChildMutes } from "@/hooks/useChildMutes";
import {
  findDirectMute,
  findGeneralMute,
  formatMuteUntil,
  type ChildMute,
  type ChildMuteScope,
} from "@/lib/childMutes";
import { useTheme } from "@/theme/ThemeContext";
import {
  fontSizes,
  fontWeights,
  maxFontScale,
  radius,
  spacing,
  type ThemeTokens,
} from "@/theme/tokens";
import { useThemedStyles } from "@/theme/useThemedStyles";
import { Ionicons } from "@expo/vector-icons";
import React, { useState } from "react";
import { showAlert } from "@/components/AppAlert";
import {
  ActivityIndicator,
  Modal,
  Pressable,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

type MuteAction = "mute" | "unmute";

interface MuteChildSheetProps {
  visible: boolean;
  childId: string;
  childName: string;
  showDirectOption: boolean;
  onClose: () => void;
}

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    backdrop: {
      flex: 1,
      backgroundColor: t.modalBackdrop,
      justifyContent: "flex-end",
    },
    sheet: {
      backgroundColor: t.background,
      borderTopLeftRadius: radius.xxl,
      borderTopRightRadius: radius.xxl,
      paddingHorizontal: spacing.xxl,
      paddingTop: spacing.xxl,
      gap: spacing.lg,
    },
    title: {
      fontSize: fontSizes.headline,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
    },
    subtitle: {
      fontSize: fontSizes.subhead,
      color: t.mutedForeground,
      marginTop: spacing.xs,
    },
    option: {
      borderRadius: radius.lg,
      backgroundColor: t.muted,
      padding: spacing.lg,
      gap: spacing.md,
    },
    optionHeader: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.md,
    },
    optionIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.primaryTint,
    },
    optionIconActive: {
      backgroundColor: t.destructive,
    },
    optionBody: {
      flex: 1,
    },
    optionTitle: {
      fontSize: fontSizes.body,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
    },
    optionMeta: {
      fontSize: fontSizes.footnote,
      color: t.mutedForeground,
      marginTop: 2,
    },
    optionMetaActive: {
      color: t.destructive,
      fontWeight: fontWeights.semibold,
    },
    buttons: {
      flexDirection: "row",
      gap: spacing.sm,
    },
    button: {
      flex: 1,
      minHeight: 44,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.primary,
    },
    buttonOutline: {
      backgroundColor: "transparent",
      borderWidth: 1,
      borderColor: t.controlBorder,
    },
    buttonText: {
      fontSize: fontSizes.subhead,
      fontWeight: fontWeights.semibold,
      color: t.primaryForeground,
    },
    buttonOutlineText: {
      color: t.foreground,
    },
    pressed: {
      opacity: 0.75,
    },
  });

interface MuteOptionProps {
  scope: ChildMuteScope;
  title: string;
  description: string;
  mute: ChildMute | null;
  now: Date;
  busy: boolean;
  disabled: boolean;
  onAction: (action: MuteAction, scope: ChildMuteScope) => void;
}

function MuteOption({
  scope,
  title,
  description,
  mute,
  now,
  busy,
  disabled,
  onAction,
}: MuteOptionProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);
  const active = mute !== null;

  const renderButton = (
    action: MuteAction,
    label: string,
    outline: boolean,
    accessibilityLabel: string,
  ) => (
    <Pressable
      onPress={() => onAction(action, scope)}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={accessibilityLabel}
      accessibilityState={{ disabled, busy }}
      style={({ pressed }) => [
        styles.button,
        outline && styles.buttonOutline,
        (pressed || disabled) && styles.pressed,
      ]}
    >
      {busy && !outline ? (
        <ActivityIndicator color={theme.primaryForeground} />
      ) : (
        <Text
          maxFontSizeMultiplier={maxFontScale.compact}
          style={[styles.buttonText, outline && styles.buttonOutlineText]}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );

  return (
    <View style={styles.option}>
      <View style={styles.optionHeader}>
        <View style={[styles.optionIcon, active && styles.optionIconActive]}>
          <Ionicons
            name={scope === "all" ? "people-outline" : "person-outline"}
            size={20}
            color={active ? theme.destructiveForeground : theme.primary}
          />
        </View>
        <View style={styles.optionBody}>
          <Text style={styles.optionTitle}>{title}</Text>
          <Text style={[styles.optionMeta, active && styles.optionMetaActive]}>
            {mute
              ? `Silêncio ativo até ${formatMuteUntil(mute.expiresAt, now)}`
              : description}
          </Text>
        </View>
      </View>
      <View style={styles.buttons}>
        {active ? (
          <>
            {renderButton(
              "unmute",
              "Cancelar",
              true,
              `Cancelar silêncio: ${title}`,
            )}
            {renderButton(
              "mute",
              "Renovar 1h",
              false,
              `Renovar silêncio por 1 hora: ${title}`,
            )}
          </>
        ) : (
          renderButton(
            "mute",
            "Silenciar por 1h",
            false,
            `Silenciar por 1 hora: ${title}`,
          )
        )}
      </View>
    </View>
  );
}

export function MuteChildSheet({
  visible,
  childId,
  childName,
  showDirectOption,
  onClose,
}: MuteChildSheetProps) {
  const insets = useSafeAreaInsets();
  const styles = useThemedStyles(createStyles);
  const { currentUser } = useAuth();
  const { showToast } = useToast();
  const { mutes, now, mute, unmute } = useChildMutes();
  const [busyScope, setBusyScope] = useState<ChildMuteScope | null>(null);
  const busy = busyScope !== null;
  const directMute = currentUser
    ? findDirectMute(mutes, childId, currentUser.id, now)
    : null;
  const generalMute = findGeneralMute(mutes, childId, now);

  const onAction = async (action: MuteAction, scope: ChildMuteScope) => {
    if (busy) return;
    setBusyScope(scope);
    try {
      if (action === "mute") {
        await mute(childId, scope);
        showToast(
          scope === "all"
            ? `Silêncio de 1h ativado para ${childName} em todas as conversas`
            : `Silêncio de 1h ativado para ${childName}`,
        );
      } else {
        await unmute(childId, scope);
        showToast("Silêncio cancelado");
      }
      onClose();
    } catch {
      showAlert(
        "Não foi possível alterar o silêncio",
        "Verifique sua conexão e tente novamente.",
      );
    } finally {
      setBusyScope(null);
    }
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <Pressable
        style={styles.backdrop}
        onPress={onClose}
        accessibilityLabel="Fechar opções de silêncio"
      >
        <Pressable
          style={[styles.sheet, { paddingBottom: insets.bottom + spacing.xxl }]}
          onPress={() => {}}
        >
          <View>
            <Text style={styles.title}>Silenciar {childName}</Text>
            <Text style={styles.subtitle}>
              Durante 1 hora, {childName} não consegue enviar mensagens. Ainda
              dá para ler e reagir.
            </Text>
          </View>
          {showDirectOption ? (
            <MuteOption
              scope="direct"
              title="Só para mim"
              description="Bloqueia apenas a conversa com você"
              mute={directMute}
              now={now}
              busy={busyScope === "direct"}
              disabled={busy}
              onAction={(action, scope) => void onAction(action, scope)}
            />
          ) : null}
          <MuteOption
            scope="all"
            title="Em todas as conversas"
            description="Bloqueia conversas e grupos"
            mute={generalMute}
            now={now}
            busy={busyScope === "all"}
            disabled={busy}
            onAction={(action, scope) => void onAction(action, scope)}
          />
        </Pressable>
      </Pressable>
    </Modal>
  );
}
