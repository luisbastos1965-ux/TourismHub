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

// Proteção Anti-Refresh
window.addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; });

const matrizCurso = {
    "Sociocultural": { "PORT": ["M1", "M2", "M3"], "ING": ["M1", "M2", "M3"], "AI": ["M1", "M2"], "EF": ["M1", "M2", "M3", "M4", "M5"], "TIC": ["M1", "M2", "M3", "M4"] },
    "Científica": { "GEO": ["M1", "M2"], "HCA": ["M1", "M2", "M3"], "MAT": ["M1", "M2", "M3"] },
    "Técnica": { "CF": ["M1", "M2", "M3"], "TIAT": ["M1", "M2", "M3", "M4"], "TCAT": ["M1", "M2", "M3", "M4"], "OTET": ["M1", "M2", "M3", "M4"] }
};

// Referências
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

let alunoAtualId = ""; 
let turmaAtual = ""; // Memória da Turma Escolhida
let nomePessoaContactoModal = ""; 
let idPrhfAtivo = ""; // Memória do PRHF aberto no Modal

function esconderTudoMenos(ecraAtivo) {
    [classView, studentDetailView, viewAvaliacoes, viewDisciplinaModulos, viewInformacoes, viewPrhf].forEach(el => el.style.display = 'none');
    if(ecraAtivo) ecraAtivo.style.display = 'block';
}

// 1. Autenticação
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", userId));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                document.getElementById('header-user-name').innerText = `Olá, ${dados.nome} (${dados.papel.toUpperCase()})`;
                
                painelAluno.style.display = dados.papel === 'admin' ? 'none' : 'block';
                painelAdmin.style.display = dados.papel === 'admin' ? 'block' : 'none';
                bottomNav.style.display = dados.papel === 'admin' ? 'none' : 'flex';
                
                loginScreen.style.display = 'none';
                appContent.style.display = 'block';
                esconderTudoMenos(null);
            }
        } catch (error) { console.error(error); }
    } else {
        loginScreen.style.display = 'flex';
        appContent.style.display = 'none';
    }
});

btnLoginManual.addEventListener('click', () => {
    const user = document.getElementById('login-username').value.trim().toLowerCase();
    const pass = document.getElementById('login-password').value;
    signInWithEmailAndPassword(auth, user + "@turmapro.com", pass)
        .then(() => errorMsg.style.display = 'none')
        .catch(() => { errorMsg.style.display = 'block'; errorMsg.innerText = "Erro: Credenciais inválidas."; });
});
btnLogout.addEventListener('click', () => signOut(auth));

// 2. Navegação Básica
document.getElementById('btn-voltar-turmas')?.addEventListener('click', () => { esconderTudoMenos(null); painelAdmin.style.display = 'block'; });
document.getElementById('btn-voltar-lista')?.addEventListener('click', () => esconderTudoMenos(classView));
document.getElementById('btn-voltar-hub-avaliacoes')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-disciplinas')?.addEventListener('click', () => esconderTudoMenos(viewAvaliacoes));
document.getElementById('btn-voltar-hub-info')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-hub-prhf')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));

document.querySelectorAll('.turma-card-large').forEach(botao => {
    botao.addEventListener('click', () => {
        turmaAtual = botao.getAttribute('data-turma'); // Guarda a turma
        document.getElementById('class-title').innerHTML = `<i class="fa-solid fa-users"></i> Turma ${turmaAtual}`;
        painelAdmin.style.display = 'none';
        esconderTudoMenos(classView);
        carregarAlunos(turmaAtual);
    });
});

async function carregarAlunos(turmaEscolhida) {
    const containerAlunos = document.querySelector('.students-list-container');
    containerAlunos.innerHTML = '<p class="text-muted">A carregar...</p>';
    try {
        const q = query(collection(db, "utilizadores"), where("turma", "==", turmaEscolhida), where("papel", "==", "aluno"));
        const res = await getDocs(q);
        if (res.empty) { containerAlunos.innerHTML = '<p class="text-muted">Sem alunos.</p>'; return; }

        let html = '<ul class="students-list">';
        res.forEach((doc) => {
            const aluno = doc.data();
            html += `<li class="student-item">
                        <div class="student-info"><strong>${aluno.nome}</strong><span>${doc.id.toUpperCase()}</span></div>
                        <button class="secondary-btn small-btn btn-ver-aluno" data-nome="${aluno.nome}" data-numero="${doc.id}"><i class="fa-solid fa-eye"></i> Ver</button>
                    </li>`;
        });
        html += '</ul>';
        containerAlunos.innerHTML = html;

        containerAlunos.querySelectorAll('.btn-ver-aluno').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.getElementById('detail-student-name').innerText = e.currentTarget.getAttribute('data-nome');
                alunoAtualId = e.currentTarget.getAttribute('data-numero');
                document.getElementById('detail-student-number').innerText = alunoAtualId.toUpperCase();
                
                // Lógica Mostrar/Esconder FCT e PAP consoante a Turma
                document.getElementById('btn-hub-fct').style.display = (turmaAtual === '11T' || turmaAtual === '12T') ? 'flex' : 'none';
                document.getElementById('btn-hub-pap').style.display = (turmaAtual === '12T') ? 'flex' : 'none';

                esconderTudoMenos(studentDetailView);
            });
        });
    } catch (e) { console.error(e); }
}

