import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, addDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let myUserId = ""; let myUserName = ""; let educandosArray = []; let educandoAtualId = ""; let turmaAtual = "";

const matrizCursoMap = {
    "Sociocultural": ["PORT", "ING", "AI", "EF", "TIC"],
    "Científica": ["GEO", "HCA", "MAT", "FQ", "BG", "MAC"],
    "Técnica": ["CF", "TIAT", "TCAT", "OTET"] 
};

// ==========================================
// 1. INICIALIZAÇÃO E MULTI-EDUCANDOS
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            if (docSnap.exists() && docSnap.data().papel === 'ee') {
                const dados = docSnap.data(); myUserName = dados.nome || "Encarregado";
                if(dados.educandos && Array.isArray(dados.educandos)) educandosArray = dados.educandos;
                else if (dados.educandoId) educandosArray = [dados.educandoId];
                else if (dados.educando) educandosArray = [dados.educando];

                if(educandosArray.length > 0) await construirSeletorEducandos();
                else document.getElementById('ee-dashboard').innerHTML = '<p class="text-muted center" style="margin-top:50px;">A tua conta não tem nenhum educando associado. Contacta a Direção.</p>';
            } else window.location.href = "index.html"; 
        } catch (e) {}
    } else window.location.href = "index.html"; 
});

async function construirSeletorEducandos() {
    const selector = document.getElementById('header-ee-student-selector'); selector.innerHTML = '';
    for (let id of educandosArray) {
        try {
            const snap = await getDoc(doc(db, "utilizadores", id));
            if (snap.exists()) {
                const opt = document.createElement('option'); opt.value = id;
                opt.text = `${snap.data().nome.split(' ')[0]} (${snap.data().turma})`;
                selector.appendChild(opt);
            }
        } catch(e) {}
    }
    if(selector.options.length > 0) {
        educandoAtualId = selector.value; carregarDadosDoFilhoSelecionado();
        selector.addEventListener('change', (e) => { educandoAtualId = e.target.value; carregarDadosDoFilhoSelecionado(); });
    }
}

document.getElementById('btn-logout-ee')?.addEventListener('click', () => { signOut(auth).then(() => window.location.href = "index.html"); });

async function carregarDadosDoFilhoSelecionado() {
    if(!educandoAtualId) return;
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", educandoAtualId));
        if (docSnap.exists()) {
            turmaAtual = docSnap.data().turma; carregarResumoDashboard();
            const abaAtivaEl = document.querySelector('.bottom-nav .nav-item.active');
            if(abaAtivaEl) {
                const abaAtiva = abaAtivaEl.getAttribute('data-target');
                if(abaAtiva === 'view-ee-caderneta') ativarTabCadernetaAtual();
                if(abaAtiva === 'view-ee-agenda') carregarAgendaEE();
                if(abaAtiva === 'view-ee-horario') carregarHorarioEE();
            }
        }
    } catch(e) {}
}

