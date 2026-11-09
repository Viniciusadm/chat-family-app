import {
  childMuteFromDto,
  childSendBlock,
  findDirectMute,
  findGeneralMute,
  formatMuteUntil,
  nextExpiry,
  type ChildMute,
} from "@/lib/childMutes";

const NOW = new Date(2026, 10, 9, 14, 0);
const inMinutes = (minutes: number) =>
  new Date(NOW.getTime() + minutes * 60_000);

const CHILD = "child";
const ADULT = "adult";
const OTHER_ADULT = "other-adult";

const directChat = { isGroup: false, participants: [CHILD, ADULT] };
const otherDirectChat = { isGroup: false, participants: [CHILD, OTHER_ADULT] };
const groupChat = { isGroup: true, participants: [CHILD, ADULT, OTHER_ADULT] };

function mute(overrides: Partial<ChildMute>): ChildMute {
  return {
    childId: CHILD,
    mutedById: ADULT,
    scope: "direct",
    expiresAt: inMinutes(30),
    ...overrides,
  };
}

describe("childMuteFromDto", () => {
  it("maps the API fields", () => {
    expect(
      childMuteFromDto({
        child_member_id: CHILD,
        muted_by_member_id: ADULT,
        scope: "all",
        expires_at: "2026-11-09T15:00:00Z",
      })
    ).toEqual({
      childId: CHILD,
      mutedById: ADULT,
      scope: "all",
      expiresAt: new Date("2026-11-09T15:00:00Z"),
    });
  });
});

describe("childSendBlock", () => {
  it("blocks only the direct chat with the adult who muted", () => {
    const mutes = [mute({})];
    expect(childSendBlock(mutes, CHILD, directChat, NOW)).toEqual({
      scope: "direct",
      mutedById: ADULT,
      expiresAt: inMinutes(30),
    });
    expect(childSendBlock(mutes, CHILD, otherDirectChat, NOW)).toBeNull();
    expect(childSendBlock(mutes, CHILD, groupChat, NOW)).toBeNull();
  });

  it("blocks every chat when muted in general", () => {
    const mutes = [mute({ scope: "all", mutedById: OTHER_ADULT })];
    for (const chat of [directChat, otherDirectChat, groupChat]) {
      expect(childSendBlock(mutes, CHILD, chat, NOW)?.scope).toBe("all");
    }
  });

  it("ignores expired mutes and mutes of other children", () => {
    const mutes = [
      mute({ expiresAt: inMinutes(-1) }),
      mute({ childId: "sibling", scope: "all" }),
    ];
    expect(childSendBlock(mutes, CHILD, directChat, NOW)).toBeNull();
  });

  it("prefers the general mute over a direct one", () => {
    const mutes = [mute({}), mute({ scope: "all", expiresAt: inMinutes(10) })];
    expect(childSendBlock(mutes, CHILD, directChat, NOW)?.scope).toBe("all");
  });
});

describe("findDirectMute / findGeneralMute", () => {
  it("returns the latest active mute for the pair", () => {
    const mutes = [
      mute({ scope: "all", expiresAt: inMinutes(10) }),
      mute({ scope: "all", mutedById: OTHER_ADULT, expiresAt: inMinutes(50) }),
      mute({ mutedById: OTHER_ADULT }),
    ];
    expect(findGeneralMute(mutes, CHILD, NOW)?.expiresAt).toEqual(
      inMinutes(50)
    );
    expect(findDirectMute(mutes, CHILD, ADULT, NOW)).toBeNull();
    expect(findDirectMute(mutes, CHILD, OTHER_ADULT, NOW)?.mutedById).toBe(
      OTHER_ADULT
    );
  });
});

describe("nextExpiry", () => {
  it("returns the soonest active expiry", () => {
    const mutes = [
      mute({ expiresAt: inMinutes(-5) }),
      mute({ expiresAt: inMinutes(40) }),
      mute({ scope: "all", expiresAt: inMinutes(20) }),
    ];
    expect(nextExpiry(mutes, NOW)).toEqual(inMinutes(20));
    expect(nextExpiry([], NOW)).toBeNull();
  });
});

describe("formatMuteUntil", () => {
  it("shows the clock time today and flags the next day", () => {
    expect(formatMuteUntil(inMinutes(60), NOW)).toMatch(/^15:00$/);
    expect(formatMuteUntil(new Date(2026, 10, 10, 0, 30), NOW)).toMatch(
      /^amanhã 00:30$/
    );
  });
});
