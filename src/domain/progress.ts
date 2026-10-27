export interface PracticeRow {
  user_id?: string;
  practiced_on?: string;
  person?: string;
  practice_date?: string;
  words_learned?: number;
  minutes?: number;
}

export interface Partner {
  id: string | null;
  name: string;
  pending: boolean;
}

export interface PracticeSummary {
  learnedDays: number;
  wordsLearned: number;
  minutesToday: number;
}

function practiceDate(row: PracticeRow): string | undefined {
  return row.practiced_on || row.practice_date;
}

function personId(row: PracticeRow): string | undefined {
  return row.user_id || row.person;
}

export function summarizePractice(rows: PracticeRow[], today: string): PracticeSummary {
  const learnedDays = new Set(rows.map(practiceDate).filter((date): date is string => Boolean(date)));
  const minutesToday = rows
    .filter((row) => practiceDate(row) === today)
    .reduce((total, row) => total + Number(row.minutes || 0), 0);

  return {
    learnedDays: learnedDays.size,
    wordsLearned: learnedDays.size * 3,
    minutesToday
  };
}

export function getSharedStreak(rows: PracticeRow[], people: Partner[], today: string): number {
  if (people.length < 2 || people.some((person) => person.pending || !person.id)) return 0;

  const membersByDay = new Map<string, Set<string>>();
  for (const row of rows) {
    const date = practiceDate(row);
    const id = personId(row);
    if (!date || !id) continue;
    const members = membersByDay.get(date) || new Set<string>();
    members.add(id);
    membersByDay.set(date, members);
  }

  const completeDay = (date: string): boolean => {
    const practiced = membersByDay.get(date);
    return Boolean(practiced && people.every((person) => person.id && practiced.has(person.id)));
  };

  const streakDay = new Date(`${today}T00:00:00Z`);
  if (!completeDay(today)) streakDay.setUTCDate(streakDay.getUTCDate() - 1);

  let streak = 0;
  while (completeDay(streakDay.toISOString().slice(0, 10))) {
    streak += 1;
    streakDay.setUTCDate(streakDay.getUTCDate() - 1);
  }
  return streak;
}
