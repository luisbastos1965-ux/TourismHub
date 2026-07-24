import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyAUU6riTOuybEamgkPke4UXJwyjMA0nJzU",
  authDomain: "turmapro-e6358.firebaseapp.com",
  projectId: "turmapro-e6358",
  storageBucket: "turmapro-e6358.firebasestorage.app",
  messagingSenderId: "242512169110",
  appId: "1:242512169110:web:f94978c0c2a13858a41ab7"
};

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

const matrizCurso = {
    "Sociocultural": { "PORT": ["M1", "M2", "M3"], "ING": ["M1", "M2", "M3"], "AI": ["M1", "M2"], "EF": ["M1", "M2", "M3", "M4", "M5"], "TIC": ["M1", "M2", "M3", "M4"] },
    "Científica": { "GEO": ["M1", "M2"], "HCA": ["M1", "M2", "M3"], "MAT": ["M1", "M2", "M3"] },
    "Técnica": { "CF": ["M1", "M2", "M3"], "TIAT": ["M1", "M2", "M3", "M4"], "TCAT": ["M1", "M2", "M3", "M4"], "OTET": ["M1", "M2", "M3", "M4"] }
};

const loginScreen = document.getElementById('login-screen');
const appContent = document.getElementById('app-content');
const btnLoginManual = document.getElementById('btn-login-manual');
const btnLogout = document.getElementById('btn-logout');
const errorMsg = document.getElementById('login-error');
const bottomNav = document.querySelector('.bottom-nav');

const painelAluno = document.getElementById('student-dashboard');
const painelAdmin = document.getElementById('admin-dashboard');
const classView = document.getElementById('class-view');
const studentDetailView = document.getElementById('student-detail-view');
const viewAvaliacoes = document.getElementById('view-avaliacoes');
const viewDisciplinaModulos = document.getElementById('view-disciplina-modulos');
const viewInformacoes = document.getElementById('view-informacoes');
const viewPrhf = document.getElementById('view-prhf');

const botoesTurma = document.querySelectorAll('.turma-card');
const classTitle = document.getElementById('class-title');
const btnVoltarTurmas = document.getElementById('btn-voltar-turmas');
const containerAlunos = document.querySelector('.students-list-container');
const btnVoltarLista = document.getElementById('btn-voltar-lista');
const detailStudentName = document.getElementById('detail-student-name');
const detailStudentNumber = document.getElementById('detail-student-number');

const btnHubAvaliacoes = document.getElementById('btn-hub-avaliacoes');
const btnVoltarHubAvaliacoes = document.getElementById('btn-voltar-hub-avaliacoes');
const btnHubInformacoes = document.getElementById('btn-hub-informacoes');
const btnVoltarHubInfo = document.getElementById('btn-voltar-hub-info');
const btnHubPrhf = document.getElementById('btn-hub-prhf');
const btnVoltarHubPrhf = document.getElementById('btn-voltar-hub-prhf');

const matrizDisciplinasContainer = document.getElementById('matriz-disciplinas-container');
const btnVoltarDisciplinas = document.getElementById('btn-voltar-disciplinas');
const tituloDisciplina = document.getElementById('titulo-disciplina');
const listaModulosDisciplina = document.getElementById('lista-modulos-disciplina');

let alunoAtualId = ""; 

function esconderTudoMenos(ecraAtivo) {
    [classView, studentDetailView, viewAvaliacoes, viewDisciplinaModulos, viewInformacoes, viewPrhf].forEach(el => el.style.display = 'none');
    if(ecraAtivo) ecraAtivo.style.display = 'block';
}

