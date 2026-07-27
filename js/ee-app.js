import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, addDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let myUserId = "";
let myUserName = "";
let educandoId = ""; 
let educandoTurma = "";

// ==========================================
// 1. SEGURANÇA E INICIALIZAÇÃO
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                if(dados.papel !== 'ee') {
                    window.location.href = "index.html"; 
                    return;
                }
                
                myUserName = dados.nome;
                educandoId = dados.educandoId; 
                document.getElementById('header-user-name-ee').innerText = myUserName.split(' ')[0];
                
                carregarDadosEducando();
            }
        } catch (e) { console.error("Erro ao ler perfil", e); }
    } else { 
        window.location.href = "index.html"; 
    }
});

document.getElementById('btn-logout-ee')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

async function carregarDadosEducando() {
    if(!educandoId) {
        document.getElementById('ee-educando-nome').innerText = "Nenhum aluno associado.";
        return;
    }
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", educandoId));
        if (docSnap.exists()) {
            const d = docSnap.data();
            educandoTurma = d.turma;
            document.getElementById('ee-educando-nome').innerText = `${d.nome} (Turma ${d.turma})`;
        }
    } catch(e) {}
}

// ==========================================
// 2. NAVEGAÇÃO DA BARRA INFERIOR E DASHBOARD
// ==========================================
const navItems = document.querySelectorAll('.nav-item');
const views = [
    document.getElementById('ee-dashboard'),
    document.getElementById('view-ee-caderneta'),
    document.getElementById('view-ee-agenda'),
    document.getElementById('view-ee-chat'),
    document.getElementById('view-ee-justificar')
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
        if(targetView) targetView.style.display = 'flex' || 'block'; // Tratar display flex do chat
        
        if(targetId === 'view-ee-chat') { targetView.style.display = 'flex'; }
        else if (targetView) { targetView.style.display = 'block'; }
    });
});

document.getElementById('btn-open-chat-dt')?.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    esconderTodasAsVistas();
    document.getElementById('view-ee-chat').style.display = 'flex';
    iniciarChatEE();
});

document.getElementById('btn-open-justificar')?.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    esconderTodasAsVistas();
    document.getElementById('view-ee-justificar').style.display = 'block';
    carregarAtestadosEE();
});

document.getElementById('btn-voltar-chat-ee')?.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    document.querySelector('.nav-item[data-target="ee-dashboard"]').classList.add('active');
    esconderTodasAsVistas();
    document.getElementById('ee-dashboard').style.display = 'block';
});

document.getElementById('btn-voltar-justificar')?.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    document.querySelector('.nav-item[data-target="ee-dashboard"]').classList.add('active');
    esconderTodasAsVistas();
    document.getElementById('ee-dashboard').style.display = 'block';
});

// ==========================================
// 3. CHAT EE <-> DT
// ==========================================
let chatUnsubscribeEE = null;

function iniciarChatEE() {
    const chatContainer = document.getElementById('ee-chat-messages-container');
    chatContainer.innerHTML = '<p class="text-muted center">A carregar...</p>';
    if(!educandoId) return;

    if(chatUnsubscribeEE) chatUnsubscribeEE();
    
    chatUnsubscribeEE = onSnapshot(query(collection(db, "utilizadores", educandoId, "chatEE"), orderBy("timestamp")), (snapshot) => {
        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.remetente === myUserId;
            const classe = isMe ? 'student' : 'admin'; // Reutilizando classes CSS, 'student' fica à direita
            
            html += `
            <div class="chat-bubble ${classe}">
                <strong>${isMe ? 'Eu' : 'Diretor(a) de Turma'}</strong><br>
                ${msg.texto}
                <span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            </div>`;
        });
        
        if(html === '') {
            html = '<p class="text-muted center" style="margin-top:20px;">Envie uma mensagem para iniciar a conversa.</p>';
        }
        
        chatContainer.innerHTML = html;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

document.getElementById('btn-ee-send-msg')?.addEventListener('click', async () => {
    const inp = document.getElementById('ee-input-chat-msg');
    const txt = inp.value.trim();
    if(!txt || !educandoId) return;
    
    try {
        await addDoc(collection(db, "utilizadores", educandoId, "chatEE"), {
            remetente: myUserId,
            texto: txt,
            timestamp: Date.now()
        });
        inp.value = '';
    } catch(e) {}
});

// ==========================================
// 4. JUSTIFICAR FALTAS (Atestados Médicos)
// ==========================================
let atestadoBase64 = "";

document.getElementById('ee-upload-atestado')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    if(file.size > 716800) { 
        alert("Ficheiro demasiado grande! Tente tirar uma foto com menos resolução."); 
        return; 
    }
    
    document.getElementById('ee-atestado-file-name').innerText = file.name;
    document.getElementById('btn-ee-enviar-atestado').style.display = 'block';

    const reader = new FileReader();
    reader.onload = (ev) => { atestadoBase64 = ev.target.result; };
    reader.readAsDataURL(file);
});

