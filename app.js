import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

// Referências aos elementos do ecrã
const loginScreen = document.getElementById('login-screen');
const appContent = document.getElementById('app-content');
const btnLoginManual = document.getElementById('btn-login-manual');
const btnLogout = document.getElementById('btn-logout');
const errorMsg = document.getElementById('login-error');

// Referências aos painéis
const painelAluno = document.getElementById('student-dashboard');
const painelAdmin = document.getElementById('admin-dashboard');
const classView = document.getElementById('class-view');
const studentDetailView = document.getElementById('student-detail-view'); // NOVO

// Referências à navegação de turmas e alunos
const botoesTurma = document.querySelectorAll('.turma-card');
const classTitle = document.getElementById('class-title');
const btnVoltarTurmas = document.getElementById('btn-voltar-turmas');
const containerAlunos = document.querySelector('.students-list-container');
const btnVoltarLista = document.getElementById('btn-voltar-lista'); // NOVO
const detailStudentName = document.getElementById('detail-student-name'); // NOVO
const detailStudentNumber = document.getElementById('detail-student-number'); // NOVO

// 1. Escutar estado de autenticação e carregar dados do utilizador
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
                
                const userProfileSpan = document.querySelector('.user-profile span');
                userProfileSpan.innerText = `Olá, ${dados.nome} (${dados.papel.toUpperCase()})`;
                
                // Esconder/Mostrar painéis consoante o papel
                if (dados.papel === 'admin') {
                    painelAluno.style.display = 'none';
                    painelAdmin.style.display = 'block';
                    classView.style.display = 'none';
                    studentDetailView.style.display = 'none';
                } else {
                    painelAluno.style.display = 'block';
                    painelAdmin.style.display = 'none';
                    classView.style.display = 'none';
                    studentDetailView.style.display = 'none';
                }
            }
        } catch (error) {
            console.error("Erro ao carregar dados do perfil:", error);
        }
    } else {
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

// 2. Fazer Login
btnLoginManual.addEventListener('click', () => {
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;
    const emailFalso = username + "@turmapro.com";

    signInWithEmailAndPassword(auth, emailFalso, pass)
        .then(() => {
            errorMsg.style.display = 'none';
        })
        .catch((error) => {
            errorMsg.style.display = 'block';
            errorMsg.innerText = "Erro: Credenciais inválidas.";
        });
});

// 3. Terminar Sessão
btnLogout.addEventListener('click', () => {
    signOut(auth);
});

// 4. Navegação Principal (Botões de Voltar)
if(btnVoltarTurmas) {
    btnVoltarTurmas.addEventListener('click', () => {
        classView.style.display = 'none';
        painelAdmin.style.display = 'block';
    });
}

if(btnVoltarLista) {
    btnVoltarLista.addEventListener('click', () => {
        studentDetailView.style.display = 'none';
        classView.style.display = 'block'; // Volta a mostrar a pauta da turma
    });
}

// 5. Navegação do Painel de Admin (Abrir Turmas)
botoesTurma.forEach(botao => {
    botao.addEventListener('click', () => {
        const nomeTurma = botao.getAttribute('data-turma'); 
        
        classTitle.innerHTML = `<i class="fa-solid fa-users"></i> Turma ${nomeTurma}`;
        
        painelAdmin.style.display = 'none';
        classView.style.display = 'block';
        studentDetailView.style.display = 'none';

        carregarAlunos(nomeTurma);
    });
});

// 6. Função Mágica: Ir buscar alunos à Base de Dados
async function carregarAlunos(turmaEscolhida) {
    containerAlunos.innerHTML = '<p style="color: var(--text-muted);">A carregar lista de alunos...</p>';

    try {
        const q = query(
            collection(db, "utilizadores"), 
            where("turma", "==", turmaEscolhida), 
            where("papel", "==", "aluno")
        );
        
        const resultados = await getDocs(q);

        if (resultados.empty) {
            containerAlunos.innerHTML = '<p style="color: var(--text-muted);">Ainda não há alunos registados nesta turma.</p>';
            return;
        }

        let htmlLista = '<ul class="students-list">';
        
        resultados.forEach((documento) => {
            const aluno = documento.data();
            const numeroAluno = documento.id;

            // Injetamos pequenos "data-attributes" para o botão saber de quem é
            htmlLista += `
                <li class="student-item">
                    <div class="student-info">
                        <strong>${aluno.nome}</strong>
                        <span>${numeroAluno.toUpperCase()}</span>
                    </div>
                    <button class="secondary-btn small-btn btn-ver-aluno" data-nome="${aluno.nome}" data-numero="${numeroAluno}">
                        <i class="fa-solid fa-eye"></i> Ver
                    </button>
                </li>
            `;
        });
        
        htmlLista += '</ul>';
        containerAlunos.innerHTML = htmlLista;

        // 7. Ativar os botões "Ver" acabados de criar!
        const botoesVer = containerAlunos.querySelectorAll('.btn-ver-aluno');
        botoesVer.forEach(botao => {
            botao.addEventListener('click', (evento) => {
                // Apanhar os dados escondidos no botão
                const nome = evento.currentTarget.getAttribute('data-nome');
                const numero = evento.currentTarget.getAttribute('data-numero');
                
                // Mudar o nome no ecrã de perfil
                detailStudentName.innerText = nome;
                detailStudentNumber.innerText = numero.toUpperCase();
                
                // Fechar a lista e abrir o perfil
                classView.style.display = 'none';
                studentDetailView.style.display = 'block';
            });
        });

    } catch (erro) {
        console.error("Erro ao carregar alunos:", erro);
        containerAlunos.innerHTML = '<p style="color: #ff4d4d;">Erro ao carregar a lista de alunos. Verifica a ligação.</p>';
    }
}
