import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, addDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const matrizCurso = {
    "Sociocultural": { "PORT": {"M1": 27, "M2": 24, "M3": 27}, "ING": {"M1": 24, "M2": 24, "M3": 24}, "AI": {"M1": 30, "M2": 30}, "EF": {"M1": 20, "M2": 20, "M3": 20, "M4": 20, "M5": 20}, "TIC": {"M1": 24, "M2": 24, "M3": 27, "M4": 24} },
    "Científica": { "GEO": {"M1": 27, "M2": 24}, "HCA": {"M1": 24, "M2": 24, "M3": 27}, "MAT": {"M1": 30, "M2": 30, "M3": 30} },
    "Técnica": { "CF": {"M1": 30, "M2": 30, "M3": 30}, "TIAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "TCAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "OTET": {"M1": 25, "M2": 25, "M3": 25, "M4": 25} }
};

let alunoAtualId = "";
let turmaAtual = "";
let myUserName = "";
let chatUnsubscribeAluno = null;

// ==========================================
// 1. SEGURANÇA E INICIALIZAÇÃO
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", userId));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                if(dados.papel !== 'aluno') {
                    // Se não for aluno, atira-o de volta para a porta (o auth.js tratará do resto)
                    window.location.href = "index.html"; 
                    return;
                }
                
                myUserName = dados.nome.split(' ')[0];
                alunoAtualId = userId;
                turmaAtual = dados.turma;
                
                document.getElementById('header-user-name-aluno').innerText = myUserName;
                carregarFotoPerfil();
                carregarDashboardAluno();
            }
        } catch (e) { console.error(e); }
    } else {
        window.location.href = "index.html"; // Redireciona para o login se não tiver sessão
    }
});

document.getElementById('btn-logout-aluno')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

async function carregarFotoPerfil() {
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", alunoAtualId));
        if (docSnap.exists() && docSnap.data().fotoPerfil) { 
            const circulo = document.getElementById('header-avatar-circle');
            circulo.innerHTML = `<img src="${docSnap.data().fotoPerfil}" alt="Avatar">`;
        }
    } catch(e){}
}

// ==========================================
// 2. O ROUTER DO ALUNO (Barra de Navegação)
// ==========================================
function esconderTudoMenos(ecraAtivoId) {
    const ecrans = ['student-dashboard', 'view-study-mode', 'view-aluno-caderneta', 'view-aluno-agenda', 'view-aluno-forum', 'view-aluno-passaporte'];
    ecrans.forEach(id => {
        const el = document.getElementById(id);
        if(el) el.style.display = 'none';
    });
    const ativo = document.getElementById(ecraAtivoId);
    if(ativo) ativo.style.display = 'block';
}

document.querySelectorAll('.bottom-nav .nav-item').forEach(link => {
    link.addEventListener('click', (e) => {
        e.preventDefault();
        document.querySelectorAll('.bottom-nav .nav-item').forEach(l => l.classList.remove('active'));
        e.currentTarget.classList.add('active');
        
        const targetId = e.currentTarget.getAttribute('data-target');
        esconderTudoMenos(targetId);

        if (targetId === 'student-dashboard') carregarDashboardAluno();
        else if (targetId === 'view-aluno-caderneta') carregarCadernetaAluno();
        else if (targetId === 'view-aluno-agenda') carregarAgendaAluno();
        else if (targetId === 'view-aluno-forum') carregarForunsAluno();
        else if (targetId === 'view-aluno-passaporte') carregarPassaporteAluno();
    });
});

document.getElementById('btn-abrir-passaporte')?.addEventListener('click', () => {
    document.querySelectorAll('.bottom-nav .nav-item').forEach(l => l.classList.remove('active'));
    document.querySelector('.bottom-nav .nav-item[data-target="view-aluno-passaporte"]')?.classList.add('active');
    esconderTudoMenos('view-aluno-passaporte');
    carregarPassaporteAluno();
});

// Acesso Rápido no Dashboard
document.getElementById('btn-open-study-mode')?.addEventListener('click', () => esconderTudoMenos('view-study-mode'));

