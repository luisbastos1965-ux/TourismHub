import { collection, doc, getDocs, getDoc, updateDoc, addDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { getMatriz, obterDisciplinasDoAno } from "./aluno-caderneta.js";

const ACADEMIAS_INFO = {
    'estrategas': { nome: 'Academia dos Estrategas', cor: '#10b981', icon: 'fa-chess-knight', desc: 'Mestres do planeamento.' },
    'embaixadores': { nome: 'Academia dos Embaixadores', cor: '#0ea5e9', icon: 'fa-handshake', desc: 'A alma da hospitalidade!' },
    'exploradores': { nome: 'Academia dos Exploradores', cor: '#f97316', icon: 'fa-compass', desc: 'Os guias de ação!' },
    'visionarios': { nome: 'Academia dos Visionários', cor: '#8b5cf6', icon: 'fa-lightbulb', desc: 'Os criativos do Turismo.' }
};

export function getNivelProInfo(xpTotal) {
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

export function aplicarTemaAcademia(idHouse) { 
    const ac = ACADEMIAS_INFO[idHouse]; if(!ac) return; 
    document.documentElement.style.setProperty('--primary-green', ac.cor); 
    const rankElem = document.getElementById('aluno-rank-title'); 
    const rankCentral = document.getElementById('perfil-titulo-central'); 
    if(rankElem) { const profInfo = getNivelProInfo(parseInt(document.getElementById('aluno-xp-atual').innerText) || 0); rankElem.innerText = `${ac.nome.replace('Academia dos ','')} • ${profInfo.titulo}`; }
    if(rankCentral) { rankCentral.innerHTML = `<i class="fa-solid ${ac.icon}"></i> ${ac.nome}`; rankCentral.style.color = ac.cor; }
    const avatarImg = document.getElementById('perfil-avatar-img'); 
    if (avatarImg) avatarImg.style.borderColor = ac.cor;
}

export function setupGamificacao(dados) {
    atualizarUI(dados.xp || 0);
    carregarPassaporteEBadges(dados); 
    carregarMetas();
    carregarRankingTurma();
    construirDashboardDinamico();
    
    const objSelect = document.getElementById('obj-disciplina');
    if(objSelect) {
        objSelect.innerHTML = '<option value="">Escolhe a Disciplina...</option>' + obterDisciplinasDoAno().map(dc => `<option value="${dc}">${dc}</option>`).join('');
    }
    document.getElementById('obj-modulo')?.addEventListener('focus', () => {
        const dV = document.getElementById('obj-disciplina').value; const sel = document.getElementById('obj-modulo');
        if(!dV) { sel.innerHTML = ''; return; }
        const m = getMatriz(); let dMs = null;
        if(m.Sociocultural && m.Sociocultural[dV]) dMs = m.Sociocultural[dV]; 
        else if(m.Científica && m.Científica[dV]) dMs = m.Científica[dV]; 
        else if(m.Técnica && m.Técnica[dV]) dMs = m.Técnica[dV];
        if(dMs) { sel.innerHTML = Object.keys(dMs).sort((a,b)=>parseInt(a)-parseInt(b)).map(k => `<option value="${k}">${k.toString().startsWith('UC')?k:`M${k}`}</option>`).join(''); } 
        else { sel.innerHTML = '<option value="1">1</option>'; }
    });

    document.getElementById('btn-add-objetivo')?.addEventListener('click', async (e) => {
        const di = document.getElementById('obj-disciplina').value; 
        const mo = document.getElementById('obj-modulo').value; 
        const no = document.getElementById('obj-nota-alvo').value;
        if(!di || !mo || !no || no < 10 || no > 20) { alert("Preenche os dados corretamente."); return; }
        
        const btn = e.currentTarget; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
            await addDoc(collection(window.db, "utilizadores", window.myUserId, "objetivos"), { tipo: 'nota', disciplina: di, modulo: mo, notaAlvo: no, desc: `Tirar ${no} ou mais a ${di} (M${mo})`, concluido: false, timestamp: Date.now() });
            carregarMetas();
            document.getElementById('obj-disciplina').value = ''; document.getElementById('obj-modulo').innerHTML = ''; document.getElementById('obj-nota-alvo').value = '';
        } catch(err) {}
        btn.innerHTML = '<i class="fa-solid fa-plus"></i> Guardar Meta';
    });
}

function atualizarUI(xp) {
    const profInfo = getNivelProInfo(xp);
    const xpEl = document.getElementById('aluno-xp-atual'); if(xpEl) xpEl.innerText = xp;
    const perfilNvlTxt = document.getElementById('perfil-nivel-txt'); if(perfilNvlTxt) perfilNvlTxt.innerText = `Nível ${profInfo.nivel} - ${profInfo.titulo}`;
    const totaisEl = document.getElementById('perfil-xp-totais'); const progEl = document.getElementById('perfil-xp-progress');
    if(totaisEl) totaisEl.innerText = xp; if(progEl) progEl.style.width = `${profInfo.progresso}%`; 
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

function carregarPassaporteEBadges(data) {
    const passCont = document.getElementById('barras-competencias-perfil');
    if(passCont) {
        const getLvl = (xp) => Math.floor((xp || 0) / 100) + 1; const getPerc = (xp) => ((xp || 0) % 100);
        passCont.innerHTML = `
        <div style="margin-bottom: 12px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-comments" style="color:#0ea5e9;"></i> Comunicação</span><strong style="color:var(--text-light);">Nvl ${getLvl(data.xp_comunicacao)}</strong></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${getPerc(data.xp_comunicacao)}%; background:#0ea5e9;"></div></div></div>
        <div style="margin-bottom: 12px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-lightbulb" style="color:#8b5cf6;"></i> Criatividade</span><strong style="color:var(--text-light);">Nvl ${getLvl(data.xp_criatividade)}</strong></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${getPerc(data.xp_criatividade)}%; background:#8b5cf6;"></div></div></div>
        <div style="margin-bottom: 12px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-compass" style="color:#f97316;"></i> Liderança</span><strong style="color:var(--text-light);">Nvl ${getLvl(data.xp_lideranca)}</strong></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${getPerc(data.xp_lideranca)}%; background:#f97316;"></div></div></div>
        <div style="margin-bottom: 12px;"><div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-chess-knight" style="color:#10b981;"></i> Estratégia</span><strong style="color:var(--text-light);">Nvl ${getLvl(data.xp_organizacao)}</strong></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${getPerc(data.xp_organizacao)}%; background:#10b981;"></div></div></div>`;
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
            const cl = earned ? 'earned' : ''; 
            bHtml += `<div class="badge-item ${cl}"><div class="badge-icon"><i class="fa-solid ${b.icon}"></i></div><div style="font-size:0.7rem; color:${earned ? 'var(--text-light)' : 'var(--text-muted)'};">${b.nome}</div></div>`;
        });
        badCont.innerHTML = bHtml;
    }
}

