// Import the functions you need from the SDKs you need
import { initializeApp } from "firebase/app";
import { getAnalytics } from "firebase/analytics";
// TODO: Add SDKs for Firebase products that you want to use
// https://firebase.google.com/docs/web/setup#available-libraries

// Your web app's Firebase configuration
// For Firebase JS SDK v7.20.0 and later, measurementId is optional
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
const analytics = getAnalytics(app);