import { auth, db, messaging, VAPID_KEY, getToken, onMessage } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, updateDoc, getDocs, query, addDoc, onSnapshot, orderBy, setDoc, enableIndexedDbPersistence, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Ativar modo Offline da base de dados
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
                if(dados.papel !== 'aluno') {
                    window.location.href = "index.html"; 
                    return;
                }
                
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
                
                // MÓDULO: DASHBOARD ADAPTATIVO
                construirHomeAdaptativa(dados);
                
                // Atualizar Sino de Notificações
                const timelineEvents = await obterEventosLinhaTemporal();
                if (timelineEvents.length > 0) {
                    const badge = document.getElementById('badge-notificacoes');
                    badge.innerText = timelineEvents.length > 9 ? '9+' : timelineEvents.length;
                    badge.style.display = 'flex';
                }

                // LER DADOS DA TURMA (Época de Exames)
                if (minhaTurma) {
                    const turmaSnap = await getDoc(doc(db, "turmas", minhaTurma));
                    if (turmaSnap.exists()) {
                        const tData = turmaSnap.data();
                        
                        if(tData.epocaExames && tData.epocaExames.ativa) {
                            document.getElementById('exam-mode-banner').style.display = 'block';
                            document.body.style.borderTop = "5px solid #8e2de2"; 
                            
                            if(tData.epocaExames.dataFim) {
                                const hoje = new Date();
                                const fim = new Date(tData.epocaExames.dataFim);
                                const diffTime = fim - hoje;
                                const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
                                
                                const txt = diffDays > 0 ? `Faltam ${diffDays} dias` : (diffDays === 0 ? "É Hoje!" : "Já terminou");
                                document.getElementById('exam-countdown').innerText = txt;
                            } else {
                                document.getElementById('exam-countdown').innerText = "Em curso";
                            }
                        }
                    }
                }
            }
        } catch (e) { console.error("Erro ao ler perfil", e); }
    } else { 
        window.location.href = "index.html"; 
    }
});

document.getElementById('btn-logout-aluno')?.addEventListener('click', () => { signOut(auth).then(() => window.location.href = "index.html"); });

// ----------------------------------------------------
// O DASHBOARD ADAPTATIVO MÁGICO (HOME)
// ----------------------------------------------------
async function construirHomeAdaptativa(dadosAluno) {
    const container = document.getElementById('dynamic-hero-section');
    if(!container) return;
    container.innerHTML = '<p class="text-muted center">A preparar o teu assistente...</p>';

    let temFaltas = 0; let eventosBreves = []; let prhfsAtivos = 0;
    try {
        const faltasSnap = await getDocs(collection(db, "utilizadores", myUserId, "faltas"));
        faltasSnap.forEach(d => { const f = d.data(); if (!f.justificada && !f.comprovativoEnviado) temFaltas++; });

        const evSnap = await getDocs(collection(db, "eventos"));
        const hoje = new Date(); const daquiA7Dias = new Date(); daquiA7Dias.setDate(hoje.getDate() + 7);
        const hojeISO = hoje.toISOString().split('T')[0]; const limiteISO = daquiA7Dias.toISOString().split('T')[0];
        
        evSnap.forEach(d => {
            const e = d.data();
            if (e.data >= hojeISO && e.data <= limiteISO && ['teste','avaliacao','entrega','trabalho'].includes(e.tipo)) {
                eventosBreves.push(e);
            }
        });
        eventosBreves.sort((a,b) => a.data.localeCompare(b.data));

        const prhfSnap = await getDocs(collection(db, "utilizadores", myUserId, "prhfs"));
        prhfSnap.forEach(d => { if (d.data().status !== 'concluida') prhfsAtivos++; });

        let heroHTML = ''; let showHumorAndMission = false;

        // PRIORIDADE 1: VERMELHO
        if (temFaltas > 0 || prhfsAtivos > 0) {
            heroHTML = `
                <div class="card" style="background: linear-gradient(135deg, #ff4d4d, #cc0000); color: white; border: none; border-radius: 16px; margin-bottom: 20px;">
                    <h3 style="margin-bottom:10px; font-size: 1.3rem;"><i class="fa-solid fa-triangle-exclamation"></i> Ação Necessária</h3>
                    <p style="font-size: 0.95rem; margin-bottom: 15px; opacity: 0.9;">Tens pendências que precisam da tua atenção imediata.</p>
                    <ul style="margin-bottom: 15px; padding-left: 20px; font-size: 0.9rem; font-weight: bold;">
                        ${temFaltas > 0 ? `<li>${temFaltas} Falta(s) por justificar</li>` : ''}
                        ${prhfsAtivos > 0 ? `<li>${prhfsAtivos} PRHF(s) em curso</li>` : ''}
                    </ul>
                    <button class="primary-btn" style="background: white; color: #cc0000;" onclick="document.querySelector('.nav-item[data-target=\\'view-aluno-caderneta\\']').click()"><i class="fa-solid fa-book-open"></i> Abrir Caderneta e Resolver</button>
                </div>
            `;
        } 
        // PRIORIDADE 2: LARANJA
        else if (eventosBreves.length > 0) {
            let ev = eventosBreves[0];
            const dataF = ev.data.split('-').reverse().join('/');
            heroHTML = `
                <div class="card" style="background: linear-gradient(135deg, #ffaa00, #e67e22); color: white; border: none; border-radius: 16px; margin-bottom: 20px;">
                    <h3 style="margin-bottom:10px; font-size: 1.3rem;"><i class="fa-solid fa-calendar-exclamation"></i> Foco Total</h3>
                    <p style="font-size: 0.95rem; margin-bottom: 15px; opacity: 0.9;">Tens <strong>${ev.titulo}</strong> no dia ${dataF}. Concentra-te hoje para não deixares para a véspera!</p>
                    <div style="display: flex; gap: 10px;">
                        <button class="primary-btn" style="background: white; color: #e67e22; flex: 1;" onclick="document.getElementById('btn-open-study-mode').click()"><i class="fa-solid fa-stopwatch"></i> Iniciar Pomodoro</button>
                    </div>
                </div>
            `;
            showHumorAndMission = true;
        } 
        // PRIORIDADE 3: VERDE
        else {
            heroHTML = `
                <div class="card" style="background: linear-gradient(135deg, #00cc88, #009966); color: white; border: none; border-radius: 16px; margin-bottom: 20px;">
                    <h3 style="margin-bottom:5px; font-size: 1.3rem;"><i class="fa-solid fa-leaf"></i> Tudo em dia!</h3>
                    <p style="font-size: 0.95rem; margin-bottom: 0; opacity: 0.9;">Não tens avaliações marcadas para os próximos dias nem pendências a resolver. Continua o bom trabalho.</p>
                </div>
            `;
            showHumorAndMission = true;
        }

        // MÓDULOS SECUNDÁRIOS
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
// GAMIFICAÇÃO E PERFIL COMPLETO (Nível, XP, Títulos)
// ----------------------------------------------------
function carregarGamificacao(dados) {
    const xp = dados.xp || 0;
    const nivel = Math.floor(xp / 100) + 1;
    const xpProximoNivel = nivel * 100;
    const xpNivelAtual = (nivel - 1) * 100;
    const progresso = ((xp - xpNivelAtual) / (xpProximoNivel - xpNivelAtual)) * 100;

    // Home
    document.getElementById('aluno-nivel').innerText = nivel;
    document.getElementById('aluno-xp-atual').innerText = xp;

    // Perfil
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

// Upload de Avatar no Perfil
document.getElementById('upload-avatar')?.addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if(!file) return;
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
    document.getElementById('student-dashboard'),
    document.getElementById('view-aluno-caderneta'),
    document.getElementById('view-aluno-agenda'),
    document.getElementById('view-aluno-forum'),
    document.getElementById('view-aluno-passaporte'),
    document.getElementById('view-study-mode'),
    document.getElementById('view-aluno-sumarios'),
    document.getElementById('view-aluno-caderno'),
    document.getElementById('view-aluno-notificacoes'),
    document.getElementById('view-aluno-perfil')
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

        if(targetId === 'view-aluno-perfil') {
            carregarObjetivosPessoais();
            renderizarGraficoNotas();
            carregarHistoricoHumor();
        }
    });
});

