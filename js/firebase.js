// Firebase: sign-in (Google or email + password) and crew-scoped data with an offline cache.
// Data lives under crews/{crewId}/{collection}/{doc}. See README for the security rules.
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import {
  getAuth, onAuthStateChanged, GoogleAuthProvider, signInWithPopup, signInWithRedirect, getRedirectResult,
  signInWithEmailAndPassword, createUserWithEmailAndPassword, sendPasswordResetEmail, signOut, updateProfile,
  linkWithPopup, linkWithCredential, EmailAuthProvider
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import {
  initializeFirestore, persistentLocalCache, persistentMultipleTabManager,
  collection, doc, setDoc, getDoc, getDocs, deleteDoc, onSnapshot, writeBatch, updateDoc
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
const db = initializeFirestore(app, { localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }) });
const google = new GoogleAuthProvider();
google.setCustomParameters({ prompt: "select_account" });

export const COLLECTIONS = ["sessions", "body", "activities", "settings", "library", "profiles", "pings"];
let crewId = null;
const col = name => collection(db, "crews", crewId, name);
const ref = (name, id) => doc(db, "crews", crewId, name, id);

// ---------------------------------------------------------------- auth
const info = u => u && !u.isAnonymous ? { uid: u.uid, email: u.email || "", name: u.displayName || "", providers: u.providerData.map(p => p.providerId) } : null;
export function watchAuth(cb) {
  getRedirectResult(auth).catch(err => cb(null, explain(err)));
  return onAuthStateChanged(auth, u => cb(info(u)));
}
export async function signInGoogle() {
  try { await signInWithPopup(auth, google); }
  catch (err) {
    if (["auth/popup-blocked", "auth/operation-not-supported-in-this-environment", "auth/cancelled-popup-request"].includes(err.code)) return signInWithRedirect(auth, google);
    throw new Error(explain(err));
  }
}
export async function signInEmail(email, pw) { try { await signInWithEmailAndPassword(auth, email.trim(), pw); } catch (err) { throw new Error(explain(err)); } }
export async function createEmailAccount(email, pw, name) {
  try { const r = await createUserWithEmailAndPassword(auth, email.trim(), pw); if (name) await updateProfile(r.user, { displayName: name }); }
  catch (err) { throw new Error(explain(err)); }
}
export async function resetPassword(email) { try { await sendPasswordResetEmail(auth, email.trim()); } catch (err) { throw new Error(explain(err)); } }
export const signOutNow = () => signOut(auth);
export async function addGoogle() { try { await linkWithPopup(auth.currentUser, google); } catch (err) { throw new Error(explain(err)); } }
export async function addPassword(pw) {
  try { await linkWithCredential(auth.currentUser, EmailAuthProvider.credential(auth.currentUser.email, pw)); } catch (err) { throw new Error(explain(err)); }
}
export const currentInfo = () => info(auth.currentUser);

// ---------------------------------------------------------------- user record and crews
export async function getUserDoc(uid) {
  try { const s = await getDoc(doc(db, "users", uid)); return s.exists() ? s.data() : null; }
  catch (err) { if (String(err.code).includes("unavailable")) return null; throw new Error(explain(err)); }
}
export const setUserDoc = (uid, data) => setDoc(doc(db, "users", uid), data, { merge: true });

const CODE_CHARS = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const newCode = () => Array.from({ length: 6 }, () => CODE_CHARS[Math.floor(Math.random() * CODE_CHARS.length)]).join("");

