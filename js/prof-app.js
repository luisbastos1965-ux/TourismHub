import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { state } from "./prof/store.js";
import { carregarRadarProfessor, analisarEAtualizarTurma, carregarTarefasProf, carregarForunsProf, atualizarDropdownModulos } from "./prof/ui.js";

import { carregarEcraOrientandos, carregarEcraDiario, prepararModalNovaSessao } from "./prof/roles/pap-diario.js";
import { carregarEcraProjetosCoord } from "./prof/roles/coord-dashboard.js";
import { validarFCT } from "./prof/roles/coord.js"; 
import { aprovarTemaPAP, rejeitarTemaPAPExecutar, aprovarRelatorioPAP } from "./prof/roles/pap.js";
import { gerarRadarConflitos } from "./prof/roles/dt.js";

// === OS NOSSOS 4 MÓDULOS DE CLIQUES ===
import { gerirCliquesForum } from "./prof/roles/forum.js";
import { gerirCliquesPRHF } from "./prof/roles/prhf.js";
import { gerirCliquesTurmas } from "./prof/roles/turmas.js";
import { gerirCliquesInicio } from "./prof/roles/inicio.js";

function getIniciais(nomeStr) {
    if (!nomeStr) return "PR";
    const parts = nomeStr.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
}

function esconderTodasAsVistas() { 
    document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none'); 
}

