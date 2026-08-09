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

    try {
        const faltasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        faltasSnap.forEach(d => { faltasTotais += d.data().horas; });
        document.getElementById('resumo-faltas').innerText = `${faltasTotais}h`;
    } catch(e) {}

    try {
        const ocSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "ocorrencias"));
        document.getElementById('resumo-ocorrencias').innerText = ocSnap.size;
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
const tabComportamento = document.getElementById('tab-ee-comportamento'); 
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

tabTimeline?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabNotas, tabFaltas, tabPrhfs, tabComportamento, tabReunioes], false); carregarTimelineEE(); });
tabNotas?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabFaltas, tabPrhfs, tabComportamento, tabReunioes], false); carregarNotasEE(); });
tabFaltas?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabPrhfs, tabComportamento, tabReunioes], true); carregarFaltasEE(); });
tabPrhfs?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabFaltas, tabComportamento, tabReunioes], true); carregarPrhfsEE(); });
tabComportamento?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabFaltas, tabPrhfs, tabReunioes], true); carregarComportamentoEE(); });
tabReunioes?.addEventListener('click', (e) => { switchTabConfig(e.currentTarget, [tabTimeline, tabNotas, tabFaltas, tabPrhfs, tabComportamento], false); carregarReunioesEE(); });

async function carregarTimelineEE() {
    if(!educandoAtualId) return;
    try {
        let eventos = [];
        const notasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "notas"));
        notasSnap.forEach(d => { const n = d.data(); eventos.push({ time: new Date(n.data).getTime(), icon: '<i class="fa-solid fa-graduation-cap"></i>', cor: 'var(--primary-green)', titulo: 'Nova Avaliação', desc: `${n.disciplina} (Mod. ${n.modulo}): <strong style="color:var(--text-light);">${n.nota}</strong>` }); });
        const faltasSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "faltas"));
        faltasSnap.forEach(d => { const f = d.data(); eventos.push({ time: new Date(f.criadoEm || f.dataInicio).getTime(), icon: '<i class="fa-solid fa-user-xmark"></i>', cor: f.justificada ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Falta a ${f.disciplina} (${f.horas}h)`, desc: f.justificada ? `Justificada` : `Falta registada.` }); });
        const ocSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "ocorrencias"));
        ocSnap.forEach(d => { const o = d.data(); eventos.push({ time: o.timestamp, icon: o.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>', cor: o.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Registo Disciplinar`, desc: `<strong style="color:var(--text-light);">${o.titulo}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">${o.descricao || ''}</span>` }); });
        const prhfSnap = await getDocs(collection(db, "utilizadores", educandoAtualId, "prhfs"));
        prhfSnap.forEach(d => { const p = d.data(); eventos.push({ time: new Date(p.dataRegisto || Date.now()).getTime(), icon: '<i class="fa-solid fa-book-medical"></i>', cor: 'var(--warning-yellow)', titulo: `Plano de Recuperação Criado`, desc: `${p.disciplina} (Mod. ${p.modulo})` }); });
        
        eventos.sort((a,b) => b.time - a.time);
        if(eventos.length === 0) { cadernetaContent.innerHTML = getEmptyState('Nenhuma atividade recente encontrada.', 'fa-timeline'); return; }
        
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
            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong style="color:var(--text-light);">${p.disciplina} (Mod. ${p.modulo})</strong><span style="color:${cor}; font-size:0.75rem; font-weight:bold;">${txtSt}</span></div><p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">${p.descricao}</p><div style="font-size:0.8rem; color:var(--text-light);">Data Limite: <strong style="color:${cor};">${p.prazo}</strong> | Presenciais: <strong style="color:var(--text-light);">${p.horasPresenciais||0}h</strong></div></div>`;
        });
        cadernetaContent.innerHTML = html;
    } catch(e) {}
}

