import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, setDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { state, getDisciplinasPermitidas, nomeCurto } from "./prof/store.js";
import { gerarRadarConflitos } from "./prof/roles/dt.js";
import { validarFCT } from "./prof/roles/coord.js"; 
import { aprovarTemaPAP, rejeitarTemaPAPExecutar, aprovarRelatorioPAP } from "./prof/roles/pap.js";
import { carregarRadarProfessor, analisarEAtualizarTurma, renderizarPautaTurma, renderizarFaltasTurma, desenharGraficoAluno, abrirPerfil360Aluno, carregarTarefasProf, carregarForunsProf, abrirChatForum, atualizarDropdownModulos, filtrarDisciplinasDoAno } from "./prof/ui.js";

import { carregarEcraOrientandos, carregarEcraDiario, prepararModalNovaSessao } from "./prof/roles/pap-diario.js";
import { carregarEcraProjetosCoord } from "./prof/roles/coord-dashboard.js";

// MATRIZ DE CONFIGURAÇÕES DE SALAS
const CONFIG_SALAS = {
    'sala4': { colunas: 4, linhas: 3, formato: 'dupla' },
    'sala7': { colunas: 3, linhas: 6, formato: 'dupla' },
    'sala8': { colunas: 3, linhas: 6, formato: 'dupla' },
    'sala11': { colunas: 3, linhas: 4, formato: 'mista_centro_individual' },
    'sala12': { colunas: 3, linhas: 4, formato: 'dupla' },
    'sala13': { colunas: 4, linhas: 4, formato: 'dupla' },
    'labCTE': { colunas: 4, linhas: 5, formato: 'individual' }
};

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
                            dropdownHtml += `<button onclick="window.mudarCapaProfessor('${papel}')" style="width: 100%; text-align: left; padding: 12px 15px; background: transparent; border: none; color: white; cursor: pointer; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 10px;">
                                <span style="width: 10px; height: 10px; border-radius: 50%; background-color: ${configuracaoPerfis[papel].cor};"></span> ${configuracaoPerfis[papel].nome}
                            </button>`;
                        }
                    });
                    document.getElementById('lista-capas-dropdown').innerHTML = dropdownHtml;

                    window.mudarCapaProfessor = (novoPapel) => {
                        state.activeRole = novoPapel;
                        const config = configuracaoPerfis[novoPapel];
                        const badge = document.getElementById('badge-perfil-ativo');
                        badge.innerText = config.nome;
                        badge.style.backgroundColor = config.cor;
                        
                        const navBase = document.querySelectorAll('.nav-role-base');
                        const navPap = document.querySelectorAll('.nav-role-pap');
                        const navCoord = document.querySelectorAll('.nav-role-coord');
                        
                        if (novoPapel === 'orientador_pap') { navBase.forEach(el => el.style.display = 'none'); navCoord.forEach(el => el.style.display = 'none'); navPap.forEach(el => el.style.display = 'flex'); } 
                        else if (novoPapel === 'coordenador') { navBase.forEach(el => el.style.display = 'none'); navPap.forEach(el => el.style.display = 'none'); navCoord.forEach(el => el.style.display = 'flex'); } 
                        else { navPap.forEach(el => el.style.display = 'none'); navCoord.forEach(el => el.style.display = 'none'); navBase.forEach(el => el.style.display = 'flex'); }

                        document.getElementById('dropdown-perfis').style.display = 'none';
                        document.querySelector('.nav-item[data-target="view-prof-dashboard"]').click();
                    };

                    window.mudarCapaProfessor('professor');
                    document.getElementById('btn-toggle-perfis').addEventListener('click', (e) => { e.stopPropagation(); const drop = document.getElementById('dropdown-perfis'); drop.style.display = drop.style.display === 'none' ? 'block' : 'none'; });

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
                    if (state.turmasProfessor.length > 0) { sel.innerHTML = '<option value="">-- Selecionar Turma --</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join(''); } 
                    else { sel.innerHTML = '<option value="">Sem turmas atribuídas</option>'; }

                    carregarRadarProfessor(); 
                } else { window.location.href = "index.html"; }
            }
        } catch (e) { console.error("Erro na inicialização:", e); }
    } else { window.location.href = "index.html"; }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#header-prof') && !e.target.closest('#modal-fab-menu') && !e.target.closest('#btn-fab-global')) { const drop = document.getElementById('dropdown-perfis'); if(drop) drop.style.display = 'none'; document.getElementById('modal-fab-menu').style.display = 'none';}
});

document.getElementById('btn-logout-dropdown')?.addEventListener('click', () => signOut(auth));
function esconderTodasAsVistas() { document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none'); }

document.getElementById('sort-passaporte')?.addEventListener('change', carregarTarefasProf);
document.getElementById('filtro-prhf-data')?.addEventListener('change', carregarTarefasProf);
document.getElementById('filtro-prhf-modulo')?.addEventListener('change', carregarTarefasProf);

// CÁLCULO DE HORAS PRHF (Com a tua fórmula)
document.getElementById('prhf-horas-totais')?.addEventListener('input', (e) => {
    const val = parseInt(e.target.value) || 0;
    document.getElementById('prhf-horas-presenciais').value = val <= 4 ? 0 : Math.ceil(val * 0.3);
});

document.getElementById('btn-prhf-minha')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('btn-prhf-todas').classList.remove('active'); state.prhfViewMode = 'minha'; carregarTarefasProf(); });
document.getElementById('btn-prhf-todas')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('btn-prhf-minha').classList.remove('active'); state.prhfViewMode = 'todas'; carregarTarefasProf(); });
document.getElementById('btn-graph-disc')?.addEventListener('click', () => { document.getElementById('btn-graph-disc').classList.add('active'); document.getElementById('btn-graph-global').classList.remove('active'); desenharGraficoAluno('disc'); });
document.getElementById('btn-graph-global')?.addEventListener('click', () => { document.getElementById('btn-graph-global').classList.add('active'); document.getElementById('btn-graph-disc').classList.remove('active'); desenharGraficoAluno('global'); });
document.getElementById('evento-periodo')?.addEventListener('change', (e) => { const timeInput = document.getElementById('evento-hora'); if(e.target.value === 'hora') { timeInput.style.display = 'block'; } else { timeInput.style.display = 'none'; } });
document.getElementById('pauta-disc-select')?.addEventListener('change', renderizarPautaTurma);
document.getElementById('faltas-disc-select')?.addEventListener('change', renderizarFaltasTurma);
document.getElementById('prof-seletor-turmas')?.addEventListener('change', (e) => { state.selectedTurma = e.target.value; if (state.selectedTurma) { document.getElementById('turma-ativa-container').style.display = 'block'; analisarEAtualizarTurma(state.selectedTurma); } else { document.getElementById('turma-ativa-container').style.display = 'none'; } });

