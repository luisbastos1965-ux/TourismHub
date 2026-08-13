import { db } from "../firebase.js";
import { doc, getDoc, collection, getDocs, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state, ACADEMIAS_INFO, ordemDisciplinasGlobal, nomeCurto, getDisciplinasPermitidas } from "./store.js";

// ==========================================
// ANIMAÇÕES E UI BASE
// ==========================================
export function iniciarCarrossel() {
    const track = document.getElementById('stats-carousel-container'); if(!track) return;
    if(state.carouselInterval) clearInterval(state.carouselInterval);
    const startScroll = () => {
        state.carouselInterval = setInterval(() => {
            if(track.scrollWidth > track.clientWidth) { track.scrollLeft += 1; if(track.scrollLeft >= (track.scrollWidth - track.clientWidth) - 1) track.scrollLeft = 0; }
        }, 30);
    };
    track.addEventListener('mouseenter', () => clearInterval(state.carouselInterval)); track.addEventListener('mouseleave', startScroll);
    track.addEventListener('touchstart', () => clearInterval(state.carouselInterval)); track.addEventListener('touchend', startScroll);
    startScroll();
}

// ==========================================
// DASHBOARD GLOBAL DO PROFESSOR
// ==========================================
export async function carregarRadarProfessor() {
    const cardAssistente = document.getElementById('assistente-global-texto')?.closest('.card');
    const divCarrossel = document.getElementById('stats-carousel-container')?.parentNode;
    const cardModulos = document.getElementById('dashboard-modulos-container')?.closest('.card');
    const cardHorario = document.getElementById('dashboard-horario-container')?.closest('.card');
    const cardEventos = document.getElementById('radar-agenda-container')?.closest('.card');
    
    const papContainerId = 'dyn-pap-dashboard';
    let papCont = document.getElementById(papContainerId);
    if (!papCont) {
        papCont = document.createElement('div');
        papCont.id = papContainerId;
        document.getElementById('view-prof-dashboard').prepend(papCont);
    }

    // -----------------------------------------------------
    // VISÕES ESPECIAIS (Orientador e Coordenador)
    // -----------------------------------------------------
    if (state.activeRole === 'orientador_pap') {
        if(cardAssistente) cardAssistente.style.display = 'none';
        if(divCarrossel) divCarrossel.style.display = 'none';
        if(cardModulos) cardModulos.style.display = 'none';
        if(cardHorario) cardHorario.style.display = 'none';
        if(cardEventos) cardEventos.style.display = 'none';
        
        papCont.style.display = 'block';
        papCont.innerHTML = `
            <div class="card" style="background: linear-gradient(135deg, rgba(16, 185, 129, 0.15), rgba(0, 0, 0, 0.3)); border: 1px solid var(--success-green); margin-bottom: 20px;">
                <h3 style="font-size: 1.1rem; margin-bottom: 10px; color: var(--success-green);"><i class="fa-solid fa-robot"></i> Assistente de Orientação</h3>
                <div id="pap-assistente-texto" style="font-size: 0.95rem; color: white; line-height: 1.5;"><i class="fa-solid fa-spinner fa-spin"></i> A analisar projetos...</div>
            </div>
            <div class="card" style="border-left: 4px solid var(--success-green); margin-bottom: 20px;">
                <h3 style="font-size: 1rem; margin-bottom: 10px; color: white;"><i class="fa-solid fa-chart-pie" style="color:var(--success-green);"></i> O Teu Raio-X</h3>
                <div id="pap-dashboard-content"><p class="text-muted center" style="font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> A calcular progresso...</p></div>
            </div>
        `;
        
        try {
            let meusOrientandos = [];
            for (const t of state.turmasProfessor) {
                const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                snap.forEach(d => {
                    const data = d.data();
                    if (data.pap && (data.pap.orientador === state.myUserName || data.pap.orientador === state.myUserId)) {
                        meusOrientandos.push(data);
                    }
                });
            }
            
            let htmlPap = '';
            if (meusOrientandos.length === 0) {
                document.getElementById('pap-assistente-texto').innerHTML = "Ainda não tens alunos atribuídos para orientação neste momento.";
                document.getElementById('pap-dashboard-content').innerHTML = '<p class="text-muted center" style="font-size:0.85rem; margin:0;">Sem dados.</p>';
            } else {
                let temasAprovados = 0; let relatoriosAprovados = 0;
                meusOrientandos.forEach(al => {
                    if (al.pap && al.pap.temaAprovado) temasAprovados++;
                    if (al.pap && al.pap.relatorioAprovado) relatoriosAprovados++;
                });
                
                document.getElementById('pap-assistente-texto').innerHTML = `Estás a orientar <strong>${meusOrientandos.length} alunos</strong>. ${temasAprovados === meusOrientandos.length ? 'Todos os teus alunos já têm o tema aprovado! 🎉' : `Atenção: Tens ${meusOrientandos.length - temasAprovados} aluno(s) a aguardar aprovação de tema.`}`;
                htmlPap = `
                <div style="display:flex; justify-content:space-between; gap:10px; text-align:center;">
                    <div style="flex:1; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border:1px solid #333;"><strong style="color:white; font-size:1.2rem;">${meusOrientandos.length}</strong><br><span style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Alunos</span></div>
                    <div style="flex:1; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border:1px solid #333;"><strong style="color:var(--warning-yellow); font-size:1.2rem;">${temasAprovados}</strong><br><span style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Temas Ok</span></div>
                    <div style="flex:1; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border:1px solid #333;"><strong style="color:var(--success-green); font-size:1.2rem;">${relatoriosAprovados}</strong><br><span style="font-size:0.7rem; color:var(--text-muted); text-transform:uppercase;">Finais Ok</span></div>
                </div>
                <button onclick="document.querySelector('.nav-role-pap[data-target=\\'view-prof-orientandos\\']').click()" class="secondary-btn" style="width:100%; margin-top:15px; border-color:var(--success-green); color:var(--success-green);"><i class="fa-solid fa-list-check"></i> Gerir Projetos</button>
                `;
                document.getElementById('pap-dashboard-content').innerHTML = htmlPap;
            }
        } catch(e) {
            document.getElementById('pap-assistente-texto').innerHTML = "Erro ao ler a base de dados.";
            document.getElementById('pap-dashboard-content').innerHTML = '<p class="text-danger center">Erro a ler PAPs.</p>';
        }
        return; 
    }

    if (state.activeRole === 'coordenador') {
        if(cardAssistente) cardAssistente.style.display = 'none';
        if(divCarrossel) divCarrossel.style.display = 'none';
        if(cardModulos) cardModulos.style.display = 'none';
        if(cardHorario) cardHorario.style.display = 'none';
        if(cardEventos) cardEventos.style.display = 'none';

        papCont.style.display = 'block';
        papCont.innerHTML = `
            <div class="card" style="background: linear-gradient(135deg, rgba(147, 51, 234, 0.15), rgba(0, 0, 0, 0.3)); border: 1px solid #9333ea; margin-bottom: 20px;">
                <h3 style="font-size: 1.1rem; margin-bottom: 10px; color: #9333ea;"><i class="fa-solid fa-eye"></i> Visão Global do Curso</h3>
                <div id="coord-assistente-texto" style="font-size: 0.95rem; color: white; line-height: 1.5;"><i class="fa-solid fa-spinner fa-spin"></i> A mapear turmas...</div>
            </div>
            <h3 style="font-size: 1rem; color: var(--danger-red); margin-bottom: 10px; margin-top: 25px;"><i class="fa-solid fa-triangle-exclamation"></i> Top Alunos em Risco</h3>
            <div id="coord-risco-content"><p class="text-muted center" style="font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> A calcular métricas...</p></div>
        `;
        
        try {
            let totalAlunosCurso = 0; let alunosEmRiscoFull = [];
            for (const t of state.turmasProfessor) {
                const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                for(const docAl of snap.docs) {
                    totalAlunosCurso++;
                    let countPRHF = 0; let countFaltas = 0;
                    const pSnap = await getDocs(collection(db, "utilizadores", docAl.id, "prhfs"));
                    pSnap.forEach(p => { if (p.data().status !== 'concluida') countPRHF++; });
                    const fSnap = await getDocs(collection(db, "utilizadores", docAl.id, "faltas"));
                    fSnap.forEach(f => { if (!f.data().justificada) countFaltas += Number(f.data().horas || 0); });
                    
                    if (countPRHF >= 2 || countFaltas >= 10) {
                        alunosEmRiscoFull.push({ id: docAl.id, nome: docAl.data().nome, turma: t, faltas: countFaltas, prhfs: countPRHF });
                    }
                }
            }

            document.getElementById('coord-assistente-texto').innerHTML = `O teu curso tem atualmente <strong>${totalAlunosCurso} alunos</strong> distribuídos por ${state.turmasProfessor.length} turmas.`;

            alunosEmRiscoFull.sort((a,b) => (b.prhfs * 10 + b.faltas) - (a.prhfs * 10 + a.faltas));
            
            let htmlRisco = '';
            if(alunosEmRiscoFull.length === 0) {
                htmlRisco = '<div class="card" style="border: 1px dashed var(--success-green);"><p class="text-success center" style="margin:0;">Nenhum aluno em situação crítica.</p></div>';
            } else {
                alunosEmRiscoFull.slice(0,5).forEach(ar => {
                    htmlRisco += `
                    <div class="card aluno-list-item" data-id="${ar.id}" style="border-left: 4px solid var(--danger-red); margin-bottom:10px; cursor:pointer; padding:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <div><strong style="color:white;">${nomeCurto(ar.nome)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${ar.turma})</span></div>
                            <div style="text-align:right;"><span style="font-size:0.75rem; color:var(--warning-yellow);">${ar.prhfs} PRHFs</span> | <span style="font-size:0.75rem; color:var(--danger-red);">${ar.faltas}h Faltas</span></div>
                        </div>
                    </div>`;
                });
            }
            document.getElementById('coord-risco-content').innerHTML = htmlRisco;
        } catch(e) { document.getElementById('coord-risco-content').innerHTML = '<p class="text-danger center">Erro a calcular risco.</p>'; }
        return; 
    }

    // -----------------------------------------------------
    // VISÃO: PROFESSOR BASE / DT (DADOS 100% REAIS)
    // -----------------------------------------------------
    papCont.style.display = 'none';
    if(cardAssistente) cardAssistente.style.display = 'block';
    if(divCarrossel) divCarrossel.style.display = 'block';
    if(cardModulos) cardModulos.style.display = 'block';
    if(cardHorario) cardHorario.style.display = 'block';
    if(cardEventos) cardEventos.style.display = 'block';

    const aText = document.getElementById('assistente-global-texto'); 
    const hCont = document.getElementById('dashboard-horario-container'); 
    const eCont = document.getElementById('radar-agenda-container');
    aText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A analisar a base de dados...';
    
    if (state.turmasProfessor.length === 0) { aText.innerHTML = 'Não tens turmas atribuídas.'; return; }

    try {
        let totalAlunos = 0; let prhfsAtivos = 0; let eventosGlobais = []; let totalFaltasProf = 0; let totalOcorrencias = 0; let profAulasHoje = [];
        const bK = ['1', '2', '3', '4', '1300', '5', '6', '7']; const bT = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' };
        const hjD = new Date(); const hjStr = `${hjD.getFullYear()}-${String(hjD.getMonth()+1).padStart(2,'0')}-${String(hjD.getDate()).padStart(2,'0')}`;

        // 1. DADOS DAS TURMAS E ALUNOS (Faltas, Ocorrências, PRHFs)
        for (const t of state.turmasProfessor) {
            try { 
                const tSnap = await getDoc(doc(db, "turmas", t)); 
                if(tSnap.exists() && tSnap.data().horario) { 
                    const hT = tSnap.data().horario; 
                    for (const b of bK) { 
                        const disc = hT[`${hjStr}_${b}`]; 
                        if (disc && state.disciplinasProfessor.includes(disc)) profAulasHoje.push({ bloco: b, turma: t, disciplina: disc, hora: bT[b] }); 
                    } 
                } 
            } catch(e) {}
            
            try {
                const snapAl = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); 
                snapAl.forEach(d => totalAlunos++);
                
                for (const docAluno of snapAl.docs) {
                    const pSnap = await getDocs(collection(db, "utilizadores", docAluno.id, "prhfs")); 
                    pSnap.forEach(p => { if (p.data().status !== 'concluida' && state.disciplinasProfessor.includes(p.data().disciplina)) prhfsAtivos++; });
                    
                    const fSnap = await getDocs(collection(db, "utilizadores", docAluno.id, "faltas")); 
                    fSnap.forEach(f => { if (state.disciplinasProfessor.includes(f.data().disciplina)) totalFaltasProf += Number(f.data().horas || 0); });
                    
                    const oSnap = await getDocs(collection(db, "utilizadores", docAluno.id, "ocorrencias")); 
                    oSnap.forEach(o => { if(o.data().autor === state.myUserName) totalOcorrencias++; });
                }
            } catch(e) {}
            
            try { 
                const snapEv = await getDocs(collection(db, "turmas", t, "eventos")); 
                snapEv.forEach(d => eventosGlobais.push({ turma: t, ...d.data() })); 
            } catch(e) {}
        }

        // 2. CÁLCULO DE AVALIAÇÕES EM FALTA (Testes Passados sem Notas Lançadas)
        let avaliacoesEmFalta = 0;
        const hjStrFull = hjD.toISOString().split('T')[0]; 
        const avaliacoesPassadas = eventosGlobais.filter(e => e.tipo === 'avaliacao' && e.data < hjStrFull && e.professor === state.myUserName);
        avaliacoesEmFalta = avaliacoesPassadas.length; // Usa o nº de testes que o Prof já fez e ainda não avaliou

        let resumo = `A gerir ${totalAlunos} alunos em ${state.turmasProfessor.length} turmas. `;
        if (prhfsAtivos > 0) resumo += `<br><span style="color:var(--warning-yellow); font-weight:bold;">Atenção: Existem ${prhfsAtivos} PRHFs a decorrer na tua matéria.</span>`; 
        else resumo += `<br><span style="color:var(--success-green);">Excelente! Tudo em dia com as recuperações.</span>`;
        if (avaliacoesEmFalta > 0) resumo += `<br><span style="color:var(--danger-red); font-size:0.85rem;"><i class="fa-solid fa-star"></i> Tens avaliações por lançar no sistema.</span>`;
        aText.innerHTML = resumo;

        // CARROSSEL ESTATÍSTICO
        const carouselTrack = document.getElementById('stats-carousel-container');
        const statsHtmlBlock = `
            <div class="stat-card"><h2 style="color: var(--primary-green); margin-bottom: 5px;">${state.turmasProfessor.length}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Turmas</span></div>
            <div class="stat-card"><h2 style="color: #0099ff; margin-bottom: 5px;">${totalAlunos}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Alunos</span></div>
            <div class="stat-card"><h2 style="color: var(--danger-red); margin-bottom: 5px;">${totalFaltasProf}h</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Faltas Dadas</span></div>
            <div class="stat-card"><h2 style="color: var(--warning-yellow); margin-bottom: 5px;">${prhfsAtivos}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">PRHFs Ativos</span></div>
            <div class="stat-card"><h2 style="color: #b82bf2; margin-bottom: 5px;">${totalOcorrencias}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Ocorrências</span></div>
            <div class="stat-card"><h2 style="color: #ffaa00; margin-bottom: 5px;">${avaliacoesEmFalta}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">A Lançar</span></div>`;
        carouselTrack.innerHTML = statsHtmlBlock + statsHtmlBlock; iniciarCarrossel();

        // 3. PROGRESSO DOS MÓDULOS (Conta os módulos que já têm notas lançadas)
        let modHtml = '<div style="display:flex; flex-direction:column; gap:8px;">';
        for (const t of state.turmasProfessor) {
            for (const d of state.disciplinasProfessor) {
                let modsAvaliados = new Set();
                try {
                    const snapAl = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                    for(const docAl of snapAl.docs) {
                        const nS = await getDocs(collection(db, "utilizadores", docAl.id, "notas"));
                        nS.forEach(n => { if(n.data().disciplina === d) modsAvaliados.add(n.data().modulo); });
                    }
                } catch(e) {}

                const totalMods = modsAvaliados.size;
                modHtml += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border:1px solid #333;">
                    <div><strong style="color:white; font-size:0.9rem;">${t} - ${d}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">Estado Atual da Turma</span></div>
                    <div style="text-align:right;"><strong style="color:var(--primary-green); font-size:1.1rem;">${totalMods}</strong><br><span style="color:var(--text-muted); font-size:0.7rem; text-transform:uppercase;">Módulos Concluídos</span></div>
                </div>`;
            }
        }
        modHtml += '</div>'; 
        document.getElementById('dashboard-modulos-container').innerHTML = modHtml;

        // HORÁRIO HOJE
        if(profAulasHoje.length > 0) {
            try { 
                profAulasHoje.sort((a,b) => { if(!a.hora || !b.hora) return 0; const getMin = (hx) => parseInt(hx.split(':')[0])*60 + parseInt(hx.split(':')[1]); return getMin(a.hora) - getMin(b.hora); }); 
                let hHtml = ''; profAulasHoje.forEach(aula => { hHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:5px; border-left:3px solid #0099ff;"><div><strong style="color:white; font-size:0.9rem;">${aula.disciplina}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">Turma ${aula.turma}</span></div><span style="color:#0099ff; font-weight:bold; font-size:0.85rem;">${aula.hora}</span></div>`; }); 
                hCont.innerHTML = hHtml; 
            } catch(sortErr) { hCont.innerHTML = '<p class="text-muted center" style="font-size:0.85rem;">Sem aulas marcadas.</p>'; }
        } else { hCont.innerHTML = '<p class="text-muted center" style="font-size:0.85rem;">Não tens aulas no sistema hoje.</p>'; }

        // PRÓXIMOS EVENTOS AGENDA
        const fut = eventosGlobais.filter(e => e.data && e.data >= hjStrFull).sort((a,b) => a.data.localeCompare(b.data)).slice(0, 3);
        if (fut.length > 0) { 
            let ah = ''; fut.forEach(e => { const datePrint = e.data ? e.data.split('-').reverse().join('/') : 'Brevemente'; const timePrint = e.periodo === 'hora' ? ` às ${e.hora}` : (e.periodo === 'manha' ? ' (Manhã)' : (e.periodo === 'tarde' ? ' (Tarde)' : '')); ah += `<div style="display:flex; justify-content:space-between; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:5px; border-left:3px solid var(--warning-yellow);"><div><strong style="color:white; font-size:0.9rem;">${e.titulo}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">Turma ${e.turma}</span></div><span style="color:var(--warning-yellow); font-size:0.8rem;">${datePrint}${timePrint}</span></div>`; }); 
            eCont.innerHTML = ah; 
        } else { eCont.innerHTML = '<p class="text-muted center" style="font-size:0.85rem;">Agenda livre.</p>'; }
        
    } catch (e) { aText.innerHTML = "Problema na ligação. Por favor, tenta novamente."; }
}

