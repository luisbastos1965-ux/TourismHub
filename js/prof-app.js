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

// UTILITÁRIO: Extrair Iniciais Corretas
function getIniciais(nomeStr) {
    if (!nomeStr) return "PR";
    const parts = nomeStr.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
}

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
                    
                    state.myUserName = state.profData.nome || state.profData.nomeCompleto || state.profData.Nome || state.myUserId;
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
                    
                    // CORREÇÃO AVATAR INICIAIS (Apenas Primeira e Última Letra)
                    const iniciais = getIniciais(state.myUserName);
                    const fotoUrl = state.profData.fotoPerfil || `https://ui-avatars.com/api/?name=${iniciais}&background=333&color=fff&font-size=0.4`;
                    
                    document.getElementById('header-avatar-circle').innerHTML = `<img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    document.getElementById('prof-avatar-img').src = fotoUrl;
                    
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

// LÓGICA DA PLANTA DA SALA
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
    
    let html = `<div style="background:#555; color:white; text-align:center; padding:5px; border-radius:4px; margin-bottom:20px; font-weight:bold; font-size:0.8rem; border:2px solid #888;">QUADRO DA SALA</div>`;
    
    html += `<div style="display:flex; flex-direction:column; gap:15px; align-items:center;">`;
    for (let l = 0; l < config.linhas; l++) {
        html += `<div style="display:flex; gap:20px;">`; 
        for (let c = 0; c < config.colunas; c++) {
            if (config.formato === 'mista_centro_individual') {
                if (c === 1) { 
                    html += `<div class="mesa-planta" data-mesa="${l}-${c}" style="width:60px; height:60px; background:#1c1f26; border:1px dashed #555; border-radius:8px; display:flex; justify-content:center; align-items:center; text-align:center; font-size:0.75rem; color:var(--text-muted);">Vazio</div>`;
                } else { 
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
            else { 
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

    // BOTÃO GERAR PLANTA DA SALA - CÉREBRO LEXICAL HÍBRIDO
    if (e.target.closest('#btn-gerar-planta')) {
        const salaId = document.getElementById('planta-sala-select').value;
        const instrucoes = document.getElementById('planta-instrucoes-ia').value.toLowerCase();
        if(!salaId) return;

        const btn = document.getElementById('btn-gerar-planta');
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A calcular otimização...';
        btn.disabled = true;

        setTimeout(() => {
            let alunos = state.alunosTurmaRAM.map(al => {
                return {
                    id: al.id,
                    nome: al.nome,
                    primeiroNome: al.nome.split(' ')[0],
                    risco: Math.floor(Math.random() * 10)
                };
            });

            let naFrente = [];
            let noFundo = [];
            let separar = []; 

            const frases = instrucoes.split(/[.,\n]/);
            frases.forEach(frase => {
                let nomesNaFrase = alunos.filter(a => frase.includes(a.primeiroNome.toLowerCase()));
                if(frase.includes('frente') || frase.includes('primeira')) {
                    nomesNaFrase.forEach(n => naFrente.push(n.id));
                }
                if(frase.includes('fundo') || frase.includes('trás') || frase.includes('ultima') || frase.includes('última')) {
                    nomesNaFrase.forEach(n => noFundo.push(n.id));
                }
                if(frase.includes('separar') || frase.includes('afastar') || frase.includes('longe')) {
                    if(nomesNaFrase.length >= 2) separar.push([nomesNaFrase[0].id, nomesNaFrase[1].id]);
                }
            });

            let modoAleatorio = instrucoes.includes('aleat');
            let modoAlfabetico = instrucoes.includes('alfab');

            if (modoAlfabetico) {
                alunos.sort((a,b) => a.nome.localeCompare(b.nome));
            } else if (modoAleatorio) {
                alunos.sort(() => 0.5 - Math.random());
            } else {
                alunos.sort((a,b) => b.risco - a.risco);
            }

            const mesasDOM = Array.from(document.querySelectorAll('.mesa-planta'));
            let slots = mesasDOM.map(m => {
                const dataMesa = m.getAttribute('data-mesa'); 
                const parts = dataMesa.split('-');
                return {
                    el: m,
                    id: dataMesa,
                    linha: parseInt(parts[0]),
                    coluna: parseInt(parts[1]),
                    parId: parts.length === 3 ? `${parts[0]}-${parts[1]}` : dataMesa,
                    aluno: null
                };
            });

            let unassigned = [...alunos];
            const assign = (alunoId, slotCondition) => {
                const alIndex = unassigned.findIndex(a => a.id === alunoId);
                if(alIndex === -1) return;
                const al = unassigned[alIndex];
                const slot = slots.find(s => s.aluno === null && slotCondition(s));
                if(slot) {
                    slot.aluno = al;
                    unassigned.splice(alIndex, 1);
                }
            };

            naFrente.forEach(id => assign(id, s => s.linha === 0));
            let maxLinha = Math.max(...slots.map(s => s.linha));
            noFundo.forEach(id => assign(id, s => s.linha === maxLinha));

            unassigned.forEach(al => {
                const slot = slots.find(s => s.aluno === null);
                if(slot) slot.aluno = al;
            });

            separar.forEach(par => {
                const s1 = slots.find(s => s.aluno?.id === par[0]);
                const s2 = slots.find(s => s.aluno?.id === par[1]);
                if(s1 && s2 && s1.parId === s2.parId) {
                    const s3 = slots.find(s => s.aluno !== null && s.parId !== s1.parId && s.aluno.id !== par[0] && s.aluno.id !== par[1]);
                    if(s3) {
                        const temp = s2.aluno;
                        s2.aluno = s3.aluno;
                        s3.aluno = temp;
                    }
                }
            });

            slots.forEach(s => {
                if(s.aluno) {
                    s.el.innerText = s.aluno.primeiroNome;
                    s.el.style.color = 'white';
                    s.el.style.borderColor = 'var(--primary-green)';
                    s.el.style.background = 'rgba(0, 204, 136, 0.15)';
                } else {
                    s.el.innerText = 'Vazio';
                    s.el.style.color = 'var(--text-muted)';
                    s.el.style.borderColor = '#555';
                    s.el.style.background = '#1c1f26';
                }
            });

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Refazer Disposição';
            btn.disabled = false;
            document.getElementById('btn-exportar-planta').style.display = 'block';
        }, 800);
        return;
    }

    // FÓRUM AÇÕES RESTAURADAS
    if (e.target.closest('.btn-edit-chat')) { e.stopPropagation(); const btn = e.target.closest('.btn-edit-chat'); const cId = btn.getAttribute('data-id'); const t = btn.getAttribute('data-turma'); document.getElementById('edit-forum-id').value = cId; document.getElementById('edit-forum-turma').value = t; const mCont = document.getElementById('lista-alunos-edit-forum'); mCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; document.getElementById('modal-editar-forum').style.display = 'flex'; try { const chatSnap = await getDoc(doc(db, "turmas", t, "foruns", cId)); if(chatSnap.exists()) { document.getElementById('input-nome-edit-forum').value = chatSnap.data().nome; const membrosAtuais = chatSnap.data().membros || []; const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); let cH = ''; cS.forEach(d => { const isChecked = membrosAtuais.includes(d.id) ? 'checked' : ''; cH += `<label style="display:flex; align-items:center; gap:10px; color:white; font-size:0.9rem; padding:8px 0; cursor:pointer;"><input type="checkbox" class="edit-forum-aluno-check" value="${d.id}" ${isChecked} style="width:18px;height:18px;accent-color:var(--warning-yellow);"> ${nomeCurto(d.data().nome)}</label>`; }); mCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH; } } catch(err) { mCont.innerHTML = '<p class="text-danger center">Erro.</p>'; } return; }
    if (e.target.closest('#btn-guardar-edit-forum')) { const cId = document.getElementById('edit-forum-id').value; const t = document.getElementById('edit-forum-turma').value; const novoNome = document.getElementById('input-nome-edit-forum').value.trim(); let mbr = [state.myUserId]; document.querySelectorAll('.edit-forum-aluno-check:checked').forEach(c => mbr.push(c.value)); if(!novoNome) return alert("O nome não pode estar vazio."); const btn = e.target.closest('#btn-guardar-edit-forum'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; try { await updateDoc(doc(db, "turmas", t, "foruns", cId), { nome: novoNome, membros: mbr }); document.getElementById('modal-editar-forum').style.display = 'none'; btn.innerHTML = 'Guardar Alterações'; btn.disabled = false; carregarForunsProf(); } catch(err) { btn.innerHTML = 'Erro!'; setTimeout(() => { btn.innerHTML = 'Guardar Alterações'; btn.disabled = false; }, 2000); } return; }
    if (e.target.closest('#btn-apagar-forum')) { if(confirm("Apagar definitivamente este grupo de chat?")) { const cId = document.getElementById('edit-forum-id').value; const t = document.getElementById('edit-forum-turma').value; const btn = e.target.closest('#btn-apagar-forum'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; try { await deleteDoc(doc(db, "turmas", t, "foruns", cId)); document.getElementById('modal-editar-forum').style.display = 'none'; btn.innerHTML = '<i class="fa-solid fa-trash"></i> Apagar Chat Definitivamente'; btn.disabled = false; carregarForunsProf(); } catch(err) { btn.innerHTML = 'Erro!'; setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-trash"></i> Apagar Chat Definitivamente'; btn.disabled = false; }, 2000); } } return; }
    if (e.target.closest('.canal-card')) { const card = e.target.closest('.canal-card'); abrirChatForum(card.getAttribute('data-turma'), card.getAttribute('data-disc'), card.getAttribute('data-nome')); return; }
    if (e.target.closest('#btn-prof-voltar-canais')) { if (state.chatUnsubscribe) { state.chatUnsubscribe(); state.chatUnsubscribe = null; } document.getElementById('prof-forum-chat-view').style.display = 'none'; document.getElementById('btn-create-chat-prof').style.display = 'block'; document.getElementById('prof-forum-channel-list').style.display = 'block'; return; }
    if (e.target.closest('#btn-prof-send-msg')) { const msgInput = document.getElementById('prof-input-forum-msg'); const msg = msgInput.value.trim(); if (!msg || !state.activeChatTurma || !state.activeChatDisc) return; try { await addDoc(collection(db, "turmas", state.activeChatTurma, "foruns", state.activeChatDisc, "mensagens"), { texto: msg, autor: state.myUserName, papel: "professor", timestamp: Date.now() }); msgInput.value = ''; } catch (err) { alert("Erro ao enviar."); } return; }
    if (e.target.closest('#btn-create-chat-prof')) { document.getElementById('forum-turma-select').innerHTML = '<option value="">Selecionar Turma...</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join(''); document.getElementById('input-nome-novo-forum').value = ''; document.getElementById('lista-alunos-forum').innerHTML = '<p class="text-muted center" style="font-size:0.8rem;">Seleciona turma primeiro.</p>'; document.getElementById('modal-criar-forum').style.display = 'flex'; return; }
    if (e.target.closest('#btn-cancelar-novo-forum')) { document.getElementById('modal-criar-forum').style.display = 'none'; return; }
    if (e.target.closest('#btn-confirm-novo-forum')) { const nome = document.getElementById('input-nome-novo-forum').value.trim(); const turma = document.getElementById('forum-turma-select').value; if(!nome || !turma) return alert("Preenche o nome do chat e a turma."); let mbr = [state.myUserId]; document.querySelectorAll('.forum-aluno-check:checked').forEach(c => mbr.push(c.value)); const btnConf = e.target.closest('#btn-confirm-novo-forum'); btnConf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btnConf.disabled = true; try { await addDoc(collection(db, "turmas", turma, "foruns"), { nome: nome, tipo: 'permanente', isDefault: false, membros: mbr, criadoPor: state.myUserName }); document.getElementById('modal-criar-forum').style.display = 'none'; btnConf.innerHTML = 'Criar Chat'; btnConf.disabled = false; carregarForunsProf(); } catch(err) { btnConf.innerHTML = 'Erro!'; setTimeout(() => { btnConf.innerHTML = 'Criar Chat'; btnConf.disabled = false; }, 2000); } return; }

    // COPILOTO IA (SÍNTESES)
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

});
