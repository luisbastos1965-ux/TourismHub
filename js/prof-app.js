import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, setDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { state, getDisciplinasPermitidas, nomeCurto } from "./prof/store.js";
import { gerarRadarConflitos } from "./prof/roles/dt.js";
import { validarFCT } from "./prof/roles/coord.js"; 
import { aprovarTemaPAP, rejeitarTemaPAPExecutar, aprovarRelatorioPAP } from "./prof/roles/pap.js";
import { carregarRadarProfessor, analisarEAtualizarTurma, renderizarPautaTurma, renderizarFaltasTurma, desenharGraficoAluno, abrirPerfil360Aluno, carregarTarefasProf, carregarForunsProf, abrirChatForum } from "./prof/ui.js";

import { carregarEcraOrientandos, carregarEcraDiario, prepararModalNovaSessao } from "./prof/roles/pap-diario.js";
import { carregarEcraProjetosCoord } from "./prof/roles/coord-dashboard.js";

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

document.addEventListener('click', (e) => {
    if (!e.target.closest('#header-prof')) {
        const drop = document.getElementById('dropdown-perfis');
        if(drop) drop.style.display = 'none';
    }
});

document.getElementById('btn-logout-dropdown')?.addEventListener('click', () => signOut(auth));
function esconderTodasAsVistas() { document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none'); }

document.getElementById('sort-passaporte')?.addEventListener('change', carregarTarefasProf);
document.getElementById('filtro-prhf-data')?.addEventListener('change', carregarTarefasProf);
document.getElementById('filtro-prhf-modulo')?.addEventListener('change', carregarTarefasProf);

document.getElementById('btn-prhf-minha')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('btn-prhf-todas').classList.remove('active'); state.prhfViewMode = 'minha'; carregarTarefasProf(); });
document.getElementById('btn-prhf-todas')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('btn-prhf-minha').classList.remove('active'); state.prhfViewMode = 'todas'; carregarTarefasProf(); });
document.getElementById('btn-graph-disc')?.addEventListener('click', () => { document.getElementById('btn-graph-disc').classList.add('active'); document.getElementById('btn-graph-global').classList.remove('active'); desenharGraficoAluno('disc'); });
document.getElementById('btn-graph-global')?.addEventListener('click', () => { document.getElementById('btn-graph-global').classList.add('active'); document.getElementById('btn-graph-disc').classList.remove('active'); desenharGraficoAluno('global'); });
document.getElementById('evento-periodo')?.addEventListener('change', (e) => { const timeInput = document.getElementById('evento-hora'); if(e.target.value === 'hora') { timeInput.style.display = 'block'; } else { timeInput.style.display = 'none'; } });
document.getElementById('pauta-disc-select')?.addEventListener('change', renderizarPautaTurma);
document.getElementById('faltas-disc-select')?.addEventListener('change', renderizarFaltasTurma);
document.getElementById('prof-seletor-turmas')?.addEventListener('change', (e) => { state.selectedTurma = e.target.value; if (state.selectedTurma) { document.getElementById('turma-ativa-container').style.display = 'block'; analisarEAtualizarTurma(state.selectedTurma); } else { document.getElementById('turma-ativa-container').style.display = 'none'; } });
document.getElementById('prhf-turma')?.addEventListener('change', async (e) => { const s = document.getElementById('prhf-aluno'); const t = e.target.value; if (!t) { s.innerHTML = '<option value="">Selecione primeiro a Turma</option>'; return; } s.innerHTML = '<option value="">A carregar...</option>'; try { const qS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); let arr = []; qS.forEach(d => arr.push({ id: d.id, nome: d.data().nome })); arr.sort((a,b) => a.nome.localeCompare(b.nome)); s.innerHTML = '<option value="">-- Selecione o Aluno --</option>' + arr.map(a => `<option value="${a.id}">${nomeCurto(a.nome)}</option>`).join(''); } catch (err) { s.innerHTML = '<option value="">Erro</option>'; } });
document.getElementById('forum-turma-select')?.addEventListener('change', async (e) => { const t = e.target.value; const cCont = document.getElementById('lista-alunos-forum'); if (!t) { cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem;">Seleciona uma turma primeiro.</p>'; return; } cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>'; try { const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); let cH = ''; cS.forEach(d => { cH += `<label style="display:flex; align-items:center; gap:10px; color:white; font-size:0.9rem; padding:8px 0; cursor:pointer;"><input type="checkbox" class="forum-aluno-check" value="${d.id}" checked style="width:18px;height:18px;accent-color:var(--primary-green);"> ${nomeCurto(d.data().nome)}</label>`; }); cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH; } catch(err) { cCont.innerHTML = '<p class="text-danger center">Erro.</p>'; } });


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

    if (e.target.closest('#tab-coord-fct')) {
        document.getElementById('tab-coord-fct').classList.add('active');
        document.getElementById('tab-coord-pap').classList.remove('active');
        import('./prof/roles/coord-dashboard.js').then(module => {
            module.coordTabAtiva = 'fct';
            module.carregarEcraProjetosCoord();
        });
        return;
    }
    
    if (e.target.closest('#tab-coord-pap')) {
        document.getElementById('tab-coord-pap').classList.add('active');
        document.getElementById('tab-coord-fct').classList.remove('active');
        import('./prof/roles/coord-dashboard.js').then(module => {
            module.coordTabAtiva = 'pap';
            module.carregarEcraProjetosCoord();
        });
        return;
    }

    if (e.target.closest('.fechar-modal')) { document.getElementById(e.target.closest('.fechar-modal').getAttribute('data-target')).style.display = 'none'; return; }
    if (e.target.closest('.aluno-list-item')) { abrirPerfil360Aluno(e.target.closest('.aluno-list-item').getAttribute('data-id')); return; }
    if (e.target.closest('#tab-tarefas-prhf')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'block'; document.getElementById('sec-tarefas-passaporte').style.display = 'none'; carregarTarefasProf(); return; }
    if (e.target.closest('#tab-tarefas-passaporte')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'none'; document.getElementById('sec-tarefas-passaporte').style.display = 'block'; carregarTarefasProf(); return; }
    if (e.target.closest('#btn-nova-sessao-pap')) { prepararModalNovaSessao(); return; }

    // COPILOTO IA (GERADOR DE FEEDBACK / SÍNTESES)
    if (e.target.closest('#btn-abrir-copiloto')) {
        const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
        const alunoNome = document.getElementById('p-aluno-nome').innerText;
        const faltas = document.getElementById('p-aluno-faltas').innerText;
        const modFeitos = document.getElementById('p-aluno-notas').innerText;
        const textareaPrompt = document.getElementById('prompt-ia-text');
        
        let promptText = "";
        if (isDT) {
            promptText = `Atua como Diretor de Turma. Faz uma Síntese Global para o aluno ${alunoNome}. Baseia-te nos dados (Tem ${faltas}h de faltas e concluiu ${modFeitos} módulos). Regras obrigatórias: Ser objetivo e claro; Indicar pontos fortes no empenho; Referir os aspetos a melhorar no comportamento/aprendizagem; Apresentar estratégias concretas de progressão; Incluir a lista de módulos não concluídos (se aplicável). Tom: Institucional e construtivo.`;
        } else {
            promptText = `Atua como professor da disciplina de ${state.disciplinasProfessor[0] || 'Técnicas'}. Escreve uma síntese de avaliação para o aluno ${alunoNome}. A síntese deve cumprir as regras da direção: Ser objetiva e construtiva; 1. Elogiar pontos fortes. 2. Apontar aspetos a melhorar na disciplina. 3. Dar estratégias claras de progressão. (Nota: O aluno concluiu ${modFeitos} módulos e tem ${faltas}h de faltas na globalidade). Tom: Profissional e direto ao assunto.`;
        }
        textareaPrompt.value = promptText;
        document.getElementById('modal-copiloto-ia').style.display = 'flex';
        return;
    }
    
    if (e.target.closest('#btn-copiar-prompt')) {
        const copyText = document.getElementById('prompt-ia-text');
        copyText.select();
        document.execCommand("copy");
        const btn = e.target.closest('#btn-copiar-prompt');
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Copiado!';
        setTimeout(() => { btn.innerHTML = '<i class="fa-regular fa-copy"></i> Copiar Prompt'; document.getElementById('modal-copiloto-ia').style.display = 'none'; }, 1500);
        return;
    }

    // EXPORTAÇÃO ICS E CALENDÁRIO
    if (e.target.closest('.btn-download-ics')) {
        const btn = e.target.closest('.btn-download-ics');
        const tit = btn.getAttribute('data-tit'); const dat = btn.getAttribute('data-data'); const hor = btn.getAttribute('data-hora') || "09:00";
        const icsContent = `BEGIN:VCALENDAR\nVERSION:2.0\nBEGIN:VEVENT\nSUMMARY:${tit}\nDTSTART:${dat.replace(/-/g,'')}T${hor.replace(':','')}00Z\nDTEND:${dat.replace(/-/g,'')}T${(parseInt(hor.split(':')[0])+1).toString().padStart(2,'0')}${hor.split(':')[1]}00Z\nDESCRIPTION:Evento agendado via TurmaPRO\nEND:VEVENT\nEND:VCALENDAR`;
        const blob = new Blob([icsContent], { type: 'text/calendar' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); a.href = url; a.download = `${tit.replace(/\s+/g,'_')}.ics`;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
        return;
    }

    // AVISOS GLOBAIS (MEGA-FÓRUM)
    if (e.target.closest('#btn-abrir-aviso-global') || e.target.closest('#btn-abrir-aviso-global-coord')) {
        let options = '';
        if (state.activeRole === 'coordenador') {
            options = '<option value="todas">Todas as minhas turmas</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join('');
        } else {
            options = `<option value="${state.selectedTurma}">Turma ${state.selectedTurma}</option>`;
        }
        document.getElementById('aviso-destino-turma').innerHTML = options;
        document.getElementById('aviso-titulo').value = '';
        document.getElementById('aviso-mensagem').value = '';
        document.getElementById('modal-aviso-global').style.display = 'flex';
        return;
    }
    
    if (e.target.closest('#btn-enviar-aviso-global')) {
        const destino = document.getElementById('aviso-destino-turma').value;
        const titulo = document.getElementById('aviso-titulo').value.trim();
        const mensagem = document.getElementById('aviso-mensagem').value.trim();
        
        if (!titulo || !mensagem) return alert("Preenche o título e a mensagem do aviso.");
        
        const btn = e.target.closest('#btn-enviar-aviso-global');
        const originalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;
        
        try {
            let turmasAlvo = destino === 'todas' ? state.turmasProfessor : [destino];
            for (const t of turmasAlvo) {
                await addDoc(collection(db, "turmas", t, "avisos"), {
                    titulo: titulo,
                    mensagem: mensagem,
                    autor: state.myUserName,
                    papel: state.activeRole,
                    timestamp: Date.now()
                });
            }
            
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviado';
            setTimeout(() => {
                btn.innerHTML = originalText;
                btn.disabled = false;
                document.getElementById('modal-aviso-global').style.display = 'none';
            }, 1500);
        } catch (err) {
            btn.innerHTML = 'Erro!';
            setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 2000);
        }
        return;
    }

    // BLOCOS TURMA E DT
    if (e.target.closest('#btn-ver-pauta')) { renderizarPautaTurma(); return; }
    if (e.target.closest('#btn-ver-faltas-turma')) { renderizarFaltasTurma(); return; }
    if (e.target.closest('#btn-radar-conflitos')) { gerarRadarConflitos(); return; }
    
    // AÇÕES DO COORDENADOR (ESTÁGIOS) E PAP
    if (e.target.closest('.btn-validar-fct')) { validarFCT(e.target.closest('.btn-validar-fct').getAttribute('data-id'), e.target.closest('.btn-validar-fct')); return; }
    if (e.target.closest('.btn-aprovar-tema')) { aprovarTemaPAP(e.target.closest('.btn-aprovar-tema').getAttribute('data-id'), e.target.closest('.btn-aprovar-tema')); return; }
    if (e.target.closest('.btn-rejeitar-tema')) { document.getElementById('rej-pap-aluno-id').value = e.target.closest('.btn-rejeitar-tema').getAttribute('data-id'); document.getElementById('rej-pap-motivo').value = ''; document.getElementById('modal-rejeitar-tema-pap').style.display = 'flex'; return; }
    if (e.target.closest('#btn-confirmar-rejeicao-pap')) { const motivo = document.getElementById('rej-pap-motivo').value.trim(); if(!motivo) return alert("Indica o motivo."); rejeitarTemaPAPExecutar(document.getElementById('rej-pap-aluno-id').value, motivo, e.target.closest('#btn-confirmar-rejeicao-pap')); return; }
    if (e.target.closest('.btn-aprovar-relatorio')) { aprovarRelatorioPAP(e.target.closest('.btn-aprovar-relatorio').getAttribute('data-id'), e.target.closest('.btn-aprovar-relatorio')); return; }

    // CIDADANIA
    if (e.target.closest('#btn-ver-cidadania')) {
        if(!state.selectedTurma) return alert("Seleciona uma turma primeiro.");
        const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
        const disc = state.disciplinasProfessor[0] || "Geral";
        const cont = document.getElementById('cidadania-dinamico-content'); document.getElementById('modal-cidadania').style.display = 'flex';
        if (isDT) { document.getElementById('dt-cidadania-tabs').style.display = 'flex'; document.getElementById('btn-cid-global').click(); } 
        else {
            document.getElementById('dt-cidadania-tabs').style.display = 'none';
            cont.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 15px;">Informa o Diretor de Turma sobre o ponto de situação do projeto na tua disciplina.</p><label style="font-size:0.8rem; color:white; margin-bottom:5px; display:block;">Ideias e Propostas de Tema</label><textarea id="cidadania-proposta" class="input-padrao" placeholder="Sugestões de temas ou ações da tua disciplina..." style="width:100%; min-height:100px; margin-bottom:15px;"></textarea><label style="font-size:0.8rem; color:white; margin-bottom:5px; display:block;">Ponto de Situação Atual</label><textarea id="cidadania-ponto-situacao" class="input-padrao" placeholder="O que os alunos já fizeram na tua aula..." style="width:100%; min-height:100px; margin-bottom:15px;"></textarea><button id="btn-gravar-cidadania" class="primary-btn" style="width:100%; background-color:#b82bf2;">Gravar Ponto de Situação</button>`;
            try { const snap = await getDoc(doc(db, "turmas", state.selectedTurma, "cidadania", disc)); if(snap.exists()) { document.getElementById('cidadania-proposta').value = snap.data().proposta || ''; document.getElementById('cidadania-ponto-situacao').value = snap.data().pontoSituacao || ''; } } catch(err) {}
        }
        return;
    }
    if (e.target.closest('#btn-cid-global')) {
        document.getElementById('btn-cid-global').classList.add('active'); document.getElementById('btn-cid-minha').classList.remove('active');
        const cont = document.getElementById('cidadania-dinamico-content'); cont.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A ler contributos...</p>';
        try {
            let html = '<h4 style="color:var(--text-muted); font-size:0.9rem; margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">Contributos dos Professores</h4>';
            const s = await getDocs(collection(db, "turmas", state.selectedTurma, "cidadania")); let achou = false;
            s.forEach(d => { if(d.id !== "projeto_global") { achou = true; html += `<div style="background:rgba(0,0,0,0.2); border-left:3px solid #b82bf2; padding:10px; margin-bottom:10px; border-radius:6px;"><strong style="color:white; font-size:0.9rem;">${d.id}</strong><p style="font-size:0.8rem; color:var(--text-light); margin:5px 0;"><strong>Ideias:</strong> ${d.data().proposta || 'Sem dados'}</p><p style="font-size:0.8rem; color:var(--text-light); margin:0;"><strong>Situação:</strong> ${d.data().pontoSituacao || 'Sem dados'}</p></div>`; } });
            if(!achou) html += '<p style="font-size:0.8rem; color:var(--text-muted);">Nenhum professor submeteu dados ainda.</p>';
            html += `<h4 style="color:white; font-size:0.9rem; margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Projeto Global (Relatório Final)</h4><label style="font-size:0.8rem; color:var(--text-muted); margin-bottom:5px; display:block;">Tema e Ideias Centrais</label><textarea id="cid-dt-ideias" class="input-padrao" style="width:100%; min-height:80px; margin-bottom:15px;"></textarea><label style="font-size:0.8rem; color:var(--text-muted); margin-bottom:5px; display:block;">Etapas de Desenvolvimento</label><textarea id="cid-dt-etapas" class="input-padrao" style="width:100%; min-height:80px; margin-bottom:15px;"></textarea><label style="font-size:0.8rem; color:var(--text-muted); margin-bottom:5px; display:block;">Concretização Final</label><textarea id="cid-dt-concret" class="input-padrao" style="width:100%; min-height:80px; margin-bottom:15px;"></textarea><button id="btn-gravar-cidadania-dt" class="primary-btn" style="width:100%; background-color:#b82bf2;">Gravar Projeto Global</button>`;
            cont.innerHTML = html; const dtSnap = await getDoc(doc(db, "turmas", state.selectedTurma, "cidadania", "projeto_global")); if(dtSnap.exists()) { document.getElementById('cid-dt-ideias').value = dtSnap.data().ideias || ''; document.getElementById('cid-dt-etapas').value = dtSnap.data().etapas || ''; document.getElementById('cid-dt-concret').value = dtSnap.data().concretizacao || ''; }
        } catch(err) { cont.innerHTML = "Erro"; }
        return;
    }
    if (e.target.closest('#btn-cid-minha')) {
        document.getElementById('btn-cid-minha').classList.add('active'); document.getElementById('btn-cid-global').classList.remove('active');
        const cont = document.getElementById('cidadania-dinamico-content'); const disc = state.disciplinasProfessor[0] || "Geral";
        cont.innerHTML = `<p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 15px;">Informa o Diretor de Turma sobre o ponto de situação do projeto na tua disciplina.</p><label style="font-size:0.8rem; color:white; margin-bottom:5px; display:block;">Ideias e Propostas de Tema</label><textarea id="cidadania-proposta" class="input-padrao" placeholder="Sugestões..." style="width:100%; min-height:100px; margin-bottom:15px;"></textarea><label style="font-size:0.8rem; color:white; margin-bottom:5px; display:block;">Ponto de Situação Atual</label><textarea id="cidadania-ponto-situacao" class="input-padrao" placeholder="O que os alunos já fizeram na tua aula..." style="width:100%; min-height:100px; margin-bottom:15px;"></textarea><button id="btn-gravar-cidadania" class="primary-btn" style="width:100%; background-color:#b82bf2;">Gravar Ponto de Situação</button>`;
        try { const snap = await getDoc(doc(db, "turmas", state.selectedTurma, "cidadania", disc)); if(snap.exists()) { document.getElementById('cidadania-proposta').value = snap.data().proposta || ''; document.getElementById('cidadania-ponto-situacao').value = snap.data().pontoSituacao || ''; } } catch(err) {}
        return;
    }
    if (e.target.closest('#btn-gravar-cidadania')) { const disc = state.disciplinasProfessor[0] || "Geral"; const btn = e.target.closest('#btn-gravar-cidadania'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; try { await setDoc(doc(db, "turmas", state.selectedTurma, "cidadania", disc), { proposta: document.getElementById('cidadania-proposta').value, pontoSituacao: document.getElementById('cidadania-ponto-situacao').value }, { merge: true }); btn.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; setTimeout(() => { btn.innerHTML = 'Gravar Ponto de Situação'; btn.disabled = false; document.getElementById('modal-cidadania').style.display = 'none'; }, 1500); } catch(err) { btn.innerHTML = 'Erro!'; setTimeout(() => { btn.innerHTML = 'Gravar Ponto de Situação'; btn.disabled = false; }, 2000); } return; }
    if (e.target.closest('#btn-gravar-cidadania-dt')) { const btn = e.target.closest('#btn-gravar-cidadania-dt'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; try { await setDoc(doc(db, "turmas", state.selectedTurma, "cidadania", "projeto_global"), { ideias: document.getElementById('cid-dt-ideias').value, etapas: document.getElementById('cid-dt-etapas').value, concretizacao: document.getElementById('cid-dt-concret').value }, { merge: true }); btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardado'; setTimeout(() => { btn.innerHTML = 'Gravar Projeto Global'; btn.disabled = false; document.getElementById('modal-cidadania').style.display = 'none'; }, 1500); } catch(err) { btn.innerHTML = 'Erro!'; setTimeout(() => { btn.innerHTML = 'Gravar Projeto Global'; btn.disabled = false; }, 2000); } return; }

    // FÓRUM
    if (e.target.closest('.btn-edit-chat')) {
        e.stopPropagation(); const btn = e.target.closest('.btn-edit-chat'); const cId = btn.getAttribute('data-id'); const t = btn.getAttribute('data-turma');
        document.getElementById('edit-forum-id').value = cId; document.getElementById('edit-forum-turma').value = t;
        const mCont = document.getElementById('lista-alunos-edit-forum'); mCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>';
        document.getElementById('modal-editar-forum').style.display = 'flex';
        try { const chatSnap = await getDoc(doc(db, "turmas", t, "foruns", cId)); if(chatSnap.exists()) { document.getElementById('input-nome-edit-forum').value = chatSnap.data().nome; const membrosAtuais = chatSnap.data().membros || []; const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); let cH = ''; cS.forEach(d => { const isChecked = membrosAtuais.includes(d.id) ? 'checked' : ''; cH += `<label style="display:flex; align-items:center; gap:10px; color:white; font-size:0.9rem; padding:8px 0; cursor:pointer;"><input type="checkbox" class="edit-forum-aluno-check" value="${d.id}" ${isChecked} style="width:18px;height:18px;accent-color:var(--warning-yellow);"> ${nomeCurto(d.data().nome)}</label>`; }); mCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH; } } catch(err) { mCont.innerHTML = '<p class="text-danger center">Erro.</p>'; } return;
    }
    if (e.target.closest('#btn-guardar-edit-forum')) { const cId = document.getElementById('edit-forum-id').value; const t = document.getElementById('edit-forum-turma').value; const novoNome = document.getElementById('input-nome-edit-forum').value.trim(); let mbr = [state.myUserId]; document.querySelectorAll('.edit-forum-aluno-check:checked').forEach(c => mbr.push(c.value)); if(!novoNome) return alert("O nome não pode estar vazio."); const btn = e.target.closest('#btn-guardar-edit-forum'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; try { await updateDoc(doc(db, "turmas", t, "foruns", cId), { nome: novoNome, membros: mbr }); document.getElementById('modal-editar-forum').style.display = 'none'; btn.innerHTML = 'Guardar Alterações'; btn.disabled = false; carregarForunsProf(); } catch(err) { btn.innerHTML = 'Erro!'; setTimeout(() => { btn.innerHTML = 'Guardar Alterações'; btn.disabled = false; }, 2000); } return; }
    if (e.target.closest('#btn-apagar-forum')) { if(confirm("Apagar definitivamente este grupo de chat?")) { const cId = document.getElementById('edit-forum-id').value; const t = document.getElementById('edit-forum-turma').value; const btn = e.target.closest('#btn-apagar-forum'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; try { await deleteDoc(doc(db, "turmas", t, "foruns", cId)); document.getElementById('modal-editar-forum').style.display = 'none'; btn.innerHTML = '<i class="fa-solid fa-trash"></i> Apagar Chat Definitivamente'; btn.disabled = false; carregarForunsProf(); } catch(err) { btn.innerHTML = 'Erro!'; setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-trash"></i> Apagar Chat Definitivamente'; btn.disabled = false; }, 2000); } } return; }
    if (e.target.closest('.canal-card')) { const card = e.target.closest('.canal-card'); abrirChatForum(card.getAttribute('data-turma'), card.getAttribute('data-disc'), card.getAttribute('data-nome')); return; }
    if (e.target.closest('#btn-prof-voltar-canais')) { if (state.chatUnsubscribe) { state.chatUnsubscribe(); state.chatUnsubscribe = null; } document.getElementById('prof-forum-chat-view').style.display = 'none'; document.getElementById('btn-create-chat-prof').style.display = 'block'; document.getElementById('prof-forum-channel-list').style.display = 'block'; return; }
    if (e.target.closest('#btn-prof-send-msg')) { const msgInput = document.getElementById('prof-input-forum-msg'); const msg = msgInput.value.trim(); if (!msg || !state.activeChatTurma || !state.activeChatDisc) return; try { await addDoc(collection(db, "turmas", state.activeChatTurma, "foruns", state.activeChatDisc, "mensagens"), { texto: msg, autor: state.myUserName, papel: "professor", timestamp: Date.now() }); msgInput.value = ''; } catch (err) { alert("Erro ao enviar."); } return; }
    if (e.target.closest('#btn-create-chat-prof')) { document.getElementById('forum-turma-select').innerHTML = '<option value="">Selecionar Turma...</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join(''); document.getElementById('input-nome-novo-forum').value = ''; document.getElementById('lista-alunos-forum').innerHTML = '<p class="text-muted center" style="font-size:0.8rem;">Seleciona turma primeiro.</p>'; document.getElementById('modal-criar-forum').style.display = 'flex'; return; }
    if (e.target.closest('#btn-cancelar-novo-forum')) { document.getElementById('modal-criar-forum').style.display = 'none'; return; }
    if (e.target.closest('#btn-confirm-novo-forum')) { const nome = document.getElementById('input-nome-novo-forum').value.trim(); const turma = document.getElementById('forum-turma-select').value; if(!nome || !turma) return alert("Preenche o nome do chat e a turma."); let mbr = [state.myUserId]; document.querySelectorAll('.forum-aluno-check:checked').forEach(c => mbr.push(c.value)); const btnConf = e.target.closest('#btn-confirm-novo-forum'); btnConf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btnConf.disabled = true; try { await addDoc(collection(db, "turmas", turma, "foruns"), { nome: nome, tipo: 'permanente', isDefault: false, membros: mbr, criadoPor: state.myUserName }); document.getElementById('modal-criar-forum').style.display = 'none'; btnConf.innerHTML = 'Criar Chat'; btnConf.disabled = false; carregarForunsProf(); } catch(err) { btnConf.innerHTML = 'Erro!'; setTimeout(() => { btnConf.innerHTML = 'Criar Chat'; btnConf.disabled = false; }, 2000); } return; }

    // PRHF
    if (e.target.closest('#btn-novo-prhf')) {
        document.getElementById('erro-modal-prhf').style.display = 'none'; document.getElementById('prhf-urgente').checked = false;
        document.getElementById('prhf-turma').innerHTML = '<option value="">-- Turma --</option>' + state.turmasProfessor.map(t => `<option value="${t}">${t}</option>`).join('');
        document.getElementById('prhf-disciplina').innerHTML = getDisciplinasPermitidas().map(dc => `<option value="${dc}">${dc}</option>`).join('');
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
        const permitidas = getDisciplinasPermitidas(); const discFalta = document.getElementById('lancar-falta-disciplina');
        discFalta.innerHTML = permitidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); discFalta.style.display = permitidas.length > 1 ? 'block' : 'none';
        const c = document.getElementById('lista-metralhadora-faltas'); let h = '';
        state.alunosTurmaRAM.forEach(al => { h += `<label style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); margin-bottom:5px; border-radius:8px; border:1px solid #333; cursor:pointer;"><span style="color:white; font-size:0.95rem;">${nomeCurto(al.nome)}</span><input type="checkbox" class="chk-falta" value="${al.id}" style="width:18px;height:18px;accent-color:var(--danger-red);"></label>`; });
        c.innerHTML = h; document.getElementById('modal-marcar-faltas').style.display = 'flex'; return;
    }
    if (e.target.closest('#btn-confirmar-faltas')) {
        const aulaMinutos = document.getElementById('falta-aula-select').value; const modSelect = document.getElementById('falta-modulo-select').value;
        const discSelect = document.getElementById('lancar-falta-disciplina'); const disc = discSelect.style.display === 'block' ? discSelect.value : (state.disciplinasProfessor[0] || "Geral");
        const errDiv = document.getElementById('erro-modal-faltas');
        if (!aulaMinutos || !modSelect) { errDiv.innerText = "Seleciona a duração e o módulo associado."; errDiv.style.display = 'block'; return; }
        const horasFormatadas = Number(aulaMinutos); const b = e.target.closest('#btn-confirmar-faltas'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        const ausentes = document.querySelectorAll('.chk-falta:checked');
        for (const chk of ausentes) { await addDoc(collection(db, "utilizadores", chk.value, "faltas"), { disciplina: disc, modulo: modSelect, horas: horasFormatadas, dataInicio: new Date().toISOString().split('T')[0], justificada: false, criadoPor: state.myUserName, criadoEm: new Date().toISOString() }); }
        b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; setTimeout(() => { b.innerHTML = 'Gravar Faltas'; b.disabled = false; document.getElementById('modal-marcar-faltas').style.display = 'none'; analisarEAtualizarTurma(state.selectedTurma); }, 1500); return;
    }

    // NOTAS
    if (e.target.closest('#btn-modal-notas')) {
        if (!state.selectedTurma || state.alunosTurmaRAM.length === 0) return alert("Seleciona turma primeiro.");
        document.getElementById('erro-modal-notas').style.display = 'none';
        const permitidas = getDisciplinasPermitidas(); const selDisc = document.getElementById('lancar-nota-disciplina');
        selDisc.innerHTML = permitidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); selDisc.style.display = permitidas.length > 1 ? 'block' : 'none';
        document.getElementById('lancar-nota-modulo').value = ''; const grid = document.getElementById('grid-notas-alunos'); let h = '';
        state.alunosTurmaRAM.forEach(al => { h += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); border-radius:8px; border:1px solid #333;"><div style="display:flex; align-items:center; gap:10px;"><img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;"><span style="color:white; font-size:0.9rem;">${nomeCurto(al.nome)}</span></div><input type="text" class="input-nota-aluno input-padrao" data-id="${al.id}" placeholder="Nota" style="width:70px; text-align:center; padding:5px; margin:0; text-transform:uppercase;"></div>`; });
        grid.innerHTML = h; document.getElementById('modal-lancamento-notas').style.display = 'flex'; return;
    }
    if (e.target.closest('#btn-confirmar-notas')) {
        const discSelect = document.getElementById('lancar-nota-disciplina'); const disc = discSelect.style.display === 'block' ? discSelect.value : (state.disciplinasProfessor[0] || "Geral"); const mod = document.getElementById('lancar-nota-modulo').value; const errDiv = document.getElementById('erro-modal-notas');
        if (!mod) { errDiv.innerText = "Preenche o módulo."; errDiv.style.display = 'block'; return; }
        const inputs = document.querySelectorAll('.input-nota-aluno'); let notasParaGravar = []; inputs.forEach(inp => { const v = inp.value.trim().toUpperCase(); if (v) notasParaGravar.push({ id: inp.getAttribute('data-id'), nota: v }); });
        if (notasParaGravar.length === 0) { errDiv.innerText = "Não inseriste notas."; errDiv.style.display = 'block'; return; }
        const b = e.target.closest('#btn-confirmar-notas'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try { for (const n of notasParaGravar) { await addDoc(collection(db, "utilizadores", n.id, "notas"), { disciplina: disc, modulo: Number(mod), nota: n.nota, data: new Date().toISOString(), professor: state.myUserName }); } b.innerHTML = '<i class="fa-solid fa-check"></i> Gravadas'; setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-save"></i> Gravar Notas'; b.disabled = false; document.getElementById('modal-lancamento-notas').style.display = 'none'; analisarEAtualizarTurma(state.selectedTurma); }, 1500); } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); }
        return;
    }

    // MATERIAIS E AGENDA E OCORRÊNCIAS
    if (e.target.closest('#btn-modal-materiais')) { if (!state.selectedTurma) return alert("Seleciona turma primeiro."); document.getElementById('mat-titulo').value = ''; const permitidas = getDisciplinasPermitidas(); const matDisc = document.getElementById('mat-disciplina'); matDisc.innerHTML = permitidas.length > 0 ? permitidas.map(dc => `<option value="${dc}">${dc}</option>`).join('') : '<option value="">Geral</option>'; matDisc.style.display = permitidas.length > 1 ? 'block' : 'none'; document.getElementById('mat-file').value = ''; state.materialBase64 = null; document.getElementById('mat-file-name').innerText = 'Toca para selecionar PDF'; document.getElementById('modal-materiais').style.display = 'flex'; return; }
    if (e.target.closest('#btn-gravar-material')) { const tit = document.getElementById('mat-titulo').value.trim(); const matDisc = document.getElementById('mat-disciplina'); const disc = matDisc.style.display === 'block' ? matDisc.value : (state.disciplinasProfessor[0] || "Geral"); if (!tit) return alert("Título em falta."); const b = e.target.closest('#btn-gravar-material'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { await addDoc(collection(db, "turmas", state.selectedTurma, "sumarios"), { titulo: tit, disciplina: disc, professor: state.myUserName, data: new Date().toLocaleDateString('pt-PT'), descricao: state.materialBase64 ? "Ficheiro em anexo." : "Material partilhado pelo professor.", ficheiroBase64: state.materialBase64, timestamp: Date.now() }); b.innerHTML = '<i class="fa-solid fa-check"></i> Partilhado'; setTimeout(() => { b.innerHTML = 'Partilhar com a Turma'; b.disabled = false; document.getElementById('modal-materiais').style.display = 'none'; }, 1500); } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); } return; }
    if (e.target.closest('#btn-modal-agenda')) { if (!state.selectedTurma) return alert("Seleciona turma primeiro."); const permitidas = getDisciplinasPermitidas(); const sd = document.getElementById('agendar-disciplina'); sd.innerHTML = permitidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); sd.style.display = permitidas.length > 1 ? 'block' : 'none'; document.getElementById('evento-titulo').value = ''; document.getElementById('evento-data').value = ''; document.getElementById('evento-hora').value = ''; document.getElementById('evento-hora').style.display = 'none'; document.getElementById('evento-periodo').value = 'dia'; document.getElementById('modal-agendar-evento').style.display = 'flex'; return; }
    if (e.target.closest('#btn-gravar-evento')) { const t = document.getElementById('evento-titulo').value.trim(); const d = document.getElementById('evento-data').value; const tp = document.getElementById('evento-tipo').value; const p = document.getElementById('evento-periodo').value; const h = document.getElementById('evento-hora').value; const sd = document.getElementById('agendar-disciplina'); const disc = sd.style.display === 'block' ? sd.value : (state.disciplinasProfessor[0] || "Geral"); if (!t || !d) return alert("Preenche Título e Data."); if (p === 'hora' && !h) return alert("Preenche a hora exata do evento."); const b = e.target.closest('#btn-gravar-evento'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { await addDoc(collection(db, "turmas", state.selectedTurma, "eventos"), { titulo: `[${disc}] ${t}`, data: d, tipo: tp, periodo: p, hora: h, professor: state.myUserName }); b.innerHTML = '<i class="fa-solid fa-check"></i> Agendado'; setTimeout(() => { b.innerHTML = 'Agendar'; b.disabled = false; document.getElementById('modal-agendar-evento').style.display = 'none'; carregarRadarProfessor(); analisarEAtualizarTurma(state.selectedTurma); }, 1500); } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); } return; }
    
    // OCORRENCIAS / REUNIÕES / JUSTIFICAÇÕES E SÍNTESES
    if (e.target.closest('#btn-dar-positiva')) { if (!state.alunoSelecionadoId) return; document.getElementById('oco-tipo').value = 'positiva'; document.getElementById('oco-titulo').innerHTML = '<i class="fa-solid fa-star" style="color:var(--success-green);"></i> Ocorrência Positiva'; document.getElementById('oco-motivo').value = ''; document.getElementById('btn-gravar-ocorrencia').style.background = 'var(--success-green)'; document.getElementById('modal-ocorrencia').style.display = 'flex'; return; }
    if (e.target.closest('#btn-dar-negativa')) { if (!state.alunoSelecionadoId) return; document.getElementById('oco-tipo').value = 'negativa'; document.getElementById('oco-titulo').innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger-red);"></i> Ocorrência Negativa'; document.getElementById('oco-motivo').value = ''; document.getElementById('btn-gravar-ocorrencia').style.background = 'var(--danger-red)'; document.getElementById('modal-ocorrencia').style.display = 'flex'; return; }
    if (e.target.closest('#btn-gravar-ocorrencia')) { const tipo = document.getElementById('oco-tipo').value; const motivo = document.getElementById('oco-motivo').value.trim(); if (!motivo) return alert("Preenche o motivo!"); const b = e.target.closest('#btn-gravar-ocorrencia'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { if (tipo === 'positiva') { const uS = await getDoc(doc(db, "utilizadores", state.alunoSelecionadoId)); let axp = uS.exists() && uS.data().xp ? uS.data().xp : 0; await addDoc(collection(db, "utilizadores", state.alunoSelecionadoId, "ocorrencias"), { titulo: "Reconhecimento Positivo", descricao: motivo, tipo: "positiva", autor: state.myUserName, timestamp: Date.now(), data: new Date().toLocaleDateString('pt-PT') }); await updateDoc(doc(db, "utilizadores", state.alunoSelecionadoId), { xp: axp + 50 }); } else { await addDoc(collection(db, "utilizadores", state.alunoSelecionadoId, "ocorrencias"), { titulo: "Registo de Aula", descricao: motivo, tipo: "negativa", autor: state.myUserName, timestamp: Date.now(), data: new Date().toLocaleDateString('pt-PT') }); } b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; setTimeout(() => { b.innerHTML = 'Confirmar Registo'; b.disabled = false; document.getElementById('modal-ocorrencia').style.display = 'none'; document.getElementById('modal-perfil-aluno').style.display = 'none'; analisarEAtualizarTurma(state.selectedTurma); }, 1500); } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); } return; }
    if (e.target.closest('#btn-justificar-faltas')) { if (!state.alunoSelecionadoId) return; document.getElementById('modal-confirm-justificar').style.display = 'flex'; return; }
    if (e.target.closest('#btn-executar-justificar')) { const b = e.target.closest('#btn-executar-justificar'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { const fS = await getDocs(query(collection(db, "utilizadores", state.alunoSelecionadoId, "faltas"), where("justificada", "==", false))); for (const f of fS.docs) { await updateDoc(doc(db, "utilizadores", state.alunoSelecionadoId, "faltas", f.id), { justificada: true, justificadaPor: state.myUserName }); } b.innerHTML = '<i class="fa-solid fa-check"></i> Faltas Justificadas'; setTimeout(() => { b.innerHTML = 'Sim, Justificar'; b.disabled = false; document.getElementById('modal-confirm-justificar').style.display = 'none'; abrirPerfil360Aluno(state.alunoSelecionadoId); analisarEAtualizarTurma(state.selectedTurma); }, 2000); } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 2000); } return; }
    if (e.target.closest('#btn-salvar-obs-dt')) { 
        if (!state.alunoSelecionadoId) return; 
        const txt = document.getElementById('p-aluno-obs-dt').value.trim(); 
        const b = e.target.closest('#btn-salvar-obs-dt'); 
        b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; 
        try { 
            const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
            if (isDT) {
                await setDoc(doc(db, "utilizadores", state.alunoSelecionadoId, "reunioes", "1_avaliacao"), { global: txt }, { merge: true }); 
            } else {
                const disc = state.disciplinasProfessor[0] || 'geral';
                await setDoc(doc(db, "utilizadores", state.alunoSelecionadoId, "reunioes", "sintese_" + disc), { texto: txt }, { merge: true });
            }
            b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; b.style.backgroundColor = "var(--success-green)"; 
            setTimeout(() => { b.innerHTML = 'Gravar Síntese'; b.disabled = false; b.style.backgroundColor = "var(--primary-green)"; }, 2000); 
        } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 2000); } return; 
    }
});
