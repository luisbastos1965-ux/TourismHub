import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { state, getDisciplinasPermitidas, nomeCurto } from "./prof/store.js";
import { carregarRadarProfessor, analisarEAtualizarTurma, carregarTarefasProf, carregarForunsProf, atualizarDropdownModulos, renderizarPautaTurma, renderizarFaltasTurma, abrirPerfil360Aluno } from "./prof/ui.js";

window.abrirPerfil360Aluno = abrirPerfil360Aluno;

import { carregarEcraOrientandos, carregarEcraDiario, prepararModalNovaSessao } from "./prof/roles/pap-diario.js";
import { carregarEcraProjetosCoord } from "./prof/roles/coord-dashboard.js";
import { validarFCT } from "./prof/roles/coord.js"; 
import { aprovarTemaPAP, rejeitarTemaPAPExecutar, aprovarRelatorioPAP } from "./prof/roles/pap.js";
import { gerarRadarConflitos } from "./prof/roles/dt.js";

// OS NOSSOS 4 MÓDULOS 
import { gerirCliquesForum } from "./prof/roles/forum.js";
import { gerirCliquesPRHF } from "./prof/roles/prhf.js";
import { gerirCliquesTurmas } from "./prof/roles/turmas.js";
import { gerirCliquesInicio } from "./prof/roles/inicio.js";

window.abrirPerfil360Aluno = abrirPerfil360Aluno;

window.analisarEAtualizarTurma = analisarEAtualizarTurma;

window.abrirAcaoRapida = async function(acaoId) {
    // 1. Fecha o menu verde do Raio
    document.getElementById('modal-fab-menu').style.display = 'none';

    if (state.selectedTurma) {
        // Se a app já tem uma turma memorizada, garante que os dados estão carregados e abre o modal.
        if (!state.alunosTurmaRAM || state.alunosTurmaRAM.length === 0) {
            await window.analisarEAtualizarTurma(state.selectedTurma);
        }
        document.getElementById(acaoId).click();
    } else {
        // Se abriste a App AGORA e não tens turma escolhida, surge a magia:
        let m = document.createElement('div');
        m.id = 'modal-quick-turma';
        m.className = 'modal-overlay';
        m.style.zIndex = '9999';
        m.style.display = 'flex';
        
        let botoesTurma = state.turmasProfessor.map(t => 
            `<button class="primary-btn" style="margin-bottom:10px; width:100%;" onclick="window.processarAcaoRapida('${t}', '${acaoId}')">Turma ${t}</button>`
        ).join('');

        m.innerHTML = `
        <div class="action-sheet" style="max-width: 300px; padding: 20px; text-align:center;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h3 style="color: white; margin:0;"><i class="fa-solid fa-users"></i> Qual a Turma?</h3>
                <button onclick="document.getElementById('modal-quick-turma').remove();" style="background:none; border:none; color:white; font-size:1.3rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            ${botoesTurma}
        </div>`;
        document.body.appendChild(m);
    }
};

// GRAVAR UMA NOVA ATIVIDADE NA FIREBASE
window.registarAtividadeProfessor = async function(tipo, descricao, subtexto) {
    if (!state.myUserId) return;
    try {
        await addDoc(collection(db, "utilizadores", state.myUserId, "atividades"), {
            tipo: tipo, // 'falta', 'nota', 'sintese', 'ocorrencia'
            descricao: descricao,
            subtexto: subtexto,
            data: new Date().toISOString()
        });
        // Tenta atualizar a lista no ecrã imediatamente
        if (document.getElementById('dashboard-atividade-container')) {
            window.carregarAtividadeRecente();
        }
    } catch(e) { console.error("Erro ao registar atividade:", e); }
};

// LER E MOSTRAR A ATIVIDADE NO DASHBOARD
window.carregarAtividadeRecente = async function() {
    const container = document.getElementById('dashboard-atividade-container');
    if (!container || !state.myUserId) return;
    
    try {
        const q = query(
            collection(db, "utilizadores", state.myUserId, "atividades"),
            orderBy("data", "desc"),
            limit(4) // Quantas queres mostrar no máximo
        );
        const snaps = await getDocs(q);
        
        if (snaps.empty) {
            container.innerHTML = '<p class="text-muted center" style="font-size:0.85rem;">Ainda não tens atividade recente registada.</p>';
            return;
        }
        
        let html = '';
        snaps.forEach(doc => {
            const ativ = doc.data();
            
            // Lógica de cores baseada no tipo de ação
            let icon = 'fa-check'; let color = '#10b981'; let bg = 'rgba(16, 185, 129, 0.15)';
            if(ativ.tipo === 'falta') { icon = 'fa-user-xmark'; color = 'var(--danger-red)'; bg = 'rgba(239, 68, 68, 0.15)'; }
            if(ativ.tipo === 'nota') { icon = 'fa-star'; color = 'var(--warning-yellow)'; bg = 'rgba(245, 158, 11, 0.15)'; }
            if(ativ.tipo === 'sintese') { icon = 'fa-clipboard'; color = '#3b82f6'; bg = 'rgba(59, 130, 246, 0.15)'; }
            if(ativ.tipo === 'ocorrencia') { icon = 'fa-triangle-exclamation'; color = 'var(--danger-red)'; bg = 'rgba(239, 68, 68, 0.15)'; }
            
            const d = new Date(ativ.data);
            const hora = d.toLocaleTimeString('pt-PT', {hour: '2-digit', minute:'2-digit'});
            const dia = d.toLocaleDateString('pt-PT', {day:'2-digit', month:'2-digit'});
            
            html += `
            <div style="display:flex; gap:12px; align-items:flex-start; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="background:${bg}; color:${color}; width:32px; height:32px; border-radius:50%; display:flex; justify-content:center; align-items:center; flex-shrink:0; font-size:0.8rem;"><i class="fa-solid ${icon}"></i></div>
                <div>
                    <p style="margin:0; font-size:0.9rem; color:white;">${ativ.descricao}</p>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${dia} às ${hora} - ${ativ.subtexto}</span>
                </div>
            </div>`;
        });
        container.innerHTML = html;
        
    } catch(e) {
        console.error("ERRO FIREBASE ATIVIDADE:", e); // Isto vai dizer-nos o erro exato no F12
        container.innerHTML = `<p class="text-muted center" style="font-size:0.85rem; color:var(--danger-red);">Erro: ${e.message}</p>`;
    }
};
window.processarAcaoRapida = async function(turma, acaoId) {
    let loading = null;
    try {
        const modalQuick = document.getElementById('modal-quick-turma');
        if (modalQuick) modalQuick.remove();
        
        // Ecrã de Loading hiper rápido para a App fazer o trabalho sujo
        loading = document.createElement('div');
        loading.className = 'modal-overlay';
        loading.style.zIndex = '9999';
        loading.style.display = 'flex';
        loading.innerHTML = '<div style="background:rgba(0,0,0,0.8); padding:20px; border-radius:8px; color:white; text-align:center;"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem; margin-bottom:10px;"></i><br>A preparar dados...</div>';
        document.body.appendChild(loading);

        // Guarda a turma no sistema de forma global!
        state.selectedTurma = turma;
        const seletorGlobal = document.getElementById('prof-seletor-turmas');
        if (seletorGlobal) seletorGlobal.value = turma;
        
        // Puxa os dados dos alunos
        await window.analisarEAtualizarTurma(turma);
        
        if (loading) loading.remove();
        
        // Finge que o utilizador clicou no botão original e abre o modal certo!
        const btn = document.getElementById(acaoId);
        if (btn) btn.click();
        
        // Bónus de usabilidade: Se escolheste PRHF, preenche o dropdown lá dentro sozinho!
        setTimeout(() => {
            if (acaoId === 'btn-novo-prhf') {
                const prhfTurma = document.getElementById('prhf-turma');
                if(prhfTurma) { 
                    prhfTurma.value = turma;
                    prhfTurma.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }, 100);
    } catch (err) {
        console.error("Erro em processarAcaoRapida:", err);
        if (loading) loading.remove();
    }
};
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

                    const selTurmaCurso = document.getElementById('filtro-curso-turma');
                    if (selTurmaCurso && state.turmasProfessor.length > 0) {
                        selTurmaCurso.innerHTML = '<option value="">Todas as Turmas</option>' + state.turmasProfessor.map(t => `<option value="${t}">${t}</option>`).join('');
                    }

                    carregarRadarProfessor(); 
                } else {
                    window.location.href = "index.html";
                }
            } else {
                window.location.href = "index.html";
            }
        } catch (e) {
            console.error("Erro na inicialização:", e);
        }
    } else {
        window.location.href = "index.html";
    }
});

