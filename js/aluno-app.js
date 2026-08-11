import { auth, db, messaging, VAPID_KEY, getToken, onMessage } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, updateDoc, getDocs, query, addDoc, onSnapshot, orderBy, setDoc, enableIndexedDbPersistence, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

try { enableIndexedDbPersistence(db).catch(function(){}); } catch(e){}

let myUserId = "", myUserName = "", minhaTurma = "", myAcademia = "";
let chartInstance = null; let alunoForumAtivoId = null; let chatUnsubscribeAluno = null; let pendingDeleteChatId = null; let pendingDeleteObjetivoId = null;
let fPB64 = "";

window.timelineFilterCat = 'all'; window.notifFilterCat = 'all';
let ahModo = 'dia', ahDOff = 0, ahSOff = 0;

function bindClick(id, fn) { const el = document.getElementById(id); if(el) el.addEventListener('click', fn); }
function bindChange(id, fn) { const el = document.getElementById(id); if(el) el.addEventListener('change', fn); }
function bindInput(id, fn) { const el = document.getElementById(id); if(el) el.addEventListener('input', fn); }
function safeAddClass(id, className) { const el = document.getElementById(id); if(el) el.classList.add(className); }
function safeRemoveClass(id, className) { const el = document.getElementById(id); if(el) el.classList.remove(className); }

function getEmptyState(mensagem, icone = "fa-folder-open") {
    return `<div style="text-align:center; padding: 40px 20px; opacity: 0.5;"><i class="fa-solid ${icone}" style="font-size: 3.5rem; margin-bottom: 15px; color: var(--text-muted);"></i><p style="font-size: 0.95rem; color: var(--text-muted);">${mensagem}</p></div>`;
}

// ==========================================
// NÍVEIS PROFISSIONAIS E 22 BADGES
// ==========================================
function getNivelProInfo(xpTotal) {
    const xp = xpTotal || 0;
    if(xp < 300) return { nivel: 1, titulo: "Aprendiz", progresso: (xp/300)*100 };
    if(xp < 700) return { nivel: 2, titulo: "Iniciante", progresso: ((xp-300)/400)*100 };
    if(xp < 1200) return { nivel: 3, titulo: "Explorador Júnior", progresso: ((xp-700)/500)*100 };
    if(xp < 2000) return { nivel: 4, titulo: "Assistente de Turismo", progresso: ((xp-1200)/800)*100 };
    if(xp < 3000) return { nivel: 5, titulo: "Profissional em Formação", progresso: ((xp-2000)/1000)*100 };
    if(xp < 4500) return { nivel: 6, titulo: "Técnico Júnior", progresso: ((xp-3000)/1500)*100 };
    if(xp < 6000) return { nivel: 7, titulo: "Técnico Intermédio", progresso: ((xp-4500)/1500)*100 };
    if(xp < 8000) return { nivel: 8, titulo: "Técnico Avançado", progresso: ((xp-6000)/2000)*100 };
    if(xp < 10000) return { nivel: 9, titulo: "Técnico de Excelência", progresso: ((xp-8000)/2000)*100 };
    if(xp < 15000) return { nivel: 10, titulo: "Especialista Bronze", progresso: ((xp-10000)/5000)*100 };
    if(xp < 20000) return { nivel: 11, titulo: "Especialista Prata", progresso: ((xp-15000)/5000)*100 };
    return { nivel: 12, titulo: "Embaixador Turístico", progresso: 100 };
}

const BADGES_DEFS = [
    { id: "b1", nome: "Primeiro Passo", icon: "fa-shoe-prints", reqXp: 100 },
    { id: "b2", nome: "Promessa", icon: "fa-star", reqXp: 1000 },
    { id: "b3", nome: "Veterano", icon: "fa-shield", reqXp: 5000 },
    { id: "b4", nome: "Lenda da Escola", icon: "fa-building-columns", reqXp: 10000 },
    
    { id: "b5", nome: "Comunicador Nato", icon: "fa-microphone", reqCom: 100 },
    { id: "b6", nome: "Voz da Razão", icon: "fa-comment-dots", reqCom: 500 },
    { id: "b7", nome: "Mestre da Oratória", icon: "fa-bullhorn", reqCom: 1000 },
    
    { id: "b8", nome: "Faísca Criativa", icon: "fa-lightbulb", reqCri: 100 },
    { id: "b9", nome: "Mente Inovadora", icon: "fa-wand-magic-sparkles", reqCri: 500 },
    { id: "b10", nome: "Visionário", icon: "fa-eye", reqCri: 1000 },
    
    { id: "b11", nome: "Guia Local", icon: "fa-map-location-dot", reqLid: 100 },
    { id: "b12", nome: "Líder Natural", icon: "fa-crown", reqLid: 500 },
    { id: "b13", nome: "Capitão de Equipa", icon: "fa-anchor", reqLid: 1000 },
    
    { id: "b14", nome: "Organizado", icon: "fa-list-check", reqOrg: 100 },
    { id: "b15", nome: "Estratega", icon: "fa-chess-knight", reqOrg: 500 },
    { id: "b16", nome: "Arquiteto", icon: "fa-compass-drafting", reqOrg: 1000 },
    
    { id: "b17", nome: "Colega 5 Estrelas", icon: "fa-handshake-angle", reqXp: 1500 },
    { id: "b18", nome: "Imparável", icon: "fa-fire-flame-curved", reqXp: 8000 },
    { id: "b19", nome: "Coração de Ouro", icon: "fa-heart", reqXp: 3000 },
    { id: "b20", nome: "Mestre do Turismo", icon: "fa-plane-departure", reqXp: 15000 },
    { id: "b21", nome: "Embaixador VIP", icon: "fa-gem", reqXp: 20000 },
    { id: "b22", nome: "Turma PRO", icon: "fa-trophy", reqXp: 25000 }
];

const ACADEMIAS_INFO = {
    'estrategas': { nome: 'Academia dos Estrategas', cor: '#10b981', icon: 'fa-chess-knight', desc: 'Mestres do planeamento. Manténs a calma sob pressão.' },
    'embaixadores': { nome: 'Academia dos Embaixadores', cor: '#0ea5e9', icon: 'fa-handshake', desc: 'A alma da hospitalidade! És a primeira cara que os turistas veem.' },
    'exploradores': { nome: 'Academia dos Exploradores', cor: '#f97316', icon: 'fa-compass', desc: 'Os guias de ação! Gostas de estar no terreno, não tens medo de liderar.' },
    'visionarios': { nome: 'Academia dos Visionários', cor: '#8b5cf6', icon: 'fa-lightbulb', desc: 'Os criativos do Turismo. Pensas "fora da caixa".' }
};

const matrizAmbos = {
    "Sociocultural": { "PORT": {"1":33,"2":34,"3":33,"4":33,"5":34,"6":33,"7":40,"8":40,"9":40}, "ING": {"1":27,"2":24,"3":24,"4":24,"5":24,"6":24,"7":24,"8":24,"9":24}, "AI": {"1":36,"2":36,"3":36,"4":36,"5":37,"6":39}, "EF": {"1":10,"2":8,"3":10,"4":10,"5":10,"6":12,"7":6,"8":12,"9":8,"10":10,"11":12,"12":8,"13":6,"14":10,"15":6,"16":2}, "TIC": {"1":25,"2":25,"3":25,"4":25} },
    "Científica": { "GEO": {"1":33,"2":33,"3":30,"4":26,"5":21,"6":21,"7":21,"8":15}, "HCA": {"1":20,"2":18,"3":18,"4":18,"5":24,"6":18,"7":18,"8":24,"9":21,"10":21}, "MAT": {"1":33,"2":27,"3":20,"4":20} }
};
const matrizAntigoTecnica = { "CF": {"1":24,"2":21,"3":21,"4":21,"5":21,"6":21,"7":9,"8":15,"9":15}, "TIAT": {"1":27,"2":24,"3":24,"4":24,"5":33,"6":30,"7":30,"8":30,"9":36,"10":30,"11":33,"12":30,"13":24}, "TCAT": {"1":33,"2":33,"3":30,"4":33,"5":36,"6":36,"7":24}, "OTET": {"1":24,"2":24,"3":33,"4":30,"5":24,"6":24,"7":36,"8":27,"9":33,"10":30,"11":30,"12":17} };
const matrizNovoTecnica = { "AET": {"UC00038":20,"UC03611":20,"UC03623":40,"UC03612":40,"UC03613":20,"UC03614":40,"UC00056":20,"UC03631":40,"UC00063":20}, "OGOT": {"UC03629":20,"UC03619":40,"UC03621":40,"UC00055":20,"UC03630":20,"UC03616":20,"UC03617":40,"UC03618":20,"UC03620":40,"UC03628":40,"UC03632":20}, "CMET": {"UC00034":30,"UC00033":30,"UC00593":20,"UC03622":40,"UC03623":40,"UC00031":30,"UC00032":30,"UC00433":20,"UC03624":20,"UC03627":20}, "LNTT": {"UC00044":50,"UC00071":50,"UC03615":40,"UC03625":20} };

