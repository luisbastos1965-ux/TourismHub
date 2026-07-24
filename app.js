import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, addDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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

window.addEventListener('beforeunload', (e) => { e.preventDefault(); e.returnValue = ''; });

const matrizCurso = {
    "Sociocultural": { "PORT": ["M1", "M2", "M3"], "ING": ["M1", "M2", "M3"], "AI": ["M1", "M2"], "EF": ["M1", "M2", "M3", "M4", "M5"], "TIC": ["M1", "M2", "M3", "M4"] },
    "Científica": { "GEO": ["M1", "M2"], "HCA": ["M1", "M2", "M3"], "MAT": ["M1", "M2", "M3"] },
    "Técnica": { "CF": ["M1", "M2", "M3"], "TIAT": ["M1", "M2", "M3", "M4"], "TCAT": ["M1", "M2", "M3", "M4"], "OTET": ["M1", "M2", "M3", "M4"] }
};

const loginScreen = document.getElementById('login-screen'); const appContent = document.getElementById('app-content');
const btnLoginManual = document.getElementById('btn-login-manual'); const btnLogout = document.getElementById('btn-logout');
const errorMsg = document.getElementById('login-error'); const bottomNav = document.querySelector('.bottom-nav');
const painelAluno = document.getElementById('student-dashboard'); const painelAdmin = document.getElementById('admin-dashboard');
const classView = document.getElementById('class-view'); const studentDetailView = document.getElementById('student-detail-view');
const viewAvaliacoes = document.getElementById('view-avaliacoes'); const viewDisciplinaModulos = document.getElementById('view-disciplina-modulos');
const viewInformacoes = document.getElementById('view-informacoes'); const viewPrhf = document.getElementById('view-prhf');
const viewFaltas = document.getElementById('view-faltas'); const viewFaltasModulos = document.getElementById('view-faltas-modulos');

let alunoAtualId = ""; let turmaAtual = ""; let nomePessoaContactoModal = ""; let idPrhfAtivo = ""; 

function esconderTudoMenos(ecraAtivo) {
    [classView, studentDetailView, viewAvaliacoes, viewDisciplinaModulos, viewInformacoes, viewPrhf, viewFaltas, viewFaltasModulos].forEach(el => el.style.display = 'none');
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
                loginScreen.style.display = 'none'; appContent.style.display = 'block'; esconderTudoMenos(null);
            }
        } catch (e) { console.error(e); }
    } else { loginScreen.style.display = 'flex'; appContent.style.display = 'none'; }
});

btnLoginManual.addEventListener('click', () => {
    const user = document.getElementById('login-username').value.trim().toLowerCase();
    signInWithEmailAndPassword(auth, user + "@turmapro.com", document.getElementById('login-password').value)
        .then(() => errorMsg.style.display = 'none').catch(() => { errorMsg.style.display = 'block'; errorMsg.innerText = "Credenciais inválidas."; });
});
btnLogout.addEventListener('click', () => signOut(auth));

// 2. Navegação Básica e Turmas
document.getElementById('btn-voltar-turmas')?.addEventListener('click', () => { esconderTudoMenos(null); painelAdmin.style.display = 'block'; });
document.getElementById('btn-voltar-lista')?.addEventListener('click', () => esconderTudoMenos(classView));
document.getElementById('btn-voltar-hub-avaliacoes')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-disciplinas')?.addEventListener('click', () => esconderTudoMenos(viewAvaliacoes));
document.getElementById('btn-voltar-hub-info')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-hub-prhf')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-hub-faltas')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-faltas-disc')?.addEventListener('click', () => esconderTudoMenos(viewFaltas));

document.querySelectorAll('.turma-card-large').forEach(botao => {
    botao.addEventListener('click', () => {
        turmaAtual = botao.getAttribute('data-turma'); 
        document.getElementById('class-title').innerHTML = `<i class="fa-solid ${turmaAtual === 'TUR' ? 'fa-globe' : 'fa-users'}"></i> Turma ${turmaAtual}`;
        painelAdmin.style.display = 'none'; esconderTudoMenos(classView); carregarAlunos(turmaAtual);
    });
});

