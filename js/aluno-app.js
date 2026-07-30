import { auth, db, messaging, VAPID_KEY, getToken, onMessage } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, updateDoc, getDocs, query, addDoc, onSnapshot, orderBy, setDoc, enableIndexedDbPersistence, deleteDoc, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const ordemDisciplinasGlobal = ['PORT', 'ING', 'AI', 'EF', 'TIC', 'GEO', 'HCA', 'MAT', 'CF', 'TIAT', 'TCAT', 'OTET'];

try { await enableIndexedDbPersistence(db); console.log("Offline OK!"); } catch (e) {}

let myUserId = "", myUserName = "", minhaTurma = "";
let chartInstance = null; let quillEditor = null;

// ==========================================
// 1. INICIALIZAÇÃO
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            if (docSnap.exists() && docSnap.data().papel === 'aluno') {
                const d = docSnap.data(); myUserName = d.nome.split(' ')[0]; minhaTurma = d.turma;
                document.getElementById('header-user-name-aluno').innerText = myUserName;
                document.getElementById('welcome-nome').innerText = myUserName;
                document.getElementById('perfil-nome-central').innerText = d.nome || myUserName;
                
                if(d.fotoPerfil) {
                    document.getElementById('header-avatar-circle').innerHTML = `<img src="${d.fotoPerfil}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    document.getElementById('perfil-avatar-img').src = d.fotoPerfil;
                }
                
                const objSelect = document.getElementById('obj-disciplina');
                if(objSelect) objSelect.innerHTML = ordemDisciplinasGlobal.map(dc => `<option value="${dc}">${dc}</option>`).join('');

                carregarDadosPassaporte(d); carregarGamificacao(d);
                await construirHomeAdaptativa();
                verificarEpocaExames();
            } else window.location.href = "index.html";
        } catch (e) { console.error("Erro Auth", e); }
    } else window.location.href = "index.html";
});

document.getElementById('btn-logout-aluno')?.addEventListener('click', () => signOut(auth));

// ==========================================
// 2. ROUTING E BOTÕES GLOBAIS
// ==========================================
function esconderTodasAsVistas() { document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none'); }

document.body.addEventListener('click', (e) => {
    // Modo Foco (Home)
    if(e.target.closest('#btn-open-study-mode')) {
        esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById('view-study-mode').style.display = 'flex';
    }
    // Caderno Digital (Home)
    if(e.target.closest('#btn-open-caderno')) {
        esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById('view-aluno-caderno').style.display = 'block';
        if(!quillEditor) quillEditor = new Quill('#quill-editor', { theme: 'snow' }); 
        carregarResumos();
    }
    // Sumários (Home)
    if(e.target.closest('#btn-open-sumarios')) {
        esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById('view-aluno-sumarios').style.display = 'block'; carregarSumariosAluno();
    }
    // Passaporte (Home)
    if(e.target.closest('#btn-abrir-passaporte')) {
        esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById('view-aluno-passaporte').style.display = 'block';
    }
    // Notificações Sino
    if(e.target.closest('#btn-open-notificacoes')) {
        esconderTodasAsVistas(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        document.getElementById('view-aluno-notificacoes').style.display = 'block'; carregarNotificacoesAluno();
    }
    // Botões de Voltar
    if(e.target.closest('#btn-voltar-notificacoes') || e.target.closest('#btn-voltar-caderno') || e.target.closest('#btn-voltar-sumarios') || e.target.closest('#btn-voltar-passaporte') || e.target.closest('#btn-voltar-study')) {
        document.querySelector('.nav-item[data-target="student-dashboard"]').click();
    }
});

// Navegação da Tab Bar
document.querySelectorAll('.nav-item').forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); e.currentTarget.classList.add('active');
        esconderTodasAsVistas(); const tId = e.currentTarget.getAttribute('data-target'); document.getElementById(tId).style.display = 'block';
        
        if(tId === 'view-aluno-perfil') { 
            carregarObjetivosPessoais(); carregarHistoricoHumor(); carregarEstatisticasEstudo();
            setTimeout(renderizarGraficoNotas, 150); 
        }
        if(tId === 'view-aluno-caderneta') document.getElementById('tab-aluno-timeline').click();
        if(tId === 'view-aluno-agenda') document.getElementById('tab-aluno-eventos').click();
        if(tId === 'view-aluno-forum') carregarForuns();
    });
});

// ==========================================
// 3. DASHBOARD ADAPTATIVO MÁGICO
// ==========================================
async function construirHomeAdaptativa() {
    const cont = document.getElementById('dynamic-hero-section'); if(!cont) return;
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

        let html = ''; let mMiss = false;
        if(tFaltas>0 || pAtivos>0 || mRep>0) {
            html += `<div class="card" style="background:linear-gradient(135deg,#ff4d4d,#cc0000); color:white; border:none; border-radius:16px; margin-bottom:20px;">
                <h3 style="margin-bottom:10px; font-size:1.8rem;"><i class="fa-solid fa-triangle-exclamation"></i> Ação Necessária</h3>
                <p style="font-size:1.1rem; margin-bottom:15px; opacity:0.9;">Tens pendências urgentes que prejudicam a tua avaliação.</p>
                <ul style="margin-bottom:20px; padding-left:20px; font-size:1.1rem; font-weight:bold; line-height:1.6;">
                    ${tFaltas>0?`<li>${tFaltas} Falta(s)</li>`:''}${mRep>0?`<li>${mRep} Módulo(s) Reprovado(s)</li>`:''}${pAtivos>0?`<li>${pAtivos} PRHF(s) pendentes (${pHoras}h presenciais)</li>`:''}
                </ul>
                <button class="primary-btn" style="background:white; color:#cc0000; font-size:1.1rem; padding:15px;" onclick="document.querySelector('.nav-item[data-target=\\'view-aluno-caderneta\\']').click()">Abrir Caderneta e Resolver</button>
            </div>`;
        } else if(evs.length>0) {
            const ev = evs[0]; const dF = ev.data.split('-').reverse().join('/');
            html += `<div class="card" style="background:linear-gradient(135deg,#ffaa00,#e67e22); color:white; border:none; border-radius:16px; margin-bottom:20px;">
                <h3 style="margin-bottom:10px; font-size:1.8rem;"><i class="fa-solid fa-calendar-exclamation"></i> Foco Total</h3>
                <p style="font-size:1.1rem; margin-bottom:15px; opacity:0.9;">Tens <strong>${ev.titulo}</strong> no dia ${dF}. Que tal iniciares um Pomodoro agora?</p>
                <button class="primary-btn" style="background:white; color:#e67e22; width:100%; font-size:1.1rem; padding:15px;" onclick="document.getElementById('btn-open-study-mode').click()"><i class="fa-solid fa-stopwatch"></i> Iniciar Pomodoro</button>
            </div>`; mMiss = true;
        } else {
            html += `<div class="card" style="background:linear-gradient(135deg,#00cc88,#009966); color:white; border:none; border-radius:16px; margin-bottom:20px;">
                <h3 style="margin-bottom:5px; font-size:1.6rem;"><i class="fa-solid fa-leaf"></i> Dia Tranquilo</h3>
                <p style="font-size:1.05rem; margin-bottom:0; opacity:0.9;">Não tens avaliações marcadas nem pendências. Excelente altura para os teus resumos!</p>
            </div>`; mMiss = true;
        }

        if(mMiss && minhaTurma) {
            const tSnap = await getDoc(doc(db, "turmas", minhaTurma));
            if(tSnap.exists() && tSnap.data().missaoTitulo) {
                const tm = tSnap.data();
                html += `<div class="card" id="missao-card" style="border-left:4px solid var(--warning-yellow); margin-bottom:20px;"><h3 style="font-size:1rem; margin-bottom:5px;"><i class="fa-solid fa-users"></i> Missão da Turma</h3><p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:${tm.missaoProgresso!==undefined?'10px':'0'};">${tm.missaoTitulo}</p>${tm.missaoProgresso!==undefined?`<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${tm.missaoProgresso}%; background:var(--warning-yellow);"></div></div>`:''}</div>`;
            }
        }

        const hjIso = new Date().toISOString().split('T')[0];
        const hSnap = await getDoc(doc(db, "utilizadores", myUserId, "humor", hjIso));
        if(!hSnap.exists() && mMiss) {
            html += `<div class="card" id="checkin-card-dinamico" style="border-left:4px solid #b82bf2; margin-bottom:20px;"><h3 style="font-size:1rem; margin-bottom:15px;"><i class="fa-solid fa-heart-pulse"></i> Como te sentes hoje?</h3><div style="display:flex; justify-content:space-around; font-size:2.2rem;" id="mood-buttons-dinamicos"><span class="mood-btn-dinamico" data-mood="😡" style="cursor:pointer; filter:grayscale(100%);">😡</span><span class="mood-btn-dinamico" data-mood="🙁" style="cursor:pointer; filter:grayscale(100%);">🙁</span><span class="mood-btn-dinamico" data-mood="😐" style="cursor:pointer; filter:grayscale(100%);">😐</span><span class="mood-btn-dinamico" data-mood="🙂" style="cursor:pointer; filter:grayscale(100%);">🙂</span><span class="mood-btn-dinamico" data-mood="🤩" style="cursor:pointer; filter:grayscale(100%);">🤩</span></div></div>`;
        }
        cont.innerHTML = html;

        document.querySelectorAll('.mood-btn-dinamico').forEach(btn => {
            btn.addEventListener('mouseover',()=>btn.style.filter='grayscale(0%)'); btn.addEventListener('mouseout',()=>btn.style.filter='grayscale(100%)');
            btn.addEventListener('click', async (e) => {
                const m = e.currentTarget.getAttribute('data-mood'); const s = await getDoc(doc(db, "utilizadores", myUserId));
                let aXp = s.exists()&&s.data().xp?s.data().xp:0;
                await setDoc(doc(db, "utilizadores", myUserId, "humor", hjIso), { humor:m, timestamp:Date.now(), dataIso:hjIso });
                await updateDoc(doc(db, "utilizadores", myUserId), { xp: aXp+10 });
                carregarGamificacao({xp: aXp+10}); document.getElementById('checkin-card-dinamico').innerHTML = '<div style="text-align:center; color:var(--success-green); font-weight:bold; font-size:0.95rem; padding:10px;">Obrigado! <span style="color:var(--warning-yellow);">+10 XP</span></div>';
            });
        });
    } catch(e) { cont.innerHTML = '<p class="text-danger center">Erro no assistente.</p>'; }
}