onAuthStateChanged(auth, async (user) => {
    if (user) {
        loginScreen.style.display = 'none';
        appContent.style.display = 'block';
        const userId = user.email.split('@')[0];
        
        try {
            const docRef = doc(db, "utilizadores", userId);
            const docSnap = await getDoc(docRef);
            
            if (docSnap.exists()) {
                const dados = docSnap.data();
                document.querySelector('.user-profile span').innerText = `Olá, ${dados.nome} (${dados.papel.toUpperCase()})`;
                
                if (dados.papel === 'admin') {
                    painelAluno.style.display = 'none';
                    painelAdmin.style.display = 'block';
                    bottomNav.style.display = 'none';
                } else {
                    painelAluno.style.display = 'block';
                    painelAdmin.style.display = 'none';
                    bottomNav.style.display = 'flex';
                }
                esconderTudoMenos(null);
            }
        } catch (error) { console.error(error); }
    } else {
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

btnLoginManual.addEventListener('click', () => {
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, username + "@turmapro.com", pass)
        .then(() => errorMsg.style.display = 'none')
        .catch(() => {
            errorMsg.style.display = 'block';
            errorMsg.innerText = "Erro: Credenciais inválidas.";
        });
});

btnLogout.addEventListener('click', () => signOut(auth));

if(btnVoltarTurmas) btnVoltarTurmas.addEventListener('click', () => { esconderTudoMenos(null); painelAdmin.style.display = 'block'; });
if(btnVoltarLista) btnVoltarLista.addEventListener('click', () => { esconderTudoMenos(classView); });
if(btnVoltarHubAvaliacoes) btnVoltarHubAvaliacoes.addEventListener('click', () => { esconderTudoMenos(studentDetailView); });
if(btnVoltarDisciplinas) btnVoltarDisciplinas.addEventListener('click', () => { esconderTudoMenos(viewAvaliacoes); });
if(btnVoltarHubInfo) btnVoltarHubInfo.addEventListener('click', () => { esconderTudoMenos(studentDetailView); });
if(btnVoltarHubPrhf) btnVoltarHubPrhf.addEventListener('click', () => { esconderTudoMenos(studentDetailView); });

botoesTurma.forEach(botao => {
    botao.addEventListener('click', () => {
        const nomeTurma = botao.getAttribute('data-turma'); 
        classTitle.innerHTML = `<i class="fa-solid fa-users"></i> Turma ${nomeTurma}`;
        painelAdmin.style.display = 'none';
        esconderTudoMenos(classView);
        carregarAlunos(nomeTurma);
    });
});

async function carregarAlunos(turmaEscolhida) {
    containerAlunos.innerHTML = '<p class="text-muted">A carregar...</p>';
    try {
        const q = query(collection(db, "utilizadores"), where("turma", "==", turmaEscolhida), where("papel", "==", "aluno"));
        const resultados = await getDocs(q);

        if (resultados.empty) { containerAlunos.innerHTML = '<p class="text-muted">Sem alunos.</p>'; return; }

        let html = '<ul class="students-list">';
        resultados.forEach((doc) => {
            const aluno = doc.data();
            html += `
                <li class="student-item">
                    <div class="student-info"><strong>${aluno.nome}</strong><span>${doc.id.toUpperCase()}</span></div>
                    <button class="secondary-btn small-btn btn-ver-aluno" data-nome="${aluno.nome}" data-numero="${doc.id}"><i class="fa-solid fa-eye"></i> Ver</button>
                </li>`;
        });
        html += '</ul>';
        containerAlunos.innerHTML = html;

        containerAlunos.querySelectorAll('.btn-ver-aluno').forEach(btn => {
            btn.addEventListener('click', (e) => {
                detailStudentName.innerText = e.currentTarget.getAttribute('data-nome');
                alunoAtualId = e.currentTarget.getAttribute('data-numero');
                detailStudentNumber.innerText = alunoAtualId.toUpperCase();
                esconderTudoMenos(studentDetailView);
            });
        });
    } catch (e) { console.error(e); }
}

if(btnHubAvaliacoes) {
    btnHubAvaliacoes.addEventListener('click', () => {
        esconderTudoMenos(viewAvaliacoes);
        construirMatrizVisual();
    });
}

function construirMatrizVisual() {
    let html = "";
    for (const [nomeComponente, disciplinas] of Object.entries(matrizCurso)) {
        html += `<div class="component-section"><div class="component-header">${nomeComponente}</div><div class="subject-grid">`;
        for (const nomeDisciplina of Object.keys(disciplinas)) {
            html += `<button class="subject-btn" data-disc="${nomeDisciplina}">${nomeDisciplina}</button>`;
        }
        html += `</div></div>`;
    }
    matrizDisciplinasContainer.innerHTML = html;

    matrizDisciplinasContainer.querySelectorAll('.subject-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            abrirModulosDisciplina(e.currentTarget.getAttribute('data-disc'));
        });
    });
}

