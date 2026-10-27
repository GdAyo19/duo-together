const languagePacks = {
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
};

const localKey = "tandem-shared-space-v1";
const dialog = document.querySelector("#challenge-dialog");
const languageDialog = document.querySelector("#language-dialog");
const authDialog = document.querySelector("#auth-dialog");
const questionNumber = document.querySelector("#question-number");
const progressBar = document.querySelector("#quiz-progress-bar");
const questionTitle = document.querySelector("#dialog-title");
const answerList = document.querySelector("#answer-list");
const feedback = document.querySelector("#answer-feedback");
const nextButton = document.querySelector("#quiz-next");
const quizContent = document.querySelector("#quiz-content");
const quizResult = document.querySelector("#quiz-result");
const toast = document.querySelector("#toast");
const appViews = document.querySelector("#app-views");
const pairingScreen = document.querySelector("#pairing-screen");
const syncState = document.querySelector("#sync-state");
const syncLabel = document.querySelector("#sync-label");
let localState = readLocalState();
let activeLanguage = localState.language;
let activeView = "home";
let questionIndex = 0;
let completed = false;
let sessionToken = 0;
let supabase = null;
let authUser = null;
let couple = null;
let members = [];
let practiceDays = [];
let savedPhrases = [];
let toastTimer;

function readLocalState() {
  const fallback = {
    language: "fr",
    members: ["Okomi", "Ifemi"],
    practiceDays: [],
    savedPhrases: []
  };
  try {
    const stored = JSON.parse(localStorage.getItem(localKey) || "null");
    if (!stored || typeof stored !== "object") return fallback;
    return {
      ...fallback,
      ...stored,
      language: Object.hasOwn(languagePacks, stored.language) ? stored.language : "fr",
      members: Array.isArray(stored.members) ? stored.members.slice(0, 2) : fallback.members,
      practiceDays: Array.isArray(stored.practiceDays) ? stored.practiceDays : [],
      savedPhrases: Array.isArray(stored.savedPhrases) ? stored.savedPhrases : []
    };
  } catch (error) {
    console.error("Could not read the saved Tandem preview.", error);
    return fallback;
  }
}

function persistLocalState() {
  try {
    localStorage.setItem(localKey, JSON.stringify(localState));
  } catch (error) {
    console.error("Could not save this Tandem preview on the device.", error);
    showToast("This browser could not save your progress.");
  }
}

function currentDate() {
  return new Date().toISOString().slice(0, 10);
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add("show");
  window.clearTimeout(toastTimer);
  toastTimer = window.setTimeout(() => toast.classList.remove("show"), 2800);
}

function setSyncStatus(status, label) {
  syncState.classList.remove("online", "offline");
  if (status) syncState.classList.add(status);
  syncLabel.textContent = label;
}

function showPairingScreen() {
  appViews.classList.add("hidden");
  pairingScreen.classList.remove("hidden");
}

function showAppViews() {
  pairingScreen.classList.add("hidden");
  appViews.classList.remove("hidden");
}

function switchView(name, updateHash = true) {
  const view = document.querySelector(`#${name}-view`);
  if (!view) return;
  activeView = name;
  document.querySelectorAll(".view").forEach((section) => {
    const selected = section === view;
    section.classList.toggle("hidden", !selected);
    section.classList.toggle("active", selected);
  });
  document.querySelectorAll(".nav-link").forEach((link) => {
    const selected = link.dataset.view === name;
    link.classList.toggle("active", selected);
    if (selected) link.setAttribute("aria-current", "page");
    else link.removeAttribute("aria-current");
  });
  document.querySelector("#sidebar").classList.remove("mobile-open");
  document.querySelector("#menu-button").setAttribute("aria-expanded", "false");
  if (updateHash && window.location.hash !== `#${name}`) {
    window.history.replaceState(null, "", `#${name}`);
  }
}

function getCurrentLanguage() {
  return languagePacks[activeLanguage];
}