// ----------------------------------------------------
// 2. EVENTOS DE MUDANÇA (CHANGE) UNIFICADOS
// ----------------------------------------------------
document.body.addEventListener('change', async (e) => {
    // --- MUDANÇA DE TURMA NO MENU PRINCIPAL ---
    if (e.target.id === 'prof-seletor-turmas') {
        const turmaSelecionada = e.target.value;
        if (!turmaSelecionada) {
            document.getElementById('lista-alunos-turma').innerHTML = '<p class="text-muted center" style="padding: 20px;">Por favor, seleciona uma turma acima.</p>';
            document.getElementById('assistente-aula-texto').innerHTML = 'A aguardar seleção...';
            state.selectedTurma = null;
            return;
        }
        state.selectedTurma = turmaSelecionada;
        analisarEAtualizarTurma(turmaSelecionada);
        return;
    }

    // --- MUDANÇA DO MOMENTO DA SÍNTESE DO ALUNO ---
    if (e.target.id === 'sintese-momento') {
        const momento = e.target.value;
        const alunoId = document.getElementById('perfil-aluno-id-hidden').value;
        const turma = state.selectedTurma;
        const displayBox = document.getElementById('p-aluno-obs-dt-display');
        
        displayBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A ler caderneta do DT...';
        
        try {
            const snap = await getDoc(doc(db, "turmas", turma, "sinteses", `${alunoId}_${momento}`));
            if (snap.exists() && snap.data().texto) {
                displayBox.innerText = snap.data().texto;
            } else {
                displayBox.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Sem síntese registada para este momento.</span>';
            }
        } catch(err) {
            displayBox.innerText = "Erro ao carregar síntese.";
        }
        return;
    }

    // --- MOSTRAR/ESCONDER CAMPO DE HORA EXATA NA AGENDA ---
    if (e.target.id === 'evento-periodo') {
        const inputHora = document.getElementById('evento-hora');
        if (inputHora) {
            inputHora.style.display = e.target.value === 'hora' ? 'block' : 'none';
        }
        return;
    }

    // --- MUDANÇA DE DISCIPLINA NOS MODAIS DE FALTAS E NOTAS ---
    if (e.target.id === 'lancar-falta-disciplina' || e.target.id === 'lancar-nota-disciplina') {
        const turma = state.selectedTurma;
        if (turma) {
            const targetSelectId = e.target.id === 'lancar-falta-disciplina' ? 'falta-modulo-select' : 'lancar-nota-modulo';
            atualizarDropdownModulos(turma, e.target.value, document.getElementById(targetSelectId));
        }
        return;
    }

    // --- MUDANÇA DE SALA NA PLANTA DA SALA ---
    if (e.target.id === 'select-sala-aula') {
        window.renderizarPlantaSala(e.target.value, disposicaoAtualAlunos);
        return;
    }

    // --- MOSTRAR INPUT DO TEMPLATE PRHF ---
    if (e.target.id === 'prhf-save-template') {
        const inputNome = document.getElementById('prhf-nome-template');
        inputNome.style.display = e.target.checked ? 'block' : 'none';
        if(e.target.checked) inputNome.focus();
    }

    // --- CHECKBOXES GERAIS (ESTILO) ---
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

    if (e.target.id === 'filtro-workflow-prhf' || e.target.classList.contains('filtro-prhf-curso')) { 
        carregarTarefasProf(); 
        return; 
    }

    if (e.target.id === 'prhf-disciplina') {
        const t = document.getElementById('prhf-turma').value;
        if (t) atualizarDropdownModulos(t, e.target.value, document.getElementById('prhf-modulo'));
    }

    if (e.target.id === 'prhf-turma') {
        const t = e.target.value;
        const cCont = document.getElementById('prhf-alunos-bulk-container');
        const discSelect = document.getElementById('prhf-disciplina');
        if (!t) {
            if(cCont) cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; margin:0;">Selecione primeiro a Turma</p>';
            return;
        }
        if(cCont) cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; margin:0;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>';
        try {
            if (discSelect && discSelect.value) atualizarDropdownModulos(t, discSelect.value, document.getElementById('prhf-modulo'));
            const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
            let arr = []; cS.forEach(d => arr.push({id: d.id, ...d.data()}));
            arr.sort((a,b) => a.nome.localeCompare(b.nome)); 
            let cH = `
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <button id="btn-prhf-select-all" class="secondary-btn small-btn" style="flex:1; border-color:var(--danger-red); color:var(--danger-red); padding:4px;">Selecionar Todos</button>
                <button id="btn-prhf-deselect-all" class="secondary-btn small-btn" style="flex:1; border-color:var(--text-muted); color:white; padding:4px;">Nenhum</button>
            </div>`;
            arr.forEach(d => {
                cH += `
                <label style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; margin-bottom:5px; cursor:pointer; transition: 0.2s;">
                    <span style="color:white; font-size:0.85rem;">${nomeCurto(d.nome)}</span>
                    <input type="checkbox" class="prhf-aluno-check" value="${d.id}" style="width:16px; height:16px; accent-color:var(--danger-red); margin:0;">
                </label>`;
            });
            if(cCont) cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH;
        } catch(err) { if(cCont) cCont.innerHTML = '<p class="text-danger center" style="font-size:0.8rem;">Erro ao carregar alunos.</p>'; }
    }

    if (e.target.id === 'forum-turma-select') {
        const t = e.target.value; 
        const cCont = document.getElementById('lista-alunos-forum'); 
        const bulkBtns = document.getElementById('forum-bulk-actions');
        if (!t) { 
            if(cCont) cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; grid-column: span 2;">Seleciona turma primeiro.</p>'; 
            if(bulkBtns) bulkBtns.style.display = 'none'; 
            return; 
        } 
        if(bulkBtns) bulkBtns.style.display = 'flex';
        if(cCont) cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; grid-column: span 2;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>'; 
        try { 
            const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); 
            let arr = []; cS.forEach(d => arr.push({id: d.id, ...d.data()}));
            arr.sort((a,b) => a.nome.localeCompare(b.nome)); 
            let cH = ''; 
            arr.forEach(d => { 
                cH += `
                <label class="forum-member-card" style="display:flex; justify-content:center; align-items:center; background:rgba(0, 204, 136, 0.15); border:1px solid var(--primary-green); padding:10px; border-radius:8px; cursor:pointer; transition:all 0.2s; text-align:center; height: 100%;">
                    <span style="color:white; font-size:0.9rem; font-weight:500; text-align:center;">${nomeCurto(d.nome)}</span>
                    <input type="checkbox" class="forum-aluno-check" value="${d.id}" checked style="display:none;">
                </label>`; 
            }); 
            if(cCont) cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem; grid-column: span 2;">Turma vazia.</p>' : cH; 
        } catch(err) { if(cCont) cCont.innerHTML = '<p class="text-danger center" style="grid-column: span 2;">Erro.</p>'; } 
    }
});

