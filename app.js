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

// MATRIZ ATUALIZADA (Agora com as horas de cada módulo para auto-preenchimento!)
const matrizCurso = {
    "Sociocultural": { "PORT": {"M1": 27, "M2": 24, "M3": 27}, "ING": {"M1": 24, "M2": 24, "M3": 24}, "AI": {"M1": 30, "M2": 30}, "EF": {"M1": 20, "M2": 20, "M3": 20, "M4": 20, "M5": 20}, "TIC": {"M1": 24, "M2": 24, "M3": 27, "M4": 24} },
    "Científica": { "GEO": {"M1": 27, "M2": 24}, "HCA": {"M1": 24, "M2": 24, "M3": 27}, "MAT": {"M1": 30, "M2": 30, "M3": 30} },
    "Técnica": { "CF": {"M1": 30, "M2": 30, "M3": 30}, "TIAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "TCAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "OTET": {"M1": 25, "M2": 25, "M3": 25, "M4": 25} }
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

// 3. AVALIAÇÕES (C/ Motivo para o REP)
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
    const notasMapa = {}; try { const qNotas = await getDocs(collection(db, "utilizadores", alunoAtualId, "notas")); qNotas.forEach(d => { if (d.data().disciplina === disciplina) { notasMapa[d.data().modulo] = d.data().nota; notasMapa[d.data().modulo + "_motivo"] = d.data().motivoRep; } }); } catch(e){}
    let modulosArray = []; for (const comp of Object.values(matrizCurso)) { if (comp[disciplina]) modulosArray = Object.keys(comp[disciplina]); }
    
    let gridBtns = ""; for(let i=10; i<=20; i++) { gridBtns += `<button class="grade-btn" data-val="${i}">${i}</button>`; } gridBtns += `<button class="grade-btn rep" data-val="REP">REP</button>`;

    let html = "";
    modulosArray.forEach(mod => {
        const nEx = notasMapa[mod] !== undefined ? notasMapa[mod] : "SN"; 
        let classeBadge = ""; if(nEx === "SN") classeBadge = "sn"; else if(nEx === "REP") classeBadge = "rep";
        const txtMotivo = (nEx === "REP" && notasMapa[mod+"_motivo"]) ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:5px;"><i>Motivo: ${notasMapa[mod+"_motivo"]}</i></div>` : "";

        html += `<div class="modulo-avaliar-item" style="display:flex; flex-direction:column;">
            <div class="mod-view" id="view-${disciplina}-${mod}" style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                <div><strong>${mod}</strong>${txtMotivo}</div>
                <div style="display:flex; align-items:center; gap:15px;"><span class="nota-badge ${classeBadge}" id="badge-${disciplina}-${mod}">${nEx}</span><button class="secondary-btn small-btn btn-abrir-edicao-nota" data-mod="${mod}"><i class="fa-solid fa-pen"></i></button></div>
            </div>
            <div class="mod-edit" id="edit-${disciplina}-${mod}" style="display:none; flex-direction:column; width:100%;">
                <div class="grade-grid" id="grid-${disciplina}-${mod}">${gridBtns}</div>
                <div id="rep-reason-box-${disciplina}-${mod}" style="display:none; width:100%; margin-bottom:10px;"><input type="text" id="input-reason-${disciplina}-${mod}" placeholder="Motivo do REP (Opc. Ex: Falta de Teste)" style="margin:0; padding:8px; font-size:0.9rem;"></div>
                <div style="display:flex; gap:10px;"><button class="primary-btn small-btn btn-gravar-nota" data-disc="${disciplina}" data-mod="${mod}" style="flex:1;">OK (Gravar)</button><button class="secondary-btn small-btn btn-fechar-edicao-nota" data-mod="${mod}" style="flex:1;">Cancelar</button></div>
            </div>
        </div>`;
    });
    listaModulosUI.innerHTML = html;
    
    listaModulosUI.querySelectorAll('.btn-abrir-edicao-nota').forEach(b => b.addEventListener('click', (e) => { const m=e.currentTarget.getAttribute('data-mod'); document.getElementById(`view-${disciplina}-${m}`).style.display='none'; document.getElementById(`edit-${disciplina}-${m}`).style.display='flex'; }));
    listaModulosUI.querySelectorAll('.btn-fechar-edicao-nota').forEach(b => b.addEventListener('click', (e) => { const m=e.currentTarget.getAttribute('data-mod'); document.getElementById(`view-${disciplina}-${m}`).style.display='flex'; document.getElementById(`edit-${disciplina}-${m}`).style.display='none'; }));
    
    let notaSelecionadaTemporaria = {};
    listaModulosUI.querySelectorAll('.grade-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const gridPai = e.currentTarget.parentElement; gridPai.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected'));
            e.currentTarget.classList.add('selected'); const modId = gridPai.id.split('-')[2]; const discId = gridPai.id.split('-')[1];
            const v = e.currentTarget.getAttribute('data-val');
            notaSelecionadaTemporaria[modId] = v;
            // Se for REP abre a caixa de motivo
            document.getElementById(`rep-reason-box-${discId}-${modId}`).style.display = v === "REP" ? "block" : "none";
        });
    });

    listaModulosUI.querySelectorAll('.btn-gravar-nota').forEach(b => b.addEventListener('click', async (e) => {
        const d = e.currentTarget.getAttribute('data-disc'); const m = e.currentTarget.getAttribute('data-mod'); const v = notaSelecionadaTemporaria[m];
        if(!v) return; 
        const btnRef = e.currentTarget; btnRef.innerText = "A gravar...";
        try { 
            const valorDb = v === "REP" ? "REP" : Number(v);
            const motivo = v === "REP" ? document.getElementById(`input-reason-${d}-${m}`).value : "";
            await setDoc(doc(db, "utilizadores", alunoAtualId, "notas", `${d}_${m}`), { disciplina: d, modulo: m, nota: valorDb, motivoRep: motivo, data: new Date().toISOString() });
            btnRef.innerText = "Gravado!";
            setTimeout(() => { btnRef.innerText = "OK (Gravar)"; abrirModulosDisciplinaAvaliacao(d); }, 800); // Recarrega para mostrar motivo
        } catch(err){ btnRef.innerText = "Erro!"; }
    }));
}

