import { isMessageLocked, tryLockMessage, unlockMessage } from "@/lib/outboxLocks";

describe("outbox locks", () => {
  afterEach(() => {
    unlockMessage("a");
    unlockMessage("b");
  });

  it("acquires a lock for an unlocked message", () => {
    expect(isMessageLocked("a")).toBe(false);
    expect(tryLockMessage("a")).toBe(true);
    expect(isMessageLocked("a")).toBe(true);
  });

  it("refuses a second lock on the same message while it is held", () => {
    tryLockMessage("a");
    expect(tryLockMessage("a")).toBe(false);
    expect(isMessageLocked("a")).toBe(true);
  });

  it("locks different messages independently", () => {
    expect(tryLockMessage("a")).toBe(true);
    expect(tryLockMessage("b")).toBe(true);
    unlockMessage("a");
    expect(isMessageLocked("a")).toBe(false);
    expect(isMessageLocked("b")).toBe(true);
  });

  it("allows relocking after unlocking", () => {
    tryLockMessage("a");
    unlockMessage("a");
    expect(isMessageLocked("a")).toBe(false);
    expect(tryLockMessage("a")).toBe(true);
  });

  it("treats unlocking a message that is not locked as a no-op", () => {
    expect(() => unlockMessage("never-locked")).not.toThrow();
    expect(isMessageLocked("never-locked")).toBe(false);
  });
});