// ==========================================
// 3. LÓGICA DO DASHBOARD (O Meu Dia)
// ==========================================
async function carregarDashboardAluno() {
    // Animação do Check-in
    const checkinBox = document.getElementById('student-checkin-box');
    checkinBox.innerHTML = `<h3>Como te sentes hoje?</h3><div class="emoji-row"><button class="emoji-btn sad" data-val="triste">😔</button><button class="emoji-btn neutral" data-val="neutro">😐</button><button class="emoji-btn happy" data-val="feliz">😊</button></div>`;
    checkinBox.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const val = e.currentTarget.getAttribute('data-val');
            checkinBox.style.opacity = '0';
            setTimeout(() => {
                checkinBox.style.opacity = '1';
                if (val === 'triste') checkinBox.innerHTML = `<h3 style="color:var(--danger-red); margin-bottom:10px;">Lamentamos ouvir isso. 😔</h3><p style="font-size:0.85rem; color:var(--text-muted);">Lembra-te que o teu Diretor de Turma está sempre disponível para te ouvir.</p>`;
                else checkinBox.innerHTML = `<h3 style="color:var(--success-green); margin-bottom:10px;">Que bom! ✨</h3><p style="font-size:0.85rem; color:var(--text-muted);">Aproveita o dia e mantém o foco nos teus objetivos.</p>`;
            }, 300);
        });
    });

    // Eventos Futuros
    try {
        const hoje = new Date().toISOString().split('T')[0];
        const resEvts = await getDocs(query(collection(db, "turmas", turmaAtual, "eventos")));
        let futuros = []; resEvts.forEach(d => { const ev = d.data(); if (ev.data >= hoje) futuros.push(ev); });
        futuros.sort((a,b) => a.data.localeCompare(b.data));
        const elEvento = document.getElementById('aluno-proximo-evento');
        if(futuros.length > 0) {
            const dp = futuros[0].data.split('-'); elEvento.innerText = `${dp[2]}/${dp[1]} - ${futuros[0].disciplina || futuros[0].titulo}`; elEvento.style.color = "var(--warning-yellow)";
        } else { elEvento.innerText = "Livre de avaliações!"; elEvento.style.color = "var(--success-green)"; }
    } catch(e) {}

    // PRHFs Pendentes
    try {
        const resPrhf = await getDocs(query(collection(db, "utilizadores", alunoAtualId, "prhfs")));
        let ativos = 0; resPrhf.forEach(d => { if(d.data().status === 'ativa') ativos++; });
        const elPrhf = document.getElementById('aluno-prhf-count');
        elPrhf.innerText = `${ativos} Plano(s)`; elPrhf.style.color = ativos > 0 ? "var(--danger-red)" : "var(--success-green)";
    } catch(e) {}
}

// ==========================================
// 4. MODO DE ESTUDO (POMODORO)
// ==========================================
let studyTimer; let tempoRestante = 25 * 60; 
const elText = document.getElementById('study-timer-text'); const elCircle = document.getElementById('study-timer-circle');

document.getElementById('btn-voltar-study')?.addEventListener('click', () => esconderTudoMenos('student-dashboard'));

document.getElementById('btn-start-study')?.addEventListener('click', (e) => {
    e.currentTarget.style.display = 'none'; document.getElementById('btn-stop-study').style.display = 'block'; elCircle.classList.add('active');
    studyTimer = setInterval(() => {
        tempoRestante--; const m = Math.floor(tempoRestante / 60); const s = tempoRestante % 60;
        elText.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if(tempoRestante <= 0) {
            clearInterval(studyTimer); elCircle.classList.remove('active'); elText.innerText = "00:00";
            alert("Foco concluído! +50 XP!");
            document.getElementById('btn-stop-study').style.display = 'none'; document.getElementById('btn-start-study').style.display = 'block'; tempoRestante = 25 * 60;
        }
    }, 1000);
});
document.getElementById('btn-stop-study')?.addEventListener('click', (e) => {
    if(confirm("Desistir da sessão de foco?")) {
        clearInterval(studyTimer); e.currentTarget.style.display = 'none'; document.getElementById('btn-start-study').style.display = 'block';
        elCircle.classList.remove('active'); tempoRestante = 25 * 60; elText.innerText = "25:00";
    }
});

// ==========================================
// 5. A CADERNETA DO ALUNO
// ==========================================
export async function carregarCadernetaAluno() {
    const content = document.getElementById('aluno-caderneta-content');
    
    document.getElementById('tab-aluno-notas').onclick = () => renderPautaGlobal(content);
    document.getElementById('tab-aluno-faltas').onclick = () => renderFaltasAluno(content);
    document.getElementById('tab-aluno-prhfs').onclick = () => renderPrhfAluno(content);
    
    document.querySelectorAll('#view-aluno-caderneta .tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-aluno-notas').classList.add('active');
    renderPautaGlobal(content);
}