// ==========================================
// GESTÃO DA TURMA (Lista, Pauta, Faltas)
// ==========================================
export async function analisarEAtualizarTurma(turmaId) {
    const listC = document.getElementById('lista-alunos-turma'); listC.innerHTML = '<p class="text-muted center">A ler dados dos alunos...</p>';
    document.getElementById('assistente-aula-texto').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A analisar a turma...';
    
    const isDT = (state.activeRole === 'diretor_turma' && turmaId === state.minhaTurmaDT);
    if(isDT) { document.getElementById('badge-dt-turma').style.display = 'inline-block'; } else { document.getElementById('badge-dt-turma').style.display = 'none'; }
    
    const btnPauta = document.getElementById('btn-ver-pauta');
    const btnFaltasGlobal = document.getElementById('btn-ver-faltas-turma');
    const lmsGrid = document.querySelector('.lms-action-grid');
    
    if (state.activeRole === 'professor') {
        btnPauta.style.display = 'none';
        btnFaltasGlobal.style.display = 'none';
        lmsGrid.style.display = 'flex';
    } else if (state.activeRole === 'diretor_turma') {
        btnPauta.style.display = 'block';
        btnFaltasGlobal.style.display = 'block';
        lmsGrid.style.display = 'flex';
    } else {
        btnPauta.style.display = 'block';
        btnFaltasGlobal.style.display = 'block';
        lmsGrid.style.display = 'none';
    }

    try {
        const qAlunos = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turmaId), where("papel", "==", "aluno")));
        state.alunosTurmaRAM = []; qAlunos.forEach(d => state.alunosTurmaRAM.push({ id: d.id, ...d.data() })); state.alunosTurmaRAM.sort((a,b) => a.nome.localeCompare(b.nome));

        let asstText = ""; let alunosEmRisco = 0; let totalPrhfs = 0; let htmlAlunos = '';

        for (let i=0; i<state.alunosTurmaRAM.length; i++) {
            const al = state.alunosTurmaRAM[i]; let nFaltas = 0; let nPrhfs = 0;
            const matVerificar = isDT ? ordemDisciplinasGlobal : state.disciplinasProfessor;
            
            const fS = await getDocs(collection(db, "utilizadores", al.id, "faltas")); fS.forEach(f => { if(!f.data().justificada && matVerificar.includes(f.data().disciplina)) nFaltas++; });
            const pS = await getDocs(collection(db, "utilizadores", al.id, "prhfs")); pS.forEach(p => { if(p.data().status !== 'concluida' && matVerificar.includes(p.data().disciplina)) nPrhfs++; });
            
            totalPrhfs += nPrhfs; let corBola = 'status-green';
            if (nFaltas > 5 || nPrhfs > 2) { corBola = 'status-red'; alunosEmRisco++; } else if (nFaltas > 2 || nPrhfs > 0) { corBola = 'status-yellow'; }

            htmlAlunos += `<div class="aluno-list-item" data-id="${al.id}" style="cursor:pointer; transition:0.2s;"><div style="display:flex; align-items:center; gap:10px;"><img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;"><div><strong style="color:white; font-size:0.95rem;">${nomeCurto(al.nome)}</strong><div style="font-size:0.75rem; color:var(--text-muted);">${nPrhfs > 0 ? `<span style="color:#00d2ff;">${nPrhfs} PRHFs em curso</span>` : 'Tudo em dia'}</div></div></div><div style="display:flex; align-items:center; gap:15px;"><span class="status-dot ${corBola}"></span></div></div>`;
        }
        
        asstText = `A turma tem <strong>${state.alunosTurmaRAM.length} alunos</strong>. `;
        if (alunosEmRisco > 0) asstText += `<span style="color:var(--danger-red);">Atenção: ${alunosEmRisco} alunos em risco${isDT?' global':' na tua disciplina'}.</span> `;
        if (totalPrhfs > 0) asstText += `Há ${totalPrhfs} PRHFs a decorrer${isDT?'':' na tua matéria'}. `;
        if (alunosEmRisco === 0 && totalPrhfs === 0) asstText += `Turma super alinhada. Bom trabalho!`;

        document.getElementById('assistente-aula-texto').innerHTML = asstText; listC.innerHTML = htmlAlunos;
    } catch (e) { listC.innerHTML = '<p class="text-danger center">Problema de Ligação.</p>'; }
}

