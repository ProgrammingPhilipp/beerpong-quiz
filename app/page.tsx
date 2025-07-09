// app/page.tsx
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
  const gameId = "default"; // später mehrere Spiele möglich

  // Fragen laden
  const [questions, setQuestions] = useState<Question[]>([]);
  useEffect(() => {
    fetch("/data/questions.json")
      .then((res) => res.json())
      .then((data: Question[]) => setQuestions(data))
      .catch((err) => console.error("Fehler beim Laden der Fragen:", err));
  }, []);

  // Cups via Firebase statt lokal
  const [cups, setCups] = useState<boolean[]>([]);
  useEffect(() => {
    const cupsRef = ref(db, `games/${gameId}/cups`);
    onValue(cupsRef, (snap) => {
      const data: boolean[] | null = snap.val();
      if (data === null) {
        // initial alle Becher aktiv
        firebaseSet(cupsRef, Array(20).fill(true));
      } else {
        setCups(data);
      }
    });
    // kein Cleanup nötig für onValue hier
  }, []);

  // Quiz-State
  const [currentQuestion, setCurrentQuestion] = useState<Question | null>(null);
  const [currentIndex, setCurrentIndex] = useState<number | null>(null);
  const [userAnswer, setUserAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [teams, setTeams] = useState<string[][] | null>(null);
  const [starter, setStarter] = useState<number | null>(null);
  const [category, setCategory] = useState<string>("");

  // Pool (gefiltert oder gesamter Fragen-Pool)
  const pool = category
    ? questions.filter((q) => q.category === category)
    : questions;

  // Treffer behandeln und in Firebase schreiben
  const handleHit = (index: number) => {
    if (currentQuestion) return;
    if (pool.length === 0) return;

    const q = pool[Math.floor(Math.random() * pool.length)];
    setCurrentQuestion(q);
    setCurrentIndex(index);
    setUserAnswer("");
    setFeedback("");

    // Becher-Status aktualisieren
    const newCups = [...cups];
    newCups[index] = false;
    firebaseSet(ref(db, `games/${gameId}/cups`), newCups);
  };

  const submitAnswer = () => {
    if (!currentQuestion || currentIndex === null) return;
    const correct =
      userAnswer.trim().toLowerCase() === currentQuestion.answer.toLowerCase();
    if (correct) {
      setFeedback("Richtig! Du musst nicht trinken.");
    } else {
      setFeedback(
        `Falsch! Richtige Antwort: ${currentQuestion.answer}. Trink einen Shot! 🍻`
      );
      // (Becher ist ja schon in Firebase gesetzt)
    }
  };

  const generateTeams = () => {
    const shuffled = [...["Philipp", "Marlon", "Enes", "Robin"]].sort(
      () => Math.random() - 0.5
    );
    setTeams([shuffled.slice(0, 2), shuffled.slice(2, 4)]);
    setStarter(null);
  };

  const drawStarter = () => {
    if (!teams) return;
    setStarter(Math.floor(Math.random() * 2) + 1);
  };

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

  const categories = ["Geographie", "Allgemeinwissen", "Fußball"];

  return (
    <main className="p-4 max-w-2xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">Beer Pong Quiz</h1>

      {/* Kategorie-Auswahl */}
      <div className="mb-6">
        <select
          value={category}
          onChange={(e: ChangeEvent<HTMLSelectElement>) =>
            setCategory(e.target.value)
          }
          className="border rounded p-3 text-base w-full"
        >
          <option value="">Kategorie auswählen</option>
          {categories.map((cat) => (
            <option key={cat} value={cat}>
              {cat}
            </option>
          ))}
        </select>
      </div>

      {/* Team-Generator */}
      <div className="mb-8">
        <h2 className="text-xl mb-2">Teams &amp; Start</h2>
        <button
          onClick={generateTeams}
          className="mr-2 px-6 py-3 bg-blue-500 text-white rounded text-base"
        >
          Teams erstellen
        </button>
        {teams && (
          <>
            <button
              onClick={drawStarter}
              className="px-6 py-3 bg-green-500 text-white rounded text-base"
            >
              Wer beginnt?
            </button>
            {starter !== null && <p className="mt-2">Team {starter} beginnt!</p>}
            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="border rounded p-4">
                <h3 className="font-medium">Team 1</h3>
                {teams[0].map((n) => (
                  <p key={n}>{n}</p>
                ))}
              </div>
              <div className="border rounded p-4">
                <h3 className="font-medium">Team 2</h3>
                {teams[1].map((n) => (
                  <p key={n}>{n}</p>
                ))}
              </div>
            </div>
          </>
        )}
      </div>

      {/* Becher Team 1 */}
      <h2 className="text-lg mb-2">Team 1 Becher</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        {cups.slice(0, 10).map((present, i) => (
          <div
            key={i}
            className={`h-24 flex items-center justify-center border rounded cursor-pointer ${
              !present ? "opacity-30" : ""
            }`}
            onClick={() => present && handleHit(i)}
          >
            Becher {i + 1}
          </div>
        ))}
      </div>

      {/* Becher Team 2 */}
      <h2 className="text-lg mb-2">Team 2 Becher</h2>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-4 mb-6">
        {cups.slice(10).map((present, i) => (
          <div
            key={i + 10}
            className={`h-24 flex items-center justify-center border rounded cursor-pointer ${
              !present ? "opacity-30" : ""
            }`}
            onClick={() => present && handleHit(i + 10)}
          >
            Becher {i + 1}
          </div>
        ))}
      </div>

      {/* Frage & Eingabe */}
      {currentQuestion && (
        <div className="border p-4 rounded mb-4">
          <p className="font-medium mb-4">{currentQuestion.question}</p>
          <input
            type="text"
            placeholder="Antwort"
            value={userAnswer}
            onChange={(e) => setUserAnswer(e.target.value)}
            className="border rounded p-3 w-full text-base mb-4"
          />
          <button
            onClick={submitAnswer}
            className="px-6 py-3 bg-indigo-600 text-white rounded text-base"
          >
            Antwort abschicken
          </button>
        </div>
      )}

      {/* Feedback */}
      {feedback && (
        <div className="p-4 bg-gray-100 rounded text-center mb-4">
          {feedback}
        </div>
      )}
    </main>
  );
}
