import { createClient } from "@supabase/supabase-js";
import { languagePacks } from "./src/domain/languages";
import { getSharedStreak, summarizePractice } from "./src/domain/progress";

const localKey = "tandem-shared-space-v1";
const phrasePageSize = 30;
const dialog = document.querySelector("#challenge-dialog");
const languageDialog = document.querySelector("#language-dialog");
const authDialog = document.querySelector("#auth-dialog");
const themeToggle = document.querySelector("#theme-toggle");
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
let questionIndex = 0;
let completed = false;
let sessionToken = 0;
let supabase = null;
let authUser = null;
let couple = null;
let members = [];
let practiceDays = [];
let savedPhrases = [];
let savedPhrasesTotal = 0;
let sharedProgress = null;
let sharedChannel = null;
let sharedChannelCoupleId = null;
let realtimeRefreshTimer;
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
  document.title = "Find your person | Tandem";
  document.querySelector('meta[name="description"]').setAttribute("content", "Create a shared Tandem space and invite someone you love to practice a new language together.");
}

function showAppViews() {
  pairingScreen.classList.add("hidden");
  appViews.classList.remove("hidden");
  switchView(document.querySelector(".view.active")?.dataset.screen ?? "home", false);
}

function switchView(name, updateHash = true) {
  const view = document.querySelector(`#${name}-view`);
  if (!view) return;
  const page = {
    home: {
      title: "Your shared space | Tandem",
      description: "See your shared language practice, celebrate small wins, and find your next five-minute date."
    },
    practice: {
      title: "Practice together | Tandem",
      description: "Play a quick language challenge together and make five minutes of practice part of your day."
    },
    moments: {
      title: "Your saved moments | Tandem",
      description: "Keep the words and phrases you have learned together in one shared collection."
    }
  }[name];
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
  document.title = page.title;
  document.querySelector('meta[name="description"]').setAttribute("content", page.description);
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

function renderSavedPhrases(phrases, total = phrases.length) {
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

  if (phrases.length < total) {
    const loadMore = document.createElement("button");
    loadMore.className = "text-action load-more-phrases";
    loadMore.type = "button";
    loadMore.textContent = "Load more phrases";
    loadMore.addEventListener("click", () => {
      loadMore.disabled = true;
      loadMore.textContent = "Loading…";
      loadMoreSavedPhrases().catch((error) => {
        console.error("Could not load more saved phrases.", error);
        showToast(`Could not load more phrases: ${error.message}`);
      });
    });
    list.append(loadMore);
  }
}

async function loadMoreSavedPhrases() {
  if (!supabase || !couple || !authUser) return;
  const cursor = savedPhrases.at(-1);
  if (!cursor) return;
  const { data, error } = await supabase
    .from("saved_phrases")
    .select("id, language, phrase, translation, created_at")
    .eq("couple_id", couple.id)
    .order("created_at", { ascending: false })
    .order("id", { ascending: false })
    .or(`created_at.lt.${cursor.created_at},and(created_at.eq.${cursor.created_at},id.lt.${cursor.id})`)
    .limit(phrasePageSize);
  if (error) throw error;

  savedPhrases = [...savedPhrases, ...data];
  render();
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
  const progress = sharedProgress || summarizePractice(rows, today);
  const pairName = couple?.name || localState.members.join(" & ");

  document.querySelector("#couple-name").textContent = pairName;
  document.querySelector("#greeting").textContent = `${pairName}, let's learn a little ${language.name.toLowerCase()}.`;
  document.querySelector("#heading-copy").textContent = "Your daily five-minute ritual, made for two.";
  document.querySelector("#language-name").textContent = language.name;
  document.querySelector("#language-code").textContent = activeLanguage.toUpperCase();
  document.querySelector("#lesson-description").textContent = language.description;
  document.querySelector("#phrase-target").textContent = language.phrase;
  document.querySelector("#phrase-translation").textContent = language.translation;
  document.querySelector("#streak-count").textContent = String(
    sharedProgress ? sharedProgress.streak : getSharedStreak(rows, people, today)
  );
  document.querySelector("#word-count").textContent = String(
    sharedProgress ? sharedProgress.words_learned : progress.wordsLearned
  );
  document.querySelector("#phrase-count").textContent = String(couple ? savedPhrasesTotal : saved.length);
  document.querySelector("#minutes-count").textContent = String(progress.minutesToday);
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
  const phraseCount = couple ? savedPhrasesTotal : saved.length;
  document.querySelector("#moments-count").textContent = `${phraseCount} ${phraseCount === 1 ? "phrase" : "phrases"}`;
  document.querySelector("#phrase-hint").textContent = saved.some((item) => item.phrase === language.phrase)
    ? "Already in your shared moments."
    : "Say it to each other today.";

  const saveButton = document.querySelector("#save-phrase");
  const phraseSaved = saved.some((item) => item.phrase === language.phrase && item.language === activeLanguage);
  saveButton.classList.toggle("saved", phraseSaved);
  saveButton.textContent = phraseSaved ? "Saved" : "Save phrase";

  renderLane(document.querySelector("#practice-lanes"), people, rows, today);
  renderLane(document.querySelector("#practice-lanes-large"), people, rows, today);
  renderSavedPhrases(saved, phraseCount);
  renderInvitePanel(people);

  if (couple) {
    setSyncStatus("online", "Shared with your person");
    document.querySelector("#account-button").textContent = "Account";
  } else {
    setSyncStatus("", "Saved on this device");
    document.querySelector("#account-button").textContent = authUser ? "Account" : supabase ? "Sign in to sync" : "Cloud sync not set up";
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

function emailRateLimitMessage(error, action) {
  if (!error.message.toLowerCase().includes("rate limit")) {
    return `Could not send the ${action}: ${error.message}`;
  }
  return `Supabase has temporarily rate-limited email for this project, so the ${action} wasn't sent. Wait for the limit to reset, or configure a custom SMTP provider in Supabase. If you already have a password, return to sign in with email and password.`;
}

function applyTheme(theme) {
  const isDark = theme === "dark";
  document.documentElement.dataset.theme = isDark ? "dark" : "light";
  themeToggle.querySelector(".theme-icon").textContent = isDark ? "☀" : "☾";
  themeToggle.querySelector(".theme-label").textContent = isDark ? "Light mode" : "Dark mode";
  themeToggle.setAttribute("aria-label", `Switch to ${isDark ? "light" : "dark"} theme`);
  themeToggle.setAttribute("aria-pressed", String(isDark));
  document.querySelector('meta[name="theme-color"]').setAttribute("content", isDark ? "#151b18" : "#ffffff");
}

function showPasswordLogin() {
  document.querySelector("#auth-title").textContent = "Welcome back.";
  document.querySelector("#auth-copy").textContent = "Sign in with your email and password.";
  document.querySelector("#password-login-form").classList.remove("hidden");
  document.querySelector("#forgot-password").classList.remove("hidden");
  document.querySelector("#show-email-link").classList.remove("hidden");
  document.querySelector("#auth-provider-options").classList.remove("hidden");
  document.querySelector("#auth-back-to-sign-in").classList.add("hidden");
  document.querySelector("#email-form").classList.add("hidden");
  document.querySelector("#password-recovery-form").classList.add("hidden");
  document.querySelector("#password-reset-form").classList.add("hidden");
  document.querySelector("#auth-message").textContent = "";
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

function stopSharedUpdates() {
  if (sharedChannel && supabase) {
    supabase.removeChannel(sharedChannel).catch((error) => {
      console.error("Could not stop shared updates.", error);
    });
  }
  sharedChannel = null;
  sharedChannelCoupleId = null;
}

function subscribeToSharedUpdates(coupleId) {
  if (!supabase || sharedChannelCoupleId === coupleId) return;
  stopSharedUpdates();

  sharedChannelCoupleId = coupleId;
  sharedChannel = supabase
    .channel(`couple:${coupleId}`)
    .on("postgres_changes", { event: "*", schema: "public", table: "practice_days", filter: `couple_id=eq.${coupleId}` }, refreshSharedSpace)
    .on("postgres_changes", { event: "*", schema: "public", table: "saved_phrases", filter: `couple_id=eq.${coupleId}` }, refreshSharedSpace)
    .on("postgres_changes", { event: "*", schema: "public", table: "couples", filter: `id=eq.${coupleId}` }, refreshSharedSpace)
    .on("postgres_changes", { event: "*", schema: "public", table: "couple_members", filter: `couple_id=eq.${coupleId}` }, refreshSharedSpace)
    .subscribe((status, error) => {
      if (status === "CHANNEL_ERROR" || status === "TIMED_OUT") {
        console.error("Live shared updates are unavailable.", error || status);
        setSyncStatus("offline", "Live updates unavailable");
      }
    });
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
    stopSharedUpdates();
    couple = null;
    members = [];
    practiceDays = [];
    savedPhrases = [];
    savedPhrasesTotal = 0;
    sharedProgress = null;
    setSyncStatus("online", "Signed in · set up your space");
    document.querySelector("#account-button").textContent = "Account";
    showPairingScreen();
    return;
  }

  const [
    { data: coupleData, error: coupleError },
    { data: memberData, error: memberError },
    { data: progressData, error: progressError },
    { data: phraseData, error: phraseError, count: phraseCount }
  ] = await Promise.all([
    supabase.from("couples").select("id, name, language, invite_code").eq("id", membership.couple_id).single(),
    supabase.from("couple_members").select("user_id, display_name, joined_at").eq("couple_id", membership.couple_id).order("joined_at"),
    supabase.rpc("get_couple_progress", { p_couple_id: membership.couple_id }),
    supabase.from("saved_phrases").select("id, language, phrase, translation, created_at", { count: "exact" })
      .eq("couple_id", membership.couple_id)
      .order("created_at", { ascending: false })
      .order("id", { ascending: false })
      .range(0, phrasePageSize - 1)
  ]);
  if (token !== sessionToken) return;
  if (coupleError) throw coupleError;
  if (memberError) throw memberError;
  if (progressError) throw progressError;
  if (phraseError) throw phraseError;
  if (token !== sessionToken) return;

  couple = coupleData;
  members = memberData;
  sharedProgress = {
    streak: progressData.streak,
    words_learned: progressData.words_learned,
    minutesToday: progressData.minutes_today
  };
  practiceDays = progressData.today_user_ids.map((userId) => ({
    user_id: userId,
    practiced_on: currentDate(),
    minutes: 5
  }));
  savedPhrases = phraseData;
  savedPhrasesTotal = phraseCount || 0;
  activeLanguage = couple.language;
  showAppViews();
  render();
  subscribeToSharedUpdates(couple.id);
}

async function handleSession(session) {
  authUser = session?.user || null;
  if (!authUser) {
    sessionToken += 1;
    stopSharedUpdates();
    couple = null;
    members = [];
    practiceDays = [];
    savedPhrases = [];
    savedPhrasesTotal = 0;
    sharedProgress = null;
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
    supabase = createClient(settings.supabaseUrl, settings.supabaseAnonKey);
    supabase.auth.onAuthStateChange((event, nextSession) => {
      window.setTimeout(() => {
        if (event === "PASSWORD_RECOVERY") showPasswordRecovery();
        handleSession(nextSession).catch((authError) => {
          console.error("Could not update the Tandem sign-in state.", authError);
          showToast(`Sign-in update failed: ${authError.message}`);
        });
      }, 0);
    });
    const { data: { session }, error } = await supabase.auth.getSession();
    if (error) throw error;
    await handleSession(session);
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
  window.clearTimeout(realtimeRefreshTimer);
  realtimeRefreshTimer = window.setTimeout(() => {
    loadSharedSpace(authUser).catch((error) => {
      console.error("Could not refresh the shared Tandem space.", error);
      setSyncStatus("offline", "Couldn't refresh shared space");
      showToast(`Could not refresh shared progress: ${error.message}`);
    });
  }, 250);
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

applyTheme(document.documentElement.dataset.theme === "dark" ? "dark" : "light");

themeToggle.addEventListener("click", () => {
  const nextTheme = document.documentElement.dataset.theme === "dark" ? "light" : "dark";
  applyTheme(nextTheme);
  try {
    localStorage.setItem("tandem-theme", nextTheme);
  } catch (error) {
    console.error("Could not save the selected Tandem theme.", error);
    showToast("Theme changed, but this browser could not save your preference.");
  }
});

document.querySelectorAll("[data-password-toggle]").forEach((toggle) => {
  const input = document.getElementById(toggle.getAttribute("aria-controls"));
  toggle.addEventListener("click", () => {
    const visible = input.type === "password";
    input.type = visible ? "text" : "password";
    toggle.textContent = visible ? "Hide" : "Show";
    toggle.setAttribute("aria-label", `${visible ? "Hide" : "Show"} password`);
    toggle.setAttribute("aria-pressed", String(visible));
    input.focus({ preventScroll: true });
  });
});

document.querySelector("#account-button").addEventListener("click", () => {
  if (!supabase) {
    showToast("Cloud sync is not connected. Add Supabase settings in config.js to sign in.");
    return;
  }
  if (authUser) {
    document.querySelector("#account-message").textContent = "";
    document.querySelector("#account-dialog").showModal();
  } else {
    showPasswordLogin();
    authDialog.showModal();
  }
});

document.querySelector("#show-email-link").addEventListener("click", () => {
  document.querySelector("#email-input").value = document.querySelector("#login-email").value;
  document.querySelector("#password-login-form").classList.add("hidden");
  document.querySelector("#forgot-password").classList.add("hidden");
  document.querySelector("#show-email-link").classList.add("hidden");
  document.querySelector("#auth-provider-options").classList.add("hidden");
  document.querySelector("#email-form").classList.remove("hidden");
  document.querySelector("#auth-back-to-sign-in").classList.remove("hidden");
  document.querySelector("#auth-message").textContent = "";
  document.querySelector("#auth-copy").textContent = "Use an email link to sign in, then set a password from Account.";
});

document.querySelector("#forgot-password").addEventListener("click", () => {
  document.querySelector("#recovery-email").value = document.querySelector("#login-email").value;
  document.querySelector("#auth-title").textContent = "Reset your password.";
  document.querySelector("#auth-copy").textContent = "We’ll email you a secure link to choose a new password.";
  document.querySelector("#password-login-form").classList.add("hidden");
  document.querySelector("#forgot-password").classList.add("hidden");
  document.querySelector("#show-email-link").classList.add("hidden");
  document.querySelector("#auth-provider-options").classList.add("hidden");
  document.querySelector("#password-recovery-form").classList.remove("hidden");
  document.querySelector("#auth-back-to-sign-in").classList.remove("hidden");
  document.querySelector("#auth-message").textContent = "";
});

document.querySelector("#auth-back-to-sign-in").addEventListener("click", () => {
  showPasswordLogin();
  document.querySelector("#login-email").focus();
});

function showPasswordRecovery() {
  document.querySelector("#auth-title").textContent = "Choose a new password.";
  document.querySelector("#auth-copy").textContent = "Your reset link is verified. Choose a new password for your account.";
  document.querySelector("#password-login-form").classList.add("hidden");
  document.querySelector("#forgot-password").classList.add("hidden");
  document.querySelector("#show-email-link").classList.add("hidden");
  document.querySelector("#auth-provider-options").classList.add("hidden");
  document.querySelector("#email-form").classList.add("hidden");
  document.querySelector("#password-recovery-form").classList.add("hidden");
  document.querySelector("#password-reset-form").classList.remove("hidden");
  document.querySelector("#auth-back-to-sign-in").classList.remove("hidden");
  document.querySelector("#auth-message").textContent = "";
  if (!authDialog.open) authDialog.showModal();
  document.querySelector("#reset-password").focus();
}

document.querySelector("#password-login-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const message = document.querySelector("#auth-message");
  const values = new FormData(form);
  button.disabled = true;
  setFormMessage(message, "Signing you in…");
  try {
    const { error } = await supabase.auth.signInWithPassword({
      email: values.get("email").trim(),
      password: values.get("password")
    });
    if (error) throw error;
    authDialog.close();
  } catch (error) {
    console.error("Could not sign in with a password.", error);
    setFormMessage(message, `Could not sign in: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#google-sign-in").addEventListener("click", async (event) => {
  if (!supabase) {
    showToast("Cloud sync is not connected. Add Supabase settings in config.js to sign in.");
    return;
  }
  const button = event.currentTarget;
  const message = document.querySelector("#auth-message");
  button.disabled = true;
  setFormMessage(message, "Connecting to Google…");
  try {
    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}${window.location.pathname}` }
    });
    if (error) throw error;
  } catch (error) {
    console.error("Could not sign in with Google.", error);
    setFormMessage(message, `Could not sign in with Google: ${error.message}`, "error");
    button.disabled = false;
  }
});

document.querySelector("#set-password-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const message = document.querySelector("#account-message");
  const values = new FormData(form);
  const password = values.get("password");
  if (password !== values.get("confirmPassword")) {
    setFormMessage(message, "Those passwords don't match. Please try again.", "error");
    return;
  }
  button.disabled = true;
  setFormMessage(message, "Saving your password…");
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    form.reset();
    setFormMessage(message, "Password saved. You can use it the next time you sign in.", "success");
  } catch (error) {
    console.error("Could not save your password.", error);
    setFormMessage(message, `Could not save password: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#sign-out-button").addEventListener("click", async () => {
  const button = document.querySelector("#sign-out-button");
  button.disabled = true;
  try {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    document.querySelector("#account-dialog").close();
  } catch (error) {
    console.error("Could not sign out.", error);
    setFormMessage(document.querySelector("#account-message"), `Could not sign out: ${error.message}`, "error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#email-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const message = document.querySelector("#auth-message");
  button.disabled = true;
  setFormMessage(message, "Sending your sign-in link…");
  try {
    const email = new FormData(form).get("email").trim();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}${window.location.pathname}` }
    });
    if (error) throw error;
    setFormMessage(message, "Check your inbox for your one-time sign-in link.", "success");
  } catch (error) {
    console.error("Could not send the sign-in link.", error);
    setFormMessage(message, emailRateLimitMessage(error, "sign-in link"), "error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#password-recovery-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const message = document.querySelector("#auth-message");
  const email = new FormData(form).get("email").trim();
  button.disabled = true;
  setFormMessage(message, "Sending your password reset link…");
  try {
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}${window.location.pathname}`
    });
    if (error) throw error;
    setFormMessage(message, "If an account exists for that email, a password reset link is on its way.", "success");
  } catch (error) {
    console.error("Could not send the password reset link.", error);
    setFormMessage(message, emailRateLimitMessage(error, "password reset link"), "error");
  } finally {
    button.disabled = false;
  }
});

document.querySelector("#password-reset-form").addEventListener("submit", async (event) => {
  event.preventDefault();
  const form = event.currentTarget;
  const button = form.querySelector("button[type=submit]");
  const message = document.querySelector("#auth-message");
  const values = new FormData(form);
  const password = values.get("password");
  if (password !== values.get("confirmPassword")) {
    setFormMessage(message, "Those passwords don't match. Please try again.", "error");
    return;
  }
  button.disabled = true;
  setFormMessage(message, "Updating your password…");
  try {
    const { error } = await supabase.auth.updateUser({ password });
    if (error) throw error;
    form.reset();
    setFormMessage(message, "Your password has been updated. You can now sign in with it.", "success");
    window.setTimeout(() => {
      authDialog.close();
      showPasswordLogin();
    }, 1200);
  } catch (error) {
    console.error("Could not update your password.", error);
    setFormMessage(message, `Could not update password: ${error.message}`, "error");
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
    const { data: { user: verifiedUser }, error: userError } = await supabase.auth.getUser();
    if (userError) throw userError;
    if (!verifiedUser || verifiedUser.id !== authUser?.id) {
      throw new Error("Your sign-in session doesn't match an account in this Supabase project. Sign out and sign in again, then retry.");
    }

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
    const message = error.code === "23503" && error.message.includes("couples_created_by_fkey")
      ? "Your account couldn't be matched to a user in this Supabase project. Sign out and sign in again. If it continues, confirm config.js points to the intended Supabase project."
      : error.message;
    setFormMessage(document.querySelector("#pairing-message"), message, "error");
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

const requestedView = window.location.hash.slice(1);
if (["home", "practice", "moments"].includes(requestedView)) switchView(requestedView, false);
render();
initializeBackend();