// 4. INFORMAÇÕES (Sem Confirms chatos)
document.getElementById('btn-editar-info-aluno')?.addEventListener('click', () => { document.getElementById('info-aluno-display').style.display='none'; document.getElementById('info-aluno-edit').style.display='block'; });
document.getElementById('btn-editar-info-ee')?.addEventListener('click', () => { document.getElementById('info-ee-display').style.display='none'; document.getElementById('info-ee-edit').style.display='block'; });
document.getElementById('btn-cancelar-aluno')?.addEventListener('click', () => { document.getElementById('info-aluno-display').style.display='block'; document.getElementById('info-aluno-edit').style.display='none'; });
document.getElementById('btn-cancelar-ee')?.addEventListener('click', () => { document.getElementById('info-ee-display').style.display='block'; document.getElementById('info-ee-edit').style.display='none'; });

// 5. PRHF (Dropdown Inteligente e Lógica de Progresso)
const selDisc = document.getElementById('prhf-disciplina'); const selMod = document.getElementById('prhf-modulo');
let optDisc = '<option value="">Disc.</option>'; for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) optDisc += `<option value="${d}">${d}</option>`; } selDisc.innerHTML = optDisc;
const optDiscFilter = '<option value="">Todas as Disciplinas</option>' + optDisc; document.getElementById('filtro-prhf-disc').innerHTML = optDiscFilter;

selDisc.addEventListener('change', (e) => { 
    const d = e.target.value; let modsObj = {}; 
    for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } 
    let optMod = '<option value="">Mod.</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); selMod.innerHTML = optMod; 
});
// Preencher horas auto!
selMod.addEventListener('change', (e) => {
    const d = selDisc.value; const m = e.target.value;
    for(const comp of Object.values(matrizCurso)) { if(comp[d] && comp[d][m]) document.getElementById('prhf-horas').value = comp[d][m]; }
});

let tabAtiva = 'ativas'; const modalFolha = document.getElementById('modal-prhf-sheet');

