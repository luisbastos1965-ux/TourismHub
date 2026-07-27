import { db } from "./firebase.js";
import { collection, query, where, getDocs, onSnapshot, orderBy, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let chatUnsubscribeAluno = null;

// ==========================================
// 1. DASHBOARD E ALERTAS
// ==========================================
export async function carregarDashboardAluno(alunoId, turmaId, nomeAluno) {
    document.getElementById('lms-welcome-name').innerText = `Olá, ${nomeAluno.split(' ')[0]}!`;

    // Próximo Evento
    try {
        const hoje = new Date().toISOString().split('T')[0];
        const resEvts = await getDocs(query(collection(db, "turmas", turmaId, "eventos")));
        let futuros = []; resEvts.forEach(d => { const ev = d.data(); if (ev.data >= hoje) futuros.push(ev); });
        futuros.sort((a,b) => a.data.localeCompare(b.data));
        const elEvento = document.getElementById('aluno-proximo-evento');
        if(futuros.length > 0) {
            const dp = futuros[0].data.split('-'); elEvento.innerText = `${dp[2]}/${dp[1]} - ${futuros[0].disciplina || futuros[0].titulo}`; elEvento.style.color = "var(--warning-yellow)";
        } else { elEvento.innerText = "Livre de testes!"; elEvento.style.color = "var(--success-green)"; }
    } catch(e) {}

    // PRHFs Pendentes
    try {
        const resPrhf = await getDocs(query(collection(db, "utilizadores", alunoId, "prhfs")));
        let ativos = 0; resPrhf.forEach(d => { if(d.data().status === 'ativa') ativos++; });
        const elPrhf = document.getElementById('aluno-prhf-count');
        elPrhf.innerText = `${ativos} Plano(s)`; elPrhf.style.color = ativos > 0 ? "var(--danger-red)" : "var(--success-green)";
    } catch(e) {}
}

// ==========================================
// 2. A CADERNETA (Notas, Faltas e PRHFs)
// ==========================================
export async function carregarCadernetaAluno(alunoId, matrizCurso) {
    const content = document.getElementById('aluno-caderneta-content');
    content.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar a tua pauta global...</p>';
    
    // Mostra as notas por defeito
    document.getElementById('tab-aluno-notas').onclick = () => renderPautaGlobal(alunoId, matrizCurso, content);
    document.getElementById('tab-aluno-faltas').onclick = () => renderFaltasAluno(alunoId, content);
    document.getElementById('tab-aluno-prhfs').onclick = () => renderPrhfAluno(alunoId, content);
    
    // Ativa tab Notas inicialmente
    document.querySelectorAll('#view-aluno-caderneta .tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-aluno-notas').classList.add('active');
    renderPautaGlobal(alunoId, matrizCurso, content);
}

async function renderPautaGlobal(alunoId, matrizCurso, container) {
    document.querySelectorAll('#view-aluno-caderneta .tab-btn').forEach(b => b.classList.remove('active')); document.getElementById('tab-aluno-notas').classList.add('active');
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", alunoId, "notas")); const mapNotas = {}; notasDb.forEach(d => { mapNotas[`${d.data().disciplina}_${d.data().modulo}`] = d.data().nota; });
        let html = '';
        for (const [comp, disciplinas] of Object.entries(matrizCurso)) {
            html += `<div class="pauta-global-componente"><div class="pauta-global-header">${comp}</div>`;
            for (const [nomeDisc, modulos] of Object.entries(disciplinas)) {
                html += `<div class="pauta-global-disc"><div class="pauta-global-disc-title">${nomeDisc}</div><div class="pauta-global-notas">`;
                for(const mod of Object.keys(modulos)) {
                    const nota = mapNotas[`${nomeDisc}_${mod}`] || 'SN'; let cor = "sn"; if(nota !== 'SN' && nota !== 'REP' && nota >= 10) cor = "positiva"; else if(nota === 'REP' || nota < 10) cor = "negativa";
                    html += `<div class="pg-nota-item"><span>${mod}</span><span class="pg-nota-val ${cor}">${nota}</span></div>`;
                }
                html += `</div></div>`;
            } html += `</div>`;
        } container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p class="text-danger">Erro ao ler pauta.</p>'; }
}

async function renderFaltasAluno(alunoId, container) {
    document.querySelectorAll('#view-aluno-caderneta .tab-btn').forEach(b => b.classList.remove('active')); document.getElementById('tab-aluno-faltas').classList.add('active');
    try {
        const res = await getDocs(query(collection(db, "utilizadores", alunoId, "faltas")));
        if(res.empty) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Parabéns! Não tens faltas registadas.</p>'; return; }
        let faltas = []; res.forEach(d => faltas.push(d.data())); faltas.sort((a,b) => b.dataInicio.localeCompare(a.dataInicio));
        let html = '';
        faltas.forEach(f => {
            const cBar = f.justificada ? 'justificada' : 'injustificada'; const cMeta = f.justificada ? 'var(--success-green)' : 'var(--danger-red)'; const tMeta = f.justificada ? 'Justificada' : 'Injustificada';
            html += `<div class="falta-registo-card" style="flex-direction: row; align-items:center; background:var(--bg-dark);"><div class="falta-status-bar ${cBar}" style="align-self: stretch;"></div><div class="falta-registo-info" style="flex:1;"><div><strong>${f.dataInicio}</strong><br><span style="font-size:0.85rem; color:var(--text-muted);">${f.disciplina} - ${f.modulo}</span></div><div style="text-align:right;"><strong>${f.horas}h</strong><br><span class="falta-registo-meta" style="color:${cMeta}; font-weight:bold;">${tMeta}</span></div></div></div>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p class="text-danger">Erro ao ler faltas.</p>'; }
}

async function renderPrhfAluno(alunoId, container) {
    document.querySelectorAll('#view-aluno-caderneta .tab-btn').forEach(b => b.classList.remove('active')); document.getElementById('tab-aluno-prhfs').classList.add('active');
    try {
        const res = await getDocs(query(collection(db, "utilizadores", alunoId, "prhfs")));
        if(res.empty) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Não tens Planos de Recuperação.</p>'; return; }
        let html = '';
        res.forEach(doc => {
            const data = doc.data(); let classeCor = data.status === 'ativa' ? (data.moduloTerminado ? 'ativa-terminado' : 'ativa-decorrer') : 'concluida';
            html += `<div class="prhf-mini-card ${classeCor}"><strong>${data.disciplina}_${data.modulo}</strong><span style="font-size:0.8rem; font-weight:bold; color:white; background:rgba(255,255,255,0.1); padding:2px 8px; border-radius:4px;">${data.status.toUpperCase()}</span></div>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p class="text-danger">Erro ao ler PRHFs.</p>'; }
}

// ==========================================
// 3. FÓRUM DO ALUNO
// ==========================================
export async function carregarForunsAluno(turmaId, alunoId, nomeAluno) {
    const listContainer = document.getElementById('aluno-forum-channel-list');
    listContainer.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar os teus canais...</p>';
    try {
        // O Aluno só vê os fóruns onde o ID dele está no array "membros"
        const q = query(collection(db, "turmas", turmaId, "foruns"), where("membros", "array-contains", alunoId));
        const res = await getDocs(q);
        if(res.empty) { listContainer.innerHTML = '<p class="text-muted" style="text-align:center;">Ainda não foste adicionado a nenhum fórum.</p>'; return; }
        
        let html = '<div class="forum-canais-grid">';
        res.forEach(docSnap => {
            const f = docSnap.data(); const icon = f.tipo === 'permanente' ? 'fa-comments' : 'fa-stopwatch';
            html += `<div class="canal-card" data-id="${docSnap.id}" data-nome="${f.nome}"><div class="canal-icon"><i class="fa-solid ${icon}"></i></div><div class="canal-info"><h4>${f.nome}</h4><p>${f.membros.length} Membro(s)</p></div></div>`;
        });
        html += '</div>';
        listContainer.innerHTML = html;
        
        listContainer.querySelectorAll('.canal-card').forEach(card => card.addEventListener('click', (e) => {
            const fId = e.currentTarget.getAttribute('data-id'); const fNome = e.currentTarget.getAttribute('data-nome');
            document.getElementById('aluno-chat-active-title').innerText = fNome;
            document.getElementById('aluno-forum-channel-list').style.display = 'none'; document.getElementById('aluno-forum-chat-view').style.display = 'flex';
            iniciarChatAluno(turmaId, fId, nomeAluno);
        }));

        document.getElementById('btn-aluno-voltar-canais').onclick = () => {
            if(chatUnsubscribeAluno) chatUnsubscribeAluno();
            document.getElementById('aluno-forum-chat-view').style.display = 'none'; document.getElementById('aluno-forum-channel-list').style.display = 'block';
        };
    } catch(err) { listContainer.innerHTML = '<p class="text-danger">Erro a carregar canais.</p>'; }
}

function iniciarChatAluno(turmaId, fId, nomeAluno) {
    const chatContainer = document.getElementById('aluno-chat-messages-container'); chatContainer.innerHTML = '';
    const userNameCortado = nomeAluno.split(' ')[0];
    if(chatUnsubscribeAluno) chatUnsubscribeAluno();
    
    chatUnsubscribeAluno = onSnapshot(query(collection(db, "turmas", turmaId, "foruns", fId, "mensagens"), orderBy("timestamp")), (snapshot) => {
        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data(); const isMe = msg.remetente === userNameCortado; const classe = isMe ? 'admin' : 'student'; // Reusa a classe css 'admin' para as minhas msgs ficarem à direita
            html += `<div class="chat-bubble ${classe}"><strong>${isMe ? 'Tu' : msg.remetente}</strong><br>${msg.texto}<span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>`;
        });
        chatContainer.innerHTML = html; chatContainer.scrollTop = chatContainer.scrollHeight;
    });

    document.getElementById('btn-aluno-send-msg').onclick = async () => {
        const inp = document.getElementById('aluno-input-forum-msg'); const txt = inp.value.trim(); if(!txt) return;
        try { await addDoc(collection(db, "turmas", turmaId, "foruns", fId, "mensagens"), { remetente: userNameCortado, texto: txt, timestamp: Date.now() }); inp.value = ''; } catch(e){}
    };
}