function getPeople() {
  if (couple) {
    const linked = members.slice(0, 2).map((member) => ({
      id: member.user_id,
      name: member.display_name,
      pending: false
    }));
    if (linked.length < 2) linked.push({ id: null, name: "Your person", pending: true });
    return linked;
  }
  return localState.members.map((name, index) => ({
    id: name,
    name,
    pending: false,
    index
  }));
}

function getPracticeRows() {
  return couple ? practiceDays : localState.practiceDays;
}

function dateRowsByMember(rows) {
  const dateMap = new Map();
  for (const row of rows) {
    const day = row.practiced_on || row.practice_date;
    const id = row.user_id || row.person;
    if (!day || !id) continue;
    if (!dateMap.has(day)) dateMap.set(day, new Set());
    dateMap.get(day).add(id);
  }
  return dateMap;
}

function getSharedStreak(rows, people) {
  if (people.length < 2 || people.some((person) => person.pending)) return 0;
  const byDay = dateRowsByMember(rows);
  const completeDay = (day) => {
    const practiced = byDay.get(day);
    return practiced && people.every((person) => practiced.has(person.id));
  };
  const today = new Date(`${currentDate()}T00:00:00Z`);
  if (!completeDay(currentDate())) today.setUTCDate(today.getUTCDate() - 1);
  let streak = 0;
  while (completeDay(today.toISOString().slice(0, 10))) {
    streak += 1;
    today.setUTCDate(today.getUTCDate() - 1);
  }
  return streak;
}

function renderLane(container, people, rows, day) {
  const todaysRows = rows.filter((row) => (row.practiced_on || row.practice_date) === day);
  container.replaceChildren();
  people.forEach((person, index) => {
    const active = !person.pending && todaysRows.some((row) => (row.user_id || row.person) === person.id);
    const lane = document.createElement("div");
    lane.className = "practice-lane";
    lane.dataset.person = person.name;

    const avatar = document.createElement("span");
    avatar.className = `lane-avatar ${index === 0 ? "okomi-avatar" : "ifemi-avatar"}`;
    avatar.textContent = person.pending ? "·" : person.name.slice(0, 1).toUpperCase();
    avatar.setAttribute("aria-hidden", "true");

    const name = document.createElement("span");
    name.className = "lane-name";
    name.textContent = person.name;

    const track = document.createElement("span");
    track.className = "lane-track";
    track.setAttribute("role", "progressbar");
    track.setAttribute("aria-label", `${person.name}: ${active ? 5 : 0} of 5 minutes`);
    track.setAttribute("aria-valuemin", "0");
    track.setAttribute("aria-valuemax", "5");
    track.setAttribute("aria-valuenow", active ? "5" : "0");

    const fill = document.createElement("span");
    fill.className = "lane-fill";
    fill.style.width = active ? "100%" : "0%";
    track.append(fill);

    const total = document.createElement("span");
    total.className = "lane-total";
    total.textContent = person.pending ? "—" : `${active ? 5 : 0}/5`;

    lane.append(avatar, name, track, total);
    container.append(lane);
  });
}

function renderSavedPhrases(phrases) {
  const list = document.querySelector("#saved-list");
  list.replaceChildren();
  if (!phrases.length) {
    const empty = document.createElement("p");
    empty.className = "empty-note";
    empty.textContent = "No saved phrases yet. Keep one from today's date and it'll be here.";
    list.append(empty);
    return;
  }

  phrases.forEach((phrase) => {
    const row = document.createElement("article");
    row.className = "saved-phrase";
    const words = document.createElement("div");
    const target = document.createElement("p");
    target.className = "phrase-target";
    target.textContent = phrase.phrase;
    const translation = document.createElement("p");
    translation.className = "phrase-translation";
    translation.textContent = phrase.translation;
    words.append(target, translation);
    const remove = document.createElement("button");
    remove.className = "remove-phrase";
    remove.type = "button";
    remove.textContent = "Remove";
    remove.setAttribute("aria-label", `Remove ${phrase.phrase} from saved phrases`);
    remove.addEventListener("click", () => {
      removePhrase(phrase).catch((error) => {
        console.error("Could not remove the saved phrase.", error);
        showToast(`Could not remove this phrase: ${error.message}`);
      });
    });
    row.append(words, remove);
    list.append(row);
  });
}

