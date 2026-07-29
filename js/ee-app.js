import { auth, db, messaging, VAPID_KEY, getToken, onMessage } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, addDoc, onSnapshot, orderBy, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let myUserId = "";
let myUserName = "";
let educandosArray = []; // Lista de IDs dos filhos
let educandoAtualId = ""; // O filho selecionado no momento
let turmaAtual = "";

// ==========================================
// 1. SEGURANÇA, INICIALIZAÇÃO E MÚLTIPLOS EDUCANDOS
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
                
                // Preparar dados do Pai/Mãe
                myUserName = dados.nome;
                
                // Suporte para 1 ou Múltiplos filhos!
                if(dados.educandos && Array.isArray(dados.educandos)) {
                    educandosArray = dados.educandos;
                } else if (dados.educandoId) {
                    educandosArray = [dados.educandoId]; // Retrocompatibilidade
                }

                if(educandosArray.length > 0) {
                    await construirSeletorEducandos();
                } else {
                    document.getElementById('header-ee-student-selector').innerHTML = '<option>Sem educandos associados.</option>';
                }
            }
        } catch (e) { console.error("Erro ao ler perfil", e); }
    } else { 
        window.location.href = "index.html"; 
    }
});

async function construirSeletorEducandos() {
    const selector = document.getElementById('header-ee-student-selector');
    selector.innerHTML = '';
    
    for (let id of educandosArray) {
        try {
            const snap = await getDoc(doc(db, "utilizadores", id));
            if (snap.exists()) {
                const opt = document.createElement('option');
                opt.value = id;
                // Ex: "👧 Maria (10T)"
                opt.text = `👩‍🎓 ${snap.data().nome.split(' ')[0]} (${snap.data().turma})`;
                selector.appendChild(opt);
            }
        } catch(e) {}
    }
    
    // Iniciar com o primeiro filho da lista
    educandoAtualId = selector.value;
    carregarDadosDoFilhoSelecionado();

    // Quando o EE muda de filho na dropdown:
    selector.addEventListener('change', (e) => {
        educandoAtualId = e.target.value;
        carregarDadosDoFilhoSelecionado(); // Refaz a magia toda!
    });
}

document.getElementById('btn-logout-ee')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

async function carregarDadosDoFilhoSelecionado() {
    if(!educandoAtualId) return;
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", educandoAtualId));
        if (docSnap.exists()) {
            turmaAtual = docSnap.data().turma;
            // Disparar cálculos para o Dashboard e Vistas
            carregarResumoDashboard();
            // Se estiver numa aba específica, recarregamos também
            const abaAtiva = document.querySelector('.bottom-nav .nav-item.active').getAttribute('data-target');
            if(abaAtiva === 'view-ee-caderneta') ativarTabCadernetaAtual();
            if(abaAtiva === 'view-ee-agenda') carregarAgendaEE();
            if(abaAtiva === 'view-ee-horario') carregarHorarioEE();
        }
    } catch(e) {}
}