document.getElementById('btn-open-notificacoes')?.addEventListener('click', () => {
    esconderTodasAsVistas();
    navItems.forEach(nav => nav.classList.remove('active'));
    document.getElementById('view-aluno-notificacoes').style.display = 'block';
    carregarNotificacoesAluno();
});

document.getElementById('btn-voltar-notificacoes')?.addEventListener('click', () => {
    esconderTodasAsVistas();
    document.querySelector('.nav-item[data-target="student-dashboard"]').classList.add('active');
    document.getElementById('student-dashboard').style.display = 'block';
});

// ----------------------------------------------------
// OBJETIVOS PESSOAIS (PERFIL)
// ----------------------------------------------------
async function carregarObjetivosPessoais() {
    const cont = document.getElementById('lista-objetivos-container');
    cont.innerHTML = '<p class="text-muted center">A carregar os teus objetivos...</p>';
    try {
        const snap = await getDocs(query(collection(db, "utilizadores", myUserId, "objetivos"), orderBy("timestamp", "desc")));
        let html = '';
        snap.forEach(d => {
            const obj = d.data();
            const checkColor = obj.concluido ? 'var(--success-green)' : '#444';
            const textDec = obj.concluido ? 'line-through' : 'none';
            const textColor = obj.concluido ? 'var(--text-muted)' : 'white';
            html += `<div style="display:flex; align-items:center; justify-content:space-between; padding:12px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:8px; border-left: 3px solid ${checkColor};">
                        <div style="display:flex; align-items:center; gap:12px; flex:1;">
                            <div onclick="toggleObjetivo('${d.id}', ${!obj.concluido})" style="width:24px; height:24px; border-radius:50%; border:2px solid ${checkColor}; background:${obj.concluido ? checkColor : 'transparent'}; display:flex; align-items:center; justify-content:center; cursor:pointer;">
                                ${obj.concluido ? '<i class="fa-solid fa-check" style="color:var(--bg-dark); font-size:0.75rem;"></i>' : ''}
                            </div>
                            <span style="text-decoration:${textDec}; color:${textColor}; font-size:0.95rem; flex:1;">${obj.texto}</span>
                        </div>
                        <i class="fa-solid fa-trash" style="color:var(--danger-red); cursor:pointer; font-size:0.9rem; padding: 5px;" onclick="apagarObjetivo('${d.id}')"></i>
                     </div>`;
        });
        if(html==='') html = '<p class="text-muted center" style="font-size:0.85rem;">Não tens metas ativas. Começa a desafiar-te!</p>';
        cont.innerHTML = html;
    } catch(e) {}
}