if(document.getElementById('btn-hub-prhf')) {
    document.getElementById('btn-hub-prhf').addEventListener('click', () => { esconderTudoMenos(viewPrhf); tabAtiva = 'ativas'; document.getElementById('tab-prhf-ativas').classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId); });
}
document.getElementById('tab-prhf-ativas').addEventListener('click', (e) => { tabAtiva = 'ativas'; e.currentTarget.classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId); });
document.getElementById('tab-prhf-concluidas').addEventListener('click', (e) => { tabAtiva = 'concluidas'; e.currentTarget.classList.add('active'); document.getElementById('tab-prhf-ativas').classList.remove('active'); carregarListaPRHF(alunoAtualId); });
document.getElementById('filtro-prhf-disc').addEventListener('change', () => carregarListaPRHF(alunoAtualId));

document.getElementById('btn-guardar-prhf').addEventListener('click', async (e) => {
    const disc = selDisc.value; const mod = selMod.value; const prazo = document.getElementById('prhf-prazo').value; const desc = document.getElementById('prhf-descricao').value.trim(); const htInput = document.getElementById('prhf-horas').value;
    const isTerminado = document.getElementById('prhf-modulo-terminado').checked;
    if(!disc || !mod || !prazo || !desc || !htInput) return alert("Preenche todos os campos!");
    
    // Matemática: Presenciais = 30%, Autónomas = 70%
    const hT = parseInt(htInput); 
    const hP = hT > 4 ? Math.ceil(hT * 0.3) : 0; 
    const hN = hT - hP;

    const btnRef = e.currentTarget; btnRef.innerText = "A gravar...";
    try {
        await addDoc(collection(db, "utilizadores", alunoAtualId, "prhfs"), { disciplina: disc, modulo: mod, prazo: prazo, descricao: desc, horasNaoPresenciais: hN, horasPresenciais: hP, moduloTerminado: isTerminado, status: 'ativa', dataRegisto: new Date().toISOString(), registosManuais: [] });
        selDisc.value = ""; selMod.value = ""; document.getElementById('prhf-prazo').value = ""; document.getElementById('prhf-descricao').value = ""; document.getElementById('prhf-horas').value = ""; document.getElementById('prhf-modulo-terminado').checked = false;
        
        btnRef.innerText = "Gravado!"; setTimeout(() => { btnRef.innerText = "Processar e Gravar"; }, 1000);
        tabAtiva = 'ativas'; document.getElementById('tab-prhf-ativas').classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId);
    } catch (err) { btnRef.innerText = "Erro!"; } 
});

let prhfsMemoria = [];
async function carregarListaPRHF(idAluno) {
    const container = document.getElementById('lista-prhf-container'); container.innerHTML = '<p class="text-muted">A carregar...</p>'; prhfsMemoria = [];
    const filtroDisc = document.getElementById('filtro-prhf-disc').value;
    try {
        const res = await getDocs(query(collection(db, "utilizadores", idAluno, "prhfs"))); let html = '';
        res.forEach(doc => {
            const data = doc.data(); data.id = doc.id;
            if (filtroDisc !== "" && data.disciplina !== filtroDisc) return; // Aplica Filtro
            if ((tabAtiva === 'ativas' && data.status === 'ativa') || (tabAtiva === 'concluidas' && data.status === 'concluida')) {
                prhfsMemoria.push(data); 
                let classeCor = 'concluida';
                if(data.status === 'ativa') classeCor = data.moduloTerminado ? 'ativa-terminado' : 'ativa-decorrer'; // Vermelho ou Amarelo!
                
                const sM = (data.modulo||"").includes('M') ? data.modulo : 'M'+data.modulo; 
                html += `<div class="prhf-mini-card ${classeCor}" data-id="${data.id}"><strong>${data.disciplina}_${sM}</strong><i class="fa-solid fa-chevron-right" style="color:var(--text-muted); font-size:0.8rem;"></i></div>`;
            }
        });
        if (html === '') { container.innerHTML = `<p class="text-muted">Sem tarefas ${tabAtiva}.</p>`; return; }
        container.innerHTML = html;
        container.querySelectorAll('.prhf-mini-card').forEach(card => card.addEventListener('click', (e) => abrirFolhaPRHF(e.currentTarget.getAttribute('data-id'))));
    } catch (err) {}
}

