import type { LanguageCode } from "./languages";

export interface LessonPhrase {
  key: string;
  phrase: string;
  translation: string;
}

export interface LessonQuestion {
  prompt: string;
  answers: [string, string, string];
  correct: number;
}

export interface DailyLesson {
  key: string;
  phrases: [LessonPhrase, LessonPhrase, LessonPhrase];
  questions: [LessonQuestion, LessonQuestion, LessonQuestion];
}

interface PhraseSeed {
  key: string;
  phrase: string;
  translation: string;
}

// A phrase library per language. Selecting a day's three phrases is
// deterministic for a couple and a date, so both partners always see the same
// lesson, but the order is shuffled and phrases already practised are skipped
// until the whole library has been seen once.
const library: Record<LanguageCode, PhraseSeed[]> = {
  fr: [
    { key: "fr-01", phrase: "Tu me manques.", translation: "I miss you." },
    { key: "fr-02", phrase: "Tu me fais sourire.", translation: "You make me smile." },
    { key: "fr-03", phrase: "Je t'aime.", translation: "I love you." },
    { key: "fr-04", phrase: "Bonne nuit, mon amour.", translation: "Good night, my love." },
    { key: "fr-05", phrase: "Tu es ma personne préférée.", translation: "You are my favorite person." },
    { key: "fr-06", phrase: "Je pense à toi.", translation: "I'm thinking of you." },
    { key: "fr-07", phrase: "Tu rends ma journée meilleure.", translation: "You make my day better." },
    { key: "fr-08", phrase: "J'ai hâte de te voir.", translation: "I can't wait to see you." },
    { key: "fr-09", phrase: "Tu es magnifique.", translation: "You are magnificent." },
    { key: "fr-10", phrase: "Merci d'être là.", translation: "Thank you for being here." },
    { key: "fr-11", phrase: "Mon cœur est à toi.", translation: "My heart is yours." },
    { key: "fr-12", phrase: "Je t'embrasse.", translation: "I'm sending you a kiss." },
    { key: "fr-13", phrase: "Bonjour, mon amour.", translation: "Good morning, my love." },
    { key: "fr-14", phrase: "Tu me manques beaucoup.", translation: "I miss you a lot." },
    { key: "fr-15", phrase: "Appelle-moi ce soir.", translation: "Call me tonight." },
    { key: "fr-16", phrase: "Je rêve de toi.", translation: "I dream about you." },
    { key: "fr-17", phrase: "Tu es tout pour moi.", translation: "You are everything to me." },
    { key: "fr-18", phrase: "Mon amour.", translation: "My love." },
    { key: "fr-19", phrase: "Je t'envoie des bisous.", translation: "I'm sending you kisses." },
    { key: "fr-20", phrase: "À demain, mon cœur.", translation: "See you tomorrow, my heart." },
    { key: "fr-21", phrase: "Passe une bonne journée.", translation: "Have a good day." },
    { key: "fr-22", phrase: "Prends soin de toi.", translation: "Take care of yourself." },
    { key: "fr-23", phrase: "Bravo, mon amour.", translation: "Well done, my love." },
    { key: "fr-24", phrase: "Je serai toujours là.", translation: "I'll always be there." },
    { key: "fr-25", phrase: "On est mieux ensemble.", translation: "We're better together." },
    { key: "fr-26", phrase: "Je me souviens de notre premier regard.", translation: "I remember our first look." },
    { key: "fr-27", phrase: "Ton sourire illumine ma journée.", translation: "Your smile lights up my day." },
    { key: "fr-28", phrase: "Tu me calmes.", translation: "You calm me down." },
    { key: "fr-29", phrase: "Tu peux y arriver.", translation: "You can do it." },
    { key: "fr-30", phrase: "Merci pour tout, mon amour.", translation: "Thank you for everything, my love." },
    { key: "fr-31", phrase: "À bientôt.", translation: "See you soon." },
    { key: "fr-32", phrase: "Je suis là pour toi.", translation: "I'm here for you." }
  ],
  es: [
    { key: "es-01", phrase: "Te extraño.", translation: "I miss you." },
    { key: "es-02", phrase: "Me haces sonreír.", translation: "You make me smile." },
    { key: "es-03", phrase: "Te quiero.", translation: "I love you." },
    { key: "es-04", phrase: "Buenas noches, mi amor.", translation: "Good night, my love." },
    { key: "es-05", phrase: "Eres mi persona favorita.", translation: "You are my favorite person." },
    { key: "es-06", phrase: "Pienso en ti.", translation: "I'm thinking of you." },
    { key: "es-07", phrase: "Haces mi día mejor.", translation: "You make my day better." },
    { key: "es-08", phrase: "Tengo ganas de verte.", translation: "I can't wait to see you." },
    { key: "es-09", phrase: "Eres increíble.", translation: "You are incredible." },
    { key: "es-10", phrase: "Gracias por estar aquí.", translation: "Thank you for being here." },
    { key: "es-11", phrase: "Mi corazón es tuyo.", translation: "My heart is yours." },
    { key: "es-12", phrase: "Te mando un beso.", translation: "I'm sending you a kiss." },
    { key: "es-13", phrase: "Buenos días, mi amor.", translation: "Good morning, my love." },
    { key: "es-14", phrase: "Te extraño mucho.", translation: "I miss you a lot." },
    { key: "es-15", phrase: "Llámame esta noche.", translation: "Call me tonight." },
    { key: "es-16", phrase: "Sueño contigo.", translation: "I dream about you." },
    { key: "es-17", phrase: "Eres todo para mí.", translation: "You are everything to me." },
    { key: "es-18", phrase: "Mi amor.", translation: "My love." },
    { key: "es-19", phrase: "Te mando muchos besos.", translation: "I'm sending you lots of kisses." },
    { key: "es-20", phrase: "Hasta mañana, mi corazón.", translation: "See you tomorrow, my heart." },
    { key: "es-21", phrase: "Que tengas un buen día.", translation: "Have a good day." },
    { key: "es-22", phrase: "Cuídate mucho.", translation: "Take care of yourself." },
    { key: "es-23", phrase: "Bravo, mi amor.", translation: "Well done, my love." },
    { key: "es-24", phrase: "Siempre estaré aquí.", translation: "I'll always be here." },
    { key: "es-25", phrase: "Estamos mejor juntos.", translation: "We're better together." },
    { key: "es-26", phrase: "Recuerdo nuestra primera mirada.", translation: "I remember our first look." },
    { key: "es-27", phrase: "Tu sonrisa ilumina mi día.", translation: "Your smile lights up my day." },
    { key: "es-28", phrase: "Me calmas.", translation: "You calm me down." },
    { key: "es-29", phrase: "Sé que puedes lograrlo.", translation: "I know you can do it." },
    { key: "es-30", phrase: "Gracias por todo, mi amor.", translation: "Thank you for everything, my love." },
    { key: "es-31", phrase: "Hasta pronto.", translation: "See you soon." },
    { key: "es-32", phrase: "Estoy aquí para ti.", translation: "I'm here for you." }
  ],
  it: [
    { key: "it-01", phrase: "Mi manchi.", translation: "I miss you." },
    { key: "it-02", phrase: "Mi fai sorridere.", translation: "You make me smile." },
    { key: "it-03", phrase: "Ti amo.", translation: "I love you." },
    { key: "it-04", phrase: "Buonanotte, amore mio.", translation: "Good night, my love." },
    { key: "it-05", phrase: "Sei la mia persona preferita.", translation: "You are my favorite person." },
    { key: "it-06", phrase: "Penso a te.", translation: "I'm thinking of you." },
    { key: "it-07", phrase: "Mi rendi la giornata migliore.", translation: "You make my day better." },
    { key: "it-08", phrase: "Non vedo l'ora di vederti.", translation: "I can't wait to see you." },
    { key: "it-09", phrase: "Sei speciale.", translation: "You are special." },
    { key: "it-10", phrase: "Grazie per esserci.", translation: "Thank you for being there." },
    { key: "it-11", phrase: "Il mio cuore è tuo.", translation: "My heart is yours." },
    { key: "it-12", phrase: "Ti mando un bacio.", translation: "I'm sending you a kiss." },
    { key: "it-13", phrase: "Buongiorno, amore mio.", translation: "Good morning, my love." },
    { key: "it-14", phrase: "Mi manchi tanto.", translation: "I miss you a lot." },
    { key: "it-15", phrase: "Chiamami stasera.", translation: "Call me tonight." },
    { key: "it-16", phrase: "Ti sogno.", translation: "I dream about you." },
    { key: "it-17", phrase: "Sei tutto per me.", translation: "You are everything to me." },
    { key: "it-18", phrase: "Amore mio.", translation: "My love." },
    { key: "it-19", phrase: "Ti mando tanti baci.", translation: "I'm sending you lots of kisses." },
    { key: "it-20", phrase: "A domani, cuore mio.", translation: "See you tomorrow, my heart." },
    { key: "it-21", phrase: "Buona giornata.", translation: "Have a good day." },
    { key: "it-22", phrase: "Prenditi cura di te.", translation: "Take care of yourself." },
    { key: "it-23", phrase: "Ben fatto, amore mio.", translation: "Well done, my love." },
    { key: "it-24", phrase: "Sarò sempre qui.", translation: "I'll always be here." },
    { key: "it-25", phrase: "Stiamo meglio insieme.", translation: "We're better together." },
    { key: "it-26", phrase: "Ricordo il nostro primo sguardo.", translation: "I remember our first look." },
    { key: "it-27", phrase: "Il tuo sorriso illumina la mia giornata.", translation: "Your smile lights up my day." },
    { key: "it-28", phrase: "Mi calmi.", translation: "You calm me down." },
    { key: "it-29", phrase: "So che puoi farcela.", translation: "I know you can do it." },
    { key: "it-30", phrase: "Grazie di tutto, amore mio.", translation: "Thank you for everything, my love." },
    { key: "it-31", phrase: "A presto.", translation: "See you soon." },
    { key: "it-32", phrase: "Sono qui per te.", translation: "I'm here for you." }
  ]
};