// ==========================================
// 2. O CÉREBRO DO DASHBOARD PROATIVO
// ==========================================
async function carregarResumoDashboard() {
    let somaNotas = 0; let countNotas = 0;
    let faltasEstaSemana = 0;
    let numOcorrencias = 0;
    let numPrhfs = 0;

    // A. Calcular Média
    try {
        const notasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "notas"));
        notasSnap.forEach(d => {
            const n = d.data().nota;
            if(n !== 'REP' && !isNaN(n)) { somaNotas += Number(n); countNotas++; }
        });
        document.getElementById('resumo-media').innerText = countNotas > 0 ? (somaNotas/countNotas).toFixed(1) : '-';
        document.getElementById('resumo-media').style.color = (countNotas > 0 && (somaNotas/countNotas) < 10) ? 'var(--danger-red)' : 'white';
    } catch(e) {}

    // B. Calcular Faltas (apenas da última semana)
    try {
        const hj = new Date();
        const umaSemanaAtras = new Date(hj.getTime() - (7 * 24 * 60 * 60 * 1000)).toISOString().split('T')[0];
        
        const faltasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        faltasSnap.forEach(d => {
            if(d.data().dataInicio >= umaSemanaAtras) { faltasEstaSemana += d.data().horas; }
        });
        document.getElementById('resumo-faltas').innerText = `${faltasEstaSemana}h`;
        document.getElementById('resumo-faltas').style.color = faltasEstaSemana > 0 ? 'var(--danger-red)' : 'white';
    } catch(e) {}

    // C. Ocorrências / Disciplina
    try {
        const ocSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "ocorrencias"));
        numOcorrencias = ocSnap.size;
        document.getElementById('resumo-ocorrencias').innerText = numOcorrencias;
    } catch(e) {}

    // D. Próximo Evento / Avaliação
    try {
        const evSnap = await getDocs(collection(db, "turmas", turmaAtual, "eventos"));
        const hojeIso = new Date().toISOString().split('T')[0];
        let futuros = [];
        evSnap.forEach(d => { if(d.data().data >= hojeIso) futuros.push(d.data()); });
        futuros.sort((a,b) => a.data.localeCompare(b.data));
        
        if(futuros.length > 0) {
            const ev = futuros[0];
            const dia = ev.data.split('-')[2]; const mes = ev.data.split('-')[1];
            document.getElementById('resumo-proximo-evento').innerHTML = `<strong>${dia}/${mes}</strong><br><span style="font-size:0.75rem; font-weight:normal; color:var(--text-muted);">${ev.titulo}</span>`;
        } else {
            document.getElementById('resumo-proximo-evento').innerText = "Nenhum agendado";
        }
    } catch(e) {}
    
    // E. Mensagens
    document.getElementById('resumo-mensagens').innerHTML = `<i class="fa-solid fa-arrow-right"></i> Ver Caixa`;
    document.getElementById('resumo-proxima-aula').innerText = "Consultar Horário";
}

// ==========================================
// 3. NAVEGAÇÃO DA BARRA INFERIOR
// ==========================================
const navItems = document.querySelectorAll('.nav-item');
const views = [
    document.getElementById('ee-dashboard'),
    document.getElementById('view-ee-caderneta'),
    document.getElementById('view-ee-agenda'),
    document.getElementById('view-ee-horario'),
    document.getElementById('view-ee-chat'),
    document.getElementById('view-ee-justificar'),
    document.getElementById('view-ee-notificacoes')
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
        
        if(targetId === 'view-ee-chat') { targetView.style.display = 'flex'; }
        else if (targetView) { targetView.style.display = 'block'; }

        // Ações locais ao mudar de tab
        if(targetId === 'view-ee-caderneta') ativarTabCadernetaAtual();
        if(targetId === 'view-ee-agenda') carregarAgendaEE();
        if(targetId === 'view-ee-horario') carregarHorarioEE();
    });
});

// Ações Rápidas do Dashboard
document.getElementById('btn-quick-mensagem')?.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    esconderTodasAsVistas();
    document.getElementById('view-ee-chat').style.display = 'flex';
    iniciarChatEE();
});

document.getElementById('btn-quick-justificar')?.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    esconderTodasAsVistas();
    document.getElementById('view-ee-justificar').style.display = 'block';
    carregarAtestadosEE();
});

// Botões de Voltar Genéricos
document.querySelectorAll('#btn-voltar-chat-ee, #btn-voltar-justificar, #btn-voltar-notificacoes').forEach(btn => {
    btn?.addEventListener('click', () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        document.querySelector('.nav-item[data-target="ee-dashboard"]').classList.add('active');
        esconderTodasAsVistas();
        document.getElementById('ee-dashboard').style.display = 'block';
    });
});

document.getElementById('btn-open-notificacoes')?.addEventListener('click', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    esconderTodasAsVistas();
    document.getElementById('view-ee-notificacoes').style.display = 'block';
    // Aqui no futuro podes carregar um array de notificações
    document.getElementById('ee-notificacoes-container').innerHTML = '<p class="text-muted center">A central de notificações está ativa. Os alertas aparecerão aqui.</p>';
});

