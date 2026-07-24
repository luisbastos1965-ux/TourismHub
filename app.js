// Importar as ferramentas principais do Firebase
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// A tua configuração específica do Firebase
const firebaseConfig = {
  apiKey: "AIzaSyAUU6rITouybEamgkPke4UXJwyjMA0nJzU",
  authDomain: "turmapro-e6358.firebaseapp.com",
  projectId: "turmapro-e6358",
  storageBucket: "turmapro-e6358.firebasestorage.app",
  messagingSenderId: "242512169110",
  appId: "1:242512169110:web:f94978c0c2a13858a41ab7"
};

// Inicializar o motor do Firebase
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

console.log("Cérebro Firebase ligado com sucesso!");
