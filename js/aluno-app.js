// js/aluno-app.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Importar os Módulos
import { setupGamificacao, aplicarTemaAcademia } from "./modules/aluno-gamificacao.js";
import { setupCaderneta } from "./modules/aluno-caderneta.js";
import { setupHorario, carregarMateriaisAluno } from "./modules/aluno-horario.js";
import { setupComunicacao } from "./modules/aluno-comunicacao.js";
import { setupPassaporte } from "./modules/aluno-passaporte.js"; // <-- NOVO MÓDULO IMPORTADO

// Partilhar variáveis globalmente para os módulos usarem
window.db = db;
window.myUserId = "";
window.myUserName = "";
window.minhaTurma = "";
window.myAcademia = "";

try { enableIndexedDbPersistence(db).catch(function(){}); } catch(e){}

// ==========================================
// INICIALIZAÇÃO DA APP
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", window.myUserId));
            if (docSnap.exists() && docSnap.data().papel === 'aluno') {
                const d = docSnap.data(); 
                window.myUserName = (d.nome || "Aluno").split(' ')[0]; 
                window.minhaTurma = d.turma || ""; 
                window.myAcademia = d.academia || null;
                
                // Preencher Interface Básica
                document.getElementById('header-user-name-aluno').innerText = window.myUserName; 
                document.getElementById('welcome-nome').innerText = window.myUserName;
                
                const centralNome = document.getElementById('perfil-nome-central'); 
                if(centralNome) centralNome.innerText = d.nome || window.myUserName;
                
                if(d.cargo === 'delegado' || d.cargo === 'subdelegado') {
                    const btnDel = document.getElementById('btn-modo-delegado');
                    if(btnDel) btnDel.style.display = 'inline-block';
                }

                const avatarCircle = document.getElementById('header-avatar-circle'); 
                const perfilImg = document.getElementById('perfil-avatar-img');
                if(d.fotoPerfil) { 
                    if(avatarCircle) avatarCircle.innerHTML = `<img src="${d.fotoPerfil}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`; 
                    if(perfilImg) perfilImg.src = d.fotoPerfil; 
                } else { 
                    if(perfilImg) perfilImg.src = `https://ui-avatars.com/api/?name=${window.myUserName}&background=00cc88&color=fff&size=100`; 
                }

                // Lógica de Visibilidade do Botão FCT/PAP
                const mStr = window.minhaTurma || "";
                const mMatch = mStr.match(/\d+/);
                const turmaAno = mMatch ? parseInt(mMatch[0]) : (d.ano || 10);
                
                // Simula o bloqueio (que depois será alterado pelo Professor na BD)
                const fctBloqueada = d.fctBloqueada !== false; 
                
                const btnPassaporte = document.getElementById('btn-abrir-passaporte');
                if (btnPassaporte) {
                    if (turmaAno === 10) {
                        btnPassaporte.style.setProperty('display', 'none', 'important');
                    } else if (turmaAno === 11 && fctBloqueada) {
                        btnPassaporte.style.display = 'flex';
                        btnPassaporte.style.filter = 'grayscale(100%)';
                        btnPassaporte.style.opacity = '0.5';
                        btnPassaporte.style.cursor = 'not-allowed';
                    } else {
                        btnPassaporte.style.display = 'flex';
                        btnPassaporte.style.filter = 'none';
                        btnPassaporte.style.opacity = '1';
                        btnPassaporte.style.cursor = 'pointer';
                    }
                }
                
                // Iniciar Módulos
                setupGamificacao(d);
                setupCaderneta(d);
                setupHorario();
                setupComunicacao();
                setupPassaporte(); // <-- NOVO MÓDULO ATIVADO AQUI

                // Verificar Academia
                if (!window.myAcademia) {
                    document.getElementById('modal-academia-quiz').style.display = 'flex'; 
                } else {
                    aplicarTemaAcademia(window.myAcademia);
                }
            } else {
                window.location.href = "index.html";
            }
        } catch (e) { console.error("Erro na leitura inicial:", e); }
    } else {
        window.location.href = "index.html";
    }
});

const btnLogout = document.getElementById('btn-logout-aluno');
if(btnLogout) btnLogout.addEventListener('click', () => signOut(auth));

// ==========================================
// NAVEGAÇÃO INFERIOR
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.app-content > div:not(.modal-overlay)').forEach(d => { if(d.id !== 'student-dashboard') d.style.display = 'none'; });
    
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.app-content > div:not(.modal-overlay)').forEach(d => d.style.display = 'none');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).style.display = 'block';
            
            // Disparar gatilhos específicos ao mudar de aba
            if(targetId === 'view-aluno-perfil') document.getElementById('badges-wrapper').style.display = 'none';
            if(targetId === 'view-aluno-caderneta') document.getElementById('tab-aluno-timeline').click();
            if(targetId === 'view-aluno-agenda') document.getElementById('tab-aluno-eventos').click();
            if(targetId === 'view-aluno-forum') {
                if(window.carregarCanaisForumAluno) window.carregarCanaisForumAluno();
            }
        });
    });

    document.getElementById('btn-open-materiais')?.addEventListener('click', () => {
        document.querySelectorAll('.app-content > div:not(.modal-overlay)').forEach(d => d.style.display = 'none');
        document.getElementById('view-aluno-materiais').style.display = 'block';
        carregarMateriaisAluno();
    });
    document.getElementById('btn-voltar-materiais')?.addEventListener('click', () => document.querySelector('.bottom-nav .nav-item.active').click());
});