async function carregarAlunos(turmaEscolhida) {
    const container = document.querySelector('.students-list-container'); container.innerHTML = '<p class="text-muted">A carregar...</p>';
    try {
        const q = turmaEscolhida === 'TUR' ? query(collection(db, "utilizadores"), where("papel", "==", "aluno")) : query(collection(db, "utilizadores"), where("turma", "==", turmaEscolhida), where("papel", "==", "aluno"));
        const res = await getDocs(q);
        if (res.empty) { container.innerHTML = '<p class="text-muted">Sem alunos.</p>'; return; }

        let html = '<ul class="students-list">';
        res.forEach((doc) => {
            const aluno = doc.data(); const tagTurma = turmaEscolhida === 'TUR' ? ` (${aluno.turma})` : '';
            const miniatura = aluno.fotoPerfil ? `<img src="${aluno.fotoPerfil}" class="list-avatar">` : `<div class="list-avatar"><i class="fa-solid fa-user"></i></div>`;
            html += `<li class="student-item"><div style="display:flex; align-items:center; gap:12px;">${miniatura}<div class="student-info"><strong>${aluno.nome}${tagTurma}</strong><span>${doc.id.toUpperCase()}</span></div></div><button class="secondary-btn small-btn btn-ver-aluno" data-nome="${aluno.nome}" data-numero="${doc.id}" data-t="${aluno.turma}"><i class="fa-solid fa-eye"></i> Ver</button></li>`;
        });
        container.innerHTML = html + '</ul>';

        container.querySelectorAll('.btn-ver-aluno').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.getElementById('detail-student-name').innerText = e.currentTarget.getAttribute('data-nome');
                alunoAtualId = e.currentTarget.getAttribute('data-numero');
                document.getElementById('detail-student-number').innerText = alunoAtualId.toUpperCase();
                
                const turmaRealAluno = e.currentTarget.getAttribute('data-t') || "10T";
                const fct = document.getElementById('btn-hub-fct'); const pap = document.getElementById('btn-hub-pap');
                if (turmaRealAluno.includes('10')) { fct.classList.add('disabled-hub-card'); pap.classList.add('disabled-hub-card'); } 
                else if (turmaRealAluno.includes('11')) { fct.classList.remove('disabled-hub-card'); pap.classList.add('disabled-hub-card'); } 
                else { fct.classList.remove('disabled-hub-card'); pap.classList.remove('disabled-hub-card'); }
                
                esconderTudoMenos(studentDetailView); carregarFotoPerfil();
            });
        });
    } catch (e) { console.error(e); }
}

async function carregarFotoPerfil() {
    document.getElementById('avatar-img').style.display = 'none'; document.getElementById('avatar-icon').style.display = 'block';
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", alunoAtualId));
        if (docSnap.exists() && docSnap.data().fotoPerfil) {
            document.getElementById('avatar-img').src = docSnap.data().fotoPerfil; document.getElementById('avatar-img').style.display = 'block'; document.getElementById('avatar-icon').style.display = 'none';
        }
    } catch(e){}
}
document.getElementById('upload-avatar').addEventListener('change', (e) => {
    const file = e.target.files[0]; if(!file) return; const reader = new FileReader();
    reader.onload = (event) => {
        const img = new Image(); img.onload = () => {
            const canvas = document.createElement('canvas'); canvas.width = 150; canvas.height = 150; const ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0, 150, 150);
            const base64 = canvas.toDataURL('image/jpeg', 0.8);
            updateDoc(doc(db, 'utilizadores', alunoAtualId), { fotoPerfil: base64 });
            document.getElementById('avatar-img').src = base64; document.getElementById('avatar-img').style.display = 'block'; document.getElementById('avatar-icon').style.display = 'none';
        }; img.src = event.target.result;
    }; reader.readAsDataURL(file);
});

// 3. AVALIAÇÕES (Grelha Moderna 10-20 + REP)
document.getElementById('btn-hub-avaliacoes')?.addEventListener('click', () => { esconderTudoMenos(viewAvaliacoes); construirMatrizVisual(document.getElementById('matriz-disciplinas-container'), abrirModulosDisciplinaAvaliacao); });

function construirMatrizVisual(containerEl, funcaoClique) {
    let html = "";
    for (const [nomeComponente, disciplinas] of Object.entries(matrizCurso)) {
        html += `<div class="component-section"><div class="component-header">${nomeComponente}</div><div class="subject-grid">`;
        for (const nomeDisciplina of Object.keys(disciplinas)) { html += `<button class="subject-btn" data-disc="${nomeDisciplina}">${nomeDisciplina}</button>`; }
        html += `</div></div>`;
    }
    containerEl.innerHTML = html;
    containerEl.querySelectorAll('.subject-btn').forEach(btn => btn.addEventListener('click', (e) => funcaoClique(e.currentTarget.getAttribute('data-disc'))));
}

