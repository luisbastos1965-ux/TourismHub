import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, addDoc, onSnapshot, orderBy, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let myUserId = ""; let myUserName = ""; let educandosArray = []; let educandoAtualId = ""; let turmaAtual = "";
let chartMediaEE = null;

// ==========================================
// A MATRIZ DE REFERÊNCIA OFICIAL
// ==========================================
const matrizAmbos = {
    "Sociocultural": {
        "PORT": {"1": 33, "2": 34, "3": 33, "4": 33, "5": 34, "6": 33, "7": 40, "8": 40, "9": 40},
        "ING": {"1": 27, "2": 24, "3": 24, "4": 24, "5": 24, "6": 24, "7": 24, "8": 24, "9": 24},
        "AI": {"1": 36, "2": 36, "3": 36, "4": 36, "5": 37, "6": 39},
        "EF": {"1": 10, "2": 8, "3": 10, "4": 10, "5": 10, "6": 12, "7": 6, "8": 12, "9": 8, "10": 10, "11": 12, "12": 8, "13": 6, "14": 10, "15": 6, "16": 2},
        "TIC": {"1": 25, "2": 25, "3": 25, "4": 25}
    },
    "Científica": {
        "GEO": {"1": 33, "2": 33, "3": 30, "4": 26, "5": 21, "6": 21, "7": 21, "8": 15},
        "HCA": {"1": 20, "2": 18, "3": 18, "4": 18, "5": 24, "6": 18, "7": 18, "8": 24, "9": 21, "10": 21},
        "MAT": {"1": 33, "2": 27, "3": 20, "4": 20}
    }
};

const matrizAntigoTecnica = {
    "CF": {"1": 24, "2": 21, "3": 21, "4": 21, "5": 21, "6": 21, "7": 9, "8": 15, "9": 15},
    "TIAT": {"1": 27, "2": 24, "3": 24, "4": 24, "5": 33, "6": 30, "7": 30, "8": 30, "9": 36, "10": 30, "11": 33, "12": 30, "13": 24},
    "TCAT": {"1": 33, "2": 33, "3": 30, "4": 33, "5": 36, "6": 36, "7": 24},
    "OTET": {"1": 24, "2": 24, "3": 33, "4": 30, "5": 24, "6": 24, "7": 36, "8": 27, "9": 33, "10": 30, "11": 30, "12": 17}
};

const matrizNovoTecnica = {
    "AET": { "UC00038": 20, "UC03611": 20, "UC03623": 40, "UC03612": 40, "UC03613": 20, "UC03614": 40, "UC00056": 20, "UC03631": 40, "UC00063": 20 },
    "OGOT": { "UC03629": 20, "UC03619": 40, "UC03621": 40, "UC00055": 20, "UC03630": 20, "UC03616": 20, "UC03617": 40, "UC03618": 20, "UC03620": 40, "UC03628": 40, "UC03632": 20 },
    "CMET": { "UC00034": 30, "UC00033": 30, "UC00593": 20, "UC03622": 40, "UC03623": 40, "UC00031": 30, "UC00032": 30, "UC00433": 20, "UC03624": 20, "UC03627": 20 },
    "LNTT": { "UC00044": 50, "UC00071": 50, "UC03615": 40, "UC03625": 20 }
};

// ==========================================
// FUNÇÕES HELPERS (Empty States Ilustrados)
// ==========================================
function getEmptyState(mensagem, icone = "fa-folder-open") {
    return `<div style="text-align:center; padding: 40px 20px; opacity: 0.5;">
                <i class="fa-solid ${icone}" style="font-size: 3.5rem; margin-bottom: 15px; color: var(--text-muted);"></i>
                <p style="font-size: 0.95rem; color: var(--text-muted);">${mensagem}</p>
            </div>`;
}

function getMatriz() {
    const anoMatch = turmaAtual.match(/\d+/);
    const ano = anoMatch ? parseInt(anoMatch[0]) : 10;
    let m = JSON.parse(JSON.stringify(matrizAmbos));
    m["Técnica"] = (ano >= 11) ? matrizAntigoTecnica : matrizNovoTecnica;
    return m;
}

function getMatrizMap() {
    const anoMatch = turmaAtual.match(/\d+/);
    const ano = anoMatch ? parseInt(anoMatch[0]) : 10;
    return {
        "Sociocultural": Object.keys(matrizAmbos["Sociocultural"]),
        "Científica": Object.keys(matrizAmbos["Científica"]),
        "Técnica": (ano >= 11) ? Object.keys(matrizAntigoTecnica) : Object.keys(matrizNovoTecnica)
    };
}

function obterDisciplinasDaMatriz() {
    const map = getMatrizMap();
    return [...map["Sociocultural"], ...map["Científica"], ...map["Técnica"]];
}

function obterDisciplinasDoAno() {
    const anoMatch = turmaAtual.match(/\d+/);
    const ano = anoMatch ? parseInt(anoMatch[0]) : 10;
    
    const base = {
        10: ["PORT", "ING", "AI", "EF", "TIC", "GEO", "HCA", "MAT"],
        11: ["PORT", "ING", "AI", "EF", "GEO", "HCA"],
        12: ["PORT", "ING", "EF", "GEO", "HCA"]
    };
    const tecAntigo = {
        10: ["CF", "TIAT", "TCAT", "OTET"],
        11: ["CF", "TIAT", "TCAT", "OTET"],
        12: ["TIAT", "OTET"]
    };
    const tecNovo = {
        10: ["AET", "OGOT", "CMET", "LNTT"],
        11: ["AET", "OGOT", "CMET", "LNTT"],
        12: ["AET", "OGOT", "CMET"]
    };
    
    let arr = [...(base[ano] || base[10])];
    if (ano >= 11) arr = [...arr, ...(tecAntigo[ano] || tecAntigo[11])];
    else arr = [...arr, ...(tecNovo[ano] || tecNovo[10])];
    return arr;
}

// ==========================================
// ARRANQUE E NAVEGAÇÃO BÁSICA
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            if (docSnap.exists() && docSnap.data().papel === 'ee') {
                const dados = docSnap.data(); 
                myUserName = dados.nome || "Encarregado";
                
                let arr = [];
                if (dados.educandos && Array.isArray(dados.educandos)) { arr = dados.educandos; } 
                else if (dados.educandoId && Array.isArray(dados.educandoId)) { arr = dados.educandoId; } 
                else if (dados.educandoId && typeof dados.educandoId === 'string') { arr = [dados.educandoId]; } 
                else if (dados.educando) { arr = [dados.educando]; }
                
                educandosArray = arr;

                if(educandosArray.length > 0) {
                    await construirSeletorEducandos();
                } else {
                    document.getElementById('header-ee-student-selector').innerHTML = '<option value="">Sem alunos</option>';
                    document.getElementById('ee-dashboard').innerHTML = getEmptyState('Sem educandos associados na base de dados.', 'fa-user-group');
                }
            } else window.location.href = "index.html"; 
        } catch (e) {}
    } else window.location.href = "index.html"; 
});

async function construirSeletorEducandos() {
    const selector = document.getElementById('header-ee-student-selector'); selector.innerHTML = '';
    for (let id of educandosArray) {
        if(!id) continue;
        try {
            const snap = await getDoc(doc(db, "utilizadores", id));
            if (snap.exists()) {
                const data = snap.data();
                const opt = document.createElement('option'); 
                opt.value = id; opt.text = `${data.nome ? data.nome.split(' ')[0] : "Aluno"} (${data.turma || "S/ Turma"})`;
                selector.appendChild(opt);
            }
        } catch(e) {}
    }
    if(selector.options.length > 0) {
        educandoAtualId = selector.value; carregarDadosDoFilhoSelecionado();
        selector.onchange = (e) => { educandoAtualId = e.target.value; carregarDadosDoFilhoSelecionado(); };
    } else selector.innerHTML = '<option value="">Alunos não encontrados</option>';
}