function renderInvitePanel(people) {
  const copy = document.querySelector("#invite-copy");
  const actions = document.querySelector("#invite-actions");
  actions.replaceChildren();

  if (couple && authUser) {
    copy.textContent = "Share this private code with your person so you can practice on both devices.";
    const label = document.createElement("span");
    label.className = "invite-code-label";
    label.textContent = "Your invite code";
    const row = document.createElement("div");
    row.className = "invite-code-row";
    const code = document.createElement("strong");
    code.className = "invite-code";
    code.textContent = couple.invite_code;
    const copyButton = document.createElement("button");
    copyButton.className = "copy-button";
    copyButton.type = "button";
    copyButton.textContent = "Copy";
    copyButton.addEventListener("click", async () => {
      try {
        await navigator.clipboard.writeText(couple.invite_code);
        showToast("Invite code copied.");
      } catch (error) {
        console.error("Could not copy the invite code.", error);
        showToast("Copy didn't work here. Select and copy the code instead.");
      }
    });
    row.append(code, copyButton);
    const count = document.createElement("p");
    count.className = "member-count";
    count.textContent = `${members.length} of 2 people in this space`;
    actions.append(label, row, count);
    return;
  }

  const button = document.createElement("button");
  button.className = "outline-button";
  button.id = "invite-button";
  button.type = "button";
  button.textContent = "Set up shared space";
  button.addEventListener("click", () => {
    if (!supabase) {
      showToast("Cloud sync needs your Supabase project settings first.");
      return;
    }
    if (!authUser) {
      authDialog.showModal();
      return;
    }
    showPairingScreen();
  });
  actions.append(button);
  if (people.some((person) => person.pending)) {
    copy.textContent = "Sign in and share a private invite code so you can keep learning across devices.";
  }
}

function render() {
  const language = getCurrentLanguage();
  const people = getPeople();
  const rows = getPracticeRows();
  const today = currentDate();
  const saved = couple ? savedPhrases : localState.savedPhrases;
  const practicedToday = rows.filter((row) => (row.practiced_on || row.practice_date) === today);
  const learnedDays = new Set(rows.map((row) => row.practiced_on || row.practice_date).filter(Boolean));
  const minutesToday = practicedToday.reduce((sum, row) => sum + Number(row.minutes || 0), 0);
  const pairName = couple?.name || localState.members.join(" & ");

  document.querySelector("#couple-name").textContent = pairName;
  document.querySelector("#greeting").textContent = `${pairName}, let's learn a little ${language.name.toLowerCase()}.`;
  document.querySelector("#heading-copy").textContent = "Your daily five-minute ritual, made for two.";
  document.querySelector("#language-name").textContent = language.name;
  document.querySelector("#language-code").textContent = activeLanguage.toUpperCase();
  document.querySelector("#lesson-description").textContent = language.description;
  document.querySelector("#phrase-target").textContent = language.phrase;
  document.querySelector("#phrase-translation").textContent = language.translation;
  document.querySelector("#streak-count").textContent = String(getSharedStreak(rows, people));
  document.querySelector("#word-count").textContent = String(learnedDays.size * 3);
  document.querySelector("#phrase-count").textContent = String(saved.length);
  document.querySelector("#minutes-count").textContent = String(minutesToday);
  document.querySelector("#today-line").textContent = new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    weekday: "long",
    month: "long",
    day: "numeric"
  }).format(new Date());
  document.querySelector("#practice-date").textContent = new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    month: "short",
    day: "numeric"
  }).format(new Date());
  document.querySelector("#practice-caption").textContent = people.some((person) => person.pending)
    ? "Your space is ready. Invite your person to start a shared streak."
    : "Every little check-in brings your shared streak closer.";
  document.querySelector("#phrase-date").textContent = new Intl.DateTimeFormat("en", {
    timeZone: "UTC",
    month: "short",
    day: "numeric"
  }).format(new Date());
  document.querySelector("#moments-count").textContent = `${saved.length} ${saved.length === 1 ? "phrase" : "phrases"}`;
  document.querySelector("#phrase-hint").textContent = saved.some((item) => item.phrase === language.phrase)
    ? "Already in your shared moments."
    : "Say it to each other today.";

  const saveButton = document.querySelector("#save-phrase");
  const phraseSaved = saved.some((item) => item.phrase === language.phrase && item.language === activeLanguage);
  saveButton.classList.toggle("saved", phraseSaved);
  saveButton.textContent = phraseSaved ? "Saved" : "Save phrase";

  renderLane(document.querySelector("#practice-lanes"), people, rows, today);
  renderLane(document.querySelector("#practice-lanes-large"), people, rows, today);
  renderSavedPhrases(saved);
  renderInvitePanel(people);

  if (couple) {
    setSyncStatus("online", "Shared with your person");
    document.querySelector("#account-button").textContent = "Sign out";
  } else {
    setSyncStatus("", "Saved on this device");
    document.querySelector("#account-button").textContent = authUser ? "Sign out" : supabase ? "Sign in to sync" : "Cloud sync not set up";
  }
}