export async function createCrew(name, me) {
  const id = doc(collection(db, "crews")).id; const code = newCode();
  await setDoc(doc(db, "crews", id), { name, code, owner: me.uid, createdAt: Date.now() });
  await setDoc(doc(db, "crews", id, "members", me.uid), { name: me.name, email: me.email, role: "owner", profileId: me.profileId || "", code, joinedAt: Date.now() });
  await setDoc(doc(db, "codes", code), { crewId: id });
  await setUserDoc(me.uid, { crewId: id });
  return { id, code };
}
export async function joinCrew(code, me) {
  code = code.trim().toUpperCase();
  const c = await getDoc(doc(db, "codes", code)).catch(err => { throw new Error(explain(err)); });
  if (!c.exists()) throw new Error("That code doesn't match a crew. Check it with whoever invited you.");
  const id = c.data().crewId;
  await setDoc(doc(db, "crews", id, "members", me.uid), { name: me.name, email: me.email, role: "member", profileId: "", code, joinedAt: Date.now() }).catch(err => { throw new Error(explain(err)); });
  await setUserDoc(me.uid, { crewId: id });
  return id;
}
export function watchCrew(id, onCrew, onMembers) {
  const a = onSnapshot(doc(db, "crews", id), s => onCrew(s.exists() ? { id, ...s.data() } : null), () => onCrew(null));
  const b = onSnapshot(collection(db, "crews", id, "members"), s => onMembers(s.docs.map(d => ({ uid: d.id, ...d.data() }))), () => {});
  return () => { a(); b(); };
}
export const updateMember = (id, uid, patch) => updateDoc(doc(db, "crews", id, "members", uid), patch);
export const removeMember = (id, uid) => deleteDoc(doc(db, "crews", id, "members", uid));
export async function renameCrew(id, name) { await updateDoc(doc(db, "crews", id), { name }); }
export async function newInviteCode(id, old) {
  const code = newCode();
  await setDoc(doc(db, "codes", code), { crewId: id });
  await updateDoc(doc(db, "crews", id), { code });
  if (old) await deleteDoc(doc(db, "codes", old)).catch(() => {});
  return code;
}

// ---------------------------------------------------------------- crew data
export function connect(id, onData, onStatus) {
  crewId = id;
  const unsubs = COLLECTIONS.map(name => onSnapshot(col(name), { includeMetadataChanges: true }, snap => {
    onData(name, snap.docs.map(d => ({ id: d.id, ...d.data() })), snap.metadata.fromCache, snap.metadata.hasPendingWrites);
  }, err => onStatus?.({ state: "error", message: explain(err) })));
  onStatus?.({ state: "ready" });
  return () => unsubs.forEach(u => u());
}
// Writes return immediately; Firestore queues them offline and syncs later.
export function save(name, id, data) {
  setDoc(ref(name, id), { ...data, updatedAt: Date.now() }, { merge: false }).catch(err => console.error("Save failed", err));
  return id;
}
export function remove(name, id) { deleteDoc(ref(name, id)).catch(err => console.error("Delete failed", err)); }
export async function importAll(data) {
  let batch = writeBatch(db), n = 0;
  for (const name of COLLECTIONS) for (const item of data[name] || []) {
    const { id, ...rest } = item;
    batch.set(ref(name, id || doc(col(name)).id), rest);
    if (++n % 400 === 0) { await batch.commit(); batch = writeBatch(db); }
  }
  await batch.commit();
  return n;
}

// The first version stored everything at the top level of the database. Read it so it can be copied into a crew.
export async function readLegacy() {
  const out = {}; let n = 0;
  for (const name of COLLECTIONS) {
    try { const s = await getDocs(collection(db, name)); out[name] = s.docs.map(d => ({ id: d.id, ...d.data() })); n += s.size; }
    catch { out[name] = []; }
  }
  return { data: out, count: n };
}

function explain(err) {
  const c = err?.code || "";
  if (c.includes("invalid-credential") || c.includes("wrong-password") || c.includes("user-not-found")) return "That email and password don't match. Try again, or use Forgot password.";
  if (c.includes("email-already-in-use")) return "There's already an account with that email. Sign in instead, or use Forgot password.";
  if (c.includes("weak-password")) return "Use a password with at least 6 characters.";
  if (c.includes("invalid-email")) return "That doesn't look like an email address.";
  if (c.includes("popup-closed-by-user")) return "The Google window was closed before signing in finished.";
  if (c.includes("unauthorized-domain")) return "This web address isn't approved for Google sign-in yet. Add it in Firebase → Authentication → Settings → Authorized domains.";
  if (c.includes("operation-not-allowed")) return "That sign-in method isn't turned on yet in Firebase → Authentication → Sign-in method.";
  if (c.includes("credential-already-in-use") || c.includes("provider-already-linked")) return "That sign-in is already connected to an account.";
  if (c.includes("requires-recent-login")) return "For security, sign out and back in, then try again.";
  if (c.includes("too-many-requests")) return "Too many tries. Wait a few minutes and try again.";
  if (c.includes("permission-denied")) return "The database refused access. Check that the Firestore rules from the README are published.";
  if (c.includes("unavailable") || c.includes("network")) return "Offline. Your entries are saved on this phone and will sync when you're back online.";
  return err?.message || "Something went wrong.";
}