document.getElementById('btn-logout-ee')?.addEventListener('click', () => { signOut(auth).then(() => window.location.href = "index.html"); });

async function carregarDadosDoFilhoSelecionado() {
    if(!educandoAtualId) return;
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", educandoAtualId));
        if (docSnap.exists()) {
            turmaAtual = docSnap.data().turma; 
            carregarResumoDashboard(); 
            
            const anoMatch = turmaAtual.match(/\d+/);
            const ano = anoMatch ? parseInt(anoMatch[0]) : 0;
            if (ano < 11) document.getElementById('card-percurso-prof').style.display = 'none';
            else { document.getElementById('card-percurso-prof').style.display = 'block'; carregarPercursoProfissional(docSnap.data()); }

            preencherFiltrosDisciplinas();
            
            const abaAtivaEl = document.querySelector('.bottom-nav .nav-item.active');
            if(abaAtivaEl) {
                const abaAtiva = abaAtivaEl.getAttribute('data-target');
                if(abaAtiva === 'view-ee-caderneta') ativarTabCadernetaAtual();
                if(abaAtiva === 'view-ee-agenda') carregarAgendaEE();
                if(abaAtiva === 'view-ee-horario') carregarHorarioEE();
            }
        }
    } catch(e) {}
}

function getUniformCircle(status) {
    if(status === true || status === 'verde') return '🟢';
    if(status === false || status === 'vermelho') return '🔴';
    if(status === 'amarelo') return '🟡';
    return '⚪'; 
}

function getRiscoBadge(status) {
    if(status === 'verde') return { cor: 'var(--success-green)', txt: '🟢 Normal' };
    if(status === 'amarelo') return { cor: 'var(--warning-yellow)', txt: '🟡 Atenção' };
    if(status === 'vermelho') return { cor: 'var(--danger-red)', txt: '🔴 Crítico' };
    return { cor: 'var(--text-muted)', txt: '⚪ Pendente' };
}

function carregarPercursoProfissional(alunoData) {
    const cardResumo = document.getElementById('card-percurso-prof');
    const miniFct = document.getElementById('resumo-mini-fct');
    const miniPap = document.getElementById('resumo-mini-pap');
    const btnPap = document.getElementById('btn-tab-pap');
    if(!cardResumo) return;

    miniFct.style.display = 'none'; miniPap.style.display = 'none'; btnPap.style.display = 'none';
    let hasFct = false; let hasPap = false; let riscoGeral = null;

    if (alunoData.fct) {
        hasFct = true; miniFct.style.display = 'block';
        const f = alunoData.fct;
        const hr = f.horasRealizadas !== undefined ? Number(f.horasRealizadas) : 0; 
        const ht = f.horasTotal !== undefined ? Number(f.horasTotal) : '-'; 
        const perc = (ht !== '-' && ht > 0) ? Math.round((hr/ht)*100) : 0;
        
        document.getElementById('txt-mini-fct').innerText = ht !== '-' ? `${hr}/${ht} h (${perc}%)` : `${hr} h registadas`;
        document.getElementById('fct-horas-txt').innerText = ht !== '-' ? `${hr} / ${ht} h` : `${hr} h`;
        document.getElementById('fct-perc-txt').innerText = ht !== '-' ? `${perc}%` : '';
        document.getElementById('fct-progresso').style.width = ht !== '-' ? `${perc}%` : '0%';
        document.getElementById('fct-prev').innerText = f.horasPrevistas !== undefined ? f.horasPrevistas : '-'; 
        document.getElementById('fct-falta').innerText = ht !== '-' ? (ht - hr) : '-';
        
        const riscoF = getRiscoBadge(f.estadoRisco);
        document.getElementById('fct-badge-risco').innerText = riscoF.txt; document.getElementById('fct-card-risco').style.borderLeftColor = riscoF.cor;
        riscoGeral = f.estadoRisco || 'branco';

        let docsHtml = '';
        const dNames = { protocolo: 'Protocolo', plano: 'Plano de Estágio', folhas: 'Folhas de Estágio', registos: 'Registos de Visita', avaliacao: 'Avaliação', autoavaliacao: 'Autoavaliação'};
        for(let key in dNames) {
            let st = (f.docs && f.docs[key] !== undefined) ? f.docs[key] : null; 
            let ic = getUniformCircle(st);
            docsHtml += `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #222; padding-bottom:5px;"><span>${dNames[key]}</span> <span style="font-size:1.1rem;">${ic}</span></div>`;
        }
        document.getElementById('fct-docs-lista').innerHTML = docsHtml;
    }

    if (alunoData.pap) {
        hasPap = true; miniPap.style.display = 'block'; btnPap.style.display = 'block';
        const p = alunoData.pap;
        
        document.getElementById('txt-mini-pap').innerText = p.faseAtual || 'A aguardar fase...';
        document.getElementById('pap-tema').innerText = p.tema || 'A aguardar definição de tema...';
        document.getElementById('pap-orientador').innerText = p.orientador || 'Não definido';
        document.getElementById('pap-data').innerText = p.dataDefesa || 'Não definida';
        document.getElementById('pap-obs-txt').innerText = p.notasOrientador || 'Sem observações registadas.';
        
        const riscoP = getRiscoBadge(p.estadoRisco);
        document.getElementById('pap-badge-risco').innerText = riscoP.txt; document.getElementById('pap-card-risco').style.borderLeftColor = riscoP.cor;
        
        if (riscoGeral !== 'vermelho') { 
            if (p.estadoRisco === 'vermelho') riscoGeral = 'vermelho';
            else if (p.estadoRisco === 'amarelo') riscoGeral = 'amarelo';
            else if (!riscoGeral) riscoGeral = p.estadoRisco;
        }

        let fasesHtml = '';
        const fNames = { escolha: 'Escolha do Tema', aprovacao: 'Aprovação', desenvolvimento: 'Desenvolvimento', relatorio: 'Relatório', apresentacao: 'Apresentação'};
        
        for(let key in fNames) {
            let st = (p.fases && p.fases[key] !== undefined) ? p.fases[key] : null;
            let statusVal = null; let prazoVal = "";
            if (st !== null && typeof st === 'object') { statusVal = st.status; prazoVal = st.prazo || ""; } else { statusVal = st; }
            let ic = getUniformCircle(statusVal);
            let prazoHtml = prazoVal ? `<br><span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;"><i class="fa-regular fa-calendar"></i> Até: ${prazoVal}</span>` : '';
            fasesHtml += `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #222; padding-bottom:8px; margin-bottom:5px;"><div><strong style="color:var(--text-light); font-size:0.9rem;">${fNames[key]}</strong>${prazoHtml}</div> <span style="font-size:1.1rem;">${ic}</span></div>`;
        }
        document.getElementById('pap-fases-lista').innerHTML = fasesHtml;
    }

    if(hasFct || hasPap) {
        cardResumo.style.display = 'block';
        const rg = getRiscoBadge(riscoGeral || 'branco'); const b = document.getElementById('badge-risco-geral');
        let bgColor = rg.cor === 'var(--text-muted)' ? 'rgba(255,255,255,0.05)' : rg.cor === 'var(--success-green)' ? 'rgba(40,167,69,0.1)' : rg.cor === 'var(--warning-yellow)' ? 'rgba(255,204,0,0.1)' : 'rgba(255,77,77,0.1)';
        b.innerText = rg.txt; b.style.color = rg.cor; b.style.background = bgColor; cardResumo.style.borderLeftColor = rg.cor;
    }
}