function getMatriz() {
    const mStr = minhaTurma || ""; const mMatch = mStr.match(/\d+/); const ano = mMatch ? parseInt(mMatch[0]) : 10;
    let m = JSON.parse(JSON.stringify(matrizAmbos)); m["Técnica"] = (ano >= 11) ? matrizAntigoTecnica : matrizNovoTecnica; return m;
}

function obterDisciplinasDoAno() {
    const mStr = minhaTurma || ""; const mMatch = mStr.match(/\d+/); const ano = mMatch ? parseInt(mMatch[0]) : 10;
    const base = { 10: ["PORT", "ING", "AI", "EF", "TIC", "GEO", "HCA", "MAT"], 11: ["PORT", "ING", "AI", "EF", "GEO", "HCA"], 12: ["PORT", "ING", "EF", "GEO", "HCA"] };
    const tecAntigo = { 10: ["CF", "TIAT", "TCAT", "OTET"], 11: ["CF", "TIAT", "TCAT", "OTET"], 12: ["TIAT", "OTET"] };
    const tecNovo = { 10: ["AET", "OGOT", "CMET", "LNTT"], 11: ["AET", "OGOT", "CMET", "LNTT"], 12: ["AET", "OGOT", "CMET"] };
    let arr = [...(base[ano] || base[10])]; if (ano >= 11) arr = [...arr, ...(tecAntigo[ano] || tecAntigo[11])]; else arr = [...arr, ...(tecNovo[ano] || tecNovo[10])]; return arr;
}

const perguntasQuiz = [
    { q: "Um grupo de turistas chegou e o quarto ainda não está pronto. O que fazes?", opcoes: [ { text: "Ofereço um café e faço com que se sintam em casa.", academia: "embaixadores" }, { text: "Reorganizo rapidamente o mapa de limpezas.", academia: "estrategas" }, { text: "Levo-os numa visita aos jardins.", academia: "exploradores" }, { text: "Surpreendo-os com uma 'Experiência' que criei.", academia: "visionarios" } ] },
    { q: "Num trabalho de grupo, qual costuma ser o teu papel?", opcoes: [ { text: "Dividir tarefas e garantir prazos.", academia: "estrategas" }, { text: "Apresentar o trabalho à turma.", academia: "embaixadores" }, { text: "Recolher materiais no terreno.", academia: "exploradores" }, { text: "Dar o toque final de design e ideias.", academia: "visionarios" } ] },
    { q: "Se pudesses escolher o ambiente de trabalho de sonho, seria...", opcoes: [ { text: "Ao ar livre, a explorar trilhos.", academia: "exploradores" }, { text: "No escritório, a gerir dados e rotas.", academia: "estrategas" }, { text: "Num lobby de um hotel, a falar com pessoas.", academia: "embaixadores" }, { text: "Num estúdio criativo e de marketing.", academia: "visionarios" } ] },
    { q: "Quando tens um problema difícil para resolver, como reages?", opcoes: [ { text: "Improviso usando a imaginação.", academia: "visionarios" }, { text: "Mantenho a empatia para ninguém ficar nervoso.", academia: "embaixadores" }, { text: "Analiso os factos friamente.", academia: "estrategas" }, { text: "Sigo o instinto e tomo a iniciativa.", academia: "exploradores" } ] }
];

let pAtual = 0; let quizScores = { estrategas: 0, embaixadores: 0, exploradores: 0, visionarios: 0 };

// ==========================================
// ARRANQUE E NAVEGAÇÃO
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            if (docSnap.exists() && docSnap.data().papel === 'aluno') {
                const d = docSnap.data(); myUserName = (d.nome || "Aluno").split(' ')[0]; minhaTurma = d.turma || ""; myAcademia = d.academia || null;
                
                document.getElementById('header-user-name-aluno').innerText = myUserName; document.getElementById('welcome-nome').innerText = myUserName;
                const centralNome = document.getElementById('perfil-nome-central'); if(centralNome) centralNome.innerText = d.nome || myUserName;
                
                const avatarCircle = document.getElementById('header-avatar-circle'); const perfilImg = document.getElementById('perfil-avatar-img');
                if(d.fotoPerfil) { if(avatarCircle) avatarCircle.innerHTML = `<img src="${d.fotoPerfil}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`; if(perfilImg) perfilImg.src = d.fotoPerfil; } 
                else { if(perfilImg) perfilImg.src = `https://ui-avatars.com/api/?name=${myUserName}&background=00cc88&color=fff&size=100`; }

                const objSelect = document.getElementById('obj-disciplina'); 
                if(objSelect) {
                    objSelect.innerHTML = '<option value="">Escolhe a Disciplina...</option>' + obterDisciplinasDoAno().map(dc => `<option value="${dc}">${dc}</option>`).join('');
                }

                const mStr = minhaTurma || ""; const mMatch = mStr.match(/\d+/); const turmaAno = mMatch ? parseInt(mMatch[0]) : (d.ano || 10);
                
                const btnPassaporte = document.getElementById('btn-abrir-passaporte'); const secFct = document.getElementById('sec-aluno-fct'); const secPap = document.getElementById('sec-aluno-pap');
                if (turmaAno === 10) { if(btnPassaporte) btnPassaporte.style.display = 'none'; } 
                else if (turmaAno === 11) { if(btnPassaporte) { btnPassaporte.style.display = 'flex'; document.getElementById('btn-passaporte-texto').innerText = 'FCT (Estágio)'; } if(secFct) secFct.style.display = 'block'; if(secPap) secPap.style.display = 'none'; } 
                else { if(btnPassaporte) { btnPassaporte.style.display = 'flex'; document.getElementById('btn-passaporte-texto').innerText = 'Estágio / PAP'; } if(secFct) secFct.style.display = 'block'; if(secPap) secPap.style.display = 'block'; }

                carregarGamificacao(d); carregarPassaporteEBadges(d); carregarMissoes(); carregarDadosPassaporte(d); construirHomeAdaptativa(); verificarEpocaExames();
                if (!myAcademia) document.getElementById('modal-academia-quiz').style.display = 'flex'; else aplicarTemaAcademia(myAcademia);
            } else window.location.href = "index.html";
        } catch (e) { console.error(e); }
    } else window.location.href = "index.html";
});

bindClick('btn-logout-aluno', () => signOut(auth));

function renderizarPergunta() {
    if(pAtual >= perguntasQuiz.length) { finalizarQuiz(); return; }
    const qData = perguntasQuiz[pAtual];
    document.getElementById('quiz-progress-text').innerText = `Pergunta ${pAtual + 1} de ${perguntasQuiz.length}`;
    document.getElementById('quiz-progress-bar').style.width = `${((pAtual + 1) / perguntasQuiz.length) * 100}%`;
    document.getElementById('quiz-q-title').innerText = qData.q;
    const optContainer = document.getElementById('quiz-q-options'); optContainer.innerHTML = '';
    const shuffled = [...qData.opcoes].sort(() => Math.random() - 0.5);
    shuffled.forEach(opt => {
        const btn = document.createElement('button'); btn.className = 'secondary-btn'; btn.style.cssText = 'text-align: left; padding: 18px 20px; height: auto; font-size: 1rem; border-color: #333; justify-content: flex-start; transition: 0.3s; color: var(--text-light);'; btn.innerText = opt.text;
        btn.addEventListener('mouseover', () => btn.style.borderColor = 'var(--primary-green)'); btn.addEventListener('mouseout', () => btn.style.borderColor = '#333');
        btn.addEventListener('click', () => { quizScores[opt.academia]++; pAtual++; renderizarPergunta(); }); optContainer.appendChild(btn);
    });
}
bindClick('btn-start-quiz', () => { document.getElementById('quiz-step-intro').style.display = 'none'; document.getElementById('quiz-step-question').style.display = 'block'; renderizarPergunta(); });

