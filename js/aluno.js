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

// ==========================================
// 4. AGENDA DO ALUNO (Calendário e Horário)
// ==========================================
export async function carregarAgendaAluno(turmaId) {
    const content = document.getElementById('aluno-agenda-content');
    
    document.getElementById('tab-aluno-eventos').onclick = () => renderEventosAluno(turmaId, content);
    document.getElementById('tab-aluno-horario').onclick = () => renderHorarioAluno(turmaId, content);
    
    // Inicia pela aba de Eventos
    document.querySelectorAll('#view-aluno-agenda .tab-btn').forEach(b => b.classList.remove('active'));
    document.getElementById('tab-aluno-eventos').classList.add('active');
    renderEventosAluno(turmaId, content);
}

async function renderEventosAluno(turmaId, container) {
    container.innerHTML = '<p class="text-muted" style="text-align:center;">A procurar avaliações...</p>';
    try {
        const res = await getDocs(query(collection(db, "turmas", turmaId, "eventos")));
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

async function renderHorarioAluno(turmaId, container) {
    // Reutilizamos a estrutura visual da grelha, mas gerada dinamicamente para o aluno
    container.innerHTML = `
        <div class="card" style="padding: 10px;">
            <p class="text-muted" style="text-align:center; font-size:0.85rem; margin-bottom:10px;">Horário Base da Turma</p>
            <div class="horario-grid" id="grid-horario-aluno">
                <div></div>
                <div class="horario-header">SEG</div><div class="horario-header">TER</div><div class="horario-header">QUA</div><div class="horario-header">QUI</div><div class="horario-header">SEX</div>
            </div>
        </div>`;

    const grid = document.getElementById('grid-horario-aluno');
    const horasLables = ["08:30<br>09:30", "09:35<br>10:35", "10:50<br>11:50", "11:55<br>12:55", "13:00<br>14:00", "14:05<br>15:05", "15:15<br>16:15", "16:20<br>17:20"];
    const horasIds = ["1", "2", "3", "4", "1300", "5", "6", "7"];
    const diasUIAbrv = ['seg', 'ter', 'qua', 'qui', 'sex'];

    try {
        const docSnap = await getDoc(doc(db, "turmas", turmaId));
        let horarioBase = {}; if(docSnap.exists() && docSnap.data().horario) horarioBase = docSnap.data().horario;

        // Construir a grelha de leitura
        for (let i = 0; i < horasIds.length; i++) {
            grid.innerHTML += `<div class="horario-time">${horasLables[i]}</div>`;
            for (let d = 0; d < diasUIAbrv.length; d++) {
                const dia = diasUIAbrv[d];
                const hora = horasIds[i];
                // Procurar se na chave "seg_1" existe algo (como não temos a data real aqui, lemos as chaves genéricas que o admin criou primeiro)
                // Se a chave estiver no formato YYYY-MM-DD_hora, teríamos de usar o motor de data real. Para o horário base (sempre visível), usamos o default.
                
                // Lógica de compatibilidade: procura a disciplina que mais se repete nesta hora/dia ou a versão mais recente
                let disc = "";
                for (const key in horarioBase) {
                    if (key.endsWith(`_${hora}`) && (key.startsWith(dia) || new Date(key.split('_')[0]).getDay() === d+1)) {
                        disc = horarioBase[key];
                    }
                }
                
                if(disc) {
                    grid.innerHTML += `<div class="horario-slot filled" style="cursor:default;"><strong>${disc}</strong></div>`;
                } else {
                    grid.innerHTML += `<div class="horario-slot" style="cursor:default;"></div>`;
                }
            }
        }
    } catch(e) { console.log(e); }
}


// ==========================================
// 5. PASSAPORTE ESCOLAR (FCT/PAP)
// ==========================================
export async function carregarPassaporteAluno(alunoId) {
    // Aqui no futuro vamos ler da base de dados as conquistas e os dados da FCT/PAP do aluno.
    // Por enquanto, atualizamos dinamicamente com os dados do perfil dele.
    
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", alunoId));
        if (docSnap.exists()) {
            const dados = docSnap.data();
            
            // Exemplo de preenchimento dinâmico (caso existam os campos)
            if(dados.fctHoras) {
                // Atualizar a barra de progresso da FCT
            }
            if(dados.papTema) {
                // Atualizar o tema da PAP
            }
        }
    } catch(e) { console.error("Erro ao carregar passaporte", e); }
}