document.getElementById('card-percurso-prof')?.addEventListener('click', () => { document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active')); esconderTodasAsVistas(); document.getElementById('view-ee-profissional').style.display = 'block'; });
document.getElementById('btn-voltar-prof')?.addEventListener('click', () => { esconderTodasAsVistas(); document.getElementById('ee-dashboard').style.display = 'block'; document.querySelector('.nav-item[data-target="ee-dashboard"]').classList.add('active'); });

const btnTabFct = document.getElementById('btn-tab-fct'); const btnTabPap = document.getElementById('btn-tab-pap');
const contentFct = document.getElementById('content-prof-fct'); const contentPap = document.getElementById('content-prof-pap');
btnTabFct?.addEventListener('click', () => { btnTabFct.classList.add('active'); btnTabPap.classList.remove('active'); contentFct.style.display = 'block'; contentPap.style.display = 'none'; });
btnTabPap?.addEventListener('click', () => { btnTabPap.classList.add('active'); btnTabFct.classList.remove('active'); contentPap.style.display = 'block'; contentFct.style.display = 'none'; });

// ==========================================
// DASHBOARD
// ==========================================
async function carregarResumoDashboard() {
    let sumG = 0, countG = 0, sumS = 0, countS = 0, sumC = 0, countC = 0, sumT = 0, countT = 0;
    let faltasTotais = 0; let nOcorrencias = 0; let nPrhf = 0;

    try {
        const notasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "notas"));
        const map = getMatrizMap();
        
        notasSnap.forEach(d => {
            const val = d.data().nota; const disc = d.data().disciplina;
            if(val !== 'REP' && !isNaN(val)) {
                const vNum = Number(val); sumG += vNum; countG++;
                if (map["Sociocultural"].includes(disc)) { sumS += vNum; countS++; }
                else if (map["Científica"].includes(disc)) { sumC += vNum; countC++; }
                else { sumT += vNum; countT++; } 
            }
        });
        const mG = countG > 0 ? (sumG/countG).toFixed(1) : '-';
        document.getElementById('resumo-media').innerText = mG;
        document.getElementById('resumo-media').style.color = (mG !== '-' && mG < 10) ? 'var(--danger-red)' : 'var(--primary-green)';
        
        document.getElementById('resumo-med-socio').innerText = countS > 0 ? (sumS/countS).toFixed(1) : '-';
        document.getElementById('resumo-med-cient').innerText = countC > 0 ? (sumC/countC).toFixed(1) : '-';
        document.getElementById('resumo-med-tec').innerText = countT > 0 ? (sumT/countT).toFixed(1) : '-';

        const ctx = document.getElementById('eeChartMedia');
        if(ctx) {
            if(chartMediaEE) chartMediaEE.destroy();
            const valS = countS > 0 ? sumS/countS : 0;
            const valC = countC > 0 ? sumC/countC : 0;
            const valT = countT > 0 ? sumT/countT : 0;
            
            if(valS === 0 && valC === 0 && valT === 0) {
                chartMediaEE = new Chart(ctx, {
                    type: 'doughnut', data: { labels: ['Sem Notas'], datasets: [{ data: [1], backgroundColor: ['#374151'], borderWidth: 0 }] },
                    options: { cutout: '75%', plugins: { legend: { display: false }, tooltip: { enabled: false } }, maintainAspectRatio: false }
                });
            } else {
                chartMediaEE = new Chart(ctx, {
                    type: 'doughnut', data: { labels: ['Sócio.', 'Científica', 'Técnica'], datasets: [{ data: [valS, valC, valT], backgroundColor: ['#8b5cf6', '#00d2ff', '#10b981'], borderWidth: 0, hoverOffset: 4 }] },
                    options: { cutout: '75%', plugins: { legend: { display: false } }, maintainAspectRatio: false }
                });
            }
        }
    } catch(e) {}

    // A ler e preencher Nível XP do aluno
    try {
        const uSnap = await getDoc(doc(db, "utilizadores", educandoAtualId));
        if(uSnap.exists()) {
            const xp = uSnap.data().xp || 0;
            const nivel = Math.floor(xp / 100) + 1;
            document.getElementById('resumo-nivel-xp').innerText = `Nvl ${nivel}`;
        }
    } catch(e) {}

    try {
        const faltasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        faltasSnap.forEach(d => { faltasTotais += d.data().horas; });
        document.getElementById('resumo-faltas').innerText = `${faltasTotais}h`;
    } catch(e) {}

    try {
        const prhfSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "prhfs"));
        prhfSnap.forEach(d => { if((d.data().status || 'ativa') === 'ativa') nPrhf++; });
        document.getElementById('resumo-prhfs').innerText = nPrhf;
    } catch(e) {}

    try {
        const evSnap = await getDocs(collection(db, "turmas", turmaAtual, "eventos"));
        const hojeIso = new Date().toISOString().split('T')[0];
        let futuros = []; evSnap.forEach(d => { if(d.data().data >= hojeIso) futuros.push(d.data()); });
        if(futuros.length > 0) {
            futuros.sort((a,b) => a.data.localeCompare(b.data));
            const dp = futuros[0].data.split('-');
            document.getElementById('resumo-proximo-evento').innerHTML = `<strong style="color:var(--text-light);">${dp[2]}/${dp[1]}</strong><br><span style="font-size:0.7rem; color:var(--text-muted);">${futuros[0].titulo}</span>`;
        } else document.getElementById('resumo-proximo-evento').innerText = "Agenda limpa";
    } catch(e) {}
}

const navItems = document.querySelectorAll('.nav-item');
const views = [ document.getElementById('ee-dashboard'), document.getElementById('view-ee-caderneta'), document.getElementById('view-ee-agenda'), document.getElementById('view-ee-horario'), document.getElementById('view-ee-chat'), document.getElementById('view-ee-justificar'), document.getElementById('view-ee-notificacoes'), document.getElementById('view-ee-profissional') ];
function esconderTodasAsVistas() { views.forEach(v => { if(v) v.style.display = 'none'; }); }

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault(); navItems.forEach(nav => nav.classList.remove('active')); e.currentTarget.classList.add('active');
        esconderTodasAsVistas(); const targetId = e.currentTarget.getAttribute('data-target'); const targetView = document.getElementById(targetId);
        if(targetId === 'view-ee-chat') targetView.style.display = 'flex'; else if (targetView) targetView.style.display = 'block';
        if(targetId === 'view-ee-caderneta') ativarTabCadernetaAtual();
        if(targetId === 'view-ee-agenda') carregarAgendaEE();
        if(targetId === 'view-ee-horario') carregarHorarioEE();
    });
});

document.getElementById('btn-quick-mensagem')?.addEventListener('click', () => { navItems.forEach(nav => nav.classList.remove('active')); esconderTodasAsVistas(); document.getElementById('view-ee-chat').style.display = 'flex'; iniciarChatEE(); });
document.getElementById('btn-quick-justificar')?.addEventListener('click', () => { navItems.forEach(nav => nav.classList.remove('active')); esconderTodasAsVistas(); document.getElementById('view-ee-justificar').style.display = 'block'; carregarAtestadosEE(); });
document.querySelectorAll('#btn-voltar-chat-ee, #btn-voltar-justificar, #btn-voltar-notificacoes').forEach(btn => { btn?.addEventListener('click', () => { navItems.forEach(nav => nav.classList.remove('active')); document.querySelector('.nav-item[data-target="ee-dashboard"]').classList.add('active'); esconderTodasAsVistas(); document.getElementById('ee-dashboard').style.display = 'block'; }); });
document.getElementById('btn-open-notificacoes')?.addEventListener('click', () => { navItems.forEach(nav => nav.classList.remove('active')); esconderTodasAsVistas(); document.getElementById('view-ee-notificacoes').style.display = 'block'; document.getElementById('ee-notificacoes-container').innerHTML = getEmptyState('Ainda não recebeste notificações.', 'fa-bell-slash'); });

