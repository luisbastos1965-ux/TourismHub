import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Referências Visuais
const loginScreen = document.getElementById('login-screen');
const appContent = document.getElementById('app-content');
const btnLoginManual = document.getElementById('btn-login-manual');
const btnLogout = document.getElementById('btn-logout');
const errorMsg = document.getElementById('login-error');

const painelAluno = document.getElementById('student-dashboard');
const painelAdmin = document.getElementById('admin-dashboard');
const classView = document.getElementById('class-view');
const studentDetailView = document.getElementById('student-detail-view');
const studentModulesView = document.getElementById('student-modules-view'); // NOVO

const botoesTurma = document.querySelectorAll('.turma-card');
const classTitle = document.getElementById('class-title');
const btnVoltarTurmas = document.getElementById('btn-voltar-turmas');
const containerAlunos = document.querySelector('.students-list-container');
const btnVoltarLista = document.getElementById('btn-voltar-lista');
const detailStudentName = document.getElementById('detail-student-name');
const detailStudentNumber = document.getElementById('detail-student-number');
const contadorModulos = document.getElementById('contador-modulos'); // NOVO

// Referências dos Módulos
const btnAbrirModulos = document.getElementById('btn-abrir-modulos');
const btnVoltarPerfilModulos = document.getElementById('btn-voltar-perfil-modulos');
const btnGuardarModulo = document.getElementById('btn-guardar-modulo');
const containerModulos = document.getElementById('lista-modulos-container');
const moduloMsg = document.getElementById('modulo-msg');

// Memória da App (Saber que aluno estamos a ver)
let alunoAtualId = ""; 

