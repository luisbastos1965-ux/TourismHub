import { collection, updateDoc, getDocs, query, addDoc, doc, getDoc, onSnapshot, orderBy, setDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { FullCalendar } from "https://cdn.jsdelivr.net/npm/fullcalendar@6.1.11/index.global.min.js"; // Helper

let dbInstance;
const ordemDisciplinasGlobal = ['PORT', 'ING', 'AI', 'EF', 'TIC', 'GEO', 'HCA', 'MAT', 'CF', 'TIAT', 'TCAT', 'OTET'];

export function initViews(dbObj) {
    dbInstance = dbObj;
    setupCaderneta();
    setupForum();
    setupEstudo();
}

// ------------------------------------------------------------------
// DASHBOARD ADAPTATIVO
// ------------------------------------------------------------------
export async function carregarHomeAdaptativa() {
    const container = document.getElementById('dynamic-hero-section');
    if(!container) return;

    let temFaltas = 0; let eventosBreves = []; let prhfsAtivos = 0; let prhfHorasResolver = 0; let modReprovados = 0;

    const faltasSnap = await getDocs(collection(dbInstance, "utilizadores", window.myUserId, "faltas"));
    faltasSnap.forEach(d => { const f = d.data(); if (!f.justificada && !f.comprovativoEnviado) temFaltas++; });

    const notasSnap = await getDocs(collection(dbInstance, "utilizadores", window.myUserId, "notas"));
    notasSnap.forEach(d => { const val = d.data().nota; if (val === 'REP' || Number(val) < 10) modReprovados++; });

    if (window.minhaTurma) {
        const evSnap = await getDocs(collection(dbInstance, "turmas", window.minhaTurma, "eventos"));
        const hoje = new Date(); const daquiA7Dias = new Date(); daquiA7Dias.setDate(hoje.getDate() + 7);
        const hojeISO = hoje.toISOString().split('T')[0]; const limiteISO = daquiA7Dias.toISOString().split('T')[0];
        evSnap.forEach(d => { const e = d.data(); if (e.data >= hojeISO && e.data <= limiteISO && ['teste','avaliacao','entrega','trabalho'].includes(e.tipo)) { eventosBreves.push(e); }});
        eventosBreves.sort((a,b) => a.data.localeCompare(b.data));
    }

    const prhfSnap = await getDocs(collection(dbInstance, "utilizadores", window.myUserId, "prhfs"));
    prhfSnap.forEach(d => { const p = d.data(); if (p.status !== 'concluida') { prhfsAtivos++; prhfHorasResolver += Number(p.horasPresenciais || 0); } });

    let heroHTML = ''; let showHumorAndMission = false;

    if (temFaltas > 0 || prhfsAtivos > 0 || modReprovados > 0) {
        heroHTML = `<div class="card" style="background: linear-gradient(135deg, #ff4d4d, #cc0000); color: white; border: none; border-radius: 16px; margin-bottom: 20px;">
                        <h3 style="margin-bottom:10px; font-size: 1.8rem;"><i class="fa-solid fa-triangle-exclamation"></i> Ação Necessária</h3>
                        <p style="font-size: 1.1rem; margin-bottom: 15px; opacity: 0.9;">Tens pendências urgentes que prejudicam a tua avaliação.</p>
                        <ul style="margin-bottom: 20px; padding-left: 20px; font-size: 1.1rem; font-weight: bold; line-height: 1.6;">
                            ${temFaltas > 0 ? `<li>${temFaltas} Falta(s)</li>` : ''}
                            ${modReprovados > 0 ? `<li>${modReprovados} Módulo(s) Reprovado(s)</li>` : ''}
                            ${prhfsAtivos > 0 ? `<li>${prhfsAtivos} PRHF(s) em curso (${prhfHorasResolver}h presenciais)</li>` : ''}
                        </ul>
                        <button class="primary-btn" style="background: white; color: #cc0000; font-size: 1.1rem; padding: 15px;" onclick="document.querySelector('.nav-item[data-target=\\'view-aluno-caderneta\\']').click()">Abrir Caderneta e Resolver</button>
                    </div>`;
    } else if (eventosBreves.length > 0) {
        const ev = eventosBreves[0]; const dataF = ev.data.split('-').reverse().join('/');
        heroHTML = `<div class="card" style="background: linear-gradient(135deg, #ffaa00, #e67e22); color: white; border: none; border-radius: 16px; margin-bottom: 20px;">
                        <h3 style="margin-bottom:10px; font-size: 1.8rem;"><i class="fa-solid fa-calendar-exclamation"></i> Foco Total</h3>
                        <p style="font-size: 1.1rem; margin-bottom: 15px; opacity: 0.9;">Tens <strong>${ev.titulo}</strong> no dia ${dataF}. Que tal iniciares um Pomodoro de 25m agora para adiantares estudo?</p>
                        <button class="primary-btn" style="background: white; color: #e67e22; width: 100%; font-size: 1.1rem; padding: 15px;" id="btn-hero-pomodoro"><i class="fa-solid fa-stopwatch"></i> Iniciar Pomodoro</button>
                    </div>`;
        showHumorAndMission = true;
    } else {
        heroHTML = `<div class="card" style="background: linear-gradient(135deg, #00cc88, #009966); color: white; border: none; border-radius: 16px; margin-bottom: 20px;">
                        <h3 style="margin-bottom:5px; font-size: 1.6rem;"><i class="fa-solid fa-leaf"></i> Dia Tranquilo</h3>
                        <p style="font-size: 1.05rem; margin-bottom: 0; opacity: 0.9;">Não tens avaliações marcadas para os próximos dias nem pendências. Excelente altura para adiantares os teus resumos!</p>
                    </div>`;
        showHumorAndMission = true;
    }

    let secundariosHTML = '';
    if(showHumorAndMission) {
        if (window.minhaTurma) {
            const turmaSnap = await getDoc(doc(dbInstance, "turmas", window.minhaTurma));
            if (turmaSnap.exists() && turmaSnap.data().missaoTitulo) {
                const tData = turmaSnap.data();
                secundariosHTML += `<div class="card" id="missao-card" style="border-left: 4px solid var(--warning-yellow); margin-bottom: 20px;"><h3 style="font-size: 1rem; margin-bottom: 5px;"><i class="fa-solid fa-users"></i> Missão da Turma</h3><p style="font-size:0.85rem; color:var(--text-muted); margin-bottom: ${tData.missaoProgresso !== undefined ? '10px' : '0'};">${tData.missaoTitulo}</p>${tData.missaoProgresso !== undefined ? `<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${tData.missaoProgresso}%; background:var(--warning-yellow);"></div></div>` : ''}</div>`;
            }
        }
        const hojeIso = new Date().toISOString().split('T')[0];
        const humorSnap = await getDoc(doc(dbInstance, "utilizadores", window.myUserId, "humor", hojeIso));
        if (!humorSnap.exists()) {
            secundariosHTML += `<div class="card" id="checkin-card-dinamico" style="border-left: 4px solid #b82bf2; margin-bottom: 20px;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;"><h3 style="font-size: 1rem; margin:0;"><i class="fa-solid fa-heart-pulse"></i> Como te sentes hoje?</h3></div><div style="display: flex; justify-content: space-around; font-size: 2.2rem;" id="mood-buttons-dinamicos"><span class="mood-btn-dinamico" data-mood="😡" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">😡</span><span class="mood-btn-dinamico" data-mood="🙁" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">🙁</span><span class="mood-btn-dinamico" data-mood="😐" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">😐</span><span class="mood-btn-dinamico" data-mood="🙂" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">🙂</span><span class="mood-btn-dinamico" data-mood="🤩" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">🤩</span></div></div>`;
        }
    }

    container.innerHTML = heroHTML + secundariosHTML;

    // Conectar botão herói se existir
    document.getElementById('btn-hero-pomodoro')?.addEventListener('click', () => { document.getElementById('btn-open-study-mode').click(); });

    // Humor dinâmico
    document.querySelectorAll('.mood-btn-dinamico').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const mood = e.currentTarget.getAttribute('data-mood'); const hojeIso = new Date().toISOString().split('T')[0];
            const snap = await getDoc(doc(dbInstance, "utilizadores", window.myUserId)); let atualXp = snap.exists() && snap.data().xp ? snap.data().xp : 0;
            await setDoc(doc(dbInstance, "utilizadores", window.myUserId, "humor", hojeIso), { humor: mood, timestamp: Date.now(), dataIso: hojeIso });
            await updateDoc(doc(dbInstance, "utilizadores", window.myUserId), { xp: atualXp + 10 });
            document.getElementById('checkin-card-dinamico').innerHTML = '<div style="text-align:center; color:var(--success-green); font-weight:bold; font-size:0.95rem; padding: 10px;">Obrigado pelo teu registo! <span style="color:var(--warning-yellow);">+10 XP</span></div>';
            carregarGamificacao({xp: atualXp + 10});
        });
    });
}

