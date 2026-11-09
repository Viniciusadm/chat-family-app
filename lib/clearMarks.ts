export function isClearedByMark(createdAt: Date, clearMark: string | null) {
  return clearMark !== null && createdAt.toISOString() <= clearMark;
}
