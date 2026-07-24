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

// Referências aos painéis
const painelAluno = document.getElementById('student-dashboard');
const painelAdmin = document.getElementById('admin-dashboard');
const classView = document.getElementById('class-view');

// Referências à navegação de turmas
const botoesTurma = document.querySelectorAll('.turma-card');
const classTitle = document.getElementById('class-title');
const btnVoltarTurmas = document.getElementById('btn-voltar-turmas');

// 1. Escutar estado de autenticação e carregar dados do utilizador
onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginScreen.style.display = 'none';
        appContent.style.display = 'block';
        
        const userId = user.email.split('@')[0];
        
        try {
            const docRef = doc(db, "utilizadores", userId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const dados = docSnap.data();
                
                // Atualizar o cabeçalho
                const userProfileSpan = document.querySelector('.user-profile span');
                userProfileSpan.innerText = `Olá, ${dados.nome} (${dados.papel.toUpperCase()})`;
                
                // O "Gestor de Tráfego": Mostra o painel correto conforme o papel
                if (dados.papel === 'admin') {
                    painelAluno.style.display = 'none';
                    painelAdmin.style.display = 'block';
                    classView.style.display = 'none'; // Garante que a vista da turma está fechada no início
                } else {
                    painelAluno.style.display = 'block';
                    painelAdmin.style.display = 'none';
                    classView.style.display = 'none';
                }
            }
        } catch (error) {
            console.error("Erro ao carregar dados do perfil:", error);
        }

    } else {
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

// 2. Fazer Login
btnLoginManual.addEventListener('click', () => {
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;
    const emailFalso = username + "@turmapro.com";

    signInWithEmailAndPassword(auth, emailFalso, pass)
        .then(() => {
            errorMsg.style.display = 'none';
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

// 4. Navegação do Painel de Admin (Abrir Turmas)
botoesTurma.forEach(botao => {
    botao.addEventListener('click', () => {
        const nomeTurma = botao.getAttribute('data-turma'); 
        
        classTitle.innerHTML = `<i class="fa-solid fa-users"></i> Turma ${nomeTurma}`;
        
        painelAdmin.style.display = 'none';
        classView.style.display = 'block';
    });
});

// Função para voltar atrás
if(btnVoltarTurmas) {
    btnVoltarTurmas.addEventListener('click', () => {
        classView.style.display = 'none';
        painelAdmin.style.display = 'block';
    });
}
