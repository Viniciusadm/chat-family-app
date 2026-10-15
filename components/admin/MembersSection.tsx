import { ProfileAvatar } from "@/components/ProfileAvatar";
import { useToast } from "@/components/Toast";
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
  });

type MembersSectionProps = {
  members: AppMember[];
  canMutate: boolean;
  onAddUser: () => void;
  onDeleteChild: (member: AppMember) => void;
};

export function MembersSection({
  members,
  canMutate,
  onAddUser,
  onDeleteChild,
}: MembersSectionProps) {
  const { theme } = useTheme();
  const cardStyles = useThemedStyles(createAdminCardStyles);
  const styles = useThemedStyles(createStyles);
  const { showToast } = useToast();

  const copyLoginCode = async (code: string) => {
    await Clipboard.setStringAsync(code);
    showToast("Código copiado");
  };

  return (
    <>
      <SectionTitle icon="people-outline" label="Participantes" />
      {members.map((member) => (
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
            </View>
            <View
              style={[
                styles.badge,
                member.role === "adult" ? styles.badgeAdult : styles.badgeChild,
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
      ))}
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
