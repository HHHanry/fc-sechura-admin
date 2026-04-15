import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";


const firebaseConfig = {
  apiKey: "AIzaSyDUsjmknRhem7fPahSGLbjme0WzeTQsYik",
  authDomain: "fc-sechura-app.firebaseapp.com",
  projectId: "fc-sechura-app",
  storageBucket: "fc-sechura-app.firebasestorage.app",
  messagingSenderId: "574089328068",
  appId: "1:574089328068:web:cae7e9e69ec1d0e4f12091"
};
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
