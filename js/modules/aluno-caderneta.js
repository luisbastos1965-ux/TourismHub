import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// CACHE INTELIGENTE PARA ALUNO (COFRE 12H)
// ==========================================
async function lerFirebaseOuCacheAluno(caminho, queryParams = null) {
    // Usamos um truque de cache que até guarda as queries (se existirem) 
    const baseId = caminho.replace(/\//g, '_');
    const paramStr = queryParams ? JSON.stringify(queryParams) : 'tudo';
    const cacheChave = `cache_al_${baseId}_${paramStr}`;
    const tempoChave = `tempo_${cacheChave}`;
    
    const agora = Date.now();
    const tempoGuardado = localStorage.getItem(tempoChave);
    let arrayDados = [];
    
    if (tempoGuardado && (agora - parseInt(tempoGuardado) < 43200000)) {
        console.log(`⚡ A ler do Cofre Local: ${caminho}`);
        arrayDados = JSON.parse(localStorage.getItem(cacheChave));
    } else {
        console.log(`🔥 A ler do Firebase: ${caminho}`);
        
        let q;
        if (queryParams && queryParams.tipo === "orderBy") {
            const { query: fbQuery, collection: fbCollection, orderBy: fbOrderBy } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            q = fbQuery(fbCollection(window.db, caminho), fbOrderBy(queryParams.campo, queryParams.ordem));
        } else {
            const { collection: fbCollection } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            q = fbCollection(window.db, caminho);
        }
        
        const { getDocs } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const snap = await getDocs(q);
        snap.forEach(d => arrayDados.push({ _id: d.id, ...d.data() }));
        
        localStorage.setItem(cacheChave, JSON.stringify(arrayDados));
        localStorage.setItem(tempoChave, agora.toString());
    }
    
    // Simula a resposta do Firebase para manter a compatibilidade total
    return {
        empty: arrayDados.length === 0,
        docs: arrayDados.map(item => ({ id: item._id, data: () => item })),
        forEach: function(cb) { this.docs.forEach(doc => cb(doc)); }
    };
}

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
    window.timelineFilterCat = 'all';

    document.getElementById('tab-aluno-timeline')?.addEventListener('click', (e) => { ativarTab(e); document.getElementById('timeline-filtros').style.display = 'flex'; carregarTimelineAluno(); });
    document.getElementById('tab-aluno-notas')?.addEventListener('click', (e) => { ativarTab(e); document.getElementById('timeline-filtros').style.display = 'none'; carregarNotasAluno(); });
    document.getElementById('tab-aluno-faltas')?.addEventListener('click', (e) => { ativarTab(e); document.getElementById('timeline-filtros').style.display = 'none'; carregarFaltasAluno(); });
    document.getElementById('tab-aluno-prhfs')?.addEventListener('click', (e) => { ativarTab(e); document.getElementById('timeline-filtros').style.display = 'none'; carregarPRHFsAluno(); });
    document.getElementById('tab-aluno-evolucao')?.addEventListener('click', (e) => { ativarTab(e); document.getElementById('timeline-filtros').style.display = 'none'; carregarEvolucaoAluno(); });
    document.getElementById('tab-aluno-observacoes')?.addEventListener('click', (e) => { ativarTab(e); document.getElementById('timeline-filtros').style.display = 'none'; carregarReunioesAluno(); });

    document.querySelectorAll('#timeline-filtros .filter-chip').forEach(chip => {
        chip.addEventListener('click', (e) => {
            document.querySelectorAll('#timeline-filtros .filter-chip').forEach(c => c.classList.remove('active'));
            e.target.classList.add('active'); 
            window.timelineFilterCat = e.target.getAttribute('data-cat'); 
            carregarTimelineAluno();
        });
    });
}

function ativarTab(e) {
    document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); 
    if (e && e.currentTarget) e.currentTarget.classList.add('active');
    else if (e && e.target) e.target.classList.add('active');
    
    document.getElementById('aluno-caderneta-content').innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; 
}

