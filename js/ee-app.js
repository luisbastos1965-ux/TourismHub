import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, addDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let myUserId = ""; let myUserName = ""; let educandosArray = []; let educandoAtualId = ""; let turmaAtual = "";

const matrizCursoMap = {
    "Sociocultural": ["PORT", "ING", "AI", "EF", "TIC"],
    "Científica": ["GEO", "HCA", "MAT", "FQ", "BG", "MAC"],
    "Técnica": ["CF", "TIAT", "TCAT", "OTET"] 
};

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
                else document.getElementById('ee-dashboard').innerHTML = '<p class="text-muted center" style="margin-top:50px;">Sem educandos associados.</p>';
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
            turmaAtual = docSnap.data().turma; carregarResumoDashboard(); preencherFiltrosDisciplinas();
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

async function carregarResumoDashboard() {
    let sumG = 0, countG = 0, sumS = 0, countS = 0, sumC = 0, countC = 0, sumT = 0, countT = 0;
    let faltasSemana = 0; let nOcorrencias = 0; let nPrhf = 0;

    try {
        const alunoSnap = await getDoc(doc(db, "utilizadores", educandoAtualId));
        if(alunoSnap.exists()) {
            document.getElementById('resumo-fct').innerText = alunoSnap.data().notaFCT || '-';
            document.getElementById('resumo-pap').innerText = alunoSnap.data().notaPAP || '-';
        }
    } catch(e){}

    try {
        const notasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "notas"));
        notasSnap.forEach(d => {
            const val = d.data().nota;
            if(val !== 'REP' && !isNaN(val)) {
                const vNum = Number(val); sumG += vNum; countG++;
                if(matrizCursoMap["Sociocultural"].includes(d.data().disciplina)) { sumS += vNum; countS++; }
                else if(matrizCursoMap["Científica"].includes(d.data().disciplina)) { sumC += vNum; countC++; }
                else { sumT += vNum; countT++; } 
            }
        });
        const mG = countG > 0 ? (sumG/countG).toFixed(1) : '-';
        document.getElementById('resumo-media').innerText = mG;
        document.getElementById('resumo-media').style.color = (mG !== '-' && mG < 10) ? 'var(--danger-red)' : 'var(--primary-green)';
        document.getElementById('resumo-med-socio').innerText = countS > 0 ? (sumS/countS).toFixed(1) : '-';
        document.getElementById('resumo-med-cient').innerText = countC > 0 ? (sumC/countC).toFixed(1) : '-';
        document.getElementById('resumo-med-tec').innerText = countT > 0 ? (sumT/countT).toFixed(1) : '-';
    } catch(e) {}

    try {
        const umaSemanaAtras = new Date(Date.now() - 7*24*60*60*1000).toISOString().split('T')[0];
        const faltasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        faltasSnap.forEach(d => { if(d.data().dataInicio >= umaSemanaAtras) faltasSemana += d.data().horas; });
        document.getElementById('resumo-faltas').innerText = `${faltasSemana}h`;
    } catch(e) {}

    try {
        const ocSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "ocorrencias"));
        document.getElementById('resumo-ocorrencias').innerText = ocSnap.size;
        const prhfSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "prhfs"));
        prhfSnap.forEach(d => { if(d.data().status !== 'concluida') nPrhf++; });
        document.getElementById('resumo-prhfs').innerText = nPrhf;
    } catch(e) {}

    try {
        const evSnap = await getDocs(collection(db, "turmas", turmaAtual, "eventos"));
        const hojeIso = new Date().toISOString().split('T')[0];
        let futuros = []; evSnap.forEach(d => { if(d.data().data >= hojeIso) futuros.push(d.data()); });
        if(futuros.length > 0) {
            futuros.sort((a,b) => a.data.localeCompare(b.data));
            const dp = futuros[0].data.split('-');
            document.getElementById('resumo-proximo-evento').innerHTML = `<strong>${dp[2]}/${dp[1]}</strong><br><span style="font-size:0.7rem; color:var(--text-muted);">${futuros[0].titulo}</span>`;
        } else document.getElementById('resumo-proximo-evento').innerText = "Agenda limpa";
    } catch(e) {}
}

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

