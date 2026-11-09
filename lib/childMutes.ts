import type { ChildMuteDto, ChildMuteScope } from "@/src/api/childMutes";
import type { Chat } from "@/types/chat";

export type { ChildMuteScope };

export interface ChildMute {
  childId: string;
  mutedById: string;
  scope: ChildMuteScope;
  expiresAt: Date;
}

export interface ChildSendBlock {
  scope: ChildMuteScope;
  mutedById: string;
  expiresAt: Date;
}

export function childMuteFromDto(dto: ChildMuteDto): ChildMute {
  return {
    childId: dto.child_member_id,
    mutedById: dto.muted_by_member_id,
    scope: dto.scope,
    expiresAt: new Date(dto.expires_at),
  };
}

export function isMuteActive(mute: ChildMute, now: Date): boolean {
  return mute.expiresAt.getTime() > now.getTime();
}

export function activeMutes(mutes: ChildMute[], now: Date): ChildMute[] {
  return mutes.filter((mute) => isMuteActive(mute, now));
}

function latest(mutes: ChildMute[]): ChildMute | null {
  return mutes.reduce<ChildMute | null>(
    (best, mute) =>
      !best || mute.expiresAt.getTime() > best.expiresAt.getTime()
        ? mute
        : best,
    null,
  );
}

export function findGeneralMute(
  mutes: ChildMute[],
  childId: string,
  now: Date,
): ChildMute | null {
  return latest(
    activeMutes(mutes, now).filter(
      (mute) => mute.childId === childId && mute.scope === "all",
    ),
  );
}

export function findDirectMute(
  mutes: ChildMute[],
  childId: string,
  adultId: string,
  now: Date,
): ChildMute | null {
  return latest(
    activeMutes(mutes, now).filter(
      (mute) =>
        mute.childId === childId &&
        mute.mutedById === adultId &&
        mute.scope === "direct",
    ),
  );
}

export function childSendBlock(
  mutes: ChildMute[],
  childId: string,
  chat: Pick<Chat, "isGroup" | "participants"> | null,
  now: Date,
): ChildSendBlock | null {
  const general = findGeneralMute(mutes, childId, now);
  if (general) {
    return {
      scope: "all",
      mutedById: general.mutedById,
      expiresAt: general.expiresAt,
    };
  }
  if (!chat || chat.isGroup) return null;
  const otherId = chat.participants.find((id) => id !== childId);
  if (!otherId) return null;
  const direct = findDirectMute(mutes, childId, otherId, now);
  return direct
    ? {
        scope: "direct",
        mutedById: direct.mutedById,
        expiresAt: direct.expiresAt,
      }
    : null;
}

export function nextExpiry(mutes: ChildMute[], now: Date): Date | null {
  return activeMutes(mutes, now).reduce<Date | null>(
    (soonest, mute) =>
      !soonest || mute.expiresAt.getTime() < soonest.getTime()
        ? mute.expiresAt
        : soonest,
    null,
  );
}

function isSameDay(a: Date, b: Date): boolean {
  return (
    a.getFullYear() === b.getFullYear() &&
    a.getMonth() === b.getMonth() &&
    a.getDate() === b.getDate()
  );
}

export function formatMuteUntil(
  expiresAt: Date,
  now: Date = new Date(),
): string {
  const time = expiresAt.toLocaleTimeString("pt-BR", {
    hour: "2-digit",
    minute: "2-digit",
  });
  return isSameDay(expiresAt, now) ? time : `amanhã ${time}`;
}
