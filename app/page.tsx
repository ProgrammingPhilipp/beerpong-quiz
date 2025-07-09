"use client";

import React, { useState, useEffect, ChangeEvent, FormEvent } from "react";
import { ref, onValue, set as firebaseSet, remove } from "firebase/database";
import { db } from "@/lib/firebase";

interface Question {
  question: string;
  answer: string;
  category: string;
}

interface Stats {
  correct: number;
  wrong: number;
}

export default function Page() {
  const gameId = "default";

  // --- Spielername & Join ---
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const playersRef = ref(db, `games/${gameId}/players`);
  const statsRefPath = `games/${gameId}/stats/${userName}`;

  const [players, setPlayers] = useState<string[]>([]);
  const [stats, setStats] = useState<Stats>({ correct: 0, wrong: 0 });

  // Load players
  useEffect(() => {
    onValue(playersRef, (snap) => {
      const data: string[] | null = snap.val();
      if (Array.isArray(data)) setPlayers(data);
      else firebaseSet(playersRef, []);
    });
  }, []);

  // Join game
  const joinGame = (e: FormEvent) => {
    e.preventDefault();
    const name = userName.trim();
    if (!name || players.includes(name)) return;
    firebaseSet(playersRef, [...players, name]);
    setJoined(true);
  };
  const resetPlayers = () => {
    remove(playersRef);
    setJoined(false);
    setUserName("");
  };

  // Load stats once joined
  useEffect(() => {
    if (!joined) return;
    const statsRef = ref(db, statsRefPath);
    onValue(statsRef, (snap) => {
      const data: Stats | null = snap.val();
      if (data) setStats(data);
      else firebaseSet(statsRef, { correct: 0, wrong: 0 });
    });
  }, [joined, userName]);

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

  // --- Quiz State ---
  const [teams, setTeams] = useState<string[][] | null>(null);
  const [starter, setStarter] = useState<1 | 2 | null>(null);
  const [category, setCategory] = useState<string>("");
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");

  // Question pool
  const pool = category
    ? questions.filter((q) => q.category === category)
    : questions;

  // Teams & Starter
  const generateTeams = () => {
    if (players.length < 2) return;
    const shuffled = [...players].sort(() => Math.random() - 0.5);
    setTeams([shuffled.slice(0, 2), shuffled.slice(2, 4)]);
    setStarter(null);
  };
  const drawStarter = () => setStarter((Math.floor(Math.random() * 2) + 1) as 1 | 2);

  // On cup hit
  const handleHit = (i: number) => {
    if (currentQuestion || !cups[i]) return;
    const q = pool[Math.floor(Math.random() * pool.length)];
    setCurrentQuestion(q);
    setCurrentIndex(i);
  };

  // Submit answer and update stats
  const submitAnswer = () => {
    if (!currentQuestion || currentIndex === null) return;
    const correct =
      userAnswer.trim().toLowerCase() === currentQuestion.answer.toLowerCase();
    const statsRef = ref(db, statsRefPath);
    if (correct) {
      setFeedback("✅ Richtig! Kein Shot.");
      firebaseSet(statsRef, { correct: stats.correct + 1, wrong: stats.wrong });
    } else {
      setFeedback(`❌ Falsch! Antwort: ${currentQuestion.answer}.`);
      firebaseSet(statsRef, { correct: stats.correct, wrong: stats.wrong + 1 });
      // grey out cup
      const cupsRef = ref(db, `games/${gameId}/cups`);
      const newCups = [...cups];
      newCups[currentIndex] = false;
      firebaseSet(cupsRef, newCups);
    }
  };

  // Reset feedback
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => {
        setCurrentQuestion(null);
        setCurrentIndex(null);
        setUserAnswer("");
        setFeedback("");
      }, 2000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  // Reset game cups
  const resetGame = () =>
    firebaseSet(ref(db, `games/${gameId}/cups`), Array(20).fill(true));

  const categories = ["Geographie", "Allgemeinwissen", "Fußball"];

  // --- Render: Join ---
  if (!joined) {
    return (
      <main className="p-4 max-w-md mx-auto">
        <h1 className="text-2xl font-bold mb-4">Spieler beitreten</h1>
        <form onSubmit={joinGame} className="flex gap-2 mb-4">
          <input
            type="text"
            placeholder="Dein Name"
            value={userName}
            onChange={(e) => setUserName(e.target.value)}
            className="border rounded p-2 flex-1"
          />
          <button type="submit" className="bg-blue-500 text-white px-4 py-2 rounded">
            Beitreten
          </button>
        </form>
        <p>Aktuelle Spieler: {players.join(", ")}</p>
        <button
          onClick={resetPlayers}
          className="mt-2 text-sm text-red-600"
        >
          Spieler zurücksetzen
        </button>
      </main>
    );
  }

  // --- Render: Quiz ---
  return (
    <main className="p-4 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Beer Pong Quiz</h1>

      {/* Show stats */}
      <section className="mb-4">
        <p>
          Spieler: <strong>{userName}</strong>
        </p>
        <p>
          Richtige Antworten: {stats.correct} | Falsche Antworten: {stats.wrong}
        </p>
      </section>

      {/* Category */}
      <select
        value={category}
        onChange={(e: ChangeEvent<HTMLSelectElement>) =>
          setCategory(e.target.value)
        }
        className="border rounded p-2 mb-4 w-full"
      >
        <option value="">Alle Kategorien</option>
        {categories.map((c) => (
          <option key={c} value={c}>
            {c}
          </option>
        ))}
      </select>

      {/* Teams & Starter */}
      <div className="mb-4 flex gap-2">
        <button
          onClick={generateTeams}
          className="bg-blue-500 text-white px-4 py-2 rounded"
        >
          Teams erstellen
        </button>
        {teams && (
          <>
            <button
              onClick={drawStarter}
              className="bg-green-500 text-white px-4 py-2 rounded"
            >
              Wer beginnt?
            </button>
            {starter && <span className="self-center">Team {starter} startet</span>}
          </>
        )}
      </div>
      {teams && (
        <div className="mb-6 grid grid-cols-2 gap-4">
          <div className="border p-2 rounded">
            <h2 className="font-semibold">Team 1</h2>
            {teams[0].map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
          <div className="border p-2 rounded">
            <h2 className="font-semibold">Team 2</h2>
            {teams[1].map((n) => (
              <p key={n}>{n}</p>
            ))}
          </div>
        </div>
      )}

      {/* Reset Game */}
      <button
        onClick={resetGame}
        className="bg-red-500 text-white px-4 py-2 rounded mb-6"
      >
        Spiel zurücksetzen
      </button>

      {/* Cups Team 1 */}
      <div className="mb-6">
        <h3 className="mb-2">Team 1 Becher</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {cups.slice(0, 10).map((present, i) => (
            <div
              key={i}
              className={`h-16 flex items-center justify-center border rounded cursor-pointer ${
                present ? "" : "opacity-30"
              }`}
              onClick={() => handleHit(i)}
            >
              {i + 1}
            </div>
          ))}
        </div>
      </div>

      {/* Cups Team 2 */}
      <div className="mb-6">
        <h3 className="mb-2">Team 2 Becher</h3>
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
          {cups.slice(10).map((present, i) => (
            <div
              key={i + 10}
              className={`h-16 flex items-center justify-center border rounded cursor-pointer ${
                present ? "" : "opacity-30"
              }`}
              onClick={() => handleHit(i + 10)}
            >
              {i + 11}
            </div>
          ))}
        </div>
      </div>

      {/* Question & Answer */}
      {currentQuestion && (
        <div className="mb-4">
          <p className="mb-2 font-medium">{currentQuestion.question}</p>
          <div className="flex gap-2">
            <input
              type="text"
              value={userAnswer}
              onChange={(e) => setUserAnswer(e.target.value)}
              className="border rounded p-2 flex-1"
            />
            <button
              onClick={submitAnswer}
              className="bg-indigo-600 text-white px-4 rounded"
            >
              Abschicken
            </button>
          </div>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className="p-3 bg-gray-100 text-gray-900 rounded text-center mb-4">
          {feedback}
        </div>
      )}
    </main>
  );
}