// Botão do Sino
document.getElementById('btn-open-notificacoes')?.addEventListener('click', () => { navItems.forEach(nav => nav.classList.remove('active')); esconderTodasAsVistas(); document.getElementById('view-ee-notificacoes').style.display = 'block'; document.getElementById('ee-notificacoes-container').innerHTML = '<p class="text-muted center">Central ativa. Notificações futuras aparecerão aqui.</p>'; });

// ==========================================
// 4. CADERNETA E TIMELINE
// ==========================================
const tabTimeline = document.getElementById('tab-ee-timeline'); const tabNotas = document.getElementById('tab-ee-notas'); const tabFaltas = document.getElementById('tab-ee-faltas'); const tabPrhfs = document.getElementById('tab-ee-prhfs'); const tabComportamento = document.getElementById('tab-ee-comportamento'); const cadernetaContent = document.getElementById('ee-caderneta-content'); const filtroContainer = document.getElementById('filtro-caderneta-container'); const filtroDisc = document.getElementById('filtro-caderneta-disc');
let currentCadernetaTab = tabTimeline;

function preencherFiltrosDisciplinas() {
    let opt = '<option value="">Todas as Disciplinas</option>';
    Object.values(matrizCursoMap).forEach(arr => { arr.forEach(d => opt += `<option value="${d}">${d}</option>`); });
    filtroDisc.innerHTML = opt;
}
filtroDisc.addEventListener('change', () => ativarTabCadernetaAtual());

function ativarTabCadernetaAtual() { if(currentCadernetaTab) currentCadernetaTab.click(); }
function switchTabConfig(tabClicada, tabsParaDesativar, showFilter) { currentCadernetaTab = tabClicada; tabClicada.classList.add('active'); tabsParaDesativar.forEach(t => t.classList.remove('active')); filtroContainer.style.display = showFilter ? 'block' : 'none'; cadernetaContent.innerHTML = '<p class="text-muted center">A carregar...</p>'; }

tabTimeline?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabNotas, tabFaltas, tabPrhfs, tabComportamento], false); carregarTimelineEE(); });
tabNotas?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabFaltas, tabPrhfs, tabComportamento], false); carregarNotasEE(); });
tabFaltas?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabPrhfs, tabComportamento], true); carregarFaltasEE(); });
tabPrhfs?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabFaltas, tabComportamento], true); carregarPrhfsEE(); });
tabComportamento?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabFaltas, tabPrhfs], true); carregarComportamentoEE(); });

async function carregarTimelineEE() {
    if(!educandoAtualId) return;
    try {
        let eventos = [];
        const notasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "notas"));
        notasSnap.forEach(d => { const n = d.data(); eventos.push({ time: new Date(n.data).getTime(), icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', titulo: 'Nova Avaliação', desc: `${n.disciplina} (Mod. ${n.modulo}): <strong>${n.nota}</strong>` }); });
        
        const faltasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        faltasSnap.forEach(d => { const f = d.data(); eventos.push({ time: new Date(f.criadoEm || f.dataInicio).getTime(), icon: '<i class="fa-solid fa-user-xmark"></i>', cor: f.justificada ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Falta a ${f.disciplina} (${f.horas}h)`, desc: f.justificada ? `Justificada` : `Falta registada.` }); });
        
        const ocSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "ocorrencias"));
        ocSnap.forEach(d => { const o = d.data(); eventos.push({ time: o.timestamp, icon: o.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>', cor: o.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Registo Disciplinar`, desc: `<strong>${o.titulo}</strong><br><span style="font-size:0.8rem; color:#aaa;">${o.descricao || ''}</span>` }); });
        
        const prhfSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "prhfs"));
        prhfSnap.forEach(d => { const p = d.data(); eventos.push({ time: new Date(p.dataRegisto || Date.now()).getTime(), icon: '<i class="fa-solid fa-book-medical"></i>', cor: 'var(--warning-yellow)', titulo: `Plano de Recuperação Criado`, desc: `${p.disciplina} (Mod. ${p.modulo})` }); });
        
        eventos.sort((a,b) => b.time - a.time);
        if(eventos.length === 0) { cadernetaContent.innerHTML = '<p class="text-muted center" style="margin-top:40px;">Tudo calmo por aqui.</p>'; return; }
        
        let html = '<div class="timeline">';
        eventos.forEach(ev => { html += `<div class="timeline-item"><div class="timeline-icon" style="color: ${ev.cor}; border-color: ${ev.cor};">${ev.icon}</div><div class="timeline-content" style="border-left: 3px solid ${ev.cor};"><span class="timeline-date">${new Date(ev.time).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span><strong style="color:white; display:block; margin-bottom:5px;">${ev.titulo}</strong><p style="font-size:0.85rem; color:var(--text-light); margin:0;">${ev.desc}</p></div></div>`; });
        cadernetaContent.innerHTML = html + '</div>';
    } catch(e) {}
}