export async function renderizarPautaTurma() {
    const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
    const cont = document.getElementById('tabela-pauta-conteudo'); cont.innerHTML = '<tr><td colspan="5" class="center text-muted">A ler notas...</td></tr>';
    document.getElementById('modal-pauta-turma').style.display = 'flex';
    
    const discSelect = document.getElementById('pauta-disc-select');
    if(isDT) { 
        discSelect.style.display = 'block'; 
        if(discSelect.options.length <= 1) discSelect.innerHTML = ordemDisciplinasGlobal.map(dc => `<option value="${dc}">${dc}</option>`).join('');
    } else { discSelect.style.display = 'none'; discSelect.innerHTML = state.disciplinasProfessor.map(dc => `<option value="${dc}">${dc}</option>`).join(''); }

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
    } catch(e) { cont.innerHTML = '<tr><td colspan="5" class="center text-danger">Erro de ligação.</td></tr>'; }
}

export async function renderizarFaltasTurma() {
    const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
    const cont = document.getElementById('tabela-faltas-conteudo'); cont.innerHTML = '<tr><td colspan="5" class="center text-muted">A ler faltas...</td></tr>';
    document.getElementById('modal-faltas-turma').style.display = 'flex';
    
    const discSelect = document.getElementById('faltas-disc-select');
    if(isDT) { 
        discSelect.style.display = 'block'; 
        if(discSelect.options.length <= 1) discSelect.innerHTML = ordemDisciplinasGlobal.map(dc => `<option value="${dc}">${dc}</option>`).join('');
    } else { discSelect.style.display = 'none'; discSelect.innerHTML = state.disciplinasProfessor.map(dc => `<option value="${dc}">${dc}</option>`).join(''); }

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
    } catch(e) { cont.innerHTML = '<tr><td colspan="5" class="center text-danger">Erro de ligação.</td></tr>'; }
}

