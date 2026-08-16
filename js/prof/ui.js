import { db } from "../firebase.js";
import { doc, getDoc, collection, getDocs, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state, ACADEMIAS_INFO, ordemDisciplinasGlobal, nomeCurto, getDisciplinasPermitidas } from "./store.js";

// ==========================================
// A TUA TABELA DE DADOS BASE
// ==========================================
export const ESTRUTURA_MODULAR = {
  'PORT': { 10: [1, 2, 3], 11: [4, 5, 6], 12: [7, 8, 9] },
  'ING': { 10: [1, 2, 3], 11: [4, 5, 6], 12: [7, 8, 9] },
  'AI': { 10: [1, 2, 3], 11: [4, 5, 6] },
  'EF': { 10: [1, 2, 3, 4, 5], 11: [6, 7, 8, 9, 10], 12: [11, 12, 13, 14, 15, 16] },
  'TIC': { 10: [1, 2, 3, 4] },
  'GEO': { 10: [1, 2], 11: [3, 4, 5], 12: [6, 7, 8] },
  'HCA': { 10: [1, 2, 3], 11: [4, 5, 6, 7], 12: [8, 9, 10] },
  'MAT': { 10: [1, 2, 3, 4] },
  'CF': { 10: [1, 2, 3], 11: [4, 5, 6, 7, 8, 9] },
  'TIAT': { 10: [1, 2, 3, 4], 11: [5, 6, 7, 8, 9], 12: [10, 11, 12, 13] },
  'TCAT': { 10: [1, 2, 3, 4], 11: [5, 6, 7] },
  'OTET': { 10: [1, 2, 3, 4], 11: [5, 6, 7, 8], 12: [9, 10, 11, 12] },
  'AET': { 10: [1, 2, 3], 11: [4, 5, 6, 7], 12: [8, 9] },
  'OGOT': { 10: [1, 2, 3, 4, 5], 11: [6, 7, 8, 9, 10], 12: [11] },
  'CMET': { 10: [1, 2, 3], 11: [4, 5], 12: [6, 7, 8, 9, 10] },
  'LNTT': { 10: [1, 2], 11: [3, 4] }
};

export function filtrarDisciplinasDoAno(turmaStr, disciplinasArray) {
    if (!turmaStr || !disciplinasArray) return disciplinasArray || [];
    const ano = parseInt((turmaStr).match(/\d+/)?.[0]) || 10;
    
    return disciplinasArray.filter(disc => {
        const dUpper = disc.toUpperCase().trim();
        if (ESTRUTURA_MODULAR[dUpper]) {
            return ESTRUTURA_MODULAR[dUpper][ano] !== undefined;
        }
        return true; 
    });
}

export function atualizarDropdownModulos(turmaStr, disciplina, selectElement) {
    if (!selectElement) return;
    const ano = parseInt((turmaStr||"10").match(/\d+/)?.[0]) || 10;
    const disc = (disciplina || "").toUpperCase().trim();
    
    let html = '<option value="">Mod...</option>';
    
    if (ESTRUTURA_MODULAR[disc]) {
        for (let y = 10; y <= ano; y++) {
            if (ESTRUTURA_MODULAR[disc][y]) {
                ESTRUTURA_MODULAR[disc][y].forEach(m => {
                    let label = `Módulo ${m}`;
                    if (y === ano) label += ' (Atual)';
                    else label += ' (Em atraso)';
                    html += `<option value="${m}">${label}</option>`;
                });
            }
        }
    } else {
        for(let i=1; i<=15; i++) {
            html += `<option value="${i}">Módulo ${i}</option>`;
        }
    }
    selectElement.innerHTML = html;
}

export function iniciarCarrossel() {
    const track = document.getElementById('stats-carousel-container'); 
    if(!track) return;
    if(state.carouselInterval) clearInterval(state.carouselInterval);
    const startScroll = () => { 
        state.carouselInterval = setInterval(() => { 
            if(track.scrollWidth > track.clientWidth) { 
                track.scrollLeft += 1; 
                if(track.scrollLeft >= (track.scrollWidth - track.clientWidth) - 1) track.scrollLeft = 0; 
            } 
        }, 30); 
    };
    track.addEventListener('mouseenter', () => clearInterval(state.carouselInterval)); 
    track.addEventListener('mouseleave', startScroll);
    track.addEventListener('touchstart', () => clearInterval(state.carouselInterval)); 
    track.addEventListener('touchend', startScroll);
    startScroll();
}

