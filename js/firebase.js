// js/firebase.js

import { initializeApp } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-app.js';
import { getFirestore } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-firestore.js';
import { getAuth } from 'https://www.gstatic.com/firebasejs/10.11.0/firebase-auth.js';

const firebaseConfig = {
  apiKey: "AIzaSyDjlk8wMMC3N_uEXdHIrBBWvArvHkvMpN8",
  authDomain: "uniz-baseball.firebaseapp.com",
  projectId: "uniz-baseball",
  storageBucket: "uniz-baseball.firebasestorage.app",
  messagingSenderId: "601982955671",
  appId: "1:601982955671:web:56c81e8d03478939d139d2",
  measurementId: "G-P0MX60MYQ3"
};

// Firebase 앱 초기화
const app = initializeApp(firebaseConfig);

// Firestore와 Auth 객체 export
export const db = getFirestore(app);
export const auth = getAuth(app);