async function abrirModulosDisciplinaAvaliacao(disciplina) {
    esconderTudoMenos(viewDisciplinaModulos); document.getElementById('titulo-disciplina').innerText = disciplina;
    const listaModulosUI = document.getElementById('lista-modulos-disciplina'); listaModulosUI.innerHTML = '<p class="text-muted">A preparar pauta...</p>';
    const notasMapa = {}; try { const qNotas = await getDocs(collection(db, "utilizadores", alunoAtualId, "notas")); qNotas.forEach(d => { if (d.data().disciplina === disciplina) notasMapa[d.data().modulo] = d.data().nota; }); } catch(e){}
    let modulosArray = []; for (const comp of Object.values(matrizCurso)) { if (comp[disciplina]) modulosArray = comp[disciplina]; }
    
    // Constrói a grelha de botões em HTML (10 a 20 e REP)
    let gridBtns = "";
    for(let i=10; i<=20; i++) { gridBtns += `<button class="grade-btn" data-val="${i}">${i}</button>`; }
    gridBtns += `<button class="grade-btn rep" data-val="REP">REP</button>`;

    let html = "";
    modulosArray.forEach(mod => {
        const nEx = notasMapa[mod] !== undefined ? notasMapa[mod] : "SN"; 
        let classeBadge = ""; if(nEx === "SN") classeBadge = "sn"; else if(nEx === "REP") classeBadge = "rep";

        html += `<div class="modulo-avaliar-item" style="display:flex; flex-direction:column;">
            <div class="mod-view" id="view-${disciplina}-${mod}" style="display:flex; justify-content:space-between; width:100%;">
                <strong>${mod}</strong>
                <div style="display:flex; align-items:center; gap:15px;">
                    <span class="nota-badge ${classeBadge}" id="badge-${disciplina}-${mod}">${nEx}</span>
                    <button class="secondary-btn small-btn btn-abrir-edicao-nota" data-mod="${mod}"><i class="fa-solid fa-pen"></i></button>
                </div>
            </div>
            <div class="mod-edit" id="edit-${disciplina}-${mod}" style="display:none; flex-direction:column; width:100%;">
                <div class="grade-grid" id="grid-${disciplina}-${mod}">${gridBtns}</div>
                <div style="display:flex; gap:10px;">
                    <button class="primary-btn small-btn btn-gravar-nota" data-disc="${disciplina}" data-mod="${mod}" style="flex:1;">OK (Gravar)</button>
                    <button class="secondary-btn small-btn btn-fechar-edicao-nota" data-mod="${mod}" style="flex:1;">Cancelar</button>
                </div>
            </div>
        </div>`;
    });
    listaModulosUI.innerHTML = html;
    
    // Lógica para abrir/fechar edição
    listaModulosUI.querySelectorAll('.btn-abrir-edicao-nota').forEach(b => b.addEventListener('click', (e) => { const m=e.currentTarget.getAttribute('data-mod'); document.getElementById(`view-${disciplina}-${m}`).style.display='none'; document.getElementById(`edit-${disciplina}-${m}`).style.display='flex'; }));
    listaModulosUI.querySelectorAll('.btn-fechar-edicao-nota').forEach(b => b.addEventListener('click', (e) => { const m=e.currentTarget.getAttribute('data-mod'); document.getElementById(`view-${disciplina}-${m}`).style.display='flex'; document.getElementById(`edit-${disciplina}-${m}`).style.display='none'; }));
    
    // Lógica de Seleção da Nota na Grelha
    let notaSelecionadaTemporaria = {}; // Objeto para guardar a nota clicada antes do OK
    listaModulosUI.querySelectorAll('.grade-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gridPai = e.currentTarget.parentElement;
            gridPai.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected');
            const modId = gridPai.id.split('-')[2]; // Ex: grid-PORT-M1
            notaSelecionadaTemporaria[modId] = e.currentTarget.getAttribute('data-val');
        });
    });

    // Lógica do OK (Gravar)
    listaModulosUI.querySelectorAll('.btn-gravar-nota').forEach(b => b.addEventListener('click', async (e) => {
        const d = e.currentTarget.getAttribute('data-disc'); const m = e.currentTarget.getAttribute('data-mod'); 
        const v = notaSelecionadaTemporaria[m];
        if(!v) return; // Não escolheu nota
        
        e.currentTarget.innerText = "A gravar...";
        try { 
            const valorDb = v === "REP" ? "REP" : Number(v);
            await setDoc(doc(db, "utilizadores", alunoAtualId, "notas", `${d}_${m}`), { disciplina: d, modulo: m, nota: valorDb, data: new Date().toISOString() });
            
            const badge = document.getElementById(`badge-${d}-${m}`); badge.innerText = v; 
            badge.className = `nota-badge ${v === "REP" ? "rep" : ""}`; // Reseta classes
            
            // Fecha Imediatamente!
            e.currentTarget.innerText = "OK (Gravar)";
            document.getElementById(`view-${d}-${m}`).style.display='flex'; document.getElementById(`edit-${d}-${m}`).style.display='none';
            notaSelecionadaTemporaria[m] = null; // Limpa memória
        } catch(err){}
    }));
}