async function finalizarQuiz() { 
    document.getElementById('quiz-step-question').style.display = 'none'; document.getElementById('quiz-step-loading').style.display = 'block';
    let winningHouse = Object.keys(quizScores).reduce((a, b) => quizScores[a] > quizScores[b] ? a : b); 
    if(quizScores[winningHouse] === 0) winningHouse = 'estrategas'; 
    myAcademia = winningHouse; const ac = ACADEMIAS_INFO[winningHouse]; 
    try { await updateDoc(doc(db, "utilizadores", myUserId), { academia: winningHouse }); } catch(e) {} 
    setTimeout(() => {
        document.getElementById('quiz-step-loading').style.display = 'none'; document.getElementById('quiz-step-result').style.display = 'block'; 
        document.getElementById('quiz-result-icon').innerHTML = `<i class="fa-solid ${ac.icon}" style="color: ${ac.cor}; text-shadow: 0 0 30px ${ac.cor};"></i>`; 
        document.getElementById('quiz-result-title').innerText = ac.nome; document.getElementById('quiz-result-title').style.color = ac.cor; document.getElementById('quiz-result-desc').innerText = ac.desc; 
        document.getElementById('btn-finish-quiz').style.backgroundColor = ac.cor; document.getElementById('btn-finish-quiz').style.color = "#000";
    }, 2000);
}
bindClick('btn-finish-quiz', () => { document.getElementById('modal-academia-quiz').style.display = 'none'; aplicarTemaAcademia(myAcademia); });

function aplicarTemaAcademia(idHouse) { 
    const ac = ACADEMIAS_INFO[idHouse]; if(!ac) return; 
    document.documentElement.style.setProperty('--primary-green', ac.cor); 
    const rankElem = document.getElementById('aluno-rank-title'); const rankCentral = document.getElementById('perfil-titulo-central'); 
    if(rankElem) { const profInfo = getNivelProInfo(parseInt(document.getElementById('aluno-xp-atual').innerText) || 0); rankElem.innerText = `${ac.nome.replace('Academia dos ','')} • ${profInfo.titulo}`; }
    if(rankCentral) { rankCentral.innerHTML = `<i class="fa-solid ${ac.icon}"></i> ${ac.nome}`; rankCentral.style.color = ac.cor; }
    const avatarImg = document.getElementById('perfil-avatar-img'); if (avatarImg) avatarImg.style.borderColor = ac.cor;
}

// ==========================================
// GAMIFICAÇÃO, PASSAPORTE E MISSÕES
// ==========================================
function carregarGamificacao(dados) {
    const xp = dados.xp || 0; const profInfo = getNivelProInfo(xp);
    const nivelEl = document.getElementById('aluno-nivel'); if(nivelEl) nivelEl.innerText = profInfo.nivel; 
    const xpEl = document.getElementById('aluno-xp-atual'); if(xpEl) xpEl.innerText = xp;
    const rankElem = document.getElementById('aluno-rank-title'); 
    if(rankElem && myAcademia && ACADEMIAS_INFO[myAcademia]) { rankElem.innerText = `${ACADEMIAS_INFO[myAcademia].nome.replace('Academia dos ','')} • ${profInfo.titulo}`; } 
    else if (rankElem) { rankElem.innerText = profInfo.titulo; }
    const perfilNvlTxt = document.getElementById('perfil-nivel-txt'); if(perfilNvlTxt) perfilNvlTxt.innerText = `Nível ${profInfo.nivel} - ${profInfo.titulo}`;
    const totaisEl = document.getElementById('perfil-xp-totais'); const progEl = document.getElementById('perfil-xp-progress');
    if(totaisEl) totaisEl.innerText = xp; if(progEl) progEl.style.width = `${profInfo.progresso}%`; 
}

function carregarPassaporteEBadges(data) {
    const passCont = document.getElementById('barras-competencias-perfil');
    if(passCont) {
        const getLvl = (xp) => Math.floor((xp || 0) / 100) + 1; const getPerc = (xp) => ((xp || 0) % 100);
        const xpCom = data.xp_comunicacao || 0; const lvlCom = getLvl(xpCom); const percCom = getPerc(xpCom);
        const xpCri = data.xp_criatividade || 0; const lvlCri = getLvl(xpCri); const percCri = getPerc(xpCri);
        const xpLid = data.xp_lideranca || 0; const lvlLid = getLvl(xpLid); const percLid = getPerc(xpLid);
        const xpOrg = data.xp_organizacao || 0; const lvlOrg = getLvl(xpOrg); const percOrg = getPerc(xpOrg);

        passCont.innerHTML = `
        <div style="margin-bottom: 12px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-comments" style="color:#0ea5e9;"></i> Comunicação</span><strong style="color:var(--text-light);">Nvl ${lvlCom}</strong></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percCom}%; background:#0ea5e9;"></div></div></div>
        <div style="margin-bottom: 12px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-lightbulb" style="color:#8b5cf6;"></i> Criatividade</span><strong style="color:var(--text-light);">Nvl ${lvlCri}</strong></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percCri}%; background:#8b5cf6;"></div></div></div>
        <div style="margin-bottom: 12px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-compass" style="color:#f97316;"></i> Liderança</span><strong style="color:var(--text-light);">Nvl ${lvlLid}</strong></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percLid}%; background:#f97316;"></div></div></div>
        <div style="margin-bottom: 12px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-chess-knight" style="color:#10b981;"></i> Estratégia</span><strong style="color:var(--text-light);">Nvl ${lvlOrg}</strong></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percOrg}%; background:#10b981;"></div></div></div>`;
    }
    const badCont = document.getElementById('badges-container');
    if(badCont) {
        let bHtml = '';
        BADGES_DEFS.forEach(b => {
            let earned = false;
            if(b.reqXp && (data.xp || 0) >= b.reqXp) earned = true;
            if(b.reqCom && (data.xp_comunicacao || 0) >= b.reqCom) earned = true;
            if(b.reqCri && (data.xp_criatividade || 0) >= b.reqCri) earned = true;
            if(b.reqLid && (data.xp_lideranca || 0) >= b.reqLid) earned = true;
            if(b.reqOrg && (data.xp_organizacao || 0) >= b.reqOrg) earned = true;
            const cl = earned ? 'earned' : ''; bHtml += `<div class="badge-item ${cl}"><div class="badge-icon"><i class="fa-solid ${b.icon}"></i></div><div style="font-size:0.7rem; color:${earned ? 'var(--text-light)' : 'var(--text-muted)'};">${b.nome}</div></div>`;
        });
        badCont.innerHTML = bHtml;
    }
}

function carregarMissoes() {
    const cont = document.getElementById('missoes-container'); if(!cont) return;
    cont.innerHTML = getEmptyState('Nenhuma missão ativa de momento.', 'fa-bullseye');
}

function carregarDadosPassaporte(dados) {
    const hrEl = document.getElementById('aluno-fct-horas'); const prEl = document.getElementById('aluno-fct-progress'); const inEl = document.getElementById('input-fct-horas');
    if(hrEl && dados.fct) hrEl.innerText = `${dados.fct.horasRealizadas||0} / ${dados.fct.horasTotal||0}h`; 
    if(prEl && dados.fct) prEl.style.width = `${((dados.fct.horasRealizadas||0)/(dados.fct.horasTotal||1))*100}%`; 
    if(inEl && dados.fct) inEl.value = dados.fct.horasRealizadas||'';
    const tEl = document.getElementById('input-pap-tema'); if(tEl && dados.pap) tEl.value = dados.pap.tema || '';
    const fEl = document.getElementById('aluno-pap-file-name'); if(fEl && dados.papFicheiroEnviado) fEl.innerText = "Ficheiro submetido.";
}