// ==========================================
// 2. DASHBOARD PROATIVO E MÉDIAS
// ==========================================
async function carregarResumoDashboard() {
    let sumG = 0, countG = 0, sumS = 0, countS = 0, sumC = 0, countC = 0, sumT = 0, countT = 0;
    let faltasSemana = 0; let nOcorrencias = 0; let nPrhf = 0;

    // FCT e PAP
    try {
        const alunoSnap = await getDoc(doc(db, "utilizadores", educandoAtualId));
        if(alunoSnap.exists()) {
            document.getElementById('resumo-fct').innerText = alunoSnap.data().notaFCT || '-';
            document.getElementById('resumo-pap').innerText = alunoSnap.data().notaPAP || '-';
        }
    } catch(e){}

    // Médias
    try {
        const notasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "notas"));
        notasSnap.forEach(d => {
            const n = d.data(); const val = n.nota;
            if(val !== 'REP' && !isNaN(val)) {
                const vNum = Number(val); sumG += vNum; countG++;
                if(matrizCursoMap["Sociocultural"].includes(n.disciplina)) { sumS += vNum; countS++; }
                else if(matrizCursoMap["Científica"].includes(n.disciplina)) { sumC += vNum; countC++; }
                else { sumT += vNum; countT++; } // Assume técnica se não for das outras
            }
        });
        const mG = countG > 0 ? (sumG/countG).toFixed(1) : '-';
        document.getElementById('resumo-media').innerText = mG;
        document.getElementById('resumo-media').style.color = (mG !== '-' && mG < 10) ? 'var(--danger-red)' : 'var(--primary-green)';
        document.getElementById('resumo-med-socio').innerText = countS > 0 ? (sumS/countS).toFixed(1) : '-';
        document.getElementById('resumo-med-cient').innerText = countC > 0 ? (sumC/countC).toFixed(1) : '-';
        document.getElementById('resumo-med-tec').innerText = countT > 0 ? (sumT/countT).toFixed(1) : '-';
    } catch(e) {}

    // Faltas (Últimos 7 dias)
    try {
        const umaSemanaAtras = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
        const faltasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        faltasSnap.forEach(d => { if(d.data().dataInicio >= umaSemanaAtras) faltasSemana += d.data().horas; });
        document.getElementById('resumo-faltas').innerText = `${faltasSemana}h`;
    } catch(e) {}

    // Ocorrências e PRHFs Ativos
    try {
        const ocSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "ocorrencias"));
        document.getElementById('resumo-ocorrencias').innerText = ocSnap.size;
        const prhfSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "prhfs"));
        prhfSnap.forEach(d => { if((d.data().status || 'ativa') === 'ativa') nPrhf++; });
        document.getElementById('resumo-prhfs').innerText = nPrhf;
    } catch(e) {}

    // Próximo Evento
    try {
        const evSnap = await getDocs(collection(db, "turmas", turmaAtual, "eventos"));
        const hojeIso = new Date().toISOString().split('T')[0];
        let futuros = []; evSnap.forEach(d => { if(d.data().data >= hojeIso) futuros.push(d.data()); });
        if(futuros.length > 0) {
            futuros.sort((a,b) => a.data.localeCompare(b.data));
            const ev = futuros[0]; const dp = ev.data.split('-');
            document.getElementById('resumo-proximo-evento').innerHTML = `<strong>${dp[2]}/${dp[1]}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${ev.titulo}</span>`;
        } else document.getElementById('resumo-proximo-evento').innerText = "Agenda limpa";
    } catch(e) {}
}

// ==========================================
// 3. NAVEGAÇÃO DA BARRA INFERIOR
// ==========================================
const navItems = document.querySelectorAll('.nav-item');
const views = [ document.getElementById('ee-dashboard'), document.getElementById('view-ee-caderneta'), document.getElementById('view-ee-agenda'), document.getElementById('view-ee-horario'), document.getElementById('view-ee-chat'), document.getElementById('view-ee-justificar'), document.getElementById('view-ee-notificacoes') ];
function esconderTodasAsVistas() { views.forEach(v => { if(v) v.style.display = 'none'; }); }

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault(); navItems.forEach(nav => nav.classList.remove('active')); e.currentTarget.classList.add('active');
        esconderTodasAsVistas(); const targetId = e.currentTarget.getAttribute('data-target'); const targetView = document.getElementById(targetId);
        if(targetId === 'view-ee-chat') targetView.style.display = 'flex'; else if (targetView) targetView.style.display = 'block';
        if(targetId === 'view-ee-caderneta') ativarTabCadernetaAtual();
        if(targetId === 'view-ee-agenda') carregarAgendaEE();
        if(targetId === 'view-ee-horario') carregarHorarioEE();
    });
});

document.getElementById('btn-quick-mensagem')?.addEventListener('click', () => { navItems.forEach(nav => nav.classList.remove('active')); esconderTodasAsVistas(); document.getElementById('view-ee-chat').style.display = 'flex'; iniciarChatEE(); });
document.getElementById('btn-quick-justificar')?.addEventListener('click', () => { navItems.forEach(nav => nav.classList.remove('active')); esconderTodasAsVistas(); document.getElementById('view-ee-justificar').style.display = 'block'; carregarAtestadosEE(); });
document.querySelectorAll('#btn-voltar-chat-ee, #btn-voltar-justificar, #btn-voltar-notificacoes').forEach(btn => { btn?.addEventListener('click', () => { navItems.forEach(nav => nav.classList.remove('active')); document.querySelector('.nav-item[data-target="ee-dashboard"]').classList.add('active'); esconderTodasAsVistas(); document.getElementById('ee-dashboard').style.display = 'block'; }); });