export const LESSON_SIZE = 3;

export function lessonLibrary(language: LanguageCode): PhraseSeed[] {
  return library[language] ?? library.fr;
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function seededRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let value = state;
    value = Math.imul(value ^ (value >>> 15), value | 1);
    value ^= value + Math.imul(value ^ (value >>> 7), value | 61);
    return ((value ^ (value >>> 14)) >>> 0) / 4294967296;
  };
}

function shuffle<T>(items: T[], seed: number): T[] {
  const random = seededRandom(seed);
  const copy = [...items];
  for (let index = copy.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [copy[index], copy[swapWith]] = [copy[swapWith], copy[index]];
  }
  return copy;
}

export function dayIndex(dateKey: string): number {
  const [year, month, day] = (dateKey || "").split("-").map(Number);
  if (!Number.isFinite(year) || !Number.isFinite(month) || !Number.isFinite(day)) return 0;
  const time = Date.UTC(year, month - 1, day);
  if (!Number.isFinite(time)) return 0;
  return Math.floor(time / 86_400_000);
}

function buildQuestions(pool: LessonPhrase[], chosen: LessonPhrase[], seed: number): LessonQuestion[] {
  // Ask in a different order than the lesson was taught, so the quiz is recall
  // rather than a repeat of the list the couple just read.
  return shuffle(chosen, seed ^ 0x85ebca6b).map((phrase, questionIndex) => {
    const distractors = shuffle(
      pool.filter((candidate) => candidate.key !== phrase.key),
      seed + questionIndex * 31 + 7
    )
      .slice(0, 2)
      .map((candidate) => candidate.phrase);
    const answers = shuffle([phrase.phrase, ...distractors], seed + questionIndex * 7919 + 13);
    return {
      prompt: phrase.translation,
      answers: answers as [string, string, string],
      correct: answers.indexOf(phrase.phrase)
    };
  });
}

