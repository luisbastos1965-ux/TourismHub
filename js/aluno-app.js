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
// NÍVEIS PROFISSIONAIS (12 Níveis para 3 anos) E BADGES (15)
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
    { id: "b4", nome: "Boa Comunicação", icon: "fa-microphone", reqCom: 100 },
    { id: "b5", nome: "Orador Nato", icon: "fa-bullhorn", reqCom: 500 },
    { id: "b6", nome: "Ideia Brilhante", icon: "fa-lightbulb", reqCri: 100 },
    { id: "b7", nome: "Mente Inovadora", icon: "fa-wand-magic-sparkles", reqCri: 500 },
    { id: "b8", nome: "Guia", icon: "fa-compass", reqLid: 100 },
    { id: "b9", nome: "Líder Natural", icon: "fa-crown", reqLid: 500 },
    { id: "b10", nome: "Organizado", icon: "fa-list-check", reqOrg: 100 },
    { id: "b11", nome: "Mestre Estratega", icon: "fa-chess", reqOrg: 500 },
    { id: "b12", nome: "Colega 5 Estrelas", icon: "fa-handshake-angle", reqXp: 1500 },
    { id: "b13", nome: "Imparável", icon: "fa-fire-flame-curved", reqXp: 8000 },
    { id: "b14", nome: "Coração de Ouro", icon: "fa-heart", reqCom: 1000 },
    { id: "b15", nome: "Mestre do Turismo", icon: "fa-plane-departure", reqXp: 15000 }
];

const ACADEMIAS_INFO = {
    'estrategas': { nome: 'Academia dos Estrategas', cor: '#10b981', icon: 'fa-chess-knight', desc: 'Mestres do planeamento. Manténs a calma sob pressão.' },
    'embaixadores': { nome: 'Academia dos Embaixadores', cor: '#0ea5e9', icon: 'fa-handshake', desc: 'A alma da hospitalidade! És a primeira cara que os turistas veem.' },
    'exploradores': { nome: 'Academia dos Exploradores', cor: '#f97316', icon: 'fa-compass', desc: 'Os guias de ação! Gostas de estar no terreno, não tens medo de liderar.' },
    'visionarios': { nome: 'Academia dos Visionários', cor: '#8b5cf6', icon: 'fa-lightbulb', desc: 'Os criativos do Turismo. Pensas "fora da caixa".' }
};

const matrizAmbos = {
    "Sociocultural": { "PORT": {"1":33,"2":34}, "ING": {"1":27,"2":24}, "AI": {"1":36}, "EF": {"1":10}, "TIC": {"1":25} },
    "Científica": { "GEO": {"1":33}, "HCA": {"1":20}, "MAT": {"1":33} }
};
const matrizAntigoTecnica = { "CF": {"1":24}, "TIAT": {"1":27}, "TCAT": {"1":33}, "OTET": {"1":24} };
const matrizNovoTecnica = { "AET": {"UC00038":20}, "OGOT": {"UC03629":20}, "CMET": {"UC00034":30}, "LNTT": {"UC00044":50} };

function getMatriz() {
    const anoMatch = minhaTurma ? minhaTurma.match(/\d+/) : null; const ano = anoMatch ? parseInt(anoMatch[0]) : 10;
    let m = JSON.parse(JSON.stringify(matrizAmbos)); m["Técnica"] = (ano >= 11) ? matrizAntigoTecnica : matrizNovoTecnica; return m;
}

