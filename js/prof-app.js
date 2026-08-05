import { auth, db, messaging, VAPID_KEY, getToken } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, updateDoc, getDocs, query, addDoc, deleteDoc, where, setDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let myUserId = "";
let myUserName = "";
let profData = {};
let myRoles = [];

let turmasProfessor = [];
let disciplinasProfessor = []; 
let selectedTurma = "";
let alunosTurmaRAM = [];
let eventosTurmaRAM = [];

let alunoSelecionadoId = null;
let materialBase64 = null;
let prhfBase64 = null;

let chatUnsubscribe = null;
let activeChatTurma = "";
let activeChatDisc = "";
let chartEvolucao = null;
let carouselInterval = null;

const ACADEMIAS_INFO = { 'atlas': { nome: 'Atlas' }, 'sentinela': { nome: 'Sentinela' }, 'nexus': { nome: 'Nexus' }, 'aurora': { nome: 'Aurora' } };

// ==========================================
// 1. INICIALIZAÇÃO E PERFIL
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            if (docSnap.exists()) {
                profData = docSnap.data();
                myRoles = profData.papeis || [];
                disciplinasProfessor = profData.disciplinas || []; 

                if (profData.papel && !myRoles.includes(profData.papel)) myRoles.push(profData.papel);
                
                if (myRoles.some(r => ['professor', 'diretor_turma', 'orientador_pap', 'coordenador'].includes(r))) {
                    myUserName = profData.nome || myUserId;
                    turmasProfessor = profData.turmas || []; 
                    
                    let titleStr = "Professor";
                    if (myRoles.includes('diretor_turma')) titleStr += " / DT";
                    if (myRoles.includes('orientador_pap')) titleStr += " / PAP";
                    if (myRoles.includes('coordenador')) titleStr += " / Coord"; 
                    
                    document.getElementById('header-user-name-prof').innerText = myUserName;
                    document.getElementById('header-user-name-prof').nextElementSibling.innerText = titleStr;
                    
                    document.getElementById('perfil-nome-prof-view').innerText = myUserName;
                    document.getElementById('perfil-disciplinas-lista').innerText = disciplinasProfessor.length > 0 ? disciplinasProfessor.join(' • ') : 'Nenhuma disciplina configurada.';
                    document.getElementById('perfil-papeis-lista').innerText = myRoles.map(r => r.toUpperCase().replace('_', ' ')).join(' • ');
                    
                    if (profData.fotoPerfil) {
                        document.getElementById('header-avatar-circle').innerHTML = `<img src="${profData.fotoPerfil}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                        document.getElementById('prof-avatar-img').src = profData.fotoPerfil;
                    }
                    
                    if (!myRoles.includes('diretor_turma') && !myRoles.includes('orientador_pap') && !myRoles.includes('coordenador')) {
                        document.getElementById('tab-tarefas-passaporte').style.display = 'none';
                    }

                    const sel = document.getElementById('prof-seletor-turmas');
                    if (turmasProfessor.length > 0) {
                        sel.innerHTML = '<option value="">-- Selecionar Turma --</option>' + turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join('');
                    } else {
                        sel.innerHTML = '<option value="">Sem turmas atribuídas</option>';
                    }

                    carregarRadarProfessor(); 
                } else { window.location.href = "index.html"; }
            }
        } catch (e) { console.error("Erro na inicialização:", e); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-prof')?.addEventListener('click', () => signOut(auth));

function setupBase64Upload(inputId, nameId, varSetter) {
    document.getElementById(inputId)?.addEventListener('change', (e) => {
        const file = e.target.files[0]; if (!file) return;
        if (file.size > 5 * 1024 * 1024) return alert("O ficheiro é muito grande. O limite máximo é 5MB.");
        document.getElementById(nameId).innerText = file.name; document.getElementById(nameId).style.color = "var(--primary-green)";
        const reader = new FileReader(); reader.onload = (event) => { varSetter(event.target.result); }; reader.readAsDataURL(file);
    });
}
setupBase64Upload('mat-file', 'mat-file-name', (val) => materialBase64 = val);
setupBase64Upload('prhf-file', 'prhf-file-name', (val) => prhfBase64 = val); 

document.getElementById('prhf-horas-totais')?.addEventListener('input', (e) => {
    const val = Number(e.target.value);
    const pres = document.getElementById('prhf-horas-presenciais');
    if(val > 0) pres.value = val <= 4 ? 0 : Math.ceil(val * 0.3); else pres.value = '';
});

// Lógica de Scroll Infinito
function iniciarCarrossel() {
    const track = document.getElementById('stats-carousel-container');
    if(!track) return;
    
    if(carouselInterval) clearInterval(carouselInterval);
    
    const startScroll = () => {
        carouselInterval = setInterval(() => {
            if(track.scrollWidth > track.clientWidth) {
                track.scrollLeft += 1;
                // Se chegou ao fim do scroll, reseta para dar o efeito infinito
                if(track.scrollLeft >= (track.scrollWidth - track.clientWidth) - 1) track.scrollLeft = 0;
            }
        }, 30);
    };
    
    track.addEventListener('mouseenter', () => clearInterval(carouselInterval));
    track.addEventListener('mouseleave', startScroll);
    track.addEventListener('touchstart', () => clearInterval(carouselInterval));
    track.addEventListener('touchend', startScroll);
    
    startScroll();
}

// ==========================================
// 3. O ASSISTENTE GLOBAL (COM PROTEÇÕES DE ERRO E CARROSSEL)
// ==========================================
async function carregarRadarProfessor() {
    const aText = document.getElementById('assistente-global-texto');
    const hCont = document.getElementById('dashboard-horario-container');
    const eCont = document.getElementById('radar-agenda-container');
    
    aText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A calcular estatísticas...';
    if (turmasProfessor.length === 0) { aText.innerHTML = 'Não tens turmas atribuídas.'; return; }

    try {
        let totalAlunos = 0; let prhfsAtivos = 0; let eventosGlobais = [];
        let totalFaltasProf = 0; let totalOcorrencias = 0; let avaliacoesEmFalta = 0;
        
        let profAulasHoje = [];
        const bK = ['1', '2', '3', '4', '1300', '5', '6', '7'];
        const bT = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' };
        const hjD = new Date();
        const hjStr = `${hjD.getFullYear()}-${String(hjD.getMonth()+1).padStart(2,'0')}-${String(hjD.getDate()).padStart(2,'0')}`;

        for (const t of turmasProfessor) {
            try {
                const tSnap = await getDoc(doc(db, "turmas", t));
                if(tSnap.exists() && tSnap.data().horario) {
                    const hT = tSnap.data().horario;
                    for (const b of bK) {
                        const disc = hT[`${hjStr}_${b}`];
                        if (disc && disciplinasProfessor.includes(disc)) {
                            profAulasHoje.push({ bloco: b, turma: t, disciplina: disc, hora: bT[b] });
                        }
                    }
                }
            } catch(e) { console.warn("Aviso ao ler horário da turma", t); }

            try {
                const snapAl = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                snapAl.forEach(d => totalAlunos++);
                
                for (const docAluno of snapAl.docs) {
                    const pSnap = await getDocs(collection(db, "utilizadores", docAluno.id, "prhfs"));
                    pSnap.forEach(p => { if (p.data().status !== 'concluida' && disciplinasProfessor.includes(p.data().disciplina)) prhfsAtivos++; });

                    const fSnap = await getDocs(collection(db, "utilizadores", docAluno.id, "faltas"));
                    fSnap.forEach(f => { if (disciplinasProfessor.includes(f.data().disciplina)) totalFaltasProf += Number(f.data().horas || 0); });

                    const oSnap = await getDocs(collection(db, "utilizadores", docAluno.id, "ocorrencias"));
                    oSnap.forEach(o => { if(o.data().autor === myUserName) totalOcorrencias++; });
                    
                    avaliacoesEmFalta += Math.floor(Math.random() * 2); // Simulação temporária até Fase 3
                }
            } catch(e) { console.warn("Aviso ao ler alunos da turma", t); }

            try {
                const snapEv = await getDocs(collection(db, "turmas", t, "eventos"));
                snapEv.forEach(d => eventosGlobais.push({ turma: t, ...d.data() }));
            } catch(e) { console.warn("Aviso ao ler eventos da turma", t); }
        }

        let resumo = `Gerir ${totalAlunos} alunos em ${turmasProfessor.length} turmas. `;
        if (prhfsAtivos > 0) resumo += `<br><span style="color:var(--warning-yellow); font-weight:bold;">Atenção: Existem ${prhfsAtivos} PRHFs em andamento.</span>`;
        else resumo += `<br><span style="color:var(--success-green);">Excelente! Tudo em dia na tua matéria.</span>`;
        aText.innerHTML = resumo;

        // INJETAR CARROSSEL INFINITO DE ESTATÍSTICAS
        const carouselTrack = document.getElementById('stats-carousel-container');
        const statsHtmlBlock = `
            <div class="stat-card"><h2 style="color: var(--primary-green); margin-bottom: 5px;">${turmasProfessor.length}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Turmas</span></div>
            <div class="stat-card"><h2 style="color: #0099ff; margin-bottom: 5px;">${totalAlunos}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Alunos</span></div>
            <div class="stat-card"><h2 style="color: var(--danger-red); margin-bottom: 5px;">${totalFaltasProf}h</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Total Faltas</span></div>
            <div class="stat-card"><h2 style="color: var(--warning-yellow); margin-bottom: 5px;">${prhfsAtivos}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">PRHFs Ativos</span></div>
            <div class="stat-card"><h2 style="color: #b82bf2; margin-bottom: 5px;">${totalOcorrencias}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Ocorrências</span></div>
            <div class="stat-card"><h2 style="color: #ffaa00; margin-bottom: 5px;">${avaliacoesEmFalta}</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">A Lançar</span></div>
        `;
        carouselTrack.innerHTML = statsHtmlBlock + statsHtmlBlock; // Duplicado para Scroll Infinito
        iniciarCarrossel();

        // PROGRESSO DE MÓDULOS (SIMULADOR FASE 3)
        let modHtml = '<div style="display:flex; flex-direction:column; gap:8px;">';
        turmasProfessor.forEach(t => {
            disciplinasProfessor.forEach(d => {
                const hDadas = 24 + Math.floor(Math.random() * 5); const hTotais = 30; const hFaltam = hTotais - hDadas;
                modHtml += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border:1px solid #333;"><div><strong style="color:white; font-size:0.9rem;">${t} - ${d}</strong> <span style="color:var(--text-muted); font-size:0.8rem;">(Módulo 1)</span><br><span style="font-size:0.75rem; color:var(--warning-yellow);">Faltam ${hFaltam}h para terminar</span></div><div style="text-align:right;"><strong style="color:var(--primary-green);">${hDadas}h</strong> <span style="color:var(--text-muted); font-size:0.8rem;">/ ${hTotais}h</span></div></div>`;
            });
        });
        modHtml += '</div>';
        document.getElementById('dashboard-modulos-container').innerHTML = modHtml;

        // HORÁRIO
        if(profAulasHoje.length > 0) {
            profAulasHoje.sort((a,b) => {
                if(!a.hora || !b.hora) return 0;
                const getMin = (hx) => parseInt(hx.split(':')[0])*60 + parseInt(hx.split(':')[1]);
                return getMin(a.hora) - getMin(b.hora);
            });
            let hHtml = '';
            profAulasHoje.forEach(aula => {
                hHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:5px; border-left:3px solid #0099ff;"><div><strong style="color:white; font-size:0.9rem;">${aula.disciplina}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">Turma ${aula.turma}</span></div><span style="color:#0099ff; font-weight:bold; font-size:0.85rem;">${aula.hora}</span></div>`;
            });
            hCont.innerHTML = hHtml;
        } else {
            hCont.innerHTML = '<p class="text-muted center" style="font-size:0.85rem;">Não tens aulas marcadas para hoje.</p>';
        }

        // EVENTOS (Amortecedor de falhas de data)
        const hjStrFull = hjData.toISOString().split('T')[0];
        const fut = eventosGlobais.filter(e => e.data && e.data >= hjStrFull).sort((a,b) => a.data.localeCompare(b.data)).slice(0, 3);
        
        if (fut.length > 0) {
            let ah = ''; fut.forEach(e => { 
                const datePrint = e.data ? e.data.split('-').reverse().join('/') : 'Brevemente';
                const timePrint = e.periodo === 'hora' ? ` às ${e.hora}` : (e.periodo === 'manha' ? ' (Manhã)' : (e.periodo === 'tarde' ? ' (Tarde)' : ''));
                ah += `<div style="display:flex; justify-content:space-between; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:5px; border-left:3px solid var(--warning-yellow);"><div><strong style="color:white; font-size:0.9rem;">${e.titulo}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">Turma ${e.turma}</span></div><span style="color:var(--warning-yellow); font-size:0.8rem;">${datePrint}${timePrint}</span></div>`; 
            }); 
            eCont.innerHTML = ah;
        } else { eCont.innerHTML = '<p class="text-muted center" style="font-size:0.85rem;">Agenda livre.</p>'; }
        
    } catch (e) { 
        console.error("Erro no Radar:", e);
        aText.innerHTML = "Problema na ligação. Por favor, verifica a tua internet."; 
        hCont.innerHTML = '<p class="text-muted center" style="font-size:0.85rem;">Não foi possível ler o horário.</p>';
        eCont.innerHTML = '<p class="text-muted center" style="font-size:0.85rem;">Não foi possível ler o calendário.</p>';
    }
}

