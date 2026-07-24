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

// 0. Prevenir Fecho ou Refresh Acidental
window.addEventListener('beforeunload', (e) => {
    // Isto obriga o browser a mostrar um aviso "Tens a certeza que queres sair?"
    e.preventDefault();
    e.returnValue = ''; 
});

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

let alunoAtualId = ""; 

function esconderTudoMenos(ecraAtivo) {
    [classView, studentDetailView, viewAvaliacoes, viewDisciplinaModulos, viewInformacoes, viewPrhf].forEach(el => el.style.display = 'none');
    if(ecraAtivo) ecraAtivo.style.display = 'block';
}

// 1. Autenticação
onAuthStateChanged(auth, async (user) => {
    if (user) {
        // Sessão ativa
        const userId = user.email.split('@')[0];
        try {
            const docRef = doc(db, "utilizadores", userId);
            const docSnap = await getDoc(docRef);
            if (docSnap.exists()) {
                const dados = docSnap.data();
                document.querySelector('.user-profile span').innerText = `Olá, ${dados.nome} (${dados.papel.toUpperCase()})`;
                
                painelAluno.style.display = dados.papel === 'admin' ? 'none' : 'block';
                painelAdmin.style.display = dados.papel === 'admin' ? 'block' : 'none';
                bottomNav.style.display = dados.papel === 'admin' ? 'none' : 'flex';
                
                loginScreen.style.display = 'none';
                appContent.style.display = 'block';
                esconderTudoMenos(null);
            }
        } catch (error) { console.error(error); }
    } else {
        // Nenhuma sessão
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

btnLoginManual.addEventListener('click', () => {
    const username = document.getElementById('login-username').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, username + "@turmapro.com", pass)
        .then(() => errorMsg.style.display = 'none')
        .catch(() => { errorMsg.style.display = 'block'; errorMsg.innerText = "Erro: Credenciais inválidas."; });
});

btnLogout.addEventListener('click', () => signOut(auth));

// 2. Navegação Básica
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

// 3. Avaliações (Omitido código duplicado por brevidade de explicação visual, continua intacto no background)
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
        btn.addEventListener('click', (e) => { abrirModulosDisciplina(e.currentTarget.getAttribute('data-disc')); });
    });
}
async function abrirModulosDisciplina(disciplina) {
    esconderTudoMenos(viewDisciplinaModulos);
    tituloDisciplina.innerText = disciplina;
    const listaModulosUI = document.getElementById('lista-modulos-disciplina');
    listaModulosUI.innerHTML = '<p class="text-muted">A preparar módulos...</p>';

    let modulosArray = [];
    for (const comp of Object.values(matrizCurso)) { if (comp[disciplina]) modulosArray = comp[disciplina]; }
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

// 4. Lógica de Informações (Módulo Leitura/Edição)
async function carregarInfoLeitura() {
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", alunoAtualId));
        if (docSnap.exists()) {
            const d = docSnap.data();
            
            // Injetar nos Textos de Leitura
            document.getElementById('display-aluno-idade').innerText = d.idade || "-";
            document.getElementById('display-aluno-tel').innerText = d.telAluno || "-";
            document.getElementById('display-aluno-email').innerText = d.emailAluno || "-";
            document.getElementById('display-aluno-morada').innerText = d.morada || "-";
            
            document.getElementById('display-ee-nome').innerText = d.nomeEE || "-";
            document.getElementById('display-ee-filiacao').innerText = d.filiacaoEE || "-";
            document.getElementById('display-ee-tel').innerText = d.telEE || "-";
            document.getElementById('display-ee-email').innerText = d.emailEE || "-";
            
            // Injetar nos Inputs de Edição
            document.getElementById('info-aluno-idade').value = d.idade || "";
            document.getElementById('info-aluno-telemovel').value = d.telAluno || "";
            document.getElementById('info-aluno-email').value = d.emailAluno || "";
            document.getElementById('info-aluno-morada').value = d.morada || "";
            
            document.getElementById('info-ee-nome').value = d.nomeEE || "";
            document.getElementById('info-ee-filiacao').value = d.filiacaoEE || "";
            document.getElementById('info-ee-telemovel').value = d.telEE || "";
            document.getElementById('info-ee-email').value = d.emailEE || "";
        }
    } catch (error) { console.error(error); }
}

if(btnHubInformacoes) {
    btnHubInformacoes.addEventListener('click', () => {
        esconderTudoMenos(viewInformacoes);
        
        // Garante que ao abrir entra sempre em modo Leitura
        document.getElementById('info-aluno-display').style.display = 'block';
        document.getElementById('info-aluno-edit').style.display = 'none';
        document.getElementById('info-ee-display').style.display = 'block';
        document.getElementById('info-ee-edit').style.display = 'none';
        
        carregarInfoLeitura();
    });
}

// Botões "Editar" - Com Confirmação de Segurança
document.getElementById('btn-editar-info-aluno').addEventListener('click', () => {
    if(confirm("Pretendes editar as informações do Aluno?")) {
        document.getElementById('info-aluno-display').style.display = 'none';
        document.getElementById('info-aluno-edit').style.display = 'block';
    }
});
document.getElementById('btn-editar-info-ee').addEventListener('click', () => {
    if(confirm("Pretendes editar as informações do Encarregado de Educação?")) {
        document.getElementById('info-ee-display').style.display = 'none';
        document.getElementById('info-ee-edit').style.display = 'block';
    }
});