// 3. AVALIAÇÕES (Bloqueio SN)
document.getElementById('btn-hub-avaliacoes')?.addEventListener('click', () => {
    esconderTudoMenos(viewAvaliacoes);
    let html = "";
    for (const [nomeComponente, disciplinas] of Object.entries(matrizCurso)) {
        html += `<div class="component-section"><div class="component-header">${nomeComponente}</div><div class="subject-grid">`;
        for (const nomeDisciplina of Object.keys(disciplinas)) {
            html += `<button class="subject-btn" data-disc="${nomeDisciplina}">${nomeDisciplina}</button>`;
        }
        html += `</div></div>`;
    }
    document.getElementById('matriz-disciplinas-container').innerHTML = html;
    document.querySelectorAll('.subject-btn').forEach(btn => {
        btn.addEventListener('click', (e) => abrirModulosDisciplina(e.currentTarget.getAttribute('data-disc')));
    });
});

async function abrirModulosDisciplina(disciplina) {
    esconderTudoMenos(viewDisciplinaModulos);
    document.getElementById('titulo-disciplina').innerText = disciplina;
    const listaModulosUI = document.getElementById('lista-modulos-disciplina');
    listaModulosUI.innerHTML = '<p class="text-muted">A preparar pauta...</p>';

    const notasMapa = {};
    try {
        const qNotas = await getDocs(collection(db, "utilizadores", alunoAtualId, "notas"));
        qNotas.forEach(doc => { const data = doc.data(); if (data.disciplina === disciplina) notasMapa[data.modulo] = data.nota; });
    } catch(e) { console.error(e); }

    let modulosArray = [];
    for (const comp of Object.values(matrizCurso)) { if (comp[disciplina]) modulosArray = comp[disciplina]; }
    
    let html = "";
    modulosArray.forEach(mod => {
        const notaExistente = notasMapa[mod] !== undefined ? notasMapa[mod] : "SN";
        const isSn = notaExistente === "SN" ? "sn" : "";
        const inputValue = notaExistente === "SN" ? "" : notaExistente;

        html += `
        <div class="modulo-avaliar-item">
            <strong>${mod}</strong>
            <div class="mod-view" id="view-${disciplina}-${mod}">
                <span class="nota-badge ${isSn}" id="badge-${disciplina}-${mod}">${notaExistente}</span>
                <button class="secondary-btn small-btn btn-abrir-edicao-nota" data-mod="${mod}"><i class="fa-solid fa-pen"></i></button>
            </div>
            <div class="mod-edit" id="edit-${disciplina}-${mod}" style="display:none; align-items:center; gap:5px;">
                <input type="number" class="modulo-nota-input" id="input-${disciplina}-${mod}" placeholder="-" value="${inputValue}" min="0" max="20">
                <button class="primary-btn small-btn btn-gravar-nota" data-disc="${disciplina}" data-mod="${mod}">Gravar</button>
                <button class="secondary-btn small-btn btn-fechar-edicao-nota" data-mod="${mod}"><i class="fa-solid fa-xmark"></i></button>
            </div>
        </div>`;
    });
    listaModulosUI.innerHTML = html;
    
    listaModulosUI.querySelectorAll('.btn-abrir-edicao-nota').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mod = e.currentTarget.getAttribute('data-mod');
            document.getElementById(`view-${disciplina}-${mod}`).style.display = 'none'; document.getElementById(`edit-${disciplina}-${mod}`).style.display = 'flex';
        });
    });
    listaModulosUI.querySelectorAll('.btn-fechar-edicao-nota').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const mod = e.currentTarget.getAttribute('data-mod');
            document.getElementById(`view-${disciplina}-${mod}`).style.display = 'flex'; document.getElementById(`edit-${disciplina}-${mod}`).style.display = 'none';
        });
    });

    listaModulosUI.querySelectorAll('.btn-gravar-nota').forEach(btn => {
        btn.addEventListener('click', async (e) => {
            const disc = e.currentTarget.getAttribute('data-disc'); const mod = e.currentTarget.getAttribute('data-mod');
            const valorNovaNota = document.getElementById(`input-${disc}-${mod}`).value;
            if(valorNovaNota === "") return;
            const btnEl = e.currentTarget; btnEl.innerText = "OK";
            try {
                await setDoc(doc(db, "utilizadores", alunoAtualId, "notas", `${disc}_${mod}`), { disciplina: disc, modulo: mod, nota: Number(valorNovaNota), data: new Date().toISOString() });
                const badge = document.getElementById(`badge-${disc}-${mod}`); badge.innerText = valorNovaNota; badge.classList.remove('sn');
                setTimeout(() => {
                    btnEl.innerText = "Gravar";
                    document.getElementById(`view-${disc}-${mod}`).style.display = 'flex'; document.getElementById(`edit-${disc}-${mod}`).style.display = 'none';
                }, 1000);
            } catch (error) { console.error(error); }
        });
    });
}