// ==========================================
// 4. ASSISTENTE DA TURMA E VISTAS EM BLOCO (PAUTA/FALTAS)
// ==========================================
async function analisarEAtualizarTurma(turmaId) {
    const listC = document.getElementById('lista-alunos-turma'); listC.innerHTML = '<p class="text-muted center">A ler dados dos alunos...</p>';
    document.getElementById('assistente-aula-texto').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A focar na tua disciplina...';
    try {
        const qAlunos = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turmaId), where("papel", "==", "aluno")));
        alunosTurmaRAM = []; qAlunos.forEach(d => alunosTurmaRAM.push({ id: d.id, ...d.data() })); alunosTurmaRAM.sort((a,b) => a.nome.localeCompare(b.nome));

        let asstText = ""; let alunosEmRisco = 0; let totalPrhfs = 0; let htmlAlunos = '';

        for (let i=0; i<alunosTurmaRAM.length; i++) {
            const al = alunosTurmaRAM[i]; let nFaltas = 0; let nPrhfs = 0;
            const fS = await getDocs(collection(db, "utilizadores", al.id, "faltas")); 
            fS.forEach(f => { if(!f.data().justificada && disciplinasProfessor.includes(f.data().disciplina)) nFaltas++; });
            const pS = await getDocs(collection(db, "utilizadores", al.id, "prhfs")); 
            pS.forEach(p => { if(p.data().status !== 'concluida' && disciplinasProfessor.includes(p.data().disciplina)) nPrhfs++; });
            
            totalPrhfs += nPrhfs; let corBola = 'status-green';
            if (nFaltas > 5 || nPrhfs > 2) { corBola = 'status-red'; alunosEmRisco++; } else if (nFaltas > 2 || nPrhfs > 0) { corBola = 'status-yellow'; }

            htmlAlunos += `<div class="aluno-list-item" data-id="${al.id}" style="cursor:pointer; transition:0.2s;"><div style="display:flex; align-items:center; gap:10px;"><img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;"><div><strong style="color:white; font-size:0.95rem;">${al.nome}</strong><div style="font-size:0.75rem; color:var(--text-muted);">${nPrhfs > 0 ? `<span style="color:#00d2ff;">${nPrhfs} PRHFs em ${disciplinasProfessor[0]}</span>` : 'Regular em ' + (disciplinasProfessor[0] || 'Geral')}</div></div></div><div style="display:flex; align-items:center; gap:15px;"><span class="status-dot ${corBola}"></span></div></div>`;
        }
        asstText = `A turma tem <strong>${alunosTurmaRAM.length} alunos</strong>. `;
        if (alunosEmRisco > 0) asstText += `<span style="color:var(--danger-red);">Tens ${alunosEmRisco} alunos em risco na tua disciplina.</span> `;
        if (totalPrhfs > 0) asstText += `Há ${totalPrhfs} PRHFs a decorrer na tua matéria. `;
        if (alunosEmRisco === 0 && totalPrhfs === 0) asstText += `Todos os alunos estão alinhados em ${disciplinasProfessor.join(', ') || 'Geral'}.`;

        document.getElementById('assistente-aula-texto').innerHTML = asstText; listC.innerHTML = htmlAlunos;
    } catch (e) { listC.innerHTML = '<p class="text-danger center">Problema de Ligação.</p>'; }
}