// 4. INFORMAÇÕES (Com Edição Reparada - Abre Logo)
document.querySelectorAll('.btn-fechar-modal').forEach(b => b.addEventListener('click', () => { document.getElementById('modal-telefone').style.display='none'; document.getElementById('modal-email').style.display='none'; }));
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('clickable-contact')) {
        const tipo = e.target.getAttribute('data-type'); const valor = e.target.innerText; if(valor === "-" || valor === "") return;
        nomePessoaContactoModal = e.target.id.includes('aluno') ? document.getElementById('detail-student-name').innerText : (document.getElementById('display-ee-nome').innerText || "Enc. Educação");
        window.contactoTemp = valor;
        if (tipo === 'tel') { document.getElementById('action-ligar').href = `tel:${valor}`; document.getElementById('modal-telefone').style.display = 'flex'; } 
        else if (tipo === 'email') { document.getElementById('action-enviar-email').href = `mailto:${valor}`; document.getElementById('modal-email').style.display = 'flex'; }
    }
});
document.getElementById('action-guardar-vcard')?.addEventListener('click', () => {
    const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${nomePessoaContactoModal}\nTEL:${window.contactoTemp}\nEND:VCARD`;
    const blob = new Blob([vcard], { type: 'text/vcard' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${nomePessoaContactoModal.replace(/\s+/g,'_')}.vcf`;
    document.body.appendChild(link); link.click(); document.body.removeChild(link); document.getElementById('modal-telefone').style.display = 'none';
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

// Removidos os confirms chatos nas Informações
document.getElementById('btn-editar-info-aluno').addEventListener('click', () => { document.getElementById('info-aluno-display').style.display='none'; document.getElementById('info-aluno-edit').style.display='block'; });
document.getElementById('btn-editar-info-ee').addEventListener('click', () => { document.getElementById('info-ee-display').style.display='none'; document.getElementById('info-ee-edit').style.display='block'; });
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

// 5. PRHF (Protegido e Matemático)
const selDisc = document.getElementById('prhf-disciplina'); const selMod = document.getElementById('prhf-modulo');
let optDisc = '<option value="">Disc.</option>'; for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) optDisc += `<option value="${d}">${d}</option>`; } selDisc.innerHTML = optDisc;
selDisc.addEventListener('change', (e) => { const d = e.target.value; let mods = []; for(const comp of Object.values(matrizCurso)) { if(comp[d]) mods = comp[d]; } let optMod = '<option value="">Mod.</option>'; mods.forEach(m => optMod += `<option value="${m}">${m}</option>`); selMod.innerHTML = optMod; });

let tabAtiva = 'ativas'; const modalFolha = document.getElementById('modal-prhf-sheet');

if(document.getElementById('btn-hub-prhf')) {
    document.getElementById('btn-hub-prhf').addEventListener('click', () => { esconderTudoMenos(viewPrhf); tabAtiva = 'ativas'; document.getElementById('tab-prhf-ativas').classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId); });
}

document.getElementById('tab-prhf-ativas').addEventListener('click', (e) => { tabAtiva = 'ativas'; e.currentTarget.classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId); });
document.getElementById('tab-prhf-concluidas').addEventListener('click', (e) => { tabAtiva = 'concluidas'; e.currentTarget.classList.add('active'); document.getElementById('tab-prhf-ativas').classList.remove('active'); carregarListaPRHF(alunoAtualId); });

