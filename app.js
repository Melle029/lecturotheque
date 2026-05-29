const STORAGE_KEY = "lecturotheque.library.v1";
const CLOUD_CONFIG_KEY = "lecturotheque.cloud.v1";
let pdfjsLibPromise = null;
let supabaseLibPromise = null;

const state = {
  mode: "text",
  docs: loadDocs(),
  selectedId: null,
  currentStudy: "summary",
  fetchedWebText: "",
  cloudConfig: loadCloudConfig(),
  supabase: null,
  session: null,
  syncing: false,
};

const els = {
  tabs: document.querySelectorAll(".tab"),
  modePanels: {
    text: document.getElementById("textImport"),
    pdf: document.getElementById("pdfImport"),
    web: document.getElementById("webImport"),
  },
  title: document.getElementById("docTitle"),
  category: document.getElementById("docCategory"),
  categoryList: document.getElementById("categoryList"),
  categoryFilter: document.getElementById("categoryFilter"),
  language: document.getElementById("languageSelect"),
  textInput: document.getElementById("textInput"),
  pdfInput: document.getElementById("pdfInput"),
  urlInput: document.getElementById("urlInput"),
  fetchUrlBtn: document.getElementById("fetchUrlBtn"),
  saveDocBtn: document.getElementById("saveDocBtn"),
  status: document.getElementById("statusText"),
  libraryList: document.getElementById("libraryList"),
  docCount: document.getElementById("docCount"),
  search: document.getElementById("searchInput"),
  selectedTitle: document.getElementById("selectedTitle"),
  selectedCategory: document.getElementById("selectedCategory"),
  selectedLanguage: document.getElementById("selectedLanguage"),
  originalText: document.getElementById("originalText"),
  translatedText: document.getElementById("translatedText"),
  readOriginalBtn: document.getElementById("readOriginalBtn"),
  translateBtn: document.getElementById("translateBtn"),
  readFrenchBtn: document.getElementById("readFrenchBtn"),
  stopSpeechBtn: document.getElementById("stopSpeechBtn"),
  summarizeBtn: document.getElementById("summarizeBtn"),
  studyBtn: document.getElementById("studyBtn"),
  summaryOutput: document.getElementById("summaryOutput"),
  cardsOutput: document.getElementById("cardsOutput"),
  saveStudyBtn: document.getElementById("saveStudyBtn"),
  studyTabs: document.querySelectorAll(".study-tab"),
  copyOriginalBtn: document.getElementById("copyOriginalBtn"),
  copyFrenchBtn: document.getElementById("copyFrenchBtn"),
  exportBtn: document.getElementById("exportBtn"),
  clearBtn: document.getElementById("clearBtn"),
  cloudStatus: document.getElementById("cloudStatus"),
  supabaseUrl: document.getElementById("supabaseUrl"),
  supabaseKey: document.getElementById("supabaseKey"),
  saveCloudBtn: document.getElementById("saveCloudBtn"),
  emailInput: document.getElementById("emailInput"),
  signInBtn: document.getElementById("signInBtn"),
  signOutBtn: document.getElementById("signOutBtn"),
  syncBtn: document.getElementById("syncBtn"),
};

document.addEventListener("DOMContentLoaded", init);

function init() {
  bindEvents();
  registerServiceWorker();
  initCloud();
  renderLibrary();
  if (state.docs.length) selectDoc(state.docs[0].id);
}

function bindEvents() {
  els.tabs.forEach((tab) => {
    tab.addEventListener("click", () => setMode(tab.dataset.mode));
  });

  els.studyTabs.forEach((tab) => {
    tab.addEventListener("click", () => setStudyTab(tab.dataset.study));
  });

  els.fetchUrlBtn.addEventListener("click", importUrl);
  els.saveDocBtn.addEventListener("click", saveCurrentDocument);
  els.search.addEventListener("input", renderLibrary);
  els.categoryFilter.addEventListener("change", renderLibrary);
  els.readOriginalBtn.addEventListener("click", () => speakSelected("original"));
  els.readFrenchBtn.addEventListener("click", () => speakSelected("french"));
  els.stopSpeechBtn.addEventListener("click", () => speechSynthesis.cancel());
  els.translateBtn.addEventListener("click", translateSelected);
  els.summarizeBtn.addEventListener("click", summarizeSelected);
  els.studyBtn.addEventListener("click", makeStudyCards);
  els.saveStudyBtn.addEventListener("click", saveStudyArtifacts);
  els.copyOriginalBtn.addEventListener("click", () => copyText(getSelected()?.text || ""));
  els.copyFrenchBtn.addEventListener("click", () => copyText(getSelected()?.translatedText || ""));
  els.exportBtn.addEventListener("click", exportLibrary);
  els.clearBtn.addEventListener("click", clearLibrary);
  els.saveCloudBtn.addEventListener("click", saveCloudSettings);
  els.signInBtn.addEventListener("click", signInWithEmail);
  els.signOutBtn.addEventListener("click", signOut);
  els.syncBtn.addEventListener("click", syncLibrary);
}

