// js/modules/aluno-caderneta.js
import { collection, getDocs, query, orderBy, doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// 1. MATRIZ DE DISCIPLINAS E HORAS
// ==========================================
const matrizAmbos = {
    "Sociocultural": { "PORT": {"1":33,"2":34,"3":33,"4":33,"5":34,"6":33,"7":40,"8":40,"9":40}, "ING": {"1":27,"2":24,"3":24,"4":24,"5":24,"6":24,"7":24,"8":24,"9":24}, "AI": {"1":36,"2":36,"3":36,"4":36,"5":37,"6":39}, "EF": {"1":10,"2":8,"3":10,"4":10,"5":10,"6":12,"7":6,"8":12,"9":8,"10":10,"11":12,"12":8,"13":6,"14":10,"15":6,"16":2}, "TIC": {"1":25,"2":25,"3":25,"4":25} },
    "Científica": { "GEO": {"1":33,"2":33,"3":30,"4":26,"5":21,"6":21,"7":21,"8":15}, "HCA": {"1":20,"2":18,"3":18,"4":18,"5":24,"6":18,"7":18,"8":24,"9":21,"10":21}, "MAT": {"1":33,"2":27,"3":20,"4":20} }
};
const matrizAntigoTecnica = { "CF": {"1":24,"2":21,"3":21,"4":21,"5":21,"6":21,"7":9,"8":15,"9":15}, "TIAT": {"1":27,"2":24,"3":24,"4":24,"5":33,"6":30,"7":30,"8":30,"9":36,"10":30,"11":33,"12":30,"13":24}, "TCAT": {"1":33,"2":33,"3":30,"4":33,"5":36,"6":36,"7":24}, "OTET": {"1":24,"2":24,"3":33,"4":30,"5":24,"6":24,"7":36,"8":27,"9":33,"10":30,"11":30,"12":17} };
const matrizNovoTecnica = { "AET": {"UC00038":20,"UC03611":20,"UC03623":40,"UC03612":40,"UC03613":20,"UC03614":40,"UC00056":20,"UC03631":40,"UC00063":20}, "OGOT": {"UC03629":20,"UC03619":40,"UC03621":40,"UC00055":20,"UC03630":20,"UC03616":20,"UC03617":40,"UC03618":20,"UC03620":40,"UC03628":40,"UC03632":20}, "CMET": {"UC00034":30,"UC00033":30,"UC00593":20,"UC03622":40,"UC03623":40,"UC00031":30,"UC00032":30,"UC00433":20,"UC03624":20,"UC03627":20}, "LNTT": {"UC00044":50,"UC00071":50,"UC03615":40,"UC03625":20} };

function getMatriz() {
    const mStr = window.minhaTurma || ""; const mMatch = mStr.match(/\d+/); const ano = mMatch ? parseInt(mMatch[0]) : 10;
    let m = JSON.parse(JSON.stringify(matrizAmbos)); m["Técnica"] = (ano >= 11) ? matrizAntigoTecnica : matrizNovoTecnica; return m;
}

function obterDisciplinasDoAno() {
    const mStr = window.minhaTurma || ""; const mMatch = mStr.match(/\d+/); const ano = mMatch ? parseInt(mMatch[0]) : 10;
    const base = { 10: ["PORT", "ING", "AI", "EF", "TIC", "GEO", "HCA", "MAT"], 11: ["PORT", "ING", "AI", "EF", "GEO", "HCA"], 12: ["PORT", "ING", "EF", "GEO", "HCA"] };
    const tecAntigo = { 10: ["CF", "TIAT", "TCAT", "OTET"], 11: ["CF", "TIAT", "TCAT", "OTET"], 12: ["TIAT", "OTET"] };
    const tecNovo = { 10: ["AET", "OGOT", "CMET", "LNTT"], 11: ["AET", "OGOT", "CMET", "LNTT"], 12: ["AET", "OGOT", "CMET"] };
    let arr = [...(base[ano] || base[10])]; if (ano >= 11) arr = [...arr, ...(tecAntigo[ano] || tecAntigo[11])]; else arr = [...arr, ...(tecNovo[ano] || tecNovo[10])]; return arr;
}

function getEmptyState(mensagem, icone = "fa-folder-open") {
    return `<div style="text-align:center; padding: 40px 20px; opacity: 0.5;">
                <i class="fa-solid ${icone}" style="font-size: 3.5rem; margin-bottom: 15px; color: var(--text-muted);"></i>
                <p style="font-size: 0.95rem; color: var(--text-muted);">${mensagem}</p>
            </div>`;
}

// ==========================================
// 2. SETUP E LISTENERS
// ==========================================
export function setupCaderneta(dados) {
    document.getElementById('tab-aluno-timeline')?.addEventListener('click', (e) => { ativarTab(e); document.getElementById('timeline-filtros').style.display = 'flex'; carregarTimelineAluno(); });
    document.getElementById('tab-aluno-notas')?.addEventListener('click', (e) => { ativarTab(e); document.getElementById('timeline-filtros').style.display = 'none'; carregarNotasAluno(); });
    document.getElementById('tab-aluno-faltas')?.addEventListener('click', (e) => { ativarTab(e); document.getElementById('timeline-filtros').style.display = 'none'; carregarFaltasAluno(); });
    document.getElementById('tab-aluno-prhfs')?.addEventListener('click', (e) => { ativarTab(e); document.getElementById('timeline-filtros').style.display = 'none'; carregarPRHFsAluno(); });
    document.getElementById('tab-aluno-evolucao')?.addEventListener('click', (e) => { ativarTab(e); document.getElementById('timeline-filtros').style.display = 'none'; carregarEvolucaoAluno(); });
    document.getElementById('tab-aluno-observacoes')?.addEventListener('click', (e) => { ativarTab(e); document.getElementById('timeline-filtros').style.display = 'none'; carregarReunioesAluno(); });

    document.querySelectorAll('#timeline-filtros .filter-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            document.querySelectorAll('#timeline-filtros .filter-chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active'); window.timelineFilterCat = e.target.getAttribute('data-cat'); carregarTimelineAluno();
        });
    });

    document.getElementById('btn-close-pauta')?.addEventListener('click', () => document.getElementById('modal-pauta-global').style.display = 'none');
    document.getElementById('btn-voltar-acao-prhf')?.addEventListener('click', () => { document.getElementById('view-aluno-acao-prhf').style.display = 'none'; document.getElementById('view-aluno-caderneta').style.display = 'block'; });
}