document.getElementById('btn-add-objetivo')?.addEventListener('click', async () => {
    const val = document.getElementById('input-novo-objetivo').value.trim();
    if(!val) return;
    try {
        await addDoc(collection(db, "utilizadores", myUserId, "objetivos"), { texto: val, concluido: false, timestamp: Date.now() });
        document.getElementById('input-novo-objetivo').value = '';
        carregarObjetivosPessoais();
    } catch(e) {}
});

window.toggleObjetivo = async (id, status) => {
    try {
        await updateDoc(doc(db, "utilizadores", myUserId, "objetivos", id), { concluido: status });
        if(status) {
            const snap = await getDoc(doc(db, "utilizadores", myUserId));
            let xp = snap.exists() && snap.data().xp ? snap.data().xp : 0;
            await updateDoc(doc(db, "utilizadores", myUserId), { xp: xp + 50 });
            carregarGamificacao({xp: xp+50});
            alert("🎯 Objetivo alcançado! +50 XP!");
        }
        carregarObjetivosPessoais();
    } catch(e) {}
};

window.apagarObjetivo = async (id) => {
    if(confirm("Queres mesmo eliminar este objetivo?")) {
        try {
            await deleteDoc(doc(db, "utilizadores", myUserId, "objetivos", id));
            carregarObjetivosPessoais();
        } catch(e) {}
    }
};

// ----------------------------------------------------
// ESTATÍSTICAS E GRÁFICOS (CHART.JS) NO PERFIL
// ----------------------------------------------------
let chartInstance = null;
async function renderizarGraficoNotas() {
    const ctx = document.getElementById('chart-notas-aluno');
    if(!ctx) return;
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", myUserId, "notas"));
        let mapNotas = {};
        notasDb.forEach(d => {
            const n = d.data();
            if(n.nota !== 'REP' && !isNaN(n.nota)) {
                if(!mapNotas[n.disciplina]) mapNotas[n.disciplina] = { soma: 0, cont: 0 };
                mapNotas[n.disciplina].soma += Number(n.nota);
                mapNotas[n.disciplina].cont++;
            }
        });
        
        let labels = [];
        let data = [];
        let bgColors = [];
        
        Object.keys(mapNotas).forEach(disc => {
            labels.push(disc);
            const media = (mapNotas[disc].soma / mapNotas[disc].cont).toFixed(1);
            data.push(media);
            bgColors.push(media >= 10 ? '#00cc88' : '#ff4d4d');
        });

        if(labels.length === 0) {
            labels = ["Sem Dados"]; data = [0]; bgColors = ["#333"];
        }

        if(chartInstance) chartInstance.destroy();
        chartInstance = new Chart(ctx, {
            type: 'bar',
            data: {
                labels: labels,
                datasets: [{ label: 'Média Atual', data: data, backgroundColor: bgColors, borderRadius: 6 }]
            },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                scales: {
                    y: { beginAtZero: true, max: 20, ticks: { color: '#a0a0a0', stepSize: 5 }, grid: { color: '#333' } },
                    x: { ticks: { color: '#e0e0e0', font: { size: 10 } }, grid: { display: false } }
                },
                plugins: { legend: { display: false } }
            }
        });
    } catch(e) {}
}

document.getElementById('btn-view-mood-history')?.addEventListener('click', carregarHistoricoHumor);

async function carregarHistoricoHumor() {
    if(!myUserId) return;
    const cont = document.getElementById('mood-history-container');
    cont.innerHTML = '<p class="text-muted center" style="font-size: 0.85rem;">A atualizar...</p>';
    try {
        const res = await getDocs(query(collection(db, "utilizadores", myUserId, "humor"), orderBy("timestamp", "desc")));
        let html = '<div style="display:flex; gap:10px; overflow-x:auto; padding-bottom:10px;">';
        res.forEach(d => {
            const h = d.data();
            const ptDate = h.dataIso.split('-').reverse().slice(0,2).join('/');
            html += `<div style="text-align:center; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px; min-width:60px;">
                        <div style="font-size:1.8rem;">${h.humor}</div>
                        <div style="font-size:0.7rem; color:var(--text-muted); margin-top:5px;">${ptDate}</div>
                     </div>`;
        });
        html += '</div>';
        if(res.empty) html = '<p class="text-muted center" style="font-size:0.85rem; margin:0;">Ainda não tens registos.</p>';
        cont.innerHTML = html;
    } catch(e) { cont.innerHTML = '<p class="text-danger center">Erro.</p>'; }
}