function setPairingTab(tab) {
  const creating = tab === "create";
  document.querySelector("#create-tab").classList.toggle("active", creating);
  document.querySelector("#create-tab").setAttribute("aria-selected", String(creating));
  document.querySelector("#join-tab").classList.toggle("active", !creating);
  document.querySelector("#join-tab").setAttribute("aria-selected", String(!creating));
  document.querySelector("#create-space-form").classList.toggle("hidden", !creating);
  document.querySelector("#join-space-form").classList.toggle("hidden", creating);
  document.querySelector("#pairing-message").textContent = "";
  document.querySelector("#pairing-message").className = "pairing-message";
}

function setFormMessage(element, message, kind = "") {
  element.textContent = message;
  element.className = `${element.classList.contains("pairing-message") ? "pairing-message" : "form-message"}${kind ? ` ${kind}` : ""}`;
}

function getQuestions() {
  return getCurrentLanguage().questions;
}

function renderQuestion() {
  const questions = getQuestions();
  const question = questions[questionIndex];
  document.querySelector("#quiz-prompt").textContent = `How do you say this in ${getCurrentLanguage().name}?`;
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
  feedback.textContent = selectedIndex === question.correct
    ? "That's it! You're learning each other's language."
    : `Good guess! The answer is “${question.answers[question.correct]}.”`;
  nextButton.disabled = false;
  nextButton.textContent = questionIndex === getQuestions().length - 1 ? "See your little win" : "Next phrase";
}

function startChallenge() {
  if (authUser && !couple) {
    showPairingScreen();
    showToast("Create or join your shared space to begin.");
    return;
  }
  questionIndex = 0;
  completed = false;
  quizContent.classList.remove("hidden");
  quizResult.classList.add("hidden");
  renderQuestion();
  dialog.showModal();
}

