import { auth, db, messaging, VAPID_KEY, getToken, onMessage } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, updateDoc, getDocs, query, addDoc, onSnapshot, orderBy, setDoc, enableIndexedDbPersistence, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

try { await enableIndexedDbPersistence(db); console.log("Offline OK!"); } catch (e) {}

let myUserId = "", myUserName = "", minhaTurma = "", myAcademia = "";
let chartInstance = null; let alunoForumAtivoId = null; let chatUnsubscribeAluno = null; let pendingDeleteChatId = null; let pendingDeleteObjetivoId = null;
let fPB64 = "";

window.timelineFilterCat = 'all'; window.notifFilterCat = 'all';
let ahModo = 'dia', ahDOff = 0, ahSOff = 0;

// ==========================================
// 1. A MATRIZ DE REFERÊNCIA OFICIAL (Mesma do EE)
// ==========================================
const matrizAmbos = {
    "Sociocultural": { "PORT": {"1": 33}, "ING": {"1": 27}, "AI": {"1": 36}, "EF": {"1": 10}, "TIC": {"1": 25} },
    "Científica": { "GEO": {"1": 33}, "HCA": {"1": 20}, "MAT": {"1": 33} }
};
const matrizAntigoTecnica = { "CF": {"1": 24}, "TIAT": {"1": 27}, "TCAT": {"1": 33}, "OTET": {"1": 24} };
const matrizNovoTecnica = { "AET": { "UC00038": 20 }, "OGOT": { "UC03629": 20 }, "CMET": { "UC00034": 30 }, "LNTT": { "UC00044": 50 } };

function obterDisciplinasDoAno() {
    const anoMatch = minhaTurma.match(/\d+/);
    const ano = anoMatch ? parseInt(anoMatch[0]) : 10;
    
    const base = {
        10: ["PORT", "ING", "AI", "EF", "TIC", "GEO", "HCA", "MAT"],
        11: ["PORT", "ING", "AI", "EF", "GEO", "HCA"],
        12: ["PORT", "ING", "EF", "GEO", "HCA"]
    };
    const tecAntigo = {
        10: ["CF", "TIAT", "TCAT", "OTET"],
        11: ["CF", "TIAT", "TCAT", "OTET"],
        12: ["TIAT", "OTET"]
    };
    const tecNovo = {
        10: ["AET", "OGOT", "CMET", "LNTT"],
        11: ["AET", "OGOT", "CMET", "LNTT"],
        12: ["AET", "OGOT", "CMET"]
    };
    
    let arr = [...(base[ano] || base[10])];
    if (ano >= 11) arr = [...arr, ...(tecAntigo[ano] || tecAntigo[11])];
    else arr = [...arr, ...(tecNovo[ano] || tecNovo[10])];
    return arr;
}

// ==========================================
// 2. INICIALIZAÇÃO E ACADEMIAS (TURISMO)
// ==========================================
const ACADEMIAS_INFO = {
    'estrategas': { nome: 'Academia dos Estrategas', cor: '#10b981', icon: 'fa-chess-knight', desc: 'Mestres do planeamento. Manténs a calma sob pressão, organizas a equipa e garantes que toda a logística de uma viagem funciona na perfeição.' },
    'embaixadores': { nome: 'Academia dos Embaixadores', cor: '#0ea5e9', icon: 'fa-handshake', desc: 'A alma da hospitalidade! És a primeira cara que os turistas veem, és resolutivo, empático e tens uma comunicação brilhante.' },
    'exploradores': { nome: 'Academia dos Exploradores', cor: '#f97316', icon: 'fa-compass', desc: 'Os guias de ação! Gostas de estar no terreno, detestas o trabalho de escritório e não tens medo de liderar grupos em plena aventura.' },
    'visionarios': { nome: 'Academia dos Visionários', cor: '#8b5cf6', icon: 'fa-lightbulb', desc: 'Os criativos do Turismo. Pensas "fora da caixa", desenhas experiências que não existem e dominas a promoção e o marketing.' }
};

const perguntasQuiz = [
    {
        q: "Um grupo de turistas acabou de chegar e o quarto ainda não está pronto. O que fazes?",
        opcoes: [
            { text: "Ofereço um café, converso com eles e faço com que se sintam em casa.", academia: "embaixadores" },
            { text: "Reorganizo rapidamente o mapa de limpezas com o departamento.", academia: "estrategas" },
            { text: "Sugiro e levo-os numa pequena visita aos jardins enquanto esperam.", academia: "exploradores" },
            { text: "Surpreendo-os com uma 'Experiência de Boas-Vindas' que criei.", academia: "visionarios" }
        ]
    },
    {
        q: "Num trabalho de grupo da escola, qual costuma ser o teu papel?",
        opcoes: [
            { text: "Dividir tarefas e garantir que não falhamos os prazos.", academia: "estrategas" },
            { text: "Apresentar o trabalho à turma, adoro comunicar.", academia: "embaixadores" },
            { text: "Sair da sala para pesquisar e recolher materiais no terreno.", academia: "exploradores" },
            { text: "Dar o toque final de design e juntar as ideias mais originais.", academia: "visionarios" }
        ]
    },
    {
        q: "Se pudesses escolher o teu ambiente de trabalho de sonho, seria...",
        opcoes: [
            { text: "Ao ar livre, a explorar trilhos ou cidades históricas.", academia: "exploradores" },
            { text: "No escritório, a gerir dados, preços e rotas com precisão.", academia: "estrategas" },
            { text: "Num lobby de um hotel de luxo, a falar com os clientes.", academia: "embaixadores" },
            { text: "Num estúdio criativo, a desenhar novas campanhas turísticas.", academia: "visionarios" }
        ]
    },
    {
        q: "Quando tens um problema difícil para resolver, como reages?",
        opcoes: [
            { text: "Improviso rapidamente usando a imaginação.", academia: "visionarios" },
            { text: "Mantenho a empatia e asseguro-me que ninguém está nervoso.", academia: "embaixadores" },
            { text: "Analiso os factos friamente e tomo a decisão mais lógica.", academia: "estrategas" },
            { text: "Sigo o meu instinto de aventura e tomo a iniciativa prática.", academia: "exploradores" }
        ]
    }
];

let pAtual = 0;
let quizScores = { estrategas: 0, embaixadores: 0, exploradores: 0, visionarios: 0 };

function getEmptyState(mensagem, icone = "fa-folder-open") {
    return `<div style="text-align:center; padding: 40px 20px; opacity: 0.5;">
                <i class="fa-solid ${icone}" style="font-size: 3.5rem; margin-bottom: 15px; color: var(--text-muted);"></i>
                <p style="font-size: 0.95rem; color: var(--text-muted);">${mensagem}</p>
            </div>`;
}

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
                if(objSelect) objSelect.innerHTML = obterDisciplinasDoAno().map(dc => `<option value="${dc}">${dc}</option>`).join('');

                const turmaAno = parseInt(minhaTurma.match(/\d+/)?.[0]) || d.ano || 10;
                const btnPassaporte = document.getElementById('btn-abrir-passaporte');
                const secFct = document.getElementById('sec-aluno-fct');
                const secPap = document.getElementById('sec-aluno-pap');
                
                if (turmaAno === 10) {
                    btnPassaporte.style.display = 'none';
                } else if (turmaAno === 11) {
                    btnPassaporte.style.display = 'flex'; document.getElementById('btn-passaporte-texto').innerText = 'FCT (Estágio)';
                    if(secFct) secFct.style.display = 'block'; if(secPap) secPap.style.display = 'none';
                } else {
                    btnPassaporte.style.display = 'flex'; document.getElementById('btn-passaporte-texto').innerText = 'Estágio / PAP';
                    if(secFct) secFct.style.display = 'block'; if(secPap) secPap.style.display = 'block';
                }

                carregarDadosPassaporte(d); carregarGamificacao(d);
                await construirHomeAdaptativa(); verificarEpocaExames();

                if (!myAcademia) iniciarQuizAcademias(); else aplicarTemaAcademia(myAcademia);
            } else window.location.href = "index.html";
        } catch (e) { console.error("Erro Auth", e); }
    } else window.location.href = "index.html";
});

