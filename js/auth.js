import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const btnLogin = document.getElementById('btn-login-manual');
const errorMsg = document.getElementById('login-error');

// 1. Verificar se alguém já tem sessão iniciada
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Se a pessoa já fez login antes, não a deixamos na porta.
        // Vamos ver quem é e atirar para a página certa!
        const userId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", userId));
            if (docSnap.exists()) {
                const papel = docSnap.data().papel;
                redirecionarParaPainel(papel);
            }
        } catch (e) { console.error("Erro ao ler perfil", e); }
    } else {
        // Se não tem sessão, garantimos que o botão está normal
        if(btnLogin) {
            btnLogin.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
            btnLogin.disabled = false;
        }
    }
});

// 2. Ação de clicar no botão "Entrar"
if(btnLogin) {
    btnLogin.addEventListener('click', () => {
        const username = document.getElementById('login-username').value.trim().toLowerCase();
        const pass = document.getElementById('login-password').value;
        
        if(!username || !pass) {
            errorMsg.innerText = "Preenche todos os campos.";
            errorMsg.style.display = 'block';
            return;
        }

        // Animação de carregamento
        btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A entrar...';
        btnLogin.disabled = true;
        errorMsg.style.display = 'none';

        // Tenta fazer login
        signInWithEmailAndPassword(auth, username + "@turmapro.com", pass)
            .then(() => {
                // O onAuthStateChanged (lá em cima) vai detetar o sucesso automaticamente e redirecionar
            })
            .catch((error) => {
                btnLogin.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
                btnLogin.disabled = false;
                errorMsg.innerText = "Utilizador ou Palavra-passe incorretos.";
                errorMsg.style.display = 'block';
            });
    });
}

// 3. A Máquina de Redirecionamento
function redirecionarParaPainel(papel) {
    // Evita loop infinito se já estiver na página certa
    const paginaAtual = window.location.pathname;

    let paginaDestino = 'index.html'; // Default

    if (papel === 'admin') paginaDestino = 'admin.html';
    else if (papel === 'dt') paginaDestino = 'dt.html';
    else if (papel === 'professor') paginaDestino = 'prof.html';
    else if (papel === 'ee') paginaDestino = 'ee.html';
    else if (papel === 'aluno') paginaDestino = 'aluno.html';

    // Se ele NÃO estiver já na página de destino, redireciona
    if (!paginaAtual.includes(paginaDestino)) {
        window.location.href = paginaDestino;
    }
}
