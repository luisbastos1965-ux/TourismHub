import { auth, db, messaging, VAPID_KEY, getToken, onMessage } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, updateDoc, getDocs, query, addDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let myUserId = "";
let myUserName = "";
let minhaTurma = ""; 

onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                if(dados.papel !== 'aluno') {
                    window.location.href = "index.html"; 
                    return;
                }
                
                myUserName = dados.nome.split(' ')[0];
                minhaTurma = dados.turma;
                document.getElementById('header-user-name-aluno').innerText = myUserName;
                
                if(dados.fotoPerfil) {
                    const avatarCircle = document.getElementById('header-avatar-circle');
                    avatarCircle.innerHTML = `<img src="${dados.fotoPerfil}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                }

                carregarDadosPassaporte(dados);
                carregarGamificacao(dados);
                carregarAgendaDashboard();
            }
        } catch (e) { console.error("Erro ao ler perfil", e); }
    } else { 
        window.location.href = "index.html"; 
    }
});

document.getElementById('btn-logout-aluno')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

function carregarGamificacao(dados) {
    const xp = dados.xp || 0;
    const nivel = Math.floor(xp / 100) + 1;
    const xpProximoNivel = nivel * 100;
    const xpNivelAtual = (nivel - 1) * 100;
    const progresso = ((xp - xpNivelAtual) / (xpProximoNivel - xpNivelAtual)) * 100;

    document.getElementById('aluno-nivel').innerText = nivel;
    document.getElementById('aluno-xp-atual').innerText = xp;
    document.getElementById('aluno-xp-progress').style.width = `${progresso}%`;
    document.getElementById('aluno-xp-falta').innerText = xpProximoNivel - xp;

    let rank = "Novato";
    if (nivel >= 2) rank = "Aprendiz";
    if (nivel >= 5) rank = "Estudante PRO";
    if (nivel >= 10) rank = "Veterano";
    if (nivel >= 20) rank = "Lenda da Turma";
    document.getElementById('aluno-rank-title').innerText = rank;
}

const navItems = document.querySelectorAll('.nav-item');
const views = [
    document.getElementById('student-dashboard'),
    document.getElementById('view-aluno-caderneta'),
    document.getElementById('view-aluno-agenda'),
    document.getElementById('view-aluno-forum'),
    document.getElementById('view-aluno-passaporte'),
    document.getElementById('view-study-mode'),
    document.getElementById('view-aluno-sumarios'),
    document.getElementById('view-aluno-caderno')
];

function esconderTodasAsVistas() {
    views.forEach(v => { if(v) v.style.display = 'none'; });
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach(nav => nav.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        esconderTodasAsVistas();
        const targetId = e.currentTarget.getAttribute('data-target');
        const targetView = document.getElementById(targetId);
        if(targetView) targetView.style.display = 'block';
    });
});

document.getElementById('btn-abrir-passaporte')?.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    esconderTodasAsVistas();
    document.getElementById('view-aluno-passaporte').style.display = 'block';
});

document.getElementById('btn-voltar-passaporte')?.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    document.querySelector('.nav-item[data-target="student-dashboard"]').classList.add('active');
    esconderTodasAsVistas();
    document.getElementById('student-dashboard').style.display = 'block';
});

let ficheiroPapBase64 = "";

function carregarDadosPassaporte(dados) {
    // Verificar o ano do aluno para mostrar/esconder FCT e PAP
    const anoMatch = (dados.turma || "").match(/\d+/);
    const ano = anoMatch ? parseInt(anoMatch[0]) : 0;
    
    if (ano === 10) {
        document.getElementById('btn-abrir-passaporte').style.display = 'none';
    } else {
        document.getElementById('btn-abrir-passaporte').style.display = 'flex';
        if (ano === 11) {
            document.getElementById('sec-aluno-pap').style.display = 'none';
        } else {
            document.getElementById('sec-aluno-pap').style.display = 'block';
        }
    }

    const fctEntidade = dados.fctEntidade || "Por definir";
    const fctHorasFeitas = dados.fctHorasFeitas || 0;
    const fctHorasTotais = dados.fctHorasTotais || 400;
    
    document.getElementById('aluno-fct-entidade').innerText = fctEntidade;
    document.getElementById('aluno-fct-horas').innerText = `${fctHorasFeitas} / ${fctHorasTotais}h`;
    
    let percFCT = fctHorasTotais > 0 ? (fctHorasFeitas / fctHorasTotais) * 100 : 0;
    document.getElementById('aluno-fct-progress').style.width = `${Math.min(percFCT, 100)}%`;

    const papTema = dados.papTema || "Por selecionar";
    document.getElementById('aluno-pap-tema').innerText = papTema;
    
    if (dados.papFicheiroEnviado) {
        document.getElementById('aluno-pap-file-name').innerText = "Ficheiro submetido e entregue à escola.";
    }
}

document.getElementById('aluno-upload-pap')?.addEventListener('change', async (e) => {
    let file = e.target.files[0];
    if(!file) return;
    
    if (file.type.startsWith('image/')) {
        const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true };
        try { file = await imageCompression(file, options); } catch (err) {}
    } else {
        if(file.size > 2097152) { alert("O teu documento é demasiado pesado! O limite é 2MB."); return; }
    }
    
    document.getElementById('aluno-pap-file-name').innerText = file.name;
    document.getElementById('aluno-pap-file-name').style.color = "var(--warning-yellow)";
    document.getElementById('btn-enviar-pap').style.display = 'block';

    const reader = new FileReader();
    reader.onload = (ev) => { ficheiroPapBase64 = ev.target.result; };
    reader.readAsDataURL(file);
});

document.getElementById('btn-enviar-pap')?.addEventListener('click', async (e) => {
    if(!ficheiroPapBase64 || !myUserId) return;
    const btnRef = e.currentTarget;
    btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar...';
    btnRef.disabled = true;

    try {
        const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
        let atualXp = docSnap.exists() && docSnap.data().xp ? docSnap.data().xp : 0;

        await updateDoc(doc(db, "utilizadores", myUserId), {
            papFicheiroEnviado: true,
            papFicheiroBase64: ficheiroPapBase64,
            papDataEnvio: new Date().toISOString(),
            xp: atualXp + 200
        });
        
        btnRef.style.backgroundColor = "var(--success-green)";
        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Submetido (+200 XP!)';
        carregarGamificacao({xp: atualXp + 200});

        setTimeout(() => {
            btnRef.style.display = 'none';
            btnRef.disabled = false;
            btnRef.style.backgroundColor = "var(--primary-green)";
            btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submeter Ficheiro';
            document.getElementById('aluno-pap-file-name').innerText = "Ficheiro na posse da escola.";
            document.getElementById('aluno-pap-file-name').style.color = "var(--success-green)";
        }, 3000);
    } catch(err) {
        btnRef.innerHTML = "Erro!";
        setTimeout(() => { btnRef.disabled = false; btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submeter Ficheiro'; }, 2000);
    }
});

let pomodoroTimer;
let pomodoroRestante = 25 * 60; 

document.getElementById('btn-open-study-mode')?.addEventListener('click', () => {
    esconderTodasAsVistas();
    navItems.forEach(nav => nav.classList.remove('active'));
    document.getElementById('view-study-mode').style.display = 'flex';
});

document.getElementById('btn-voltar-study')?.addEventListener('click', () => {
    esconderTodasAsVistas();
    document.querySelector('.nav-item[data-target="student-dashboard"]').classList.add('active');
    document.getElementById('student-dashboard').style.display = 'block';
});

document.getElementById('btn-start-study')?.addEventListener('click', (e) => {
    e.currentTarget.style.display = 'none';
    document.getElementById('btn-stop-study').style.display = 'inline-block';
    
    pomodoroTimer = setInterval(() => {
        pomodoroRestante--;
        const m = Math.floor(pomodoroRestante / 60).toString().padStart(2, '0');
        const s = (pomodoroRestante % 60).toString().padStart(2, '0');
        document.getElementById('study-timer-text').innerText = `${m}:${s}`;
        
        if(pomodoroRestante <= 0) {
            clearInterval(pomodoroTimer);
            alert("Parabéns! Foco concluído. Descansa 5 minutos.");
            resetPomodoro();
        }
    }, 1000);
});

document.getElementById('btn-stop-study')?.addEventListener('click', resetPomodoro);

function resetPomodoro() {
    clearInterval(pomodoroTimer);
    pomodoroRestante = 25 * 60;
    document.getElementById('study-timer-text').innerText = "25:00";
    document.getElementById('btn-stop-study').style.display = 'none';
    document.getElementById('btn-start-study').style.display = 'inline-block';
}

const tabNotas = document.getElementById('tab-aluno-notas');
const tabFaltas = document.getElementById('tab-aluno-faltas');
const tabPrhfs = document.getElementById('tab-aluno-prhfs');
const tabComportamento = document.getElementById('tab-aluno-comportamento');
const tabObservacoes = document.getElementById('tab-aluno-observacoes'); 
const cadernetaContent = document.getElementById('aluno-caderneta-content');

tabNotas?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-comportamento', 'tab-aluno-observacoes']); carregarNotasAluno(); });
tabFaltas?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-notas', 'tab-aluno-prhfs', 'tab-aluno-comportamento', 'tab-aluno-observacoes']); carregarFaltasAluno(); });
tabPrhfs?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-comportamento', 'tab-aluno-observacoes']); carregarPrhfsAluno(); });
tabComportamento?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-observacoes']); carregarComportamentoAluno(); });
tabObservacoes?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-comportamento']); carregarObservacoesAluno(); });

document.querySelector('.nav-item[data-target="view-aluno-caderneta"]')?.addEventListener('click', () => {
    ativarTab(tabNotas, ['tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-comportamento', 'tab-aluno-observacoes']);
    carregarNotasAluno();
});

function ativarTab(tabAtiva, tabsInativasIds) {
    if(!tabAtiva) return;
    tabAtiva.classList.add('active');
    tabsInativasIds.forEach(id => document.getElementById(id)?.classList.remove('active'));
    cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar...</p>';
}

async function carregarNotasAluno() {
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", myUserId, "notas"));
        if(notasDb.empty) { cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">Ainda não tens notas lançadas.</p>'; return; }
        
        let html = '<div class="stats-grid" style="grid-template-columns: 1fr;">';
        notasDb.forEach(d => {
            const nota = d.data();
            const cor = (nota.nota === 'REP' || Number(nota.nota) < 10) ? 'var(--danger-red)' : 'var(--success-green)';
            html += `
            <div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left: 4px solid ${cor};">
                <div><strong>${nota.disciplina}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">Módulo ${nota.modulo}</span></div>
                <div style="font-size:1.4rem; font-weight:bold; color:${cor};">${nota.nota}</div>
            </div>`;
        });
        cadernetaContent.innerHTML = html + '</div>';
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao ler notas.</p>'; }
}

async function carregarFaltasAluno() {
    try {
        const faltasDb = await getDocs(collection(db, "utilizadores", myUserId, "faltas"));
        if(faltasDb.empty) { cadernetaContent.innerHTML = '<div style="text-align:center; padding:30px;"><i class="fa-solid fa-check-circle" style="font-size:3rem; color:var(--success-green); margin-bottom:15px;"></i><p class="text-muted">Parabéns! Não tens faltas registadas.</p></div>'; return; }
        
        let faltasArr = [];
        faltasDb.forEach(d => { faltasArr.push(d.data()); });
        faltasArr.sort((a,b) => b.dataInicio.localeCompare(a.dataInicio)); 

        let html = '';
        faltasArr.forEach(f => {
            const statusColor = f.justificada ? 'var(--success-green)' : 'var(--danger-red)';
            const statusTxt = f.justificada ? 'Justificada' : (f.comprovativoEnviado ? 'Em Análise (DT)' : 'Injustificada');
            html += `
            <div class="card" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div><strong>${f.disciplina}</strong> (${f.horas}h)<br><span style="font-size:0.8rem; color:var(--text-muted);">${f.dataInicio}</span></div>
                <span style="font-size:0.8rem; font-weight:bold; color:${statusColor}; padding:5px 10px; background:rgba(255,255,255,0.05); border-radius:12px;">${statusTxt}</span>
            </div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao ler faltas.</p>'; }
}