async function carregarTimelineAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    try {
        let ev = [];
        const nS_novas = await lerFirebaseOuCacheAluno(`utilizadores/${window.myUserId}/avaliacoes`);
        const nS_antigas = await lerFirebaseOuCacheAluno(`utilizadores/${window.myUserId}/notas`);
        
        // --- O DESEMPACOTADOR ---
        let notasProcessadas = [...nS_novas.docs];
        nS_antigas.forEach(d => {
            const data = d.data();
            if(data.lista_notas) data.lista_notas.forEach(n => notasProcessadas.push({ data: () => n }));
            else if(data.disciplina) notasProcessadas.push(d);
        });
        
        notasProcessadas.forEach(d => { 
            const n = d.data(); 
            const dataLancamento = n.dataLancamento || n.data || new Date().toISOString();
            const modLabel = n.modulo ? n.modulo.toString().replace(/\D/g, '') : '?';
            ev.push({ 
                time: new Date(dataLancamento).getTime(), 
                cat: 'notas', icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', 
                titulo: 'Nova Avaliação', desc: `${n.disciplina} (M${modLabel}): <strong style="color:var(--text-light);">${n.nota}</strong>` 
            }); 
        });
        
        const fS = await lerFirebaseOuCacheAluno(`utilizadores/${window.myUserId}/faltas`); 
        fS.forEach(d => { 
            const f = d.data(); 
            ev.push({ 
                time: new Date(f.dataRegisto || f.dataInicio).getTime(), 
                cat: 'faltas', icon: '<i class="fa-solid fa-user-xmark"></i>', 
                cor: f.justificada ? 'var(--success-green)' : 'var(--danger-red)', 
                titulo: `Falta a ${f.disciplina} (${f.duracaoBlocos || f.horas}h)`, 
                desc: f.justificada ? `Justificada` : `Injustificada - Ocorrida a ${f.dataFalta ? new Date(f.dataFalta).toLocaleDateString('pt-PT') : (f.dataInicio || 'SN')}` 
            }); 
        });
        
        ev = ev.filter(e => !isNaN(e.time)); ev.sort((a,b) => b.time - a.time); 
        let eventos = ev;
        window.timelineFilterCat = window.timelineFilterCat || 'all';
        if(window.timelineFilterCat !== 'all') eventos = eventos.filter(e => e.cat === window.timelineFilterCat);
        if(eventos.length === 0) { cCont.innerHTML = getEmptyState('O teu histórico escolar está limpo.', 'fa-clock-rotate-left'); return; }
        
        let html = '<div class="timeline">';
        eventos.forEach(e => { 
            html += `<div class="timeline-item"><div class="timeline-icon" style="color: ${e.cor}; border-color: ${e.cor};">${e.icon}</div><div class="timeline-content" style="border-left: 3px solid ${e.cor};"><span class="timeline-date">${new Date(e.time).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span><strong style="color:var(--text-light); display:block; margin-bottom:5px;">${e.titulo}</strong><p style="font-size:0.85rem; color:var(--text-light); margin:0;">${e.desc}</p></div></div>`; 
        });
        cCont.innerHTML = html + '</div>';
    } catch(e) { console.error("Erro na Timeline:", e); }
}

async function carregarEvolucaoAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    try {
        let html = `<h4 style="color:var(--text-muted); margin-bottom:15px; font-size:0.9rem; text-transform:uppercase;"><i class="fa-solid fa-bolt"></i> Histórico de XP e Comportamento</h4>`;
        let regs = [];

        const ocSnap = await lerFirebaseOuCacheAluno(`utilizadores/${window.myUserId}/ocorrencias`); 
        ocSnap.forEach(d => { const o = d.data(); regs.push({ time: new Date(o.data).getTime() || o.timestamp, ...o }); });

        const mdSnap = await lerFirebaseOuCacheAluno(`utilizadores/${window.myUserId}/humor`); 
        mdSnap.forEach(d => { 
            const h = d.data(); const dataStr = new Date(h.timestamp).toLocaleDateString('pt-PT');
            regs.push({ time: h.timestamp, tipo: 'positiva', titulo: 'Check-in Diário', descricao: `Sentiste-te ${h.humor}.`, xp: 10, data: dataStr, autor: 'App' }); 
        });

        if(regs.length === 0) { 
            html += getEmptyState('Sem registos de evolução.', 'fa-star'); 
        } else {
            regs.sort((a,b) => b.time - a.time);
            regs.forEach(r => {
                const isPos = r.tipo === 'positiva'; const cor = isPos ? 'var(--success-green)' : 'var(--danger-red)'; const bgCor = isPos ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                const xpLabel = r.xp ? (r.xp > 0 ? `+${r.xp} XP` : `${r.xp} XP`) : (isPos ? 'Registo Positivo' : 'Registo Negativo');
                
                let dataFormatada = r.data;
                if (typeof dataFormatada === 'string' && dataFormatada.includes('T')) {
                    dataFormatada = new Date(dataFormatada).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' }).replace(',', ' às');
                }

                html += `<div style="display:flex; align-items:center; justify-content:space-between; background:${bgCor}; border: 1px solid ${cor}; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                            <div><strong style="color:${cor}; font-size:1.1rem;">${xpLabel}</strong><br><span style="color:var(--text-light); font-size:0.95rem; font-weight:bold;">${r.titulo}</span>${r.descricao ? `<div style="color:var(--text-muted); font-size:0.85rem; margin-top:3px;">${r.descricao}</div>` : ''}</div>
                            <div style="text-align:right; font-size:0.75rem; color:var(--text-muted);">${dataFormatada}<br>${r.autor==='App'?'Gamificação':`Prof. ${r.autor}`}</div>
                         </div>`;
            });
        }
        cCont.innerHTML = html;
    } catch(e) {}
}