// ------------------------------------------------------------------
// ESTATÍSTICAS E PERFIL
// ------------------------------------------------------------------
export function carregarGamificacao(dados) {
    const xp = dados.xp || 0; const nivel = Math.floor(xp / 100) + 1; const xpNivelAtual = (nivel - 1) * 100; const progresso = ((xp - xpNivelAtual) / 100) * 100;
    document.getElementById('aluno-nivel').innerText = nivel; document.getElementById('aluno-xp-atual').innerText = xp; document.getElementById('perfil-xp-totais').innerText = xp; document.getElementById('perfil-xp-progress').style.width = `${progresso}%`;
    let rank = "Novato"; if (nivel >= 2) rank = "Aprendiz"; if (nivel >= 5) rank = "Estudante PRO"; if (nivel >= 10) rank = "Veterano"; if (nivel >= 20) rank = "Lenda";
    document.getElementById('aluno-rank-title').innerText = rank; document.getElementById('perfil-titulo-central').innerText = rank;
}

let chartInstance = null;
export function renderizarGraficoNotas() {
    const ctx = document.getElementById('chart-notas-aluno'); if(!ctx) return;
    try {
        getDocs(collection(dbInstance, "utilizadores", window.myUserId, "notas")).then(notasDb => {
            let mapNotas = {};
            notasDb.forEach(d => { const n = d.data(); if(n.nota !== 'REP' && !isNaN(n.nota)) { if(!mapNotas[n.disciplina]) mapNotas[n.disciplina] = { soma: 0, cont: 0 }; mapNotas[n.disciplina].soma += Number(n.nota); mapNotas[n.disciplina].cont++; } });
            let labels = []; let data = []; let bgColors = [];
            Object.keys(mapNotas).forEach(disc => { labels.push(disc); const media = (mapNotas[disc].soma / mapNotas[disc].cont).toFixed(1); data.push(media); bgColors.push(media >= 10 ? '#00cc88' : '#ff4d4d'); });
            if(labels.length === 0) { labels = ["Sem Dados"]; data = [0]; bgColors = ["#333"]; }
            if(chartInstance) chartInstance.destroy();
            chartInstance = new Chart(ctx, { type: 'bar', data: { labels: labels, datasets: [{ label: 'Média', data: data, backgroundColor: bgColors, borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 20 }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } } });
        });
    } catch(e) {}
}

