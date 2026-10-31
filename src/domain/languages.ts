export type LanguageCode = "fr" | "es" | "it";

export interface LanguagePack {
  name: string;
  speech: string;
  description: string;
}

export const languagePacks = {
  fr: {
    name: "French",
    speech: "fr-FR",
    description: "Three lovely French phrases, one little game, and five minutes just for you two."
  },
  es: {
    name: "Spanish",
    speech: "es-ES",
    description: "Three lovely Spanish phrases, one little game, and five minutes just for you two."
  },
  it: {
    name: "Italian",
    speech: "it-IT",
    description: "Three lovely Italian phrases, one little game, and five minutes just for you two."
  }
} satisfies Record<LanguageCode, LanguagePack>;