document.getElementById('btn-guardar-prhf').addEventListener('click', async (e) => {
    const disc = selDisc.value; const mod = selMod.value; const prazo = document.getElementById('prhf-prazo').value; const desc = document.getElementById('prhf-descricao').value.trim(); const htInput = document.getElementById('prhf-horas').value;
    if(!disc || !mod || !prazo || !desc || !htInput) return alert("Preenche todos os campos!");
    
    const hT = parseInt(htInput); let hP = 0; if(hT > 4) hP = Math.ceil(hT * 0.3); const hN = hT - hP; // P = 30%, N = 70%

    e.currentTarget.innerText = "A gravar...";
    try {
        await addDoc(collection(db, "utilizadores", alunoAtualId, "prhfs"), { disciplina: disc, modulo: mod, prazo: prazo, descricao: desc, horasNaoPresenciais: hN, horasPresenciais: hP, status: 'ativa', dataRegisto: new Date().toISOString(), registosManuais: [] });
        selDisc.value = ""; selMod.value = ""; document.getElementById('prhf-prazo').value = ""; document.getElementById('prhf-descricao').value = ""; document.getElementById('prhf-horas').value = "";
        tabAtiva = 'ativas'; document.getElementById('tab-prhf-ativas').classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId);
    } catch (err) {} e.currentTarget.innerText = "Gravar Tarefa";
});

let prhfsMemoria = [];
async function carregarListaPRHF(idAluno) {
    const container = document.getElementById('lista-prhf-container'); container.innerHTML = '<p class="text-muted">A carregar...</p>'; prhfsMemoria = [];
    try {
        const res = await getDocs(query(collection(db, "utilizadores", idAluno, "prhfs"))); let html = '';
        res.forEach(doc => {
            const data = doc.data(); data.id = doc.id;
            if ((tabAtiva === 'ativas' && data.status === 'ativa') || (tabAtiva === 'concluidas' && data.status === 'concluida')) {
                prhfsMemoria.push(data); const classeCor = data.status === 'ativa' ? 'ativa' : 'concluida'; const sM = (data.modulo||"").includes('M') ? data.modulo : 'M'+data.modulo; 
                html += `<div class="prhf-mini-card ${classeCor}" data-id="${data.id}"><strong>${data.disciplina}_${sM}</strong><i class="fa-solid fa-chevron-right" style="color:var(--text-muted); font-size:0.8rem;"></i></div>`;
            }
        });
        if (html === '') { container.innerHTML = `<p class="text-muted">Sem tarefas ${tabAtiva}.</p>`; return; }
        container.innerHTML = html;
        container.querySelectorAll('.prhf-mini-card').forEach(card => card.addEventListener('click', (e) => abrirFolhaPRHF(e.currentTarget.getAttribute('data-id'))));
    } catch (err) {}
}

function desenharRegistosManuais(plano) {
    const container = document.getElementById('lista-presencias-manuais');
    if(!plano.registosManuais || plano.registosManuais.length === 0) { container.innerHTML = ""; return; }
    let h = "<p style='margin-bottom:5px;'><strong>Já Registadas:</strong></p>";
    plano.registosManuais.forEach(r => h += `<div class="registo-item"><span>${r.data}</span><span>${r.inicio} - ${r.fim}</span></div>`);
    container.innerHTML = h;
}