function setMode(mode) {
  state.mode = mode;
  els.tabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.mode === mode));
  Object.entries(els.modePanels).forEach(([key, panel]) => panel.classList.toggle("active", key === mode));
  setStatus("");
}

function setStudyTab(study) {
  state.currentStudy = study;
  els.studyTabs.forEach((tab) => tab.classList.toggle("active", tab.dataset.study === study));
  els.summaryOutput.classList.toggle("active", study === "summary");
  els.cardsOutput.classList.toggle("active", study === "cards");
}

async function importUrl() {
  const url = els.urlInput.value.trim();
  if (!url) return setStatus("Entre une adresse web.");
  setStatus("Import du texte web en cours...");

  try {
    const response = await fetch(url);
    const html = await response.text();
    const doc = new DOMParser().parseFromString(html, "text/html");
    doc.querySelectorAll("script, style, nav, footer, header, aside").forEach((node) => node.remove());
    const title = doc.querySelector("title")?.textContent?.trim();
    const text = normalizeText(doc.body?.innerText || "");
    state.fetchedWebText = text;
    if (!els.title.value && title) els.title.value = title;
    setStatus(text ? "Texte web importe. Tu peux l'ajouter a la bibliotheque." : "Aucun texte lisible trouve.");
  } catch (error) {
    setStatus("Import bloque par le site. Colle le texte dans l'onglet Texte.");
  }
}

async function saveCurrentDocument() {
  setStatus("Preparation du document...");
  const text = await getImportText();
  if (!text.trim()) return setStatus("Ajoute un texte, un PDF ou une page web avant de classer.");

  const doc = {
    id: crypto.randomUUID(),
    title: els.title.value.trim() || makeTitle(text),
    category: els.category.value.trim() || "Non classe",
    language: els.language.value === "auto" ? detectLanguage(text) : els.language.value,
    text: normalizeText(text),
    translatedText: "",
    summary: "",
    cards: "",
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };

  state.docs.unshift(doc);
  persist();
  pushDocSoon(doc);
  clearImportFields();
  renderLibrary();
  selectDoc(doc.id);
  setStatus("Document ajoute a la bibliotheque.");
}

async function getImportText() {
  if (state.mode === "text") return els.textInput.value;
  if (state.mode === "web") return state.fetchedWebText || els.textInput.value;
  if (state.mode === "pdf") return extractPdfText();
  return "";
}

async function extractPdfText() {
  const file = els.pdfInput.files?.[0];
  if (!file) return "";
  const pdfjsLib = await loadPdfLibrary();
  if (!pdfjsLib) {
    setStatus("PDF.js n'a pas pu se charger. Verifie la connexion Internet, puis reessaie.");
    return "";
  }

  const buffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
  const pages = [];

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber += 1) {
    const page = await pdf.getPage(pageNumber);
    const content = await page.getTextContent();
    pages.push(content.items.map((item) => item.str).join(" "));
  }

  return normalizeText(pages.join("\n\n"));
}

async function loadPdfLibrary() {
  if (!pdfjsLibPromise) {
    pdfjsLibPromise = import("https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.min.mjs")
      .then((lib) => {
        lib.GlobalWorkerOptions.workerSrc = "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/4.10.38/pdf.worker.min.mjs";
        return lib;
      })
      .catch(() => null);
  }
  return pdfjsLibPromise;
}