async function loadSharedSpace(user) {
  const token = ++sessionToken;
  const { data: membership, error: membershipError } = await supabase
    .from("couple_members")
    .select("couple_id, user_id, display_name")
    .eq("user_id", user.id)
    .maybeSingle();
  if (membershipError) throw membershipError;
  if (token !== sessionToken) return;

  if (!membership) {
    couple = null;
    members = [];
    practiceDays = [];
    savedPhrases = [];
    setSyncStatus("online", "Signed in · set up your space");
    document.querySelector("#account-button").textContent = "Sign out";
    showPairingScreen();
    return;
  }

  const [
    { data: coupleData, error: coupleError },
    { data: memberData, error: memberError },
    { data: practiceData, error: practiceError },
    { data: phraseData, error: phraseError }
  ] = await Promise.all([
    supabase.from("couples").select("id, name, language, invite_code").eq("id", membership.couple_id).single(),
    supabase.from("couple_members").select("user_id, display_name, joined_at").eq("couple_id", membership.couple_id).order("joined_at"),
    supabase.from("practice_days").select("user_id, practiced_on, words_learned, minutes").eq("couple_id", membership.couple_id).order("practiced_on", { ascending: false }).limit(400),
    supabase.from("saved_phrases").select("id, language, phrase, translation, created_at").eq("couple_id", membership.couple_id).order("created_at", { ascending: false }).limit(100)
  ]);
  if (token !== sessionToken) return;
  if (coupleError) throw coupleError;
  if (memberError) throw memberError;
  if (practiceError) throw practiceError;
  if (phraseError) throw phraseError;
  if (token !== sessionToken) return;

  couple = coupleData;
  members = memberData;
  practiceDays = practiceData;
  savedPhrases = phraseData;
  activeLanguage = couple.language;
  showAppViews();
  render();
}

async function handleSession(session) {
  authUser = session?.user || null;
  if (!authUser) {
    sessionToken += 1;
    couple = null;
    members = [];
    practiceDays = [];
    savedPhrases = [];
    showAppViews();
    render();
    return;
  }

  document.querySelector("#account-button").textContent = "Signing in…";
  try {
    await loadSharedSpace(authUser);
  } catch (error) {
    console.error("Could not load the shared Tandem space.", error);
    showAppViews();
    render();
    setSyncStatus("offline", "Couldn't load shared space");
    showToast(`Could not load your shared space: ${error.message}`);
  }
}

async function initializeBackend() {
  const settings = window.TANDEM_CONFIG || {};
  const hasUrl = typeof settings.supabaseUrl === "string" && settings.supabaseUrl.trim();
  const hasKey = typeof settings.supabaseAnonKey === "string" && settings.supabaseAnonKey.trim();
  if (!hasUrl && !hasKey) {
    render();
    return;
  }
  if (!hasUrl || !hasKey) {
    render();
    setSyncStatus("offline", "Supabase settings incomplete");
    showToast("Add both the Supabase project URL and publishable key to config.js.");
    return;
  }

  try {
    const { createClient } = await import("https://esm.sh/@supabase/supabase-js@2");
    supabase = createClient(settings.supabaseUrl, settings.supabaseAnonKey);
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    await handleSession(session);
    supabase.auth.onAuthStateChange((_event, nextSession) => {
      window.setTimeout(() => {
        handleSession(nextSession).catch((authError) => {
          console.error("Could not update the Tandem sign-in state.", authError);
          showToast(`Sign-in update failed: ${authError.message}`);
        });
      }, 0);
    });
  } catch (error) {
    console.error("Could not connect to Supabase.", error);
    render();
    setSyncStatus("offline", "Cloud connection unavailable");
    showToast(`Cloud sync could not start: ${error.message}`);
  }
}

async function recordPractice() {
  const day = currentDate();
  if (couple && authUser) {
    const { error } = await supabase.from("practice_days").insert({
      couple_id: couple.id,
      user_id: authUser.id,
      practiced_on: day,
      words_learned: 3,
      minutes: 5
    });
    if (error?.code === "23505") {
      await loadSharedSpace(authUser);
      showToast("You've already practiced today. Your progress is saved.");
      return;
    }
    if (error) throw error;
    await loadSharedSpace(authUser);
    showToast("Today's date is saved to your shared space.");
    return;
  }

  const currentRows = localState.practiceDays.filter((row) => row.practice_date === day);
  const alreadyCompleted = localState.members.every((person) => currentRows.some((row) => row.person === person));
  if (alreadyCompleted) {
    showToast("You both already practiced today. Your progress is saved.");
    return;
  }
  for (const person of localState.members) {
    if (!currentRows.some((row) => row.person === person)) {
      localState.practiceDays.push({
        person,
        practice_date: day,
        words_learned: 3,
        minutes: 5
      });
    }
  }
  persistLocalState();
  render();
  showToast("Your date is saved on this device.");
}