async function verificarEpocaExames() {
    if(!minhaTurma) return;
    const tSnap = await getDoc(doc(db, "turmas", minhaTurma));
    if(tSnap.exists() && tSnap.data().epocaExames?.ativa) {
        document.getElementById('exam-mode-banner').style.display='block'; document.body.style.borderTop="5px solid #8e2de2";
        if(tSnap.data().epocaExames.dataFim) {
            const df = Math.ceil((new Date(tSnap.data().epocaExames.dataFim) - new Date()) / (1000 * 60 * 60 * 24));
            document.getElementById('exam-countdown').innerText = df > 0 ? `Faltam ${df} dias` : "Já terminou";
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
        let resArr = [];
        const rDb = await getDocs(query(collection(db, "utilizadores", myUserId, "apontamentos")));
        rDb.forEach(d => { if(d.data().titulo?.toLowerCase().includes(termo)) resArr.push({ t: 'O Meu Resumo', txt: d.data().titulo, id: 'btn-open-caderno' }); });
        if (minhaTurma) { 
            const sDb = await getDocs(query(collection(db, "turmas", minhaTurma, "sumarios"))); 
            sDb.forEach(d => { if(d.data().titulo?.toLowerCase().includes(termo) || d.data().disciplina?.toLowerCase().includes(termo)) resArr.push({ t: `Sumário - ${d.data().disciplina}`, txt: d.data().titulo, id: 'btn-open-sumarios' }); }); 
        }
        if(resArr.length === 0) box.innerHTML = '<p class="text-muted" style="margin:0; font-size:0.85rem;">Sem resultados.</p>'; 
        else { 
            let h = ''; resArr.forEach(r => h += `<div style="padding:8px; border-bottom:1px solid #333; cursor:pointer;" onclick="document.getElementById('${r.id}').click(); document.getElementById('aluno-search-results').style.display='none'; document.getElementById('aluno-search-input').value='';"><span style="font-size:0.7rem; color:var(--primary-green); text-transform:uppercase;">${r.t}</span><div style="font-size:0.9rem; color:white; margin-top:3px;">${r.txt}</div></div>`); box.innerHTML = h; 
        }
    } catch(err) { box.innerHTML = '<p class="text-danger" style="margin:0;">Erro.</p>'; }
});
document.addEventListener('click', (e) => { if (!e.target.closest('#aluno-search-input') && !e.target.closest('#aluno-search-results')) { document.getElementById('aluno-search-results').style.display = 'none'; } });

// ==========================================
// 5. PERFIL E OBJETIVOS INTELIGENTES
// ==========================================
function carregarGamificacao(dados) {
    const xp = dados.xp || 0; const nivel = Math.floor(xp / 100) + 1; const prog = ((xp - ((nivel - 1) * 100)) / 100) * 100;
    document.getElementById('aluno-nivel').innerText = nivel; document.getElementById('aluno-xp-atual').innerText = xp;
    document.getElementById('perfil-xp-totais').innerText = xp; document.getElementById('perfil-xp-progress').style.width = `${prog}%`;
    let r = "Novato"; if(nivel>=2)r="Aprendiz"; if(nivel>=5)r="Estudante PRO"; if(nivel>=10)r="Veterano"; if(nivel>=20)r="Lenda";
    document.getElementById('aluno-rank-title').innerText = r; document.getElementById('perfil-titulo-central').innerText = r;
}

async function carregarObjetivosPessoais() {
    const cont = document.getElementById('lista-objetivos-container'); cont.innerHTML = '<p class="text-muted center">A carregar...</p>';
    try {
        const notasSnap = await getDocs(collection(db, "utilizadores", myUserId, "notas")); let mapNotas = {};
        notasSnap.forEach(n => { const dt = n.data(); if(dt.nota !== 'REP' && !isNaN(dt.nota)) { const val = Number(dt.nota); if(!mapNotas[dt.disciplina] || val > mapNotas[dt.disciplina]) mapNotas[dt.disciplina] = val; } });

        const snap = await getDocs(query(collection(db, "utilizadores", myUserId, "objetivos"), orderBy("timestamp", "desc")));
        let html = ''; let objGanhouXP = false;
        for (const d of snap.docs) {
            const obj = d.data(); 
            if(!obj.concluido && mapNotas[obj.disciplina] && mapNotas[obj.disciplina] >= Number(obj.notaAlvo)) {
                await updateDoc(doc(db, "utilizadores", myUserId, "objetivos", d.id), { concluido: true });
                obj.concluido = true; objGanhouXP = true;
            }
            const cColor = obj.concluido ? 'var(--success-green)' : '#444'; const txtDec = obj.concluido ? 'line-through' : 'none'; const txtColor = obj.concluido ? 'var(--text-muted)' : 'white';
            html += `<div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:8px; border-left: 3px solid ${cColor};"><div style="display:flex; align-items:center; gap:12px; flex:1;"><div style="width:24px; height:24px; border-radius:50%; border:2px solid ${cColor}; background:${obj.concluido ? cColor : 'transparent'}; display:flex; align-items:center; justify-content:center;">${obj.concluido ? '<i class="fa-solid fa-check" style="color:var(--bg-dark); font-size:0.75rem;"></i>' : ''}</div><span style="text-decoration:${txtDec}; color:${txtColor}; font-size:0.95rem; flex:1;">Tirar <strong>${obj.notaAlvo}</strong> a ${obj.disciplina}</span></div><i class="fa-solid fa-trash" style="color:var(--danger-red); cursor:pointer; font-size:0.9rem; padding: 5px;" onclick="window.apagarObjetivo('${d.id}')"></i></div>`;
        }
        if(objGanhouXP) {
            const userS = await getDoc(doc(db, "utilizadores", myUserId)); let axp = userS.exists()&&userS.data().xp?userS.data().xp:0;
            await updateDoc(doc(db, "utilizadores", myUserId), { xp: axp + 50 }); carregarGamificacao({xp: axp+50}); alert("🎉 Parabéns! Um Objetivo Inteligente foi concluído com base nas tuas Notas! +50 XP");
        }
        cont.innerHTML = html === '' ? '<p class="text-muted center" style="font-size:0.85rem;">Não tens metas ativas. Começa a desafiar-te!</p>' : html;
    } catch(e) {}
}