document.getElementById('btn-logout-aluno')?.addEventListener('click', () => signOut(auth));

function iniciarQuizAcademias() { 
    document.getElementById('modal-academia-quiz').style.display = 'flex'; 
    document.getElementById('quiz-step-intro').style.display = 'block';
    document.getElementById('quiz-step-question').style.display = 'none';
    document.getElementById('quiz-step-result').style.display = 'none';
    document.getElementById('quiz-step-loading').style.display = 'none';
}

document.getElementById('btn-start-quiz')?.addEventListener('click', () => {
    document.getElementById('quiz-step-intro').style.display = 'none';
    document.getElementById('quiz-step-question').style.display = 'block';
    renderizarPergunta();
});

function renderizarPergunta() {
    if(pAtual >= perguntasQuiz.length) { finalizarQuiz(); return; }
    
    const qData = perguntasQuiz[pAtual];
    document.getElementById('quiz-progress-text').innerText = `Pergunta ${pAtual + 1} de ${perguntasQuiz.length}`;
    document.getElementById('quiz-progress-bar').style.width = `${((pAtual + 1) / perguntasQuiz.length) * 100}%`;
    document.getElementById('quiz-q-title').innerText = qData.q;
    
    const optContainer = document.getElementById('quiz-q-options'); optContainer.innerHTML = '';
    const shuffled = [...qData.opcoes].sort(() => Math.random() - 0.5);

    shuffled.forEach(opt => {
        const btn = document.createElement('button');
        btn.className = 'secondary-btn';
        btn.style.cssText = 'text-align: left; padding: 18px 20px; height: auto; font-size: 1rem; border-color: #333; justify-content: flex-start; transition: 0.3s; color: white;';
        btn.innerText = opt.text;
        
        btn.addEventListener('mouseover', () => btn.style.borderColor = 'var(--primary-green)');
        btn.addEventListener('mouseout', () => btn.style.borderColor = '#333');
        
        btn.addEventListener('click', () => { quizScores[opt.academia]++; pAtual++; renderizarPergunta(); });
        optContainer.appendChild(btn);
    });
}

async function finalizarQuiz() { 
    document.getElementById('quiz-step-question').style.display = 'none';
    document.getElementById('quiz-step-loading').style.display = 'block';

    let winningHouse = Object.keys(quizScores).reduce((a, b) => quizScores[a] > quizScores[b] ? a : b); 
    if(quizScores[winningHouse] === 0) winningHouse = 'estrategas'; 
    myAcademia = winningHouse; const ac = ACADEMIAS_INFO[winningHouse]; 
    
    try { await updateDoc(doc(db, "utilizadores", myUserId), { academia: winningHouse }); } catch(e) {} 
    
    setTimeout(() => {
        document.getElementById('quiz-step-loading').style.display = 'none'; document.getElementById('quiz-step-result').style.display = 'block'; 
        document.getElementById('quiz-result-icon').innerHTML = `<i class="fa-solid ${ac.icon}" style="color: ${ac.cor}; text-shadow: 0 0 30px ${ac.cor};"></i>`; 
        document.getElementById('quiz-result-title').innerText = ac.nome; document.getElementById('quiz-result-title').style.color = ac.cor; 
        document.getElementById('quiz-result-desc').innerText = ac.desc; 
        document.getElementById('btn-finish-quiz').style.backgroundColor = ac.cor; document.getElementById('btn-finish-quiz').style.color = "#000";
    }, 2000);
}

document.getElementById('btn-finish-quiz')?.addEventListener('click', () => { document.getElementById('modal-academia-quiz').style.display = 'none'; aplicarTemaAcademia(myAcademia); });

function aplicarTemaAcademia(idHouse) { 
    const ac = ACADEMIAS_INFO[idHouse]; if(!ac) return; 
    document.documentElement.style.setProperty('--primary-green', ac.cor); 
    
    const rankElem = document.getElementById('aluno-rank-title'); const rankCentral = document.getElementById('perfil-titulo-central'); 
    
    if(rankElem) rankElem.innerText = `${ac.nome.replace('Academia dos ','')}`; 
    if(rankCentral) { rankCentral.innerHTML = `<i class="fa-solid ${ac.icon}"></i> ${ac.nome}`; rankCentral.style.color = ac.cor; }
    
    const avatarImg = document.getElementById('perfil-avatar-img'); if (avatarImg) avatarImg.style.borderColor = ac.cor;
}