async function savePhrase() {
  const language = getCurrentLanguage();
  const alreadySaved = (couple ? savedPhrases : localState.savedPhrases)
    .some((phrase) => phrase.language === activeLanguage && phrase.phrase === language.phrase);
  if (alreadySaved) {
    showToast("This phrase is already in your shared moments.");
    return;
  }

  if (couple && authUser) {
    const { error } = await supabase.from("saved_phrases").insert({
      couple_id: couple.id,
      saved_by: authUser.id,
      language: activeLanguage,
      phrase: language.phrase,
      translation: language.translation
    });
    if (error?.code === "23505") {
      await loadSharedSpace(authUser);
      showToast("This phrase is already in your shared moments.");
      return;
    }
    if (error) throw error;
    await loadSharedSpace(authUser);
  } else {
    localState.savedPhrases.unshift({
      id: `${activeLanguage}:${language.phrase}`,
      language: activeLanguage,
      phrase: language.phrase,
      translation: language.translation
    });
    persistLocalState();
    render();
  }
  showToast("Saved to your shared moments.");
}

async function removePhrase(phrase) {
  if (couple && authUser) {
    const { error } = await supabase.from("saved_phrases").delete().eq("id", phrase.id).eq("couple_id", couple.id);
    if (error) {
      console.error("Could not remove the saved phrase.", error);
      showToast(`Could not remove this phrase: ${error.message}`);
      return;
    }
    await loadSharedSpace(authUser);
  } else {
    localState.savedPhrases = localState.savedPhrases.filter((item) => item.id !== phrase.id);
    persistLocalState();
    render();
  }
  showToast("Removed from your shared moments.");
}

function refreshSharedSpace() {
  if (!supabase || !authUser || !couple || document.visibilityState !== "visible") return;
  loadSharedSpace(authUser).catch((error) => {
    console.error("Could not refresh the shared Tandem space.", error);
    setSyncStatus("offline", "Couldn't refresh shared space");
    showToast(`Could not refresh shared progress: ${error.message}`);
  });
}

async function updateLanguage(code) {
  if (!Object.hasOwn(languagePacks, code)) return;
  const previous = activeLanguage;
  activeLanguage = code;
  if (couple && authUser) {
    const { data, error } = await supabase
      .from("couples")
      .update({ language: code })
      .eq("id", couple.id)
      .select("id, name, language, invite_code")
      .single();
    if (error) {
      activeLanguage = previous;
      console.error("Could not update the shared language.", error);
      showToast(`Could not change language: ${error.message}`);
      return;
    }
    couple = data;
  } else {
    localState.language = code;
    persistLocalState();
  }
  render();
  languageDialog.close();
  showToast(`${languagePacks[code].name} is your shared language now.`);
}

document.querySelectorAll("[data-view]").forEach((control) => {
  control.addEventListener("click", (event) => {
    event.preventDefault();
    switchView(control.dataset.view);
  });
});

document.querySelector("#menu-button").addEventListener("click", () => {
  const sidebar = document.querySelector("#sidebar");
  const open = sidebar.classList.toggle("mobile-open");
  document.querySelector("#menu-button").setAttribute("aria-expanded", String(open));
});

document.querySelector("#account-button").addEventListener("click", async () => {
  if (authUser && supabase) {
    try {
      const { error } = await supabase.auth.signOut();
      if (error) throw error;
    } catch (error) {
      console.error("Could not sign out.", error);
      showToast(`Could not sign out: ${error.message}`);
    }
    return;
  }
  if (!supabase) {
    showToast("Cloud sync is not connected. Add Supabase settings in config.js to sign in.");
    return;
  }
  document.querySelector("#auth-message").textContent = "";
  authDialog.showModal();
});

