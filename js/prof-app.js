import { auth, db, messaging, VAPID_KEY, getToken } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, updateDoc, getDocs, query, addDoc, deleteDoc, where, setDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let myUserId = "";
let myUserName = "";
let profData = {};
let myRoles = [];

let turmasProfessor = [];
let disciplinasProfessor = []; // O SEGREDO DO FILTRO
let selectedTurma = "";
let alunosTurmaRAM = [];
let eventosTurmaRAM = [];

let alunoSelecionadoId = null;
let materialBase64 = null;
let prhfBase64 = null;

// Fórum e Gráficos
let chatUnsubscribe = null;
let activeChatTurma = "";
let activeChatDisc = "";
let chartEvolucao = null;

const ACADEMIAS_INFO = { 'atlas': { nome: 'Atlas' }, 'sentinela': { nome: 'Sentinela' }, 'nexus': { nome: 'Nexus' }, 'aurora': { nome: 'Aurora' } };

// ==========================================
// 1. INICIALIZAÇÃO E LEITURA DE DADOS
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            if (docSnap.exists()) {
                profData = docSnap.data();
                myRoles = profData.papeis || [];
                disciplinasProfessor = profData.disciplinas || []; // Lê a disciplina que criaste na DB!

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
                    document.getElementById('perfil-nome-prof').innerText = myUserName;
                    
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

                    carregarRadarProfessor(); // O novo Assistente Global
                } else { window.location.href = "index.html"; }
            }
        } catch (e) { console.error("Erro na inicialização:", e); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-prof')?.addEventListener('click', () => signOut(auth));

// ==========================================
// 2. CONVERSÃO DE FICHEIROS PARA BASE64
// ==========================================
function setupBase64Upload(inputId, nameId, varSetter) {
    document.getElementById(inputId)?.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        if (file.size > 5 * 1024 * 1024) return alert("O ficheiro é muito grande. O limite máximo é 5MB.");
        
        document.getElementById(nameId).innerText = file.name;
        document.getElementById(nameId).style.color = "var(--primary-green)";
        
        const reader = new FileReader();
        reader.onload = (event) => { varSetter(event.target.result); };
        reader.readAsDataURL(file);
    });
}
setupBase64Upload('mat-file', 'mat-file-name', (val) => materialBase64 = val);
setupBase64Upload('prhf-file', 'prhf-file-name', (val) => prhfBase64 = val); // O novo upload do PRHF


// ==========================================
// 3. O ASSISTENTE GLOBAL (NOVO DASHBOARD) E RADAR
// ==========================================
async function carregarRadarProfessor() {
    const aText = document.getElementById('assistente-global-texto');
    const hCont = document.getElementById('dashboard-horario-container');
    const eCont = document.getElementById('radar-agenda-container');
    
    aText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A calcular inteligência letiva global...';
    hCont.innerHTML = '<p class="text-muted center">A ler horário...</p>';
    eCont.innerHTML = '<p class="text-muted center">A ler eventos...</p>';
    
    if (turmasProfessor.length === 0) {
        aText.innerHTML = 'Não tens turmas atribuídas de momento.'; return;
    }

    try {
        let totalAlunos = 0;
        let prhfsAtivosNasMinhasDisciplinas = 0;
        let eventosGlobais = [];

        for (const t of turmasProfessor) {
            // Busca Alunos
            const snapAl = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
            snapAl.forEach(d => totalAlunos++);
            
            // Busca Eventos
            const snapEv = await getDocs(collection(db, "turmas", t, "eventos"));
            snapEv.forEach(d => eventosGlobais.push({ turma: t, ...d.data() }));

            // Busca PRHFs ativos e filtra SÓ PELA DISCIPLINA DO PROF
            for (const docAluno of snapAl.docs) {
                const pSnap = await getDocs(collection(db, "utilizadores", docAluno.id, "prhfs"));
                pSnap.forEach(p => {
                    if (p.data().status !== 'concluida' && disciplinasProfessor.includes(p.data().disciplina)) {
                        prhfsAtivosNasMinhasDisciplinas++;
                    }
                });
            }
        }

        // 1. Escreve Assistente Global
        let resumo = `Gerir ${totalAlunos} alunos em ${turmasProfessor.length} turmas. `;
        if (prhfsAtivosNasMinhasDisciplinas > 0) {
            resumo += `<br><span style="color:var(--warning-yellow); font-weight:bold;">Tens ${prhfsAtivosNasMinhasDisciplinas} Planos de Recuperação ativos nas tuas disciplinas.</span>`;
        } else {
            resumo += `<br><span style="color:var(--success-green);">Todos os teus alunos estão regulares na tua disciplina!</span>`;
        }
        aText.innerHTML = resumo;

        // 2. Horário do Dia (Exemplo Fixo Bonito)
        const hjData = new Date();
        const diasSemana = ["Domingo", "Segunda", "Terça", "Quarta", "Quinta", "Sexta", "Sábado"];
        hCont.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); border:1px solid #333; padding:10px; border-radius:8px;">
                <div style="color:var(--text-muted); font-size:0.85rem;">${diasSemana[hjData.getDay()]}</div>
                <div style="font-weight:bold; color:white;">O horário do professor estará disponível na Fase 3.</div>
            </div>`;

        // 3. Próximos Eventos
        const hjStr = hjData.toISOString().split('T')[0];
        const fut = eventosGlobais.filter(e => e.data >= hjStr).sort((a,b) => a.data.localeCompare(b.data)).slice(0, 3);
        
        if (fut.length > 0) {
            let ah = ''; 
            fut.forEach(e => { 
                ah += `<div style="display:flex; justify-content:space-between; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:5px; border-left:3px solid var(--warning-yellow);"><div><strong style="color:white; font-size:0.9rem;">${e.titulo}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">Turma ${e.turma}</span></div><span style="color:var(--warning-yellow); font-size:0.8rem;">${e.data.split('-').reverse().join('/')}</span></div>`; 
            }); 
            eCont.innerHTML = ah;
        } else { 
            eCont.innerHTML = '<p class="text-muted center" style="font-size:0.85rem;">Agenda livre para as próximas semanas.</p>'; 
        }

    } catch (e) { aText.innerHTML = "Erro ao carregar dados."; }
}