// ==========================================
// 4. CADERNETA E TIMELINE
// ==========================================
const tabTimeline = document.getElementById('tab-ee-timeline'); const tabNotas = document.getElementById('tab-ee-notas'); const tabFaltas = document.getElementById('tab-ee-faltas'); const tabPrhfs = document.getElementById('tab-ee-prhfs'); const tabComportamento = document.getElementById('tab-ee-comportamento'); const cadernetaContent = document.getElementById('ee-caderneta-content');
let currentCadernetaTab = tabTimeline;
function ativarTabCadernetaAtual() { if(currentCadernetaTab) currentCadernetaTab.click(); }
function switchTabConfig(tabClicada, tabsParaDesativar) { currentCadernetaTab = tabClicada; tabClicada.classList.add('active'); tabsParaDesativar.forEach(t => t.classList.remove('active')); cadernetaContent.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; }

tabTimeline?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabNotas, tabFaltas, tabPrhfs, tabComportamento]); carregarTimelineEE(); });
tabNotas?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabFaltas, tabPrhfs, tabComportamento]); carregarNotasEE(); });
tabFaltas?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabPrhfs, tabComportamento]); carregarFaltasEE(); });
tabPrhfs?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabFaltas, tabComportamento]); carregarPrhfsEE(); });
tabComportamento?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabFaltas, tabPrhfs]); carregarComportamentoEE(); });