function obterDisciplinasDoAno() {
    const anoMatch = minhaTurma ? minhaTurma.match(/\d+/) : null; const ano = anoMatch ? parseInt(anoMatch[0]) : 10;
    const base = { 10: ["PORT", "ING", "AI", "EF", "TIC", "GEO", "HCA", "MAT"], 11: ["PORT", "ING", "AI", "EF", "GEO", "HCA"], 12: ["PORT", "ING", "EF", "GEO", "HCA"] };
    const tecAntigo = { 10: ["CF", "TIAT", "TCAT", "OTET"], 11: ["CF", "TIAT", "TCAT", "OTET"], 12: ["TIAT", "OTET"] };
    const tecNovo = { 10: ["AET", "OGOT", "CMET", "LNTT"], 11: ["AET", "OGOT", "CMET", "LNTT"], 12: ["AET", "OGOT", "CMET"] };
    let arr = [...(base[ano] || base[10])]; if (ano >= 11) arr = [...arr, ...(tecAntigo[ano] || tecAntigo[11])]; else arr = [...arr, ...(tecNovo[ano] || tecNovo[10])]; return arr;
}

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

                const objSelect = document.getElementById('obj-disciplina'); if(objSelect) objSelect.innerHTML = obterDisciplinasDoAno().map(dc => `<option value="${dc}">${dc}</option>`).join('');

                const turmaAno = parseInt((minhaTurma || "").match(/\d+/)?.[0]) || d.ano || 10;
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
    const missoes = [
        { id: "m1", title: "Atendimento Impossível", desc: "Apresenta uma solução profissional para um turista sem reserva.", xp: 100, tag: "Embaixadores", cor: "#0ea5e9" },
        { id: "m2", title: "Operação Turismo", desc: "Organiza uma atividade desde o planeamento até à execução.", xp: 150, tag: "Estrategas", cor: "#10b981" }
    ];
    let html = '';
    missoes.forEach(m => { 
        html += `<div class="card mission-card" id="mission-card-${m.id}" style="border-left: 4px solid ${m.cor}; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center;"><div style="flex:1;"><span style="font-size:0.7rem; color:${m.cor}; font-weight:bold; text-transform:uppercase; border:1px solid ${m.cor}; padding:2px 6px; border-radius:12px;">Missão: ${m.tag}</span><h4 style="margin:5px 0 3px 0; color:var(--text-light); font-size:1rem;">${m.title}</h4><p style="font-size:0.85rem; color:var(--text-muted); margin:0;">${m.desc}</p></div><div style="text-align:right; margin-left:10px;"><strong style="color:var(--warning-yellow); font-size:1.1rem;">+${m.xp} XP</strong><br><button class="secondary-btn small-btn btn-accept-mission" style="margin-top:5px; border-color:var(--text-muted); color:var(--text-muted); cursor:pointer;">Aceitar</button></div></div>`; 
    });
    cont.innerHTML = html;
    document.querySelectorAll('.btn-accept-mission').forEach(btn => { btn.addEventListener('click', (e) => { const b = e.currentTarget; const card = b.closest('.mission-card'); card.classList.add('accepted'); b.innerHTML = '<i class="fa-solid fa-check"></i> Aceite'; b.style.backgroundColor = 'var(--success-green)'; b.style.color = '#fff'; b.style.borderColor = 'var(--success-green)'; b.disabled = true; }); });
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

        let html = `<button id="btn-pauta-global" class="primary-btn" style="margin-bottom: 20px; background-color: transparent; border: 1px solid var(--primary-green); color: var(--primary-green);"><i class="fa-solid fa-table-list"></i> Pauta Global</button>`;
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
        
        // Pauta Global Modal Bindings
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

