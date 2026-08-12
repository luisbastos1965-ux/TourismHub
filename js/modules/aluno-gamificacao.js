// js/modules/aluno-gamificacao.js
import { collection, doc, getDocs, getDoc, updateDoc, setDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
    return { nivel: 5, titulo: "Profissional em Formação", progresso: 100 };
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
    carregarMetas();
    carregarRankingTurma();
    construirDashboardDinamico();
    
    // Configurar Modal Nova Meta
    document.getElementById('btn-add-objetivo')?.addEventListener('click', async (e) => {
        const di = document.getElementById('obj-disciplina').value; 
        const mo = document.getElementById('obj-modulo').value; 
        const no = document.getElementById('obj-nota-alvo').value;
        if(!di || !mo || !no) return;
        
        const btn = e.currentTarget; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        try {
            await addDoc(collection(window.db, "utilizadores", window.myUserId, "objetivos"), { tipo: 'nota', disciplina: di, modulo: mo, notaAlvo: no, desc: `Tirar ${no} a ${di} (M${mo})`, concluido: false, timestamp: Date.now() });
            carregarMetas();
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
    if(!window.minhaTurma) return;
    
    try {
        const snap = await getDocs(query(collection(window.db, "utilizadores"), where("papel", "==", "aluno"), where("turma", "==", window.minhaTurma)));
        let alunos = []; let academiasXP = { estrategas: 0, embaixadores: 0, exploradores: 0, visionarios: 0 };
        
        snap.forEach(d => {
            const al = { id: d.id, ...d.data() };
            if(al.academia) academiasXP[al.academia] += (al.xp || 0); 
            alunos.push(al); 
        });
        alunos.sort((a,b) => (b.xp || 0) - (a.xp || 0));
        
        // Grelha Academias 2x2
        let hAcad = `<div style="display:grid; grid-template-columns: 1fr 1fr; gap:15px; margin-bottom:20px; background:rgba(0,0,0,0.2); padding:15px; border-radius:12px;">`;
        Object.keys(academiasXP).sort((a,b) => academiasXP[b] - academiasXP[a]).forEach((ac) => {
            const acData = ACADEMIAS_INFO[ac];
            hAcad += `<div style="text-align:center;"><i class="fa-solid ${acData.icon}" style="font-size:1.5rem; color:${acData.cor}; margin-bottom:5px; display:block;"></i><strong style="color:var(--text-light); font-size:0.75rem;">${acData.nome.replace('Academia dos ','')}</strong><br><span style="color:var(--warning-yellow); font-size:0.9rem; font-weight:bold;">${academiasXP[ac]} XP</span></div>`;
        });
        hAcad += `</div><h4 style="color:var(--text-muted); font-size:0.85rem; margin-bottom:10px;">🏆 Top Alunos</h4>`;
        
        // Ranking Alunos sem duplicar nome
        let hAl = '';
        alunos.slice(0, 10).forEach((al, idx) => {
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
    const flameBox = document.getElementById('aluno-streak-flame');
    if(!flameBox) return;

    try {
        const getISOWeek = (dateStr) => {
            const d = new Date(dateStr); d.setHours(0,0,0,0); d.setDate(d.getDate() + 3 - (d.getDay() + 6) % 7);
            const w1 = new Date(d.getFullYear(), 0, 4);
            return `${d.getFullYear()}-W${1 + Math.round(((d.getTime() - w1.getTime()) / 86400000 - 3 + (w1.getDay() + 6) % 7) / 7)}`;
        };
        const hj = new Date(); const anoLetivo = hj.getMonth() + 1 >= 9 ? hj.getFullYear() : hj.getFullYear() - 1;
        const inicioAnoIso = getISOWeek(`${anoLetivo}-09-01`);

        const fS = await getDocs(collection(window.db, "utilizadores", window.myUserId, "faltas")); 
        let semanasComFaltas = new Set();
        fS.forEach(d => { 
            const f = d.data(); if(!f.justificada) { const iso = getISOWeek(f.dataInicio || f.data); if(iso && iso >= inicioAnoIso) semanasComFaltas.add(iso); } 
        });

        let semanasSemFaltas = 0;
        if(window.minhaTurma) {
            const tSnap = await getDoc(doc(window.db, "turmas", window.minhaTurma));
            if (tSnap.exists()) {
                const hor = tSnap.data().horario || {}; let sAulas = new Set();
                for (let k in hor) { if (hor[k]) { const iw = getISOWeek(k.split('_')[0]); if (iw >= inicioAnoIso && iw <= getISOWeek(hj.toISOString())) sAulas.add(iw); } }
                const sOrd = Array.from(sAulas).sort((a, b) => b.localeCompare(a));
                for (const sem of sOrd) { if (semanasComFaltas.has(sem)) break; semanasSemFaltas++; }
            }
        }
        
        let mult = Math.min(1.0 + (semanasSemFaltas * 0.2), 2.0);
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), { multiplicadorXP: mult });

        if(mult >= 2.0) flameBox.innerHTML = `<i class="fa-solid fa-fire-flame-curved"></i> <span>x2.0 MAX</span>`;
        else flameBox.innerHTML = `<i class="fa-solid fa-fire"></i> <span>x${mult.toFixed(1)}</span>`;
        flameBox.style.color = mult > 1.0 ? "#ff9900" : "var(--text-muted)";
    } catch(e){}
}
