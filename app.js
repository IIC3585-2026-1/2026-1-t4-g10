import { initializeApp } from "https://www.gstatic.com/firebasejs/12.12.1/firebase-app.js";
import {
  getMessaging,
  getToken,
  isSupported as isMessagingSupported
} from "https://www.gstatic.com/firebasejs/12.12.1/firebase-messaging.js";

import { firebaseConfig, firebaseVapidKey } from "./firebase-config.js";

const titleInput = document.getElementById("noteTitle");
const bodyInput = document.getElementById("noteBody");
const saveBtn = document.getElementById("saveNote");
const notesList = document.getElementById("notesList");
const searchInput = document.getElementById("searchInput");
const statusText = document.getElementById("status");
const notifyBtn = document.getElementById("notifyBtn");

const FIREBASE_PLACEHOLDER_VALUES = new Set([
  "",
  "YOUR_API_KEY",
  "YOUR_PROJECT.firebaseapp.com",
  "YOUR_PROJECT_ID",
  "YOUR_PROJECT.appspot.com",
  "YOUR_SENDER_ID",
  "YOUR_APP_ID"
]);

let notes = loadNotes();
let serviceWorkerRegistration = null;
let firebaseMessaging = null;

function loadNotes() {
  try {
    return JSON.parse(localStorage.getItem("notes")) || [];
  } catch {
    return [];
  }
}

function saveNotes() {
  localStorage.setItem("notes", JSON.stringify(notes));
}

function createNoteElement(note) {
  const article = document.createElement("article");
  article.className = "note";

  const title = document.createElement("h3");
  title.textContent = note.title;

  const body = document.createElement("p");
  body.textContent = note.body;

  const createdAt = document.createElement("small");
  createdAt.textContent = new Date(note.createdAt).toLocaleString();

  const actions = document.createElement("div");
  actions.className = "note-actions";

  const favoriteButton = document.createElement("button");
  favoriteButton.className = "favorite";
  favoriteButton.dataset.id = note.id;
  favoriteButton.textContent = note.favorite ? "★ Favorita" : "☆ Favorita";

  const deleteButton = document.createElement("button");
  deleteButton.className = "delete";
  deleteButton.dataset.id = note.id;
  deleteButton.textContent = "Eliminar";

  actions.append(favoriteButton, deleteButton);
  article.append(title, body, createdAt, actions);

  return article;
}

function renderNotes(filter = "") {
  const normalizedFilter = filter.toLowerCase();

  const filteredNotes = notes.filter(note => {
    return (
      note.title.toLowerCase().includes(normalizedFilter) ||
      note.body.toLowerCase().includes(normalizedFilter)
    );
  });

  notesList.replaceChildren(...filteredNotes.map(createNoteElement));
}

function handleSaveNote() {
  const title = titleInput.value.trim();
  const body = bodyInput.value.trim();

  if (!title || !body) {
    return;
  }

  notes.unshift({
    id: crypto.randomUUID(),
    title,
    body,
    favorite: false,
    createdAt: Date.now()
  });

  saveNotes();
  renderNotes(searchInput.value);

  titleInput.value = "";
  bodyInput.value = "";
}

function handleNoteAction(event) {
  const button = event.target.closest("button[data-id]");

  if (!button) {
    return;
  }

  const { id } = button.dataset;

  if (button.classList.contains("delete")) {
    notes = notes.filter(note => note.id !== id);
  }

  if (button.classList.contains("favorite")) {
    notes = notes.map(note =>
      note.id === id ? { ...note, favorite: !note.favorite } : note
    );
  }

  saveNotes();
  renderNotes(searchInput.value);
}

function updateOnlineStatus() {
  statusText.textContent = navigator.onLine ? "Online" : "Offline";
  statusText.className = navigator.onLine ? "online" : "offline";
}

function hasFirebaseConfig() {
  const requiredConfigValues = [
    firebaseConfig.apiKey,
    firebaseConfig.authDomain,
    firebaseConfig.projectId,
    firebaseConfig.messagingSenderId,
    firebaseConfig.appId
  ];

  return (
    requiredConfigValues.every(value => !FIREBASE_PLACEHOLDER_VALUES.has(value)) &&
    Boolean(firebaseVapidKey)
  );
}

async function registerServiceWorker() {
  if (!("serviceWorker" in navigator)) {
    console.warn("Service workers are not supported by this browser.");
    return null;
  }

  try {
    const registration = await navigator.serviceWorker.register("/sw.js");
    await navigator.serviceWorker.ready;
    console.log("Service worker registered.");
    return registration;
  } catch (error) {
    console.error("Service worker registration failed:", error);
    return null;
  }
}

async function initializeFirebaseMessaging() {
  if (!hasFirebaseConfig()) {
    console.info("Firebase config is incomplete. Running in dummy notification mode.");
    return null;
  }

  if (!(await isMessagingSupported())) {
    console.warn("Firebase Messaging is not supported by this browser.");
    return null;
  }

  try {
    const firebaseApp = initializeApp(firebaseConfig);
    return getMessaging(firebaseApp);
  } catch (error) {
    console.error("Firebase initialization failed:", error);
    return null;
  }
}

async function requestNotificationPermission() {
  if (!("Notification" in window)) {
    alert("Este navegador no soporta notificaciones.");
    return false;
  }

  if (Notification.permission === "granted") {
    return true;
  }

  const permission = await Notification.requestPermission();

  if (permission !== "granted") {
    alert("No se habilitaron las notificaciones.");
    return false;
  }

  return true;
}

async function logFirebaseToken() {
  if (!firebaseMessaging || !serviceWorkerRegistration) {
    return;
  }

  try {
    const token = await getToken(firebaseMessaging, {
      vapidKey: firebaseVapidKey,
      serviceWorkerRegistration
    });

    console.log("Firebase Cloud Messaging token:", token);
  } catch (error) {
    console.error("Could not get Firebase Messaging token:", error);
  }
}

async function showDummyNotification() {
  const hasPermission = await requestNotificationPermission();

  if (!hasPermission) {
    return;
  }

  if (!serviceWorkerRegistration) {
    alert("El service worker no esta listo. Revisa la consola.");
    return;
  }

  await logFirebaseToken();

  serviceWorkerRegistration.showNotification("Recordatorio de nota", {
    body: "No olvides revisar tus notas guardadas.",
    tag: "pocket-notes-demo",
    data: {
      url: "/"
    }
  });
}

async function bootstrap() {
  updateOnlineStatus();
  renderNotes();

  serviceWorkerRegistration = await registerServiceWorker();
  firebaseMessaging = await initializeFirebaseMessaging();
}

saveBtn.addEventListener("click", handleSaveNote);
notesList.addEventListener("click", handleNoteAction);
searchInput.addEventListener("input", () => renderNotes(searchInput.value));
notifyBtn.addEventListener("click", showDummyNotification);
window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);

bootstrap();