// ==========================================
// 4. CADERNETA E LINHA TEMPORAL (TIMELINE)
// ==========================================
const tabTimeline = document.getElementById('tab-ee-timeline');
const tabNotas = document.getElementById('tab-ee-notas');
const tabFaltas = document.getElementById('tab-ee-faltas');
const tabPrhfs = document.getElementById('tab-ee-prhfs');
const tabComportamento = document.getElementById('tab-ee-comportamento');
const cadernetaContent = document.getElementById('ee-caderneta-content');

let currentCadernetaTab = tabTimeline;

function ativarTabCadernetaAtual() {
    if(currentCadernetaTab) currentCadernetaTab.click();
}

function switchTabConfig(tabClicada, tabsParaDesativar) {
    currentCadernetaTab = tabClicada;
    tabClicada.classList.add('active');
    tabsParaDesativar.forEach(t => t.classList.remove('active'));
    cadernetaContent.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>';
}

tabTimeline?.addEventListener('click', (e) => { 
    switchTabConfig(e.currentTarget, [tabNotas, tabFaltas, tabPrhfs, tabComportamento]); 
    carregarTimelineEE(); 
});
tabNotas?.addEventListener('click', (e) => { 
    switchTabConfig(e.currentTarget, [tabTimeline, tabFaltas, tabPrhfs, tabComportamento]); 
    carregarNotasEE(); 
});
tabFaltas?.addEventListener('click', (e) => { 
    switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabPrhfs, tabComportamento]); 
    carregarFaltasEE(); 
});
tabPrhfs?.addEventListener('click', (e) => { 
    switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabFaltas, tabComportamento]); 
    carregarPrhfsEE(); 
});
tabComportamento?.addEventListener('click', (e) => { 
    switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabFaltas, tabPrhfs]); 
    carregarComportamentoEE(); 
});

// MAGIA: LINHA TEMPORAL
async function carregarTimelineEE() {
    if(!educandoAtualId) return;
    try {
        let eventos = [];
        
        // Buscar Notas
        const notasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "notas"));
        notasSnap.forEach(d => {
            const n = d.data();
            eventos.push({
                time: new Date(n.data).getTime(), dateStr: n.data,
                icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)',
                titulo: 'Nova Avaliação Lançada',
                desc: `${n.disciplina} (Mod. ${n.modulo}): <strong>${n.nota}</strong>`
            });
        });

        // Buscar Faltas
        const faltasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        faltasSnap.forEach(d => {
            const f = d.data();
            const corF = f.justificada ? 'var(--success-green)' : 'var(--danger-red)';
            const txtF = f.justificada ? '(Justificada)' : '';
            eventos.push({
                time: new Date(f.criadoEm || f.dataInicio).getTime(), dateStr: f.dataInicio,
                icon: '<i class="fa-solid fa-user-xmark"></i>', cor: corF,
                titulo: `Falta de ${f.horas}h a ${f.disciplina} ${txtF}`,
                desc: `Registada no sistema.`
            });
        });

        // Buscar Ocorrências
        const ocSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "ocorrencias"));
        ocSnap.forEach(d => {
            const o = d.data();
            const corO = o.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)';
            const icO = o.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';
            eventos.push({
                time: o.timestamp, dateStr: o.data,
                icon: icO, cor: corO,
                titulo: `Registo de Comportamento (${o.tipo.toUpperCase()})`,
                desc: `<strong>${o.titulo}</strong><br><span style="font-size:0.8rem; color:#aaa;">${o.descricao || ''}</span>`
            });
        });

        // Ordenar do mais recente para o mais antigo
        eventos.sort((a,b) => b.time - a.time);

        if(eventos.length === 0) {
            cadernetaContent.innerHTML = '<p class="text-muted center" style="margin-top:40px;"><i class="fa-solid fa-wind" style="font-size:2rem; margin-bottom:15px; display:block;"></i>Tudo calmo por aqui. Ainda não há histórico.</p>';
            return;
        }

        let html = '<div class="timeline">';
        eventos.forEach(ev => {
            const dtRelativa = new Date(ev.time).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' });
            html += `
            <div class="timeline-item">
                <div class="timeline-icon" style="color: ${ev.cor}; border-color: ${ev.cor};">${ev.icon}</div>
                <div class="timeline-content" style="border-left: 3px solid ${ev.cor};">
                    <span class="timeline-date">${dtRelativa}</span>
                    <strong style="color:white; display:block; margin-bottom:5px;">${ev.titulo}</strong>
                    <p style="font-size:0.85rem; color:var(--text-light); margin:0;">${ev.desc}</p>
                </div>
            </div>`;
        });
        html += '</div>';
        cadernetaContent.innerHTML = html;

    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro a gerar cronologia.</p>'; }
}