async function renderizarPautaTurma() {
    const cont = document.getElementById('tabela-pauta-conteudo'); cont.innerHTML = '<tr><td colspan="4" class="center text-muted">A ler notas da base de dados...</td></tr>';
    document.getElementById('modal-pauta-turma').style.display = 'flex';
    try {
        let html = '<tr><th>Aluno</th><th>Mod. 1</th><th>Mod. 2</th><th>Mod. 3</th></tr>';
        for(const al of alunosTurmaRAM) {
            const nS = await getDocs(collection(db, "utilizadores", al.id, "notas"));
            let m1='-', m2='-', m3='-';
            nS.forEach(n => {
                if(disciplinasProfessor.includes(n.data().disciplina)) {
                    if(n.data().modulo == 1) m1 = n.data().nota;
                    if(n.data().modulo == 2) m2 = n.data().nota;
                    if(n.data().modulo == 3) m3 = n.data().nota;
                }
            });
            html += `<tr><td>${al.nome.split(' ')[0]} ${al.nome.split(' ').pop()}</td><td>${m1}</td><td>${m2}</td><td>${m3}</td></tr>`;
        }
        cont.innerHTML = html;
    } catch(e) { cont.innerHTML = '<tr><td colspan="4" class="center text-danger">Erro de ligação.</td></tr>'; }
}

async function renderizarFaltasTurma() {
    const cont = document.getElementById('tabela-faltas-conteudo'); cont.innerHTML = '<tr><td colspan="3" class="center text-muted">A ler faltas da base de dados...</td></tr>';
    document.getElementById('modal-faltas-turma').style.display = 'flex';
    try {
        let html = '<tr><th>Aluno</th><th>Faltas Injust.</th><th>Total (Horas)</th></tr>';
        for(const al of alunosTurmaRAM) {
            const fS = await getDocs(collection(db, "utilizadores", al.id, "faltas"));
            let inj = 0; let tot = 0;
            fS.forEach(f => {
                if(disciplinasProfessor.includes(f.data().disciplina)) {
                    tot += Number(f.data().horas || 0);
                    if(!f.data().justificada) inj += Number(f.data().horas || 0);
                }
            });
            const cor = inj > 5 ? 'color:var(--danger-red); font-weight:bold;' : '';
            html += `<tr><td>${al.nome.split(' ')[0]} ${al.nome.split(' ').pop()}</td><td style="${cor}">${inj}h</td><td>${tot}h</td></tr>`;
        }
        cont.innerHTML = html;
    } catch(e) { cont.innerHTML = '<tr><td colspan="3" class="center text-danger">Erro de ligação.</td></tr>'; }
}

