console.log("🚀 [TESTE EXTREMO] O ficheiro ee-app.js abriu e leu a linha 1!");

import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, addDoc, onSnapshot, orderBy, where, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
let myUserId = "";
let myUserName = "";
let educandosArray = [];
let educandoAtualId = "";
let turmaAtual = "";
let chartMediaEE = null;

// ==========================================
// FUNÇÕES DE SEGURANÇA PARA CLIQUES
// ==========================================
function bindClick(id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('click', fn); }
function bindChange(id, fn) { const el = document.getElementById(id); if (el) el.addEventListener('change', fn); }
function safeAddClass(id, className) { const el = document.getElementById(id); if (el) el.classList.add(className); }
function safeRemoveClass(id, className) { const el = document.getElementById(id); if (el) el.classList.remove(className); }

// ==========================================
// A MATRIZ DE REFERÊNCIA OFICIAL
// ==========================================
const matrizAmbos = {
    "Sociocultural": {
        "PORT": { "1": 33, "2": 34, "3": 33, "4": 33, "5": 34, "6": 33, "7": 40, "8": 40, "9": 40 },
        "ING": { "1": 27, "2": 24, "3": 24, "4": 24, "5": 24, "6": 24, "7": 24, "8": 24, "9": 24 },
        "AI": { "1": 36, "2": 36, "3": 36, "4": 36, "5": 37, "6": 39 },
        "EF": { "1": 10, "2": 8, "3": 10, "4": 10, "5": 10, "6": 12, "7": 6, "8": 12, "9": 8, "10": 10, "11": 12, "12": 8, "13": 6, "14": 10, "15": 6, "16": 2 },
        "TIC": { "1": 25, "2": 25, "3": 25, "4": 25 }
    },
    "Científica": {
        "GEO": { "1": 33, "2": 33, "3": 30, "4": 26, "5": 21, "6": 21, "7": 21, "8": 15 },
        "HCA": { "1": 20, "2": 18, "3": 18, "4": 18, "5": 24, "6": 18, "7": 18, "8": 24, "9": 21, "10": 21 },
        "MAT": { "1": 33, "2": 27, "3": 20, "4": 20 }
    }
};

const matrizAntigoTecnica = {
    "CF": { "1": 24, "2": 21, "3": 21, "4": 21, "5": 21, "6": 21, "7": 9, "8": 15, "9": 15 },
    "TIAT": { "1": 27, "2": 24, "3": 24, "4": 24, "5": 33, "6": 30, "7": 30, "8": 30, "9": 36, "10": 30, "11": 33, "12": 30, "13": 24 },
    "TCAT": { "1": 33, "2": 33, "3": 30, "4": 33, "5": 36, "6": 36, "7": 24 },
    "OTET": { "1": 24, "2": 24, "3": 33, "4": 30, "5": 24, "6": 24, "7": 36, "8": 27, "9": 33, "10": 30, "11": 30, "12": 17 }
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
    const anoMatch = turmaAtual ? turmaAtual.match(/\d+/) : null;
    const ano = anoMatch ? parseInt(anoMatch[0]) : 10;
    let m = JSON.parse(JSON.stringify(matrizAmbos));
    m["Técnica"] = (ano >= 11) ? matrizAntigoTecnica : matrizNovoTecnica;
    return m;
}

function getMatrizMap() {
    const anoMatch = turmaAtual ? turmaAtual.match(/\d+/) : null;
    const ano = anoMatch ? parseInt(anoMatch[0]) : 10;
    return {
        "Sociocultural": Object.keys(matrizAmbos["Sociocultural"]),
        "Científica": Object.keys(matrizAmbos["Científica"]),
        "Técnica": (ano >= 11) ? Object.keys(matrizAntigoTecnica) : Object.keys(matrizNovoTecnica)
    };
}

function obterDisciplinasDoAno() {
    const anoMatch = turmaAtual ? turmaAtual.match(/\d+/) : null;
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
// ARRANQUE E AUTENTICAÇÃO BLINDADA
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        let rawId = user.email.split('@')[0].toLowerCase();
        
        // TRUQUE INTELIGENTE: Se o ID começar por 'a' (ex: a3726), converte para 'e'
        if (rawId.startsWith('a')) {
            myUserId = 'e' + rawId.substring(1);
        } else {
            myUserId = rawId;
        }

        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            
            if (docSnap.exists()) {
                const dados = docSnap.data();
                const papelUser = (dados.papel || "").toLowerCase();
                
                // Aceita 'ee' ou 'encarregado_educacao'
                if (papelUser === 'ee' || papelUser === 'encarregado_educacao' || papelUser === 'encarregado') {
                    myUserName = dados.nome || "Encarregado";

                    // Extrator infalível do Educando
                    let arr = [];
                    if (dados.educando) { arr = [dados.educando.trim()]; }
                    else if (dados.educandos && Array.isArray(dados.educandos)) { arr = dados.educandos; }
                    else if (dados.educandoId && Array.isArray(dados.educandoId)) { arr = dados.educandoId; }
                    else if (dados.educandoId && typeof dados.educandoId === 'string') { arr = [dados.educandoId.trim()]; }

                    educandosArray = arr;

                    if (educandosArray.length > 0) {
                        await construirSeletorEducandos();
                    } else {
                        document.getElementById('header-ee-student-selector').innerHTML = '<option value="">Sem alunos associados</option>';
                        document.getElementById('ee-dashboard').innerHTML = getEmptyState('A sua conta não tem nenhum educando associado. Contacte a escola.', 'fa-user-group');
                    }
                } else {
                    alert("Acesso Negado: A sua conta não está registada como Encarregado de Educação.");
                    window.location.href = "index.html";
                }
            } else {
                alert(`Erro Crítico: O perfil '${myUserId}' não existe na base de dados!`);
                window.location.href = "index.html";
            }
        } catch (e) {
            console.error("Erro no login:", e);
        }
    } else {
        window.location.href = "index.html";
    }
});

async function construirSeletorEducandos() {
    const selector = document.getElementById('header-ee-student-selector');
    if (!selector) return;
    selector.innerHTML = '';
    
    let alunosCarregados = 0;

    for (let id of educandosArray) {
        if (!id) continue;
        try {
            const snap = await getDoc(doc(db, "utilizadores", id));
            if (snap.exists()) {
                const data = snap.data();
                const opt = document.createElement('option');
                opt.value = id;
                opt.text = `${data.nome ? data.nome.split(' ')[0] : "Aluno"} (${data.turma || "S/T"})`;
                selector.appendChild(opt);
                alunosCarregados++;
            }
        } catch (e) { console.error("Erro a ler aluno:", e); }
    }
    
    if (alunosCarregados > 0) {
        educandoAtualId = selector.value;
        // O AWAIT AQUI GARANTE QUE O DASHBOARD CARREGA
        await carregarDadosDoFilhoSelecionado(); 
        selector.onchange = (e) => {
            educandoAtualId = e.target.value;
            carregarDadosDoFilhoSelecionado();
        };
    } else {
        selector.innerHTML = '<option value="">Erro ao carregar o aluno</option>';
        document.getElementById('ee-dashboard').innerHTML = getEmptyState('Ocorreu um problema ao carregar a ficha do aluno. Ele pode ter sido apagado.', 'fa-triangle-exclamation');
    }
}

bindClick('btn-logout-ee', () => { signOut(auth).then(() => window.location.href = "index.html"); });

async function carregarDadosDoFilhoSelecionado() {
    if (!educandoAtualId) return;
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", educandoAtualId));
        if (docSnap.exists()) {
            turmaAtual = docSnap.data().turma || "";
            carregarResumoDashboard();

            const anoMatch = turmaAtual.match(/\d+/);
            const ano = anoMatch ? parseInt(anoMatch[0]) : 0;
            const cardProf = document.getElementById('card-percurso-prof');
            if (cardProf) {
                if (ano < 11) {
                    cardProf.style.display = 'none';
                } else {
                    cardProf.style.display = 'block';
                    carregarPercursoProfissional(docSnap.data());
                }
            }

            preencherFiltrosDisciplinas();

            const abaAtivaEl = document.querySelector('.bottom-nav .nav-item.active');
            if (abaAtivaEl) {
                const abaAtiva = abaAtivaEl.getAttribute('data-target');
                if (abaAtiva === 'view-ee-caderneta') ativarTabCadernetaAtual();
                if (abaAtiva === 'view-ee-agenda') carregarAgendaEE();
                if (abaAtiva === 'view-ee-horario') carregarHorarioEE();
            }

            // ==========================================
            // ATIVA O RADAR DE NOTIFICAÇÕES PARA ESTE ALUNO
            // ==========================================
            iniciarEscutaNotificacoes();
        }
    } catch (e) { }
}

function getUniformCircle(status) {
    if (status === true || status === 'verde') return '🟢';
    if (status === false || status === 'vermelho') return '🔴';
    if (status === 'amarelo') return '🟡';
    return '⚪';
}

function getRiscoBadge(status) {
    if (status === 'verde') return { cor: 'var(--success-green)', txt: '🟢 Normal' };
    if (status === 'amarelo') return { cor: 'var(--warning-yellow)', txt: '🟡 Atenção' };
    if (status === 'vermelho') return { cor: 'var(--danger-red)', txt: '🔴 Crítico' };
    return { cor: 'var(--text-muted)', txt: '⚪ Pendente' };
}

