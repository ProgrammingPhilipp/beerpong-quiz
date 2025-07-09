"use client";

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { ref, onValue, set as firebaseSet, remove } from "firebase/database";
import { db, auth, firestore } from "@/lib/firebase";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  updateProfile,
  onAuthStateChanged,
} from "firebase/auth";
import {
  doc,
  getDoc,
  collection,
  query,
  orderBy,
  limit,
  getDocs,
  updateDoc,
  increment,
  serverTimestamp,
} from "firebase/firestore";

interface Question {
  question: string;
  answer: string;
  category: string;
}

export default function Page() {
  const gameId = "default";

  // --- Auth & User Setup ---
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [userName, setUserName] = useState("");
  const [uid, setUid] = useState<string | null>(null);
  const [authMode, setAuthMode] = useState<"login" | "register">("login");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      if (user) {
        setUserName(user.displayName || user.email || "");
        setUid(user.uid);
      } else {
        setUserName("");
        setUid(null);
      }
    });
    return unsubscribe;
  }, []);

  const handleRegister = async (e: FormEvent) => {
    e.preventDefault();
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    if (cred.user) {
      await updateProfile(cred.user, { displayName });
    }
  };
  const handleLogin = async (e: FormEvent) => {
    e.preventDefault();
    await signInWithEmailAndPassword(auth, email, password);
  };
  const handleLogout = () => auth.signOut();

  // --- Firestore Stats Helpers ---
  const finishGame = async (winnerUid: string, loserUid: string) => {
    const winnerRef = doc(firestore, "users", winnerUid);
    const loserRef = doc(firestore, "users", loserUid);
    await Promise.all([
      updateDoc(winnerRef, { wins: increment(1), lastPlayed: serverTimestamp() }),
      updateDoc(loserRef, { losses: increment(1), lastPlayed: serverTimestamp() }),
    ]);
  };

  const [myStats, setMyStats] = useState<{ wins: number; losses: number } | null>(null);
  const [leaderboard, setLeaderboard] = useState<Array<{ displayName: string; wins: number }>>(
    []
  );

  useEffect(() => {
    if (!uid) return;
    const loadStats = async () => {
      const snap = await getDoc(doc(firestore, "users", uid));
      if (snap.exists()) {
        const data = snap.data();
        setMyStats({ wins: data.wins || 0, losses: data.losses || 0 });
      }
      const q = query(collection(firestore, "users"), orderBy("wins", "desc"), limit(10));
      const result = await getDocs(q);
      const list: Array<{ displayName: string; wins: number }> = [];
      result.forEach((d) => {
        const dat = d.data();
        list.push({ displayName: dat.displayName, wins: dat.wins || 0 });
      });
      setLeaderboard(list);
    };
    loadStats();
  }, [uid]);

  // --- Quiz & Players via Realtime DB ---
  const playersRef = ref(db, `games/${gameId}/players`);
  const [players, setPlayers] = useState<string[]>([]);
  useEffect(() => {
    onValue(playersRef, (snap) => {
      const data: string[] | null = snap.val();
      if (Array.isArray(data)) setPlayers(data);
      else firebaseSet(playersRef, []);
    });
  }, []);
  const resetPlayers = () => remove(playersRef);

  // --- Fragen laden ---
  const [questions, setQuestions] = useState<Question[]>([]);
  useEffect(() => {
    fetch("/data/questions.json").then((r) => r.json()).then(setQuestions);
  }, []);

  // --- Cups via Realtime DB ---
  const [cups, setCups] = useState<boolean[]>([]);
  useEffect(() => {
    const cupsRef = ref(db, `games/${gameId}/cups`);
    onValue(cupsRef, (snap) => {
      const data: boolean[] | null = snap.val();
      if (data === null) firebaseSet(cupsRef, Array(20).fill(true));
      else setCups(data);
    });
  }, []);

  // --- Teams & Quiz State ---
  const [teams, setTeams] = useState<string[][] | null>(null);
  const [starter, setStarter] = useState<1 | 2 | null>(null);
  const [category, setCategory] = useState("");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");

  const pool = category ? questions.filter((q) => q.category === category) : questions;
  const generateTeams = () => {
    if (players.length < 2) return;
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    setTeams([shuffled.slice(0, 2), shuffled.slice(2, 4)]);
    setStarter(null);
  };
  const drawStarter = () => setStarter((Math.floor(Math.random() * 2) + 1) as 1 | 2);
  const handleHit = (i: number) => {
    if (!cups[i] || currentQuestion) return;
    const q = pool[Math.floor(Math.random() * pool.length)];
    setCurrentQuestion(q);
    setCurrentIndex(i);
  };
  const submitAnswer = () => {
    if (!currentQuestion || currentIndex === null) return;
    const correct =
      userAnswer.trim().toLowerCase() === currentQuestion.answer.toLowerCase();
    if (!correct && uid && teams) {
      // Graue Cup aus
      const cupsRef = ref(db, `games/${gameId}/cups`);
      const newCups = [...cups];
      newCups[currentIndex] = false;
      firebaseSet(cupsRef, newCups);
      // Update Stats (Beispiel: Gegner gewinnt)
      const loserUid = uid;
      // Hier müsstest du noch mapping von displayName zu UID bauen
      // finishGame(winnerUid, loserUid);
    }
    setFeedback(correct ? "✅ Richtig! Kein Shot." : `❌ Falsch! Antwort: ${currentQuestion.answer}`);
    setTimeout(() => {
      setCurrentQuestion(null);
      setUserAnswer("");
      setFeedback("");
    }, 2000);
  };
  const resetGame = () => firebaseSet(ref(db, `games/${gameId}/cups`), Array(20).fill(true));
  const categories = ["Geographie", "Allgemeinwissen", "Fußball"];

  // --- Render ---
  if (!uid) {
    return (
      <main className="p-4 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">
          {authMode === "login" ? "Login" : "Registrieren"}
        </h1>
        <form
          onSubmit={authMode === "login" ? handleLogin : handleRegister}
          className="space-y-2"
        >
          {authMode === "register" && (
            <input
              type="text"
              placeholder="Display Name"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              className="w-full border rounded p-2"
            />
          )}
          <input
            type="email"
            placeholder="E-Mail"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full border rounded p-2"
          />
          <input
            type="password"
            placeholder="Passwort"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border rounded p-2"
          />
          <button type="submit" className="w-full bg-blue-500 text-white p-2 rounded">
            {authMode === "login" ? "Einloggen" : "Registrieren"}
          </button>
        </form>
        <p className="mt-4 text-center">
          {authMode === "login" ? (
            <button onClick={() => setAuthMode("register")} className="text-blue-500">
              Noch keinen Account? Registrieren
            </button>
          ) : (
            <button onClick={() => setAuthMode("login")} className="text-blue-500">
              Schon registriert? Einloggen
            </button>
          )}
        </p>
      </main>
    );
  }

  return (
    <main className="p-4 max-w-3xl mx-auto">
      <header className="flex justify-between items-center mb-4">
        <h1 className="text-2xl font-bold">Beer Pong Quiz</h1>
        <button onClick={handleLogout} className="text-sm text-red-600">
          Logout
        </button>
      </header>

      <section className="mb-6">
        <p>Eingeloggt als <strong>{userName}</strong></p>
        {myStats && <p className="mt-2">Siege: {myStats.wins} | Niederlagen: {myStats.losses}</p>}
        <h2 className="mt-4 font-semibold">Leaderboard</h2>
        <ul className="list-decimal list-inside">
          {leaderboard.map((u, i) => (
            <li key={i}>{u.displayName} ({u.wins} Siege)</li>
          ))}
        </ul>
      </section>

      <section className="mb-6">
        <h2 className="font-semibold mb-2">Spieler verwalten</h2>
        <ul className="list-disc list-inside">
          {players.map((p) => <li key={p}>{p}</li>)}
        </ul>
        <button onClick={resetPlayers} className="mt-2 text-sm text-red-600">
          Spieler zurücksetzen
        </button>
      </section>

      {/* Rest deines Quiz-Interface (Kategorie, Teams, Cups, Fragen usw.) */}
      {/* ... */}
    </main>
  );
}
