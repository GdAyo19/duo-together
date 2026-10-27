export type LanguageCode = "fr" | "es" | "it";

export interface QuizQuestion {
  prompt: string;
  answers: [string, string, string];
  correct: number;
}

export interface LanguagePack {
  name: string;
  speech: string;
  phrase: string;
  translation: string;
  description: string;
  questions: [QuizQuestion, QuizQuestion, QuizQuestion];
}

export const languagePacks = {
  fr: {
    name: "French",
    speech: "fr-FR",
    phrase: "Tu me fais sourire.",
    translation: "You make me smile.",
    description: "Three lovely French phrases, one little game, and five minutes just for you two.",
    questions: [
      { prompt: "I miss you", answers: ["Tu me manques", "Je t'aime bien", "Tu es mon ami"], correct: 0 },
      { prompt: "You make me smile", answers: ["Tu es très drôle", "Tu me fais sourire", "Je suis heureux"], correct: 1 },
      { prompt: "My favorite person", answers: ["Mon meilleur jour", "Ma jolie maison", "Ma personne préférée"], correct: 2 }
    ]
  },
  es: {
    name: "Spanish",
    speech: "es-ES",
    phrase: "Me haces sonreír.",
    translation: "You make me smile.",
    description: "Three lovely Spanish phrases, one little game, and five minutes just for you two.",
    questions: [
      { prompt: "I miss you", answers: ["Te extraño", "Me gustas", "Eres mi amigo"], correct: 0 },
      { prompt: "You make me smile", answers: ["Eres muy amable", "Me haces sonreír", "Estoy feliz"], correct: 1 },
      { prompt: "My favorite person", answers: ["Mi mejor día", "Mi persona favorita", "Mi casa bonita"], correct: 1 }
    ]
  },
  it: {
    name: "Italian",
    speech: "it-IT",
    phrase: "Mi fai sorridere.",
    translation: "You make me smile.",
    description: "Three lovely Italian phrases, one little game, and five minutes just for you two.",
    questions: [
      { prompt: "I miss you", answers: ["Mi piaci", "Sei mio amico", "Mi manchi"], correct: 2 },
      { prompt: "You make me smile", answers: ["Mi fai sorridere", "Sono felice", "Sei molto gentile"], correct: 0 },
      { prompt: "My favorite person", answers: ["La mia giornata", "La mia persona preferita", "La mia bella casa"], correct: 1 }
    ]
  }
} satisfies Record<LanguageCode, LanguagePack>;
