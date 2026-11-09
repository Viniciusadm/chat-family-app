import { ProfileAvatar } from "@/components/ProfileAvatar";
import type { MemberProfile } from "@/hooks/useMemberProfiles";
import {
  findDirectMute,
  findGeneralMute,
  formatMuteUntil,
  type ChildMute,
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
import type { Chat, UserRole } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";
import { StyleSheet, Text, View } from "react-native";
import { InfoRow } from "./InfoRow";

interface MembersTabProps {
  chat: Chat;
  currentUserId: string;
  currentUserIsAdult: boolean;
  memberProfiles: Record<string, MemberProfile>;
  mutes: ChildMute[];
  now: Date;
  commonGroups: Chat[];
  onAddMembers?: () => void;
  onOpenMember: (memberId: string) => void;
  onOpenChat: (chatId: string) => void;
}

const ROLE_ORDER: Record<UserRole, number> = { adult: 0, child: 1 };

const createStyles = (t: ThemeTokens) =>
  StyleSheet.create({
    sectionHeader: {
      paddingHorizontal: spacing.xl,
      paddingTop: spacing.lg,
      paddingBottom: spacing.sm,
      fontSize: fontSizes.subhead,
      fontWeight: fontWeights.medium,
      color: t.mutedForeground,
    },
    addCircle: {
      width: 44,
      height: 44,
      borderRadius: radius.pill,
      alignItems: "center",
      justifyContent: "center",
      backgroundColor: t.primary,
    },
    badge: {
      paddingHorizontal: spacing.sm,
      paddingVertical: spacing.xs,
      borderRadius: radius.sm,
      backgroundColor: t.muted,
    },
    badgeAdult: {
      backgroundColor: t.primaryTint,
    },
    badgeText: {
      fontSize: fontSizes.footnote,
      fontWeight: fontWeights.medium,
      color: t.mutedForeground,
    },
    badgeTextAdult: {
      color: t.primary,
    },
    empty: {
      paddingHorizontal: spacing.xl,
      paddingVertical: spacing.xxl,
      fontSize: fontSizes.subhead,
      color: t.mutedForeground,
      textAlign: "center",
    },
  });

function RoleBadge({ role }: { role: UserRole }) {
  const styles = useThemedStyles(createStyles);
  const isAdult = role === "adult";
  return (
    <View style={[styles.badge, isAdult && styles.badgeAdult]}>
      <Text
        style={[styles.badgeText, isAdult && styles.badgeTextAdult]}
        maxFontSizeMultiplier={maxFontScale.compact}
      >
        {isAdult ? "Adulto" : "Criança"}
      </Text>
    </View>
  );
}

export function MembersTab({
  chat,
  currentUserId,
  currentUserIsAdult,
  memberProfiles,
  mutes,
  now,
  commonGroups,
  onAddMembers,
  onOpenMember,
  onOpenChat,
}: MembersTabProps) {
  const { theme } = useTheme();
  const styles = useThemedStyles(createStyles);

  const muteLabel = (memberId: string, role: UserRole | undefined) => {
    if (role !== "child") return null;
    const general = findGeneralMute(mutes, memberId, now);
    if (general) {
      return `Silêncio geral até ${formatMuteUntil(general.expiresAt, now)}`;
    }
    const direct = currentUserIsAdult
      ? findDirectMute(mutes, memberId, currentUserId, now)
      : null;
    return direct
      ? `Silêncio para você até ${formatMuteUntil(direct.expiresAt, now)}`
      : null;
  };

  if (!chat.isGroup) {
    return (
      <View>
        <Text style={styles.sectionHeader}>
          {commonGroups.length === 0
            ? "Grupos em comum"
            : `${commonGroups.length} ${commonGroups.length === 1 ? "grupo" : "grupos"} em comum`}
        </Text>
        {commonGroups.length === 0 ? (
          <Text style={styles.empty}>
            Vocês ainda não estão em nenhum grupo juntos.
          </Text>
        ) : (
          commonGroups.map((group) => (
            <InfoRow
              key={group.id}
              title={group.name}
              subtitle={`${group.participants.length} membros`}
              leading={
                <ProfileAvatar
                  name={group.name}
                  photoUrl={group.photoUrl}
                  icon="people-outline"
                  size={44}
                />
              }
              onPress={() => onOpenChat(group.id)}
            />
          ))
        )}
      </View>
    );
  }

  const members = [...chat.participants].sort((a, b) => {
    if (a === currentUserId) return -1;
    if (b === currentUserId) return 1;
    const roleA = ROLE_ORDER[memberProfiles[a]?.role ?? "child"];
    const roleB = ROLE_ORDER[memberProfiles[b]?.role ?? "child"];
    if (roleA !== roleB) return roleA - roleB;
    return (memberProfiles[a]?.name ?? "").localeCompare(
      memberProfiles[b]?.name ?? "",
      "pt-BR",
    );
  });

  return (
    <View>
      <Text style={styles.sectionHeader}>
        {members.length} {members.length === 1 ? "membro" : "membros"}
      </Text>
      {onAddMembers ? (
        <InfoRow
          title="Adicionar membros"
          leading={
            <View style={styles.addCircle}>
              <Ionicons
                name="person-add"
                size={20}
                color={theme.primaryForeground}
              />
            </View>
          }
          onPress={onAddMembers}
        />
      ) : null}
      {members.map((memberId) => {
        const profile = memberProfiles[memberId];
        const isSelf = memberId === currentUserId;
        const name = isSelf ? "Você" : (profile?.name ?? "Participante");
        return (
          <InfoRow
            key={memberId}
            title={name}
            subtitle={muteLabel(memberId, profile?.role)}
            leading={
              <ProfileAvatar
                name={profile?.name ?? name}
                photoUrl={profile?.photoUrl}
                size={44}
              />
            }
            trailing={profile ? <RoleBadge role={profile.role} /> : null}
            onPress={isSelf ? undefined : () => onOpenMember(memberId)}
            accessibilityLabel={`Ver perfil de ${name}`}
          />
        );
      })}
    </View>
  );
}
