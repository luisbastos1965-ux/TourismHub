import { auth, db, messaging, VAPID_KEY, getToken, onMessage } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, updateDoc, getDocs, query, addDoc, onSnapshot, orderBy, setDoc, enableIndexedDbPersistence, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const ordemDisciplinasGlobal = ['PORT', 'ING', 'AI', 'EF', 'TIC', 'GEO', 'HCA', 'MAT', 'CF', 'TIAT', 'TCAT', 'OTET'];

try { await enableIndexedDbPersistence(db); console.log("Offline OK!"); } catch (e) {}

let myUserId = "", myUserName = "", minhaTurma = "", myAcademia = "";
let chartInstance = null; let quillEditor = null;
let alunoForumAtivoId = null; let chatUnsubscribeAluno = null; let pendingDeleteChatId = null;
let fQB64 = "";

let pTmr = null; let pTimeConfig = 30; let pXPConfig = 50; let pRest = 30 * 60;
const focusXPMap = { '15': 25, '25': 40, '30': 50, '45': 75, '60': 100 };

window.timelineFilterCat = 'all'; window.notifFilterCat = 'all';
let ahModo = 'dia', ahDOff = 0, ahSOff = 0;

const ACADEMIAS_INFO = {
    'atlas': { nome: 'Atlas', cor: '#00cc88', icon: 'fa-compass', desc: 'A academia dos Exploradores. Movidos pela curiosidade e descoberta.' },
    'sentinela': { nome: 'Sentinela', cor: '#0088ff', icon: 'fa-shield-halved', desc: 'A academia dos Guardiões. Destacam-se pela responsabilidade e organização.' },
    'nexus': { nome: 'Nexus', cor: '#ff8800', icon: 'fa-microchip', desc: 'A academia dos Inovadores. Criativos, focados em encontrar novas soluções.' },
    'aurora': { nome: 'Aurora', cor: '#b82bf2', icon: 'fa-bolt', desc: 'A academia dos Desafiadores. Competitivos, resilientes e mestres do foco.' }
};

// ==========================================
// 1. INICIALIZAÇÃO
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            if (docSnap.exists() && docSnap.data().papel === 'aluno') {
                const d = docSnap.data(); myUserName = d.nome.split(' ')[0]; minhaTurma = d.turma; myAcademia = d.academia || null;
                
                document.getElementById('header-user-name-aluno').innerText = myUserName;
                document.getElementById('welcome-nome').innerText = myUserName;
                document.getElementById('perfil-nome-central').innerText = d.nome || myUserName;
                if(d.fotoPerfil) {
                    document.getElementById('header-avatar-circle').innerHTML = `<img src="${d.fotoPerfil}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    document.getElementById('perfil-avatar-img').src = d.fotoPerfil;
                } else { document.getElementById('perfil-avatar-img').src = `https://ui-avatars.com/api/?name=${myUserName}&background=00cc88&color=fff&size=100`; }

                const objSelect = document.getElementById('obj-disciplina');
                if(objSelect) objSelect.innerHTML = ordemDisciplinasGlobal.map(dc => `<option value="${dc}">${dc}</option>`).join('');

                carregarDadosPassaporte(d); carregarGamificacao(d);
                await construirHomeAdaptativa(); verificarEpocaExames();
                if (!myAcademia) iniciarQuizAcademias(); else aplicarTemaAcademia(myAcademia);
                
                setTimeout(iniciarRodaFoco, 1000); // Inicia mecânica da roda do modo foco
            } else window.location.href = "index.html";
        } catch (e) { console.error("Erro Auth", e); }
    } else window.location.href = "index.html";
});

document.getElementById('btn-logout-aluno')?.addEventListener('click', () => signOut(auth));

let quizScores = { atlas: 0, sentinela: 0, nexus: 0, aurora: 0 }; let currentQuestion = 1;
function iniciarQuizAcademias() { document.getElementById('modal-academia-quiz').style.display = 'flex'; document.querySelectorAll('.quiz-opt').forEach(btn => { btn.addEventListener('click', (e) => { const chosen = e.currentTarget.getAttribute('data-house'); quizScores[chosen]++; currentQuestion++; avancarQuiz(); }); }); }
function avancarQuiz() { const qText = document.getElementById('quiz-question-text'); const opts = document.querySelectorAll('.quiz-opt'); if (currentQuestion === 2) { qText.innerText = "2. Como preferes trabalhar e estudar?"; opts[0].innerText = "Em visitas de estudo e a explorar a matéria livremente."; opts[1].innerText = "Com método, rotinas, tarefas bem definidas e prazos."; opts[2].innerText = "Com as mãos na massa, construindo algo ou no PC."; opts[3].innerText = "Em maratonas, desafios e a cronometrar o meu tempo."; } else if (currentQuestion === 3) { qText.innerText = "3. Se tivesses de escolher o teu 'Superpoder', qual seria?"; opts[0].innerText = "Visão Raio-X (Curiosidade para ver além do óbvio)."; opts[1].innerText = "Escudo Protetor (Responsabilidade e lealdade)."; opts[2].innerText = "Varinha Mágica (Criatividade e Inovação)."; opts[3].innerText = "Super Velocidade (Foco, rapidez e energia)."; } else if (currentQuestion > 3) { finalizarQuiz(); } }
async function finalizarQuiz() { let winningHouse = Object.keys(quizScores).reduce((a, b) => quizScores[a] > quizScores[b] ? a : b); if(quizScores[winningHouse] === 0) winningHouse = 'atlas'; myAcademia = winningHouse; const ac = ACADEMIAS_INFO[winningHouse]; document.getElementById('quiz-question-container').style.display = 'none'; document.getElementById('quiz-result-container').style.display = 'block'; document.getElementById('quiz-result-icon').innerHTML = `<i class="fa-solid ${ac.icon}" style="color: ${ac.cor}; text-shadow: 0 0 20px ${ac.cor};"></i>`; document.getElementById('quiz-result-name').innerText = ac.nome; document.getElementById('quiz-result-name').style.color = ac.cor; document.getElementById('quiz-result-desc').innerText = ac.desc; try { await updateDoc(doc(db, "utilizadores", myUserId), { academia: winningHouse }); } catch(e) {} document.getElementById('btn-entrar-app').addEventListener('click', () => { document.getElementById('modal-academia-quiz').style.display = 'none'; aplicarTemaAcademia(winningHouse); }); }
function aplicarTemaAcademia(idHouse) { const ac = ACADEMIAS_INFO[idHouse]; if(!ac) return; document.documentElement.style.setProperty('--primary-green', ac.cor); const rankElem = document.getElementById('aluno-rank-title'); const rankCentral = document.getElementById('perfil-titulo-central'); if(rankElem) rankElem.innerText = `${rankElem.innerText.split('•')[0].trim()} • ${ac.nome}`; if(rankCentral) rankCentral.innerHTML = `<i class="fa-solid ${ac.icon}"></i> ${ac.nome}`; }