// ==========================================
// 4. ASSISTENTE DA TURMA (ISOLADO À DISCIPLINA)
// ==========================================
async function analisarEAtualizarTurma(turmaId) {
    const listC = document.getElementById('lista-alunos-turma'); 
    listC.innerHTML = '<p class="text-muted center">A ler dados dos alunos...</p>';
    document.getElementById('assistente-aula-texto').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A focar na tua disciplina...';
    
    try {
        const qAlunos = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turmaId), where("papel", "==", "aluno")));
        alunosTurmaRAM = []; qAlunos.forEach(d => alunosTurmaRAM.push({ id: d.id, ...d.data() })); alunosTurmaRAM.sort((a,b) => a.nome.localeCompare(b.nome));

        let asstText = ""; let alunosEmRisco = 0; let totalPrhfsDisciplina = 0; let htmlAlunos = '';

        for (let i=0; i<alunosTurmaRAM.length; i++) {
            const al = alunosTurmaRAM[i]; let numFaltasNaMinhaDisc = 0; let numPrhfsNaMinhaDisc = 0;
            
            // Faltas (Conta apenas as da disciplina do prof)
            const fS = await getDocs(collection(db, "utilizadores", al.id, "faltas")); 
            fS.forEach(f => { 
                if(!f.data().justificada && disciplinasProfessor.includes(f.data().disciplina)) {
                    numFaltasNaMinhaDisc++; 
                }
            });
            
            // PRHFs (Conta apenas os da disciplina do prof)
            const pS = await getDocs(collection(db, "utilizadores", al.id, "prhfs")); 
            pS.forEach(p => { 
                if(p.data().status !== 'concluida' && disciplinasProfessor.includes(p.data().disciplina)) {
                    numPrhfsNaMinhaDisc++; 
                }
            });
            
            totalPrhfsDisciplina += numPrhfsNaMinhaDisc; 
            let corBola = 'status-green';
            
            if (numFaltasNaMinhaDisc > 5 || numPrhfsNaMinhaDisc > 2) { corBola = 'status-red'; alunosEmRisco++; } 
            else if (numFaltasNaMinhaDisc > 2 || numPrhfsNaMinhaDisc > 0) { corBola = 'status-yellow'; }

            htmlAlunos += `
            <div class="aluno-list-item" data-id="${al.id}" style="cursor:pointer; transition:0.2s;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                    <div>
                        <strong style="color:white; font-size:0.95rem;">${al.nome}</strong>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${numPrhfsNaMinhaDisc > 0 ? `<span style="color:#00d2ff;">${numPrhfsNaMinhaDisc} PRHFs em ${disciplinasProfessor[0]}</span>` : 'Tudo regular em ' + (disciplinasProfessor[0] || 'Geral')}</div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <span style="color:var(--primary-green); font-size:0.85rem; font-weight:bold;">${al.xp || 0} XP</span>
                    <span class="status-dot ${corBola}"></span>
                </div>
            </div>`;
        }

        asstText = `A turma tem <strong>${alunosTurmaRAM.length} alunos</strong>. `;
        if (alunosEmRisco > 0) asstText += `<span style="color:var(--danger-red);">Tens ${alunosEmRisco} alunos em risco na tua disciplina.</span> `;
        if (totalPrhfsDisciplina > 0) asstText += `Há ${totalPrhfsDisciplina} PRHFs a decorrer na tua matéria. `;
        if (alunosEmRisco === 0 && totalPrhfsDisciplina === 0) asstText += `Todos os alunos estão alinhados em ${disciplinasProfessor.join(', ') || 'Geral'}.`;

        document.getElementById('assistente-aula-texto').innerHTML = asstText; listC.innerHTML = htmlAlunos;
    } catch (e) { listC.innerHTML = '<p class="text-danger center">Erro a processar turma.</p>'; }
}