document.getElementById('prhf-turma')?.addEventListener('change', async (e) => { 
    const s = document.getElementById('prhf-aluno'); const t = e.target.value; 
    if (!t) { s.innerHTML = '<option value="">Selecione primeiro a Turma</option>'; return; } 
    const disc = document.getElementById('prhf-disciplina').value;
    atualizarDropdownModulos(t, disc, document.getElementById('prhf-modulo'));
    
    s.innerHTML = '<option value="">A carregar...</option>'; 
    try { 
        const qS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); 
        let arr = []; qS.forEach(d => arr.push({ id: d.id, nome: d.data().nome })); arr.sort((a,b) => a.nome.localeCompare(b.nome)); 
        s.innerHTML = '<option value="">-- Selecione o Aluno --</option>' + arr.map(a => `<option value="${a.id}">${nomeCurto(a.nome)}</option>`).join(''); 
    } catch (err) { s.innerHTML = '<option value="">Erro</option>'; } 
});

document.getElementById('prhf-disciplina')?.addEventListener('change', (e) => {
    const t = document.getElementById('prhf-turma').value;
    if (t) atualizarDropdownModulos(t, e.target.value, document.getElementById('prhf-modulo'));
});

// Ações Globais Dinâmicas (A partir do FAB)
document.getElementById('lancar-falta-turma')?.addEventListener('change', async (e) => {
    const t = e.target.value;
    const c = document.getElementById('lista-metralhadora-faltas');
    if (!t) { c.innerHTML = '<p class="text-muted center" style="padding:15px; font-size:0.85rem;">Seleciona uma turma para ver os alunos.</p>'; return; }
    
    const discSelect = document.getElementById('lancar-falta-disciplina');
    const dValidas = filtrarDisciplinasDoAno(t, getDisciplinasPermitidas());
    discSelect.innerHTML = dValidas.map(dc => `<option value="${dc}">${dc}</option>`).join('');
    atualizarDropdownModulos(t, (dValidas[0]||"Geral"), document.getElementById('falta-modulo-select'));

    c.innerHTML = '<p class="text-muted center">A ler alunos...</p>';
    try {
        const qS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); 
        let arr = []; qS.forEach(d => arr.push({ id: d.id, ...d.data() })); arr.sort((a,b) => a.nome.localeCompare(b.nome)); 
        let h = ''; arr.forEach(al => { h += `<label style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); margin-bottom:5px; border-radius:8px; border:1px solid #333; cursor:pointer;"><span style="color:white; font-size:0.95rem;">${nomeCurto(al.nome)}</span><input type="checkbox" class="chk-falta" value="${al.id}" style="width:18px;height:18px;accent-color:var(--danger-red);"></label>`; });
        c.innerHTML = h;
    } catch(err) { c.innerHTML = '<p class="text-danger center">Erro.</p>'; }
});

document.getElementById('oco-global-turma')?.addEventListener('change', async (e) => {
    const s = document.getElementById('oco-global-aluno'); const t = e.target.value; 
    if (!t) { s.innerHTML = '<option value="">Selecionar Aluno...</option>'; return; } 
    s.innerHTML = '<option value="">A carregar...</option>'; 
    try { 
        const qS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); 
        let arr = []; qS.forEach(d => arr.push({ id: d.id, nome: d.data().nome })); arr.sort((a,b) => a.nome.localeCompare(b.nome)); 
        s.innerHTML = '<option value="">-- Selecione o Aluno --</option>' + arr.map(a => `<option value="${a.id}">${nomeCurto(a.nome)}</option>`).join(''); 
    } catch (err) { s.innerHTML = '<option value="">Erro</option>'; } 
});

document.getElementById('lancar-sumario-turma')?.addEventListener('change', (e) => {
    const t = e.target.value;
    const matDisc = document.getElementById('mat-disciplina');
    if (!t) { matDisc.innerHTML = '<option value="">Turma em falta</option>'; return; }
    const dValidas = filtrarDisciplinasDoAno(t, getDisciplinasPermitidas());
    matDisc.innerHTML = dValidas.length > 0 ? dValidas.map(dc => `<option value="${dc}">${dc}</option>`).join('') : '<option value="">Geral</option>';
});

