// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";

const firebaseConfig = {
  apiKey: "AIzaSyA8v1r9vmWEM8d7HUTYsZsRH11TY39n6r4",
  authDomain: "beerpong-quiz.firebaseapp.com",
  databaseURL: "https://beerpong-quiz-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: "beerpong-quiz",
  storageBucket:    "beerpong-quiz.appspot.com",
  messagingSenderId: "584570490067",
  appId:            "1:584570490067:web:d0f5bb23a9fb0a97399826",
  measurementId:    "G-2RRXHVTLPY"
};

const app = initializeApp(firebaseConfig);
export const db = getDatabase(app);
