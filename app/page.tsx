"use client";

import React, { useState, useEffect, ChangeEvent } from "react";
import { ref, onValue, set as firebaseSet } from "firebase/database";
import { db } from "@/lib/firebase";

interface Question {
  question: string;
  answer: string;
  category: string;
}

export default function Page() {
  const gameId = "default";

  // --- FRAGEN LADEN ---
  const [questions, setQuestions] = useState<Question[]>([]);
  useEffect(() => {
    fetch("/data/questions.json")
      .then((r) => r.json())
      .then((data) => setQuestions(data))
      .catch(console.error);
  }, []);

  // --- CUPS ÜBER FIREBASE ---
  const [cups, setCups] = useState<boolean[]>([]);
  useEffect(() => {
    const cupsRef = ref(db, `games/${gameId}/cups`);
    onValue(cupsRef, (snap) => {
      const data: boolean[] | null = snap.val();
      if (data === null) {
        // initial Fill
        firebaseSet(cupsRef, Array(20).fill(true));
      } else {
        setCups(data);
      }
    });
  }, []);

  // --- QUIZ STATE ---
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [category, setCategory] = useState<string>("");

  // Pool nach Kategorie
  const pool = category
    ? questions.filter((q) => q.category === category)
    : questions;

  // Treffer: nur Frage ziehen, nicht grayout
  const handleHit = (index: number) => {
    if (currentQuestion) return;
    if (pool.length === 0) return;
    const q = pool[Math.floor(Math.random() * pool.length)];
    setCurrentQuestion(q);
    setCurrentIndex(index);
    setUserAnswer("");
    setFeedback("");
  };

  // Antwort abschicken
  const submitAnswer = () => {
    if (!currentQuestion || currentIndex === null) return;
    const correct =
      userAnswer.trim().toLowerCase() === currentQuestion.answer.toLowerCase();

    if (correct) {
      setFeedback("✅ Richtig! Kein Shot.");
    } else {
      setFeedback(`❌ Falsch! Antwort: ${currentQuestion.answer}. Trink einen Shot!`);
      // erst jetzt den Becher in Firebase auf false setzen
      const cupsRef = ref(db, `games/${gameId}/cups`);
      const newCups = [...cups];
      newCups[currentIndex] = false;
      firebaseSet(cupsRef, newCups);
    }
  };

  // Reset-Funktion
  const resetGame = () => {
    const cupsRef = ref(db, `games/${gameId}/cups`);
    firebaseSet(cupsRef, Array(20).fill(true));
    setCurrentQuestion(null);
    setCurrentIndex(null);
    setUserAnswer("");
    setFeedback("");
  };

  // Feedback-Clear nach 2s
  useEffect(() => {
    if (feedback) {
      const t = setTimeout(() => setFeedback(""), 2000);
      return () => clearTimeout(t);
    }
  }, [feedback]);

  const categories = ["Geographie", "Allgemeinwissen", "Fußball"];

  return (
    <main className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-4">Beer Pong Quiz</h1>

      {/* Kategorie */}
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

      {/* Reset */}
      <button
        onClick={resetGame}
        className="bg-red-500 text-white rounded px-4 py-2 mb-4"
      >
        Spiel zurücksetzen
      </button>

      {/* Becher-Gitter */}
      <div className="grid grid-cols-5 gap-2 mb-6">
        {cups.map((present, i) => (
          <div
            key={i}
            className={`h-16 flex items-center justify-center border rounded cursor-pointer ${
              !present ? "opacity-30" : ""
            }`}
            onClick={() => present && handleHit(i)}
          >
            {i + 1}
          </div>
        ))}
      </div>

      {/* Frage & Antwort */}
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
              className="bg-blue-600 text-white rounded px-4"
            >
              Abschicken
            </button>
          </div>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className="p-3 bg-gray-100 rounded text-center">{feedback}</div>
      )}
    </main>
  );
}