function renderLibrary() {
  const query = els.search.value.trim().toLowerCase();
  const selectedCategory = els.categoryFilter.value;
  const categories = [...new Set(state.docs.map((doc) => doc.category))].sort();

  els.categoryFilter.innerHTML = '<option value="">Toutes les categories</option>';
  els.categoryList.innerHTML = "";
  categories.forEach((category) => {
    const option = document.createElement("option");
    option.value = category;
    option.textContent = category;
    els.categoryFilter.append(option);

    const dataOption = document.createElement("option");
    dataOption.value = category;
    els.categoryList.append(dataOption);
  });
  els.categoryFilter.value = selectedCategory;

  const filtered = state.docs.filter((doc) => {
    const haystack = `${doc.title} ${doc.category} ${doc.text}`.toLowerCase();
    return (!query || haystack.includes(query)) && (!selectedCategory || doc.category === selectedCategory);
  });

  els.docCount.textContent = state.docs.length;
  els.libraryList.innerHTML = "";

  if (!filtered.length) {
    const empty = document.createElement("p");
    empty.className = "hint";
    empty.textContent = "Aucun document pour le moment.";
    els.libraryList.append(empty);
    return;
  }

  const template = document.getElementById("libraryItemTemplate");
  filtered.forEach((doc) => {
    const item = template.content.firstElementChild.cloneNode(true);
    item.classList.toggle("active", doc.id === state.selectedId);
    item.querySelector(".item-title").textContent = doc.title;
    item.querySelector(".item-meta").textContent = `${doc.category} · ${doc.language.toUpperCase()} · ${wordCount(doc.text)} mots`;
    item.addEventListener("click", () => selectDoc(doc.id));
    els.libraryList.append(item);
  });
}

function selectDoc(id) {
  state.selectedId = id;
  const doc = getSelected();
  if (!doc) return;

  els.selectedTitle.textContent = doc.title;
  els.selectedCategory.textContent = doc.category;
  els.selectedLanguage.textContent = doc.language.toUpperCase();
  setTextBox(els.originalText, doc.text);
  setTextBox(els.translatedText, doc.translatedText || "La traduction francaise apparaitra ici.");
  els.summaryOutput.innerHTML = doc.summary || "Cree un resume pour le document choisi.";
  els.cardsOutput.innerHTML = doc.cards || "Cree une fiche d'etude pour reviser.";
  renderLibrary();
}

async function translateSelected() {
  const doc = getSelected();
  if (!doc) return setStatus("Choisis un document.");
  if (doc.language === "fr") {
    doc.translatedText = doc.text;
    touchDoc(doc);
    persist();
    pushDocSoon(doc);
    selectDoc(doc.id);
    return setStatus("Le document est deja en francais.");
  }

  setStatus("Traduction en cours...");
  doc.translatedText = await translateToFrench(doc.text);
  touchDoc(doc);
  persist();
  pushDocSoon(doc);
  selectDoc(doc.id);
  setStatus("Traduction ajoutee au document.");
}

async function translateToFrench(text) {
  const translator = await makeBrowserTranslator();
  if (translator) {
    try {
      return await translator.translate(text);
    } catch (error) {
      return fallbackTranslation(text);
    }
  }
  return fallbackTranslation(text);
}

async function makeBrowserTranslator() {
  if (!("Translator" in window)) return null;
  try {
    const availability = await window.Translator.availability({ sourceLanguage: "en", targetLanguage: "fr" });
    if (availability === "unavailable") return null;
    return window.Translator.create({ sourceLanguage: "en", targetLanguage: "fr" });
  } catch (error) {
    return null;
  }
}

function fallbackTranslation(text) {
  const replacements = [
    ["introduction", "introduction"],
    ["conclusion", "conclusion"],
    ["research", "recherche"],
    ["study", "etude"],
    ["students", "eleves"],
    ["learning", "apprentissage"],
    ["memory", "memoire"],
    ["important", "important"],
    ["because", "parce que"],
    ["however", "cependant"],
    ["therefore", "donc"],
    ["the ", "le/la "],
    ["and ", "et "],
    ["with ", "avec "],
    ["without ", "sans "],
  ];
  let translated = text;
  replacements.forEach(([source, target]) => {
    translated = translated.replaceAll(new RegExp(`\\b${escapeRegExp(source)}\\b`, "gi"), target);
  });
  return `Traduction locale d'aperçu:\n\n${translated}\n\nNote: pour une traduction complete, branche une API de traduction ou active l'API Translator du navigateur.`;
}

function speakSelected(kind) {
  const doc = getSelected();
  if (!doc) return setStatus("Choisis un document.");
  const text = kind === "french" ? doc.translatedText || doc.text : doc.text;
  const lang = kind === "french" ? "fr-CA" : doc.language === "fr" ? "fr-CA" : "en-US";
  speak(text, lang);
}