async function carregarNotasEE() {
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", educandoAtualId, "notas"));
        if(notasDb.empty) { cadernetaContent.innerHTML = '<p class="text-muted center">Sem notas lançadas.</p>'; return; }
        let html = '<div class="stats-grid" style="grid-template-columns: 1fr;">';
        notasDb.forEach(d => {
            const nota = d.data();
            const cor = (nota.nota === 'REP' || Number(nota.nota) < 10) ? 'var(--danger-red)' : 'var(--success-green)';
            html += `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left: 4px solid ${cor};"><div><strong>${nota.disciplina}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">Módulo ${nota.modulo}</span></div><div style="font-size:1.4rem; font-weight:bold; color:${cor};">${nota.nota}</div></div>`;
        });
        cadernetaContent.innerHTML = html + '</div>';
    } catch(e) {}
}

async function carregarFaltasEE() {
    try {
        const faltasDb = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        if(faltasDb.empty) { cadernetaContent.innerHTML = '<div style="text-align:center; padding:30px;"><i class="fa-solid fa-check-circle" style="font-size:3rem; color:var(--success-green); margin-bottom:15px;"></i><p class="text-muted">Sem faltas registadas.</p></div>'; return; }
        let faltasArr = []; faltasDb.forEach(d => { faltasArr.push(d.data()); }); faltasArr.sort((a,b) => b.dataInicio.localeCompare(a.dataInicio)); 
        let html = '';
        faltasArr.forEach(f => {
            const statusColor = f.justificada ? 'var(--success-green)' : 'var(--danger-red)';
            const statusTxt = f.justificada ? 'Justificada' : (f.comprovativoEnviado ? 'Em Análise (DT)' : 'Injustificada');
            html += `<div class="card" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;"><div><strong>${f.disciplina}</strong> (${f.horas}h)<br><span style="font-size:0.8rem; color:var(--text-muted);">${f.dataInicio}</span></div><span style="font-size:0.8rem; font-weight:bold; color:${statusColor}; padding:5px 10px; background:rgba(255,255,255,0.05); border-radius:12px;">${statusTxt}</span></div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

async function carregarPrhfsEE() {
    try {
        const prhfsDb = await getDocs(collection(db, "utilizadores", educandoAtualId, "prhfs"));
        if(prhfsDb.empty) { cadernetaContent.innerHTML = '<p class="text-muted center">Sem PRHFs atribuídos.</p>'; return; }
        let html = '';
        prhfsDb.forEach(d => {
            const p = d.data(); const cor = p.status === 'concluida' ? 'var(--success-green)' : 'var(--warning-yellow)';
            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${p.disciplina} (Mod. ${p.modulo})</strong><span style="color:${cor}; font-size:0.85rem; font-weight:bold;">${p.status.toUpperCase()}</span></div><p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">${p.descricao}</p><div style="font-size:0.8rem;">Data Limite: <strong>${p.prazo}</strong> | Presenciais: <strong>${p.horasPresenciais}h</strong></div></div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

async function carregarComportamentoEE() {
    try {
        const res = await getDocs(query(collection(db, "utilizadores", educandoAtualId, "ocorrencias")));
        if(res.empty) { cadernetaContent.innerHTML = '<p class="text-muted center">Sem registos disciplinares.</p>'; return; }
        let regs = []; res.forEach(d => regs.push(d.data())); regs.sort((a,b) => b.data.localeCompare(a.data)); 
        let html = '';
        regs.forEach(r => {
            const cor = r.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)';
            const ic = r.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';
            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; align-items:center; gap:8px; color:${cor}; margin-bottom:5px;">${ic} <strong>${r.titulo}</strong></div><span style="font-size:0.75rem; color:var(--text-muted);">Data: ${r.data} | Prof. ${r.autor}</span>${r.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">${r.descricao}</p>` : ''}</div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}


// ==========================================
// 5. AGENDA E HORÁRIO (MENUS SEPARADOS E FILTROS)
// ==========================================
document.getElementById('filtro-agenda-testes')?.addEventListener('change', carregarAgendaEE);
document.getElementById('filtro-agenda-outros')?.addEventListener('change', carregarAgendaEE);

async function carregarAgendaEE() {
    const subContainer = document.getElementById('ee-agenda-content');
    subContainer.innerHTML = '<p class="text-muted center">A carregar calendário...</p>';
    if(!turmaAtual) return;

    const mostraTestes = document.getElementById('filtro-agenda-testes').checked;
    const mostraOutros = document.getElementById('filtro-agenda-outros').checked;

    try {
        const evDb = await getDocs(collection(db, "turmas", turmaAtual, "eventos"));
        if(evDb.empty) { subContainer.innerHTML = '<p class="text-muted center">Sem eventos agendados pela escola.</p>'; return; }
        
        let eventosFormatados = [];
        evDb.forEach(d => { 
            const e = d.data();
            let inc = false;
            let bgC = '#b82bf2'; // roxo para outros

            if(e.tipo === 'teste' || e.tipo === 'avaliacao') {
                if(mostraTestes) { inc = true; bgC = '#ffaa00'; } // amarelo/laranja
            } else {
                if(mostraOutros) { inc = true; }
            }

            if(inc) {
                eventosFormatados.push({
                    title: e.titulo,
                    start: e.data,
                    backgroundColor: bgC,
                    borderColor: bgC
                });
            }
        });
        
        subContainer.innerHTML = "";
        let calendar = new FullCalendar.Calendar(subContainer, {
            initialView: 'dayGridMonth', locale: 'pt', events: eventosFormatados,
            headerToolbar: { left: 'prev,next', center: 'title', right: 'today' }, height: 'auto'
        });
        calendar.render();
    } catch(e) {}
}

// HORÁRIO
let eeHorarioWeekOffset = 0;
document.getElementById('btn-ee-prev-week')?.addEventListener('click', () => { eeHorarioWeekOffset--; carregarHorarioEE(); });
document.getElementById('btn-ee-next-week')?.addEventListener('click', () => { eeHorarioWeekOffset++; carregarHorarioEE(); });

async function carregarHorarioEE() {
    const subContainer = document.getElementById('ee-horario-content');
    subContainer.innerHTML = '<p class="text-muted center">A carregar horário...</p>';
    if(!turmaAtual) return;

    try {
        const docSnap = await getDoc(doc(db, "turmas", turmaAtual));
        let horarioBase = {}; 
        if(docSnap.exists() && docSnap.data().horario) horarioBase = docSnap.data().horario;
        
        let html = '<div class="card" style="padding: 10px;">';
        let temAulas = false;
        
        const diasMap = { 'seg': 'Segunda', 'ter': 'Terça', 'qua': 'Quarta', 'qui': 'Quinta', 'sex': 'Sexta' };
        const blocosTempo = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' };
        
        let targetDate = new Date(); 
        targetDate.setDate(targetDate.getDate() + (eeHorarioWeekOffset * 7));
        // Recuar para a Segunda-feira dessa semana
        targetDate.setDate(targetDate.getDate() - (targetDate.getDay() === 0 ? 6 : targetDate.getDay() - 1));
        
        let endOfWeek = new Date(targetDate); endOfWeek.setDate(endOfWeek.getDate() + 4);
        
        const fDt = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;
        document.getElementById('ee-week-display').innerText = `${fDt(targetDate)} a ${fDt(endOfWeek)}`;
        
        let currDate = new Date(targetDate);
        for(let i=0; i<5; i++) {
            const dataStr = `${currDate.getFullYear()}-${String(currDate.getMonth()+1).padStart(2,'0')}-${String(currDate.getDate()).padStart(2,'0')}`;
            let diaHtml = '';
            Object.keys(blocosTempo).forEach(bId => {
                const disc = horarioBase[`${dataStr}_${bId}`];
                if(disc) {
                    diaHtml += `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #333; padding:10px 5px; align-items:center;">
                        <span style="color:var(--text-muted); font-size: 0.9rem; font-family: monospace;">${blocosTempo[bId]}</span>
                        <strong style="color:white; font-size: 1.05rem;">${disc}</strong>
                    </div>`;
                    temAulas = true;
                }
            });
            
            if(diaHtml !== '') {
                html += `<div style="margin-bottom:20px;">
                            <h5 style="color:var(--primary-green); margin-bottom:5px; padding-bottom:5px; border-bottom: 2px solid var(--primary-green);">${diasMap[Object.keys(diasMap)[i]]} (${fDt(currDate)})</h5>
                            ${diaHtml}
                         </div>`;
            }
            currDate.setDate(currDate.getDate() + 1);
        }
        
        html += '</div>';
        subContainer.innerHTML = temAulas ? html : '<p class="text-muted center" style="margin-top:30px;">O DT ainda não registou aulas para esta semana.</p>';
    } catch(e) {}
}

// ==========================================
// 6. CHAT E JUSTIFICAÇÕES (COM ETIQUETAS PREMIUM)
// ==========================================
let chatUnsubscribeEE = null;

function iniciarChatEE() {
    const chatContainer = document.getElementById('ee-chat-messages-container');
    chatContainer.innerHTML = '<p class="text-muted center">A sincronizar...</p>';
    if(!educandoAtualId) return;

    if(chatUnsubscribeEE) chatUnsubscribeEE();
    
    // Ler do nó unificado "chat_dt"
    chatUnsubscribeEE = onSnapshot(query(collection(db, "utilizadores", educandoAtualId, "chat_dt"), orderBy("timestamp")), (snapshot) => {
        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.remetente === myUserName || msg.autor === 'ee';
            const classe = isMe ? 'admin' : 'student'; // Admin fica à direita (verde), Student à esquerda (cinza)
            const autorLabel = isMe ? 'Tu' : (msg.autor === 'dt' ? 'Diretor de Turma' : msg.remetente);
            
            html += `
            <div class="chat-bubble ${classe}">
                <strong>${autorLabel}</strong><br>
                ${msg.texto}
                <span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
            </div>`;
        });
        
        if(html === '') { html = '<p class="text-muted center" style="margin-top:40px;"><i class="fa-solid fa-comments" style="font-size:3rem; opacity:0.2; display:block; margin-bottom:15px;"></i>Inicie aqui a comunicação com a escola.</p>'; }
        
        chatContainer.innerHTML = html;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

document.getElementById('btn-ee-send-msg')?.addEventListener('click', async () => {
    const inp = document.getElementById('ee-input-chat-msg');
    const txt = inp.value.trim();
    if(!txt || !educandoAtualId) return;
    
    try {
        await addDoc(collection(db, "utilizadores", educandoAtualId, "chat_dt"), {
            remetente: myUserName,
            autor: 'ee',
            texto: txt,
            timestamp: Date.now()
        });
        inp.value = '';
    } catch(e) {}
});

// JUSTIFICAR FALTAS E METADADOS
let atestadoBase64 = "";

document.getElementById('ee-upload-atestado')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 2097152) { alert("Ficheiro demasiado grande! Máx 2MB."); return; } // Aumentei o limite para fotos dos atestados
    
    document.getElementById('ee-atestado-file-name').innerText = "Ficheiro Selecionado: " + file.name;
    document.getElementById('btn-ee-enviar-atestado').style.display = 'block';

    const reader = new FileReader();
    reader.onload = (ev) => { atestadoBase64 = ev.target.result; };
    reader.readAsDataURL(file);
});