async function carregarReunioesAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    
    const MOMENTOS_LABEL = ['1ª Intercalar', '1ª Avaliação', '2ª Intercalar', '2ª Avaliação', '3ª Avaliação'];
    const MOMENTOS_DB = ['momento_1', 'momento_2', 'momento_3', 'momento_4', 'momento_5'];
    
    try {
        const snap = await lerFirebaseOuCacheAluno(`utilizadores/${window.myUserId}/reunioes`); 
        let notasReunioes = {};
        
        snap.forEach(d => {
            notasReunioes[d.id] = d.data();
        });

        let html = `<div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:15px; margin-bottom:15px;" class="filter-chips-container" id="reunioes-tabs">`;
        MOMENTOS_LABEL.forEach((m, idx) => { 
            html += `<div class="filter-chip ${idx===0?'active':''}" data-momento="${MOMENTOS_DB[idx]}">${m}</div>`; 
        });
        html += `</div><div id="reuniao-detalhe-container"></div>`;
        cCont.innerHTML = html;

        const renderMomento = (momentoAtivo) => {
            const cDet = document.getElementById('reuniao-detalhe-container');
            const dadosMomento = notasReunioes[momentoAtivo] || {}; 

            // ==========================================
            // CADEADO DO ALUNO
            // ==========================================
            if (dadosMomento.publicado !== true) {
                cDet.innerHTML = `
                    <div style="text-align: center; padding: 40px 20px; border: 1px dashed #444; border-radius: 8px; background: rgba(0,0,0,0.2);">
                        <i class="fa-solid fa-lock" style="font-size: 3rem; color: #555; margin-bottom: 15px;"></i>
                        <h4 style="color: var(--text-light); font-size: 1.1rem; margin-bottom: 8px;">Reunião em Processamento</h4>
                        <p style="font-size: 0.9rem; color: var(--text-muted); margin: 0;">As tuas avaliações qualitativas estarão disponíveis após aprovação pelo Diretor de Turma.</p>
                    </div>`;
                return;
            }
            // ==========================================
            
            const disciplinasDoAno = obterDisciplinasDoAno();
            let mHtml = `<div style="display:grid; gap:15px; margin-bottom:20px;">`;
            
            disciplinasDoAno.forEach(disc => {
                const texto = (dadosMomento.sinteses_disciplinas && dadosMomento.sinteses_disciplinas[disc]) 
                              ? dadosMomento.sinteses_disciplinas[disc] 
                              : 'Sem comentário (SN).';
                
                mHtml += `<div class="card" style="border-left:4px solid var(--primary-green); margin-bottom:0; background:var(--bg-card); padding:15px; border-radius:8px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                                <strong style="color:var(--text-light); font-size:1.05rem;">${disc}</strong>
                            </div>
                            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:0; white-space: pre-wrap;">${texto}</p>
                          </div>`;
            });
            mHtml += `</div>`;

            const textoGlobal = dadosMomento.sintese_global || 'Sem observações globais registadas (SN).';
            
            mHtml += `<div class="card" style="border: 1px solid var(--warning-yellow); border-radius:8px; padding:15px; background: transparent;">
                        <h3 style="color:var(--warning-yellow); font-size:1rem; margin-bottom:10px;"><i class="fa-solid fa-comment-dots"></i> Observações Globais</h3>
                        <p style="font-size:0.9rem; color:var(--text-light); line-height:1.5; margin-bottom:0; white-space: pre-wrap;">${textoGlobal}</p>
                      </div>`;

            cDet.innerHTML = mHtml;
        };

        document.querySelectorAll('#reunioes-tabs .filter-chip').forEach(chip => {
            chip.addEventListener('click', (e) => {
                document.querySelectorAll('#reunioes-tabs .filter-chip').forEach(c => c.classList.remove('active'));
                e.target.classList.add('active'); 
                renderMomento(e.target.getAttribute('data-momento'));
            });
        });
        
        renderMomento(MOMENTOS_DB[0]);
    } catch(e) { console.error("Erro a carregar as observações do aluno: ", e); }
}