// ==========================================
// VISTAS E GERAÇÃO DE DADOS (Não minificadas)
// ==========================================
export async function carregarRadarProfessor() {
    const cardAssistente = document.getElementById('assistente-global-texto')?.closest('.card');
    const divCarrossel = document.getElementById('stats-carousel-container')?.parentNode;
    const cardModulos = document.getElementById('dashboard-modulos-container')?.closest('.card');
    const cardHorario = document.getElementById('dashboard-horario-container')?.closest('.card');
    const cardEventos = document.getElementById('radar-agenda-container')?.closest('.card');
    const cardAlertas = document.getElementById('dashboard-alertas-container')?.closest('.card');
    
    const papContainerId = 'dyn-pap-dashboard'; 
    let papCont = document.getElementById(papContainerId);
    
    if (!papCont) { 
        papCont = document.createElement('div'); 
        papCont.id = papContainerId; 
        document.getElementById('view-prof-dashboard').prepend(papCont); 
    }

    if (state.activeRole === 'orientador_pap' || state.activeRole === 'coordenador') {
        if(cardAssistente) cardAssistente.style.display = 'none'; 
        if(divCarrossel) divCarrossel.style.display = 'none'; 
        if(cardModulos) cardModulos.style.display = 'none'; 
        if(cardHorario) cardHorario.style.display = 'none'; 
        if(cardEventos) cardEventos.style.display = 'none'; 
        if(cardAlertas) cardAlertas.style.display = 'none';
        
        papCont.style.display = 'block'; 
        papCont.innerHTML = `<p class="text-muted center" style="padding: 20px;">A carregar vista de coordenação especial...</p>`;
        return; 
    }

    papCont.style.display = 'none';
    if(cardAssistente) cardAssistente.style.display = 'block'; 
    if(divCarrossel) divCarrossel.style.display = 'block'; 
    if(cardModulos) cardModulos.style.display = 'block'; 
    if(cardHorario) cardHorario.style.display = 'block'; 
    if(cardEventos) cardEventos.style.display = 'block'; 
    if(cardAlertas) cardAlertas.style.display = 'block';

    const aText = document.getElementById('assistente-global-texto'); 
    const hCont = document.getElementById('dashboard-horario-container'); 
    const eCont = document.getElementById('radar-agenda-container'); 
    const alCont = document.getElementById('dashboard-alertas-container');
    
    aText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A analisar a base de dados...';
    
    if (!state.turmasProfessor || state.turmasProfessor.length === 0) { 
        aText.innerHTML = 'Não tens turmas atribuídas no teu perfil.'; 
        return; 
    }

    try {
        let totalAlunos = 0; let prhfsAtivos = 0; let eventosGlobais = []; let totalFaltasProf = 0; let totalOcorrencias = 0; let profAulasHoje = [];
        let listaAlertas = []; 

        const bK = ['1', '2', '3', '4', '1300', '5', '6', '7']; 
        const bT = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' };
        const hjD = new Date(); 
        const hjStr = `${hjD.getFullYear()}-${String(hjD.getMonth()+1).padStart(2,'0')}-${String(hjD.getDate()).padStart(2,'0')}`;

        for (const t of state.turmasProfessor) {
            try { 
                const tSnap = await getDoc(doc(db, "turmas", t)); 
                if(tSnap.exists() && tSnap.data().horario) { 
                    const hT = tSnap.data().horario; 
                    for (const b of bK) { 
                        const disc = hT[`${hjStr}_${b}`]; 
                        if (disc && state.disciplinasProfessor.includes(disc)) {
                            profAulasHoje.push({ bloco: b, turma: t, disciplina: disc, hora: bT[b] }); 
                        }
                    } 
                } 
            } catch(e) {}
            
            try {
                const snapAl = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); 
                for (const docAluno of snapAl.docs) {
                    totalAlunos++; let faltasAluno = 0; let prhfsAluno = 0;
                    
                    try { 
                        const pSnap = await getDocs(collection(db, "utilizadores", docAluno.id, "prhfs")); 
                        pSnap.forEach(p => { 
                            if (p.data().status !== 'concluida' && state.disciplinasProfessor.includes(p.data().disciplina)) { 
                                prhfsAtivos++; 
                                prhfsAluno++; 
                            } 
                        }); 
                    } catch(err){}
                    
                    try { 
                        const fSnap = await getDocs(collection(db, "utilizadores", docAluno.id, "faltas")); 
                        fSnap.forEach(f => { 
                            if (state.disciplinasProfessor.includes(f.data().disciplina)) { 
                                const h = Number(f.data().horas || 0); 
                                totalFaltasProf += h; 
                                if(!f.data().justificada) faltasAluno += h;
                            } 
                        }); 
                    } catch(err){}
                    
                    try { 
                        const oSnap = await getDocs(collection(db, "utilizadores", docAluno.id, "ocorrencias")); 
                        oSnap.forEach(o => { 
                            if(o.data().autor === state.myUserName) totalOcorrencias++; 
                        }); 
                    } catch(err){}
                    
                    if (faltasAluno > 6) listaAlertas.push({ nome: docAluno.data().nome, turma: t, msg: `${faltasAluno}h de faltas injustificadas.`, tipo: 'falta' });
                    if (prhfsAluno > 1) listaAlertas.push({ nome: docAluno.data().nome, turma: t, msg: `${prhfsAluno} PRHFs pendentes.`, tipo: 'prhf' });
                }
            } catch(e) {}
            try { 
                const snapEv = await getDocs(collection(db, "turmas", t, "eventos")); 
                snapEv.forEach(d => eventosGlobais.push({ turma: t, ...d.data() })); 
            } catch(e) {}
        }

        let avaliacoesEmFalta = 0; 
        const hjStrFull = hjD.toISOString().split('T')[0]; 
        const avaliacoesPassadas = eventosGlobais.filter(e => e.tipo === 'avaliacao' && e.data < hjStrFull && e.professor === state.myUserName);
        avaliacoesEmFalta = avaliacoesPassadas.length; 

        let resumo = `A gerir ${totalAlunos} alunos em ${state.turmasProfessor.length} turmas. `;
        if (prhfsAtivos > 0) {
            resumo += `<br><span style="color:var(--warning-yellow); font-weight:bold;">Atenção: Existem ${prhfsAtivos} PRHFs a decorrer na tua matéria.</span>`; 
        } else {
            resumo += `<br><span style="color:var(--success-green);">Excelente! Tudo em dia com as recuperações.</span>`;
        }
        
        if (avaliacoesEmFalta > 0) {
            resumo += `<br><span style="color:var(--danger-red); font-size:0.85rem;"><i class="fa-solid fa-star"></i> Tens avaliações por lançar no sistema.</span>`;
        }
        aText.innerHTML = resumo;

        let alertasHtml = '';
        if (listaAlertas.length === 0) {
            alertasHtml = '<div class="empty-state"><i class="fa-solid fa-check-circle empty-state-icon" style="color:var(--success-green);"></i><p class="empty-state-desc">Nenhum aluno em risco nas tuas turmas.</p></div>';
        } else {
            listaAlertas.forEach(a => {
                const icon = a.tipo === 'falta' ? '<i class="fa-solid fa-user-xmark" style="color:var(--danger-red);"></i>' : '<i class="fa-solid fa-file-medical" style="color:var(--warning-yellow);"></i>';
                alertasHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border-left:3px solid var(--danger-red); margin-bottom:5px;">
                    <div><strong style="color:white; font-size:0.9rem;">${nomeCurto(a.nome)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${a.turma})</span></div>
                    <div style="font-size:0.8rem; color:var(--text-light); display:flex; align-items:center; gap:5px;">${icon} ${a.msg}</div>
                </div>`;
            });
        }
        if(alCont) alCont.innerHTML = alertasHtml;

        const carouselTrack = document.getElementById('stats-carousel-container');
        if(carouselTrack) {
            carouselTrack.innerHTML = `
                <div class="stat-card"><h2 style="color: var(--primary-green); margin-bottom: 5px;">${state.turmasProfessor.length}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Turmas</span></div>
                <div class="stat-card"><h2 style="color: #0099ff; margin-bottom: 5px;">${totalAlunos}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Alunos</span></div>
                <div class="stat-card"><h2 style="color: var(--danger-red); margin-bottom: 5px;">${totalFaltasProf}h</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Faltas Dadas</span></div>
                <div class="stat-card"><h2 style="color: var(--warning-yellow); margin-bottom: 5px;">${prhfsAtivos}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">PRHFs Ativos</span></div>
                <div class="stat-card"><h2 style="color: #b82bf2; margin-bottom: 5px;">${totalOcorrencias}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Ocorrências</span></div>
                <div class="stat-card"><h2 style="color: #ffaa00; margin-bottom: 5px;">${avaliacoesEmFalta}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">A Lançar</span></div>`;
            iniciarCarrossel();
        }

        let modHtml = '<div style="display:flex; flex-direction:column; gap:8px;">'; 
        let foundMods = false;
        
        for (const t of state.turmasProfessor) {
            const discValidas = filtrarDisciplinasDoAno(t, state.disciplinasProfessor);
            for (const d of discValidas) {
                let modsAvaliados = new Set();
                try {
                    const snapAl = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                    for(const docAl of snapAl.docs) { 
                        try { 
                            const nS = await getDocs(collection(db, "utilizadores", docAl.id, "notas")); 
                            nS.forEach(n => { 
                                if(n.data().disciplina === d && n.data().nota !== 'REP') modsAvaliados.add(n.data().modulo); 
                            }); 
                        } catch(err){} 
                    }
                } catch(e) {}
                
                if (modsAvaliados.size > 0) {
                    foundMods = true;
                    modHtml += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border:1px solid #333;">
                        <div><strong style="color:white; font-size:0.9rem;">${t} - ${d}</strong></div>
                        <div style="text-align:right;"><strong style="color:var(--primary-green); font-size:1.1rem;">${modsAvaliados.size}</strong><br><span style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Mód. Fechados</span></div>
                    </div>`;
                }
            }
        }
        modHtml += '</div>'; 
        
        if(!foundMods) {
            modHtml = '<div class="empty-state"><i class="fa-solid fa-layer-group empty-state-icon"></i><h4 class="empty-state-title">Sem Módulos Concluídos</h4><p class="empty-state-desc">Ainda não tens módulos fechados e validados nesta turma.</p></div>';
        }
        
        const modCont = document.getElementById('dashboard-modulos-container'); 
        if(modCont) modCont.innerHTML = modHtml;

        if(profAulasHoje.length > 0) {
            try { 
                profAulasHoje.sort((a,b) => { 
                    if(!a.hora || !b.hora) return 0; 
                    const getMin = (hx) => parseInt(hx.split(':')[0])*60 + parseInt(hx.split(':')[1]); 
                    return getMin(a.hora) - getMin(b.hora); 
                }); 
                let hHtml = ''; 
                profAulasHoje.forEach(aula => { 
                    hHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:5px; border-left:3px solid #0099ff;"><div><strong style="color:white; font-size:0.9rem;">${aula.disciplina}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">Turma ${aula.turma}</span></div><span style="color:#0099ff; font-weight:bold; font-size:0.85rem;">${aula.hora}</span></div>`; 
                }); 
                if(hCont) hCont.innerHTML = hHtml; 
            } catch(sortErr) { 
                if(hCont) hCont.innerHTML = '<div class="empty-state"><i class="fa-solid fa-clock empty-state-icon" style="color:#0099ff;"></i><p class="empty-state-desc">Sem aulas marcadas hoje.</p></div>'; 
            }
        } else { 
            if(hCont) hCont.innerHTML = '<div class="empty-state"><i class="fa-solid fa-clock empty-state-icon" style="color:#0099ff;"></i><p class="empty-state-desc">Não tens aulas no sistema hoje.</p></div>'; 
        }

        const fut = eventosGlobais.filter(e => e.data && e.data >= hjStrFull).sort((a,b) => a.data.localeCompare(b.data)).slice(0, 3);
        if (fut.length > 0) { 
            let ah = ''; 
            fut.forEach(e => { 
                const datePrint = e.data ? e.data.split('-').reverse().join('/') : 'Brevemente'; 
                const timePrint = e.periodo === 'hora' ? ` às ${e.hora}` : (e.periodo === 'manha' ? ' (Manhã)' : (e.periodo === 'tarde' ? ' (Tarde)' : '')); 
                ah += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:5px; border-left:3px solid var(--warning-yellow);"><div><strong style="color:white; font-size:0.9rem;">${e.titulo}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">Turma ${e.turma}</span></div><div><span style="color:var(--warning-yellow); font-size:0.8rem; display:block;">${datePrint}${timePrint}</span></div></div>`; 
            }); 
            if(eCont) eCont.innerHTML = ah; 
        } else { 
            if(eCont) eCont.innerHTML = '<div class="empty-state"><i class="fa-solid fa-calendar empty-state-icon" style="color:var(--warning-yellow);"></i><p class="empty-state-desc">A tua agenda de eventos futuros está livre.</p></div>'; 
        }
        
    } catch (e) { 
        if(aText) aText.innerHTML = "Problema na ligação a recolher dados estatísticos globais."; 
    }
}

export async function analisarEAtualizarTurma(turmaId) {
    const listC = document.getElementById('lista-alunos-turma'); 
    listC.innerHTML = '<p class="text-muted center">A ler dados dos alunos...</p>';
    document.getElementById('assistente-aula-texto').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A analisar a turma...';
    
    const isDT = (state.activeRole === 'diretor_turma' && turmaId === state.minhaTurmaDT);
    if(isDT) { 
        document.getElementById('badge-dt-turma').style.display = 'inline-block'; 
    } else { 
        document.getElementById('badge-dt-turma').style.display = 'none'; 
    }
    
    const btnPauta = document.getElementById('btn-ver-pauta');
    const btnFaltasGlobal = document.getElementById('btn-ver-faltas-turma');
    const lmsGrid = document.querySelector('.lms-action-grid');
    const btnAvisoGlobal = document.getElementById('btn-abrir-aviso-global');
    
    if (btnAvisoGlobal) btnAvisoGlobal.style.display = isDT ? 'block' : 'none';
    
    if (state.activeRole === 'professor') { 
        btnPauta.style.display = 'none'; 
        btnFaltasGlobal.style.display = 'none'; 
        lmsGrid.style.display = 'grid'; 
    } else if (state.activeRole === 'diretor_turma') { 
        btnPauta.style.display = 'block'; 
        btnFaltasGlobal.style.display = 'block'; 
        lmsGrid.style.display = 'grid'; 
    } else { 
        btnPauta.style.display = 'block'; 
        btnFaltasGlobal.style.display = 'block'; 
        lmsGrid.style.display = 'none'; 
    }

    try {
        const qAlunos = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turmaId), where("papel", "==", "aluno")));
        state.alunosTurmaRAM = []; 
        qAlunos.forEach(d => state.alunosTurmaRAM.push({ id: d.id, ...d.data() })); 
        state.alunosTurmaRAM.sort((a,b) => a.nome.localeCompare(b.nome));

        let asstText = ""; 
        let alunosEmRisco = 0; 
        let totalPrhfs = 0; 
        let htmlAlunos = '';

        for (let i=0; i<state.alunosTurmaRAM.length; i++) {
            const al = state.alunosTurmaRAM[i]; 
            let nFaltas = 0; 
            let nPrhfs = 0;
            const matVerificar = isDT ? ordemDisciplinasGlobal : state.disciplinasProfessor;
            
            try { 
                const fS = await getDocs(collection(db, "utilizadores", al.id, "faltas")); 
                fS.forEach(f => { 
                    if(!f.data().justificada && matVerificar.includes(f.data().disciplina)) nFaltas++; 
                }); 
            } catch(err){}
            
            try { 
                const pS = await getDocs(collection(db, "utilizadores", al.id, "prhfs")); 
                pS.forEach(p => { 
                    if(p.data().status !== 'concluida' && matVerificar.includes(p.data().disciplina)) nPrhfs++; 
                }); 
            } catch(err){}
            
            totalPrhfs += nPrhfs; 
            let corBola = 'status-green';
            if (nFaltas > 5 || nPrhfs > 2) { 
                corBola = 'status-red'; 
                alunosEmRisco++; 
            } else if (nFaltas > 2 || nPrhfs > 0) { 
                corBola = 'status-yellow'; 
            }

            htmlAlunos += `
            <div class="aluno-list-item" data-id="${al.id}">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                    <div>
                        <strong style="color:white; font-size:0.95rem;">${nomeCurto(al.nome)}</strong>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${nPrhfs > 0 ? `<span style="color:#00d2ff;">${nPrhfs} PRHFs em curso</span>` : 'Tudo em dia'}</div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <span class="status-dot ${corBola}"></span>
                </div>
            </div>`;
        }
        
        asstText = `A turma tem <strong>${state.alunosTurmaRAM.length} alunos</strong>. `;
        if (alunosEmRisco > 0) asstText += `<span style="color:var(--danger-red);">Atenção: ${alunosEmRisco} alunos em risco${isDT?' global':' na tua disciplina'}.</span> `;
        if (totalPrhfs > 0) asstText += `Há ${totalPrhfs} PRHFs a decorrer${isDT?'':' na tua matéria'}. `;
        if (alunosEmRisco === 0 && totalPrhfs === 0) asstText += `Turma super alinhada. Bom trabalho!`;

        document.getElementById('assistente-aula-texto').innerHTML = asstText; 
        listC.innerHTML = htmlAlunos;
    } catch (e) { 
        listC.innerHTML = '<p class="text-danger center">Problema de Ligação.</p>'; 
    }
}

export async function renderizarPautaTurma() {
    const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
    const cont = document.getElementById('tabela-pauta-conteudo'); 
    cont.innerHTML = '<tr><td colspan="5" class="center text-muted">A ler notas...</td></tr>';
    document.getElementById('modal-pauta-turma').style.display = 'flex';
    
    const discSelect = document.getElementById('pauta-disc-select');
    if(isDT) { 
        discSelect.style.display = 'block'; 
        const discValidas = filtrarDisciplinasDoAno(state.selectedTurma, ordemDisciplinasGlobal);
        if(discSelect.options.length <= 1) discSelect.innerHTML = discValidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); 
    } else { 
        discSelect.style.display = 'none'; 
        const discValidas = filtrarDisciplinasDoAno(state.selectedTurma, state.disciplinasProfessor);
        discSelect.innerHTML = discValidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); 
    }

    const curDisc = discSelect.value || (isDT ? ordemDisciplinasGlobal[0] : state.disciplinasProfessor[0]);

    try {
        let html = `<tr><th>Aluno</th><th>Mod. 1</th><th>Mod. 2</th><th>Mod. 3</th><th>Média</th></tr>`;
        for(const al of state.alunosTurmaRAM) {
            const nS = await getDocs(collection(db, "utilizadores", al.id, "notas"));
            let m1='-', m2='-', m3='-'; 
            let sum = 0; let count = 0;
            
            nS.forEach(n => {
                if(n.data().disciplina === curDisc) {
                    if(n.data().modulo == 1) m1 = n.data().nota;
                    else if(n.data().modulo == 2) m2 = n.data().nota;
                    else if(n.data().modulo == 3) m3 = n.data().nota;
                    
                    if(!isNaN(n.data().nota)) { sum += Number(n.data().nota); count++; }
                }
            });
            const media = count > 0 ? (sum / count).toFixed(1) : '-';
            const medColor = (media !== '-' && media < 10) ? 'color:var(--danger-red);' : 'color:var(--success-green);';
            html += `<tr><td>${nomeCurto(al.nome)}</td><td>${m1}</td><td>${m2}</td><td>${m3}</td><td style="font-weight:bold; ${medColor}">${media}</td></tr>`;
        }
        cont.innerHTML = html;
    } catch(e) { 
        cont.innerHTML = '<tr><td colspan="5" class="center text-danger">Erro de ligação.</td></tr>'; 
    }
}

export async function renderizarFaltasTurma() {
    const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
    const cont = document.getElementById('tabela-faltas-conteudo'); 
    cont.innerHTML = '<tr><td colspan="5" class="center text-muted">A ler faltas...</td></tr>';
    document.getElementById('modal-faltas-turma').style.display = 'flex';
    
    const discSelect = document.getElementById('faltas-disc-select');
    if(isDT) { 
        discSelect.style.display = 'block'; 
        const discValidas = filtrarDisciplinasDoAno(state.selectedTurma, ordemDisciplinasGlobal);
        if(discSelect.options.length <= 1) discSelect.innerHTML = discValidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); 
    } else { 
        discSelect.style.display = 'none'; 
        const discValidas = filtrarDisciplinasDoAno(state.selectedTurma, state.disciplinasProfessor);
        discSelect.innerHTML = discValidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); 
    }

    const curDisc = discSelect.value || (isDT ? ordemDisciplinasGlobal[0] : state.disciplinasProfessor[0]);

    try {
        let html = '<tr><th>Aluno</th><th>Mod. 1</th><th>Mod. 2</th><th>Mod. 3</th><th>Total</th></tr>';
        for(const al of state.alunosTurmaRAM) {
            const fS = await getDocs(collection(db, "utilizadores", al.id, "faltas"));
            let m1=0, m2=0, m3=0, tot=0;
            fS.forEach(f => {
                if(f.data().disciplina === curDisc) {
                    let h = Number(f.data().horas || 0); 
                    tot += h;
                    let mod = f.data().modulo;
                    if(mod == 1) m1 += h; 
                    else if(mod == 2) m2 += h; 
                    else if(mod == 3) m3 += h;
                }
            });
            html += `<tr><td>${nomeCurto(al.nome)}</td><td>${m1?m1+'h':'-'}</td><td>${m2?m2+'h':'-'}</td><td>${m3?m3+'h':'-'}</td><td style="font-weight:bold; color:var(--danger-red);">${tot}h</td></tr>`;
        }
        cont.innerHTML = html;
    } catch(e) { 
        cont.innerHTML = '<tr><td colspan="5" class="center text-danger">Erro de ligação.</td></tr>'; 
    }
}

export function desenharGraficoAluno(modo) {
    const ctx = document.getElementById('chartEvolucaoAluno').getContext('2d');
    if(state.chartEvolucao) state.chartEvolucao.destroy();
    
    let gradient = ctx.createLinearGradient(0, 0, 0, 150); 
    gradient.addColorStop(0, 'rgba(0, 204, 136, 0.6)'); 
    gradient.addColorStop(1, 'rgba(0, 204, 136, 0.0)');

    const selDisc = document.getElementById('perfil-disc-select')?.value || state.disciplinasProfessor[0];

    if(modo === 'disc') {
        let dadosFiltrados = state.notasAlunoRAM.filter(n => n.disciplina === selDisc && !isNaN(n.valor) && n.valor > 0); 
        dadosFiltrados.sort((a,b) => a.moduloReal - b.moduloReal);
        state.chartEvolucao = new Chart(ctx, { 
            type: 'line', 
            data: { 
                labels: dadosFiltrados.length > 0 ? dadosFiltrados.map(n => `Mod ${n.moduloReal}`) : ['Sem Aval.'], 
                datasets: [{ 
                    label: selDisc, 
                    data: dadosFiltrados.length > 0 ? dadosFiltrados.map(n => n.valor) : [0], 
                    borderColor: '#00cc88', 
                    backgroundColor: gradient, 
                    borderWidth: 3, 
                    fill: true, 
                    tension: 0.4, 
                    pointBackgroundColor: '#00cc88', 
                    pointBorderColor: '#fff', 
                    pointBorderWidth: 2, 
                    pointRadius: 5 
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { y: { min: 10, max: 20, grid: { color: '#333' } }, x: { grid: { display: false } } }, 
                plugins: { legend: { display: false } } 
            } 
        });
    } else {
        let medias = {}; 
        state.notasAlunoRAM.forEach(n => { 
            if(!isNaN(n.valor) && n.valor > 0) { 
                if(!medias[n.disciplina]) medias[n.disciplina] = { soma: 0, count: 0 }; 
                medias[n.disciplina].soma += n.valor; 
                medias[n.disciplina].count++; 
            } 
        });
        
        let labels = []; 
        let values = []; 
        let colors = []; 
        
        Object.keys(medias).forEach(d => { 
            labels.push(d); 
            const m = medias[d].soma / medias[d].count; 
            values.push(m.toFixed(1)); 
            colors.push(m >= 10 ? '#00cc88' : '#ff4d4d'); 
        });
        
        state.chartEvolucao = new Chart(ctx, { 
            type: 'bar', 
            data: { 
                labels: labels.length > 0 ? labels : ['Sem Aval.'], 
                datasets: [{ 
                    label: 'Média Global', 
                    data: values.length > 0 ? values : [0], 
                    backgroundColor: colors, 
                    borderRadius: 6 
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { y: { min: 10, max: 20, grid: { color: '#333' } }, x: { grid: { display: false } } }, 
                plugins: { legend: { display: false } } 
            } 
        });
    }
}

export async function abrirPerfil360Aluno(alunoId) {
    state.alunoSelecionadoId = alunoId; 
    const al = state.alunosTurmaRAM.find(a => a.id === alunoId); 
    if (!al) return;
    
    document.getElementById('p-aluno-nome').innerText = nomeCurto(al.nome); 
    document.getElementById('p-aluno-foto').src = al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`; 
    
    try { 
        document.getElementById('p-aluno-academia').innerText = (al.academia && ACADEMIAS_INFO[al.academia]) ? ACADEMIAS_INFO[al.academia].nome : 'Sem Academia'; 
    } catch(err) { 
        document.getElementById('p-aluno-academia').innerText = 'Sem Academia'; 
    }

    const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
    document.getElementById('perfil-aluno-title-estat').innerText = isDT ? 'Estatísticas Globais' : 'Estatísticas na Tua Disciplina';
    
    const togDiv = document.getElementById('dt-graph-toggles'); 
    if(isDT) togDiv.style.display = 'flex'; 
    else togDiv.style.display = 'none';

    const discSelect = document.getElementById('perfil-disc-select');
    const disciplinasDoAno = filtrarDisciplinasDoAno(state.selectedTurma, isDT ? ordemDisciplinasGlobal : state.disciplinasProfessor);
    discSelect.innerHTML = disciplinasDoAno.map(dc => `<option value="${dc}">${dc}</option>`).join('');
    
    discSelect.onchange = async () => {
        const d = discSelect.value;
        desenharGraficoAluno(document.getElementById('btn-graph-disc').classList.contains('active') ? 'disc' : 'global');
        
        let notasHtml = '<div style="display:flex; flex-direction:column; gap:8px;">';
        let notasParaMostrar = state.notasAlunoRAM.filter(n => isDT || n.disciplina === d);
        notasParaMostrar.sort((a,b) => a.moduloReal - b.moduloReal);
        
        notasParaMostrar.forEach(n => {
            const isRep = n.notaOriginal === 'REP';
            const cor = (isRep || n.valor < 10) ? 'var(--danger-red)' : 'var(--success-green)';
            notasHtml += `
            <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border-left:3px solid ${cor}; display:flex; justify-content:space-between; align-items:center;">
                <div><span style="font-size:0.85rem; color:var(--text-muted);">${n.disciplina}</span><br><span style="color:white; font-size:0.9rem;">Módulo ${n.moduloReal || '?'}</span></div>
                <strong style="color:${cor}; font-size:1.1rem;">${n.notaOriginal}</strong>
            </div>`;
        });
        
        notasHtml += '</div>';
        if(notasParaMostrar.length === 0) notasHtml = '<p class="text-muted" style="font-size:0.85rem; margin-bottom:10px;">Sem avaliações a '+d+'.</p>';
        document.getElementById('historico-notas-container').innerHTML = notasHtml;

        if(!isDT) {
            const momento = document.getElementById('sintese-momento').value;
            try {
                const rS = await getDoc(doc(db, "utilizadores", alunoId, "reunioes", `sintese_${d}_${momento}`)); 
                document.getElementById('p-aluno-obs-dt').value = (rS.exists() && rS.data().texto) ? rS.data().texto : '';
            } catch(e) {}
        }
    };

    document.getElementById('sintese-momento').onchange = async () => { discSelect.onchange(); };

    let fCount = 0; let pCount = 0; state.notasAlunoRAM = [];
    
    try {
        const fS = await getDocs(collection(db, "utilizadores", alunoId, "faltas")); 
        fS.forEach(f => { if(disciplinasDoAno.includes(f.data().disciplina)) fCount += Number(f.data().horas || 0); });
        
        const pS = await getDocs(collection(db, "utilizadores", alunoId, "prhfs")); 
        pS.forEach(p => { if(p.data().status !== 'concluida' && disciplinasDoAno.includes(p.data().disciplina)) pCount++; });
        
        const nS = await getDocs(collection(db, "utilizadores", alunoId, "notas")); 
        nS.forEach(n => { 
            if(disciplinasDoAno.includes(n.data().disciplina)) { 
                const mFormatado = parseInt(String(n.data().modulo).replace(/\D/g, '')) || n.data().modulo;
                state.notasAlunoRAM.push({ disciplina: n.data().disciplina, moduloReal: mFormatado, notaOriginal: n.data().nota, valor: isNaN(n.data().nota) ? 0 : Number(n.data().nota) }); 
            } 
        });

        document.getElementById('area-sintese-prof').style.display = 'block';
        if (isDT) { 
            document.getElementById('btn-justificar-faltas').style.display = fCount > 0 ? 'block' : 'none'; 
            document.getElementById('titulo-sintese-area').innerText = 'Síntese Global (DT)';
            document.getElementById('sintese-momento').style.display = 'none'; 
            
            const rS = await getDoc(doc(db, "utilizadores", alunoId, "reunioes", "1_avaliacao")); 
            if (rS.exists() && rS.data().global) { document.getElementById('p-aluno-obs-dt').value = rS.data().global; } else { document.getElementById('p-aluno-obs-dt').value = ''; } 
        } else { 
            document.getElementById('btn-justificar-faltas').style.display = 'none'; 
            document.getElementById('titulo-sintese-area').innerText = `Síntese da Disciplina`;
            document.getElementById('sintese-momento').style.display = 'block';
        }
        
        discSelect.onchange(); 

    } catch (e) {}

    document.getElementById('p-aluno-faltas').innerText = fCount; 
    document.getElementById('p-aluno-prhfs').innerText = pCount; 
    document.getElementById('p-aluno-notas').innerText = state.notasAlunoRAM.length;
    
    document.getElementById('btn-graph-disc').classList.add('active'); 
    document.getElementById('btn-graph-global').classList.remove('active');
    
    document.getElementById('modal-perfil-aluno').style.display = 'flex';
}

// ==========================================
// A NOVA FUNÇÃO PRHF: ORDENAÇÃO E EDIÇÃO
// ==========================================
// Adicionado evento no filtro de workflow
document.getElementById('filtro-workflow-prhf')?.addEventListener('change', carregarTarefasProf);

export async function carregarTarefasProf() {
    const isPRHFTab = document.getElementById('tab-tarefas-prhf').classList.contains('active');
    const canSeePassaporteTab = (state.activeRole === 'diretor_turma' || state.activeRole === 'orientador_pap' || state.activeRole === 'coordenador');
    document.getElementById('tab-tarefas-passaporte').style.display = canSeePassaporteTab ? 'inline-block' : 'none';
    if (!canSeePassaporteTab && !isPRHFTab) { document.getElementById('tab-tarefas-prhf').click(); return; }

    if (isPRHFTab) {
        const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
        if(isDT) { 
            document.getElementById('btn-radar-conflitos').style.display = 'block'; 
            document.getElementById('prhf-dt-toggles').style.display = 'flex'; 
        } else { 
            document.getElementById('btn-radar-conflitos').style.display = 'none'; 
            document.getElementById('prhf-dt-toggles').style.display = 'none'; 
        }

        const container = document.getElementById('lista-prhfs-professor'); 
        const histContainer = document.getElementById('lista-prhfs-historico');
        const workflowFiltro = document.getElementById('filtro-workflow-prhf').value;
        
        container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A procurar PRHFs...</p>';
        histContainer.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar histórico...</p>';
        
        if (!state.turmasProfessor || state.turmasProfessor.length === 0) { 
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-ban empty-state-icon"></i><p class="empty-state-desc">Sem turmas atribuídas.</p></div>'; 
            histContainer.innerHTML = '<div class="empty-state"><i class="fa-solid fa-ban empty-state-icon"></i><p class="empty-state-desc">Sem turmas atribuídas.</p></div>';
            return; 
        }
        
        try {
            let todosAlunos = []; 
            for (const t of state.turmasProfessor) { 
                const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); 
                snap.forEach(d => todosAlunos.push({ id: d.id, ...d.data() })); 
            }
            
            let todosPrhfs = []; 
            for (const al of todosAlunos) { 
                const pSnap = await getDocs(collection(db, "utilizadores", al.id, "prhfs")); 
                pSnap.forEach(p => todosPrhfs.push({ id: p.id, alunoId: al.id, alunoNome: al.nome, turma: al.turma, ...p.data() })); 
            }
            
            // ORDENAÇÃO INTELIGENTE: Urgentes primeiro, depois os mais perto do prazo.
            todosPrhfs.sort((a,b) => {
                if (a.urgente && !b.urgente) return -1;
                if (!a.urgente && b.urgente) return 1;
                return new Date(a.prazo || 0) - new Date(b.prazo || 0);
            }); 
            
            const matVerificar = (isDT && state.prhfViewMode === 'todas') ? ordemDisciplinasGlobal : state.disciplinasProfessor;
            let pendentes = todosPrhfs.filter(p => p.status !== 'concluida' && matVerificar.includes(p.disciplina));
            let concluidos = todosPrhfs.filter(p => p.status === 'concluida' && matVerificar.includes(p.disciplina));
            
            // APLICAÇÃO DO FILTRO DE WORKFLOW ("Aguardam Minha Ação")
            if (workflowFiltro === 'acao_prof') {
                pendentes = pendentes.filter(p => p.propostaAluno && !p.propostaLidaDT);
            }

            let h = ''; 
            if (pendentes.length === 0) { 
                h = `<div class="empty-state"><i class="fa-solid fa-check empty-state-icon" style="color:var(--success-green);"></i><p class="empty-state-desc">Não há PRHFs pendentes para esta vista.</p></div>`; 
            }
            
            pendentes.forEach(p => {
                const souOProfessorDoPRHF = state.disciplinasProfessor.includes(p.disciplina) || p.professor === state.myUserName;
                let acoesProposta = '';
                let progresso = 25; // 25% = Inicial / Aguarda Prof
                
                if (p.propostaProfessor) { 
                    acoesProposta = `<div style="background:rgba(0,153,255,0.1); border:1px dashed #0099ff; padding:10px; border-radius:8px; margin-top:10px;"><strong style="color:#0099ff; font-size:0.85rem;"><i class="fa-solid fa-clock"></i> Sugestão do Professor:</strong><p style="font-size:0.85rem; color:white; margin:5px 0;">${p.propostaProfessor}</p><span style="font-size:0.75rem; color:var(--text-muted);">A aguardar que o aluno aceite.</span></div>`; 
                    progresso = 40;
                } else if (p.propostaAluno && p.propostaLidaDT === false) { 
                    acoesProposta = `<div style="background:rgba(255,204,0,0.1); border:1px dashed var(--warning-yellow); padding:10px; border-radius:8px; margin-top:10px;"><strong style="color:var(--warning-yellow); font-size:0.85rem;"><i class="fa-solid fa-clock"></i> Aluno sugere:</strong><p style="font-size:0.85rem; color:white; margin:5px 0;">${p.propostaAluno}</p><div style="display:flex; gap:10px; margin-top:10px;">${souOProfessorDoPRHF ? `<button class="primary-btn small-btn btn-aceitar-proposta" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1; background:var(--success-green);"><i class="fa-solid fa-check"></i> Aceitar</button><button class="secondary-btn small-btn btn-rejeitar-proposta" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1; border-color:var(--danger-red); color:var(--danger-red);"><i class="fa-solid fa-xmark"></i> Rejeitar</button>` : `<span style="font-size:0.75rem; color:var(--warning-yellow);">A aguardar aprovação do prof. ${p.disciplina}</span>`}</div></div>`; 
                    progresso = 50;
                } else if (p.propostaAluno && p.propostaLidaDT === true) { 
                    acoesProposta = `<div style="margin-top:10px; font-size:0.8rem; color:var(--success-green);"><i class="fa-solid fa-calendar-check"></i> Sessão Presencial Agendada (${p.propostaProfessor || p.propostaAluno})</div>`; 
                    progresso = 75;
                }

                if(p.presencaValidada) progresso = 90;

                let conflitoTag = ''; 
                if(isDT && p.propostaLidaDT) { 
                    const allDataDesc = todosPrhfs.filter(px => px.id !== p.id && px.propostaLidaDT).map(px => px.propostaProfessor || px.propostaAluno); 
                    if(allDataDesc.includes(p.propostaProfessor || p.propostaAluno)) { 
                        conflitoTag = `<span style="background:var(--danger-red); color:white; font-size:0.6rem; padding:2px 6px; border-radius:4px; font-weight:bold; margin-left:8px;">⚠️ CONFLITO</span>`; 
                    } 
                }

                const isUrgente = p.urgente; 
                const corCard = isUrgente ? 'var(--danger-red)' : 'var(--warning-yellow)'; 
                const txtSt = isUrgente ? 'URGENTE' : 'EM CURSO'; 
                const hPres = Number(p.horasPresenciais || 0);
                
                // BARRA DE PROGRESSO HTML
                const barraProgressoHtml = `<div style="width:100%; background:rgba(255,255,255,0.1); height:6px; border-radius:3px; margin: 10px 0; overflow:hidden;"><div style="width:${progresso}%; background:${corCard}; height:100%; border-radius:3px; transition:width 0.5s ease;"></div></div>`;

                let btnAction = '';
                if(souOProfessorDoPRHF) { 
                    if (hPres > 0) { 
                        if (!p.propostaLidaDT) { 
                            btnAction = `<button class="secondary-btn small-btn" disabled style="width:100%; opacity:0.5;"><i class="fa-solid fa-clock"></i> Aguarda Horário</button>`; 
                        } else if (!p.presencaValidada) { 
                            btnAction = `<button class="primary-btn small-btn btn-validar-presenca" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="width:100%; background:var(--warning-yellow); color:black;"><i class="fa-solid fa-user-check"></i> Validar Presença</button>`; 
                        } else { 
                            btnAction = `<button class="btn-concluir-prhf primary-btn small-btn" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="width:100%; background:var(--success-green); color:white;"><i class="fa-solid fa-clipboard-check"></i> Fechar Plano</button>`; 
                        } 
                    } else { 
                        btnAction = `<button class="btn-concluir-prhf primary-btn small-btn" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="width:100%; background:var(--success-green); color:white;"><i class="fa-solid fa-clipboard-check"></i> Fechar Plano</button>`; 
                    } 
                }
                
                const dataPrint = p.prazo ? p.prazo.split('-').reverse().join('/') : 'S/ Prazo';
                
                // O BOTÃO DE EDIÇÃO INCLUÍDO NO HTML
                h += `
                <div class="card" style="margin-bottom:15px; border-left: 4px solid ${corCard}; position:relative;">
                    <button class="btn-edit-prhf" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="position:absolute; top:15px; right:15px; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-pen"></i></button>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="width: 85%;">
                            <strong style="color:white; font-size:1.05rem;">${nomeCurto(p.alunoNome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${p.turma})</span></strong>
                            <div style="color:${corCard}; font-weight:bold; font-size:0.9rem; margin-top:3px;">${p.disciplina} (Mod. ${p.modulo}) - ${txtSt} ${conflitoTag}</div>
                            ${barraProgressoHtml}
                        </div>
                    </div>
                    <p style="font-size:0.85rem; color:var(--text-light); margin:5px 0 10px 0;">${p.descricao}</p>
                    <div style="font-size:0.8rem; color:var(--text-muted);">Prazo: <strong style="color:white;">${dataPrint}</strong> | Presenciais: <strong>${hPres}h</strong></div>
                    ${acoesProposta} 
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        ${souOProfessorDoPRHF ? `<button class="secondary-btn small-btn btn-propor-prof" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1;"><i class="fa-regular fa-calendar"></i> Sugerir</button>` : ''} 
                        ${btnAction}
                    </div>
                </div>`;
            }); 
            container.innerHTML = h;

            const dFiltro = document.getElementById('filtro-prhf-data').value; 
            const mFiltro = document.getElementById('filtro-prhf-modulo').value; 
            let concluidosFiltrados = concluidos;
            
            if(mFiltro) concluidosFiltrados = concluidosFiltrados.filter(c => c.modulo == mFiltro);
            concluidosFiltrados.sort((a,b) => { 
                const da = a.dataCriacao ? new Date(a.dataCriacao) : 0; 
                const db = b.dataCriacao ? new Date(b.dataCriacao) : 0; 
                return dFiltro === 'desc' ? db - da : da - db; 
            });

            let histHtml = '';
            if (concluidosFiltrados.length === 0) { 
                histHtml += `<div class="empty-state"><i class="fa-solid fa-clock-rotate-left empty-state-icon"></i><p class="empty-state-desc">Nenhum plano registado no histórico com estes filtros.</p></div>`; 
            } else { 
                concluidosFiltrados.forEach(c => { 
                    const dataConcluida = c.dataCriacao ? new Date(c.dataCriacao).toLocaleDateString('pt-PT') : 'Antigo'; 
                    histHtml += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); border-left: 3px solid var(--success-green); padding:10px; border-radius:6px; margin-bottom:8px;">
                        <div>
                            <strong style="color:white; font-size:0.95rem;">${nomeCurto(c.alunoNome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${c.turma})</span></strong><br>
                            <span style="font-size:0.8rem; color:var(--success-green);">${c.disciplina} - Módulo ${c.modulo}</span>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:0.7rem; color:var(--text-muted);">Concluído</span><br>
                            <strong style="font-size:0.8rem; color:white;">${dataConcluida}</strong>
                        </div>
                    </div>`; 
                }); 
            }
            histContainer.innerHTML = histHtml;
        } catch (e) { 
            console.error("Erro PRHF:", e);
            container.innerHTML = '<p class="text-danger center">Erro ao carregar PRHFs pendentes.</p>'; 
            histContainer.innerHTML = '<p class="text-danger center">Erro ao carregar histórico.</p>';
        }
    } else {
        const container = document.getElementById('lista-passaportes-professor'); 
        container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar passaportes...</p>';
        try {
            let todosAlunos = []; 
            for (const t of state.turmasProfessor) { 
                const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); 
                snap.forEach(d => todosAlunos.push({ id: d.id, ...d.data() })); 
            }
            
            const sortMode = document.getElementById('sort-passaporte').value;
            if(sortMode === 'fct') { 
                todosAlunos.sort((a,b) => (b.fct?.horasRealizadas || 0) - (a.fct?.horasRealizadas || 0)); 
            }

            let h = '';
            todosAlunos.forEach(al => {
                const turmaAno = parseInt(al.turma.match(/\d+/)?.[0]) || 10;
                let showFCT = turmaAno >= 11; let showPAP = turmaAno === 12;
                if(!showFCT && !showPAP) return;

                let fctHtml = ''; 
                if (showFCT) { 
                    if (al.fct && al.fct.horasRealizadas > 0) { 
                        if (al.fct.validadoDT) { 
                            fctHtml = `<span style="color:var(--success-green); font-size:0.8rem;"><i class="fa-solid fa-check-double"></i> ${al.fct.horasRealizadas}h Validadas</span>`; 
                        } else { 
                            let btnValidar = state.activeRole === 'coordenador' || state.activeRole === 'diretor_turma' ? `<button class="primary-btn small-btn btn-validar-fct" data-id="${al.id}" style="width:auto; padding:4px 10px;">Validar</button>` : `<span style="font-size:0.75rem; color:var(--text-muted);">A aguardar validação.</span>`; 
                            fctHtml = `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--warning-yellow); font-size:0.8rem;">${al.fct.horasRealizadas}h declaradas</span> ${btnValidar}</div>`; 
                        } 
                    } else { 
                        fctHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Sem registos FCT.</span>`; 
                    } 
                }

                let papHtml = ''; 
                if (showPAP) { 
                    if (al.papFicheiroEnviado && al.papFicheiroBase64) { 
                        if (state.activeRole === 'orientador_pap' || state.activeRole === 'diretor_turma' || state.activeRole === 'coordenador') { 
                            papHtml = `
                            <span style="color:white; font-size:0.85rem; display:block; margin-bottom:5px;">Tema: ${al.pap?.tema || 'Desconhecido'}</span>
                            <a href="${al.papFicheiroBase64}" download="PAP_${al.nome.replace(/\s+/g, '_')}" class="secondary-btn small-btn" style="color:#0099ff; border-color:#0099ff; display:inline-block; text-align:center; margin-bottom:5px;"><i class="fa-solid fa-download"></i> Baixar Relatório Final</a>`; 
                            
                            if (state.activeRole === 'orientador_pap') { 
                                if (!al.pap.relatorioAprovado) { 
                                    papHtml += `<button class="primary-btn small-btn btn-aprovar-relatorio" data-id="${al.id}" style="width:100%; background:var(--success-green); margin-top:5px;"><i class="fa-solid fa-check"></i> Aprovar Relatório</button>`; 
                                } else { 
                                    papHtml += `<span style="color:var(--success-green); font-size:0.8rem; display:block; margin-top:5px;"><i class="fa-solid fa-check-double"></i> Apto para Apresentação Final</span>`; 
                                } 
                            } 
                        } else { 
                            papHtml = `<span style="color:var(--success-green); font-size:0.8rem;"><i class="fa-solid fa-check"></i> Relatório submetido</span>`; 
                        } 
                    } else if (al.pap && al.pap.tema) { 
                        let statusTag = al.pap.temaAprovado ? `<span style="color:var(--warning-yellow);">Em Desenvolvimento</span>` : `<span style="color:#00d2ff;">A Aguardar Aprovação</span>`; 
                        papHtml = `<span style="color:var(--text-light); font-size:0.8rem;">Tema: <strong style="color:white;">${al.pap.tema}</strong><br>${statusTag}</span>`; 
                        if (state.activeRole === 'orientador_pap' && !al.pap.temaAprovado) { 
                            papHtml += `<div style="display:flex; gap:10px; margin-top:10px;"><button class="primary-btn small-btn btn-aprovar-tema" data-id="${al.id}" style="flex:1; background:var(--success-green);"><i class="fa-solid fa-check"></i> Aceitar</button><button class="secondary-btn small-btn btn-rejeitar-tema" data-id="${al.id}" style="flex:1; border-color:var(--danger-red); color:var(--danger-red);"><i class="fa-solid fa-xmark"></i> Rejeitar</button></div>`; 
                        } 
                    } else { 
                        papHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Por iniciar.</span>`; 
                    } 
                }

                let bodyHtml = '';
                if(showFCT) bodyHtml += `<div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px dashed #333;"><strong style="font-size:0.85rem; color:white;"><i class="fa-solid fa-briefcase" style="color:var(--primary-green);"></i> FCT (Estágio)</strong><div style="margin-top:5px;">${fctHtml}</div></div>`;
                if(showPAP) bodyHtml += `<div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px dashed #333;"><strong style="font-size:0.85rem; color:white;"><i class="fa-solid fa-laptop-code" style="color:#0099ff;"></i> Projeto de Aptidão Profissional (PAP)</strong><div style="margin-top:5px;">${papHtml}</div></div>`;
                h += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #ff9900;"><strong style="color:white; font-size:1.05rem;">${nomeCurto(al.nome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span></strong>${bodyHtml}</div>`;
            }); 
            container.innerHTML = h === '' ? '<div class="empty-state"><i class="fa-solid fa-briefcase empty-state-icon"></i><p class="empty-state-desc">Nenhum aluno submeteu dados de Passaporte.</p></div>' : h;
        } catch (e) { container.innerHTML = '<p class="text-danger center">Erro ao carregar passaportes.</p>'; }
    }
}