document.getElementById('btn-add-objetivo')?.addEventListener('click', async () => {
    const disc = document.getElementById('obj-disciplina').value; const nota = document.getElementById('obj-nota-alvo').value;
    if(!disc || !nota) { alert("Preenche a Disciplina e a Nota Alvo."); return; }
    try { await addDoc(collection(db, "utilizadores", myUserId, "objetivos"), { disciplina: disc, notaAlvo: nota, concluido: false, timestamp: Date.now() }); document.getElementById('obj-nota-alvo').value = ''; carregarObjetivosPessoais(); } catch(e) {}
});
window.apagarObjetivo = async (id) => { if(confirm("Apagar objetivo?")) { try { await deleteDoc(doc(db, "utilizadores", myUserId, "objetivos", id)); carregarObjetivosPessoais(); } catch(e) {} } };

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
        const est = await getDocs(query(collection(db, "utilizadores", myUserId, "estudos")));
        let tS = 0; let dU = new Set(); est.forEach(d => { tS++; if(d.data().data) dU.add(d.data().data.split('T')[0]); });
        const tm = tS * 25; document.getElementById('total-minutos-foco').innerText = tm>60?`${Math.floor(tm/60)}h${tm%60}m`:`${tm}m`;
        let stk = 0; let dO = Array.from(dU).sort((a,b)=>b.localeCompare(a));
        if(dO.length>0){
            let hj = new Date(); const hs = hj.toISOString().split('T')[0]; hj.setDate(hj.getDate()-1); const os = hj.toISOString().split('T')[0];
            if(dO.includes(hs)||dO.includes(os)){ let cv = new Date(dO[0]); for(let i=0;i<dO.length;i++){ if(dO.includes(cv.toISOString().split('T')[0])){ stk++; cv.setDate(cv.getDate()-1); } else break; } }
        }
        document.getElementById('streak-dias').innerText = stk;
    } catch(e) {}
}

document.getElementById('btn-view-mood-history')?.addEventListener('click', carregarHistoricoHumor);
async function carregarHistoricoHumor() {
    const c = document.getElementById('mood-history-container'); c.innerHTML = '<p class="text-muted center">A atualizar...</p>';
    try {
        const r = await getDocs(query(collection(db, "utilizadores", myUserId, "humor"), orderBy("timestamp", "desc")));
        let h = '<div style="display:flex;gap:10px;overflow-x:auto;padding-bottom:10px;">';
        r.forEach(d=>{ const hh=d.data(); h+=`<div style="text-align:center;background:rgba(0,0,0,0.3);padding:10px;border-radius:8px;min-width:60px;"><div style="font-size:1.8rem;">${hh.humor}</div><div style="font-size:0.7rem;color:var(--text-muted);margin-top:5px;">${hh.dataIso.split('-').reverse().slice(0,2).join('/')}</div></div>`;});
        c.innerHTML = r.empty ? '<p class="text-muted center" style="margin:0;">Sem registos.</p>' : h+'</div>';
    } catch(e){}
}

// ==========================================
// 6. CADERNETA COMPLETAS (Notas, Faltas, PRHF, Reuniões)
// ==========================================
const tabsCad = ['tab-aluno-timeline', 'tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-comportamento', 'tab-aluno-observacoes'];
tabsCad.forEach(t => {
    document.getElementById(t)?.addEventListener('click', (e) => {
        tabsCad.forEach(id => document.getElementById(id)?.classList.remove('active')); e.currentTarget.classList.add('active');
        document.getElementById('timeline-filtros').style.display = t === 'tab-aluno-timeline' ? 'flex' : 'none';
        document.getElementById('aluno-caderneta-content').innerHTML = '<p class="text-muted center">A carregar...</p>';
        if(t==='tab-aluno-timeline') carregarTimelineAluno(); if(t==='tab-aluno-notas') carregarNotasAluno(); if(t==='tab-aluno-faltas') carregarFaltasAluno(); if(t==='tab-aluno-prhfs') carregarPrhfsAluno(); if(t==='tab-aluno-comportamento') carregarComportamentoAluno(); if(t==='tab-aluno-observacoes') carregarObservacoesAluno();
    });
});

let timelineFilterCat = 'all';
document.querySelectorAll('#timeline-filtros .filter-chip').forEach(c => { c.addEventListener('click', (e) => { document.querySelectorAll('#timeline-filtros .filter-chip').forEach(ch => ch.classList.remove('active')); e.currentTarget.classList.add('active'); timelineFilterCat = e.currentTarget.getAttribute('data-cat'); carregarTimelineAluno(); }); });