function carregarPercursoProfissional(alunoData) {
    const cardResumo = document.getElementById('card-percurso-prof');
    const miniFct = document.getElementById('resumo-mini-fct');
    const miniPap = document.getElementById('resumo-mini-pap');
    const btnPap = document.getElementById('btn-tab-pap');
    if (!cardResumo) return;

    miniFct.style.display = 'none';
    miniPap.style.display = 'none';
    if (btnPap) btnPap.style.display = 'none';
    let hasFct = false; let hasPap = false; let riscoGeral = null;

    if (alunoData.fct) {
        hasFct = true; miniFct.style.display = 'block';
        const f = alunoData.fct;
        const hr = f.horasRealizadas !== undefined ? Number(f.horasRealizadas) : 0;
        const ht = f.horasTotal !== undefined ? Number(f.horasTotal) : '-';
        const perc = (ht !== '-' && ht > 0) ? Math.round((hr / ht) * 100) : 0;

        document.getElementById('txt-mini-fct').innerText = ht !== '-' ? `${hr}/${ht} h (${perc}%)` : `${hr} h registadas`;
        document.getElementById('fct-horas-txt').innerText = ht !== '-' ? `${hr} / ${ht} h` : `${hr} h`;
        document.getElementById('fct-perc-txt').innerText = ht !== '-' ? `${perc}%` : '';
        document.getElementById('fct-progresso').style.width = ht !== '-' ? `${perc}%` : '0%';
        document.getElementById('fct-prev').innerText = f.horasPrevistas !== undefined ? f.horasPrevistas : '-';
        document.getElementById('fct-falta').innerText = ht !== '-' ? (ht - hr) : '-';

        const riscoF = getRiscoBadge(f.estadoRisco);
        document.getElementById('fct-badge-risco').innerText = riscoF.txt;
        document.getElementById('fct-card-risco').style.borderLeftColor = riscoF.cor;
        riscoGeral = f.estadoRisco || 'branco';

        let docsHtml = '';
        const dNames = { protocolo: 'Protocolo', plano: 'Plano de Estágio', folhas: 'Folhas de Estágio', registos: 'Registos de Visita', avaliacao: 'Avaliação', autoavaliacao: 'Autoavaliação' };
        for (let key in dNames) {
            let st = (f.docs && f.docs[key] !== undefined) ? f.docs[key] : null;
            let ic = getUniformCircle(st);
            docsHtml += `<div style="display:flex; justify-content:space-between; border-bottom:1px solid #222; padding-bottom:5px;"><span>${dNames[key]}</span> <span style="font-size:1.1rem;">${ic}</span></div>`;
        }
        document.getElementById('fct-docs-lista').innerHTML = docsHtml;
    }

    if (alunoData.pap) {
        hasPap = true; miniPap.style.display = 'block';
        if (btnPap) btnPap.style.display = 'block';
        const p = alunoData.pap;

        document.getElementById('txt-mini-pap').innerText = p.faseAtual || 'A aguardar fase...';
        document.getElementById('pap-tema').innerText = p.tema || 'A aguardar definição de tema...';
        document.getElementById('pap-orientador').innerText = p.orientador || 'Não definido';
        document.getElementById('pap-data').innerText = p.dataDefesa || 'Não definida';
        document.getElementById('pap-obs-txt').innerText = p.notasOrientador || 'Sem observações registadas.';

        const riscoP = getRiscoBadge(p.estadoRisco);
        document.getElementById('pap-badge-risco').innerText = riscoP.txt;
        document.getElementById('pap-card-risco').style.borderLeftColor = riscoP.cor;

        if (riscoGeral !== 'vermelho') {
            if (p.estadoRisco === 'vermelho') riscoGeral = 'vermelho';
            else if (p.estadoRisco === 'amarelo') riscoGeral = 'amarelo';
            else if (!riscoGeral) riscoGeral = p.estadoRisco;
        }

        let fasesHtml = '';
        const fNames = { escolha: 'Escolha do Tema', aprovacao: 'Aprovação', desenvolvimento: 'Desenvolvimento', relatorio: 'Relatório', apresentacao: 'Apresentação' };

        for (let key in fNames) {
            let st = (p.fases && p.fases[key] !== undefined) ? p.fases[key] : null;
            let statusVal = null; let prazoVal = "";
            if (st !== null && typeof st === 'object') { statusVal = st.status; prazoVal = st.prazo || ""; } else { statusVal = st; }
            let ic = getUniformCircle(statusVal);
            let prazoHtml = prazoVal ? `<br><span style="font-size:0.75rem; color:var(--text-muted); font-weight:normal;"><i class="fa-regular fa-calendar"></i> Até: ${prazoVal}</span>` : '';
            fasesHtml += `<div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px solid #222; padding-bottom:8px; margin-bottom:5px;"><div><strong style="color:var(--text-light); font-size:0.9rem;">${fNames[key]}</strong>${prazoHtml}</div> <span style="font-size:1.1rem;">${ic}</span></div>`;
        }
        document.getElementById('pap-fases-lista').innerHTML = fasesHtml;
    }

    if (hasFct || hasPap) {
        cardResumo.style.display = 'block';
        const rg = getRiscoBadge(riscoGeral || 'branco');
        const b = document.getElementById('badge-risco-geral');
        if (b) {
            let bgColor = rg.cor === 'var(--text-muted)' ? 'rgba(255,255,255,0.05)' : rg.cor === 'var(--success-green)' ? 'rgba(40,167,69,0.1)' : rg.cor === 'var(--warning-yellow)' ? 'rgba(255,204,0,0.1)' : 'rgba(255,77,77,0.1)';
            b.innerText = rg.txt; b.style.color = rg.cor; b.style.background = bgColor;
            cardResumo.style.borderLeftColor = rg.cor;
        }
    }
}

bindClick('card-percurso-prof', () => {
    document.querySelectorAll('.nav-item').forEach(nav => nav.classList.remove('active'));
    esconderTodasAsVistas();
    document.getElementById('view-ee-profissional').style.display = 'block';
});

bindClick('btn-voltar-prof', () => {
    esconderTodasAsVistas();
    document.getElementById('ee-dashboard').style.display = 'block';
    safeAddClass(document.querySelector('.nav-item[data-target="ee-dashboard"]'), 'active');
});

bindClick('btn-tab-fct', () => {
    safeAddClass('btn-tab-fct', 'active'); safeRemoveClass('btn-tab-pap', 'active');
    const cFct = document.getElementById('content-prof-fct'); if (cFct) cFct.style.display = 'block';
    const cPap = document.getElementById('content-prof-pap'); if (cPap) cPap.style.display = 'none';
});

bindClick('btn-tab-pap', () => {
    safeAddClass('btn-tab-pap', 'active'); safeRemoveClass('btn-tab-fct', 'active');
    const cPap = document.getElementById('content-prof-pap'); if (cPap) cPap.style.display = 'block';
    const cFct = document.getElementById('content-prof-fct'); if (cFct) cFct.style.display = 'none';
});

// ==========================================
// CACHE INTELIGENTE PARA E.E. (COFRE 12H)
// ==========================================
async function lerFirebaseOuCacheEE(caminho) {
    const cacheChave = `cache_ee_${caminho.replace(/\//g, '_')}`;
    const tempoChave = `tempo_${cacheChave}`;
    const agora = Date.now();
    const tempoGuardado = localStorage.getItem(tempoChave);
    let arrayDados = [];
    
    if (tempoGuardado && (agora - parseInt(tempoGuardado) < 43200000)) {
        console.log(`⚡ A ler do Cofre Local: ${caminho}`);
        arrayDados = JSON.parse(localStorage.getItem(cacheChave));
    } else {
        console.log(`🔥 A ler do Firebase: ${caminho}`);
        const snap = await getDocs(collection(db, caminho));
        snap.forEach(d => arrayDados.push({ _id: d.id, ...d.data() }));
        localStorage.setItem(cacheChave, JSON.stringify(arrayDados));
        localStorage.setItem(tempoChave, agora.toString());
    }
    
    // Simula a resposta do Firebase para não quebrar o teu código antigo!
    return {
        empty: arrayDados.length === 0,
        docs: arrayDados.map(item => ({ id: item._id, data: () => item })),
        forEach: function(cb) { this.docs.forEach(doc => cb(doc)); }
    };
}

