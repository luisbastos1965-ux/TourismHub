import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const btnLogin = document.getElementById('btn-login-manual');
const btnBiometrico = document.getElementById('btn-login-biometrico');
const errorMsg = document.getElementById('login-error');

// ==================================================
// 0. TEMA CLARO / ESCURO & MOSTRAR PALAVRA-PASSE
// ==================================================
const themeBtn = document.getElementById('btn-theme-toggle');
const themeIcon = document.getElementById('theme-icon');
const togglePassword = document.getElementById('toggle-password');
const passwordInput = document.getElementById('login-password');

// Carregar Tema guardado
const currentTheme = localStorage.getItem('turmapro_theme') || 'dark';
document.documentElement.setAttribute('data-theme', currentTheme);
if(themeIcon) themeIcon.className = currentTheme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';

// Alternar Tema com Animação
if(themeBtn) {
    themeBtn.addEventListener('click', () => {
        const isLight = document.documentElement.getAttribute('data-theme') === 'light';
        const newTheme = isLight ? 'dark' : 'light';
        document.documentElement.setAttribute('data-theme', newTheme);
        localStorage.setItem('turmapro_theme', newTheme);
        
        themeIcon.style.transform = 'scale(0) rotate(-90deg)';
        setTimeout(() => {
            themeIcon.className = newTheme === 'light' ? 'fa-solid fa-moon' : 'fa-solid fa-sun';
            themeIcon.style.transform = 'scale(1) rotate(0deg)';
        }, 200);
    });
}

// Alternar Visibilidade da Password
if(togglePassword && passwordInput) {
    togglePassword.addEventListener('click', () => {
        const type = passwordInput.getAttribute('type') === 'password' ? 'text' : 'password';
        passwordInput.setAttribute('type', type);
        togglePassword.classList.toggle('fa-eye');
        togglePassword.classList.toggle('fa-eye-slash');
        togglePassword.style.color = type === 'text' ? 'var(--primary-green)' : 'var(--text-muted)';
    });
}

// ==================================================
// 1. VERIFICAR SE O DISPOSITIVO SUPORTA BIOMETRIA
// ==================================================
if (window.PasswordCredential && navigator.credentials) {
    if(btnBiometrico) btnBiometrico.style.display = 'flex';
}

// ==================================================
// 2. VERIFICAR SESSÃO ATIVA E REDIRECIONAR
// ==================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", userId));
            if (docSnap.exists()) {
                const data = docSnap.data();
                const papeis = data.papeis || [];
                if (data.papel && !papeis.includes(data.papel)) {
                    papeis.push(data.papel);
                }
                redirecionarParaPainel(papeis);
            } else {
                mostrarErro("Utilizador não encontrado na base de dados.");
                auth.signOut();
            }
        } catch (e) { console.error("Erro ao ler perfil", e); }
    } else {
        if(btnLogin) {
            btnLogin.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
            btnLogin.disabled = false;
        }
    }
});

// ==================================================
// 3. LOGIN MANUAL
// ==================================================
if(btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const username = document.getElementById('login-username').value.trim().toLowerCase();
        const pass = passwordInput.value;
        
        if(!username || !pass) {
            mostrarErro("Preenche todos os campos.");
            return;
        }

        // Micro-interação de Carregamento (Spinner)
        btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A entrar...';
        btnLogin.disabled = true;
        errorMsg.style.display = 'none';

        try {
            await signInWithEmailAndPassword(auth, username + "@turmapro.com", pass);
            
            if (window.PasswordCredential && navigator.credentials) {
                try {
                    const cred = new PasswordCredential({ id: username, password: pass, name: username.toUpperCase() });
                    await navigator.credentials.store(cred);
                } catch(err) { console.log("O dispositivo não permitiu guardar a credencial.", err); }
            }
        } catch (error) {
            // Restaura o botão em caso de erro
            btnLogin.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
            btnLogin.disabled = false;
            mostrarErro("Utilizador ou Palavra-passe incorretos.");
        }
    });
}

const inputPass = document.getElementById('login-password');
if(inputPass) {
    inputPass.addEventListener('keypress', function (e) {
        if (e.key === 'Enter') btnLogin.click();
    });
}

// ==================================================
// 4. LOGIN COM IMPRESSÃO DIGITAL / FACE ID
// ==================================================
if(btnBiometrico) {
    btnBiometrico.addEventListener('click', async () => {
        errorMsg.style.display = 'none';
        try {
            const cred = await navigator.credentials.get({ password: true, mediation: 'required' });
            if (cred && cred.id && cred.password) {
                btnBiometrico.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A verificar...';
                await signInWithEmailAndPassword(auth, cred.id + "@turmapro.com", cred.password);
            } else {
                mostrarErro("Nenhuma credencial guardada neste dispositivo.");
            }
        } catch (err) {
            mostrarErro("Autenticação biométrica cancelada ou falhou.");
            btnBiometrico.innerHTML = '<i class="fa-solid fa-fingerprint"></i> Entrar com Biometria';
        }
    });
}

// ==================================================
// 5. MÁQUINA DE ROTAS E AJUDANTES
// ==================================================
function mostrarErro(texto) {
    if(errorMsg) {
        errorMsg.innerText = texto;
        errorMsg.style.display = 'block';
    }
}

function redirecionarParaPainel(papeis) {
    const paginaAtual = window.location.pathname;
    let paginaDestino = 'index.html'; 

    if (papeis.includes('admin')) { paginaDestino = 'admin.html'; } 
    else if (papeis.some(r => ['professor', 'diretor_turma', 'dt', 'orientador_pap', 'coordenador'].includes(r))) { paginaDestino = 'prof.html'; } 
    else if (papeis.includes('ee')) { paginaDestino = 'ee.html'; } 
    else if (papeis.includes('aluno')) { paginaDestino = 'aluno.html'; }

    if (!paginaAtual.includes(paginaDestino)) {
        window.location.href = paginaDestino;
    }
}
