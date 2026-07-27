import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { collection, query, where, getDocs, doc, getDoc, addDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// A Matriz Curricular para o prof selecionar a disciplina e módulo
const matrizCurso = {
    "Sociocultural": { "PORT": {"M1": 27, "M2": 24, "M3": 27}, "ING": {"M1": 24, "M2": 24, "M3": 24}, "AI": {"M1": 30, "M2": 30}, "EF": {"M1": 20, "M2": 20, "M3": 20, "M4": 20, "M5": 20}, "TIC": {"M1": 24, "M2": 24, "M3": 27, "M4": 24} },
    "Científica": { "GEO": {"M1": 27, "M2": 24}, "HCA": {"M1": 24, "M2": 24, "M3": 27}, "MAT": {"M1": 30, "M2": 30, "M3": 30} },
    "Técnica": { "CF": {"M1": 30, "M2": 30, "M3": 30}, "TIAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "TCAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "OTET": {"M1": 25, "M2": 25, "M3": 25, "M4": 25} }
};

let myUserName = "";
let turmaSelecionada = "";
let acaoAtual = ""; // Pode ser 'faltas' ou 'notas'
let alunosTurmaMemo = [];

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
                if(dados.papel !== 'professor' && dados.papel !== 'admin') {
                    window.location.href = "index.html"; return;
                }
                
                myUserName = dados.nome.split(' ')[0];
                document.getElementById('header-user-name-staff').innerText = `Prof. ${myUserName}`;
                
                preencherDropdownDisciplinas();
            }
        } catch (e) { console.error(e); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-staff')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});

// ==========================================
// 2. NAVEGAÇÃO E SELEÇÃO DE TURMA
// ==========================================
function esconderTudoMenos(idAlvo) {
    ['prof-dashboard', 'prof-hub-view', 'prof-lista-alunos-view'].forEach(id => {
        document.getElementById(id).style.display = 'none';
    });
    document.getElementById(idAlvo).style.display = 'block';
}

document.querySelectorAll('.turma-card-large').forEach(btn => {
    btn.addEventListener('click', (e) => {
        turmaSelecionada = e.currentTarget.getAttribute('data-turma');
        document.getElementById('prof-hub-title').innerText = `Gestão - Turma ${turmaSelecionada}`;
        esconderTudoMenos('prof-hub-view');
        carregarAlunosParaMemoria(turmaSelecionada); // Pre-carrega alunos para a tabela
    });
});

document.getElementById('btn-voltar-turmas-hub').addEventListener('click', () => esconderTudoMenos('prof-dashboard'));
document.getElementById('btn-voltar-prof-hub').addEventListener('click', () => esconderTudoMenos('prof-hub-view'));

// ==========================================
// 3. O CORAÇÃO: MARCAR FALTAS & NOTAS EM LOTE
// ==========================================
const selDisc = document.getElementById('prof-select-disc');
const selMod = document.getElementById('prof-select-mod');

function preencherDropdownDisciplinas() {
    let opt = '<option value="">A sua Disciplina...</option>';
    for(const comp of Object.values(matrizCurso)) {
        for(const d of Object.keys(comp)) opt += `<option value="${d}">${d}</option>`;
    }
    selDisc.innerHTML = opt;
}

selDisc.addEventListener('change', (e) => {
    const d = e.target.value; let modsObj = {};
    for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; }
    let optMod = '<option value="">Módulo...</option>';
    Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`);
    selMod.innerHTML = optMod;
});

async function carregarAlunosParaMemoria(turma) {
    alunosTurmaMemo = [];
    try {
        const q = query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno"));
        const res = await getDocs(q);
        res.forEach(doc => {
            alunosTurmaMemo.push({ id: doc.id, nome: doc.data().nome });
        });
        alunosTurmaMemo.sort((a,b) => a.nome.localeCompare(b.nome)); // Ordenar alfabeticamente
    } catch(e) { console.error(e); }
}

// BOTÃO MARCAR FALTAS
document.getElementById('btn-prof-faltas').addEventListener('click', () => {
    acaoAtual = 'faltas';
    document.getElementById('prof-action-title').innerText = "Registo de Faltas";
    document.getElementById('th-action-col').innerText = "Marcar Falta";
    document.getElementById('prof-faltas-tools').style.display = 'flex';
    esconderTudoMenos('prof-lista-alunos-view');
    desenharTabelaAcao();
});

// BOTÃO LANÇAR NOTAS
document.getElementById('btn-prof-avaliacoes').addEventListener('click', () => {
    acaoAtual = 'notas';
    document.getElementById('prof-action-title').innerText = "Lançar Notas (Módulo)";
    document.getElementById('th-action-col').innerText = "Nota Final";
    document.getElementById('prof-faltas-tools').style.display = 'none';
    esconderTudoMenos('prof-lista-alunos-view');
    desenharTabelaAcao();
});

function desenharTabelaAcao() {
    const tbody = document.getElementById('prof-lista-tabela');
    if(alunosTurmaMemo.length === 0) {
        tbody.innerHTML = '<tr><td colspan="2" class="text-muted center">Sem alunos na turma.</td></tr>';
        return;
    }

    let html = '';
    alunosTurmaMemo.forEach(aluno => {
        let actionHTML = '';
        
        if (acaoAtual === 'faltas') {
            actionHTML = `<button class="danger-btn small-btn btn-action-falta" data-aluno="${aluno.id}"><i class="fa-solid fa-user-xmark"></i> Marcar</button>`;
        } else if (acaoAtual === 'notas') {
            actionHTML = `<div style="display:flex; gap:5px; justify-content:center;">
                            <input type="text" class="input-nota-${aluno.id}" placeholder="Ex: 14 ou REP" style="width:70px; margin:0; text-align:center;">
                            <button class="primary-btn small-btn btn-action-nota" data-aluno="${aluno.id}"><i class="fa-solid fa-check"></i></button>
                          </div>`;
        }

        html += `<tr>
                    <td><strong>${aluno.nome}</strong><br><span style="font-size:0.75rem; color:#888;">${aluno.id.toUpperCase()}</span></td>
                    <td class="center">${actionHTML}</td>
                 </tr>`;
    });
    tbody.innerHTML = html;

    // Atribuir Eventos aos Botões (Faltas)
    if(acaoAtual === 'faltas') {
        document.querySelectorAll('.btn-action-falta').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idAl = e.currentTarget.getAttribute('data-aluno');
                const disc = selDisc.value;
                const mod = selMod.value;
                const horas = parseInt(document.getElementById('prof-faltas-horas').value);
                const dataHoje = new Date().toISOString().split('T')[0];

                if(!disc || !mod) return alert("Selecione a Disciplina e Módulo no topo!");
                
                const btnRef = e.currentTarget;
                btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                
                try {
                    await addDoc(collection(db, "utilizadores", idAl, "faltas"), {
                        dataInicio: dataHoje, disciplina: disc, modulo: mod, horas: horas, justificada: false, criadoEm: new Date().toISOString()
                    });
                    btnRef.className = "secondary-btn small-btn";
                    btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Marcada';
                    btnRef.disabled = true;
                } catch(err) { btnRef.innerHTML = "Erro"; }
            });
        });
    }

    // Atribuir Eventos aos Botões (Notas)
    if(acaoAtual === 'notas') {
        document.querySelectorAll('.btn-action-nota').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const idAl = e.currentTarget.getAttribute('data-aluno');
                const disc = selDisc.value;
                const mod = selMod.value;
                const notaInput = document.querySelector(`.input-nota-${idAl}`).value.trim().toUpperCase();

                if(!disc || !mod) return alert("Selecione a Disciplina e Módulo no topo!");
                if(notaInput === "") return alert("Insira uma nota!");
                
                const valorDb = notaInput === "REP" ? "REP" : Number(notaInput);
                if(notaInput !== "REP" && isNaN(valorDb)) return alert("Nota inválida (Insira um número ou REP)");

                const btnRef = e.currentTarget;
                btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                
                try {
                    await setDoc(doc(db, "utilizadores", idAl, "notas", `${disc}_${mod}`), {
                        disciplina: disc, modulo: mod, nota: valorDb, motivoRep: "", data: new Date().toISOString()
                    });
                    btnRef.className = "secondary-btn small-btn";
                    btnRef.innerHTML = '<i class="fa-solid fa-check-double"></i>';
                } catch(err) { btnRef.innerHTML = "Erro"; }
            });
        });
    }
}