document.getElementById('forum-turma-select')?.addEventListener('change', async (e) => { const t = e.target.value; const cCont = document.getElementById('lista-alunos-forum'); if (!t) { cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem;">Seleciona uma turma primeiro.</p>'; return; } cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>'; try { const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); let cH = ''; cS.forEach(d => { cH += `<label style="display:flex; align-items:center; gap:10px; color:white; font-size:0.9rem; padding:8px 0; cursor:pointer;"><input type="checkbox" class="forum-aluno-check" value="${d.id}" checked style="width:18px;height:18px;accent-color:var(--primary-green);"> ${nomeCurto(d.data().nome)}</label>`; }); cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH; } catch(err) { cCont.innerHTML = '<p class="text-danger center">Erro.</p>'; } });

// ----------------------------------------------------
// NOVO: LÓGICA DA PLANTA DA SALA
// ----------------------------------------------------
document.getElementById('planta-sala-select')?.addEventListener('change', (e) => {
    const salaId = e.target.value;
    const cont = document.getElementById('planta-gerada-container');
    const btnGerar = document.getElementById('btn-gerar-planta');
    
    if (!salaId) { 
        cont.style.display = 'none'; 
        btnGerar.disabled = true;
        btnGerar.style.opacity = '0.5';
        return; 
    }
    
    btnGerar.disabled = false;
    btnGerar.style.opacity = '1';
    cont.style.display = 'block';
    const config = CONFIG_SALAS[salaId];
    
    // Desenha o Quadro Virado para Cima
    let html = `<div style="background:#555; color:white; text-align:center; padding:5px; border-radius:4px; margin-bottom:20px; font-weight:bold; font-size:0.8rem; border:2px solid #888;">QUADRO DA SALA</div>`;
    
    // Desenhar Grelha Baseada na Matriz
    html += `<div style="display:flex; flex-direction:column; gap:15px; align-items:center;">`;
    
    for (let l = 0; l < config.linhas; l++) {
        html += `<div style="display:flex; gap:20px;">`; // Fila
        for (let c = 0; c < config.colunas; c++) {
            
            // Regra especial para Sala 11 (Centro Individual)
            if (config.formato === 'mista_centro_individual') {
                if (c === 1) { // Fila do meio
                    html += `<div class="mesa-planta" data-mesa="${l}-${c}" style="width:60px; height:60px; background:#1c1f26; border:1px dashed #555; border-radius:8px; display:flex; justify-content:center; align-items:center; text-align:center; font-size:0.75rem; color:var(--text-muted);">Vazio</div>`;
                } else { // Filas laterais (duplas)
                    html += `<div style="display:flex; gap:2px; background:#111; padding:4px; border-radius:8px; border:1px solid #333;">
                        <div class="mesa-planta" data-mesa="${l}-${c}-A" style="width:60px; height:60px; background:#1c1f26; border:1px dashed #555; border-radius:6px; display:flex; justify-content:center; align-items:center; text-align:center; font-size:0.75rem; color:var(--text-muted);">Vazio</div>
                        <div class="mesa-planta" data-mesa="${l}-${c}-B" style="width:60px; height:60px; background:#1c1f26; border:1px dashed #555; border-radius:6px; display:flex; justify-content:center; align-items:center; text-align:center; font-size:0.75rem; color:var(--text-muted);">Vazio</div>
                    </div>`;
                }
            } 
            else if (config.formato === 'dupla') {
                html += `<div style="display:flex; gap:2px; background:#111; padding:4px; border-radius:8px; border:1px solid #333;">
                    <div class="mesa-planta" data-mesa="${l}-${c}-A" style="width:60px; height:60px; background:#1c1f26; border:1px dashed #555; border-radius:6px; display:flex; justify-content:center; align-items:center; text-align:center; font-size:0.75rem; color:var(--text-muted);">Vazio</div>
                    <div class="mesa-planta" data-mesa="${l}-${c}-B" style="width:60px; height:60px; background:#1c1f26; border:1px dashed #555; border-radius:6px; display:flex; justify-content:center; align-items:center; text-align:center; font-size:0.75rem; color:var(--text-muted);">Vazio</div>
                </div>`;
            }
            else { // Individual (CTE)
                html += `<div class="mesa-planta" data-mesa="${l}-${c}" style="width:60px; height:60px; background:#1c1f26; border:1px dashed #555; border-radius:8px; display:flex; justify-content:center; align-items:center; text-align:center; font-size:0.75rem; color:var(--text-muted);">Vazio</div>`;
            }
        }
        html += `</div>`;
    }
    html += `</div>`;
    cont.innerHTML = html;
    document.getElementById('btn-exportar-planta').style.display = 'none';
});

// CLIQUE GERAL PARA TODA A PÁGINA
document.body.addEventListener('click', async (e) => {
    
    // NAVEGAÇÃO
    const nav = e.target.closest('.nav-item');
    if (nav) {
        e.preventDefault(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); nav.classList.add('active');
        esconderTodasAsVistas(); const tId = nav.getAttribute('data-target'); document.getElementById(tId).style.display = (tId === 'view-prof-forum') ? 'flex' : 'block';
        if (tId === 'view-prof-dashboard') carregarRadarProfessor();
        if (tId === 'view-prof-turmas' && state.selectedTurma) analisarEAtualizarTurma(state.selectedTurma);
        if (tId === 'view-prof-tarefas') carregarTarefasProf();
        if (tId === 'view-prof-orientandos') carregarEcraOrientandos();
        if (tId === 'view-prof-diario') carregarEcraDiario();
        if (tId === 'view-coord-projetos') carregarEcraProjetosCoord();
        if (tId === 'view-prof-forum') { if (state.chatUnsubscribe) { state.chatUnsubscribe(); state.chatUnsubscribe = null; } document.getElementById('prof-forum-chat-view').style.display = 'none'; document.getElementById('btn-create-chat-prof').style.display = 'block'; document.getElementById('prof-forum-channel-list').style.display = 'block'; carregarForunsProf(); }
        return; 
    }

    if (e.target.closest('#tab-coord-fct')) { document.getElementById('tab-coord-fct').classList.add('active'); document.getElementById('tab-coord-pap').classList.remove('active'); import('./prof/roles/coord-dashboard.js').then(module => { module.coordTabAtiva = 'fct'; module.carregarEcraProjetosCoord(); }); return; }
    if (e.target.closest('#tab-coord-pap')) { document.getElementById('tab-coord-pap').classList.add('active'); document.getElementById('tab-coord-fct').classList.remove('active'); import('./prof/roles/coord-dashboard.js').then(module => { module.coordTabAtiva = 'pap'; module.carregarEcraProjetosCoord(); }); return; }
    if (e.target.closest('.fechar-modal')) { document.getElementById(e.target.closest('.fechar-modal').getAttribute('data-target')).style.display = 'none'; return; }
    if (e.target.closest('.aluno-list-item')) { abrirPerfil360Aluno(e.target.closest('.aluno-list-item').getAttribute('data-id')); return; }
    if (e.target.closest('#tab-tarefas-prhf')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'block'; document.getElementById('sec-tarefas-passaporte').style.display = 'none'; carregarTarefasProf(); return; }
    if (e.target.closest('#tab-tarefas-passaporte')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'none'; document.getElementById('sec-tarefas-passaporte').style.display = 'block'; carregarTarefasProf(); return; }
    if (e.target.closest('#btn-nova-sessao-pap')) { prepararModalNovaSessao(); return; }

    // BOTÃO FAB GLOBAL
    if (e.target.closest('#btn-fab-global')) {
        document.getElementById('modal-fab-menu').style.display = 'flex';
        return;
    }

    // AÇÕES DO FAB
    if (e.target.closest('#btn-fab-falta')) {
        document.getElementById('modal-fab-menu').style.display = 'none';
        document.getElementById('erro-modal-faltas').style.display = 'none';
        const tCont = document.getElementById('global-falta-turma-container');
        tCont.style.display = 'block';
        const selTurmas = document.getElementById('lancar-falta-turma');
        selTurmas.innerHTML = '<option value="">Selecionar Turma...</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join('');
        document.getElementById('lista-metralhadora-faltas').innerHTML = '<p class="text-muted center" style="padding:15px; font-size:0.85rem;">Seleciona uma turma para ver os alunos.</p>';
        
        const discFalta = document.getElementById('lancar-falta-disciplina');
        discFalta.style.display = state.disciplinasProfessor.length > 1 ? 'block' : 'none';
        document.getElementById('modal-marcar-faltas').style.display = 'flex';
        return;
    }

    if (e.target.closest('#btn-fab-ocorrencia')) {
        document.getElementById('modal-fab-menu').style.display = 'none';
        document.getElementById('oco-tipo').value = 'geral';
        document.getElementById('oco-titulo').innerHTML = 'Registar Ocorrência';
        document.getElementById('oco-motivo').value = '';
        
        document.getElementById('global-oco-turma-container').style.display = 'block';
        document.getElementById('oco-global-turma').innerHTML = '<option value="">Selecionar Turma...</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join('');
        document.getElementById('oco-global-aluno').innerHTML = '<option value="">Selecionar Aluno...</option>';
        
        document.getElementById('btn-gravar-ocorrencia').style.background = 'var(--warning-yellow)';
        document.getElementById('btn-gravar-ocorrencia').style.color = 'black';
        document.getElementById('modal-ocorrencia').style.display = 'flex';
        return;
    }

    if (e.target.closest('#btn-fab-sumario')) {
        document.getElementById('modal-fab-menu').style.display = 'none';
        document.getElementById('mat-titulo').value = '';
        document.getElementById('mat-sumario').value = '';
        
        document.getElementById('global-sumario-turma-container').style.display = 'block';
        document.getElementById('lancar-sumario-turma').innerHTML = '<option value="">Selecionar Turma...</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join('');
        
        const matDisc = document.getElementById('mat-disciplina');
        matDisc.innerHTML = '<option value="">Geral</option>';
        matDisc.style.display = state.disciplinasProfessor.length > 1 ? 'block' : 'none';
        
        document.getElementById('mat-file').value = ''; state.materialBase64 = null; 
        document.getElementById('mat-file-name').innerText = 'Toca para selecionar';
        document.getElementById('modal-materiais').style.display = 'flex';
        return;
    }

    // ABRIR MODAL PLANTA
    if (e.target.closest('#btn-ver-planta')) {
        if (!state.selectedTurma) return alert("Seleciona uma turma primeiro.");
        document.getElementById('planta-sala-select').value = '';
        document.getElementById('planta-gerada-container').style.display = 'none';
        document.getElementById('planta-instrucoes-ia').value = '';
        const btnGerar = document.getElementById('btn-gerar-planta');
        btnGerar.disabled = true; btnGerar.style.opacity = '0.5';
        document.getElementById('modal-planta-sala').style.display = 'flex';
        return;
    }

    // BOTÃO GERAR PLANTA DA SALA
    if (e.target.closest('#btn-gerar-planta')) {
        const salaId = document.getElementById('planta-sala-select').value;
        if(!salaId) return;
        
        const btn = document.getElementById('btn-gerar-planta');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A calcular...';
        
        // Simular o delay da Inteligência Artificial a pensar
        setTimeout(() => {
            const mesas = document.querySelectorAll('.mesa-planta');
            // Embaralhar alunos da turma atual para a demo
            let alunosBaralhados = [...state.alunosTurmaRAM].sort(() => 0.5 - Math.random());
            
            // Limpar tudo
            mesas.forEach(m => {
                m.innerText = 'Vazio'; 
                m.style.color = 'var(--text-muted)'; 
                m.style.borderColor = '#555';
                m.style.background = '#1c1f26';
            });
            
            // Preencher com a IA (Simulada)
            let i = 0;
            mesas.forEach(m => {
                if (i < alunosBaralhados.length) {
                    const primeiroNome = alunosBaralhados[i].nome.split(' ')[0];
                    m.innerText = primeiroNome;
                    m.style.color = 'white';
                    m.style.borderColor = 'var(--primary-green)';
                    m.style.background = 'rgba(0, 204, 136, 0.15)';
                    i++;
                }
            });
            
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Refazer Disposição';
            document.getElementById('btn-exportar-planta').style.display = 'block';
        }, 1200);
        return;
    }

    // COPILOTO IA
    if (e.target.closest('#btn-abrir-copiloto')) {
        const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
        const alunoNome = document.getElementById('p-aluno-nome').innerText;
        const faltas = document.getElementById('p-aluno-faltas').innerText;
        const modFeitos = document.getElementById('p-aluno-notas').innerText;
        const textareaPrompt = document.getElementById('prompt-ia-text');
        
        let promptText = "";
        if (isDT) { promptText = `Atua como Diretor de Turma. Faz uma Síntese Global para o aluno ${alunoNome}. Baseia-te nos dados (Tem ${faltas}h de faltas e concluiu ${modFeitos} módulos). Regras obrigatórias: Ser objetivo e claro; Indicar pontos fortes no empenho; Referir os aspetos a melhorar no comportamento/aprendizagem; Apresentar estratégias concretas de progressão; Incluir a lista de módulos não concluídos (se aplicável). Tom: Institucional e construtivo.`; } 
        else { promptText = `Atua como professor da disciplina de ${document.getElementById('perfil-disc-select').value || 'Técnicas'}. Escreve uma síntese de avaliação para o aluno ${alunoNome}. A síntese deve cumprir as regras da direção: Ser objetiva e construtiva; 1. Elogiar pontos fortes. 2. Apontar aspetos a melhorar na disciplina. 3. Dar estratégias claras de progressão. (Nota: O aluno concluiu ${modFeitos} módulos e tem ${faltas}h de faltas na globalidade). Tom: Profissional e direto ao assunto.`; }
        textareaPrompt.value = promptText; document.getElementById('modal-copiloto-ia').style.display = 'flex'; return;
    }
    
    if (e.target.closest('#btn-copiar-prompt')) { const copyText = document.getElementById('prompt-ia-text'); copyText.select(); document.execCommand("copy"); const btn = e.target.closest('#btn-copiar-prompt'); btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!'; setTimeout(() => { btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar Prompt'; document.getElementById('modal-copiloto-ia').style.display = 'none'; }, 1500); return; }

    // FORMATAÇÃO IA SUMÁRIOS
    if (e.target.closest('#btn-ia-formatar-sumario')) {
        const btn = e.target.closest('#btn-ia-formatar-sumario');
        const sumarioBox = document.getElementById('mat-sumario');
        const textoOriginal = sumarioBox.value.trim();
        
        if (!textoOriginal) return alert("Escreve primeiro alguns tópicos para a IA formatar.");
        
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        setTimeout(() => {
            const linhas = textoOriginal.split('\n').filter(l => l.trim() !== '');
            let textoFormatado = "Sumário da Aula:\n";
            linhas.forEach(linha => {
                let cleanLine = linha.replace(/^[-\*\.]\s*/, '').trim();
                textoFormatado += `• ${cleanLine.charAt(0).toUpperCase() + cleanLine.slice(1)}.\n`;
            });
            sumarioBox.value = textoFormatado;
            btn.innerHTML = '<i class="fa-solid fa-check" style="color:var(--success-green);"></i>';
            setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>'; }, 2000);
        }, 800);
        return;
    }

    if (e.target.closest('.btn-download-ics')) { const btn = e.target.closest('.btn-download-ics'); const tit = btn.getAttribute('data-tit'); const dat = btn.getAttribute('data-data'); const hor = btn.getAttribute('data-hora') || "09:00"; const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${tit}\nDTSTART:${dat.replace(/-/g,'')}T${hor.replace(':','')}00Z\nDTEND:${dat.replace(/-/g,'')}T${(parseInt(hor.split(':')[0])+1).toString().padStart(2,'0')}${hor.split(':')[1]}00Z\nDESCRIPTION:Evento agendado via TurmaPRO\nEND:VEVENT\nEND:VCALENDAR`; const blob = new Blob([icsContent], { type: 'text/calendar' }); const url = URL.createObjectURL(blob); const a = document.createElement('a'); a.href = url; a.download = `${tit.replace(/\s+/g,'_')}.ics`; document.body.appendChild(a); a.click(); document.body.removeChild(a); return; }

    if (e.target.closest('#btn-abrir-aviso-global') || e.target.closest('#btn-abrir-aviso-global-coord')) { let options = ''; if (state.activeRole === 'coordenador') { options = '<option value="todas">Todas as minhas turmas</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join(''); } else { options = `<option value="${state.selectedTurma}">Turma ${state.selectedTurma}</option>`; } document.getElementById('aviso-destino-turma').innerHTML = options; document.getElementById('aviso-titulo').value = ''; document.getElementById('aviso-mensagem').value = ''; document.getElementById('modal-aviso-global').style.display = 'flex'; return; }
    
    if (e.target.closest('#btn-enviar-aviso-global')) { const destino = document.getElementById('aviso-destino-turma').value; const titulo = document.getElementById('aviso-titulo').value.trim(); const mensagem = document.getElementById('aviso-mensagem').value.trim(); if (!titulo || !mensagem) return alert("Preenche o título e a mensagem do aviso."); const btn = e.target.closest('#btn-enviar-aviso-global'); const originalText = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; try { let turmasAlvo = destino === 'todas' ? state.turmasProfessor : [destino]; for (const t of turmasAlvo) { await addDoc(collection(db, "turmas", t, "avisos"), { titulo: titulo, mensagem: mensagem, autor: state.myUserName, papel: state.activeRole, timestamp: Date.now() }); } btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviado'; setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; document.getElementById('modal-aviso-global').style.display = 'none'; }, 1500); } catch (err) { btn.innerHTML = 'Erro!'; setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 2000); } return; }

    if (e.target.closest('#btn-ver-pauta')) { renderizarPautaTurma(); return; }
    if (e.target.closest('#btn-ver-faltas-turma')) { renderizarFaltasTurma(); return; }
    if (e.target.closest('#btn-radar-conflitos')) { gerarRadarConflitos(); return; }
    
    if (e.target.closest('.btn-validar-fct')) { validarFCT(e.target.closest('.btn-validar-fct').getAttribute('data-id'), e.target.closest('.btn-validar-fct')); return; }
    if (e.target.closest('.btn-aprovar-tema')) { aprovarTemaPAP(e.target.closest('.btn-aprovar-tema').getAttribute('data-id'), e.target.closest('.btn-aprovar-tema')); return; }
    if (e.target.closest('.btn-rejeitar-tema')) { document.getElementById('rej-pap-aluno-id').value = e.target.closest('.btn-rejeitar-tema').getAttribute('data-id'); document.getElementById('rej-pap-motivo').value = ''; document.getElementById('modal-rejeitar-tema-pap').style.display = 'flex'; return; }
    if (e.target.closest('#btn-confirmar-rejeicao-pap')) { const motivo = document.getElementById('rej-pap-motivo').value.trim(); if(!motivo) return alert("Indica o motivo."); rejeitarTemaPAPExecutar(document.getElementById('rej-pap-aluno-id').value, motivo, e.target.closest('#btn-confirmar-rejeicao-pap')); return; }
    if (e.target.closest('.btn-aprovar-relatorio')) { aprovarRelatorioPAP(e.target.closest('.btn-aprovar-relatorio').getAttribute('data-id'), e.target.closest('.btn-aprovar-relatorio')); return; }

    // PRHF AÇÕES
    if (e.target.closest('#btn-novo-prhf')) {
        document.getElementById('erro-modal-prhf').style.display = 'none'; document.getElementById('prhf-urgente').checked = false;
        document.getElementById('prhf-turma').innerHTML = '<option value="">-- Turma --</option>' + state.turmasProfessor.map(t => `<option value="${t}">${t}</option>`).join('');
        const permitidas = getDisciplinasPermitidas();
        document.getElementById('prhf-disciplina').innerHTML = permitidas.length > 0 ? permitidas.map(dc => `<option value="${dc}">${dc}</option>`).join('') : '<option value="">Sem disciplinas</option>';
        document.getElementById('prhf-modulo').innerHTML = '<option value="">Mod...</option>';
        document.getElementById('prhf-file').value = ''; state.prhfBase64 = null; document.getElementById('prhf-file-name').innerText = 'Toca para PDF ou Imagem';
        document.getElementById('prhf-horas-totais').value = ''; document.getElementById('prhf-horas-presenciais').value = '';
        document.getElementById('modal-criar-prhf').style.display = 'flex'; return;
    }
    if (e.target.closest('#btn-gravar-novo-prhf')) { const tTurma = document.getElementById('prhf-turma').value; const tAluno = document.getElementById('prhf-aluno').value; const tDisc = document.getElementById('prhf-disciplina').value; const tMod = document.getElementById('prhf-modulo').value; const tPrazo = document.getElementById('prhf-prazo').value; const tHorasT = document.getElementById('prhf-horas-totais').value; const tHorasP = document.getElementById('prhf-horas-presenciais').value; const tDesc = document.getElementById('prhf-descricao').value.trim(); const urg = document.getElementById('prhf-urgente').checked; const errDiv = document.getElementById('erro-modal-prhf'); if (!tAluno || !tDisc || !tMod || !tHorasT || !tPrazo || !tDesc) { errDiv.innerText = "Por favor, preenche todos os campos obrigatórios."; errDiv.style.display = 'block'; return; } const b = e.target.closest('#btn-gravar-novo-prhf'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { await addDoc(collection(db, "utilizadores", tAluno, "prhfs"), { disciplina: tDisc, modulo: Number(tMod), prazo: tPrazo, horasTotais: Number(tHorasT), horasPresenciais: Number(tHorasP), descricao: tDesc, status: 'pendente', dataCriacao: new Date().toISOString(), professor: state.myUserName, ficheiroBase64: state.prhfBase64, urgente: urg, presencaValidada: false }); b.innerHTML = '<i class="fa-solid fa-check"></i> Atribuído'; setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Atribuir PRHF'; b.disabled = false; document.getElementById('modal-criar-prhf').style.display = 'none'; carregarTarefasProf(); analisarEAtualizarTurma(state.selectedTurma); }, 1500); } catch (err) { errDiv.innerText = "Erro ao gravar. Tenta de novo."; errDiv.style.display = 'block'; b.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Atribuir PRHF'; b.disabled = false; } return; }
    if (e.target.closest('.btn-validar-presenca')) { const btn = e.target.closest('.btn-validar-presenca'); const aId = btn.getAttribute('data-aluno'); const pId = btn.getAttribute('data-prhf'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; try { await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { presencaValidada: true }); carregarTarefasProf(); } catch (err) { btn.innerHTML = "Erro"; btn.disabled = false; } return; }
    if (e.target.closest('.btn-propor-prof')) { const btn = e.target.closest('.btn-propor-prof'); document.getElementById('prop-prof-aluno-id').value = btn.getAttribute('data-aluno'); document.getElementById('prop-prof-prhf-id').value = btn.getAttribute('data-prhf'); document.getElementById('prop-prof-data').value = ''; document.getElementById('prop-prof-inicio').value = ''; document.getElementById('prop-prof-fim').value = ''; document.getElementById('modal-propor-prhf-prof').style.display = 'flex'; return; }
    if (e.target.closest('#btn-confirmar-proposta-prof')) { const aId = document.getElementById('prop-prof-aluno-id').value; const pId = document.getElementById('prop-prof-prhf-id').value; const pd = document.getElementById('prop-prof-data').value; const pi = document.getElementById('prop-prof-inicio').value; const pf = document.getElementById('prop-prof-fim').value; if(!pd || !pi || !pf) return alert("Preenche todos os campos."); const btn = e.target.closest('#btn-confirmar-proposta-prof'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; try { await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { propostaProfessor: `Dia ${pd.split('-').reverse().join('/')} das ${pi} às ${pf}` }); btn.innerHTML = '<i class="fa-solid fa-check"></i> Sugerido'; setTimeout(() => { btn.innerHTML = 'Sugerir Horário'; btn.disabled = false; document.getElementById('modal-propor-prhf-prof').style.display = 'none'; carregarTarefasProf(); }, 1500); } catch(err) { btn.innerHTML = 'Erro'; setTimeout(()=>btn.disabled=false, 1500); } return; }
    if (e.target.closest('.btn-concluir-prhf')) { const btn = e.target.closest('.btn-concluir-prhf'); document.getElementById('conc-aluno-id').value = btn.getAttribute('data-aluno'); document.getElementById('conc-prhf-id').value = btn.getAttribute('data-prhf'); document.getElementById('conc-motivo').value = ''; document.getElementById('modal-concluir-prhf').style.display = 'flex'; return; }
    if (e.target.closest('#btn-confirmar-conclusao-prhf')) { const aId = document.getElementById('conc-aluno-id').value; const pId = document.getElementById('conc-prhf-id').value; const feedback = document.getElementById('conc-motivo').value.trim() || "Concluído com sucesso."; const b = e.target.closest('#btn-confirmar-conclusao-prhf'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { status: 'concluida', feedbackProfessor: feedback }); b.innerHTML = '<i class="fa-solid fa-check"></i> Plano Fechado'; setTimeout(() => { b.innerHTML = 'Aprovar e Fechar Plano'; b.disabled = false; document.getElementById('modal-concluir-prhf').style.display = 'none'; carregarTarefasProf(); analisarEAtualizarTurma(state.selectedTurma); }, 1500); } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); } return; }

    // FALTAS
    if (e.target.closest('#btn-modal-faltas')) {
        if (!state.selectedTurma || state.alunosTurmaRAM.length === 0) return alert("Seleciona uma turma com alunos primeiro.");
        document.getElementById('erro-modal-faltas').style.display = 'none';
        document.getElementById('global-falta-turma-container').style.display = 'none'; // Estamos dentro de uma turma
        
        const permitidas = filtrarDisciplinasDoAno(state.selectedTurma, getDisciplinasPermitidas()); 
        const discFalta = document.getElementById('lancar-falta-disciplina');
        discFalta.innerHTML = permitidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); discFalta.style.display = permitidas.length > 1 ? 'block' : 'none';
        atualizarDropdownModulos(state.selectedTurma, (permitidas[0]||"Geral"), document.getElementById('falta-modulo-select'));
        const c = document.getElementById('lista-metralhadora-faltas'); let h = '';
        state.alunosTurmaRAM.forEach(al => { h += `<label style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); margin-bottom:5px; border-radius:8px; border:1px solid #333; cursor:pointer;"><span style="color:white; font-size:0.95rem;">${nomeCurto(al.nome)}</span><input type="checkbox" class="chk-falta" value="${al.id}" style="width:18px;height:18px;accent-color:var(--danger-red);"></label>`; });
        c.innerHTML = h; document.getElementById('modal-marcar-faltas').style.display = 'flex'; return;
    }
    if (e.target.closest('#lancar-falta-disciplina')) {
        const t = document.getElementById('lancar-falta-turma').value || state.selectedTurma;
        const disc = document.getElementById('lancar-falta-disciplina').value;
        atualizarDropdownModulos(t, disc, document.getElementById('falta-modulo-select'));
    }
    if (e.target.closest('#btn-confirmar-faltas')) {
        const aulaMinutos = document.getElementById('falta-aula-select').value; const modSelect = document.getElementById('falta-modulo-select').value;
        const discSelect = document.getElementById('lancar-falta-disciplina'); const disc = discSelect.style.display === 'block' ? discSelect.value : (state.disciplinasProfessor[0] || "Geral");
        const errDiv = document.getElementById('erro-modal-faltas');
        if (!aulaMinutos || !modSelect) { errDiv.innerText = "Seleciona a duração e o módulo associado."; errDiv.style.display = 'block'; return; }
        const horasFormatadas = Number(aulaMinutos); const b = e.target.closest('#btn-confirmar-faltas'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        const ausentes = document.querySelectorAll('.chk-falta:checked');
        for (const chk of ausentes) { await addDoc(collection(db, "utilizadores", chk.value, "faltas"), { disciplina: disc, modulo: modSelect, horas: horasFormatadas, dataInicio: new Date().toISOString().split('T')[0], justificada: false, criadoPor: state.myUserName, criadoEm: new Date().toISOString() }); }
        b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; setTimeout(() => { b.innerHTML = 'Gravar Faltas'; b.disabled = false; document.getElementById('modal-marcar-faltas').style.display = 'none'; if(state.selectedTurma) analisarEAtualizarTurma(state.selectedTurma); carregarRadarProfessor();}, 1500); return;
    }

    // NOTAS
    if (e.target.closest('#btn-modal-notas')) {
        if (!state.selectedTurma || state.alunosTurmaRAM.length === 0) return alert("Seleciona turma primeiro.");
        document.getElementById('erro-modal-notas').style.display = 'none';
        const permitidas = filtrarDisciplinasDoAno(state.selectedTurma, getDisciplinasPermitidas()); 
        const selDisc = document.getElementById('lancar-nota-disciplina');
        selDisc.innerHTML = permitidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); selDisc.style.display = permitidas.length > 1 ? 'block' : 'none';
        atualizarDropdownModulos(state.selectedTurma, (permitidas[0]||"Geral"), document.getElementById('lancar-nota-modulo'));
        
        const grid = document.getElementById('grid-notas-alunos'); let h = '';
        state.alunosTurmaRAM.forEach(al => { 
            h += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); border-radius:8px; border:1px solid #333;">
                <div style="display:flex; align-items:center; gap:10px;"><img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;"><span style="color:white; font-size:0.9rem;">${nomeCurto(al.nome)}</span></div>
                <div class="caixa-nota-aluno" data-id="${al.id}" style="width: 70px; height: 40px; background: var(--bg-dark); border: 1px solid #333; border-radius: 8px; display: flex; align-items: center; justify-content: center; font-weight: bold; cursor: pointer; color: white;">-</div>
            </div>`; 
        });
        grid.innerHTML = h; document.getElementById('modal-lancamento-notas').style.display = 'flex'; return;
    }

    if (e.target.closest('#lancar-nota-disciplina')) {
        const disc = document.getElementById('lancar-nota-disciplina').value;
        atualizarDropdownModulos(state.selectedTurma, disc, document.getElementById('lancar-nota-modulo'));
    }

    if (e.target.closest('.caixa-nota-aluno')) {
        const caixa = e.target.closest('.caixa-nota-aluno');
        document.getElementById('teclado-nota-aluno-id').value = caixa.getAttribute('data-id');
        document.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected'));
        document.getElementById('area-justificacao-rep').style.display = 'none';
        document.getElementById('texto-justificacao-rep').value = '';
        document.getElementById('modal-teclado-notas').style.display = 'flex';
        return;
    }
    
    if (e.target.closest('.grade-btn')) {
        document.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected'));
        const btn = e.target.closest('.grade-btn'); btn.classList.add('selected');
        if (btn.getAttribute('data-val') === 'REP') { document.getElementById('area-justificacao-rep').style.display = 'block'; } else { document.getElementById('area-justificacao-rep').style.display = 'none'; }
        return;
    }

    if (e.target.closest('#btn-salvar-nota-teclado')) {
        const selectedBtn = document.querySelector('.grade-btn.selected'); if (!selectedBtn) return alert("Seleciona uma nota primeiro.");
        const val = selectedBtn.getAttribute('data-val'); const just = document.getElementById('texto-justificacao-rep').value.trim();
        if (val === 'REP' && !just) return alert("A justificação é obrigatória para atribuição de REP.");
        const aId = document.getElementById('teclado-nota-aluno-id').value; const caixa = document.querySelector(`.caixa-nota-aluno[data-id="${aId}"]`);
        if(caixa) { caixa.innerText = val; caixa.setAttribute('data-nota', val); caixa.setAttribute('data-justificacao', just); caixa.style.color = val === 'REP' ? 'var(--danger-red)' : 'var(--success-green)'; caixa.style.borderColor = val === 'REP' ? 'var(--danger-red)' : 'var(--success-green)'; }
        document.getElementById('modal-teclado-notas').style.display = 'none'; return;
    }

    if (e.target.closest('#btn-confirmar-notas')) {
        const discSelect = document.getElementById('lancar-nota-disciplina'); const disc = discSelect.style.display === 'block' ? discSelect.value : (state.disciplinasProfessor[0] || "Geral"); 
        const mod = document.getElementById('lancar-nota-modulo').value; const errDiv = document.getElementById('erro-modal-notas');
        if (!mod) { errDiv.innerText = "Preenche o módulo."; errDiv.style.display = 'block'; return; }
        const caixas = document.querySelectorAll('.caixa-nota-aluno'); let notasParaGravar = []; 
        caixas.forEach(caixa => { const v = caixa.getAttribute('data-nota'); const just = caixa.getAttribute('data-justificacao') || ''; if (v) notasParaGravar.push({ id: caixa.getAttribute('data-id'), nota: v, justificacao: just }); });
        if (notasParaGravar.length === 0) { errDiv.innerText = "Não selecionaste notas no quadro."; errDiv.style.display = 'block'; return; }
        const b = e.target.closest('#btn-confirmar-notas'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try { for (const n of notasParaGravar) { await addDoc(collection(db, "utilizadores", n.id, "notas"), { disciplina: disc, modulo: Number(mod), nota: n.nota, justificacao: n.justificacao, data: new Date().toISOString(), professor: state.myUserName }); } b.innerHTML = '<i class="fa-solid fa-check"></i> Gravadas'; setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-save"></i> Gravar Notas'; b.disabled = false; document.getElementById('modal-lancamento-notas').style.display = 'none'; analisarEAtualizarTurma(state.selectedTurma); }, 1500); } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); } return;
    }

    // MATERIAIS, SUMÁRIOS E AGENDA 
    if (e.target.closest('#btn-modal-materiais')) { 
        if (!state.selectedTurma) return alert("Seleciona turma primeiro."); 
        document.getElementById('global-sumario-turma-container').style.display = 'none';
        document.getElementById('mat-titulo').value = ''; 
        document.getElementById('mat-sumario').value = ''; 
        const permitidas = filtrarDisciplinasDoAno(state.selectedTurma, getDisciplinasPermitidas()); 
        const matDisc = document.getElementById('mat-disciplina'); 
        matDisc.innerHTML = permitidas.length > 0 ? permitidas.map(dc => `<option value="${dc}">${dc}</option>`).join('') : '<option value="">Geral</option>'; 
        matDisc.style.display = permitidas.length > 1 ? 'block' : 'none'; 
        document.getElementById('mat-file').value = ''; state.materialBase64 = null; 
        document.getElementById('mat-file-name').innerText = 'Toca para selecionar PDF'; 
        document.getElementById('modal-materiais').style.display = 'flex'; return; 
    }
    if (e.target.closest('#btn-gravar-material')) { 
        const tit = document.getElementById('mat-titulo').value.trim(); 
        const tTurma = document.getElementById('lancar-sumario-turma')?.value || state.selectedTurma;
        const matDisc = document.getElementById('mat-disciplina'); 
        const disc = matDisc.style.display === 'block' ? matDisc.value : (state.disciplinasProfessor[0] || "Geral"); 
        const sumarioText = document.getElementById('mat-sumario').value.trim();
        if (!tit || !tTurma) return alert("Título e Turma são obrigatórios."); 
        
        const b = e.target.closest('#btn-gravar-material'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; 
        try { 
            await addDoc(collection(db, "turmas", tTurma, "sumarios"), { 
                titulo: tit, disciplina: disc, professor: state.myUserName, 
                data: new Date().toLocaleDateString('pt-PT'), 
                descricao: sumarioText || (state.materialBase64 ? "Ficheiro em anexo." : "Material partilhado pelo professor."), 
                ficheiroBase64: state.materialBase64, timestamp: Date.now() 
            }); 
            b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; 
            setTimeout(() => { b.innerHTML = 'Registar Aula'; b.disabled = false; document.getElementById('modal-materiais').style.display = 'none'; }, 1500); 
        } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); } return; 
    }

    if (e.target.closest('#btn-modal-agenda')) { if (!state.selectedTurma) return alert("Seleciona turma primeiro."); const permitidas = filtrarDisciplinasDoAno(state.selectedTurma, getDisciplinasPermitidas()); const sd = document.getElementById('agendar-disciplina'); sd.innerHTML = permitidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); sd.style.display = permitidas.length > 1 ? 'block' : 'none'; document.getElementById('evento-titulo').value = ''; document.getElementById('evento-data').value = ''; document.getElementById('evento-hora').value = ''; document.getElementById('evento-hora').style.display = 'none'; document.getElementById('evento-periodo').value = 'dia'; document.getElementById('modal-agendar-evento').style.display = 'flex'; return; }
    if (e.target.closest('#btn-gravar-evento')) { const t = document.getElementById('evento-titulo').value.trim(); const d = document.getElementById('evento-data').value; const tp = document.getElementById('evento-tipo').value; const p = document.getElementById('evento-periodo').value; const h = document.getElementById('evento-hora').value; const sd = document.getElementById('agendar-disciplina'); const disc = sd.style.display === 'block' ? sd.value : (state.disciplinasProfessor[0] || "Geral"); if (!t || !d) return alert("Preenche Título e Data."); if (p === 'hora' && !h) return alert("Preenche a hora exata do evento."); const b = e.target.closest('#btn-gravar-evento'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { await addDoc(collection(db, "turmas", state.selectedTurma, "eventos"), { titulo: `[${disc}] ${t}`, data: d, tipo: tp, periodo: p, hora: h, professor: state.myUserName }); b.innerHTML = '<i class="fa-solid fa-check"></i> Agendado'; setTimeout(() => { b.innerHTML = 'Agendar'; b.disabled = false; document.getElementById('modal-agendar-evento').style.display = 'none'; carregarRadarProfessor(); analisarEAtualizarTurma(state.selectedTurma); }, 1500); } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); } return; }
    
    // OCORRENCIAS E SÍNTESES
    if (e.target.closest('#btn-dar-positiva')) { if (!state.alunoSelecionadoId) return; document.getElementById('global-oco-turma-container').style.display = 'none'; document.getElementById('oco-tipo').value = 'positiva'; document.getElementById('oco-titulo').innerHTML = '<i class="fa-solid fa-star" style="color:var(--success-green);"></i> Ocorrência Positiva'; document.getElementById('oco-motivo').value = ''; document.getElementById('btn-gravar-ocorrencia').style.background = 'var(--success-green)'; document.getElementById('modal-ocorrencia').style.display = 'flex'; return; }
    if (e.target.closest('#btn-dar-negativa')) { if (!state.alunoSelecionadoId) return; document.getElementById('global-oco-turma-container').style.display = 'none'; document.getElementById('oco-tipo').value = 'negativa'; document.getElementById('oco-titulo').innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger-red);"></i> Ocorrência Negativa'; document.getElementById('oco-motivo').value = ''; document.getElementById('btn-gravar-ocorrencia').style.background = 'var(--danger-red)'; document.getElementById('modal-ocorrencia').style.display = 'flex'; return; }
    
    if (e.target.closest('#btn-gravar-ocorrencia')) { 
        const tipo = document.getElementById('oco-tipo').value; 
        const motivo = document.getElementById('oco-motivo').value.trim(); 
        const aId = (tipo === 'geral') ? document.getElementById('oco-global-aluno').value : state.alunoSelecionadoId;
        const notificarEE = document.getElementById('oco-notificar-ee').checked;
        
        if (!motivo || !aId) return alert("Preenche todos os campos (Aluno e Motivo)!"); 
        
        const b = e.target.closest('#btn-gravar-ocorrencia'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; 
        try { 
            const finalTipo = (tipo === 'geral') ? 'negativa' : tipo; // FAB regista sempre como atenção
            if (finalTipo === 'positiva') { 
                const uS = await getDoc(doc(db, "utilizadores", aId)); let axp = uS.exists() && uS.data().xp ? uS.data().xp : 0; 
                await addDoc(collection(db, "utilizadores", aId, "ocorrencias"), { titulo: "Reconhecimento Positivo", descricao: motivo, tipo: "positiva", notificadoEE: notificarEE, autor: state.myUserName, timestamp: Date.now(), data: new Date().toLocaleDateString('pt-PT') }); 
                await updateDoc(doc(db, "utilizadores", aId), { xp: axp + 50 }); 
            } else { 
                await addDoc(collection(db, "utilizadores", aId, "ocorrencias"), { titulo: "Registo de Aula", descricao: motivo, tipo: "negativa", notificadoEE: notificarEE, autor: state.myUserName, timestamp: Date.now(), data: new Date().toLocaleDateString('pt-PT') }); 
            } 
            b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; 
            setTimeout(() => { b.innerHTML = 'Confirmar Registo'; b.disabled = false; document.getElementById('modal-ocorrencia').style.display = 'none'; if(document.getElementById('modal-perfil-aluno').style.display === 'flex') { abrirPerfil360Aluno(aId); } if(state.selectedTurma) analisarEAtualizarTurma(state.selectedTurma); }, 1500); 
        } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); } return; 
    }

    if (e.target.closest('#btn-justificar-faltas')) { if (!state.alunoSelecionadoId) return; document.getElementById('modal-confirm-justificar').style.display = 'flex'; return; }
    if (e.target.closest('#btn-executar-justificar')) { const b = e.target.closest('#btn-executar-justificar'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { const fS = await getDocs(query(collection(db, "utilizadores", state.alunoSelecionadoId, "faltas"), where("justificada", "==", false))); for (const f of fS.docs) { await updateDoc(doc(db, "utilizadores", state.alunoSelecionadoId, "faltas", f.id), { justificada: true, justificadaPor: state.myUserName }); } b.innerHTML = '<i class="fa-solid fa-check"></i> Faltas Justificadas'; setTimeout(() => { b.innerHTML = 'Sim, Justificar'; b.disabled = false; document.getElementById('modal-confirm-justificar').style.display = 'none'; abrirPerfil360Aluno(state.alunoSelecionadoId); analisarEAtualizarTurma(state.selectedTurma); }, 2000); } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 2000); } return; }
    if (e.target.closest('#btn-salvar-obs-dt')) { 
        if (!state.alunoSelecionadoId) return; const txt = document.getElementById('p-aluno-obs-dt').value.trim(); const b = e.target.closest('#btn-salvar-obs-dt'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; 
        try { 
            const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT); 
            if (isDT) { 
                await setDoc(doc(db, "utilizadores", state.alunoSelecionadoId, "reunioes", "1_avaliacao"), { global: txt }, { merge: true }); 
            } else { 
                const disc = document.getElementById('perfil-disc-select').value || 'geral'; 
                const momento = document.getElementById('sintese-momento').value;
                await setDoc(doc(db, "utilizadores", state.alunoSelecionadoId, "reunioes", `sintese_${disc}_${momento}`), { texto: txt }, { merge: true }); 
            } 
            b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; b.style.backgroundColor = "var(--success-green)"; setTimeout(() => { b.innerHTML = 'Gravar Síntese'; b.disabled = false; b.style.backgroundColor = "var(--primary-green)"; }, 2000); 
        } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 2000); } return; 
    }
});