async function carregarPrhfsAluno() {
    try {
        const prhfsDb = await getDocs(collection(db, "utilizadores", myUserId, "prhfs"));
        if(prhfsDb.empty) { cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">Não tens Planos de Recuperação (PRHF) atribuídos.</p>'; return; }
        
        let html = '';
        prhfsDb.forEach(d => {
            const p = d.data();
            const cor = p.status === 'concluida' ? 'var(--success-green)' : 'var(--warning-yellow)';
            html += `
            <div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong>${p.disciplina} (Mod. ${p.modulo})</strong>
                    <span style="color:${cor}; font-size:0.85rem; font-weight:bold;">${p.status.toUpperCase()}</span>
                </div>
                <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">${p.descricao}</p>
                <div style="font-size:0.8rem;">Data Limite: <strong>${p.prazo}</strong> | Presenciais: <strong>${p.horasPresenciais}h</strong></div>
            </div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao ler PRHFs.</p>'; }
}

async function carregarComportamentoAluno() {
    if(!myUserId) return;
    try {
        const res = await getDocs(query(collection(db, "utilizadores", myUserId, "ocorrencias")));
        if(res.empty) { cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">Sem registos disciplinares ou de mérito.</p>'; return; }
        let regs = []; res.forEach(d => regs.push(d.data())); regs.sort((a,b) => b.data.localeCompare(a.data)); 
        let html = '';
        regs.forEach(r => {
            const cor = r.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)';
            const ic = r.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';
            html += `
            <div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};">
                <div style="display:flex; align-items:center; gap:8px; color:${cor}; margin-bottom:5px;">${ic} <strong>${r.titulo}</strong></div>
                <span style="font-size:0.75rem; color:var(--text-muted);">Data: ${r.data} | Prof. ${r.autor}</span>
                ${r.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">${r.descricao}</p>` : ''}
            </div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao carregar dados.</p>'; }
}

async function carregarObservacoesAluno() {
    if(!myUserId) return;
    try {
        const res = await getDocs(query(collection(db, "utilizadores", myUserId, "observacoes")));
        if(res.empty) { cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">Ainda não existem observações de reunião registadas.</p>'; return; }
        let obsArr = []; res.forEach(d => obsArr.push(d.data())); obsArr.sort((a,b) => b.timestamp - a.timestamp); 
        let html = '';
        obsArr.forEach(o => {
            html += `
            <div class="card" style="margin-bottom:10px; border-left: 4px solid var(--primary-green);">
                <div style="display:flex; justify-content:space-between;"><strong style="color: white;">${o.momento}</strong><span style="font-size:0.75rem; color:var(--text-muted);">${o.data}</span></div>
                <p style="margin-top:8px; font-size:0.9rem; line-height: 1.5; color: var(--text-light);">${o.descricao}</p>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px; text-align:right;">Prof. ${o.autor}</div>
            </div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao carregar observações.</p>'; }
}

document.querySelector('.nav-item[data-target="view-aluno-agenda"]')?.addEventListener('click', () => {
    document.getElementById('tab-aluno-eventos').classList.add('active');
    document.getElementById('tab-aluno-horario').classList.remove('active');
    carregarAgendaAluno();
});
document.getElementById('tab-aluno-eventos')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-aluno-horario').classList.remove('active'); carregarAgendaAluno(); });
document.getElementById('tab-aluno-horario')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-aluno-eventos').classList.remove('active'); document.getElementById('aluno-agenda-content').innerHTML = '<p class="text-muted center">Esta funcionalidade espelhará o horário inserido pelo DT.</p>'; });

async function carregarAgendaDashboard() {
    if(!minhaTurma) return;
    try {
        const evDb = await getDocs(collection(db, "eventos"));
        if(!evDb.empty) {
            let evArr = []; evDb.forEach(d => evArr.push(d.data()));
            const hoje = new Date().toISOString().split('T')[0];
            const futuros = evArr.filter(e => e.data >= hoje).sort((a,b) => a.data.localeCompare(b.data));
            if(futuros.length > 0) { document.getElementById('aluno-proximo-evento').innerText = futuros[0].data.split('-').reverse().join('/') + ' - ' + futuros[0].titulo; return; }
        }
        document.getElementById('aluno-proximo-evento').innerText = "Agenda Livre!";
    } catch(e){}
}

async function carregarAgendaAluno() {
    const containerEL = document.getElementById('aluno-agenda-content'); containerEL.innerHTML = '<p class="text-muted center">A desenhar calendário...</p>';
    try {
        const evDb = await getDocs(collection(db, "eventos")); let eventosFormatados = [];
        evDb.forEach(d => { const e = d.data(); eventosFormatados.push({ title: e.titulo, start: e.data, backgroundColor: '#9b59b6', borderColor: '#9b59b6' }); });
        containerEL.innerHTML = ""; 
        let calendar = new FullCalendar.Calendar(containerEL, { initialView: 'dayGridMonth', locale: 'pt', events: eventosFormatados, headerToolbar: { left: 'prev,next', center: 'title', right: 'today' }, height: 'auto' });
        calendar.render();
    } catch(e) { containerEL.innerHTML = '<p class="text-danger center">Erro ao carregar o calendário.</p>'; }
}

let chatUnsubscribeAluno = null; let alunoForumAtivoId = null;
document.querySelector('.nav-item[data-target="view-aluno-forum"]')?.addEventListener('click', async () => {
    const container = document.getElementById('aluno-forum-channel-list'); container.innerHTML = '<p class="text-muted center">A carregar fóruns...</p>';
    if(!minhaTurma) return;
    try {
        const res = await getDocs(collection(db, "turmas", minhaTurma, "foruns")); let html = '';
        res.forEach(docSnap => {
            const f = docSnap.data();
            if(f.membros.includes(myUserId)) {
                const icon = f.tipo === 'permanente' ? 'fa-comments' : 'fa-stopwatch';
                html += `<div class="canal-card" data-id="${docSnap.id}" data-nome="${f.nome}"><div class="canal-icon"><i class="fa-solid ${icon}"></i></div><div class="canal-info"><h4>${f.nome}</h4></div></div>`;
            }
        });
        if(html === '') { container.innerHTML = '<p class="text-muted center">Não estás inserido em nenhum canal.</p>'; return; }
        container.innerHTML = html;
        container.querySelectorAll('.canal-card').forEach(card => card.addEventListener('click', (e) => { alunoForumAtivoId = e.currentTarget.getAttribute('data-id'); document.getElementById('aluno-chat-active-title').innerText = e.currentTarget.getAttribute('data-nome'); document.getElementById('aluno-forum-channel-list').style.display = 'none'; document.getElementById('aluno-forum-chat-view').style.display = 'flex'; iniciarChatAluno(alunoForumAtivoId); }));
    } catch(e) {}
});

document.getElementById('btn-aluno-voltar-canais')?.addEventListener('click', () => { document.getElementById('aluno-forum-chat-view').style.display = 'none'; document.getElementById('aluno-forum-channel-list').style.display = 'block'; });

function iniciarChatAluno(fId) {
    const chatContainer = document.getElementById('aluno-chat-messages-container'); chatContainer.innerHTML = ''; if(chatUnsubscribeAluno) chatUnsubscribeAluno();
    chatUnsubscribeAluno = onSnapshot(query(collection(db, "turmas", minhaTurma, "foruns", fId, "mensagens"), orderBy("timestamp")), (snapshot) => {
        let html = '';
        snapshot.forEach(doc => { const msg = doc.data(); const isMe = msg.remetente === myUserName; const classe = isMe ? 'admin' : 'student'; html += `<div class="chat-bubble ${classe}"><strong>${isMe ? 'Tu' : msg.remetente}</strong><br>${msg.texto}<span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>`; });
        chatContainer.innerHTML = html; chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}
document.getElementById('btn-aluno-send-msg')?.addEventListener('click', async () => { const inp = document.getElementById('aluno-input-forum-msg'); const txt = inp.value.trim(); if(!txt || !alunoForumAtivoId) return; try { await addDoc(collection(db, "turmas", minhaTurma, "foruns", alunoForumAtivoId, "mensagens"), { remetente: myUserName, texto: txt, timestamp: Date.now() }); inp.value = ''; } catch(e) {} });

const viewSumarios = document.getElementById('view-aluno-sumarios');
document.getElementById('btn-open-sumarios')?.addEventListener('click', () => { esconderTodasAsVistas(); navItems.forEach(nav => nav.classList.remove('active')); viewSumarios.style.display = 'block'; carregarSumariosAluno(); });
document.getElementById('btn-voltar-sumarios')?.addEventListener('click', () => { esconderTodasAsVistas(); document.querySelector('.nav-item[data-target="student-dashboard"]').classList.add('active'); document.getElementById('student-dashboard').style.display = 'block'; });
document.getElementById('aluno-filtro-sumarios-disc')?.addEventListener('change', carregarSumariosAluno);

async function carregarSumariosAluno() {
    const container = document.getElementById('aluno-lista-sumarios-container'); container.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar sumários...</p>';
    if(!minhaTurma) return;
    try {
        const res = await getDocs(query(collection(db, "turmas", minhaTurma, "sumarios")));
        if(res.empty) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Nenhum material publicado pelos professores.</p>'; return; }
        let sumarios = []; let disciplinasUnicas = new Set();
        res.forEach(d => { const data = d.data(); sumarios.push({id: d.id, ...data}); disciplinasUnicas.add(data.disciplina); });
        const filtroSelect = document.getElementById('aluno-filtro-sumarios-disc');
        if (filtroSelect.options.length <= 1) { let optHTML = '<option value="">Todas as Disciplinas</option>'; disciplinasUnicas.forEach(disc => optHTML += `<option value="${disc}">${disc}</option>`); filtroSelect.innerHTML = optHTML; }
        const filtroAtual = filtroSelect.value; if(filtroAtual) sumarios = sumarios.filter(s => s.disciplina === filtroAtual);
        sumarios.sort((a,b) => b.data.localeCompare(a.data)); 
        if(sumarios.length === 0) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Sem sumários para esta disciplina.</p>'; return; }
        let html = '';
        sumarios.forEach(s => {
            const anexoBtn = s.anexoBase64 ? `<a href="${s.anexoBase64}" download="${s.anexoNome}" class="primary-btn small-btn" style="display:inline-block; margin-top:10px; width:auto; padding:8px 12px; background-color:#0099ff;"><i class="fa-solid fa-download"></i> Baixar ${s.anexoNome}</a>` : '';
            html += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #0099ff;"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">${s.data} | ${s.disciplina} | Prof. ${s.professor}</span><h4 style="margin:5px 0;">${s.titulo}</h4>${s.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">${s.descricao}</p>` : ''}</div></div>${anexoBtn}</div>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p class="text-danger center">Erro ao carregar os dados.</p>'; }
}

let quillEditor; 
document.getElementById('btn-open-caderno')?.addEventListener('click', () => {
    esconderTodasAsVistas(); navItems.forEach(nav => nav.classList.remove('active')); document.getElementById('view-aluno-caderno').style.display = 'block';
    if (!quillEditor) { quillEditor = new Quill('#quill-editor', { theme: 'snow', placeholder: 'Escreve aqui o teu resumo com negritos, cores, listas...', modules: { toolbar: [ ['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], [{ 'color': [] }, { 'background': [] }], ['clean'] ] } }); }
    carregarApontamentos();
});
document.getElementById('btn-voltar-caderno')?.addEventListener('click', () => { esconderTodasAsVistas(); document.querySelector('.nav-item[data-target="student-dashboard"]').classList.add('active'); document.getElementById('student-dashboard').style.display = 'block'; });

document.getElementById('btn-gravar-apontamento')?.addEventListener('click', async (e) => {
    const titulo = document.getElementById('caderno-titulo').value.trim(); const conteudoHTML = quillEditor.root.innerHTML; const textoLimpo = quillEditor.getText().trim(); 
    if(!titulo || textoLimpo.length === 0) { alert("Preenche o título e escreve alguma coisa no resumo!"); return; }
    const br = e.currentTarget; const txtOriginal = br.innerHTML; br.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar na nuvem...'; br.disabled = true;
    try {
        await addDoc(collection(db, "utilizadores", myUserId, "apontamentos"), { titulo: titulo, conteudo: conteudoHTML, timestamp: Date.now() });
        document.getElementById('caderno-titulo').value = ''; quillEditor.root.innerHTML = '';
        br.innerHTML = '<i class="fa-solid fa-check"></i> Gravado com sucesso!'; br.style.backgroundColor = 'var(--success-green)';
        carregarApontamentos();
        setTimeout(() => { br.innerHTML = txtOriginal; br.disabled = false; br.style.backgroundColor = '#e67e22'; }, 2000);
    } catch(err) { br.innerHTML = 'Erro ao gravar!'; setTimeout(() => { br.innerHTML = txtOriginal; br.disabled = false; }, 2000); }
});

async function carregarApontamentos() {
    const container = document.getElementById('lista-apontamentos-container'); container.innerHTML = '<p class="text-muted center">A sincronizar com a nuvem...</p>';
    if(!myUserId) return;
    try {
        const res = await getDocs(query(collection(db, "utilizadores", myUserId, "apontamentos")));
        if(res.empty) { container.innerHTML = '<p class="text-muted center">Ainda não tens resumos gravados. Começa a escrever o teu primeiro!</p>'; return; }
        let arr = []; res.forEach(d => arr.push({id: d.id, ...d.data()})); arr.sort((a,b) => b.timestamp - a.timestamp); 
        let html = '';
        arr.forEach(nota => { html += `<div class="card" style="margin-bottom:15px; border-left:4px solid #e67e22;"><div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;"><strong style="font-size:1.05rem; color:var(--primary-green);">${nota.titulo}</strong><span style="font-size:0.75rem; color:var(--text-muted);"><i class="fa-regular fa-clock"></i> ${new Date(nota.timestamp).toLocaleDateString('pt-PT')}</span></div><div style="background: rgba(255,255,255,0.05); padding:10px; border-radius:6px; font-size:0.95rem; overflow-x:auto;">${nota.conteudo}</div></div>`; });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p class="text-danger center">Ocorreu um erro a carregar os resumos.</p>'; }
}

async function pedirPermissaoNotificacoes() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
            if (currentToken) { await updateDoc(doc(db, "utilizadores", myUserId), { tokenNotificacao: currentToken }); }
        }
    } catch (error) { console.error("🚨 Erro fatal ao ativar notificações:", error); }
}

if(typeof onMessage !== "undefined" && messaging) {
    onMessage(messaging, (payload) => { alert(`NOVA NOTIFICAÇÃO:\n\n${payload.notification.title}\n${payload.notification.body}`); });
}
setTimeout(() => { if(myUserId) pedirPermissaoNotificacoes(); }, 4000);