async function renderPautaGlobal(container) {
    document.querySelectorAll('#view-aluno-caderneta .tab-btn').forEach(b => b.classList.remove('active')); document.getElementById('tab-aluno-notas').classList.add('active');
    container.innerHTML = '<p class="text-muted" style="text-align:center;">A compilar pauta...</p>';
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", alunoAtualId, "notas")); const mapNotas = {}; notasDb.forEach(d => { mapNotas[`${d.data().disciplina}_${d.data().modulo}`] = d.data().nota; });
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

async function renderFaltasAluno(container) {
    document.querySelectorAll('#view-aluno-caderneta .tab-btn').forEach(b => b.classList.remove('active')); document.getElementById('tab-aluno-faltas').classList.add('active');
    container.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar faltas...</p>';
    try {
        const res = await getDocs(query(collection(db, "utilizadores", alunoAtualId, "faltas")));
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

async function renderPrhfAluno(container) {
    document.querySelectorAll('#view-aluno-caderneta .tab-btn').forEach(b => b.classList.remove('active')); document.getElementById('tab-aluno-prhfs').classList.add('active');
    container.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar planos...</p>';
    try {
        const res = await getDocs(query(collection(db, "utilizadores", alunoAtualId, "prhfs")));
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
// 6. AGENDA E HORÁRIO (Leitura)
// ==========================================
export async function carregarAgendaAluno() {
    const content = document.getElementById('aluno-agenda-content');
    document.getElementById('tab-aluno-eventos').onclick = () => renderEventosAluno(content);
    document.getElementById('tab-aluno-horario').onclick = () => renderHorarioAluno(content);
    
    document.querySelectorAll('#view-aluno-agenda .tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-aluno-eventos').classList.add('active');
    renderEventosAluno(content);
}

async function renderEventosAluno(container) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;">A procurar avaliações...</p>';
    try {
        const res = await getDocs(query(collection(db, "turmas", turmaAtual, "eventos")));
        if(res.empty) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Não tens avaliações ou eventos agendados.</p>'; return; }

        let evs = []; res.forEach(d => evs.push(d.data()));
        const hoje = new Date().toISOString().split('T')[0];
        const futuros = evs.filter(e => e.data >= hoje).sort((a,b) => a.data.localeCompare(b.data));
        if(futuros.length === 0) { container.innerHTML = '<p class="text-muted" style="text-align:center;">A tua agenda está limpa! 😎</p>'; return; }

        let html = ''; const mesArr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        futuros.forEach(ev => {
            let classeCard = "outro"; let badgeClass = "outro"; let badgeTexto = "OUTRO EVENTO";
            if(ev.tipo === 'teste') { classeCard = "teste"; badgeClass = "teste"; badgeTexto = "TESTE / FREQUÊNCIA"; } 
            else if (ev.tipo === 'avaliacao') { classeCard = "avaliacao"; badgeClass = "avaliacao"; badgeTexto = "AVALIAÇÃO / TRABALHO"; }
            
            const dp = ev.data.split('-'); const mesStr = mesArr[parseInt(dp[1])-1]; const diaStr = dp[2];
            const pDisc = ev.disciplina ? `<p><i class="fa-solid fa-book"></i> ${ev.disciplina} | ${ev.hora || '09:00'}</p>` : `<p><i class="fa-regular fa-clock"></i> ${ev.hora || '09:00'}</p>`;
            
            html += `<div class="calendar-event-card ${classeCard}"><div class="calendar-date-box"><span class="day">${diaStr}</span><span class="month">${mesStr}</span></div><div class="calendar-info"><span class="badge-tipo-evento ${badgeClass}">${badgeTexto}</span><h4>${ev.titulo}</h4>${pDisc}</div></div>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p class="text-danger">Erro ao carregar calendário.</p>'; }
}

async function renderHorarioAluno(container) {
    container.innerHTML = `<div class="card" style="padding: 10px;"><p class="text-muted" style="text-align:center; font-size:0.85rem; margin-bottom:10px;">Horário Base da Turma</p><div class="horario-grid" id="grid-horario-aluno"><div></div><div class="horario-header">SEG</div><div class="horario-header">TER</div><div class="horario-header">QUA</div><div class="horario-header">QUI</div><div class="horario-header">SEX</div></div></div>`;
    const grid = document.getElementById('grid-horario-aluno');
    const horasLables = ["08:30<br>09:30", "09:35<br>10:35", "10:50<br>11:50", "11:55<br>12:55", "13:00<br>14:00", "14:05<br>15:05", "15:15<br>16:15", "16:20<br>17:20"];
    const horasIds = ["1", "2", "3", "4", "1300", "5", "6", "7"];
    const diasUIAbrv = ['seg', 'ter', 'qua', 'qui', 'sex'];

    try {
        const docSnap = await getDoc(doc(db, "turmas", turmaAtual));
        let horarioBase = {}; if(docSnap.exists() && docSnap.data().horario) horarioBase = docSnap.data().horario;

        for (let i = 0; i < horasIds.length; i++) {
            grid.innerHTML += `<div class="horario-time">${horasLables[i]}</div>`;
            for (let d = 0; d < diasUIAbrv.length; d++) {
                const dia = diasUIAbrv[d]; const hora = horasIds[i];
                let disc = "";
                for (const key in horarioBase) { if (key.endsWith(`_${hora}`) && (key.startsWith(dia) || new Date(key.split('_')[0]).getDay() === d+1)) { disc = horarioBase[key]; } }
                if(disc) grid.innerHTML += `<div class="horario-slot filled" style="cursor:default;"><strong>${disc}</strong></div>`;
                else grid.innerHTML += `<div class="horario-slot" style="cursor:default;"></div>`;
            }
        }
    } catch(e) {}
}

// ==========================================
// 7. FÓRUM DO ALUNO
// ==========================================
export async function carregarForunsAluno() {
    const listContainer = document.getElementById('aluno-forum-channel-list');
    listContainer.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar os teus canais...</p>';
    try {
        const q = query(collection(db, "turmas", turmaAtual, "foruns"), where("membros", "array-contains", alunoAtualId));
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
            iniciarChatAluno(fId);
        }));

        document.getElementById('btn-aluno-voltar-canais').onclick = () => {
            if(chatUnsubscribeAluno) chatUnsubscribeAluno();
            document.getElementById('aluno-forum-chat-view').style.display = 'none'; document.getElementById('aluno-forum-channel-list').style.display = 'block';
        };
    } catch(err) { listContainer.innerHTML = '<p class="text-danger">Erro a carregar canais.</p>'; }
}

function iniciarChatAluno(fId) {
    const chatContainer = document.getElementById('aluno-chat-messages-container'); chatContainer.innerHTML = '';
    if(chatUnsubscribeAluno) chatUnsubscribeAluno();
    
    chatUnsubscribeAluno = onSnapshot(query(collection(db, "turmas", turmaAtual, "foruns", fId, "mensagens"), orderBy("timestamp")), (snapshot) => {
        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data(); const isMe = msg.remetente === myUserName; const classe = isMe ? 'admin' : 'student'; 
            html += `<div class="chat-bubble ${classe}"><strong>${isMe ? 'Tu' : msg.remetente}</strong><br>${msg.texto}<span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>`;
        });
        chatContainer.innerHTML = html; chatContainer.scrollTop = chatContainer.scrollHeight;
    });

    document.getElementById('btn-aluno-send-msg').onclick = async () => {
        const inp = document.getElementById('aluno-input-forum-msg'); const txt = inp.value.trim(); if(!txt) return;
        try { await addDoc(collection(db, "turmas", turmaAtual, "foruns", fId, "mensagens"), { remetente: myUserName, texto: txt, timestamp: Date.now() }); inp.value = ''; } catch(e){}
    };
}

// ==========================================
// 8. PASSAPORTE ESCOLAR (FCT/PAP)
// ==========================================
export async function carregarPassaporteAluno() {
    // Leitura estática para já. Futuramente cruzamos dados do utilizador
    document.getElementById('btn-voltar-passaporte')?.addEventListener('click', () => {
        document.querySelectorAll('.bottom-nav .nav-item').forEach(l => l.classList.remove('active'));
        document.querySelector('.bottom-nav .nav-item[data-target="student-dashboard"]')?.classList.add('active');
        esconderTudoMenos('student-dashboard');
    });
}