// 1. Escutar estado de autenticação
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
                } else {
                    painelAluno.style.display = 'block';
                    painelAdmin.style.display = 'none';
                }
                classView.style.display = 'none';
                studentDetailView.style.display = 'none';
                studentModulesView.style.display = 'none';
            }
        } catch (error) { console.error(error); }
    } else {
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

// 2. Login & Logout
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

// 3. Navegação: Voltar atrás
if(btnVoltarTurmas) {
    btnVoltarTurmas.addEventListener('click', () => {
        classView.style.display = 'none';
        painelAdmin.style.display = 'block';
    });
}
if(btnVoltarLista) {
    btnVoltarLista.addEventListener('click', () => {
        studentDetailView.style.display = 'none';
        classView.style.display = 'block'; 
    });
}
if(btnVoltarPerfilModulos) {
    btnVoltarPerfilModulos.addEventListener('click', () => {
        studentModulesView.style.display = 'none';
        studentDetailView.style.display = 'block';
        // Atualizar o número de módulos no ecrã de perfil quando voltamos
        contarModulos(alunoAtualId);
    });
}

// 4. Navegação: Abrir Turma
botoesTurma.forEach(botao => {
    botao.addEventListener('click', () => {
        const nomeTurma = botao.getAttribute('data-turma'); 
        classTitle.innerHTML = `<i class="fa-solid fa-users"></i> Turma ${nomeTurma}`;
        painelAdmin.style.display = 'none';
        classView.style.display = 'block';
        carregarAlunos(nomeTurma);
    });
});

// 5. Função: Carregar Alunos
async function carregarAlunos(turmaEscolhida) {
    containerAlunos.innerHTML = '<p class="text-muted">A carregar lista...</p>';
    try {
        const q = query(collection(db, "utilizadores"), where("turma", "==", turmaEscolhida), where("papel", "==", "aluno"));
        const resultados = await getDocs(q);

        if (resultados.empty) {
            containerAlunos.innerHTML = '<p class="text-muted">Sem alunos registados.</p>';
            return;
        }

        let htmlLista = '<ul class="students-list">';
        resultados.forEach((documento) => {
            const aluno = documento.data();
            htmlLista += `
                <li class="student-item">
                    <div class="student-info">
                        <strong>${aluno.nome}</strong>
                        <span>${documento.id.toUpperCase()}</span>
                    </div>
                    <button class="secondary-btn small-btn btn-ver-aluno" data-nome="${aluno.nome}" data-numero="${documento.id}">
                        <i class="fa-solid fa-eye"></i> Ver
                    </button>
                </li>`;
        });
        htmlLista += '</ul>';
        containerAlunos.innerHTML = htmlLista;

        // Clicar em Ver Aluno
        containerAlunos.querySelectorAll('.btn-ver-aluno').forEach(botao => {
            botao.addEventListener('click', (evento) => {
                detailStudentName.innerText = evento.currentTarget.getAttribute('data-nome');
                alunoAtualId = evento.currentTarget.getAttribute('data-numero'); // Guarda na memória
                detailStudentNumber.innerText = alunoAtualId.toUpperCase();
                
                classView.style.display = 'none';
                studentDetailView.style.display = 'block';
                contarModulos(alunoAtualId); // Atualiza o contador imediatamente
            });
        });
    } catch (erro) { console.error(erro); }
}

// 6. Navegação: Abrir Módulos
btnAbrirModulos.addEventListener('click', () => {
    studentDetailView.style.display = 'none';
    studentModulesView.style.display = 'block';
    carregarListaModulos(alunoAtualId);
});

// 7. Função: Gravar novo módulo na Base de Dados
btnGuardarModulo.addEventListener('click', async () => {
    const nomeModulo = document.getElementById('novo-modulo-nome').value.trim();
    const notaModulo = document.getElementById('novo-modulo-nota').value;

    if (nomeModulo === "" || notaModulo === "") {
        moduloMsg.style.display = 'block';
        moduloMsg.style.color = '#ff4d4d';
        moduloMsg.innerText = "Preenche o nome e a nota!";
        return;
    }

    btnGuardarModulo.innerText = "A gravar...";
    btnGuardarModulo.disabled = true;

    try {
        // Criar uma subcoleção "modulos" dentro do documento deste aluno específico
        await addDoc(collection(db, "utilizadores", alunoAtualId, "modulos"), {
            nome: nomeModulo,
            nota: Number(notaModulo),
            dataRegisto: new Date().toISOString()
        });

        // Limpar campos
        document.getElementById('novo-modulo-nome').value = "";
        document.getElementById('novo-modulo-nota').value = "";
        moduloMsg.style.display = 'block';
        moduloMsg.style.color = 'var(--primary-green)';
        moduloMsg.innerText = "Módulo guardado com sucesso!";
        
        // Recarregar a lista visual
        carregarListaModulos(alunoAtualId);

    } catch (erro) {
        console.error(erro);
        moduloMsg.style.display = 'block';
        moduloMsg.style.color = '#ff4d4d';
        moduloMsg.innerText = "Erro ao guardar.";
    } finally {
        btnGuardarModulo.innerText = "Gravar Nota";
        btnGuardarModulo.disabled = false;
        setTimeout(() => moduloMsg.style.display = 'none', 3000);
    }
});

// 8. Função: Carregar Módulos e Contar
async function carregarListaModulos(idAluno) {
    containerModulos.innerHTML = '<p class="text-muted">A carregar...</p>';
    try {
        const q = query(collection(db, "utilizadores", idAluno, "modulos"));
        const resultados = await getDocs(q);

        if (resultados.empty) {
            containerModulos.innerHTML = '<p class="text-muted">Nenhum módulo registado ainda.</p>';
            return;
        }

        let html = '';
        resultados.forEach(doc => {
            const mod = doc.data();
            html += `
                <div class="module-item">
                    <div class="module-info">
                        <strong>${mod.nome}</strong>
                    </div>
                    <div class="module-grade">${mod.nota}</div>
                </div>
            `;
        });
        containerModulos.innerHTML = html;
    } catch (error) { console.error(error); }
}

async function contarModulos(idAluno) {
    try {
        const q = query(collection(db, "utilizadores", idAluno, "modulos"));
        const resultados = await getDocs(q);
        contadorModulos.innerText = resultados.size; // Size diz-nos quantos documentos encontrou
    } catch (error) { console.error(error); }
}