// ----------------------------------------------------
// PESQUISA UNIVERSAL INTELIGENTE
// ----------------------------------------------------
document.getElementById('aluno-search-input')?.addEventListener('input', async (e) => {
    const termo = e.target.value.toLowerCase().trim();
    const box = document.getElementById('aluno-search-results');
    if(termo.length < 2) { box.style.display = 'none'; return; }
    box.innerHTML = '<p class="text-muted" style="margin:0; font-size:0.85rem;">A procurar...</p>'; box.style.display = 'block';

    try {
        let resultados = [];
        const resumosDb = await getDocs(query(collection(db, "utilizadores", myUserId, "apontamentos")));
        resumosDb.forEach(d => {
            const data = d.data();
            if(data.titulo && data.titulo.toLowerCase().includes(termo)) {
                resultados.push({ tipo: 'O Meu Resumo', texto: data.titulo, target: 'view-aluno-caderno' });
            }
        });

        if (minhaTurma) {
            const sumariosDb = await getDocs(query(collection(db, "turmas", minhaTurma, "sumarios")));
            sumariosDb.forEach(d => {
                const data = d.data();
                if(data.titulo && data.titulo.toLowerCase().includes(termo) || (data.disciplina && data.disciplina.toLowerCase().includes(termo))) {
                    resultados.push({ tipo: `Sumário - ${data.disciplina}`, texto: data.titulo, target: 'view-aluno-sumarios' });
                }
            });
        }

        if(resultados.length === 0) {
            box.innerHTML = '<p class="text-muted" style="margin:0; font-size:0.85rem;">Nenhum resultado encontrado.</p>';
        } else {
            let html = '';
            resultados.forEach(r => {
                html += `<div style="padding: 8px; border-bottom: 1px solid #333; cursor: pointer;" onclick="document.querySelector('.nav-item[data-target=\\'${r.target}\\']').click(); document.getElementById('aluno-search-results').style.display='none'; document.getElementById('aluno-search-input').value='';">
                    <span style="font-size:0.7rem; color:var(--primary-green); text-transform:uppercase;">${r.tipo}</span>
                    <div style="font-size:0.9rem; color:white; margin-top:3px;">${r.texto}</div>
                </div>`;
            });
            box.innerHTML = html;
        }

    } catch(err) { box.innerHTML = '<p class="text-danger" style="margin:0;">Erro na pesquisa.</p>'; }
});

document.addEventListener('click', (e) => {
    if (!e.target.closest('#aluno-search-input') && !e.target.closest('#aluno-search-results')) {
        document.getElementById('aluno-search-results').style.display = 'none';
    }
});

// ----------------------------------------------------
// PASSAPORTE FCT & PAP
// ----------------------------------------------------
document.getElementById('btn-abrir-passaporte')?.addEventListener('click', () => { navItems.forEach(nav => nav.classList.remove('active')); esconderTodasAsVistas(); document.getElementById('view-aluno-passaporte').style.display = 'block'; });
document.getElementById('btn-voltar-passaporte')?.addEventListener('click', () => { navItems.forEach(nav => nav.classList.remove('active')); document.querySelector('.nav-item[data-target="student-dashboard"]').classList.add('active'); esconderTodasAsVistas(); document.getElementById('student-dashboard').style.display = 'block'; });

function carregarDadosPassaporte(dados) {
    const anoMatch = (dados.turma || "").match(/\d+/); const ano = anoMatch ? parseInt(anoMatch[0]) : 0;
    if (ano === 10) { document.getElementById('btn-abrir-passaporte').style.display = 'none'; } 
    else { document.getElementById('btn-abrir-passaporte').style.display = 'flex'; document.getElementById('btn-open-sumarios').style.display = 'flex';
        if (ano === 11) document.getElementById('sec-aluno-pap').style.display = 'none';
        else document.getElementById('sec-aluno-pap').style.display = 'block';
    }

    if(dados.fct) {
        const hr = dados.fct.horasRealizadas !== undefined ? Number(dados.fct.horasRealizadas) : 0;
        const ht = dados.fct.horasTotal !== undefined ? Number(dados.fct.horasTotal) : '-';
        document.getElementById('aluno-fct-horas').innerText = ht !== '-' ? `${hr} / ${ht}h` : `${hr}h registadas`;
        let percFCT = ht !== '-' && ht > 0 ? (hr / ht) * 100 : 0;
        document.getElementById('aluno-fct-progress').style.width = `${Math.min(percFCT, 100)}%`;
        document.getElementById('input-fct-horas').value = hr > 0 ? hr : '';
    }

    if(dados.pap) { document.getElementById('input-pap-tema').value = dados.pap.tema || ''; }
    if (dados.papFicheiroEnviado) document.getElementById('aluno-pap-file-name').innerText = "Ficheiro na posse da escola.";
}

document.getElementById('btn-save-fct')?.addEventListener('click', async (e) => {
    if(!myUserId) return; const inputVal = document.getElementById('input-fct-horas').value.trim(); if(inputVal === '') return;
    const btn = e.currentTarget; const iconOriginal = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
    try { await updateDoc(doc(db, "utilizadores", myUserId), { "fct.horasRealizadas": inputVal }); btn.style.background = 'var(--success-green)'; btn.innerHTML = '<i class="fa-solid fa-check"></i>'; setTimeout(() => { btn.style.background = 'var(--primary-green)'; btn.innerHTML = iconOriginal; btn.disabled = false; }, 2000); } catch(err) { btn.innerHTML = 'Erro'; setTimeout(() => { btn.innerHTML = iconOriginal; btn.disabled = false; }, 2000); }
});

