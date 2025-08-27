// firebaseConfig.jsx
import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";
import { getStorage } from "firebase/storage";

// Your web app's Firebase configuration
const firebaseConfig = {
  apiKey: "AIzaSyAiiWxdWDk9YYh_hx0ClSfPwgRtE5Bb-QY",
  authDomain: "ojtmanagementsystem-3c13f.firebaseapp.com",
  projectId: "ojtmanagementsystem-3c13f",
  storageBucket: "ojtmanagementsystem-3c13f.firebasestorage.app",
  messagingSenderId: "161737113843",
  appId: "1:161737113843:web:86dabdec708ef899bb7786",
  measurementId: "G-PR098KXEXJ"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
const auth = getAuth(app);
const db = getFirestore(app);
const storage = getStorage(app);

export { auth, db, storage };
export default app;
