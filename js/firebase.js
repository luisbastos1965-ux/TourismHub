import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getMessaging, getToken, onMessage } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-messaging.js";

const firebaseConfig = {
  apiKey: "AIzaSyAUU6riTOuybEamgkPke4UXJwyjMA0nJzU",
  authDomain: "turmapro-e6358.firebaseapp.com",
  projectId: "turmapro-e6358",
  storageBucket: "turmapro-e6358.firebasestorage.app",
  messagingSenderId: "242512169110",
  appId: "1:242512169110:web:f94978c0c2a13858a41ab7"
};

const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const messaging = getMessaging(app);

// Adicionamos a VAPID KEY que geraste na consola do Firebase
export const VAPID_KEY = "BGvfEWuZMe51THx0yPPBDXcpDIEX1CuMHc5uj85eI7KMvPo8wSiZaORLfM3uTwjm5j-zqPJ3knoqXG4g-Uut5ZE"; 

// Exportamos as funções para usar nos outros ficheiros
export { getToken, onMessage };