// ----------------------------------------------------
// 1. AUTENTICAÇÃO E ARRANQUE
// ----------------------------------------------------
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

                if (state.profData.papel && !state.myRoles.includes(state.profData.papel)) {
                    state.myRoles.push(state.profData.papel);
                }
                
                if (state.myRoles.some(r => ['professor', 'diretor_turma', 'orientador_pap', 'coordenador'].includes(r))) {
                    let baseName = state.profData.nome || state.profData.nomeCompleto || state.profData.Nome || state.myUserId;
                    state.myUserName = baseName.replace(/^(Prof\.|Professor|Professora|Prof)\s+/i, '').trim();
                    
                    document.getElementById('header-user-name-prof').innerText = state.myUserName;
                    
                    const configuracaoPerfis = {
                        'professor': { nome: 'Professor', cor: '#64748b' },
                        'diretor_turma': { nome: 'Diretor de Turma', cor: '#f59e0b' },
                        'coordenador': { nome: 'Coordenador', cor: '#9333ea' },
                        'orientador_pap': { nome: 'Orientador PAP', cor: '#10b981' }
                    };

                    let dropdownHtml = '';
                    state.myRoles.forEach(papel => {
                        if(configuracaoPerfis[papel]) {
                            dropdownHtml += `
                            <button onclick="window.mudarCapaProfessor('${papel}')" style="width: 100%; text-align: left; padding: 12px 15px; background: transparent; border: none; color: white; cursor: pointer; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 10px;">
                                <span style="width: 10px; height: 10px; border-radius: 50%; background-color: ${configuracaoPerfis[papel].cor};"></span> ${configuracaoPerfis[papel].nome}
                            </button>`;
                        }
                    });
                    document.getElementById('lista-capas-dropdown').innerHTML = dropdownHtml;

                    window.mudarCapaProfessor = (novoPapel) => {
                        state.activeRole = novoPapel;
                        const config = configuracaoPerfis[novoPapel];
                        const badge = document.getElementById('badge-perfil-ativo');
                        if(badge) { badge.innerText = config.nome; badge.style.backgroundColor = config.cor; }
                        
                        const navBase = document.querySelectorAll('.nav-role-base');
                        const navPap = document.querySelectorAll('.nav-role-pap');
                        const navCoord = document.querySelectorAll('.nav-role-coord');
                        
                        if (novoPapel === 'orientador_pap') { 
                            navBase.forEach(el => el.style.display = 'none'); navCoord.forEach(el => el.style.display = 'none'); navPap.forEach(el => el.style.display = 'flex'); 
                        } else if (novoPapel === 'coordenador') { 
                            navBase.forEach(el => el.style.display = 'none'); navPap.forEach(el => el.style.display = 'none'); navCoord.forEach(el => el.style.display = 'flex'); 
                        } else { 
                            navPap.forEach(el => el.style.display = 'none'); navCoord.forEach(el => el.style.display = 'none'); navBase.forEach(el => el.style.display = 'flex'); 
                        }

                        document.getElementById('dropdown-perfis').style.display = 'none';
                        document.querySelector('.nav-item[data-target="view-prof-dashboard"]').click();
                    };

                    window.mudarCapaProfessor('professor');
                    
                    document.getElementById('btn-toggle-perfis').addEventListener('click', (e) => { 
                        e.stopPropagation(); 
                        const drop = document.getElementById('dropdown-perfis'); 
                        drop.style.display = drop.style.display === 'none' ? 'block' : 'none'; 
                    });

                    document.getElementById('perfil-nome-prof-view').innerText = state.myUserName;
                    document.getElementById('perfil-disciplinas-lista').innerText = state.disciplinasProfessor.length > 0 ? state.disciplinasProfessor.join(' • ') : 'Nenhuma disciplina configurada.';
                    document.getElementById('perfil-papeis-lista').innerText = state.myRoles.map(r => r.toUpperCase().replace('_', ' ')).join(' • ');
                    
                    const iniciais = getIniciais(state.myUserName);
                    const fotoUrl = state.profData.fotoPerfil || `https://ui-avatars.com/api/?name=${iniciais}&background=333&color=fff&font-size=0.4`;
                    
                    document.getElementById('header-avatar-circle').innerHTML = `<img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    document.getElementById('prof-avatar-img').src = fotoUrl;

                    const sel = document.getElementById('prof-seletor-turmas');
                    if (sel) {
                        if (state.turmasProfessor.length > 0) { sel.innerHTML = '<option value="">-- Selecionar Turma --</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join(''); } 
                        else { sel.innerHTML = '<option value="">Sem turmas atribuídas</option>'; }
                    }

                    carregarRadarProfessor(); 
                } else { window.location.href = "index.html"; }
            } else { window.location.href = "index.html"; }
        } catch (e) { console.error("Erro na inicialização:", e); }
    } else { window.location.href = "index.html"; }
});

// ----------------------------------------------------
// 2. INPUT & CHANGE EVENTS
// ----------------------------------------------------
document.body.addEventListener('input', (e) => {
    if (e.target.id === 'prhf-horas-totais') {
        const val = parseInt(e.target.value) || 0;
        const presInput = document.getElementById('prhf-horas-presenciais');
        if(presInput) presInput.value = val <= 4 ? 0 : Math.ceil(val * 0.3);
    }
});

document.body.addEventListener('change', async (e) => {
    if (e.target.id === 'filtro-workflow-prhf') { carregarTarefasProf(); return; }

    if (e.target.classList.contains('forum-aluno-check') || e.target.classList.contains('edit-forum-aluno-check') || e.target.classList.contains('prhf-aluno-check')) {
        const chk = e.target; 
        const lbl = chk.closest('label');
        if (lbl) {
            if (chk.checked) { 
                if (chk.classList.contains('prhf-aluno-check')) { lbl.style.background = 'rgba(239, 68, 68, 0.15)'; lbl.style.borderColor = 'var(--danger-red)'; } 
                else { lbl.style.background = 'rgba(0, 204, 136, 0.15)'; lbl.style.borderColor = 'var(--primary-green)'; }
            } else { lbl.style.background = 'rgba(0,0,0,0.2)'; lbl.style.borderColor = '#333'; }
        }
    }

    if (e.target.id === 'prhf-disciplina') {
        const t = document.getElementById('prhf-turma').value;
        if (t) atualizarDropdownModulos(t, e.target.value, document.getElementById('prhf-modulo'));
    }
});

// ----------------------------------------------------
// 3. MOTOR CENTRAL DE CLIQUES
// ----------------------------------------------------
document.body.addEventListener('click', async (e) => {
    
    // a) Navegação de Menus Principal
    const nav = e.target.closest('.nav-item');
    if (nav) {
        e.preventDefault(); 
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        esconderTodasAsVistas();
        
        const tId = nav.getAttribute('data-target');
        const targetView = document.getElementById(tId);
        if (targetView) targetView.style.display = (tId === 'view-prof-forum') ? 'flex' : 'block';
        
        if (tId === 'view-prof-dashboard') carregarRadarProfessor();
        if (tId === 'view-prof-turmas' && state.selectedTurma) analisarEAtualizarTurma(state.selectedTurma);
        if (tId === 'view-prof-tarefas') carregarTarefasProf();
        if (tId === 'view-prof-orientandos') carregarEcraOrientandos();
        if (tId === 'view-prof-diario') carregarEcraDiario();
        if (tId === 'view-coord-projetos') carregarEcraProjetosCoord();
        if (tId === 'view-prof-forum') {
            if (state.chatUnsubscribe) { state.chatUnsubscribe(); state.chatUnsubscribe = null; }
            if (state.chatMetaUnsubscribe) { state.chatMetaUnsubscribe(); state.chatMetaUnsubscribe = null; }
            document.getElementById('prof-forum-chat-view').style.display = 'none';
            document.getElementById('btn-create-chat-prof').style.display = 'block';
            document.getElementById('prof-forum-channel-list').style.display = 'block';
            carregarForunsProf();
        }
        return; 
    }

    // b) Fechar Modais / Dropdowns
    if (!e.target.closest('#header-prof') && !e.target.closest('#modal-fab-menu') && !e.target.closest('#btn-fab-global')) { 
        const drop = document.getElementById('dropdown-perfis'); if(drop) drop.style.display = 'none'; 
        const fab = document.getElementById('modal-fab-menu'); if(fab) fab.style.display = 'none';
    }
    
    if (e.target.closest('#btn-logout-dropdown')) { signOut(auth); return; }
    
    if (e.target.closest('.fechar-modal')) { 
        const targetId = e.target.closest('.fechar-modal').getAttribute('data-target');
        const modal = document.getElementById(targetId);
        if (modal) modal.style.display = 'none'; 
        return; 
    }

    // c) DELEGAÇÃO PARA OS 4 MÓDULOS DE AÇÃO
    if (await gerirCliquesForum(e)) return;
    if (await gerirCliquesPRHF(e)) return;
    if (await gerirCliquesTurmas(e)) return;
    if (await gerirCliquesInicio(e)) return;

    // d) BOTÕES QUE SOBRARAM (Coordenação e PAP)
    if (e.target.closest('#tab-coord-fct')) { document.getElementById('tab-coord-fct').classList.add('active'); document.getElementById('tab-coord-pap').classList.remove('active'); import('./prof/roles/coord-dashboard.js').then(module => { module.coordTabAtiva = 'fct'; module.carregarEcraProjetosCoord(); }); return; }
    if (e.target.closest('#tab-coord-pap')) { document.getElementById('tab-coord-pap').classList.add('active'); document.getElementById('tab-coord-fct').classList.remove('active'); import('./prof/roles/coord-dashboard.js').then(module => { module.coordTabAtiva = 'pap'; module.carregarEcraProjetosCoord(); }); return; }
    if (e.target.closest('#tab-tarefas-prhf')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'block'; document.getElementById('sec-tarefas-passaporte').style.display = 'none'; carregarTarefasProf(); return; }
    if (e.target.closest('#tab-tarefas-passaporte')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'none'; document.getElementById('sec-tarefas-passaporte').style.display = 'block'; carregarTarefasProf(); return; }
    if (e.target.closest('#btn-nova-sessao-pap')) { prepararModalNovaSessao(); return; }
    if (e.target.closest('#btn-radar-conflitos')) { gerarRadarConflitos(); return; }
    if (e.target.closest('.btn-validar-fct')) { validarFCT(e.target.closest('.btn-validar-fct').getAttribute('data-id'), e.target.closest('.btn-validar-fct')); return; }
    if (e.target.closest('.btn-aprovar-tema')) { aprovarTemaPAP(e.target.closest('.btn-aprovar-tema').getAttribute('data-id'), e.target.closest('.btn-aprovar-tema')); return; }
    if (e.target.closest('.btn-rejeitar-tema')) { document.getElementById('rej-pap-aluno-id').value = e.target.closest('.btn-rejeitar-tema').getAttribute('data-id'); document.getElementById('rej-pap-motivo').value = ''; document.getElementById('modal-rejeitar-tema-pap').style.display = 'flex'; return; }
    if (e.target.closest('#btn-confirmar-rejeicao-pap')) { const motivo = document.getElementById('rej-pap-motivo').value.trim(); if(!motivo) return alert("Indica o motivo."); rejeitarTemaPAPExecutar(document.getElementById('rej-pap-aluno-id').value, motivo, e.target.closest('#btn-confirmar-rejeicao-pap')); return; }
    if (e.target.closest('.btn-aprovar-relatorio')) { aprovarRelatorioPAP(e.target.closest('.btn-aprovar-relatorio').getAttribute('data-id'), e.target.closest('.btn-aprovar-relatorio')); return; }
});
