import { describe, expect, it } from "vitest";
import { getSharedStreak, summarizePractice } from "../src/domain/progress";
import { lessonForDate, lessonLibrary } from "../src/domain/lessons";
import {
  AVATAR_MAX_BYTES,
  avatarPathFor,
  validateAvatarFile,
  validateNickname
} from "../src/domain/profile";
import { IDLE_TIMEOUT_MS, IDLE_WARNING_MS, idleRemainingMs, shouldSignOut, shouldWarnIdle } from "../src/domain/idle";
import { STUN_SERVERS, buildIceServers, initiatesOffer } from "../src/domain/call";

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

describe("daily lessons", () => {
  it("gives both partners the same three phrases for a date and history", () => {
    const lesson = lessonForDate("fr", "2026-10-31", [], "couple-1");

    expect(lessonForDate("fr", "2026-10-31", [], "couple-1")).toEqual(lesson);
    expect(lesson.phrases).toHaveLength(3);
    expect(lesson.questions).toHaveLength(3);
    expect(new Set(lesson.phrases.map((phrase) => phrase.key)).size).toBe(3);
  });

  it("picks a different shuffle for a different couple", () => {
    const one = lessonForDate("fr", "2026-10-31", [], "couple-1").phrases.map((phrase) => phrase.key);
    const two = lessonForDate("fr", "2026-10-31", [], "couple-2").phrases.map((phrase) => phrase.key);

    expect(one).not.toEqual(two);
  });

  it("never repeats a phrase until the whole library has been learned", () => {
    const learned: string[] = [];
    const lessons = 10;

    for (let offset = 0; offset < lessons; offset += 1) {
      const date = new Date(Date.UTC(2026, 0, 1 + offset)).toISOString().slice(0, 10);
      const lesson = lessonForDate("fr", date, learned, "couple-1");

      for (const phrase of lesson.phrases) {
        expect(learned).not.toContain(phrase.key);
      }
      learned.push(...lesson.phrases.map((phrase) => phrase.key));
    }

    expect(new Set(learned).size).toBe(lessons * 3);
  });

  it("starts reviewing once every phrase has been learned", () => {
    const library = lessonLibrary("es");
    const seen = library.map((phrase) => phrase.key);
    const lesson = lessonForDate("es", "2026-10-31", seen, "couple-1");

    expect(lesson.phrases).toHaveLength(3);
    expect(new Set(lesson.phrases.map((phrase) => phrase.key)).size).toBe(3);
    lesson.phrases.forEach((phrase) => expect(seen).toContain(phrase.key));
  });

  it("quizzes each of today's phrases once with three distinct options", () => {
    for (const language of ["fr", "es", "it"] as const) {
      const lesson = lessonForDate(language, "2026-10-31", [], "couple-1");
      const correctAnswers = lesson.questions.map((question) => question.answers[question.correct]);

      lesson.questions.forEach((question) => {
        expect(question.answers[question.correct]).toBeTruthy();
        expect(new Set(question.answers).size).toBe(3);
      });
      expect(new Set(correctAnswers)).toEqual(new Set(lesson.phrases.map((phrase) => phrase.phrase)));
    }
  });

  it("ships a library long enough to avoid repeats for a month", () => {
    for (const language of ["fr", "es", "it"] as const) {
      expect(lessonLibrary(language).length).toBeGreaterThanOrEqual(30);
      expect(new Set(lessonLibrary(language).map((phrase) => phrase.key)).size).toBe(
        lessonLibrary(language).length
      );
    }
  });

  it("gives every phrase a non-empty, distinct phrase and translation", () => {
    for (const language of ["fr", "es", "it"] as const) {
      const library = lessonLibrary(language);

      for (const entry of library) {
        expect(entry.key.trim()).not.toBe("");
        expect(entry.phrase.trim()).not.toBe("");
        expect(entry.translation.trim()).not.toBe("");
      }

      expect(new Set(library.map((entry) => entry.phrase)).size).toBe(library.length);
      expect(new Set(library.map((entry) => entry.translation)).size).toBe(library.length);
    }
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

describe("call configuration", () => {
  it("keeps the default STUN server and appends a configured relay", () => {
    const servers = buildIceServers({ turn: { urls: "turn:relay.example.com", username: "u", credential: "c" } });

    expect(servers[0]).toEqual(STUN_SERVERS[0]);
    expect(servers.at(-1)).toEqual({ urls: "turn:relay.example.com", username: "u", credential: "c" });
  });

  it("accepts several relays and an explicit server list", () => {
    expect(buildIceServers({ turns: [{ urls: "turn:a" }, { urls: "" }] })).toHaveLength(2);
    expect(buildIceServers({ iceServers: [{ urls: "turn:only" }] })).toEqual([{ urls: "turn:only" }]);
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

  it("warns two minutes before signing out", () => {
    const start = 1_000_000;

    expect(IDLE_WARNING_MS).toBe(2 * 60 * 1000);
    expect(shouldWarnIdle(start, start + IDLE_TIMEOUT_MS - IDLE_WARNING_MS - 1)).toBe(false);
    expect(shouldWarnIdle(start, start + IDLE_TIMEOUT_MS - IDLE_WARNING_MS)).toBe(true);
    expect(shouldWarnIdle(start, start + IDLE_TIMEOUT_MS)).toBe(false);
    expect(idleRemainingMs(start, start + 60_000)).toBe(IDLE_TIMEOUT_MS - 60_000);
  });
});

describe("distinct words learned", () => {
  it("counts a phrase once even when both partners practiced it", () => {
    const rows = [
      { user_id: "okomi", practiced_on: "2026-10-27", minutes: 5, phrase_keys: ["fr-1", "fr-2", "fr-3"] },
      { user_id: "ifemi", practiced_on: "2026-10-27", minutes: 5, phrase_keys: ["fr-1", "fr-2", "fr-3"] },
      { user_id: "okomi", practiced_on: "2026-10-28", minutes: 5, phrase_keys: ["fr-1", "fr-4", "fr-5"] }
    ];

    expect(summarizePractice(rows, "2026-10-27").wordsLearned).toBe(5);
    expect(summarizePractice(rows, "2026-10-27").minutesToday).toBe(10);
  });
});