// ==========================================
// 3. NAVEGAÇÃO E DELEGAÇÃO DE EVENTOS
// ==========================================
function esconderTodasAsVistas() { document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none'); }

document.body.addEventListener('click', async (e) => {
    const nav = e.target.closest('.nav-item');
    if(nav) {
        e.preventDefault(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); nav.classList.add('active');
        esconderTodasAsVistas(); const tId = nav.getAttribute('data-target'); 
        document.getElementById(tId).style.display = (tId === 'view-aluno-forum') ? 'flex' : 'block';
        if(tId === 'view-aluno-perfil') { carregarRankingTurma(); carregarObjetivosPessoais(); setTimeout(renderizarGraficoNotas, 150); }
        if(tId === 'view-aluno-caderneta') document.getElementById('tab-aluno-timeline').click();
        if(tId === 'view-aluno-agenda') document.getElementById('tab-aluno-eventos').click();
        if(tId === 'view-aluno-forum') carregarForuns();
    }
    
    if(e.target.closest('#btn-open-materiais')) { esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); document.getElementById('view-aluno-materiais').style.display = 'block'; carregarMateriaisAluno(); }
    if(e.target.closest('#btn-abrir-passaporte')) { esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); document.getElementById('view-aluno-passaporte').style.display = 'block'; }
    if(e.target.closest('#btn-open-notificacoes')) { esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); document.getElementById('view-aluno-notificacoes').style.display = 'block'; carregarNotificacoesAluno(); }
    if(e.target.closest('#btn-voltar-notificacoes') || e.target.closest('#btn-voltar-materiais') || e.target.closest('#btn-voltar-passaporte')) { document.querySelector('.nav-item[data-target="student-dashboard"]').click(); }

    if(e.target.closest('#tab-aluno-timeline')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='flex'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; carregarTimelineAluno(); }
    if(e.target.closest('#tab-aluno-notas')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; carregarNotasAluno(); }
    if(e.target.closest('#tab-aluno-faltas')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; carregarFaltasAluno(); }
    if(e.target.closest('#tab-aluno-prhfs')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; carregarPrhfsAluno(); }
    if(e.target.closest('#tab-aluno-comportamento')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; carregarComportamentoAluno(); }
    if(e.target.closest('#tab-aluno-observacoes')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; carregarObservacoesAluno(); }

    const tChip = e.target.closest('#timeline-filtros .filter-chip');
    if(tChip) { document.querySelectorAll('#timeline-filtros .filter-chip').forEach(c => c.classList.remove('active')); tChip.classList.add('active'); window.timelineFilterCat = tChip.getAttribute('data-cat'); carregarTimelineAluno(); }
    const nChip = e.target.closest('#notificacoes-filtros .filter-chip');
    if(nChip) { document.querySelectorAll('#notificacoes-filtros .filter-chip').forEach(c => c.classList.remove('active')); nChip.classList.add('active'); window.notifFilterCat = nChip.getAttribute('data-cat'); carregarNotificacoesAluno(); }

    if(e.target.closest('#tab-aluno-eventos')) { document.getElementById('tab-aluno-eventos').classList.add('active'); document.getElementById('tab-aluno-horario').classList.remove('active'); document.getElementById('aluno-agenda-filtros').style.display = 'flex'; document.getElementById('aluno-horario-container').style.display = 'none'; carregarAgendaAlunoLista(); }
    if(e.target.closest('#tab-aluno-horario')) { document.getElementById('tab-aluno-horario').classList.add('active'); document.getElementById('tab-aluno-eventos').classList.remove('active'); document.getElementById('aluno-agenda-filtros').style.display = 'none'; document.getElementById('aluno-horario-container').style.display = 'block'; carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-horario-dia')) { ahModo = 'dia'; document.getElementById('btn-aluno-horario-dia').classList.add('active'); document.getElementById('btn-aluno-horario-grelha').classList.remove('active'); carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-horario-grelha')) { ahModo = 'grelha'; document.getElementById('btn-aluno-horario-grelha').classList.add('active'); document.getElementById('btn-aluno-horario-dia').classList.remove('active'); carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-prev-horario')) { if(ahModo === 'dia') ahDOff--; else ahSOff--; carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-next-horario')) { if(ahModo === 'dia') ahDOff++; else ahSOff++; carregarHorarioAluno(); }

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
    if(e.target.closest('#btn-confirm-novo-forum')) {
        const nome = document.getElementById('input-nome-novo-forum').value.trim(); if(!nome) { alert("Tens de dar um nome ao Grupo!"); return; }
        let mbr = [myUserId]; document.querySelectorAll('.colegas-check:checked').forEach(c => mbr.push(c.value));
        const btnConf = e.target.closest('#btn-confirm-novo-forum'); btnConf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btnConf.disabled = true;
        try { await addDoc(collection(db, "turmas", minhaTurma, "foruns"), { nome: nome, tipo: 'permanente', isDefault: false, membros: mbr, criadoPor: myUserName }); document.getElementById('modal-criar-forum').style.display = 'none'; document.getElementById('input-nome-novo-forum').value = ''; btnConf.innerHTML = 'Criar Grupo'; btnConf.disabled = false; carregarForuns(); } catch(err) { btnConf.innerHTML = 'Erro!'; setTimeout(() => { btnConf.innerHTML = 'Criar Grupo'; btnConf.disabled = false; }, 2000); }
    }
    
    if(e.target.closest('.btn-delete-chat')) { e.stopPropagation(); pendingDeleteChatId = e.target.closest('.btn-delete-chat').getAttribute('data-id'); document.getElementById('modal-confirm-delete-chat').style.display = 'flex'; }
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
    
    if(e.target.closest('#btn-add-objetivo')) {
        const tipo = document.getElementById('obj-tipo').value; let data = { tipo: tipo, concluido: false, timestamp: Date.now() };
        if(tipo === 'nota') {
            data.disciplina = document.getElementById('obj-disciplina').value; data.modulo = document.getElementById('obj-modulo').value; data.notaAlvo = document.getElementById('obj-nota-alvo').value;
            if(!data.disciplina || !data.modulo || !data.notaAlvo) return alert("Preenche todos os campos.");
            data.desc = `Tirar ${data.notaAlvo} a ${data.disciplina} no Mod. ${data.modulo}`;
        } else if (tipo === 'prhf') { 
            const pSnap = await getDocs(collection(db, "utilizadores", myUserId, "prhfs")); let c = 0; pSnap.forEach(p => { if(p.data().status === 'concluida') c++; });
            data.targetCount = c + 1; data.desc = `Concluir +1 Plano de Recuperação (PRHF)`;
        } else if (tipo === 'reconhecimento') {
            const rSnap = await getDocs(query(collection(db, "utilizadores", myUserId, "ocorrencias"), where("tipo", "==", "positiva")));
            data.targetCount = rSnap.size + 1; data.desc = `Receber +1 Registo Positivo do Professor`;
        }
        try { await addDoc(collection(db, "utilizadores", myUserId, "objetivos"), data); document.getElementById('obj-nota-alvo').value = ''; carregarObjetivosPessoais(); } catch(err) {}
    }

    if(e.target.closest('.btn-delete-objetivo')) { e.stopPropagation(); pendingDeleteObjetivoId = e.target.closest('.btn-delete-objetivo').getAttribute('data-id'); document.getElementById('modal-confirm-delete-objetivo').style.display = 'flex'; }
    if(e.target.closest('#btn-cancel-delete-objetivo')) { document.getElementById('modal-confirm-delete-objetivo').style.display = 'none'; pendingDeleteObjetivoId = null; }
    if(e.target.closest('#btn-confirm-delete-objetivo')) {
        if(pendingDeleteObjetivoId) {
            const btn = e.target.closest('#btn-confirm-delete-objetivo'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
            try { await deleteDoc(doc(db, "utilizadores", myUserId, "objetivos", pendingDeleteObjetivoId)); document.getElementById('modal-confirm-delete-objetivo').style.display = 'none'; carregarObjetivosPessoais(); } catch(err){}
            finally { btn.innerHTML = 'Sim, Apagar'; btn.disabled = false; pendingDeleteObjetivoId = null; }
        }
    }
});

document.addEventListener('change', async (e) => {
    if (e.target.id === 'obj-tipo') { const v = e.target.value; document.getElementById('obj-setup-nota').style.display = v === 'nota' ? 'flex' : 'none'; }
    if (e.target.closest('.agenda-filter-label input')) { carregarAgendaAlunoLista(); }
});