async function carregarTimelineAluno() {
    const cCont = document.getElementById('aluno-caderneta-content');
    try {
        let ev = [];
        const nS = await getDocs(collection(db, "utilizadores", myUserId, "notas")); nS.forEach(d => { ev.push({ time: new Date(d.data().data).getTime(), cat: 'notas', icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', titulo: 'Nova Avaliação Lançada', desc: `${d.data().disciplina}: <strong>${d.data().nota}</strong>` }); });
        const fS = await getDocs(collection(db, "utilizadores", myUserId, "faltas")); fS.forEach(d => { ev.push({ time: new Date(d.data().criadoEm || d.data().dataInicio).getTime(), cat: 'faltas', icon: '<i class="fa-solid fa-user-xmark"></i>', cor: d.data().justificada ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Falta a ${d.data().disciplina} (${d.data().horas}h)`, desc: d.data().justificada ? `Justificada` : `Falta registada` }); });
        const oS = await getDocs(collection(db, "utilizadores", myUserId, "ocorrencias")); oS.forEach(d => { ev.push({ time: d.data().timestamp, cat: 'comportamento', icon: d.data().tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>', cor: d.data().tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Registo Disciplinar`, desc: `<strong>${d.data().titulo}</strong>` }); });
        const hS = await getDocs(collection(db, "utilizadores", myUserId, "humor")); hS.forEach(d => { ev.push({ time: d.data().timestamp, cat: 'gamificacao', icon: '<i class="fa-solid fa-heart-pulse"></i>', cor: '#b82bf2', titulo: `Check-in Emocional`, desc: `${d.data().humor} (+10 XP)` }); });
        ev.sort((a,b) => b.time - a.time); if(timelineFilterCat !== 'all') ev = ev.filter(e => e.cat === timelineFilterCat);
        if(ev.length === 0) { cCont.innerHTML = '<p class="text-muted center" style="margin-top:40px;">O teu histórico está limpo.</p>'; return; }
        let html = '<div class="timeline">'; ev.forEach(e => { html += `<div class="timeline-item"><div class="timeline-icon" style="color:${e.cor}; border-color:${e.cor};">${e.icon}</div><div class="timeline-content" style="border-left: 3px solid ${e.cor};"><span class="timeline-date">${new Date(e.time).toLocaleDateString('pt-PT')}</span><strong style="color:white; display:block; margin-bottom:5px;">${e.titulo}</strong><p style="font-size:0.85rem; color:var(--text-light); margin:0;">${e.desc}</p></div></div>`; }); cCont.innerHTML = html + '</div>';
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
        const faltasDb = await getDocs(collection(db, "utilizadores", myUserId, "faltas")); let faltasObj = {}; faltasDb.forEach(d => { const f = d.data(); if(!faltasObj[f.disciplina]) faltasObj[f.disciplina] = []; faltasObj[f.disciplina].push(f); });
        const prhfsDb = await getDocs(collection(db, "utilizadores", myUserId, "prhfs")); let hrsRec = {}; prhfsDb.forEach(d => { const p = d.data(); if (p.status === 'concluida') { hrsRec[p.disciplina] = (hrsRec[p.disciplina] || 0) + Number(p.horasTotais || p.horas || 0); } });

        let html = '';
        ordemDisciplinasGlobal.forEach(disc => {
            let totF = 0; let fHtml = '';
            if(faltasObj[disc]) {
                faltasObj[disc].sort((a,b) => b.dataInicio.localeCompare(a.dataInicio));
                faltasObj[disc].forEach(f => {
                    totF += Number(f.horas || 0); // Todas as faltas abatem assiduidade até fazer PRHF
                    const sc = f.justificada ? 'var(--success-green)' : 'var(--danger-red)'; const st = f.justificada ? 'Justificada' : 'Injustificada'; 
                    fHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px dashed #333;"><div><strong style="color:white; font-size:0.9rem;">Falta (${f.horas}h)</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${f.dataInicio}</span></div><span style="font-size:0.75rem; font-weight:bold; color:${sc}; padding:4px 8px; background:rgba(255,255,255,0.05); border-radius:12px;">${st}</span></div>`;
                });
            }

            const rec = hrsRec[disc] || 0; let fEfetivas = totF - rec; if(fEfetivas < 0) fEfetivas = 0;
            let assiduidade = 100 - ((fEfetivas / 50) * 100); if(assiduidade < 0) assiduidade = 0; if(assiduidade > 100) assiduidade = 100;
            let barraColor = assiduidade < 80 ? 'var(--danger-red)' : (assiduidade < 90 ? 'var(--warning-yellow)' : 'var(--success-green)');

            if(faltasObj[disc] && faltasObj[disc].length > 0) {
                html += `<div class="card" style="margin-bottom:15px; padding:15px; border-left: 4px solid ${barraColor};"><div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'"><div><strong style="font-size: 1.1rem; color:white;">${disc}</strong><div style="font-size: 0.8rem; color:var(--text-muted); margin-top:3px;">${totF}h Faltadas ${rec>0? `(<span style="color:var(--success-green);">${rec}h Recup.</span>)`:''}</div></div><div style="text-align:right;"><div style="font-weight:bold; color:${barraColor};">${assiduidade.toFixed(0)}%</div><div style="font-size:0.7rem; color:var(--text-muted);">Assiduidade</div></div></div><div style="display:none; margin-top:15px; border-top:1px solid #333; padding-top:10px;">${fHtml}</div></div>`;
            } else { html += `<div class="card" style="margin-bottom:10px; padding:15px; border-left: 4px solid var(--success-green); display:flex; justify-content:space-between; align-items:center;"><strong style="font-size: 1rem; color:var(--text-muted);">${disc}</strong><div style="text-align:right;"><div style="font-weight:bold; color:var(--success-green);">100%</div></div></div>`; }
        });
        cCont.innerHTML = html;
    } catch(e) {}
}

async function carregarPrhfsAluno() {
    const cCont = document.getElementById('aluno-caderneta-content');
    try {
        const prhfsDb = await getDocs(collection(db, "utilizadores", myUserId, "prhfs"));
        if(prhfsDb.empty) { cCont.innerHTML = '<p class="text-muted center">Não tens Planos de Recuperação.</p>'; return; }
        let prhfsArr = []; prhfsDb.forEach(d => { prhfsArr.push({id: d.id, ...d.data()}); }); prhfsArr.sort((a,b) => new Date(a.prazo) - new Date(b.prazo));
        
        let pendentes = prhfsArr.filter(p => p.status !== 'concluida');
        let concluidos = prhfsArr.filter(p => p.status === 'concluida');

        let html = ''; 
        const renderP = (p) => {
            const isUrgente = p.moduloTerminado === true || p.moduloTerminado === "true"; 
            const cor = isUrgente ? 'var(--danger-red)' : 'var(--warning-yellow)';
            const txtSt = p.status === 'concluida' ? 'CONCLUÍDO' : (isUrgente ? 'URGENTE' : 'EM CURSO');
            const corFinal = p.status === 'concluida' ? 'var(--success-green)' : cor;
            const hPres = Number(p.horasPresenciais || 0); 
            
            const anexoHTML = p.anexoBase64 ? `<a href="${p.anexoBase64}" download="PRHF_${p.disciplina}" class="secondary-btn small-btn" style="margin-bottom:10px; color:var(--primary-green); border-color:var(--primary-green);"><i class="fa-solid fa-download"></i> Documento do Professor</a>` : '';
            const fpHTML = p.feedbackProfessor ? `<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; margin-bottom:10px; font-size:0.85rem;"><strong style="color:var(--primary-green);">Prof:</strong> ${p.feedbackProfessor}</div>` : '';
            const propHTML = p.propostaAluno ? `<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; margin-bottom:15px; font-size:0.85rem;"><strong style="color:var(--warning-yellow);">A tua Proposta:</strong> ${p.propostaAluno} <br><span style="color:${p.propostaLidaDT ? 'var(--success-green)' : 'var(--text-muted)'}; font-size:0.75rem;"><i class="fa-solid ${p.propostaLidaDT ? 'fa-check-double' : 'fa-check'}"></i> ${p.propostaLidaDT ? 'Validada' : 'A aguardar validação'}</span></div>` : '';

            return `<div class="card" style="margin-bottom:15px; border-left: 4px solid ${corFinal};"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong style="font-size: 1.1rem; color:white;">${p.disciplina} (Mod. ${p.modulo})</strong><span style="color:${corFinal}; font-size:0.75rem; font-weight:bold;">${txtSt}</span></div><p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">${p.descricao}</p>${anexoHTML} ${fpHTML} ${propHTML}<div style="font-size:0.8rem; margin-bottom: 15px; border-top:1px dashed #333; padding-top:10px;">Data Limite: <strong style="color:${corFinal};">${p.prazo}</strong><br>Horas Presenciais: <strong>${hPres}h</strong></div>${p.status !== 'concluida' ? `<button class="primary-btn small-btn" style="width:100%; background-color:${corFinal}; color:${corFinal === 'var(--warning-yellow)' ? 'black' : 'white'};" onclick="window.abrirAcaoPrhf('${p.id}', '${p.disciplina}', '${p.modulo}', '${p.prazo}')"><i class="fa-solid fa-calendar-plus"></i> Agendar Sessão</button>` : ''}</div>`;
        };

        pendentes.forEach(p => html += renderP(p));
        if(concluidos.length > 0) {
            html += `<div class="falta-date-divider" style="margin-top:20px;"><span>Concluídos</span></div>`;
            concluidos.forEach(p => html += renderP(p));
        }
        cCont.innerHTML = html;
    } catch(e) {}
}

window.abrirAcaoPrhf = (id, disc, mod, prazo) => {
    esconderTodasAsVistas(); document.getElementById('view-aluno-acao-prhf').style.display = 'block';
    document.getElementById('prhf-acao-titulo').innerText = `${disc} (Mod. ${mod})`; document.getElementById('prhf-acao-prazo').innerText = prazo;
    
    document.getElementById('btn-voltar-acao-prhf').onclick = () => { esconderTodasAsVistas(); document.getElementById('view-aluno-caderneta').style.display = 'block'; carregarPrhfsAluno(); };

    document.getElementById('btn-enviar-proposta-prhf').onclick = async (e) => {
        const d = document.getElementById('aluno-prhf-proposta-data').value; const hi = document.getElementById('aluno-prhf-proposta-hora-inicio').value; const hf = document.getElementById('aluno-prhf-proposta-hora-fim').value;
        if(!d || !hi || !hf) { alert("Preenche a data e horas!"); return; }
        const btn = e.currentTarget; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
        try { await updateDoc(doc(db, "utilizadores", myUserId, "prhfs", id), { propostaAluno: `Data: ${d.split('-').reverse().join('/')} | Das ${hi} às ${hf}`, propostaLidaDT: false }); btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviado'; btn.style.backgroundColor = 'var(--success-green)'; setTimeout(() => { document.getElementById('btn-voltar-acao-prhf').click(); btn.innerHTML = 'Enviar Proposta ao Professor'; btn.disabled = false; btn.style.backgroundColor = 'var(--primary-green)';}, 1500); } catch(err) { btn.innerHTML = "Erro"; setTimeout(() => { btn.disabled = false; }, 1500); }
    };
};

async function carregarComportamentoAluno() {
    const cCont = document.getElementById('aluno-caderneta-content');
    try {
        const res = await getDocs(query(collection(db, "utilizadores", myUserId, "ocorrencias")));
        if(res.empty) { cCont.innerHTML = '<p class="text-muted center">Sem registos.</p>'; return; }
        let regs = []; res.forEach(d => regs.push(d.data())); regs.sort((a,b) => b.data.localeCompare(a.data)); 
        let html = ''; regs.forEach(r => { const cor = r.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)'; const ic = r.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>'; html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; align-items:center; gap:8px; color:${cor}; margin-bottom:5px;">${ic} <strong>${r.titulo}</strong></div><span style="font-size:0.75rem; color:var(--text-muted);">Data: ${r.data} | Prof. ${r.autor}</span>${r.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">${r.descricao}</p>` : ''}</div>`; }); cCont.innerHTML = html;
    } catch(e) {}
}

async function carregarObservacoesAluno(reuniaoSelecionada = '1_avaliacao') {
    const cCont = document.getElementById('aluno-caderneta-content');
    const reunioesMenu = [{id: '1_intercalar', label: '1ª Intercalar'}, {id: '1_avaliacao', label: '1ª Avaliação'}, {id: '2_intercalar', label: '2ª Intercalar'}, {id: '2_avaliacao', label: '2ª Avaliação'}, {id: '3_avaliacao', label: '3ª Avaliação'}];
    let html = '<div style="display:flex; overflow-x:auto; gap:10px; margin-bottom:20px; padding-bottom:10px; scrollbar-width: none;">';
    reunioesMenu.forEach(r => { const bg = r.id === reuniaoSelecionada ? 'var(--primary-green)' : 'var(--bg-dark)'; const color = r.id === reuniaoSelecionada ? 'var(--bg-dark)' : 'var(--text-muted)'; html += `<button class="btn-select-reuniao" data-id="${r.id}" style="background:${bg}; color:${color}; border:1px solid #333; padding:8px 15px; border-radius:20px; cursor:pointer; font-weight:bold; white-space:nowrap; transition:0.2s; flex-shrink:0;">${r.label}</button>`; });
    html += '</div><div id="reuniao-content-area"><p class="text-muted center">A carregar dados...</p></div>';
    cCont.innerHTML = html;

    document.querySelectorAll('.btn-select-reuniao').forEach(btn => { btn.addEventListener('click', (e) => { carregarObservacoesAluno(e.currentTarget.getAttribute('data-id')); }); });

    try {
        const docSnap = await getDoc(doc(db, "utilizadores", myUserId, "reunioes", reuniaoSelecionada));
        let dadosReuniao = docSnap.exists() ? docSnap.data() : {};
        let contentHtml = '<div style="display:flex; flex-direction:column; gap:10px;">';
        ordemDisciplinasGlobal.forEach(disc => {
            const comentario = dadosReuniao.disciplinas && dadosReuniao.disciplinas[disc] ? dadosReuniao.disciplinas[disc] : '<span style="color:var(--text-muted);">Sem comentário (SN)</span>';
            contentHtml += `<div class="card" style="margin-bottom:0; border-left:4px solid var(--primary-green); padding:15px;"><h4 style="margin-bottom:8px; color:white; font-size:1rem;">${disc}</h4><p style="color:var(--text-light); font-size:0.9rem; line-height:1.4; margin:0;">${comentario}</p></div>`;
        });
        const global = dadosReuniao.global || '<span style="color:var(--text-muted);">Sem observações globais registadas (SN).</span>';
        contentHtml += `<div class="card" style="margin-top:15px; border:1px solid var(--warning-yellow); background:rgba(255,204,0,0.05); padding:15px;"><h3 style="color:var(--warning-yellow); margin-bottom:10px; font-size:1.1rem;"><i class="fa-solid fa-comment-dots"></i> Observações Globais</h3><p style="color:white; font-size:0.95rem; line-height:1.5; margin:0;">${global}</p></div></div>`;
        document.getElementById('reuniao-content-area').innerHTML = contentHtml;
    } catch(e) {}
}

// ==========================================
// 7. AGENDA E HORÁRIO
// ==========================================
document.getElementById('tab-aluno-eventos')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-aluno-horario').classList.remove('active'); document.getElementById('aluno-agenda-filtros').style.display = 'flex'; document.getElementById('aluno-horario-container').style.display = 'none'; carregarAgendaAlunoLista(); });
document.getElementById('tab-aluno-horario')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-aluno-eventos').classList.remove('active'); document.getElementById('aluno-agenda-filtros').style.display = 'none'; document.getElementById('aluno-horario-container').style.display = 'block'; carregarHorarioAluno(); });

document.querySelectorAll('.agenda-filter-label input').forEach(chk => chk.addEventListener('change', carregarAgendaAlunoLista));

async function carregarAgendaAlunoLista() {
    const subContainer = document.getElementById('aluno-agenda-content'); subContainer.innerHTML = '<p class="text-muted center">A sincronizar...</p>'; if(!minhaTurma) return;
    const mT = document.getElementById('aluno-filtro-agenda-testes').checked; const mTr = document.getElementById('aluno-filtro-agenda-trabalhos').checked; const mO = document.getElementById('aluno-filtro-agenda-outros').checked;
    try {
        const evDb = await getDocs(collection(db, "turmas", minhaTurma, "eventos"));
        let evs = []; evDb.forEach(d => { const e = d.data(); let bgC = '#b82bf2'; let txtT = 'Evento'; if(e.tipo === 'teste' || e.tipo === 'avaliacao') { if(mT) { bgC = '#ffaa00'; txtT = 'Avaliação'; evs.push({...e, cor: bgC, txt: txtT}); } } else if(e.tipo === 'trabalho' || e.tipo === 'entrega') { if(mTr) { bgC = '#00d2ff'; txtT = 'Entrega'; evs.push({...e, cor: bgC, txt: txtT}); } } else { if(mO) evs.push({...e, cor: bgC, txt: txtT}); } });
        if(evs.length === 0) { subContainer.innerHTML = '<p class="text-muted center">Nenhum evento com os filtros atuais.</p>'; return; }
        const hj = new Date().toISOString().split('T')[0]; const fut = evs.filter(e => e.data >= hj).sort((a,b) => a.data.localeCompare(b.data)); const pas = evs.filter(e => e.data < hj).sort((a,b) => b.data.localeCompare(a.data));
        const mesArr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        let html = '';
        const rEv = (ev) => { const dp = ev.data.split('-'); const mes = mesArr[parseInt(dp[1])-1]; return `<div class="calendar-event-card" style="border-left-color:${ev.cor}; margin-bottom:10px;"><div class="calendar-date-box"><span class="day">${dp[2]}</span><span class="month" style="color:${ev.cor};">${mes}</span></div><div class="calendar-info"><h4 style="margin:0; color:white;">${ev.titulo}</h4><span style="font-size:0.8rem; color:var(--text-muted);">${(ev.txt||'evento').toUpperCase()}</span></div></div>`; };
        if(fut.length > 0) fut.forEach(e => html += rEv(e)); else html += '<p class="text-muted center">Sem eventos futuros.</p>';
        if(pas.length > 0) { html += '<div class="calendar-divider" style="margin-top:20px;"><span>Passados</span></div>'; pas.forEach(e => html += rEv(e)); }
        subContainer.innerHTML = html;
    } catch(e) {}
}

let ahModo = 'dia', ahDOff = 0, ahSOff = 0;
document.getElementById('btn-aluno-horario-dia')?.addEventListener('click', (e) => { ahModo = 'dia'; e.currentTarget.classList.add('active'); document.getElementById('btn-aluno-horario-grelha').classList.remove('active'); carregarHorarioAluno(); });
document.getElementById('btn-aluno-horario-grelha')?.addEventListener('click', (e) => { ahModo = 'grelha'; e.currentTarget.classList.add('active'); document.getElementById('btn-aluno-horario-dia').classList.remove('active'); carregarHorarioAluno(); });
document.getElementById('btn-aluno-prev-horario')?.addEventListener('click', () => { if(ahModo === 'dia') ahDOff--; else ahSOff--; carregarHorarioAluno(); });
document.getElementById('btn-aluno-next-horario')?.addEventListener('click', () => { if(ahModo === 'dia') ahDOff++; else ahSOff++; carregarHorarioAluno(); });

const getCorEspecial = (d) => { const dL = d.toLowerCase(); if(d.includes('alm')) return { c: 'var(--warning-yellow)', bg: 'rgba(255, 204, 0, 0.15)' }; if(d.includes('vis')) return { c: '#00d2ff', bg: 'rgba(0, 210, 255, 0.15)' }; if(d.includes('prhf')) return { c: 'var(--danger-red)', bg: 'rgba(255, 77, 77, 0.15)' }; if(d.includes('pap') || d.includes('fct')) return { c: '#ff9900', bg: 'rgba(255, 153, 0, 0.15)' }; return { c: 'var(--primary-green)', bg: 'rgba(0, 204, 136, 0.1)' }; };

async function carregarHorarioAluno() {
    const sC = document.getElementById('aluno-agenda-content'); sC.innerHTML = '<p class="text-muted center">A gerar horário...</p>'; if(!minhaTurma) return;
    try {
        const dS = await getDoc(doc(db, "turmas", minhaTurma)); let hb = {}; if(dS.exists() && dS.data().horario) hb = dS.data().horario;
        const bK = ['1', '2', '3', '4', '1300', '5', '6', '7']; const bT = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' }; const dM = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']; const fDt = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
        if (ahModo === 'dia') {
            let tD = new Date(); tD.setDate(tD.getDate() + ahDOff); document.getElementById('aluno-horario-display').innerText = `${dM[tD.getDay()]}, ${fDt(tD)}`;
            let h = ''; let tAD = false; const dSStr = `${tD.getFullYear()}-${String(tD.getMonth()+1).padStart(2,'0')}-${String(tD.getDate()).padStart(2,'0')}`;
            bK.forEach(b => { const dc = hb[`${dSStr}_${b}`]; if(dc) { const sty = getCorEspecial(dc); h += `<div class="horario-list-item" style="border-left-color:${sty.c}; background-color:${sty.bg};"><div class="horario-time-col">${bT[b]}</div><div class="horario-disc-col"><div class="horario-disc-name">${dc}</div></div></div>`; tAD = true; } });
            sC.innerHTML = tAD ? h : '<p class="text-muted center" style="margin-top:30px;">Sem aulas neste dia.</p>';
        } else {
            let dT = new Date(); dtT.setDate(dtT.getDate() + (ahSOff * 7)); dtT.setDate(dtT.getDate() - (dtT.getDay() === 0 ? 6 : dtT.getDay() - 1)); let dE = new Date(dtT); dE.setDate(dE.getDate() + 4);
            document.getElementById('aluno-horario-display').innerText = `${fDt(dtT)} a ${fDt(dE)}`;
            let h = '<div class="horario-grid" style="min-width:100%;"><div class="horario-header"></div>'; let dI = new Date(dtT);
            ['SEG','TER','QUA','QUI','SEX'].forEach(d => { h += `<div class="horario-header">${d}<span>${fDt(dI)}</span></div>`; dI.setDate(dI.getDate()+1); });
            bK.forEach(b => { h += `<div class="horario-time">${bT[b]}</div>`; dI = new Date(dtT); for(let i=0; i<5; i++) { const dSStr = `${dI.getFullYear()}-${String(dI.getMonth()+1).padStart(2,'0')}-${String(dI.getDate()).padStart(2,'0')}`; const dc = hb[`${dSStr}_${b}`]; if(dc) { const sty = getCorEspecial(dc); h += `<div class="horario-slot" style="border:1px solid ${sty.c}; background-color:${sty.bg}; color:white;"><strong>${dc}</strong></div>`; } else h += `<div class="horario-slot"></div>`; dI.setDate(dI.getDate()+1); } });
            sC.innerHTML = h + '</div>';
        }
    } catch(e) {}
}

// ==========================================
// 8. FÓRUNS E CHAT
// ==========================================
let chatUnsubscribeAluno = null; let alunoForumAtivoId = null;

document.getElementById('btn-create-chat-aluno')?.addEventListener('click', async () => { 
    document.getElementById('modal-criar-forum').style.display = 'flex'; 
    const cCont = document.getElementById('lista-colegas-forum'); cCont.innerHTML = '<p class="text-muted center">A procurar colegas...</p>';
    try {
        const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", minhaTurma), where("papel", "==", "aluno")));
        let cH = ''; cS.forEach(d => { if(d.id !== myUserId) { cH += `<label style="display:flex; align-items:center; gap:10px; color:white; font-size:0.9rem; padding:8px 0; cursor:pointer;"><input type="checkbox" class="colegas-check" value="${d.id}" style="width:18px;height:18px;accent-color:var(--primary-green);"> ${d.data().nome}</label>`; } });
        cCont.innerHTML = cH === '' ? '<p class="text-muted center">Sem colegas.</p>' : cH;
    } catch(e) {}
});

document.getElementById('btn-cancelar-novo-forum')?.addEventListener('click', () => { document.getElementById('modal-criar-forum').style.display = 'none'; document.getElementById('input-nome-novo-forum').value = ''; });
document.getElementById('btn-confirmar-novo-forum')?.addEventListener('click', async () => {
    const nome = document.getElementById('input-nome-novo-forum').value.trim(); if(!nome) return;
    let mbr = [myUserId]; document.querySelectorAll('.colegas-check:checked').forEach(c => mbr.push(c.value));
    try { await addDoc(collection(db, "turmas", minhaTurma, "foruns"), { nome: nome, tipo: 'permanente', isDefault: false, membros: mbr, criadoPor: myUserName }); document.getElementById('modal-criar-forum').style.display = 'none'; document.getElementById('input-nome-novo-forum').value = ''; alert("Grupo criado!"); carregarForuns(); } catch(e) {}
});

async function carregarForuns() {
    const cont = document.getElementById('aluno-forum-channel-list'); cont.innerHTML = '<p class="text-muted center">A carregar...</p>'; if(!minhaTurma) return;
    let html = `<h3 style="font-size:1rem; color:var(--text-muted); margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">Apoio & Turma</h3><div class="canal-card" data-id="turma_global" data-nome="Turma ${minhaTurma}"><div class="canal-icon" style="color:#00cc88; border-color:#00cc88;"><i class="fa-solid fa-users"></i></div><div class="canal-info"><h4>Turma ${minhaTurma}</h4><p>Canal Geral</p></div></div><div class="canal-card" data-id="dt_${myUserId}" data-nome="Chat DT"><div class="canal-icon" style="color:#ffaa00; border-color:#ffaa00;"><i class="fa-solid fa-user-tie"></i></div><div class="canal-info"><h4>Diretor de Turma</h4><p>Mensagem Privada</p></div></div><h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Disciplinas</h3><div style="display:flex; flex-wrap:wrap; gap:10px;">`;
    ordemDisciplinasGlobal.forEach(disc => { html += `<div class="canal-card" data-id="disc_${disc}" data-nome="Fórum ${disc}" style="flex: 1 1 45%; padding: 10px;"><div class="canal-info" style="text-align:center;"><h4 style="margin:0; font-size:0.9rem; color:#00d2ff;"><i class="fa-solid fa-book-open"></i> ${disc}</h4></div></div>`; }); html += '</div>';
    
    try {
        const res = await getDocs(collection(db, "turmas", minhaTurma, "foruns")); let extras = '';
        res.forEach(d => { const f = d.data(); if(f.membros.includes(myUserId) && !f.isDefault) extras += `<div class="canal-card" data-id="${d.id}" data-nome="${f.nome}"><div class="canal-icon" style="color:#b82bf2; border-color:#b82bf2;"><i class="fa-solid fa-comments"></i></div><div class="canal-info"><h4>${f.nome}</h4><p>Os Meus Chats</p></div></div>`; });
        if(extras !== '') html += `<h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Os Meus Chats</h3>` + extras;
    } catch(e) {}
    cont.innerHTML = html;
    
    cont.querySelectorAll('.canal-card').forEach(c => c.addEventListener('click', (e) => { alunoForumAtivoId = e.currentTarget.getAttribute('data-id'); document.getElementById('aluno-chat-active-title').innerText = e.currentTarget.getAttribute('data-nome'); document.getElementById('aluno-forum-channel-list').style.display = 'none'; document.getElementById('aluno-forum-chat-view').style.display = 'flex'; document.getElementById('btn-create-chat-aluno').style.display = 'none'; iniciarChatAluno(alunoForumAtivoId); }));
}

document.getElementById('btn-aluno-voltar-canais')?.addEventListener('click', () => { document.getElementById('aluno-forum-chat-view').style.display = 'none'; document.getElementById('aluno-forum-channel-list').style.display = 'block'; document.getElementById('btn-create-chat-aluno').style.display = 'block'; });

function iniciarChatAluno(fId) {
    const chatC = document.getElementById('aluno-chat-messages-container'); chatC.innerHTML = ''; if(chatUnsubscribeAluno) chatUnsubscribeAluno();
    chatUnsubscribeAluno = onSnapshot(query(collection(db, "turmas", minhaTurma, "foruns", fId, "mensagens"), orderBy("timestamp")), (snap) => { let html = ''; snap.forEach(doc => { const m = doc.data(); const isMe = m.remetente === myUserName; html += `<div class="chat-bubble ${isMe ? 'admin' : 'student'}"><strong>${isMe ? 'Tu' : m.remetente}</strong><br>${m.texto}<span class="chat-meta">${new Date(m.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>`; }); chatC.innerHTML = html; chatC.scrollTop = chatC.scrollHeight; });
}
document.getElementById('btn-aluno-send-msg')?.addEventListener('click', async () => { const inp = document.getElementById('aluno-input-forum-msg'); const t = inp.value.trim(); if(!t || !alunoForumAtivoId) return; try { await addDoc(collection(db, "turmas", minhaTurma, "foruns", alunoForumAtivoId, "mensagens"), { remetente: myUserName, texto: t, timestamp: Date.now() }); inp.value = ''; } catch(e) {} });

// ==========================================
// 9. POMODORO (Música e XP)
// ==========================================
let pTmr; let pRest = 25 * 60; 
document.getElementById('btn-start-study')?.addEventListener('click', (e) => {
    e.currentTarget.style.display = 'none'; document.getElementById('btn-stop-study').style.display = 'inline-block';
    pTmr = setInterval(() => { pRest--; const m = Math.floor(pRest / 60).toString().padStart(2, '0'); const s = (pRest % 60).toString().padStart(2, '0'); document.getElementById('study-timer-text').innerText = `${m}:${s}`; if(pRest <= 0) { clearInterval(pTmr); document.getElementById('study-controls').style.display = 'none'; document.getElementById('post-study-log').style.display = 'block'; } }, 1000);
});
document.getElementById('btn-stop-study')?.addEventListener('click', () => { clearInterval(pTmr); pRest = 25 * 60; document.getElementById('study-timer-text').innerText = "25:00"; document.getElementById('btn-stop-study').style.display = 'none'; document.getElementById('btn-start-study').style.display = 'inline-block'; });

document.getElementById('btn-load-music')?.addEventListener('click', () => {
    const url = document.getElementById('pomodoro-music-url').value.trim(); const iframeC = document.getElementById('music-player-frame'); if(!url) return;
    if (url.includes('spotify.com')) { iframeC.innerHTML = `<iframe style="border-radius:12px" src="${url.replace("open.spotify.com", "open.spotify.com/embed")}" width="100%" height="80" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`; iframeC.style.display = 'block'; } 
    else if (url.includes('youtu.be/') || url.includes('v=')) { let vId = url.includes('youtu.be/') ? url.split('youtu.be/')[1].split('?')[0] : url.split('v=')[1].split('&')[0]; if (vId) { iframeC.innerHTML = `<iframe width="100%" height="150" src="https://www.youtube.com/embed/${vId}" frameborder="0" allowfullscreen></iframe>`; iframeC.style.display = 'block'; } }
});

document.getElementById('btn-save-study-log')?.addEventListener('click', async (e) => {
    const t = document.getElementById('study-log-text').value.trim(); if(!t) return;
    const b = e.currentTarget; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
    try {
        const uS = await getDoc(doc(db, "utilizadores", myUserId)); let axp = uS.exists() && uS.data().xp ? uS.data().xp : 0;
        await addDoc(collection(db, "utilizadores", myUserId, "estudos"), { texto: t, data: new Date().toISOString() });
        await updateDoc(doc(db, "utilizadores", myUserId), { xp: axp + 50 }); carregarGamificacao({xp: axp + 50});
        b.style.backgroundColor = "var(--success-green)"; b.innerHTML = '<i class="fa-solid fa-check"></i> Feito!';
        setTimeout(() => { document.getElementById('study-log-text').value = ''; document.getElementById('post-study-log').style.display = 'none'; document.getElementById('study-controls').style.display = 'block'; b.innerHTML = '<i class="fa-solid fa-save"></i> Guardar e Ganhar XP'; b.disabled = false; b.style.backgroundColor = "var(--success-green)"; document.getElementById('btn-voltar-study').click(); }, 2000);
    } catch(err) { b.innerHTML = "Erro"; setTimeout(() => { b.disabled = false; }, 2000); }
});

// ==========================================
// 10. CADERNO DIGITAL
// ==========================================
document.getElementById('btn-gravar-apontamento')?.addEventListener('click', async (e) => {
    const t = document.getElementById('caderno-titulo').value.trim(); const h = quillEditor.root.innerHTML; const txt = quillEditor.getText().trim(); 
    if(!t || txt.length === 0) { alert("Preenche o título e o resumo!"); return; }
    const b = e.currentTarget; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
    try { await addDoc(collection(db, "utilizadores", myUserId, "apontamentos"), { titulo: t, conteudo: h, timestamp: Date.now() }); document.getElementById('caderno-titulo').value = ''; quillEditor.root.innerHTML = ''; b.innerHTML = '<i class="fa-solid fa-check"></i> Guardado'; b.style.backgroundColor = 'var(--success-green)'; carregarResumos(); setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-save"></i> Gravar na Nuvem'; b.disabled = false; b.style.backgroundColor = '#e67e22'; }, 2000); } catch(err) { b.innerHTML = 'Erro!'; setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-save"></i> Gravar na Nuvem'; b.disabled = false; }, 2000); }
});

async function carregarResumos() {
    const c = document.getElementById('lista-apontamentos-container'); c.innerHTML = '<p class="text-muted center">A carregar...</p>';
    try { const r = await getDocs(query(collection(db, "utilizadores", myUserId, "apontamentos"))); let arr = []; r.forEach(d => arr.push({id: d.id, ...d.data()})); arr.sort((a,b) => b.timestamp - a.timestamp); let h = ''; arr.forEach(n => { h += `<div class="card" style="margin-bottom:15px; border-left:4px solid #e67e22;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><strong style="font-size:1.05rem; color:var(--primary-green);">${n.titulo}</strong><span style="font-size:0.75rem; color:var(--text-muted);"><i class="fa-regular fa-clock"></i> ${new Date(n.timestamp).toLocaleDateString('pt-PT')}</span></div><div style="background: rgba(255,255,255,0.05); padding:10px; border-radius:6px; font-size:0.95rem; overflow-x:auto;">${n.conteudo}</div></div>`; }); c.innerHTML = h === '' ? '<p class="text-muted center">Nenhum resumo.</p>' : h; } catch(e) {}
}

let fQB64 = "";
document.getElementById('upload-foto-quadro')?.addEventListener('change', async (e) => { let file = e.target.files[0]; if(!file) return; if (file.type.startsWith('image/')) { const opt = { maxSizeMB: 0.8, maxWidthOrHeight: 1920, useWebWorker: true }; try { file = await imageCompression(file, opt); } catch (err) {} } document.getElementById('foto-quadro-file-name').innerText = file.name; document.getElementById('btn-gravar-foto-quadro').style.display = 'block'; const rd = new FileReader(); rd.onload = (ev) => { fQB64 = ev.target.result; }; rd.readAsDataURL(file); });
document.getElementById('btn-gravar-foto-quadro')?.addEventListener('click', async (e) => { const t = document.getElementById('foto-titulo').value.trim(); if(!t || !fQB64) return; const b = e.currentTarget; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { await addDoc(collection(db, "utilizadores", myUserId, "caderno_fotos"), { titulo: t, fotoBase64: fQB64, timestamp: Date.now() }); b.innerHTML = '<i class="fa-solid fa-check"></i> Guardada'; setTimeout(() => { b.style.display = 'none'; b.disabled = false; b.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Guardar na Galeria'; document.getElementById('foto-quadro-file-name').innerText = ""; document.getElementById('foto-titulo').value = ""; fQB64 = ""; carregarFotosQuadro(); }, 2000); } catch(err) { b.innerHTML = "Erro"; setTimeout(() => { b.disabled = false; }, 2000); } });
async function carregarFotosQuadro() { const c = document.getElementById('lista-fotos-quadro-container'); c.innerHTML = '<p class="text-muted" style="grid-column: span 2; text-align:center;">A carregar galeria...</p>'; try { const s = await getDocs(query(collection(db, "utilizadores", myUserId, "caderno_fotos"), orderBy("timestamp", "desc"))); let h = ''; s.forEach(d => { const dta = d.data(); h += `<div style="background:var(--bg-card); border:1px solid #333; border-radius:8px; overflow:hidden;"><div style="height:120px; background:url('${dta.fotoBase64}') center/cover no-repeat; cursor:pointer;" onclick="window.open('${dta.fotoBase64}')"></div><div style="padding:10px; font-size:0.85rem;"><strong style="color:white; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${dta.titulo}</strong><span style="color:var(--text-muted); font-size:0.7rem;">${new Date(dta.timestamp).toLocaleDateString('pt-PT')}</span></div></div>`; }); c.innerHTML = h===''?'<p class="text-muted" style="grid-column: span 2; text-align:center;">Sem fotos.</p>':h; } catch(e) {} }
document.getElementById('tab-caderno-resumos')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-caderno-galeria').classList.remove('active'); document.getElementById('sec-caderno-resumos').style.display = 'block'; document.getElementById('sec-caderno-galeria').style.display = 'none'; });
document.getElementById('tab-caderno-galeria')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-caderno-resumos').classList.remove('active'); document.getElementById('sec-caderno-resumos').style.display = 'none'; document.getElementById('sec-caderno-galeria').style.display = 'block'; carregarFotosQuadro(); });

// ==========================================
// 11. SUMÁRIOS
// ==========================================
document.getElementById('aluno-filtro-sumarios-disc')?.addEventListener('change', carregarSumariosAluno);
async function carregarSumariosAluno() {
    const c = document.getElementById('aluno-lista-sumarios-container'); c.innerHTML = '<p class="text-muted center">A carregar sumários...</p>'; if(!minhaTurma) return;
    try {
        const r = await getDocs(query(collection(db, "turmas", minhaTurma, "sumarios"))); if(r.empty) { c.innerHTML = '<p class="text-muted center">Sem sumários.</p>'; return; }
        let sum = []; let dU = new Set(); r.forEach(d => { const dt = d.data(); sum.push({id: d.id, ...dt}); dU.add(dt.disciplina); });
        const fS = document.getElementById('aluno-filtro-sumarios-disc'); if (fS.options.length <= 1) { let oH = '<option value="">Todas as Disciplinas</option>'; dU.forEach(dc => oH += `<option value="${dc}">${dc}</option>`); fS.innerHTML = oH; }
        const fA = fS.value; if(fA) sum = sum.filter(s => s.disciplina === fA); sum.sort((a,b) => b.data.localeCompare(a.data)); 
        if(sum.length === 0) { c.innerHTML = '<p class="text-muted center">Sem sumários para a disciplina.</p>'; return; }
        let h = ''; sum.forEach(s => { const aB = s.anexoBase64 ? `<a href="${s.anexoBase64}" download="${s.anexoNome}" class="primary-btn small-btn" style="display:inline-block; margin-top:10px; width:auto; padding:8px 12px; background-color:#0099ff;"><i class="fa-solid fa-download"></i> Baixar Anexo</a>` : ''; h += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #0099ff;"><div><span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">${s.data} | ${s.disciplina} | Prof. ${s.professor}</span><h4 style="margin:5px 0;">${s.titulo}</h4>${s.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">${s.descricao}</p>` : ''}</div>${aB}</div>`; }); c.innerHTML = h;
    } catch(e) {}
}

// ==========================================
// 12. PASSAPORTE
// ==========================================
function carregarDadosPassaporte(dados) {
    if(dados.fct) { document.getElementById('aluno-fct-horas').innerText = `${dados.fct.horasRealizadas||0} / ${dados.fct.horasTotal||0}h`; document.getElementById('aluno-fct-progress').style.width = `${((dados.fct.horasRealizadas||0)/(dados.fct.horasTotal||1))*100}%`; document.getElementById('input-fct-horas').value = dados.fct.horasRealizadas||'';}
    if(dados.pap) { document.getElementById('input-pap-tema').value = dados.pap.tema || ''; }
    if (dados.papFicheiroEnviado) document.getElementById('aluno-pap-file-name').innerText = "Ficheiro submetido.";
}
document.getElementById('btn-save-fct')?.addEventListener('click', async (e) => { const v = document.getElementById('input-fct-horas').value.trim(); if(!v) return; const b = e.currentTarget; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { await updateDoc(doc(db, "utilizadores", myUserId), { "fct.horasRealizadas": v }); b.style.backgroundColor = 'var(--success-green)'; b.innerHTML = '<i class="fa-solid fa-check"></i>'; setTimeout(() => { b.style.backgroundColor = 'var(--primary-green)'; b.innerHTML = '<i class="fa-solid fa-check"></i>'; b.disabled = false; }, 2000); } catch(err) {} });
document.getElementById('btn-save-pap-tema')?.addEventListener('click', async (e) => { const v = document.getElementById('input-pap-tema').value.trim(); if(!v) return; const b = e.currentTarget; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { await updateDoc(doc(db, "utilizadores", myUserId), { "pap.tema": v }); b.style.backgroundColor = 'var(--success-green)'; b.innerHTML = '<i class="fa-solid fa-check"></i>'; setTimeout(() => { b.style.backgroundColor = 'var(--primary-green)'; b.innerHTML = '<i class="fa-solid fa-save"></i>'; b.disabled = false; }, 2000); } catch(err) {} });
let fPB64 = ""; document.getElementById('aluno-upload-pap')?.addEventListener('change', async (e) => { let f = e.target.files[0]; if(!f) return; if (f.type.startsWith('image/')) { try { f = await imageCompression(f, {maxSizeMB:0.5}); } catch(e){} } document.getElementById('aluno-pap-file-name').innerText = f.name; document.getElementById('btn-enviar-pap').style.display = 'block'; const r = new FileReader(); r.onload = ev => fPB64 = ev.target.result; r.readAsDataURL(f); });
document.getElementById('btn-enviar-pap')?.addEventListener('click', async (e) => { if(!fPB64) return; const b = e.currentTarget; b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; try { const snap = await getDoc(doc(db, "utilizadores", myUserId)); let axp = snap.exists()&&snap.data().xp?snap.data().xp:0; await updateDoc(doc(db, "utilizadores", myUserId), { papFicheiroEnviado:true, papFicheiroBase64:fPB64, xp:axp+200 }); b.style.backgroundColor="var(--success-green)"; b.innerHTML='<i class="fa-solid fa-check"></i> Submetido'; setTimeout(() => { b.style.display='none'; b.disabled=false; document.getElementById('aluno-pap-file-name').style.color="var(--success-green)"; }, 2000); } catch(err){} });

async function pedirPermissaoNotificacoes() { try { const p = await Notification.requestPermission(); if(p==='granted') { const r = await navigator.serviceWorker.register('./firebase-messaging-sw.js'); const t = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: r }); if(t) await updateDoc(doc(db, "utilizadores", myUserId), { tokenNotificacao: t }); } } catch(e){} }
if(typeof onMessage !== "undefined" && messaging) onMessage(messaging, p => alert(`NOVA NOTIFICAÇÃO:\n${p.notification.title}\n${p.notification.body}`));
setTimeout(() => { if(myUserId) pedirPermissaoNotificacoes(); }, 4000);