// ==========================================
// PERFIL 360º DO ALUNO & GAMIFICAÇÃO
// ==========================================
export function desenharGraficoAluno(modo) {
    const ctx = document.getElementById('chartEvolucaoAluno').getContext('2d');
    if(state.chartEvolucao) state.chartEvolucao.destroy();
    let gradient = ctx.createLinearGradient(0, 0, 0, 150); gradient.addColorStop(0, 'rgba(0, 204, 136, 0.6)'); gradient.addColorStop(1, 'rgba(0, 204, 136, 0.0)');

    if(modo === 'disc') {
        const minhaDisc = state.disciplinasProfessor[0] || 'Geral'; let dadosFiltrados = state.notasAlunoRAM.filter(n => n.disciplina === minhaDisc); dadosFiltrados.sort((a,b) => a.moduloReal - b.moduloReal);
        state.chartEvolucao = new Chart(ctx, { type: 'line', data: { labels: dadosFiltrados.length > 0 ? dadosFiltrados.map(n => `Mod ${n.moduloReal}`) : ['Sem Avaliação'], datasets: [{ label: minhaDisc, data: dadosFiltrados.length > 0 ? dadosFiltrados.map(n => n.valor) : [0], borderColor: '#00cc88', backgroundColor: gradient, borderWidth: 3, fill: true, tension: 0.4, pointBackgroundColor: '#00cc88', pointBorderColor: '#fff', pointBorderWidth: 2, pointRadius: 5 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 20, grid: { color: '#333' } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } } });
    } else {
        let medias = {}; state.notasAlunoRAM.forEach(n => { if(!medias[n.disciplina]) medias[n.disciplina] = { soma: 0, count: 0 }; medias[n.disciplina].soma += n.valor; medias[n.disciplina].count++; });
        let labels = []; let values = []; let colors = []; Object.keys(medias).forEach(d => { labels.push(d); const m = medias[d].soma / medias[d].count; values.push(m.toFixed(1)); colors.push(m >= 10 ? '#00cc88' : '#ff4d4d'); });
        state.chartEvolucao = new Chart(ctx, { type: 'bar', data: { labels: labels.length > 0 ? labels : ['Sem Avaliação'], datasets: [{ label: 'Média Global', data: values.length > 0 ? values : [0], backgroundColor: colors, borderRadius: 6 }] }, options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 20, grid: { color: '#333' } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } } });
    }
}