async function carregarNotasAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    try {
        const notasNovas = await lerFirebaseOuCacheAluno(`utilizadores/${window.myUserId}/avaliacoes`);
        const notasAntigas = await lerFirebaseOuCacheAluno(`utilizadores/${window.myUserId}/notas`);
        
        // --- O DESEMPACOTADOR ---
        let notasProcessadas = [...notasNovas.docs];
        notasAntigas.forEach(d => {
            const data = d.data();
            if(data.lista_notas) data.lista_notas.forEach(n => notasProcessadas.push({ data: () => n }));
            else if(data.disciplina) notasProcessadas.push(d);
        });

        let disciplinasDoAluno = {}; window.mapNotasCache = {};
        
        notasProcessadas.forEach(d => { 
            const n = d.data(); 
            const modF = n.modulo ? n.modulo.toString().replace(/\D/g, '') : '?';
            n.modulo = modF; 
            
            if(!disciplinasDoAluno[n.disciplina]) disciplinasDoAluno[n.disciplina] = []; 
            const index = disciplinasDoAluno[n.disciplina].findIndex(x => x.modulo === modF);
            if (index > -1) disciplinasDoAluno[n.disciplina][index] = n; 
            else disciplinasDoAluno[n.disciplina].push(n); 
            
            window.mapNotasCache[`${n.disciplina}_${modF}`] = n.nota; 
        });
        
        const ordemDisciplinas = obterDisciplinasDoAno();
        if(ordemDisciplinas.length === 0) { cCont.innerHTML = getEmptyState('Ainda não tens disciplinas ativas.', 'fa-book'); return; }

        let html = `<button id="btn-pauta-global" class="primary-btn" style="margin-bottom: 20px; background-color: transparent; border: 1px solid var(--primary-green); color: var(--primary-green);" onclick="window.abrirModalPautaGlobal()">Pauta Global</button>`;
        
        ordemDisciplinas.forEach(disc => {
            if(disciplinasDoAluno[disc] && disciplinasDoAluno[disc].length > 0) {
                let sum = 0; let c = 0; let modsHtml = '';
                disciplinasDoAluno[disc].sort((a,b) => parseInt(a.modulo) - parseInt(b.modulo)).forEach(n => {
                    if(n.nota !== 'REP' && !isNaN(n.nota)) { sum += Number(n.nota); c++; }
                    const cor = (n.nota === 'REP' || Number(n.nota) < 10) ? 'var(--danger-red)' : 'var(--success-green)'; 
                    const modLabel = n.modulo.toString().startsWith('UC') ? n.modulo : `Módulo ${n.modulo}`;
                    modsHtml += `<div class="modulo-row"><span style="color:var(--text-light);">${modLabel}</span><span style="font-weight:bold; color:${cor};">${n.nota}</span></div>`;
                });
                const med = c > 0 ? (sum/c).toFixed(1) : '-'; const medCor = (med !== '-' && med < 10) ? 'var(--danger-red)' : 'var(--text-light)';
                
                html += `<div class="disciplina-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                            <span class="disciplina-title" style="color:var(--text-light);">${disc}</span>
                            <span><span style="font-size:0.75rem; color:var(--text-muted); margin-right:8px;">Média:</span><span class="disciplina-media" style="color:${medCor};">${med}</span> <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; color:var(--text-muted); margin-left:5px;"></i></span>
                         </div><div class="disciplina-modules">${modsHtml}</div>`;
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
    
    const btnClose = document.getElementById('btn-close-pauta');
    if(btnClose) {
        btnClose.onclick = () => { if(mod) mod.style.display = 'none'; };
    }

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
        const snap = await lerFirebaseOuCacheAluno(`utilizadores/${window.myUserId}/faltas`, { tipo: "orderBy", campo: "dataRegisto", ordem: "desc" }); 
        if(snap.empty) { cCont.innerHTML = getEmptyState('Nenhuma falta registada.', 'fa-user-check'); return; }

        let faltasPorChave = {};
        snap.forEach(d => {
            const f = d.data(); 
            const mod = f.modulo || '1'; 
            const duracaoDaFalta = Number(f.duracaoBlocos || f.horas || 1);
            const key = `${f.disciplina}_${mod}`;
            
            if(!faltasPorChave[key]) faltasPorChave[key] = { disc: f.disciplina, mod: mod, horasInjustificadas: 0, totalHoras: 0, detalhes: [] };
            
            faltasPorChave[key].detalhes.push(f); 
            faltasPorChave[key].totalHoras += duracaoDaFalta;
            
            if(!f.justificada) faltasPorChave[key].horasInjustificadas += duracaoDaFalta;
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
                const duracao = f.duracaoBlocos || f.horas;
                const dataFormatada = f.dataFalta ? new Date(f.dataFalta).toLocaleDateString('pt-PT') : (f.dataInicio || "SN");
                const jStatus = f.justificada ? `<span style="color:var(--success-green);"><i class="fa-solid fa-check"></i> Justificada</span>` : `<span style="color:var(--danger-red);"><i class="fa-solid fa-xmark"></i> Injustificada</span>`;
                
                html += `<div style="padding:10px; background:rgba(0,0,0,0.2); border-left:3px solid ${f.justificada?'var(--success-green)':'var(--danger-red)'}; border-radius:6px; margin-bottom:8px; display:flex; justify-content:space-between; align-items:center;">
                            <div><div style="font-size:0.85rem; color:var(--text-light); margin-bottom:3px;">${dataFormatada}</div><span style="color:var(--text-muted); font-size:0.75rem;">${duracao}h marcadas</span></div>
                            <div style="font-size:0.8rem; font-weight:bold;">${jStatus}</div>
                         </div>`;
            });
            html += `</div>`;
        }
        cCont.innerHTML = html;
    } catch(e) { console.error("Erro no carregamento de faltas:", e); }
}

async function carregarPRHFsAluno() {
    const cCont = document.getElementById('aluno-caderneta-content'); if(!cCont) return;
    try {
        const snap = await lerFirebaseOuCacheAluno(`utilizadores/${window.myUserId}/prhfs`); 
        let pArr = [];
        snap.forEach(d => pArr.push({id: d.id, ...d.data()})); 
        
        let ativas = pArr.filter(p => p.status === 'ativa' || p.status === 'pendente');
        let concluidas = pArr.filter(p => p.status === 'concluida');

        if(pArr.length === 0) { 
            cCont.innerHTML = getEmptyState('Não tens planos de recuperação neste momento.', 'fa-file-shield'); 
            return; 
        }
        
        let html = '';

        if (ativas.length > 0) {
            html += `<h4 style="color:var(--text-muted); margin-bottom:15px; font-size:0.9rem; text-transform:uppercase;"><i class="fa-solid fa-bolt"></i> PRHFs a Decorrer</h4>`;
            ativas.forEach(p => {
                const corCard = p.urgente ? 'var(--danger-red)' : 'var(--warning-yellow)';
                const txtSt = p.urgente ? 'URGENTE' : 'EM CURSO';

                // Tarefa / Instruções do Professor
                let tarefaProfessorHtml = '';
                if (p.tarefaPresencial || p.descricao) {
                    tarefaProfessorHtml = `
                    <div style="background:rgba(0,153,255,0.08); border:1px solid #0099ff; padding:10px; border-radius:8px; margin-bottom:10px;">
                        <strong style="color:#0099ff; font-size:0.8rem;"><i class="fa-solid fa-book-open"></i> Tarefa / Instruções do Professor:</strong>
                        <p style="font-size:0.85rem; color:white; margin:5px 0 0 0; white-space: pre-wrap;">${p.tarefaPresencial || p.descricao}</p>
                    </div>`;
                }

                // CRIAR CAIXINHAS SEPARADAS E CONTAR HORAS
                let caixasSessoesHtml = '';
                let listaSessoes = [];
                let totalHorasMarcadas = 0; // CONTADOR
                
                if (p.sessoesPresenciais && Array.isArray(p.sessoesPresenciais)) {
                    listaSessoes = p.sessoesPresenciais;
                } else if (p.propostaProfessor) {
                    listaSessoes = [{ data: 'Acordado', inicio: '', fim: '', tarefa: p.propostaProfessor, status: 'aceite', horas: p.horasPresenciais || 1 }];
                } else if (p.propostaAluno) {
                    listaSessoes = [{ data: 'Proposto', inicio: '', fim: '', tarefa: p.propostaAluno, status: 'pendente', horas: p.horasPresenciais || 1 }];
                }

                if (listaSessoes.length > 0) {
                    listaSessoes.forEach((s, idx) => {
                        const sHoras = Number(s.horas || 1);
                        totalHorasMarcadas += sHoras; // SOMA AS HORAS DESTA CAIXA

                        const dataFormatada = s.data && s.data.includes('-') ? s.data.split('-').reverse().join('/') : (s.data || '');
                        const horaFormatada = s.inicio && s.fim ? `das ${s.inicio} às ${s.fim}` : '';
                        const horasTotaisTxt = ` — <strong>${sHoras}h</strong>`;
                        
                        const isAceite = s.status === 'aceite' || p.propostaLidaDT === true;
                        const corBorda = isAceite ? 'var(--success-green)' : 'var(--warning-yellow)';
                        const bgCor = isAceite ? 'rgba(0,204,136,0.08)' : 'rgba(255,204,0,0.08)';
                        const iconeStatus = isAceite ? '<i class="fa-solid fa-calendar-check" style="color:var(--success-green);"></i>' : '<i class="fa-solid fa-clock" style="color:var(--warning-yellow);"></i>';
                        const labelStatus = isAceite ? 'Sessão Confirmada' : 'A aguardar validação do Professor';
                        const labelSugestao = isAceite ? 'Agendado' : 'Aluno Sugere';

                        caixasSessoesHtml += `
                        <div style="background:${bgCor}; border:1px dashed ${corBorda}; padding:10px; border-radius:8px; margin-bottom:8px;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:3px;">
                                <span style="font-size:0.75rem; color:${corBorda}; font-weight:bold;">${iconeStatus} ${labelSugestao} (Sessão #${idx + 1})</span>
                                <span style="font-size:0.8rem; color:white; font-weight:bold;">${dataFormatada} ${horaFormatada}${horasTotaisTxt}</span>
                            </div>
                            ${s.tarefa ? `<p style="font-size:0.8rem; color:var(--text-light); margin:5px 0 0 0;"><strong>Nota:</strong> ${s.tarefa}</p>` : ''}
                            <span style="font-size:0.75rem; color:var(--text-muted);">${labelStatus}</span>
                        </div>`;
                    });
                }

                // GESTÃO DO BOTÃO COM BASE NO LIMITE DE HORAS
                const maxHoras = Number(p.horasPresenciais || 0);
                let botaoMarcarMais = '';
                
                if (maxHoras > 0) {
                    if (totalHorasMarcadas < maxHoras) {
                        botaoMarcarMais = `
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <button class="secondary-btn small-btn btn-abrir-modal-aluno-proposta" data-id="${p.id}" style="flex:1; border-color:var(--warning-yellow); color:var(--warning-yellow);">
                                <i class="fa-regular fa-calendar"></i> + Adicionar Horas (${totalHorasMarcadas}/${maxHoras}h)
                            </button>
                        </div>`;
                    } else {
                        botaoMarcarMais = `
                        <div style="margin-top:10px; text-align:center; padding:8px; background:rgba(0,204,136,0.1); border-radius:6px; border:1px solid var(--success-green);">
                            <span style="font-size:0.8rem; color:var(--success-green); font-weight:bold;"><i class="fa-solid fa-check-circle"></i> Todas as horas exigidas (${maxHoras}h) foram agendadas!</span>
                        </div>`;
                    }
                }

                let interacaoHtml = `
                ${tarefaProfessorHtml}
                ${caixasSessoesHtml}
                ${botaoMarcarMais}`;

                let estadoPrazoHtml = '';
                if (p.prazo) {
                    const hoje = new Date(); hoje.setHours(0,0,0,0);
                    const limite = new Date(p.prazo);
                    const dif = limite.getTime() - hoje.getTime();
                    const dias = Math.ceil(dif / (1000 * 3600 * 24));
                    
                    if (dias < 0) estadoPrazoHtml = `<span style="color:var(--danger-red);"><i class="fa-solid fa-triangle-exclamation"></i> ATRASADO</span>`;
                    else if (dias <= 2) estadoPrazoHtml = `<span style="color:var(--warning-yellow);"><i class="fa-solid fa-clock"></i> Termina em ${dias} dias</span>`;
                    else estadoPrazoHtml = `<span style="color:var(--text-muted);"><i class="fa-regular fa-calendar"></i> Prazo: ${p.prazo.split('-').reverse().join('/')}</span>`;
                }

                html += `
                <div class="card" style="margin-bottom:15px; border-left:4px solid ${corCard}; position:relative;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <strong style="color:white; font-size:1.05rem;">${p.disciplina} <span style="font-size:0.8rem; color:var(--text-muted);">(M${p.modulo})</span></strong>
                            <div style="color:${corCard}; font-weight:bold; font-size:0.85rem; margin-top:3px;">${txtSt}</div>
                        </div>
                    </div>
                    <p style="font-size:0.85rem; color:var(--text-light); margin:10px 0;">${p.descricao}</p>
                    <div style="font-size:0.8rem; background:rgba(0,0,0,0.2); padding:6px; border-radius:4px; display:inline-block; margin-bottom:10px;">
                        ${estadoPrazoHtml} | Presenciais: <strong>${p.horasPresenciais || 0}h</strong>
                    </div>
                    ${p.ficheiroBase64 ? `<a href="${p.ficheiroBase64}" download="Anexo_PRHF_${p.disciplina}_Mod${p.modulo}" class="secondary-btn small-btn" style="display:inline-block; margin-bottom:10px; border-color:#0099ff; color:#0099ff;"><i class="fa-solid fa-download"></i> Baixar Anexo</a>` : ''}
                    ${interacaoHtml}
                </div>`;
            });
        }

        if (concluidas.length > 0) {
            html += `<h4 style="color:var(--text-muted); margin-top:25px; margin-bottom:15px; font-size:0.9rem; text-transform:uppercase;"><i class="fa-solid fa-check-double"></i> Histórico Concluído</h4>`;
            concluidas.forEach(c => {
                html += `
                <div style="background:rgba(0,0,0,0.2); border-left: 3px solid var(--success-green); padding:12px; border-radius:6px; margin-bottom:10px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <strong style="color:white; font-size:0.95rem;">${c.disciplina} <span style="font-size:0.75rem; color:var(--text-muted);">(M${c.modulo})</span></strong><br>
                            ${c.horasPresenciais > 0 ? `<span style="font-size:0.75rem; color:var(--warning-yellow); display:inline-block; margin-top:3px;"><i class="fa-solid fa-clock"></i> ${c.horasPresenciais}h Presenciais cumpridas</span>` : ''}
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:0.7rem; color:var(--success-green); font-weight:bold;">Concluído</span>
                        </div>
                    </div>
                    ${c.feedbackProfessor ? `<div style="font-size:0.8rem; color:black; margin-top:8px; background:rgba(0, 204, 136, 0.7); padding:6px; border-radius:4px;"><strong>Feedback do Prof:</strong> ${c.feedbackProfessor}</div>` : ''}
                </div>`;
            });
        }

        cCont.innerHTML = html;

        cCont.querySelectorAll('.btn-abrir-modal-aluno-proposta').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                const id = e.currentTarget.getAttribute('data-id');
                window.abrirModalPropostaAluno(id);
            });
        });

    } catch(e) {
        console.error("Erro PRHF Aluno:", e);
        cCont.innerHTML = '<p class="text-danger center">Erro a carregar PRHFs.</p>';
    }
}

