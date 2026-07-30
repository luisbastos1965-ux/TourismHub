import { auth, db, messaging, VAPID_KEY, getToken, onMessage } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, updateDoc, setDoc, enableIndexedDbPersistence } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Importa as Vistas (O Novo Ficheiro Modular)
import { initViews, carregarHomeAdaptativa, carregarGamificacao, carregarObjetivosPessoais, renderizarGraficoNotas, carregarHistoricoHumor, carregarEstatisticasEstudo, carregarTimelineAluno, carregarForuns } from "./aluno-views.js";

try { await enableIndexedDbPersistence(db); console.log("Modo Offline ativado!"); } catch (err) {}

window.myUserId = "";
window.myUserName = "";
window.minhaTurma = ""; 

onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", window.myUserId));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                if(dados.papel !== 'aluno') { window.location.href = "index.html"; return; }
                
                window.myUserName = dados.nome.split(' ')[0];
                window.minhaTurma = dados.turma;
                
                document.getElementById('header-user-name-aluno').innerText = window.myUserName;
                document.getElementById('welcome-nome').innerText = window.myUserName;
                document.getElementById('perfil-nome-central').innerText = dados.nome || window.myUserName;
                
                if(dados.fotoPerfil) {
                    document.getElementById('header-avatar-circle').innerHTML = `<img src="${dados.fotoPerfil}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                    document.getElementById('perfil-avatar-img').src = dados.fotoPerfil;
                } else {
                    document.getElementById('perfil-avatar-img').src = `https://ui-avatars.com/api/?name=${window.myUserName}&background=00cc88&color=fff&size=100`;
                }

                // Inicializa as vistas a partir do módulo secundário
                initViews(db);
                carregarGamificacao(dados);
                
                // ARRANCAR ASSISTENTE EM SEGURANÇA
                try { await carregarHomeAdaptativa(); } catch(e) { console.error("Erro Dashboard", e); }

                // Check Época de Exames
                if (window.minhaTurma) {
                    const turmaSnap = await getDoc(doc(db, "turmas", window.minhaTurma));
                    if (turmaSnap.exists()) {
                        const tData = turmaSnap.data();
                        if(tData.epocaExames && tData.epocaExames.ativa) {
                            document.getElementById('exam-mode-banner').style.display = 'block';
                            document.body.style.borderTop = "5px solid #8e2de2"; 
                            if(tData.epocaExames.dataFim) {
                                const hj = new Date(); const fm = new Date(tData.epocaExames.dataFim);
                                const df = Math.ceil((fm - hj) / (1000 * 60 * 60 * 24));
                                document.getElementById('exam-countdown').innerText = df > 0 ? `Faltam ${df} dias` : "Já terminou";
                            }
                        }
                    }
                }
            }
        } catch (e) { console.error("Erro Auth", e); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-aluno')?.addEventListener('click', () => { signOut(auth).then(() => window.location.href = "index.html"); });

// ----------------------------------------------------
// EVENT DELEGATION (Modo Foco e Caderno Seguros)
// ----------------------------------------------------
document.body.addEventListener('click', (e) => {
    // Modo Foco
    if(e.target.closest('#btn-open-study-mode')) {
        esconderTodasAsVistas();
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById('view-study-mode').style.display = 'flex';
    }
    // Caderno
    if(e.target.closest('#btn-open-caderno')) {
        esconderTodasAsVistas();
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById('view-aluno-caderno').style.display = 'block';
    }
});

// ----------------------------------------------------
// NAVEGAÇÃO GLOBAL
// ----------------------------------------------------
const navItems = document.querySelectorAll('.nav-item');
const views = [
    document.getElementById('student-dashboard'), document.getElementById('view-aluno-caderneta'),
    document.getElementById('view-aluno-agenda'), document.getElementById('view-aluno-forum'),
    document.getElementById('view-aluno-passaporte'), document.getElementById('view-study-mode'),
    document.getElementById('view-aluno-sumarios'), document.getElementById('view-aluno-caderno'),
    document.getElementById('view-aluno-notificacoes'), document.getElementById('view-aluno-perfil'),
    document.getElementById('view-aluno-acao-prhf')
];

function esconderTodasAsVistas() { views.forEach(v => { if(v) v.style.display = 'none'; }); }

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault(); navItems.forEach(nav => nav.classList.remove('active')); e.currentTarget.classList.add('active');
        esconderTodasAsVistas(); const targetId = e.currentTarget.getAttribute('data-target'); const targetView = document.getElementById(targetId);
        if(targetView) targetView.style.display = 'block';

        if(targetId === 'view-aluno-perfil') { 
            carregarObjetivosPessoais(); carregarHistoricoHumor(); carregarEstatisticasEstudo();
            setTimeout(() => { renderizarGraficoNotas(); }, 300); // 300ms de atraso para Chart.js não falhar
        }
        if(targetId === 'view-aluno-caderneta') { 
            document.getElementById('tab-aluno-timeline').click(); 
        }
        if(targetId === 'view-aluno-agenda') { document.getElementById('tab-aluno-eventos').click(); }
        if(targetId === 'view-aluno-forum') { carregarForuns(); }
    });
});

document.getElementById('btn-open-notificacoes')?.addEventListener('click', () => { esconderTodasAsVistas(); navItems.forEach(nav => nav.classList.remove('active')); document.getElementById('view-aluno-notificacoes').style.display = 'block'; });
document.querySelectorAll('#btn-voltar-notificacoes, #btn-voltar-caderno').forEach(btn => {
    btn?.addEventListener('click', () => { esconderTodasAsVistas(); document.querySelector('.nav-item[data-target="student-dashboard"]').classList.add('active'); document.getElementById('student-dashboard').style.display = 'block'; });
});