export async function carregarEstatisticasEstudo() {
    try {
        const estudosSnap = await getDocs(query(collection(dbInstance, "utilizadores", window.myUserId, "estudos")));
        let totalSessions = 0; let diasUnicos = new Set();
        estudosSnap.forEach(d => { totalSessions++; if(d.data().data) { diasUnicos.add(d.data().data.split('T')[0]); } });
        const totalMinutes = totalSessions * 25; document.getElementById('total-minutos-foco').innerText = totalMinutes > 60 ? `${Math.floor(totalMinutes/60)}h${totalMinutes%60}m` : `${totalMinutes}m`;
        let streak = 0; let datasOrdenadas = Array.from(diasUnicos).sort((a,b) => b.localeCompare(a));
        if (datasOrdenadas.length > 0) {
            let hoje = new Date(); let dataTeste = new Date(hoje); const hojeStr = dataTeste.toISOString().split('T')[0]; dataTeste.setDate(dataTeste.getDate() - 1); const ontemStr = dataTeste.toISOString().split('T')[0];
            if (datasOrdenadas.includes(hojeStr) || datasOrdenadas.includes(ontemStr)) { let cv = new Date(datasOrdenadas[0]); for(let i=0; i<datasOrdenadas.length; i++) { if(datasOrdenadas.includes(cv.toISOString().split('T')[0])) { streak++; cv.setDate(cv.getDate() - 1); } else break; } }
        }
        document.getElementById('streak-dias').innerText = streak;
    } catch(e) {}
}