function calcularDiferencaHorasInteiras(inicio, fim) {
    const [hI, mI] = inicio.split(':').map(Number); const [hF, mF] = fim.split(':').map(Number);
    let diff = (hF + mF/60) - (hI + mI/60);
    return diff > 0 ? Math.floor(diff) : 0; // Arredonda sempre para baixo e sem decimais!
}

function desenharRegistosManuais(plano) {
    const container = document.getElementById('lista-presencias-manuais'); let totalRealizado = 0;
    if(!plano.registosManuais || plano.registosManuais.length === 0) { container.innerHTML = ""; } else {
        let h = "<p style='margin-bottom:5px;'><strong>Já Registadas:</strong></p>";
        plano.registosManuais.forEach((r, idx) => {
            totalRealizado += r.horas;
            h += `<div class="registo-item"><span>${r.data} (${r.inicio} - ${r.fim}) [${r.horas}h]</span><i class="fa-solid fa-trash registo-item-del" data-idx="${idx}"></i></div>`;
        });
        container.innerHTML = h;
        container.querySelectorAll('.registo-item-del').forEach(icon => {
            icon.addEventListener('click', async (e) => {
                if(!confirm("Apagar este registo?")) return;
                const indexToRemove = e.currentTarget.getAttribute('data-idx'); const novaLista = [...plano.registosManuais]; novaLista.splice(indexToRemove, 1);
                try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { registosManuais: novaLista }); plano.registosManuais = novaLista; desenharRegistosManuais(plano); } catch(err) {}
            });
        });
    }

    document.getElementById('sheet-horas-feitas').innerText = totalRealizado; document.getElementById('sheet-horas-totais').innerText = plano.horasPresenciais;
    
    const btnConcluir = document.getElementById('sheet-btn-concluir');
    const progressFill = document.getElementById('sheet-btn-progress-fill');
    const progressText = document.getElementById('sheet-btn-progress-text');
    const txtRegisto = document.getElementById('txt-btn-registo');

    // Cálculos da Barra de Progresso do Botão!
    let perc = plano.horasPresenciais > 0 ? Math.min((totalRealizado / plano.horasPresenciais) * 100, 100) : 100;
    progressFill.style.width = `${perc}%`;
    progressText.innerHTML = `<i class="fa-solid fa-check"></i> Concluído (${Math.floor(perc)}%)`;

    if(totalRealizado >= plano.horasPresenciais && plano.horasPresenciais > 0) {
        btnConcluir.classList.add('ready'); btnConcluir.disabled = false; txtRegisto.innerText = "Retificar Presenciais";
    } else {
        btnConcluir.classList.remove('ready'); btnConcluir.disabled = true; txtRegisto.innerText = "Registar Presenciais";
    }
}

function abrirFolhaPRHF(id) {
    const p = prhfsMemoria.find(x => x.id === id); if(!p) return;
    idPrhfAtivo = id; 
    const sM = (p.modulo||"").includes('M') ? p.modulo : 'M'+p.modulo;
    const dp = (p.prazo||"").split('-'); const dF = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : p.prazo;
    
    document.getElementById('sheet-title').innerText = `${p.disciplina}_${sM}`; document.getElementById('sheet-prazo').innerText = dF;
    document.getElementById('sheet-hp').innerText = p.horasPresenciais; document.getElementById('sheet-ha').innerText = p.horasNaoPresenciais;
    document.getElementById('sheet-desc').innerText = p.descricao;
    
    const badge = document.getElementById('sheet-status'); badge.innerText = p.status.toUpperCase(); 
    if(p.status === 'ativa') badge.className = `paper-status ${p.moduloTerminado ? 'ativa-terminado' : 'ativa-decorrer'}`; else badge.className = `paper-status concluida`;

    if (p.status === 'concluida') {
        document.getElementById('sheet-btn-concluir').style.display = 'none';
        document.getElementById('sheet-btn-reverter').style.display = 'flex';
        document.getElementById('sheet-btn-toggle-manual').style.display = 'none';
        document.getElementById('manual-presence-box').style.display = 'none';
    } else {
        document.getElementById('sheet-btn-concluir').style.display = 'block';
        document.getElementById('sheet-btn-reverter').style.display = 'none';
        document.getElementById('sheet-btn-toggle-manual').style.display = 'flex';
        document.getElementById('manual-presence-box').style.display = 'none'; 
    }
    
    desenharRegistosManuais(p); modalFolha.style.display = 'flex';
}
document.querySelector('.btn-close-paper').addEventListener('click', () => modalFolha.style.display = 'none');

