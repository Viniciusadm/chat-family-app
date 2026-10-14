import { AppHeader } from "@/components/AppHeader";
import { ProfileAvatar } from "@/components/ProfileAvatar";
import type { MemberProfile } from "@/hooks/useMemberProfiles";
import type { Chat } from "@/types/chat";
import { Ionicons } from "@expo/vector-icons";

interface ChatHeaderProps {
  chat: Chat | null;
  currentUserId: string;
  memberProfiles: Record<string, MemberProfile>;
  chatTitle: string;
  headerTitle: string;
  onBack: () => void;
}

export function ChatHeader({
  chat,
  currentUserId,
  memberProfiles,
  chatTitle,
  headerTitle,
  onBack,
}: ChatHeaderProps) {
  const otherId =
    chat && !chat.isGroup
      ? chat.participants.find((id) => id !== currentUserId)
      : undefined;
  const otherProfile = otherId ? memberProfiles[otherId] : undefined;
  const photoUrl = chat?.isGroup
    ? chat?.photoUrl ?? undefined
    : otherProfile?.photoUrl ?? undefined;
  const icon: keyof typeof Ionicons.glyphMap = chat?.isGroup
    ? "people-outline"
    : "chatbubble-outline";

  return (
    <AppHeader
      title={headerTitle}
      onBack={onBack}
      leading={
        <ProfileAvatar
          name={otherProfile?.name ?? chatTitle}
          photoUrl={photoUrl}
          icon={icon}
          size={32}
        />
      }
    />
  );
}
