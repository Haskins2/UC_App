import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';

const firebaseConfig = {
  apiKey: "AIzaSyBRa5flCB51BSIJZLufs1dnqeu-GA6rpSo",
  authDomain: "ucapp-7329b.firebaseapp.com",
  projectId: "ucapp-7329b",
  storageBucket: "ucapp-7329b.firebasestorage.app",
  messagingSenderId: "95795248323",
  appId: "1:95795248323:web:e0217f041ba2703254b676",
  measurementId: "G-0RVJ1RMJ05"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firestore
export const db = getFirestore(app);