// ==========================================
// DASHBOARD
// ==========================================
async function carregarResumoDashboard() {
    let sumG = 0, countG = 0, sumS = 0, countS = 0, sumC = 0, countC = 0, sumT = 0, countT = 0;
    let faltasTotais = 0; let nPrhf = 0;

    try {
        const notasNovas = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/avaliacoes`);
        const notasAntigas = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/notas`);
        
        // --- O DESEMPACOTADOR AQUI ---
        let todasAsNotas = [...notasNovas.docs];
        notasAntigas.forEach(d => {
            const data = d.data();
            if(data.lista_notas) data.lista_notas.forEach(n => todasAsNotas.push({ data: () => n }));
            else if(data.disciplina) todasAsNotas.push(d);
        });

        let mapaUnico = {};
        todasAsNotas.forEach(d => {
            const n = d.data();
            const m = n.modulo ? n.modulo.toString().replace(/\D/g, '') : '?';
            mapaUnico[`${n.disciplina}_${m}`] = n;
        });

        const map = getMatrizMap();

        Object.values(mapaUnico).forEach(n => {
            const val = n.nota; const disc = n.disciplina;
            if (val !== 'REP' && !isNaN(val)) {
                const vNum = Number(val); sumG += vNum; countG++;
                if (map["Sociocultural"].includes(disc)) { sumS += vNum; countS++; }
                else if (map["Científica"].includes(disc)) { sumC += vNum; countC++; }
                else { sumT += vNum; countT++; }
            }
        });

        const mG = countG > 0 ? (sumG / countG).toFixed(1) : '-';
        document.getElementById('resumo-media').innerText = mG;
        document.getElementById('resumo-media').style.color = (mG !== '-' && mG < 10) ? 'var(--danger-red)' : 'var(--primary-green)';

        document.getElementById('resumo-med-socio').innerText = countS > 0 ? (sumS / countS).toFixed(1) : '-';
        document.getElementById('resumo-med-cient').innerText = countC > 0 ? (sumC / countC).toFixed(1) : '-';
        document.getElementById('resumo-med-tec').innerText = countT > 0 ? (sumT / countT).toFixed(1) : '-';

        const ctx = document.getElementById('eeChartMedia');
        if (ctx) {
            if (chartMediaEE) chartMediaEE.destroy();
            const valS = countS > 0 ? sumS / countS : 0; const valC = countC > 0 ? sumC / countC : 0; const valT = countT > 0 ? sumT / countT : 0;

            if (valS === 0 && valC === 0 && valT === 0) {
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
    } catch (e) { }

    try {
        const uSnap = await getDoc(doc(db, "utilizadores", educandoAtualId));
        if (uSnap.exists()) {
            const xp = uSnap.data().xp || 0;
            const nivel = Math.floor(xp / 100) + 1;
            document.getElementById('resumo-nivel-xp').innerText = `Nvl ${nivel}`;
        }
    } catch (e) { }

    try {
        const faltasSnap = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/faltas`);
        faltasSnap.forEach(d => {
            const faltaData = d.data();
            if (faltaData.justificada === false || !faltaData.hasOwnProperty("justificada")) {
                faltasTotais += Number(faltaData.duracaoBlocos) || Number(faltaData.horas) || 0;
            }
        });

        const textElement = document.getElementById('resumo-faltas');
        textElement.innerText = `${faltasTotais}h`;
        if (faltasTotais > 0) { textElement.style.color = "var(--danger-red)"; } else { textElement.style.color = "white"; }
    } catch (e) { }

    try {
        const prhfSnap = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/prhfs`);
        prhfSnap.forEach(d => { if ((d.data().status || 'ativa') === 'ativa') nPrhf++; });
        document.getElementById('resumo-prhfs').innerText = nPrhf;
    } catch (e) { }

    try {
        if (turmaAtual) {
            const evSnap = await lerFirebaseOuCacheEE(`turmas/${turmaAtual}/eventos`);
            const hojeIso = new Date().toISOString().split('T')[0];
            let futuros = [];
            evSnap.forEach(d => { if (d.data().data >= hojeIso) futuros.push(d.data()); });

            if (futuros.length > 0) {
                futuros.sort((a, b) => a.data.localeCompare(b.data));
                const dp = futuros[0].data.split('-');
                document.getElementById('resumo-proximo-evento').innerHTML = `<strong style="color:var(--text-light);">${dp[2]}/${dp[1]}</strong><br><span style="font-size:0.7rem; color:var(--text-muted);">${futuros[0].titulo}</span>`;
            } else {
                document.getElementById('resumo-proximo-evento').innerText = "Agenda limpa";
            }
        }
    } catch (e) { }
}

const navItems = document.querySelectorAll('.nav-item');
const views = ['ee-dashboard', 'view-ee-caderneta', 'view-ee-agenda', 'view-ee-horario', 'view-ee-chat', 'view-ee-justificar', 'view-ee-notificacoes', 'view-ee-profissional'];

function esconderTodasAsVistas() {
    views.forEach(id => { const el = document.getElementById(id); if (el) el.style.display = 'none'; });
}

navItems.forEach(item => {
    item.addEventListener('click', (e) => {
        e.preventDefault();
        navItems.forEach(nav => nav.classList.remove('active'));
        e.currentTarget.classList.add('active');

        esconderTodasAsVistas();
        const targetId = e.currentTarget.getAttribute('data-target');
        const targetView = document.getElementById(targetId);

        if (targetId === 'view-ee-chat') { if (targetView) targetView.style.display = 'flex'; }
        else if (targetView) { targetView.style.display = 'block'; }

        if (targetId === 'view-ee-caderneta') ativarTabCadernetaAtual();
        if (targetId === 'view-ee-agenda') carregarAgendaEE();
        if (targetId === 'view-ee-horario') carregarHorarioEE();
    });
});

bindClick('btn-quick-mensagem', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    esconderTodasAsVistas();
    const vw = document.getElementById('view-ee-chat'); if (vw) vw.style.display = 'flex';
    iniciarChatEE();
});

bindClick('btn-quick-justificar', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    esconderTodasAsVistas();
    const vw = document.getElementById('view-ee-justificar'); if (vw) vw.style.display = 'block';
    carregarAtestadosEE();
});

['btn-voltar-chat-ee', 'btn-voltar-justificar', 'btn-voltar-notificacoes'].forEach(id => {
    bindClick(id, () => {
        navItems.forEach(nav => nav.classList.remove('active'));
        const tgt = document.querySelector('.nav-item[data-target="ee-dashboard"]'); if (tgt) tgt.classList.add('active');
        esconderTodasAsVistas();
        const dash = document.getElementById('ee-dashboard'); if (dash) dash.style.display = 'block';
    });
});

// ==========================================
// SISTEMA DE NOTIFICAÇÕES EM TEMPO REAL (RPG)
// ==========================================
let unsubNotificacoes = null;

function iniciarEscutaNotificacoes() {
    if (!educandoAtualId) return;
    if (unsubNotificacoes) unsubNotificacoes();

    const qOco = query(collection(db, "utilizadores", educandoAtualId, "ocorrencias"), orderBy("data", "desc"));

    unsubNotificacoes = onSnapshot(qOco, (snap) => {
        let naoLidas = 0;
        let html = '';

        snap.forEach(docSnap => {
            const oco = docSnap.data();
            if (oco.notificarEE && !oco.lidaEE) naoLidas++;

            const isPos = oco.tipo === 'positiva';
            const cor = isPos ? 'var(--success-green)' : 'var(--danger-red)';
            const icone = isPos ? 'fa-bolt' : 'fa-triangle-exclamation';
            const xpTexto = oco.xp ? (oco.xp > 0 ? `+${oco.xp} XP` : `${oco.xp} XP`) : '';

            html += `
            <div class="card" style="border-left: 4px solid ${cor}; margin-bottom:10px; background: rgba(0,0,0,0.2);">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                    <strong style="color:white; font-size:0.95rem;"><i class="fa-solid ${icone}" style="color:${cor};"></i> ${oco.titulo}</strong>
                    <span style="color:${cor}; font-weight:bold; font-size:0.85rem;">${xpTexto}</span>
                </div>
                <p style="font-size:0.85rem; color:var(--text-light); margin-bottom:8px;">${oco.descricao}</p>
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <span style="font-size:0.75rem; color:var(--text-muted);">${new Date(oco.data).toLocaleString('pt-PT', { day: '2-digit', month: '2-digit', hour: '2-digit', minute: '2-digit' })} | Prof. ${oco.autor}</span>
                    ${!oco.lidaEE
                    ? `<button class="btn-marcar-lida" data-id="${docSnap.id}" style="background:rgba(255,255,255,0.1); border:1px solid ${cor}; color:${cor}; border-radius:4px; padding:4px 10px; font-size:0.75rem; cursor:pointer; font-weight:bold;"><i class="fa-solid fa-check"></i> Visto</button>`
                    : `<span style="font-size:0.75rem; color:var(--text-muted);"><i class="fa-solid fa-check-double"></i> Lido</span>`
                }
                </div>
            </div>`;
        });

        const btnSino = document.getElementById('btn-open-notificacoes');
        if (btnSino) {
            if (naoLidas > 0) {
                btnSino.innerHTML = `<i class="fa-solid fa-bell fa-shake" style="color:var(--danger-red);"></i> <span style="position:absolute; top:-5px; right:-5px; background:var(--danger-red); color:white; font-size:0.6rem; font-weight:bold; padding:2px 5px; border-radius:50%;">${naoLidas}</span>`;
                btnSino.style.position = 'relative';
            } else {
                btnSino.innerHTML = `<i class="fa-solid fa-bell" style="color:white;"></i>`;
            }
        }

        const cont = document.getElementById('ee-notificacoes-container');
        if (cont) {
            cont.innerHTML = html === '' ? getEmptyState('Não há registos disciplinares ou de evolução.', 'fa-bell-slash') : html;
            document.querySelectorAll('.btn-marcar-lida').forEach(b => {
                b.addEventListener('click', async (e) => {
                    const id = e.currentTarget.getAttribute('data-id');
                    e.currentTarget.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                    await setDoc(doc(db, "utilizadores", educandoAtualId, "ocorrencias", id), { lidaEE: true }, { merge: true });
                });
            });
        }
    });
}

bindClick('btn-open-notificacoes', () => {
    navItems.forEach(nav => nav.classList.remove('active'));
    esconderTodasAsVistas();
    const vw = document.getElementById('view-ee-notificacoes');
    if (vw) vw.style.display = 'block';
});

// ==========================================
// CADERNETA 
// ==========================================
let currentCadernetaTabId = 'tab-ee-timeline';