// ==========================================
// 2. EVENT DELEGATION GLOBAL (CLIQUES SEGUROS)
// ==========================================
function esconderTodasAsVistas() { document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none'); }

document.body.addEventListener('click', async (e) => {
    
    // NAV BAR INFERIOR
    const nav = e.target.closest('.nav-item');
    if(nav) {
        e.preventDefault(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); nav.classList.add('active');
        esconderTodasAsVistas(); const tId = nav.getAttribute('data-target'); 
        document.getElementById(tId).style.display = (tId === 'view-study-mode' || tId === 'view-aluno-forum') ? 'flex' : 'block';
        if(tId === 'view-aluno-perfil') { carregarRankingTurma(); carregarObjetivosPessoais(); carregarHistoricoHumor(); setTimeout(renderizarGraficoNotas, 150); }
        if(tId === 'view-aluno-caderneta') document.getElementById('tab-aluno-timeline').click();
        if(tId === 'view-aluno-agenda') document.getElementById('tab-aluno-eventos').click();
        if(tId === 'view-aluno-forum') carregarForuns();
        if(tId === 'view-aluno-caderno') { if(!quillEditor) quillEditor = new Quill('#quill-editor', { theme: 'snow' }); carregarResumos(); }
    }
    
    // FERRAMENTAS
    if(e.target.closest('#btn-open-study-mode')) {
        esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); document.getElementById('view-study-mode').style.display = 'flex';
        if(localStorage.getItem('pomodoroEndTarget') && localStorage.getItem('pomodoroEndTarget') > Date.now()) { document.getElementById('btn-start-study').click(); }
        setTimeout(()=>document.getElementById('study-wheel').scrollTop=60, 50); // Centra aos 30min
    }
    if(e.target.closest('#btn-open-caderno')) {
        esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); document.getElementById('view-aluno-caderno').style.display = 'block';
        if(!quillEditor) quillEditor = new Quill('#quill-editor', { theme: 'snow' }); carregarResumos(); document.getElementById('tab-caderno-resumos').click();
    }
    if(e.target.closest('#btn-open-sumarios')) { esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); document.getElementById('view-aluno-sumarios').style.display = 'block'; carregarSumariosAluno(); }
    if(e.target.closest('#btn-abrir-passaporte')) { esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); document.getElementById('view-aluno-passaporte').style.display = 'block'; }
    if(e.target.closest('#btn-open-notificacoes')) { esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); document.getElementById('view-aluno-notificacoes').style.display = 'block'; carregarNotificacoesAluno(); }
    if(e.target.closest('#btn-voltar-notificacoes') || e.target.closest('#btn-voltar-caderno') || e.target.closest('#btn-voltar-sumarios') || e.target.closest('#btn-voltar-passaporte') || e.target.closest('#btn-voltar-study')) {
        document.querySelector('.nav-item[data-target="student-dashboard"]').click();
    }

    // CADERNETA (TABS SUPERIORES)
    if(e.target.closest('#tab-aluno-timeline')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='flex'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center">A carregar...</p>'; carregarTimelineAluno(); }
    if(e.target.closest('#tab-aluno-notas')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center">A carregar...</p>'; carregarNotasAluno(); }
    if(e.target.closest('#tab-aluno-faltas')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center">A carregar...</p>'; carregarFaltasAluno(); }
    if(e.target.closest('#tab-aluno-prhfs')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center">A carregar...</p>'; carregarPrhfsAluno(); }
    if(e.target.closest('#tab-aluno-comportamento')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center">A carregar...</p>'; carregarComportamentoAluno(); }
    if(e.target.closest('#tab-aluno-observacoes')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center">A carregar...</p>'; carregarObservacoesAluno(); }

    // FILTROS
    const tChip = e.target.closest('#timeline-filtros .filter-chip');
    if(tChip) { document.querySelectorAll('#timeline-filtros .filter-chip').forEach(c => c.classList.remove('active')); tChip.classList.add('active'); window.timelineFilterCat = tChip.getAttribute('data-cat'); carregarTimelineAluno(); }
    const nChip = e.target.closest('#notificacoes-filtros .filter-chip');
    if(nChip) { document.querySelectorAll('#notificacoes-filtros .filter-chip').forEach(c => c.classList.remove('active')); nChip.classList.add('active'); window.notifFilterCat = nChip.getAttribute('data-cat'); carregarNotificacoesAluno(); }

    // CADERNO DIGITAL
    if(e.target.closest('#tab-caderno-resumos')) { document.getElementById('tab-caderno-resumos').classList.add('active'); document.getElementById('tab-caderno-galeria').classList.remove('active'); document.getElementById('sec-caderno-resumos').style.display = 'block'; document.getElementById('sec-caderno-galeria').style.display = 'none'; }
    if(e.target.closest('#tab-caderno-galeria')) { document.getElementById('tab-caderno-galeria').classList.add('active'); document.getElementById('tab-caderno-resumos').classList.remove('active'); document.getElementById('sec-caderno-resumos').style.display = 'none'; document.getElementById('sec-caderno-galeria').style.display = 'block'; carregarFotosQuadro(); }
    
    if(e.target.closest('#btn-gravar-apontamento')) {
        const t = document.getElementById('caderno-titulo').value.trim(); const h = quillEditor.root.innerHTML; const txt = quillEditor.getText().trim(); 
        if(!t || txt.length === 0) { alert("Preenche o título e o resumo!"); return; }
        const b = e.target.closest('#btn-gravar-apontamento'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try { 
            await addDoc(collection(db, "utilizadores", myUserId, "apontamentos"), { titulo: t, conteudo: h, timestamp: Date.now() }); 
            document.getElementById('caderno-titulo').value = ''; quillEditor.root.innerHTML = ''; b.innerHTML = '<i class="fa-solid fa-check"></i> Guardado'; b.style.backgroundColor = 'var(--success-green)'; 
            carregarResumos(); setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-save"></i> Gravar na Nuvem'; b.disabled = false; b.style.backgroundColor = '#e67e22'; }, 2000); 
        } catch(err) { console.error(err); b.innerHTML = 'Erro Interno!'; setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-save"></i> Gravar na Nuvem'; b.disabled = false; }, 2000); }
    }
    
    if(e.target.closest('#btn-gravar-foto-quadro')) {
        const t = document.getElementById('foto-titulo').value.trim(); 
        if(!t) { alert("Preenche o Título da Foto primeiro!"); return; }
        if(!fQB64) { alert("Tira ou anexa uma foto primeiro!"); return; }
        const b = e.target.closest('#btn-gravar-foto-quadro'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; 
        try { 
            await addDoc(collection(db, "utilizadores", myUserId, "caderno_fotos"), { titulo: t, fotoBase64: fQB64, timestamp: Date.now() }); 
            b.innerHTML = '<i class="fa-solid fa-check"></i> Guardada'; 
            setTimeout(() => { b.style.display = 'none'; b.disabled = false; b.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Gravar na Galeria'; document.getElementById('foto-quadro-file-name').innerText = ""; document.getElementById('foto-titulo').value = ""; fQB64 = ""; carregarFotosQuadro(); }, 2000); 
        } catch(err) { console.error(err); b.innerHTML = "Erro Interno"; setTimeout(() => { b.disabled = false; }, 2000); } 
    }

    // AGENDA E HORÁRIO
    if(e.target.closest('#tab-aluno-eventos')) { document.getElementById('tab-aluno-eventos').classList.add('active'); document.getElementById('tab-aluno-horario').classList.remove('active'); document.getElementById('aluno-agenda-filtros').style.display = 'flex'; document.getElementById('aluno-horario-container').style.display = 'none'; carregarAgendaAlunoLista(); }
    if(e.target.closest('#tab-aluno-horario')) { document.getElementById('tab-aluno-horario').classList.add('active'); document.getElementById('tab-aluno-eventos').classList.remove('active'); document.getElementById('aluno-agenda-filtros').style.display = 'none'; document.getElementById('aluno-horario-container').style.display = 'block'; carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-horario-dia')) { ahModo = 'dia'; document.getElementById('btn-aluno-horario-dia').classList.add('active'); document.getElementById('btn-aluno-horario-grelha').classList.remove('active'); carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-horario-grelha')) { ahModo = 'grelha'; document.getElementById('btn-aluno-horario-grelha').classList.add('active'); document.getElementById('btn-aluno-horario-dia').classList.remove('active'); carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-prev-horario')) { if(ahModo === 'dia') ahDOff--; else ahSOff--; carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-next-horario')) { if(ahModo === 'dia') ahDOff++; else ahSOff++; carregarHorarioAluno(); }

    // FÓRUNS (CRIAR E ABRIR)
    if(e.target.closest('#btn-create-chat-aluno')) {
        document.getElementById('modal-criar-forum').style.display = 'flex'; 
        const cCont = document.getElementById('lista-colegas-forum'); cCont.innerHTML = '<p class="text-muted center">A procurar colegas...</p>';
        try {
            const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", minhaTurma))); let cH = ''; 
            cS.forEach(d => { if(d.data().papel === 'aluno' && d.id !== myUserId) { cH += `<label style="display:flex; align-items:center; gap:10px; color:white; font-size:0.9rem; padding:8px 0; cursor:pointer;"><input type="checkbox" class="colegas-check" value="${d.id}" style="width:18px;height:18px;accent-color:var(--primary-green);"> ${d.data().nome}</label>`; } });
            cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Ainda és o único aluno registado nesta turma.</p>' : cH;
        } catch(err) { cCont.innerHTML = '<p class="text-danger center">Erro ao listar turma.</p>'; }
    }
    if(e.target.closest('#btn-cancelar-novo-forum')) { document.getElementById('modal-criar-forum').style.display = 'none'; document.getElementById('input-nome-novo-forum').value = ''; }
    if(e.target.closest('#btn-confirmar-novo-forum')) {
        const nome = document.getElementById('input-nome-novo-forum').value.trim(); if(!nome) { alert("Tens de dar um nome ao Grupo!"); return; }
        let mbr = [myUserId]; document.querySelectorAll('.colegas-check:checked').forEach(c => mbr.push(c.value));
        const btnConf = e.target.closest('#btn-confirmar-novo-forum'); btnConf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btnConf.disabled = true;
        try { await addDoc(collection(db, "turmas", minhaTurma, "foruns"), { nome: nome, tipo: 'permanente', isDefault: false, membros: mbr, criadoPor: myUserName }); document.getElementById('modal-criar-forum').style.display = 'none'; document.getElementById('input-nome-novo-forum').value = ''; btnConf.innerHTML = 'Criar Grupo'; btnConf.disabled = false; carregarForuns(); } catch(err) { btnConf.innerHTML = 'Erro!'; setTimeout(() => { btnConf.innerHTML = 'Criar Grupo'; btnConf.disabled = false; }, 2000); }
    }
    
    // Apagar Chat Modal
    if(e.target.closest('.btn-delete-chat')) {
        e.stopPropagation(); pendingDeleteChatId = e.target.closest('.btn-delete-chat').getAttribute('data-id');
        document.getElementById('modal-confirm-delete-chat').style.display = 'flex';
    }
    if(e.target.closest('#btn-cancel-delete-chat')) { document.getElementById('modal-confirm-delete-chat').style.display = 'none'; pendingDeleteChatId = null; }
    if(e.target.closest('#btn-confirm-delete-chat')) {
        if(pendingDeleteChatId) {
            const btn = e.target.closest('#btn-confirm-delete-chat'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
            try { await deleteDoc(doc(db, "turmas", minhaTurma, "foruns", pendingDeleteChatId)); document.getElementById('modal-confirm-delete-chat').style.display = 'none'; carregarForuns(); } catch(err){}
            finally { btn.innerHTML = 'Sim, Apagar'; btn.disabled = false; pendingDeleteChatId = null; }
        }
    }

    const cardF = e.target.closest('.canal-card');
    if(cardF && !e.target.closest('.btn-delete-chat')) {
        alunoForumAtivoId = cardF.getAttribute('data-id'); document.getElementById('aluno-chat-active-title').innerText = cardF.getAttribute('data-nome'); 
        document.getElementById('aluno-forum-channel-list').style.display = 'none'; document.getElementById('btn-create-chat-aluno').style.display = 'none'; document.getElementById('aluno-forum-chat-view').style.display = 'flex'; 
        iniciarChatAluno(alunoForumAtivoId);
    }
    if(e.target.closest('#btn-aluno-voltar-canais')) { document.getElementById('aluno-forum-chat-view').style.display = 'none'; document.getElementById('aluno-forum-channel-list').style.display = 'block'; document.getElementById('btn-create-chat-aluno').style.display = 'block'; }
    if(e.target.closest('#btn-aluno-send-msg')) {
        const inp = document.getElementById('aluno-input-forum-msg'); const t = inp.value.trim(); if(!t || !alunoForumAtivoId) return; 
        try { await addDoc(collection(db, "turmas", minhaTurma, "foruns", alunoForumAtivoId, "mensagens"), { remetente: myUserName, texto: t, timestamp: Date.now() }); inp.value = ''; } catch(err) {} 
    }

    // MODO FOCO (Botões)
    if(e.target.closest('#btn-start-study')) {
        pXPConfig = focusXPMap[pTimeConfig] || 50; pRest = pTimeConfig * 60;
        document.getElementById('btn-start-study').style.display = 'none'; document.getElementById('btn-stop-study').style.display = 'inline-block';
        document.getElementById('study-setup').style.display = 'none'; document.getElementById('study-timer-text').style.color = "var(--primary-green)";
        if(!localStorage.getItem('pomodoroEndTarget')) localStorage.setItem('pomodoroEndTarget', Date.now() + (pRest * 1000));
        renderTimerRunning(); if(pTmr) clearInterval(pTmr); pTmr = setInterval(renderTimerRunning, 1000);
    }
    if(e.target.closest('#btn-stop-study')) { resetPomodoroUI(); formatTimer(pTimeConfig * 60); }
    if(e.target.closest('#btn-save-study-log')) {
        const t = document.getElementById('study-log-text').value.trim(); if(!t) return;
        const b = e.target.closest('#btn-save-study-log'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            const uS = await getDoc(doc(db, "utilizadores", myUserId)); let axp = uS.exists() && uS.data().xp ? uS.data().xp : 0;
            await addDoc(collection(db, "utilizadores", myUserId, "estudos"), { texto: t, minutos: pTimeConfig, data: new Date().toISOString() });
            await updateDoc(doc(db, "utilizadores", myUserId), { xp: axp + pXPConfig }); carregarGamificacao({xp: axp + pXPConfig});
            b.style.backgroundColor = "var(--success-green)"; b.innerHTML = '<i class="fa-solid fa-check"></i> Feito!';
            setTimeout(() => { document.getElementById('study-log-text').value = ''; document.getElementById('post-study-log').style.display = 'none'; document.getElementById('study-controls').style.display = 'block'; document.getElementById('study-setup').style.display = 'block'; b.innerHTML = '<i class="fa-solid fa-save"></i> Guardar Recompensa'; b.disabled = false; b.style.backgroundColor = "var(--success-green)"; formatTimer(30*60); document.getElementById('btn-voltar-study').click(); }, 2000);
        } catch(err) { b.innerHTML = "Erro"; setTimeout(() => { b.disabled = false; }, 2000); }
    }
    
    // Objetivos Adicionar
    if(e.target.closest('#btn-add-objetivo')) {
        const tipo = document.getElementById('obj-tipo').value;
        let data = { tipo: tipo, concluido: false, timestamp: Date.now() };
        if(tipo === 'nota') {
            data.disciplina = document.getElementById('obj-disciplina').value; data.modulo = document.getElementById('obj-modulo').value; data.notaAlvo = document.getElementById('obj-nota-alvo').value;
            if(!data.disciplina || !data.modulo || !data.notaAlvo) return alert("Preenche todos os campos.");
            data.desc = `Tirar ${data.notaAlvo} no Mod. ${data.modulo} a ${data.disciplina}`;
        } else if (tipo === 'nivel') {
            data.nivelAlvo = document.getElementById('obj-nivel-alvo').value;
            if(!data.nivelAlvo) return alert("Preenche o nível alvo.");
            data.desc = `Alcançar o Nível ${data.nivelAlvo}`;
        } else if (tipo === 'prhf') { data.desc = `Concluir 1 Plano de Recuperação (PRHF)`; }
        
        try { await addDoc(collection(db, "utilizadores", myUserId, "objetivos"), data); document.getElementById('obj-nota-alvo').value = ''; document.getElementById('obj-nivel-alvo').value = ''; carregarObjetivosPessoais(); } catch(err) {}
    }
});

// ==========================================
// 2.5 EVENTOS DE CÂMARA E RODA DO FOCO
// ==========================================
document.addEventListener('change', async (e) => {
    // Foto
    if (e.target.id === 'upload-foto-quadro' || e.target.id === 'tirar-foto-quadro') {
        let file = e.target.files[0]; if(!file) return; 
        if (file.type.startsWith('image/')) { try { file = await imageCompression(file, { maxSizeMB: 0.4, maxWidthOrHeight: 1200, useWebWorker: true }); } catch (err) {} } 
        document.getElementById('foto-quadro-file-name').innerText = file.name || 'foto_capturada.jpg'; document.getElementById('btn-gravar-foto-quadro').style.display = 'block'; 
        const rd = new FileReader(); rd.onload = (ev) => { fQB64 = ev.target.result; }; rd.readAsDataURL(file); 
    }
    // Mudança de Tipo de Objetivo
    if (e.target.id === 'obj-tipo') {
        const v = e.target.value; document.getElementById('obj-setup-nota').style.display = v === 'nota' ? 'flex' : 'none'; document.getElementById('obj-setup-nivel').style.display = v === 'nivel' ? 'flex' : 'none';
    }
    // Filtros Agenda
    if (e.target.closest('.agenda-filter-label input')) { carregarAgendaAlunoLista(); }
});

// Animação Roda do Foco (Scroll Snap Observer)
function iniciarRodaFoco() {
    const wheel = document.getElementById('study-wheel'); if(!wheel) return;
    const observer = new IntersectionObserver(entries => {
        entries.forEach(entry => {
            if(entry.isIntersecting) {
                document.querySelectorAll('.wheel-opt').forEach(el => { el.style.color = '#555'; el.style.fontSize = '1.2rem'; });
                entry.target.style.color = 'white'; entry.target.style.fontSize = '1.6rem';
                pTimeConfig = parseInt(entry.target.getAttribute('data-val'));
                if(!pTmr) formatTimer(pTimeConfig * 60);
            }
        });
    }, { root: wheel, threshold: 0.6 });
    document.querySelectorAll('.wheel-opt').forEach(el => observer.observe(el));
}

window.abrirFotoModal = (url, titulo) => { document.getElementById('modal-foto-img').src = url; document.getElementById('modal-foto-titulo').innerText = titulo; document.getElementById('modal-ver-foto').style.display = 'flex'; };

// ==========================================
// 3. DASHBOARD ADAPTATIVO MÁGICO
// ==========================================
async function construirHomeAdaptativa() {
    const alertCont = document.getElementById('hero-alert-section'); const emoCont = document.getElementById('hero-emotional-section');
    if(!alertCont || !emoCont) return;
    try {
        let tFaltas = 0, evs = [], pAtivos = 0, pHoras = 0, mRep = 0;
        const fS = await getDocs(collection(db, "utilizadores", myUserId, "faltas")); fS.forEach(d => { if(!d.data().justificada && !d.data().comprovativoEnviado) tFaltas++; });
        const nS = await getDocs(collection(db, "utilizadores", myUserId, "notas")); nS.forEach(d => { const n = d.data().nota; if(n==='REP'||Number(n)<10) mRep++; });
        const pS = await getDocs(collection(db, "utilizadores", myUserId, "prhfs")); pS.forEach(d => { if(d.data().status!=='concluida'){pAtivos++; pHoras+=Number(d.data().horasPresenciais||0);} });
        
        if(minhaTurma) {
            const evSnap = await getDocs(collection(db, "turmas", minhaTurma, "eventos"));
            const hj = new Date().toISOString().split('T')[0]; let d7 = new Date(); d7.setDate(d7.getDate()+7); const lIso = d7.toISOString().split('T')[0];
            evSnap.forEach(d => { const e = d.data(); if(e.data>=hj && e.data<=lIso && ['teste','avaliacao','entrega'].includes(e.tipo)) evs.push(e); });
            evs.sort((a,b)=>a.data.localeCompare(b.data));
        }

        let alertHtml = ''; let mMiss = false;
        if(tFaltas>0 || pAtivos>0 || mRep>0) {
            alertHtml += `<div class="card" style="background:linear-gradient(135deg,#ff4d4d,#cc0000); color:white; border:none; border-radius:16px; margin-bottom:20px;">
                <h3 style="margin-bottom:10px; font-size:1.8rem;"><i class="fa-solid fa-triangle-exclamation"></i> Ação Necessária</h3>
                <p style="font-size:1.1rem; margin-bottom:15px; opacity:0.9;">Tens pendências urgentes que prejudicam a tua avaliação.</p>
                <ul style="margin-bottom:20px; padding-left:20px; font-size:1.1rem; font-weight:bold; line-height:1.6;">
                    ${tFaltas>0?`<li>${tFaltas} Falta(s)</li>`:''}${mRep>0?`<li>${mRep} Módulo(s) Reprovado(s)</li>`:''}${pAtivos>0?`<li>${pAtivos} PRHF(s) pendentes (${pHoras}h presenciais)</li>`:''}
                </ul>
                <button class="primary-btn" style="background:white; color:#cc0000; font-size:1.1rem; padding:15px;" onclick="document.querySelector('.nav-item[data-target=\\'view-aluno-caderneta\\']').click()">Abrir Caderneta e Resolver</button>
            </div>`;
        } else if(evs.length>0) {
            const ev = evs[0]; const dF = ev.data.split('-').reverse().join('/');
            alertHtml += `<div class="card" style="background:linear-gradient(135deg,#ffaa00,#e67e22); color:white; border:none; border-radius:16px; margin-bottom:20px;">
                <h3 style="margin-bottom:10px; font-size:1.8rem;"><i class="fa-solid fa-calendar-exclamation"></i> Foco Total</h3>
                <p style="font-size:1.1rem; margin-bottom:15px; opacity:0.9;">Tens <strong>${ev.titulo}</strong> no dia ${dF}. Que tal iniciares um Pomodoro agora?</p>
                <button class="primary-btn" style="background:white; color:#e67e22; width:100%; font-size:1.1rem; padding:15px;" onclick="document.getElementById('btn-open-study-mode').click()"><i class="fa-solid fa-stopwatch"></i> Iniciar Foco</button>
            </div>`; mMiss = true;
        } else {
            alertHtml += `<div class="card" style="background:linear-gradient(135deg,var(--primary-green),var(--primary-hover)); color:white; border:none; border-radius:16px; margin-bottom:20px;">
                <h3 style="margin-bottom:5px; font-size:1.6rem;"><i class="fa-solid fa-leaf"></i> Dia Tranquilo</h3>
                <p style="font-size:1.05rem; margin-bottom:0; opacity:0.9;">Não tens avaliações marcadas nem pendências. Excelente altura para os teus resumos!</p>
            </div>`; mMiss = true;
        }
        alertCont.innerHTML = alertHtml;

        let emoHtml = '';
        if(minhaTurma) {
            const tSnap = await getDoc(doc(db, "turmas", minhaTurma));
            if(tSnap.exists() && tSnap.data().missaoTitulo) {
                const tm = tSnap.data();
                emoHtml += `<div class="card" id="missao-card" style="border-left:4px solid var(--warning-yellow); margin-bottom:20px;"><h3 style="font-size:1rem; margin-bottom:5px;"><i class="fa-solid fa-users"></i> Missão da Turma</h3><p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:${tm.missaoProgresso!==undefined?'10px':'0'};">${tm.missaoTitulo}</p>${tm.missaoProgresso!==undefined?`<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${tm.missaoProgresso}%; background:var(--warning-yellow);"></div></div>`:''}</div>`;
            }
        }
        const hjIso = new Date().toISOString().split('T')[0]; const hSnap = await getDoc(doc(db, "utilizadores", myUserId, "humor", hjIso));
        if(!hSnap.exists()) {
            emoHtml += `<div class="card" id="checkin-card-dinamico" style="border-left:4px solid #b82bf2; margin-bottom:20px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;"><h3 style="font-size: 1rem; margin:0;"><i class="fa-solid fa-heart-pulse"></i> Como te sentes hoje?</h3></div><div style="display: flex; justify-content: space-around; font-size: 2.2rem;" id="mood-buttons-dinamicos"><span class="mood-btn-dinamico" data-mood="😡" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">😡</span><span class="mood-btn-dinamico" data-mood="🙁" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">🙁</span><span class="mood-btn-dinamico" data-mood="😐" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">😐</span><span class="mood-btn-dinamico" data-mood="🙂" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">🙂</span><span class="mood-btn-dinamico" data-mood="🤩" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">🤩</span></div></div>`;
        }
        emoCont.innerHTML = emoHtml;
        document.querySelectorAll('.mood-btn-dinamico').forEach(btn => {
            btn.addEventListener('mouseover',()=>btn.style.filter='grayscale(0%)'); btn.addEventListener('mouseout',()=>btn.style.filter='grayscale(100%)');
            btn.addEventListener('click', async (e) => {
                const m = e.currentTarget.getAttribute('data-mood'); const s = await getDoc(doc(db, "utilizadores", myUserId)); let aXp = s.exists()&&s.data().xp?s.data().xp:0;
                await setDoc(doc(db, "utilizadores", myUserId, "humor", hjIso), { humor:m, timestamp:Date.now(), dataIso:hjIso }); await updateDoc(doc(db, "utilizadores", myUserId), { xp: aXp+10 }); carregarGamificacao({xp: aXp+10}); document.getElementById('checkin-card-dinamico').innerHTML = '<div style="text-align:center; color:var(--success-green); font-weight:bold; font-size:0.95rem; padding:10px;">Obrigado! <span style="color:var(--warning-yellow);">+10 XP</span></div>';
            });
        });
    } catch(e) { }
}

async function verificarEpocaExames() {
    if(!minhaTurma) return;
    const tSnap = await getDoc(doc(db, "turmas", minhaTurma));
    if(tSnap.exists() && tSnap.data().epocaExames?.ativa) {
        document.getElementById('exam-mode-banner').style.display='block'; document.body.style.borderTop="5px solid #8e2de2";
        if(tSnap.data().epocaExames.dataFim) {
            const df = Math.ceil((new Date(tSnap.data().epocaExames.dataFim) - new Date()) / (1000 * 60 * 60 * 24)); document.getElementById('exam-countdown').innerText = df > 0 ? `Faltam ${df} dias` : "Já terminou";
        }
    }
}

// ==========================================
// 4. PESQUISA UNIVERSAL
// ==========================================
document.getElementById('aluno-search-input')?.addEventListener('input', async (e) => {
    const termo = e.target.value.toLowerCase().trim(); const box = document.getElementById('aluno-search-results');
    if(termo.length < 2) { box.style.display = 'none'; return; } box.innerHTML = '<p class="text-muted" style="margin:0; font-size:0.85rem;">A procurar...</p>'; box.style.display = 'block';
    try {
        let resArr = []; const rDb = await getDocs(query(collection(db, "utilizadores", myUserId, "apontamentos")));
        rDb.forEach(d => { if(d.data().titulo?.toLowerCase().includes(termo)) resArr.push({ t: 'O Meu Resumo', txt: d.data().titulo, id: 'btn-open-caderno' }); });
        if (minhaTurma) { const sDb = await getDocs(query(collection(db, "turmas", minhaTurma, "sumarios"))); sDb.forEach(d => { if(d.data().titulo?.toLowerCase().includes(termo) || d.data().disciplina?.toLowerCase().includes(termo)) resArr.push({ t: `Sumário - ${d.data().disciplina}`, txt: d.data().titulo, id: 'btn-open-sumarios' }); }); }
        if(resArr.length === 0) box.innerHTML = '<p class="text-muted" style="margin:0; font-size:0.85rem;">Sem resultados.</p>'; else { let h = ''; resArr.forEach(r => h += `<div style="padding:8px; border-bottom:1px solid #333; cursor:pointer;" onclick="document.getElementById('${r.id}').click(); document.getElementById('aluno-search-results').style.display='none'; document.getElementById('aluno-search-input').value='';"><span style="font-size:0.7rem; color:var(--primary-green); text-transform:uppercase;">${r.t}</span><div style="font-size:0.9rem; color:white; margin-top:3px;">${r.txt}</div></div>`); box.innerHTML = h; }
    } catch(err) { box.innerHTML = '<p class="text-danger" style="margin:0;">Erro.</p>'; }
});
document.addEventListener('click', (e) => { if (!e.target.closest('#aluno-search-input') && !e.target.closest('#aluno-search-results')) { document.getElementById('aluno-search-results').style.display = 'none'; } });

// ==========================================
// 5. PERFIL: RANKING, OBJETIVOS, ESTATÍSTICAS
// ==========================================
function carregarGamificacao(dados) {
    const xp = dados.xp || 0; const nivel = Math.floor(xp / 100) + 1; const prog = ((xp - ((nivel - 1) * 100)) / 100) * 100;
    document.getElementById('aluno-nivel').innerText = nivel; document.getElementById('aluno-xp-atual').innerText = xp;
    if(document.getElementById('perfil-xp-totais')) { document.getElementById('perfil-xp-totais').innerText = xp; document.getElementById('perfil-xp-progress').style.width = `${prog}%`; }
}

async function carregarRankingTurma() {
    const c = document.getElementById('ranking-turma-container'); if(!minhaTurma) { c.innerHTML = '<p class="text-muted center">Sem turma atribuída.</p>'; return; }
    try {
        const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", minhaTurma), where("papel", "==", "aluno")));
        let alunos = []; snap.forEach(d => alunos.push({id: d.id, ...d.data()})); alunos.sort((a,b) => (b.xp || 0) - (a.xp || 0));
        let html = '';
        alunos.slice(0, 10).forEach((al, idx) => {
            let cor = 'var(--text-muted)'; if(idx === 0) cor = '#ffd700'; else if(idx === 1) cor = '#c0c0c0'; else if(idx === 2) cor = '#cd7f32';
            html += `<div style="display:flex; align-items:center; gap:10px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:8px; border-left:3px solid ${cor};"><span style="font-weight:bold; font-size:1.2rem; color:${cor}; width:25px; text-align:center;">${idx+1}</span><img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=00cc88&color=fff`}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;"><div style="flex:1;"><strong style="font-size:0.95rem; color:white;">${al.nome.split(' ')[0]} ${al.nome.split(' ').pop()}</strong><br><span style="font-size:0.7rem; color:var(--text-muted);">${al.academia ? ACADEMIAS_INFO[al.academia].nome : 'S/ Academia'}</span></div><span style="font-weight:bold; color:var(--primary-green); font-size:0.9rem;">${al.xp || 0} XP</span></div>`;
        });
        c.innerHTML = html === '' ? '<p class="text-muted center">Ainda não há alunos com XP.</p>' : html;
    } catch(e) { c.innerHTML = '<p class="text-danger center">Erro ao carregar ranking.</p>'; }
}

async function carregarObjetivosPessoais() {
    const cont = document.getElementById('lista-objetivos-container'); cont.innerHTML = '<p class="text-muted center">A carregar...</p>';
    try {
        const uSnap = await getDoc(doc(db, "utilizadores", myUserId)); const uXp = uSnap.exists() ? (uSnap.data().xp || 0) : 0; const currentNivel = Math.floor(uXp / 100) + 1;
        const nSnap = await getDocs(collection(db, "utilizadores", myUserId, "notas")); let notasArr = []; nSnap.forEach(n => notasArr.push(n.data()));
        const pSnap = await getDocs(collection(db, "utilizadores", myUserId, "prhfs")); let prhfsArr = []; pSnap.forEach(p => prhfsArr.push(p.data()));

        const snap = await getDocs(query(collection(db, "utilizadores", myUserId, "objetivos"))); let objArr = []; snap.forEach(d => objArr.push({id: d.id, ...d.data()})); objArr.sort((a,b) => b.timestamp - a.timestamp);
        let html = ''; let objGanhouXP = false;
        for (const obj of objArr) {
            let achieved = false;
            if(!obj.concluido) {
                if(obj.tipo === 'nota') { const temNota = notasArr.find(n => n.disciplina === obj.disciplina && Number(n.modulo) === Number(obj.modulo) && Number(n.nota) >= Number(obj.notaAlvo)); if(temNota) achieved = true; } 
                else if (obj.tipo === 'nivel') { if(currentNivel >= Number(obj.nivelAlvo)) achieved = true; } 
                else if (obj.tipo === 'prhf') { const temPrhfConcluido = prhfsArr.find(p => p.status === 'concluida'); if(temPrhfConcluido) achieved = true; }
            }
            if(achieved) { await updateDoc(doc(db, "utilizadores", myUserId, "objetivos", obj.id), { concluido: true }); obj.concluido = true; objGanhouXP = true; }
            const cColor = obj.concluido ? 'var(--success-green)' : '#444'; const txtDec = obj.concluido ? 'line-through' : 'none'; const txtColor = obj.concluido ? 'var(--text-muted)' : 'white';
            html += `<div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:8px; border-left: 3px solid ${cColor};"><div style="display:flex; align-items:center; gap:12px; flex:1;"><div style="width:24px; height:24px; border-radius:50%; border:2px solid ${cColor}; background:${obj.concluido ? cColor : 'transparent'}; display:flex; align-items:center; justify-content:center;">${obj.concluido ? '<i class="fa-solid fa-check" style="color:var(--bg-dark); font-size:0.75rem;"></i>' : ''}</div><span style="text-decoration:${txtDec}; color:${txtColor}; font-size:0.95rem; flex:1;">${obj.desc}</span></div><i class="fa-solid fa-trash" style="color:var(--danger-red); cursor:pointer; font-size:0.9rem; padding: 5px;" onclick="window.apagarObjetivo('${obj.id}')"></i></div>`;
        }
        if(objGanhouXP) { await updateDoc(doc(db, "utilizadores", myUserId), { xp: uXp + 50 }); carregarGamificacao({xp: uXp+50}); alert("🎉 Parabéns! Um Objetivo Inteligente foi concluído automaticamente! +50 XP"); }
        cont.innerHTML = html === '' ? '<p class="text-muted center" style="font-size:0.85rem;">Não tens metas ativas. Começa a desafiar-te!</p>' : html;
    } catch(e) {}
}

window.apagarObjetivo = async (id) => { if(confirm("Apagar meta?")) { try { await deleteDoc(doc(db, "utilizadores", myUserId, "objetivos", id)); carregarObjetivosPessoais(); } catch(e) {} } };

function renderizarGraficoNotas() {
    const ctx = document.getElementById('chart-notas-aluno'); if(!ctx) return;
    getDocs(collection(db, "utilizadores", myUserId, "notas")).then(notasDb => {
        let mapN = {}; notasDb.forEach(d => { const n = d.data(); if(n.nota!=='REP'&&!isNaN(n.nota)){ if(!mapN[n.disciplina])mapN[n.disciplina]={s:0,c:0}; mapN[n.disciplina].s+=Number(n.nota); mapN[n.disciplina].c++; } });
        let l=[], dt=[], bg=[]; Object.keys(mapN).forEach(dc => { l.push(dc); const md=(mapN[dc].s/mapN[dc].c).toFixed(1); dt.push(md); bg.push(md>=10?'#00cc88':'#ff4d4d'); });
        if(l.length===0){ l=["Sem Dados"]; dt=[0]; bg=["#333"]; }
        if(chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, { type:'bar', data:{labels:l, datasets:[{label:'Média', data:dt, backgroundColor:bg, borderRadius:6}]}, options:{responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true, max:20}, x:{grid:{display:false}}}, plugins:{legend:{display:false}}} });
    });
}

async function carregarEstatisticasEstudo() {
    try {
        const s = await getDocs(collection(db, "utilizadores", myUserId, "estudos")); let arr = []; s.forEach(d => arr.push(d.data()));
        let dU = new Set(); let mTot = 0; arr.forEach(d => { if(d.data) dU.add(d.data.split('T')[0]); mTot += Number(d.minutos || 30); });
        document.getElementById('total-minutos-foco').innerText = mTot>60?`${Math.floor(mTot/60)}h${mTot%60}m`:`${mTot}m`;
        let stk = 0; let dO = Array.from(dU).sort((a,b)=>b.localeCompare(a));
        if(dO.length>0){ let hj = new Date(); const hs = hj.toISOString().split('T')[0]; hj.setDate(hj.getDate()-1); const os = hj.toISOString().split('T')[0]; if(dO.includes(hs)||dO.includes(os)){ let cv = new Date(dO[0]); for(let i=0;i<dO.length;i++){ if(dO.includes(cv.toISOString().split('T')[0])){ stk++; cv.setDate(cv.getDate()-1); } else break; } } }
        document.getElementById('streak-dias').innerText = stk;
    } catch(e) {}
}

document.getElementById('btn-view-mood-history')?.addEventListener('click', carregarHistoricoHumor);
async function carregarHistoricoHumor() {
    const c = document.getElementById('mood-history-container'); c.innerHTML = '<p class="text-muted center">A atualizar...</p>';
    try {
        const s = await getDocs(collection(db, "utilizadores", myUserId, "humor")); let arr = []; s.forEach(d => arr.push(d.data())); arr.sort((a,b) => b.timestamp - a.timestamp);
        let h = '<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:10px;">'; arr.forEach(hh=>{ h+=`<div style="text-align:center;background:rgba(0,0,0,0.3);padding:10px;border-radius:8px;min-width:60px;"><div style="font-size:1.8rem;">${hh.humor}</div><div style="font-size:0.7rem;color:var(--text-muted);margin-top:5px;">${hh.dataIso.split('-').reverse().slice(0,2).join('/')}</div></div>`;});
        c.innerHTML = arr.length === 0 ? '<p class="text-muted center" style="margin:0;">Sem registos.</p>' : h+'</div>';
    } catch(e){}
}

document.getElementById('upload-avatar')?.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if(!file) return;
    try {
        const compressedFile = await imageCompression(file, { maxSizeMB: 0.2, maxWidthOrHeight: 500, useWebWorker: true }); const reader = new FileReader();
        reader.onload = async (ev) => { const base64 = ev.target.result; document.getElementById('perfil-avatar-img').src = base64; document.getElementById('header-avatar-circle').innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`; await updateDoc(doc(db, "utilizadores", myUserId), { fotoPerfil: base64 }); }; reader.readAsDataURL(compressedFile);
    } catch(err) {}
});

// ==========================================
// 6. CADERNETA 
// ==========================================
async function obterEventosLinhaTemporal() {
    let ev = [];
    const nS = await getDocs(collection(db, "utilizadores", myUserId, "notas")); nS.forEach(d => { ev.push({ time: new Date(d.data().data).getTime(), cat: 'notas', icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', titulo: 'Nova Avaliação', desc: `${d.data().disciplina}: <strong>${d.data().nota}</strong>` }); });
    const fS = await getDocs(collection(db, "utilizadores", myUserId, "faltas")); fS.forEach(d => { ev.push({ time: new Date(d.data().criadoEm || d.data().dataInicio).getTime(), cat: 'faltas', icon: '<i class="fa-solid fa-user-xmark"></i>', cor: d.data().justificada ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Falta a ${d.data().disciplina} (${d.data().horas}h)`, desc: d.data().justificada ? `Justificada` : `Por justificar` }); });
    const oS = await getDocs(collection(db, "utilizadores", myUserId, "ocorrencias")); oS.forEach(d => { ev.push({ time: d.data().timestamp, cat: 'comportamento', icon: d.data().tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>', cor: d.data().tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Registo Disciplinar`, desc: `<strong>${d.data().titulo}</strong>` }); });
    const hS = await getDocs(collection(db, "utilizadores", myUserId, "humor")); hS.forEach(d => { ev.push({ time: d.data().timestamp, cat: 'gamificacao', icon: '<i class="fa-solid fa-heart-pulse"></i>', cor: '#b82bf2', titulo: `Check-in Emocional`, desc: `${d.data().humor} (+10 XP)` }); });
    ev.sort((a,b) => b.time - a.time); return ev;
}

async function carregarTimelineAluno() {
    const cCont = document.getElementById('aluno-caderneta-content');
    try {
        let eventos = await obterEventosLinhaTemporal();
        if(window.timelineFilterCat !== 'all') { eventos = eventos.filter(e => e.cat === window.timelineFilterCat); }
        if(eventos.length === 0) { cCont.innerHTML = '<p class="text-muted center" style="margin-top:40px;">O teu histórico está limpo.</p>'; return; }
        let html = '<div class="timeline">'; eventos.forEach(e => { html += `<div class="timeline-item"><div class="timeline-icon" style="color:${e.cor}; border-color:${e.cor};">${e.icon}</div><div class="timeline-content" style="border-left: 3px solid ${e.cor};"><span class="timeline-date">${new Date(e.time).toLocaleDateString('pt-PT')}</span><strong style="color:white; display:block; margin-bottom:5px;">${e.titulo}</strong><p style="font-size:0.85rem; color:var(--text-light); margin:0;">${e.desc}</p></div></div>`; }); cCont.innerHTML = html + '</div>';
    } catch(e) {}
}

async function carregarNotificacoesAluno() {
    const cont = document.getElementById('aluno-notificacoes-container'); cont.innerHTML = '<p class="text-muted center">A ler alertas...</p>';
    try {
        let evs = await obterEventosLinhaTemporal();
        evs = evs.map(e => { let c='escola'; if(e.cat==='faltas'&&e.cor==='var(--danger-red)') c='importante'; if(e.cat==='gamificacao') c='gamificacao'; return {...e, nCat: c}; });
        if(window.notifFilterCat !== 'all') evs = evs.filter(e => e.nCat === window.notifFilterCat);
        const rec = evs.slice(0, 15);
        if(rec.length === 0) { cont.innerHTML = '<p class="text-muted center" style="margin-top:40px;">Sem alertas nesta categoria.</p>'; return; }
        let h = ''; rec.forEach(ev => { h += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${ev.cor}; display:flex; align-items:flex-start; gap: 15px; padding: 15px;"><div style="font-size: 1.5rem; color: ${ev.cor};">${ev.icon}</div><div><strong style="color:white; font-size:1rem; display:block; margin-bottom:3px;">${ev.titulo}</strong><span style="font-size:0.85rem; color:var(--text-light);">${ev.desc}</span><div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">${new Date(ev.time).toLocaleString('pt-PT')}</div></div></div>`; }); cont.innerHTML = h; 
        if(window.notifFilterCat === 'all') document.getElementById('badge-notificacoes').style.display = 'none';
    } catch(e) {}
}

async function carregarNotasAluno() {
    const cCont = document.getElementById('aluno-caderneta-content');
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", myUserId, "notas"));
        if(notasDb.empty) { cCont.innerHTML = '<p class="text-muted center">Sem notas lançadas.</p>'; return; }
        let disciplinas = {}; notasDb.forEach(d => { const n = d.data(); if(!disciplinas[n.disciplina]) disciplinas[n.disciplina] = []; disciplinas[n.disciplina].push(n); });
        let html = '';
        ordemDisciplinasGlobal.forEach(disc => {
            if(disciplinas[disc] && disciplinas[disc].length > 0) {
                let sum = 0; let c = 0; let modsHtml = '';
                disciplinas[disc].forEach(n => {
                    if(n.nota !== 'REP' && !isNaN(n.nota)) { sum += Number(n.nota); c++; }
                    const cor = (n.nota === 'REP' || Number(n.nota) < 10) ? 'var(--danger-red)' : 'var(--success-green)';
                    modsHtml += `<div class="modulo-row"><span>Módulo ${n.modulo}</span><span style="font-weight:bold; color:${cor};">${n.nota}</span></div>`;
                });
                const med = c > 0 ? (sum/c).toFixed(1) : '-'; const medCor = (med !== '-' && med < 10) ? 'var(--danger-red)' : 'white';
                html += `<div class="disciplina-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'"><span class="disciplina-title">${disc}</span><span><span style="font-size:0.75rem; color:var(--text-muted); margin-right:8px;">Média:</span><span class="disciplina-media" style="color:${medCor};">${med}</span> <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; margin-left:5px;"></i></span></div><div class="disciplina-modules">${modsHtml}</div>`;
            } else { html += `<div class="disciplina-header" style="cursor:default;"><span class="disciplina-title" style="color:var(--text-muted);">${disc}</span><span><span class="disciplina-media" style="color:var(--text-muted); font-size:0.9rem;">SN</span></span></div>`; }
        });
        cCont.innerHTML = html;
    } catch(e) {}
}

async function carregarFaltasAluno() {
    const cCont = document.getElementById('aluno-caderneta-content');
    try {
        const fDb = await getDocs(collection(db, "utilizadores", myUserId, "faltas")); let fObj = {}; fDb.forEach(d => { const f = d.data(); if(!fObj[f.disciplina]) fObj[f.disciplina] = []; fObj[f.disciplina].push(f); });
        const pDb = await getDocs(collection(db, "utilizadores", myUserId, "prhfs")); let hRec = {}; pDb.forEach(d => { const p = d.data(); if (p.status === 'concluida') { hRec[p.disciplina] = (hRec[p.disciplina] || 0) + Number(p.horasTotais || p.horas || 0); } });

        let html = '';
        ordemDisciplinasGlobal.forEach(disc => {
            let totF = 0; let fHtml = '';
            if(fObj[disc]) {
                fObj[disc].sort((a,b) => b.dataInicio.localeCompare(a.dataInicio));
                fObj[disc].forEach(f => {
                    totF += Number(f.horas || 0); 
                    const sc = f.justificada ? 'var(--success-green)' : 'var(--danger-red)'; const st = f.justificada ? 'Justificada' : 'Injustificada'; 
                    fHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px dashed #333;"><div><strong style="color:white; font-size:0.9rem;">Falta (${f.horas}h)</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${f.dataInicio}</span></div><span style="font-size:0.75rem; font-weight:bold; color:${sc}; padding:4px 8px; background:rgba(255,255,255,0.05); border-radius:12px;">${st}</span></div>`;
                });
            }

            const rec = hRec[disc] || 0; let fEf = totF - rec; if(fEf < 0) fEf = 0;
            let assiduidade = 100 - ((fEf / 50) * 100); if(assiduidade < 0) assiduidade = 0; if(assiduidade > 100) assiduidade = 100;
            let bC = assiduidade < 80 ? 'var(--danger-red)' : (assiduidade < 90 ? 'var(--warning-yellow)' : 'var(--success-green)');

            if(fObj[disc] && fObj[disc].length > 0) {
                html += `<div class="card" style="margin-bottom:15px; padding:15px; border-left: 4px solid ${bC};"><div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'"><div><strong style="font-size: 1.1rem; color:white;">${disc}</strong><div style="font-size: 0.8rem; color:var(--text-muted); margin-top:3px;">${totF}h Faltadas ${rec>0? `(<span style="color:var(--success-green);">${rec}h Recup.</span>)`:''}</div></div><div style="text-align:right;"><div style="font-weight:bold; color:${bC};">${assiduidade.toFixed(0)}%</div><div style="font-size:0.7rem; color:var(--text-muted);">Assiduidade</div></div></div><div style="display:none; margin-top:15px; border-top:1px solid #333; padding-top:10px;">${fHtml}</div></div>`;
            } else { html += `<div class="card" style="margin-bottom:10px; padding:15px; border-left: 4px solid var(--success-green); display:flex; justify-content:space-between; align-items:center;"><strong style="font-size: 1rem; color:var(--text-muted);">${disc}</strong><div style="text-align:right;"><div style="font-weight:bold; color:var(--success-green);">100%</div></div></div>`; }
        });
        cCont.innerHTML = html;
    } catch(e) {}
}

async function carregarPrhfsAluno() {
    const cCont = document.getElementById('aluno-caderneta-content');
    try {
        const prhfsDb = await getDocs(collection(db, "utilizadores", myUserId, "prhfs"));
        if(prhfsDb.empty) { cCont.innerHTML = '<p class="text-muted" style="text-align:center;">Não tens Planos de Recuperação.</p>'; return; }
        let arr = []; prhfsDb.forEach(d => { arr.push({id: d.id, ...d.data()}); }); arr.sort((a,b) => new Date(a.prazo) - new Date(b.prazo));
        
        let pendentes = arr.filter(p => p.status !== 'concluida'); let concluidos = arr.filter(p => p.status === 'concluida');
        let html = ''; 
        const renderP = (p) => {
            const isUrgente = p.moduloTerminado === true || p.moduloTerminado === "true"; const cor = isUrgente ? 'var(--danger-red)' : 'var(--warning-yellow)'; const txtSt = p.status === 'concluida' ? 'CONCLUÍDO' : (isUrgente ? 'URGENTE' : 'EM CURSO'); const corFinal = p.status === 'concluida' ? 'var(--success-green)' : cor; const hPres = Number(p.horasPresenciais || 0); 
            const aHtml = p.anexoBase64 ? `<a href="${p.anexoBase64}" download="PRHF_${p.disciplina}" class="secondary-btn small-btn" style="margin-bottom:10px; color:var(--primary-green); border-color:var(--primary-green);"><i class="fa-solid fa-download"></i> Documento do Professor</a>` : '';
            const fpHtml = p.feedbackProfessor ? `<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; margin-bottom:10px; font-size:0.85rem;"><strong style="color:var(--primary-green);">Prof:</strong> ${p.feedbackProfessor}</div>` : '';
            const propHtml = p.propostaAluno ? `<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; margin-bottom:15px; font-size:0.85rem;"><strong style="color:var(--warning-yellow);">A tua Proposta:</strong> ${p.propostaAluno} <br><span style="color:${p.propostaLidaDT ? 'var(--success-green)' : 'var(--text-muted)'}; font-size:0.75rem;"><i class="fa-solid ${p.propostaLidaDT ? 'fa-check-double' : 'fa-check'}"></i> ${p.propostaLidaDT ? 'Validada' : 'A aguardar validação'}</span></div>` : '';
            let btn = ''; if(p.status !== 'concluida' && hPres > 0) { btn = `<button class="primary-btn small-btn" style="width:100%; background-color:${corFinal}; color:${corFinal === 'var(--warning-yellow)' ? 'black' : 'white'};" onclick="window.abrirAcaoPrhf('${p.id}', '${p.disciplina}', '${p.modulo}', '${p.prazo}')">Agendar Sessão Presencial</button>`; }
            return `<div class="card" style="margin-bottom:15px; border-left: 4px solid ${corFinal};"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong style="font-size: 1.1rem; color:white;">${p.disciplina} (Mod. ${p.modulo})</strong><span style="color:${corFinal}; font-size:0.75rem; font-weight:bold;">${txtSt}</span></div><p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">${p.descricao}</p>${aHtml} ${fpHtml} ${propHtml}<div style="font-size:0.8rem; margin-bottom: 15px; border-top:1px dashed #333; padding-top:10px;">Data Limite: <strong style="color:${corFinal};">${p.prazo}</strong><br>Horas Presenciais: <strong>${hPres}h</strong></div>${btn}</div>`;
        };
        pendentes.forEach(p => html += renderP(p)); if(concluidos.length > 0) { html += `<div class="falta-date-divider" style="margin-top:20px;"><span>Concluídos</span></div>`; concluidos.forEach(p => html += renderP(p)); } cCont.innerHTML = html;
    } catch(e) {}
}

window.abrirAcaoPrhf = (id, disc, mod, prazo) => {
    esconderTodasAsVistas(); document.getElementById('view-aluno-acao-prhf').style.display = 'block'; document.getElementById('prhf-acao-titulo').innerText = `${disc} (Mod. ${mod})`; document.getElementById('prhf-acao-prazo').innerText = prazo;
    document.getElementById('btn-voltar-acao-prhf').onclick = () => { esconderTodasAsVistas(); document.getElementById('view-aluno-caderneta').style.display = 'block'; carregarPrhfsAluno(); };
    document.getElementById('btn-enviar-proposta-prhf').onclick = async (e) => {
        const d = document.getElementById('aluno-prhf-proposta-data').value; const hi = document.getElementById('aluno-prhf-proposta-hora-inicio').value; const hf = document.getElementById('aluno-prhf-proposta-hora-fim').value;
        if(!d || !hi || !hf) { alert("Preenche a data e horas!"); return; }
        const btn = e.currentTarget; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
        try { await updateDoc(doc(db, "utilizadores", myUserId, "prhfs", id), { propostaAluno: `Data: ${d.split('-').reverse().join('/')} | Das ${hi} às ${hf}`, propostaLidaDT: false }); btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviado'; btn.style.backgroundColor = 'var(--success-green)'; setTimeout(() => { document.getElementById('btn-voltar-acao-prhf').click(); btn.innerHTML = 'Enviar Proposta'; btn.disabled = false; btn.style.backgroundColor = 'var(--primary-green)';}, 1500); } catch(err) { btn.innerHTML = "Erro"; setTimeout(() => { btn.disabled = false; }, 1500); }
    };
};

async function carregarComportamentoAluno() {
    const cCont = document.getElementById('aluno-caderneta-content');
    try {
        const s = await getDocs(collection(db, "utilizadores", myUserId, "ocorrencias"));
        if(s.empty) { cCont.innerHTML = '<p class="text-muted" style="text-align:center;">Sem registos disciplinares.</p>'; return; }
        let regs = []; s.forEach(d => regs.push(d.data())); regs.sort((a,b) => b.data.localeCompare(a.data)); 
        let html = ''; regs.forEach(r => { const cor = r.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)'; const ic = r.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>'; html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; align-items:center; gap:8px; color:${cor}; margin-bottom:5px;">${ic} <strong>${r.titulo}</strong></div><span style="font-size:0.75rem; color:var(--text-muted);">Data: ${r.data} | Prof. ${r.autor}</span>${r.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">${r.descricao}</p>` : ''}</div>`; }); cCont.innerHTML = html;
    } catch(e) {}
}

async function carregarObservacoesAluno(rSel = '1_avaliacao') {
    const cCont = document.getElementById('aluno-caderneta-content');
    const rM = [{id: '1_intercalar', label: '1ª Intercalar'}, {id: '1_avaliacao', label: '1ª Avaliação'}, {id: '2_intercalar', label: '2ª Intercalar'}, {id: '2_avaliacao', label: '2ª Avaliação'}, {id: '3_avaliacao', label: '3ª Avaliação'}];
    let html = '<div style="display:flex; overflow-x:auto; gap:10px; margin-bottom:20px; padding-bottom:10px; scrollbar-width: none;">'; rM.forEach(r => { const bg = r.id === rSel ? 'var(--primary-green)' : 'var(--bg-dark)'; const color = r.id === rSel ? 'var(--bg-dark)' : 'var(--text-muted)'; html += `<button class="btn-select-reuniao" data-id="${r.id}" style="background:${bg}; color:${color}; border:1px solid #333; padding:8px 15px; border-radius:20px; cursor:pointer; font-weight:bold; white-space:nowrap; transition:0.2s; flex-shrink:0;">${r.label}</button>`; }); html += '</div><div id="reuniao-content-area"><p class="text-muted center">A carregar dados...</p></div>'; cCont.innerHTML = html;
    document.querySelectorAll('.btn-select-reuniao').forEach(btn => { btn.addEventListener('click', (e) => { carregarObservacoesAluno(e.currentTarget.getAttribute('data-id')); }); });

    try {
        const dS = await getDoc(doc(db, "utilizadores", myUserId, "reunioes", rSel)); let dR = dS.exists() ? dS.data() : {}; let cH = '<div style="display:flex; flex-direction:column; gap:10px;">';
        ordemDisciplinasGlobal.forEach(disc => { const cm = dR.disciplinas && dR.disciplinas[disc] ? dR.disciplinas[disc] : '<span style="color:var(--text-muted);">Sem comentário</span>'; cH += `<div class="card" style="margin-bottom:0; border-left:4px solid var(--primary-green); padding:15px;"><h4 style="margin-bottom:8px; color:white; font-size:1rem;">${disc}</h4><p style="color:var(--text-light); font-size:0.9rem; line-height:1.4; margin:0;">${cm}</p></div>`; });
        const gl = dR.global || '<span style="color:var(--text-muted);">Sem observações globais.</span>'; cH += `<div class="card" style="margin-top:15px; border:1px solid var(--warning-yellow); background:rgba(255,204,0,0.05); padding:15px;"><h3 style="color:var(--warning-yellow); margin-bottom:10px; font-size:1.1rem;"><i class="fa-solid fa-comment-dots"></i> Observações Globais</h3><p style="color:white; font-size:0.95rem; line-height:1.5; margin:0;">${gl}</p></div></div>`;
        document.getElementById('reuniao-content-area').innerHTML = cH;
    } catch(e) {}
}

// ==========================================
// 7. AGENDA E HORÁRIO
// ==========================================
async function carregarAgendaAlunoLista() {
    const sC = document.getElementById('aluno-agenda-content'); sC.innerHTML = '<p class="text-muted center">A sincronizar agenda...</p>'; if(!minhaTurma) return;
    const mT = document.getElementById('aluno-filtro-agenda-testes').checked; const mTr = document.getElementById('aluno-filtro-agenda-trabalhos').checked; const mO = document.getElementById('aluno-filtro-agenda-outros').checked;
    try {
        const evDb = await getDocs(collection(db, "turmas", minhaTurma, "eventos")); if(evDb.empty) { sC.innerHTML = '<p class="text-muted center">Sem eventos na escola.</p>'; return; }
        let evs = [];
        evDb.forEach(d => { const e = d.data(); let bgC = '#b82bf2'; let txtT = 'Evento'; if(e.tipo === 'teste' || e.tipo === 'avaliacao') { if(mT) { bgC = '#ffaa00'; txtT = 'Avaliação'; evs.push({...e, cor: bgC, txt: txtT}); } } else if(e.tipo === 'trabalho' || e.tipo === 'entrega') { if(mTr) { bgC = '#00d2ff'; txtT = 'Entrega'; evs.push({...e, cor: bgC, txt: txtT}); } } else { if(mO) evs.push({...e, cor: bgC, txt: txtT}); } });
        if(evs.length === 0) { sC.innerHTML = '<p class="text-muted center">Nenhum evento com os filtros atuais.</p>'; return; }
        const hj = new Date().toISOString().split('T')[0]; const fut = evs.filter(e => e.data >= hj).sort((a,b) => a.data.localeCompare(b.data)); const pas = evs.filter(e => e.data < hj).sort((a,b) => b.data.localeCompare(a.data));
        const mA = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; let html = '';
        const rEv = (ev) => { const dp = ev.data.split('-'); const mes = mA[parseInt(dp[1])-1]; return `<div class="calendar-event-card" style="border-left-color:${ev.cor}; margin-bottom:10px;"><div class="calendar-date-box"><span class="day">${dp[2]}</span><span class="month" style="color:${ev.cor};">${mes}</span></div><div class="calendar-info"><h4 style="margin:0; color:white;">${ev.titulo}</h4><span style="font-size:0.8rem; color:var(--text-muted);">${(ev.txt||'evento').toUpperCase()}</span></div></div>`; };
        if(fut.length > 0) fut.forEach(e => html += rEv(e)); else html += '<p class="text-muted center">Sem eventos futuros.</p>';
        if(pas.length > 0) { html += '<div class="calendar-divider" style="margin-top:20px;"><span>Passados</span></div>'; pas.forEach(e => html += rEv(e)); } sC.innerHTML = html;
    } catch(e) {}
}

const getCorEspecial = (dsc) => { const d = dsc.toLowerCase(); if(d.includes('alm')) return { c: 'var(--warning-yellow)', bg: 'rgba(255, 204, 0, 0.15)' }; if(d.includes('vis')) return { c: '#00d2ff', bg: 'rgba(0, 210, 255, 0.15)' }; if(d.includes('prhf')) return { c: 'var(--danger-red)', bg: 'rgba(255, 77, 77, 0.15)' }; if(d.includes('pap') || d.includes('fct')) return { c: '#ff9900', bg: 'rgba(255, 153, 0, 0.15)' }; if(['reunião','reuniao','livre','estudo'].some(k => d.includes(k))) return { c: '#b82bf2', bg: 'rgba(184, 43, 242, 0.15)' }; return { c: 'var(--primary-green)', bg: 'rgba(0, 204, 136, 0.1)' }; };

async function carregarHorarioAluno() {
    const sC = document.getElementById('aluno-agenda-content'); sC.innerHTML = '<p class="text-muted center">A gerar horário...</p>'; if(!minhaTurma) return;
    try {
        const dS = await getDoc(doc(db, "turmas", minhaTurma)); let hb = {}; if(dS.exists() && dS.data().horario) hb = dS.data().horario;
        const bK = ['1', '2', '3', '4', '1300', '5', '6', '7']; const bT = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' }; const dM = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']; const fDt = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
        
        if (ahModo === 'dia') {
            let tD = new Date(); tD.setDate(tD.getDate() + ahDOff); document.getElementById('aluno-horario-display').innerText = `${dM[tD.getDay()]}, ${fDt(tD)}`;
            let h = ''; let tAD = false; const dSStr = `${tD.getFullYear()}-${String(tD.getMonth()+1).padStart(2,'0')}-${String(tD.getDate()).padStart(2,'0')}`;
            bK.forEach(b => { const dc = hb[`${dSStr}_${b}`]; if(dc) { const sty = getCorEspecial(dc); h += `<div class="horario-list-item" style="border-left-color:${sty.c}; background-color:${sty.bg};"><div class="horario-time-col">${bT[b]}</div><div class="horario-disc-col"><div class="horario-disc-name">${dc}</div><div class="horario-prof" style="font-size:0.75rem; color:#888; margin-top:4px;">Prof. A Atribuir</div></div></div>`; tAD = true; } });
            sC.innerHTML = tAD ? h : '<p class="text-muted center" style="margin-top:30px;">Sem aulas neste dia.</p>';
        } else {
            let dT = new Date(); dT.setDate(dT.getDate() + (ahSOff * 7)); dT.setDate(dT.getDate() - (dT.getDay() === 0 ? 6 : dT.getDay() - 1)); let dE = new Date(dT); dE.setDate(dE.getDate() + 4);
            document.getElementById('aluno-horario-display').innerText = `${fDt(dT)} a ${fDt(dE)}`;
            let h = '<div class="horario-grid" style="min-width:100%;"><div class="horario-header"></div>'; let dI = new Date(dT);
            ['SEG','TER','QUA','QUI','SEX'].forEach(d => { h += `<div class="horario-header">${d}<span>${fDt(dI)}</span></div>`; dI.setDate(dI.getDate()+1); });
            bK.forEach(b => { h += `<div class="horario-time">${bT[b]}</div>`; dI = new Date(dT); for(let i=0; i<5; i++) { const dSStr = `${dI.getFullYear()}-${String(dI.getMonth()+1).padStart(2,'0')}-${String(dI.getDate()).padStart(2,'0')}`; const dc = hb[`${dSStr}_${b}`]; if(dc) { const sty = getCorEspecial(dc); h += `<div class="horario-slot" style="border:1px solid ${sty.c}; background-color:${sty.bg}; color:white;"><strong>${dc}</strong></div>`; } else h += `<div class="horario-slot"></div>`; dI.setDate(dI.getDate()+1); } });
            sC.innerHTML = h + '</div>';
        }
    } catch(e) {}
}

// ==========================================
// 8. FÓRUNS E CHAT
// ==========================================
async function carregarForuns() {
    const cont = document.getElementById('aluno-forum-channel-list'); cont.innerHTML = '<p class="text-muted center">A configurar fóruns...</p>'; if(!minhaTurma) return;
    let html = `<h3 style="font-size:1rem; color:var(--text-muted); margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">Apoio & Turma</h3><div class="canal-card" data-id="turma_global" data-nome="Turma ${minhaTurma}" style="margin-bottom: 15px;"><div class="canal-icon" style="color:#00cc88; border-color:#00cc88;"><i class="fa-solid fa-users"></i></div><div class="canal-info"><h4>Turma ${minhaTurma}</h4><p>Canal Geral</p></div></div><div class="canal-card" data-id="dt_${myUserId}" data-nome="Chat DT"><div class="canal-icon" style="color:#ffaa00; border-color:#ffaa00;"><i class="fa-solid fa-user-tie"></i></div><div class="canal-info"><h4>Diretor de Turma</h4><p>Mensagem Privada</p></div></div><h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Disciplinas</h3><div style="display:flex; flex-wrap:wrap; gap:10px;">`;
    ordemDisciplinasGlobal.forEach(disc => { html += `<div class="canal-card" data-id="disc_${disc}" data-nome="Fórum ${disc}" style="flex: 1 1 45%; padding: 10px;"><div class="canal-info" style="text-align:center;"><h4 style="margin:0; font-size:0.9rem; color:#00d2ff;"><i class="fa-solid fa-book-open"></i> ${disc}</h4></div></div>`; }); html += '</div>';
    try {
        const res = await getDocs(collection(db, "turmas", minhaTurma, "foruns")); let extrasHtml = '';
        res.forEach(docSnap => { const f = docSnap.data(); if(f.membros && f.membros.includes(myUserId) && !f.isDefault) { extrasHtml += `<div class="canal-card" data-id="${docSnap.id}" data-nome="${f.nome}" style="position:relative; flex: 1 1 45%; padding:10px;"><div class="canal-info" style="text-align:center;"><h4 style="margin:0; font-size:0.9rem; color:#b82bf2;"><i class="fa-solid fa-comments"></i> ${f.nome}</h4></div><i class="fa-solid fa-trash btn-delete-chat" data-id="${docSnap.id}" style="color:var(--danger-red); position:absolute; top:5px; right:5px; font-size:0.8rem; cursor:pointer; padding:5px;"></i></div>`; } });
        if (extrasHtml !== '') html += `<h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Os Meus Chats</h3><div style="display:flex; flex-wrap:wrap; gap:10px;">${extrasHtml}</div>`;
    } catch(e) {}
    cont.innerHTML = html;
}

function iniciarChatAluno(fId) {
    const chatContainer = document.getElementById('aluno-chat-messages-container'); chatContainer.innerHTML = ''; if(chatUnsubscribeAluno) chatUnsubscribeAluno();
    chatUnsubscribeAluno = onSnapshot(query(collection(db, "turmas", minhaTurma, "foruns", fId, "mensagens"), orderBy("timestamp")), (snapshot) => {
        let html = ''; snapshot.forEach(doc => { const msg = doc.data(); const isMe = msg.remetente === myUserName; const classe = isMe ? 'admin' : 'student'; html += `<div class="chat-bubble ${classe}"><strong>${isMe ? 'Tu' : msg.remetente}</strong><br>${msg.texto}<span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>`; });
        chatContainer.innerHTML = html; chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

// ==========================================
// 9. POMODORO (Foco de Memória)
// ==========================================
function formatTimer(segundos) {
    if(segundos < 0) segundos = 0; const m = Math.floor(segundos / 60).toString().padStart(2, '0'); const s = (segundos % 60).toString().padStart(2, '0');
    document.getElementById('study-timer-text').innerText = `${m}:${s}`;
}

function resetPomodoroUI() {
    clearInterval(pTmr); pTmr = null; localStorage.removeItem('pomodoroEndTarget');
    document.getElementById('btn-stop-study').style.display = 'none'; document.getElementById('btn-start-study').style.display = 'inline-block';
    document.getElementById('study-setup').style.display = 'block'; document.getElementById('study-timer-text').style.color = "white";
}

function renderTimerRunning() {
    let target = localStorage.getItem('pomodoroEndTarget'); if(!target) return;
    let left = Math.round((target - Date.now()) / 1000);
    if(left <= 0) {
        resetPomodoroUI(); formatTimer(0);
        document.getElementById('study-controls').style.display = 'none'; document.getElementById('study-setup').style.display = 'none'; document.getElementById('post-study-log').style.display = 'block';
    } else formatTimer(left);
}

document.addEventListener('visibilitychange', () => {
    if (document.hidden && pTmr !== null) {
        clearInterval(pTmr); pTmr = null; localStorage.removeItem('pomodoroEndTarget');
        document.getElementById('foco-xp-perdido').innerText = `${pXPConfig} XP`;
        document.getElementById('modal-foco-interrompido').style.display = 'flex';
        resetPomodoroUI(); formatTimer(pTimeConfig * 60);
    }
});

// ==========================================
// 11. SUMÁRIOS E PASSAPORTE
// ==========================================
async function carregarSumariosAluno() {
    const c = document.getElementById('aluno-lista-sumarios-container'); c.innerHTML = '<p class="text-muted center">A carregar sumários...</p>'; if(!minhaTurma) return;
    try {
        const r = await getDocs(query(collection(db, "turmas", minhaTurma, "sumarios"))); if(r.empty) { c.innerHTML = '<p class="text-muted center">Nenhum material publicado pelos professores.</p>'; return; }
        let sum = []; let dU = new Set(); r.forEach(d => { const dt = d.data(); sum.push({id: d.id, ...dt}); dU.add(dt.disciplina); });
        const fS = document.getElementById('aluno-filtro-sumarios-disc'); if (fS.options.length <= 1) { let oH = '<option value="">Todas as Disciplinas</option>'; dU.forEach(dc => oH += `<option value="${dc}">${dc}</option>`); fS.innerHTML = oH; }
        const fA = fS.value; if(fA) sum = sum.filter(s => s.disciplina === fA); sum.sort((a,b) => b.data.localeCompare(a.data)); 
        if(sum.length === 0) { c.innerHTML = '<p class="text-muted" style="text-align:center;">Sem sumários para esta disciplina.</p>'; return; }
        let html = ''; sum.forEach(s => { const aB = s.anexoBase64 ? `<a href="${s.anexoBase64}" download="${s.anexoNome}" class="primary-btn small-btn" style="display:inline-block; margin-top:10px; width:auto; padding:8px 12px; background-color:#0099ff;"><i class="fa-solid fa-download"></i> Baixar ${s.anexoNome}</a>` : ''; html += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #0099ff;"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">${s.data} | ${s.disciplina} | Prof. ${s.professor}</span><h4 style="margin:5px 0;">${s.titulo}</h4>${s.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">${s.descricao}</p>` : ''}</div></div>${aB}</div>`; }); c.innerHTML = html;
    } catch(e) { c.innerHTML = '<p class="text-danger center">Erro ao carregar os dados.</p>'; }
}

function carregarDadosPassaporte(dados) {
    if(dados.fct) { document.getElementById('aluno-fct-horas').innerText = `${dados.fct.horasRealizadas||0} / ${dados.fct.horasTotal||0}h`; document.getElementById('aluno-fct-progress').style.width = `${((dados.fct.horasRealizadas||0)/(dados.fct.horasTotal||1))*100}%`; document.getElementById('input-fct-horas').value = dados.fct.horasRealizadas||'';}
    if(dados.pap) { document.getElementById('input-pap-tema').value = dados.pap.tema || ''; }
    if (dados.papFicheiroEnviado) document.getElementById('aluno-pap-file-name').innerText = "Ficheiro submetido.";
}
document.getElementById('btn-save-fct')?.addEventListener('click', async (e) => { const v = document.getElementById('input-fct-horas').value.trim(); if(!v) return; const b = e.currentTarget; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { await updateDoc(doc(db, "utilizadores", myUserId), { "fct.horasRealizadas": v }); b.style.backgroundColor = 'var(--success-green)'; b.innerHTML = '<i class="fa-solid fa-check"></i>'; setTimeout(() => { b.style.backgroundColor = 'var(--primary-green)'; b.innerHTML = '<i class="fa-solid fa-check"></i>'; b.disabled = false; }, 2000); } catch(err) {} });
document.getElementById('btn-save-pap-tema')?.addEventListener('click', async (e) => { const v = document.getElementById('input-pap-tema').value.trim(); if(!v) return; const b = e.currentTarget; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { await updateDoc(doc(db, "utilizadores", myUserId), { "pap.tema": v }); b.style.backgroundColor = 'var(--success-green)'; b.innerHTML = '<i class="fa-solid fa-check"></i>'; setTimeout(() => { b.style.backgroundColor = 'var(--primary-green)'; b.innerHTML = '<i class="fa-solid fa-save"></i>'; b.disabled = false; }, 2000); } catch(err) {} });
document.getElementById('btn-enviar-pap')?.addEventListener('click', async (e) => { if(!fPB64) return; const b = e.currentTarget; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { const snap = await getDoc(doc(db, "utilizadores", myUserId)); let axp = snap.exists()&&snap.data().xp?snap.data().xp:0; await updateDoc(doc(db, "utilizadores", myUserId), { papFicheiroEnviado:true, papFicheiroBase64:fPB64, xp:axp+200 }); b.style.backgroundColor="var(--success-green)"; b.innerHTML='<i class="fa-solid fa-check"></i> Submetido'; setTimeout(() => { b.style.display='none'; b.disabled=false; document.getElementById('aluno-pap-file-name').style.color="var(--success-green)"; }, 2000); } catch(err){} });

async function pedirPermissaoNotificacoes() { try { const p = await Notification.requestPermission(); if(p==='granted') { const r = await navigator.serviceWorker.register('./firebase-messaging-sw.js'); const t = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: r }); if(t) await updateDoc(doc(db, "utilizadores", myUserId), { tokenNotificacao: t }); } } catch(e){} }
if(typeof onMessage !== "undefined" && messaging) onMessage(messaging, p => alert(`NOVA NOTIFICAÇÃO:\n${p.notification.title}\n${p.notification.body}`));
setTimeout(() => { if(myUserId) pedirPermissaoNotificacoes(); }, 4000);