// 4. INFORMAÇÕES E CONTACTOS
const modalTelefone = document.getElementById('modal-telefone');
const modalEmail = document.getElementById('modal-email');
let contactoTemp = "";

document.querySelectorAll('.btn-fechar-modal').forEach(b => b.addEventListener('click', () => { modalTelefone.style.display = 'none'; modalEmail.style.display = 'none'; }));

document.addEventListener('click', (e) => {
    if (e.target.classList.contains('clickable-contact')) {
        const tipo = e.target.getAttribute('data-type');
        const valor = e.target.innerText;
        if(valor === "-" || valor === "") return;
        nomePessoaContactoModal = e.target.id.includes('aluno') ? document.getElementById('detail-student-name').innerText : (document.getElementById('display-ee-nome').innerText || "Enc. Educação");
        contactoTemp = valor;
        if (tipo === 'tel') { document.getElementById('action-ligar').href = `tel:${contactoTemp}`; modalTelefone.style.display = 'flex'; } 
        else if (tipo === 'email') { document.getElementById('action-enviar-email').href = `mailto:${contactoTemp}?subject=Contacto da Escola`; modalEmail.style.display = 'flex'; }
    }
});

document.getElementById('action-guardar-vcard')?.addEventListener('click', () => {
    const vcardData = `BEGIN:VCARD\nVERSION:3.0\nFN:${nomePessoaContactoModal}\nTEL:${contactoTemp}\nEND:VCARD`;
    const blob = new Blob([vcardData], { type: 'text/vcard' });
    const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${nomePessoaContactoModal.replace(/\s+/g, '_')}.vcf`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); modalTelefone.style.display = 'none';
});

async function carregarInfoLeitura() {
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", alunoAtualId));
        if (docSnap.exists()) {
            const d = docSnap.data();
            document.getElementById('display-aluno-idade').innerText = d.idade || "-"; document.getElementById('display-aluno-tel').innerText = d.telAluno || "-"; document.getElementById('display-aluno-email').innerText = d.emailAluno || "-"; document.getElementById('display-aluno-morada').innerText = d.morada || "-";
            document.getElementById('display-ee-nome').innerText = d.nomeEE || "-"; document.getElementById('display-ee-filiacao').innerText = d.filiacaoEE || "-"; document.getElementById('display-ee-tel').innerText = d.telEE || "-"; document.getElementById('display-ee-email').innerText = d.emailEE || "-";
            ['info-aluno-idade', 'info-aluno-telemovel', 'info-aluno-email', 'info-aluno-morada', 'info-ee-nome', 'info-ee-filiacao', 'info-ee-telemovel', 'info-ee-email'].forEach(id => {
                const key = id.replace('info-aluno-', '').replace('info-ee-', '');
                document.getElementById(id).value = d[key === 'telemovel' ? (id.includes('aluno') ? 'telAluno' : 'telEE') : (key === 'email' ? (id.includes('aluno') ? 'emailAluno' : 'emailEE') : key)] || d[id.includes('aluno') ? key : key + 'EE'] || "";
            });
        }
    } catch (error) { console.error(error); }
}

if(document.getElementById('btn-hub-informacoes')) {
    document.getElementById('btn-hub-informacoes').addEventListener('click', () => {
        esconderTudoMenos(viewInformacoes);
        document.getElementById('info-aluno-display').style.display = 'block'; document.getElementById('info-aluno-edit').style.display = 'none';
        document.getElementById('info-ee-display').style.display = 'block'; document.getElementById('info-ee-edit').style.display = 'none';
        carregarInfoLeitura();
    });
}

document.getElementById('btn-editar-info-aluno').addEventListener('click', () => { if(confirm("Editar Aluno?")) { document.getElementById('info-aluno-display').style.display='none'; document.getElementById('info-aluno-edit').style.display='block'; }});
document.getElementById('btn-editar-info-ee').addEventListener('click', () => { if(confirm("Editar Encarregado de Educação?")) { document.getElementById('info-ee-display').style.display='none'; document.getElementById('info-ee-edit').style.display='block'; }});
document.getElementById('btn-cancelar-aluno').addEventListener('click', () => { document.getElementById('info-aluno-display').style.display='block'; document.getElementById('info-aluno-edit').style.display='none'; });
document.getElementById('btn-cancelar-ee').addEventListener('click', () => { document.getElementById('info-ee-display').style.display='block'; document.getElementById('info-ee-edit').style.display='none'; });

document.getElementById('btn-guardar-aluno').addEventListener('click', async (e) => {
    e.currentTarget.innerText = "A gravar...";
    try { await updateDoc(doc(db, "utilizadores", alunoAtualId), { idade: document.getElementById('info-aluno-idade').value, telAluno: document.getElementById('info-aluno-telemovel').value, emailAluno: document.getElementById('info-aluno-email').value, morada: document.getElementById('info-aluno-morada').value });
        carregarInfoLeitura(); document.getElementById('info-aluno-display').style.display='block'; document.getElementById('info-aluno-edit').style.display='none';
    } catch(e) {} e.currentTarget.innerText = "Guardar";
});
document.getElementById('btn-guardar-ee').addEventListener('click', async (e) => {
    e.currentTarget.innerText = "A gravar...";
    try { await updateDoc(doc(db, "utilizadores", alunoAtualId), { nomeEE: document.getElementById('info-ee-nome').value, filiacaoEE: document.getElementById('info-ee-filiacao').value, telEE: document.getElementById('info-ee-telemovel').value, emailEE: document.getElementById('info-ee-email').value });
        carregarInfoLeitura(); document.getElementById('info-ee-display').style.display='block'; document.getElementById('info-ee-edit').style.display='none';
    } catch(e) {} e.currentTarget.innerText = "Guardar";
});

// 5. PRHF (ABAS E FOLHA MODAL)
let tabAtiva = 'ativas'; // Estado da aba selecionada
const modalFolha = document.getElementById('modal-prhf-sheet');

if(document.getElementById('btn-hub-prhf')) {
    document.getElementById('btn-hub-prhf').addEventListener('click', () => {
        esconderTudoMenos(viewPrhf);
        tabAtiva = 'ativas'; 
        document.getElementById('tab-prhf-ativas').classList.add('active');
        document.getElementById('tab-prhf-concluidas').classList.remove('active');
        carregarListaPRHF(alunoAtualId);
    });
}

document.getElementById('tab-prhf-ativas').addEventListener('click', (e) => {
    tabAtiva = 'ativas';
    e.currentTarget.classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active');
    carregarListaPRHF(alunoAtualId);
});
document.getElementById('tab-prhf-concluidas').addEventListener('click', (e) => {
    tabAtiva = 'concluidas';
    e.currentTarget.classList.add('active'); document.getElementById('tab-prhf-ativas').classList.remove('active');
    carregarListaPRHF(alunoAtualId);
});

document.getElementById('btn-guardar-prhf').addEventListener('click', async (e) => {
    const disc = document.getElementById('prhf-disciplina').value.trim(); const mod = document.getElementById('prhf-modulo').value.trim();
    const prazo = document.getElementById('prhf-prazo').value; const desc = document.getElementById('prhf-descricao').value.trim();
    const htInput = document.getElementById('prhf-horas').value;

    if(!disc || !mod || !prazo || !desc || !htInput) return alert("Preenche todos os campos!");
    
    const hT = parseInt(htInput);
    let hN = 0; if(hT > 4) hN = Math.ceil(hT * 0.3);
    const hP = hT - hN;

    e.currentTarget.innerText = "A gravar...";
    try {
        await addDoc(collection(db, "utilizadores", alunoAtualId, "prhfs"), { 
            disciplina: disc.toUpperCase(), modulo: mod.toUpperCase(), prazo: prazo, descricao: desc, 
            horasNaoPresenciais: hN, horasPresenciais: hP, status: 'ativa', dataRegisto: new Date().toISOString() 
        });
        document.getElementById('prhf-disciplina').value = ""; document.getElementById('prhf-modulo').value = ""; document.getElementById('prhf-prazo').value = ""; document.getElementById('prhf-descricao').value = ""; document.getElementById('prhf-horas').value = "";
        
        tabAtiva = 'ativas'; document.getElementById('tab-prhf-ativas').classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active');
        carregarListaPRHF(alunoAtualId);
    } catch (e) { console.error(e); } e.currentTarget.innerText = "Gravar Tarefa";
});

let prhfsMemoria = []; // Guarda os dados para abrir na folha

async function carregarListaPRHF(idAluno) {
    const container = document.getElementById('lista-prhf-container');
    container.innerHTML = '<p class="text-muted">A carregar...</p>';
    prhfsMemoria = [];
    try {
        const q = query(collection(db, "utilizadores", idAluno, "prhfs"));
        const resultados = await getDocs(q);

        let html = '';
        resultados.forEach(doc => {
            const data = doc.data(); data.id = doc.id;
            // Só guarda na memória e desenha se o status coincidir com a aba
            if ((tabAtiva === 'ativas' && data.status === 'ativa') || (tabAtiva === 'concluidas' && data.status === 'concluida')) {
                prhfsMemoria.push(data);
                const classeCor = data.status === 'ativa' ? 'ativa' : 'concluida';
                const siglaMod = data.modulo.includes('M') ? data.modulo : 'M'+data.modulo; // Garante o M
                
                html += `
                    <div class="prhf-mini-card ${classeCor}" data-id="${data.id}">
                        <strong>${data.disciplina}_${siglaMod}</strong>
                        <i class="fa-solid fa-chevron-right" style="color:var(--text-muted); font-size:0.8rem;"></i>
                    </div>
                `;
            }
        });
        
        if (html === '') { container.innerHTML = `<p class="text-muted">Sem tarefas ${tabAtiva}.</p>`; return; }
        
        container.innerHTML = html;

        // Adicionar clique para abrir a Folha
        container.querySelectorAll('.prhf-mini-card').forEach(card => {
            card.addEventListener('click', (e) => {
                const idClicado = e.currentTarget.getAttribute('data-id');
                abrirFolhaPRHF(idClicado);
            });
        });
    } catch (e) { console.error(e); }
}

// Lógica da Folha (Modal Paper)
function abrirFolhaPRHF(id) {
    const plano = prhfsMemoria.find(p => p.id === id);
    if(!plano) return;
    
    idPrhfAtivo = id; // Memória para o botão concluir
    const siglaMod = plano.modulo.includes('M') ? plano.modulo : 'M'+plano.modulo;
    const dataParts = plano.prazo.split('-'); const dataF = dataParts.length === 3 ? `${dataParts[2]}/${dataParts[1]}/${dataParts[0]}` : plano.prazo;
    
    document.getElementById('sheet-title').innerText = `${plano.disciplina}_${siglaMod}`;
    document.getElementById('sheet-prazo').innerText = dataF;
    document.getElementById('sheet-hp').innerText = plano.horasPresenciais;
    document.getElementById('sheet-ha').innerText = plano.horasNaoPresenciais;
    document.getElementById('sheet-desc').innerText = plano.descricao;
    
    const badgeStatus = document.getElementById('sheet-status');
    badgeStatus.innerText = plano.status.toUpperCase();
    badgeStatus.className = `paper-status ${plano.status}`;

    // Link do Calendário
    const textoDataCalendario = plano.prazo.replace(/-/g, '') + 'T090000Z/' + plano.prazo.replace(/-/g, '') + 'T100000Z'; 
    document.getElementById('sheet-btn-agendar').href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Apoio+${plano.disciplina}&details=Aluno:+${document.getElementById('detail-student-name').innerText}%0AHoras:+${plano.horasPresenciais}h%0A${plano.descricao}&dates=${textoDataCalendario}`;

    // Esconde o botão Concluir se já estiver concluído
    document.getElementById('sheet-btn-concluir').style.display = plano.status === 'concluida' ? 'none' : 'flex';
    
    modalFolha.style.display = 'flex';
}

document.querySelector('.btn-close-paper').addEventListener('click', () => modalFolha.style.display = 'none');

document.getElementById('sheet-btn-concluir').addEventListener('click', async (e) => {
    if(!confirm("Marcar este plano como CONCLUÍDO?")) return;
    e.currentTarget.innerText = "A validar...";
    try {
        await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { status: 'concluida' });
        modalFolha.style.display = 'none';
        carregarListaPRHF(alunoAtualId); // Recarrega a lista para a tarefa desaparecer da aba 'Ativas'
    } catch(err) { console.error(err); e.currentTarget.innerText = "Marcar como Concluído"; }
});