export async function carregarObjetivosPessoais() {
    const cont = document.getElementById('lista-objetivos-container'); cont.innerHTML = '<p class="text-muted center">A carregar...</p>';
    try {
        const snap = await getDocs(query(collection(dbInstance, "utilizadores", window.myUserId, "objetivos"), orderBy("timestamp", "desc")));
        let html = '';
        snap.forEach(d => {
            const obj = d.data(); const checkColor = obj.concluido ? 'var(--success-green)' : '#444'; const textDec = obj.concluido ? 'line-through' : 'none'; const textColor = obj.concluido ? 'var(--text-muted)' : 'white';
            html += `<div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:8px; border-left: 3px solid ${checkColor};">
                        <div style="display:flex; align-items:center; gap:12px; flex:1;">
                            <div onclick="window.toggleObjetivo('${d.id}', ${!obj.concluido})" style="width:24px; height:24px; border-radius:50%; border:2px solid ${checkColor}; background:${obj.concluido ? checkColor : 'transparent'}; display:flex; align-items:center; justify-content:center; cursor:pointer;">${obj.concluido ? '<i class="fa-solid fa-check" style="color:var(--bg-dark); font-size:0.75rem;"></i>' : ''}</div>
                            <span style="text-decoration:${textDec}; color:${textColor}; font-size:0.95rem;">${obj.texto}</span>
                        </div><i class="fa-solid fa-trash" style="color:var(--danger-red); cursor:pointer;" onclick="window.apagarObjetivo('${d.id}')"></i>
                     </div>`;
        });
        cont.innerHTML = html === '' ? '<p class="text-muted center" style="font-size:0.85rem;">Não tens metas ativas.</p>' : html;
    } catch(e) {}
}

export async function carregarHistoricoHumor() {
    const cont = document.getElementById('mood-history-container'); cont.innerHTML = '<p class="text-muted center">A atualizar...</p>';
    try {
        const res = await getDocs(query(collection(dbInstance, "utilizadores", window.myUserId, "humor"), orderBy("timestamp", "desc")));
        let html = '<div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px;">';
        res.forEach(d => { const h = d.data(); html += `<div style="text-align:center; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; min-width:60px;"><div style="font-size:1.8rem;">${h.humor}</div><div style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">${h.dataIso.split('-').reverse().slice(0,2).join('/')}</div></div>`; });
        cont.innerHTML = html + '</div>';
    } catch(e) {}
}


// ------------------------------------------------------------------
// CADERNETA (Notas, Faltas, PRHF)
// ------------------------------------------------------------------
function setupCaderneta() {
    const tabs = ['tab-aluno-timeline', 'tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-comportamento', 'tab-aluno-observacoes'];
    const cCont = document.getElementById('aluno-caderneta-content');

    const switchTab = (idAtiva, isTimeline) => {
        tabs.forEach(id => { const el = document.getElementById(id); if(el) el.classList.remove('active'); });
        document.getElementById(idAtiva).classList.add('active');
        document.getElementById('timeline-filtros').style.display = isTimeline ? 'flex' : 'none';
        cCont.innerHTML = '<p class="text-muted center">A carregar...</p>';
    };

    document.getElementById('tab-aluno-timeline')?.addEventListener('click', () => { switchTab('tab-aluno-timeline', true); carregarTimelineAluno(); });
    document.getElementById('tab-aluno-notas')?.addEventListener('click', () => { switchTab('tab-aluno-notas', false); carregarNotasAluno(); });
    document.getElementById('tab-aluno-faltas')?.addEventListener('click', () => { switchTab('tab-aluno-faltas', false); carregarFaltasAluno(); });
    document.getElementById('tab-aluno-prhfs')?.addEventListener('click', () => { switchTab('tab-aluno-prhfs', false); carregarPrhfsAluno(); });

    // Botões Grelha Horário
    document.getElementById('btn-aluno-horario-dia')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('btn-aluno-horario-grelha').classList.remove('active'); document.getElementById('aluno-horario-container').style.display = 'block'; });
}