/**
 * Builds a day's lesson.
 *
 * @param seenKeys phrases this couple has already practised. They are skipped
 *   until every phrase in the library has been learned once, so a couple does
 *   not repeat a phrase for a month on a 32-phrase language.
 * @param seed stable couple identifier, so both partners get the same lesson.
 */
export function lessonForDate(
  language: LanguageCode,
  dateKey: string,
  seenKeys: string[] = [],
  seed = ""
): DailyLesson {
  const pool = lessonLibrary(language);
  const phrases = pool.map((entry) => ({
    key: entry.key,
    phrase: entry.phrase,
    translation: entry.translation
  }));
  const seen = new Set(seenKeys.filter((key) => phrases.some((phrase) => phrase.key === key)));
  const baseSeed = hashString(`${seed}|${language}|${dateKey}`);

  const unseen = shuffle(
    phrases.filter((phrase) => !seen.has(phrase.key)),
    baseSeed
  );
  const review = shuffle(
    phrases.filter((phrase) => seen.has(phrase.key)),
    baseSeed ^ 0x9e3779b9
  );

  const chosen = [...unseen, ...review].slice(0, LESSON_SIZE);
  const questions = buildQuestions(phrases, chosen, baseSeed);

  return {
    key: `${language}-${dateKey}`,
    phrases: chosen as [LessonPhrase, LessonPhrase, LessonPhrase],
    questions: questions as [LessonQuestion, LessonQuestion, LessonQuestion]
  };
}