// ==========================================
// CADERNETA 
// ==========================================
const tabTimeline = document.getElementById('tab-ee-timeline'); 
const tabNotas = document.getElementById('tab-ee-notas'); 
const tabFaltas = document.getElementById('tab-ee-faltas'); 
const tabPrhfs = document.getElementById('tab-ee-prhfs'); 
const tabEvolucao = document.getElementById('tab-ee-evolucao'); 
const tabReunioes = document.getElementById('tab-ee-reunioes');
const cadernetaContent = document.getElementById('ee-caderneta-content'); 
const filtroContainer = document.getElementById('filtro-caderneta-container'); 
const filtroDisc = document.getElementById('filtro-caderneta-disc');
let currentCadernetaTab = tabTimeline;

function preencherFiltrosDisciplinas() {
    const disciplinas = obterDisciplinasDoAno();
    let opt = '<option value="">Todas as Disciplinas</option>';
    disciplinas.forEach(d => opt += `<option value="${d}">${d}</option>`);
    filtroDisc.innerHTML = opt;
}
filtroDisc.addEventListener('change', () => ativarTabCadernetaAtual());
function ativarTabCadernetaAtual() { if(currentCadernetaTab) currentCadernetaTab.click(); }
function switchTabConfig(tabClicada, tabsParaDesativar, showFilter) { 
    currentCadernetaTab = tabClicada; tabClicada.classList.add('active'); 
    tabsParaDesativar.forEach(t => t.classList.remove('active')); 
    filtroContainer.style.display = showFilter ? 'block' : 'none'; 
    cadernetaContent.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; 
}

tabTimeline?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabNotas, tabFaltas, tabPrhfs, tabEvolucao, tabReunioes], false); carregarTimelineEE(); });
tabNotas?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabFaltas, tabPrhfs, tabEvolucao, tabReunioes], false); carregarNotasEE(); });
tabFaltas?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabPrhfs, tabEvolucao, tabReunioes], true); carregarFaltasEE(); });
tabPrhfs?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabFaltas, tabEvolucao, tabReunioes], true); carregarPrhfsEE(); });
tabReunioes?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabFaltas, tabPrhfs, tabEvolucao], false); carregarReunioesEE(); });

// O CLIQUE MÁGICO NA NOVA MONTRA DO PASSAPORTE
tabEvolucao?.addEventListener('click', (e) => { 
    switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabFaltas, tabPrhfs, tabReunioes], false); 
    carregarEvolucaoEE(); 
});

async function carregarEvolucaoEE() {
    let html = `
    <div class="card" style="border-top: 4px solid var(--primary-green); margin-bottom: 20px;">
        <h3 style="color: white; margin-bottom: 15px; font-size: 1.1rem;"><i class="fa-solid fa-chart-radar"></i> Perfil de Competências</h3>
        
        <div style="margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-comments" style="color:#0ea5e9;"></i> Comunicação & Hospitalidade</span><strong style="color:var(--primary-green);">Nvl 4</strong></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: 80%; background:#0ea5e9;"></div></div>
        </div>
        
        <div style="margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-lightbulb" style="color:#8b5cf6;"></i> Criatividade & Inovação</span><strong style="color:var(--primary-green);">Nvl 5</strong></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: 100%; background:#8b5cf6;"></div></div>
        </div>
        
        <div style="margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-compass" style="color:#f97316;"></i> Liderança & Autonomia</span><strong style="color:var(--primary-green);">Nvl 3</strong></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: 60%; background:#f97316;"></div></div>
        </div>
        
        <div style="margin-bottom: 12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-chess-knight" style="color:#10b981;"></i> Organização & Estratégia</span><strong style="color:var(--primary-green);">Nvl 2</strong></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: 40%; background:#10b981;"></div></div>
        </div>
    </div>
    
    <h4 style="color:var(--text-muted); margin-bottom:10px; font-size:0.9rem; text-transform:uppercase;"><i class="fa-solid fa-bolt"></i> Últimos Registos</h4>
    
    <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(16, 185, 129, 0.1); border: 1px solid var(--primary-green); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
        <div>
            <strong style="color:var(--primary-green); font-size:1.1rem;">+40 XP</strong><br>
            <span style="color:var(--text-light); font-size:0.95rem;">Criatividade (Ideia fora da caixa)</span>
        </div>
        <div style="text-align:right; font-size:0.75rem; color:var(--text-muted);">
            Hoje<br>Prof. Silva
        </div>
    </div>
    
    <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(16, 185, 129, 0.1); border: 1px solid var(--primary-green); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
        <div>
            <strong style="color:var(--primary-green); font-size:1.1rem;">+20 XP</strong><br>
            <span style="color:var(--text-light); font-size:0.95rem;">Espírito de Equipa (Ajudou colega)</span>
        </div>
        <div style="text-align:right; font-size:0.75rem; color:var(--text-muted);">
            Ontem<br>Prof. Martins
        </div>
    </div>

    <div style="display:flex; align-items:center; justify-content:space-between; background:rgba(239, 68, 68, 0.1); border: 1px solid var(--danger-red); padding: 12px; border-radius: 8px; margin-bottom: 10px;">
        <div>
            <strong style="color:var(--danger-red); font-size:1.1rem;">-15 XP</strong><br>
            <span style="color:var(--text-light); font-size:0.95rem;">Uso Indevido de Telemóvel</span>
        </div>
        <div style="text-align:right; font-size:0.75rem; color:var(--text-muted);">
            12/03<br>Prof. Costa
        </div>
    </div>
    `;
    cadernetaContent.innerHTML = html;
}