document.querySelector("#email-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const message = document.querySelector("#auth-message");
  button.disabled = true;
  setFormMessage(message, "Sending your sign-in link…");
  try {
    const email = new FormData(form).get("email");
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` }
    });
    if (error) throw error;
    setFormMessage(message, "Check your inbox for a one-time sign-in link.", "success");
  } catch (error) {
    console.error("Could not send the sign-in link.", error);
    setFormMessage(message, `Could not send the link: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#create-tab").addEventListener("click", () => setPairingTab("create"));
document.querySelector("#join-tab").addEventListener("click", () => setPairingTab("join"));

document.querySelector("#create-space-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const values = new FormData(form);
  button.disabled = true;
  setFormMessage(document.querySelector("#pairing-message"), "Creating your shared space…");
  try {
    const { data, error } = await supabase.rpc("create_couple", {
      p_name: values.get("coupleName"),
      p_display_name: values.get("displayName"),
      p_language: values.get("language")
    });
    if (error) throw error;
    couple = data;
    await loadSharedSpace(authUser);
    showToast("Your shared space is ready. Send your person the invite code.");
  } catch (error) {
    console.error("Could not create the shared space.", error);
    setFormMessage(document.querySelector("#pairing-message"), error.message, "error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#join-space-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const values = new FormData(form);
  button.disabled = true;
  setFormMessage(document.querySelector("#pairing-message"), "Joining your shared space…");
  try {
    const { data, error } = await supabase.rpc("join_couple_by_code", {
      p_code: values.get("inviteCode"),
      p_display_name: values.get("displayName")
    });
    if (error) throw error;
    couple = data;
    await loadSharedSpace(authUser);
    showToast("You're in. Your shared space is ready.");
  } catch (error) {
    console.error("Could not join the shared space.", error);
    setFormMessage(document.querySelector("#pairing-message"), error.message, "error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#language-button").addEventListener("click", () => {
  document.querySelectorAll(".language-option").forEach((option) => {
    option.classList.toggle("selected", option.dataset.language === activeLanguage);
  });
  languageDialog.showModal();
});

document.querySelectorAll(".language-option").forEach((option) => {
  option.addEventListener("click", async () => {
    try {
      await updateLanguage(option.dataset.language);
    } catch (error) {
      console.error("Could not change the shared language.", error);
      showToast(`Could not change language: ${error.message}`);
    }
  });
});

document.querySelectorAll(".start-challenge").forEach((button) => {
  button.addEventListener("click", startChallenge);
});

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

document.querySelector("#finish-challenge").addEventListener("click", async () => {
  if (completed) {
    const button = document.querySelector("#finish-challenge");
    button.disabled = true;
    try {
      await recordPractice();
      dialog.close();
    } catch (error) {
      console.error("Could not save today's practice.", error);
      showToast(`Could not save today's practice: ${error.message}`);
    } finally {
      button.disabled = false;
    }
  } else {
    dialog.close();
  }
});

document.querySelector("#save-phrase").addEventListener("click", () => {
  savePhrase().catch((error) => {
    console.error("Could not save the phrase.", error);
    showToast(`Could not save this phrase: ${error.message}`);
  });
});

document.querySelector("#speak-phrase").addEventListener("click", () => {
  if (!("speechSynthesis" in window)) {
    showToast("Audio playback isn't available in this browser.");
    return;
  }
  window.speechSynthesis.cancel();
  const phrase = new SpeechSynthesisUtterance(getCurrentLanguage().phrase);
  phrase.lang = getCurrentLanguage().speech;
  window.speechSynthesis.speak(phrase);
});

window.addEventListener("hashchange", () => {
  const requested = window.location.hash.slice(1);
  if (["home", "practice", "moments"].includes(requested)) switchView(requested, false);
});

window.addEventListener("focus", refreshSharedSpace);
document.addEventListener("visibilitychange", refreshSharedSpace);
window.setInterval(refreshSharedSpace, 30000);

const requestedView = window.location.hash.slice(1);
if (["home", "practice", "moments"].includes(requestedView)) switchView(requestedView, false);
render();
initializeBackend();