// ==========================================
// 5. PERFIL 360 DO ALUNO (ESTATÍSTICAS DA DISCIPLINA)
// ==========================================
async function abrirPerfil360Aluno(alunoId) {
    alunoSelecionadoId = alunoId; const al = alunosTurmaRAM.find(a => a.id === alunoId); if (!al) return;
    document.getElementById('p-aluno-nome').innerText = al.nome; document.getElementById('p-aluno-foto').src = al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`; document.getElementById('p-aluno-academia').innerText = al.academia ? ACADEMIAS_INFO[al.academia].nome : 'Sem Academia';

    let fCount = 0; let pCount = 0; let notasData = [];
    
    try {
        // Filtra Faltas SÓ da disciplina do prof
        const fS = await getDocs(collection(db, "utilizadores", alunoId, "faltas")); 
        fS.forEach(f => { if(!f.data().justificada && disciplinasProfessor.includes(f.data().disciplina)) fCount++; });
        
        // Filtra PRHFs SÓ da disciplina do prof
        const pS = await getDocs(collection(db, "utilizadores", alunoId, "prhfs")); 
        pS.forEach(p => { if(p.data().status !== 'concluida' && disciplinasProfessor.includes(p.data().disciplina)) pCount++; });
        
        // Recolhe Notas SÓ da disciplina do prof para o gráfico
        const nS = await getDocs(collection(db, "utilizadores", alunoId, "notas"));
        nS.forEach(n => {
            if(disciplinasProfessor.includes(n.data().disciplina)) {
                notasData.push({ modulo: `Mod ${n.data().modulo}`, valor: isNaN(n.data().nota) ? 0 : Number(n.data().nota) });
            }
        });
        notasData.sort((a,b) => a.modulo.localeCompare(b.modulo));

        if (myRoles.includes('diretor_turma')) {
            document.getElementById('area-obs-dt').style.display = 'block'; document.getElementById('btn-justificar-faltas').style.display = fCount > 0 ? 'block' : 'none';
            const rS = await getDoc(doc(db, "utilizadores", alunoId, "reunioes", "1_avaliacao"));
            if (rS.exists() && rS.data().global) { document.getElementById('p-aluno-obs-dt').value = rS.data().global; } else { document.getElementById('p-aluno-obs-dt').value = ''; }
        }
    } catch (e) {}

    document.getElementById('p-aluno-faltas').innerText = fCount; 
    document.getElementById('p-aluno-prhfs').innerText = pCount;
    document.getElementById('p-aluno-notas').innerText = notasData.length;

    // DESENHAR O GRÁFICO DA DISCIPLINA
    const ctx = document.getElementById('chartEvolucaoAluno').getContext('2d');
    if(chartEvolucao) chartEvolucao.destroy();
    
    const labels = notasData.length > 0 ? notasData.map(n => n.modulo) : ['Sem Avaliação'];
    const values = notasData.length > 0 ? notasData.map(n => n.valor) : [0];

    chartEvolucao = new Chart(ctx, {
        type: 'line',
        data: {
            labels: labels,
            datasets: [{
                label: 'Evolução na tua Disciplina',
                data: values,
                borderColor: '#00cc88', backgroundColor: 'rgba(0, 204, 136, 0.2)', borderWidth: 2, fill: true, tension: 0.3, pointRadius: 4
            }]
        },
        options: {
            responsive: true, maintainAspectRatio: false,
            scales: { y: { beginAtZero: true, max: 20, grid: { color: '#333' }, ticks: { color: '#a0a0a0' } }, x: { grid: { display: false }, ticks: { color: '#a0a0a0' } } },
            plugins: { legend: { display: false } }
        }
    });

    document.getElementById('modal-perfil-aluno').style.display = 'flex';
}

// ==========================================
// 6. GESTÃO DE PRHFS E PASSAPORTE
// ==========================================
async function carregarTarefasProf() {
    const isPRHFTab = document.getElementById('tab-tarefas-prhf').classList.contains('active');
    
    if (isPRHFTab) {
        const container = document.getElementById('lista-prhfs-professor'); container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A procurar PRHFs...</p>';
        if (turmasProfessor.length === 0) { container.innerHTML = '<p class="text-muted center">Sem turmas atribuídas.</p>'; return; }
        
        try {
            let todosAlunos = []; 
            for (const t of turmasProfessor) { const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); snap.forEach(d => todosAlunos.push({ id: d.id, ...d.data() })); }
            let todosPrhfs = []; 
            for (const al of todosAlunos) { const pSnap = await getDocs(collection(db, "utilizadores", al.id, "prhfs")); pSnap.forEach(p => todosPrhfs.push({ id: p.id, alunoId: al.id, alunoNome: al.nome, turma: al.turma, alunoXP: al.xp || 0, ...p.data() })); }
            
            todosPrhfs.sort((a,b) => new Date(a.prazo) - new Date(b.prazo)); 
            // O SEGREDO: O Prof só vê os PRHFs da sua disciplina!
            let pendentes = todosPrhfs.filter(p => p.status !== 'concluida' && disciplinasProfessor.includes(p.disciplina));
            
            let h = ''; 
            if (pendentes.length === 0) { h = `<div style="padding:15px; border:1px dashed var(--success-green); border-radius:8px; text-align:center;"><p style="color:var(--success-green); font-size:0.9rem; margin:0;">Excelente! Não há Planos de Recuperação na tua matéria.</p></div>`; }

            pendentes.forEach(p => {
                let acoesProposta = '';
                if (p.propostaAluno && p.propostaLidaDT === false) { 
                    acoesProposta = `<div style="background:rgba(255,204,0,0.1); border:1px dashed var(--warning-yellow); padding:10px; border-radius:8px; margin-top:10px;"><strong style="color:var(--warning-yellow); font-size:0.85rem;"><i class="fa-solid fa-clock"></i> Proposta de Agendamento:</strong><p style="font-size:0.85rem; color:white; margin:5px 0;">${p.propostaAluno}</p><div style="display:flex; gap:10px; margin-top:10px;"><button class="primary-btn small-btn btn-aceitar-proposta" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1; background:var(--success-green);"><i class="fa-solid fa-check"></i> Aceitar</button><button class="secondary-btn small-btn btn-rejeitar-proposta" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1; border-color:var(--danger-red); color:var(--danger-red);"><i class="fa-solid fa-xmark"></i> Rejeitar</button></div></div>`; 
                } else if (p.propostaAluno && p.propostaLidaDT === true) { 
                    acoesProposta = `<div style="margin-top:10px; font-size:0.8rem; color:var(--success-green);"><i class="fa-solid fa-calendar-check"></i> Sessão Agendada</div>`; 
                }
                
                h += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #00d2ff;"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><strong style="color:white; font-size:1.05rem;">${p.alunoNome} <span style="font-size:0.75rem; color:var(--text-muted);">(${p.turma})</span></strong><div style="color:#00d2ff; font-weight:bold; font-size:0.9rem; margin-top:3px;">${p.disciplina} (Módulo ${p.modulo})</div></div><button class="btn-concluir-prhf" data-aluno="${p.alunoId}" data-prhf="${p.id}" data-xp="${p.alunoXP}" style="background:var(--bg-dark); border:1px solid var(--success-green); color:var(--success-green); padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-clipboard-check"></i> Concluir</button></div><p style="font-size:0.85rem; color:var(--text-light); margin:10px 0;">${p.descricao}</p><div style="font-size:0.8rem; color:var(--text-muted);">Prazo: <strong style="color:white;">${p.prazo.split('-').reverse().join('/')}</strong> | Horas: <strong>${p.horasPresenciais}h</strong></div>${acoesProposta}</div>`;
            }); 
            container.innerHTML = h;
        } catch (e) { container.innerHTML = '<p class="text-danger center">Erro a carregar PRHFs.</p>'; }
    } else {
        const container = document.getElementById('lista-passaportes-professor'); container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar passaportes...</p>';
        try {
            let todosAlunos = []; 
            for (const t of turmasProfessor) { const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); snap.forEach(d => todosAlunos.push({ id: d.id, ...d.data() })); }
            let h = '';
            
            todosAlunos.forEach(al => {
                let fctHtml = ''; 
                if (al.fct && al.fct.horasRealizadas > 0) { 
                    if (al.fct.validadoDT) { fctHtml = `<span style="color:var(--success-green); font-size:0.8rem;"><i class="fa-solid fa-check-double"></i> ${al.fct.horasRealizadas}h Validadas</span>`; } 
                    else { 
                        let btnValidar = myRoles.includes('coordenador') ? `<button class="primary-btn small-btn btn-validar-fct" data-id="${al.id}" style="width:auto; padding:4px 10px;">Validar</button>` : `<span style="font-size:0.75rem; color:var(--text-muted);">A aguardar Coord.</span>`;
                        fctHtml = `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--warning-yellow); font-size:0.8rem;">${al.fct.horasRealizadas}h declaradas</span> ${btnValidar}</div>`; 
                    }
                } else { fctHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Sem registos FCT.</span>`; }
                
                let papHtml = ''; 
                if (al.papFicheiroEnviado && al.papFicheiroBase64) { 
                    if (myRoles.includes('orientador_pap') || myRoles.includes('diretor_turma')) { papHtml = `<a href="${al.papFicheiroBase64}" download="PAP_${al.nome.replace(/\s+/g, '_')}" class="secondary-btn small-btn" style="color:#0099ff; border-color:#0099ff; display:inline-block; text-align:center;"><i class="fa-solid fa-download"></i> Baixar Relatório</a>`; } else { papHtml = `<span style="color:var(--success-green); font-size:0.8rem;"><i class="fa-solid fa-check"></i> Relatório submetido</span>`; }
                } else if (al.pap && al.pap.tema) { papHtml = `<span style="color:var(--text-light); font-size:0.8rem;">Tema: ${al.pap.tema} (Pendente)</span>`; } else { papHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Sem registos PAP.</span>`; }
                
                if (fctHtml.includes('declaradas') || fctHtml.includes('Validadas') || papHtml.includes('Tema') || papHtml.includes('Baixar') || papHtml.includes('submetido')) {
                    h += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #ff9900;"><strong style="color:white; font-size:1.05rem;">${al.nome} <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span></strong><div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px dashed #333;"><strong style="font-size:0.85rem; color:white;"><i class="fa-solid fa-briefcase" style="color:var(--primary-green);"></i> FCT (Estágio)</strong><div style="margin-top:5px;">${fctHtml}</div></div><div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px dashed #333;"><strong style="font-size:0.85rem; color:white;"><i class="fa-solid fa-laptop-code" style="color:#0099ff;"></i> Projeto de Aptidão Profissional (PAP)</strong><div style="margin-top:5px;">${papHtml}</div></div></div>`;
                }
            }); 
            container.innerHTML = h === '' ? '<p class="text-muted center">Nenhum aluno submeteu horas ou relatórios ainda.</p>' : h;
        } catch (e) { container.innerHTML = '<p class="text-danger center">Erro ao carregar passaportes.</p>'; }
    }
}