function speak(text, lang) {
  if (!("speechSynthesis" in window)) return setStatus("La lecture vocale n'est pas disponible dans ce navigateur.");
  speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text.slice(0, 18000));
  utterance.lang = lang;
  utterance.rate = lang.startsWith("fr") ? 0.95 : 1;
  utterance.pitch = 1;
  const voices = speechSynthesis.getVoices();
  utterance.voice = voices.find((voice) => voice.lang.toLowerCase().startsWith(lang.slice(0, 2))) || null;
  speechSynthesis.speak(utterance);
  setStatus(`Lecture lancee en ${lang.startsWith("fr") ? "francais" : "anglais"}.`);
}

function summarizeSelected() {
  const doc = getSelected();
  if (!doc) return setStatus("Choisis un document.");
  const base = doc.translatedText || doc.text;
  const sentences = splitSentences(base);
  const top = rankSentences(sentences).slice(0, 5);
  const keywords = topKeywords(base).slice(0, 8);
  doc.summary = `
    <h4>Resume</h4>
    <ul>${top.map((sentence) => `<li>${escapeHtml(sentence)}</li>`).join("")}</ul>
    <h4>Mots cles</h4>
    <p>${keywords.map(escapeHtml).join(", ") || "Aucun mot cle detecte."}</p>
  `;
  touchDoc(doc);
  persist();
  pushDocSoon(doc);
  selectDoc(doc.id);
  setStudyTab("summary");
  setStatus("Resume cree et garde avec le document.");
}

function makeStudyCards() {
  const doc = getSelected();
  if (!doc) return setStatus("Choisis un document.");
  const base = doc.translatedText || doc.text;
  const keywords = topKeywords(base).slice(0, 6);
  const sentences = rankSentences(splitSentences(base)).slice(0, 6);
  doc.cards = `
    <h4>Questions rapides</h4>
    <ul>
      ${keywords.map((word) => `<li><strong>${escapeHtml(word)}</strong>: explique ce terme avec tes propres mots.</li>`).join("")}
      ${sentences.slice(0, 3).map((sentence) => `<li>Pourquoi cette idee est-elle importante: ${escapeHtml(sentence)}</li>`).join("")}
    </ul>
    <h4>A retenir</h4>
    <ul>${sentences.slice(0, 4).map((sentence) => `<li>${escapeHtml(sentence)}</li>`).join("")}</ul>
  `;
  touchDoc(doc);
  persist();
  pushDocSoon(doc);
  selectDoc(doc.id);
  setStudyTab("cards");
  setStatus("Fiche d'etude creee et classee.");
}

function saveStudyArtifacts() {
  const doc = getSelected();
  if (!doc) return setStatus("Choisis un document.");
  doc.category = doc.category || "Fiches d'etude";
  touchDoc(doc);
  persist();
  pushDocSoon(doc);
  renderLibrary();
  setStatus("Resume et fiches sont classes avec le document.");
}

function splitSentences(text) {
  return normalizeText(text)
    .split(/(?<=[.!?])\s+/)
    .map((sentence) => sentence.trim())
    .filter((sentence) => sentence.length > 35);
}

function rankSentences(sentences) {
  const keywords = topKeywords(sentences.join(" "));
  return [...sentences].sort((a, b) => scoreSentence(b, keywords) - scoreSentence(a, keywords));
}

function scoreSentence(sentence, keywords) {
  const lower = sentence.toLowerCase();
  return keywords.reduce((score, keyword) => score + (lower.includes(keyword) ? 1 : 0), 0) + Math.min(sentence.length / 180, 1);
}

function topKeywords(text) {
  const stopwords = new Set(
    "avec dans pour plus nous vous they their about from that this have were are was une des les est pas qui que the and of to in a an en le la du de et un it on as is by be or".split(" "),
  );
  const counts = new Map();
  normalizeText(text)
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .filter((word) => word.length > 3 && !stopwords.has(word))
    .forEach((word) => counts.set(word, (counts.get(word) || 0) + 1));
  return [...counts.entries()]
    .sort((a, b) => b[1] - a[1])
    .map(([word]) => word);
}