document.getElementById('sheet-btn-toggle-manual').addEventListener('click', () => { const box = document.getElementById('manual-presence-box'); box.style.display = box.style.display === 'none' ? 'block' : 'none'; });

document.getElementById('btn-save-manual-pres').addEventListener('click', async (e) => {
    const d = document.getElementById('reg-pres-data').value; const i = document.getElementById('reg-pres-inicio').value; const f = document.getElementById('reg-pres-fim').value;
    if(!d || !i || !f) return alert("Preenche Data, Início e Fim!");
    const horasCalc = calcularDiferencaHorasInteiras(i, f);
    if(horasCalc <= 0) return alert("A hora de fim tem de ter pelo menos 1h de diferença arredondada!");

    const btnRef = e.currentTarget; btnRef.innerText = "A gravar...";
    try {
        const nR = { data: d, inicio: i, fim: f, horas: horasCalc };
        const p = prhfsMemoria.find(x => x.id === idPrhfAtivo); const novaLista = p.registosManuais ? [...p.registosManuais, nR] : [nR];
        await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { registosManuais: novaLista });
        document.getElementById('reg-pres-data').value = ""; document.getElementById('reg-pres-inicio').value = ""; document.getElementById('reg-pres-fim').value = "";
        p.registosManuais = novaLista; desenharRegistosManuais(p);
        btnRef.innerText = "Gravado!"; setTimeout(() => btnRef.innerText = "Guardar Registo", 1000);
    } catch(err){ btnRef.innerText = "Erro!"; } 
});

document.getElementById('sheet-btn-concluir').addEventListener('click', async () => {
    if(!confirm("Marcar como CONCLUÍDO?")) return;
    try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { status: 'concluida' }); modalFolha.style.display = 'none'; carregarListaPRHF(alunoAtualId); } catch(err){}
});
document.getElementById('sheet-btn-reverter').addEventListener('click', async (e) => {
    if(!confirm("REVERTER para ATIVA?")) return; e.currentTarget.innerText = "A reverter...";
    try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { status: 'ativa' }); modalFolha.style.display = 'none'; carregarListaPRHF(alunoAtualId); } catch(err){}
});

// 6. MOTOR DE FALTAS (Esqueleto com Filtros Pronto!)
if(document.getElementById('btn-hub-faltas')) {
    document.getElementById('btn-hub-faltas').addEventListener('click', () => { 
        esconderTudoMenos(viewFaltas); 
        document.getElementById('tab-faltas-disciplina').classList.add('active'); document.getElementById('tab-faltas-data').classList.remove('active');
        document.getElementById('faltas-container-disciplina').style.display = 'block'; document.getElementById('faltas-container-data').style.display = 'none';
        construirMatrizVisual(document.getElementById('faltas-container-disciplina'), abrirModulosDisciplinaFaltas); 
    });
}
document.getElementById('tab-faltas-disciplina').addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-faltas-data').classList.remove('active'); document.getElementById('faltas-container-disciplina').style.display = 'block'; document.getElementById('faltas-container-data').style.display = 'none'; });
document.getElementById('tab-faltas-data').addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-faltas-disciplina').classList.remove('active'); document.getElementById('faltas-container-disciplina').style.display = 'none'; document.getElementById('faltas-container-data').style.display = 'block'; });

async function abrirModulosDisciplinaFaltas(disciplina) {
    esconderTudoMenos(viewFaltasModulos); document.getElementById('titulo-falta-disciplina').innerText = disciplina;
    document.getElementById('lista-faltas-disciplina').innerHTML = `<p class="text-muted" style="margin-bottom:15px;">Em desenvolvimento no próximo passo...</p>`;
}