async function carregarTimelineEE() {
    if(!educandoAtualId) return;
    try {
        let eventos = [];
        const notasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "notas"));
        notasSnap.forEach(d => { const n = d.data(); eventos.push({ time: new Date(n.data).getTime(), icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', titulo: 'Nova Avaliação', desc: `${n.disciplina} (Mod. ${n.modulo}): <strong style="color:var(--text-light);">${n.nota}</strong>` }); });
        const faltasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        faltasSnap.forEach(d => { const f = d.data(); eventos.push({ time: new Date(f.criadoEm || f.dataInicio).getTime(), icon: '<i class="fa-solid fa-user-xmark"></i>', cor: f.justificada ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Falta a ${f.disciplina} (${f.horas}h)`, desc: f.justificada ? `Justificada` : `Falta registada.` }); });
        
        eventos.sort((a,b) => b.time - a.time);
        if(eventos.length === 0) { cadernetaContent.innerHTML = getEmptyState('O histórico está limpo.', 'fa-clock-rotate-left'); return; }
        
        let html = '<div class="timeline">';
        eventos.forEach(ev => { html += `<div class="timeline-item"><div class="timeline-icon" style="color: ${ev.cor}; border-color: ${ev.cor};">${ev.icon}</div><div class="timeline-content" style="border-left: 3px solid ${ev.cor};"><span class="timeline-date">${new Date(ev.time).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span><strong style="color:var(--text-light); display:block; margin-bottom:5px;">${ev.titulo}</strong><p style="font-size:0.85rem; color:var(--text-light); margin:0;">${ev.desc}</p></div></div>`; });
        cadernetaContent.innerHTML = html + '</div>';
    } catch(e) {}
}

async function carregarNotasEE() {
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", educandoAtualId, "notas"));
        let disciplinasDoAluno = {};
        notasDb.forEach(d => { const n = d.data(); if(!disciplinasDoAluno[n.disciplina]) disciplinasDoAluno[n.disciplina] = []; disciplinasDoAluno[n.disciplina].push(n); });
        
        const ordemDisciplinas = obterDisciplinasDoAno();

        let html = `<button id="btn-pauta-global" class="primary-btn" style="margin-bottom: 20px; background-color: transparent; border: 1px solid var(--primary-green); color: var(--primary-green);"><i class="fa-solid fa-table-list"></i> Pauta Global (3 Anos)</button>`;
        
        ordemDisciplinas.forEach(disc => {
            if(disciplinasDoAluno[disc] && disciplinasDoAluno[disc].length > 0) {
                let sum = 0; let c = 0; let modsHtml = '';
                disciplinasDoAluno[disc].forEach(n => {
                    if(n.nota !== 'REP' && !isNaN(n.nota)) { sum += Number(n.nota); c++; }
                    const cor = (n.nota === 'REP' || Number(n.nota) < 10) ? 'var(--danger-red)' : 'var(--success-green)';
                    const modLabel = n.modulo.toString().startsWith('UC') ? n.modulo : `Módulo ${n.modulo}`;
                    modsHtml += `<div class="modulo-row"><span style="color:var(--text-light);">${modLabel}</span><span style="font-weight:bold; color:${cor};">${n.nota}</span></div>`;
                });
                const med = c > 0 ? (sum/c).toFixed(1) : '-';
                const medCor = (med !== '-' && med < 10) ? 'var(--danger-red)' : 'var(--text-light)';
                
                html += `<div class="disciplina-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                            <span class="disciplina-title" style="color:var(--text-light);">${disc}</span>
                            <span><span style="font-size:0.75rem; color:var(--text-muted); margin-right:8px;">Média:</span><span class="disciplina-media" style="color:${medCor};">${med}</span> <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; color:var(--text-muted); margin-left:5px;"></i></span>
                         </div><div class="disciplina-modules">${modsHtml}</div>`;
            } else {
                html += `<div class="disciplina-header" style="cursor:default;">
                            <span class="disciplina-title" style="color:var(--text-muted);">${disc}</span>
                            <span><span class="disciplina-media" style="color:var(--text-muted); font-size:0.9rem;">SN</span></span>
                         </div>`;
            }
        });
        cadernetaContent.innerHTML = html;
        
        document.getElementById('btn-pauta-global')?.addEventListener('click', async () => { 
            document.getElementById('modal-pauta-global').style.display = 'flex'; 
            const container = document.getElementById('pauta-global-content'); 
            try { 
                const mapNotas = {}; notasDb.forEach(d => { const dt = d.data(); mapNotas[`${dt.disciplina}_${dt.modulo}`] = dt.nota; }); 
                const matriz = getMatriz(); let pHtml = ''; 
                for (const [nomeComponente, disciplinas] of Object.entries(matriz)) { 
                    pHtml += `<div class="pauta-global-componente"><div class="pauta-global-header">${nomeComponente}</div>`; 
                    for (const [nomeDisc, modulos] of Object.entries(disciplinas)) { 
                        pHtml += `<div class="pauta-global-disc"><div class="pauta-global-disc-title">${nomeDisc}</div><div class="pauta-global-notas">`; 
                        const isNumeric = Object.keys(modulos).every(k => !isNaN(k));
                        const modKeys = isNumeric ? Object.keys(modulos).sort((a,b) => parseInt(a) - parseInt(b)) : Object.keys(modulos);
                        for(const mod of modKeys) { 
                            const nota = mapNotas[`${nomeDisc}_${mod}`] || 'SN'; let cor = "sn"; 
                            if(nota !== 'SN' && nota !== 'REP' && nota >= 10) cor = "positiva"; 
                            else if(nota === 'REP' || nota < 10) cor = "negativa"; 
                            const modLabel = mod.toString().startsWith('UC') ? mod : `M${mod}`;
                            pHtml += `<div class="pg-nota-item"><span>${modLabel}</span><span class="pg-nota-val ${cor}">${nota}</span></div>`; 
                        } 
                        pHtml += `</div></div>`; 
                    } pHtml += `</div>`; 
                } container.innerHTML = pHtml; 
            } catch(err) { container.innerHTML = '<p class="text-danger center">Erro ao compilar pauta.</p>'; } 
        });
        document.getElementById('btn-close-pauta')?.addEventListener('click', () => document.getElementById('modal-pauta-global').style.display = 'none');

    } catch(e) {}
}

async function carregarFaltasEE() {
    try {
        const fDisc = filtroDisc.value;
        const faltasDb = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        let faltasPorDisc = {};
        
        faltasDb.forEach(d => {
            const f = d.data();
            if(!f.justificada && (!fDisc || f.disciplina === fDisc)) {
                if(!faltasPorDisc[f.disciplina]) faltasPorDisc[f.disciplina] = {};
                if(!faltasPorDisc[f.disciplina][f.modulo]) faltasPorDisc[f.disciplina][f.modulo] = [];
                faltasPorDisc[f.disciplina][f.modulo].push(f);
            }
        });

        if(Object.keys(faltasPorDisc).length === 0) { cadernetaContent.innerHTML = getEmptyState('Sem faltas injustificadas.', 'fa-face-smile'); return; }
        
        let html = '';
        const ordemDisciplinas = obterDisciplinasDoAno();
        const matriz = getMatriz();
        
        ordemDisciplinas.forEach(disc => {
            if(faltasPorDisc[disc]) {
                let discHtml = ''; let totalFaltasDisc = 0;
                
                for(let mod of Object.keys(faltasPorDisc[disc]).sort()) {
                    let sumFaltasMod = 0;
                    faltasPorDisc[disc][mod].forEach(f => sumFaltasMod += Number(f.horas||0));
                    totalFaltasDisc += sumFaltasMod;
                    
                    let limiteHoras = 0;
                    let totalHorasMod = 0;
                    for (const comp of Object.values(matriz)) { 
                        if(comp[disc] && comp[disc][mod]) { 
                            totalHorasMod = comp[disc][mod];
                            limiteHoras = Math.round(totalHorasMod * 0.1); 
                            break; 
                        } 
                    }
                    
                    let corBarra = 'var(--success-green)'; 
                    let txtRisco = 'Regular'; 
                    let perc = 0;
                    
                    if(totalHorasMod > 0) {
                        perc = (sumFaltasMod / totalHorasMod) * 100;
                        if(perc > 100) perc = 100;

                        if(sumFaltasMod > limiteHoras) { 
                            corBarra = 'var(--danger-red)'; 
                            txtRisco = '⚠️ Abaixo de 90% (Reprovado)'; 
                        }
                        else if(sumFaltasMod === limiteHoras) { 
                            corBarra = 'var(--warning-yellow)'; 
                            txtRisco = 'Atenção (No limite dos 90%)'; 
                        }
                        else {
                            corBarra = 'var(--success-green)';
                            txtRisco = 'Regular (Acima de 90%)';
                        }
                    }

                    const modLabel = mod.toString().startsWith('UC') ? mod : `Módulo ${mod}`;

                    discHtml += `
                    <div style="background:rgba(0,0,0,0.2); padding:12px; border-radius:8px; border:1px solid #333; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:8px;">
                            <strong style="color:var(--text-light);">${modLabel}</strong>
                            <span style="font-size:0.8rem; font-weight:bold; color:${corBarra};">${sumFaltasMod}h / ${limiteHoras > 0 ? limiteHoras+'h (Limite)' : '?'}</span>
                        </div>
                        <div class="progress-bar-bg" style="margin-top:0; margin-bottom:5px; height:6px;"><div class="progress-bar-fill" style="width: ${perc}%; background-color:${corBarra};"></div></div>
                        <div style="text-align:right; font-size:0.75rem; color:${corBarra};">${txtRisco}</div>
                    </div>`;
                }

                html += `<div class="disciplina-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                            <span class="disciplina-title" style="color:var(--text-light);">${disc}</span>
                            <span><span class="disciplina-media" style="color:var(--danger-red);">${totalFaltasDisc}h</span> <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; color:var(--text-muted); margin-left:5px;"></i></span>
                         </div><div class="disciplina-modules">${discHtml}</div>`;
            }
        });
        
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

async function carregarPrhfsEE() {
    try {
        const fDisc = filtroDisc.value;
        const prhfsDb = await getDocs(collection(db, "utilizadores", educandoAtualId, "prhfs"));
        let prhfsArr = []; prhfsDb.forEach(d => { const p = d.data(); if(p.status !== 'concluida' && (!fDisc || p.disciplina === fDisc)) prhfsArr.push(p); });
        if(prhfsArr.length === 0) { cadernetaContent.innerHTML = getEmptyState('Nenhum PRHF ativo.', 'fa-book-medical'); return; }
        
        prhfsArr.sort((a,b) => new Date(a.prazo) - new Date(b.prazo));
        let html = '';
        prhfsArr.forEach(p => {
            const isUrgente = p.moduloTerminado === true || p.moduloTerminado === "true"; 
            const cor = isUrgente ? 'var(--danger-red)' : 'var(--warning-yellow)';
            const txtSt = isUrgente ? 'URGENTE (Mód. Terminado)' : 'EM CURSO';
            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong style="color:var(--text-light);">${p.disciplina} (Mod. ${p.modulo})</strong><span style="color:${cor}; font-size:0.75rem; font-weight:bold;">${txtSt}</span></div><p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">${p.descricao}</p><div style="font-size:0.8rem; color:var(--text-light);">Data Limite: <strong style="color:${cor};">${p.prazo.split('-').reverse().join('/')}</strong> | Presenciais: <strong style="color:var(--text-light);">${p.horasPresenciais||0}h</strong></div></div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

async function carregarReunioesEE(reuniaoSelecionada = '1_intercalar') {
    const reunioesMenu = [
        {id: '1_intercalar', label: '1ª Intercalar'}, {id: '1_avaliacao', label: '1ª Avaliação'},
        {id: '2_intercalar', label: '2ª Intercalar'}, {id: '2_avaliacao', label: '2ª Avaliação'},
        {id: '3_avaliacao', label: '3ª Avaliação'}
    ];
    
    let html = '<div style="display:flex; overflow-x:auto; gap:10px; margin-bottom:20px; padding-bottom:10px;">';
    reunioesMenu.forEach(r => {
        const bg = r.id === reuniaoSelecionada ? 'var(--primary-green)' : 'var(--bg-dark)';
        const color = r.id === reuniaoSelecionada ? 'var(--bg-dark)' : 'var(--text-muted)';
        html += `<button class="btn-select-reuniao" data-id="${r.id}" style="background:${bg}; color:${color}; border:1px solid #333; padding:8px 15px; border-radius:20px; cursor:pointer; font-weight:bold; white-space:nowrap; transition:0.2s; flex-shrink:0;">${r.label}</button>`;
    });
    html += '</div><div id="reuniao-content-area"><p class="text-muted center">A carregar dados...</p></div>';
    
    cadCompreendido. Aqui tens os dois ficheiros **completos, revistos e sem qualquer corte** (removi também os espaços invisíveis que por vezes causam erros ao copiar/colar). 

Podes copiar e substituir integralmente o conteúdo dos teus ficheiros atuais.

### `ee.html`

```html
<!DOCTYPE html>
<html lang="pt-PT">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no">
    <title>Turma PRO - Família</title>
    <link rel="icon" type="image/png" href="logo_tur.png">
    <link rel="stylesheet" href="style.css?v=11">
    <link rel="stylesheet" href="[https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css](https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css)">
    <!-- Adicionado o Chart.js para os gráficos -->
    <script src="[https://cdn.jsdelivr.net/npm/chart.js](https://cdn.jsdelivr.net/npm/chart.js)"></script>
    <script>
        const currentTheme = localStorage.getItem('turmapro_theme') || 'dark';
        document.documentElement.setAttribute('data-theme', currentTheme);
    </script>
</head>
<body>
    <div id="app-content">
        <!-- HEADER ESTÁTICO -->
        <header id="header-ee" class="app-header">
            <div class="user-profile" style="flex: 1; min-width: 0;">
                <select id="header-ee-student-selector" class="ee-student-selector">
                    <option value="">A carregar...</option>
                </select>
            </div>
            <div style="display: flex; align-items: center; gap: 15px; flex-shrink: 0;">
                <button id="btn-open-notificacoes" class="notification-bell">
                    <i class="fa-solid fa-bell"></i>
                    <span id="badge-notificacoes" class="notification-badge" style="display:none;">0</span>
                </button>
                <button id="btn-logout-ee" class="logout-btn" title="Sair" style="font-size: 1.2rem;"><i class="fa-solid fa-right-from-bracket"></i></button>
            </div>
        </header>

        <main class="app-content">
            
            <!-- 1. DASHBOARD PRINCIPAL -->
            <div id="ee-dashboard">
                <div class="ee-summary-grid">
                    
                    <!-- CARTÃO DA MÉDIA COM GRÁFICO (NOVO) -->
                    <div class="ee-summary-card ee-card-extended" style="display: flex; flex-direction: row; align-items: center; gap: 20px;">
                        <div style="flex: 1;">
                            <div><i class="fa-solid fa-chart-pie" style="font-size: 1.2rem;"></i><div class="ee-summary-label">Média Global</div></div>
                            <div class="ee-summary-value" id="resumo-media" style="color: var(--primary-green); font-size: 2.5rem;">...</div>
                            <div style="display:flex; flex-direction:column; gap: 5px; margin-top: 10px;">
                                <div style="display:flex; align-items:center; gap:5px; font-size:0.75rem; color:var(--text-muted);"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#8b5cf6;"></span> Sócio. <strong style="color:var(--text-light); margin-left:auto;" id="resumo-med-socio">-</strong></div>
                                <div style="display:flex; align-items:center; gap:5px; font-size:0.75rem; color:var(--text-muted);"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#00d2ff;"></span> Científica <strong style="color:var(--text-light); margin-left:auto;" id="resumo-med-cient">-</strong></div>
                                <div style="display:flex; align-items:center; gap:5px; font-size:0.75rem; color:var(--text-muted);"><span style="display:inline-block; width:8px; height:8px; border-radius:50%; background:#10b981;"></span> Técnica <strong style="color:var(--text-light); margin-left:auto;" id="resumo-med-tec">-</strong></div>
                            </div>
                        </div>
                        <div style="width: 110px; height: 110px; position: relative;">
                            <canvas id="eeChartMedia"></canvas>
                        </div>
                    </div>

                    <div class="ee-summary-card">
                        <div><i class="fa-solid fa-user-xmark" style="color: var(--danger-red);"></i><div class="ee-summary-value" id="resumo-faltas">...</div></div>
                        <div class="ee-summary-label">Total de Faltas</div>
                    </div>
                    <div class="ee-summary-card">
                        <div><i class="fa-regular fa-calendar-check" style="color: var(--warning-yellow);"></i><div class="ee-summary-value" id="resumo-proximo-evento" style="font-size: 1.1rem;">...</div></div>
                        <div class="ee-summary-label">Próximo Evento</div>
                    </div>
                    <div class="ee-summary-card">
                        <div><i class="fa-solid fa-book-medical" style="color: #0099ff;"></i><div class="ee-summary-value" id="resumo-prhfs">...</div></div>
                        <div class="ee-summary-label">PRHFs Ativos</div>
                    </div>
                    <div class="ee-summary-card">
                        <div><i class="fa-solid fa-triangle-exclamation" style="color: #e67e22;"></i><div class="ee-summary-value" id="resumo-ocorrencias">...</div></div>
                        <div class="ee-summary-label">Ocorrências</div>
                    </div>
                </div>

                <!-- RESUMO PERCURSO PROFISSIONAL (FCT / PAP) -->
                <div class="card" id="card-percurso-prof" style="display:none; border-left: 4px solid var(--text-muted); cursor: pointer; transition: 0.2s;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                        <h3 style="font-size: 1.1rem; color: #0099ff; margin:0;"><i class="fa-solid fa-briefcase"></i> Percurso Profissional</h3>
                        <span id="badge-risco-geral" style="font-size: 0.75rem; padding: 4px 10px; border-radius: 12px; font-weight:bold; background: rgba(255,255,255,0.05); color: var(--text-muted);">⚪ Pendente</span>
                    </div>
                    <div id="resumo-mini-fct" style="display:none; font-size:0.9rem; margin-bottom:8px; color:var(--text-light); border-bottom: 1px dashed #333; padding-bottom: 8px;">
                        <strong>FCT:</strong> <span id="txt-mini-fct">A carregar...</span>
                    </div>
                    <div id="resumo-mini-pap" style="display:none; font-size:0.9rem; color:var(--text-light);">
                        <strong>PAP:</strong> <span id="txt-mini-pap">A carregar...</span>
                    </div>
                    <div style="text-align:center; margin-top:12px; font-size:0.75rem; color:var(--text-muted);"><i class="fa-solid fa-hand-pointer"></i> Tocar para ver detalhes</div>
                </div>

                <!-- Botões de Ação Rápida Otimizados -->
                <div style="display: flex; gap: 10px; margin-top: 15px;">
                    <button class="primary-btn" id="btn-quick-justificar" style="background-color: var(--success-green); flex: 1; padding: 18px 10px;">
                        <span style="font-size:1rem; font-weight:bold; color:white;">Justificar Falta</span>
                    </button>
                    <button class="primary-btn" id="btn-quick-mensagem" style="background-color: var(--warning-yellow); flex: 1; padding: 18px 10px;">
                        <span style="font-size:1rem; font-weight:bold; color:black;">Falar com DT</span>
                    </button>
                </div>
            </div>

            <!-- VISTA DETALHADA: FCT & PAP -->
            <div id="view-ee-profissional" style="display: none;">
                <div class="class-header" style="margin-bottom: 15px;"><button id="btn-voltar-prof" class="secondary-btn small-btn" style="border: none; background: rgba(255,255,255,0.1); width: auto;"><i class="fa-solid fa-arrow-left"></i> Início</button></div>
                
                <div class="falta-tabs" style="margin-bottom: 15px;">
                    <button class="falta-tab-btn active" id="btn-tab-fct">FCT (Estágio)</button>
                    <button class="falta-tab-btn" id="btn-tab-pap" style="display:none;">PAP (Projeto Final)</button>
                </div>

                <div id="content-prof-fct" style="display:block;">
                    <div class="card" style="border-left: 4px solid var(--text-muted);" id="fct-card-risco">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h3 style="margin:0; font-size:1.1rem; color:var(--text-light);">Estado Geral</h3>
                            <span id="fct-badge-risco" style="font-size: 1rem;">⚪ Pendente</span>
                        </div>
                    </div>

                    <div class="card">
                        <h3 style="margin-bottom:15px; font-size:1rem; color:var(--text-light);"><i class="fa-solid fa-clock"></i> Horas Realizadas</h3>
                        <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:5px;">
                            <span style="font-size:1.4rem; font-weight:bold; color:var(--primary-green);" id="fct-horas-txt">0 / 0 h</span>
                            <span style="font-size:0.9rem; color:var(--text-muted);" id="fct-perc-txt">0%</span>
                        </div>
                        <div class="progress-bar-bg"><div class="progress-bar-fill" id="fct-progresso" style="width: 0%;"></div></div>
                        <div style="display:flex; justify-content:space-between; margin-top:15px; font-size:0.85rem; color:var(--text-muted); border-top:1px dashed #333; padding-top:10px;">
                            <div>Previstas: <strong style="color:var(--text-light);" id="fct-prev">0</strong></div>
                            <div>Em Falta: <strong style="color:var(--warning-yellow);" id="fct-falta">0</strong></div>
                        </div>
                    </div>

                    <div class="card">
                        <h3 style="margin-bottom:15px; font-size:1rem; color:var(--text-light);"><i class="fa-solid fa-file-signature"></i> Documentação</h3>
                        <div id="fct-docs-lista" style="display:flex; flex-direction:column; gap:10px; font-size:0.9rem;"></div>
                    </div>
                </div>

                <div id="content-prof-pap" style="display:none;">
                    <div class="card" style="border-left: 4px solid var(--text-muted);" id="pap-card-risco">
                        <div style="display:flex; justify-content:space-between; align-items:center;">
                            <h3 style="margin:0; font-size:1.1rem; color:var(--text-light);">Estado do Projeto</h3>
                            <span id="pap-badge-risco" style="font-size: 1rem;">⚪ Pendente</span>
                        </div>
                    </div>

                    <div class="card">
                        <span style="font-size:0.8rem; color:var(--text-muted); text-transform:uppercase;">Tema da PAP</span>
                        <h3 style="margin:5px 0 15px 0; font-size:1.2rem; color:var(--primary-green); line-height:1.3;" id="pap-tema">A carregar...</h3>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem; border-top:1px dashed #333; padding-top:10px; margin-bottom:5px;">
                            <span style="color:var(--text-muted);">Orientador:</span> <strong style="color:var(--text-light);" id="pap-orientador">-</strong>
                        </div>
                        <div style="display:flex; justify-content:space-between; font-size:0.85rem;">
                            <span style="color:var(--text-muted);">Data de Defesa:</span> <strong style="color:var(--text-light);" id="pap-data">-</strong>
                        </div>
                    </div>

                    <div class="card">
                        <h3 style="margin-bottom:15px; font-size:1rem; color:var(--text-light);"><i class="fa-solid fa-bars-progress"></i> Fases do Projeto</h3>
                        <div id="pap-fases-lista" style="display:flex; flex-direction:column; gap:10px; font-size:0.9rem;"></div>
                    </div>

                    <div class="card" id="pap-obs-container">
                        <h3 style="margin-bottom:10px; font-size:1rem; color:var(--text-light);"><i class="fa-solid fa-comment-dots"></i> Observações do Orientador</h3>
                        <div style="background: rgba(255,255,255,0.05); padding: 15px; border-radius: 8px; border-left: 3px solid var(--primary-green); font-size:0.9rem; line-height:1.4;" id="pap-obs-txt">
                            Sem observações recentes.
                        </div>
                    </div>
                </div>
            </div>

            <!-- CADERNETA -->
            <div id="view-ee-caderneta" style="display: none;">
                <div class="falta-tabs" style="display: grid; grid-template-columns: 1fr 1fr; gap: 8px; justify-content:center; margin-bottom: 20px;">
                    <button class="falta-tab-btn active" id="tab-ee-timeline">Linha Temporal</button>
                    <button class="falta-tab-btn" id="tab-ee-notas">Notas</button>
                    <button class="falta-tab-btn" id="tab-ee-faltas">Faltas</button>
                    <button class="falta-tab-btn" id="tab-ee-prhfs">PRHFs</button>
                    <button class="falta-tab-btn" id="tab-ee-comportamento">Comportamento</button>
                    <button class="falta-tab-btn" id="tab-ee-reunioes">Reuniões</button>
                </div>
                
                <div id="filtro-caderneta-container" style="display:none; margin-bottom: 15px;">
                    <select id="filtro-caderneta-disc" style="margin:0; background-color: var(--bg-dark); border-radius: 8px;"><option value="">Todas as Disciplinas</option></select>
                </div>
                <div id="ee-caderneta-content"></div>
            </div>

            <!-- AGENDA -->
            <div id="view-ee-agenda" style="display: none;">
                <div class="agenda-filters">
                    <label class="agenda-filter-label"><input type="checkbox" id="filtro-agenda-testes" checked> <span style="color:#ffaa00;">●</span> Testes/Av.</label>
                    <label class="agenda-filter-label"><input type="checkbox" id="filtro-agenda-trabalhos" checked> <span style="color:#00d2ff;">●</span> Entregas</label>
                    <label class="agenda-filter-label"><input type="checkbox" id="filtro-agenda-outros" checked> <span style="color:#b82bf2;">●</span> Outros</label>
                </div>
                <div id="ee-agenda-content"></div>
            </div>

            <!-- HORÁRIO -->
            <div id="view-ee-horario" style="display: none;">
                <div class="falta-tabs" style="margin-bottom: 15px;">
                    <button class="falta-tab-btn active" id="btn-horario-dia">Vista Diária</button>
                    <button class="falta-tab-btn" id="btn-horario-grelha">Grelha Semanal</button>
                </div>
                <div class="week-nav-bar">
                    <button id="btn-ee-prev-horario"><i class="fa-solid fa-chevron-left"></i></button>
                    <span id="ee-horario-display">A carregar...</span>
                    <button id="btn-ee-next-horario"><i class="fa-solid fa-chevron-right"></i></button>
                </div>
                <div id="ee-horario-content" style="margin-top:15px; overflow-x: auto;"></div>
            </div>

            <!-- CHAT E JUSTIFICAR -->
            <div id="view-ee-chat" style="display: none; flex-direction: column; height: 75vh;">
                <div class="class-header" style="margin-bottom: 10px;"><button id="btn-voltar-chat-ee" class="secondary-btn small-btn" style="border: none; background: rgba(255,255,255,0.1); width: auto;"><i class="fa-solid fa-arrow-left"></i> Início</button></div>
                <div class="forum-messages" id="ee-chat-messages-container" style="flex:1; overflow-y:auto; padding:15px; display:flex; flex-direction:column; gap:15px; background: var(--bg-card); border-radius: 12px 12px 0 0; border: 1px solid #333; border-bottom: none;"></div>
                <div class="forum-input-area" style="background:#1a1a1a; padding:10px; border: 1px solid #333; display:flex; gap:8px; align-items:center; border-radius: 0 0 12px 12px;">
                    <input type="text" id="ee-input-chat-msg" placeholder="A sua mensagem..." style="margin:0; flex:1; border-radius:20px; padding:10px 15px;">
                    <button id="btn-ee-send-msg" class="forum-send-btn" style="width:40px; height:40px; background-color: var(--warning-yellow); color: black;"><i class="fa-solid fa-paper-plane"></i></button>
                </div>
            </div>

            <div id="view-ee-justificar" style="display: none;">
                <div class="class-header" style="margin-bottom: 15px;"><button id="btn-voltar-justificar" class="secondary-btn small-btn" style="border: none; background: rgba(255,255,255,0.1); width: auto;"><i class="fa-solid fa-arrow-left"></i> Início</button></div>
                <div class="card" style="margin-bottom: 20px;">
                    <h3 style="margin-bottom: 15px; font-size: 1rem; color: var(--text-light);"><i class="fa-solid fa-cloud-arrow-up"></i> Enviar Comprovativo</h3>
                    <p style="font-size: 0.85rem; color: var(--text-muted); margin-bottom: 15px;">Tire foto do atestado para justificar ausências.</p>
                    <div style="background:var(--bg-dark); padding:20px; border-radius:8px; border:1px dashed #555; text-align:center; margin-bottom:15px;">
                        <label for="ee-upload-atestado" class="secondary-btn" style="margin:0 auto; width:fit-content; border-color: var(--success-green); color: var(--success-green); cursor: pointer;"><i class="fa-solid fa-camera"></i> Anexar Foto / PDF</label>
                        <input type="file" id="ee-upload-atestado" style="display:none;" accept="image/*,.pdf">
                        <span id="ee-atestado-file-name" class="file-name-display" style="display:block; margin-top:10px; font-size:0.85rem; color:var(--text-light);"></span>
                    </div>
                    <textarea id="ee-atestado-obs" class="input-field" placeholder="Observações" style="min-height: 80px; margin-bottom: 15px;"></textarea>
                    <button id="btn-ee-enviar-atestado" class="primary-btn" style="width:100%; background-color: var(--success-green); display:none;"><i class="fa-solid fa-paper-plane"></i> Enviar Atestado</button>
                </div>
                <h3 style="color: var(--primary-green); font-size: 1rem; margin-bottom: 15px;">Histórico de Envios</h3>
                <div id="ee-lista-atestados-container"></div>
            </div>

            <div id="view-ee-notificacoes" style="display: none;">
                <div class="class-header" style="margin-bottom: 15px;"><button id="btn-voltar-notificacoes" class="secondary-btn small-btn" style="border: none; background: rgba(255,255,255,0.1); width: auto;"><i class="fa-solid fa-arrow-left"></i> Voltar</button></div>
                <h2 style="font-size: 1.2rem; margin-bottom: 15px; color: var(--text-light);"><i class="fa-solid fa-bell"></i> Central de Alertas</h2>
                <div id="ee-notificacoes-container"></div>
            </div>
        </main>

        <nav class="bottom-nav">
            <a href="#" class="nav-item active" data-target="ee-dashboard"><i class="fa-solid fa-house"></i><span>Início</span></a>
            <a href="#" class="nav-item" data-target="view-ee-caderneta"><i class="fa-solid fa-book-open"></i><span>Caderneta</span></a>
            <a href="#" class="nav-item" data-target="view-ee-agenda"><i class="fa-regular fa-calendar-check"></i><span>Agenda</span></a>
            <a href="#" class="nav-item" data-target="view-ee-horario"><i class="fa-solid fa-clock"></i><span>Horário</span></a>
        </nav>
    </div>

    <!-- MODAL PAUTA GLOBAL -->
    <div id="modal-pauta-global" class="modal-overlay">
        <div class="action-sheet" style="max-width: 600px; width: 95%; max-height: 85vh; overflow-y: auto; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 20px;">
                <h2 style="color: var(--primary-green); font-size:1.3rem; margin:0;"><i class="fa-solid fa-table-list"></i> Pauta Global</h2>
                <button id="btn-close-pauta" style="background:none; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="pauta-global-content"><p class="text-muted" style="text-align:center;">A compilar notas...</p></div>
        </div>
    </div>

    <script type="module" src="./js/ee-app.js?v=17"></script>
</body>
</html>