function detectLanguage(text) {
  const frenchSignals = [" le ", " la ", " les ", " des ", " une ", " que ", " avec ", " pour ", " francais", "etait"];
  const englishSignals = [" the ", " and ", " with ", " from ", " that ", " this ", " because ", " english"];
  const sample = ` ${text.toLowerCase().slice(0, 4000)} `;
  const fr = frenchSignals.filter((signal) => sample.includes(signal)).length;
  const en = englishSignals.filter((signal) => sample.includes(signal)).length;
  return fr >= en ? "fr" : "en";
}

function loadDocs() {
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
  } catch (error) {
    return [];
  }
}

function persist() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.docs));
}

function touchDoc(doc) {
  doc.updatedAt = new Date().toISOString();
}

function getSelected() {
  return state.docs.find((doc) => doc.id === state.selectedId);
}

function setTextBox(el, text) {
  el.textContent = text;
  el.classList.toggle("empty", !text || text.includes("apparaitra ici"));
}

function normalizeText(text) {
  return text.replace(/\s+/g, " ").replace(/\s([,.!?;:])/g, "$1").trim();
}

function makeTitle(text) {
  return normalizeText(text).slice(0, 58) || "Document sans titre";
}

function wordCount(text) {
  return normalizeText(text).split(/\s+/).filter(Boolean).length;
}

function setStatus(message) {
  els.status.textContent = message;
}

function clearImportFields() {
  els.title.value = "";
  els.category.value = "";
  els.textInput.value = "";
  els.urlInput.value = "";
  els.pdfInput.value = "";
  state.fetchedWebText = "";
}

async function copyText(text) {
  if (!text) return setStatus("Rien a copier.");
  await navigator.clipboard.writeText(text);
  setStatus("Texte copie.");
}

function exportLibrary() {
  const blob = new Blob([JSON.stringify(state.docs, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = "lecturotheque-bibliotheque.json";
  link.click();
  URL.revokeObjectURL(link.href);
}

function clearLibrary() {
  if (!confirm("Vider toute la bibliotheque locale et cloud pour ce compte?")) return;
  state.docs = [];
  state.selectedId = null;
  persist();
  clearCloudLibrary();
  renderLibrary();
  selectEmpty();
}

function selectEmpty() {
  els.selectedTitle.textContent = "Choisis ou importe un document";
  els.selectedCategory.textContent = "Aucun document choisi";
  els.selectedLanguage.textContent = "--";
  setTextBox(els.originalText, "Le contenu du document apparaitra ici.");
  setTextBox(els.translatedText, "La traduction francaise apparaitra ici.");
  els.summaryOutput.textContent = "Cree un resume pour le document choisi.";
  els.cardsOutput.textContent = "Cree une fiche d'etude pour reviser.";
}

function escapeRegExp(text) {
  return text.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}

function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) return;
  if (location.protocol !== "https:" && location.hostname !== "127.0.0.1" && location.hostname !== "localhost") return;
  navigator.serviceWorker.register("sw.js").catch(() => {});
}

async function initCloud() {
  els.supabaseUrl.value = state.cloudConfig.url || "";
  els.supabaseKey.value = state.cloudConfig.key || "";
  if (!state.cloudConfig.url || !state.cloudConfig.key) {
    setCloudStatus("Cloud non configure");
    return;
  }

  await connectSupabase();
}

async function loadSupabaseLib() {
  if (!supabaseLibPromise) {
    supabaseLibPromise = import("https://esm.sh/@supabase/supabase-js@2").catch(() => null);
  }
  return supabaseLibPromise;
}

async function connectSupabase() {
  const lib = await loadSupabaseLib();
  if (!lib) {
    setCloudStatus("Supabase indisponible");
    return null;
  }

  state.supabase = lib.createClient(state.cloudConfig.url, state.cloudConfig.key);
  const { data } = await state.supabase.auth.getSession();
  state.session = data.session;
  state.supabase.auth.onAuthStateChange((_event, session) => {
    state.session = session;
    updateCloudStatus();
    if (session) syncLibrary();
  });
  updateCloudStatus();
  if (state.session) syncLibrary();
  return state.supabase;
}

function loadCloudConfig() {
  try {
    return JSON.parse(localStorage.getItem(CLOUD_CONFIG_KEY) || "{}");
  } catch (error) {
    return {};
  }
}

async function saveCloudSettings() {
  state.cloudConfig = {
    url: els.supabaseUrl.value.trim(),
    key: els.supabaseKey.value.trim(),
  };

  if (!state.cloudConfig.url || !state.cloudConfig.key) {
    return setCloudStatus("Ajoute l'URL et la cle");
  }

  localStorage.setItem(CLOUD_CONFIG_KEY, JSON.stringify(state.cloudConfig));
  setCloudStatus("Connexion au cloud...");
  await connectSupabase();
}

async function signInWithEmail() {
  const email = els.emailInput.value.trim();
  const supabase = await requireSupabase();
  if (!supabase) return;
  if (!email) return setCloudStatus("Entre ton courriel");

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: { emailRedirectTo: location.origin + location.pathname },
  });

  setCloudStatus(error ? "Connexion impossible" : "Lien envoye par courriel");
}