document.getElementById('btn-ee-enviar-atestado')?.addEventListener('click', async (e) => {
    if(!atestadoBase64 || !educandoAtualId) return;
    const obs = document.getElementById('ee-atestado-obs').value.trim();
    
    const btnRef = e.currentTarget;
    btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar...';
    btnRef.disabled = true;

    try {
        await addDoc(collection(db, "utilizadores", educandoAtualId, "atestados"), {
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
    container.innerHTML = '<p class="text-muted center">A procurar histórico...</p>';
    if(!educandoAtualId) return;

    try {
        const res = await getDocs(query(collection(db, "utilizadores", educandoAtualId, "atestados")));
        if(res.empty) { container.innerHTML = '<p class="text-muted center">Nenhum comprovativo enviado.</p>'; return; }
        
        let arr = []; res.forEach(d => arr.push(d.data()));
        arr.sort((a,b) => b.dataEnvio.localeCompare(a.dataEnvio)); 

        let html = '';
        arr.forEach(a => {
            let corStatus = 'var(--warning-yellow)';
            let txtStatus = 'Em análise';
            let iconStatus = '<i class="fa-regular fa-clock"></i>';
            
            if(a.status === 'aprovado' || a.status === 'aceite') { corStatus = 'var(--success-green)'; txtStatus = 'Aceite'; iconStatus = '<i class="fa-solid fa-check-circle"></i>'; }
            if(a.status === 'rejeitado' || a.status === 'recusada') { corStatus = 'var(--danger-red)'; txtStatus = 'Recusada'; iconStatus = '<i class="fa-solid fa-xmark-circle"></i>'; }
            
            const dataF = new Date(a.dataEnvio).toLocaleDateString('pt-PT');
            const dataHora = new Date(a.dataEnvio).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'});
            
            html += `
            <div class="card" style="margin-bottom:10px; border-left: 4px solid ${corStatus}; display:flex; justify-content:space-between; align-items:center;">
                <div>
                    <strong>Enviado a ${dataF}</strong><br>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${a.observacoes || 'Sem observações escritas'}</span>
                    <div style="font-size: 0.7rem; color: #888; margin-top: 5px;">Hora: ${dataHora}</div>
                </div>
                <div style="text-align: right;">
                    <span style="font-size:0.8rem; font-weight:bold; color:${corStatus}; padding:6px 12px; background:rgba(255,255,255,0.05); border-radius:20px; display:inline-block;">${iconStatus} ${txtStatus}</span>
                    ${a.analisadoPor ? `<div style="font-size: 0.65rem; color: #777; margin-top: 5px;">Por: ${a.analisadoPor}</div>` : ''}
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) {}
}

// ==========================================
// 7. NOTIFICAÇÕES PUSH PARA EE
// ==========================================
async function pedirPermissaoNotificacoes() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
            if (currentToken && myUserId) {
                await updateDoc(doc(db, "utilizadores", myUserId), { tokenNotificacao: currentToken });
            }
        }
    } catch (error) {}
}

if(typeof onMessage !== "undefined" && messaging) {
    onMessage(messaging, (payload) => {
        // Mostrar badge no sino (efeito nativo)
        const badge = document.getElementById('badge-notificacoes');
        if(badge) {
            badge.style.display = 'flex';
            let atuais = parseInt(badge.innerText) || 0;
            badge.innerText = atuais + 1;
        }
        // Injetar no array temporário do modal de notificações (Front-End)
        const container = document.getElementById('ee-notificacoes-container');
        if(container) {
            if(container.innerHTML.includes('A central de notificações')) container.innerHTML = '';
            container.innerHTML = `
            <div class="card" style="border-left: 4px solid var(--primary-green); margin-bottom: 10px;">
                <strong>${payload.notification.title}</strong>
                <p style="font-size: 0.85rem; color: var(--text-muted); margin-top: 5px;">${payload.notification.body}</p>
                <div style="font-size: 0.7rem; color: #666; margin-top: 8px; text-align: right;">Agora mesmo</div>
            </div>` + container.innerHTML;
        }
    });
}
setTimeout(() => { if(myUserId) pedirPermissaoNotificacoes(); }, 4000);
