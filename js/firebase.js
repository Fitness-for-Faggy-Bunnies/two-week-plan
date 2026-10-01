// Firebase connection: anonymous sign-in + Firestore with an offline cache.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth, onAuthStateChanged, signInAnonymously } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, deleteDoc, onSnapshot, writeBatch
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAm5Mnk4z1NTrIBCJ1k5WI8la2xQ2HtJ-k",
  authDomain: "fitness-for-faggy-bunnies.firebaseapp.com",
  projectId: "fitness-for-faggy-bunnies",
  storageBucket: "fitness-for-faggy-bunnies.firebasestorage.app",
  messagingSenderId: "1064959793157",
  appId: "1:1064959793157:web:89f913163da3631ab5646c"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
});

export const COLLECTIONS = ["sessions", "body", "activities", "settings", "library", "profiles", "pings"];

// Calls onData(name, docs, fromCache) whenever a collection changes.
export function connect(onData, onStatus) {
  const unsubs = [];
  onAuthStateChanged(auth, user => {
    unsubs.splice(0).forEach(u => u());
    if (!user) {
      signInAnonymously(auth).catch(err => onStatus?.({ state: "error", message: explain(err) }));
      return;
    }
    for (const name of COLLECTIONS) {
      unsubs.push(onSnapshot(collection(db, name), { includeMetadataChanges: true }, snap => {
        onData(name, snap.docs.map(d => ({ id: d.id, ...d.data() })), snap.metadata.fromCache, snap.metadata.hasPendingWrites);
      }, err => onStatus?.({ state: "error", message: explain(err) })));
    }
    onStatus?.({ state: "ready" });
  });
}

// Writes return immediately; Firestore queues them offline and syncs later.
export function newId(name) { return doc(collection(db, name)).id; }
export function save(name, id, data) {
  const p = setDoc(doc(db, name, id), { ...data, updatedAt: Date.now() }, { merge: false });
  p.catch(err => console.error("Save failed", err));
  return id;
}
export function remove(name, id) {
  deleteDoc(doc(db, name, id)).catch(err => console.error("Delete failed", err));
}
export async function importAll(data) {
  let batch = writeBatch(db), n = 0;
  for (const name of COLLECTIONS) for (const item of data[name] || []) {
    const { id, ...rest } = item;
    batch.set(doc(db, name, id || newId(name)), rest);
    if (++n % 400 === 0) { await batch.commit(); batch = writeBatch(db); }
  }
  await batch.commit();
  return n;
}

function explain(err) {
  const c = err?.code || "";
  if (c.includes("permission-denied")) return "The database refused access. Check that Anonymous sign-in is on and the Firestore rules are published.";
  if (c.includes("admin-restricted-operation") || c.includes("operation-not-allowed")) return "Anonymous sign-in is turned off. Turn it on in Firebase → Authentication → Sign-in method.";
  if (c.includes("unavailable") || c.includes("network")) return "Offline. Your entries are saved on this phone and will sync when you're back online.";
  return err?.message || "Something went wrong connecting to the database.";
}