// =========================================================================
// MODAL DINÂMICO DE MARCAÇÃO MÚLTIPLA DE DIAS PRESENCIAIS (ALUNO)
// =========================================================================

window.abrirModalPropostaAluno = async function(prhfId) {
    let modal = document.getElementById('modal-aluno-proposta-dinamico');
    if (!modal) {
        const htmlModal = `
        <div id="modal-aluno-proposta-dinamico" class="modal-overlay" style="display: flex; z-index: 9999; align-items: center; justify-content: center;">
            <div class="action-sheet" style="max-width: 450px; width: 90%; padding: 20px; max-height: 90vh; overflow-y: auto; background: var(--bg-card); border: 1px solid #333;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                    <h3 style="color: var(--warning-yellow); margin:0;"><i class="fa-regular fa-calendar"></i> Marcar Dias Presenciais</h3>
                    <button type="button" onclick="document.getElementById('modal-aluno-proposta-dinamico').style.display='none'" style="background:none; border:none; color:white; font-size:1.3rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                <input type="hidden" id="aluno-prop-prhf-id" value="${prhfId}">
                <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Podes adicionar dias disponíveis para o teu plano.</p>
                
                <div id="aluno-linhas-sessoes-container" style="display:flex; flex-direction:column; gap:10px; margin-bottom:15px;"></div>

                <button type="button" id="aluno-btn-mais-sessao" class="secondary-btn small-btn" style="width:100%; border-color:var(--warning-yellow); color:var(--warning-yellow); margin-bottom:20px;">
                    <i class="fa-solid fa-plus"></i> Adicionar Outra Data
                </button>

                <button type="button" id="aluno-btn-enviar-multiplas-propostas" class="primary-btn" style="width:100%; background:var(--warning-yellow); color:black;">
                    <i class="fa-solid fa-paper-plane"></i> Atualizar e Enviar Propostas
                </button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', htmlModal);
        
        document.getElementById('aluno-btn-mais-sessao').addEventListener('click', () => window.adicionarLinhaAlunoModal());
        document.getElementById('aluno-btn-enviar-multiplas-propostas').addEventListener('click', () => window.enviarPropostasAlunoFirebase());
    } else {
        document.getElementById('aluno-prop-prhf-id').value = prhfId;
        modal.style.display = 'flex';
    }

    window.renderizarLinhasAlunoModal([{ data: '', inicio: '', fim: '', tarefa: '' }]);
};

window.renderizarLinhasAlunoModal = function(arr) {
    const cont = document.getElementById('aluno-linhas-sessoes-container');
    if (!cont) return;
    let html = '';
    arr.forEach((s, idx) => {
        html += `
        <div class="aluno-sessao-linha-item" style="background: rgba(0,0,0,0.2); border: 1px solid #444; border-radius: 8px; padding: 12px; position: relative; margin-bottom: 8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:0.75rem; color:var(--warning-yellow); font-weight:bold;">Nova Proposta</span>
                <button type="button" onclick="this.closest('.aluno-sessao-linha-item').remove()" style="background:none; border:none; color:var(--danger-red); cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
            </div>
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <div style="flex: 2;"><label style="font-size:0.7rem; color:var(--text-muted);">Data</label><input type="date" value="${s.data || ''}" class="input-padrao al-data" style="width:100%; margin:0; font-size:0.85rem;"></div>
                <div style="flex: 1;"><label style="font-size:0.7rem; color:var(--text-muted);">Início</label><input type="time" value="${s.inicio || ''}" class="input-padrao al-inicio" style="width:100%; margin:0; font-size:0.85rem;"></div>
                <div style="flex: 1;"><label style="font-size:0.7rem; color:var(--text-muted);">Fim</label><input type="time" value="${s.fim || ''}" class="input-padrao al-fim" style="width:100%; margin:0; font-size:0.85rem;"></div>
            </div>
            <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:3px;">Nota/Observação (Opcional)</label>
            <input type="text" value="${s.tarefa || ''}" placeholder="Ex: Disponível após as 14h..." class="input-padrao al-tarefa" style="width:100%; margin:0; font-size:0.85rem;">
        </div>`;
    });
    cont.innerHTML = html;
};

window.adicionarLinhaAlunoModal = function() {
    const cont = document.getElementById('aluno-linhas-sessoes-container');
    if (!cont) return;
    const div = document.createElement('div');
    div.className = 'aluno-sessao-linha-item';
    div.style.cssText = 'background: rgba(0,0,0,0.2); border: 1px solid #444; border-radius: 8px; padding: 12px; position: relative; margin-bottom: 8px;';
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:0.75rem; color:var(--warning-yellow); font-weight:bold;">Nova Proposta</span>
            <button type="button" onclick="this.closest('.aluno-sessao-linha-item').remove()" style="background:none; border:none; color:var(--danger-red); cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
        </div>
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <div style="flex: 2;"><label style="font-size:0.7rem; color:var(--text-muted);">Data</label><input type="date" class="input-padrao al-data" style="width:100%; margin:0; font-size:0.85rem;"></div>
            <div style="flex: 1;"><label style="font-size:0.7rem; color:var(--text-muted);">Início</label><input type="time" class="input-padrao al-inicio" style="width:100%; margin:0; font-size:0.85rem;"></div>
            <div style="flex: 1;"><label style="font-size:0.7rem; color:var(--text-muted);">Fim</label><input type="time" class="input-padrao al-fim" style="width:100%; margin:0; font-size:0.85rem;"></div>
        </div>
        <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:3px;">Nota/Observação (Opcional)</label>
        <input type="text" placeholder="Ex: Disponível após as 14h..." class="input-padrao al-tarefa" style="width:100%; margin:0; font-size:0.85rem;">`;
    cont.appendChild(div);
};

window.enviarPropostasAlunoFirebase = async function() {
    const prhfId = document.getElementById('aluno-prop-prhf-id').value;
    const linhas = document.querySelectorAll('.aluno-sessao-linha-item');
    let novasSessoes = [];
    let erro = false;

    linhas.forEach(l => {
        const data = l.querySelector('.al-data').value;
        const inicio = l.querySelector('.al-inicio').value;
        const fim = l.querySelector('.al-fim').value;
        const tarefa = l.querySelector('.al-tarefa').value.trim();

        if (!data || !inicio || !fim) {
            erro = true;
        } else {
            let [hIni, mIni] = inicio.split(':').map(Number);
            let [hFim, mFim] = fim.split(':').map(Number);
            let hI = hIni, hF = hFim;
            if (hF < hI) hF += 24; 
            const diffMinutos = (hF * 60 + mFim) - (hI * 60 + mIni);
            const horasSessao = Math.max(1, Math.round(diffMinutos / 60));

            novasSessoes.push({ data, inicio, fim, tarefa, horas: horasSessao, status: 'pendente' });
        }
    });

    if (erro || novasSessoes.length === 0) {
        alert("Preenche todas as datas, horas de início e fim das sessões que queres marcar.");
        return;
    }

    const btn = document.getElementById('aluno-btn-enviar-multiplas-propostas');
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A atualizar...';
    btn.disabled = true;

    try {
        const { doc, updateDoc, getDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const prhfRef = doc(window.db, "utilizadores", window.myUserId, "prhfs", prhfId);
        
        const docSnap = await getDoc(prhfRef);
        let sessoesExistentes = [];
        if (docSnap.exists() && docSnap.data().sessoesPresenciais && Array.isArray(docSnap.data().sessoesPresenciais)) {
            sessoesExistentes = docSnap.data().sessoesPresenciais;
        }

        const todasAsSessoes = [...sessoesExistentes, ...novasSessoes];
        const arrPropostas = todasAsSessoes.map(s => {
            const dPt = s.data && s.data.includes('-') ? s.data.split('-').reverse().join('/') : (s.data || '');
            return `${dPt} das ${s.inicio} às ${s.fim} (${s.horas || 1}h)`;
        });

        await updateDoc(prhfRef, {
            sessoesPresenciais: todasAsSessoes,
            propostaAluno: arrPropostas.join(' | '),
            propostaLidaDT: false
        });

        document.getElementById('modal-aluno-proposta-dinamico').style.display = 'none';
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Atualizar e Enviar Propostas';
        btn.disabled = false;
        carregarPRHFsAluno();
    } catch(err) {
        console.error("Erro ao atualizar proposta:", err);
        alert("Erro ao atualizar proposta.");
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Atualizar e Enviar Propostas';
        btn.disabled = false;
    }
};