function abrirFolhaPRHF(id) {
    const p = prhfsMemoria.find(x => x.id === id); if(!p) return;
    idPrhfAtivo = id; 
    const sM = (p.modulo||"").includes('M') ? p.modulo : 'M'+p.modulo;
    const dp = (p.prazo||"").split('-'); const dF = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : p.prazo;
    
    document.getElementById('sheet-title').innerText = `${p.disciplina}_${sM}`; document.getElementById('sheet-prazo').innerText = dF;
    document.getElementById('sheet-hp').innerText = p.horasPresenciais; document.getElementById('sheet-ha').innerText = p.horasNaoPresenciais;
    document.getElementById('sheet-desc').innerText = p.descricao;
    
    const badge = document.getElementById('sheet-status'); badge.innerText = p.status.toUpperCase(); badge.className = `paper-status ${p.status}`;
    
    const txtCal = p.prazo ? (p.prazo.replace(/-/g, '') + 'T090000Z/' + p.prazo.replace(/-/g, '') + 'T100000Z') : ""; 
    document.getElementById('sheet-btn-agendar').href = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=Apoio+${p.disciplina}&details=Aluno:+${document.getElementById('detail-student-name').innerText}%0AHoras:+${p.horasPresenciais}h%0A${p.descricao}&dates=${txtCal}`;

    if (p.status === 'concluida') {
        document.getElementById('sheet-btn-concluir').style.display = 'none';
        document.getElementById('sheet-btn-reverter').style.display = 'flex'; // Reverter!
        document.getElementById('sheet-btn-agendar').style.display = 'none'; // Esconde Agenda
        document.getElementById('sheet-btn-toggle-manual').style.display = 'none';
        document.getElementById('manual-presence-box').style.display = 'none';
    } else {
        document.getElementById('sheet-btn-concluir').style.display = 'flex';
        document.getElementById('sheet-btn-reverter').style.display = 'none';
        document.getElementById('sheet-btn-agendar').style.display = 'flex';
        document.getElementById('sheet-btn-toggle-manual').style.display = 'flex';
        document.getElementById('manual-presence-box').style.display = 'none'; 
    }
    
    desenharRegistosManuais(p);
    modalFolha.style.display = 'flex';
}
document.querySelector('.btn-close-paper').addEventListener('click', () => modalFolha.style.display = 'none');

document.getElementById('sheet-btn-toggle-manual').addEventListener('click', () => {
    const box = document.getElementById('manual-presence-box'); box.style.display = box.style.display === 'none' ? 'block' : 'none';
});

document.getElementById('btn-save-manual-pres').addEventListener('click', async (e) => {
    const d = document.getElementById('reg-pres-data').value; const i = document.getElementById('reg-pres-inicio').value; const f = document.getElementById('reg-pres-fim').value;
    if(!d || !i || !f) return alert("Preenche Data, Início e Fim!");
    e.currentTarget.innerText = "A gravar...";
    try {
        const novoRegisto = { data: d, inicio: i, fim: f };
        await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { registosManuais: arrayUnion(novoRegisto) });
        document.getElementById('reg-pres-data').value = ""; document.getElementById('reg-pres-inicio').value = ""; document.getElementById('reg-pres-fim').value = "";
        const p = prhfsMemoria.find(x => x.id === idPrhfAtivo); if(!p.registosManuais) p.registosManuais = []; p.registosManuais.push(novoRegisto); desenharRegistosManuais(p);
    } catch(err){} e.currentTarget.innerText = "Guardar Registo";
});

document.getElementById('sheet-btn-concluir').addEventListener('click', async (e) => {
    if(!confirm("Marcar como CONCLUÍDO?")) return; e.currentTarget.innerText = "A validar...";
    try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { status: 'concluida' }); modalFolha.style.display = 'none'; carregarListaPRHF(alunoAtualId); } catch(err){}
});
document.getElementById('sheet-btn-reverter').addEventListener('click', async (e) => {
    if(!confirm("REVERTER para ATIVA?")) return; e.currentTarget.innerText = "A reverter...";
    try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { status: 'ativa' }); modalFolha.style.display = 'none'; carregarListaPRHF(alunoAtualId); } catch(err){}
});

// 6. MOTOR DE FALTAS (O Início)
if(document.getElementById('btn-hub-faltas')) {
    document.getElementById('btn-hub-faltas').addEventListener('click', () => { esconderTudoMenos(viewFaltas); construirMatrizVisual(document.getElementById('matriz-faltas-container'), abrirModulosDisciplinaFaltas); });
}

async function abrirModulosDisciplinaFaltas(disciplina) {
    esconderTudoMenos(viewFaltasModulos); document.getElementById('titulo-falta-disciplina').innerText = disciplina;
    const container = document.getElementById('lista-faltas-disciplina'); container.innerHTML = '<p class="text-muted">A preparar faltas...</p>';
    
    // Futura integração com Base de Dados para Faltas ficará aqui! 
    let html = `<p class="text-muted" style="margin-bottom:15px;">Motor de Gestão de Faltas (10%) pronto a arrancar no próximo passo!</p>`;
    
    let modulosArray = []; for (const comp of Object.values(matrizCurso)) { if (comp[disciplina]) modulosArray = comp[disciplina]; }
    modulosArray.forEach(mod => {
        html += `
        <div style="background:var(--bg-dark); padding:15px; border-radius:8px; border:1px solid #333; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;">
                <strong>${mod}</strong><span class="falta-badge" id="badge-falta-${mod}">0 / ?</span>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center;">
                <input type="number" placeholder="Tot. Aulas" style="width:100px; margin:0; padding:8px;">
                <div style="display:flex; gap:5px;">
                    <button class="secondary-btn small-btn">-</button><button class="primary-btn small-btn">+</button>
                </div>
            </div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:0%;"></div></div>
        </div>`;
    });
    container.innerHTML = html;
}
