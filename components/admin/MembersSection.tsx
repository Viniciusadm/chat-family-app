import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useToast } from "@/components/Toast";
import { useAuth } from "@/context/AuthContext";
import { useChildMutes } from "@/hooks/useChildMutes";
import {
  findDirectMute,
  findGeneralMute,
  formatMuteUntil,
} from "@/lib/childMutes";
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
import type { AppMember } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import * as Clipboard from "expo-clipboard";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { createAdminCardStyles } from "./adminStyles";
import { SectionTitle } from "./SectionTitle";

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    codeRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.sm,
      marginTop: spacing.xs,
    },
    codeText: {
      fontFamily: "monospace",
      fontSize: fontSizes.footnote,
      color: t.mutedForeground,
      letterSpacing: 1,
    },
    badge: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
    },
    badgeAdult: {
      backgroundColor: t.primary,
    },
    badgeChild: {
      backgroundColor: t.muted,
    },
    badgeText: {
      fontSize: fontSizes.footnote,
      fontWeight: fontWeights.semibold,
      color: t.foreground,
    },
    badgeTextAdult: {
      color: t.primaryForeground,
    },
    muteStatus: {
      flexDirection: "row",
      alignItems: "center",
      gap: spacing.xs,
      marginTop: spacing.xs,
    },
    muteStatusText: {
      fontSize: fontSizes.footnote,
      fontWeight: fontWeights.semibold,
      color: t.destructive,
    },
  });

type MembersSectionProps = {
  members: AppMember[];
  canMutate: boolean;
  onAddUser: () => void;
  onDeleteChild: (member: AppMember) => void;
  onMuteChild: (member: AppMember) => void;
};

export function MembersSection({
  members,
  canMutate,
  onAddUser,
  onDeleteChild,
  onMuteChild,
}: MembersSectionProps) {
  const { theme } = useTheme();
  const cardStyles = useThemedStyles(createAdminCardStyles);
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();
  const { currentUser } = useAuth();
  const { mutes, now } = useChildMutes();

  const muteStatusFor = (member: AppMember) => {
    if (member.role !== "child") return null;
    const general = findGeneralMute(mutes, member.id, now);
    if (general) {
      return `Silêncio geral até ${formatMuteUntil(general.expiresAt, now)}`;
    }
    const direct = currentUser
      ? findDirectMute(mutes, member.id, currentUser.id, now)
      : null;
    return direct
      ? `Silêncio para você até ${formatMuteUntil(direct.expiresAt, now)}`
      : null;
  };

  const copyLoginCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    showToast("Código copiado");
  };

  return (
    <>
      <SectionTitle icon="people-outline" label="Participantes" />
      {members.map((member) => {
        const muteStatus = muteStatusFor(member);
        return (
          <View key={member.id} style={cardStyles.card}>
            <View style={cardStyles.cardRow}>
              <ProfileAvatar
                name={member.name}
                photoUrl={member.photoUrl}
                size={40}
              />
              <View style={cardStyles.cardBody}>
                <Text style={cardStyles.cardTitle}>{member.name}</Text>
                {member.loginCode ? (
                  <View style={styles.codeRow}>
                    <Text style={styles.codeText}>
                      {member.role === "adult"
                        ? `Convite: ${member.loginCode}`
                        : member.loginCode}
                    </Text>
                    <Pressable
                      onPress={() => void copyLoginCode(member.loginCode!)}
                      hitSlop={12}
                      accessibilityRole="button"
                      accessibilityLabel={
                        member.role === "adult"
                          ? `Copiar código de convite de ${member.name}`
                          : `Copiar código de acesso de ${member.name}`
                      }
                      style={({ pressed }) => pressed && cardStyles.pressed}
                    >
                      <Ionicons
                        name="copy-outline"
                        size={18}
                        color={theme.mutedForeground}
                      />
                    </Pressable>
                  </View>
                ) : (
                  <Text style={cardStyles.cardMeta}>Conta com e-mail</Text>
                )}
                {muteStatus ? (
                  <View style={styles.muteStatus}>
                    <Ionicons
                      name="volume-mute"
                      size={14}
                      color={theme.destructive}
                    />
                    <Text style={styles.muteStatusText}>{muteStatus}</Text>
                  </View>
                ) : null}
              </View>
              <View
                style={[
                  styles.badge,
                  member.role === "adult"
                    ? styles.badgeAdult
                    : styles.badgeChild,
                ]}
              >
                <Text
                  maxFontSizeMultiplier={maxFontScale.compact}
                  style={[
                    styles.badgeText,
                    member.role === "adult" && styles.badgeTextAdult,
                  ]}
                >
                  {member.role === "adult" ? "Adulto" : "Criança"}
                </Text>
              </View>
              {canMutate && member.role === "child" ? (
                <Pressable
                  onPress={() => onMuteChild(member)}
                  style={cardStyles.iconAct}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Silenciar ${member.name}`}
                >
                  <Ionicons
                    name={muteStatus ? "volume-mute" : "volume-mute-outline"}
                    size={22}
                    color={muteStatus ? theme.destructive : theme.foreground}
                  />
                </Pressable>
              ) : null}
              {canMutate && member.role === "child" ? (
                <Pressable
                  onPress={() => onDeleteChild(member)}
                  style={cardStyles.iconAct}
                  hitSlop={8}
                  accessibilityRole="button"
                  accessibilityLabel={`Apagar ${member.name}`}
                >
                  <Ionicons
                    name="trash-outline"
                    size={22}
                    color={theme.destructive}
                  />
                </Pressable>
              ) : null}
            </View>
          </View>
        );
      })}
      {canMutate ? (
        <Pressable
          onPress={onAddUser}
          accessibilityRole="button"
          style={({ pressed }) => [
            cardStyles.outlineBtn,
            pressed && cardStyles.pressed,
          ]}
        >
          <Ionicons
            name="person-add-outline"
            size={18}
            color={theme.foreground}
          />
          <Text style={cardStyles.outlineBtnText}>Adicionar participante</Text>
        </Pressable>
      ) : null}
    </>
  );
}