async function carregarMetas() {
    const cont = document.getElementById('lista-objetivos-container'); if(!cont) return;
    try {
        const snap = await getDocs(collection(window.db, "utilizadores", window.myUserId, "objetivos")); 
        let html = '';
        snap.forEach(d => {
            const obj = d.data();
            const cColor = obj.concluido ? 'var(--success-green)' : '#444'; 
            html += `<div style="padding:12px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:8px; border-left: 3px solid ${cColor}; display:flex; gap:10px; align-items:center;">
                        <i class="fa-solid fa-bullseye" style="color:${cColor};"></i> <span style="font-size:0.95rem; flex:1; color:${obj.concluido?'var(--text-muted)':'var(--text-light)'}; text-decoration:${obj.concluido?'line-through':'none'};">${obj.desc}</span>
                     </div>`;
        });
        cont.innerHTML = html === '' ? '<p class="text-muted center" style="font-size:0.85rem;">Sem metas ativas.</p>' : html;
    } catch(e) {}
}

async function carregarRankingTurma() {
    const c = document.getElementById('ranking-turma-container'); 
    
    try {
        const snap = await getDocs(query(collection(window.db, "utilizadores"), where("papel", "==", "aluno")));
        let alunosTurma = []; 
        let academiasXP = { estrategas: 0, embaixadores: 0, exploradores: 0, visionarios: 0 };
        
        snap.forEach(d => {
            const al = { id: d.id, ...d.data() };
            if(al.academia && academiasXP[al.academia] !== undefined) { academiasXP[al.academia] += (al.xp || 0); }
            if(al.turma === window.minhaTurma) { alunosTurma.push(al); } 
        });
        
        alunosTurma.sort((a,b) => (b.xp || 0) - (a.xp || 0));
        
        let hAcad = `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px; text-align:center; background:rgba(0,0,0,0.2); padding:15px; border-radius:12px;">`;
        Object.keys(academiasXP).sort((a,b) => academiasXP[b] - academiasXP[a]).forEach((ac) => {
            const acData = ACADEMIAS_INFO[ac];
            hAcad += `<div><i class="fa-solid ${acData.icon}" style="font-size:1.8rem; color:${acData.cor}; margin-bottom:8px; display:block;"></i><strong style="color:var(--text-light); font-size:0.75rem;">${acData.nome.replace('Academia dos ','')}</strong><br><span style="color:var(--warning-yellow); font-size:0.9rem; font-weight:bold;">${academiasXP[ac]} XP</span></div>`;
        });
        hAcad += `</div><h4 style="color:var(--text-muted); font-size:0.85rem; margin-bottom:10px;">🏆 Top 10 da Turma</h4>`;
        
        let hAl = '';
        alunosTurma.slice(0, 10).forEach((al, idx) => {
            let cor = idx===0 ? '#ffd700' : (idx===1 ? '#c0c0c0' : (idx===2 ? '#cd7f32' : 'var(--text-muted)'));
            const pNome = (al.nome || "Aluno").split(' '); const nomeE = pNome.length > 1 ? `${pNome[0]} ${pNome[pNome.length - 1]}` : pNome[0];
            hAl += `<div style="display:flex; align-items:center; gap:10px; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:8px; border-left:3px solid ${cor};">
                        <strong style="font-size:1.2rem; color:${cor}; width:25px; text-align:center;">${idx+1}</strong>
                        <div style="flex:1;"><strong style="font-size:0.95rem; color:var(--text-light);">${nomeE}</strong></div>
                        <span style="font-weight:bold; color:var(--primary-green); font-size:0.9rem;">${al.xp || 0} XP</span>
                    </div>`;
        });
        c.innerHTML = hAcad + hAl;
    } catch(e) {}
}