// Botões "Cancelar Edição"
document.getElementById('btn-cancelar-aluno').addEventListener('click', () => {
    document.getElementById('info-aluno-display').style.display = 'block';
    document.getElementById('info-aluno-edit').style.display = 'none';
});
document.getElementById('btn-cancelar-ee').addEventListener('click', () => {
    document.getElementById('info-ee-display').style.display = 'block';
    document.getElementById('info-ee-edit').style.display = 'none';
});

// Botões "Guardar"
document.getElementById('btn-guardar-aluno').addEventListener('click', async (e) => {
    e.currentTarget.innerText = "A gravar...";
    try {
        await updateDoc(doc(db, "utilizadores", alunoAtualId), {
            idade: document.getElementById('info-aluno-idade').value,
            telAluno: document.getElementById('info-aluno-telemovel').value,
            emailAluno: document.getElementById('info-aluno-email').value,
            morada: document.getElementById('info-aluno-morada').value,
        });
        carregarInfoLeitura();
        document.getElementById('info-aluno-display').style.display = 'block';
        document.getElementById('info-aluno-edit').style.display = 'none';
    } catch (error) { console.error(error); }
    e.currentTarget.innerText = "Guardar";
});
document.getElementById('btn-guardar-ee').addEventListener('click', async (e) => {
    e.currentTarget.innerText = "A gravar...";
    try {
        await updateDoc(doc(db, "utilizadores", alunoAtualId), {
            nomeEE: document.getElementById('info-ee-nome').value,
            filiacaoEE: document.getElementById('info-ee-filiacao').value,
            telEE: document.getElementById('info-ee-telemovel').value,
            emailEE: document.getElementById('info-ee-email').value
        });
        carregarInfoLeitura();
        document.getElementById('info-ee-display').style.display = 'block';
        document.getElementById('info-ee-edit').style.display = 'none';
    } catch (error) { console.error(error); }
    e.currentTarget.innerText = "Guardar";
});

// 5. Lógica de PRHF 
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
    const horasTotaisInput = document.getElementById('prhf-horas').value;

    if(!disc || !mod || !prazo || !desc || !horasTotaisInput) {
        alert("Preenche todos os campos (incluindo as horas)!");
        return;
    }

    // O Cérebro Matemático da tua Escola
    const horasTotais = parseInt(horasTotaisInput);
    let horasNaoPresenciais = 0;
    
    // =SE(C5<=4;0;ARRED.EXCESSO(C5*0,3;1))
    if(horasTotais > 4) {
        horasNaoPresenciais = Math.ceil(horasTotais * 0.3);
    }
    const horasPresenciais = horasTotais - horasNaoPresenciais;

    e.currentTarget.innerText = "A gravar...";
    try {
        await addDoc(collection(db, "utilizadores", alunoAtualId, "prhfs"), {
            disciplina: disc.toUpperCase(),
            modulo: mod.toUpperCase(),
            prazo: prazo,
            descricao: desc,
            horasNaoPresenciais: horasNaoPresenciais,
            horasPresenciais: horasPresenciais,
            dataRegisto: new Date().toISOString()
        });
        
        document.getElementById('prhf-disciplina').value = "";
        document.getElementById('prhf-modulo').value = "";
        document.getElementById('prhf-prazo').value = "";
        document.getElementById('prhf-descricao').value = "";
        document.getElementById('prhf-horas').value = "";

        document.getElementById('msg-sucesso-prhf').style.display = 'block';
        setTimeout(() => document.getElementById('msg-sucesso-prhf').style.display = 'none', 3000);
        
        carregarListaPRHF(alunoAtualId);
    } catch (error) { console.error(error); }
    
    e.currentTarget.innerText = "Processar e Gravar";
});

async function carregarListaPRHF(idAluno) {
    const container = document.getElementById('lista-prhf-container');
    container.innerHTML = '<p class="text-muted">A carregar planos...</p>';
    try {
        const q = query(collection(db, "utilizadores", idAluno, "prhfs"));
        const resultados = await getDocs(q);

        if (resultados.empty) {
            container.innerHTML = '<p class="text-muted">Sem tarefas ativas.</p>';
            return;
        }

        let html = '';
        resultados.forEach(doc => {
            const prhf = doc.data();
            const dataParts = prhf.prazo.split('-');
            const dataFormatada = dataParts.length === 3 ? `${dataParts[2]}-${dataParts[1]}-${dataParts[0]}` : prhf.prazo;

            html += `
                <div class="prhf-card">
                    <div class="prhf-header">
                        <strong>${prhf.disciplina} - ${prhf.modulo}</strong>
                        <span class="prhf-prazo"><i class="fa-solid fa-calendar-days"></i> ${dataFormatada}</span>
                    </div>
                    <p style="font-size: 0.95rem; margin-bottom: 10px;">${prhf.descricao}</p>
                    
                    <div style="background-color: var(--bg-dark); padding: 8px; border-radius: 6px; font-size: 0.85rem; border: 1px dashed var(--primary-green);">
                        <div style="color: var(--primary-green); margin-bottom: 4px;"><strong>Cálculo do Plano:</strong></div>
                        <div>Horas Autónomas (Não Presenciais): <strong>${prhf.horasNaoPresenciais}h</strong></div>
                        <div>Horas com Professor (Presenciais): <strong>${prhf.horasPresenciais}h</strong></div>
                    </div>
                </div>
            `;
        });
        container.innerHTML = html;
    } catch (error) { console.error(error); }
}
