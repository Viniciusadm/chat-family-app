const inFlightMessageIds = new Set<string>();

export function tryLockMessage(messageId: string): boolean {
  if (inFlightMessageIds.has(messageId)) return false;
  inFlightMessageIds.add(messageId);
  return true;
}

export function unlockMessage(messageId: string) {
  inFlightMessageIds.delete(messageId);
}

export function isMessageLocked(messageId: string): boolean {
  return inFlightMessageIds.has(messageId);
}