async function signOut() {
  const supabase = await requireSupabase();
  if (!supabase) return;
  await supabase.auth.signOut();
  state.session = null;
  updateCloudStatus();
}

async function requireSupabase() {
  if (state.supabase) return state.supabase;
  if (!state.cloudConfig.url || !state.cloudConfig.key) {
    setCloudStatus("Configure Supabase d'abord");
    return null;
  }
  return connectSupabase();
}

function updateCloudStatus() {
  if (!state.cloudConfig.url || !state.cloudConfig.key) return setCloudStatus("Cloud non configure");
  if (!state.session?.user?.email) return setCloudStatus("Cloud pret, non connecte");
  setCloudStatus(`Connecte: ${state.session.user.email}`);
}

function setCloudStatus(message) {
  els.cloudStatus.textContent = message;
}

async function syncLibrary() {
  if (state.syncing) return;
  const supabase = await requireSupabase();
  if (!supabase || !state.session) return setCloudStatus("Connecte-toi pour synchroniser");

  state.syncing = true;
  setCloudStatus("Synchronisation...");
  try {
    const { data, error } = await supabase.from("documents").select("*").order("updated_at", { ascending: false });
    if (error) throw error;

    const merged = mergeDocs(state.docs, (data || []).map(fromCloudDoc));
    state.docs = merged;
    persist();

    if (state.docs.length) {
      const { error: upsertError } = await supabase.from("documents").upsert(state.docs.map(toCloudDoc), {
        onConflict: "id",
      });
      if (upsertError) throw upsertError;
    }

    renderLibrary();
    if (state.selectedId) selectDoc(state.selectedId);
    else if (state.docs.length) selectDoc(state.docs[0].id);
    setCloudStatus(`Synchro OK: ${state.docs.length} documents`);
  } catch (error) {
    setCloudStatus("Synchro impossible");
  } finally {
    state.syncing = false;
  }
}

function pushDocSoon(doc) {
  if (!state.supabase || !state.session) return;
  window.clearTimeout(pushDocSoon.timer);
  pushDocSoon.timer = window.setTimeout(() => pushDocToCloud(doc), 700);
}

async function pushDocToCloud(doc) {
  const supabase = await requireSupabase();
  if (!supabase || !state.session) return;
  await supabase.from("documents").upsert(toCloudDoc(doc), { onConflict: "id" });
  updateCloudStatus();
}

async function clearCloudLibrary() {
  const supabase = await requireSupabase();
  if (!supabase || !state.session) return;
  await supabase.from("documents").delete().eq("user_id", state.session.user.id);
}

function mergeDocs(localDocs, cloudDocs) {
  const byId = new Map();
  [...localDocs, ...cloudDocs].forEach((doc) => {
    const current = byId.get(doc.id);
    if (!current || new Date(doc.updatedAt || doc.createdAt) > new Date(current.updatedAt || current.createdAt)) {
      byId.set(doc.id, doc);
    }
  });
  return [...byId.values()].sort((a, b) => new Date(b.updatedAt || b.createdAt) - new Date(a.updatedAt || a.createdAt));
}

function toCloudDoc(doc) {
  return {
    id: doc.id,
    user_id: state.session.user.id,
    title: doc.title,
    category: doc.category,
    language: doc.language,
    text: doc.text,
    translated_text: doc.translatedText || "",
    summary: doc.summary || "",
    cards: doc.cards || "",
    created_at: doc.createdAt || new Date().toISOString(),
    updated_at: doc.updatedAt || doc.createdAt || new Date().toISOString(),
  };
}

function fromCloudDoc(row) {
  return {
    id: row.id,
    title: row.title,
    category: row.category,
    language: row.language,
    text: row.text,
    translatedText: row.translated_text || "",
    summary: row.summary || "",
    cards: row.cards || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}