// ==========================================
// EVENTOS PRINCIPAIS DE NAVEGAÇÃO E BINDINGS
// ==========================================
function esconderTodasAsVistas() { document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none'); }

document.body.addEventListener('click', async (e) => {
    const nav = e.target.closest('.nav-item');
    if(nav) {
        e.preventDefault(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); nav.classList.add('active');
        esconderTodasAsVistas(); const tId = nav.getAttribute('data-target'); const tgt = document.getElementById(tId); if(tgt) tgt.style.display = (tId === 'view-aluno-forum') ? 'flex' : 'block';
        if(tId === 'view-aluno-perfil') { carregarRankingTurma(); carregarObjetivosPessoais(); }
        if(tId === 'view-aluno-caderneta') { const el = document.getElementById('tab-aluno-timeline'); if(el) el.click(); }
        if(tId === 'view-aluno-agenda') { const el = document.getElementById('tab-aluno-eventos'); if(el) el.click(); }
        if(tId === 'view-aluno-forum') carregarForuns();
    }
    
    if(e.target.closest('#btn-open-materiais')) { esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); const el = document.getElementById('view-aluno-materiais'); if(el) el.style.display = 'block'; carregarMateriaisAluno(); }
    if(e.target.closest('#btn-abrir-passaporte')) { esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); const el = document.getElementById('view-aluno-passaporte'); if(el) el.style.display = 'block'; }
    if(e.target.closest('#btn-open-notificacoes')) { esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); const el = document.getElementById('view-aluno-notificacoes'); if(el) el.style.display = 'block'; carregarNotificacoesAluno(); }
    if(e.target.closest('#btn-voltar-notificacoes') || e.target.closest('#btn-voltar-materiais') || e.target.closest('#btn-voltar-passaporte')) { const el = document.querySelector('.nav-item[data-target="student-dashboard"]'); if(el) el.click(); }

    if(e.target.closest('#tab-aluno-timeline')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='flex'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; carregarTimelineAluno(); }
    if(e.target.closest('#tab-aluno-notas')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; carregarNotasAluno(); }
    if(e.target.closest('#tab-aluno-faltas')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; carregarFaltasAluno(); }
    if(e.target.closest('#tab-aluno-prhfs')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; carregarPrhfsAluno(); }
    if(e.target.closest('#tab-aluno-evolucao')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar evolução...</p>'; carregarEvolucaoAluno(); }
    if(e.target.closest('#tab-aluno-observacoes')) { document.querySelectorAll('.falta-tab-btn').forEach(b=>b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('timeline-filtros').style.display='none'; document.getElementById('aluno-caderneta-content').innerHTML='<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; carregarObservacoesAluno(); }

    const tChip = e.target.closest('#timeline-filtros .filter-chip');
    if(tChip) { document.querySelectorAll('#timeline-filtros .filter-chip').forEach(c => c.classList.remove('active')); tChip.classList.add('active'); window.timelineFilterCat = tChip.getAttribute('data-cat'); carregarTimelineAluno(); }
    const nChip = e.target.closest('#notificacoes-filtros .filter-chip');
    if(nChip) { document.querySelectorAll('#notificacoes-filtros .filter-chip').forEach(c => c.classList.remove('active')); nChip.classList.add('active'); window.notifFilterCat = nChip.getAttribute('data-cat'); carregarNotificacoesAluno(); }

    if(e.target.closest('#tab-aluno-eventos')) { document.getElementById('tab-aluno-eventos').classList.add('active'); document.getElementById('tab-aluno-horario').classList.remove('active'); document.getElementById('aluno-agenda-filtros').style.display = 'flex'; document.getElementById('aluno-horario-container').style.display = 'none'; document.getElementById('aluno-agenda-content').style.display = 'block'; carregarAgendaAlunoLista(); }
    if(e.target.closest('#tab-aluno-horario')) { document.getElementById('tab-aluno-horario').classList.add('active'); document.getElementById('tab-aluno-eventos').classList.remove('active'); document.getElementById('aluno-agenda-filtros').style.display = 'none'; document.getElementById('aluno-agenda-content').style.display = 'none'; document.getElementById('aluno-horario-container').style.display = 'block'; carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-horario-dia')) { ahModo = 'dia'; document.getElementById('btn-aluno-horario-dia').classList.add('active'); document.getElementById('btn-aluno-horario-grelha').classList.remove('active'); carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-horario-grelha')) { ahModo = 'grelha'; document.getElementById('btn-aluno-horario-grelha').classList.add('active'); document.getElementById('btn-aluno-horario-dia').classList.remove('active'); carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-prev-horario')) { if(ahModo === 'dia') ahDOff--; else ahSOff--; carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-next-horario')) { if(ahModo === 'dia') ahDOff++; else ahSOff++; carregarHorarioAluno(); }

    if(e.target.closest('#btn-create-chat-aluno')) {
        document.getElementById('modal-criar-forum').style.display = 'flex'; const cCont = document.getElementById('lista-colegas-forum'); cCont.innerHTML = '<p class="text-muted center">A procurar colegas...</p>';
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

// Event Delegation global para Inputs e Selects
document.body.addEventListener('change', (e) => {
    if(e.target.closest('.agenda-filter-label input')) { carregarAgendaAlunoLista(); }
    if(e.target.id === 'obj-disciplina') { atualizarModulosMeta(); }
    if(e.target.id === 'aluno-upload-pap') {
        const file = e.target.files[0]; if(!file) return; document.getElementById('aluno-pap-file-name').innerText = "Ficheiro: " + file.name; document.getElementById('btn-enviar-pap').style.display = 'block'; const reader = new FileReader(); reader.onload = (ev) => { fPB64 = ev.target.result; }; reader.readAsDataURL(file);
    }
    if(e.target.id === 'upload-avatar') {
        const file = e.target.files[0]; if(!file) return;
        try { const reader = new FileReader(); reader.onload = async (ev) => { const base64 = ev.target.result; document.getElementById('perfil-avatar-img').src = base64; document.getElementById('header-avatar-circle').innerHTML = `<img src="${base64}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`; await updateDoc(doc(db, "utilizadores", myUserId), { fotoPerfil: base64 }); }; reader.readAsDataURL(file); } catch(err) {} 
    }
});

function atualizarModulosMeta() {
    const disc = document.getElementById('obj-disciplina').value;
    const selMod = document.getElementById('obj-modulo');
    selMod.innerHTML = '';
    if(!disc) { selMod.innerHTML = '<option value="">Mod.</option>'; return; }
    
    const matriz = getMatriz();
    let mods = null;
    for(let comp in matriz) { if(matriz[comp][disc]) mods = matriz[comp][disc]; }
    
    if(mods) {
        const modKeys = Object.keys(mods);
        const isNumeric = modKeys.every(k => !isNaN(k));
        if(isNumeric) modKeys.sort((a,b) => parseInt(a) - parseInt(b));
        modKeys.forEach(m => {
            const label = m.toString().startsWith('UC') ? m : `M${m}`;
            selMod.innerHTML += `<option value="${m}">${label}</option>`;
        });
    } else {
        selMod.innerHTML = '<option value="">Mod.</option>';
    }
}

bindClick('btn-save-fct', async (e) => { const v = document.getElementById('input-fct-horas').value.trim(); if(!v) return; const b = e.currentTarget; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { await updateDoc(doc(db, "utilizadores", myUserId), { "fct.horasRealizadas": v }); b.style.backgroundColor = 'var(--success-green)'; b.innerHTML = '<i class="fa-solid fa-check"></i>'; setTimeout(() => { b.style.backgroundColor = 'var(--primary-green)'; b.innerHTML = '<i class="fa-solid fa-check"></i>'; b.disabled = false; }, 2000); } catch(err) {} });
bindClick('btn-save-pap-tema', async (e) => { const v = document.getElementById('input-pap-tema').value.trim(); if(!v) return; const b = e.currentTarget; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { await updateDoc(doc(db, "utilizadores", myUserId), { "pap.tema": v }); b.style.backgroundColor = 'var(--success-green)'; b.innerHTML = '<i class="fa-solid fa-check"></i>'; setTimeout(() => { b.style.backgroundColor = 'var(--primary-green)'; b.innerHTML = '<i class="fa-solid fa-save"></i>'; b.disabled = false; }, 2000); } catch(err) {} });
bindClick('btn-enviar-pap', async (e) => { if(!fPB64) return; const b = e.currentTarget; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { const snap = await getDoc(doc(db, "utilizadores", myUserId)); let axp = snap.exists()&&snap.data().xp?snap.data().xp:0; await updateDoc(doc(db, "utilizadores", myUserId), { papFicheiroEnviado:true, papFicheiroBase64:fPB64, xp:axp+200 }); b.style.backgroundColor="var(--success-green)"; b.innerHTML='<i class="fa-solid fa-check"></i> Submetido'; setTimeout(() => { b.style.display='none'; b.disabled=false; const fNm = document.getElementById('aluno-pap-file-name'); if(fNm) fNm.style.color="var(--success-green)"; }, 2000); } catch(err){} });

async function construirHomeAdaptativa() {
    const alertCont = document.getElementById('hero-alert-section'); const emoCont = document.getElementById('hero-emotional-section');
    if(!alertCont || !emoCont) return;
    try {
        let tFaltas = 0, evs = [], pAtivos = 0, pHoras = 0, mRep = 0;
        const fS = await getDocs(collection(db, "utilizadores", myUserId, "faltas")); fS.forEach(d => { if(!d.data().justificada && !d.data().comprovativoEnviado) tFaltas++; });
        const nS = await getDocs(collection(db, "utilizadores", myUserId, "notas")); nS.forEach(d => { const n = d.data().nota; if(n==='REP'||Number(n)<10) mRep++; });
        const pS = await getDocs(collection(db, "utilizadores", myUserId, "prhfs")); pS.forEach(d => { if(d.data().status!=='concluida'){pAtivos++; pHoras+=Number(d.data().horasPresenciais||0);} });
        
        if(minhaTurma) {
            const evSnap = await getDocs(collection(db, "turmas", minhaTurma, "eventos")); const hj = new Date().toISOString().split('T')[0]; let d7 = new Date(); d7.setDate(d7.getDate()+7); const lIso = d7.toISOString().split('T')[0];
            evSnap.forEach(d => { const e = d.data(); if(e.data>=hj && e.data<=lIso && ['teste','avaliacao','entrega'].includes(e.tipo)) evs.push(e); }); evs.sort((a,b)=>a.data.localeCompare(b.data));
        }

        let alertHtml = ''; 
        if(tFaltas>0 || pAtivos>0 || mRep>0) {
            alertHtml += `<div class="card" style="background:linear-gradient(135deg,#ef4444,#b91c1c); color:white; border:none; border-radius:16px; margin-bottom:20px;"><h3 style="margin-bottom:10px; font-size:1.8rem;"><i class="fa-solid fa-triangle-exclamation"></i> Ação Necessária</h3><p style="font-size:1.1rem; margin-bottom:15px; opacity:0.9;">Tens pendências urgentes que prejudicam a tua avaliação.</p><ul style="margin-bottom:20px; padding-left:20px; font-size:1.1rem; font-weight:bold; line-height:1.6;">${tFaltas>0?`<li>${tFaltas} Falta(s) injustificada(s)</li>`:''}${mRep>0?`<li>${mRep} Módulo(s) Reprovado(s)</li>`:''}${pAtivos>0?`<li>${pAtivos} PRHF(s) pendentes (${pHoras}h presenciais)</li>`:''}</ul><button class="primary-btn" style="background:white; color:#b91c1c; font-size:1.1rem; padding:15px;" onclick="document.querySelector('.nav-item[data-target=\\'view-aluno-caderneta\\']').click()">Abrir Caderneta e Resolver</button></div>`;
        } else if(evs.length>0) {
            const ev = evs[0]; const dF = ev.data.split('-').reverse().join('/');
            alertHtml += `<div class="card" style="background:linear-gradient(135deg,#f59e0b,#d97706); color:white; border:none; border-radius:16px; margin-bottom:20px;"><h3 style="margin-bottom:10px; font-size:1.8rem;"><i class="fa-solid fa-calendar-exclamation"></i> Prepara-te</h3><p style="font-size:1.1rem; margin-bottom:15px; opacity:0.9;">Tens <strong>${ev.titulo}</strong> no dia ${dF}.</p></div>`;
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
    if(!minhaTurma) return; const tSnap = await getDoc(doc(db, "turmas", minhaTurma)); const tSnapData = tSnap.data();
    if(tSnap.exists() && tSnapData.epocaExames && tSnapData.epocaExames.ativa) {
        document.getElementById('exam-mode-banner').style.display='block'; document.body.style.borderTop="5px solid #8b5cf6";
        if(tSnapData.epocaExames.dataFim) { const df = Math.ceil((new Date(tSnapData.epocaExames.dataFim) - new Date()) / (1000 * 60 * 60 * 24)); document.getElementById('exam-countdown').innerText = df > 0 ? `Faltam ${df} dias` : "Já terminou"; }
    }
}

// ==========================================
// CADERNETA: NOTAS (PAUTA GLOBAL) E EVOLUÇÃO (EXTRATO)
// ==========================================
async function carregarNotasAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", myUserId, "notas")); let mapNotas = {}; let disciplinasDoAluno = {}; 
        notasDb.forEach(d => { const n = d.data(); if(!disciplinasDoAluno[n.disciplina]) disciplinasDoAluno[n.disciplina] = []; disciplinasDoAluno[n.disciplina].push(n); mapNotas[`${n.disciplina}_${n.modulo}`] = n.nota; });
        const ordemDisciplinas = obterDisciplinasDoAno();
        if(ordemDisciplinas.length === 0) { cCont.innerHTML = getEmptyState('Ainda não tens disciplinas ativas.', 'fa-book'); return; }

        let html = `<button id="btn-pauta-global" class="primary-btn" style="margin-bottom: 20px; background-color: transparent; border: 1px solid var(--primary-green); color: var(--primary-green);">Pauta Global</button>`;
        ordemDisciplinas.forEach(disc => {
            if(disciplinasDoAluno[disc] && disciplinasDoAluno[disc].length > 0) {
                let sum = 0; let c = 0; let modsHtml = '';
                disciplinasDoAluno[disc].forEach(n => {
                    if(n.nota !== 'REP' && !isNaN(n.nota)) { sum += Number(n.nota); c++; }
                    const cor = (n.nota === 'REP' || Number(n.nota) < 10) ? 'var(--danger-red)' : 'var(--success-green)'; const modLabel = n.modulo.toString().startsWith('UC') ? n.modulo : `Módulo ${n.modulo}`;
                    modsHtml += `<div class="modulo-row"><span style="color:var(--text-light);">${modLabel}</span><span style="font-weight:bold; color:${cor};">${n.nota}</span></div>`;
                });
                const med = c > 0 ? (sum/c).toFixed(1) : '-'; const medCor = (med !== '-' && med < 10) ? 'var(--danger-red)' : 'var(--text-light)';
                html += `<div class="disciplina-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'"><span class="disciplina-title" style="color:var(--text-light);">${disc}</span><span><span style="font-size:0.75rem; color:var(--text-muted); margin-right:8px;">Média:</span><span class="disciplina-media" style="color:${medCor};">${med}</span> <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; color:var(--text-muted); margin-left:5px;"></i></span></div><div class="disciplina-modules">${modsHtml}</div>`;
            } else { html += `<div class="disciplina-header" style="cursor:default;"><span class="disciplina-title" style="color:var(--text-muted);">${disc}</span><span><span class="disciplina-media" style="color:var(--text-muted); font-size:0.9rem;">SN</span></span></div>`; }
        });
        cCont.innerHTML = html;
        
        bindClick('btn-pauta-global', () => { 
            const mod = document.getElementById('modal-pauta-global'); if(mod) mod.style.display = 'flex'; 
            const container = document.getElementById('pauta-global-content'); 
            try { 
                const matriz = getMatriz(); let pHtml = ''; 
                for (const [nomeComponente, disciplinas] of Object.entries(matriz)) { 
                    pHtml += `<div class="pauta-global-componente"><div class="pauta-global-header">${nomeComponente}</div>`; 
                    for (const [nomeDisc, modulos] of Object.entries(disciplinas)) { 
                        pHtml += `<div class="pauta-global-disc"><div class="pauta-global-disc-title">${nomeDisc}</div><div class="pauta-global-notas">`; 
                        const isNumeric = Object.keys(modulos).every(k => !isNaN(k)); const modKeys = isNumeric ? Object.keys(modulos).sort((a,b) => parseInt(a) - parseInt(b)) : Object.keys(modulos);
                        for (const mod of modKeys) { 
                            const nota = mapNotas[`${nomeDisc}_${mod}`] || 'SN'; let cor = "sn"; 
                            if (nota !== 'SN' && nota !== 'REP' && nota >= 10) cor = "positiva"; else if (nota === 'REP' || nota < 10) cor = "negativa"; 
                            const modLabel = mod.toString().startsWith('UC') ? mod : `M${mod}`; pHtml += `<div class="pg-nota-item"><span>${modLabel}</span><span class="pg-nota-val ${cor}">${nota}</span></div>`; 
                        } 
                        pHtml += `</div></div>`; 
                    } pHtml += `</div>`; 
                } 
                if(container) container.innerHTML = pHtml; 
            } catch(err) { if(container) container.innerHTML = '<p class="text-danger center">Erro ao compilar pauta.</p>'; } 
        });
        bindClick('btn-close-pauta', () => { const mod = document.getElementById('modal-pauta-global'); if(mod) mod.style.display = 'none'; });

    } catch(e) {}
}

async function carregarEvolucaoAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    try {
        let html = `<h4 style="color:var(--text-muted); margin-bottom:15px; font-size:0.9rem; text-transform:uppercase;"><i class="fa-solid fa-bolt"></i> Histórico de Ações (Extrato)</h4>`;
        const ocSnap = await getDocs(query(collection(db, "utilizadores", myUserId, "ocorrencias"))); let regs = []; ocSnap.forEach(d => regs.push(d.data()));

        if(regs.length === 0) { html += getEmptyState('Sem registos de evolução.', 'fa-star'); } 
        else {
            regs.sort((a,b) => b.data.localeCompare(a.data));
            regs.forEach(r => {
                const isPos = r.tipo === 'positiva'; const cor = isPos ? 'var(--success-green)' : 'var(--danger-red)'; const bgCor = isPos ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                const xpLabel = r.xp ? (r.xp > 0 ? `+${r.xp} XP` : `${r.xp} XP`) : (isPos ? 'Registo Positivo' : 'Registo Negativo');
                html += `<div style="display:flex; align-items:center; justify-content:space-between; background:${bgCor}; border: 1px solid ${cor}; padding: 12px; border-radius: 8px; margin-bottom: 10px;"><div><strong style="color:${cor}; font-size:1.1rem;">${xpLabel}</strong><br><span style="color:var(--text-light); font-size:0.95rem; font-weight:bold;">${r.titulo}</span>${r.descricao ? `<div style="color:var(--text-muted); font-size:0.85rem; margin-top:3px;">${r.descricao}</div>` : ''}</div><div style="text-align:right; font-size:0.75rem; color:var(--text-muted);">${r.data}<br>Prof. ${r.autor}</div></div>`;
            });
        }
        cCont.innerHTML = html;
    } catch(e) { cCont.innerHTML = '<p class="text-danger center">Erro ao carregar histórico.</p>'; }
}

async function obterEventosLinhaTemporal() {
    let ev = [];
    const nS = await getDocs(collection(db, "utilizadores", myUserId, "notas")); nS.forEach(d => { const n = d.data(); ev.push({ time: new Date(n.data).getTime(), cat: 'notas', icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', titulo: 'Nova Avaliação', desc: `${n.disciplina} (Mod. ${n.modulo}): <strong style="color:var(--text-light);">${n.nota}</strong>` }); });
    const fS = await getDocs(collection(db, "utilizadores", myUserId, "faltas")); fS.forEach(d => { const f = d.data(); ev.push({ time: new Date(f.criadoEm || f.dataInicio).getTime(), cat: 'faltas', icon: '<i class="fa-solid fa-user-xmark"></i>', cor: f.justificada ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Falta a ${f.disciplina} (${f.horas}h)`, desc: f.justificada ? `Justificada` : `Falta registada.` }); });
    const oS = await getDocs(collection(db, "utilizadores", myUserId, "ocorrencias")); oS.forEach(d => { const o = d.data(); ev.push({ time: o.timestamp, cat: 'comportamento', icon: o.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>', cor: o.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Registo Disciplinar`, desc: `<strong style="color:var(--text-light);">${o.titulo}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">${o.descricao || ''}</span>` }); });
    const pS = await getDocs(collection(db, "utilizadores", myUserId, "prhfs")); pS.forEach(d => { const p = d.data(); ev.push({ time: new Date(p.dataRegisto || Date.now()).getTime(), cat: 'prhfs', icon: '<i class="fa-solid fa-book-medical"></i>', cor: 'var(--warning-yellow)', titulo: `Plano de Recuperação Criado`, desc: `${p.disciplina} (Mod. ${p.modulo})` }); });
    ev = ev.filter(e => !isNaN(e.time)); ev.sort((a,b) => b.time - a.time); return ev;
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

async function carregarFaltasAluno() {
    try {
        const faltasDb = await getDocs(collection(db, "utilizadores", myUserId, "faltas")); let faltasPorDisc = {};
        faltasDb.forEach(d => { const f = d.data(); if(!f.justificada) { if(!faltasPorDisc[f.disciplina]) faltasPorDisc[f.disciplina] = {}; if(!faltasPorDisc[f.disciplina][f.modulo]) faltasPorDisc[f.disciplina][f.modulo] = []; faltasPorDisc[f.disciplina][f.modulo].push(f); } });

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
                        if(sumFaltasMod > limiteHoras) { corBarra = 'var(--danger-red)'; txtRisco = '⚠️ Reprovado'; }
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
        const prhfsDb = await getDocs(collection(db, "utilizadores", myUserId, "prhfs")); let prhfsArr = []; prhfsDb.forEach(d => { const p = d.data(); if(p.status !== 'concluida') prhfsArr.push({id: d.id, ...p}); });
        if(prhfsArr.length === 0) { document.getElementById('aluno-caderneta-content').innerHTML = getEmptyState('Não tens Planos de Recuperação.', 'fa-book-medical'); return; }
        prhfsArr.sort((a,b) => new Date(a.prazo) - new Date(b.prazo)); let html = '';
        prhfsArr.forEach(p => {
            const isUrgente = p.moduloTerminado === true || p.moduloTerminado === "true"; const cor = isUrgente ? 'var(--danger-red)' : 'var(--warning-yellow)'; const txtSt = isUrgente ? 'URGENTE (Mód. Terminado)' : 'EM CURSO';
            const hPres = Number(p.horasPresenciais || 0);
            let btn = ''; if(p.status !== 'concluida' && hPres > 0) { btn = `<button class="primary-btn small-btn" style="width:100%; background-color:${cor}; color:${cor === 'var(--warning-yellow)' ? 'black' : 'white'};" onclick="window.abrirAcaoPrhf('${p.id}', '${p.disciplina}', '${p.modulo}', '${p.prazo}')"><i class="fa-regular fa-calendar"></i> Sugerir Horário</button>`; }
            html += `<div class="card" style="margin-bottom:15px; border-left: 4px solid ${cor};"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong style="font-size: 1.1rem; color:var(--text-light);">${p.disciplina} (Mod. ${p.modulo})</strong><span style="color:${cor}; font-size:0.75rem; font-weight:bold;">${txtSt}</span></div><p style="font-size:0.85rem; color:var(--text-light); margin-bottom:10px;">${p.descricao}</p><div style="font-size:0.8rem; margin-bottom: 15px; border-top:1px dashed #333; padding-top:10px; color:var(--text-light);">Data Limite: <strong style="color:${cor};">${p.prazo.split('-').reverse().join('/')}</strong><br>Horas Presenciais: <strong>${hPres}h</strong></div>${btn}</div>`;
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
        else { ordemDisciplinas.forEach(disc => { const cm = dR.disciplinas && dR.disciplinas[disc] ? dR.disciplinas[disc] : '<span style="color:var(--text-muted);">Sem comentário</span>'; cH += `<div class="card" style="margin-bottom:0; border-left:4px solid var(--primary-green); padding:15px;"><h4 style="margin-bottom:8px; color:var(--text-light); font-size:1rem;">${disc}</h4><p style="color:var(--text-light); font-size:0.9rem; line-height:1.4; margin:0;">${cm}</p></div>`; }); }
        const gl = dR.global || '<span style="color:var(--text-muted);">Sem observações globais.</span>'; cH += `<div class="card" style="margin-top:15px; border:1px solid var(--warning-yellow); background:rgba(255,204,0,0.05); padding:15px;"><h3 style="color:var(--warning-yellow); margin-bottom:10px; font-size:1.1rem;"><i class="fa-solid fa-comment-dots"></i> Observações Globais</h3><p style="color:var(--text-light); font-size:0.95rem; line-height:1.5; margin:0;">${gl}</p></div></div>`;
        document.getElementById('reuniao-content-area').innerHTML = cH;
    } catch(e) {}
}

async function carregarAgendaAlunoLista() {
    const sC = document.getElementById('aluno-agenda-content'); sC.innerHTML = '<p class="text-muted center">A sincronizar agenda...</p>'; if(!minhaTurma) { sC.innerHTML = getEmptyState('Sem turma configurada.', 'fa-calendar-xmark'); return; }
    
    // Ler checkboxes com fallback (caso o DOM não as encontre)
    const elT = document.getElementById('aluno-filtro-agenda-testes');
    const elTr = document.getElementById('aluno-filtro-agenda-trabalhos');
    const elO = document.getElementById('aluno-filtro-agenda-outros');
    const mT = elT ? elT.checked : true; 
    const mTr = elTr ? elTr.checked : true; 
    const mO = elO ? elO.checked : true;
    
    try {
        const evDb = await getDocs(collection(db, "turmas", minhaTurma, "eventos")); 
        if(evDb.empty) { sC.innerHTML = getEmptyState('Sem eventos na escola.', 'fa-calendar-xmark'); return; }
        
        let evs = []; 
        evDb.forEach(d => { 
            const e = d.data(); 
            let bgC = '#8b5cf6'; let txtT = 'Evento'; 
            
            if(e.tipo === 'teste' || e.tipo === 'avaliacao') { 
                if(mT) { bgC = '#f59e0b'; txtT = 'Avaliação'; evs.push({...e, cor: bgC, txt: txtT}); } 
            } else if(e.tipo === 'trabalho' || e.tipo === 'entrega') { 
                if(mTr) { bgC = '#00d2ff'; txtT = 'Entrega'; evs.push({...e, cor: bgC, txt: txtT}); } 
            } else { 
                if(mO) evs.push({...e, cor: bgC, txt: txtT}); 
            } 
        });
        
        if(evs.length === 0) { sC.innerHTML = getEmptyState('Nenhum evento com os filtros atuais.', 'fa-filter'); return; }
        
        const hj = new Date().toISOString().split('T')[0]; 
        const fut = evs.filter(e => (e.data || '') >= hj).sort((a,b) => (a.data || '').localeCompare(b.data || '')); 
        const pas = evs.filter(e => (e.data || '') < hj).sort((a,b) => (b.data || '').localeCompare(a.data || ''));
        const mA = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; 
        let html = '';
        
        const rEv = (ev) => { if (!ev.data) return ''; const dp = ev.data.split('-'); const mes = mA[parseInt(dp[1])-1]; return `<div class="calendar-event-card" style="border-left-color:${ev.cor}; margin-bottom:10px;"><div class="calendar-date-box"><span class="day">${dp[2]}</span><span class="month" style="color:${ev.cor};">${mes}</span></div><div class="calendar-info"><h4 style="margin:0; color:var(--text-light);">${ev.titulo}</h4><span style="font-size:0.8rem; color:var(--text-muted);">${(ev.txt||'evento').toUpperCase()}</span></div></div>`; };
        
        if(fut.length > 0) fut.forEach(e => html += rEv(e)); else html += '<p class="text-muted center">Sem eventos futuros.</p>';
        if(pas.length > 0) { html += '<div class="calendar-divider" style="margin-top:20px;"><span>Passados</span></div>'; pas.forEach(e => html += rEv(e)); } 
        sC.innerHTML = html;
    } catch(e) { sC.innerHTML = getEmptyState('Erro ao sincronizar.', 'fa-triangle-exclamation'); }
}

async function carregarHorarioAluno() {
    const sC = document.getElementById('aluno-horario-content'); if(!sC) return;
    sC.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A gerar horário...</p>'; 
    if(!minhaTurma) { sC.innerHTML = getEmptyState('Sem turma configurada.', 'fa-calendar-xmark'); return; }
    
    try {
        const dS = await getDoc(doc(db, "turmas", minhaTurma)); 
        let hb = {}; if(dS.exists() && dS.data().horario) hb = dS.data().horario;
        
        // CORREÇÃO DO BUG: Recolhe profs SEM precisar do Firebase Index
        let profsCache = {};
        const pSnap = await getDocs(query(collection(db, "utilizadores"), where("papel", "==", "professor")));
        pSnap.forEach(d => { 
            const profData = d.data(); 
            // Só guarda na memória se o professor der aulas a esta turma
            if (profData.turmas && profData.turmas.includes(minhaTurma) && profData.disciplinas) { 
                profData.disciplinas.forEach(dsc => { 
                    profsCache[dsc] = profData.nome ? profData.nome.split(' ')[0] : 'Desconhecido'; 
                }); 
            } 
        });

        const bK = ['1', '2', '3', '4', '1300', '5', '6', '7']; const bT = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' }; const dM = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']; const fDt = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
        
        if (ahModo === 'dia') {
            let tD = new Date(); tD.setDate(tD.getDate() + ahDOff); const hd = document.getElementById('aluno-horario-display'); if(hd) hd.innerText = `${dM[tD.getDay()]}, ${fDt(tD)}`;
            let h = ''; let tAD = false; const dSStr = `${tD.getFullYear()}-${String(tD.getMonth()+1).padStart(2,'0')}-${String(tD.getDate()).padStart(2,'0')}`;
            
            bK.forEach(b => { 
                const dc = hb[`${dSStr}_${b}`]; 
                if(dc) { 
                    const sty = getCorEspecial(dc); 
                    const profNome = profsCache[dc] ? `Prof. ${profsCache[dc]}` : 'Prof. A Atribuir';
                    h += `<div class="horario-list-item" style="border-left-color:${sty.c}; background-color:${sty.bg};"><div class="horario-time-col">${bT[b]}</div><div class="horario-disc-col"><div class="horario-disc-name">${dc}</div><div class="horario-prof" style="font-size:0.75rem; color:#888; margin-top:4px;">${profNome}</div></div></div>`; 
                    tAD = true; 
                } 
            });
            sC.innerHTML = tAD ? h : getEmptyState('Sem aulas neste dia.', 'fa-mug-hot');
        } else {
            let dT = new Date(); dT.setDate(dT.getDate() + (ahSOff * 7)); dT.setDate(dT.getDate() - (dT.getDay() === 0 ? 6 : dT.getDay() - 1)); let dE = new Date(dT); dE.setDate(dE.getDate() + 4);
            const hd = document.getElementById('aluno-horario-display'); if(hd) hd.innerText = `${fDt(dT)} a ${fDt(dE)}`;
            
            let h = '<div class="horario-grid" style="min-width:100%;"><div class="horario-header"></div>'; let dI = new Date(dT);
            ['SEG','TER','QUA','QUI','SEX'].forEach(d => { h += `<div class="horario-header">${d}<span>${fDt(dI)}</span></div>`; dI.setDate(dI.getDate()+1); });
            
            bK.forEach(b => { 
                h += `<div class="horario-time">${bT[b]}</div>`; dI = new Date(dT); 
                for(let i=0; i<5; i++) { 
                    const dSStr = `${dI.getFullYear()}-${String(dI.getMonth()+1).padStart(2,'0')}-${String(dI.getDate()).padStart(2,'0')}`; const dc = hb[`${dSStr}_${b}`]; 
                    if(dc) { const sty = getCorEspecial(dc); h += `<div class="horario-slot filled" style="border-color:${sty.c}; background-color:${sty.bg};"><strong>${dc}</strong></div>`; } 
                    else { h += `<div class="horario-slot"></div>`; }
                    dI.setDate(dI.getDate()+1); 
                } 
            });
            sC.innerHTML = h + '</div>';
        }
    } catch(e) { sC.innerHTML = '<p class="text-danger center">Erro a gerar o horário.</p>'; }
}

// ==========================================
// RANKINGS, FORUNS, E MATERIAIS
// ==========================================
async function carregarRankingTurma() {
    const c = document.getElementById('ranking-turma-container'); if(!minhaTurma) { c.innerHTML = '<p class="text-muted center">Sem turma atribuída.</p>'; return; }
    try {
        const snap = await getDocs(query(collection(db, "utilizadores"), where("papel", "==", "aluno")));
        let alunosTurma = []; let academiasXP = { estrategas: 0, embaixadores: 0, exploradores: 0, visionarios: 0 };
        
        snap.forEach(d => {
            const al = {id: d.id, ...d.data()};
            if(al.academia && academiasXP[al.academia] !== undefined) { academiasXP[al.academia] += (al.xp || 0); }
            if(al.turma === minhaTurma) { alunosTurma.push(al); }
        });
        alunosTurma.sort((a,b) => (b.xp || 0) - (a.xp || 0));
        
        let hAcad = `<div style="display:flex; justify-content:space-around; margin-bottom:20px; text-align:center; background:rgba(0,0,0,0.2); padding:15px; border-radius:12px;">`;
        const orderAcad = Object.keys(academiasXP).sort((a,b) => academiasXP[b] - academiasXP[a]);
        
        orderAcad.forEach((ac) => {
            const acData = ACADEMIAS_INFO[ac];
            if(acData) { // Escudo de proteção adicionado
                const shortName = acData.nome.replace('Academia dos ', '');
                hAcad += `<div><i class="fa-solid ${acData.icon}" style="font-size:1.8rem; color:${acData.cor}; margin-bottom:8px; display:block;"></i><strong style="color:var(--text-light); font-size:0.75rem;">${shortName}</strong><br><span style="color:var(--warning-yellow); font-size:0.9rem; font-weight:bold;">${academiasXP[ac]} XP</span></div>`;
            }
        });
        hAcad += `</div><h4 style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; margin-bottom:10px;">🏆 Top 10</h4>`;
        
        let hAl = '';
        alunosTurma.slice(0, 10).forEach((al, idx) => {
            let cor = 'var(--text-muted)'; 
            let iconePos = `${idx+1}`;
            if(idx === 0) { cor = '#ffd700'; iconePos = '<i class="fa-solid fa-crown" style="font-size:1.4rem;"></i>'; } 
            else if(idx === 1) { cor = '#c0c0c0'; iconePos = '<i class="fa-solid fa-medal" style="font-size:1.3rem;"></i>'; } 
            else if(idx === 2) { cor = '#cd7f32'; iconePos = '<i class="fa-solid fa-award" style="font-size:1.3rem;"></i>'; }
            
            hAl += `<div style="display:flex; align-items:center; gap:10px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:8px; border-left:3px solid ${cor};">
                        <span style="font-weight:bold; font-size:1.2rem; color:${cor}; width:35px; text-align:center; display:inline-block;">${iconePos}</span>
                        <img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=00cc88&color=fff`}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;">
                        <div style="flex:1;">
                            <strong style="font-size:0.95rem; color:var(--text-light);">${al.nome.split(' ')[0]} ${al.nome.split(' ').pop()}</strong><br>
                            <span style="font-size:0.7rem; color:var(--text-muted);">${al.academia && ACADEMIAS_INFO[al.academia] ? ACADEMIAS_INFO[al.academia].nome.replace('Academia dos ','') : 'S/ Academia'}</span>
                        </div>
                        <span style="font-weight:bold; color:var(--primary-green); font-size:0.9rem;">${al.xp || 0} XP</span>
                    </div>`;
        });
        c.innerHTML = hAcad + (hAl === '' ? '<p class="text-muted center">Ainda não há alunos com XP na tua turma.</p>' : hAl);
    } catch(e) { c.innerHTML = '<p class="text-danger center">Erro ao carregar ranking.</p>'; }
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

function iniciarChatAluno(fId) {
    const chatContainer = document.getElementById('aluno-chat-messages-container'); if(!chatContainer) return;
    chatContainer.innerHTML = ''; if(chatUnsubscribeAluno) chatUnsubscribeAluno();
    chatUnsubscribeAluno = onSnapshot(query(collection(db, "turmas", minhaTurma, "foruns", fId, "mensagens"), orderBy("timestamp")), (snapshot) => {
        let html = ''; 
        snapshot.forEach(doc => { 
            const msg = doc.data(); const isMe = msg.remetente === myUserName || msg.autor === myUserName; const remetenteNome = msg.remetente || msg.autor || 'Desconhecido'; const isProf = msg.papel === 'professor';
            const d = new Date(msg.timestamp); const hora = isNaN(d.getTime()) ? '' : `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`;
            if (isMe) { html += `<div class="chat-bubble student"><strong>Eu</strong><br>${msg.texto}<span class="chat-meta">${hora}</span></div>`; } 
            else if (isProf) { html += `<div class="chat-bubble admin"><strong>Prof. ${remetenteNome}</strong><br>${msg.texto}<span class="chat-meta">${hora}</span></div>`; } 
            else { html += `<div class="chat-bubble student"><strong style="color:var(--primary-green);">${remetenteNome}</strong><br>${msg.texto}<span class="chat-meta">${hora}</span></div>`; }
        });
        if (html === '') html = getEmptyState('Sê o primeiro a falar na tua turma!', 'fa-comments');
        chatContainer.innerHTML = html; setTimeout(() => { chatContainer.scrollTop = chatContainer.scrollHeight; }, 100);
    });
}

async function carregarMateriaisAluno() {
    const c = document.getElementById('aluno-lista-materiais-container'); c.innerHTML = '<p class="text-muted center">A carregar materiais...</p>'; if(!minhaTurma) return;
    try {
        const r = await getDocs(query(collection(db, "turmas", minhaTurma, "sumarios"))); 
        if(r.empty) { c.innerHTML = getEmptyState('Nenhum material publicado.', 'fa-book-open'); return; }
        
        let sum = []; let dU = new Set(); r.forEach(d => { const dt = d.data(); sum.push({id: d.id, ...dt}); dU.add(dt.disciplina); });
        const fS = document.getElementById('aluno-filtro-materiais-disc'); 
        if (fS && fS.options.length <= 1) { let oH = '<option value="">Todas as Disciplinas</option>'; Array.from(dU).sort().forEach(dc => oH += `<option value="${dc}">${dc}</option>`); fS.innerHTML = oH; }
        
        const fA = fS ? fS.value : ""; if(fA) sum = sum.filter(s => s.disciplina === fA); 
        sum.sort((a,b) => b.timestamp - a.timestamp || (b.data || "").localeCompare(a.data || "")); 
        
        if(sum.length === 0) { c.innerHTML = getEmptyState('Sem materiais para esta disciplina.', 'fa-filter'); return; }
        
        let html = ''; 
        sum.forEach(s => { 
            const ficheiro = s.ficheiroBase64 || s.anexoBase64; const nomeFicheiro = s.anexoNome || 'Material_Anexo';
            const aB = ficheiro ? `<a href="${ficheiro}" download="${nomeFicheiro}" class="primary-btn small-btn" style="display:block; margin-top:15px; width:100%; text-align:center; padding:10px 12px; background-color:#0099ff; color:white;"><i class="fa-solid fa-download"></i> Baixar Anexo</a>` : ''; 
            html += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #0099ff;"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">${s.data} | ${s.disciplina} | Prof. ${s.professor || ''}</span><h4 style="margin:5px 0; color:var(--text-light);">${s.titulo}</h4>${s.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">${s.descricao}</p>` : ''}</div></div>${aB}</div>`; 
        }); 
        c.innerHTML = html;
    } catch(e) { c.innerHTML = '<p class="text-danger center">Erro ao carregar os dados.</p>'; }
}

async function pedirPermissaoNotificacoes() { try { const p = await Notification.requestPermission(); if(p==='granted') { const r = await navigator.serviceWorker.register('./firebase-messaging-sw.js'); const t = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: r }); if(t) await updateDoc(doc(db, "utilizadores", myUserId), { tokenNotificacao: t }); } } catch(e){} }
if(typeof onMessage !== "undefined" && messaging) onMessage(messaging, p => alert(`NOVA NOTIFICAÇÃO:\n${p.notification.title}\n${p.notification.body}`));
setTimeout(() => { if(myUserId) pedirPermissaoNotificacoes(); }, 4000);
