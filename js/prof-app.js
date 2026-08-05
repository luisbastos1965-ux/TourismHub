// js/prof-app.js
import { auth, db, signOut } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, setDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { state, getDisciplinasPermitidas, nomeCurto } from "./prof/store.js";
import { gerarRadarConflitos } from "./prof/roles/dt.js";
import { validarFCT } from "./prof/roles/coord.js"; // <-- Importamos o Coordenador
import { carregarRadarProfessor, analisarEAtualizarTurma, renderizarPautaTurma, renderizarFaltasTurma, desenharGraficoAluno, abrirPerfil360Aluno, carregarTarefasProf, carregarForunsProf, abrirChatForum } from "./prof/ui.js";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        state.myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", state.myUserId));
            if (docSnap.exists()) {
                state.profData = docSnap.data();
                state.myRoles = state.profData.papeis || [];
                state.disciplinasProfessor = state.profData.disciplinas || []; 
                state.turmasProfessor = state.profData.turmas || []; 
                state.minhaTurmaDT = state.profData.turmaDT || (state.turmasProfessor.length > 0 ? state.turmasProfessor[0] : "10T"); 

                if (state.profData.papel && !state.myRoles.includes(state.profData.papel)) state.myRoles.push(state.profData.papel);
                
                if (state.myRoles.some(r => ['professor', 'diretor_turma', 'orientador_pap', 'coordenador'].includes(r))) {
                    state.myUserName = state.profData.nome || state.myUserId;
                    
                    let titleStr = "Professor";
                    if (state.myRoles.includes('diretor_turma')) titleStr += " / DT";
                    if (state.myRoles.includes('orientador_pap')) titleStr += " / PAP";
                    if (state.myRoles.includes('coordenador')) titleStr += " / Coord"; 
                    
                    document.getElementById('header-user-name-prof').innerText = state.myUserName;
                    document.getElementById('header-user-name-prof').nextElementSibling.innerText = titleStr;
                    document.getElementById('perfil-nome-prof-view').innerText = state.myUserName;
                    document.getElementById('perfil-disciplinas-lista').innerText = state.disciplinasProfessor.length > 0 ? state.disciplinasProfessor.join(' • ') : 'Nenhuma disciplina configurada.';
                    document.getElementById('perfil-papeis-lista').innerText = state.myRoles.map(r => r.toUpperCase().replace('_', ' ')).join(' • ');
                    
                    if (state.profData.fotoPerfil) {
                        document.getElementById('header-avatar-circle').innerHTML = `<img src="${state.profData.fotoPerfil}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                        document.getElementById('prof-avatar-img').src = state.profData.fotoPerfil;
                    }
                    
                    let maxAno = 10; state.turmasProfessor.forEach(t => { let ano = parseInt(t.match(/\d+/)?.[0]) || 10; if(ano > maxAno) maxAno = ano; });
                    const canSeePassaporte = (state.myRoles.includes('diretor_turma') || state.myRoles.includes('orientador_pap') || state.myRoles.includes('coordenador')) && maxAno >= 11;
                    if (!canSeePassaporte) { document.getElementById('tab-tarefas-passaporte').style.display = 'none'; }

                    const sel = document.getElementById('prof-seletor-turmas');
                    if (state.turmasProfessor.length > 0) {
                        sel.innerHTML = '<option value="">-- Selecionar Turma --</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join('');
                    } else { sel.innerHTML = '<option value="">Sem turmas atribuídas</option>'; }

                    carregarRadarProfessor(); 
                } else { window.location.href = "index.html"; }
            }
        } catch (e) { console.error("Erro na inicialização:", e); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-prof')?.addEventListener('click', () => signOut(auth));

function esconderTodasAsVistas() { document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none'); }

document.body.addEventListener('click', async (e) => {
    
    // NAVEGAÇÃO PRINCIPAL E TABS
    const nav = e.target.closest('.nav-item');
    if (nav) {
        e.preventDefault(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); nav.classList.add('active');
        esconderTodasAsVistas(); const tId = nav.getAttribute('data-target'); document.getElementById(tId).style.display = (tId === 'view-prof-forum') ? 'flex' : 'block';
        if (tId === 'view-prof-dashboard') carregarRadarProfessor();
        if (tId === 'view-prof-turmas' && state.selectedTurma) analisarEAtualizarTurma(state.selectedTurma);
        if (tId === 'view-prof-tarefas') carregarTarefasProf();
        if (tId === 'view-prof-forum') { if (state.chatUnsubscribe) { state.chatUnsubscribe(); state.chatUnsubscribe = null; } document.getElementById('prof-forum-chat-view').style.display = 'none'; document.getElementById('btn-create-chat-prof').style.display = 'block'; document.getElementById('prof-forum-channel-list').style.display = 'block'; carregarForunsProf(); }
        return; 
    }

    if (e.target.closest('.fechar-modal')) { document.getElementById(e.target.closest('.fechar-modal').getAttribute('data-target')).style.display = 'none'; return; }
    if (e.target.closest('.aluno-list-item')) { abrirPerfil360Aluno(e.target.closest('.aluno-list-item').getAttribute('data-id')); return; }
    if (e.target.closest('#tab-tarefas-prhf')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'block'; document.getElementById('sec-tarefas-passaporte').style.display = 'none'; carregarTarefasProf(); return; }
    if (e.target.closest('#tab-tarefas-passaporte')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'none'; document.getElementById('sec-tarefas-passaporte').style.display = 'block'; carregarTarefasProf(); return; }

    // BLOCOS TURMA E DT
    if (e.target.closest('#btn-ver-pauta')) { renderizarPautaTurma(); return; }
    if (e.target.closest('#btn-ver-faltas-turma')) { renderizarFaltasTurma(); return; }
    if (e.target.closest('#btn-radar-conflitos')) { gerarRadarConflitos(); return; }
    
    // AÇÕES DO COORDENADOR DE CURSO ------------------------------------
    if (e.target.closest('.btn-validar-fct')) {
        const btn = e.target.closest('.btn-validar-fct');
        validarFCT(btn.getAttribute('data-id'), btn);
        return;
    }
    // ------------------------------------------------------------------

    // RESTANTES AÇÕES (Que já desenhamos: Fóruns, Faltas, Notas, PRHFs)
    // O ui.js e a Firebase tratam de alimentar os modais corretos.
    // ...
});
