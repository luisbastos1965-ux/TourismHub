import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAUU6riTOuybEamgkPke4UXJwyjMA0nJzU",
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

// 1. Escutar estado de autenticação e carregar dados do utilizador
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Tem sessão iniciada. Esconde o login, mostra a app.
        loginScreen.style.display = 'none';
        appContent.style.display = 'block';
        
        // Extrair o ID do utilizador a partir do email (ex: "admin")
        const userId = user.email.split('@')[0];
        
        try {
            // Ir à coleção "utilizadores" procurar pelo documento do utilizador
            const docRef = doc(db, "utilizadores", userId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const dados = docSnap.data();
                
                // 1.1 Atualizar o cabeçalho com nome e papel
                const userProfileSpan = document.querySelector('.user-profile span');
                userProfileSpan.innerText = `Olá, ${dados.nome} (${dados.papel.toUpperCase()})`;
                
                // 1.2 O "Gestor de Tráfego": Mostra o painel correto conforme o papel
                const painelAluno = document.getElementById('student-dashboard');
                const painelAdmin = document.getElementById('admin-dashboard');
                
                if (dados.papel === 'admin') {
                    painelAluno.style.display = 'none';
                    painelAdmin.style.display = 'block';
                } else {
                    painelAluno.style.display = 'block';
                    painelAdmin.style.display = 'none';
                }
            }
        } catch (error) {
            console.error("Erro ao carregar dados do perfil:", error);
        }

    } else {
        // Não tem sessão. Mostra o login, esconde a app.
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

// 2. Fazer Login
btnLoginManual.addEventListener('click', () => {
    // Recolher dados, remover espaços em branco invisíveis e forçar minúsculas
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;
    
    // O truque da simulação de e-mail
    const emailFalso = username + "@turmapro.com";

    signInWithEmailAndPassword(auth, emailFalso, pass)
        .then(() => {
            errorMsg.style.display = 'none'; // Sucesso
        })
        .catch((error) => {
            errorMsg.style.display = 'block';
            errorMsg.innerText = "Erro: Credenciais inválidas.";
        });
});

// 3. Terminar Sessão
btnLogout.addEventListener('click', () => {
    signOut(auth);
});