// ==========================================
// 5. PERFIL 360 DO ALUNO (GRÁFICO ORDENADO)
// ==========================================
async function abrirPerfil360Aluno(alunoId) {
    alunoSelecionadoId = alunoId; const al = alunosTurmaRAM.find(a => a.id === alunoId); if (!al) return;
    document.getElementById('p-aluno-nome').innerText = al.nome; document.getElementById('p-aluno-foto').src = al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`; document.getElementById('p-aluno-academia').innerText = al.academia ? ACADEMIAS_INFO[al.academia].nome : 'Sem Academia';

    let fCount = 0; let pCount = 0; let notasData = [];
    try {
        const fS = await getDocs(collection(db, "utilizadores", alunoId, "faltas")); 
        fS.forEach(f => { if(!f.data().justificada && disciplinasProfessor.includes(f.data().disciplina)) fCount++; });
        const pS = await getDocs(collection(db, "utilizadores", alunoId, "prhfs")); 
        pS.forEach(p => { if(p.data().status !== 'concluida' && disciplinasProfessor.includes(p.data().disciplina)) pCount++; });
        const nS = await getDocs(collection(db, "utilizadores", alunoId, "notas"));
        
        nS.forEach(n => { 
            if(disciplinasProfessor.includes(n.data().disciplina)) { 
                notasData.push({ moduloReal: Number(n.data().modulo), moduloStr: `Mod ${n.data().modulo}`, valor: isNaN(n.data().nota) ? 0 : Number(n.data().nota) }); 
            } 
        });
        notasData.sort((a,b) => a.moduloReal - b.moduloReal);

        if (myRoles.includes('diretor_turma')) {
            document.getElementById('area-obs-dt').style.display = 'block'; document.getElementById('btn-justificar-faltas').style.display = fCount > 0 ? 'block' : 'none';
            const rS = await getDoc(doc(db, "utilizadores", alunoId, "reunioes", "1_avaliacao"));
            if (rS.exists() && rS.data().global) { document.getElementById('p-aluno-obs-dt').value = rS.data().global; } else { document.getElementById('p-aluno-obs-dt').value = ''; }
        }
    } catch (e) {}

    document.getElementById('p-aluno-faltas').innerText = fCount; document.getElementById('p-aluno-prhfs').innerText = pCount; document.getElementById('p-aluno-notas').innerText = notasData.length;

    const ctx = document.getElementById('chartEvolucaoAluno').getContext('2d');
    if(chartEvolucao) chartEvolucao.destroy();
    chartEvolucao = new Chart(ctx, {
        type: 'line', 
        data: { labels: notasData.length > 0 ? notasData.map(n => n.moduloStr) : ['Sem Avaliação'], datasets: [{ label: 'Evolução', data: notasData.length > 0 ? notasData.map(n => n.valor) : [0], borderColor: '#00cc88', backgroundColor: 'rgba(0, 204, 136, 0.2)', borderWidth: 2, fill: true, tension: 0.3 }] },
        options: { responsive: true, maintainAspectRatio: false, scales: { y: { beginAtZero: true, max: 20, grid: { color: '#333' } }, x: { grid: { display: false } } }, plugins: { legend: { display: false } } }
    });

    document.getElementById('modal-perfil-aluno').style.display = 'flex';
}

// ==========================================
// 6. GESTÃO DE TAREFAS E HISTÓRICO DE PRHF
// ==========================================
async function carregarTarefasProf() {
    const isPRHFTab = document.getElementById('tab-tarefas-prhf').classList.contains('active');
    if (isPRHFTab) {
        const container = document.getElementById('lista-prhfs-professor'); container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A procurar PRHFs...</p>';
        if (turmasProfessor.length === 0) { container.innerHTML = '<p class="text-muted center">Sem turmas.</p>'; return; }
        try {
            let todosAlunos = []; for (const t of turmasProfessor) { const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); snap.forEach(d => todosAlunos.push({ id: d.id, ...d.data() })); }
            let todosPrhfs = []; for (const al of todosAlunos) { const pSnap = await getDocs(collection(db, "utilizadores", al.id, "prhfs")); pSnap.forEach(p => todosPrhfs.push({ id: p.id, alunoId: al.id, alunoNome: al.nome, turma: al.turma, ...p.data() })); }
            
            todosPrhfs.sort((a,b) => new Date(a.prazo || 0) - new Date(b.prazo || 0)); 
            
            let pendentes = todosPrhfs.filter(p => p.status !== 'concluida' && disciplinasProfessor.includes(p.disciplina));
            let concluidos = todosPrhfs.filter(p => p.status === 'concluida' && disciplinasProfessor.includes(p.disciplina));
            
            let h = ''; 
            if (pendentes.length === 0) { h = `<div style="padding:15px; border:1px dashed var(--success-green); border-radius:8px; text-align:center;"><p style="color:var(--success-green); font-size:0.9rem; margin:0;">Não há Planos de Recuperação ativos na tua matéria.</p></div>`; }
            
            pendentes.forEach(p => {
                let acoesProposta = '';
                if (p.propostaAluno && p.propostaLidaDT === false) { acoesProposta = `<div style="background:rgba(255,204,0,0.1); border:1px dashed var(--warning-yellow); padding:10px; border-radius:8px; margin-top:10px;"><strong style="color:var(--warning-yellow); font-size:0.85rem;"><i class="fa-solid fa-clock"></i> Proposta de Agendamento:</strong><p style="font-size:0.85rem; color:white; margin:5px 0;">${p.propostaAluno}</p><div style="display:flex; gap:10px; margin-top:10px;"><button class="primary-btn small-btn btn-aceitar-proposta" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1; background:var(--success-green);"><i class="fa-solid fa-check"></i> Aceitar</button><button class="secondary-btn small-btn btn-rejeitar-proposta" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1; border-color:var(--danger-red); color:var(--danger-red);"><i class="fa-solid fa-xmark"></i> Rejeitar</button></div></div>`; } 
                else if (p.propostaAluno && p.propostaLidaDT === true) { acoesProposta = `<div style="margin-top:10px; font-size:0.8rem; color:var(--success-green);"><i class="fa-solid fa-calendar-check"></i> Sessão Agendada</div>`; }
                const dataPrint = p.prazo ? p.prazo.split('-').reverse().join('/') : 'S/ Prazo';
                h += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #00d2ff;"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><strong style="color:white; font-size:1.05rem;">${p.alunoNome} <span style="font-size:0.75rem; color:var(--text-muted);">(${p.turma})</span></strong><div style="color:#00d2ff; font-weight:bold; font-size:0.9rem; margin-top:3px;">${p.disciplina} (Módulo ${p.modulo})</div></div><button class="btn-concluir-prhf" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="background:var(--bg-dark); border:1px solid var(--success-green); color:var(--success-green); padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-clipboard-check"></i> Fechar</button></div><p style="font-size:0.85rem; color:var(--text-light); margin:10px 0;">${p.descricao}</p><div style="font-size:0.8rem; color:var(--text-muted);">Prazo: <strong style="color:white;">${dataPrint}</strong> | Presenciais: <strong>${p.horasPresenciais}h</strong></div>${acoesProposta}</div>`;
            }); 

            // HISTÓRICO DE CONCLUÍDOS
            h += `<h3 style="margin-top: 30px; font-size: 1.1rem; color: var(--text-muted); border-bottom: 1px solid #333; padding-bottom: 10px;">Histórico Concluído</h3>`;
            if (concluidos.length === 0) {
                h += `<p class="text-muted center" style="font-size:0.85rem; margin-top:15px;">Ainda não tens histórico de planos fechados.</p>`;
            } else {
                concluidos.forEach(c => {
                    const dataConcluida = c.dataCriacao ? new Date(c.dataCriacao).toLocaleDateString('pt-PT') : 'Antigo';
                    h += `
                    <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); border-left: 3px solid var(--success-green); padding:10px; border-radius:6px; margin-bottom:8px;">
                        <div><strong style="color:white; font-size:0.95rem;">${c.alunoNome} <span style="font-size:0.75rem; color:var(--text-muted);">(${c.turma})</span></strong><br><span style="font-size:0.8rem; color:var(--success-green);">${c.disciplina} - Módulo ${c.modulo}</span></div>
                        <div style="text-align:right;"><span style="font-size:0.7rem; color:var(--text-muted);">Concluído</span><br><strong style="font-size:0.8rem; color:white;">${dataConcluida}</strong></div>
                    </div>`;
                });
            }
            container.innerHTML = h;
        } catch (e) { container.innerHTML = '<p class="text-danger center">Erro a carregar PRHFs.</p>'; }
    } else {
        const container = document.getElementById('lista-passaportes-professor'); container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar passaportes...</p>';
        try {
            let todosAlunos = []; for (const t of turmasProfessor) { const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); snap.forEach(d => todosAlunos.push({ id: d.id, ...d.data() })); }
            let h = '';
            todosAlunos.forEach(al => {
                let fctHtml = ''; if (al.fct && al.fct.horasRealizadas > 0) { if (al.fct.validadoDT) { fctHtml = `<span style="color:var(--success-green); font-size:0.8rem;"><i class="fa-solid fa-check-double"></i> ${al.fct.horasRealizadas}h Validadas</span>`; } else { let btnValidar = myRoles.includes('coordenador') ? `<button class="primary-btn small-btn btn-validar-fct" data-id="${al.id}" style="width:auto; padding:4px 10px;">Validar</button>` : `<span style="font-size:0.75rem; color:var(--text-muted);">A aguardar Coord.</span>`; fctHtml = `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--warning-yellow); font-size:0.8rem;">${al.fct.horasRealizadas}h declaradas</span> ${btnValidar}</div>`; } } else { fctHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Sem registos FCT.</span>`; }
                let papHtml = ''; if (al.papFicheiroEnviado && al.papFicheiroBase64) { if (myRoles.includes('orientador_pap') || myRoles.includes('diretor_turma')) { papHtml = `<a href="${al.papFicheiroBase64}" download="PAP_${al.nome.replace(/\s+/g, '_')}" class="secondary-btn small-btn" style="color:#0099ff; border-color:#0099ff; display:inline-block; text-align:center;"><i class="fa-solid fa-download"></i> Baixar Relatório</a>`; } else { papHtml = `<span style="color:var(--success-green); font-size:0.8rem;"><i class="fa-solid fa-check"></i> Relatório submetido</span>`; } } else if (al.pap && al.pap.tema) { papHtml = `<span style="color:var(--text-light); font-size:0.8rem;">Tema: ${al.pap.tema} (Pendente)</span>`; } else { papHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Sem registos PAP.</span>`; }
                if (fctHtml.includes('declaradas') || fctHtml.includes('Validadas') || papHtml.includes('Tema') || papHtml.includes('Baixar') || papHtml.includes('submetido')) { h += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #ff9900;"><strong style="color:white; font-size:1.05rem;">${al.nome} <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span></strong><div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px dashed #333;"><strong style="font-size:0.85rem; color:white;"><i class="fa-solid fa-briefcase" style="color:var(--primary-green);"></i> FCT (Estágio)</strong><div style="margin-top:5px;">${fctHtml}</div></div><div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px dashed #333;"><strong style="font-size:0.85rem; color:white;"><i class="fa-solid fa-laptop-code" style="color:#0099ff;"></i> Projeto de Aptidão Profissional (PAP)</strong><div style="margin-top:5px;">${papHtml}</div></div></div>`; }
            }); 
            container.innerHTML = h === '' ? '<p class="text-muted center">Nenhum aluno submeteu horas.</p>' : h;
        } catch (e) { container.innerHTML = '<p class="text-danger center">Erro ao carregar passaportes.</p>'; }
    }
}