// ==========================================
// 4. DASHBOARD ADAPTATIVO MÁGICO
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

        let alertHtml = ''; 
        if(tFaltas>0 || pAtivos>0 || mRep>0) {
            alertHtml += `<div class="card" style="background:linear-gradient(135deg,#ef4444,#b91c1c); color:white; border:none; border-radius:16px; margin-bottom:20px;"><h3 style="margin-bottom:10px; font-size:1.8rem;"><i class="fa-solid fa-triangle-exclamation"></i> Ação Necessária</h3><p style="font-size:1.1rem; margin-bottom:15px; opacity:0.9;">Tens pendências urgentes que prejudicam a tua avaliação.</p><ul style="margin-bottom:20px; padding-left:20px; font-size:1.1rem; font-weight:bold; line-height:1.6;">${tFaltas>0?`<li>${tFaltas} Falta(s) injustificada(s)</li>`:''}${mRep>0?`<li>${mRep} Módulo(s) Reprovado(s)</li>`:''}${pAtivos>0?`<li>${pAtivos} PRHF(s) pendentes (${pHoras}h presenciais)</li>`:''}</ul><button class="primary-btn" style="background:white; color:#b91c1c; font-size:1.1rem; padding:15px;" onclick="document.querySelector('.nav-item[data-target=\\'view-aluno-caderneta\\']').click()">Abrir Caderneta e Resolver</button></div>`;
        } else if(evs.length>0) {
            const ev = evs[0]; const dF = ev.data.split('-').reverse().join('/');
            alertHtml += `<div class="card" style="background:linear-gradient(135deg,#f59e0b,#d97706); color:white; border:none; border-radius:16px; margin-bottom:20px;"><h3 style="margin-bottom:10px; font-size:1.8rem;"><i class="fa-solid fa-calendar-exclamation"></i> Prepara-te</h3><p style="font-size:1.1rem; margin-bottom:15px; opacity:0.9;">Tens <strong>${ev.titulo}</strong> no dia ${dF}. Recomendamos que vejas os teus materiais!</p><button class="primary-btn" style="background:white; color:#d97706; width:100%; font-size:1.1rem; padding:15px;" onclick="document.getElementById('btn-open-materiais').click()"><i class="fa-solid fa-book-open"></i> Abrir Materiais</button></div>`;
        } else {
            alertHtml += `<div class="card" style="background:linear-gradient(135deg,var(--primary-green),var(--primary-hover)); color:white; border:none; border-radius:16px; margin-bottom:20px;"><h3 style="margin-bottom:5px; font-size:1.6rem;"><i class="fa-solid fa-leaf"></i> Dia Tranquilo</h3><p style="font-size:1.05rem; margin-bottom:0; opacity:0.9;">Não tens avaliações marcadas nem pendências.</p></div>`;
        }
        alertCont.innerHTML = alertHtml;

        let emoHtml = '';
        if(minhaTurma) {
            const tSnap = await getDoc(doc(db, "turmas", minhaTurma));
            if(tSnap.exists() && tSnap.data().missaoTitulo) {
                const tm = tSnap.data();
                emoHtml += `<div class="card" id="missao-card" style="border-left:4px solid var(--warning-yellow); margin-bottom:20px;"><h3 style="font-size:1rem; margin-bottom:5px; color:var(--text-light);"><i class="fa-solid fa-users"></i> Missão da Turma</h3><p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:${tm.missaoProgresso!==undefined?'10px':'0'};">${tm.missaoTitulo}</p>${tm.missaoProgresso!==undefined?`<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${tm.missaoProgresso}%; background:var(--warning-yellow);"></div></div>`:''}</div>`;
            }
        }
        const hjIso = new Date().toISOString().split('T')[0]; const hSnap = await getDoc(doc(db, "utilizadores", myUserId, "humor", hjIso));
        if(!hSnap.exists()) {
            emoHtml += `<div class="card" id="checkin-card-dinamico" style="border-left:4px solid var(--accent-purple); margin-bottom:20px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;"><h3 style="font-size: 1rem; margin:0; color:var(--text-light);"><i class="fa-solid fa-heart-pulse"></i> Como te sentes hoje?</h3></div><div style="display: flex; justify-content: space-around; font-size: 2.2rem;" id="mood-buttons-dinamicos"><span class="mood-btn-dinamico" data-mood="😡" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">😡</span><span class="mood-btn-dinamico" data-mood="🙁" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">🙁</span><span class="mood-btn-dinamico" data-mood="😐" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">😐</span><span class="mood-btn-dinamico" data-mood="🙂" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">🙂</span><span class="mood-btn-dinamico" data-mood="🤩" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">🤩</span></div></div>`;
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
    if(!minhaTurma) return; const tSnap = await getDoc(doc(db, "turmas", minhaTurma));
    if(tSnap.exists() && tSnap.data().epocaExames?.ativa) {
        document.getElementById('exam-mode-banner').style.display='block'; document.body.style.borderTop="5px solid #8b5cf6";
        if(tSnap.data().epocaExames.dataFim) { const df = Math.ceil((new Date(tSnap.data().epocaExames.dataFim) - new Date()) / (1000 * 60 * 60 * 24)); document.getElementById('exam-countdown').innerText = df > 0 ? `Faltam ${df} dias` : "Já terminou"; }
    }
}

// ==========================================
// 5. PERFIL: GAMIFICAÇÃO E ESTATÍSTICAS
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
        
        let academiasXP = { estrategas: 0, embaixadores: 0, exploradores: 0, visionarios: 0 };
        alunos.forEach(al => { if(al.academia && academiasXP[al.academia] !== undefined) academiasXP[al.academia] += (al.xp || 0); });
        
        let hAcad = `<div style="display:flex; justify-content:space-around; margin-bottom:20px; text-align:center; background:rgba(0,0,0,0.2); padding:15px; border-radius:12px;">`;
        const orderAcad = Object.keys(academiasXP).sort((a,b) => academiasXP[b] - academiasXP[a]);
        orderAcad.forEach((ac) => {
            const acData = ACADEMIAS_INFO[ac];
            hAcad += `<div><i class="fa-solid ${acData.icon}" style="font-size:2rem; color:${acData.cor}; margin-bottom:8px; display:block;"></i><strong style="color:var(--text-light); font-size:0.85rem;">${acData.nome.split(' ')[2]||acData.nome}</strong><br><span style="color:var(--warning-yellow); font-size:0.9rem; font-weight:bold;">${academiasXP[ac]} XP</span></div>`;
        });
        hAcad += `</div><h4 style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; margin-bottom:10px;">🏆 Top 10 Alunos</h4>`;
        
        let hAl = '';
        alunos.slice(0, 10).forEach((al, idx) => {
            let cor = 'var(--text-muted)'; if(idx === 0) cor = '#f59e0b'; else if(idx === 1) cor = '#9ca3af'; else if(idx === 2) cor = '#d97706';
            hAl += `<div style="display:flex; align-items:center; gap:10px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:8px; border-left:3px solid ${cor};"><span style="font-weight:bold; font-size:1.2rem; color:${cor}; width:25px; text-align:center;">${idx+1}</span><img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=00cc88&color=fff`}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;"><div style="flex:1;"><strong style="font-size:0.95rem; color:var(--text-light);">${al.nome.split(' ')[0]} ${al.nome.split(' ').pop()}</strong><br><span style="font-size:0.7rem; color:var(--text-muted);">${al.academia ? ACADEMIAS_INFO[al.academia].nome : 'S/ Academia'}</span></div><span style="font-weight:bold; color:var(--primary-green); font-size:0.9rem;">${al.xp || 0} XP</span></div>`;
        });
        c.innerHTML = hAcad + (hAl === '' ? '<p class="text-muted center">Ainda não há alunos com XP.</p>' : hAl);
    } catch(e) { c.innerHTML = '<p class="text-danger center">Erro ao carregar ranking.</p>'; }
}