function ativarTab(e) {
    document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); 
    e.target.classList.add('active');
}

// ==========================================
// 3. FUNÇÕES DAS ABAS DA CADERNETA
// ==========================================
async function carregarTimelineAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    try {
        let ev = [];
        const nS = await getDocs(collection(window.db, "utilizadores", window.myUserId, "notas")); 
        nS.forEach(d => { const n = d.data(); ev.push({ time: new Date(n.data).getTime(), cat: 'notas', icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', titulo: 'Nova Avaliação', desc: `${n.disciplina} (M${n.modulo}): <strong style="color:var(--text-light);">${n.nota}</strong>` }); });
        
        const fS = await getDocs(collection(window.db, "utilizadores", window.myUserId, "faltas")); 
        fS.forEach(d => { const f = d.data(); ev.push({ time: new Date(f.criadoEm || f.dataInicio).getTime(), cat: 'faltas', icon: '<i class="fa-solid fa-user-xmark"></i>', cor: f.justificada ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Falta a ${f.disciplina} (${f.horas}h)`, desc: f.justificada ? `Justificada` : `Injustificada` }); });
        
        const moodS = await getDocs(collection(window.db, "utilizadores", window.myUserId, "humor"));
        moodS.forEach(d => { const h = d.data(); ev.push({ time: h.timestamp, cat: 'gamificacao', icon: '<i class="fa-solid fa-heart-pulse"></i>', cor: 'var(--accent-purple)', titulo: 'Check-in Diário', desc: `Sentiste-te ${h.humor}. <strong style="color:var(--warning-yellow);">+10 XP</strong>` }); });

        ev = ev.filter(e => !isNaN(e.time)); ev.sort((a,b) => b.time - a.time); 
        
        let eventos = ev;
        if(window.timelineFilterCat !== 'all') eventos = eventos.filter(e => e.cat === window.timelineFilterCat);
        if(eventos.length === 0) { cCont.innerHTML = getEmptyState('O teu histórico está limpo.', 'fa-clock-rotate-left'); return; }
        
        let html = '<div class="timeline">';
        eventos.forEach(e => { 
            html += `<div class="timeline-item">
                        <div class="timeline-icon" style="color: ${e.cor}; border-color: ${e.cor};">${e.icon}</div>
                        <div class="timeline-content" style="border-left: 3px solid ${e.cor};">
                            <span class="timeline-date">${new Date(e.time).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span>
                            <strong style="color:var(--text-light); display:block; margin-bottom:5px;">${e.titulo}</strong>
                            <p style="font-size:0.85rem; color:var(--text-light); margin:0;">${e.desc}</p>
                        </div>
                     </div>`; 
        });
        cCont.innerHTML = html + '</div>';
    } catch(e) {}
}

async function carregarNotasAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    try {
        const notasDb = await getDocs(collection(window.db, "utilizadores", window.myUserId, "notas")); 
        let disciplinasDoAluno = {}; window.mapNotasCache = {};
        
        notasDb.forEach(d => { 
            const n = d.data(); 
            if(!disciplinasDoAluno[n.disciplina]) disciplinasDoAluno[n.disciplina] = []; 
            disciplinasDoAluno[n.disciplina].push(n); 
            window.mapNotasCache[`${n.disciplina}_${n.modulo}`] = n.nota; 
        });
        
        const ordemDisciplinas = obterDisciplinasDoAno();
        if(ordemDisciplinas.length === 0) { cCont.innerHTML = getEmptyState('Ainda não tens disciplinas ativas.', 'fa-book'); return; }

        let html = `<button id="btn-pauta-global" class="primary-btn" style="margin-bottom: 20px; background-color: transparent; border: 1px solid var(--primary-green); color: var(--primary-green);" onclick="window.abrirModalPautaGlobal()">Pauta Global</button>`;
        
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
                
                html += `<div class="disciplina-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                            <span class="disciplina-title" style="color:var(--text-light);">${disc}</span>
                            <span><span style="font-size:0.75rem; color:var(--text-muted); margin-right:8px;">Média:</span><span class="disciplina-media" style="color:${medCor};">${med}</span> <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; color:var(--text-muted); margin-left:5px;"></i></span>
                         </div>
                         <div class="disciplina-modules">${modsHtml}</div>`;
            } else { 
                html += `<div class="disciplina-header" style="cursor:default;"><span class="disciplina-title" style="color:var(--text-muted);">${disc}</span><span><span class="disciplina-media" style="color:var(--text-muted); font-size:0.9rem;">SN</span></span></div>`; 
            }
        });
        cCont.innerHTML = html;
    } catch(e) {}
}

window.abrirModalPautaGlobal = function() {
    const mod = document.getElementById('modal-pauta-global'); if(mod) mod.style.display = 'flex'; 
    const container = document.getElementById('pauta-global-content'); 
    try { 
        const matriz = getMatriz(); let pHtml = ''; 
        for (const [nomeComponente, disciplinas] of Object.entries(matriz)) { 
            pHtml += `<div class="pauta-global-componente"><div class="pauta-global-header">${nomeComponente}</div>`; 
            for (const [nomeDisc, modulos] of Object.entries(disciplinas)) { 
                pHtml += `<div class="pauta-global-disc"><div class="pauta-global-disc-title">${nomeDisc}</div><div class="pauta-global-notas">`; 
                const isNumeric = Object.keys(modulos).every(k => !isNaN(k)); 
                const modKeys = isNumeric ? Object.keys(modulos).sort((a,b) => parseInt(a) - parseInt(b)) : Object.keys(modulos);
                for (const mod of modKeys) { 
                    const nota = window.mapNotasCache[`${nomeDisc}_${mod}`] || 'SN'; let cor = "sn"; 
                    if (nota !== 'SN' && nota !== 'REP' && nota >= 10) cor = "positiva"; else if (nota === 'REP' || nota < 10) cor = "negativa"; 
                    const modLabel = mod.toString().startsWith('UC') ? mod : `M${mod}`; 
                    pHtml += `<div class="pg-nota-item"><span>${modLabel}</span><span class="pg-nota-val ${cor}">${nota}</span></div>`; 
                } 
                pHtml += `</div></div>`; 
            } 
            pHtml += `</div>`; 
        } 
        if(container) container.innerHTML = pHtml; 
    } catch(err) {}
};

async function carregarFaltasAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    try {
        const snap = await getDocs(query(collection(window.db, "utilizadores", window.myUserId, "faltas"), orderBy("dataInicio", "desc"))); 
        if(snap.empty) { cCont.innerHTML = getEmptyState('Nenhuma falta registada.', 'fa-user-check'); return; }

        let faltasPorChave = {};
        snap.forEach(d => {
            const f = d.data(); const mod = f.modulo || '1'; const key = `${f.disciplina}_${mod}`;
            if(!faltasPorChave[key]) faltasPorChave[key] = { disc: f.disciplina, mod: mod, horasInjustificadas: 0, totalHoras: 0, detalhes: [] };
            faltasPorChave[key].detalhes.push(f); faltasPorChave[key].totalHoras += Number(f.horas);
            if(!f.justificada) faltasPorChave[key].horasInjustificadas += Number(f.horas);
        });

        const matriz = getMatriz(); let html = '';
        for(const key in faltasPorChave) {
            const group = faltasPorChave[key]; let lim = 0;
            const mC = matriz.Científica?.[group.disc]?.[group.mod]; const mS = matriz.Sociocultural?.[group.disc]?.[group.mod]; const mT = matriz.Técnica?.[group.disc]?.[group.mod];
            const valStr = mC || mS || mT;
            
            if(valStr) lim = Math.round(Number(valStr) * 0.1);
            if(lim === 0) lim = 3; 
            
            const perc = Math.min((group.horasInjustificadas / lim) * 100, 100);
            const pCor = perc >= 100 ? 'var(--danger-red)' : (perc > 60 ? 'var(--warning-yellow)' : 'var(--success-green)');

            html += `<div class="card" style="margin-bottom:20px; border:1px solid #333;">
                        <h4 style="margin:0 0 10px 0; color:var(--text-light); font-size:1.1rem;">${group.disc} <span style="font-size:0.85rem; color:var(--text-muted);">(M${group.mod.toString().replace('UC','')})</span></h4>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; color:var(--text-muted); margin-bottom:5px;"><span>Faltas: <strong style="color:${pCor};">${group.horasInjustificadas}h</strong></span><span>Limite: ${lim}h</span></div>
                        <div class="progress-bar-bg" style="margin-bottom:15px;"><div class="progress-bar-fill" style="width:${perc}%; background:${pCor};"></div></div>`;
            
            group.detalhes.forEach(f => {
                const jStatus = f.justificada ? `<span style="color:var(--success-green);"><i class="fa-solid fa-check"></i> Justificada</span>` : `<span style="color:var(--danger-red);"><i class="fa-solid fa-xmark"></i> Injustificada</span>`;
                html += `<div style="padding:10px; background:rgba(0,0,0,0.2); border-left:3px solid ${f.justificada?'var(--success-green)':'var(--danger-red)'}; border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                            <div><div style="font-size:0.85rem; color:var(--text-light); margin-bottom:3px;">${f.dataInicio}</div><span style="color:var(--text-muted); font-size:0.75rem;">${f.horas}h marcadas</span></div>
                            <div style="font-size:0.8rem; font-weight:bold;">${jStatus}</div>
                         </div>`;
            });
            html += `</div>`;
        }
        cCont.innerHTML = html;
    } catch(e) {}
}

async function carregarEvolucaoAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    cCont.innerHTML = getEmptyState('Sem registos de evolução.', 'fa-star'); 
}

async function carregarPRHFsAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    try {
        const snap = await getDocs(query(collection(window.db, "utilizadores", window.myUserId, "prhfs"))); let pArr = [];
        snap.forEach(d => pArr.push({id: d.id, ...d.data()})); 
        
        if(pArr.length === 0) { cCont.innerHTML = getEmptyState('Não tens planos de recuperação.', 'fa-file-shield'); return; }
        
        let html = '';
        pArr.forEach(p => {
            const st = p.status; let cor = '#333'; let txt = 'Concluído';
            if(st==='pendente_aluno'){ cor='var(--danger-red)'; txt='Ação Necessária'; }
            html += `<div class="card" style="border-left:4px solid ${cor}; margin-bottom:15px;">
                        <strong style="color:var(--text-light);">${p.disciplina}</strong>
                        <p style="font-size:0.85rem; color:var(--text-muted);">Carga: ${p.horasPresenciais}h</p>
                     </div>`;
        });
        cCont.innerHTML = html;
    } catch(e) {}
}

async function carregarReunioesAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    try {
        const snap = await getDocs(query(collection(window.db, "utilizadores", window.myUserId, "reunioes"))); 
        let html = '';
        snap.forEach(d => {
            const o = d.data();
            html += `<div class="card" style="border-left:4px solid var(--accent-purple); margin-bottom:15px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><strong style="color:var(--text-light); font-size:1rem;">${o.disciplina || o.titulo}</strong><span style="font-size:0.75rem; color:var(--text-muted);">${o.data}</span></div>
                        <p style="font-size:0.85rem; color:var(--text-light); margin-bottom:10px; line-height:1.5;">${o.texto}</p>
                        <div style="font-size:0.75rem; color:var(--text-muted); text-align:right;">Prof. ${o.autor}</div>
                     </div>`;
        });

        // Caso a base de dados esteja vazia, mostra os teus testes para não perderes o visual
        if(html === '') {
            const testes = [
                { disc: 'Português', data: '12 Out 2023', texto: 'Reunião de acompanhamento com os Encarregados de Educação.', prof: 'Maria Silva' },
                { disc: 'Matemática', data: '05 Nov 2023', texto: 'Análise da evolução no 1º Módulo.', prof: 'João Costa' },
                { disc: 'Inglês', data: '20 Nov 2023', texto: 'Estratégias de melhoria na oralidade.', prof: 'Ana Sousa' },
                { disc: 'Área de Integração', data: '15 Dez 2023', texto: 'Ponto de situação do final de período.', prof: 'Carlos Mendes' },
                { disc: 'Educação Física', data: '10 Jan 2024', texto: 'Avaliação da aptidão física e participação.', prof: 'Nuno Alves' }
            ];
            testes.forEach(o => {
                html += `<div class="card" style="border-left:4px solid var(--accent-purple); margin-bottom:15px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><strong style="color:var(--text-light); font-size:1rem;">${o.disc}</strong><span style="font-size:0.75rem; color:var(--text-muted);">${o.data}</span></div>
                            <p style="font-size:0.85rem; color:var(--text-light); margin-bottom:10px; line-height:1.5;">${o.texto}</p>
                            <div style="font-size:0.75rem; color:var(--text-muted); text-align:right;">Prof. ${o.prof}</div>
                         </div>`;
            });
        }
        cCont.innerHTML = html;
    } catch(e) {}
}
