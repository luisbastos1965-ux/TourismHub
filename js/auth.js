import { auth, db } from "./firebase.js";
import { signInWithEmailAndPassword, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const btnLogin = document.getElementById('btn-login-manual');
const btnBiometrico = document.getElementById('btn-login-biometrico');
const errorMsg = document.getElementById('login-error');

// ==================================================
// 1. VERIFICAR SE O DISPOSITIVO SUPORTA BIOMETRIA
// ==================================================
if (window.PasswordCredential && navigator.credentials) {
    // Se o browser suportar o cofre do dispositivo, mostramos o botão
    if(btnBiometrico) btnBiometrico.style.display = 'flex';
}

// ==================================================
// 2. VERIFICAR SESSÃO ATIVA E REDIRECIONAR (O PORTEIRO)
// ==================================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Se já está logado, descobrir os papéis e mandar para a página certa
        const userId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", userId));
            if (docSnap.exists()) {
                const data = docSnap.data();
                
                // Sistema de Cinto de Utilidades (Array de Papéis)
                const papeis = data.papeis || [];
                
                // Manter retrocompatibilidade se o aluno só tiver "papel: 'aluno'"
                if (data.papel && !papeis.includes(data.papel)) {
                    papeis.push(data.papel);
                }
                
                redirecionarParaPainel(papeis);
            } else {
                mostrarErro("Utilizador não encontrado na base de dados.");
                auth.signOut();
            }
        } catch (e) { console.error("Erro ao ler perfil para redirecionamento", e); }
    } else {
        // Garantir que os botões ficam normais se não houver sessão
        if(btnLogin) {
            btnLogin.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
            btnLogin.disabled = false;
        }
    }
});

// ==================================================
// 3. LOGIN MANUAL E GUARDAR IMPRESSÃO DIGITAL
// ==================================================
if(btnLogin) {
    btnLogin.addEventListener('click', async () => {
        const username = document.getElementById('login-username').value.trim().toLowerCase();
        const pass = document.getElementById('login-password').value;
        
        if(!username || !pass) {
            mostrarErro("Preenche todos os campos.");
            return;
        }

        btnLogin.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A entrar...';
        btnLogin.disabled = true;
        errorMsg.style.display = 'none';

        try {
            // Fazer Login no Firebase
            await signInWithEmailAndPassword(auth, username + "@turmapro.com", pass);
            
            // GUARDAR CREDENCIAL PARA BIOMETRIA FUTURA (Se o browser suportar)
            if (window.PasswordCredential && navigator.credentials) {
                try {
                    const cred = new PasswordCredential({
                        id: username,
                        password: pass,
                        name: username.toUpperCase()
                    });
                    await navigator.credentials.store(cred);
                    // O dispositivo guardou com sucesso no Keychain/Google Passwords
                } catch(err) {
                    console.log("O utilizador recusou guardar a credencial ou o dispositivo não permite.", err);
                }
            }
            
            // A função onAuthStateChanged apanha o sucesso e redireciona automaticamente!
        } catch (error) {
            btnLogin.innerHTML = '<i class="fa-solid fa-right-to-bracket"></i> Entrar';
            btnLogin.disabled = false;
            mostrarErro("Utilizador ou Palavra-passe incorretos.");
        }
    });
}

// Permite fazer login clicando na tecla "Enter" no campo da password
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
            // Pedir ao sistema operativo as credenciais guardadas
            // Isto obriga o dispositivo a pedir a Impressão Digital ou Face ID ao utilizador!
            const cred = await navigator.credentials.get({
                password: true,
                mediation: 'required' // Força a interação de segurança do telemóvel
            });

            if (cred && cred.id && cred.password) {
                // Biometria aprovada! O cofre devolveu a password, vamos entrar!
                btnBiometrico.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A verificar...';
                
                await signInWithEmailAndPassword(auth, cred.id + "@turmapro.com", cred.password);
                // O onAuthStateChanged vai apanhar e redirecionar
            } else {
                mostrarErro("Nenhuma credencial guardada neste dispositivo.");
            }
        } catch (err) {
            console.error("Erro na biometria:", err);
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
    let paginaDestino = 'index.html'; // Default

    if (papeis.includes('admin')) {
        paginaDestino = 'admin.html';
    } 
    // Deteta qualquer tipo de função letiva e manda para o canivete suíço (prof.html)
    else if (papeis.some(r => ['professor', 'diretor_turma', 'dt', 'orientador_pap', 'coordenador'].includes(r))) {
        paginaDestino = 'prof.html';
    } 
    else if (papeis.includes('ee')) {
        paginaDestino = 'ee.html';
    } 
    else if (papeis.includes('aluno')) {
        paginaDestino = 'aluno.html';
    }

    // Para evitar loops, se não estiver na página de destino, redireciona
    if (!paginaAtual.includes(paginaDestino)) {
        window.location.href = paginaDestino;
    }
}