async function carregarObjetivosPessoais() {
    const cont = document.getElementById('lista-objetivos-container'); cont.innerHTML = '<p class="text-muted center">A carregar...</p>';
    try {
        const uSnap = await getDoc(doc(db, "utilizadores", myUserId)); const uXp = uSnap.exists() ? (uSnap.data().xp || 0) : 0;
        const nSnap = await getDocs(collection(db, "utilizadores", myUserId, "notas")); let notasArr = []; nSnap.forEach(n => notasArr.push(n.data()));
        const pSnap = await getDocs(collection(db, "utilizadores", myUserId, "prhfs")); let numPrhfs = 0; pSnap.forEach(p => { if(p.data().status === 'concluida') numPrhfs++; });
        const rSnap = await getDocs(query(collection(db, "utilizadores", myUserId, "ocorrencias"), where("tipo", "==", "positiva"))); const numPositivas = rSnap.size;

        const snap = await getDocs(collection(db, "utilizadores", myUserId, "objetivos")); let objArr = []; snap.forEach(d => objArr.push({id: d.id, ...d.data()})); objArr.sort((a,b) => b.timestamp - a.timestamp);
        let html = ''; let objGanhouXP = false;
        for (const obj of objArr) {
            let achieved = false;
            if(!obj.concluido) {
                if(obj.tipo === 'nota') { const temNota = notasArr.find(n => n.disciplina === obj.disciplina && Number(n.modulo) === Number(obj.modulo) && Number(n.nota) >= Number(obj.notaAlvo)); if(temNota) achieved = true; } 
                else if (obj.tipo === 'prhf') { if(numPrhfs >= obj.targetCount) achieved = true; }
                else if (obj.tipo === 'reconhecimento') { if(numPositivas >= obj.targetCount) achieved = true; }
            }
            if(achieved) { await updateDoc(doc(db, "utilizadores", myUserId, "objetivos", obj.id), { concluido: true }); obj.concluido = true; objGanhouXP = true; }
            const cColor = obj.concluido ? 'var(--success-green)' : '#444'; const txtDec = obj.concluido ? 'line-through' : 'none'; const txtColor = obj.concluido ? 'var(--text-muted)' : 'var(--text-light)';
            html += `<div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:8px; border-left: 3px solid ${cColor};"><div style="display:flex; align-items:center; gap:12px; flex:1;"><div onclick="window.toggleObjetivo('${obj.id}', ${!obj.concluido})" style="width:24px; height:24px; border-radius:50%; border:2px solid ${cColor}; background:${obj.concluido ? cColor : 'transparent'}; display:flex; align-items:center; justify-content:center; cursor:pointer;">${obj.concluido ? '<i class="fa-solid fa-check" style="color:var(--bg-dark); font-size:0.75rem;"></i>' : ''}</div><span style="text-decoration:${txtDec}; color:${txtColor}; font-size:0.95rem; flex:1;">${obj.desc}</span></div><i class="fa-solid fa-trash btn-delete-objetivo" data-id="${obj.id}" style="color:var(--danger-red); cursor:pointer; font-size:0.9rem; padding: 5px;"></i></div>`;
        }
        if(objGanhouXP) { await updateDoc(doc(db, "utilizadores", myUserId), { xp: uXp + 50 }); carregarGamificacao({xp: uXp+50}); alert("🎉 Parabéns! Uma Meta foi concluída automaticamente! +50 XP"); }
        cont.innerHTML = html === '' ? '<p class="text-muted center" style="font-size:0.85rem;">Não tens metas ativas. Começa a desafiar-te!</p>' : html;
    } catch(e) {}
}

window.toggleObjetivo = async (id, status) => { try { await updateDoc(doc(db, "utilizadores", myUserId, "objetivos", id), { concluido: status }); if(status) { const snap = await getDoc(doc(db, "utilizadores", myUserId)); let xp = snap.exists() && snap.data().xp ? snap.data().xp : 0; await updateDoc(doc(db, "utilizadores", myUserId), { xp: xp + 50 }); carregarGamificacao({xp: xp+50}); } carregarObjetivosPessoais(); } catch(e) {} };

function renderizarGraficoNotas() {
    const ctx = document.getElementById('chart-notas-aluno'); if(!ctx) return;
    getDocs(collection(db, "utilizadores", myUserId, "notas")).then(notasDb => {
        let mapN = {}; notasDb.forEach(d => { const n = d.data(); if(n.nota!=='REP'&&!isNaN(n.nota)){ if(!mapN[n.disciplina])mapN[n.disciplina]={s:0,c:0}; mapN[n.disciplina].s+=Number(n.nota); mapN[n.disciplina].c++; } });
        let l = Object.keys(mapN).sort(); let dt=[], bg=[]; 
        l.forEach(dc => { 
            const md=(mapN[dc].s/mapN[dc].c).toFixed(1); dt.push(md); bg.push(md>=10?'#10b981':'#ef4444');
        });
        if(chartInstance) chartInstance.destroy();
        if(l.length === 0) { l = ['Sem Notas']; dt = [0]; bg = ['#333']; }
        chartInstance = new Chart(ctx, { type:'bar', data:{labels:l, datasets:[{label:'Média', data:dt, backgroundColor:bg, borderRadius:6}]}, options:{responsive:true, maintainAspectRatio:false, scales:{y:{beginAtZero:true, max:20}, x:{grid:{display:false}}}, plugins:{legend:{display:false}}} });
    });
}