document.getElementById('btn-save-pap-tema')?.addEventListener('click', async (e) => {
    if(!myUserId) return; const inputVal = document.getElementById('input-pap-tema').value.trim(); if(!inputVal) return;
    const btn = e.currentTarget; const iconOriginal = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
    try { await updateDoc(doc(db, "utilizadores", myUserId), { "pap.tema": inputVal }); btn.style.background = 'var(--success-green)'; btn.innerHTML = '<i class="fa-solid fa-check"></i>'; setTimeout(() => { btn.style.background = 'var(--primary-green)'; btn.innerHTML = iconOriginal; btn.disabled = false; }, 2000); } catch(err) { btn.innerHTML = 'Erro'; setTimeout(() => { btn.innerHTML = iconOriginal; btn.disabled = false; }, 2000); }
});

let ficheiroPapBase64 = "";
document.getElementById('aluno-upload-pap')?.addEventListener('change', async (e) => {
    let file = e.target.files[0]; if(!file) return;
    if (file.type.startsWith('image/')) { const options = { maxSizeMB: 0.5, maxWidthOrHeight: 1920, useWebWorker: true }; try { file = await imageCompression(file, options); } catch (err) {} } else { if(file.size > 2097152) { alert("O ficheiro excede os 2MB limite."); return; } }
    document.getElementById('aluno-pap-file-name').innerText = file.name; document.getElementById('aluno-pap-file-name').style.color = "var(--warning-yellow)"; document.getElementById('btn-enviar-pap').style.display = 'block';
    const reader = new FileReader(); reader.onload = (ev) => { ficheiroPapBase64 = ev.target.result; }; reader.readAsDataURL(file);
});

