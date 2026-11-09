import { apiFetch } from "./client";

export type ChildMuteScope = "direct" | "all";

export type ChildMuteDto = {
  child_member_id: string;
  muted_by_member_id: string;
  scope: ChildMuteScope;
  expires_at: string;
};

export function listChildMutes() {
  return apiFetch<ChildMuteDto[]>("/child-mutes");
}

export function muteChild(childId: string, scope: ChildMuteScope) {
  return apiFetch<ChildMuteDto>(`/members/${childId}/mute`, {
    method: "PUT",
    body: { scope },
  });
}

export function unmuteChild(childId: string, scope: ChildMuteScope) {
  return apiFetch<{ ok: true }>(`/members/${childId}/mute?scope=${scope}`, {
    method: "DELETE",
  });
}
