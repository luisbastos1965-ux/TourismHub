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

// IMPORTAÇÃO DOS NOVOS MÓDULOS DE RESPONSABILIDADE
import { gerirCliquesForum } from "./prof/roles/forum.js";
import { gerirCliquesPRHF } from "./prof/roles/prhf.js";


function getIniciais(nomeStr) {
    if (!nomeStr) return "PR";
    const parts = nomeStr.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
}

function esconderTodasAsVistas() { 
    document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none'); 
}


// ========================================================
// 1. AUTENTICAÇÃO E INICIALIZAÇÃO
// ========================================================
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
                        badge.innerText = config.nome;
                        badge.style.backgroundColor = config.cor;
                        
                        const navBase = document.querySelectorAll('.nav-role-base');
                        const navPap = document.querySelectorAll('.nav-role-pap');
                        const navCoord = document.querySelectorAll('.nav-role-coord');
                        
                        if (novoPapel === 'orientador_pap') { 
                            navBase.forEach(el => el.style.display = 'none'); 
                            navCoord.forEach(el => el.style.display = 'none'); 
                            navPap.forEach(el => el.style.display = 'flex'); 
                        } else if (novoPapel === 'coordenador') { 
                            navBase.forEach(el => el.style.display = 'none'); 
                            navPap.forEach(el => el.style.display = 'none'); 
                            navCoord.forEach(el => el.style.display = 'flex'); 
                        } else { 
                            navPap.forEach(el => el.style.display = 'none'); 
                            navCoord.forEach(el => el.style.display = 'none'); 
                            navBase.forEach(el => el.style.display = 'flex'); 
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
                    if (state.turmasProfessor.length > 0) { 
                        sel.innerHTML = '<option value="">-- Selecionar Turma --</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join(''); 
                    } else { 
                        sel.innerHTML = '<option value="">Sem turmas atribuídas</option>'; 
                    }

                    carregarRadarProfessor(); 
                } else { 
                    window.location.href = "index.html"; 
                }
            }
        } catch (e) { console.error("Erro na inicialização:", e); }
    } else { 
        window.location.href = "index.html"; 
    }
});


// ========================================================
// 2. EVENTOS DE INPUT E CHANGE (Digitação e Seleção)
// ========================================================
document.body.addEventListener('input', (e) => {
    // Cálculo Rápido PRHF
    if (e.target.id === 'prhf-horas-totais') {
        const val = parseInt(e.target.value) || 0;
        // Podes alterar esta fórmula mais tarde!
        document.getElementById('prhf-horas-presenciais').value = val <= 4 ? 0 : Math.ceil(val * 0.3);
    }
});

document.body.addEventListener('change', async (e) => {
    
    // UI Fórum e PRHF - Colorir Labels das Checkboxes Escondidas
    if (e.target.classList.contains('forum-aluno-check') || e.target.classList.contains('edit-forum-aluno-check') || e.target.classList.contains('prhf-aluno-check')) {
        const chk = e.target; 
        const lbl = chk.closest('label');
        if (chk.checked) { 
            if (chk.classList.contains('prhf-aluno-check')) {
                lbl.style.background = 'rgba(239, 68, 68, 0.15)'; 
                lbl.style.borderColor = 'var(--danger-red)'; 
            } else {
                lbl.style.background = 'rgba(0, 204, 136, 0.15)'; 
                lbl.style.borderColor = 'var(--primary-green)'; 
            }
        } else { 
            lbl.style.background = 'rgba(0,0,0,0.2)'; 
            lbl.style.borderColor = '#333'; 
        }
    }

    // PRHF - Atualizar lista de alunos
    if (e.target.id === 'prhf-turma') {
        const t = e.target.value;
        const cCont = document.getElementById('prhf-alunos-bulk-container');
        const discSelect = document.getElementById('prhf-disciplina');
        
        if (!t) {
            cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; margin:0;">Selecione primeiro a Turma</p>';
            return;
        }
        cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; margin:0;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>';
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
            cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH;
        } catch(err) { cCont.innerHTML = '<p class="text-danger center" style="font-size:0.8rem;">Erro ao carregar alunos.</p>'; }
    }

    // FÓRUM - Atualizar lista de alunos
    if (e.target.id === 'forum-turma-select') {
        const t = e.target.value; 
        const cCont = document.getElementById('lista-alunos-forum'); 
        const bulkBtns = document.getElementById('forum-bulk-actions');
        
        if (!t) { 
            cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; grid-column: span 2;">Seleciona uma turma primeiro.</p>'; 
            if(bulkBtns) bulkBtns.style.display = 'none'; 
            return; 
        } 
        
        if(bulkBtns) bulkBtns.style.display = 'flex';
        cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; grid-column: span 2;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>'; 
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
            cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem; grid-column: span 2;">Turma vazia.</p>' : cH; 
        } catch(err) { cCont.innerHTML = '<p class="text-danger center" style="grid-column: span 2;">Erro.</p>'; } 
    }

    if (e.target.id === 'prhf-disciplina') {
        const t = document.getElementById('prhf-turma').value;
        if (t) atualizarDropdownModulos(t, e.target.value, document.getElementById('prhf-modulo'));
    }
});