async function carregarComportamentoEE() {
    try {
        const fDisc = filtroDisc.value;
        const res = await getDocs(query(collection(db, "utilizadores", educandoAtualId, "ocorrencias")));
        let regs = []; res.forEach(d => { if(!fDisc || d.data().disciplina === fDisc) regs.push(d.data()); }); 
        if(regs.length === 0) { cadernetaContent.innerHTML = getEmptyState('Nenhum registo disciplinar.', 'fa-scale-balanced'); return; }
        regs.sort((a,b) => b.data.localeCompare(a.data)); 
        let html = '';
        regs.forEach(r => {
            const cor = r.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)';
            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; align-items:center; gap:8px; color:${cor}; margin-bottom:5px;"><i class="fa-solid fa-circle-exclamation"></i> <strong style="color:var(--text-light);">${r.titulo}</strong></div><span style="font-size:0.75rem; color:var(--text-muted);">Data: ${r.data} | Prof. ${r.autor}</span>${r.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px; background:rgba(0,0,0,0.2); padding:8px; border-radius:6px;">${r.descricao}</p>` : ''}</div>`;
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
    
    cadernetaContent.innerHTML = html;
    document.querySelectorAll('.btn-select-reuniao').forEach(btn => { btn.addEventListener('click', (e) => { carregarReunioesEE(e.currentTarget.getAttribute('data-id')); }); });

    try {
        const docSnap = await getDoc(doc(db, "utilizadores", educandoAtualId, "reunioes", reuniaoSelecionada));
        let dadosReuniao = docSnap.exists() ? docSnap.data() : {};
        
        const ordemDisciplinas = obterDisciplinasDoAno();
        let contentHtml = '<div style="display:flex; flex-direction:column; gap:10px;">';
        
        if (ordemDisciplinas.length === 0) {
            contentHtml += '<p class="text-muted center">Ainda não existem disciplinas associadas.</p>';
        } else {
            ordemDisciplinas.forEach(disc => {
                const comentario = dadosReuniao.disciplinas && dadosReuniao.disciplinas[disc] ? dadosReuniao.disciplinas[disc] : '<span style="color:var(--text-muted);">Sem comentário (SN)</span>';
                contentHtml += `<div class="card" style="margin-bottom:0; border-left:4px solid var(--primary-green); padding:15px;"><h4 style="margin-bottom:8px; color:var(--text-light); font-size:1rem;">${disc}</h4><p style="color:var(--text-light); font-size:0.9rem; line-height:1.4; margin:0;">${comentario}</p></div>`;
            });
        }
        
        const global = dadosReuniao.global || '<span style="color:var(--text-muted);">Sem observações globais registadas (SN).</span>';
        contentHtml += `<div class="card" style="margin-top:15px; border:1px solid var(--warning-yellow); background:rgba(255,204,0,0.05); padding:15px;"><h3 style="color:var(--warning-yellow); margin-bottom:10px; font-size:1.1rem;"><i class="fa-solid fa-comment-dots"></i> Observações Globais</h3><p style="color:var(--text-light); font-size:0.95rem; line-height:1.5; margin:0;">${global}</p></div></div>`;
        
        document.getElementById('reuniao-content-area').innerHTML = contentHtml;
    } catch(e) { document.getElementById('reuniao-content-area').innerHTML = '<p class="text-danger center">Erro ao carregar a reunião.</p>'; }
}

// 5. AGENDA E HORÁRIO
document.getElementById('filtro-agenda-testes')?.addEventListener('change', carregarAgendaEE);
document.getElementById('filtro-agenda-trabalhos')?.addEventListener('change', carregarAgendaEE);
document.getElementById('filtro-agenda-outros')?.addEventListener('change', carregarAgendaEE);

async function carregarAgendaEE() {
    const subContainer = document.getElementById('ee-agenda-content'); subContainer.innerHTML = '<p class="text-muted center">A sincronizar agenda...</p>';
    if(!turmaAtual) return;

    const mostraT = document.getElementById('filtro-agenda-testes').checked; const mostraTr = document.getElementById('filtro-agenda-trabalhos').checked; const mostraO = document.getElementById('filtro-agenda-outros').checked;
    try {
        const evDb = await getDocs(collection(db, "turmas", turmaAtual, "eventos"));
        if(evDb.empty) { subContainer.innerHTML = getEmptyState('Sem eventos agendados.', 'fa-calendar-xmark'); return; }
        
        let evs = [];
        evDb.forEach(d => { 
            const e = d.data(); let bgC = '#8b5cf6'; let txtT = 'Evento';
            if(e.tipo === 'teste' || e.tipo === 'avaliacao') { if(mostraT) { bgC = '#f59e0b'; txtT = 'Avaliação'; evs.push({...e, cor: bgC, txt: txtT}); } } 
            else if(e.tipo === 'trabalho' || e.tipo === 'entrega') { if(mostraTr) { bgC = '#00d2ff'; txtT = 'Entrega'; evs.push({...e, cor: bgC, txt: txtT}); } } 
            else { if(mostraO) evs.push({...e, cor: bgC, txt: txtT}); }
        });
        if(evs.length === 0) { subContainer.innerHTML = getEmptyState('Sem eventos com os filtros atuais.', 'fa-filter'); return; }
        
        const hoje = new Date().toISOString().split('T')[0];
        const futuros = evs.filter(e => e.data >= hoje).sort((a,b) => a.data.localeCompare(b.data));
        const passados = evs.filter(e => e.data < hoje).sort((a,b) => b.data.localeCompare(a.data));
        const mesArr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        let html = '';

        const renderEv = (ev) => { const dp = ev.data.split('-'); const mes = mesArr[parseInt(dp[1])-1]; return `<div class="calendar-event-card" style="border-left-color:${ev.cor}; margin-bottom:10px;"><div class="calendar-date-box"><span class="day">${dp[2]}</span><span class="month" style="color:${ev.cor};">${mes}</span></div><div class="calendar-info"><h4 style="margin:0; color:var(--text-light);">${ev.titulo}</h4><span style="font-size:0.8rem; color:var(--text-muted);">${(ev.txt||'evento').toUpperCase()}</span></div></div>`; };

        if(futuros.length > 0) { futuros.forEach(e => html += renderEv(e)); } else { html += '<p class="text-muted center">Sem eventos futuros.</p>'; }
        if(passados.length > 0) { html += '<div class="calendar-divider" style="margin-top:20px;"><span>Passados</span></div>'; passados.forEach(e => html += renderEv(e)); }
        subContainer.innerHTML = html;
    } catch(e) {}
}

let eeHorarioModo = 'dia'; let eeHorarioDiaOffset = 0; let eeHorarioSemanaOffset = 0;
document.getElementById('btn-horario-dia')?.addEventListener('click', (e) => { eeHorarioModo = 'dia'; e.currentTarget.classList.add('active'); document.getElementById('btn-horario-grelha').classList.remove('active'); carregarHorarioEE(); });
document.getElementById('btn-horario-grelha')?.addEventListener('click', (e) => { eeHorarioModo = 'grelha'; e.currentTarget.classList.add('active'); document.getElementById('btn-horario-dia').classList.remove('active'); carregarHorarioEE(); });
document.getElementById('btn-ee-prev-horario')?.addEventListener('click', () => { if(eeHorarioModo === 'dia') eeHorarioDiaOffset--; else eeHorarioSemanaOffset--; carregarHorarioEE(); });
document.getElementById('btn-ee-next-horario')?.addEventListener('click', () => { if(eeHorarioModo === 'dia') eeHorarioDiaOffset++; else eeHorarioSemanaOffset++; carregarHorarioEE(); });

const getCorEspecial = (dsc) => {
    const d = dsc.toLowerCase();
    if(d.includes('alm')) return { c: 'var(--warning-yellow)', bg: 'rgba(245, 158, 11, 0.1)' };
    if(d.includes('vis')) return { c: '#00d2ff', bg: 'rgba(0, 210, 255, 0.1)' };
    if(d.includes('prhf')) return { c: 'var(--danger-red)', bg: 'rgba(239, 68, 68, 0.1)' };
    if(d.includes('pap') || d.includes('fct')) return { c: '#ff9900', bg: 'rgba(255, 153, 0, 0.1)' };
    if(['reunião','reuniao','livre','estudo'].some(k => d.includes(k))) return { c: 'var(--accent-purple)', bg: 'rgba(139, 92, 246, 0.1)' };
    return { c: 'var(--primary-green)', bg: 'rgba(16, 185, 129, 0.05)' };
};

async function carregarHorarioEE() {
    const subContainer = document.getElementById('ee-horario-content'); subContainer.innerHTML = '<p class="text-muted center">A gerar horário...</p>';
    if(!turmaAtual) return;

    try {
        const docSnap = await getDoc(doc(db, "turmas", turmaAtual));
        let hb = {}; if(docSnap.exists() && docSnap.data().horario) hb = docSnap.data().horario;
        
        let profsCache = {};
        const pSnap = await getDocs(query(collection(db, "utilizadores"), where("papel", "==", "professor"), where("turmas", "array-contains", turmaAtual)));
        pSnap.forEach(d => { const profData = d.data(); if (profData.disciplinas) { profData.disciplinas.forEach(dsc => { profsCache[dsc] = profData.nome ? profData.nome.split(' ')[0] : 'Desconhecido'; }); } });

        const blocosKeys = ['1', '2', '3', '4', '1300', '5', '6', '7']; const blocosTempo = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' }; const diasMap = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado']; const fDt = (dt) => `${String(dt.getDate()).padStart(2,'0')}/${String(dt.getMonth()+1).padStart(2,'0')}`;

        if (eeHorarioModo === 'dia') {
            let targetDate = new Date(); targetDate.setDate(targetDate.getDate() + eeHorarioDiaOffset);
            document.getElementById('ee-horario-display').innerText = `${diasMap[targetDate.getDay()]}, ${fDt(targetDate)}`;

            let html = ''; let temAulasDia = false;
            const dataStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth()+1).padStart(2,'0')}-${String(targetDate.getDate()).padStart(2,'0')}`;

            blocosKeys.forEach(bId => {
                const disc = hb[`${dataStr}_${bId}`];
                if(disc) {
                    const sty = getCorEspecial(disc); const profNome = profsCache[disc] ? `Prof. ${profsCache[disc]}` : 'Prof. A Atribuir';
                    html += `<div class="horario-list-item" style="border-left-color:${sty.c}; background-color:${sty.bg};"><div class="horario-time-col">${blocosTempo[bId]}</div><div class="horario-disc-col"><div class="horario-disc-name">${disc}</div><div class="horario-prof">${profNome}</div></div></div>`;
                    temAulasDia = true;
                }
            });
            subContainer.innerHTML = temAulasDia ? html : getEmptyState('Sem aulas agendadas para hoje.', 'fa-mug-hot');
        } else {
            let dtT = new Date(); dtT.setDate(dtT.getDate() + (eeHorarioSemanaOffset * 7)); dtT.setDate(dtT.getDate() - (dtT.getDay() === 0 ? 6 : dtT.getDay() - 1));
            let dEnd = new Date(dtT); dEnd.setDate(dEnd.getDate() + 4);
            document.getElementById('ee-horario-display').innerText = `${fDt(dtT)} a ${fDt(dEnd)}`;

            let html = '<div class="horario-grid"><div class="horario-header"></div>'; let dtIter = new Date(dtT);
            ['SEG','TER','QUA','QUI','SEX'].forEach(d => { html += `<div class="horario-header">${d}<span>${fDt(dtIter)}</span></div>`; dtIter.setDate(dtIter.getDate()+1); });
            
            blocosKeys.forEach(bId => {
                html += `<div class="horario-time">${blocosTempo[bId]}</div>`; dtIter = new Date(dtT);
                for(let i=0; i<5; i++) {
                    const dStr = `${dtIter.getFullYear()}-${String(dtIter.getMonth()+1).padStart(2,'0')}-${String(dtIter.getDate()).padStart(2,'0')}`; const disc = hb[`${dStr}_${bId}`];
                    if(disc) { const sty = getCorEspecial(disc); html += `<div class="horario-slot filled" style="border-color:${sty.c}; background-color:${sty.bg};"><strong>${disc}</strong></div>`; } 
                    else html += `<div class="horario-slot"></div>`;
                    dtIter.setDate(dtIter.getDate()+1);
                }
            });
            subContainer.innerHTML = html + '</div>';
        }
    } catch(e) {}
}

// 6. CHAT E JUSTIFICAÇÕES 
let chatUnsubscribeEE = null;
function iniciarChatEE() {
    const chatContainer = document.getElementById('ee-chat-messages-container'); if(!educandoAtualId) return; if(chatUnsubscribeEE) chatUnsubscribeEE();
    chatUnsubscribeEE = onSnapshot(query(collection(db, "utilizadores", educandoAtualId, "chat_dt"), orderBy("timestamp")), (snapshot) => {
        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data(); const isMe = msg.remetente === myUserName || msg.autor === 'ee'; const classe = isMe ? 'admin' : 'student'; const autorLabel = isMe ? 'Tu' : (msg.autor === 'dt' ? 'Diretor de Turma' : msg.remetente);
            html += `<div class="chat-bubble ${classe}"><strong style="color:var(--text-light);">${autorLabel}</strong><br>${msg.texto}<span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>`;
        });
        if(html === '') html = getEmptyState('Inicie aqui a comunicação.', 'fa-comments');
        chatContainer.innerHTML = html; chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}
document.getElementById('btn-ee-send-msg')?.addEventListener('click', async () => { const inp = document.getElementById('ee-input-chat-msg'); const txt = inp.value.trim(); if(!txt || !educandoAtualId) return; try { await addDoc(collection(db, "utilizadores", educandoAtualId, "chat_dt"), { remetente: myUserName, autor: 'ee', texto: txt, timestamp: Date.now() }); inp.value = ''; } catch(e) {} });

let atestadoBase64 = "";
document.getElementById('ee-upload-atestado')?.addEventListener('change', (e) => {
    const file = e.target.files[0]; if(!file) return; if(file.size > 2097152) { alert("Ficheiro demasiado grande! Máx 2MB."); return; } 
    document.getElementById('ee-atestado-file-name').innerText = "Ficheiro: " + file.name; document.getElementById('btn-ee-enviar-atestado').style.display = 'block';
    const reader = new FileReader(); reader.onload = (ev) => { atestadoBase64 = ev.target.result; }; reader.readAsDataURL(file);
});
document.getElementById('btn-ee-enviar-atestado')?.addEventListener('click', async (e) => {
    if(!atestadoBase64 || !educandoAtualId) return; const obs = document.getElementById('ee-atestado-obs').value.trim();
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar...'; btnRef.disabled = true;
    try {
        await addDoc(collection(db, "utilizadores", educandoAtualId, "atestados"), { ficheiroBase64: atestadoBase64, observacoes: obs, status: "pendente", dataEnvio: new Date().toISOString() });
        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Enviado!';
        setTimeout(() => { document.getElementById('ee-atestado-file-name').innerText = ""; document.getElementById('ee-atestado-obs').value = ""; atestadoBase64 = ""; btnRef.style.display = 'none'; btnRef.disabled = false; btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Atestado'; carregarAtestadosEE(); }, 2000);
    } catch(err) { btnRef.innerHTML = "Erro!"; setTimeout(() => { btnRef.disabled = false; btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Atestado'; }, 2000); }
});

async function carregarAtestadosEE() {
    const container = document.getElementById('ee-lista-atestados-container'); container.innerHTML = '<p class="text-muted center">A procurar...</p>';
    if(!educandoAtualId) return;
    try {
        const res = await getDocs(query(collection(db, "utilizadores", educandoAtualId, "atestados")));
        if(res.empty) { container.innerHTML = getEmptyState('Nenhum comprovativo.', 'fa-file-invoice'); return; }
        let arr = []; res.forEach(d => arr.push(d.data())); arr.sort((a,b) => b.dataEnvio.localeCompare(a.dataEnvio)); 
        let html = '';
        arr.forEach(a => {
            let corStatus = 'var(--warning-yellow)'; let txtStatus = 'Em análise'; let iconStatus = '<i class="fa-regular fa-clock"></i>';
            if(a.status === 'aprovado' || a.status === 'aceite') { corStatus = 'var(--success-green)'; txtStatus = 'Aceite'; iconStatus = '<i class="fa-solid fa-check-circle"></i>'; }
            if(a.status === 'rejeitado' || a.status === 'recusada') { corStatus = 'var(--danger-red)'; txtStatus = 'Recusada'; iconStatus = '<i class="fa-solid fa-xmark-circle"></i>'; }
            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${corStatus}; display:flex; justify-content:space-between; align-items:center;"><div><strong style="color:var(--text-light);">Enviado a ${new Date(a.dataEnvio).toLocaleDateString('pt-PT')}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">${a.observacoes || 'Sem observações'}</span></div><div style="text-align: right;"><span style="font-size:0.8rem; font-weight:bold; color:${corStatus}; padding:6px 12px; background:rgba(255,255,255,0.05); border-radius:20px; display:inline-block;">${iconStatus} ${txtStatus}</span></div></div>`;
        });
        container.innerHTML = html;
    } catch(e) {}
}