// ==========================================
// RANKINGS, METAS PESSOAIS E RESTANTES
// ==========================================
async function carregarRankingTurma() {
    const c = document.getElementById('ranking-turma-container'); if(!minhaTurma) { c.innerHTML = '<p class="text-muted center">Sem turma atribuída.</p>'; return; }
    try {
        const snap = await getDocs(query(collection(db, "utilizadores"), where("papel", "==", "aluno"))); let alunosTurma = []; let academiasXP = { estrategas: 0, embaixadores: 0, exploradores: 0, visionarios: 0 };
        snap.forEach(d => { const al = {id: d.id, ...d.data()}; if(al.academia && academiasXP[al.academia] !== undefined) { academiasXP[al.academia] += (al.xp || 0); } if(al.turma === minhaTurma) { alunosTurma.push(al); } });
        alunosTurma.sort((a,b) => (b.xp || 0) - (a.xp || 0));
        
        let hAcad = `<div style="display:flex; justify-content:space-around; flex-wrap: wrap; gap:10px; margin-bottom:20px; text-align:center; background:rgba(0,0,0,0.2); padding:15px; border-radius:12px;">`;
        Object.keys(academiasXP).sort((a,b) => academiasXP[b] - academiasXP[a]).forEach((ac) => {
            const acData = ACADEMIAS_INFO[ac]; const shortName = acData.nome.replace('Academia dos ', '');
            hAcad += `<div><i class="fa-solid ${acData.icon}" style="font-size:2rem; color:${acData.cor}; margin-bottom:8px; display:block;"></i><strong style="color:var(--text-light); font-size:0.8rem;">${shortName}</strong><br><span style="color:var(--warning-yellow); font-size:0.9rem; font-weight:bold;">${academiasXP[ac]} XP</span></div>`;
        });
        hAcad += `</div><h4 style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; margin-bottom:10px;">🏆 Top 10 (A Tua Turma)</h4>`;
        
        let hAl = '';
        alunosTurma.slice(0, 10).forEach((al, idx) => {
            let cor = 'var(--text-muted)'; let iconePos = `${idx+1}`;
            if(idx === 0) { cor = '#ffd700'; iconePos = '<i class="fa-solid fa-crown" style="font-size:1.4rem;"></i>'; } else if(idx === 1) { cor = '#c0c0c0'; iconePos = '<i class="fa-solid fa-medal" style="font-size:1.3rem;"></i>'; } else if(idx === 2) { cor = '#cd7f32'; iconePos = '<i class="fa-solid fa-award" style="font-size:1.3rem;"></i>'; }
            hAl += `<div style="display:flex; align-items:center; gap:10px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:8px; border-left:3px solid ${cor};"><span style="font-weight:bold; font-size:1.2rem; color:${cor}; width:35px; text-align:center; display:inline-block;">${iconePos}</span><img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=00cc88&color=fff`}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;"><div style="flex:1;"><strong style="font-size:0.95rem; color:var(--text-light);">${al.nome.split(' ')[0]} ${al.nome.split(' ').pop()}</strong><br><span style="font-size:0.7rem; color:var(--text-muted);">${al.academia ? ACADEMIAS_INFO[al.academia].nome.replace('Academia dos ','') : 'S/ Academia'}</span></div><span style="font-weight:bold; color:var(--primary-green); font-size:0.9rem;">${al.xp || 0} XP</span></div>`;
        });
        c.innerHTML = hAcad + (hAl === '' ? '<p class="text-muted center">Ainda não há alunos com XP na tua turma.</p>' : hAl);
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
                // Fica a base da lógica de Assiduidade para automação futura
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

bindClick('btn-add-objetivo', async () => {
    const tipo = document.getElementById('obj-tipo').value; let data = { tipo: tipo, concluido: false, timestamp: Date.now() };
    if(tipo === 'nota') {
        data.disciplina = document.getElementById('obj-disciplina').value; data.modulo = document.getElementById('obj-modulo').value; data.notaAlvo = document.getElementById('obj-nota-alvo').value;
        if(!data.disciplina || !data.modulo || !data.notaAlvo) return alert("Preenche todos os campos."); data.desc = `Tirar ${data.notaAlvo} a ${data.disciplina} no Mod. ${data.modulo}`;
    } else if (tipo === 'prhf') { 
        const pSnap = await getDocs(collection(db, "utilizadores", myUserId, "prhfs")); let c = 0; pSnap.forEach(p => { if(p.data().status === 'concluida') c++; }); data.targetCount = c + 1; data.desc = `Concluir +1 Plano de Recuperação (PRHF)`;
    } else if (tipo === 'reconhecimento') {
        const rSnap = await getDocs(query(collection(db, "utilizadores", myUserId, "ocorrencias"), where("tipo", "==", "positiva"))); data.targetCount = rSnap.size + 1; data.desc = `Receber +1 Registo Positivo do Professor`;
    } else if (tipo === 'assiduidade') {
        data.desc = `Manter assiduidade sem faltas injustificadas.`;
    }
    try { await addDoc(collection(db, "utilizadores", myUserId, "objetivos"), data); document.getElementById('obj-nota-alvo').value = ''; carregarObjetivosPessoais(); } catch(err) {}
});

bindChange('obj-tipo', async (e) => { const v = e.target.value; document.getElementById('obj-setup-nota').style.display = v === 'nota' ? 'flex' : 'none'; });

// ==========================================
// FUNÇÕES DE BOTÕES DE DELEGAÇÃO PRINCIPAL (FALHAS, AGENDA, HORÁRIOS)
// ==========================================
document.body.addEventListener('click', async (e) => {
    if(e.target.closest('.btn-delete-objetivo')) { e.stopPropagation(); pendingDeleteObjetivoId = e.target.closest('.btn-delete-objetivo').getAttribute('data-id'); document.getElementById('modal-confirm-delete-objetivo').style.display = 'flex'; }
    if(e.target.closest('#btn-cancel-delete-objetivo')) { document.getElementById('modal-confirm-delete-objetivo').style.display = 'none'; pendingDeleteObjetivoId = null; }
    if(e.target.closest('#btn-confirm-delete-objetivo')) {
        if(pendingDeleteObjetivoId) { const btn = e.target.closest('#btn-confirm-delete-objetivo'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; try { await deleteDoc(doc(db, "utilizadores", myUserId, "objetivos", pendingDeleteObjetivoId)); document.getElementById('modal-confirm-delete-objetivo').style.display = 'none'; carregarObjetivosPessoais(); } catch(err){} finally { btn.innerHTML = 'Sim, Apagar'; btn.disabled = false; pendingDeleteObjetivoId = null; } }
    }
    
    const tChip = e.target.closest('#timeline-filtros .filter-chip'); if(tChip) { document.querySelectorAll('#timeline-filtros .filter-chip').forEach(c => c.classList.remove('active')); tChip.classList.add('active'); window.timelineFilterCat = tChip.getAttribute('data-cat'); carregarTimelineAluno(); }
    const nChip = e.target.closest('#notificacoes-filtros .filter-chip'); if(nChip) { document.querySelectorAll('#notificacoes-filtros .filter-chip').forEach(c => c.classList.remove('active')); nChip.classList.add('active'); window.notifFilterCat = nChip.getAttribute('data-cat'); carregarNotificacoesAluno(); }

    if(e.target.closest('#tab-aluno-eventos')) { document.getElementById('tab-aluno-eventos').classList.add('active'); document.getElementById('tab-aluno-horario').classList.remove('active'); document.getElementById('aluno-agenda-filtros').style.display = 'flex'; document.getElementById('aluno-horario-container').style.display = 'none'; carregarAgendaAlunoLista(); }
    if(e.target.closest('#tab-aluno-horario')) { document.getElementById('tab-aluno-horario').classList.add('active'); document.getElementById('tab-aluno-eventos').classList.remove('active'); document.getElementById('aluno-agenda-filtros').style.display = 'none'; document.getElementById('aluno-horario-container').style.display = 'block'; carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-horario-dia')) { ahModo = 'dia'; document.getElementById('btn-aluno-horario-dia').classList.add('active'); document.getElementById('btn-aluno-horario-grelha').classList.remove('active'); carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-horario-grelha')) { ahModo = 'grelha'; document.getElementById('btn-aluno-horario-grelha').classList.add('active'); document.getElementById('btn-aluno-horario-dia').classList.remove('active'); carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-prev-horario')) { if(ahModo === 'dia') ahDOff--; else ahSOff--; carregarHorarioAluno(); }
    if(e.target.closest('#btn-aluno-next-horario')) { if(ahModo === 'dia') ahDOff++; else ahSOff++; carregarHorarioAluno(); }

    if(e.target.closest('#btn-create-chat-aluno')) {
        document.getElementById('modal-criar-forum').style.display = 'flex'; const cCont = document.getElementById('lista-colegas-forum'); cCont.innerHTML = '<p class="text-muted center">A procurar colegas...</p>';
        try { const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", minhaTurma))); let cH = ''; cS.forEach(d => { if(d.data().papel === 'aluno' && d.id !== myUserId) { cH += `<label style="display:flex; align-items:center; gap:10px; color:white; font-size:0.9rem; padding:8px 0; cursor:pointer;"><input type="checkbox" class="colegas-check" value="${d.id}" style="width:18px;height:18px;accent-color:var(--primary-green);"> ${d.data().nome}</label>`; } }); cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Ainda és o único aluno registado nesta turma.</p>' : cH; } catch(err) { cCont.innerHTML = '<p class="text-danger center">Erro ao listar turma.</p>'; }
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
        if(pendingDeleteChatId) { const btn = e.target.closest('#btn-confirm-delete-chat'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; try { await deleteDoc(doc(db, "turmas", minhaTurma, "foruns", pendingDeleteChatId)); document.getElementById('modal-confirm-delete-chat').style.display = 'none'; carregarForuns(); } catch(err){} finally { btn.innerHTML = 'Sim, Apagar'; btn.disabled = false; pendingDeleteChatId = null; } }
    }

    const cardF = e.target.closest('.canal-card');
    if(cardF && !e.target.closest('.btn-delete-chat')) { alunoForumAtivoId = cardF.getAttribute('data-id'); document.getElementById('aluno-chat-active-title').innerText = cardF.getAttribute('data-nome'); document.getElementById('aluno-forum-channel-list').style.display = 'none'; document.getElementById('btn-create-chat-aluno').style.display = 'none'; document.getElementById('aluno-forum-chat-view').style.display = 'flex'; iniciarChatAluno(alunoForumAtivoId); }
    if(e.target.closest('#btn-aluno-voltar-canais')) { document.getElementById('aluno-forum-chat-view').style.display = 'none'; document.getElementById('aluno-forum-channel-list').style.display = 'block'; document.getElementById('btn-create-chat-aluno').style.display = 'block'; }
    if(e.target.closest('#btn-aluno-send-msg')) { const inp = document.getElementById('aluno-input-forum-msg'); const t = inp.value.trim(); if(!t || !alunoForumAtivoId) return; try { await addDoc(collection(db, "turmas", minhaTurma, "foruns", alunoForumAtivoId, "mensagens"), { remetente: myUserName, texto: t, timestamp: Date.now() }); inp.value = ''; } catch(err) {} }
});

bindChange('aluno-filtro-agenda-testes', carregarAgendaAlunoLista); bindChange('aluno-filtro-agenda-trabalhos', carregarAgendaAlunoLista); bindChange('aluno-filtro-agenda-outros', carregarAgendaAlunoLista);

async function carregarAgendaAlunoLista() {
    const sC = document.getElementById('aluno-agenda-content'); if(!sC) return;
    sC.innerHTML = '<p class="text-muted center">A sincronizar agenda...</p>'; if(!minhaTurma) { sC.innerHTML = getEmptyState('Sem turma configurada.', 'fa-calendar-xmark'); return; }
    const elT = document.getElementById('aluno-filtro-agenda-testes'); const elTr = document.getElementById('aluno-filtro-agenda-trabalhos'); const elO = document.getElementById('aluno-filtro-agenda-outros');
    const mT = elT ? elT.checked : true; const mTr = elTr ? elTr.checked : true; const mO = elO ? elO.checked : true;
    try {
        const evDb = await getDocs(collection(db, "turmas", minhaTurma, "eventos")); if(evDb.empty) { sC.innerHTML = getEmptyState('Sem eventos na escola.', 'fa-calendar-xmark'); return; }
        let evs = []; evDb.forEach(d => { const e = d.data(); let bgC = '#8b5cf6'; let txtT = 'Evento'; if(e.tipo === 'teste' || e.tipo === 'avaliacao') { if(mT) { bgC = '#f59e0b'; txtT = 'Avaliação'; evs.push({...e, cor: bgC, txt: txtT}); } } else if(e.tipo === 'trabalho' || e.tipo === 'entrega') { if(mTr) { bgC = '#00d2ff'; txtT = 'Entrega'; evs.push({...e, cor: bgC, txt: txtT}); } } else { if(mO) evs.push({...e, cor: bgC, txt: txtT}); } });
        if(evs.length === 0) { sC.innerHTML = getEmptyState('Nenhum evento com os filtros atuais.', 'fa-filter'); return; }
        const hj = new Date().toISOString().split('T')[0]; const fut = evs.filter(e => (e.data || '') >= hj).sort((a,b) => (a.data || '').localeCompare(b.data || '')); const pas = evs.filter(e => (e.data || '') < hj).sort((a,b) => (b.data || '').localeCompare(a.data || ''));
        const mA = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; let html = '';
        const rEv = (ev) => { if (!ev.data) return ''; const dp = ev.data.split('-'); const mes = mA[parseInt(dp[1])-1]; return `<div class="calendar-event-card" style="border-left-color:${ev.cor}; margin-bottom:10px;"><div class="calendar-date-box"><span class="day">${dp[2]}</span><span class="month" style="color:${ev.cor};">${mes}</span></div><div class="calendar-info"><h4 style="margin:0; color:var(--text-light);">${ev.titulo}</h4><span style="font-size:0.8rem; color:var(--text-muted);">${(ev.txt||'evento').toUpperCase()}</span></div></div>`; };
        if(fut.length > 0) fut.forEach(e => html += rEv(e)); else html += '<p class="text-muted center">Sem eventos futuros.</p>';
        if(pas.length > 0) { html += '<div class="calendar-divider" style="margin-top:20px;"><span>Passados</span></div>'; pas.forEach(e => html += rEv(e)); } sC.innerHTML = html;
    } catch(e) { sC.innerHTML = getEmptyState('Erro ao sincronizar.', 'fa-triangle-exclamation'); }
}

const getCorEspecial = (dsc) => {
    if(!dsc) return { c: 'var(--primary-green)', bg: 'rgba(16, 185, 129, 0.05)' };
    const d = dsc.toLowerCase();
    if(d.includes('alm')) return { c: 'var(--warning-yellow)', bg: 'rgba(245, 158, 11, 0.1)' };
    if(d.includes('vis')) return { c: '#00d2ff', bg: 'rgba(0, 210, 255, 0.1)' };
    if(d.includes('prhf')) return { c: 'var(--danger-red)', bg: 'rgba(239, 68, 68, 0.1)' };
    if(d.includes('pap') || d.includes('fct')) return { c: '#ff9900', bg: 'rgba(255, 153, 0, 0.1)' };
    if(['reunião','reuniao','livre','estudo'].some(k => d.includes(k))) return { c: 'var(--accent-purple)', bg: 'rgba(139, 92, 246, 0.1)' };
    return { c: 'var(--primary-green)', bg: 'rgba(16, 185, 129, 0.05)' };
};

async function carregarHorarioAluno() {
    const sC = document.getElementById('aluno-horario-content'); if(!sC) return;
    sC.innerHTML = '<p class="text-muted center">A gerar horário...</p>'; if(!minhaTurma) { sC.innerHTML = getEmptyState('Sem turma configurada.', 'fa-calendar-xmark'); return; }
    try {
        const dS = await getDoc(doc(db, "turmas", minhaTurma)); let hb = {}; if(dS.exists() && dS.data().horario) hb = dS.data().horario;
        const bK = ['1', '2', '3', '4', '1300', '5', '6', '7']; const bT = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' }; const dM = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']; const fDt = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
        
        if (ahModo === 'dia') {
            let tD = new Date(); tD.setDate(tD.getDate() + ahDOff); const hd = document.getElementById('aluno-horario-display'); if(hd) hd.innerText = `${dM[tD.getDay()]}, ${fDt(tD)}`;
            let h = ''; let tAD = false; const dSStr = `${tD.getFullYear()}-${String(tD.getMonth()+1).padStart(2,'0')}-${String(tD.getDate()).padStart(2,'0')}`;
            bK.forEach(b => { const dc = hb[`${dSStr}_${b}`]; if(dc) { const sty = getCorEspecial(dc); h += `<div class="horario-list-item" style="border-left-color:${sty.c}; background-color:${sty.bg};"><div class="horario-time-col">${bT[b]}</div><div class="horario-disc-col"><div class="horario-disc-name">${dc}</div><div class="horario-prof" style="font-size:0.75rem; color:#888; margin-top:4px;">Prof. A Atribuir</div></div></div>`; tAD = true; } });
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
bindChange('aluno-filtro-materiais-disc', carregarMateriaisAluno);

async function pedirPermissaoNotificacoes() { try { const p = await Notification.requestPermission(); if(p==='granted') { const r = await navigator.serviceWorker.register('./firebase-messaging-sw.js'); const t = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: r }); if(t) await updateDoc(doc(db, "utilizadores", myUserId), { tokenNotificacao: t }); } } catch(e){} }
if(typeof onMessage !== "undefined" && messaging) onMessage(messaging, p => alert(`NOVA NOTIFICAÇÃO:\n${p.notification.title}\n${p.notification.body}`));
setTimeout(() => { if(myUserId) pedirPermissaoNotificacoes(); }, 4000);