async function abrirModulosDisciplina(disciplina) {
    esconderTudoMenos(viewDisciplinaModulos);
    tituloDisciplina.innerText = disciplina;
    const listaModulosUI = document.getElementById('lista-modulos-disciplina');
    listaModulosUI.innerHTML = '<p class="text-muted">A preparar módulos...</p>';

    let modulosArray = [];
    for (const comp of Object.values(matrizCurso)) {
        if (comp[disciplina]) modulosArray = comp[disciplina];
    }

    let html = "";
    modulosArray.forEach(mod => {
        html += `
        <div class="modulo-avaliar-item">
            <strong>${mod}</strong>
            <div style="display: flex; gap: 10px; align-items: center;">
                <input type="number" class="modulo-nota-input" id="nota-${disciplina}-${mod}" placeholder="-" min="0" max="20">
                <button class="primary-btn small-btn btn-gravar-nota" data-disc="${disciplina}" data-mod="${mod}">Gravar</button>
            </div>
        </div>`;
    });
    listaModulosUI.innerHTML = html;
    
    listaModulosUI.querySelectorAll('.btn-gravar-nota').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const disc = e.currentTarget.getAttribute('data-disc');
            const mod = e.currentTarget.getAttribute('data-mod');
            const valorInput = document.getElementById(`nota-${disc}-${mod}`).value;
            if(valorInput === "") return;

            e.currentTarget.innerText = "OK!";
            e.currentTarget.style.backgroundColor = "white";
            
            try {
                await setDoc(doc(db, "utilizadores", alunoAtualId, "notas", `${disc}_${mod}`), {
                    disciplina: disc, modulo: mod, nota: Number(valorInput), data: new Date().toISOString()
                });
                setTimeout(() => { e.currentTarget.innerText = "Gravar"; e.currentTarget.style.backgroundColor = "var(--primary-green)"; }, 2000);
            } catch (error) { console.error(error); }
        });
    });
}

if(btnHubInformacoes) {
    btnHubInformacoes.addEventListener('click', async () => {
        esconderTudoMenos(viewInformacoes);
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", alunoAtualId));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                document.getElementById('info-aluno-idade').value = dados.idade || "";
                document.getElementById('info-aluno-telemovel').value = dados.telAluno || "";
                document.getElementById('info-aluno-email').value = dados.emailAluno || "";
                document.getElementById('info-aluno-morada').value = dados.morada || "";
                document.getElementById('info-ee-nome').value = dados.nomeEE || "";
                document.getElementById('info-ee-filiacao').value = dados.filiacaoEE || "";
                document.getElementById('info-ee-telemovel').value = dados.telEE || "";
                document.getElementById('info-ee-email').value = dados.emailEE || "";
            }
        } catch (error) { console.error("Erro a carregar info:", error); }
    });
}

