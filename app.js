const languagePacks = {
  fr: {
    name: "French",
    flag: "🇫🇷",
    speech: "fr-FR",
    phrase: "Tu me fais sourire.",
    questions: [
      { prompt: "I miss you", answers: ["Tu me manques", "Je t'aime bien", "Tu es mon ami"], correct: 0 },
      { prompt: "You make me smile", answers: ["Tu es très drôle", "Tu me fais sourire", "Je suis heureux"], correct: 1 },
      { prompt: "My favorite person", answers: ["Mon meilleur jour", "Ma jolie maison", "Ma personne préférée"], correct: 2 }
    ]
  },
  es: {
    name: "Spanish",
    flag: "🇪🇸",
    speech: "es-ES",
    phrase: "Me haces sonreír.",
    questions: [
      { prompt: "I miss you", answers: ["Te extraño", "Me gustas", "Eres mi amigo"], correct: 0 },
      { prompt: "You make me smile", answers: ["Eres muy amable", "Me haces sonreír", "Estoy feliz"], correct: 1 },
      { prompt: "My favorite person", answers: ["Mi mejor día", "Mi persona favorita", "Mi casa bonita"], correct: 1 }
    ]
  },
  it: {
    name: "Italian",
    flag: "🇮🇹",
    speech: "it-IT",
    phrase: "Mi fai sorridere.",
    questions: [
      { prompt: "I miss you", answers: ["Mi piaci", "Sei mio amico", "Mi manchi"], correct: 2 },
      { prompt: "You make me smile", answers: ["Mi fai sorridere", "Sono felice", "Sei molto gentile"], correct: 0 },
      { prompt: "My favorite person", answers: ["La mia giornata", "La mia persona preferita", "La mia bella casa"], correct: 1 }
    ]
  }
};

const dialog = document.querySelector("#challenge-dialog");
const languageDialog = document.querySelector("#language-dialog");
const questionNumber = document.querySelector("#question-number");
const progressBar = document.querySelector("#quiz-progress-bar");
const questionTitle = document.querySelector("#dialog-title");
const answerList = document.querySelector("#answer-list");
const feedback = document.querySelector("#answer-feedback");
const nextButton = document.querySelector("#quiz-next");
const quizContent = document.querySelector("#quiz-content");
const quizResult = document.querySelector("#quiz-result");
const toast = document.querySelector("#toast");
let questionIndex = 0;
let completed = false;
let selectedLanguage = "fr";
let toastTimer;

function getQuestions() {
  return languagePacks[selectedLanguage].questions;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2400);
}

function renderQuestion() {
  const questions = getQuestions();
  const question = questions[questionIndex];
  document.querySelector("#quiz-prompt").textContent = `How do you say this in ${languagePacks[selectedLanguage].name}?`;
  questionNumber.textContent = `${questionIndex + 1} / ${questions.length}`;
  progressBar.style.width = `${((questionIndex + 1) / questions.length) * 100}%`;
  questionTitle.textContent = question.prompt;
  feedback.textContent = "";
  nextButton.disabled = true;
  nextButton.textContent = "Choose an answer";
  answerList.replaceChildren();

  question.answers.forEach((answer, answerIndex) => {
    const option = document.createElement("button");
    option.className = "answer-option";
    option.type = "button";
    option.textContent = answer;
    option.addEventListener("click", () => selectAnswer(answerIndex));
    answerList.append(option);
  });
}

function selectAnswer(selectedIndex) {
  const question = getQuestions()[questionIndex];
  const options = [...answerList.children];
  options.forEach((option, index) => {
    option.disabled = true;
    if (index === question.correct) option.classList.add("correct");
    if (index === selectedIndex && index !== question.correct) option.classList.add("incorrect");
  });

  const isCorrect = selectedIndex === question.correct;
  feedback.textContent = isCorrect
    ? "That's it! You're learning each other's language."
    : `Good guess! The answer is “${question.answers[question.correct]}.”`;
  nextButton.disabled = false;
  nextButton.textContent = questionIndex === questions.length - 1 ? "See your little win" : "Next phrase";
}

function startChallenge() {
  questionIndex = 0;
  completed = false;
  quizContent.classList.remove("hidden");
  quizResult.classList.add("hidden");
  renderQuestion();
  dialog.showModal();
}

document.querySelector("#start-challenge").addEventListener("click", startChallenge);
document.querySelector("#quick-game").addEventListener("click", startChallenge);

nextButton.addEventListener("click", () => {
  if (nextButton.disabled) return;
  if (questionIndex < getQuestions().length - 1) {
    questionIndex += 1;
    renderQuestion();
    return;
  }

  completed = true;
  quizContent.classList.add("hidden");
  quizResult.classList.remove("hidden");
});

document.querySelector("#finish-challenge").addEventListener("click", () => {
  dialog.close();
  if (completed) {
    document.querySelector("#streak-count").textContent = "5";
    document.querySelector("#word-count").textContent = "31";
    showToast("Your shared streak is now 5 days. Lovely work!");
  }
});

document.querySelector("#language-button").addEventListener("click", () => {
  languageDialog.showModal();
});

document.querySelectorAll(".language-option").forEach((option) => {
  option.addEventListener("click", () => {
    selectedLanguage = option.dataset.language;
    const language = languagePacks[selectedLanguage];
    document.querySelector("#language-name").textContent = language.name;
    document.querySelector("#language-flag").textContent = language.flag;
    document.querySelector("#phrase-target").textContent = language.phrase;
    document.querySelectorAll(".language-option").forEach((button) => {
      button.classList.toggle("selected", button === option);
    });
    languageDialog.close();
    showToast(`${language.name} is your shared language now.`);
  });
});

document.querySelector("#save-phrase").addEventListener("click", (event) => {
  const button = event.currentTarget;
  const saved = button.classList.toggle("saved");
  button.innerHTML = saved ? "<span>♥</span> Saved to your moments" : "<span>♡</span> Save this phrase";
  showToast(saved ? "Saved to your shared moments." : "Removed from your shared moments.");
});

document.querySelector("#speak-phrase").addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    showToast("Audio playback isn't available in this browser.");
    return;
  }
  window.speechSynthesis.cancel();
  const language = languagePacks[selectedLanguage];
  const phrase = new SpeechSynthesisUtterance(language.phrase);
  phrase.lang = language.speech;
  window.speechSynthesis.speak(phrase);
});