// OS FÓRUNS PERMANENTES 
async function carregarForunsProf() {
    const cont = document.getElementById('prof-forum-channel-list'); 
    cont.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A ler canais...</p>';
    if(turmasProfessor.length === 0) { cont.innerHTML = '<p class="text-muted center">Não tens turmas.</p>'; return; }

    let html = '';
    html += '<h3 style="font-size:1rem; color:var(--text-muted); margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">A Minha Disciplina</h3>';
    turmasProfessor.forEach(t => { disciplinasProfessor.forEach(d => { html += `<div class="canal-card" data-turma="${t}" data-disc="${d}"><div class="canal-icon" style="color:#00d2ff; border-color:#00d2ff;"><i class="fa-solid fa-book-open"></i></div><div class="canal-info" style="flex:1;"><h4>Apoio a ${d}</h4><p>Turma ${t}</p></div><i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i></div>`; }); });

    html += '<h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Estrutura da Turma</h3>';
    turmasProfessor.forEach(t => {
        html += `<div class="canal-card" data-turma="${t}" data-disc="Professores"><div class="canal-icon" style="color:#b82bf2; border-color:#b82bf2;"><i class="fa-solid fa-chalkboard-user"></i></div><div class="canal-info" style="flex:1;"><h4>Conselho de Turma</h4><p>Professores do ${t}</p></div><i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i></div>`;
        html += `<div class="canal-card" data-turma="${t}" data-disc="DT_Privado"><div class="canal-icon" style="color:#ffaa00; border-color:#ffaa00;"><i class="fa-solid fa-user-tie"></i></div><div class="canal-info" style="flex:1;"><h4>Diretor de Turma</h4><p>Assuntos Privados - ${t}</p></div><i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i></div>`;
        html += `<div class="canal-card" data-turma="${t}" data-disc="Coordenador"><div class="canal-icon" style="color:#ff4d4d; border-color:#ff4d4d;"><i class="fa-solid fa-sitemap"></i></div><div class="canal-info" style="flex:1;"><h4>Coordenador de Curso</h4><p>Gestão - ${t}</p></div><i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i></div>`;
    });

    html += '<h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Chats Personalizados</h3>';
    let encontrouPersonalizado = false; let htmlPersonalizado = '<div style="display:flex; flex-direction:column; gap:10px;">';
    try {
        for (const t of turmasProfessor) {
            const s = await getDocs(collection(db, "turmas", t, "foruns")); let arr = []; s.forEach(d => arr.push({id: d.id, ...d.data()}));
            arr.forEach(f => { 
                if(f.membros && f.membros.includes(myUserId) && !f.isDefault) { 
                    encontrouPersonalizado = true;
                    htmlPersonalizado += `<div class="canal-card" data-turma="${t}" data-disc="${f.id}" style="position:relative;"><div class="canal-icon" style="color:#00cc88; border-color:#00cc88;"><i class="fa-solid fa-comments"></i></div><div class="canal-info" style="flex:1;"><h4>${f.nome}</h4><p>Turma ${t}</p></div><i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i></div>`; 
                } 
            });
        }
        if (!encontrouPersonalizado) htmlPersonalizado += '<p class="text-muted center" style="font-size:0.85rem;">Nenhum chat extra criado.</p>';
        htmlPersonalizado += '</div>';
        cont.innerHTML = `<div class="forum-canais-grid">${html}${htmlPersonalizado}</div>`;
    } catch (e) { cont.innerHTML = '<p class="text-danger center">Erro a carregar chats.</p>'; }
}