export async function abrirPerfil360Aluno(alunoId) {
    state.alunoSelecionadoId = alunoId; const al = state.alunosTurmaRAM.find(a => a.id === alunoId); if (!al) return;
    document.getElementById('p-aluno-nome').innerText = nomeCurto(al.nome); document.getElementById('p-aluno-foto').src = al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`; document.getElementById('p-aluno-academia').innerText = al.academia ? ACADEMIAS_INFO[al.academia].nome : 'Sem Academia';

    const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
    document.getElementById('perfil-aluno-title-estat').innerText = isDT ? 'Estatísticas Globais' : 'Estatísticas na Tua Disciplina';
    const togDiv = document.getElementById('dt-graph-toggles'); if(isDT) togDiv.style.display = 'flex'; else togDiv.style.display = 'none';

    let fCount = 0; let pCount = 0; state.notasAlunoRAM = [];
    try {
        const matVerificar = isDT ? ordemDisciplinasGlobal : state.disciplinasProfessor;
        const fS = await getDocs(collection(db, "utilizadores", alunoId, "faltas")); fS.forEach(f => { if(matVerificar.includes(f.data().disciplina)) fCount += Number(f.data().horas || 0); });
        const pS = await getDocs(collection(db, "utilizadores", alunoId, "prhfs")); pS.forEach(p => { if(p.data().status !== 'concluida' && matVerificar.includes(p.data().disciplina)) pCount++; });
        const nS = await getDocs(collection(db, "utilizadores", alunoId, "notas")); nS.forEach(n => { if(matVerificar.includes(n.data().disciplina)) { state.notasAlunoRAM.push({ disciplina: n.data().disciplina, moduloReal: Number(n.data().modulo), valor: isNaN(n.data().nota) ? 0 : Number(n.data().nota) }); } });

        if (isDT) { 
            document.getElementById('area-obs-dt').style.display = 'block'; 
            document.getElementById('btn-justificar-faltas').style.display = fCount > 0 ? 'block' : 'none'; 
            const rS = await getDoc(doc(db, "utilizadores", alunoId, "reunioes", "1_avaliacao")); 
            if (rS.exists() && rS.data().global) { document.getElementById('p-aluno-obs-dt').value = rS.data().global; } else { document.getElementById('p-aluno-obs-dt').value = ''; } 
        } else { 
            document.getElementById('area-obs-dt').style.display = 'none'; 
            document.getElementById('btn-justificar-faltas').style.display = 'none'; 
        }

        // --- BLINDAGEM DO COORDENADOR ---
        const blocoPosNeg = document.getElementById('btn-dar-positiva')?.closest('div');
        if (state.activeRole === 'coordenador') {
            document.getElementById('area-obs-dt').style.display = 'none';
            document.getElementById('btn-justificar-faltas').style.display = 'none';
            if(blocoPosNeg) blocoPosNeg.style.display = 'none';
        } else {
            if(blocoPosNeg) blocoPosNeg.style.display = 'flex';
        }

    } catch (e) {}

    document.getElementById('p-aluno-faltas').innerText = fCount; document.getElementById('p-aluno-prhfs').innerText = pCount; document.getElementById('p-aluno-notas').innerText = state.notasAlunoRAM.length;
    document.getElementById('btn-graph-disc').classList.add('active'); document.getElementById('btn-graph-global').classList.remove('active');
    desenharGraficoAluno('disc');
    document.getElementById('modal-perfil-aluno').style.display = 'flex';
}

// ==========================================
// TAREFAS E FÓRUNS (Sem alterações estruturais profundas)
// ==========================================
export async function carregarTarefasProf() {
    const isPRHFTab = document.getElementById('tab-tarefas-prhf').classList.contains('active');
    
    const canSeePassaporteTab = (state.activeRole === 'diretor_turma' || state.activeRole === 'orientador_pap' || state.activeRole === 'coordenador');
    document.getElementById('tab-tarefas-passaporte').style.display = canSeePassaporteTab ? 'inline-block' : 'none';
    if (!canSeePassaporteTab && !isPRHFTab) {
        document.getElementById('tab-tarefas-prhf').click(); return;
    }

    if (isPRHFTab) {
        const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
        if(isDT) { document.getElementById('btn-radar-conflitos').style.display = 'block'; document.getElementById('prhf-dt-toggles').style.display = 'flex'; } else { document.getElementById('btn-radar-conflitos').style.display = 'none'; document.getElementById('prhf-dt-toggles').style.display = 'none'; }

        const container = document.getElementById('lista-prhfs-professor'); container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A procurar PRHFs...</p>';
        if (state.turmasProfessor.length === 0) { container.innerHTML = '<p class="text-muted center">Sem turmas.</p>'; return; }
        try {
            let todosAlunos = []; for (const t of state.turmasProfessor) { const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); snap.forEach(d => todosAlunos.push({ id: d.id, ...d.data() })); }
            let todosPrhfs = []; for (const al of todosAlunos) { const pSnap = await getDocs(collection(db, "utilizadores", al.id, "prhfs")); pSnap.forEach(p => todosPrhfs.push({ id: p.id, alunoId: al.id, alunoNome: al.nome, turma: al.turma, ...p.data() })); }
            
            todosPrhfs.sort((a,b) => new Date(a.prazo || 0) - new Date(b.prazo || 0)); 
            
            const matVerificar = (isDT && state.prhfViewMode === 'todas') ? ordemDisciplinasGlobal : state.disciplinasProfessor;
            let pendentes = todosPrhfs.filter(p => p.status !== 'concluida' && matVerificar.includes(p.disciplina));
            let concluidos = todosPrhfs.filter(p => p.status === 'concluida' && matVerificar.includes(p.disciplina));
            
            let h = ''; 
            if (pendentes.length === 0) { h = `<div style="padding:15px; border:1px dashed var(--success-green); border-radius:8px; text-align:center;"><p style="color:var(--success-green); font-size:0.9rem; margin:0;">Não há Planos ativos nestas disciplinas.</p></div>`; }
            
            pendentes.forEach(p => {
                const souOProfessorDoPRHF = state.disciplinasProfessor.includes(p.disciplina) || p.professor === state.myUserName;
                let acoesProposta = '';
                if (p.propostaProfessor) { acoesProposta = `<div style="background:rgba(0,153,255,0.1); border:1px dashed #0099ff; padding:10px; border-radius:8px; margin-top:10px;"><strong style="color:#0099ff; font-size:0.85rem;"><i class="fa-solid fa-clock"></i> Sugestão do Professor:</strong><p style="font-size:0.85rem; color:white; margin:5px 0;">${p.propostaProfessor}</p><span style="font-size:0.75rem; color:var(--text-muted);">A aguardar que o aluno aceite.</span></div>`; } else if (p.propostaAluno && p.propostaLidaDT === false) { acoesProposta = `<div style="background:rgba(255,204,0,0.1); border:1px dashed var(--warning-yellow); padding:10px; border-radius:8px; margin-top:10px;"><strong style="color:var(--warning-yellow); font-size:0.85rem;"><i class="fa-solid fa-clock"></i> Aluno sugere:</strong><p style="font-size:0.85rem; color:white; margin:5px 0;">${p.propostaAluno}</p><div style="display:flex; gap:10px; margin-top:10px;">${souOProfessorDoPRHF ? `<button class="primary-btn small-btn btn-aceitar-proposta" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1; background:var(--success-green);"><i class="fa-solid fa-check"></i> Aceitar</button><button class="secondary-btn small-btn btn-rejeitar-proposta" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1; border-color:var(--danger-red); color:var(--danger-red);"><i class="fa-solid fa-xmark"></i> Rejeitar</button>` : `<span style="font-size:0.75rem; color:var(--warning-yellow);">A aguardar aprovação do prof. ${p.disciplina}</span>`}</div></div>`; } else if (p.propostaAluno && p.propostaLidaDT === true) { acoesProposta = `<div style="margin-top:10px; font-size:0.8rem; color:var(--success-green);"><i class="fa-solid fa-calendar-check"></i> Sessão Presencial Agendada (${p.propostaProfessor || p.propostaAluno})</div>`; }

                let conflitoTag = '';
                if(isDT && p.propostaLidaDT) {
                    const allDataDesc = todosPrhfs.filter(px => px.id !== p.id && px.propostaLidaDT).map(px => px.propostaProfessor || px.propostaAluno);
                    if(allDataDesc.includes(p.propostaProfessor || p.propostaAluno)) { conflitoTag = `<span style="background:var(--danger-red); color:white; font-size:0.6rem; padding:2px 6px; border-radius:4px; font-weight:bold; margin-left:8px;">⚠️ CONFLITO</span>`; }
                }

                const isUrgente = p.urgente; const corCard = isUrgente ? 'var(--danger-red)' : 'var(--warning-yellow)'; const txtSt = isUrgente ? 'TERMINADO' : 'EM CURSO'; const hPres = Number(p.horasPresenciais || 0);
                
                let btnAction = '';
                if(souOProfessorDoPRHF) {
                    if (hPres > 0) { if (!p.propostaLidaDT) { btnAction = `<button class="secondary-btn small-btn" disabled style="width:100%; opacity:0.5;"><i class="fa-solid fa-clock"></i> Aguarda Horário</button>`; } else if (!p.presencaValidada) { btnAction = `<button class="primary-btn small-btn btn-validar-presenca" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="width:100%; background:var(--warning-yellow); color:black;"><i class="fa-solid fa-user-check"></i> Validar Presença</button>`; } else { btnAction = `<button class="btn-concluir-prhf primary-btn small-btn" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="width:100%; background:var(--success-green); color:white;"><i class="fa-solid fa-clipboard-check"></i> Fechar Plano</button>`; } } else { btnAction = `<button class="btn-concluir-prhf primary-btn small-btn" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="width:100%; background:var(--success-green); color:white;"><i class="fa-solid fa-clipboard-check"></i> Fechar Plano</button>`; }
                }
                const dataPrint = p.prazo ? p.prazo.split('-').reverse().join('/') : 'S/ Prazo';
                h += `<div class="card" style="margin-bottom:15px; border-left: 4px solid ${corCard};"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><strong style="color:white; font-size:1.05rem;">${nomeCurto(p.alunoNome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${p.turma})</span></strong><div style="color:${corCard}; font-weight:bold; font-size:0.9rem; margin-top:3px;">${p.disciplina} (Mod. ${p.modulo}) - ${txtSt} ${conflitoTag}</div></div></div><p style="font-size:0.85rem; color:var(--text-light); margin:10px 0;">${p.descricao}</p><div style="font-size:0.8rem; color:var(--text-muted);">Prazo: <strong style="color:white;">${dataPrint}</strong> | Presenciais: <strong>${hPres}h</strong></div>${acoesProposta} <div style="display:flex; gap:10px; margin-top:10px;">${souOProfessorDoPRHF ? `<button class="secondary-btn small-btn btn-propor-prof" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1;"><i class="fa-regular fa-calendar"></i> Sugerir</button>` : ''} ${btnAction}</div></div>`;
            }); 
            container.innerHTML = h;

            const dFiltro = document.getElementById('filtro-prhf-data').value; const mFiltro = document.getElementById('filtro-prhf-modulo').value;
            let concluidosFiltrados = concluidos;
            if(mFiltro) concluidosFiltrados = concluidosFiltrados.filter(c => c.modulo == mFiltro);
            concluidosFiltrados.sort((a,b) => { const da = a.dataCriacao ? new Date(a.dataCriacao) : 0; const db = b.dataCriacao ? new Date(b.dataCriacao) : 0; return dFiltro === 'desc' ? db - da : da - db; });

            let histHtml = '';
            if (concluidosFiltrados.length === 0) { histHtml += `<p class="text-muted center" style="font-size:0.85rem; margin-top:15px;">Sem histórico com estes filtros.</p>`; } 
            else {
                concluidosFiltrados.forEach(c => {
                    const dataConcluida = c.dataCriacao ? new Date(c.dataCriacao).toLocaleDateString('pt-PT') : 'Antigo';
                    histHtml += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); border-left: 3px solid var(--success-green); padding:10px; border-radius:6px; margin-bottom:8px;"><div><strong style="color:white; font-size:0.95rem;">${nomeCurto(c.alunoNome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${c.turma})</span></strong><br><span style="font-size:0.8rem; color:var(--success-green);">${c.disciplina} - Módulo ${c.modulo}</span></div><div style="text-align:right;"><span style="font-size:0.7rem; color:var(--text-muted);">Concluído</span><br><strong style="font-size:0.8rem; color:white;">${dataConcluida}</strong></div></div>`;
                });
            }
            document.getElementById('lista-prhfs-historico').innerHTML = histHtml;
        } catch (e) { container.innerHTML = '<p class="text-danger center">Erro a carregar PRHFs.</p>'; }
    } else {
        const container = document.getElementById('lista-passaportes-professor'); 
        container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar passaportes...</p>';
        try {
            let todosAlunos = []; 
            for (const t of state.turmasProfessor) { const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); snap.forEach(d => todosAlunos.push({ id: d.id, ...d.data() })); }
            const sortMode = document.getElementById('sort-passaporte').value;
            if(sortMode === 'fct') { todosAlunos.sort((a,b) => (b.fct?.horasRealizadas || 0) - (a.fct?.horasRealizadas || 0)); }

            let h = '';
            todosAlunos.forEach(al => {
                const turmaAno = parseInt(al.turma.match(/\d+/)?.[0]) || 10;
                let showFCT = turmaAno >= 11; let showPAP = turmaAno === 12;
                if(!showFCT && !showPAP) return;

                let fctHtml = ''; 
                if (showFCT) {
                    if (al.fct && al.fct.horasRealizadas > 0) { 
                        if (al.fct.validadoDT) { fctHtml = `<span style="color:var(--success-green); font-size:0.8rem;"><i class="fa-solid fa-check-double"></i> ${al.fct.horasRealizadas}h Validadas</span>`; } else { let btnValidar = state.activeRole === 'coordenador' || state.activeRole === 'diretor_turma' ? `<button class="primary-btn small-btn btn-validar-fct" data-id="${al.id}" style="width:auto; padding:4px 10px;">Validar</button>` : `<span style="font-size:0.75rem; color:var(--text-muted);">A aguardar validação.</span>`; fctHtml = `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--warning-yellow); font-size:0.8rem;">${al.fct.horasRealizadas}h declaradas</span> ${btnValidar}</div>`; } 
                    } else { fctHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Sem registos FCT.</span>`; }
                }

                let papHtml = ''; 
                if (showPAP) {
                    if (al.papFicheiroEnviado && al.papFicheiroBase64) { 
                        if (state.activeRole === 'orientador_pap' || state.activeRole === 'diretor_turma' || state.activeRole === 'coordenador') { 
                            papHtml = `<span style="color:white; font-size:0.85rem; display:block; margin-bottom:5px;">Tema: ${al.pap?.tema || 'Desconhecido'}</span><a href="${al.papFicheiroBase64}" download="PAP_${al.nome.replace(/\s+/g, '_')}" class="secondary-btn small-btn" style="color:#0099ff; border-color:#0099ff; display:inline-block; text-align:center; margin-bottom:5px;"><i class="fa-solid fa-download"></i> Baixar Relatório Final</a>`; 
                            if (state.activeRole === 'orientador_pap') {
                                if (!al.pap.relatorioAprovado) { papHtml += `<button class="primary-btn small-btn btn-aprovar-relatorio" data-id="${al.id}" style="width:100%; background:var(--success-green); margin-top:5px;"><i class="fa-solid fa-check"></i> Aprovar Relatório</button>`; } else { papHtml += `<span style="color:var(--success-green); font-size:0.8rem; display:block; margin-top:5px;"><i class="fa-solid fa-check-double"></i> Apto para Apresentação Final</span>`; }
                            }
                        } else { papHtml = `<span style="color:var(--success-green); font-size:0.8rem;"><i class="fa-solid fa-check"></i> Relatório submetido</span>`; } 
                    } 
                    else if (al.pap && al.pap.tema) { 
                        let statusTag = al.pap.temaAprovado ? `<span style="color:var(--warning-yellow);">Em Desenvolvimento</span>` : `<span style="color:#00d2ff;">A Aguardar Aprovação</span>`;
                        papHtml = `<span style="color:var(--text-light); font-size:0.8rem;">Tema: <strong style="color:white;">${al.pap.tema}</strong><br>${statusTag}</span>`; 
                        if (state.activeRole === 'orientador_pap' && !al.pap.temaAprovado) { papHtml += `<div style="display:flex; gap:10px; margin-top:10px;"><button class="primary-btn small-btn btn-aprovar-tema" data-id="${al.id}" style="flex:1; background:var(--success-green);"><i class="fa-solid fa-check"></i> Aceitar</button><button class="secondary-btn small-btn btn-rejeitar-tema" data-id="${al.id}" style="flex:1; border-color:var(--danger-red); color:var(--danger-red);"><i class="fa-solid fa-xmark"></i> Rejeitar</button></div>`; }
                    } else { papHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Por iniciar.</span>`; }
                }

                let bodyHtml = '';
                if(showFCT) bodyHtml += `<div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px dashed #333;"><strong style="font-size:0.85rem; color:white;"><i class="fa-solid fa-briefcase" style="color:var(--primary-green);"></i> FCT (Estágio)</strong><div style="margin-top:5px;">${fctHtml}</div></div>`;
                if(showPAP) bodyHtml += `<div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px dashed #333;"><strong style="font-size:0.85rem; color:white;"><i class="fa-solid fa-laptop-code" style="color:#0099ff;"></i> Projeto de Aptidão Profissional (PAP)</strong><div style="margin-top:5px;">${papHtml}</div></div>`;
                h += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #ff9900;"><strong style="color:white; font-size:1.05rem;">${nomeCurto(al.nome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span></strong>${bodyHtml}</div>`;
            }); 
            container.innerHTML = h === '' ? '<p class="text-muted center">Nenhum aluno submeteu dados.</p>' : h;
        } catch (e) { container.innerHTML = '<p class="text-danger center">Erro ao carregar passaportes.</p>'; }
    }
}