// ==========================================
// 7. EVENTOS DE CLIQUE (AÇÃO DOS BOTÕES)
// ==========================================
document.body.addEventListener('click', async (e) => {
    const nav = e.target.closest('.nav-item');
    if (nav) {
        e.preventDefault(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); nav.classList.add('active');
        esconderTodasAsVistas(); const tId = nav.getAttribute('data-target'); document.getElementById(tId).style.display = (tId === 'view-prof-forum') ? 'flex' : 'block';
        if (tId === 'view-prof-dashboard') carregarRadarProfessor();
        if (tId === 'view-prof-turmas' && selectedTurma) analisarEAtualizarTurma(selectedTurma);
        if (tId === 'view-prof-tarefas') carregarTarefasProf();
        if (tId === 'view-prof-forum') { if (chatUnsubscribe) { chatUnsubscribe(); chatUnsubscribe = null; } document.getElementById('prof-forum-chat-view').style.display = 'none'; document.getElementById('prof-forum-channel-list').style.display = 'block'; carregarForunsProf(); }
    }
    if (e.target.closest('.fechar-modal')) document.getElementById(e.target.closest('.fechar-modal').getAttribute('data-target')).style.display = 'none';
    if (e.target.closest('.aluno-list-item')) abrirPerfil360Aluno(e.target.closest('.aluno-list-item').getAttribute('data-id'));
    if (e.target.closest('#tab-tarefas-prhf')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'block'; document.getElementById('sec-tarefas-passaporte').style.display = 'none'; carregarTarefasProf(); }
    if (e.target.closest('#tab-tarefas-passaporte')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'none'; document.getElementById('sec-tarefas-passaporte').style.display = 'block'; carregarTarefasProf(); }

    // --- CRIAR PRHF COM UPLOAD ---
    if (e.target.closest('#btn-novo-prhf')) {
        document.getElementById('prhf-turma').innerHTML = '<option value="">-- Turma --</option>' + turmasProfessor.map(t => `<option value="${t}">${t}</option>`).join('');
        document.getElementById('prhf-disciplina').innerHTML = disciplinasProfessor.length > 0 ? disciplinasProfessor.map(dc => `<option value="${dc}">${dc}</option>`).join('') : '<option value="">Erro: Sem Disciplina</option>';
        document.getElementById('prhf-file').value = ''; prhfBase64 = null;
        document.getElementById('prhf-file-name').innerText = 'Toca para PDF ou Imagem';
        document.getElementById('modal-criar-prhf').style.display = 'flex';
    }

    if (e.target.closest('#btn-gravar-novo-prhf')) {
        const tTurma = document.getElementById('prhf-turma').value; const tAluno = document.getElementById('prhf-aluno').value; const tDisc = document.getElementById('prhf-disciplina').value; const tMod = document.getElementById('prhf-modulo').value; const tPrazo = document.getElementById('prhf-prazo').value; const tHoras = document.getElementById('prhf-horas').value; const tDesc = document.getElementById('prhf-descricao').value.trim();
        if (!tAluno || !tDisc || !tMod || !tPrazo || !tHoras || !tDesc) return alert("Preenche todos os campos obrigatórios!");
        const b = e.target.closest('#btn-gravar-novo-prhf'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            await addDoc(collection(db, "utilizadores", tAluno, "prhfs"), { disciplina: tDisc, modulo: Number(tMod), prazo: tPrazo, horasPresenciais: Number(tHoras), descricao: tDesc, status: 'pendente', dataCriacao: new Date().toISOString(), professor: myUserName, ficheiroBase64: prhfBase64 });
            b.innerHTML = '<i class="fa-solid fa-check"></i> Plano Ativado'; b.style.backgroundColor = "var(--success-green)"; 
            setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Atribuir PRHF'; b.disabled = false; b.style.backgroundColor = "var(--danger-red)"; document.getElementById('modal-criar-prhf').style.display = 'none'; carregarTarefasProf(); analisarEAtualizarTurma(selectedTurma); }, 2000);
        } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 2000); }
    }

    // --- CONCLUIR PRHF ---
    if (e.target.closest('.btn-concluir-prhf')) {
        const btn = e.target.closest('.btn-concluir-prhf'); 
        document.getElementById('conc-aluno-id').value = btn.getAttribute('data-aluno');
        document.getElementById('conc-prhf-id').value = btn.getAttribute('data-prhf');
        document.getElementById('conc-aluno-xp').value = btn.getAttribute('data-xp');
        document.getElementById('conc-motivo').value = '';
        document.getElementById('modal-concluir-prhf').style.display = 'flex';
    }

    if (e.target.closest('#btn-confirmar-conclusao-prhf')) {
        const aId = document.getElementById('conc-aluno-id').value; const pId = document.getElementById('conc-prhf-id').value; const currXP = parseInt(document.getElementById('conc-aluno-xp').value) || 0;
        const feedback = document.getElementById('conc-motivo').value.trim() || "Recuperação concluída com sucesso.";
        const b = e.target.closest('#btn-confirmar-conclusao-prhf'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try { 
            await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { status: 'concluida', feedbackProfessor: feedback }); 
            await updateDoc(doc(db, "utilizadores", aId), { xp: currXP + 100 }); 
            b.innerHTML = '<i class="fa-solid fa-check"></i> Plano Aprovado';
            setTimeout(() => { b.innerHTML = 'Aprovar Plano (+100 XP)'; b.disabled = false; document.getElementById('modal-concluir-prhf').style.display = 'none'; carregarTarefasProf(); analisarEAtualizarTurma(selectedTurma); }, 1500);
        } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); }
    }

    // --- FALTAS METRALHADORA (Filtra a disciplina do prof) ---
    if (e.target.closest('#btn-modal-faltas')) {
        if (!selectedTurma || alunosTurmaRAM.length === 0) return alert("Seleciona uma turma com alunos primeiro.");
        const c = document.getElementById('lista-metralhadora-faltas'); let h = '';
        document.getElementById('falta-disciplina-select').innerHTML = disciplinasProfessor.map(dc => `<option value="${dc}">${dc}</option>`).join('');
        alunosTurmaRAM.forEach(al => { h += `<label style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); margin-bottom:5px; border-radius:8px; border:1px solid #333; cursor:pointer;"><span style="color:white; font-size:0.95rem;">${al.nome}</span><input type="checkbox" class="chk-presente" value="${al.id}" checked></label>`; });
        c.innerHTML = h; document.getElementById('falta-horas-bloco').value = ''; document.getElementById('modal-marcar-faltas').style.display = 'flex';
    }
    if (e.target.closest('#btn-todos-presentes')) { e.preventDefault(); document.querySelectorAll('.chk-presente').forEach(c => c.checked = true); }
    if (e.target.closest('#btn-confirmar-faltas')) {
        const horas = document.getElementById('falta-horas-bloco').value; const disc = document.getElementById('falta-disciplina-select').value; if (!horas || !disc) return alert("Preenche todos os campos!");
        const b = e.target.closest('#btn-confirmar-faltas'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        const ausentes = document.querySelectorAll('.chk-presente:not(:checked)');
        for (const chk of ausentes) { await addDoc(collection(db, "utilizadores", chk.value, "faltas"), { disciplina: disc, horas: Number(horas), dataInicio: new Date().toISOString().split('T')[0], justificada: false, criadoPor: myUserName, criadoEm: new Date().toISOString() }); }
        b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; b.style.backgroundColor = "var(--success-green)"; 
        setTimeout(() => { b.innerHTML = 'Gravar Registo'; b.disabled = false; b.style.backgroundColor = "var(--danger-red)"; document.getElementById('modal-marcar-faltas').style.display = 'none'; analisarEAtualizarTurma(selectedTurma); }, 1500);
    }

    // --- NOTAS EM MASSA ---
    if (e.target.closest('#btn-modal-notas')) {
        if (!selectedTurma || alunosTurmaRAM.length === 0) return alert("Seleciona uma turma com alunos primeiro.");
        document.getElementById('lancar-nota-disciplina').innerHTML = disciplinasProfessor.map(dc => `<option value="${dc}">${dc}</option>`).join(''); document.getElementById('lancar-nota-modulo').value = '';
        const grid = document.getElementById('grid-notas-alunos'); let h = '';
        alunosTurmaRAM.forEach(al => { h += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); border-radius:8px; border:1px solid #333;"><div style="display:flex; align-items:center; gap:10px;"><img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;"><span style="color:white; font-size:0.9rem;">${al.nome}</span></div><input type="text" class="input-nota-aluno input-padrao" data-id="${al.id}" placeholder="Nota" style="width:70px; text-align:center; padding:5px; margin:0; text-transform:uppercase;"></div>`; });
        grid.innerHTML = h; document.getElementById('modal-lancamento-notas').style.display = 'flex';
    }
    if (e.target.closest('#btn-confirmar-notas')) {
        const disc = document.getElementById('lancar-nota-disciplina').value; const mod = document.getElementById('lancar-nota-modulo').value; if (!disc || !mod) return alert("Preenche a Disciplina e Módulo!");
        const inputs = document.querySelectorAll('.input-nota-aluno'); let notasParaGravar = []; inputs.forEach(inp => { const v = inp.value.trim().toUpperCase(); if (v) notasParaGravar.push({ id: inp.getAttribute('data-id'), nota: v }); });
        if (notasParaGravar.length === 0) return alert("Não inseriste notas.");
        const b = e.target.closest('#btn-confirmar-notas'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            for (const n of notasParaGravar) {
                await addDoc(collection(db, "utilizadores", n.id, "notas"), { disciplina: disc, modulo: Number(mod), nota: n.nota, data: new Date().toISOString(), professor: myUserName });
                if (n.nota !== 'REP' && !isNaN(n.nota) && Number(n.nota) >= 10) { const uS = await getDoc(doc(db, "utilizadores", n.id)); if(uS.exists()) await updateDoc(doc(db, "utilizadores", n.id), { xp: (uS.data().xp || 0) + 20 }); }
            }
            b.innerHTML = '<i class="fa-solid fa-check"></i> Gravadas'; b.style.backgroundColor = "var(--success-green)"; b.style.color = "white";
            setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-save"></i> Gravar Notas'; b.disabled = false; b.style.backgroundColor = "var(--warning-yellow)"; b.style.color = "black"; document.getElementById('modal-lancamento-notas').style.display = 'none'; analisarEAtualizarTurma(selectedTurma); }, 1500);
        } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); }
    }

    // --- REJEIÇÃO PRHF ---
    if (e.target.closest('.btn-rejeitar-proposta')) {
        const btn = e.target.closest('.btn-rejeitar-proposta'); 
        document.getElementById('rej-aluno-id').value = btn.getAttribute('data-aluno');
        document.getElementById('rej-prhf-id').value = btn.getAttribute('data-prhf');
        document.getElementById('rej-motivo').value = '';
        document.getElementById('modal-rejeitar-prhf').style.display = 'flex';
    }
    if (e.target.closest('#btn-confirmar-rejeicao')) {
        const aId = document.getElementById('rej-aluno-id').value; const pId = document.getElementById('rej-prhf-id').value; const feedback = document.getElementById('rej-motivo').value.trim();
        if (!feedback) return alert("Indica o motivo.");
        const b = e.target.closest('#btn-confirmar-rejeicao'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { propostaLidaDT: true, propostaAluno: null, feedbackProfessor: "Rejeitada: " + feedback });
            b.innerHTML = '<i class="fa-solid fa-check"></i> Rejeitado'; setTimeout(() => { b.innerHTML = 'Rejeitar Agendamento'; b.disabled = false; document.getElementById('modal-rejeitar-prhf').style.display = 'none'; carregarTarefasProf(); }, 1500);
        } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); }
    }

    // --- OCORRÊNCIAS ---
    if (e.target.closest('#btn-dar-positiva')) {
        if (!alunoSelecionadoId) return; document.getElementById('oco-tipo').value = 'positiva'; document.getElementById('oco-titulo').innerHTML = '<i class="fa-solid fa-star" style="color:var(--success-green);"></i> Ocorrência Positiva'; document.getElementById('oco-motivo').value = ''; document.getElementById('btn-gravar-ocorrencia').style.background = 'var(--success-green)'; document.getElementById('modal-ocorrencia').style.display = 'flex';
    }
    if (e.target.closest('#btn-dar-negativa')) {
        if (!alunoSelecionadoId) return; document.getElementById('oco-tipo').value = 'negativa'; document.getElementById('oco-titulo').innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger-red);"></i> Ocorrência Negativa'; document.getElementById('oco-motivo').value = ''; document.getElementById('btn-gravar-ocorrencia').style.background = 'var(--danger-red)'; document.getElementById('modal-ocorrencia').style.display = 'flex';
    }
    if (e.target.closest('#btn-gravar-ocorrencia')) {
        const tipo = document.getElementById('oco-tipo').value; const motivo = document.getElementById('oco-motivo').value.trim(); if (!motivo) return alert("Preenche o motivo!");
        const b = e.target.closest('#btn-gravar-ocorrencia'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            if (tipo === 'positiva') {
                const uS = await getDoc(doc(db, "utilizadores", alunoSelecionadoId)); let axp = uS.exists() && uS.data().xp ? uS.data().xp : 0;
                await addDoc(collection(db, "utilizadores", alunoSelecionadoId, "ocorrencias"), { titulo: "Reconhecimento Positivo", descricao: motivo, tipo: "positiva", autor: myUserName, timestamp: Date.now(), data: new Date().toLocaleDateString('pt-PT') });
                await updateDoc(doc(db, "utilizadores", alunoSelecionadoId), { xp: axp + 50 });
            } else { await addDoc(collection(db, "utilizadores", alunoSelecionadoId, "ocorrencias"), { titulo: "Registo de Aula", descricao: motivo, tipo: "negativa", autor: myUserName, timestamp: Date.now(), data: new Date().toLocaleDateString('pt-PT') }); }
            b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; setTimeout(() => { b.innerHTML = 'Confirmar Registo'; b.disabled = false; document.getElementById('modal-ocorrencia').style.display = 'none'; document.getElementById('modal-perfil-aluno').style.display = 'none'; analisarEAtualizarTurma(selectedTurma); }, 1500);
        } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); }
    }
});

// SELECTS MUDANÇA
document.getElementById('prof-seletor-turmas')?.addEventListener('change', (e) => {
    selectedTurma = e.target.value; if (selectedTurma) { document.getElementById('turma-ativa-container').style.display = 'block'; analisarEAtualizarTurma(selectedTurma); } else { document.getElementById('turma-ativa-container').style.display = 'none'; }
});
document.getElementById('prhf-turma')?.addEventListener('change', async (e) => {
    const s = document.getElementById('prhf-aluno'); const t = e.target.value;
    if (!t) { s.innerHTML = '<option value="">Selecione primeiro a Turma</option>'; return; }
    s.innerHTML = '<option value="">A carregar alunos...</option>';
    try { const qS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); let arr = []; qS.forEach(d => arr.push({ id: d.id, nome: d.data().nome })); arr.sort((a,b) => a.nome.localeCompare(b.nome)); s.innerHTML = '<option value="">-- Selecione o Aluno --</option>' + arr.map(a => `<option value="${a.id}">${a.nome}</option>`).join(''); } catch (err) { s.innerHTML = '<option value="">Erro</option>'; }
});