document.getElementById('btn-ee-enviar-atestado')?.addEventListener('click', async (e) => {
    if(!atestadoBase64 || !educandoId) return;
    const obs = document.getElementById('ee-atestado-obs').value.trim();
    
    const btnRef = e.currentTarget;
    btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar...';
    btnRef.disabled = true;

    try {
        await addDoc(collection(db, "utilizadores", educandoId, "atestados"), {
            ficheiroBase64: atestadoBase64,
            observacoes: obs,
            status: "pendente",
            dataEnvio: new Date().toISOString()
        });
        
        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Enviado!';
        setTimeout(() => {
            document.getElementById('ee-atestado-file-name').innerText = "";
            document.getElementById('ee-atestado-obs').value = "";
            atestadoBase64 = "";
            btnRef.style.display = 'none';
            btnRef.disabled = false;
            btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar para Análise';
            carregarAtestadosEE();
        }, 2000);
    } catch(err) {
        btnRef.innerHTML = "Erro ao enviar!";
        setTimeout(() => { btnRef.disabled = false; btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar para Análise'; }, 2000);
    }
});

async function carregarAtestadosEE() {
    const container = document.getElementById('ee-lista-atestados-container');
    container.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar...</p>';
    if(!educandoId) return;

    try {
        const res = await getDocs(query(collection(db, "utilizadores", educandoId, "atestados")));
        if(res.empty) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Nenhum comprovativo enviado.</p>'; return; }
        
        let arr = [];
        res.forEach(d => arr.push(d.data()));
        arr.sort((a,b) => b.dataEnvio.localeCompare(a.dataEnvio)); 

        let html = '';
        arr.forEach(a => {
            let corStatus = 'var(--warning-yellow)';
            let txtStatus = 'Em Análise';
            
            if(a.status === 'aprovado') { corStatus = 'var(--success-green)'; txtStatus = 'Aprovado'; }
            if(a.status === 'rejeitado') { corStatus = 'var(--danger-red)'; txtStatus = 'Rejeitado'; }
            
            const dataF = a.dataEnvio.split('T')[0];
            
            html += `
            <div class="card" style="margin-bottom:10px; border-left: 4px solid ${corStatus}; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>Enviado a ${dataF}</strong><br>
                    <span style="font-size:0.8rem; color:var(--text-muted);">${a.observacoes || 'Sem observações'}</span>
                </div>
                <span style="font-size:0.8rem; font-weight:bold; color:${corStatus};">${txtStatus}</span>
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p class="text-danger center">Erro.</p>'; }
}

// ==========================================
// 5. CADERNETA (Notas, Faltas, PRHFs, Comportamento)
// ==========================================
const tabNotas = document.getElementById('tab-ee-notas');
const tabFaltas = document.getElementById('tab-ee-faltas');
const tabPrhfs = document.getElementById('tab-ee-prhfs');
const tabComportamento = document.getElementById('tab-ee-comportamento');
const cadernetaContent = document.getElementById('ee-caderneta-content');

tabNotas?.addEventListener('click', (e) => { 
    ativarTab(e.currentTarget, ['tab-ee-faltas', 'tab-ee-prhfs', 'tab-ee-comportamento']); 
    carregarNotasEE(); 
});
tabFaltas?.addEventListener('click', (e) => { 
    ativarTab(e.currentTarget, ['tab-ee-notas', 'tab-ee-prhfs', 'tab-ee-comportamento']); 
    carregarFaltasEE(); 
});
tabPrhfs?.addEventListener('click', (e) => { 
    ativarTab(e.currentTarget, ['tab-ee-notas', 'tab-ee-faltas', 'tab-ee-comportamento']); 
    carregarPrhfsEE(); 
});
tabComportamento?.addEventListener('click', (e) => { 
    ativarTab(e.currentTarget, ['tab-ee-notas', 'tab-ee-faltas', 'tab-ee-prhfs']); 
    carregarComportamentoEE(); 
});

document.querySelector('.nav-item[data-target="view-ee-caderneta"]')?.addEventListener('click', () => {
    ativarTab(tabNotas, ['tab-ee-faltas', 'tab-ee-prhfs', 'tab-ee-comportamento']);
    carregarNotasEE();
});

function ativarTab(tabAtiva, tabsInativasIds) {
    if(!tabAtiva) return;
    tabAtiva.classList.add('active');
    tabsInativasIds.forEach(id => document.getElementById(id)?.classList.remove('active'));
    cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar...</p>';
}

async function carregarNotasEE() {
    if(!educandoId) return;
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", educandoId, "notas"));
        if(notasDb.empty) { cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">Sem notas lançadas.</p>'; return; }
        
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
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro.</p>'; }
}

async function carregarFaltasEE() {
    if(!educandoId) return;
    try {
        const faltasDb = await getDocs(collection(db, "utilizadores", educandoId, "faltas"));
        if(faltasDb.empty) { cadernetaContent.innerHTML = '<div style="text-align:center; padding:30px;"><i class="fa-solid fa-check-circle" style="font-size:3rem; color:var(--success-green); margin-bottom:15px;"></i><p class="text-muted">Sem faltas registadas.</p></div>'; return; }
        
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
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro.</p>'; }
}

async function carregarPrhfsEE() {
    if(!educandoId) return;
    try {
        const prhfsDb = await getDocs(collection(db, "utilizadores", educandoId, "prhfs"));
        if(prhfsDb.empty) { cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">Sem PRHFs atribuídos.</p>'; return; }
        
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
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro.</p>'; }
}

async function carregarComportamentoEE() {
    if(!educandoId) return;
    try {
        const res = await getDocs(query(collection(db, "utilizadores", educandoId, "ocorrencias")));
        if(res.empty) { 
            cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">Sem registos disciplinares ou de mérito.</p>'; 
            return; 
        }
        
        let regs = []; 
        res.forEach(d => regs.push(d.data())); 
        regs.sort((a,b) => b.data.localeCompare(a.data)); 
        
        let html = '';
        regs.forEach(r => {
            const cor = r.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)';
            const ic = r.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';
            html += `
            <div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};">
                <div style="display:flex; align-items:center; gap:8px; color:${cor}; margin-bottom:5px;">
                    ${ic} <strong>${r.titulo}</strong>
                </div>
                <span style="font-size:0.75rem; color:var(--text-muted);">Data: ${r.data} | Prof. ${r.autor}</span>
                ${r.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">${r.descricao}</p>` : ''}
            </div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao carregar dados.</p>'; }
}

// ==========================================
// 6. AGENDA (VISUALIZAÇÃO DO EE)
// ==========================================
document.querySelector('.nav-item[data-target="view-ee-agenda"]')?.addEventListener('click', async () => {
    const container = document.getElementById('ee-agenda-content');
    container.innerHTML = '<p class="text-muted center">A carregar calendário escolar...</p>';
    if(!educandoTurma) return;

    try {
        const evDb = await getDocs(collection(db, "turmas", educandoTurma, "eventos"));
        if(evDb.empty) { container.innerHTML = '<p class="text-muted center">Sem eventos agendados.</p>'; return; }
        
        let evArr = [];
        evDb.forEach(d => evArr.push(d.data()));
        
        const hoje = new Date().toISOString().split('T')[0];
        const futuros = evArr.filter(e => e.data >= hoje).sort((a,b) => a.data.localeCompare(b.data));
        
        if(futuros.length === 0) { container.innerHTML = '<p class="text-muted center">Sem eventos futuros.</p>'; return; }

        let html = '';
        futuros.forEach(ev => {
            html += `
            <div class="card" style="margin-bottom:10px; display:flex; gap:15px; align-items:center;">
                <div style="background:var(--bg-dark); padding:10px; border-radius:8px; text-align:center; min-width:60px;">
                    <div style="color:var(--primary-green); font-weight:bold; font-size:1.2rem;">${ev.data.split('-')[2]}</div>
                    <div style="font-size:0.75rem; text-transform:uppercase;">${ev.data.split('-')[1]}</div>
                </div>
                <div>
                    <h4 style="margin:0; font-size:1rem;">${ev.titulo}</h4>
                    <span style="font-size:0.85rem; color:var(--text-muted);"><i class="fa-regular fa-clock"></i> ${ev.hora} | ${ev.tipo.toUpperCase()}</span>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p class="text-danger center">Erro.</p>'; }
});
