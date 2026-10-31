import { describe, expect, it } from "vitest";
import { getSharedStreak, summarizePractice } from "../src/domain/progress";
import {
  AVATAR_MAX_BYTES,
  avatarPathFor,
  validateAvatarFile,
  validateNickname
} from "../src/domain/profile";
import { IDLE_TIMEOUT_MS, shouldSignOut } from "../src/domain/idle";
import { initiatesOffer } from "../src/domain/call";

const partners = [
  { id: "okomi", name: "Okomi", pending: false },
  { id: "ifemi", name: "Ifemi", pending: false }
];

describe("shared practice progress", () => {
  it("counts a shared day only when both partners practiced", () => {
    const rows = [
      { user_id: "okomi", practiced_on: "2026-10-27", minutes: 5, words_learned: 3 },
      { user_id: "ifemi", practiced_on: "2026-10-27", minutes: 5, words_learned: 3 }
    ];

    expect(summarizePractice(rows, "2026-10-27")).toEqual({
      learnedDays: 1,
      wordsLearned: 3,
      minutesToday: 10
    });
    expect(getSharedStreak(rows, partners, "2026-10-27")).toBe(1);
  });

  it("keeps the previous streak through an incomplete current day", () => {
    const rows = [
      { user_id: "okomi", practiced_on: "2026-10-27", minutes: 5, words_learned: 3 },
      { user_id: "okomi", practiced_on: "2026-10-26", minutes: 5, words_learned: 3 },
      { user_id: "ifemi", practiced_on: "2026-10-26", minutes: 5, words_learned: 3 }
    ];

    expect(getSharedStreak(rows, partners, "2026-10-27")).toBe(1);
    expect(summarizePractice(rows, "2026-10-27").wordsLearned).toBe(6);
  });

  it("returns no shared streak while a partner is still pending", () => {
    expect(getSharedStreak([], [{ ...partners[0] }, { id: null, name: "Your person", pending: true }], "2026-10-27")).toBe(0);
  });
});

describe("nickname and avatar validation", () => {
  it("trims a nickname and accepts it within the length limit", () => {
    expect(validateNickname("  Okomi  ")).toEqual({ ok: true, value: "Okomi" });
  });

  it("rejects an empty or whitespace-only nickname", () => {
    expect(validateNickname("   ").ok).toBe(false);
  });

  it("rejects a nickname longer than 32 characters", () => {
    expect(validateNickname("a".repeat(33)).ok).toBe(false);
    expect(validateNickname("a".repeat(32)).ok).toBe(true);
  });

  it("accepts supported images and rejects other types or oversized files", () => {
    expect(validateAvatarFile({ name: "me.png", type: "image/png", size: 1024 }).ok).toBe(true);
    expect(validateAvatarFile({ name: "me.gif", type: "image/gif", size: 1024 }).ok).toBe(false);
    expect(validateAvatarFile({ name: "me.png", type: "image/png", size: AVATAR_MAX_BYTES + 1 }).ok).toBe(false);
  });

  it("builds an owner-scoped storage path from a safe extension", () => {
    expect(avatarPathFor("user-1", "photo.PNG", "image/png", 1234)).toBe("user-1/1234.png");
    expect(avatarPathFor("user-1", "photo.jpg", "image/jpeg", 1234)).toBe("user-1/1234.jpeg");
    expect(avatarPathFor("user-1", "photo.exe", "image/webp", 1234)).toBe("user-1/1234.webp");
  });
});

describe("call offer negotiation", () => {
  it("lets only the lower account id start the offer", () => {
    expect(initiatesOffer("aaa", "bbb")).toBe(true);
    expect(initiatesOffer("bbb", "aaa")).toBe(false);
  });

  it("does not offer without a partner or to itself", () => {
    expect(initiatesOffer("aaa", "aaa")).toBe(false);
    expect(initiatesOffer("aaa", "")).toBe(false);
  });
});

describe("idle sign-out", () => {
  it("defaults to a one hour timeout", () => {
    expect(IDLE_TIMEOUT_MS).toBe(60 * 60 * 1000);
  });

  it("signs out once inactivity reaches the timeout", () => {
    const start = 1_000_000;
    expect(shouldSignOut(start, start + IDLE_TIMEOUT_MS - 1)).toBe(false);
    expect(shouldSignOut(start, start + IDLE_TIMEOUT_MS)).toBe(true);
  });

  it("does not sign out before any activity has been recorded", () => {
    expect(shouldSignOut(0, Date.now())).toBe(false);
  });
});