// ========================================================
// 3. MOTOR PRINCIPAL DE CLIQUES (DELEGAÇÃO DE MÓDULOS)
// ========================================================
document.body.addEventListener('click', async (e) => {
    try {
        // NAVEGAÇÃO BÁSICA
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

        // FECHAR MENUS
        if (!e.target.closest('#header-prof') && !e.target.closest('#modal-fab-menu') && !e.target.closest('#btn-fab-global')) { 
            const drop = document.getElementById('dropdown-perfis'); 
            if(drop) drop.style.display = 'none'; 
            document.getElementById('modal-fab-menu').style.display = 'none';
        }
        if (e.target.closest('#btn-logout-dropdown')) { signOut(auth); return; }
        if (e.target.closest('.fechar-modal')) { 
            document.getElementById(e.target.closest('.fechar-modal').getAttribute('data-target')).style.display = 'none'; 
            return; 
        }

        // DELEGAÇÃO PARA OS NOVOS MÓDULOS DE RESPONSABILIDADE
        if (await gerirCliquesForum(e)) return;
        if (await gerirCliquesPRHF(e)) return;


        // ==========================================
        // RESTANTES LÓGICAS (A SEPARAR NO FUTURO)
        // ==========================================

        if (e.target.closest('#btn-fab-global')) { document.getElementById('modal-fab-menu').style.display = 'flex'; return; }
        
        // TABS (Coordenação, Passaportes, etc)
        if (e.target.closest('#tab-coord-fct')) { document.getElementById('tab-coord-fct').classList.add('active'); document.getElementById('tab-coord-pap').classList.remove('active'); import('./prof/roles/coord-dashboard.js').then(module => { module.coordTabAtiva = 'fct'; module.carregarEcraProjetosCoord(); }); return; }
        if (e.target.closest('#tab-coord-pap')) { document.getElementById('tab-coord-pap').classList.add('active'); document.getElementById('tab-coord-fct').classList.remove('active'); import('./prof/roles/coord-dashboard.js').then(module => { module.coordTabAtiva = 'pap'; module.carregarEcraProjetosCoord(); }); return; }
        if (e.target.closest('.aluno-list-item')) { abrirPerfil360Aluno(e.target.closest('.aluno-list-item').getAttribute('data-id')); return; }
        if (e.target.closest('#tab-tarefas-prhf')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'block'; document.getElementById('sec-tarefas-passaporte').style.display = 'none'; carregarTarefasProf(); return; }
        if (e.target.closest('#tab-tarefas-passaporte')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'none'; document.getElementById('sec-tarefas-passaporte').style.display = 'block'; carregarTarefasProf(); return; }
        if (e.target.closest('#btn-nova-sessao-pap')) { prepararModalNovaSessao(); return; }

        // PLANTA DA SALA
        if (e.target.closest('#btn-ver-planta')) { 
            if (!state.selectedTurma) return alert("Seleciona uma turma primeiro."); 
            document.getElementById('planta-sala-select').value = ''; document.getElementById('planta-gerada-container').style.display = 'none'; document.getElementById('planta-instrucoes-ia').value = ''; 
            const btnGerar = document.getElementById('btn-gerar-planta'); btnGerar.disabled = true; btnGerar.style.opacity = '0.5'; 
            document.getElementById('modal-planta-sala').style.display = 'flex'; 
            return; 
        }

        if (e.target.closest('#btn-gerar-planta')) {
            const salaId = document.getElementById('planta-sala-select').value; const instrucoes = document.getElementById('planta-instrucoes-ia').value.toLowerCase();
            if(!salaId) return; 
            const btn = document.getElementById('btn-gerar-planta'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A calcular otimização...'; btn.disabled = true;

            setTimeout(() => {
                let alunos = state.alunosTurmaRAM.map(al => ({ id: al.id, nome: al.nome, primeiroNome: al.nome.split(' ')[0], risco: Math.floor(Math.random() * 10) }));
                let naFrente = []; let noFundo = []; let separar = []; 
                const frases = instrucoes.split(/[.,\n]/);
                frases.forEach(frase => { 
                    let nomesNaFrase = alunos.filter(a => frase.includes(a.primeiroNome.toLowerCase())); 
                    if(frase.includes('frente') || frase.includes('primeira')) { nomesNaFrase.forEach(n => naFrente.push(n.id)); }
                    if(frase.includes('fundo') || frase.includes('trás') || frase.includes('ultima') || frase.includes('última')) { nomesNaFrase.forEach(n => noFundo.push(n.id)); }
                    if(frase.includes('separar') || frase.includes('afastar') || frase.includes('longe')) { if(nomesNaFrase.length >= 2) separar.push([nomesNaFrase[0].id, nomesNaFrase[1].id]); }
                });
                
                let modoAleatorio = instrucoes.includes('aleat'); let modoAlfabetico = instrucoes.includes('alfab');
                if (modoAlfabetico) { alunos.sort((a,b) => a.nome.localeCompare(b.nome)); } else if (modoAleatorio) { alunos.sort(() => 0.5 - Math.random()); } else { alunos.sort((a,b) => b.risco - a.risco); }
                
                const mesasDOM = Array.from(document.querySelectorAll('.mesa-planta')); 
                let slots = mesasDOM.map(m => { const dataMesa = m.getAttribute('data-mesa'); const parts = dataMesa.split('-'); return { el: m, id: dataMesa, linha: parseInt(parts[0]), coluna: parseInt(parts[1]), parId: parts.length === 3 ? `${parts[0]}-${parts[1]}` : dataMesa, aluno: null }; });
                let unassigned = [...alunos];
                
                const assign = (alunoId, slotCondition) => { const alIndex = unassigned.findIndex(a => a.id === alunoId); if(alIndex === -1) return; const al = unassigned[alIndex]; const slot = slots.find(s => s.aluno === null && slotCondition(s)); if(slot) { slot.aluno = al; unassigned.splice(alIndex, 1); } };
                naFrente.forEach(id => assign(id, s => s.linha === 0)); 
                let maxLinha = Math.max(...slots.map(s => s.linha)); noFundo.forEach(id => assign(id, s => s.linha === maxLinha));
                unassigned.forEach(al => { const slot = slots.find(s => s.aluno === null); if(slot) slot.aluno = al; });
                
                separar.forEach(par => { const s1 = slots.find(s => s.aluno?.id === par[0]); const s2 = slots.find(s => s.aluno?.id === par[1]); if(s1 && s2 && s1.parId === s2.parId) { const s3 = slots.find(s => s.aluno !== null && s.parId !== s1.parId && s.aluno.id !== par[0] && s.aluno.id !== par[1]); if(s3) { const temp = s2.aluno; s2.aluno = s3.aluno; s3.aluno = temp; } } });
                slots.forEach(s => { if(s.aluno) { s.el.innerText = s.aluno.primeiroNome; s.el.style.color = 'white'; s.el.style.borderColor = 'var(--primary-green)'; s.el.style.background = 'rgba(0, 204, 136, 0.15)'; } else { s.el.innerText = 'Vazio'; s.el.style.color = 'var(--text-muted)'; s.el.style.borderColor = '#555'; s.el.style.background = '#1c1f26'; } });
                
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Refazer Disposição'; btn.disabled = false; document.getElementById('btn-exportar-planta').style.display = 'block';
            }, 800);
            return;
        }

        // OUTRAS AÇÕES E MODAIS SECUNDÁRIOS
        if (e.target.closest('#btn-abrir-copiloto')) { const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT); const alunoNome = document.getElementById('p-aluno-nome').innerText; const faltas = document.getElementById('p-aluno-faltas').innerText; const modFeitos = document.getElementById('p-aluno-notas').innerText; const textareaPrompt = document.getElementById('prompt-ia-text'); let promptText = ""; if (isDT) { promptText = `Atua como Diretor de Turma. Faz uma Síntese Global para o aluno ${alunoNome}. Baseia-te nos dados (Tem ${faltas}h de faltas e concluiu ${modFeitos} módulos). Regras obrigatórias: Ser objetivo e claro; Indicar pontos fortes no empenho; Referir os aspetos a melhorar no comportamento/aprendizagem; Apresentar estratégias concretas de progressão; Incluir a lista de módulos não concluídos (se aplicável). Tom: Institucional e construtivo.`; } else { promptText = `Atua como professor da disciplina de ${document.getElementById('perfil-disc-select').value || 'Técnicas'}. Escreve uma síntese de avaliação para o aluno ${alunoNome}. A síntese deve cumprir as regras da direção: Ser objetiva e construtiva; 1. Elogiar pontos fortes. 2. Apontar aspetos a melhorar na disciplina. 3. Dar estratégias claras de progressão. (Nota: O aluno concluiu ${modFeitos} módulos e tem ${faltas}h de faltas na globalidade). Tom: Profissional e direto ao assunto.`; } textareaPrompt.value = promptText; document.getElementById('modal-copiloto-ia').style.display = 'flex'; return; }
        if (e.target.closest('#btn-copiar-prompt')) { const copyText = document.getElementById('prompt-ia-text'); copyText.select(); document.execCommand("copy"); const btn = e.target.closest('#btn-copiar-prompt'); btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!'; setTimeout(() => { btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar Prompt'; document.getElementById('modal-copiloto-ia').style.display = 'none'; }, 1500); return; }
        if (e.target.closest('#btn-ia-formatar-sumario')) { const btn = e.target.closest('#btn-ia-formatar-sumario'); const sumarioBox = document.getElementById('mat-sumario'); const textoOriginal = sumarioBox.value.trim(); if (!textoOriginal) return alert("Escreve primeiro alguns tópicos para a IA formatar."); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; setTimeout(() => { const linhas = textoOriginal.split('\n').filter(l => l.trim() !== ''); let textoFormatado = "Sumário da Aula:\n"; linhas.forEach(linha => { let cleanLine = linha.replace(/^[-\*\.]\s*/, '').trim(); textoFormatado += `• ${cleanLine.charAt(0).toUpperCase() + cleanLine.slice(1)}.\n`; }); sumarioBox.value = textoFormatado; btn.innerHTML = '<i class="fa-solid fa-check" style="color:var(--success-green);"></i>'; setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i>'; }, 2000); }, 800); return; }
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

    } catch (criticalError) {
        console.error("Erro Crítico no Sistema de Navegação:", criticalError);
    }
});