export async function carregarForunsProf() {
    const cont = document.getElementById('prof-forum-channel-list'); 
    cont.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A ler canais...</p>';
    if(state.turmasProfessor.length === 0) { cont.innerHTML = '<p class="text-muted center">Não tens turmas.</p>'; return; }

    if (state.activeRole === 'orientador_pap') {
        let html = '<h3 style="font-size:1rem; color:var(--text-muted); margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">Rede de Orientação</h3>';
        html += `<div class="canal-card" data-turma="Global" data-disc="Orientadores" data-nome="Equipa de Orientadores"><div class="canal-icon" style="color:var(--success-green); border-color:var(--success-green);"><i class="fa-solid fa-users-viewfinder"></i></div><div class="canal-info" style="flex:1;"><h4>Equipa de Orientadores</h4><p>Chat fechado de coordenação</p></div><i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i></div>`;
        
        html += '<h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Os Meus Orientandos</h3>';
        
        let temAlunos = false;
        try {
            let meusOrientandos = [];
            for (const t of state.turmasProfessor) {
                const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                snap.forEach(d => {
                    const data = d.data();
                    if (data.pap && (data.pap.orientador === state.myUserName || data.pap.orientador === state.myUserId)) {
                        meusOrientandos.push({ id: d.id, ...data });
                    }
                });
            }
            
            if (meusOrientandos.length > 0) {
                temAlunos = true;
                html += `<div class="canal-card" data-turma="Global" data-disc="Avisos_Orientandos_${state.myUserId}" data-nome="Avisos (Todos os Orientandos)"><div class="canal-icon" style="color:#0099ff; border-color:#0099ff;"><i class="fa-solid fa-bullhorn"></i></div><div class="canal-info" style="flex:1;"><h4>Avisos Gerais</h4><p>Mensagem para os teus alunos</p></div><i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i></div>`;
                
                meusOrientandos.forEach(al => {
                    html += `<div class="canal-card" data-turma="${al.turma}" data-disc="PAP_${al.id}" data-nome="PAP - ${nomeCurto(al.nome)}"><div class="canal-icon" style="color:var(--warning-yellow); border-color:var(--warning-yellow); padding:0; overflow:hidden;"><img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:100%;height:100%;object-fit:cover;"></div><div class="canal-info" style="flex:1;"><h4>${nomeCurto(al.nome)}</h4><p>Apoio Individual</p></div><i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i></div>`;
                });
            }
        } catch(e) {}
        
        if (!temAlunos) html += '<p class="text-muted center" style="font-size:0.85rem;">Não tens orientandos atribuídos neste momento.</p>';
        cont.innerHTML = `<div class="forum-canais-grid">${html}</div>`;
        return; 
    }

    let html = '';
    html += '<h3 style="font-size:1rem; color:var(--text-muted); margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">A Minha Disciplina</h3>';
    state.turmasProfessor.forEach(t => { state.disciplinasProfessor.forEach(d => { html += `<div class="canal-card" data-turma="${t}" data-disc="${d}" data-nome="Apoio a ${d}"><div class="canal-icon" style="color:#00d2ff; border-color:#00d2ff;"><i class="fa-solid fa-book-open"></i></div><div class="canal-info" style="flex:1;"><h4>Apoio a ${d}</h4><p>Turma ${t}</p></div><i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i></div>`; }); });

    html += '<h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Estrutura da Turma</h3>';
    state.turmasProfessor.forEach(t => {
        html += `<div class="canal-card" data-turma="${t}" data-disc="Professores" data-nome="Conselho de Turma"><div class="canal-icon" style="color:#b82bf2; border-color:#b82bf2;"><i class="fa-solid fa-chalkboard-user"></i></div><div class="canal-info" style="flex:1;"><h4>Conselho de Turma</h4><p>Professores do ${t}</p></div><i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i></div>`;
        html += `<div class="canal-card" data-turma="${t}" data-disc="DT_Privado" data-nome="Diretor de Turma"><div class="canal-icon" style="color:#ffaa00; border-color:#ffaa00;"><i class="fa-solid fa-user-tie"></i></div><div class="canal-info" style="flex:1;"><h4>Diretor de Turma</h4><p>Assuntos Privados - ${t}</p></div><i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i></div>`;
    });
    
    html += `<div class="canal-card" data-turma="Global" data-disc="Coordenador" data-nome="Coordenador de Curso"><div class="canal-icon" style="color:#ff4d4d; border-color:#ff4d4d;"><i class="fa-solid fa-sitemap"></i></div><div class="canal-info" style="flex:1;"><h4>Coordenador de Curso</h4><p>Chat Global do Curso</p></div><i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i></div>`;

    html += '<h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Chats Personalizados</h3>';
    let encontrouPersonalizado = false; let htmlPersonalizado = '<div style="display:flex; flex-direction:column; gap:10px;">';
    try {
        for (const t of state.turmasProfessor) {
            const s = await getDocs(collection(db, "turmas", t, "foruns")); let arr = []; s.forEach(d => arr.push({id: d.id, ...d.data()}));
            arr.forEach(f => { 
                if(f.membros && f.membros.includes(state.myUserId) && !f.isDefault) { 
                    encontrouPersonalizado = true;
                    const iconConfig = f.criadoPor === state.myUserName ? `<i class="fa-solid fa-gear btn-edit-chat" data-id="${f.id}" data-turma="${t}" style="color:var(--warning-yellow); font-size:1.2rem; cursor:pointer; padding:5px;"></i>` : `<i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i>`;
                    htmlPersonalizado += `<div class="canal-card" data-turma="${t}" data-disc="${f.id}" data-nome="${f.nome}" style="position:relative;"><div class="canal-icon" style="color:#00cc88; border-color:#00cc88;"><i class="fa-solid fa-comments"></i></div><div class="canal-info" style="flex:1;"><h4>${f.nome}</h4><p>Turma ${t}</p></div>${iconConfig}</div>`; 
                } 
            });
        }
        if (!encontrouPersonalizado) { htmlPersonalizado += '<p class="text-muted center" style="font-size:0.85rem;">Nenhum chat extra criado.</p>'; }
        htmlPersonalizado += '</div>';
        cont.innerHTML = `<div class="forum-canais-grid">${html}${htmlPersonalizado}</div>`;
    } catch (e) { cont.innerHTML = '<p class="text-danger center">Erro a carregar chats.</p>'; }
}