function preencherFiltrosDisciplinas() {
    const disciplinas = obterDisciplinasDoAno();
    let opt = '<option value="">Todas as Disciplinas</option>';
    disciplinas.forEach(d => opt += `<option value="${d}">${d}</option>`);
    const filtroDisc = document.getElementById('filtro-caderneta-disc');
    if (filtroDisc) filtroDisc.innerHTML = opt;
}

bindChange('filtro-caderneta-disc', () => ativarTabCadernetaAtual());

function ativarTabCadernetaAtual() {
    const el = document.getElementById(currentCadernetaTabId);
    if (el) el.click();
}

function switchTabConfig(tabId, hideIds, showFilter) {
    currentCadernetaTabId = tabId;
    safeAddClass(tabId, 'active');
    hideIds.forEach(id => safeRemoveClass(id, 'active'));

    const fCont = document.getElementById('filtro-caderneta-container');
    if (fCont) fCont.style.display = showFilter ? 'block' : 'none';

    const cadCont = document.getElementById('ee-caderneta-content');
    if (cadCont) cadCont.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>';
}

bindClick('tab-ee-timeline', () => { switchTabConfig('tab-ee-timeline', ['tab-ee-notas', 'tab-ee-faltas', 'tab-ee-prhfs', 'tab-ee-evolucao', 'tab-ee-reunioes'], false); carregarTimelineEE(); });
bindClick('tab-ee-notas', () => { switchTabConfig('tab-ee-notas', ['tab-ee-timeline', 'tab-ee-faltas', 'tab-ee-prhfs', 'tab-ee-evolucao', 'tab-ee-reunioes'], false); carregarNotasEE(); });
bindClick('tab-ee-faltas', () => { switchTabConfig('tab-ee-faltas', ['tab-ee-timeline', 'tab-ee-notas', 'tab-ee-prhfs', 'tab-ee-evolucao', 'tab-ee-reunioes'], true); carregarFaltasEE(); });
bindClick('tab-ee-prhfs', () => { switchTabConfig('tab-ee-prhfs', ['tab-ee-timeline', 'tab-ee-notas', 'tab-ee-faltas', 'tab-ee-evolucao', 'tab-ee-reunioes'], true); carregarPrhfsEE(); });
bindClick('tab-ee-evolucao', () => { switchTabConfig('tab-ee-evolucao', ['tab-ee-timeline', 'tab-ee-notas', 'tab-ee-faltas', 'tab-ee-prhfs', 'tab-ee-reunioes'], false); carregarEvolucaoEE(); });
bindClick('tab-ee-reunioes', () => { switchTabConfig('tab-ee-reunioes', ['tab-ee-timeline', 'tab-ee-notas', 'tab-ee-faltas', 'tab-ee-prhfs', 'tab-ee-evolucao'], false); carregarReunioesEE(); });

