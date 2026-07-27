import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let myUserId = "";
let myUserName = "";

// ==========================================
// 1. SEGURANÇA E INICIALIZAÇÃO
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                if(dados.papel !== 'aluno') {
                    window.location.href = "index.html"; 
                    return;
                }
                
                myUserName = dados.nome.split(' ')[0];
                document.getElementById('header-user-name-aluno').innerText = myUserName;
                
                // Carregar foto de perfil
                if(dados.fotoPerfil) {
                    const avatarCircle = document.getElementById('header-avatar-circle');
                    avatarCircle.innerHTML = `<img src="${dados.fotoPerfil}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                }

                carregarDadosPassaporte(dados);
            }
        } catch (e) { console.error("Erro ao ler perfil", e); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-aluno')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

// ==========================================
// 2. NAVEGAÇÃO DA BARRA INFERIOR
// ==========================================
const navItems = document.querySelectorAll('.nav-item');
const views = [
    document.getElementById('student-dashboard'),
    document.getElementById('view-aluno-caderneta'),
    document.getElementById('view-aluno-agenda'),
    document.getElementById('view-aluno-forum'),
    document.getElementById('view-aluno-passaporte'),
    document.getElementById('view-study-mode')
];

function esconderTodasAsVistas() {
    views.forEach(v => { if(v) v.style.display = 'none'; });
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        
        // Atualizar barra ativa
        navItems.forEach(nav => nav.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        // Mudar de vista
        esconderTodasAsVistas();
        const targetId = e.currentTarget.getAttribute('data-target');
        const targetView = document.getElementById(targetId);
        if(targetView) targetView.style.display = 'block';
    });
});

// O Botão especial no cabeçalho para saltar direto para o passaporte
document.getElementById('btn-abrir-passaporte')?.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    document.querySelector('.nav-item[data-target="view-aluno-passaporte"]').classList.add('active');
    esconderTodasAsVistas();
    document.getElementById('view-aluno-passaporte').style.display = 'block';
});

document.getElementById('btn-voltar-passaporte')?.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    document.querySelector('.nav-item[data-target="student-dashboard"]').classList.add('active');
    esconderTodasAsVistas();
    document.getElementById('student-dashboard').style.display = 'block';
});

// ==========================================
// 3. PASSAPORTE (FCT & PAP)
// ==========================================
let ficheiroPapBase64 = "";

function carregarDadosPassaporte(dados) {
    // FCT
    const fctEntidade = dados.fctEntidade || "Por definir";
    const fctHorasFeitas = dados.fctHorasFeitas || 0;
    const fctHorasTotais = dados.fctHorasTotais || 400; // Padrão dos Cursos Profissionais
    
    document.getElementById('aluno-fct-entidade').innerText = fctEntidade;
    document.getElementById('aluno-fct-horas').innerText = `${fctHorasFeitas} / ${fctHorasTotais}h`;
    
    let percFCT = fctHorasTotais > 0 ? (fctHorasFeitas / fctHorasTotais) * 100 : 0;
    document.getElementById('aluno-fct-progress').style.width = `${Math.min(percFCT, 100)}%`;

    // PAP
    const papTema = dados.papTema || "Por selecionar";
    document.getElementById('aluno-pap-tema').innerText = papTema;
}

// Upload do Anteprojeto da PAP
document.getElementById('aluno-upload-pap')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    // Limite de segurança de tamanho
    if(file.size > 3145728) { 
        alert("Ficheiro demasiado grande! O limite é 3MB."); 
        return; 
    }
    
    document.getElementById('aluno-pap-file-name').innerText = file.name;
    document.getElementById('btn-enviar-pap').style.display = 'block'; // Mostrar botão de envio

    const reader = new FileReader();
    reader.onload = (ev) => { ficheiroPapBase64 = ev.target.result; };
    reader.readAsDataURL(file);
});

// Envio para o Firebase
document.getElementById('btn-enviar-pap')?.addEventListener('click', async (e) => {
    if(!ficheiroPapBase64 || !myUserId) return;
    
    const btnRef = e.currentTarget;
    btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar...';
    btnRef.disabled = true;

    try {
        await updateDoc(doc(db, "utilizadores", myUserId), {
            papFicheiroEnviado: true,
            papFicheiroBase64: ficheiroPapBase64,
            papDataEnvio: new Date().toISOString()
        });
        
        btnRef.style.backgroundColor = "var(--success-green)";
        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Submetido com Sucesso!';
        
        setTimeout(() => {
            btnRef.style.display = 'none';
            btnRef.disabled = false;
            btnRef.style.backgroundColor = "var(--primary-green)";
            btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submeter Ficheiro';
            document.getElementById('aluno-pap-file-name').innerText = "Ficheiro na posse da escola.";
        }, 3000);
        
    } catch(err) {
        btnRef.innerHTML = "Erro ao submeter!";
        setTimeout(() => {
            btnRef.disabled = false;
            btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submeter Ficheiro';
        }, 2000);
    }
});

// ==========================================
// 4. MODO DE ESTUDO (POMODORO)
// ==========================================
let pomodoroTimer;
let pomodoroRestante = 25 * 60; // 25 Minutos

document.getElementById('btn-open-study-mode')?.addEventListener('click', () => {
    esconderTodasAsVistas();
    document.getElementById('view-study-mode').style.display = 'flex';
});

document.getElementById('btn-voltar-study')?.addEventListener('click', () => {
    esconderTodasAsVistas();
    document.getElementById('student-dashboard').style.display = 'block';
});

document.getElementById('btn-start-study')?.addEventListener('click', (e) => {
    e.currentTarget.style.display = 'none';
    document.getElementById('btn-stop-study').style.display = 'inline-block';
    
    pomodoroTimer = setInterval(() => {
        pomodoroRestante--;
        const m = Math.floor(pomodoroRestante / 60).toString().padStart(2, '0');
        const s = (pomodoroRestante % 60).toString().padStart(2, '0');
        document.getElementById('study-timer-text').innerText = `${m}:${s}`;
        
        if(pomodoroRestante <= 0) {
            clearInterval(pomodoroTimer);
            alert("Parabéns! Foco concluído. Descansa 5 minutos.");
            resetPomodoro();
        }
    }, 1000);
});

document.getElementById('btn-stop-study')?.addEventListener('click', resetPomodoro);

function resetPomodoro() {
    clearInterval(pomodoroTimer);
    pomodoroRestante = 25 * 60;
    document.getElementById('study-timer-text').innerText = "25:00";
    document.getElementById('btn-stop-study').style.display = 'none';
    document.getElementById('btn-start-study').style.display = 'inline-block';
}