async function construirDashboardDinamico() {
    const alertCont = document.getElementById('hero-alert-section'); 
    const flameBox = document.getElementById('aluno-streak-flame');
    
    try {
        const getISOWeek = (dateStr) => {
            if(!dateStr) return null;
            const d = new Date(dateStr); d.setHours(0,0,0,0); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
            const w1 = new Date(d.getFullYear(), 0, 4);
            return `${d.getFullYear()}-W${1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7)}`;
        };
        const hj = new Date(); const hjIso = hj.toISOString().split('T')[0]; 
        const anoLetivo = hj.getMonth() + 1 >= 9 ? hj.getFullYear() : hj.getFullYear() - 1;
        const inicioAnoIso = getISOWeek(`${anoLetivo}-09-01`);

        let tFaltas = 0, pAtivos = 0, mRep = 0, evs = [];

        const fS = await getDocs(collection(window.db, "utilizadores", window.myUserId, "faltas")); 
        let semanasComFaltas = new Set();
        fS.forEach(d => { 
            const f = d.data(); if(!f.justificada && !f.comprovativoEnviado) { 
                tFaltas++; const iso = getISOWeek(f.dataInicio || f.data); if(iso && iso >= inicioAnoIso) semanasComFaltas.add(iso); 
            } 
        });

        const nS = await getDocs(collection(window.db, "utilizadores", window.myUserId, "notas")); 
        nS.forEach(d => { const n = d.data().nota; if(n === 'REP' || Number(n) < 10) mRep++; });

        const pS = await getDocs(collection(window.db, "utilizadores", window.myUserId, "prhfs")); 
        pS.forEach(d => { if(d.data().status !== 'concluida') pAtivos++; });

        let semanasSemFaltas = 0;
        if(window.minhaTurma) {
            const tSnap = await getDoc(doc(window.db, "turmas", window.minhaTurma));
            if (tSnap.exists()) {
                const hor = tSnap.data().horario || {}; let sAulas = new Set();
                for (let k in hor) { if (hor[k]) { const iw = getISOWeek(k.split('_')[0]); if (iw >= inicioAnoIso && iw <= getISOWeek(hjIso)) sAulas.add(iw); } }
                const sOrd = Array.from(sAulas).sort((a, b) => b.localeCompare(a));
                for (const sem of sOrd) { if (semanasComFaltas.has(sem)) break; semanasSemFaltas++; }
            }
        }
        
        let mult = 1.0 + (semanasSemFaltas * 0.2); if(mult > 2.0) mult = 2.0;
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), { multiplicadorXP: mult });

        if(flameBox) {
            if(mult > 1.0) {
                flameBox.innerHTML = `<i class="fa-solid fa-fire${mult >= 2.0 ? '-flame-curved' : ''}"></i> <span id="aluno-streak-multiplier">x${mult.toFixed(1)}${mult >= 2.0 ? ' MAX' : ''}</span>`;
                flameBox.style.color = mult >= 2.0 ? "#ff4500" : "#ff9900";
                flameBox.style.borderColor = mult >= 2.0 ? "#ff4500" : "#ff9900";
                flameBox.style.background = mult >= 2.0 ? "rgba(255, 69, 0, 0.15)" : "rgba(255, 153, 0, 0.1)";
                flameBox.style.boxShadow = mult >= 2.0 ? "0 0 15px rgba(255, 69, 0, 0.4)" : "0 0 10px rgba(255, 153, 0, 0.2)";
            } else {
                flameBox.innerHTML = `<i class="fa-solid fa-fire"></i> <span id="aluno-streak-multiplier">x1.0</span>`;
                flameBox.style.color = "var(--text-muted)"; flameBox.style.borderColor = "#333";
                flameBox.style.background = "transparent"; flameBox.style.boxShadow = "none";
            }
        }

        if(alertCont) {
            if(window.minhaTurma) {
                const evSnap = await getDocs(collection(window.db, "turmas", window.minhaTurma, "eventos")); 
                let d7 = new Date(); d7.setDate(d7.getDate()+7); const lIso = d7.toISOString().split('T')[0]; 
                evSnap.forEach(d => { const e = d.data(); if(e.data >= hjIso && e.data <= lIso && ['teste','avaliacao','entrega'].includes(e.tipo)) evs.push(e); }); 
                evs.sort((a,b) => a.data.localeCompare(b.data));
            }

            let alertHtml = ''; 
            if(tFaltas > 0 || pAtivos > 0 || mRep > 0) {
                alertHtml += `<div class="card" style="background:linear-gradient(135deg,#ef4444,#b91c1c); color:white; border:none; border-radius:16px; margin-bottom:20px;">
                                <h3 style="margin-bottom:10px; font-size:1.8rem;"><i class="fa-solid fa-triangle-exclamation"></i> Ação Necessária</h3>
                                <p style="font-size:1.1rem; margin-bottom:15px; opacity:0.9;">Tens pendências urgentes que prejudicam a tua avaliação.</p>
                                <button class="primary-btn" style="background:white; color:#b91c1c; font-size:1.1rem; padding:15px; width:100%;" onclick="document.querySelector('.nav-item[data-target=\\'view-aluno-caderneta\\']').click()">Ver na Caderneta</button>
                              </div>`;
            } else if(evs.length > 0) {
                const ev = evs[0]; const dF = ev.data.split('-').reverse().join('/');
                alertHtml += `<div class="card" style="background:linear-gradient(135deg,#f59e0b,#d97706); color:white; border:none; border-radius:16px; margin-bottom:20px;">
                                <h3 style="margin-bottom:10px; font-size:1.8rem;"><i class="fa-solid fa-calendar-exclamation"></i> Prepara-te</h3>
                                <p style="font-size:1.1rem; margin-bottom:15px; opacity:0.9;">Tens <strong>${ev.titulo}</strong> no dia ${dF}.</p>
                              </div>`;
            } else {
                alertHtml += `<div class="card" style="background:linear-gradient(135deg,var(--primary-green),var(--primary-hover)); color:white; border:none; border-radius:16px; margin-bottom:20px;">
                                <h3 style="margin-bottom:5px; font-size:1.6rem;"><i class="fa-solid fa-leaf"></i> Dia Tranquilo</h3>
                                <p style="font-size:1.05rem; margin-bottom:0; opacity:0.9;">Não tens avaliações marcadas nem pendências.</p>
                              </div>`;
            }
            alertCont.innerHTML = alertHtml;
        }
    } catch(e){}
}