document.getElementById('btn-guardar-informacoes').addEventListener('click', async (e) => {
    e.currentTarget.innerText = "A gravar...";
    try {
        await updateDoc(doc(db, "utilizadores", alunoAtualId), {
            idade: document.getElementById('info-aluno-idade').value,
            telAluno: document.getElementById('info-aluno-telemovel').value,
            emailAluno: document.getElementById('info-aluno-email').value,
            morada: document.getElementById('info-aluno-morada').value,
            nomeEE: document.getElementById('info-ee-nome').value,
            filiacaoEE: document.getElementById('info-ee-filiacao').value,
            telEE: document.getElementById('info-ee-telemovel').value,
            emailEE: document.getElementById('info-ee-email').value
        });
        document.getElementById('msg-sucesso-info').style.display = 'block';
        setTimeout(() => document.getElementById('msg-sucesso-info').style.display = 'none', 3000);
    } catch (error) { console.error("Erro a guardar info:", error); }
    e.currentTarget.innerText = "Guardar Informações";
});

// 6. Lógica de PRHF (Planos de Recuperação - NOVO SISTEMA)
if(btnHubPrhf) {
    btnHubPrhf.addEventListener('click', () => {
        esconderTudoMenos(viewPrhf);
        carregarListaPRHF(alunoAtualId);
    });
}

document.getElementById('btn-guardar-prhf').addEventListener('click', async (e) => {
    const disc = document.getElementById('prhf-disciplina').value.trim();
    const mod = document.getElementById('prhf-modulo').value.trim();
    const prazo = document.getElementById('prhf-prazo').value;
    const desc = document.getElementById('prhf-descricao').value.trim();

    if(!disc || !mod || !prazo || !desc) {
        alert("Preenche todos os campos do PRHF!");
        return;
    }

    e.currentTarget.innerText = "A gravar...";
    try {
        // Guarda na coleção específica de PRHFs deste aluno
        await addDoc(collection(db, "utilizadores", alunoAtualId, "prhfs"), {
            disciplina: disc.toUpperCase(),
            modulo: mod.toUpperCase(),
            prazo: prazo,
            descricao: desc,
            dataRegisto: new Date().toISOString()
        });
        
        // Limpar campos
        document.getElementById('prhf-disciplina').value = "";
        document.getElementById('prhf-modulo').value = "";
        document.getElementById('prhf-prazo').value = "";
        document.getElementById('prhf-descricao').value = "";

        document.getElementById('msg-sucesso-prhf').style.display = 'block';
        setTimeout(() => document.getElementById('msg-sucesso-prhf').style.display = 'none', 3000);
        
        // Atualizar lista no ecrã imediatamente
        carregarListaPRHF(alunoAtualId);
    } catch (error) { console.error("Erro a guardar PRHF:", error); }
    
    e.currentTarget.innerText = "Gravar Tarefa PRHF";
});

// Função para desenhar a lista de PRHFs do aluno
async function carregarListaPRHF(idAluno) {
    const container = document.getElementById('lista-prhf-container');
    container.innerHTML = '<p class="text-muted">A carregar planos...</p>';
    try {
        const q = query(collection(db, "utilizadores", idAluno, "prhfs"));
        const resultados = await getDocs(q);

        if (resultados.empty) {
            container.innerHTML = '<p class="text-muted">Sem tarefas de recuperação ativas.</p>';
            return;
        }

        let html = '';
        resultados.forEach(doc => {
            const prhf = doc.data();
            
            // Inverter a data (de AAAA-MM-DD para DD-MM-AAAA) para ficar mais bonito
            const dataParts = prhf.prazo.split('-');
            const dataFormatada = dataParts.length === 3 ? `${dataParts[2]}-${dataParts[1]}-${dataParts[0]}` : prhf.prazo;

            html += `
                <div class="prhf-card">
                    <div class="prhf-header">
                        <strong>${prhf.disciplina} - ${prhf.modulo}</strong>
                        <span class="prhf-prazo"><i class="fa-solid fa-calendar-days"></i> ${dataFormatada}</span>
                    </div>
                    <p style="font-size: 0.95rem;">${prhf.descricao}</p>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) { 
        console.error(error); 
        container.innerHTML = '<p style="color: #ff4d4d;">Erro ao carregar as tarefas.</p>';
    }
}
