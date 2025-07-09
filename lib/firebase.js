// lib/firebase.js
import { initializeApp } from "firebase/app";
import { getDatabase } from "firebase/database";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || "AIzaSyA8v1r9vmWEM8d7HUTYsZsRH11TY39n6r4",
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || "beerpong-quiz.firebaseapp.com",
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL || "https://beerpong-quiz-default-rtdb.europe-west1.firebasedatabase.app/",
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || "beerpong-quiz",
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || "beerpong-quiz.appspot.com",
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || "584570490067",
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || "1:584570490067:web:d0f5bb23a9fb0a97399826",
  measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID || "G-2RRXHVTLPY"
};

// initialize Firebase App
const app = initializeApp(firebaseConfig);

// Realtime Database
export const db = getDatabase(app);

// Authentication
export const auth = getAuth(app);

// Firestore
export const firestore = getFirestore(app);
