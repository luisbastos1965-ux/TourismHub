import { auth, db, messaging, VAPID_KEY, getToken, onMessage } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, updateDoc, getDocs, query, addDoc, onSnapshot, orderBy, setDoc, enableIndexedDbPersistence, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Matriz Oficial de Disciplinas
const matrizCursoMap = {
    "Sociocultural": ["PORT", "ING", "AI", "EF", "TIC"],
    "Científica": ["GEO", "HCA", "MAT", "FQ", "BG", "MAC"],
    "Técnica": ["CF", "TIAT", "TCAT", "OTET"] 
};
const ordemDisciplinasGlobal = ['PORT', 'ING', 'AI', 'EF', 'TIC', 'GEO', 'HCA', 'MAT', 'CF', 'TIAT', 'TCAT', 'OTET'];

try {
    await enableIndexedDbPersistence(db);
    console.log("Modo Offline ativado com sucesso!");
} catch (err) {
    console.warn("Modo Offline não suportado pelo browser ou múltiplos separadores abertos.");
}

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
                if(dados.papel !== 'aluno') { window.location.href = "index.html"; return; }
                
                myUserName = dados.nome.split(' ')[0];
                minhaTurma = dados.turma;
                document.getElementById('header-user-name-aluno').innerText = myUserName;
                document.getElementById('welcome-nome').innerText = myUserName;
                document.getElementById('perfil-nome-central').innerText = dados.nome || myUserName;
                
                if(dados.fotoPerfil) {
                    const circle = document.getElementById('header-avatar-circle');
                    circle.innerHTML = `<img src="${dados.fotoPerfil}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
                    document.getElementById('perfil-avatar-img').src = dados.fotoPerfil;
                } else {
                    document.getElementById('perfil-avatar-img').src = `https://ui-avatars.com/api/?name=${myUserName}&background=00cc88&color=fff&size=100`;
                }

                carregarDadosPassaporte(dados);
                carregarGamificacao(dados);
                
                // MÓDULO DASHBOARD ADAPTATIVO
                await construirHomeAdaptativa(dados);
                
                const timelineEvents = await obterEventosLinhaTemporal();
                if (timelineEvents.length > 0) {
                    const badge = document.getElementById('badge-notificacoes');
                    badge.innerText = timelineEvents.length > 9 ? '9+' : timelineEvents.length;
                    badge.style.display = 'flex';
                }

                if (minhaTurma) {
                    const turmaSnap = await getDoc(doc(db, "turmas", minhaTurma));
                    if (turmaSnap.exists()) {
                        const tData = turmaSnap.data();
                        if(tData.epocaExames && tData.epocaExames.ativa) {
                            document.getElementById('exam-mode-banner').style.display = 'block';
                            document.body.style.borderTop = "5px solid #8e2de2"; 
                            if(tData.epocaExames.dataFim) {
                                const hoje = new Date(); const fim = new Date(tData.epocaExames.dataFim);
                                const diffTime = fim - hoje; const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                const txt = diffDays > 0 ? `Faltam ${diffDays} dias` : (diffDays === 0 ? "É Hoje!" : "Já terminou");
                                document.getElementById('exam-countdown').innerText = txt;
                            } else { document.getElementById('exam-countdown').innerText = "Em curso"; }
                        }
                    }
                }
            }
        } catch (e) { console.error("Erro ao ler perfil", e); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-aluno')?.addEventListener('click', () => { signOut(auth).then(() => window.location.href = "index.html"); });

// ----------------------------------------------------
// O DASHBOARD ADAPTATIVO MÁGICO (HOME) - POLIDO
// ----------------------------------------------------
async function construirHomeAdaptativa(dadosAluno) {
    const container = document.getElementById('dynamic-hero-section');
    if(!container) return;
    container.innerHTML = '<p class="text-muted center">A analisar o teu percurso...</p>';

    let temFaltas = 0; let eventosBreves = []; let prhfsAtivos = 0; let prhfHorasResolver = 0; let modReprovados = 0;
    try {
        const faltasSnap = await getDocs(collection(db, "utilizadores", myUserId, "faltas"));
        faltasSnap.forEach(d => { const f = d.data(); if (!f.justificada && !f.comprovativoEnviado) temFaltas++; });

        const notasSnap = await getDocs(collection(db, "utilizadores", myUserId, "notas"));
        notasSnap.forEach(d => { const val = d.data().nota; if (val === 'REP' || Number(val) < 10) modReprovados++; });

        if (minhaTurma) {
            const evSnap = await getDocs(collection(db, "turmas", minhaTurma, "eventos"));
            const hoje = new Date(); const daquiA7Dias = new Date(); daquiA7Dias.setDate(hoje.getDate() + 7);
            const hojeISO = hoje.toISOString().split('T')[0]; const limiteISO = daquiA7Dias.toISOString().split('T')[0];
            
            evSnap.forEach(d => {
                const e = d.data();
                if (e.data >= hojeISO && e.data <= limiteISO && ['teste','avaliacao','entrega','trabalho'].includes(e.tipo)) {
                    eventosBreves.push(e);
                }
            });
            eventosBreves.sort((a,b) => a.data.localeCompare(b.data));
        }

        const prhfSnap = await getDocs(collection(db, "utilizadores", myUserId, "prhfs"));
        prhfSnap.forEach(d => { 
            const p = d.data(); 
            if (p.status !== 'concluida') {
                prhfsAtivos++; 
                prhfHorasResolver += Number(p.horasPresenciais || 0);
            }
        });

        let heroHTML = ''; let showHumorAndMission = false;

        // PRIORIDADE 1: VERMELHO
        if (temFaltas > 0 || prhfsAtivos > 0 || modReprovados > 0) {
            heroHTML = `
                <div class="card" style="background: linear-gradient(135deg, #ff4d4d, #cc0000); color: white; border: none; border-radius: 16px; margin-bottom: 20px;">
                    <h3 style="margin-bottom:10px; font-size: 1.8rem;"><i class="fa-solid fa-triangle-exclamation"></i> Ação Necessária</h3>
                    <p style="font-size: 1.1rem; margin-bottom: 15px; opacity: 0.9;">Tens pendências urgentes que prejudicam a tua avaliação.</p>
                    <ul style="margin-bottom: 20px; padding-left: 20px; font-size: 1.1rem; font-weight: bold; line-height: 1.6;">
                        ${temFaltas > 0 ? `<li>${temFaltas} Falta(s)</li>` : ''}
                        ${modReprovados > 0 ? `<li>${modReprovados} Módulo(s) Reprovado(s)</li>` : ''}
                        ${prhfsAtivos > 0 ? `<li>${prhfsAtivos} PRHF(s) em curso (${prhfHorasResolver}h presenciais)</li>` : ''}
                    </ul>
                    <button class="primary-btn" style="background: white; color: #cc0000; font-size: 1.1rem; padding: 15px;" onclick="document.querySelector('.nav-item[data-target=\\'view-aluno-caderneta\\']').click()">Abrir Caderneta e Resolver</button>
                </div>
            `;
        } 
        // PRIORIDADE 2: LARANJA
        else if (eventosBreves.length > 0) {
            let ev = eventosBreves[0];
            const dataF = ev.data.split('-').reverse().join('/');
            heroHTML = `
                <div class="card" style="background: linear-gradient(135deg, #ffaa00, #e67e22); color: white; border: none; border-radius: 16px; margin-bottom: 20px;">
                    <h3 style="margin-bottom:10px; font-size: 1.8rem;"><i class="fa-solid fa-calendar-exclamation"></i> Foco Total</h3>
                    <p style="font-size: 1.1rem; margin-bottom: 15px; opacity: 0.9;">Tens <strong>${ev.titulo}</strong> no dia ${dataF}. Que tal iniciares um Pomodoro de 25m agora para adiantares estudo?</p>
                    <div style="display: flex; gap: 10px;">
                        <button class="primary-btn" style="background: white; color: #e67e22; flex: 1; font-size: 1.1rem; padding: 15px;" onclick="document.getElementById('btn-open-study-mode').click()"><i class="fa-solid fa-stopwatch"></i> Iniciar Pomodoro</button>
                    </div>
                </div>
            `;
            showHumorAndMission = true;
        } 
        // PRIORIDADE 3: VERDE
        else {
            heroHTML = `
                <div class="card" style="background: linear-gradient(135deg, #00cc88, #009966); color: white; border: none; border-radius: 16px; margin-bottom: 20px;">
                    <h3 style="margin-bottom:5px; font-size: 1.6rem;"><i class="fa-solid fa-leaf"></i> Dia Tranquilo</h3>
                    <p style="font-size: 1.05rem; margin-bottom: 0; opacity: 0.9;">Não tens avaliações marcadas para os próximos dias nem pendências. Excelente altura para adiantares os teus resumos!</p>
                </div>
            `;
            showHumorAndMission = true;
        }

        let secundariosHTML = '';
        if(showHumorAndMission) {
            if (minhaTurma) {
                const turmaSnap = await getDoc(doc(db, "turmas", minhaTurma));
                if (turmaSnap.exists() && turmaSnap.data().missaoTitulo) {
                    const tData = turmaSnap.data();
                    secundariosHTML += `
                        <div class="card" id="missao-card" style="border-left: 4px solid var(--warning-yellow); margin-bottom: 20px;">
                            <h3 style="font-size: 1rem; margin-bottom: 5px;"><i class="fa-solid fa-users"></i> Missão da Turma</h3>
                            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom: ${tData.missaoProgresso !== undefined ? '10px' : '0'};">${tData.missaoTitulo}</p>
                            ${tData.missaoProgresso !== undefined ? `<div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${tData.missaoProgresso}%; background:var(--warning-yellow);"></div></div>` : ''}
                        </div>
                    `;
                }
            }

            const hojeIso = new Date().toISOString().split('T')[0];
            const humorSnap = await getDoc(doc(db, "utilizadores", myUserId, "humor", hojeIso));
            if (!humorSnap.exists()) {
                secundariosHTML += `
                    <div class="card" id="checkin-card-dinamico" style="border-left: 4px solid #b82bf2; margin-bottom: 20px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                            <h3 style="font-size: 1rem; margin:0;"><i class="fa-solid fa-heart-pulse"></i> Como te sentes hoje?</h3>
                        </div>
                        <div style="display: flex; justify-content: space-around; font-size: 2.2rem;" id="mood-buttons-dinamicos">
                            <span class="mood-btn-dinamico" data-mood="😡" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">😡</span>
                            <span class="mood-btn-dinamico" data-mood="🙁" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">🙁</span>
                            <span class="mood-btn-dinamico" data-mood="😐" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">😐</span>
                            <span class="mood-btn-dinamico" data-mood="🙂" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">🙂</span>
                            <span class="mood-btn-dinamico" data-mood="🤩" style="cursor:pointer; filter:grayscale(100%); transition:0.2s;">🤩</span>
                        </div>
                    </div>
                `;
            }
        }

        container.innerHTML = heroHTML + secundariosHTML;

        // Ativar cliques no Humor Dinâmico
        const bDinamicos = document.querySelectorAll('.mood-btn-dinamico');
        if(bDinamicos.length > 0) {
            bDinamicos.forEach(btn => {
                btn.addEventListener('mouseover', () => btn.style.filter = 'grayscale(0%)');
                btn.addEventListener('mouseout', () => btn.style.filter = 'grayscale(100%)');
                btn.addEventListener('click', async (e) => {
                    const mood = e.currentTarget.getAttribute('data-mood');
                    const hojeIso = new Date().toISOString().split('T')[0];
                    const snap = await getDoc(doc(db, "utilizadores", myUserId));
                    let atualXp = snap.exists() && snap.data().xp ? snap.data().xp : 0;
                    
                    await setDoc(doc(db, "utilizadores", myUserId, "humor", hojeIso), { humor: mood, timestamp: Date.now(), dataIso: hojeIso });
                    await updateDoc(doc(db, "utilizadores", myUserId), { xp: atualXp + 10 });
                    
                    carregarGamificacao({xp: atualXp + 10});
                    document.getElementById('checkin-card-dinamico').innerHTML = '<div style="text-align:center; color:var(--success-green); font-weight:bold; font-size:0.95rem; padding: 10px;">Obrigado pelo teu registo! <span style="color:var(--warning-yellow);">+10 XP</span></div>';
                    carregarHistoricoHumor();
                });
            });
        }
    } catch(e) { console.error("Erro ao gerar dashboard", e); }
}

// ----------------------------------------------------
// GAMIFICAÇÃO E AVATAR (Perfil)
// ----------------------------------------------------
function carregarGamificacao(dados) {
    const xp = dados.xp || 0;
    const nivel = Math.floor(xp / 100) + 1;
    const xpProximoNivel = nivel * 100;
    const xpNivelAtual = (nivel - 1) * 100;
    const progresso = ((xp - xpNivelAtual) / (xpProximoNivel - xpNivelAtual)) * 100;

    document.getElementById('aluno-nivel').innerText = nivel;
    document.getElementById('aluno-xp-atual').innerText = xp;
    document.getElementById('perfil-xp-totais').innerText = xp;
    document.getElementById('perfil-xp-progress').style.width = `${progresso}%`;

    let rank = "Novato";
    if (nivel >= 2) rank = "Aprendiz";
    if (nivel >= 5) rank = "Estudante PRO";
    if (nivel >= 10) rank = "Veterano";
    if (nivel >= 20) rank = "Lenda da Turma";
    
    document.getElementById('aluno-rank-title').innerText = rank;
    document.getElementById('perfil-titulo-central').innerText = rank;
}

async function carregarEstatisticasEstudo() {
    try {
        const estudosSnap = await getDocs(query(collection(db, "utilizadores", myUserId, "estudos")));
        let totalSessions = 0; let diasUnicos = new Set();
        estudosSnap.forEach(d => { totalSessions++; if(d.data().data) { const dataIso = d.data().data.split('T')[0]; diasUnicos.add(dataIso); } });
        
        const totalMinutes = totalSessions * 25; 
        const horasFormatadas = totalMinutes > 60 ? `${Math.floor(totalMinutes/60)}h${totalMinutes%60}m` : `${totalMinutes}m`;
        document.getElementById('total-minutos-foco').innerText = horasFormatadas;

        let streak = 0; let datasOrdenadas = Array.from(diasUnicos).sort((a,b) => b.localeCompare(a));
        if (datasOrdenadas.length > 0) {
            let hoje = new Date(); let dataTeste = new Date(hoje); const hojeStr = dataTeste.toISOString().split('T')[0];
            dataTeste.setDate(dataTeste.getDate() - 1); const ontemStr = dataTeste.toISOString().split('T')[0];
            if (datasOrdenadas.includes(hojeStr) || datasOrdenadas.includes(ontemStr)) {
                let currentVerificacao = new Date(datasOrdenadas[0]);
                for(let i=0; i<datasOrdenadas.length; i++) {
                    const dataAtualStr = currentVerificacao.toISOString().split('T')[0];
                    if(datasOrdenadas.includes(dataAtualStr)) { streak++; currentVerificacao.setDate(currentVerificacao.getDate() - 1); } else break;
                }
            }
        }
        document.getElementById('streak-dias').innerText = streak;
    } catch(e) { console.error("Erro stats estudo", e); }
}

document.getElementById('upload-avatar')?.addEventListener('change', async (e) => {
    const file = e.target.files[0]; if(!file) return;
    const options = { maxSizeMB: 0.2, maxWidthOrHeight: 500, useWebWorker: true };
    try {
        const compressedFile = await imageCompression(file, options);
        const reader = new FileReader();
        reader.onload = async (ev) => {
            const base64 = ev.target.result;
            document.getElementById('perfil-avatar-img').src = base64;
            document.getElementById('header-avatar-circle').innerHTML = `<img src="${base64}" style="width:100%; height:100%; object-fit:cover; border-radius:50%;">`;
            await updateDoc(doc(db, "utilizadores", myUserId), { fotoPerfil: base64 });
        };
        reader.readAsDataURL(compressedFile);
    } catch(err) { console.error(err); }
});

// ----------------------------------------------------
// NAVEGAÇÃO ENTRE VISTAS
// ----------------------------------------------------
const navItems = document.querySelectorAll('.nav-item');
const views = [
    document.getElementById('student-dashboard'), document.getElementById('view-aluno-caderneta'),
    document.getElementById('view-aluno-agenda'), document.getElementById('view-aluno-forum'),
    document.getElementById('view-aluno-passaporte'), document.getElementById('view-study-mode'),
    document.getElementById('view-aluno-sumarios'), document.getElementById('view-aluno-caderno'),
    document.getElementById('view-aluno-notificacoes'), document.getElementById('view-aluno-perfil'),
    document.getElementById('view-aluno-acao-prhf')
];

function esconderTodasAsVistas() { views.forEach(v => { if(v) v.style.display = 'none'; }); }

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault(); navItems.forEach(nav => nav.classList.remove('active')); e.currentTarget.classList.add('active');
        esconderTodasAsVistas(); const targetId = e.currentTarget.getAttribute('data-target'); const targetView = document.getElementById(targetId);
        if(targetView) targetView.style.display = 'block';

        if(targetId === 'view-aluno-perfil') { 
            carregarObjetivosPessoais(); 
            carregarHistoricoHumor(); 
            carregarEstatisticasEstudo();
            renderizarGraficoNotas(); 
        }
        if(targetId === 'view-aluno-caderneta') { ativarTab(tabTimeline, ['tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-comportamento', 'tab-aluno-observacoes'], true); carregarTimelineAluno(); }
        if(targetId === 'view-aluno-agenda') { document.getElementById('tab-aluno-eventos').click(); }
        if(targetId === 'view-aluno-forum') { carregarForuns(); }
        if(targetId === 'view-aluno-caderno') { 
            if (!quillEditor) { quillEditor = new Quill('#quill-editor', { theme: 'snow', placeholder: 'Escreve aqui o teu resumo...', modules: { toolbar: [ ['bold', 'italic', 'underline'], [{ 'list': 'ordered'}, { 'list': 'bullet' }], [{ 'color': [] }, { 'background': [] }], ['clean'] ] } }); }
            document.getElementById('tab-caderno-resumos').click(); 
        }
    });
});

document.getElementById('btn-open-notificacoes')?.addEventListener('click', () => { esconderTodasAsVistas(); navItems.forEach(nav => nav.classList.remove('active')); document.getElementById('view-aluno-notificacoes').style.display = 'block'; carregarNotificacoesAluno(); });
document.querySelectorAll('#btn-voltar-notificacoes').forEach(btn => {
    btn?.addEventListener('click', () => { esconderTodasAsVistas(); document.querySelector('.nav-item[data-target="student-dashboard"]').classList.add('active'); document.getElementById('student-dashboard').style.display = 'block'; });
});

// ----------------------------------------------------
// CADERNETA - VISTAS E INTERATIVIDADE
// ----------------------------------------------------
const tabTimeline = document.getElementById('tab-aluno-timeline'); const tabNotas = document.getElementById('tab-aluno-notas'); const tabFaltas = document.getElementById('tab-aluno-faltas'); const tabPrhfs = document.getElementById('tab-aluno-prhfs'); const tabComportamento = document.getElementById('tab-aluno-comportamento'); const tabObservacoes = document.getElementById('tab-aluno-observacoes'); const cadernetaContent = document.getElementById('aluno-caderneta-content');

tabTimeline?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-comportamento', 'tab-aluno-observacoes'], true); carregarTimelineAluno(); }); 
tabNotas?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-timeline', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-comportamento', 'tab-aluno-observacoes'], false); carregarNotasAluno(); }); 
tabFaltas?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-timeline', 'tab-aluno-notas', 'tab-aluno-prhfs', 'tab-aluno-comportamento', 'tab-aluno-observacoes'], false); carregarFaltasAluno(); }); 
tabPrhfs?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-timeline', 'tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-comportamento', 'tab-aluno-observacoes'], false); carregarPrhfsAluno(); }); 
tabComportamento?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-timeline', 'tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-observacoes'], false); carregarComportamentoAluno(); }); 
tabObservacoes?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-timeline', 'tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-comportamento'], false); carregarObservacoesAluno(); });

function ativarTab(tabAtiva, tabsInativasIds, mostrarFiltrosTimeline = false) { 
    if(!tabAtiva) return; tabAtiva.classList.add('active'); 
    tabsInativasIds.forEach(id => document.getElementById(id)?.classList.remove('active')); 
    const filtrosEl = document.getElementById('timeline-filtros');
    if(filtrosEl) filtrosEl.style.display = mostrarFiltrosTimeline ? 'flex' : 'none';
    cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar...</p>'; 
}

// LINHA TEMPORAL
let timelineFilterCat = 'all';
document.querySelectorAll('#timeline-filtros .filter-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
        document.querySelectorAll('#timeline-filtros .filter-chip').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active'); timelineFilterCat = e.currentTarget.getAttribute('data-cat');
        carregarTimelineAluno();
    });
});

async function obterEventosLinhaTemporal() {
    let eventos = []; if(!myUserId) return eventos;
    const notasSnap = await getDocs(collection(db, "utilizadores", myUserId, "notas")); notasSnap.forEach(d => { const n = d.data(); eventos.push({ time: new Date(n.data).getTime(), cat: 'notas', icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', titulo: 'Nova Avaliação Lançada', desc: `${n.disciplina} (Mod. ${n.modulo}): <strong>${n.nota}</strong>` }); });
    const faltasSnap = await getDocs(collection(db, "utilizadores", myUserId, "faltas")); faltasSnap.forEach(d => { const f = d.data(); eventos.push({ time: new Date(f.criadoEm || f.dataInicio).getTime(), cat: 'faltas', icon: '<i class="fa-solid fa-user-xmark"></i>', cor: f.justificada ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Falta a ${f.disciplina} (${f.horas}h)`, desc: f.justificada ? `Estado: Justificada` : `Falta registada` }); });
    const ocSnap = await getDocs(collection(db, "utilizadores", myUserId, "ocorrencias")); ocSnap.forEach(d => { const o = d.data(); eventos.push({ time: o.timestamp, cat: 'comportamento', icon: o.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>', cor: o.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Registo Disciplinar`, desc: `<strong>${o.titulo}</strong><br><span style="font-size:0.8rem; color:#aaa;">${o.descricao || ''}</span>` }); });
    const humorSnap = await getDocs(collection(db, "utilizadores", myUserId, "humor")); humorSnap.forEach(d => { const h = d.data(); eventos.push({ time: h.timestamp, cat: 'gamificacao', icon: '<i class="fa-solid fa-heart-pulse"></i>', cor: '#b82bf2', titulo: `Check-in Emocional`, desc: `Sentiste-te ${h.humor} (+10 XP)` }); });
    eventos.sort((a,b) => b.time - a.time); return eventos;
}

async function carregarTimelineAluno() {
    cadernetaContent.innerHTML = '<p class="text-muted center">A construir o teu histórico...</p>';
    try {
        let eventos = await obterEventosLinhaTemporal();
        if(timelineFilterCat !== 'all') { eventos = eventos.filter(e => e.cat === timelineFilterCat); }
        if(eventos.length === 0) { cadernetaContent.innerHTML = '<p class="text-muted center" style="margin-top:40px;">O teu histórico está limpo nesta categoria.</p>'; return; }
        let html = '<div class="timeline">'; eventos.forEach(ev => { html += `<div class="timeline-item"><div class="timeline-icon" style="color: ${ev.cor}; border-color: ${ev.cor};">${ev.icon}</div><div class="timeline-content" style="border-left: 3px solid ${ev.cor};"><span class="timeline-date">${new Date(ev.time).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span><strong style="color:white; display:block; margin-bottom:5px;">${ev.titulo}</strong><p style="font-size:0.85rem; color:var(--text-light); margin:0;">${ev.desc}</p></div></div>`; }); cadernetaContent.innerHTML = html + '</div>';
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao carregar histórico.</p>'; }
}

// Filtros das Notificações
let notifFilterCat = 'all';
document.querySelectorAll('#notificacoes-filtros .filter-chip').forEach(chip => {
    chip.addEventListener('click', (e) => {
        document.querySelectorAll('#notificacoes-filtros .filter-chip').forEach(c => c.classList.remove('active'));
        e.currentTarget.classList.add('active'); notifFilterCat = e.currentTarget.getAttribute('data-cat');
        carregarNotificacoesAluno();
    });
});

async function carregarNotificacoesAluno() {
    const container = document.getElementById('aluno-notificacoes-container'); container.innerHTML = '<p class="text-muted center">A ler alertas...</p>';
    try {
        let eventos = await obterEventosLinhaTemporal();
        eventos = eventos.map(e => {
            let nCat = 'escola';
            if(e.cat === 'faltas' && e.cor === 'var(--danger-red)') nCat = 'importante';
            if(e.cat === 'gamificacao') nCat = 'gamificacao';
            return { ...e, nCat: nCat };
        });

        if(notifFilterCat !== 'all') { eventos = eventos.filter(e => e.nCat === notifFilterCat); }
        const recentes = eventos.slice(0, 15);
        if(recentes.length === 0) { container.innerHTML = '<p class="text-muted center" style="margin-top:40px;">Sem alertas nesta categoria.</p>'; return; }
        
        let html = ''; recentes.forEach(ev => { html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${ev.cor}; display:flex; align-items:flex-start; gap: 15px; padding: 15px;"><div style="font-size: 1.5rem; color: ${ev.cor};">${ev.icon}</div><div><strong style="color:white; font-size:1rem; display:block; margin-bottom:3px;">${ev.titulo}</strong><span style="font-size:0.85rem; color:var(--text-light);">${ev.desc}</span><div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">${new Date(ev.time).toLocaleString('pt-PT')}</div></div></div>`; }); container.innerHTML = html; 
        if(notifFilterCat === 'all') document.getElementById('badge-notificacoes').style.display = 'none';
    } catch(e) { container.innerHTML = '<p class="text-danger center">Erro ao carregar notificações.</p>'; }
}

async function carregarNotasAluno() {
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", myUserId, "notas"));
        let disciplinas = {};
        notasDb.forEach(d => { const n = d.data(); if(!disciplinas[n.disciplina]) disciplinas[n.disciplina] = []; disciplinas[n.disciplina].push(n); });
        
        let html = '';
        ordemDisciplinasGlobal.forEach(disc => {
            if(disciplinas[disc] && disciplinas[disc].length > 0) {
                let sum = 0; let c = 0; let modsHtml = '';
                disciplinas[disc].forEach(n => {
                    if(n.nota !== 'REP' && !isNaN(n.nota)) { sum += Number(n.nota); c++; }
                    const cor = (n.nota === 'REP' || Number(n.nota) < 10) ? 'var(--danger-red)' : 'var(--success-green)';
                    modsHtml += `<div class="modulo-row"><span>Módulo ${n.modulo}</span><span style="font-weight:bold; color:${cor};">${n.nota}</span></div>`;
                });
                const med = c > 0 ? (sum/c).toFixed(1) : '-';
                const medCor = (med !== '-' && med < 10) ? 'var(--danger-red)' : 'white';
                html += `<div class="disciplina-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'"><span class="disciplina-title">${disc}</span><span><span style="font-size:0.75rem; color:var(--text-muted); margin-right:8px;">Média:</span><span class="disciplina-media" style="color:${medCor};">${med}</span> <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; margin-left:5px;"></i></span></div><div class="disciplina-modules">${modsHtml}</div>`;
            } else {
                html += `<div class="disciplina-header" style="cursor:default;"><span class="disciplina-title" style="color:var(--text-muted);">${disc}</span><span><span class="disciplina-media" style="color:var(--text-muted); font-size:0.9rem;">SN</span></span></div>`;
            }
        });
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

async function carregarFaltasAluno() {
    try {
        const faltasDb = await getDocs(collection(db, "utilizadores", myUserId, "faltas"));
        let faltasObj = {}; 
        faltasDb.forEach(d => { const f = d.data(); if(!faltasObj[f.disciplina]) faltasObj[f.disciplina] = []; faltasObj[f.disciplina].push(f); });

        // Identificar horas recuperadas através de PRHFs concluídos
        const prhfsDb = await getDocs(collection(db, "utilizadores", myUserId, "prhfs"));
        let horasRecuperadasObj = {};
        prhfsDb.forEach(d => {
            const p = d.data();
            if (p.status === 'concluida') {
                if(!horasRecuperadasObj[p.disciplina]) horasRecuperadasObj[p.disciplina] = 0;
                horasRecuperadasObj[p.disciplina] += Number(p.horasTotais || 50); // Assumimos recuperação do módulo (50h default)
            }
        });

        let html = '';
        ordemDisciplinasGlobal.forEach(disc => {
            let totalHorasFaltaGeral = 0; // Conta todas as faltas (para o cálculo base)
            let faltasHTML = '';
            
            if(faltasObj[disc] && faltasObj[disc].length > 0) {
                faltasObj[disc].sort((a,b) => b.dataInicio.localeCompare(a.dataInicio));
                faltasObj[disc].forEach(f => {
                    totalHorasFaltaGeral += Number(f.horas || 0); // Faltas justificadas ou injustificadas são sempre FALTAS.
                    const statusColor = f.justificada ? 'var(--success-green)' : 'var(--danger-red)'; 
                    const statusTxt = f.justificada ? 'Justificada' : (f.comprovativoEnviado ? 'Em Análise (DT)' : 'Injustificada'); 
                    faltasHTML += `<div style="display:flex; justify-content:space-between; align-items:center; padding: 10px 0; border-bottom: 1px dashed #333;"><div><strong style="color:white; font-size:0.9rem;">Falta (${f.horas}h)</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${f.dataInicio}</span></div><span style="font-size:0.75rem; font-weight:bold; color:${statusColor}; padding:4px 8px; background:rgba(255,255,255,0.05); border-radius:12px;">${statusTxt}</span></div>`;
                });
            }

            // A matemática da assiduidade: Total Faltas - Faltas Recuperadas no PRHF
            const recuperadas = horasRecuperadasObj[disc] || 0;
            let horasFaltaEfetivas = totalHorasFaltaGeral - recuperadas;
            if (horasFaltaEfetivas < 0) horasFaltaEfetivas = 0;

            const limiteVirtual = 50; 
            let assiduidade = 100 - ((horasFaltaEfetivas / limiteVirtual) * 100);
            if (assiduidade < 0) assiduidade = 0;
            if (assiduidade > 100) assiduidade = 100;
            
            let barraColor = 'var(--success-green)';
            if (assiduidade < 90) barraColor = 'var(--warning-yellow)';
            if (assiduidade < 80) barraColor = 'var(--danger-red)';

            if(faltasObj[disc] && faltasObj[disc].length > 0) {
                html += `
                <div class="card" style="margin-bottom:15px; padding:15px; border-left: 4px solid ${barraColor};">
                    <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                        <div>
                            <strong style="font-size: 1.1rem; color:white;">${disc}</strong>
                            <div style="font-size: 0.8rem; color:var(--text-muted); margin-top:3px;">${totalHorasFaltaGeral}h Faltadas ${recuperadas>0? `(<span style="color:var(--success-green);">${recuperadas}h Recup.</span>)`:''}</div>
                        </div>
                        <div style="text-align:right;">
                            <div style="font-weight:bold; color:${barraColor};">${assiduidade.toFixed(0)}%</div>
                            <div style="font-size:0.7rem; color:var(--text-muted);">Assiduidade</div>
                        </div>
                    </div>
                    <div style="display:none; margin-top:15px; border-top:1px solid #333; padding-top:10px;">
                        ${faltasHTML}
                    </div>
                </div>`;
            } else {
                html += `
                <div class="card" style="margin-bottom:10px; padding:15px; border-left: 4px solid var(--success-green); display:flex; justify-content:space-between; align-items:center;">
                    <strong style="font-size: 1rem; color:var(--text-muted);">${disc}</strong>
                    <div style="text-align:right;">
                        <div style="font-weight:bold; color:var(--success-green);">100%</div>
                    </div>
                </div>`;
            }
        });
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

async function carregarPrhfsAluno() {
    try {
        const prhfsDb = await getDocs(collection(db, "utilizadores", myUserId, "prhfs"));
        if(prhfsDb.empty) { cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">Não tens Planos de Recuperação (PRHF) atribuídos.</p>'; return; }
        let prhfsArr = []; prhfsDb.forEach(d => { prhfsArr.push({id: d.id, ...d.data()}); });
        prhfsArr.sort((a,b) => new Date(a.prazo) - new Date(b.prazo));
        
        let html = ''; 
        prhfsArr.forEach(p => { 
            const isUrgente = p.moduloTerminado === true || p.moduloTerminado === "true"; 
            const cor = isUrgente ? 'var(--danger-red)' : 'var(--warning-yellow)';
            const txtSt = p.status === 'concluida' ? 'CONCLUÍDO' : (isUrgente ? 'URGENTE' : 'EM CURSO');
            const corFinal = p.status === 'concluida' ? 'var(--success-green)' : cor;

            const horasTotais = Number(p.horasTotais || 50); 
            const horasPresenciais = Number(p.horasPresenciais || 0);
            const horasAutonomas = horasTotais - horasPresenciais;

            // Se o professor enviou um anexo (Matriz)
            const anexoHTML = p.anexoBase64 ? `<a href="${p.anexoBase64}" download="${p.anexoNome || 'Documento_PRHF'}" class="secondary-btn small-btn" style="margin-bottom:15px; display:inline-block; border-color:var(--text-muted); color:white;"><i class="fa-solid fa-download"></i> Matriz / Guião</a>` : '';

            // Se o aluno já fez uma proposta e ela está gravada
            const propostaHTML = p.propostaAluno ? `<div style="background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; margin-bottom:15px; font-size:0.85rem;"><strong style="color:var(--warning-yellow);">Tua Proposta de Presenciais:</strong> ${p.propostaAluno} <br><span style="color:${p.propostaLidaDT ? 'var(--success-green)' : 'var(--text-muted)'}; font-size:0.75rem;"><i class="fa-solid ${p.propostaLidaDT ? 'fa-check-double' : 'fa-check'}"></i> ${p.propostaLidaDT ? 'Vista e Avaliada pelo Prof/DT' : 'A aguardar validação'}</span></div>` : '';

            html += `<div class="card" style="margin-bottom:15px; border-left: 4px solid ${corFinal};">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <strong style="font-size: 1.1rem; color:white;">${p.disciplina} (Mod. ${p.modulo})</strong>
                            <span style="color:${corFinal}; font-size:0.75rem; font-weight:bold;">${txtSt}</span>
                        </div>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">${p.descricao}</p>
                        ${anexoHTML}
                        ${propostaHTML}
                        <div style="font-size:0.8rem; margin-bottom: 15px; border-top:1px dashed #333; padding-top:10px;">
                            Data Limite: <strong style="color:${corFinal};">${p.prazo}</strong><br>
                            Horas Totais: <strong>${horasTotais}h</strong> (Presenciais: <strong>${horasPresenciais}h</strong> | Autónomo: <strong>${horasAutonomas}h</strong>)
                        </div>
                        ${p.status !== 'concluida' ? `<button class="primary-btn small-btn" style="width:100%; background-color:${corFinal}; color:${corFinal === 'var(--warning-yellow)' ? 'black' : 'white'};" onclick="abrirAcaoPrhf('${p.id}', '${p.disciplina}', '${p.modulo}', '${p.prazo}', '${horasPresenciais}', '${horasTotais}')"><i class="fa-solid fa-calendar-plus"></i> Agendar Presenciais</button>` : ''}
                    </div>`; 
        }); 
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

window.abrirAcaoPrhf = (id, disc, mod, prazo, horasFeitas, horasTotais) => {
    document.querySelector('.nav-item[data-target="view-aluno-caderneta"]').classList.remove('active');
    esconderTodasAsVistas();
    document.getElementById('view-aluno-acao-prhf').style.display = 'block';
    
    document.getElementById('prhf-acao-titulo').innerText = `${disc} (Mod. ${mod})`;
    document.getElementById('prhf-acao-prazo').innerText = prazo;
    document.getElementById('prhf-acao-horas').innerText = `${horasFeitas}h`;
    document.getElementById('prhf-acao-horas-totais').innerText = `${horasTotais}h`;
    
    document.getElementById('btn-voltar-acao-prhf').onclick = () => {
        esconderTodasAsVistas();
        document.querySelector('.nav-item[data-target="view-aluno-caderneta"]').classList.add('active');
        document.getElementById('view-aluno-caderneta').style.display = 'block';
        document.getElementById('tab-aluno-prhfs').click(); 
    };

    document.getElementById('btn-enviar-proposta-prhf').onclick = async () => {
        const dataVal = document.getElementById('aluno-prhf-proposta-data').value;
        const hInicio = document.getElementById('aluno-prhf-proposta-hora-inicio').value;
        const hFim = document.getElementById('aluno-prhf-proposta-hora-fim').value;
        if(!dataVal || !hInicio || !hFim) { alert("Preenche o dia e as horas de início e fim da tua proposta!"); return; }
        
        const propostaFinal = `Data: ${dataVal} | Das ${hInicio} às ${hFim}`;
        try {
            await updateDoc(doc(db, "utilizadores", myUserId, "prhfs", id), { propostaAluno: propostaFinal, propostaLidaDT: false });
            alert("Proposta enviada ao Professor com sucesso!");
            document.getElementById('btn-voltar-acao-prhf').click();
        } catch(e) {}
    };
};

async function carregarComportamentoAluno() {
    try {
        const res = await getDocs(query(collection(db, "utilizadores", myUserId, "ocorrencias")));
        if(res.empty) { cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">Sem registos disciplinares ou de mérito.</p>'; return; }
        let regs = []; res.forEach(d => regs.push(d.data())); regs.sort((a,b) => b.data.localeCompare(a.data)); 
        let html = ''; regs.forEach(r => { const cor = r.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)'; const ic = r.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>'; html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; align-items:center; gap:8px; color:${cor}; margin-bottom:5px;">${ic} <strong>${r.titulo}</strong></div><span style="font-size:0.75rem; color:var(--text-muted);">Data: ${r.data} | Prof. ${r.autor}</span>${r.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">${r.descricao}</p>` : ''}</div>`; }); cadernetaContent.innerHTML = html;
    } catch(e) {}
}

async function carregarObservacoesAluno(reuniaoSelecionada = '1_avaliacao') {
    const reunioesMenu = [
        {id: '1_intercalar', label: '1ª Intercalar'}, {id: '1_avaliacao', label: '1ª Avaliação'}, {id: '2_intercalar', label: '2ª Intercalar'}, {id: '2_avaliacao', label: '2ª Avaliação'}, {id: '3_avaliacao', label: '3ª Avaliação'}
    ];
    let html = '<div style="display:flex; overflow-x:auto; gap:10px; margin-bottom:20px; padding-bottom:10px; scrollbar-width: none;">';
    reunioesMenu.forEach(r => { const bg = r.id === reuniaoSelecionada ? 'var(--primary-green)' : 'var(--bg-dark)'; const color = r.id === reuniaoSelecionada ? 'var(--bg-dark)' : 'var(--text-muted)'; html += `<button class="btn-select-reuniao" data-id="${r.id}" style="background:${bg}; color:${color}; border:1px solid #333; padding:8px 15px; border-radius:20px; cursor:pointer; font-weight:bold; white-space:nowrap; transition:0.2s; flex-shrink:0;">${r.label}</button>`; });
    html += '</div><div id="reuniao-content-area"><p class="text-muted center">A carregar dados...</p></div>';
    cadernetaContent.innerHTML = html;

    document.querySelectorAll('.btn-select-reuniao').forEach(btn => { btn.addEventListener('click', (e) => { carregarObservacoesAluno(e.currentTarget.getAttribute('data-id')); }); });

    try {
        const docSnap = await getDoc(doc(db, "utilizadores", myUserId, "reunioes", reuniaoSelecionada));
        let dadosReuniao = docSnap.exists() ? docSnap.data() : {};
        let contentHtml = '<div style="display:flex; flex-direction:column; gap:10px;">';
        ordemDisciplinasGlobal.forEach(disc => {
            const comentario = dadosReuniao.disciplinas && dadosReuniao.disciplinas[disc] ? dadosReuniao.disciplinas[disc] : '<span style="color:var(--text-muted);">Sem comentário (SN)</span>';
            contentHtml += `<div class="card" style="margin-bottom:0; border-left:4px solid var(--primary-green); padding:15px;"><h4 style="margin-bottom:8px; color:white; font-size:1rem;">${disc}</h4><p style="color:var(--text-light); font-size:0.9rem; line-height:1.4; margin:0;">${comentario}</p></div>`;
        });
        const global = dadosReuniao.global || '<span style="color:var(--text-muted);">Sem observações globais registadas (SN).</span>';
        contentHtml += `<div class="card" style="margin-top:15px; border:1px solid var(--warning-yellow); background:rgba(255,204,0,0.05); padding:15px;"><h3 style="color:var(--warning-yellow); margin-bottom:10px; font-size:1.1rem;"><i class="fa-solid fa-comment-dots"></i> Observações Globais</h3><p style="color:white; font-size:0.95rem; line-height:1.5; margin:0;">${global}</p></div></div>`;
        document.getElementById('reuniao-content-area').innerHTML = contentHtml;
    } catch(e) { document.getElementById('reuniao-content-area').innerHTML = '<p class="text-danger center">Erro ao carregar a reunião.</p>'; }
}

// ----------------------------------------------------
// AGENDA E HORÁRIO (Com Grelha ajustada)
// ----------------------------------------------------
document.querySelector('.nav-item[data-target="view-aluno-agenda"]')?.addEventListener('click', () => { document.getElementById('tab-aluno-eventos').click(); });
document.getElementById('tab-aluno-eventos')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-aluno-horario').classList.remove('active'); document.getElementById('aluno-agenda-filtros').style.display = 'flex'; document.getElementById('aluno-horario-container').style.display = 'none'; carregarAgendaAlunoLista(); });
document.getElementById('tab-aluno-horario')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-aluno-eventos').classList.remove('active'); document.getElementById('aluno-agenda-filtros').style.display = 'none'; document.getElementById('aluno-horario-container').style.display = 'block'; carregarHorarioAluno(); });

document.getElementById('aluno-filtro-agenda-testes')?.addEventListener('change', carregarAgendaAlunoLista);
document.getElementById('aluno-filtro-agenda-trabalhos')?.addEventListener('change', carregarAgendaAlunoLista);
document.getElementById('aluno-filtro-agenda-outros')?.addEventListener('change', carregarAgendaAlunoLista);

async function carregarAgendaAlunoLista() {
    const subContainer = document.getElementById('aluno-agenda-content'); subContainer.innerHTML = '<p class="text-muted center">A sincronizar agenda...</p>';
    if(!minhaTurma) return;

    const mostraT = document.getElementById('aluno-filtro-agenda-testes').checked;
    const mostraTr = document.getElementById('aluno-filtro-agenda-trabalhos').checked;
    const mostraO = document.getElementById('aluno-filtro-agenda-outros').checked;

    try {
        const evDb = await getDocs(collection(db, "turmas", minhaTurma, "eventos"));
        if(evDb.empty) { subContainer.innerHTML = '<p class="text-muted center">Sem eventos na escola.</p>'; return; }
        
        let evs = [];
        evDb.forEach(d => { 
            const e = d.data(); let bgC = '#b82bf2'; let txtT = 'Evento';
            if(e.tipo === 'teste' || e.tipo === 'avaliacao') { if(mostraT) { bgC = '#ffaa00'; txtT = 'Avaliação'; evs.push({...e, cor: bgC, txt: txtT}); } } 
            else if(e.tipo === 'trabalho' || e.tipo === 'entrega') { if(mostraTr) { bgC = '#00d2ff'; txtT = 'Entrega'; evs.push({...e, cor: bgC, txt: txtT}); } } 
            else { if(mostraO) evs.push({...e, cor: bgC, txt: txtT}); }
        });
        
        if(evs.length === 0) { subContainer.innerHTML = '<p class="text-muted center">Nenhum evento com os filtros atuais.</p>'; return; }
        
        const hoje = new Date().toISOString().split('T')[0];
        const futuros = evs.filter(e => e.data >= hoje).sort((a,b) => a.data.localeCompare(b.data));
        const passados = evs.filter(e => e.data < hoje).sort((a,b) => b.data.localeCompare(a.data));
        const mesArr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        let html = '';

        const renderEv = (ev) => {
            const dp = ev.data.split('-'); const mes = mesArr[parseInt(dp[1])-1];
            return `<div class="calendar-event-card" style="border-left-color:${ev.cor}; margin-bottom:10px;"><div class="calendar-date-box"><span class="day">${dp[2]}</span><span class="month" style="color:${ev.cor};">${mes}</span></div><div class="calendar-info"><h4 style="margin:0; color:white;">${ev.titulo}</h4><span style="font-size:0.8rem; color:var(--text-muted);">${(ev.txt||'evento').toUpperCase()}</span></div></div>`;
        };

        if(futuros.length > 0) { futuros.forEach(e => html += renderEv(e)); } else { html += '<p class="text-muted center">Sem eventos futuros.</p>'; }
        if(passados.length > 0) { html += '<div class="calendar-divider" style="margin-top:20px;"><span>Passados</span></div>'; passados.forEach(e => html += renderEv(e)); }
        subContainer.innerHTML = html;
    } catch(e) {}
}

let alunoHorarioModo = 'dia'; 
let alunoHorarioDiaOffset = 0;
let alunoHorarioSemanaOffset = 0;

document.getElementById('btn-aluno-horario-dia')?.addEventListener('click', (e) => { alunoHorarioModo = 'dia'; e.currentTarget.classList.add('active'); document.getElementById('btn-aluno-horario-grelha').classList.remove('active'); carregarHorarioAluno(); });
document.getElementById('btn-aluno-horario-grelha')?.addEventListener('click', (e) => { alunoHorarioModo = 'grelha'; e.currentTarget.classList.add('active'); document.getElementById('btn-aluno-horario-dia').classList.remove('active'); carregarHorarioAluno(); });
document.getElementById('btn-aluno-prev-horario')?.addEventListener('click', () => { if(alunoHorarioModo === 'dia') alunoHorarioDiaOffset--; else alunoHorarioSemanaOffset--; carregarHorarioAluno(); });
document.getElementById('btn-aluno-next-horario')?.addEventListener('click', () => { if(alunoHorarioModo === 'dia') alunoHorarioDiaOffset++; else alunoHorarioSemanaOffset++; carregarHorarioAluno(); });

const getCorEspecial = (dsc) => {
    const d = dsc.toLowerCase();
    if(d.includes('alm')) return { c: 'var(--warning-yellow)', bg: 'rgba(255, 204, 0, 0.15)' };
    if(d.includes('vis')) return { c: '#00d2ff', bg: 'rgba(0, 210, 255, 0.15)' };
    if(d.includes('prhf')) return { c: 'var(--danger-red)', bg: 'rgba(255, 77, 77, 0.15)' };
    if(d.includes('pap') || d.includes('fct')) return { c: '#ff9900', bg: 'rgba(255, 153, 0, 0.15)' };
    if(['reunião','reuniao','livre','estudo'].some(k => d.includes(k))) return { c: '#b82bf2', bg: 'rgba(184, 43, 242, 0.15)' };
    return { c: 'var(--primary-green)', bg: 'rgba(0, 204, 136, 0.1)' };
};

async function carregarHorarioAluno() {
    const subContainer = document.getElementById('aluno-agenda-content'); subContainer.innerHTML = '<p class="text-muted center">A gerar horário...</p>';
    if(!minhaTurma) return;
    try {
        const docSnap = await getDoc(doc(db, "turmas", minhaTurma));
        let hb = {}; if(docSnap.exists() && docSnap.data().horario) hb = docSnap.data().horario;
        
        const blocosKeys = ['1', '2', '3', '4', '1300', '5', '6', '7'];
        const blocosTempo = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' };
        const diasMap = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const fDt = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;

        if (alunoHorarioModo === 'dia') {
            let targetDate = new Date(); targetDate.setDate(targetDate.getDate() + alunoHorarioDiaOffset);
            document.getElementById('aluno-horario-display').innerText = `${diasMap[targetDate.getDay()]}, ${fDt(targetDate)}`;

            let html = ''; let temAulasDia = false;
            const dataStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,'0')}-${String(targetDate.getDate()).padStart(2,'0')}`;

            blocosKeys.forEach(bId => {
                const disc = hb[`${dataStr}_${bId}`];
                if(disc) {
                    const sty = getCorEspecial(disc);
                    html += `<div class="horario-list-item" style="border-left-color:${sty.c}; background-color:${sty.bg};"><div class="horario-time-col">${blocosTempo[bId]}</div><div class="horario-disc-col"><div class="horario-disc-name">${disc}</div><div class="horario-prof">Prof. A Atribuir</div></div></div>`;
                    temAulasDia = true;
                }
            });
            subContainer.innerHTML = temAulasDia ? html : '<p class="text-muted center" style="margin-top:30px;">Sem aulas agendadas para este dia.</p>';
        } else {
            let dtT = new Date(); dtT.setDate(dtT.getDate() + (alunoHorarioSemanaOffset * 7));
            dtT.setDate(dtT.getDate() - (dtT.getDay() === 0 ? 6 : dtT.getDay() - 1));
            let dEnd = new Date(dtT); dEnd.setDate(dEnd.getDate() + 4);
            document.getElementById('aluno-horario-display').innerText = `${fDt(dtT)} a ${fDt(dEnd)}`;

            // Grelha Semanal ajustada ao telemóvel
            let html = '<div class="horario-grid" style="min-width:100%;"><div class="horario-header"></div>';
            let dtIter = new Date(dtT);
            ['SEG','TER','QUA','QUI','SEX'].forEach(d => { html += `<div class="horario-header">${d}<span>${fDt(dtIter)}</span></div>`; dtIter.setDate(dtIter.getDate()+1); });
            
            blocosKeys.forEach(bId => {
                html += `<div class="horario-time">${blocosTempo[bId]}</div>`;
                dtIter = new Date(dtT);
                for(let i=0; i<5; i++) {
                    const dStr = `${dtIter.getFullYear()}-${String(dtIter.getMonth()+1).padStart(2,'0')}-${String(dtIter.getDate()).padStart(2,'0')}`;
                    const disc = hb[`${dStr}_${bId}`];
                    if(disc) {
                        const sty = getCorEspecial(disc);
                        html += `<div class="horario-slot" style="border: 1px solid ${sty.c}; background-color: ${sty.bg}; color: white;"><strong>${disc}</strong></div>`;
                    } else html += `<div class="horario-slot"></div>`;
                    dtIter.setDate(dtIter.getDate()+1);
                }
            });
            subContainer.innerHTML = html + '</div>';
        }
    } catch(e) {}
}

// ----------------------------------------------------
// FÓRUM MAGIA E MODAL PRO
// ----------------------------------------------------
let chatUnsubscribeAluno = null; let alunoForumAtivoId = null;

document.getElementById('btn-create-chat-aluno')?.addEventListener('click', () => {
    document.getElementById('modal-criar-forum').style.display = 'flex';
});

document.getElementById('btn-cancelar-novo-forum')?.addEventListener('click', () => {
    document.getElementById('modal-criar-forum').style.display = 'none';
    document.getElementById('input-nome-novo-forum').value = '';
});

document.getElementById('btn-confirmar-novo-forum')?.addEventListener('click', async () => {
    const nomeGrupo = document.getElementById('input-nome-novo-forum').value.trim();
    if(!nomeGrupo) return;
    try {
        await addDoc(collection(db, "turmas", minhaTurma, "foruns"), {
            nome: nomeGrupo, tipo: 'permanente', isDefault: false, membros: [myUserId], criadoPor: myUserName
        });
        document.getElementById('modal-criar-forum').style.display = 'none';
        document.getElementById('input-nome-novo-forum').value = '';
        alert("Grupo de Trabalho criado com sucesso!");
        carregarForuns();
    } catch(e) {}
});

async function carregarForuns() {
    const container = document.getElementById('aluno-forum-channel-list'); container.innerHTML = '<p class="text-muted center">A configurar fóruns mágicos...</p>'; 
    if(!minhaTurma) return;
    
    let html = `
        <h3 style="font-size:1rem; color:var(--text-muted); margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">Apoio & Turma</h3>
        <div class="canal-card" data-id="turma_global" data-nome="Turma ${minhaTurma} (Geral)">
            <div class="canal-icon" style="color:#00cc88; border-color:#00cc88;"><i class="fa-solid fa-users"></i></div>
            <div class="canal-info"><h4>Turma ${minhaTurma}</h4><p>Canal Geral</p></div>
        </div>
        <div class="canal-card" data-id="dt_${myUserId}" data-nome="Chat c/ Diretor de Turma">
            <div class="canal-icon" style="color:#ffaa00; border-color:#ffaa00;"><i class="fa-solid fa-user-tie"></i></div>
            <div class="canal-info"><h4>Diretor de Turma</h4><p>Mensagem Privada</p></div>
        </div>

        <h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Disciplinas</h3>
        <div style="display:flex; flex-wrap:wrap; gap:10px;">
    `;
    
    ordemDisciplinasGlobal.forEach(disc => {
        html += `<div class="canal-card" data-id="disc_${disc}" data-nome="Fórum ${disc}" style="flex: 1 1 45%; padding: 10px;">
                    <div class="canal-info" style="text-align:center;"><h4 style="margin:0; font-size:0.9rem; color:#00d2ff;"><i class="fa-solid fa-book-open"></i> ${disc}</h4></div>
                 </div>`;
    });
    html += '</div>';

    try {
        const res = await getDocs(collection(db, "turmas", minhaTurma, "foruns"));
        let extrasHtml = '';
        res.forEach(docSnap => { 
            const f = docSnap.data(); 
            if(f.membros.includes(myUserId) && !f.isDefault) { 
                extrasHtml += `<div class="canal-card" data-id="${docSnap.id}" data-nome="${f.nome}"><div class="canal-icon" style="color:#b82bf2; border-color:#b82bf2;"><i class="fa-solid fa-comments"></i></div><div class="canal-info"><h4>${f.nome}</h4><p>Grupo de Trabalho</p></div></div>`; 
            } 
        });
        
        if (extrasHtml !== '') {
            html += `<h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Grupos de Trabalho</h3>` + extrasHtml;
        }
    } catch(e) {}

    container.innerHTML = html;
    
    container.querySelectorAll('.canal-card').forEach(card => card.addEventListener('click', (e) => { 
        alunoForumAtivoId = e.currentTarget.getAttribute('data-id'); 
        document.getElementById('aluno-chat-active-title').innerText = e.currentTarget.getAttribute('data-nome'); 
        document.getElementById('aluno-forum-channel-list').style.display = 'none'; 
        document.getElementById('aluno-forum-chat-view').style.display = 'flex'; 
        document.getElementById('btn-create-chat-aluno').style.display = 'none';
        iniciarChatAluno(alunoForumAtivoId); 
    }));
}

document.getElementById('btn-aluno-voltar-canais')?.addEventListener('click', () => { 
    document.getElementById('aluno-forum-chat-view').style.display = 'none'; 
    document.getElementById('aluno-forum-channel-list').style.display = 'block'; 
    document.getElementById('btn-create-chat-aluno').style.display = 'block';
});

function iniciarChatAluno(fId) {
    const chatContainer = document.getElementById('aluno-chat-messages-container'); chatContainer.innerHTML = ''; if(chatUnsubscribeAluno) chatUnsubscribeAluno();
    chatUnsubscribeAluno = onSnapshot(query(collection(db, "turmas", minhaTurma, "foruns", fId, "mensagens"), orderBy("timestamp")), (snapshot) => {
        let html = ''; snapshot.forEach(doc => { const msg = doc.data(); const isMe = msg.remetente === myUserName; const classe = isMe ? 'admin' : 'student'; html += `<div class="chat-bubble ${classe}"><strong>${isMe ? 'Tu' : msg.remetente}</strong><br>${msg.texto}<span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>`; });
        chatContainer.innerHTML = html; chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}
document.getElementById('btn-aluno-send-msg')?.addEventListener('click', async () => { const inp = document.getElementById('aluno-input-forum-msg'); const txt = inp.value.trim(); if(!txt || !alunoForumAtivoId) return; try { await addDoc(collection(db, "turmas", minhaTurma, "foruns", alunoForumAtivoId, "mensagens"), { remetente: myUserName, texto: txt, timestamp: Date.now() }); inp.value = ''; } catch(e) {} });

// ----------------------------------------------------
// SUMÁRIOS
// ----------------------------------------------------
const viewSumarios = document.getElementById('view-aluno-sumarios');
document.getElementById('btn-open-sumarios')?.addEventListener('click', () => { esconderTodasAsVistas(); navItems.forEach(nav => nav.classList.remove('active')); viewSumarios.style.display = 'block'; carregarSumariosAluno(); });
document.getElementById('btn-voltar-sumarios')?.addEventListener('click', () => { esconderTodasAsVistas(); document.querySelector('.nav-item[data-target="student-dashboard"]').classList.add('active'); document.getElementById('student-dashboard').style.display = 'block'; });
document.getElementById('aluno-filtro-sumarios-disc')?.addEventListener('change', carregarSumariosAluno);

async function carregarSumariosAluno() {
    const container = document.getElementById('aluno-lista-sumarios-container'); container.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar sumários...</p>'; if(!minhaTurma) return;
    try {
        const res = await getDocs(query(collection(db, "turmas", minhaTurma, "sumarios"))); if(res.empty) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Nenhum material publicado pelos professores.</p>'; return; }
        let sumarios = []; let disciplinasUnicas = new Set(); res.forEach(d => { const data = d.data(); sumarios.push({id: d.id, ...data}); disciplinasUnicas.add(data.disciplina); });
        const filtroSelect = document.getElementById('aluno-filtro-sumarios-disc'); if (filtroSelect.options.length <= 1) { let optHTML = '<option value="">Todas as Disciplinas</option>'; disciplinasUnicas.forEach(disc => optHTML += `<option value="${disc}">${disc}</option>`); filtroSelect.innerHTML = optHTML; }
        const filtroAtual = filtroSelect.value; if(filtroAtual) sumarios = sumarios.filter(s => s.disciplina === filtroAtual); sumarios.sort((a,b) => b.data.localeCompare(a.data)); 
        if(sumarios.length === 0) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Sem sumários para esta disciplina.</p>'; return; }
        let html = ''; sumarios.forEach(s => { const anexoBtn = s.anexoBase64 ? `<a href="${s.anexoBase64}" download="${s.anexoNome}" class="primary-btn small-btn" style="display:inline-block; margin-top:10px; width:auto; padding:8px 12px; background-color:#0099ff;"><i class="fa-solid fa-download"></i> Baixar ${s.anexoNome}</a>` : ''; html += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #0099ff;"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">${s.data} | ${s.disciplina} | Prof. ${s.professor}</span><h4 style="margin:5px 0;">${s.titulo}</h4>${s.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">${s.descricao}</p>` : ''}</div></div>${anexoBtn}</div>`; }); container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p class="text-danger center">Erro ao carregar os dados.</p>'; }
}

// ----------------------------------------------------
// CADERNO DIGITAL (Com Galeria de Fotos e Resumos JS)
// ----------------------------------------------------
document.getElementById('tab-caderno-resumos')?.addEventListener('click', (e) => { 
    e.currentTarget.classList.add('active'); document.getElementById('tab-caderno-galeria').classList.remove('active'); 
    document.getElementById('sec-caderno-resumos').style.display = 'block'; document.getElementById('sec-caderno-galeria').style.display = 'none'; 
});
document.getElementById('tab-caderno-galeria')?.addEventListener('click', (e) => { 
    e.currentTarget.classList.add('active'); document.getElementById('tab-caderno-resumos').classList.remove('active'); 
    document.getElementById('sec-caderno-resumos').style.display = 'none'; document.getElementById('sec-caderno-galeria').style.display = 'block'; 
    carregarFotosQuadro(); 
});

let fotoQuadroBase64 = "";
document.getElementById('upload-foto-quadro')?.addEventListener('change', async (e) => {
    let file = e.target.files[0]; if(!file) return;
    if (file.type.startsWith('image/')) { 
        const options = { maxSizeMB: 0.8, maxWidthOrHeight: 1920, useWebWorker: true }; 
        try { file = await imageCompression(file, options); } catch (err) {} 
    }
    document.getElementById('foto-quadro-file-name').innerText = file.name; 
    document.getElementById('btn-gravar-foto-quadro').style.display = 'block';
    const reader = new FileReader(); reader.onload = (ev) => { fotoQuadroBase64 = ev.target.result; }; reader.readAsDataURL(file);
});

document.getElementById('btn-gravar-foto-quadro')?.addEventListener('click', async (e) => {
    const titulo = document.getElementById('foto-titulo').value.trim();
    if(!titulo || !fotoQuadroBase64) { alert("Preenche o título e anexa a foto!"); return; }
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...'; btnRef.disabled = true;
    try {
        await addDoc(collection(db, "utilizadores", myUserId, "caderno_fotos"), { titulo: titulo, fotoBase64: fotoQuadroBase64, timestamp: Date.now() });
        btnRef.style.backgroundColor = "var(--primary-green)"; btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Foto Guardada!'; 
        setTimeout(() => { btnRef.style.display = 'none'; btnRef.disabled = false; btnRef.style.backgroundColor = "var(--success-green)"; btnRef.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Guardar na Galeria'; document.getElementById('foto-quadro-file-name').innerText = ""; document.getElementById('foto-titulo').value = ""; fotoQuadroBase64 = ""; carregarFotosQuadro(); }, 2000);
    } catch(err) { btnRef.innerHTML = "Erro!"; setTimeout(() => { btnRef.disabled = false; btnRef.innerHTML = '<i class="fa-solid fa-cloud-arrow-up"></i> Guardar na Galeria'; }, 2000); }
});

async function carregarFotosQuadro() {
    const cont = document.getElementById('lista-fotos-quadro-container'); cont.innerHTML = '<p class="text-muted" style="grid-column: span 2; text-align:center;">A carregar galeria...</p>';
    try {
        const snap = await getDocs(query(collection(db, "utilizadores", myUserId, "caderno_fotos"), orderBy("timestamp", "desc")));
        if(snap.empty) { cont.innerHTML = '<p class="text-muted" style="grid-column: span 2; text-align:center;">Sem fotos na galeria.</p>'; return; }
        let html = '';
        snap.forEach(d => {
            const data = d.data();
            html += `<div style="background:var(--bg-card); border:1px solid #333; border-radius:8px; overflow:hidden; position:relative; box-shadow:0 4px 10px rgba(0,0,0,0.3);">
                        <div style="height: 120px; background: url('${data.fotoBase64}') center/cover no-repeat; cursor:pointer;" onclick="window.open('${data.fotoBase64}')"></div>
                        <div style="padding: 10px; font-size: 0.85rem;">
                            <strong style="color:white; display:block; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${data.titulo}</strong>
                            <span style="color:var(--text-muted); font-size:0.7rem;">${new Date(data.timestamp).toLocaleDateString('pt-PT')}</span>
                        </div>
                     </div>`;
        });
        cont.innerHTML = html;
    } catch(e) { cont.innerHTML = '<p class="text-danger center" style="grid-column: span 2;">Erro ao carregar fotos.</p>'; }
}

// ----------------------------------------------------
// POMODORO COM MÚSICA
// ----------------------------------------------------
document.getElementById('btn-load-music')?.addEventListener('click', () => {
    const url = document.getElementById('pomodoro-music-url').value.trim();
    const iframeContainer = document.getElementById('music-player-frame');
    if(!url) return;
    
    let embedUrl = "";
    if (url.includes('spotify.com')) {
        embedUrl = url.replace("open.spotify.com", "open.spotify.com/embed");
        iframeContainer.innerHTML = `<iframe style="border-radius:12px" src="${embedUrl}" width="100%" height="80" frameBorder="0" allowfullscreen="" allow="autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture"></iframe>`;
        iframeContainer.style.display = 'block';
    } else if (url.includes('youtube.com') || url.includes('youtu.be')) {
        // Conversão básica de vídeo YT para Embed
        let videoId = "";
        if (url.includes('youtu.be/')) videoId = url.split('youtu.be/')[1].split('?')[0];
        else if (url.includes('v=')) videoId = url.split('v=')[1].split('&')[0];
        
        if (videoId) {
            iframeContainer.innerHTML = `<iframe width="100%" height="150" src="https://www.youtube.com/embed/${videoId}" title="YouTube video player" frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen></iframe>`;
            iframeContainer.style.display = 'block';
        }
    } else {
        alert("Apenas links do Spotify ou YouTube são suportados de momento.");
    }
});

async function pedirPermissaoNotificacoes() { try { const permission = await Notification.requestPermission(); if (permission === 'granted') { const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js'); const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }); if (currentToken) { await updateDoc(doc(db, "utilizadores", myUserId), { tokenNotificacao: currentToken }); } } } catch (error) { console.error("Erro fatal ao ativar notificações:", error); } }
if(typeof onMessage !== "undefined" && messaging) { onMessage(messaging, (payload) => { alert(`NOVA NOTIFICAÇÃO:\n\n${payload.notification.title}\n${payload.notification.body}`); }); }
setTimeout(() => { if(myUserId) pedirPermissaoNotificacoes(); }, 4000);