// ==========================================
// 6. CADERNETA E COMUNICAÇÃO
// ==========================================
async function obterEventosLinhaTemporal() {
    let ev = [];
    const nS = await getDocs(collection(db, "utilizadores", myUserId, "notas")); nS.forEach(d => { const n = d.data(); ev.push({ time: new Date(n.data).getTime(), cat: 'notas', icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', titulo: 'Nova Avaliação', desc: `${n.disciplina} (Mod. ${n.modulo}): <strong style="color:var(--text-light);">${n.nota}</strong>` }); });
    const fS = await getDocs(collection(db, "utilizadores", myUserId, "faltas")); fS.forEach(d => { const f = d.data(); ev.push({ time: new Date(f.criadoEm || f.dataInicio).getTime(), cat: 'faltas', icon: '<i class="fa-solid fa-user-xmark"></i>', cor: f.justificada ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Falta a ${f.disciplina} (${f.horas}h)`, desc: f.justificada ? `Justificada` : `Falta registada.` }); });
    const oS = await getDocs(collection(db, "utilizadores", myUserId, "ocorrencias")); oS.forEach(d => { const o = d.data(); ev.push({ time: o.timestamp, cat: 'comportamento', icon: o.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>', cor: o.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Registo Disciplinar`, desc: `<strong style="color:var(--text-light);">${o.titulo}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">${o.descricao || ''}</span>` }); });
    const pS = await getDocs(collection(db, "utilizadores", myUserId, "prhfs")); pS.forEach(d => { const p = d.data(); ev.push({ time: new Date(p.dataRegisto || Date.now()).getTime(), cat: 'prhfs', icon: '<i class="fa-solid fa-book-medical"></i>', cor: 'var(--warning-yellow)', titulo: `Plano de Recuperação Criado`, desc: `${p.disciplina} (Mod. ${p.modulo})` }); });
    ev.sort((a,b) => b.time - a.time); return ev;
}

async function carregarTimelineAluno() {
    const cCont = document.getElementById('aluno-caderneta-content');
    try {
        let eventos = await obterEventosLinhaTemporal();
        if(window.timelineFilterCat !== 'all') { eventos = eventos.filter(e => e.cat === window.timelineFilterCat); }
        if(eventos.length === 0) { cCont.innerHTML = getEmptyState('O teu histórico está limpo.', 'fa-clock-rotate-left'); return; }
        
        let html = '<div class="timeline">';
        eventos.forEach(ev => { html += `<div class="timeline-item"><div class="timeline-icon" style="color: ${ev.cor}; border-color: ${ev.cor};">${ev.icon}</div><div class="timeline-content" style="border-left: 3px solid ${ev.cor};"><span class="timeline-date">${new Date(ev.time).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span><strong style="color:var(--text-light); display:block; margin-bottom:5px;">${ev.titulo}</strong><p style="font-size:0.85rem; color:var(--text-light); margin:0;">${ev.desc}</p></div></div>`; });
        cCont.innerHTML = html + '</div>';
    } catch(e) {}
}

async function carregarNotificacoesAluno() {
    const cont = document.getElementById('aluno-notificacoes-container'); cont.innerHTML = '<p class="text-muted center">A ler alertas...</p>';
    try {
        let evs = await obterEventosLinhaTemporal();
        evs = evs.map(e => { let c='escola'; if(e.cat==='faltas'&&e.cor==='var(--danger-red)') c='importante'; if(e.cat==='gamificacao') c='gamificacao'; return {...e, nCat: c}; });
        if(window.notifFilterCat !== 'all') evs = evs.filter(e => e.nCat === window.notifFilterCat);
        const rec = evs.slice(0, 15);
        if(rec.length === 0) { cont.innerHTML = getEmptyState('Sem alertas nesta categoria.', 'fa-bell-slash'); return; }
        
        let h = ''; rec.forEach(ev => { h += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${ev.cor}; display:flex; align-items:flex-start; gap: 15px; padding: 15px;"><div style="font-size: 1.5rem; color: ${ev.cor};">${ev.icon}</div><div><strong style="color:var(--text-light); font-size:1rem; display:block; margin-bottom:3px;">${ev.titulo}</strong><span style="font-size:0.85rem; color:var(--text-light);">${ev.desc}</span><div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">${new Date(ev.time).toLocaleString('pt-PT')}</div></div></div>`; }); cont.innerHTML = h; 
        if(window.notifFilterCat === 'all') document.getElementById('badge-notificacoes').style.display = 'none';
    } catch(e) {}
}

async function carregarNotasAluno() {
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", myUserId, "notas"));
        let disciplinasDoAluno = {}; notasDb.forEach(d => { const n = d.data(); if(!disciplinasDoAluno[n.disciplina]) disciplinasDoAluno[n.disciplina] = []; disciplinasDoAluno[n.disciplina].push(n); });
        
        let ordemDisciplinas = obterDisciplinasDoAno();
        if(ordemDisciplinas.length === 0) { cadernetaContent.innerHTML = getEmptyState('Ainda não tens disciplinas ativas.', 'fa-book'); return; }

        let html = '';
        ordemDisciplinas.forEach(disc => {
            if(disciplinasDoAluno[disc] && disciplinasDoAluno[disc].length > 0) {
                let sum = 0; let c = 0; let modsHtml = '';
                disciplinasDoAluno[disc].forEach(n => {
                    if(n.nota !== 'REP' && !isNaN(n.nota)) { sum += Number(n.nota); c++; }
                    const cor = (n.nota === 'REP' || Number(n.nota) < 10) ? 'var(--danger-red)' : 'var(--success-green)';
                    const modLabel = n.modulo.toString().startsWith('UC') ? n.modulo : `Módulo ${n.modulo}`;
                    modsHtml += `<div class="modulo-row"><span style="color:var(--text-light);">${modLabel}</span><span style="font-weight:bold; color:${cor};">${n.nota}</span></div>`;
                });
                const med = c > 0 ? (sum/c).toFixed(1) : '-'; const medCor = (med !== '-' && med < 10) ? 'var(--danger-red)' : 'var(--text-light)';
                html += `<div class="disciplina-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'"><span class="disciplina-title" style="color:var(--text-light);">${disc}</span><span><span style="font-size:0.75rem; color:var(--text-muted); margin-right:8px;">Média:</span><span class="disciplina-media" style="color:${medCor};">${med}</span> <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; color:var(--text-muted); margin-left:5px;"></i></span></div><div class="disciplina-modules">${modsHtml}</div>`;
            } else {
                html += `<div class="disciplina-header" style="cursor:default;"><span class="disciplina-title" style="color:var(--text-muted);">${disc}</span><span><span class="disciplina-media" style="color:var(--text-muted); font-size:0.9rem;">SN</span></span></div>`;
            }
        });
        document.getElementById('aluno-caderneta-content').innerHTML = html;
    } catch(e) {}
}

async function carregarFaltasAluno() {
    try {
        const fDisc = document.getElementById('filtro-caderneta-disc')?.value;
        const faltasDb = await getDocs(collection(db, "utilizadores", myUserId, "faltas"));
        let faltasPorDisc = {};
        faltasDb.forEach(d => { const f = d.data(); if(!f.justificada && (!fDisc || f.disciplina === fDisc)) { if(!faltasPorDisc[f.disciplina]) faltasPorDisc[f.disciplina] = {}; if(!faltasPorDisc[f.disciplina][f.modulo]) faltasPorDisc[f.disciplina][f.modulo] = []; faltasPorDisc[f.disciplina][f.modulo].push(f); } });

        if(Object.keys(faltasPorDisc).length === 0) { document.getElementById('aluno-caderneta-content').innerHTML = getEmptyState('Sem faltas injustificadas. Excelente!', 'fa-face-smile'); return; }
        
        let html = ''; const ordemDisciplinas = obterDisciplinasDoAno(); const matriz = getMatriz();
        
        ordemDisciplinas.forEach(disc => {
            if(faltasPorDisc[disc]) {
                let discHtml = ''; let totalFaltasDisc = 0;
                for(let mod of Object.keys(faltasPorDisc[disc]).sort()) {
                    let sumFaltasMod = 0; faltasPorDisc[disc][mod].forEach(f => sumFaltasMod += Number(f.horas||0)); totalFaltasDisc += sumFaltasMod;
                    
                    let limiteHoras = 0; let totalHorasMod = 0;
                    for (const comp of Object.values(matriz)) { if(comp[disc] && comp[disc][mod]) { totalHorasMod = comp[disc][mod]; limiteHoras = Math.round(totalHorasMod * 0.1); break; } }
                    
                    let corBarra = 'var(--success-green)'; let txtRisco = 'Regular'; let perc = 0;
                    if(totalHorasMod > 0) {
                        perc = (sumFaltasMod / totalHorasMod) * 100; if(perc > 100) perc = 100;
                        if(sumFaltasMod > limiteHoras) { corBarra = 'var(--danger-red)'; txtRisco = '⚠️ Abaixo de 90%'; }
                        else if(sumFaltasMod === limiteHoras) { corBarra = 'var(--warning-yellow)'; txtRisco = 'Atenção (No limite)'; }
                        else { corBarra = 'var(--success-green)'; txtRisco = 'Regular'; }
                    }

                    const modLabel = mod.toString().startsWith('UC') ? mod : `Módulo ${mod}`;
                    discHtml += `<div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; border:1px solid #333; margin-bottom:10px;"><div style="display:flex; justify-content:space-between; margin-bottom:8px;"><strong style="color:var(--text-light);">${modLabel}</strong><span style="font-size:0.8rem; font-weight:bold; color:${corBarra};">${sumFaltasMod}h / ${limiteHoras > 0 ? limiteHoras+'h' : '?'}</span></div><div class="progress-bar-bg" style="margin-top:0; margin-bottom:5px; height:6px;"><div class="progress-bar-fill" style="width: ${perc}%; background-color:${corBarra};"></div></div><div style="text-align:right; font-size:0.75rem; color:${corBarra};">${txtRisco}</div></div>`;
                }
                html += `<div class="disciplina-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'"><span class="disciplina-title" style="color:var(--text-light);">${disc}</span><span><span class="disciplina-media" style="color:var(--danger-red);">${totalFaltasDisc}h</span> <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; color:var(--text-muted); margin-left:5px;"></i></span></div><div class="disciplina-modules">${discHtml}</div>`;
            }
        });
        document.getElementById('aluno-caderneta-content').innerHTML = html;
    } catch(e) {}
}

async function carregarPrhfsAluno() {
    try {
        const fDisc = document.getElementById('filtro-caderneta-disc')?.value;
        const prhfsDb = await getDocs(collection(db, "utilizadores", myUserId, "prhfs"));
        let prhfsArr = []; prhfsDb.forEach(d => { const p = d.data(); if(!fDisc || p.disciplina === fDisc) prhfsArr.push({id: d.id, ...p}); });
        if(prhfsArr.length === 0) { document.getElementById('aluno-caderneta-content').innerHTML = getEmptyState('Não tens Planos de Recuperação.', 'fa-book-medical'); return; }
        
        prhfsArr.sort((a,b) => new Date(a.prazo) - new Date(b.prazo));
        let pendentes = prhfsArr.filter(p => p.status !== 'concluida'); let concluidos = prhfsArr.filter(p => p.status === 'concluida');
        
        let html = ''; 
        const renderP = (p) => {
            const isUrgente = p.moduloTerminado === true || p.moduloTerminado === "true"; 
            const cor = isUrgente ? 'var(--danger-red)' : 'var(--warning-yellow)'; 
            const txtSt = p.status === 'concluida' ? 'CONCLUÍDO' : (isUrgente ? 'URGENTE' : 'EM CURSO'); 
            const corFinal = p.status === 'concluida' ? 'var(--success-green)' : cor; 
            const hPres = Number(p.horasPresenciais || 0); const hAut = Number(p.horasTotais || 50) - hPres;
            
            const b64Var = p.ficheiroBase64 || p.anexoBase64; 
            const aHtml = b64Var ? `<a href="${b64Var}" download="PRHF_${p.disciplina}_M${p.modulo}" class="secondary-btn small-btn" style="margin-bottom:10px; color:var(--primary-green); border-color:var(--primary-green); display:block; text-align:center;"><i class="fa-solid fa-download"></i> Descarregar Ficha</a>` : '';
            const fpHtml = p.feedbackProfessor ? `<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; margin-bottom:10px; font-size:0.85rem;"><strong style="color:var(--primary-green);">Prof. ${p.professor || ''}:</strong> ${p.feedbackProfessor}</div>` : '';
            const propHtml = p.propostaAluno ? `<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; margin-bottom:15px; font-size:0.85rem;"><strong style="color:var(--warning-yellow);">A tua Proposta:</strong> ${p.propostaAluno} <br><span style="color:${p.propostaLidaDT ? 'var(--success-green)' : 'var(--text-muted)'}; font-size:0.75rem;"><i class="fa-solid ${p.propostaLidaDT ? 'fa-check-double' : 'fa-clock'}"></i> ${p.propostaLidaDT ? 'Validada pelo Prof.' : 'A aguardar validação'}</span></div>` : '';
            
            let btn = ''; if(p.status !== 'concluida' && hPres > 0) { btn = `<button class="primary-btn small-btn" style="width:100%; background-color:${corFinal}; color:${corFinal === 'var(--warning-yellow)' ? 'black' : 'white'};" onclick="window.abrirAcaoPrhf('${p.id}', '${p.disciplina}', '${p.modulo}', '${p.prazo}')"><i class="fa-regular fa-calendar"></i> Sugerir Horário</button>`; }
            
            return `<div class="card" style="margin-bottom:15px; border-left: 4px solid ${corFinal};"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong style="font-size: 1.1rem; color:var(--text-light);">${p.disciplina} (Mod. ${p.modulo})</strong><span style="color:${corFinal}; font-size:0.75rem; font-weight:bold;">${txtSt}</span></div><p style="font-size:0.85rem; color:var(--text-light); margin-bottom:10px;">${p.descricao}</p>${aHtml} ${fpHtml} ${propHtml}<div style="font-size:0.8rem; margin-bottom: 15px; border-top:1px dashed #333; padding-top:10px; color:var(--text-light);">Data Limite: <strong style="color:${corFinal};">${p.prazo.split('-').reverse().join('/')}</strong><br>Horas Presenciais: <strong>${hPres}h</strong></div>${btn}</div>`;
        };
        
        pendentes.forEach(p => html += renderP(p)); 
        if(concluidos.length > 0) { html += `<div class="falta-date-divider" style="margin-top:20px;"><span>Concluídos</span></div>`; concluidos.forEach(p => html += renderP(p)); } 
        document.getElementById('aluno-caderneta-content').innerHTML = html;
    } catch(e) { }
}

window.abrirAcaoPrhf = (id, disc, mod, prazo) => {
    esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.getElementById('view-aluno-acao-prhf').style.display = 'block'; 
    document.getElementById('prhf-acao-titulo').innerText = `${disc} (Mod. ${mod})`; 
    document.getElementById('prhf-acao-prazo').innerText = prazo.split('-').reverse().join('/');
    
    document.getElementById('btn-voltar-acao-prhf').onclick = () => { document.querySelector('.nav-item[data-target="view-aluno-caderneta"]').click(); };
    
    document.getElementById('btn-enviar-proposta-prhf').onclick = async (e) => {
        const d = document.getElementById('aluno-prhf-proposta-data').value; const hi = document.getElementById('aluno-prhf-proposta-hora-inicio').value; const hf = document.getElementById('aluno-prhf-proposta-hora-fim').value;
        if(!d || !hi || !hf) { alert("Preenche a data e horas!"); return; }
        const btn = e.currentTarget; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
        try { 
            await updateDoc(doc(db, "utilizadores", myUserId, "prhfs", id), { propostaAluno: `O aluno propõe: ${d.split('-').reverse().join('/')} das ${hi} às ${hf}`, propostaLidaDT: false }); 
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviado'; btn.style.backgroundColor = 'var(--success-green)'; 
            setTimeout(() => { document.getElementById('btn-voltar-acao-prhf').click(); btn.innerHTML = 'Enviar Proposta'; btn.disabled = false; btn.style.backgroundColor = 'var(--primary-green)';}, 1500); 
        } catch(err) { btn.innerHTML = "Erro"; setTimeout(() => { btn.disabled = false; }, 1500); }
    };
};

async function carregarComportamentoAluno() {
    try {
        const fDisc = document.getElementById('filtro-caderneta-disc')?.value;
        const res = await getDocs(query(collection(db, "utilizadores", myUserId, "ocorrencias")));
        let regs = []; res.forEach(d => { if(!fDisc || d.data().disciplina === fDisc) regs.push(d.data()); }); 
        if(regs.length === 0) { document.getElementById('aluno-caderneta-content').innerHTML = getEmptyState('Sem registos disciplinares.', 'fa-scale-balanced'); return; }
        regs.sort((a,b) => b.data.localeCompare(a.data)); 
        let html = '';
        regs.forEach(r => {
            const cor = r.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)';
            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; align-items:center; gap:8px; color:${cor}; margin-bottom:5px;"><i class="fa-solid fa-circle-exclamation"></i> <strong style="color:var(--text-light);">${r.titulo}</strong></div><span style="font-size:0.75rem; color:var(--text-muted);">Data: ${r.data} | Prof. ${r.autor}</span>${r.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">${r.descricao}</p>` : ''}</div>`;
        });
        document.getElementById('aluno-caderneta-content').innerHTML = html;
    } catch(e) {}
}

async function carregarObservacoesAluno(rSel = '1_intercalar') {
    const cCont = document.getElementById('aluno-caderneta-content');
    const rM = [{id: '1_intercalar', label: '1ª Intercalar'}, {id: '1_avaliacao', label: '1ª Avaliação'}, {id: '2_intercalar', label: '2ª Intercalar'}, {id: '2_avaliacao', label: '2ª Avaliação'}, {id: '3_avaliacao', label: '3ª Avaliação'}];
    let html = '<div style="display:flex; overflow-x:auto; gap:10px; margin-bottom:20px; padding-bottom:10px; scrollbar-width: none;">'; rM.forEach(r => { const bg = r.id === rSel ? 'var(--primary-green)' : 'var(--bg-dark)'; const color = r.id === rSel ? 'var(--bg-dark)' : 'var(--text-muted)'; html += `<button class="btn-select-reuniao" data-id="${r.id}" style="background:${bg}; color:${color}; border:1px solid #333; padding:8px 15px; border-radius:20px; cursor:pointer; font-weight:bold; white-space:nowrap; transition:0.2s; flex-shrink:0;">${r.label}</button>`; }); html += '</div><div id="reuniao-content-area"><p class="text-muted center">A carregar dados...</p></div>'; cCont.innerHTML = html;
    document.querySelectorAll('.btn-select-reuniao').forEach(btn => { btn.addEventListener('click', (e) => { carregarObservacoesAluno(e.currentTarget.getAttribute('data-id')); }); });

    try {
        const dS = await getDoc(doc(db, "utilizadores", myUserId, "reunioes", rSel)); let dR = dS.exists() ? dS.data() : {}; let cH = '<div style="display:flex; flex-direction:column; gap:10px;">';
        const ordemDisciplinas = obterDisciplinasDoAno();
        if(ordemDisciplinas.length === 0) { cH += '<p class="text-muted center">Ainda não tens disciplinas associadas.</p>'; }
        else {
            ordemDisciplinas.forEach(disc => { const cm = dR.disciplinas && dR.disciplinas[disc] ? dR.disciplinas[disc] : '<span style="color:var(--text-muted);">Sem comentário</span>'; cH += `<div class="card" style="margin-bottom:0; border-left:4px solid var(--primary-green); padding:15px;"><h4 style="margin-bottom:8px; color:white; font-size:1rem;">${disc}</h4><p style="color:var(--text-light); font-size:0.9rem; line-height:1.4; margin:0;">${cm}</p></div>`; });
        }
        const gl = dR.global || '<span style="color:var(--text-muted);">Sem observações globais.</span>'; cH += `<div class="card" style="margin-top:15px; border:1px solid var(--warning-yellow); background:rgba(255,204,0,0.05); padding:15px;"><h3 style="color:var(--warning-yellow); margin-bottom:10px; font-size:1.1rem;"><i class="fa-solid fa-comment-dots"></i> Observações Globais</h3><p style="color:white; font-size:0.95rem; line-height:1.5; margin:0;">${gl}</p></div></div>`;
        document.getElementById('reuniao-content-area').innerHTML = cH;
    } catch(e) {}
}

async function carregarForuns() {
    const cont = document.getElementById('aluno-forum-channel-list'); cont.innerHTML = '<p class="text-muted center">A configurar fóruns...</p>'; if(!minhaTurma) return;
    let html = `<h3 style="font-size:1rem; color:var(--text-muted); margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">Apoio & Turma</h3><div class="canal-card" data-id="turma_global" data-nome="Turma ${minhaTurma}" style="margin-bottom: 15px;"><div class="canal-icon" style="color:#00cc88; border-color:#00cc88;"><i class="fa-solid fa-users"></i></div><div class="canal-info"><h4>Turma ${minhaTurma}</h4><p>Canal Geral</p></div></div><div class="canal-card" data-id="dt_${myUserId}" data-nome="Chat DT"><div class="canal-icon" style="color:#ffaa00; border-color:#ffaa00;"><i class="fa-solid fa-user-tie"></i></div><div class="canal-info"><h4>Diretor de Turma</h4><p>Mensagem Privada</p></div></div><h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Disciplinas</h3><div style="display:flex; flex-wrap:wrap; gap:10px;">`;
    const ordemDisciplinas = obterDisciplinasDoAno();
    ordemDisciplinas.forEach(disc => { html += `<div class="canal-card" data-id="disc_${disc}" data-nome="Fórum ${disc}" style="flex: 1 1 45%; padding: 10px;"><div class="canal-info" style="text-align:center;"><h4 style="margin:0; font-size:0.9rem; color:#00d2ff;"><i class="fa-solid fa-book-open"></i> ${disc}</h4></div></div>`; }); html += '</div>';
    try {
        const res = await getDocs(collection(db, "turmas", minhaTurma, "foruns")); let extrasHtml = '';
        res.forEach(docSnap => { const f = docSnap.data(); if(f.membros && f.membros.includes(myUserId) && !f.isDefault) { extrasHtml += `<div class="canal-card" data-id="${docSnap.id}" data-nome="${f.nome}" style="position:relative;"><div class="canal-icon" style="color:#b82bf2; border-color:#b82bf2;"><i class="fa-solid fa-comments"></i></div><div class="canal-info"><h4>${f.nome}</h4><p>Grupo de Trabalho</p></div><i class="fa-solid fa-trash btn-delete-chat" data-id="${docSnap.id}" style="color:var(--danger-red); position:absolute; right:15px; font-size:1.1rem; cursor:pointer;"></i></div>`; } });
        if (extrasHtml !== '') html += `<h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Grupos de Trabalho</h3>` + extrasHtml;
    } catch(e) {}
    cont.innerHTML = html;
}

// ----------------------------------------------------
// MATERIAIS / SUMÁRIOS COM DOWNLOAD BASE64
// ----------------------------------------------------
async function carregarMateriaisAluno() {
    const c = document.getElementById('aluno-lista-materiais-container'); c.innerHTML = '<p class="text-muted center">A carregar materiais...</p>'; if(!minhaTurma) return;
    try {
        const r = await getDocs(query(collection(db, "turmas", minhaTurma, "sumarios"))); 
        if(r.empty) { c.innerHTML = getEmptyState('Nenhum material publicado.', 'fa-book-open'); return; }
        
        let sum = []; let dU = new Set(); r.forEach(d => { const dt = d.data(); sum.push({id: d.id, ...dt}); dU.add(dt.disciplina); });
        
        const fS = document.getElementById('aluno-filtro-materiais-disc'); 
        if (fS.options.length <= 1) { let oH = '<option value="">Todas as Disciplinas</option>'; Array.from(dU).sort().forEach(dc => oH += `<option value="${dc}">${dc}</option>`); fS.innerHTML = oH; }
        
        const fA = fS.value; if(fA) sum = sum.filter(s => s.disciplina === fA); 
        sum.sort((a,b) => b.timestamp - a.timestamp || b.data.localeCompare(a.data)); 
        
        if(sum.length === 0) { c.innerHTML = getEmptyState('Sem materiais para esta disciplina.', 'fa-filter'); return; }
        
        let html = ''; 
        sum.forEach(s => { 
            const ficheiro = s.ficheiroBase64 || s.anexoBase64;
            const nomeFicheiro = s.anexoNome || 'Material_Anexo';
            const aB = ficheiro ? `<a href="${ficheiro}" download="${nomeFicheiro}" class="primary-btn small-btn" style="display:block; margin-top:15px; width:100%; text-align:center; padding:10px 12px; background-color:#0099ff; color:white;"><i class="fa-solid fa-download"></i> Baixar Anexo</a>` : ''; 
            html += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #0099ff;"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">${s.data} | ${s.disciplina} | Prof. ${s.professor || ''}</span><h4 style="margin:5px 0; color:var(--text-light);">${s.titulo}</h4>${s.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">${s.descricao}</p>` : ''}</div></div>${aB}</div>`; 
        }); 
        c.innerHTML = html;
    } catch(e) { c.innerHTML = '<p class="text-danger center">Erro ao carregar os dados.</p>'; }
}
document.getElementById('aluno-filtro-materiais-disc')?.addEventListener('change', carregarMateriaisAluno);

async function pedirPermissaoNotificacoes() { try { const p = await Notification.requestPermission(); if(p==='granted') { const r = await navigator.serviceWorker.register('./firebase-messaging-sw.js'); const t = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: r }); if(t) await updateDoc(doc(db, "utilizadores", myUserId), { tokenNotificacao: t }); } } catch(e){} }
if(typeof onMessage !== "undefined" && messaging) onMessage(messaging, p => alert(`NOVA NOTIFICAÇÃO:\n${p.notification.title}\n${p.notification.body}`));
setTimeout(() => { if(myUserId) pedirPermissaoNotificacoes(); }, 4000);