function abrirChatForum(turma, disciplina) {
    activeChatTurma = turma; activeChatDisc = disciplina;
    document.getElementById('prof-forum-channel-list').style.display = 'none'; document.getElementById('btn-create-chat-prof').style.display = 'none'; 
    document.getElementById('prof-forum-chat-view').style.display = 'flex'; 
    document.getElementById('prof-chat-active-title').innerText = `${disciplina} (${turma})`;
    const msgCont = document.getElementById('prof-chat-messages-container'); msgCont.innerHTML = '<p class="text-muted center">A carregar mensagens...</p>';
    
    const q = query(collection(db, "turmas", turma, "foruns", disciplina, "mensagens"), orderBy("timestamp", "asc"));
    if (chatUnsubscribe) chatUnsubscribe(); 
    chatUnsubscribe = onSnapshot(q, (snapshot) => {
        let h = '';
        snapshot.forEach(doc => { 
            const m = doc.data(); const d = new Date(m.timestamp); const hora = isNaN(d.getTime()) ? '' : `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; 
            const isMe = m.autor === myUserName || m.remetente === myUserName;
            const nomeStr = m.autor || m.remetente || 'Desconhecido';
            if (isMe) { h += `<div class="chat-bubble admin"><strong>Eu</strong><br>${m.texto}<span class="chat-meta">${hora}</span></div>`; } 
            else { h += `<div class="chat-bubble student"><strong style="color:var(--primary-green);">${nomeStr}</strong><br>${m.texto}<span class="chat-meta">${hora}</span></div>`; }
        });
        if (h === '') h = '<p class="text-muted center" style="margin-top:20px;">Sê o primeiro a enviar uma mensagem para este canal!</p>';
        msgCont.innerHTML = h; setTimeout(() => { msgCont.scrollTop = msgCont.scrollHeight; }, 100);
    });
}

// Ocultar campo de hora se for dia inteiro
document.getElementById('evento-periodo')?.addEventListener('change', (e) => {
    const timeInput = document.getElementById('evento-hora');
    if(e.target.value === 'hora') { timeInput.style.display = 'block'; } else { timeInput.style.display = 'none'; }
});

// ==========================================
// 7. MÁQUINA DE CLIQUES (TODOS OS BOTÕES)
// ==========================================
function esconderTodasAsVistas() { document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none'); }

document.body.addEventListener('click', async (e) => {
    
    const nav = e.target.closest('.nav-item');
    if (nav) {
        e.preventDefault(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); nav.classList.add('active');
        esconderTodasAsVistas(); const tId = nav.getAttribute('data-target'); document.getElementById(tId).style.display = (tId === 'view-prof-forum') ? 'flex' : 'block';
        if (tId === 'view-prof-dashboard') carregarRadarProfessor();
        if (tId === 'view-prof-turmas' && selectedTurma) analisarEAtualizarTurma(selectedTurma);
        if (tId === 'view-prof-tarefas') carregarTarefasProf();
        if (tId === 'view-prof-forum') { if (chatUnsubscribe) { chatUnsubscribe(); chatUnsubscribe = null; } document.getElementById('prof-forum-chat-view').style.display = 'none'; document.getElementById('btn-create-chat-prof').style.display = 'block'; document.getElementById('prof-forum-channel-list').style.display = 'block'; carregarForunsProf(); }
        return; 
    }

    if (e.target.closest('.fechar-modal')) { document.getElementById(e.target.closest('.fechar-modal').getAttribute('data-target')).style.display = 'none'; return; }
    if (e.target.closest('.aluno-list-item')) { abrirPerfil360Aluno(e.target.closest('.aluno-list-item').getAttribute('data-id')); return; }

    if (e.target.closest('#tab-tarefas-prhf')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'block'; document.getElementById('sec-tarefas-passaporte').style.display = 'none'; carregarTarefasProf(); return; }
    if (e.target.closest('#tab-tarefas-passaporte')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'none'; document.getElementById('sec-tarefas-passaporte').style.display = 'block'; carregarTarefasProf(); return; }

    // BOTÕES DE VISTA DE BLOCO
    if (e.target.closest('#btn-ver-pauta')) { renderizarPautaTurma(); return; }
    if (e.target.closest('#btn-ver-faltas-turma')) { renderizarFaltasTurma(); return; }

    if (e.target.closest('.canal-card')) { const card = e.target.closest('.canal-card'); abrirChatForum(card.getAttribute('data-turma'), card.getAttribute('data-disc')); return; }
    if (e.target.closest('#btn-prof-voltar-canais')) { if (chatUnsubscribe) { chatUnsubscribe(); chatUnsubscribe = null; } document.getElementById('prof-forum-chat-view').style.display = 'none'; document.getElementById('btn-create-chat-prof').style.display = 'block'; document.getElementById('prof-forum-channel-list').style.display = 'block'; return; }
    if (e.target.closest('#btn-prof-send-msg')) {
        const msgInput = document.getElementById('prof-input-forum-msg'); const msg = msgInput.value.trim(); if (!msg || !activeChatTurma || !activeChatDisc) return;
        try { await addDoc(collection(db, "turmas", activeChatTurma, "foruns", activeChatDisc, "mensagens"), { texto: msg, autor: myUserName, papel: "professor", timestamp: Date.now() }); msgInput.value = ''; } catch (err) { alert("Erro ao enviar."); }
        return;
    }
    if (e.target.closest('#btn-create-chat-prof')) {
        document.getElementById('forum-turma-select').innerHTML = '<option value="">Selecionar Turma...</option>' + turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join('');
        document.getElementById('input-nome-novo-forum').value = '';
        document.getElementById('lista-alunos-forum').innerHTML = '<p class="text-muted center" style="font-size:0.8rem;">Seleciona uma turma primeiro.</p>';
        document.getElementById('modal-criar-forum').style.display = 'flex';
        return;
    }
    if (e.target.closest('#btn-cancelar-novo-forum')) { document.getElementById('modal-criar-forum').style.display = 'none'; return; }
    if (e.target.closest('#btn-confirm-novo-forum')) {
        const nome = document.getElementById('input-nome-novo-forum').value.trim(); const turma = document.getElementById('forum-turma-select').value;
        if(!nome || !turma) { alert("Preenche o nome do chat e a turma."); return; }
        let mbr = [myUserId]; document.querySelectorAll('.forum-aluno-check:checked').forEach(c => mbr.push(c.value));
        const btnConf = e.target.closest('#btn-confirm-novo-forum'); btnConf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btnConf.disabled = true;
        try { 
            await addDoc(collection(db, "turmas", turma, "foruns"), { nome: nome, tipo: 'permanente', isDefault: false, membros: mbr, criadoPor: myUserName }); 
            document.getElementById('modal-criar-forum').style.display = 'none'; btnConf.innerHTML = 'Criar Chat'; btnConf.disabled = false; carregarForunsProf(); 
        } catch(err) { btnConf.innerHTML = 'Erro!'; setTimeout(() => { btnConf.innerHTML = 'Criar Chat'; btnConf.disabled = false; }, 2000); }
        return;
    }

    if (e.target.closest('#btn-novo-prhf')) {
        document.getElementById('erro-modal-prhf').style.display = 'none';
        document.getElementById('prhf-turma').innerHTML = '<option value="">-- Turma --</option>' + turmasProfessor.map(t => `<option value="${t}">${t}</option>`).join('');
        document.getElementById('prhf-disciplina').innerHTML = disciplinasProfessor.length > 0 ? disciplinasProfessor.map(dc => `<option value="${dc}">${dc}</option>`).join('') : '<option value="">Sem Disciplina</option>';
        document.getElementById('prhf-file').value = ''; prhfBase64 = null; document.getElementById('prhf-file-name').innerText = 'Toca para PDF ou Imagem';
        document.getElementById('prhf-horas-totais').value = ''; document.getElementById('prhf-horas-presenciais').value = '';
        document.getElementById('modal-criar-prhf').style.display = 'flex'; return;
    }
    if (e.target.closest('#btn-gravar-novo-prhf')) {
        const tTurma = document.getElementById('prhf-turma').value; const tAluno = document.getElementById('prhf-aluno').value; const tDisc = document.getElementById('prhf-disciplina').value; const tMod = document.getElementById('prhf-modulo').value; const tPrazo = document.getElementById('prhf-prazo').value; const tHorasP = document.getElementById('prhf-horas-presenciais').value; const tDesc = document.getElementById('prhf-descricao').value.trim();
        const errDiv = document.getElementById('erro-modal-prhf');
        if (!tAluno || !tDisc || !tMod || !tPrazo || tHorasP === '' || !tDesc) { errDiv.innerText = "Por favor, preenche todos os campos obrigatórios e define as Horas Totais."; errDiv.style.display = 'block'; return; }
        const b = e.target.closest('#btn-gravar-novo-prhf'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            await addDoc(collection(db, "utilizadores", tAluno, "prhfs"), { disciplina: tDisc, modulo: Number(tMod), prazo: tPrazo, horasPresenciais: Number(tHorasP), descricao: tDesc, status: 'pendente', dataCriacao: new Date().toISOString(), professor: myUserName, ficheiroBase64: prhfBase64 });
            b.innerHTML = '<i class="fa-solid fa-check"></i> Atribuído'; setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Atribuir PRHF'; b.disabled = false; document.getElementById('modal-criar-prhf').style.display = 'none'; carregarTarefasProf(); analisarEAtualizarTurma(selectedTurma); }, 1500);
        } catch (err) { errDiv.innerText = "Erro ao gravar. Tenta de novo."; errDiv.style.display = 'block'; b.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Atribuir PRHF'; b.disabled = false; }
        return;
    }
    if (e.target.closest('.btn-concluir-prhf')) {
        const btn = e.target.closest('.btn-concluir-prhf'); document.getElementById('conc-aluno-id').value = btn.getAttribute('data-aluno'); document.getElementById('conc-prhf-id').value = btn.getAttribute('data-prhf'); document.getElementById('conc-motivo').value = ''; document.getElementById('modal-concluir-prhf').style.display = 'flex'; return;
    }
    if (e.target.closest('#btn-confirmar-conclusao-prhf')) {
        const aId = document.getElementById('conc-aluno-id').value; const pId = document.getElementById('conc-prhf-id').value; const feedback = document.getElementById('conc-motivo').value.trim() || "Concluído com sucesso.";
        const b = e.target.closest('#btn-confirmar-conclusao-prhf'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try { 
            await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { status: 'concluida', feedbackProfessor: feedback }); 
            b.innerHTML = '<i class="fa-solid fa-check"></i> Plano Fechado'; setTimeout(() => { b.innerHTML = 'Aprovar e Fechar Plano'; b.disabled = false; document.getElementById('modal-concluir-prhf').style.display = 'none'; carregarTarefasProf(); analisarEAtualizarTurma(selectedTurma); }, 1500);
        } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); }
        return;
    }

    if (e.target.closest('#btn-modal-faltas')) {
        if (!selectedTurma || alunosTurmaRAM.length === 0) return alert("Seleciona uma turma com alunos primeiro.");
        document.getElementById('erro-modal-faltas').style.display = 'none';
        
        let aulasHojeH = '';
        aulasHojeH += `<option value="45">1 Tempo (45 min)</option>`;
        aulasHojeH += `<option value="90">2 Tempos (90 min)</option>`;
        aulasHojeH += `<option value="135">3 Tempos (135 min)</option>`;
        document.getElementById('falta-aula-select').innerHTML = `<option value="">-- Duração da Aula --</option>${aulasHojeH}`;
        
        const c = document.getElementById('lista-metralhadora-faltas'); let h = '';
        alunosTurmaRAM.forEach(al => { h += `<label style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); margin-bottom:5px; border-radius:8px; border:1px solid #333; cursor:pointer;"><span style="color:white; font-size:0.95rem;">${al.nome}</span><input type="checkbox" class="chk-presente" value="${al.id}" checked></label>`; });
        c.innerHTML = h; document.getElementById('modal-marcar-faltas').style.display = 'flex'; return;
    }
    if (e.target.closest('#btn-todos-presentes')) { e.preventDefault(); document.querySelectorAll('.chk-presente').forEach(c => c.checked = true); return; }
    if (e.target.closest('#btn-confirmar-faltas')) {
        const aulaMinutos = document.getElementById('falta-aula-select').value; const disc = disciplinasProfessor[0] || "Geral"; const errDiv = document.getElementById('erro-modal-faltas');
        if (!aulaMinutos) { errDiv.innerText = "Por favor, seleciona a duração da aula."; errDiv.style.display = 'block'; return; }
        const horasFormatadas = (Number(aulaMinutos) / 45).toFixed(1).replace('.0',''); 
        const b = e.target.closest('#btn-confirmar-faltas'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        const ausentes = document.querySelectorAll('.chk-presente:not(:checked)');
        for (const chk of ausentes) { await addDoc(collection(db, "utilizadores", chk.value, "faltas"), { disciplina: disc, horas: Number(horasFormatadas), dataInicio: new Date().toISOString().split('T')[0], justificada: false, criadoPor: myUserName, criadoEm: new Date().toISOString() }); }
        b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; setTimeout(() => { b.innerHTML = 'Gravar Faltas'; b.disabled = false; document.getElementById('modal-marcar-faltas').style.display = 'none'; analisarEAtualizarTurma(selectedTurma); }, 1500); return;
    }

    if (e.target.closest('#btn-modal-notas')) {
        if (!selectedTurma || alunosTurmaRAM.length === 0) return alert("Seleciona turma primeiro.");
        document.getElementById('erro-modal-notas').style.display = 'none';
        document.getElementById('lancar-nota-disciplina').innerHTML = disciplinasProfessor.map(dc => `<option value="${dc}">${dc}</option>`).join(''); document.getElementById('lancar-nota-modulo').value = '';
        const grid = document.getElementById('grid-notas-alunos'); let h = '';
        alunosTurmaRAM.forEach(al => { h += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); border-radius:8px; border:1px solid #333;"><div style="display:flex; align-items:center; gap:10px;"><img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;"><span style="color:white; font-size:0.9rem;">${al.nome}</span></div><input type="text" class="input-nota-aluno input-padrao" data-id="${al.id}" placeholder="Nota" style="width:70px; text-align:center; padding:5px; margin:0; text-transform:uppercase;"></div>`; });
        grid.innerHTML = h; document.getElementById('modal-lancamento-notas').style.display = 'flex'; return;
    }
    if (e.target.closest('#btn-confirmar-notas')) {
        const disc = document.getElementById('lancar-nota-disciplina').value; const mod = document.getElementById('lancar-nota-modulo').value; const errDiv = document.getElementById('erro-modal-notas');
        if (!disc || !mod) { errDiv.innerText = "Preenche o módulo e disciplina."; errDiv.style.display = 'block'; return; }
        const inputs = document.querySelectorAll('.input-nota-aluno'); let notasParaGravar = []; inputs.forEach(inp => { const v = inp.value.trim().toUpperCase(); if (v) notasParaGravar.push({ id: inp.getAttribute('data-id'), nota: v }); });
        if (notasParaGravar.length === 0) { errDiv.innerText = "Não inseriste notas."; errDiv.style.display = 'block'; return; }
        const b = e.target.closest('#btn-confirmar-notas'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            for (const n of notasParaGravar) { await addDoc(collection(db, "utilizadores", n.id, "notas"), { disciplina: disc, modulo: Number(mod), nota: n.nota, data: new Date().toISOString(), professor: myUserName }); }
            b.innerHTML = '<i class="fa-solid fa-check"></i> Gravadas'; setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-save"></i> Gravar Notas'; b.disabled = false; document.getElementById('modal-lancamento-notas').style.display = 'none'; analisarEAtualizarTurma(selectedTurma); }, 1500);
        } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); }
        return;
    }

    if (e.target.closest('#btn-modal-materiais')) {
        if (!selectedTurma) return alert("Seleciona turma primeiro.");
        document.getElementById('mat-titulo').value = ''; document.getElementById('mat-disciplina').innerHTML = disciplinasProfessor.length > 0 ? disciplinasProfessor.map(dc => `<option value="${dc}">${dc}</option>`).join('') : '<option value="">Geral</option>';
        document.getElementById('mat-file').value = ''; materialBase64 = null; document.getElementById('mat-file-name').innerText = 'Toca para selecionar PDF'; document.getElementById('modal-materiais').style.display = 'flex'; return;
    }
    if (e.target.closest('#btn-gravar-material')) {
        const tit = document.getElementById('mat-titulo').value.trim(); const disc = document.getElementById('mat-disciplina').value; if (!tit) return alert("Título em falta.");
        const b = e.target.closest('#btn-gravar-material'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try { await addDoc(collection(db, "turmas", selectedTurma, "sumarios"), { titulo: tit, disciplina: disc, professor: myUserName, data: new Date().toLocaleDateString('pt-PT'), descricao: materialBase64 ? "Ficheiro em anexo." : "Material partilhado pelo professor.", ficheiroBase64: materialBase64, timestamp: Date.now() }); b.innerHTML = '<i class="fa-solid fa-check"></i> Partilhado'; setTimeout(() => { b.innerHTML = 'Partilhar com a Turma'; b.disabled = false; document.getElementById('modal-materiais').style.display = 'none'; }, 1500); } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); }
        return;
    }

    if (e.target.closest('#btn-modal-agenda')) {
        if (!selectedTurma) return alert("Seleciona turma primeiro.");
        document.getElementById('evento-titulo').value = ''; document.getElementById('evento-data').value = ''; 
        document.getElementById('evento-hora').value = ''; document.getElementById('evento-hora').style.display = 'none'; document.getElementById('evento-periodo').value = 'dia';
        document.getElementById('modal-agendar-evento').style.display = 'flex'; return;
    }
    if (e.target.closest('#btn-gravar-evento')) {
        const t = document.getElementById('evento-titulo').value.trim(); const d = document.getElementById('evento-data').value; const tp = document.getElementById('evento-tipo').value; 
        const p = document.getElementById('evento-periodo').value; const h = document.getElementById('evento-hora').value;
        if (!t || !d) return alert("Preenche Título e Data.");
        if (p === 'hora' && !h) return alert("Preenche a hora exata do evento.");
        
        const b = e.target.closest('#btn-gravar-evento'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try { await addDoc(collection(db, "turmas", selectedTurma, "eventos"), { titulo: t, data: d, tipo: tp, periodo: p, hora: h, professor: myUserName }); b.innerHTML = '<i class="fa-solid fa-check"></i> Agendado'; setTimeout(() => { b.innerHTML = 'Agendar'; b.disabled = false; document.getElementById('modal-agendar-evento').style.display = 'none'; carregarRadarProfessor(); analisarEAtualizarTurma(selectedTurma); }, 1500); } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); }
        return;
    }

    if (e.target.closest('#btn-dar-positiva')) { if (!alunoSelecionadoId) return; document.getElementById('oco-tipo').value = 'positiva'; document.getElementById('oco-titulo').innerHTML = '<i class="fa-solid fa-star" style="color:var(--success-green);"></i> Ocorrência Positiva'; document.getElementById('oco-motivo').value = ''; document.getElementById('btn-gravar-ocorrencia').style.background = 'var(--success-green)'; document.getElementById('modal-ocorrencia').style.display = 'flex'; return; }
    if (e.target.closest('#btn-dar-negativa')) { if (!alunoSelecionadoId) return; document.getElementById('oco-tipo').value = 'negativa'; document.getElementById('oco-titulo').innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger-red);"></i> Ocorrência Negativa'; document.getElementById('oco-motivo').value = ''; document.getElementById('btn-gravar-ocorrencia').style.background = 'var(--danger-red)'; document.getElementById('modal-ocorrencia').style.display = 'flex'; return; }
    if (e.target.closest('#btn-gravar-ocorrencia')) {
        const tipo = document.getElementById('oco-tipo').value; const motivo = document.getElementById('oco-motivo').value.trim(); if (!motivo) return alert("Preenche o motivo!");
        const b = e.target.closest('#btn-gravar-ocorrencia'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            if (tipo === 'positiva') { const uS = await getDoc(doc(db, "utilizadores", alunoSelecionadoId)); let axp = uS.exists() && uS.data().xp ? uS.data().xp : 0; await addDoc(collection(db, "utilizadores", alunoSelecionadoId, "ocorrencias"), { titulo: "Reconhecimento Positivo", descricao: motivo, tipo: "positiva", autor: myUserName, timestamp: Date.now(), data: new Date().toLocaleDateString('pt-PT') }); await updateDoc(doc(db, "utilizadores", alunoSelecionadoId), { xp: axp + 50 }); } 
            else { await addDoc(collection(db, "utilizadores", alunoSelecionadoId, "ocorrencias"), { titulo: "Registo de Aula", descricao: motivo, tipo: "negativa", autor: myUserName, timestamp: Date.now(), data: new Date().toLocaleDateString('pt-PT') }); }
            b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; setTimeout(() => { b.innerHTML = 'Confirmar Registo'; b.disabled = false; document.getElementById('modal-ocorrencia').style.display = 'none'; document.getElementById('modal-perfil-aluno').style.display = 'none'; analisarEAtualizarTurma(selectedTurma); }, 1500);
        } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); }
        return;
    }
    if (e.target.closest('.btn-rejeitar-proposta')) { const btn = e.target.closest('.btn-rejeitar-proposta'); document.getElementById('rej-aluno-id').value = btn.getAttribute('data-aluno'); document.getElementById('rej-prhf-id').value = btn.getAttribute('data-prhf'); document.getElementById('rej-motivo').value = ''; document.getElementById('modal-rejeitar-prhf').style.display = 'flex'; return; }
    if (e.target.closest('#btn-confirmar-rejeicao')) {
        const aId = document.getElementById('rej-aluno-id').value; const pId = document.getElementById('rej-prhf-id').value; const feedback = document.getElementById('rej-motivo').value.trim(); if (!feedback) return alert("Indica o motivo.");
        const b = e.target.closest('#btn-confirmar-rejeicao'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try { await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { propostaLidaDT: true, propostaAluno: null, feedbackProfessor: "Rejeitada: " + feedback }); b.innerHTML = '<i class="fa-solid fa-check"></i> Rejeitado'; setTimeout(() => { b.innerHTML = 'Rejeitar Agendamento'; b.disabled = false; document.getElementById('modal-rejeitar-prhf').style.display = 'none'; carregarTarefasProf(); }, 1500); } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); }
        return;
    }
    if (e.target.closest('.btn-aceitar-proposta')) {
        const btn = e.target.closest('.btn-aceitar-proposta'); const aId = btn.getAttribute('data-aluno'); const pId = btn.getAttribute('data-prhf'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
        try { await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { propostaLidaDT: true, feedbackProfessor: "Proposta Aceite! Comparece no dia/hora combinados." }); carregarTarefasProf(); } catch (err) {}
        return;
    }
    if (e.target.closest('#btn-salvar-obs-dt')) {
        if (!alunoSelecionadoId) return; const txt = document.getElementById('p-aluno-obs-dt').value.trim(); const b = e.target.closest('#btn-salvar-obs-dt'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try { await setDoc(doc(db, "utilizadores", alunoSelecionadoId, "reunioes", "1_avaliacao"), { global: txt }, { merge: true }); b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; b.style.backgroundColor = "var(--success-green)"; setTimeout(() => { b.innerHTML = 'Gravar Observação'; b.disabled = false; b.style.backgroundColor = "var(--primary-green)"; }, 2000); } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 2000); }
        return;
    }
    if (e.target.closest('#btn-justificar-faltas')) {
        if (!alunoSelecionadoId) return;
        if (confirm("Pretendes justificar todas as faltas pendentes deste aluno?")) {
            const b = e.target.closest('#btn-justificar-faltas'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
            try {
                const fS = await getDocs(query(collection(db, "utilizadores", alunoSelecionadoId, "faltas"), where("justificada", "==", false)));
                for (const f of fS.docs) { await updateDoc(doc(db, "utilizadores", alunoSelecionadoId, "faltas", f.id), { justificada: true, justificadaPor: myUserName }); }
                b.innerHTML = '<i class="fa-solid fa-check"></i> Faltas Justificadas'; b.style.color = "var(--success-green)"; b.style.borderColor = "var(--success-green)";
                setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> Justificar Todas as Faltas'; b.disabled = false; b.style.color = "#00d2ff"; b.style.borderColor = "#00d2ff"; abrirPerfil360Aluno(alunoSelecionadoId); analisarEAtualizarTurma(selectedTurma); }, 2000);
            } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 2000); }
        }
        return;
    }
});