async function carregarTimelineEE() {
    if(!educandoAtualId) return;
    try {
        let eventos = [];
        const notasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "notas"));
        notasSnap.forEach(d => { const n = d.data(); eventos.push({ time: new Date(n.data).getTime(), icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', titulo: 'Nova Avaliação', desc: `${n.disciplina} (Mod. ${n.modulo}): <strong>${n.nota}</strong>` }); });
        
        const faltasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        faltasSnap.forEach(d => { const f = d.data(); eventos.push({ time: new Date(f.criadoEm || f.dataInicio).getTime(), icon: '<i class="fa-solid fa-user-xmark"></i>', cor: f.justificada ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Falta a ${f.disciplina} (${f.horas}h)`, desc: f.justificada ? `Falta Justificada` : `Falta registada no sistema.` }); });
        
        const ocSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "ocorrencias"));
        ocSnap.forEach(d => { const o = d.data(); eventos.push({ time: o.timestamp, icon: o.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>', cor: o.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Registo Disciplinar`, desc: `<strong>${o.titulo}</strong><br><span style="font-size:0.8rem; color:#aaa;">${o.descricao || ''}</span>` }); });
        
        eventos.sort((a,b) => b.time - a.time);
        if(eventos.length === 0) { cadernetaContent.innerHTML = '<p class="text-muted center" style="margin-top:40px;"><i class="fa-solid fa-wind" style="font-size:2rem; display:block; margin-bottom:10px;"></i>Tudo calmo por aqui.</p>'; return; }
        
        let html = '<div class="timeline">';
        eventos.forEach(ev => { html += `<div class="timeline-item"><div class="timeline-icon" style="color: ${ev.cor}; border-color: ${ev.cor};">${ev.icon}</div><div class="timeline-content" style="border-left: 3px solid ${ev.cor};"><span class="timeline-date">${new Date(ev.time).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span><strong style="color:white; display:block; margin-bottom:5px;">${ev.titulo}</strong><p style="font-size:0.85rem; color:var(--text-light); margin:0;">${ev.desc}</p></div></div>`; });
        cadernetaContent.innerHTML = html + '</div>';
    } catch(e) {}
}

async function carregarNotasEE() {
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", educandoAtualId, "notas"));
        if(notasDb.empty) { cadernetaContent.innerHTML = '<p class="text-muted center">Sem notas.</p>'; return; }
        let html = '<div class="stats-grid" style="grid-template-columns: 1fr;">';
        notasDb.forEach(d => { const n = d.data(); const cor = (n.nota === 'REP' || Number(n.nota) < 10) ? 'var(--danger-red)' : 'var(--success-green)'; html += `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left: 4px solid ${cor};"><div><strong>${n.disciplina}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">Módulo ${n.modulo}</span></div><div style="font-size:1.4rem; font-weight:bold; color:${cor};">${n.nota}</div></div>`; });
        cadernetaContent.innerHTML = html + '</div>';
    } catch(e) {}
}

async function carregarFaltasEE() {
    try {
        const faltasDb = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        if(faltasDb.empty) { cadernetaContent.innerHTML = '<p class="text-muted center">Aluno sem faltas.</p>'; return; }
        let faltasArr = []; faltasDb.forEach(d => faltasArr.push(d.data())); faltasArr.sort((a,b) => b.dataInicio.localeCompare(a.dataInicio)); 
        
        let html = ''; let currentDate = ''; const mesArr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        faltasArr.forEach(f => {
            if(f.dataInicio !== currentDate) {
                currentDate = f.dataInicio; const dp = currentDate.split('-');
                const dateStr = dp.length===3 ? `${dp[2]} de ${mesArr[parseInt(dp[1])-1]}` : currentDate;
                html += `<div class="falta-date-divider" style="margin-top: 20px;">${dateStr}</div>`;
            }
            const stColor = f.justificada ? 'var(--success-green)' : 'var(--danger-red)';
            const stTxt = f.justificada ? 'Justificada' : (f.comprovativoEnviado ? 'Em Análise' : 'Injustificada');
            html += `<div class="card" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;"><div><strong>${f.disciplina}</strong> (${f.horas}h)</div><span style="font-size:0.8rem; font-weight:bold; color:${stColor}; padding:5px 10px; background:rgba(255,255,255,0.05); border-radius:12px;">${stTxt}</span></div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

async function carregarPrhfsEE() {
    try {
        const prhfsDb = await getDocs(collection(db, "utilizadores", educandoAtualId, "prhfs"));
        if(prhfsDb.empty) { cadernetaContent.innerHTML = '<p class="text-muted center">Nenhum PRHF ativo.</p>'; return; }
        let html = '';
        prhfsDb.forEach(d => {
            const p = d.data(); const status = p.status || 'ativa';
            const cor = status === 'concluida' ? 'var(--success-green)' : 'var(--warning-yellow)';
            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${p.disciplina} (Mod. ${p.modulo})</strong><span style="color:${cor}; font-size:0.85rem; font-weight:bold;">${status.toUpperCase()}</span></div><p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">${p.descricao}</p><div style="font-size:0.8rem;">Data Limite: <strong>${p.prazo}</strong> | Presenciais: <strong>${p.horasPresenciais||0}h</strong></div></div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

async function carregarComportamentoEE() {
    try {
        const res = await getDocs(query(collection(db, "utilizadores", educandoAtualId, "ocorrencias")));
        if(res.empty) { cadernetaContent.innerHTML = '<p class="text-muted center">Sem registos.</p>'; return; }
        let regs = []; res.forEach(d => regs.push(d.data())); regs.sort((a,b) => b.data.localeCompare(a.data)); 
        let html = '';
        regs.forEach(r => {
            const cor = r.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)';
            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; align-items:center; gap:8px; color:${cor}; margin-bottom:5px;"><i class="fa-solid fa-circle-exclamation"></i> <strong>${r.titulo}</strong></div><span style="font-size:0.75rem; color:var(--text-muted);">Data: ${r.data} | Prof. ${r.autor}</span>${r.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">${r.descricao}</p>` : ''}</div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

// ==========================================
// 5. AGENDA (LISTA) E HORÁRIO (GRELHA)
// ==========================================
document.getElementById('filtro-agenda-testes')?.addEventListener('change', carregarAgendaEE);
document.getElementById('filtro-agenda-outros')?.addEventListener('change', carregarAgendaEE);

async function carregarAgendaEE() {
    const subContainer = document.getElementById('ee-agenda-content');
    subContainer.innerHTML = '<p class="text-muted center">A sincronizar agenda...</p>';
    if(!turmaAtual) return;

    const mostraT = document.getElementById('filtro-agenda-testes').checked;
    const mostraO = document.getElementById('filtro-agenda-outros').checked;

    try {
        const evDb = await getDocs(collection(db, "turmas", turmaAtual, "eventos"));
        if(evDb.empty) { subContainer.innerHTML = '<p class="text-muted center">Sem eventos na escola.</p>'; return; }
        
        let evs = [];
        evDb.forEach(d => { 
            const e = d.data(); let bgC = '#b82bf2'; 
            if(e.tipo === 'teste' || e.tipo === 'avaliacao') { if(mostraT) { bgC = '#ffaa00'; evs.push({...e, cor: bgC}); } } 
            else { if(mostraO) evs.push({...e, cor: bgC}); }
        });
        
        if(evs.length === 0) { subContainer.innerHTML = '<p class="text-muted center">Nenhum evento com os filtros atuais.</p>'; return; }
        
        const hoje = new Date().toISOString().split('T')[0];
        const futuros = evs.filter(e => e.data >= hoje).sort((a,b) => a.data.localeCompare(b.data));
        const passados = evs.filter(e => e.data < hoje).sort((a,b) => b.data.localeCompare(a.data));
        const mesArr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        let html = '';

        const renderEv = (ev) => {
            const dp = ev.data.split('-'); const mes = mesArr[parseInt(dp[1])-1];
            return `<div class="calendar-event-card" style="border-left-color:${ev.cor}; margin-bottom:10px;"><div class="calendar-date-box"><span class="day">${dp[2]}</span><span class="month" style="color:${ev.cor};">${mes}</span></div><div class="calendar-info"><h4 style="margin:0; color:white;">${ev.titulo}</h4><span style="font-size:0.8rem; color:var(--text-muted);">${(ev.tipo||'evento').toUpperCase()}</span></div></div>`;
        };

        if(futuros.length > 0) { futuros.forEach(e => html += renderEv(e)); }
        else { html += '<p class="text-muted center">Sem eventos futuros.</p>'; }
        
        if(passados.length > 0) {
            html += '<div class="calendar-divider" style="margin-top:20px;"><span>Passados</span></div>';
            passados.forEach(e => html += renderEv(e));
        }
        subContainer.innerHTML = html;
    } catch(e) {}
}

let eeHW = 0;
document.getElementById('btn-ee-prev-week')?.addEventListener('click', () => { eeHW--; carregarHorarioEE(); });
document.getElementById('btn-ee-next-week')?.addEventListener('click', () => { eeHW++; carregarHorarioEE(); });

async function carregarHorarioEE() {
    const subContainer = document.getElementById('ee-horario-content');
    subContainer.innerHTML = '<p class="text-muted center">A gerar grelha...</p>';
    if(!turmaAtual) return;

    try {
        const docSnap = await getDoc(doc(db, "turmas", turmaAtual));
        let hb = {}; if(docSnap.exists() && docSnap.data().horario) hb = docSnap.data().horario;
        
        const blocos = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' };
        let dtT = new Date(); dtT.setDate(dtT.getDate() + (eeHW * 7));
        dtT.setDate(dtT.getDate() - (dtT.getDay() === 0 ? 6 : dtT.getDay() - 1));
        
        let dEnd = new Date(dtT); dEnd.setDate(dEnd.getDate() + 4);
        const fDt = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
        document.getElementById('ee-week-display').innerText = `${fDt(dtT)} a ${fDt(dEnd)}`;
        
        let html = '<div class="horario-grid" style="min-width: 500px;"><div class="horario-header"></div>';
        let dtIter = new Date(dtT);
        ['SEG','TER','QUA','QUI','SEX'].forEach(d => { html += `<div class="horario-header">${d}<span>${fDt(dtIter)}</span></div>`; dtIter.setDate(dtIter.getDate()+1); });
        
        Object.keys(blocos).forEach(bId => {
            html += `<div class="horario-time">${blocos[bId]}</div>`;
            dtIter = new Date(dtT);
            for(let i=0; i<5; i++) {
                const dStr = `${dtIter.getFullYear()}-${String(dtIter.getMonth()+1).padStart(2,'0')}-${String(dtIter.getDate()).padStart(2,'0')}`;
                const disc = hb[`${dStr}_${bId}`];
                if(disc) html += `<div class="horario-slot filled" style="padding:2px;"><strong>${disc}</strong></div>`;
                else html += `<div class="horario-slot"></div>`;
                dtIter.setDate(dtIter.getDate()+1);
            }
        });
        subContainer.innerHTML = html + '</div>';
    } catch(e) {}
}

// ==========================================
// 6. CHAT E JUSTIFICAÇÕES 
// ==========================================
let chatUnsubscribeEE = null;
function iniciarChatEE() {
    const chatContainer = document.getElementById('ee-chat-messages-container');
    if(!educandoAtualId) return;
    if(chatUnsubscribeEE) chatUnsubscribeEE();
    chatUnsubscribeEE = onSnapshot(query(collection(db, "utilizadores", educandoAtualId, "chat_dt"), orderBy("timestamp")), (snapshot) => {
        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data(); const isMe = msg.remetente === myUserName || msg.autor === 'ee';
            const classe = isMe ? 'admin' : 'student'; 
            const autorLabel = isMe ? 'Tu' : (msg.autor === 'dt' ? 'Diretor de Turma' : msg.remetente);
            html += `<div class="chat-bubble ${classe}"><strong>${autorLabel}</strong><br>${msg.texto}<span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>`;
        });
        if(html === '') html = '<p class="text-muted center" style="margin-top:40px;"><i class="fa-solid fa-comments" style="font-size:3rem; opacity:0.2; display:block; margin-bottom:15px;"></i>Inicie aqui a comunicação com a escola.</p>';
        chatContainer.innerHTML = html; chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}
document.getElementById('btn-ee-send-msg')?.addEventListener('click', async () => { const inp = document.getElementById('ee-input-chat-msg'); const txt = inp.value.trim(); if(!txt || !educandoAtualId) return; try { await addDoc(collection(db, "utilizadores", educandoAtualId, "chat_dt"), { remetente: myUserName, autor: 'ee', texto: txt, timestamp: Date.now() }); inp.value = ''; } catch(e) {} });

// Justificações
let atestadoBase64 = "";
document.getElementById('ee-upload-atestado')?.addEventListener('change', (e) => {
    const file = e.target.files[0]; if(!file) return;
    if(file.size > 2097152) { alert("Ficheiro demasiado grande! Máx 2MB."); return; } 
    document.getElementById('ee-atestado-file-name').innerText = "Ficheiro: " + file.name;
    document.getElementById('btn-ee-enviar-atestado').style.display = 'block';
    const reader = new FileReader(); reader.onload = (ev) => { atestadoBase64 = ev.target.result; }; reader.readAsDataURL(file);
});
document.getElementById('btn-ee-enviar-atestado')?.addEventListener('click', async (e) => {
    if(!atestadoBase64 || !educandoAtualId) return; const obs = document.getElementById('ee-atestado-obs').value.trim();
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar...'; btnRef.disabled = true;
    try {
        await addDoc(collection(db, "utilizadores", educandoAtualId, "atestados"), { ficheiroBase64: atestadoBase64, observacoes: obs, status: "pendente", dataEnvio: new Date().toISOString() });
        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Enviado!';
        setTimeout(() => { document.getElementById('ee-atestado-file-name').innerText = ""; document.getElementById('ee-atestado-obs').value = ""; atestadoBase64 = ""; btnRef.style.display = 'none'; btnRef.disabled = false; btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar para Análise'; carregarAtestadosEE(); }, 2000);
    } catch(err) { btnRef.innerHTML = "Erro!"; setTimeout(() => { btnRef.disabled = false; btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar para Análise'; }, 2000); }
});

async function carregarAtestadosEE() {
    const container = document.getElementById('ee-lista-atestados-container'); container.innerHTML = '<p class="text-muted center">A procurar histórico...</p>';
    if(!educandoAtualId) return;
    try {
        const res = await getDocs(query(collection(db, "utilizadores", educandoAtualId, "atestados")));
        if(res.empty) { container.innerHTML = '<p class="text-muted center">Nenhum comprovativo enviado.</p>'; return; }
        let arr = []; res.forEach(d => arr.push(d.data())); arr.sort((a,b) => b.dataEnvio.localeCompare(a.dataEnvio)); 
        let html = '';
        arr.forEach(a => {
            let corStatus = 'var(--warning-yellow)'; let txtStatus = 'Em análise'; let iconStatus = '<i class="fa-regular fa-clock"></i>';
            if(a.status === 'aprovado' || a.status === 'aceite') { corStatus = 'var(--success-green)'; txtStatus = 'Aceite'; iconStatus = '<i class="fa-solid fa-check-circle"></i>'; }
            if(a.status === 'rejeitado' || a.status === 'recusada') { corStatus = 'var(--danger-red)'; txtStatus = 'Recusada'; iconStatus = '<i class="fa-solid fa-xmark-circle"></i>'; }
            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${corStatus}; display:flex; justify-content:space-between; align-items:center;"><div><strong>Enviado a ${new Date(a.dataEnvio).toLocaleDateString('pt-PT')}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${a.observacoes || 'Sem observações'}</span></div><div style="text-align: right;"><span style="font-size:0.8rem; font-weight:bold; color:${corStatus}; padding:6px 12px; background:rgba(255,255,255,0.05); border-radius:20px; display:inline-block;">${iconStatus} ${txtStatus}</span></div></div>`;
        });
        container.innerHTML = html;
    } catch(e) {}
}