async function carregarNotasEE() {
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", educandoAtualId, "notas"));
        if(notasDb.empty) { cadernetaContent.innerHTML = '<p class="text-muted center">Sem notas.</p>'; return; }
        let disciplinas = {};
        notasDb.forEach(d => { const n = d.data(); if(!disciplinas[n.disciplina]) disciplinas[n.disciplina] = []; disciplinas[n.disciplina].push(n); });
        
        let html = '';
        Object.keys(disciplinas).forEach(disc => {
            let sum = 0; let c = 0; let modsHtml = '';
            disciplinas[disc].forEach(n => {
                if(n.nota !== 'REP' && !isNaN(n.nota)) { sum += Number(n.nota); c++; }
                const cor = (n.nota === 'REP' || Number(n.nota) < 10) ? 'var(--danger-red)' : 'var(--success-green)';
                modsHtml += `<div class="modulo-row"><span>Módulo ${n.modulo}</span><span style="font-weight:bold; color:${cor};">${n.nota}</span></div>`;
            });
            const med = c > 0 ? (sum/c).toFixed(1) : '-';
            const medCor = (med !== '-' && med < 10) ? 'var(--danger-red)' : 'white';
            
            html += `<div class="disciplina-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                        <span class="disciplina-title">${disc}</span>
                        <span><span style="font-size:0.75rem; color:var(--text-muted); margin-right:8px;">Média:</span><span class="disciplina-media" style="color:${medCor};">${med}</span> <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; margin-left:5px;"></i></span>
                     </div><div class="disciplina-modules">${modsHtml}</div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

async function carregarFaltasEE() {
    try {
        const fDisc = filtroDisc.value;
        const faltasDb = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        let faltasArr = []; faltasDb.forEach(d => { if(!fDisc || d.data().disciplina === fDisc) faltasArr.push(d.data()); }); 
        if(faltasArr.length === 0) { cadernetaContent.innerHTML = '<p class="text-muted center">Sem faltas registadas.</p>'; return; }
        faltasArr.sort((a,b) => b.dataInicio.localeCompare(a.dataInicio)); 
        
        let html = ''; let currentDate = ''; const mesArr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        faltasArr.forEach(f => {
            if(f.dataInicio !== currentDate) {
                currentDate = f.dataInicio; const dp = currentDate.split('-');
                const dateStr = dp.length===3 ? `${dp[2]} de ${mesArr[parseInt(dp[1])-1]}` : currentDate;
                html += `<div class="falta-date-divider" style="margin-top: 15px;">${dateStr}</div>`;
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
        const fDisc = filtroDisc.value;
        const prhfsDb = await getDocs(collection(db, "utilizadores", educandoAtualId, "prhfs"));
        let prhfsArr = []; prhfsDb.forEach(d => { const p = d.data(); if(p.status !== 'concluida' && (!fDisc || p.disciplina === fDisc)) prhfsArr.push(p); });
        if(prhfsArr.length === 0) { cadernetaContent.innerHTML = '<p class="text-muted center">Nenhum PRHF ativo.</p>'; return; }
        
        // Ordenar do prazo mais curto para o mais alargado
        prhfsArr.sort((a,b) => new Date(a.prazo) - new Date(b.prazo));
        
        let html = '';
        prhfsArr.forEach(p => {
            // Urgência baseada no módulo terminado
            const isUrgente = p.moduloTerminado === true || p.moduloTerminado === "true"; 
            const cor = isUrgente ? 'var(--danger-red)' : 'var(--warning-yellow)';
            const txtSt = isUrgente ? 'URGENTE (Mód. Terminado)' : 'EM CURSO';
            
            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${p.disciplina} (Mod. ${p.modulo})</strong><span style="color:${cor}; font-size:0.75rem; font-weight:bold;">${txtSt}</span></div><p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">${p.descricao}</p><div style="font-size:0.8rem;">Data Limite: <strong style="color:${cor};">${p.prazo}</strong> | Presenciais: <strong>${p.horasPresenciais||0}h</strong></div></div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

async function carregarComportamentoEE() {
    try {
        const fDisc = filtroDisc.value;
        const res = await getDocs(query(collection(db, "utilizadores", educandoAtualId, "ocorrencias")));
        let regs = []; res.forEach(d => { if(!fDisc || d.data().disciplina === fDisc) regs.push(d.data()); }); 
        if(regs.length === 0) { cadernetaContent.innerHTML = '<p class="text-muted center">Sem registos.</p>'; return; }
        regs.sort((a,b) => b.data.localeCompare(a.data)); 
        let html = '';
        regs.forEach(r => {
            const cor = r.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)';
            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; align-items:center; gap:8px; color:${cor}; margin-bottom:5px;"><i class="fa-solid fa-circle-exclamation"></i> <strong>${r.titulo}</strong></div><span style="font-size:0.75rem; color:var(--text-muted);">Data: ${r.data} | Prof. ${r.autor}</span>${r.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">${r.descricao}</p>` : ''}</div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

// ==========================================
// 5. AGENDA (LISTA) E HORÁRIO (NOVA GRELHA MOBILE)
// ==========================================
document.getElementById('filtro-agenda-testes')?.addEventListener('change', carregarAgendaEE);
document.getElementById('filtro-agenda-trabalhos')?.addEventListener('change', carregarAgendaEE);
document.getElementById('filtro-agenda-outros')?.addEventListener('change', carregarAgendaEE);

async function carregarAgendaEE() {
    const subContainer = document.getElementById('ee-agenda-content');
    subContainer.innerHTML = '<p class="text-muted center">A sincronizar agenda...</p>';
    if(!turmaAtual) return;

    const mostraT = document.getElementById('filtro-agenda-testes').checked;
    const mostraTr = document.getElementById('filtro-agenda-trabalhos').checked;
    const mostraO = document.getElementById('filtro-agenda-outros').checked;

    try {
        const evDb = await getDocs(collection(db, "turmas", turmaAtual, "eventos"));
        if(evDb.empty) { subContainer.innerHTML = '<p class="text-muted center">Sem eventos na escola.</p>'; return; }
        
        let evs = [];
        evDb.forEach(d => { 
            const e = d.data(); let bgC = '#b82bf2'; let txtT = 'Evento';
            if(e.tipo === 'teste' || e.tipo === 'avaliacao') { if(mostraT) { bgC = '#ffaa00'; txtT = 'Avaliação'; evs.push({...e, cor: bgC, txt: txtT}); } } 
            else if(e.tipo === 'trabalho' || e.tipo === 'entrega') { if(mostraTr) { bgC = '#00d2ff'; txtT = 'Entrega'; evs.push({...e, cor: bgC, txt: txtT}); } } 
            else { if(mostraO) evs.push({...e, cor: bgC, txt: txtT}); }
        });
        
        if(evs.length === 0) { subContainer.innerHTML = '<p class="text-muted center">Nenhum evento com os filtros atuais.</p>'; return; }
        
        const hoje = new Date().toISOString().split('T')[0];
        const futuros = evs.filter(e => e.data >= hoje).sort((a,b) => a.data.localeCompare(b.data));
        const passados = evs.filter(e => e.data < hoje).sort((a,b) => b.data.localeCompare(a.data));
        const mesArr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        let html = '';

        const renderEv = (ev) => {
            const dp = ev.data.split('-'); const mes = mesArr[parseInt(dp[1])-1];
            return `<div class="horario-list-item" style="border-left-color:${ev.cor}; padding: 10px 15px;"><div style="display:flex; align-items:center; gap:15px;"><div style="text-align:center; min-width:40px;"><div style="font-size:1.3rem; font-weight:bold; color:white;">${dp[2]}</div><div style="font-size:0.7rem; color:${ev.cor}; text-transform:uppercase;">${mes}</div></div><div><div style="font-weight:bold; color:white;">${ev.titulo}</div><div style="font-size:0.75rem; color:var(--text-muted); margin-top:2px;">${ev.txt}</div></div></div></div>`;
        };

        if(futuros.length > 0) { futuros.forEach(e => html += renderEv(e)); }
        else { html += '<p class="text-muted center">Sem eventos futuros.</p>'; }
        
        if(passados.length > 0) {
            html += '<div class="horario-dia-titulo" style="color: var(--text-muted); border-color:#222;">Eventos Passados</div>';
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
    subContainer.innerHTML = '<p class="text-muted center">A gerar horário...</p>';
    if(!turmaAtual) return;

    try {
        const docSnap = await getDoc(doc(db, "turmas", turmaAtual));
        let hb = {}; if(docSnap.exists() && docSnap.data().horario) hb = docSnap.data().horario;
        
        // Array ordenado para corrigir o 13:00 no fim
        const blocosKeys = ['1', '2', '3', '4', '1300', '5', '6', '7'];
        const blocosTempo = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' };
        const diasMap = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
        
        let dtT = new Date(); dtT.setDate(dtT.getDate() + (eeHW * 7));
        dtT.setDate(dtT.getDate() - (dtT.getDay() === 0 ? 6 : dtT.getDay() - 1));
        
        let dEnd = new Date(dtT); dEnd.setDate(dEnd.getDate() + 4);
        const fDt = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
        document.getElementById('ee-week-display').innerText = `${fDt(dtT)} a ${fDt(dEnd)}`;
        
        let html = ''; let temAulasGeral = false;
        
        let currDate = new Date(dtT);
        for(let i=0; i<5; i++) {
            const dataStr = `${currDate.getFullYear()}-${String(currDate.getMonth()+1).padStart(2,'0')}-${String(currDate.getDate()).padStart(2,'0')}`;
            let diaHtml = ''; let temAulasDia = false;
            
            blocosKeys.forEach(bId => {
                const disc = hb[`${dataStr}_${bId}`];
                if(disc) {
                    // Placeholder para o Professor que virá do Firebase futuramente
                    diaHtml += `<div class="horario-list-item">
                                    <div class="horario-time-col">${blocosTempo[bId]}</div>
                                    <div class="horario-disc-col">
                                        <div class="horario-disc-name">${disc}</div>
                                        <div class="horario-prof">Prof. A Atribuir</div>
                                    </div>
                                </div>`;
                    temAulasDia = true; temAulasGeral = true;
                }
            });
            
            if(temAulasDia) {
                html += `<div class="horario-dia-titulo">${diasMap[i]} <span style="font-size:0.8rem; color:var(--text-muted); float:right;">${fDt(currDate)}</span></div>${diaHtml}`;
            }
            currDate.setDate(currDate.getDate() + 1);
        }
        
        subContainer.innerHTML = temAulasGeral ? html : '<p class="text-muted center" style="margin-top:30px;">Sem aulas agendadas nesta semana.</p>';
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
        setTimeout(() => { document.getElementById('ee-atestado-file-name').innerText = ""; document.getElementById('ee-atestado-obs').value = ""; atestadoBase64 = ""; btnRef.style.display = 'none'; btnRef.disabled = false; btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Atestado'; carregarAtestadosEE(); }, 2000);
    } catch(err) { btnRef.innerHTML = "Erro!"; setTimeout(() => { btnRef.disabled = false; btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Atestado'; }, 2000); }
});

async function carregarAtestadosEE() {
    const container = document.getElementById('ee-lista-atestados-container'); container.innerHTML = '<p class="text-muted center">A procurar...</p>';
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
