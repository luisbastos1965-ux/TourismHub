import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// MATRIZ PARTILHADA
export const matrizAmbos = {
    "Sociocultural": { "PORT": {"1":33,"2":34,"3":33,"4":33,"5":34,"6":33,"7":40,"8":40,"9":40}, "ING": {"1":27,"2":24,"3":24,"4":24,"5":24,"6":24,"7":24,"8":24,"9":24}, "AI": {"1":36,"2":36,"3":36,"4":36,"5":37,"6":39}, "EF": {"1":10,"2":8,"3":10,"4":10,"5":10,"6":12,"7":6,"8":12,"9":8,"10":10,"11":12,"12":8,"13":6,"14":10,"15":6,"16":2}, "TIC": {"1":25,"2":25,"3":25,"4":25} },
    "Científica": { "GEO": {"1":33,"2":33,"3":30,"4":26,"5":21,"6":21,"7":21,"8":15}, "HCA": {"1":20,"2":18,"3":18,"4":18,"5":24,"6":18,"7":18,"8":24,"9":21,"10":21}, "MAT": {"1":33,"2":27,"3":20,"4":20} }
};
const matrizAntigoTecnica = { "CF": {"1":24,"2":21,"3":21,"4":21,"5":21,"6":21,"7":9,"8":15,"9":15}, "TIAT": {"1":27,"2":24,"3":24,"4":24,"5":33,"6":30,"7":30,"8":30,"9":36,"10":30,"11":33,"12":30,"13":24}, "TCAT": {"1":33,"2":33,"3":30,"4":33,"5":36,"6":36,"7":24}, "OTET": {"1":24,"2":24,"3":33,"4":30,"5":24,"6":24,"7":36,"8":27,"9":33,"10":30,"11":30,"12":17} };
const matrizNovoTecnica = { "AET": {"UC00038":20,"UC03611":20,"UC03623":40,"UC03612":40,"UC03613":20,"UC03614":40,"UC00056":20,"UC03631":40,"UC00063":20}, "OGOT": {"UC03629":20,"UC03619":40,"UC03621":40,"UC00055":20,"UC03630":20,"UC03616":20,"UC03617":40,"UC03618":20,"UC03620":40,"UC03628":40,"UC03632":20}, "CMET": {"UC00034":30,"UC00033":30,"UC00593":20,"UC03622":40,"UC03623":40,"UC00031":30,"UC00032":30,"UC00433":20,"UC03624":20,"UC03627":20}, "LNTT": {"UC00044":50,"UC00071":50,"UC03615":40,"UC03625":20} };

export function getMatriz() {
    const mStr = window.minhaTurma || ""; const mMatch = mStr.match(/\d+/); const ano = mMatch ? parseInt(mMatch[0]) : 10;
    let m = JSON.parse(JSON.stringify(matrizAmbos)); m["Técnica"] = (ano >= 11) ? matrizAntigoTecnica : matrizNovoTecnica; return m;
}

export function obterDisciplinasDoAno() {
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
}

function ativarTab(e) {
    document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); 
    e.target.classList.add('active');
}