export async function obterEventosLinhaTemporal() {
    let ev = [];
    const notasSnap = await getDocs(collection(dbInstance, "utilizadores", window.myUserId, "notas")); notasSnap.forEach(d => { const n = d.data(); ev.push({ time: new Date(n.data).getTime(), cat: 'notas', icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', titulo: 'Nova Avaliação Lançada', desc: `${n.disciplina} (Mod. ${n.modulo}): <strong>${n.nota}</strong>` }); });
    const faltasSnap = await getDocs(collection(dbInstance, "utilizadores", window.myUserId, "faltas")); faltasSnap.forEach(d => { const f = d.data(); ev.push({ time: new Date(f.criadoEm || f.dataInicio).getTime(), cat: 'faltas', icon: '<i class="fa-solid fa-user-xmark"></i>', cor: f.justificada ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Falta a ${f.disciplina} (${f.horas}h)`, desc: f.justificada ? `Estado: Justificada` : `Falta registada` }); });
    const humorSnap = await getDocs(collection(dbInstance, "utilizadores", window.myUserId, "humor")); humorSnap.forEach(d => { const h = d.data(); ev.push({ time: h.timestamp, cat: 'gamificacao', icon: '<i class="fa-solid fa-heart-pulse"></i>', cor: '#b82bf2', titulo: `Check-in Emocional`, desc: `Sentiste-te ${h.humor} (+10 XP)` }); });
    ev.sort((a,b) => b.time - a.time); return ev;
}

export async function carregarTimelineAluno() {
    const cCont = document.getElementById('aluno-caderneta-content');
    try {
        let eventos = await obterEventosLinhaTemporal();
        if(eventos.length === 0) { cCont.innerHTML = '<p class="text-muted center" style="margin-top:40px;">O teu histórico está limpo.</p>'; return; }
        let html = '<div class="timeline">'; eventos.forEach(ev => { html += `<div class="timeline-item"><div class="timeline-icon" style="color: ${ev.cor}; border-color: ${ev.cor};">${ev.icon}</div><div class="timeline-content" style="border-left: 3px solid ${ev.cor};"><span class="timeline-date">${new Date(ev.time).toLocaleDateString('pt-PT')}</span><strong style="color:white; display:block; margin-bottom:5px;">${ev.titulo}</strong><p style="font-size:0.85rem; color:var(--text-light); margin:0;">${ev.desc}</p></div></div>`; }); cCont.innerHTML = html + '</div>';
    } catch(e) {}
}

async function carregarNotasAluno() {
    const cCont = document.getElementById('aluno-caderneta-content');
    try {
        const notasDb = await getDocs(collection(dbInstance, "utilizadores", window.myUserId, "notas"));
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
        const faltasDb = await getDocs(collection(dbInstance, "utilizadores", window.myUserId, "faltas"));
        let faltasObj = {}; faltasDb.forEach(d => { const f = d.data(); if(!faltasObj[f.disciplina]) faltasObj[f.disciplina] = []; faltasObj[f.disciplina].push(f); });

        const prhfsDb = await getDocs(collection(dbInstance, "utilizadores", window.myUserId, "prhfs"));
        let hrsRec = {}; prhfsDb.forEach(d => { const p = d.data(); if (p.status === 'concluida') { hrsRec[p.disciplina] = (hrsRec[p.disciplina] || 0) + Number(p.horasTotais || 50); } });

        let html = '';
        ordemDisciplinasGlobal.forEach(disc => {
            let totF = 0; let fHtml = '';
            if(faltasObj[disc]) {
                faltasObj[disc].sort((a,b) => b.dataInicio.localeCompare(a.dataInicio));
                faltasObj[disc].forEach(f => {
                    totF += Number(f.horas || 0);
                    const sc = f.justificada ? 'var(--success-green)' : 'var(--danger-red)'; const st = f.justificada ? 'Justificada' : 'Injustificada'; 
                    fHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px dashed #333;"><div><strong style="color:white; font-size:0.9rem;">Falta (${f.horas}h)</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${f.dataInicio}</span></div><span style="font-size:0.75rem; font-weight:bold; color:${sc}; padding:4px 8px; background:rgba(255,255,255,0.05); border-radius:12px;">${st}</span></div>`;
                });
            }

            const rec = hrsRec[disc] || 0; let fEfetivas = totF - rec; if(fEfetivas < 0) fEfetivas = 0;
            let assiduidade = 100 - ((fEfetivas / 50) * 100); if (assiduidade < 0) assiduidade = 0;
            let barraColor = assiduidade < 80 ? 'var(--danger-red)' : (assiduidade < 90 ? 'var(--warning-yellow)' : 'var(--success-green)');

            if(faltasObj[disc] && faltasObj[disc].length > 0) {
                html += `<div class="card" style="margin-bottom:15px; padding:15px; border-left: 4px solid ${barraColor};">
                            <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                                <div><strong style="font-size: 1.1rem; color:white;">${disc}</strong><div style="font-size: 0.8rem; color:var(--text-muted); margin-top:3px;">${totF}h Faltadas ${rec>0? `(<span style="color:var(--success-green);">${rec}h Recup.</span>)`:''}</div></div>
                                <div style="text-align:right;"><div style="font-weight:bold; color:${barraColor};">${assiduidade.toFixed(0)}%</div><div style="font-size:0.7rem; color:var(--text-muted);">Assiduidade</div></div>
                            </div>
                            <div style="display:none; margin-top:15px; border-top:1px solid #333; padding-top:10px;">${fHtml}</div>
                         </div>`;
            } else { html += `<div class="card" style="margin-bottom:10px; padding:15px; border-left: 4px solid var(--success-green); display:flex; justify-content:space-between; align-items:center;"><strong style="font-size: 1rem; color:var(--text-muted);">${disc}</strong><div style="text-align:right;"><div style="font-weight:bold; color:var(--success-green);">100%</div></div></div>`; }
        });
        cCont.innerHTML = html;
    } catch(e) {}
}

async function carregarPrhfsAluno() {
    const cCont = document.getElementById('aluno-caderneta-content');
    try {
        const prhfsDb = await getDocs(collection(dbInstance, "utilizadores", window.myUserId, "prhfs"));
        if(prhfsDb.empty) { cCont.innerHTML = '<p class="text-muted center">Não tens Planos de Recuperação.</p>'; return; }
        let prhfsArr = []; prhfsDb.forEach(d => { prhfsArr.push({id: d.id, ...d.data()}); });
        prhfsArr.sort((a,b) => new Date(a.prazo) - new Date(b.prazo));
        
        let html = ''; 
        prhfsArr.forEach(p => { 
            const isUrgente = p.moduloTerminado === true || p.moduloTerminado === "true"; 
            const cor = isUrgente ? 'var(--danger-red)' : 'var(--warning-yellow)';
            const txtSt = p.status === 'concluida' ? 'CONCLUÍDO' : (isUrgente ? 'URGENTE' : 'EM CURSO');
            const corFinal = p.status === 'concluida' ? 'var(--success-green)' : cor;
            const hTot = Number(p.horasTotais || 50); const hPres = Number(p.horasPresenciais || 0); const hAut = hTot - hPres;
            
            const anexoHTML = p.anexoBase64 ? `<a href="${p.anexoBase64}" download="PRHF_${p.disciplina}" class="secondary-btn small-btn" style="margin-bottom:10px; color:var(--primary-green); border-color:var(--primary-green);"><i class="fa-solid fa-download"></i> Documento de Apoio (Prof)</a>` : '';
            const fpHTML = p.feedbackProfessor ? `<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; margin-bottom:10px; font-size:0.85rem;"><strong style="color:var(--primary-green);">Professor:</strong> ${p.feedbackProfessor}</div>` : '';
            const propHTML = p.propostaAluno ? `<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; margin-bottom:15px; font-size:0.85rem;"><strong style="color:var(--warning-yellow);">A tua Proposta:</strong> ${p.propostaAluno} <br><span style="color:${p.propostaLidaDT ? 'var(--success-green)' : 'var(--text-muted)'}; font-size:0.75rem;"><i class="fa-solid ${p.propostaLidaDT ? 'fa-check-double' : 'fa-check'}"></i> ${p.propostaLidaDT ? 'Validada' : 'A aguardar validação'}</span></div>` : '';

            html += `<div class="card" style="margin-bottom:15px; border-left: 4px solid ${corFinal};">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <strong style="font-size: 1.1rem; color:white;">${p.disciplina} (Mod. ${p.modulo})</strong><span style="color:${corFinal}; font-size:0.75rem; font-weight:bold;">${txtSt}</span>
                        </div>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">${p.descricao}</p>
                        ${anexoHTML} ${fpHTML} ${propHTML}
                        <div style="font-size:0.8rem; margin-bottom: 15px; border-top:1px dashed #333; padding-top:10px;">Data Limite: <strong style="color:${corFinal};">${p.prazo}</strong><br>Trabalho Autónomo: <strong>${hAut}h</strong></div>
                        ${p.status !== 'concluida' ? `<button class="primary-btn small-btn" style="width:100%; background-color:${corFinal}; color:${corFinal === 'var(--warning-yellow)' ? 'black' : 'white'};" onclick="window.abrirAcaoPrhf('${p.id}', '${p.disciplina}', '${p.modulo}', '${p.prazo}')"><i class="fa-solid fa-calendar-plus"></i> Agendar Sessão Presencial</button>` : ''}
                    </div>`; 
        }); 
        cCont.innerHTML = html;
    } catch(e) {}
}

window.abrirAcaoPrhf = (id, disc, mod, prazo) => {
    document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
    document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none');
    document.getElementById('view-aluno-acao-prhf').style.display = 'block';
    
    document.getElementById('prhf-acao-titulo').innerText = `${disc} (Mod. ${mod})`;
    document.getElementById('prhf-acao-prazo').innerText = prazo;
    
    document.getElementById('btn-voltar-acao-prhf').onclick = () => {
        document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none');
        document.querySelector('.nav-item[data-target="view-aluno-caderneta"]').classList.add('active');
        document.getElementById('view-aluno-caderneta').style.display = 'block';
        carregarPrhfsAluno(); 
    };

    document.getElementById('btn-enviar-proposta-prhf').onclick = async (e) => {
        const dataVal = document.getElementById('aluno-prhf-proposta-data').value;
        const hInicio = document.getElementById('aluno-prhf-proposta-hora-inicio').value;
        const hFim = document.getElementById('aluno-prhf-proposta-hora-fim').value;
        if(!dataVal || !hInicio || !hFim) { alert("Preenche a data e horas!"); return; }
        
        const btn = e.currentTarget; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
        try {
            await updateDoc(doc(dbInstance, "utilizadores", window.myUserId, "prhfs", id), { propostaAluno: `Data: ${dataVal} | Das ${hInicio} às ${hFim}`, propostaLidaDT: false });
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviado'; btn.style.backgroundColor = 'var(--success-green)';
            setTimeout(() => { document.getElementById('btn-voltar-acao-prhf').click(); btn.innerHTML = 'Enviar Proposta ao Professor'; btn.disabled = false; btn.style.backgroundColor = 'var(--primary-green)';}, 1500);
        } catch(err) { btn.innerHTML = "Erro"; setTimeout(() => { btn.disabled = false; }, 1500); }
    };
};

// ------------------------------------------------------------------
// FÓRUNS
// ------------------------------------------------------------------
function setupForum() {
    document.getElementById('btn-create-chat-aluno')?.addEventListener('click', () => { document.getElementById('modal-criar-forum').style.display = 'flex'; });
    document.getElementById('btn-cancelar-novo-forum')?.addEventListener('click', () => { document.getElementById('modal-criar-forum').style.display = 'none'; document.getElementById('input-nome-novo-forum').value = ''; });
    document.getElementById('btn-confirmar-novo-forum')?.addEventListener('click', async () => {
        const nomeGrupo = document.getElementById('input-nome-novo-forum').value.trim(); if(!nomeGrupo) return;
        try { await addDoc(collection(dbInstance, "turmas", window.minhaTurma, "foruns"), { nome: nomeGrupo, tipo: 'permanente', isDefault: false, membros: [window.myUserId], criadoPor: window.myUserName }); document.getElementById('modal-criar-forum').style.display = 'none'; document.getElementById('input-nome-novo-forum').value = ''; carregarForuns(); } catch(e) {}
    });
}

export async function carregarForuns() {
    const container = document.getElementById('aluno-forum-channel-list'); container.innerHTML = '<p class="text-muted center">A configurar fóruns...</p>'; if(!window.minhaTurma) return;
    let html = `<h3 style="font-size:1rem; color:var(--text-muted); margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">Apoio & Turma</h3><div class="canal-card" data-id="turma_global" data-nome="Turma ${window.minhaTurma}"><div class="canal-icon" style="color:#00cc88; border-color:#00cc88;"><i class="fa-solid fa-users"></i></div><div class="canal-info"><h4>Turma ${window.minhaTurma}</h4><p>Canal Geral</p></div></div><div class="canal-card" data-id="dt_${window.myUserId}" data-nome="Chat DT"><div class="canal-icon" style="color:#ffaa00; border-color:#ffaa00;"><i class="fa-solid fa-user-tie"></i></div><div class="canal-info"><h4>Diretor de Turma</h4><p>Mensagem Privada</p></div></div><h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Disciplinas</h3><div style="display:flex; flex-wrap:wrap; gap:10px;">`;
    ordemDisciplinasGlobal.forEach(disc => { html += `<div class="canal-card" data-id="disc_${disc}" data-nome="Fórum ${disc}" style="flex: 1 1 45%; padding: 10px;"><div class="canal-info" style="text-align:center;"><h4 style="margin:0; font-size:0.9rem; color:#00d2ff;"><i class="fa-solid fa-book-open"></i> ${disc}</h4></div></div>`; }); html += '</div>';
    try {
        const res = await getDocs(collection(dbInstance, "turmas", window.minhaTurma, "foruns")); let extrasHtml = '';
        res.forEach(docSnap => { const f = docSnap.data(); if(f.membros.includes(window.myUserId) && !f.isDefault) { extrasHtml += `<div class="canal-card" data-id="${docSnap.id}" data-nome="${f.nome}"><div class="canal-icon" style="color:#b82bf2; border-color:#b82bf2;"><i class="fa-solid fa-comments"></i></div><div class="canal-info"><h4>${f.nome}</h4><p>Grupo de Trabalho</p></div></div>`; } });
        if (extrasHtml !== '') html += `<h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Grupos de Trabalho</h3>` + extrasHtml;
    } catch(e) {}
    container.innerHTML = html;
}

// ------------------------------------------------------------------
// POMODORO & MÚSICA
// ------------------------------------------------------------------
function setupEstudo() {
    let pomodoroTimer; let pomodoroRestante = 25 * 60; 
    document.getElementById('btn-start-study')?.addEventListener('click', (e) => {
        e.currentTarget.style.display = 'none'; document.getElementById('btn-stop-study').style.display = 'inline-block';
        pomodoroTimer = setInterval(() => {
            pomodoroRestante--;
            const m = Math.floor(pomodoroRestante / 60).toString().padStart(2, '0'); const s = (pomodoroRestante % 60).toString().padStart(2, '0');
            document.getElementById('study-timer-text').innerText = `${m}:${s}`;
            if(pomodoroRestante <= 0) { clearInterval(pomodoroTimer); document.getElementById('study-controls').style.display = 'none'; document.getElementById('post-study-log').style.display = 'block'; }
        }, 1000);
    });

    document.getElementById('btn-stop-study')?.addEventListener('click', () => {
        clearInterval(pomodoroTimer); pomodoroRestante = 25 * 60; document.getElementById('study-timer-text').innerText = "25:00"; document.getElementById('btn-stop-study').style.display = 'none'; document.getElementById('btn-start-study').style.display = 'inline-block';
    });

    document.getElementById('btn-load-music')?.addEventListener('click', () => {
        const url = document.getElementById('pomodoro-music-url').value.trim(); const iframeContainer = document.getElementById('music-player-frame');
        if(!url) return;
        if (url.includes('spotify.com')) { iframeContainer.innerHTML = `<iframe style="border-radius:12px" src="${url.replace("open.spotify.com", "open.spotify.com/embed")}" width="100%" height="80" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`; iframeContainer.style.display = 'block'; } 
        else if (url.includes('youtube.com') || url.includes('youtu.be')) {
            let videoId = url.includes('youtu.be/') ? url.split('youtu.be/')[1].split('?')[0] : (url.includes('v=') ? url.split('v=')[1].split('&')[0] : "");
            if (videoId) { iframeContainer.innerHTML = `<iframe width="100%" height="150" src="https://www.youtube.com/embed/${videoId}" frameborder="0" allowfullscreen></iframe>`; iframeContainer.style.display = 'block'; }
        }
    });

    // Toggle Tabs Caderno
    document.getElementById('tab-caderno-resumos')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-caderno-galeria').classList.remove('active'); document.getElementById('sec-caderno-resumos').style.display = 'block'; document.getElementById('sec-caderno-galeria').style.display = 'none'; });
    document.getElementById('tab-caderno-galeria')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-caderno-resumos').classList.remove('active'); document.getElementById('sec-caderno-resumos').style.display = 'none'; document.getElementById('sec-caderno-galeria').style.display = 'block'; });
}

// ------------------------------------------------------------------
// GLOBAL HELPERS
// ------------------------------------------------------------------
window.toggleObjetivo = async (id, status) => { try { await updateDoc(doc(dbInstance, "utilizadores", window.myUserId, "objetivos", id), { concluido: status }); if(status) { const snap = await getDoc(doc(dbInstance, "utilizadores", window.myUserId)); let xp = snap.exists() && snap.data().xp ? snap.data().xp : 0; await updateDoc(doc(dbInstance, "utilizadores", window.myUserId), { xp: xp + 50 }); carregarGamificacao({xp: xp+50}); } carregarObjetivosPessoais(); } catch(e) {} };
window.apagarObjetivo = async (id) => { if(confirm("Queres mesmo eliminar este objetivo?")) { try { await deleteDoc(doc(dbInstance, "utilizadores", window.myUserId, "objetivos", id)); carregarObjetivosPessoais(); } catch(e) {} } };

async function pedirPermissaoNotificacoes() { try { const permission = await Notification.requestPermission(); if (permission === 'granted') { const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js'); const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }); if (currentToken) { await updateDoc(doc(dbInstance, "utilizadores", window.myUserId), { tokenNotificacao: currentToken }); } } } catch (error) { console.error("Erro fatal ao ativar notificações:", error); } }
if(typeof onMessage !== "undefined" && messaging) { onMessage(messaging, (payload) => { alert(`NOVA NOTIFICAÇÃO:\n\n${payload.notification.title}\n${payload.notification.body}`); }); }
setTimeout(() => { if(window.myUserId) pedirPermissaoNotificacoes(); }, 4000);