async function carregarEvolucaoEE() {
    const cadernetaContent = document.getElementById('ee-caderneta-content');
    if (!cadernetaContent) return;
    cadernetaContent.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar evolução...</p>';

    try {
        const uSnap = await getDoc(doc(db, "utilizadores", educandoAtualId));
        const data = uSnap.exists() ? uSnap.data() : {};

        const getLvl = (xp) => Math.floor((xp || 0) / 100) + 1;
        const getPerc = (xp) => ((xp || 0) % 100);

        const lvlCom = getLvl(data.xp_comunicacao); const percCom = getPerc(data.xp_comunicacao);
        const lvlCri = getLvl(data.xp_criatividade); const percCri = getPerc(data.xp_criatividade);
        const lvlLid = getLvl(data.xp_lideranca); const percLid = getPerc(data.xp_lideranca);
        const lvlOrg = getLvl(data.xp_organizacao); const percOrg = getPerc(data.xp_organizacao);

        let html = `
        <div class="card" style="border-top: 4px solid var(--primary-green); margin-bottom: 20px;">
            <h3 style="color: white; margin-bottom: 15px; font-size: 1.1rem;"><i class="fa-solid fa-chart-radar"></i> Perfil de Competências</h3>
            <div style="margin-bottom: 12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-comments" style="color:#0ea5e9;"></i> Comunicação & Hospitalidade</span><strong style="color:var(--primary-green);">Nvl ${lvlCom}</strong></div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percCom}%; background:#0ea5e9;"></div></div>
            </div>
            <div style="margin-bottom: 12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-lightbulb" style="color:#8b5cf6;"></i> Criatividade & Inovação</span><strong style="color:var(--primary-green);">Nvl ${lvlCri}</strong></div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percCri}%; background:#8b5cf6;"></div></div>
            </div>
            <div style="margin-bottom: 12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-compass" style="color:#f97316;"></i> Liderança & Autonomia</span><strong style="color:var(--primary-green);">Nvl ${lvlLid}</strong></div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percLid}%; background:#f97316;"></div></div>
            </div>
            <div style="margin-bottom: 12px;">
                <div style="display:flex; justify-content:space-between; margin-bottom:5px; font-size:0.9rem;"><span><i class="fa-solid fa-chess-knight" style="color:#10b981;"></i> Organização & Estratégia</span><strong style="color:var(--primary-green);">Nvl ${lvlOrg}</strong></div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width: ${percOrg}%; background:#10b981;"></div></div>
            </div>
        </div>
        <h4 style="color:var(--text-muted); margin-bottom:10px; font-size:0.9rem; text-transform:uppercase;"><i class="fa-solid fa-bolt"></i> Últimos Registos</h4>`;

        const fDiscEl = document.getElementById('filtro-caderneta-disc');
        const fDisc = fDiscEl ? fDiscEl.value : "";
        const ocSnap = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/ocorrencias`);
        let regs = [];
        ocSnap.forEach(d => { if (!fDisc || d.data().disciplina === fDisc) regs.push(d.data()); });

        if (regs.length === 0) {
            html += getEmptyState('Sem registos de evolução.', 'fa-star');
        } else {
            regs.sort((a, b) => b.data.localeCompare(a.data));
            regs.slice(0, 15).forEach(r => {
                const isPos = r.tipo === 'positiva';
                const cor = isPos ? 'var(--success-green)' : 'var(--danger-red)';
                const bgCor = isPos ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)';
                const xpLabel = r.xp ? (r.xp > 0 ? `+${r.xp} XP` : `${r.xp} XP`) : (isPos ? 'Registo Positivo' : 'Registo Negativo');

                html += `
                <div style="display:flex; align-items:center; justify-content:space-between; background:${bgCor}; border: 1px solid ${cor}; padding: 12px; border-radius: 8px; margin-bottom: 10px;">
                    <div>
                        <strong style="color:${cor}; font-size:1.1rem;">${xpLabel}</strong><br>
                        <span style="color:var(--text-light); font-size:0.95rem; font-weight:bold;">${r.titulo}</span>
                        ${r.descricao ? `<div style="color:var(--text-muted); font-size:0.85rem; margin-top:3px;">${r.descricao}</div>` : ''}
                    </div>
                    <div style="text-align:right; font-size:0.75rem; color:var(--text-muted);">
                        ${r.data}<br>Prof. ${r.autor}
                    </div>
                </div>`;
            });
        }

        cadernetaContent.innerHTML = html;
    } catch (e) {
        cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao carregar evolução.</p>';
    }
}

async function carregarTimelineEE() {
    if (!educandoAtualId) return;
    const cadernetaContent = document.getElementById('ee-caderneta-content');
    try {
        let eventos = [];
        
        // 1. Vai buscar as notas às DUAS gavetas (novas e antigas agregadas)
        const notasNovas = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/avaliacoes`);
        const notasAntigas = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/notas`);
        
        // --- O DESEMPACOTADOR ---
        let notasProcessadas = [...notasNovas.docs];
        notasAntigas.forEach(d => {
            const data = d.data();
            if(data.lista_notas) data.lista_notas.forEach(n => notasProcessadas.push({ data: () => n }));
            else if(data.disciplina) notasProcessadas.push(d);
        });

        // 2. Transforma as notas desempacotadas em "Eventos" da Timeline
        notasProcessadas.forEach(d => {
            const n = d.data();
            eventos.push({ 
                time: new Date(n.data || Date.now()).getTime(), 
                icon: '<i class="fa-solid fa-graduation-cap"></i>', 
                cor: 'var(--primary-green)', 
                titulo: 'Nova Avaliação', 
                desc: `${n.disciplina} (Mod. ${n.modulo}): <strong style="color:var(--text-light);">${n.nota}</strong>` 
            });
        });

        // O resto da tua função continua igual (as faltas, ocorrências e PRHFs não foram agrupadas em array)
        const faltasSnap = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/faltas`);
        faltasSnap.forEach(d => {
            const f = d.data();
            const horasFalta = f.duracaoBlocos || f.duracao || f.horas || 2; 
            eventos.push({ 
                time: new Date(f.criadoEm || f.dataRegisto || f.dataInicio || Date.now()).getTime(), 
                icon: '<i class="fa-solid fa-user-xmark"></i>', 
                cor: f.justificada ? 'var(--success-green)' : 'var(--danger-red)', 
                titulo: `Falta a ${f.disciplina} (${horasFalta}h)`, 
                desc: f.justificada ? `Justificada` : `Falta registada.` 
            });
        });

        const ocSnap = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/ocorrencias`);
        ocSnap.forEach(d => {
            const o = d.data();
            eventos.push({ time: o.timestamp || Date.now(), icon: o.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>', cor: o.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)', titulo: `Registo Disciplinar`, desc: `<strong style="color:var(--text-light);">${o.titulo}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">${o.descricao || ''}</span>` });
        });

        const prhfSnap = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/prhfs`);
        prhfSnap.forEach(d => {
            const p = d.data();
            eventos.push({ time: new Date(p.dataRegisto || Date.now()).getTime(), icon: '<i class="fa-solid fa-book-medical"></i>', cor: 'var(--warning-yellow)', titulo: `Plano de Recuperação Criado`, desc: `${p.disciplina} (Mod. ${p.modulo})` });
        });

        eventos = eventos.filter(ev => !isNaN(ev.time));
        eventos.sort((a, b) => b.time - a.time);

        if (eventos.length === 0) {
            if (cadernetaContent) cadernetaContent.innerHTML = getEmptyState('Nenhuma atividade recente encontrada.', 'fa-timeline');
            return;
        }

        let html = '<div class="timeline">';
        eventos.forEach(ev => {
            html += `<div class="timeline-item"><div class="timeline-icon" style="color: ${ev.cor}; border-color: ${ev.cor};">${ev.icon}</div><div class="timeline-content" style="border-left: 3px solid ${ev.cor};"><span class="timeline-date">${new Date(ev.time).toLocaleDateString('pt-PT', { day: 'numeric', month: 'short' })}</span><strong style="color:var(--text-light); display:block; margin-bottom:5px;">${ev.titulo}</strong><p style="font-size:0.85rem; color:var(--text-light); margin:0;">${ev.desc}</p></div></div>`;
        });
        if (cadernetaContent) cadernetaContent.innerHTML = html + '</div>';
    } catch (e) { }
}

async function carregarNotasEE() {
    const cadernetaContent = document.getElementById('ee-caderneta-content');
    if (!cadernetaContent) return;

    cadernetaContent.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar avaliações...</p>';

    try {
        const notasNovas = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/avaliacoes`);
        const notasAntigas = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/notas`);

        // --- O DESEMPACOTADOR AQUI ---
        let notasProcessadas = [...notasNovas.docs];
        notasAntigas.forEach(d => {
            const data = d.data();
            if(data.lista_notas) data.lista_notas.forEach(n => notasProcessadas.push({ data: () => n }));
            else if(data.disciplina) notasProcessadas.push(d);
        });

        let disciplinasDoAluno = {};
        window.mapNotasCache = {};

        // Iterar sobre a nova lista desempacotada
        notasProcessadas.forEach(d => {
            const n = d.data();
            const discNome = (n.disciplina || '').trim();
            const modF = n.modulo ? n.modulo.toString().replace(/\D/g, '') : '?';
            n.modulo = modF;

            if (!disciplinasDoAluno[discNome]) disciplinasDoAluno[discNome] = [];

            const index = disciplinasDoAluno[discNome].findIndex(x => x.modulo === modF);
            if (index > -1) {
                disciplinasDoAluno[discNome][index] = n;
            } else {
                disciplinasDoAluno[discNome].push(n);
            }

            window.mapNotasCache[`${discNome}_${modF}`] = n.nota;
        });

        const ordemDisciplinas = obterDisciplinasDoAno();
        let html = `<button id="btn-pauta-global" class="primary-btn" style="margin-bottom: 20px; background-color: transparent; border: 1px solid var(--primary-green); color: var(--primary-green);"><i class="fa-solid fa-table-list"></i> Pauta Global</button>`;

        ordemDisciplinas.forEach(disc => {
            const discTrim = disc.trim();
            if (disciplinasDoAluno[discTrim] && disciplinasDoAluno[discTrim].length > 0) {
                let sum = 0; let c = 0; let modsHtml = '';

                disciplinasDoAluno[discTrim].sort((a, b) => parseInt(a.modulo) - parseInt(b.modulo)).forEach(n => {
                    if (n.nota !== 'REP' && !isNaN(n.nota)) { sum += Number(n.nota); c++; }
                    const cor = (n.nota === 'REP' || Number(n.nota) < 10) ? 'var(--danger-red)' : 'var(--success-green)';
                    const modLabel = n.modulo.toString().startsWith('UC') ? n.modulo : `Módulo ${n.modulo}`;
                    modsHtml += `<div class="modulo-row"><span style="color:var(--text-light);">${modLabel}</span><span style="font-weight:bold; color:${cor};">${n.nota}</span></div>`;
                });

                const med = c > 0 ? (sum / c).toFixed(1) : '-';
                const medCor = (med !== '-' && med < 10) ? 'var(--danger-red)' : 'var(--text-light)';

                html += `<div class="disciplina-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'">
                            <span class="disciplina-title" style="color:var(--text-light);">${discTrim}</span>
                            <span><span style="font-size:0.75rem; color:var(--text-muted); margin-right:8px;">Média:</span><span class="disciplina-media" style="color:${medCor};">${med}</span> <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; color:var(--text-muted); margin-left:5px;"></i></span>
                         </div><div class="disciplina-modules" style="display:none;">${modsHtml}</div>`;
            } else {
                html += `<div class="disciplina-header" style="cursor:default;">
                            <span class="disciplina-title" style="color:var(--text-muted);">${discTrim}</span>
                            <span><span class="disciplina-media" style="color:var(--text-muted); font-size:0.9rem;">SN</span></span>
                         </div>`;
            }
        });

        if (cadernetaContent) cadernetaContent.innerHTML = html;

        bindClick('btn-pauta-global', () => {
            const mod = document.getElementById('modal-pauta-global'); if (mod) mod.style.display = 'flex';
            const container = document.getElementById('pauta-global-content');
            try {
                const matriz = getMatriz();
                let pHtml = '';

                for (const [nomeComponente, disciplinas] of Object.entries(matriz)) {
                    pHtml += `<div class="pauta-global-componente"><div class="pauta-global-header">${nomeComponente}</div>`;
                    for (const [nomeDisc, modulos] of Object.entries(disciplinas)) {
                        pHtml += `<div class="pauta-global-disc"><div class="pauta-global-disc-title">${nomeDisc}</div><div class="pauta-global-notas">`;

                        const isNumeric = Object.keys(modulos).every(k => !isNaN(k));
                        const modKeys = isNumeric ? Object.keys(modulos).sort((a, b) => parseInt(a) - parseInt(b)) : Object.keys(modulos);

                        for (const mod of modKeys) {
                            const nota = window.mapNotasCache[`${nomeDisc.trim()}_${mod}`] || 'SN';
                            let cor = "sn";
                            if (nota !== 'SN' && nota !== 'REP' && nota >= 10) cor = "positiva";
                            else if (nota === 'REP' || nota < 10) cor = "negativa";
                            const modLabel = mod.toString().startsWith('UC') ? mod : `M${mod}`;
                            pHtml += `<div class="pg-nota-item"><span>${modLabel}</span><span class="pg-nota-val ${cor}">${nota}</span></div>`;
                        }
                        pHtml += `</div></div>`;
                    }
                    pHtml += `</div>`;
                }
                if (container) container.innerHTML = pHtml;
            } catch (err) {
                if (container) container.innerHTML = '<p class="text-danger center">Erro ao compilar pauta.</p>';
            }
        });

        bindClick('btn-close-pauta', () => {
            const mod = document.getElementById('modal-pauta-global'); if (mod) mod.style.display = 'none';
        });

    } catch (e) {
        if (cadernetaContent) cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao carregar avaliações.</p>';
    }
}

async function carregarFaltasEE() {
    const cadernetaContent = document.getElementById('ee-caderneta-content');
    if (!cadernetaContent) return;

    cadernetaContent.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar faltas e a calcular limites...</p>';

    try {
        let matrizCargaHoraria = {};
        try { if (typeof getMatriz === 'function') { matrizCargaHoraria = getMatriz(); } } catch (e) { }

        const faltasSnap = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/faltas`);
        let faltasPorDisciplina = {};

        faltasSnap.forEach(d => {
            const f = d.data();
            const discNome = (f.disciplina || '').trim();
            const duracao = Number(f.duracaoBlocos) || Number(f.horas) || 0;
            const moduloNum = f.modulo || "?";

            if (!faltasPorDisciplina[discNome]) {
                faltasPorDisciplina[discNome] = { totalInjustificadas: 0, totalJustificadas: 0, modulos: {} };
            }
            if (!faltasPorDisciplina[discNome].modulos[moduloNum]) {
                faltasPorDisciplina[discNome].modulos[moduloNum] = { horasTotais: 0, detalhes: [] };
            }

            faltasPorDisciplina[discNome].modulos[moduloNum].horasTotais += duracao;
            faltasPorDisciplina[discNome].modulos[moduloNum].detalhes.push({ id: d.id, ...f, duracao });

            if (f.justificada === false || !f.hasOwnProperty('justificada')) {
                faltasPorDisciplina[discNome].totalInjustificadas += duracao;
            } else {
                faltasPorDisciplina[discNome].totalJustificadas += duracao;
            }
        });

        const ordemDisciplinas = obterDisciplinasDoAno();
        let html = '';

        ordemDisciplinas.forEach(disc => {
            const discTrim = disc.trim();
            const dadosFaltas = faltasPorDisciplina[discTrim] || { totalInjustificadas: 0, totalJustificadas: 0, modulos: {} };
            const totalFaltasDisc = dadosFaltas.totalInjustificadas + dadosFaltas.totalJustificadas;

            let corGlobal = 'var(--text-muted)';
            if (totalFaltasDisc > 0) {
                if (dadosFaltas.totalInjustificadas > 0 && dadosFaltas.totalJustificadas === 0) corGlobal = 'var(--danger-red)';
                else if (dadosFaltas.totalInjustificadas === 0 && dadosFaltas.totalJustificadas > 0) corGlobal = 'var(--success-green)';
                else corGlobal = 'var(--warning-yellow)';
            }

            let detalhesHtml = '';
            const modulosChaves = Object.keys(dadosFaltas.modulos);

            if (modulosChaves.length > 0) {
                modulosChaves.sort((a, b) => parseInt(a) - parseInt(b)).forEach(mod => {
                    const dadosMod = dadosFaltas.modulos[mod];
                    const modLabel = mod.toString().startsWith('UC') ? mod : `Módulo ${mod}`;

                    let horasTotaisDoModulo = 0;
                    for (const comp in matrizCargaHoraria) {
                        if (matrizCargaHoraria[comp][discTrim] && matrizCargaHoraria[comp][discTrim][mod]) {
                            horasTotaisDoModulo = Number(matrizCargaHoraria[comp][discTrim][mod]);
                            break;
                        }
                    }

                    let avisoLimite = '';
                    if (horasTotaisDoModulo > 0) {
                        const limiteFaltas = Math.round(horasTotaisDoModulo * 0.10);
                        if (dadosMod.horasTotais > limiteFaltas) {
                            avisoLimite = `<span style="color:var(--danger-red); font-size:0.75rem; margin-left:8px; background:rgba(239,68,68,0.1); padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-xmark"></i> Excedeu Limite (Máx: ${limiteFaltas}h)</span>`;
                        } else if (dadosMod.horasTotais === limiteFaltas) {
                            avisoLimite = `<span style="color:var(--danger-red); font-size:0.75rem; margin-left:8px; background:rgba(239,68,68,0.1); padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-triangle-exclamation"></i> No Limite Exato (${limiteFaltas}h)</span>`;
                        } else if (dadosMod.horasTotais >= limiteFaltas - 3) {
                            avisoLimite = `<span style="color:var(--warning-yellow); font-size:0.75rem; margin-left:8px; background:rgba(245,158,11,0.1); padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-circle-exclamation"></i> Quase no limite (Máx: ${limiteFaltas}h)</span>`;
                        }
                    } else {
                        if (dadosMod.horasTotais >= 6) {
                            avisoLimite = `<span style="color:var(--danger-red); font-size:0.75rem; margin-left:8px; background:rgba(239,68,68,0.1); padding:2px 6px; border-radius:4px;"><i class="fa-solid fa-triangle-exclamation"></i> Limite em Risco!</span>`;
                        }
                    }

                    detalhesHtml += `
                    <div style="background:rgba(255,255,255,0.03); padding:10px; border-radius:8px; border:1px solid #333; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:center; border-bottom:1px dashed #444; padding-bottom:8px; margin-bottom:8px;">
                            <strong style="color:var(--text-light); font-size:0.95rem;">${modLabel} ${avisoLimite}</strong>
                            <span style="color:white; font-size:0.85rem; font-weight:bold;">Total: ${dadosMod.horasTotais}h</span>
                        </div>`;

                    dadosMod.detalhes.sort((a, b) => new Date(b.dataFalta || b.dataRegisto || 0) - new Date(a.dataFalta || a.dataRegisto || 0));

                    dadosMod.detalhes.forEach(f => {
                        const dataF = f.dataFalta || new Date(f.dataRegisto || f.dataInicio).toLocaleDateString('pt-PT');
                        const isInjustificada = (f.justificada === false || !f.hasOwnProperty('justificada'));
                        const corLinha = isInjustificada ? 'var(--danger-red)' : 'var(--success-green)';
                        const lblLinha = isInjustificada ? 'Injustificada' : 'Justificada';

                        detalhesHtml += `
                            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.3); padding:8px; border-radius:6px; border-left:3px solid ${corLinha}; margin-bottom:5px;">
                                <div><span style="font-size:0.8rem; color:var(--text-light);"><i class="fa-regular fa-calendar"></i> ${dataF}</span><br><span style="color:${corLinha}; font-size:0.7rem;">${lblLinha}</span></div>
                                <span style="color:var(--text-muted); font-size:0.85rem;">${f.duracao}h</span>
                            </div>`;
                    });
                    detalhesHtml += `</div>`;
                });
            } else {
                detalhesHtml = '<p class="text-muted" style="font-size:0.85rem; padding: 10px;">Sem registo de faltas nesta disciplina.</p>';
            }

            const totalAmostra = totalFaltasDisc > 0 ? `${totalFaltasDisc}h` : '0h';

            html += `
            <div class="disciplina-header" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'block' ? 'none' : 'block'" style="cursor:pointer; display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span class="disciplina-title" style="color:var(--text-light); font-weight:bold;">${discTrim}</span>
                <span>
                    <strong style="color:${corGlobal}; font-size:1.1rem; margin-right:8px;">${totalAmostra}</strong> 
                    <i class="fa-solid fa-chevron-down" style="font-size:0.8rem; color:var(--text-muted);"></i>
                </span>
            </div>
            <div class="disciplina-modules" style="display:none; margin-bottom: 15px;">${detalhesHtml}</div>
            `;
        });

        cadernetaContent.innerHTML = html;
    } catch (e) {
        cadernetaContent.innerHTML = '<p class="text-danger center">Erro ao carregar faltas.</p>';
    }
}