// ----------------------------------------------------
// 3. MOTOR CENTRAL DE CLIQUES
// ----------------------------------------------------
document.body.addEventListener('click', async (e) => {
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

// CLIQUE NO BOTÃO "IR PARA GESTÃO PRHF" DO DASHBOARD
    if (e.target.closest('#btn-dashboard-ir-prhf')) {
        // Encontra o botão do menu inferior correspondente à aba dos PRHFs e clica nele
        const tabPrhf = document.querySelector('.nav-item[data-target="view-prof-tarefas"]');
        if (tabPrhf) tabPrhf.click();
        return;
    }

    if (await gerirCliquesForum(e)) return;
    if (await gerirCliquesPRHF(e)) return;
    if (await gerirCliquesTurmas(e)) return;
    if (await gerirCliquesInicio(e)) return;

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

    // --- BOTÕES DA VISTA TURMAS ---
    if (e.target.closest('#btn-ver-pauta')) {
        renderizarPautaTurma();
        return;
    }
    if (e.target.closest('#btn-ver-faltas-turma')) {
        renderizarFaltasTurma();
        return;
    }

    // ABRIR PERFIL DO ALUNO (LISTA DE TURMAS)
    if (e.target.closest('.aluno-list-item')) {
        const card = e.target.closest('.aluno-list-item');
        const alunoId = card.getAttribute('data-id');
        if (alunoId) {
            abrirPerfil360Aluno(alunoId);
        }
        return;
    }

    // ABRIR MODAL DE MARCAR FALTAS
    if (e.target.closest('#btn-modal-faltas')) {
        const turma = state.selectedTurma;
        if (!turma) {
            alert("Seleciona primeiro uma turma no menu superior.");
            return;
        }

        const turmaSelect = document.getElementById('lancar-falta-turma');
        if (turmaSelect) turmaSelect.innerHTML = `<option value="${turma}">Turma ${turma}</option>`;

        const discSelect = document.getElementById('lancar-falta-disciplina');
        if (discSelect && state.disciplinasProfessor) {
            discSelect.innerHTML = state.disciplinasProfessor.map(d => `<option value="${d}">${d}</option>`).join('');
            discSelect.style.display = 'block';
            
            if (state.disciplinasProfessor.length > 0) {
                atualizarDropdownModulos(turma, state.disciplinasProfessor[0], document.getElementById('falta-modulo-select'));
            }
        }

        const dataInput = document.getElementById('falta-data-input');
        if (dataInput) {
            const hoje = new Date().toISOString().split('T')[0];
            dataInput.value = hoje;
        }

        const cCont = document.getElementById('lista-metralhadora-faltas');
        if (cCont) {
            cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>';
            
            try {
                const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno")));
                let arr = []; 
                cS.forEach(d => arr.push({id: d.id, ...d.data()}));
                arr.sort((a,b) => a.nome.localeCompare(b.nome)); 
                
                let cH = '';
                arr.forEach(d => {
                    cH += `
                    <label style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; cursor:pointer; transition: 0.2s;">
                        <span style="color:white; font-size:0.85rem;">${nomeCurto(d.nome)}</span>
                        <input type="checkbox" class="falta-aluno-check" value="${d.id}" style="width:18px; height:18px; accent-color:var(--danger-red); margin:0;">
                    </label>`;
                });
                cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH;
            } catch (err) {
                console.error("Erro ao carregar alunos:", err);
                cCont.innerHTML = '<p class="text-danger center" style="font-size:0.8rem;">Erro ao carregar alunos.</p>';
            }
        }

        const modal = document.getElementById('modal-marcar-faltas');
        if(modal) modal.style.display = 'flex';
        return;
    }

    // ABRIR MODAL DE NOTAS COM BOTÃO DE ATRIBUIR E ESCOLHER NOTA
    if (e.target.closest('#btn-modal-notas')) {
        const turma = state.selectedTurma;
        if (!turma) { alert("Seleciona primeiro uma turma."); return; }

        const discSelect = document.getElementById('lancar-nota-disciplina');
        if (discSelect && state.disciplinasProfessor) {
            discSelect.innerHTML = state.disciplinasProfessor.map(d => `<option value="${d}">${d}</option>`).join('');
            if (state.disciplinasProfessor.length > 0) {
                atualizarDropdownModulos(turma, state.disciplinasProfessor[0], document.getElementById('lancar-nota-modulo'));
            }
        }
        
        const grid = document.getElementById('grid-notas-alunos');
        if (grid) {
            grid.innerHTML = '<p class="text-muted center" style="padding:15px; font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>';
            
            try {
                const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno")));
                let arr = []; 
                cS.forEach(d => arr.push({id: d.id, ...d.data()}));
                arr.sort((a,b) => a.nome.localeCompare(b.nome)); 
                
                let cH = '';
                arr.forEach(d => {
                    cH += `
                    <div class="aluno-nota-row" data-id="${d.id}" style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px;">
                        <span style="color:white; font-size:0.85rem; flex: 1;">${nomeCurto(d.nome)}</span>
                        <button class="btn-abrir-escolha-nota secondary-btn small-btn" data-id="${d.id}" data-nome="${nomeCurto(d.nome)}" style="width: 80px; font-weight: bold; color: var(--primary-green);">Atribuir</button>
                        <input type="hidden" class="input-nota-aluno-hidden" value="">
                        <input type="hidden" class="input-motivo-aluno-hidden" value="">
                    </div>`;
                });
                grid.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH;
            } catch(err) {
                console.error("Erro ao carregar:", err);
                grid.innerHTML = '<p class="text-danger center" style="font-size:0.8rem;">Erro ao carregar alunos.</p>';
            }
        }
        
        const modal = document.getElementById('modal-lancamento-notas');
        if(modal) modal.style.display = 'flex';
        return;
    }

    // CLIQUE NO BOTÃO "ATRIBUIR" NA GRELHA PARA ABRIR O MINI-MODAL
    if (e.target.closest('.btn-abrir-escolha-nota')) {
        const row = e.target.closest('.aluno-nota-row');
        window.carregarAlunoNoMiniModal(row);
        const modal = document.getElementById('modal-escolher-nota');
        if(modal) modal.style.display = 'flex';
        return;
    }

    // NAVEGAÇÃO MANUAL NO MINI-MODAL (Setas < e >)
    if (e.target.closest('#btn-nota-anterior') || e.target.closest('#btn-nota-seguinte')) {
        const isNext = e.target.closest('#btn-nota-seguinte') !== null;
        const atualId = document.getElementById('aluno-id-nota-atual').value;
        const linhas = Array.from(document.querySelectorAll('.aluno-nota-row'));
        const indexAtual = linhas.findIndex(r => r.getAttribute('data-id') === atualId);
        
        if (indexAtual !== -1) {
            const novoIndex = isNext ? indexAtual + 1 : indexAtual - 1;
            if (novoIndex >= 0 && novoIndex < linhas.length) {
                window.carregarAlunoNoMiniModal(linhas[novoIndex]);
            }
        }
        return;
    }

    // SELEÇÃO DE UMA NOTA NO MINI-MODAL (10 a 20 ou REP)
    if (e.target.closest('.btn-nota-opcao')) {
        const btn = e.target.closest('.btn-nota-opcao');
        document.querySelectorAll('.btn-nota-opcao').forEach(b => {
            b.classList.remove('active-nota');
            b.style.boxShadow = 'none';
            b.style.background = '';
        });
        
        btn.classList.add('active-nota');
        btn.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.2)';
        btn.style.background = 'rgba(255,255,255,0.1)';
        
        const val = btn.getAttribute('data-val');
        const repContainer = document.getElementById('container-justificacao-rep');
        if (repContainer) {
            repContainer.style.display = (val === 'REP') ? 'block' : 'none';
        }
        return;
    }

    // CONFIRMAR A NOTA E SALTAR PARA O PRÓXIMO ALUNO
    if (e.target.closest('#btn-confirmar-nota-modal')) {
        const btnActive = document.querySelector('.btn-nota-opcao.active-nota');
        if (!btnActive) {
            alert("Por favor, clica numa nota primeiro (10 a 20 ou REP).");
            return;
        }
        
        const val = btnActive.getAttribute('data-val');
        const motivoSelect = document.getElementById('motivo-rep-select');
        const motivo = (val === 'REP' && motivoSelect) ? motivoSelect.value : "";
        
        const alunoId = document.getElementById('aluno-id-nota-atual').value;
        const linhas = Array.from(document.querySelectorAll('.aluno-nota-row'));
        const indexAtual = linhas.findIndex(r => r.getAttribute('data-id') === alunoId);
        
        if (indexAtual !== -1) {
            const row = linhas[indexAtual];
            const btnAtribuir = row.querySelector('.btn-abrir-escolha-nota');
            const hiddenNota = row.querySelector('.input-nota-aluno-hidden');
            const hiddenMotivo = row.querySelector('.input-motivo-aluno-hidden');
            
            if(hiddenNota) hiddenNota.value = val;
            if(hiddenMotivo) hiddenMotivo.value = motivo;
            
            if (val === 'REP') {
                btnAtribuir.innerText = `REP`;
                btnAtribuir.style.color = 'var(--danger-red)';
                btnAtribuir.style.borderColor = 'var(--danger-red)';
                btnAtribuir.style.background = 'transparent';
            } else {
                btnAtribuir.innerText = val;
                btnAtribuir.style.color = '#fff';
                btnAtribuir.style.background = 'var(--primary-green)';
                btnAtribuir.style.borderColor = 'var(--primary-green)';
            }
            
            // Salta automaticamente para o próximo aluno
            if (indexAtual + 1 < linhas.length) {
                window.carregarAlunoNoMiniModal(linhas[indexAtual + 1]);
            } else {
                const modal = document.getElementById('modal-escolher-nota');
                if(modal) modal.style.display = 'none';
            }
        }
        return;
    }

    // GRAVAR NOTAS NA BASE DE DADOS
    if (e.target.closest('#btn-gravar-notas-turma')) {
        const btn = e.target.closest('#btn-gravar-notas-turma');
        const turma = state.selectedTurma;
        const disciplina = document.getElementById('lancar-nota-disciplina').value;
        const modulo = document.getElementById('lancar-nota-modulo').value;
        
        if (!modulo) {
            alert("Por favor, aguarda ou seleciona um módulo válido.");
            return;
        }

        const linhas = document.querySelectorAll('.aluno-nota-row');
        const notasParaGravar = [];

        linhas.forEach(row => {
            const alunoId = row.getAttribute('data-id');
            const notaVal = row.querySelector('.input-nota-aluno-hidden').value;
            const motivoVal = row.querySelector('.input-motivo-aluno-hidden').value;
            
            if (notaVal !== "") {
                notasParaGravar.push({
                    alunoId: alunoId,
                    nota: notaVal, // Pode ser '10' a '20' ou 'REP'
                    motivo: motivoVal
                });
            }
        });

        if (notasParaGravar.length === 0) {
            alert("Não atribuíste nenhuma nota.");
            return;
        }

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
        btn.disabled = true;

        try {
            const gravacoes = notasParaGravar.map(n => 
                setDoc(doc(db, "utilizadores", n.alunoId, "avaliacoes", `${disciplina}_${modulo}`), {
                    turma: turma,
                    disciplina: disciplina,
                    modulo: modulo,
                    nota: n.nota,
                    motivoREP: n.motivo || null, 
                    dataLancamento: new Date().toISOString(),
                    professor: state.myUserName
                }, { merge: true })
            );
            
            await Promise.all(gravacoes);
            
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Avaliações Gravadas!';
            setTimeout(() => { 
                btn.innerHTML = txtOriginal; 
                btn.disabled = false; 
                document.getElementById('modal-lancamento-notas').style.display = 'none';
            }, 2000);
            
        } catch(err) {
            console.error(err);
            btn.innerHTML = 'Erro ao gravar!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ABRIR MODAL DOS MATERIAIS / SUMÁRIOS
    if (e.target.closest('#btn-modal-materiais')) {
        const turma = state.selectedTurma;
        if (!turma) {
            alert("Seleciona primeiro uma turma.");
            return;
        }

        const discSelect = document.getElementById('mat-disciplina');
        if (discSelect && state.disciplinasProfessor) {
            discSelect.innerHTML = state.disciplinasProfessor.map(d => `<option value="${d}">${d}</option>`).join('');
        }
        const turmaSelect = document.getElementById('lancar-sumario-turma');
        if (turmaSelect) {
            turmaSelect.innerHTML = `<option value="${turma}">${turma}</option>`;
        }
        const modal = document.getElementById('modal-materiais');
        if(modal) modal.style.display = 'flex';
        return;
    }

    // A MÁGICA DA IA A ESCREVER O SUMÁRIO POR EXTENSO
    if (e.target.closest('#btn-ia-formatar-sumario')) {
        e.preventDefault(); 
        const btnIA = e.target.closest('#btn-ia-formatar-sumario');
        const textArea = document.getElementById('mat-sumario');
        let textoRaw = textArea.value.trim();

        if (!textoRaw) {
            alert("Escreve alguns tópicos soltos primeiro para a IA ter matéria-prima!");
            return;
        }

        const iconOriginal = btnIA.innerHTML;
        btnIA.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnIA.disabled = true;

        setTimeout(() => {
            // 1. Extrair os tópicos isolados (por vírgula, ponto ou nova linha)
            let items = textoRaw.split(/[\n,.]+/).map(t => t.trim()).filter(t => t.length > 0);
            
            // 2. Colocar a primeira letra minúscula para a frase encaixar perfeitamente
            items = items.map(t => t.charAt(0).toLowerCase() + t.slice(1));
            
            let resultadoFinal = "";

            // 3. Montar o texto corrido de forma fluida consoante o número de tópicos
            if (items.length === 1) {
                resultadoFinal = `Nesta sessão, procedeu-se à exploração e desenvolvimento de ${items[0]}. Os conteúdos foram lecionados de forma a consolidar as aprendizagens, tendo os alunos demonstrado empenho na execução das tarefas.`;
            } else if (items.length === 2) {
                resultadoFinal = `A aula de hoje centrou-se inicialmente na análise de ${items[0]}, com posterior transição e abordagem a ${items[1]}. O envolvimento e a postura da turma foram genericamente positivos ao longo da sessão.`;
            } else {
                const ultimo = items.pop();
                const primeiro = items.shift();
                resultadoFinal = `A sessão letiva teve início com a exploração de ${primeiro}. Posteriormente, procedeu-se ao desenvolvimento dos seguintes conteúdos práticos e teóricos: ${items.join(", ")}, culminando com ${ultimo}. A turma mostrou-se globalmente atenta e participativa.`;
            }

            // 4. Afinar ligações da língua portuguesa (corrigir "de o" para "do", etc.)
            resultadoFinal = resultadoFinal.replace(/ de o /g, " do ").replace(/ de a /g, " da ").replace(/ de os /g, " dos ").replace(/ de as /g, " das ");
            
            // Capitalizar sempre a primeira letra
            resultadoFinal = resultadoFinal.charAt(0).toUpperCase() + resultadoFinal.slice(1);

            textArea.value = resultadoFinal;
            
            btnIA.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i>';
            setTimeout(() => {
                btnIA.innerHTML = iconOriginal;
                btnIA.disabled = false;
            }, 2000);
        }, 1500);
        return;
    }

    // GRAVAR O SUMÁRIO NA BASE DE DADOS
    if (e.target.closest('#btn-gravar-material')) {
        const btn = e.target.closest('#btn-gravar-material');
        const turma = state.selectedTurma || document.getElementById('lancar-sumario-turma').value;
        const disciplina = document.getElementById('mat-disciplina').value;
        const titulo = document.getElementById('mat-titulo').value.trim();
        const sumario = document.getElementById('mat-sumario').value.trim();

        if (!turma) { alert("Seleciona a turma primeiro."); return; }
        if (!titulo || !sumario) { alert("O título e o sumário são obrigatórios."); return; }

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A registar...';
        btn.disabled = true;

        try {
            await addDoc(collection(db, "turmas", turma, "sumarios"), {
                disciplina: disciplina,
                titulo: titulo,
                texto: sumario,
                dataLancamento: new Date().toISOString(),
                professor: state.myUserName,
                temAnexo: document.getElementById('mat-file').files.length > 0 
            });

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Aula Registada!';
            
            document.getElementById('mat-titulo').value = '';
            document.getElementById('mat-sumario').value = '';
            document.getElementById('mat-file').value = '';
            
            setTimeout(() => {
                btn.innerHTML = txtOriginal;
                btn.disabled = false;
                document.getElementById('modal-materiais').style.display = 'none';
            }, 1500);

        } catch (err) {
            console.error(err);
            btn.innerHTML = 'Erro ao gravar!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ABRIR MODAL AGENDA
    if (e.target.closest('#btn-modal-agenda')) {
        const discSelect = document.getElementById('agendar-disciplina');
        if (discSelect && state.disciplinasProfessor) {
            discSelect.innerHTML = state.disciplinasProfessor.map(d => `<option value="${d}">${d}</option>`).join('');
            discSelect.style.display = 'block';
        }
        const modal = document.getElementById('modal-agendar-evento');
        if(modal) modal.style.display = 'flex';
        return;
    }

    // ABRIR PROJETO DE CIDADANIA E LER DADOS
    if (e.target.closest('#btn-ver-cidadania')) {
        const modal = document.getElementById('modal-projeto-cidadania');
        if(!modal) return;
        
        modal.style.display = 'flex';
        const turma = state.selectedTurma;
        const disciplina = state.disciplinasProfessor[0] || "Desconhecida"; 
        
        document.getElementById('cid-tema').innerText = "A procurar...";
        document.getElementById('cid-produto').innerText = "A procurar...";
        document.getElementById('cid-etapas').innerHTML = "<li>A carregar...</li>";
        document.getElementById('cid-disciplina').innerHTML = `<strong>Atribuição:</strong> A verificar...`;
        
        try {
            const docSnap = await getDoc(doc(db, "turmas", turma, "cidadania", "projeto"));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                document.getElementById('cid-tema').innerText = dados.tema || "Sem tema definido.";
                document.getElementById('cid-produto').innerText = dados.produto || "Sem produto definido.";
                
                if (dados.etapas && dados.etapas.length > 0) {
                    document.getElementById('cid-etapas').innerHTML = dados.etapas.map(e => `<li>${e}</li>`).join('');
                } else {
                    document.getElementById('cid-etapas').innerHTML = "<li>Sem etapas definidas.</li>";
                }
                
                const tarefasDisc = dados.tarefasDisciplinas ? dados.tarefasDisciplinas[disciplina] : null;
                document.getElementById('cid-disciplina').innerHTML = `<strong>Atribuição:</strong> ${tarefasDisc || "Nenhuma tarefa específica atribuída à tua disciplina (para já)."}`;
            } else {
                document.getElementById('cid-tema').innerText = "O Diretor de Turma ainda não configurou o projeto.";
                document.getElementById('cid-produto').innerText = "-";
                document.getElementById('cid-etapas').innerHTML = "<li>-</li>";
                document.getElementById('cid-disciplina').innerHTML = `<strong>Atribuição:</strong> -`;
            }
        } catch (err) {
            console.error(err);
            document.getElementById('cid-tema').innerText = "Erro ao carregar dados.";
        }
        return;
    }

    // GRAVAR A SUGESTÃO PARA O DT
    if (e.target.closest('#btn-enviar-sugestao-cidadania')) {
        const btn = e.target.closest('#btn-enviar-sugestao-cidadania');
        const sugestao = document.getElementById('cidadania-sugestao-dt').value.trim();
        const turma = state.selectedTurma;
        
        if (!sugestao) {
            alert("Escreve uma sugestão na caixa primeiro!");
            return;
        }
        
        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar...';
        btn.disabled = true;
        
        try {
            await addDoc(collection(db, "turmas", turma, "cidadania_sugestoes"), {
                professor: state.myUserName,
                disciplina: state.disciplinasProfessor[0] || "Geral",
                texto: sugestao,
                data: new Date().toISOString(),
                lidaDT: false
            });
            
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviado com sucesso!';
            document.getElementById('cidadania-sugestao-dt').value = '';
            setTimeout(() => {
                btn.innerHTML = txtOriginal;
                btn.disabled = false;
            }, 2000);
        } catch(err) {
            console.error(err);
            btn.innerHTML = 'Erro ao enviar!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // LÓGICA DA PLANTA DA SALA
    const carteira = e.target.closest('.carteira-lugar');
    if (carteira) {
        const posClicked = parseInt(carteira.getAttribute('data-pos'));
        
        if (lugarSelecionadoIndex === null) {
            if (!disposicaoAtualAlunos[posClicked]) {
                alert("Este lugar está vazio. Clica num aluno para o selecionar primeiro.");
                return;
            }
            lugarSelecionadoIndex = posClicked;
        } else {
            const temp = disposicaoAtualAlunos[lugarSelecionadoIndex];
            disposicaoAtualAlunos[lugarSelecionadoIndex] = disposicaoAtualAlunos[posClicked] || null;
            disposicaoAtualAlunos[posClicked] = temp;
            
            lugarSelecionadoIndex = null;
            const salaId = document.getElementById('select-sala-aula').value;
            window.renderizarPlantaSala(salaId, disposicaoAtualAlunos);
        }
        
        const salaId = document.getElementById('select-sala-aula').value;
        window.renderizarPlantaSala(salaId, disposicaoAtualAlunos);
        return;
    }

    if (e.target.closest('#btn-ver-planta')) {
        const modal = document.getElementById('modal-planta-sala');
        if(modal) {
            modal.style.display = 'flex';
            const turma = state.selectedTurma;
            const disciplina = state.disciplinasProfessor[0] || "Geral";
            
            try {
                const docRef = doc(db, "turmas", turma, "plantas_professors", `${state.myUserId}_${disciplina}`);
                const docSnap = await getDoc(docRef);
                
                if (docSnap.exists()) {
                    const dados = docSnap.data();
                    if(dados.sala) document.getElementById('select-sala-aula').value = dados.sala;
                    window.renderizarPlantaSala(dados.sala || 'sala_1', dados.lugares || {});
                } else {
                    const dtSnap = await getDoc(doc(db, "turmas", turma, "cidadania", "planta_dt"));
                    if (dtSnap.exists()) {
                        const dadosDt = dtSnap.data();
                        window.renderizarPlantaSala(dadosDt.sala || 'sala_1', dadosDt.lugares || {});
                    } else {
                        window.renderizarPlantaSala('sala_1', {});
                    }
                }
            } catch(err) {
                console.error("Erro ao carregar planta:", err);
                window.renderizarPlantaSala('sala_1', {});
            }
        }
        return;
    }

    if (e.target.closest('#btn-copiar-planta-dt')) {
        const turma = state.selectedTurma;
        try {
            const dtSnap = await getDoc(doc(db, "turmas", turma, "cidadania", "planta_dt"));
            if (dtSnap.exists()) {
                const dadosDt = dtSnap.data();
                if(dadosDt.sala) document.getElementById('select-sala-aula').value = dadosDt.sala;
                window.renderizarPlantaSala(dadosDt.sala || 'sala_1', dadosDt.lugares || {});
                alert("Matriz do Diretor de Turma copiada com sucesso! Podes agora fazer as tuas alterações e clicar em 'Guardar'.");
            } else {
                alert("O Diretor de Turma ainda não definiu nenhuma planta oficial para esta turma.");
            }
        } catch(err) {
            console.error(err);
            alert("Erro ao copiar a planta do DT.");
        }
        return;
    }

    if (e.target.closest('#btn-guardar-planta-prof')) {
        const btn = e.target.closest('#btn-guardar-planta-prof');
        const turma = state.selectedTurma;
        const disciplina = state.disciplinasProfessor[0] || "Geral";
        const salaId = document.getElementById('select-sala-aula').value;
        
        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...';
        btn.disabled = true;
        
        try {
            await setDoc(doc(db, "turmas", turma, "plantas_professors", `${state.myUserId}_${disciplina}`), {
                sala: salaId,
                lugares: disposicaoAtualAlunos,
                atualizadoEm: new Date().toISOString()
            }, { merge: true });
            
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardado com Sucesso!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        } catch(err) {
            console.error(err);
            btn.innerHTML = 'Erro ao guardar!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ABRIR MODAL PRINCIPAL DAS SÍNTESES
    if (e.target.closest('#btn-ver-sinteses-turma')) {
        const turma = state.selectedTurma;
        if (!turma) { alert("Seleciona primeiro uma turma."); return; }
        
        const grid = document.getElementById('grid-sinteses-alunos');
        if (grid) {
            grid.innerHTML = '<p class="text-muted center" style="padding:15px; font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>';
            try {
                const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno")));
                let arr = []; 
                cS.forEach(d => arr.push({id: d.id, ...d.data()}));
                arr.sort((a,b) => a.nome.localeCompare(b.nome)); 
                
                let cH = '';
                arr.forEach(d => {
                    cH += `
                    <div class="aluno-sintese-row" data-id="${d.id}" style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px;">
                        <span class="nome-aluno-span" style="color:white; font-size:0.85rem; flex: 1;">${nomeCurto(d.nome)}</span>
                        <button class="btn-abrir-gerador-sintese secondary-btn small-btn" style="width: 90px; color: #3b82f6; border-color: #3b82f6;">Avaliar</button>
                        <input type="hidden" class="input-sintese-hidden" value="">
                        <i class="fa-solid fa-check icon-sintese-feita" style="color:var(--success-green); display:none; margin-left:10px;"></i>
                    </div>`;
                });
                grid.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH;
            } catch(err) { grid.innerHTML = '<p class="text-danger center">Erro.</p>'; }
        }
        document.getElementById('modal-lancamento-sinteses').style.display = 'flex';
        return;
    }

    // CLIQUE EM AVALIAR NO ALUNO
    if (e.target.closest('.btn-abrir-gerador-sintese')) {
        const row = e.target.closest('.aluno-sintese-row');
        window.carregarAlunoNoMiniModalSintese(row);
        document.getElementById('modal-gerador-sintese').style.display = 'flex';
        return;
    }

    // NAVEGAÇÃO DE SETAS NA SÍNTESE
    if (e.target.closest('#btn-sint-anterior') || e.target.closest('#btn-sint-seguinte')) {
        const isNext = e.target.closest('#btn-sint-seguinte') !== null;
        const atualId = document.getElementById('sintese-aluno-id-atual').value;
        const linhas = Array.from(document.querySelectorAll('.aluno-sintese-row'));
        const indexAtual = linhas.findIndex(r => r.getAttribute('data-id') === atualId);
        
        if (indexAtual !== -1) {
            const novoIndex = isNext ? indexAtual + 1 : indexAtual - 1;
            if (novoIndex >= 0 && novoIndex < linhas.length) {
                window.carregarAlunoNoMiniModalSintese(linhas[novoIndex]);
            }
        }
        return;
    }

    // O "PULO DO GATO": IA GERADORA DE TEXTO
    if (e.target.closest('#btn-auto-gerar-sintese')) {
        const btn = e.target.closest('#btn-auto-gerar-sintese');
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A analisar dados...';
        
        setTimeout(async () => {
            const assid = document.getElementById('sint-assid').value;
            const emp = document.getElementById('sint-emp').value;
            const part = document.getElementById('sint-part').value;
            const alunoId = document.getElementById('sintese-aluno-id-atual').value;
            
            let texto = "";
            
            // Lógica de Fraseado Dinâmico e Humano
            if(assid === 'Sempre') texto += "O aluno tem revelado uma postura exemplar, sendo assíduo e pontual. ";
            else if(assid === 'Geralmente') texto += "O aluno é, na generalidade, assíduo e pontual às sessões letivas. ";
            else texto += "O aluno tem apresentado algumas falhas na sua assiduidade e/ou pontualidade que prejudicam a fluidez letiva. ";

            if(emp === 'Elevado') texto += "Demonstra um elevado nível de empenho e interesse pelas atividades desenvolvidas na disciplina, ";
            else if(emp === 'Bom') texto += "Demonstra um bom nível de empenho e interesse pelas atividades da disciplina, ";
            else if(emp === 'Suficiente') texto += "Apresenta um nível aceitável de empenho, cumprindo os mínimos propostos, ";
            else texto += "Revela um reduzido nível de empenho e fraco interesse face às propostas da disciplina, ";

            if(part === 'Ativa') texto += "mantendo sempre uma participação ativa, pertinente e construtiva na dinâmica da turma.";
            else if(part === 'Regular') texto += "mantendo uma participação regular e adequada ao esperado.";
            else if(part === 'Pouca') texto += "no entanto, a sua participação oral construtiva é pouco frequente.";
            else texto += "assumindo muitas vezes uma postura passiva e de inexistente participação na aula.";

            // Extrair PRHFs da Base de Dados na Hora!
            if (document.getElementById('sint-check-prhfs').checked) {
                try {
                    const disciplinaAtual = state.disciplinasProfessor[0];
                    let prhfsAtivos = 0;
                    const pS = await getDocs(collection(db, "utilizadores", alunoId, "prhfs"));
                    pS.forEach(p => { if(p.data().status !== 'concluida' && p.data().disciplina === disciplinaAtual) prhfsAtivos++; });
                    
                    if (prhfsAtivos > 0) {
                        texto += `\n\nNeste momento, o aluno tem ativados ${prhfsAtivos} Plano(s) de Recuperação (PRHF) na disciplina, encontrando-se num processo de recuperação de aprendizagens.`;
                    }
                } catch(err) {}
            }

            if (document.getElementById('sint-check-atrasos').checked) {
                texto += `\nDe salientar que o aluno possui módulos em atraso que carecem de recuperação.`;
            }

            document.getElementById('texto-sintese-final').value = texto;
            btn.innerHTML = originalIcon;
        }, 800); // pequeno delay para dar sensação de IA a pensar
        return;
    }

    // GUARDAR SÍNTESE
    if (e.target.closest('#btn-salvar-sintese-bd')) {
        const btn = e.target.closest('#btn-salvar-sintese-bd');
        const textoF = document.getElementById('texto-sintese-final').value.trim();
        const alunoId = document.getElementById('sintese-aluno-id-atual').value;
        const momento = document.getElementById('lancar-sintese-momento-global').value;
        const disciplina = state.disciplinasProfessor[0];
        const turma = state.selectedTurma;
        
        if (!textoF) { alert("A síntese está vazia."); return; }

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
        btn.disabled = true;

        try {
            // Guardar o documento final
            await setDoc(doc(db, "utilizadores", alunoId, "reunioes", `sintese_${disciplina}_${momento}`), {
                turma: turma,
                disciplina: disciplina,
                momento: momento,
                texto: textoF,
                dataLancamento: new Date().toISOString(),
                professor: state.myUserName
            }, { merge: true });

            // Atualizar o cartão visualmente
            const linhas = Array.from(document.querySelectorAll('.aluno-sintese-row'));
            const indexAtual = linhas.findIndex(r => r.getAttribute('data-id') === alunoId);
            
            if (indexAtual !== -1) {
                const row = linhas[indexAtual];
                row.querySelector('.input-sintese-hidden').value = textoF;
                row.querySelector('.icon-sintese-feita').style.display = 'block';
                
                // Saltar para o próximo aluno
                if (indexAtual + 1 < linhas.length) {
                    window.carregarAlunoNoMiniModalSintese(linhas[indexAtual + 1]);
                } else {
                    document.getElementById('modal-gerador-sintese').style.display = 'none';
                }
            }
            
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar e Avançar';
            btn.disabled = false;
        } catch(err) {
            btn.innerHTML = 'Erro!';
            setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar e Avançar'; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ABRIR MODAL OCORRÊNCIA (A PARTIR DO PERFIL 360º)
    if (e.target.closest('#btn-abrir-ocorrencia-360')) {
        const alunoId = document.getElementById('perfil-aluno-id-hidden').value;
        const alunoNome = document.getElementById('p-aluno-nome').innerText;
        
        if (!alunoId) return;
        
        // Limpar o formulário
        document.getElementById('oco-motivo').value = '';
        document.getElementById('oco-notificar-ee').checked = true;
        
        // Esconder os seletores de turma/aluno globais, porque já sabemos quem é
        const globalContainer = document.getElementById('global-oco-turma-container');
        if (globalContainer) globalContainer.style.display = 'none';
        
        document.getElementById('oco-titulo').innerText = `Ocorrência: ${alunoNome}`;
        document.getElementById('modal-ocorrencia').style.display = 'flex';
        return;
    }

    // GRAVAR A OCORRÊNCIA NA BASE DE DADOS
    if (e.target.closest('#btn-gravar-ocorrencia')) {
        const btn = e.target.closest('#btn-gravar-ocorrencia');
        const alunoId = document.getElementById('perfil-aluno-id-hidden').value; 
        const motivo = document.getElementById('oco-motivo').value.trim();
        const notificarEE = document.getElementById('oco-notificar-ee').checked;
        const turma = state.selectedTurma;
        const disciplina = state.disciplinasProfessor[0] || "Geral";
        
        if (!motivo) { alert("Descreve a situação primeiro."); return; }
        
        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A registar...';
        btn.disabled = true;
        
        try {
            await addDoc(collection(db, "utilizadores", alunoId, "ocorrencias"), {
                turma: turma,
                disciplina: disciplina,
                descricao: motivo,
                data: new Date().toISOString(),
                autor: state.myUserName,
                notificarEE: notificarEE,
                lidaEE: false
            });

            // --- A MÁGICA ACONTECE AQUI! GRAVAR NO LOG DE ATIVIDADES ---
            if (window.registarAtividadeProfessor) {
                await window.registarAtividadeProfessor('ocorrencia', `Ocorrência registada a ${alunoNome}`, `Turma ${turma}`);
            }
            // -------------------------------------------------------------

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Registada!';
            setTimeout(() => {
                btn.innerHTML = txtOriginal;
                btn.disabled = false;
                document.getElementById('modal-ocorrencia').style.display = 'none';
            }, 1500);
        } catch (err) {
            console.error("Erro ao gravar ocorrência:", err);
            btn.innerHTML = 'Erro ao gravar!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ABRIR/FECHAR MENU FLUTUANTE (Ações Rápidas)
    if (e.target.closest('#btn-fab-global')) {
        const menu = document.getElementById('modal-fab-menu');
        if (menu) {
            menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'flex' : 'none';
        }
        return;
    }
}); // <-- FIM DO MOTOR DE CLIQUES

// ----------------------------------------------------
// 4. FUNÇÕES GERAIS / MOTOR DA PLANTA E MODAIS
// ----------------------------------------------------
window.mudarTurmaManualmente = function(caixaSelect) {
    const turma = caixaSelect.value;
    const painelTurma = document.getElementById('turma-ativa-container');
    
    if (turma) {
        state.selectedTurma = turma;
        if(painelTurma) painelTurma.style.display = 'block'; 
        analisarEAtualizarTurma(turma);
    } else {
        if(painelTurma) painelTurma.style.display = 'none'; 
        state.selectedTurma = null;
    }
};

const dimensoesSalas = {
    'sala_1': { cols: 3, linhas: 6, tipo: 'dupla' },
    'sala_4': { cols: 4, linhas: 3, tipo: 'dupla' },
    'sala_7': { cols: 3, linhas: 6, tipo: 'dupla' },
    'sala_8': { cols: 3, linhas: 6, tipo: 'dupla' },
    'sala_11': { cols: 3, linhas: 5, tipo: 'dupla' },
    'sala_12': { cols: 3, linhas: 4, tipo: 'dupla' },
    'sala_13': { cols: 4, linhas: 5, tipo: 'dupla' },
    'lab_cte': { cols: 5, linhas: 5, tipo: 'individual' }
};

let lugarSelecionadoIndex = null;
let disposicaoAtualAlunos = {}; 

window.renderizarPlantaSala = function(salaId, lugaresOcupados = {}) {
    const config = dimensoesSalas[salaId] || dimensoesSalas['sala_1'];
    const container = document.getElementById('grid-planta-sala');
    if (!container) return;

    disposicaoAtualAlunos = { ...lugaresOcupados };
    container.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;
    
    let html = '';
    const totalLugares = config.cols * config.linhas;

    for (let i = 1; i <= totalLugares; i++) {
        const alunoNome = disposicaoAtualAlunos[i] || `Lugar Vago`;
        const isVago = !disposicaoAtualAlunos[i];
        
        let estiloExtra = 'background: rgba(255,255,255,0.03); border-color: #444; color: var(--text-muted);';
        if (!isVago) {
            estiloExtra = 'background: rgba(0, 204, 136, 0.15); border-color: var(--primary-green); color: white;';
        }
        if (lugarSelecionadoIndex === i) {
            estiloExtra = 'background: rgba(245, 158, 11, 0.25); border-color: var(--warning-yellow); color: var(--warning-yellow); box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);';
        }
        
        html += `
            <div class="carteira-lugar" data-pos="${i}" style="${estiloExtra} border: 1px solid; height: 55px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px; cursor: pointer; transition: 0.2s;">
                <span style="font-size: 0.6rem; opacity: 0.6;">#${i}</span>
                <span style="font-size: 0.75rem; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; font-weight: ${!isVago ? 'bold' : 'normal'};">${alunoNome}</span>
            </div>
        `;
    }
    container.innerHTML = html;
};

window.carregarAlunoNoMiniModal = function(linhaHTML) {
    if (!linhaHTML) return;
    const alunoId = linhaHTML.getAttribute('data-id');
    const btnAtribuir = linhaHTML.querySelector('.btn-abrir-escolha-nota');
    const alunoNome = btnAtribuir.getAttribute('data-nome');
    
    const inputId = document.getElementById('aluno-id-nota-atual');
    const labelNome = document.getElementById('nome-aluno-nota-atual');
    if(inputId) inputId.value = alunoId;
    if(labelNome) labelNome.innerText = alunoNome;
    
    document.querySelectorAll('.btn-nota-opcao').forEach(b => {
        b.classList.remove('active-nota');
        b.style.boxShadow = 'none';
        b.style.background = '';
    });
    
    const repContainer = document.getElementById('container-justificacao-rep');
    const motivoSelect = document.getElementById('motivo-rep-select');
    if(repContainer) repContainer.style.display = 'none';
    if(motivoSelect) motivoSelect.value = 'Falta de Plano';
    
    const notaAtual = linhaHTML.querySelector('.input-nota-aluno-hidden').value;
    if (notaAtual) {
        const btnOpt = document.querySelector(`.btn-nota-opcao[data-val="${notaAtual}"]`);
        if (btnOpt) {
            btnOpt.classList.add('active-nota');
            btnOpt.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.2)';
            btnOpt.style.background = 'rgba(255,255,255,0.1)';
            if (notaAtual === 'REP') {
                if(repContainer) repContainer.style.display = 'block';
                const motivoAtual = linhaHTML.querySelector('.input-motivo-aluno-hidden').value;
                if(motivoSelect && motivoAtual) motivoSelect.value = motivoAtual;
            }
        }
    }
};

// Variável global para evitar sobreposição de gráficos
let graficoAlunoInstance = null;

window.abrirPerfilCompletoAluno = async function(alunoId, alunoNome, alunoFoto) {
    const modal = document.getElementById('modal-perfil-aluno');
    if (!modal) return;
    
    // 1. Reset da Interface
    document.getElementById('p-aluno-nome').innerText = alunoNome;
    document.getElementById('p-aluno-foto').src = alunoFoto || 'logo_tur.png';
    document.getElementById('perfil-aluno-id-hidden').value = alunoId;
    document.getElementById('p-aluno-media').innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:0.8rem;"></i>';
    document.getElementById('badge-maai-aluno').innerHTML = '<span style="background:#333; color:var(--text-muted); padding:4px 8px; border-radius:4px; font-size:0.75rem;">A verificar...</span>';
    
    // Dispara logo o dropdown das sínteses para carregar o Momento 1 por defeito
    document.getElementById('sintese-momento').value = 'momento_1';
    document.getElementById('sintese-momento').dispatchEvent(new Event('change', { bubbles: true }));

    modal.style.display = 'flex';

    try {
        const disciplina = state.disciplinasProfessor[0]; // Assume a 1ª disciplina do prof
        
        // 2. Carregar Dados do Aluno (MAAI)
        const alunoSnap = await getDoc(doc(db, "utilizadores", alunoId));
        if (alunoSnap.exists()) {
            const data = alunoSnap.data();
            let maaiHtml = '<span style="background:#333; color:white; padding:4px 8px; border-radius:4px; font-size:0.75rem;">Nenhuma Medida Ativa</span>';
            
            if (data.maai === 'adicionais') {
                maaiHtml = '<span style="background:var(--danger-red); color:white; padding:4px 8px; border-radius:4px; font-size:0.75rem;"><i class="fa-solid fa-layer-group"></i> Medidas Adicionais</span>';
            } else if (data.maai === 'seletivas') {
                maaiHtml = '<span style="background:var(--warning-yellow); color:black; padding:4px 8px; border-radius:4px; font-size:0.75rem;"><i class="fa-solid fa-filter"></i> Medidas Seletivas</span>';
            } else if (data.maai === 'universais') {
                maaiHtml = '<span style="background:var(--primary-green); color:black; padding:4px 8px; border-radius:4px; font-size:0.75rem;"><i class="fa-solid fa-globe"></i> Medidas Universais</span>';
            }
            document.getElementById('badge-maai-aluno').innerHTML = maaiHtml;
        }

        // 3. Carregar Notas da disciplina e Calcular Média
        const notasSnap = await getDocs(query(collection(db, "utilizadores", alunoId, "avaliacoes"), where("disciplina", "==", disciplina)));
        let soma = 0;
        let count = 0;
        let notasParaGrafico = [];

        notasSnap.forEach(d => {
            const val = d.data().nota;
            if (val !== 'REP' && !isNaN(val)) {
                soma += parseFloat(val);
                count++;
                notasParaGrafico.push({ modulo: d.data().modulo, nota: parseFloat(val) });
            }
        });

        // Ordenar módulos para o gráfico ficar lógico (M1, M2, M3...)
        notasParaGrafico.sort((a, b) => parseInt(a.modulo) - parseInt(b.modulo));

        // Aplica a Média
        if (count > 0) {
            document.getElementById('p-aluno-media').innerText = (soma / count).toFixed(1);
        } else {
            document.getElementById('p-aluno-media').innerText = '-';
        }

        // 4. Desenhar o Gráfico Blindado
        const ctx = document.getElementById('chartEvolucaoAluno');
        if (ctx) {
            if (graficoAlunoInstance) {
                graficoAlunoInstance.destroy(); // Destrói o anterior para não sobrepor nem causar bugs visuais
            }
            
            graficoAlunoInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: notasParaGrafico.map(n => `Mod ${n.modulo}`),
                    datasets: [{
                        label: 'Classificação (0-20)',
                        data: notasParaGrafico.map(n => n.nota),
                        borderColor: '#00cc88',
                        backgroundColor: 'rgba(0, 204, 136, 0.1)',
                        pointBackgroundColor: '#00cc88',
                        pointBorderColor: '#fff',
                        pointRadius: 5,
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: { 
                            beginAtZero: true, 
                            max: 20,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: 'rgba(255,255,255,0.5)' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: 'rgba(255,255,255,0.5)' }
                        }
                    }
                }
            });
        }

        // 5. Puxar faltas e PRHFs (Exemplo estático rápido, podes ligar à tua lógica real de contagem de faltas a seguir)
        document.getElementById('p-aluno-faltas').innerText = "12"; // Substitui depois pela query real de faltas
        document.getElementById('p-aluno-prhfs').innerText = "1";   // Substitui depois pela query real de PRHFs

    } catch(err) {
        console.error("Erro ao carregar perfil:", err);
    }
};

window.carregarAlunoNoMiniModalSintese = function(linhaHTML) {
    if (!linhaHTML) return;
    const alunoId = linhaHTML.getAttribute('data-id');
    const alunoNome = linhaHTML.querySelector('.nome-aluno-span').innerText;
    
    document.getElementById('sintese-aluno-id-atual').value = alunoId;
    document.getElementById('nome-aluno-sintese-atual').innerText = alunoNome;
    
    // Reset visual
    document.getElementById('sint-assid').value = 'Geralmente';
    document.getElementById('sint-emp').value = 'Bom';
    document.getElementById('sint-part').value = 'Regular';
    
    // Verifica se já tinha texto escondido no card e carrega
    const txtGuardado = linhaHTML.querySelector('.input-sintese-hidden').value;
    document.getElementById('texto-sintese-final').value = txtGuardado || "";
};