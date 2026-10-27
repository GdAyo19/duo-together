import { describe, expect, it } from "vitest";
import { getSharedStreak, summarizePractice } from "../src/domain/progress";

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