async function carregarPrhfsEE() {
    const cadernetaContent = document.getElementById('ee-caderneta-content');
    try {
        const fDiscEl = document.getElementById('filtro-caderneta-disc');
        const fDisc = fDiscEl ? fDiscEl.value : "";
        const prhfsDb = await lerFirebaseOuCacheEE(`utilizadores/${educandoAtualId}/prhfs`);
        let prhfsArr = [];
        prhfsDb.forEach(d => {
            const p = d.data();
            if (p.status !== 'concluida' && (!fDisc || p.disciplina === fDisc)) prhfsArr.push(p);
        });

        if (prhfsArr.length === 0) {
            if (cadernetaContent) cadernetaContent.innerHTML = getEmptyState('Nenhum PRHF ativo.', 'fa-book-medical');
            return;
        }

        prhfsArr.sort((a, b) => new Date(a.prazo) - new Date(b.prazo));
        let html = '';
        prhfsArr.forEach(p => {
            const isUrgente = p.moduloTerminado === true || p.moduloTerminado === "true";
            const cor = isUrgente ? 'var(--danger-red)' : 'var(--warning-yellow)';
            const txtSt = isUrgente ? 'URGENTE (Mód. Terminado)' : 'EM CURSO';
            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${cor};"><div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong style="color:var(--text-light);">${p.disciplina} (Mod. ${p.modulo})</strong><span style="color:${cor}; font-size:0.75rem; font-weight:bold;">${txtSt}</span></div><p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">${p.descricao}</p><div style="font-size:0.8rem; color:var(--text-light);">Data Limite: <strong style="color:${cor};">${p.prazo.split('-').reverse().join('/')}</strong> | Presenciais: <strong style="color:var(--text-light);">${p.horasPresenciais || 0}h</strong></div></div>`;
        });
        if (cadernetaContent) cadernetaContent.innerHTML = html;
    } catch (e) { }
}

async function carregarAgendaEE() {
    const subContainer = document.getElementById('ee-agenda-content');
    if (!subContainer) return;
    subContainer.innerHTML = '<p class="text-muted center">A sincronizar agenda...</p>';
    if (!turmaAtual) return;

    const elT = document.getElementById('filtro-agenda-testes');
    const elTr = document.getElementById('filtro-agenda-trabalhos');
    const elO = document.getElementById('filtro-agenda-outros');
    const mostraT = elT ? elT.checked : true;
    const mostraTr = elTr ? elTr.checked : true;
    const mostraO = elO ? elO.checked : true;

    try {
        const evDb = await lerFirebaseOuCacheEE(`turmas/${turmaAtual}/eventos`);
        if (evDb.empty) {
            subContainer.innerHTML = getEmptyState('Sem eventos agendados.', 'fa-calendar-xmark');
            return;
        }

        let evs = [];
        evDb.forEach(d => {
            const e = d.data();
            let bgC = '#8b5cf6';
            let txtT = 'Evento';

            if (e.tipo === 'teste' || e.tipo === 'avaliacao') {
                if (mostraT) { bgC = '#f59e0b'; txtT = 'Avaliação'; evs.push({ ...e, cor: bgC, txt: txtT }); }
            }
            else if (e.tipo === 'trabalho' || e.tipo === 'entrega') {
                if (mostraTr) { bgC = '#00d2ff'; txtT = 'Entrega'; evs.push({ ...e, cor: bgC, txt: txtT }); }
            }
            else {
                if (mostraO) evs.push({ ...e, cor: bgC, txt: txtT });
            }
        });

        if (evs.length === 0) {
            subContainer.innerHTML = getEmptyState('Sem eventos com os filtros atuais.', 'fa-filter');
            return;
        }

        const hoje = new Date().toISOString().split('T')[0];
        const futuros = evs.filter(e => (e.data || '') >= hoje).sort((a, b) => (a.data || '').localeCompare(b.data || ''));
        const passados = evs.filter(e => (e.data || '') < hoje).sort((a, b) => (b.data || '').localeCompare(a.data || ''));
        const mesArr = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
        let html = '';

        const renderEv = (ev) => {
            if (!ev.data) return '';
            const dp = ev.data.split('-');
            const mes = mesArr[parseInt(dp[1]) - 1];
            return `<div class="calendar-event-card" style="border-left-color:${ev.cor}; margin-bottom:10px;"><div class="calendar-date-box"><span class="day">${dp[2]}</span><span class="month" style="color:${ev.cor};">${mes}</span></div><div class="calendar-info"><h4 style="margin:0; color:var(--text-light);">${ev.titulo}</h4><span style="font-size:0.8rem; color:var(--text-muted);">${(ev.txt || 'evento').toUpperCase()}</span></div></div>`;
        };

        if (futuros.length > 0) {
            futuros.forEach(e => html += renderEv(e));
        } else {
            html += '<p class="text-muted center">Sem eventos futuros.</p>';
        }

        if (passados.length > 0) {
            html += '<div class="calendar-divider" style="margin-top:20px;"><span>Passados</span></div>';
            passados.forEach(e => html += renderEv(e));
        }

        subContainer.innerHTML = html;
    } catch (e) { 
        subContainer.innerHTML = '<p class="text-danger center">Erro ao carregar agenda.</p>';
    }
}

let eeHorarioModo = 'dia';
let eeHorarioDiaOffset = 0;
let eeHorarioSemanaOffset = 0;

bindClick('btn-horario-dia', (e) => {
    eeHorarioModo = 'dia';
    safeAddClass('btn-horario-dia', 'active');
    safeRemoveClass('btn-horario-grelha', 'active');
    carregarHorarioEE();
});
bindClick('btn-horario-grelha', (e) => {
    eeHorarioModo = 'grelha';
    safeAddClass('btn-horario-grelha', 'active');
    safeRemoveClass('btn-horario-dia', 'active');
    carregarHorarioEE();
});
bindClick('btn-ee-prev-horario', () => {
    if (eeHorarioModo === 'dia') eeHorarioDiaOffset--;
    else eeHorarioSemanaOffset--;
    carregarHorarioEE();
});
bindClick('btn-ee-next-horario', () => {
    if (eeHorarioModo === 'dia') eeHorarioDiaOffset++;
    else eeHorarioSemanaOffset++;
    carregarHorarioEE();
});

const getCorEspecial = (dsc) => {
    if (!dsc) return { c: 'var(--primary-green)', bg: 'rgba(16, 185, 129, 0.05)' };
    const d = dsc.toLowerCase();
    if (d.includes('alm')) return { c: 'var(--warning-yellow)', bg: 'rgba(245, 158, 11, 0.1)' };
    if (d.includes('vis')) return { c: '#00d2ff', bg: 'rgba(0, 210, 255, 0.1)' };
    if (d.includes('prhf')) return { c: 'var(--danger-red)', bg: 'rgba(239, 68, 68, 0.1)' };
    if (d.includes('pap') || d.includes('fct')) return { c: '#ff9900', bg: 'rgba(255, 153, 0, 0.1)' };
    if (['reunião', 'reuniao', 'livre', 'estudo'].some(k => d.includes(k))) return { c: 'var(--accent-purple)', bg: 'rgba(139, 92, 246, 0.1)' };
    return { c: 'var(--primary-green)', bg: 'rgba(16, 185, 129, 0.05)' };
};

async function carregarHorarioEE() {
    const subContainer = document.getElementById('ee-horario-content');
    if (!subContainer) return;
    subContainer.innerHTML = '<p class="text-muted center">A gerar horário...</p>';
    if (!turmaAtual) return;

    try {
        const docSnap = await getDoc(doc(db, "turmas", turmaAtual));
        let hb = {};
        if (docSnap.exists() && docSnap.data().horario) hb = docSnap.data().horario;

        let profsCache = {};
        const pSnap = await getDocs(query(collection(db, "utilizadores"), where("papel", "==", "professor"), where("turmas", "array-contains", turmaAtual)));
        pSnap.forEach(d => {
            const profData = d.data();
            if (profData.disciplinas) {
                profData.disciplinas.forEach(dsc => {
                    if (profData.nome) {
                        // Remove "Prof.", "Profª", etc., e agarra no primeiro nome real
                        const nomeLimpo = profData.nome.replace(/^(Prof\.?|Profª\.?)\s*/i, '');
                        profsCache[dsc] = nomeLimpo ? nomeLimpo.split(' ')[0] : profData.nome;
                    } else {
                        profsCache[dsc] = 'Desconhecido';
                    }
                });
            }
        });

        const blocosKeys = ['1', '2', '3', '4', '1300', '5', '6', '7'];
        const blocosTempo = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' };
        const diasMap = ['Domingo', 'Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira', 'Sábado'];
        const fDt = (dt) => `${String(dt.getDate()).padStart(2, '0')}/${String(dt.getMonth() + 1).padStart(2, '0')}`;

        if (eeHorarioModo === 'dia') {
            let targetDate = new Date();
            targetDate.setDate(targetDate.getDate() + eeHorarioDiaOffset);
            const hd = document.getElementById('ee-horario-display');
            if (hd) hd.innerText = `${diasMap[targetDate.getDay()]}, ${fDt(targetDate)}`;

            let html = '';
            let temAulasDia = false;
            const dataStr = `${targetDate.getFullYear()}-${String(targetDate.getMonth() + 1).padStart(2, '0')}-${String(targetDate.getDate()).padStart(2, '0')}`;

            blocosKeys.forEach(bId => {
                const disc = hb[`${dataStr}_${bId}`];
                if (disc) {
                    const sty = getCorEspecial(disc);
                    const profNome = profsCache[disc] ? (profsCache[disc].includes('Prof') ? profsCache[disc] : `Prof. ${profsCache[disc]}`) : 'Prof. A Atribuir';
                    html += `<div class="horario-list-item" style="border-left-color:${sty.c}; background-color:${sty.bg};"><div class="horario-time-col">${blocosTempo[bId]}</div><div class="horario-disc-col"><div class="horario-disc-name">${disc}</div><div class="horario-prof">${profNome}</div></div></div>`;
                    temAulasDia = true;
                }
            });
            subContainer.innerHTML = temAulasDia ? html : getEmptyState('Sem aulas agendadas para hoje.', 'fa-mug-hot');
        } else {
            let dtT = new Date();
            dtT.setDate(dtT.getDate() + (eeHorarioSemanaOffset * 7));
            dtT.setDate(dtT.getDate() - (dtT.getDay() === 0 ? 6 : dtT.getDay() - 1));
            let dEnd = new Date(dtT);
            dEnd.setDate(dEnd.getDate() + 4);
            const hd = document.getElementById('ee-horario-display');
            if (hd) hd.innerText = `${fDt(dtT)} a ${fDt(dEnd)}`;

            let html = '<div class="horario-grid"><div class="horario-header"></div>';
            let dtIter = new Date(dtT);
            ['SEG', 'TER', 'QUA', 'QUI', 'SEX'].forEach(d => {
                html += `<div class="horario-header">${d}<span>${fDt(dtIter)}</span></div>`;
                dtIter.setDate(dtIter.getDate() + 1);
            });

            blocosKeys.forEach(bId => {
                html += `<div class="horario-time">${blocosTempo[bId]}</div>`;
                dtIter = new Date(dtT);
                for (let i = 0; i < 5; i++) {
                    const dStr = `${dtIter.getFullYear()}-${String(dtIter.getMonth() + 1).padStart(2, '0')}-${String(dtIter.getDate()).padStart(2, '0')}`;
                    const disc = hb[`${dStr}_${bId}`];
                    if (disc) {
                        const sty = getCorEspecial(disc);
                        html += `<div class="horario-slot filled" style="border-color:${sty.c}; background-color:${sty.bg};"><strong>${disc}</strong></div>`;
                    }
                    else {
                        html += `<div class="horario-slot"></div>`;
                    }
                    dtIter.setDate(dtIter.getDate() + 1);
                }
            });
            subContainer.innerHTML = html + '</div>';
        }
    } catch (e) { }
}

// 6. CHAT E JUSTIFICAÇÕES 
let chatUnsubscribeEE = null;

function iniciarChatEE() {
    const chatContainer = document.getElementById('ee-chat-messages-container');
    if (!educandoAtualId || !chatContainer) return;

    if (chatUnsubscribeEE) chatUnsubscribeEE();

    chatUnsubscribeEE = onSnapshot(query(collection(db, "utilizadores", educandoAtualId, "chat_dt"), orderBy("timestamp")), (snapshot) => {
        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.remetente === myUserName || msg.autor === 'ee';
            const classe = isMe ? 'admin' : 'student';
            const autorLabel = isMe ? 'Tu' : (msg.autor === 'dt' ? 'Diretor de Turma' : msg.remetente);
            html += `<div class="chat-bubble ${classe}"><strong style="color:var(--text-light);">${autorLabel}</strong><br>${msg.texto}<span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</span></div>`;
        });

        if (html === '') html = getEmptyState('Inicie aqui a comunicação.', 'fa-comments');
        chatContainer.innerHTML = html;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

bindClick('btn-ee-send-msg', async () => {
    const inp = document.getElementById('ee-input-chat-msg');
    if (!inp) return;
    const txt = inp.value.trim();
    if (!txt || !educandoAtualId) return;

    try {
        await addDoc(collection(db, "utilizadores", educandoAtualId, "chat_dt"), {
            remetente: myUserName,
            autor: 'ee',
            texto: txt,
            timestamp: Date.now()
        });
        inp.value = '';
    } catch (e) { }
});

let atestadoBase64 = "";
bindChange('ee-upload-atestado', (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const fn = document.getElementById('ee-atestado-file-name');
    if (fn) fn.innerText = "A processar imagem...";
    const btnEnv = document.getElementById('btn-ee-enviar-atestado');
    if (btnEnv) btnEnv.style.display = 'none';

    // A. SE FOR IMAGEM: Comprimir via URL
    if (file.type.startsWith('image/')) {
        const tempUrl = URL.createObjectURL(file);
        const img = new Image();
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const MAX_WIDTH = 800; // Define a largura máxima de 800px
            let width = img.width;
            let height = img.height;

            if (width > MAX_WIDTH) {
                height *= MAX_WIDTH / width;
                width = MAX_WIDTH;
            }

            canvas.width = width;
            canvas.height = height;

            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);

            // Qualidade a 60% para ficheiros ridiculamente pequenos (ex: 80KB)
            atestadoBase64 = canvas.toDataURL('image/jpeg', 0.6);

            URL.revokeObjectURL(tempUrl); // Limpa a memória

            if (fn) fn.innerText = "Imagem pronta (" + file.name + ")";
            if (btnEnv) btnEnv.style.display = 'block';
        };
        img.onerror = () => {
            if (fn) fn.innerText = "Erro ao processar imagem.";
        };
        img.src = tempUrl;
    }
    // B. SE FOR PDF: Usar o FileReader normal
    else {
        if (file.size > 700000) {
            alert("Este documento PDF é demasiado pesado (Max: 700KB). Por favor, tira uma fotografia do documento ou comprime o PDF.");
            if (fn) fn.innerText = "Ficheiro recusado pelo tamanho.";
            return;
        }
        const reader = new FileReader();
        reader.onload = (ev) => {
            atestadoBase64 = ev.target.result;
            if (fn) fn.innerText = "PDF pronto (" + file.name + ")";
            if (btnEnv) btnEnv.style.display = 'block';
        };
        reader.readAsDataURL(file);
    }
});

bindClick('btn-ee-enviar-atestado', async (e) => {
    if (!atestadoBase64 || !educandoAtualId) return;

    // NOVO: Apanhar apenas as faltas selecionadas pelo E.E.
    const checks = document.querySelectorAll('.check-falta-justificar:checked');
    if (checks.length === 0) {
        alert("Atenção: Tens de selecionar pelo menos uma falta na lista acima para associar a este documento.");
        return;
    }
    const faltasSelecionadas = Array.from(checks).map(c => c.value);

    const obsEl = document.getElementById('ee-atestado-obs-novo');
    const obs = obsEl ? obsEl.value.trim() : "";
    const btnRef = e.currentTarget;
    btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar...';
    btnRef.disabled = true;

    try {
        await addDoc(collection(db, "utilizadores", educandoAtualId, "atestados"), {
            ficheiroBase64: atestadoBase64,
            observacoes: obs,
            status: "pendente",
            dataEnvio: new Date().toISOString(),
            faltasAssociadas: faltasSelecionadas // A MAGIA DE GRAVAR OS IDs VAI AQUI!
        });

        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Enviado com sucesso!';

        setTimeout(() => {
            const fn = document.getElementById('ee-atestado-file-name'); if (fn) fn.innerText = "";
            if (obsEl) obsEl.value = "";
            atestadoBase64 = "";
            btnRef.style.display = 'none';
            btnRef.disabled = false;
            btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Atestado';
            carregarAtestadosEE();
        }, 2000);
    } catch (err) {
        btnRef.innerHTML = "Erro ao enviar!";
        setTimeout(() => { btnRef.disabled = false; btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Atestado'; }, 2000);
    }
});

async function carregarAtestadosEE() {
    const container = document.getElementById('ee-lista-atestados-container');
    if (!container) return;
    container.innerHTML = '<p class="text-muted center">A procurar histórico...</p>';
    if (!educandoAtualId) return;

    try {
        const res = await getDocs(query(collection(db, "utilizadores", educandoAtualId, "atestados")));
        if (res.empty) {
            container.innerHTML = getEmptyState('Nenhum comprovativo enviado.', 'fa-file-invoice');
            carregarFaltasParaSelecao(); // <-- TAMBÉM AQUI (caso não haja histórico, carrega as faltas à mesma)
            return;
        }

        let arr = [];
        res.forEach(d => arr.push(d.data()));
        arr.sort((a, b) => (b.dataEnvio || '').localeCompare(a.dataEnvio || ''));

        let html = '';
        arr.forEach(a => {
            let corStatus = 'var(--warning-yellow)';
            let txtStatus = 'Em análise';
            let iconStatus = '<i class="fa-regular fa-clock"></i>';

            if (a.status === 'aprovado' || a.status === 'aceite') {
                corStatus = 'var(--success-green)';
                txtStatus = 'Aceite';
                iconStatus = '<i class="fa-solid fa-check-circle"></i>';
            }
            if (a.status === 'rejeitado' || a.status === 'recusada') {
                corStatus = 'var(--danger-red)';
                txtStatus = 'Recusada';
                iconStatus = '<i class="fa-solid fa-xmark-circle"></i>';
            }

            html += `<div class="card" style="margin-bottom:10px; border-left: 4px solid ${corStatus}; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="color:var(--text-light);">Enviado a ${new Date(a.dataEnvio).toLocaleDateString('pt-PT')}</strong><br>
                            <span style="font-size:0.75rem; color:var(--text-muted);">${a.observacoes || 'Sem observações adicionais'}</span>
                        </div>
                        <div style="text-align: right;">
                            <span style="font-size:0.8rem; font-weight:bold; color:${corStatus}; padding:6px 12px; background:rgba(255,255,255,0.05); border-radius:20px; display:inline-block;">${iconStatus} ${txtStatus}</span>
                        </div>
                     </div>`;
        });

        container.innerHTML = html;
    } catch (e) { }

    // ==========================================
    // A FRASE VEM PARA AQUI! 
    // ==========================================
    carregarFaltasParaSelecao();
}

// =========================================================================
// NOVO: CARREGAR FALTAS PENDENTES PARA O E.E. SELECIONAR
// =========================================================================
async function carregarFaltasParaSelecao() {
    let container = document.getElementById('ee-selecao-faltas-container');

    // O SEGREDO: Como apagámos a caixa de texto velha, agora ancoramos no Botão de Enviar!
    if (!container) {
        const btnEnviar = document.getElementById('btn-ee-enviar-atestado');
        if (btnEnviar) {
            container = document.createElement('div');
            container.id = 'ee-selecao-faltas-container';
            container.style.marginBottom = '15px';
            btnEnviar.parentNode.insertBefore(container, btnEnviar);
        }
    }

    if (!container) return; // Se não encontrar o botão, sai em segurança.

    container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar faltas pendentes...</p>';

    try {
        const qFaltas = query(collection(db, "utilizadores", educandoAtualId, "faltas"));
        const snap = await getDocs(qFaltas);

        let faltasPendentes = [];

        snap.forEach(d => {
            const f = d.data();
            if (f.justificada === false || !f.hasOwnProperty("justificada")) {
                faltasPendentes.push({ id: d.id, ...f });
            }
        });

        if (faltasPendentes.length === 0) {
            container.innerHTML = '<div style="background:rgba(16, 185, 129, 0.1); border:1px solid var(--success-green); padding:10px; border-radius:6px; text-align:center;"><p style="color:var(--success-green); font-size:0.85rem; margin:0;"><i class="fa-solid fa-check"></i> Sem faltas pendentes para justificar.</p></div>';
            return;
        }

        let html = '<label style="font-size:0.85rem; color:white; font-weight:bold; display:block; margin-bottom:8px;">1. Seleciona a(s) falta(s) a justificar:</label><div style="background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:8px; padding:10px; max-height:180px; overflow-y:auto; display:flex; flex-direction:column; gap:8px;">';

        faltasPendentes.forEach(f => {
            const dataF = f.dataFalta || new Date(f.dataRegisto || f.dataInicio || Date.now()).toLocaleDateString('pt-PT');
            html += `
            <label style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:10px; border-radius:6px; cursor:pointer; border:1px solid transparent; transition:0.2s;" onchange="this.style.borderColor = this.querySelector('input').checked ? 'var(--primary-green)' : 'transparent';">
                <span style="color:white; font-size:0.85rem;"><strong>${f.disciplina}</strong> (${f.duracaoBlocos || f.horas || 2} tempos) <br><span style="color:var(--text-muted); font-size:0.75rem;">Ocorrida a: ${dataF}</span></span>
                <input type="checkbox" class="check-falta-justificar" value="${f.id}" style="width:20px; height:20px; accent-color:var(--primary-green);">
            </label>
            `;
        });
        html += '</div>';

        html += `
        <label style="font-size:0.85rem; color:white; font-weight:bold; display:block; margin-top:15px; margin-bottom:8px;">2. Observações (Opcional):</label>
        <textarea id="ee-atestado-obs-novo" placeholder="Escreva aqui se tiver alguma nota para o Diretor de Turma..." style="width: 100%; min-height: 80px; background: rgba(0,0,0,0.2); border: 1px solid #333; border-radius: 8px; padding: 12px; color: white; font-family: inherit; font-size: 0.9rem; resize: vertical; margin-bottom: 15px; box-sizing: border-box;"></textarea>
        `;

        container.innerHTML = html;
    } catch (e) {
        container.innerHTML = '<p class="text-danger">Erro ao carregar faltas.</p>';
    }
}