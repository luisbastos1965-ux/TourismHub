import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAUU6rITouybEamgkPke4UXJwyjMA0nJzU",
  authDomain: "turmapro-e6358.firebaseapp.com",
  projectId: "turmapro-e6358",
  storageBucket: "turmapro-e6358.firebasestorage.app",
  messagingSenderId: "242512169110",
  appId: "1:242512169110:web:f94978c0c2a13858a41ab7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Referências aos elementos do ecrã
const loginScreen = document.getElementById('login-screen');
const appContent = document.getElementById('app-content');
const btnLoginManual = document.getElementById('btn-login-manual');
const btnLogout = document.getElementById('btn-logout');
const errorMsg = document.getElementById('login-error');

// 1. Escutar se alguém entrou ou saiu
onAuthStateChanged(auth, (user) => {
    if (user) {
        // Tem sessão iniciada! Esconde o login, mostra a app.
        loginScreen.style.display = 'none';
        appContent.style.display = 'block';
    } else {
        // Não tem sessão. Mostra o login, esconde a app.
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

// 2. Fazer Login (O truque do a1234)
btnLoginManual.addEventListener('click', () => {
    // O .trim() corta automaticamente espaços em branco invisíveis no início ou fim
    const username = document.getElementById('login-username').value.trim();
    const pass = document.getElementById('login-password').value;
    
    // O nosso truque: juntar o domínio
    const emailFalso = username + "@turmapro.com";

    signInWithEmailAndPassword(auth, emailFalso, pass)
        .then((userCredential) => {
            errorMsg.style.display = 'none'; // Login com sucesso
        })
        .catch((error) => {
            errorMsg.style.display = 'block'; 
            // Agora a app vai mostrar o erro exato do Firebase no ecrã!
            errorMsg.innerText = "Erro do Firebase: " + error.code; 
        });
});

// 3. Terminar Sessão (Sair)
btnLogout.addEventListener('click', () => {
    signOut(auth);
});
