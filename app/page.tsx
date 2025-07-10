"use client";

import React, {
  useState,
  useEffect,
  useRef,
  ChangeEvent,
  FormEvent,
} from "react";
import {
  ref,
  onValue,
  runTransaction,
  set as firebaseSet,
  remove,
} from "firebase/database";
import { db } from "@/lib/firebase";
import Confetti from "react-confetti";
import { useSwipeable } from "react-swipeable";

// custom hook for window size (replaces react-use)
function useWindowSize() {
  const [size, setSize] = useState<{ width: number; height: number }>({ width: 0, height: 0 });
  useEffect(() => {
    function handleResize() {
      setSize({ width: window.innerWidth, height: window.innerHeight });
    }
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);
  return size;
}



interface Question {
  question: string;
  answer: string;
  category: string;
}
interface Stats {
  correct: number;
  wrong: number;
  gamesWon: number;
}

export default function Page() {
  const gameId = "default";
  const playersRef = ref(db, `games/${gameId}/players`);
  const cupsRef = ref(db, `games/${gameId}/cups`);
  const statsBase = `games/${gameId}/stats`;
  const [scores, setScores] = useState<number[]>([0, 0]);
  const [answeredThisTurn, setAnsweredThisTurn] = useState(false);

  


  // — STATES —
  const [userName, setUserName] = useState("");
  const [joined, setJoined] = useState(false);
  const [view, setView] = useState<"play" | "stats">("play");
  const [notifications, setNotifications] = useState<string[]>([]);
  const prevPlayers = useRef<string[]>([]);

  const [players, setPlayers] = useState<string[]>([]);
  const [statsMap, setStatsMap] = useState<Record<string, Stats>>({});
  const [userStats, setUserStats] = useState<Stats>({
    correct: 0,
    wrong: 0,
    gamesWon: 0,
  });
  const [questions, setQuestions] = useState<Question[]>([]);
  const [cups, setCups] = useState<boolean[]>([]);

  const [teams, setTeams] = useState<string[][] | null>(null);
  const [turnIndex, setTurnIndex] = useState(0);
  const [category, setCategory] = useState("");
  const [currentQ, setCurrentQ] = useState<Question | null>(null);
  const [qIndex, setQIndex] = useState<number | null>(null);
  const [answer, setAnswer] = useState("");
  const [feedback, setFeedback] = useState("");
  const [showConfetti, setShowConfetti] = useState(false);
  const { width, height } = useWindowSize();

  const categories = ["Geographie", "Allgemeinwissen", "Fußball"];
  const pool = category
    ? questions.filter((q) => q.category === category)
    : questions;

    useEffect(() => {
  setAnsweredThisTurn(false);
}, [turnIndex]);

  // Fortschritt
  const hitCount = 20 - cups.filter((c) => c).length;
  const progress = (hitCount / 20) * 100;

  // Swipe-Handler
  const handlers = useSwipeable({
    onSwipedLeft: () => setView("stats"),
    onSwipedRight: () => setView("play"),
    trackMouse: true,
  });

  // — EFFECTS —

  const resetGame = () => {
  firebaseSet(cupsRef, Array(20).fill(true));
  setFeedback("");
  setCurrentQ(null);
  setAnswer("");
  setTurnIndex(0);
  setAnsweredThisTurn(false);
};
  // Players + Notifications
  useEffect(() => {
    const stored = localStorage.getItem("userName");
    if (stored) {
      setUserName(stored);
      setJoined(true);
    }
    onValue(playersRef, (snap) => {
      const list = Array.isArray(snap.val()) ? snap.val()! : [];
      list.forEach((n: string) => {
        if (!prevPlayers.current.includes(n)) {
          setNotifications((ns) => [...ns, `${n} ist beigetreten`]);
        }
      });
      prevPlayers.current = list;
      setPlayers(list);
    });
  }, []);

  // Clear notifications
  useEffect(() => {
    if (notifications.length) {
      const t = setTimeout(() => setNotifications((ns) => ns.slice(1)), 3000);
      return () => clearTimeout(t);
    }
  }, [notifications]);

  // Reset join if removed
  useEffect(() => {
    if (joined && !players.includes(userName)) {
      localStorage.removeItem("userName");
      setJoined(false);
      setUserName("");
    }
  }, [players]);

  // Load stats
  useEffect(() => {
    onValue(ref(db, statsBase), (snap) => {
      const data = (snap.val() as Record<string, Stats>) || {};
      setStatsMap(data);
      if (joined && userName && data[userName]) {
        setUserStats(data[userName]);
      }
    });
  }, [joined, userName]);

  // Load questions
  useEffect(() => {
    fetch("/data/questions.json").then((r) => r.json()).then(setQuestions);
  }, []);

  // Load cups
  useEffect(() => {
    onValue(cupsRef, (snap) => {
      const data = snap.val();
      if (data == null) firebaseSet(cupsRef, Array(20).fill(true));
      else setCups(data);
    });
  }, []);

  // — ACTIONS —

  const joinGame = (e: FormEvent) => {
    e.preventDefault();
    const name = userName.trim();
    if (!name) return;
    runTransaction(playersRef, (cur) => {
      const arr = Array.isArray(cur) ? cur : [];
      if (!arr.includes(name)) arr.push(name);
      return arr;
    });
    localStorage.setItem("userName", name);
    setJoined(true);
  };

  const removePlayer = (name: string) => {
    runTransaction(playersRef, (cur) =>
      Array.isArray(cur) ? cur.filter((n) => n !== name) : []
    );
  };

  const generateTeams = () => {
  if (players.length < 2) return;
  const shuffled = [...players].sort(() => Math.random() - 0.5);
  setTeams([shuffled.slice(0, 2), shuffled.slice(2, 4)]);
  setTurnIndex(0);
  setFeedback(`Team 1 beginnt: ${shuffled.slice(0, 2).join(", ")}`);
};


  const handleHit = (i: number) => {
    if (currentQ || !cups[i] || !teams) return;
    setCurrentQ(pool[Math.floor(Math.random() * pool.length)]);
    setQIndex(i);
  };

  const submitAnswer = () => {
  if (answeredThisTurn) return;  // 1x Antwort pro Runde
  if (!currentQ || qIndex == null || !teams) return;

  const ok = answer.trim().toLowerCase() === currentQ.answer.toLowerCase();

  const uRef = ref(db, `${statsBase}/${userName}`);
  const ns = { ...userStats };
  ok ? ns.correct++ : ns.wrong++;
  firebaseSet(uRef, ns);

  if (!ok) {
    const nc = [...cups];
    nc[qIndex] = false;
    firebaseSet(cupsRef, nc);
  }

  // Punkte updaten, wenn richtig (Team finden, das dran ist)
  if (ok) {
    // Welches Team ist gerade dran? 
    // Angenommen, `turnIndex` ist der Index des aktuellen Spielers in `players`
    const currentPlayer = players[turnIndex];
    const currentTeamIndex = teams.findIndex(team => team.includes(currentPlayer));

    setScores((prev) => {
      const copy = [...prev];
      copy[currentTeamIndex] = (copy[currentTeamIndex] ?? 0) + 1;
      return copy;
    });
  }

  const t1 = cups
    .slice(0, 10)
    .every((p, idx) => !p || (idx === qIndex && !ok));
  const t2 = cups
    .slice(10)
    .every((p, idx) => !p || (idx + 10 === qIndex && !ok));
  if (t1 || t2) {
    const winners = t1 ? teams[1] : teams[0];
    winners.forEach((p: string) => {
      const pRef = ref(db, `${statsBase}/${p}`);
      const ps = statsMap[p] || { correct: 0, wrong: 0, gamesWon: 0 };
      firebaseSet(pRef, {
        ...ps,
        gamesWon: (ps.gamesWon || 0) + 1,
      });
    });
    setFeedback(`🏆 Team ${t1 ? 2 : 1} gewinnt!`);
    setShowConfetti(true);
  } else {
    setTurnIndex((i) => (i + 1) % players.length);
    setFeedback(ok ? "✅ Richtig!" : "❌ Falsch!");
  }

  setAnsweredThisTurn(true);  // Sperre setzen

  setTimeout(() => {
    setCurrentQ(null);
    setAnswer("");
    setFeedback("");
    setShowConfetti(false);
  }, 2000);
};


  // — RENDER —
  if (!joined) {
    return (
      <main className="flex items-center justify-center h-screen bg-gradient-to-br from-blue-300 to-purple-300">
        <div className="bg-white p-8 rounded-3xl shadow-xl max-w-sm w-full">
          <h1 className="text-4xl font-extrabold text-center text-indigo-600 mb-6">
            BeerPong Quiz
          </h1>
          <form onSubmit={joinGame} className="flex space-x-4">
            <input
              className="flex-1 px-4 py-2 border-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder="Dein Name"
              value={userName}
              onChange={(e) => setUserName(e.target.value)}
            />
            <button
              type="submit"
              className="px-6 py-2 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
            >
              Join
            </button>
          </form>
        </div>
      </main>
    );
  }

  return (
    <main
      {...handlers}
      className="p-6 bg-gray-50 min-h-screen overflow-x-hidden"
    >
      
      {showConfetti && (
        <Confetti width={width} height={height} recycle={false} />
      )}
      <div className="max-w-4xl mx-auto space-y-6">
        {/* Progress Bar */}
        <div className="w-full bg-gray-200 rounded-full h-2">
          <div
            className="bg-indigo-600 h-2 rounded-full transition-width duration-500"
            style={{ width: `${progress}%` }}
          />
        </div>

        {/* Header & Theme Toggle */}
        <div className="flex justify-between items-center">
          <h1 className="text-3xl font-bold text-gray-800">BeerPong Quiz</h1>
          <div className="space-x-4">
            <button
              onClick={() => setView("play")}
              className={`px-4 py-2 rounded-lg ${
                view === "play"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-200"
              } transition`}
            >
              Play
            </button>
            <button
              onClick={() => setView("stats")}
              className={`px-4 py-2 rounded-lg ${
                view === "stats"
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-200"
              } transition`}
            >
              Stats
            </button>
          </div>
        </div>

        {/* Notifications */}
        {notifications.map((msg, i) => (
          <div
            key={i}
            className="p-3 bg-yellow-100 text-yellow-800 rounded-lg"
          >
            {msg}
          </div>
        ))}

        {view === "play" ? (
          <>
            {/* Players */}
            <div className="flex flex-wrap gap-2">
              {players.map((p: string, idx: number) => (
                <div
                  key={p}
                  className={`flex items-center space-x-2 px-4 py-1 rounded-full ${
                    idx === turnIndex ? "bg-indigo-200" : "bg-gray-200"
                  }`}
                >
                  <span>{p}</span>
                  <button
                    onClick={() => removePlayer(p)}
                    className="text-red-500 hover:text-red-700"
                  >
                    ✕
                  </button>
                </div>
              ))}
            </div>

            {/* Quiz Controls */}
            <div className="grid sm:grid-cols-2 gap-4 mb-4">
              <select
                value={category}
                onChange={(e: ChangeEvent<HTMLSelectElement>) =>
                  setCategory(e.target.value)
                }
                className="p-3 border-2 rounded-lg focus:ring-2 focus:ring-indigo-500"
              >
                <option value="">Alle Kategorien</option>
                {categories.map((c: string) => (
                  <option key={c}>{c}</option>
                ))}
              </select>
              <button
                onClick={generateTeams}
                className="py-3 bg-indigo-600 text-white rounded-lg hover:bg-indigo-700 transition"
              >
                Teams generieren
              </button>
            </div>

            {/* Teams */}
{teams && (
  <div className="grid grid-cols-2 gap-6 mb-6">
    {teams.map((teamPlayers: string[], i: number) => (
      <div
        key={i}
        className={`p-4 rounded-xl shadow-md hover:shadow-xl transition
          ${i === 0 ? "bg-red-100" : "bg-blue-100"}`}
      >
        <h2 className={`font-semibold mb-2 text-${i === 0 ? "red" : "blue"}-700`}>
          Team {i + 1} - Punkte: {scores[i] ?? 0}
        </h2>
        {teamPlayers.map((name: string) => (
          <p key={name} className="select-none">{name}</p>
        ))}
        <div className="flex space-x-2 mt-2">
          {/* Beispiel für 10 Becher */}
          {[...Array(10)].map((_, idx) => (
            <div
              key={idx}
              className={`w-6 h-6 rounded-full border-2
                ${
                  idx < (scores[i] ?? 0)
                    ? i === 0
                      ? "bg-red-600 border-red-800"
                      : "bg-blue-600 border-blue-800"
                    : "bg-gray-300 border-gray-400"
                }`}
            />
          ))}
        </div>
      </div>
    ))}
  </div>
)}



            {/* Cups */}
            <div className="mt-6 space-y-4">
              {[0, 10].map((offset: number) => (
                <div key={offset} className="grid grid-cols-5 gap-3">
                  {cups.slice(offset, offset + 10).map((ok, i: number) => (
                    <div
                      key={i}
                      onClick={() => handleHit(offset + i)}
                      className={`aspect-square flex items-center justify-center text-xl font-bold rounded-lg cursor-pointer transition ${
                        ok
                          ? "bg-yellow-300 hover:bg-yellow-400"
                          : "bg-gray-300 opacity-50"
                      }`}
                    >
                      {offset + i + 1}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Question */}
         {currentQ && players[turnIndex] === userName && (
  <div className="mt-6 bg-white p-6 rounded-xl shadow-lg">
    <p className="text-xl mb-4">{currentQ.question}</p>
    <div className="flex space-x-4">
      <input
        type="text"
        value={answer}
        onChange={(e) => setAnswer(e.target.value)}
        placeholder="Antwort"
        className="flex-1 p-3 border-2 rounded-lg focus:ring-2 focus:ring-indigo-500"
      />
      <button
        onClick={submitAnswer}
        className="px-6 py-3 bg-green-500 text-white rounded-lg hover:bg-green-600"
      >
        Abschicken
      </button>
    </div>
  </div>
)}

{currentQ && players[turnIndex] !== userName && (
  <div className="mt-6 p-6 bg-gray-200 rounded-xl text-center text-gray-600">
    Es ist gerade nicht dein Zug. Warte bitte.
  </div>
)}


            {/* Feedback */}
            {feedback && (
              <div className="mt-4 p-4 bg-indigo-100 text-indigo-800 rounded-lg text-center">
                {feedback}
              </div>
            )}

            {/* Reset */}
            <div className="mt-6 text-right">
              <button
                onClick={resetGame}
                className="text-sm text-red-500 hover:underline"
              >
                Cups zurücksetzen
              </button>
            </div>
          </>
        ) : (
          // STATS VIEW
          <div>
            <h2 className="text-2xl font-semibold mb-6">Statistiken</h2>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-6">
              {players.map((p: string) => {
                const s = statsMap[p] || { correct: 0, wrong: 0, gamesWon: 0 };
                return (
                  <li
                    key={p}
                    className="bg-white p-6 rounded-xl shadow-md hover:shadow-xl transition"
                  >
                    <h3 className="font-bold mb-2">{p}</h3>
                    <p>✅ Richtig: {s.correct}</p>
                    <p>❌ Falsch: {s.wrong}</p>
                    <p>🏆 Siege: {s.gamesWon}</p>
                  </li>
                );
              })}
            </ul>
          </div>
        )}
      </div>
    </main>
  );
}