// ==========================================
// 1. TIMELINE (Apenas Escola)
// ==========================================
async function carregarTimelineAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    try {
        let ev = [];
        const nS = await getDocs(collection(window.db, "utilizadores", window.myUserId, "notas")); 
        nS.forEach(d => { const n = d.data(); ev.push({ time: new Date(n.data).getTime(), cat: 'notas', icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', titulo: 'Nova Avaliação', desc: `${n.disciplina} (M${n.modulo}): <strong style="color:var(--text-light);">${n.nota}</strong>` }); });
        
        const fS = await getDocs(collection(window.db, "utilizadores", window.myUserId, "faltas")); 
        fS.forEach(d => { const f = d.data(); ev.push({ time: new Date(f.criadoEm || f.dataInicio).getTime(), cat: 'faltas', icon: '<i class="fa-solid fa-user-xmark"></i>', cor: f.justificada ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Falta a ${f.disciplina} (${f.horas}h)`, desc: f.justificada ? `Justificada` : `Injustificada` }); });
        
        ev = ev.filter(e => !isNaN(e.time)); ev.sort((a,b) => b.time - a.time); 
        
        let eventos = ev;
        if(window.timelineFilterCat !== 'all') eventos = eventos.filter(e => e.cat === window.timelineFilterCat);
        if(eventos.length === 0) { cCont.innerHTML = getEmptyState('O teu histórico escolar está limpo.', 'fa-clock-rotate-left'); return; }
        
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

// ==========================================
// 2. EVOLUÇÃO (Humor e Gamificação aqui!)
// ==========================================
async function carregarEvolucaoAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    try {
        let html = `<h4 style="color:var(--text-muted); margin-bottom:15px; font-size:0.9rem; text-transform:uppercase;"><i class="fa-solid fa-bolt"></i> Histórico de XP e Comportamento</h4>`;
        let regs = [];

        // Ocorrências do Professor
        const ocSnap = await getDocs(query(collection(window.db, "utilizadores", window.myUserId, "ocorrencias"))); 
        ocSnap.forEach(d => { const o = d.data(); regs.push({ time: new Date(o.data).getTime() || o.timestamp, ...o }); });

        // Humores Diários do Aluno
        const mdSnap = await getDocs(query(collection(window.db, "utilizadores", window.myUserId, "humor"))); 
        mdSnap.forEach(d => { 
            const h = d.data(); 
            const dataStr = new Date(h.timestamp).toLocaleDateString('pt-PT');
            regs.push({ time: h.timestamp, tipo: 'positiva', titulo: 'Check-in Diário', descricao: `Sentiste-te ${h.humor}.`, xp: 10, data: dataStr, autor: 'Gamificação' }); 
        });

        if(regs.length === 0) { 
            html += getEmptyState('Sem registos de evolução.', 'fa-star'); 
        } else {
            regs.sort((a,b) => b.time - a.time);
            regs.forEach(r => {
                const isPos = r.tipo === 'positiva'; const cor = isPos ? 'var(--success-green)' : 'var(--danger-red)'; const bgCor = isPos ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                const xpLabel = r.xp ? (r.xp > 0 ? `+${r.xp} XP` : `${r.xp} XP`) : (isPos ? 'Registo Positivo' : 'Registo Negativo');
                html += `<div style="display:flex; align-items:center; justify-content:space-between; background:${bgCor}; border: 1px solid ${cor}; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                            <div><strong style="color:${cor}; font-size:1.1rem;">${xpLabel}</strong><br><span style="color:var(--text-light); font-size:0.95rem; font-weight:bold;">${r.titulo}</span>${r.descricao ? `<div style="color:var(--text-muted); font-size:0.85rem; margin-top:3px;">${r.descricao}</div>` : ''}</div>
                            <div style="text-align:right; font-size:0.75rem; color:var(--text-muted);">${r.data}<br>${r.autor==='Gamificação'?'App':`Prof. ${r.autor}`}</div>
                         </div>`;
            });
        }
        cCont.innerHTML = html;
    } catch(e) {}
}

// ==========================================
// 3. REUNIÕES (OS 5 MOMENTOS OFICIAIS)
// ==========================================
async function carregarReunioesAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    
    // Os 5 momentos fixos que pediste
    const MOMENTOS = ['1ª Intercalar', '1ª Avaliação', '2ª Intercalar', '2ª Avaliação', '3ª Avaliação'];
    
    try {
        const snap = await getDocs(query(collection(window.db, "utilizadores", window.myUserId, "reunioes"))); 
        let notasReunioes = {};
        
        // Agrupar observações que vêm da base de dados pelo 'momento'
        snap.forEach(d => {
            const o = d.data();
            const mom = o.momento || '1ª Intercalar'; // fallback
            if(!notasReunioes[mom]) notasReunioes[mom] = [];
            notasReunioes[mom].push(o);
        });

        // Tabs dos 5 momentos
        let html = `<div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:15px; margin-bottom:15px;" class="filter-chips-container" id="reunioes-tabs">`;
        MOMENTOS.forEach((m, idx) => { html += `<div class="filter-chip ${idx===0?'active':''}" data-momento="${m}">${m}</div>`; });
        html += `</div><div id="reuniao-detalhe-container"></div>`;
        
        cCont.innerHTML = html;

        // Função de renderizar o interior do momento selecionado
        const renderMomento = (momentoAtivo) => {
            const cDet = document.getElementById('reuniao-detalhe-container');
            const dadosMomento = notasReunioes[momentoAtivo] || [];
            
            if(dadosMomento.length === 0) {
                cDet.innerHTML = getEmptyState(`Ainda não há dados para a ${momentoAtivo}.`, 'fa-folder-closed');
                return;
            }

            let mHtml = '';
            
            // 1º Procurar a Avaliação Global do DT
            const avalGlobal = dadosMomento.find(d => d.disciplina === 'Direção de Turma' || d.isDT === true);
            if(avalGlobal) {
                mHtml += `<div class="card" style="border: 2px solid var(--primary-green); background: rgba(0, 204, 136, 0.05); margin-bottom: 20px;">
                            <h3 style="color:var(--primary-green); font-size:1.1rem; margin-bottom:10px;"><i class="fa-solid fa-clipboard-user"></i> Avaliação Global (Diretor de Turma)</h3>
                            <p style="font-size:0.9rem; color:var(--text-light); line-height:1.5; margin-bottom:10px;">${avalGlobal.texto}</p>
                            <span style="font-size:0.75rem; color:var(--text-muted);">Por Prof. ${avalGlobal.autor} | ${avalGlobal.data}</span>
                          </div>`;
            }

            // 2º Restantes Disciplinas
            mHtml += `<h4 style="color:var(--text-muted); font-size:0.85rem; text-transform:uppercase; margin-bottom:15px;">Pareceres por Disciplina</h4><div style="display:grid; gap:15px;">`;
            dadosMomento.forEach(o => {
                if(o.disciplina === 'Direção de Turma' || o.isDT === true) return;
                mHtml += `<div style="background:var(--bg-card); border-left:4px solid #0ea5e9; padding:15px; border-radius:8px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:8px;"><strong style="color:var(--text-light); font-size:1rem;">${o.disciplina}</strong></div>
                            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">${o.texto}</p>
                            <div style="font-size:0.75rem; color:var(--text-muted); text-align:right;">Prof. ${o.autor}</div>
                          </div>`;
            });
            cDet.innerHTML = mHtml + `</div>`;
        };

        // Adicionar eventos aos botões
        document.querySelectorAll('#reunioes-tabs .filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                document.querySelectorAll('#reunioes-tabs .filter-chip').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active');
                renderMomento(e.target.getAttribute('data-momento'));
            });
        });

        // Renderizar a 1ª por defeito
        renderMomento(MOMENTOS[0]);

    } catch(e) {}
}

// (Manti as funções carregarNotasAluno, carregarFaltasAluno e carregarPRHFsAluno iguais para não apagar a tua estrutura modular que estava correta!)