export function abrirChatForum(turma, disciplina, nomeCustom) {
    state.activeChatTurma = turma; state.activeChatDisc = disciplina;
    document.getElementById('prof-forum-channel-list').style.display = 'none'; document.getElementById('btn-create-chat-prof').style.display = 'none'; 
    document.getElementById('prof-forum-chat-view').style.display = 'flex'; 
    document.getElementById('prof-chat-active-title').innerText = `${nomeCustom || disciplina} (${turma})`;
    const msgCont = document.getElementById('prof-chat-messages-container'); msgCont.innerHTML = '<p class="text-muted center">A carregar mensagens...</p>';
    
    const q = query(collection(db, "turmas", turma, "foruns", disciplina, "mensagens"), orderBy("timestamp", "asc"));
    if (state.chatUnsubscribe) state.chatUnsubscribe(); 
    state.chatUnsubscribe = onSnapshot(q, (snapshot) => {
        let h = '';
        snapshot.forEach(doc => { 
            const m = doc.data(); const d = new Date(m.timestamp); const hora = isNaN(d.getTime()) ? '' : `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; 
            const isMe = m.autor === state.myUserName || m.remetente === state.myUserName;
            const nomeStr = m.autor || m.remetente || 'Desconhecido';
            if (isMe) { h += `<div class="chat-bubble admin"><strong>Eu</strong><br>${m.texto}<span class="chat-meta">${hora}</span></div>`; } 
            else { h += `<div class="chat-bubble student"><strong style="color:var(--primary-green);">${nomeStr}</strong><br>${m.texto}<span class="chat-meta">${hora}</span></div>`; }
        });
        if (h === '') h = '<p class="text-muted center" style="margin-top:20px;">Sê o primeiro a enviar uma mensagem para este canal!</p>';
        msgCont.innerHTML = h; setTimeout(() => { msgCont.scrollTop = msgCont.scrollHeight; }, 100);
    });
}