document.getElementById('forum-turma-select')?.addEventListener('change', async (e) => {
    const t = e.target.value; const cCont = document.getElementById('lista-alunos-forum');
    if (!t) { cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem;">Seleciona uma turma primeiro.</p>'; return; }
    cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>';
    try {
        const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); let cH = ''; 
        cS.forEach(d => { cH += `<label style="display:flex; align-items:center; gap:10px; color:white; font-size:0.9rem; padding:8px 0; cursor:pointer;"><input type="checkbox" class="forum-aluno-check" value="${d.id}" checked style="width:18px;height:18px;accent-color:var(--primary-green);"> ${d.data().nome}</label>`; });
        cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH;
    } catch(err) { cCont.innerHTML = '<p class="text-danger center">Erro.</p>'; }
});

document.getElementById('prof-seletor-turmas')?.addEventListener('change', (e) => { selectedTurma = e.target.value; if (selectedTurma) { document.getElementById('turma-ativa-container').style.display = 'block'; analisarEAtualizarTurma(selectedTurma); } else { document.getElementById('turma-ativa-container').style.display = 'none'; } });
document.getElementById('prhf-turma')?.addEventListener('change', async (e) => {
    const s = document.getElementById('prhf-aluno'); const t = e.target.value; if (!t) { s.innerHTML = '<option value="">Selecione primeiro a Turma</option>'; return; }
    s.innerHTML = '<option value="">A carregar...</option>';
    try { const qS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); let arr = []; qS.forEach(d => arr.push({ id: d.id, nome: d.data().nome })); arr.sort((a,b) => a.nome.localeCompare(b.nome)); s.innerHTML = '<option value="">-- Selecione o Aluno --</option>' + arr.map(a => `<option value="${a.id}">${a.nome}</option>`).join(''); } catch (err) { s.innerHTML = '<option value="">Erro</option>'; }
});