document.getElementById('btn-enviar-pap')?.addEventListener('click', async (e) => {
    if(!ficheiroPapBase64 || !myUserId) return;
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar...'; btnRef.disabled = true;
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", myUserId)); let atualXp = docSnap.exists() && docSnap.data().xp ? docSnap.data().xp : 0;
        await updateDoc(doc(db, "utilizadores", myUserId), { papFicheiroEnviado: true, papFicheiroBase64: ficheiroPapBase64, papDataEnvio: new Date().toISOString(), xp: atualXp + 200 });
        btnRef.style.backgroundColor = "var(--success-green)"; btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Submetido (+200 XP!)'; carregarGamificacao({xp: atualXp + 200});
        setTimeout(() => { btnRef.style.display = 'none'; btnRef.disabled = false; btnRef.style.backgroundColor = "var(--primary-green)"; btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submeter à Escola'; document.getElementById('aluno-pap-file-name').innerText = "Ficheiro na posse da escola."; document.getElementById('aluno-pap-file-name').style.color = "var(--success-green)"; }, 3000);
    } catch(err) { btnRef.innerHTML = "Erro!"; setTimeout(() => { btnRef.disabled = false; btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Submeter à Escola'; }, 2000); }
});

// ----------------------------------------------------
// MODO FOCO & DIÁRIO DE ESTUDO
// ----------------------------------------------------
let pomodoroTimer; let pomodoroRestante = 25 * 60; 
document.getElementById('btn-open-study-mode')?.addEventListener('click', () => { esconderTodasAsVistas(); navItems.forEach(nav => nav.classList.remove('active')); document.getElementById('view-study-mode').style.display = 'flex'; });
document.getElementById('btn-voltar-study')?.addEventListener('click', () => { esconderTodasAsVistas(); document.querySelector('.nav-item[data-target="student-dashboard"]').classList.add('active'); document.getElementById('student-dashboard').style.display = 'block'; document.getElementById('post-study-log').style.display = 'none'; document.getElementById('study-controls').style.display = 'block'; });

document.getElementById('btn-start-study')?.addEventListener('click', (e) => {
    e.currentTarget.style.display = 'none'; document.getElementById('btn-stop-study').style.display = 'inline-block';
    pomodoroTimer = setInterval(() => {
        pomodoroRestante--;
        const m = Math.floor(pomodoroRestante / 60).toString().padStart(2, '0'); const s = (pomodoroRestante % 60).toString().padStart(2, '0');
        document.getElementById('study-timer-text').innerText = `${m}:${s}`;
        if(pomodoroRestante <= 0) { clearInterval(pomodoroTimer); document.getElementById('study-controls').style.display = 'none'; document.getElementById('post-study-log').style.display = 'block'; }
    }, 1000);
});

document.getElementById('btn-stop-study')?.addEventListener('click', resetPomodoro);
function resetPomodoro() { clearInterval(pomodoroTimer); pomodoroRestante = 25 * 60; document.getElementById('study-timer-text').innerText = "25:00"; document.getElementById('btn-stop-study').style.display = 'none'; document.getElementById('btn-start-study').style.display = 'inline-block'; }

document.getElementById('btn-save-study-log')?.addEventListener('click', async (e) => {
    const texto = document.getElementById('study-log-text').value.trim(); if(!texto || !myUserId) return;
    const btn = e.currentTarget; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...'; btn.disabled = true;
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", myUserId)); let atualXp = docSnap.exists() && docSnap.data().xp ? docSnap.data().xp : 0;
        await addDoc(collection(db, "utilizadores", myUserId, "estudos"), { texto: texto, data: new Date().toISOString() });
        await updateDoc(doc(db, "utilizadores", myUserId), { xp: atualXp + 50 });
        btn.style.backgroundColor = "var(--success-green)"; btn.innerHTML = '<i class="fa-solid fa-check"></i> Feito! +50 XP'; carregarGamificacao({xp: atualXp + 50});
        setTimeout(() => { document.getElementById('study-log-text').value = ''; document.getElementById('post-study-log').style.display = 'none'; document.getElementById('study-controls').style.display = 'block'; btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar e Ganhar XP'; btn.style.backgroundColor = "var(--success-green)"; btn.disabled = false; resetPomodoro(); document.getElementById('btn-voltar-study').click(); }, 2000);
    } catch(err) { btn.innerHTML = "Erro!"; setTimeout(() => { btn.disabled = false; btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar e Ganhar XP'; }, 2000); }
});

// ----------------------------------------------------
// CADERNETA, TIMELINE E NOTIFICAÇÕES
// ----------------------------------------------------
const tabTimeline = document.getElementById('tab-aluno-timeline'); const tabNotas = document.getElementById('tab-aluno-notas'); const tabFaltas = document.getElementById('tab-aluno-faltas'); const tabPrhfs = document.getElementById('tab-aluno-prhfs'); const tabComportamento = document.getElementById('tab-aluno-comportamento'); const tabObservacoes = document.getElementById('tab-aluno-observacoes'); const cadernetaContent = document.getElementById('aluno-caderneta-content');
tabTimeline?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-comportamento', 'tab-aluno-observacoes']); carregarTimelineAluno(); }); tabNotas?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-timeline', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-comportamento', 'tab-aluno-observacoes']); carregarNotasAluno(); }); tabFaltas?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-timeline', 'tab-aluno-notas', 'tab-aluno-prhfs', 'tab-aluno-comportamento', 'tab-aluno-observacoes']); carregarFaltasAluno(); }); tabPrhfs?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-timeline', 'tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-comportamento', 'tab-aluno-observacoes']); carregarPrhfsAluno(); }); tabComportamento?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-timeline', 'tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-observacoes']); carregarComportamentoAluno(); }); tabObservacoes?.addEventListener('click', (e) => { ativarTab(e.currentTarget, ['tab-aluno-timeline', 'tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-comportamento']); carregarObservacoesAluno(); });
document.querySelector('.nav-item[data-target="view-aluno-caderneta"]')?.addEventListener('click', () => { ativarTab(tabTimeline, ['tab-aluno-notas', 'tab-aluno-faltas', 'tab-aluno-prhfs', 'tab-aluno-comportamento', 'tab-aluno-observacoes']); carregarTimelineAluno(); });
function ativarTab(tabAtiva, tabsInativasIds) { if(!tabAtiva) return; tabAtiva.classList.add('active'); tabsInativasIds.forEach(id => document.getElementById(id)?.classList.remove('active')); cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar...</p>'; }

async function obterEventosLinhaTemporal() {
    let eventos = []; if(!myUserId) return eventos;
    const notasSnap = await getDocs(collection(db, "utilizadores", myUserId, "notas")); notasSnap.forEach(d => { const n = d.data(); eventos.push({ time: new Date(n.data).getTime(), icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', titulo: 'Nova Avaliação Lançada', desc: `${n.disciplina} (Mod. ${n.modulo}): <strong>${n.nota}</strong>` }); });
    const faltasSnap = await getDocs(collection(db, "utilizadores", myUserId, "faltas")); faltasSnap.forEach(d => { const f = d.data(); eventos.push({ time: new Date(f.criadoEm || f.dataInicio).getTime(), icon: '<i class="fa-solid fa-user-xmark"></i>', cor: f.justificada ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Falta a ${f.disciplina} (${f.horas}h)`, desc: f.justificada ? `Estado: Justificada` : `Atenção: Falta por justificar!` }); });
    const ocSnap = await getDocs(collection(db, "utilizadores", myUserId, "ocorrencias")); ocSnap.forEach(d => { const o = d.data(); eventos.push({ time: o.timestamp, icon: o.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>', cor: o.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Registo Disciplinar`, desc: `<strong>${o.titulo}</strong><br><span style="font-size:0.8rem; color:#aaa;">${o.descricao || ''}</span>` }); });
    const humorSnap = await getDocs(collection(db, "utilizadores", myUserId, "humor")); humorSnap.forEach(d => { const h = d.data(); eventos.push({ time: h.timestamp, icon: '<i class="fa-solid fa-heart-pulse"></i>', cor: '#b82bf2', titulo: `Check-in Emocional`, desc: `Sentiste-te ${h.humor}. (+10 XP)` }); });
    eventos.sort((a,b) => b.time - a.time); return eventos;
}

async function carregarTimelineAluno() {
    cadernetaContent.innerHTML = '<p class="text-muted center">A construir o teu histórico...</p>';
    try {
        const eventos = await obterEventosLinhaTemporal();
        if(eventos.length === 0) { cadernetaContent.innerHTML = '<p class="text-muted center" style="margin-top:40px;">O teu histórico está limpo.</p>'; return; }
        let html = '<div class="timeline">'; eventos.forEach(ev => { html += `<div class="timeline-item"><div class="timeline-icon" style="color: ${ev.cor}; border-color: ${ev.cor};">${ev.icon}</div><div class="timeline-content" style="border-left: 3px solid ${ev.cor};"><span class="timeline-date">${new Date(ev.time).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span><strong style="color:white; display:block; margin-bottom:5px;">${ev.titulo}</strong><p style="font-size:0.85rem; color:var(--text-light); margin:0;">${ev.desc}</p></div></div>`; }); cadernetaContent.innerHTML = html + '</div>';
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao carregar histórico.</p>'; }
}

async function carregarNotificacoesAluno() {
    const container = document.getElementById('aluno-notificacoes-container'); container.innerHTML = '<p class="text-muted center">A ler notificações...</p>';
    try {
        const eventos = await obterEventosLinhaTemporal(); const recentes = eventos.slice(0, 15);
        if(recentes.length === 0) { container.innerHTML = '<p class="text-muted center" style="margin-top:40px;">Sem alertas recentes.</p>'; return; }
        let html = ''; recentes.forEach(ev => { html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${ev.cor}; display:flex; align-items:flex-start; gap: 15px; padding: 15px;"><div style="font-size: 1.5rem; color: ${ev.cor};">${ev.icon}</div><div><strong style="color:white; font-size:1rem; display:block; margin-bottom:3px;">${ev.titulo}</strong><span style="font-size:0.85rem; color:var(--text-light);">${ev.desc}</span><div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px;">${new Date(ev.time).toLocaleString('pt-PT')}</div></div></div>`; }); container.innerHTML = html; document.getElementById('badge-notificacoes').style.display = 'none';
    } catch(e) { container.innerHTML = '<p class="text-danger center">Erro ao carregar notificações.</p>'; }
}

async function carregarNotasAluno() {
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", myUserId, "notas"));
        if(notasDb.empty) { cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">Ainda não tens notas lançadas.</p>'; return; }
        let html = '<div class="stats-grid" style="grid-template-columns: 1fr;">'; notasDb.forEach(d => { const nota = d.data(); const cor = (nota.nota === 'REP' || Number(nota.nota) < 10) ? 'var(--danger-red)' : 'var(--success-green)'; html += `<div class="card" style="display:flex; justify-content:space-between; align-items:center; border-left: 4px solid ${cor};"><div><strong>${nota.disciplina}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">Módulo ${nota.modulo}</span></div><div style="font-size:1.4rem; font-weight:bold; color:${cor};">${nota.nota}</div></div>`; }); cadernetaContent.innerHTML = html + '</div>';
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao ler notas.</p>'; }
}

async function carregarFaltasAluno() {
    try {
        const faltasDb = await getDocs(collection(db, "utilizadores", myUserId, "faltas"));
        if(faltasDb.empty) { cadernetaContent.innerHTML = '<div style="text-align:center; padding:30px;"><i class="fa-solid fa-check-circle" style="font-size:3rem; color:var(--success-green); margin-bottom:15px;"></i><p class="text-muted">Parabéns! Não tens faltas registadas.</p></div>'; return; }
        let faltasArr = []; faltasDb.forEach(d => { faltasArr.push(d.data()); }); faltasArr.sort((a,b) => b.dataInicio.localeCompare(a.dataInicio)); 
        let html = ''; faltasArr.forEach(f => { const statusColor = f.justificada ? 'var(--success-green)' : 'var(--danger-red)'; const statusTxt = f.justificada ? 'Justificada' : (f.comprovativoEnviado ? 'Em Análise (DT)' : 'Injustificada'); html += `<div class="card" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;"><div><strong>${f.disciplina}</strong> (${f.horas}h)<br><span style="font-size:0.8rem; color:var(--text-muted);">${f.dataInicio}</span></div><span style="font-size:0.8rem; font-weight:bold; color:${statusColor}; padding:5px 10px; background:rgba(255,255,255,0.05); border-radius:12px;">${statusTxt}</span></div>`; }); cadernetaContent.innerHTML = html;
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao ler faltas.</p>'; }
}

async function carregarPrhfsAluno() {
    try {
        const prhfsDb = await getDocs(collection(db, "utilizadores", myUserId, "prhfs"));
        if(prhfsDb.empty) { cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">Não tens Planos de Recuperação (PRHF) atribuídos.</p>'; return; }
        let html = ''; prhfsDb.forEach(d => { const p = d.data(); const cor = p.status === 'concluida' ? 'var(--success-green)' : 'var(--warning-yellow)'; html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong>${p.disciplina} (Mod. ${p.modulo})</strong><span style="color:${cor}; font-size:0.85rem; font-weight:bold;">${p.status.toUpperCase()}</span></div><p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">${p.descricao}</p><div style="font-size:0.8rem;">Data Limite: <strong>${p.prazo}</strong> | Presenciais: <strong>${p.horasPresenciais}h</strong></div></div>`; }); cadernetaContent.innerHTML = html;
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao ler PRHFs.</p>'; }
}

async function carregarComportamentoAluno() {
    if(!myUserId) return;
    try {
        const res = await getDocs(query(collection(db, "utilizadores", myUserId, "ocorrencias")));
        if(res.empty) { cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">Sem registos disciplinares ou de mérito.</p>'; return; }
        let regs = []; res.forEach(d => regs.push(d.data())); regs.sort((a,b) => b.data.localeCompare(a.data)); 
        let html = ''; regs.forEach(r => { const cor = r.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)'; const ic = r.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>'; html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; align-items:center; gap:8px; color:${cor}; margin-bottom:5px;">${ic} <strong>${r.titulo}</strong></div><span style="font-size:0.75rem; color:var(--text-muted);">Data: ${r.data} | Prof. ${r.autor}</span>${r.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">${r.descricao}</p>` : ''}</div>`; }); cadernetaContent.innerHTML = html;
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao carregar dados.</p>'; }
}

async function carregarObservacoesAluno() {
    if(!myUserId) return;
    try {
        const res = await getDocs(query(collection(db, "utilizadores", myUserId, "observacoes")));
        if(res.empty) { cadernetaContent.innerHTML = '<p class="text-muted" style="text-align:center;">Ainda não existem observações de reunião registadas.</p>'; return; }
        let obsArr = []; res.forEach(d => obsArr.push(d.data())); obsArr.sort((a,b) => b.timestamp - a.timestamp); 
        let html = ''; obsArr.forEach(o => { html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid var(--primary-green);"><div style="display:flex; justify-content:space-between;"><strong style="color: white;">${o.momento}</strong><span style="font-size:0.75rem; color:var(--text-muted);">${o.data}</span></div><p style="margin-top:8px; font-size:0.9rem; line-height: 1.5; color: var(--text-light);">${o.descricao}</p><div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px; text-align:right;">Prof. ${o.autor}</div></div>`; }); cadernetaContent.innerHTML = html;
    } catch(e) { cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao carregar observações.</p>'; }
}

// ----------------------------------------------------
// AGENDA
// ----------------------------------------------------
document.querySelector('.nav-item[data-target="view-aluno-agenda"]')?.addEventListener('click', () => { document.getElementById('tab-aluno-eventos').classList.add('active'); document.getElementById('tab-aluno-horario').classList.remove('active'); carregarAgendaAlunoLocal(); });
document.getElementById('tab-aluno-eventos')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-aluno-horario').classList.remove('active'); carregarAgendaAlunoLocal(); });
document.getElementById('tab-aluno-horario')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-aluno-eventos').classList.remove('active'); document.getElementById('aluno-agenda-content').innerHTML = '<p class="text-muted center">Esta funcionalidade espelhará o horário inserido pelo DT.</p>'; });

async function carregarAgendaAlunoLocal() {
    const containerEL = document.getElementById('aluno-agenda-content'); containerEL.innerHTML = '<p class="text-muted center">A desenhar calendário...</p>';
    try {
        const evDb = await getDocs(collection(db, "eventos")); let eventosFormatados = [];
        evDb.forEach(d => { const e = d.data(); eventosFormatados.push({ title: e.titulo, start: e.data, backgroundColor: '#9b59b6', borderColor: '#9b59b6' }); });
        containerEL.innerHTML = ""; let calendar = new FullCalendar.Calendar(containerEL, { initialView: 'dayGridMonth', locale: 'pt', events: eventosFormatados, headerToolbar: { left: 'prev,next', center: 'title', right: 'today' }, height: 'auto' }); calendar.render();
    } catch(e) { containerEL.innerHTML = '<p class="text-danger center">Erro ao carregar o calendário.</p>'; }
}

// ----------------------------------------------------
// FÓRUM / CHAT
// ----------------------------------------------------
let chatUnsubscribeAluno = null; let alunoForumAtivoId = null;
document.querySelector('.nav-item[data-target="view-aluno-forum"]')?.addEventListener('click', async () => {
    const container = document.getElementById('aluno-forum-channel-list'); container.innerHTML = '<p class="text-muted center">A carregar fóruns...</p>'; if(!minhaTurma) return;
    try {
        const res = await getDocs(collection(db, "turmas", minhaTurma, "foruns")); let html = '';
        res.forEach(docSnap => { const f = docSnap.data(); if(f.membros.includes(myUserId)) { const icon = f.tipo === 'permanente' ? 'fa-comments' : 'fa-stopwatch'; html += `<div class="canal-card" data-id="${docSnap.id}" data-nome="${f.nome}"><div class="canal-icon"><i class="fa-solid ${icon}"></i></div><div class="canal-info"><h4>${f.nome}</h4></div></div>`; } });
        if(html === '') { container.innerHTML = '<p class="text-muted center">Não estás inserido em nenhum canal.</p>'; return; } container.innerHTML = html;
        container.querySelectorAll('.canal-card').forEach(card => card.addEventListener('click', (e) => { alunoForumAtivoId = e.currentTarget.getAttribute('data-id'); document.getElementById('aluno-chat-active-title').innerText = e.currentTarget.getAttribute('data-nome'); document.getElementById('aluno-forum-channel-list').style.display = 'none'; document.getElementById('aluno-forum-chat-view').style.display = 'flex'; iniciarChatAluno(alunoForumAtivoId); }));
    } catch(e) {}
});

document.getElementById('btn-aluno-voltar-canais')?.addEventListener('click', () => { document.getElementById('aluno-forum-chat-view').style.display = 'none'; document.getElementById('aluno-forum-channel-list').style.display = 'block'; });

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

async function pedirPermissaoNotificacoes() { try { const permission = await Notification.requestPermission(); if (permission === 'granted') { const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js'); const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }); if (currentToken) { await updateDoc(doc(db, "utilizadores", myUserId), { tokenNotificacao: currentToken }); } } } catch (error) { console.error("Erro fatal ao ativar notificações:", error); } }
if(typeof onMessage !== "undefined" && messaging) { onMessage(messaging, (payload) => { alert(`NOVA NOTIFICAÇÃO:\n\n${payload.notification.title}\n${payload.notification.body}`); }); }
setTimeout(() => { if(myUserId) pedirPermissaoNotificacoes(); }, 4000);
