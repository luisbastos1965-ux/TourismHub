import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// MATRIZ DO CURSO
const matrizCurso = {
    "Sociocultural": {
        "PORT": ["M1", "M2", "M3"],
        "ING": ["M1", "M2", "M3"],
        "AI": ["M1", "M2"],
        "EF": ["M1", "M2", "M3", "M4", "M5"],
        "TIC": ["M1", "M2", "M3", "M4"]
    },
    "Científica": {
        "GEO": ["M1", "M2"],
        "HCA": ["M1", "M2", "M3"],
        "MAT": ["M1", "M2", "M3"]
    },
    "Técnica": {
        "CF": ["M1", "M2", "M3"],
        "TIAT": ["M1", "M2", "M3", "M4"],
        "TCAT": ["M1", "M2", "M3", "M4"],
        "OTET": ["M1", "M2", "M3", "M4"]
    }
};

// Referências Visuais
const loginScreen = document.getElementById('login-screen');
const appContent = document.getElementById('app-content');
const btnLoginManual = document.getElementById('btn-login-manual');
const btnLogout = document.getElementById('btn-logout');
const errorMsg = document.getElementById('login-error');
const bottomNav = document.querySelector('.bottom-nav'); // Referência à barra inferior

const painelAluno = document.getElementById('student-dashboard');
const painelAdmin = document.getElementById('admin-dashboard');
const classView = document.getElementById('class-view');
const studentDetailView = document.getElementById('student-detail-view');
const viewAvaliacoes = document.getElementById('view-avaliacoes');
const viewDisciplinaModulos = document.getElementById('view-disciplina-modulos');

const botoesTurma = document.querySelectorAll('.turma-card');
const classTitle = document.getElementById('class-title');
const btnVoltarTurmas = document.getElementById('btn-voltar-turmas');
const containerAlunos = document.querySelector('.students-list-container');
const btnVoltarLista = document.getElementById('btn-voltar-lista');
const detailStudentName = document.getElementById('detail-student-name');
const detailStudentNumber = document.getElementById('detail-student-number');

// Botões Hub
const btnHubAvaliacoes = document.getElementById('btn-hub-avaliacoes');
const btnVoltarHubAvaliacoes = document.getElementById('btn-voltar-hub-avaliacoes');
const matrizDisciplinasContainer = document.getElementById('matriz-disciplinas-container');
const btnVoltarDisciplinas = document.getElementById('btn-voltar-disciplinas');
const tituloDisciplina = document.getElementById('titulo-disciplina');
const listaModulosDisciplina = document.getElementById('lista-modulos-Disciplina');

let alunoAtualId = ""; 

// 1. Autenticação
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
                
                // Gestão de visibilidade baseada no papel
                if (dados.papel === 'admin') {
                    painelAluno.style.display = 'none';
                    painelAdmin.style.display = 'block';
                    bottomNav.style.display = 'none'; // Esconde barra para Admins e DTs
                } else {
                    painelAluno.style.display = 'block';
                    painelAdmin.style.display = 'none';
                    bottomNav.style.display = 'flex'; // Mostra barra para Alunos
                }
                
                // Esconder os ecrãs secundários no carregamento inicial
                [classView, studentDetailView, viewAvaliacoes, viewDisciplinaModulos].forEach(el => el.style.display = 'none');
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

// 2. Navegação Principal
if(btnVoltarTurmas) btnVoltarTurmas.addEventListener('click', () => { classView.style.display = 'none'; painelAdmin.style.display = 'block'; });
if(btnVoltarLista) btnVoltarLista.addEventListener('click', () => { studentDetailView.style.display = 'none'; classView.style.display = 'block'; });
if(btnVoltarHubAvaliacoes) btnVoltarHubAvaliacoes.addEventListener('click', () => { viewAvaliacoes.style.display = 'none'; studentDetailView.style.display = 'block'; });
if(btnVoltarDisciplinas) btnVoltarDisciplinas.addEventListener('click', () => { viewDisciplinaModulos.style.display = 'none'; viewAvaliacoes.style.display = 'block'; });

botoesTurma.forEach(botao => {
    botao.addEventListener('click', () => {
        const nomeTurma = botao.getAttribute('data-turma'); 
        classTitle.innerHTML = `<i class="fa-solid fa-users"></i> Turma ${nomeTurma}`;
        painelAdmin.style.display = 'none';
        classView.style.display = 'block';
        carregarAlunos(nomeTurma);
    });
});

// 3. Carregar Alunos
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
                classView.style.display = 'none';
                studentDetailView.style.display = 'block';
            });
        });
    } catch (e) { console.error(e); }
}

// 4. Construir Matriz de Avaliações
if(btnHubAvaliacoes) {
    btnHubAvaliacoes.addEventListener('click', () => {
        studentDetailView.style.display = 'none';
        viewAvaliacoes.style.display = 'block';
        construirMatrizVisual();
    });
}

function construirMatrizVisual() {
    let html = "";
    for (const [nomeComponente, disciplinas] of Object.entries(matrizCurso)) {
        html += `
        <div class="component-section">
            <div class="component-header">${nomeComponente}</div>
            <div class="subject-grid">`;
        
        for (const nomeDisciplina of Object.keys(disciplinas)) {
            html += `<button class="subject-btn" data-disc="${nomeDisciplina}">${nomeDisciplina}</button>`;
        }
        
        html += `</div></div>`;
    }
    matrizDisciplinasContainer.innerHTML = html;

    // Clicar numa Disciplina
    matrizDisciplinasContainer.querySelectorAll('.subject-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const discEscolhida = e.currentTarget.getAttribute('data-disc');
            abrirModulosDisciplina(discEscolhida);
        });
    });
}

// 5. Avaliar Módulos de uma Disciplina
async function abrirModulosDisciplina(disciplina) {
    viewAvaliacoes.style.display = 'none';
    viewDisciplinaModulos.style.display = 'block';
    tituloDisciplina.innerText = disciplina;
    
    // Corrigido aqui para apontar para a referência certa no DOM
    const listaModulosUI = document.getElementById('lista-modulos-disciplina');
    listaModulosUI.innerHTML = '<p class="text-muted">A preparar módulos...</p>';

    // Encontrar os módulos desta disciplina na Matriz
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
    
    // Gravar Nota
    listaModulosUI.querySelectorAll('.btn-gravar-nota').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const disc = e.currentTarget.getAttribute('data-disc');
            const mod = e.currentTarget.getAttribute('data-mod');
            const valorInput = document.getElementById(`nota-${disc}-${mod}`).value;
            
            if(valorInput === "") return;

            e.currentTarget.innerText = "OK!";
            e.currentTarget.style.backgroundColor = "white";
            
            try {
                const docId = `${disc}_${mod}`;
                await setDoc(doc(db, "utilizadores", alunoAtualId, "notas", docId), {
                    disciplina: disc,
                    modulo: mod,
                    nota: Number(valorInput),
                    data: new Date().toISOString()
                });
                
                setTimeout(() => {
                    e.currentTarget.innerText = "Gravar";
                    e.currentTarget.style.backgroundColor = "var(--primary-green)";
                }, 2000);
            } catch (error) {
                console.error("Erro ao gravar nota", error);
            }
        });
    });
}
