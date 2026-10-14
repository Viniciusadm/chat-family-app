import { formatMessageTime } from "@/lib/formatMessageTime";

const now = new Date(2026, 9, 14, 15, 30);

describe("formatMessageTime", () => {
  it("shows HH:mm for a message sent today", () => {
    expect(formatMessageTime(new Date(2026, 9, 14, 9, 5), now)).toBe("09:05");
  });

  it("shows HH:mm in 24-hour format for an afternoon message today", () => {
    expect(formatMessageTime(new Date(2026, 9, 14, 15, 7), now)).toBe("15:07");
  });

  it("shows HH:mm for a message at the first minute of today", () => {
    expect(formatMessageTime(new Date(2026, 9, 14, 0, 0), now)).toBe("00:00");
  });

  it("shows Ontem for a message sent yesterday", () => {
    expect(formatMessageTime(new Date(2026, 9, 13, 23, 59), now)).toBe("Ontem");
    expect(formatMessageTime(new Date(2026, 9, 13, 0, 1), now)).toBe("Ontem");
  });

  it("shows Ontem across a month boundary", () => {
    expect(
      formatMessageTime(new Date(2026, 8, 30, 20, 0), new Date(2026, 9, 1, 8, 0)),
    ).toBe("Ontem");
  });

  it("shows Ontem across a year boundary", () => {
    expect(
      formatMessageTime(new Date(2025, 11, 31, 22, 0), new Date(2026, 0, 1, 1, 0)),
    ).toBe("Ontem");
  });

  it("shows dd/MM for an older message in the same year", () => {
    expect(formatMessageTime(new Date(2026, 9, 12, 10, 0), now)).toBe("12/10");
    expect(formatMessageTime(new Date(2026, 0, 3, 10, 0), now)).toBe("03/01");
  });

  it("shows dd/MM/yy for a message from a different year", () => {
    expect(formatMessageTime(new Date(2025, 9, 14, 10, 0), now)).toBe("14/10/25");
  });

  it("does not show Ontem for a message from the same day in a previous month", () => {
    expect(formatMessageTime(new Date(2026, 8, 13, 10, 0), now)).toBe("13/09");
  });
});
