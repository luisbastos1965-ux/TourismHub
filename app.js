import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-app.js";
import { getAuth, signInWithEmailAndPassword, onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { getFirestore, doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, addDoc, deleteDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
    "Sociocultural": { "PORT": {"M1": 27, "M2": 24, "M3": 27}, "ING": {"M1": 24, "M2": 24, "M3": 24}, "AI": {"M1": 30, "M2": 30}, "EF": {"M1": 20, "M2": 20, "M3": 20, "M4": 20, "M5": 20}, "TIC": {"M1": 24, "M2": 24, "M3": 27, "M4": 24} },
    "Científica": { "GEO": {"M1": 27, "M2": 24}, "HCA": {"M1": 24, "M2": 24, "M3": 27}, "MAT": {"M1": 30, "M2": 30, "M3": 30} },
    "Técnica": { "CF": {"M1": 30, "M2": 30, "M3": 30}, "TIAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "TCAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "OTET": {"M1": 25, "M2": 25, "M3": 25, "M4": 25} }
};

const loginScreen = document.getElementById('login-screen'); const appContent = document.getElementById('app-content');
const btnLoginManual = document.getElementById('btn-login-manual'); const btnLogout = document.getElementById('btn-logout');

const painelAluno = document.getElementById('student-dashboard'); const viewStudyMode = document.getElementById('view-study-mode');
const painelAdmin = document.getElementById('admin-dashboard'); const classHubView = document.getElementById('class-hub-view'); 
const classView = document.getElementById('class-view'); const studentDetailView = document.getElementById('student-detail-view'); 
const viewClassCalendario = document.getElementById('view-class-calendario'); const viewClassHorario = document.getElementById('view-class-horario');
const viewClassForum = document.getElementById('view-class-forum'); const viewClassEstatisticas = document.getElementById('view-class-estatisticas');
const viewAvaliacoes = document.getElementById('view-avaliacoes'); const viewDisciplinaModulos = document.getElementById('view-disciplina-modulos');
const viewInformacoes = document.getElementById('view-informacoes'); const viewPrhf = document.getElementById('view-prhf');
const viewFaltas = document.getElementById('view-faltas'); const viewFaltasModulos = document.getElementById('view-faltas-modulos');
const bottomNav = document.querySelector('.bottom-nav');

let alunoAtualId = ""; let turmaAtual = ""; let nomePessoaContactoModal = ""; let idPrhfAtivo = ""; 
let pdfBase64Temporario = ""; let pdfNomeTemporario = "";

function esconderTudoMenos(ecraAtivo) {
    [classHubView, classView, studentDetailView, viewAvaliacoes, viewDisciplinaModulos, viewInformacoes, viewPrhf, viewFaltas, viewFaltasModulos, painelAluno, viewStudyMode, viewClassCalendario, viewClassHorario, viewClassForum, viewClassEstatisticas].forEach(el => { if(el) el.style.display = 'none'; });
    if(ecraAtivo) ecraAtivo.style.display = 'block';
}

// 1. Autenticação e Gamificação Aluno
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", userId));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                document.getElementById('header-user-name').innerText = `Olá, ${dados.nome} (${dados.papel.toUpperCase()})`;
                if(dados.papel === 'admin') { 
                    painelAdmin.style.display = 'block'; bottomNav.style.display = 'none'; esconderTudoMenos(null); 
                } else { 
                    document.getElementById('lms-welcome-name').innerText = `Olá, ${dados.nome.split(' ')[0]}!`; 
                    painelAdmin.style.display = 'none'; bottomNav.style.display = 'flex'; esconderTudoMenos(painelAluno); alunoAtualId = userId; 
                }
                loginScreen.style.display = 'none'; appContent.style.display = 'block'; 
            }
        } catch (e) { console.error(e); }
    } else { loginScreen.style.display = 'flex'; appContent.style.display = 'none'; }
});

btnLoginManual.addEventListener('click', () => {
    const user = document.getElementById('login-username').value.trim().toLowerCase();
    signInWithEmailAndPassword(auth, user + "@turmapro.com", document.getElementById('login-password').value).then(() => document.getElementById('login-error').style.display = 'none').catch(() => { document.getElementById('login-error').style.display = 'block'; document.getElementById('login-error').innerText = "Credenciais inválidas."; });
});
btnLogout.addEventListener('click', () => signOut(auth));

// 2. Navegação Geral
document.getElementById('btn-voltar-turmas-hub')?.addEventListener('click', () => { esconderTudoMenos(null); painelAdmin.style.display = 'block'; });
document.getElementById('btn-voltar-class-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));
document.getElementById('btn-voltar-lista')?.addEventListener('click', () => esconderTudoMenos(classView));
document.getElementById('btn-voltar-hub-avaliacoes')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-disciplinas')?.addEventListener('click', () => esconderTudoMenos(viewAvaliacoes));
document.getElementById('btn-voltar-hub-info')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-hub-prhf')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-hub-faltas')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-faltas-disc')?.addEventListener('click', () => esconderTudoMenos(viewFaltas));

document.getElementById('btn-lms-meu-perfil')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-open-study-mode')?.addEventListener('click', () => esconderTudoMenos(viewStudyMode));
document.getElementById('btn-voltar-study')?.addEventListener('click', () => esconderTudoMenos(painelAluno));

document.getElementById('btn-hub-calendario')?.addEventListener('click', () => { document.getElementById('title-cal-turma').innerText = `Calendário - ${turmaAtual}`; esconderTudoMenos(viewClassCalendario); carregarEventosCalendario(); });
document.getElementById('btn-voltar-cal-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));
document.getElementById('btn-hub-horario')?.addEventListener('click', () => { document.getElementById('title-horario-turma').innerText = `Horário - ${turmaAtual}`; esconderTudoMenos(viewClassHorario); carregarHorario(); });
document.getElementById('btn-voltar-horario-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));
document.getElementById('btn-hub-forum')?.addEventListener('click', () => { document.getElementById('title-forum-turma').innerText = `Fórum - ${turmaAtual}`; esconderTudoMenos(viewClassForum); });
document.getElementById('btn-voltar-forum-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));
document.getElementById('btn-hub-estatisticas')?.addEventListener('click', () => { document.getElementById('title-stats-turma').innerText = `Estatísticas - ${turmaAtual}`; esconderTudoMenos(viewClassEstatisticas); });
document.getElementById('btn-voltar-stats-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));

document.querySelectorAll('.turma-card-large').forEach(botao => {
    botao.addEventListener('click', () => {
        turmaAtual = botao.getAttribute('data-turma'); painelAdmin.style.display = 'none'; 
        if(turmaAtual === 'TUR') { document.getElementById('class-title').innerHTML = `<i class="fa-solid fa-globe"></i> Turma TUR`; esconderTudoMenos(classView); carregarAlunos('TUR'); } 
        else { document.getElementById('class-hub-title').innerHTML = `Turma ${turmaAtual}`; esconderTudoMenos(classHubView); }
    });
});
document.getElementById('btn-hub-alunos')?.addEventListener('click', () => { document.getElementById('class-title').innerHTML = `<i class="fa-solid fa-users"></i> Turma ${turmaAtual}`; esconderTudoMenos(classView); carregarAlunos(turmaAtual); });

async function carregarAlunos(turmaEscolhida) {
    const container = document.querySelector('.students-list-container'); container.innerHTML = '<p class="text-muted">A carregar...</p>';
    try {
        const q = turmaEscolhida === 'TUR' ? query(collection(db, "utilizadores"), where("papel", "==", "aluno")) : query(collection(db, "utilizadores"), where("turma", "==", turmaEscolhida), where("papel", "==", "aluno"));
        const res = await getDocs(q); if (res.empty) { container.innerHTML = '<p class="text-muted">Sem alunos.</p>'; return; }
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
                const t = e.currentTarget.getAttribute('data-t') || "10T";
                const f = document.getElementById('btn-hub-fct'); const p = document.getElementById('btn-hub-pap');
                if (t.includes('10')) { f.classList.add('disabled-hub-card'); p.classList.add('disabled-hub-card'); } else if (t.includes('11')) { f.classList.remove('disabled-hub-card'); p.classList.add('disabled-hub-card'); } else { f.classList.remove('disabled-hub-card'); p.classList.remove('disabled-hub-card'); }
                esconderTudoMenos(studentDetailView); carregarFotoPerfil();
            });
        });
    } catch (e) {}
}

async function carregarFotoPerfil() {
    document.getElementById('avatar-img').style.display = 'none'; document.getElementById('avatar-icon').style.display = 'block';
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", alunoAtualId));
        if (docSnap.exists() && docSnap.data().fotoPerfil) { document.getElementById('avatar-img').src = docSnap.data().fotoPerfil; document.getElementById('avatar-img').style.display = 'block'; document.getElementById('avatar-icon').style.display = 'none'; }
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

// ==========================================
// 3. CALENDÁRIO DA TURMA E REFRESH AUTOMÁTICO
// ==========================================
document.getElementById('btn-abrir-modal-evento')?.addEventListener('click', () => {
    document.getElementById('modal-novo-evento').style.display = 'flex';
    let opt = '<option value="">Disciplina Relacionada (Opcional)</option>';
    for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) opt += `<option value="${d}">${d}</option>`; }
    document.getElementById('ev-disc').innerHTML = opt;
});
document.getElementById('btn-cancelar-evento')?.addEventListener('click', () => document.getElementById('modal-novo-evento').style.display = 'none');

document.getElementById('btn-gravar-evento')?.addEventListener('click', async (e) => {
    const titulo = document.getElementById('ev-titulo').value.trim(); const tipo = document.getElementById('ev-tipo').value;
    const data = document.getElementById('ev-data').value; const hora = document.getElementById('ev-hora').value; const disc = document.getElementById('ev-disc').value;
    if(!titulo || !data) return alert("Preenche Título e Data!");

    e.currentTarget.innerText = "A guardar...";
    try {
        await addDoc(collection(db, "turmas", turmaAtual, "eventos"), { titulo, tipo, data, hora, disciplina: disc, criadoEm: new Date().toISOString() });
        document.getElementById('modal-novo-evento').style.display = 'none';
        document.getElementById('ev-titulo').value = ""; document.getElementById('ev-data').value = "";
        e.currentTarget.innerText = "Criar Evento"; 
        carregarEventosCalendario(); // REFRESH AQUI
    } catch(err) { e.currentTarget.innerText = "Erro!"; }
});

async function carregarEventosCalendario() {
    const container = document.getElementById('lista-calendario-container'); container.innerHTML = '<p class="text-muted">A carregar eventos...</p>';
    try {
        const res = await getDocs(query(collection(db, "turmas", turmaAtual, "eventos")));
        if(res.empty) { container.innerHTML = '<p class="text-muted">Sem eventos agendados.</p>'; return; }

        let evs = []; res.forEach(d => evs.push(d.data()));
        const hoje = new Date().toISOString().split('T')[0];
        
        const futuros = evs.filter(e => e.data >= hoje).sort((a,b) => a.data.localeCompare(b.data));
        const passados = evs.filter(e => e.data < hoje).sort((a,b) => b.data.localeCompare(a.data));

        let html = ''; const mesArr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        
        function renderCard(ev, jaPassou) {
            let classeCard = "outro"; let badgeClass = "outro"; let badgeTexto = "OUTRO EVENTO";
            if(jaPassou) { classeCard = "concluido"; badgeClass = "concluido"; badgeTexto = "CONCLUÍDO"; } 
            else if(ev.tipo === 'teste') { classeCard = "teste"; badgeClass = "teste"; badgeTexto = "TESTE / FREQUÊNCIA"; } 
            else if (ev.tipo === 'avaliacao') { classeCard = "avaliacao"; badgeClass = "avaliacao"; badgeTexto = "AVALIAÇÃO / TRABALHO"; }
            const dp = ev.data.split('-'); const mesStr = dp.length === 3 ? mesArr[parseInt(dp[1])-1] : ''; const diaStr = dp.length === 3 ? dp[2] : '';
            const pDisc = ev.disciplina ? `<p><i class="fa-solid fa-book"></i> ${ev.disciplina} | ${ev.hora || '09:00'}</p>` : `<p><i class="fa-regular fa-clock"></i> ${ev.hora || '09:00'}</p>`;
            return `<div class="calendar-event-card ${classeCard}"><div class="calendar-date-box"><span class="day">${diaStr}</span><span class="month">${mesStr}</span></div><div class="calendar-info"><span class="badge-tipo-evento ${badgeClass}">${badgeTexto}</span><h4>${ev.titulo}</h4>${pDisc}</div></div>`;
        }

        futuros.forEach(e => html += renderCard(e, false));
        if(passados.length > 0) {
            html += `<div class="calendar-divider"><span>Eventos Passados</span></div>`;
            passados.forEach(e => html += renderCard(e, true));
        }
        container.innerHTML = html;
    } catch(err) { container.innerHTML = '<p class="text-muted" style="color:var(--danger-red);">Erro ao carregar calendário.</p>'; }
}


// ==========================================
// 3B. HORÁRIO DINÂMICO (Com a linha 13:00)
// ==========================================
let modoEdicaoHorario = false; let slotSelecionado = null;
document.getElementById('btn-editar-horario')?.addEventListener('click', (e) => {
    modoEdicaoHorario = true; e.currentTarget.style.display = 'none'; document.getElementById('btn-salvar-horario').style.display = 'flex';
    document.querySelectorAll('.horario-slot').forEach(slot => slot.classList.add('edit-mode'));
});
document.getElementById('btn-salvar-horario')?.addEventListener('click', (e) => {
    modoEdicaoHorario = false; e.currentTarget.style.display = 'none'; document.getElementById('btn-editar-horario').style.display = 'flex';
    document.querySelectorAll('.horario-slot').forEach(slot => slot.classList.remove('edit-mode'));
});

document.querySelectorAll('.horario-slot').forEach(slot => {
    slot.addEventListener('click', (e) => {
        if(!modoEdicaoHorario) return;
        slotSelecionado = e.currentTarget;
        let opt = '<option value="">Sem Aula (Limpar)</option>';
        for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) opt += `<option value="${d}">${d}</option>`; }
        document.getElementById('ed-horario-disc').innerHTML = opt;
        document.getElementById('modal-editar-horario').style.display = 'flex';
    });
});
document.getElementById('btn-cancelar-bloco-horario')?.addEventListener('click', () => document.getElementById('modal-editar-horario').style.display = 'none');
document.getElementById('btn-gravar-bloco-horario')?.addEventListener('click', async (e) => {
    if(!slotSelecionado) return;
    const novaDisc = document.getElementById('ed-horario-disc').value;
    const dia = slotSelecionado.getAttribute('data-dia'); const horaId = slotSelecionado.getAttribute('data-hora');
    e.currentTarget.innerText = "A guardar...";
    try {
        await updateDoc(doc(db, "turmas", turmaAtual), { [`horario.${dia}_${horaId}`]: novaDisc });
        slotSelecionado.innerHTML = novaDisc ? `<strong>${novaDisc}</strong>` : "";
        if(novaDisc) slotSelecionado.classList.add('filled'); else slotSelecionado.classList.remove('filled');
        document.getElementById('modal-editar-horario').style.display = 'none'; e.currentTarget.innerText = "Confirmar";
    } catch(err) {
        await setDoc(doc(db, "turmas", turmaAtual), { horario: { [`${dia}_${horaId}`]: novaDisc } }, {merge:true});
        slotSelecionado.innerHTML = novaDisc ? `<strong>${novaDisc}</strong>` : "";
        if(novaDisc) slotSelecionado.classList.add('filled'); else slotSelecionado.classList.remove('filled');
        document.getElementById('modal-editar-horario').style.display = 'none'; e.currentTarget.innerText = "Confirmar";
    }
});
async function carregarHorario() {
    document.querySelectorAll('.horario-slot').forEach(slot => { slot.innerHTML = ""; slot.classList.remove('filled'); });
    try {
        const docSnap = await getDoc(doc(db, "turmas", turmaAtual));
        if(docSnap.exists() && docSnap.data().horario) {
            const h = docSnap.data().horario;
            for(const key in h) {
                const [dia, hora] = key.split('_'); const slot = document.querySelector(`.horario-slot[data-dia="${dia}"][data-hora="${hora}"]`);
                if(slot && h[key]) { slot.innerHTML = `<strong>${h[key]}</strong>`; slot.classList.add('filled'); }
            }
        }
    } catch(err){}
}


// ==========================================
// 4. AVALIAÇÕES E PAUTA GLOBAL
// ==========================================
document.getElementById('btn-hub-avaliacoes')?.addEventListener('click', () => { esconderTudoMenos(viewAvaliacoes); construirMatrizVisual(document.getElementById('matriz-disciplinas-container'), abrirModulosDisciplinaAvaliacao); });
function construirMatrizVisual(containerEl, funcaoClique) {
    let html = ""; for (const [nomeComponente, disciplinas] of Object.entries(matrizCurso)) { html += `<div class="component-section"><div class="component-header">${nomeComponente}</div><div class="subject-grid">`; for (const nomeDisciplina of Object.keys(disciplinas)) { html += `<button class="subject-btn" data-disc="${nomeDisciplina}">${nomeDisciplina}</button>`; } html += `</div></div>`; }
    containerEl.innerHTML = html; containerEl.querySelectorAll('.subject-btn').forEach(btn => btn.addEventListener('click', (e) => funcaoClique(e.currentTarget.getAttribute('data-disc'))));
}

document.getElementById('btn-pauta-global')?.addEventListener('click', async () => {
    document.getElementById('modal-pauta-global').style.display = 'flex';
    const container = document.getElementById('pauta-global-content'); container.innerHTML = '<p class="text-muted" style="text-align:center;">A compilar notas...</p>';
    try {
        const notasDb = await getDocs(collection(db, "utilizadores", alunoAtualId, "notas")); const mapNotas = {}; notasDb.forEach(d => { const dt = d.data(); mapNotas[`${dt.disciplina}_${dt.modulo}`] = dt.nota; });
        let html = '';
        for (const [nomeComponente, disciplinas] of Object.entries(matrizCurso)) {
            html += `<div class="pauta-global-componente"><div class="pauta-global-header">${nomeComponente}</div>`;
            for (const [nomeDisc, modulos] of Object.entries(disciplinas)) {
                html += `<div class="pauta-global-disc"><div class="pauta-global-disc-title">${nomeDisc}</div><div class="pauta-global-notas">`;
                for(const mod of Object.keys(modulos)) {
                    const nota = mapNotas[`${nomeDisc}_${mod}`] || 'SN'; let cor = "sn"; if(nota !== 'SN' && nota !== 'REP' && nota >= 10) cor = "positiva"; else if(nota === 'REP' || nota < 10) cor = "negativa";
                    html += `<div class="pg-nota-item"><span>${mod}</span><span class="pg-nota-val ${cor}">${nota}</span></div>`;
                }
                html += `</div></div>`;
            }
            html += `</div>`;
        }
        container.innerHTML = html;
    } catch(err) { container.innerHTML = '<p class="text-muted" style="color:var(--danger-red); text-align:center;">Erro ao carregar a pauta.</p>'; }
});
document.getElementById('btn-close-pauta')?.addEventListener('click', () => document.getElementById('modal-pauta-global').style.display = 'none');

async function abrirModulosDisciplinaAvaliacao(disciplina) {
    esconderTudoMenos(viewDisciplinaModulos); document.getElementById('titulo-disciplina').innerText = disciplina;
    const listaModulosUI = document.getElementById('lista-modulos-disciplina'); listaModulosUI.innerHTML = '<p class="text-muted">A preparar pauta...</p>';
    const notasMapa = {}; try { const qNotas = await getDocs(collection(db, "utilizadores", alunoAtualId, "notas")); qNotas.forEach(d => { if (d.data().disciplina === disciplina) { notasMapa[d.data().modulo] = d.data().nota; notasMapa[d.data().modulo + "_motivo"] = d.data().motivoRep; } }); } catch(e){}
    let modulosArray = []; for (const comp of Object.values(matrizCurso)) { if (comp[disciplina]) modulosArray = Object.keys(comp[disciplina]); }
    let gridBtns = ""; for(let i=10; i<=20; i++) { gridBtns += `<button class="grade-btn" data-val="${i}">${i}</button>`; } gridBtns += `<button class="grade-btn rep" data-val="REP">REP</button>`;

    let html = "";
    modulosArray.forEach(mod => {
        const nEx = notasMapa[mod] !== undefined ? notasMapa[mod] : "SN"; let classeBadge = ""; if(nEx === "SN") classeBadge = "sn"; else if(nEx === "REP") classeBadge = "rep";
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
            const v = e.currentTarget.getAttribute('data-val'); notaSelecionadaTemporaria[modId] = v;
            document.getElementById(`rep-reason-box-${discId}-${modId}`).style.display = v === "REP" ? "block" : "none";
        });
    });
    listaModulosUI.querySelectorAll('.btn-gravar-nota').forEach(b => b.addEventListener('click', async (e) => {
        const d = e.currentTarget.getAttribute('data-disc'); const m = e.currentTarget.getAttribute('data-mod'); const v = notaSelecionadaTemporaria[m];
        if(!v) return; const btnRef = e.currentTarget; btnRef.innerText = "A gravar...";
        try { 
            const valorDb = v === "REP" ? "REP" : Number(v); const motivo = v === "REP" ? document.getElementById(`input-reason-${d}-${m}`).value : "";
            await setDoc(doc(db, "utilizadores", alunoAtualId, "notas", `${d}_${m}`), { disciplina: d, modulo: m, nota: valorDb, motivoRep: motivo, data: new Date().toISOString() });
            btnRef.innerText = "Gravado!"; setTimeout(() => { btnRef.innerText = "OK (Gravar)"; abrirModulosDisciplinaAvaliacao(d); }, 800);
        } catch(err){ btnRef.innerText = "Erro!"; }
    }));
}


// ==========================================
// 5. INFORMAÇÕES
// ==========================================
document.querySelectorAll('.btn-fechar-modal').forEach(b => b.addEventListener('click', () => { document.getElementById('modal-telefone').style.display='none'; document.getElementById('modal-email').style.display='none'; document.getElementById('modal-nova-falta').style.display='none'; document.getElementById('modal-alterar-falta').style.display='none'; document.getElementById('modal-novo-evento').style.display='none'; document.getElementById('modal-editar-horario').style.display='none'; }));
document.addEventListener('click', (e) => {
    if (e.target.classList.contains('clickable-contact')) {
        const tipo = e.target.getAttribute('data-type'); const valor = e.target.innerText; if(valor === "-" || valor === "") return;
        nomePessoaContactoModal = e.target.id.includes('aluno') ? document.getElementById('detail-student-name').innerText : (document.getElementById('display-ee-nome').innerText || "Enc. Educação");
        window.contactoTemp = valor;
        if (tipo === 'tel') { document.getElementById('action-ligar').href = `tel:${valor}`; document.getElementById('modal-telefone').style.display = 'flex'; } 
        else if (tipo === 'email') { document.getElementById('action-enviar-email').href = `mailto:${valor}`; document.getElementById('modal-email').style.display = 'flex'; }
    }
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
    } catch (error) {}
}

document.body.addEventListener('click', async (e) => {
    if(e.target.closest('#btn-hub-informacoes')) { esconderTudoMenos(viewInformacoes); document.getElementById('info-aluno-display').style.display = 'block'; document.getElementById('info-aluno-edit').style.display = 'none'; document.getElementById('info-ee-display').style.display = 'block'; document.getElementById('info-ee-edit').style.display = 'none'; carregarInfoLeitura(); }
    if(e.target.closest('#btn-editar-info-aluno')) { document.getElementById('info-aluno-display').style.display='none'; document.getElementById('info-aluno-edit').style.display='block'; }
    if(e.target.closest('#btn-editar-info-ee')) { document.getElementById('info-ee-display').style.display='none'; document.getElementById('info-ee-edit').style.display='block'; }
    if(e.target.closest('#btn-cancelar-aluno')) { document.getElementById('info-aluno-display').style.display='block'; document.getElementById('info-aluno-edit').style.display='none'; }
    if(e.target.closest('#btn-cancelar-ee')) { document.getElementById('info-ee-display').style.display='block'; document.getElementById('info-ee-edit').style.display='none'; }
});
document.getElementById('btn-guardar-aluno')?.addEventListener('click', async (e) => { e.currentTarget.innerText = "A gravar..."; try { await updateDoc(doc(db, "utilizadores", alunoAtualId), { idade: document.getElementById('info-aluno-idade').value, telAluno: document.getElementById('info-aluno-telemovel').value, emailAluno: document.getElementById('info-aluno-email').value, morada: document.getElementById('info-aluno-morada').value }); carregarInfoLeitura(); document.getElementById('info-aluno-display').style.display='block'; document.getElementById('info-aluno-edit').style.display='none'; } catch(err) {} e.currentTarget.innerText = "Guardar"; });
document.getElementById('btn-guardar-ee')?.addEventListener('click', async (e) => { e.currentTarget.innerText = "A gravar..."; try { await updateDoc(doc(db, "utilizadores", alunoAtualId), { nomeEE: document.getElementById('info-ee-nome').value, filiacaoEE: document.getElementById('info-ee-filiacao').value, telEE: document.getElementById('info-ee-telemovel').value, emailEE: document.getElementById('info-ee-email').value }); carregarInfoLeitura(); document.getElementById('info-ee-display').style.display='block'; document.getElementById('info-ee-edit').style.display='none'; } catch(err) {} e.currentTarget.innerText = "Guardar"; });


// ==========================================
// 6. PRHF (Mantido Integral)
// ==========================================
const selDisc = document.getElementById('prhf-disciplina'); const selMod = document.getElementById('prhf-modulo');
let optDisc = '<option value="">Disc.</option>'; for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) optDisc += `<option value="${d}">${d}</option>`; } selDisc.innerHTML = optDisc;
const optDiscFilter = '<option value="">Todas as Disciplinas</option>' + optDisc; document.getElementById('filtro-prhf-disc').innerHTML = optDiscFilter;

selDisc.addEventListener('change', (e) => { const d = e.target.value; let modsObj = {}; for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } let optMod = '<option value="">Mod.</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); selMod.innerHTML = optMod; });
document.getElementById('prhf-file-upload')?.addEventListener('change', (e) => { const file = e.target.files[0]; if(!file) return; if(file.size > 1048576) { alert("Ficheiro demasiado grande! (Limite 1MB para testes)"); return; } pdfNomeTemporario = file.name; document.getElementById('prhf-file-name').innerText = pdfNomeTemporario; const reader = new FileReader(); reader.onload = (ev) => { pdfBase64Temporario = ev.target.result; }; reader.readAsDataURL(file); });

let tabAtivaPrhf = 'ativas'; const modalFolha = document.getElementById('modal-prhf-sheet');

if(document.getElementById('btn-hub-prhf')) { document.getElementById('btn-hub-prhf').addEventListener('click', () => { esconderTudoMenos(viewPrhf); tabAtivaPrhf = 'ativas'; document.getElementById('tab-prhf-ativas').classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId); }); }
document.getElementById('tab-prhf-ativas')?.addEventListener('click', (e) => { tabAtivaPrhf = 'ativas'; e.currentTarget.classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId); });
document.getElementById('tab-prhf-concluidas')?.addEventListener('click', (e) => { tabAtivaPrhf = 'concluidas'; e.currentTarget.classList.add('active'); document.getElementById('tab-prhf-ativas').classList.remove('active'); carregarListaPRHF(alunoAtualId); });
document.getElementById('filtro-prhf-disc')?.addEventListener('change', () => carregarListaPRHF(alunoAtualId));

document.getElementById('btn-guardar-prhf')?.addEventListener('click', async (e) => {
    const disc = selDisc.value; const mod = selMod.value; const prazo = document.getElementById('prhf-prazo').value; const desc = document.getElementById('prhf-descricao').value.trim(); const htInput = document.getElementById('prhf-horas').value;
    const isTerminado = document.getElementById('prhf-modulo-terminado').checked;
    if(!disc || !mod || !prazo || !desc || !htInput) return alert("Preenche todos os campos!");
    const hT = parseInt(htInput); const hP = hT > 4 ? Math.ceil(hT * 0.3) : 0; const hN = hT - hP;
    const btnRef = e.currentTarget; btnRef.innerText = "A gravar...";
    try {
        await addDoc(collection(db, "utilizadores", alunoAtualId, "prhfs"), { disciplina: disc, modulo: mod, prazo: prazo, descricao: desc, horasNaoPresenciais: hN, horasPresenciais: hP, moduloTerminado: isTerminado, status: 'ativa', dataRegisto: new Date().toISOString(), registosManuais: [], pdfName: pdfNomeTemporario, pdfFile: pdfBase64Temporario });
        selDisc.value = ""; selMod.value = ""; document.getElementById('prhf-prazo').value = ""; document.getElementById('prhf-descricao').value = ""; document.getElementById('prhf-horas').value = ""; document.getElementById('prhf-modulo-terminado').checked = false;
        pdfBase64Temporario = ""; pdfNomeTemporario = ""; document.getElementById('prhf-file-name').innerText = ""; document.getElementById('prhf-file-upload').value = "";
        btnRef.innerText = "Gravado!"; setTimeout(() => { btnRef.innerText = "Processar e Gravar"; }, 1000);
        tabAtivaPrhf = 'ativas'; document.getElementById('tab-prhf-ativas').classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId);
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
            if (filtroDisc !== "" && data.disciplina !== filtroDisc) return; 
            if ((tabAtivaPrhf === 'ativas' && data.status === 'ativa') || (tabAtivaPrhf === 'concluidas' && data.status === 'concluida')) {
                prhfsMemoria.push(data); let classeCor = 'concluida'; if(data.status === 'ativa') classeCor = data.moduloTerminado ? 'ativa-terminado' : 'ativa-decorrer';
                const sM = (data.modulo||"").includes('M') ? data.modulo : 'M'+data.modulo; 
                html += `<div class="prhf-mini-card ${classeCor}" data-id="${data.id}"><strong>${data.disciplina}_${sM}</strong><i class="fa-solid fa-chevron-right" style="color:var(--text-muted); font-size:0.8rem;"></i></div>`;
            }
        });
        if (html === '') { container.innerHTML = `<p class="text-muted">Sem tarefas ${tabAtivaPrhf}.</p>`; return; }
        container.innerHTML = html;
        container.querySelectorAll('.prhf-mini-card').forEach(card => card.addEventListener('click', (e) => abrirFolhaPRHF(e.currentTarget.getAttribute('data-id'))));
    } catch (err) {}
}

function desenharRegistosManuais(plano) {
    const container = document.getElementById('lista-presencias-manuais'); let totalRealizado = 0;
    if(!plano.registosManuais || plano.registosManuais.length === 0) { container.innerHTML = ""; } else {
        let h = "<p style='margin-bottom:5px;'><strong>Já Registadas:</strong></p>";
        plano.registosManuais.forEach((r, idx) => { totalRealizado += r.horas; h += `<div class="registo-item"><span>${r.data} (${r.inicio} - ${r.fim}) [${r.horas}h]</span><i class="fa-solid fa-trash registo-item-del" data-idx="${idx}"></i></div>`; });
        container.innerHTML = h;
        container.querySelectorAll('.registo-item-del').forEach(icon => {
            icon.addEventListener('click', async (e) => {
                if(!confirm("Apagar este registo?")) return;
                const indexToRemove = e.currentTarget.getAttribute('data-idx'); const novaLista = [...plano.registosManuais]; novaLista.splice(indexToRemove, 1);
                try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { registosManuais: novaLista }); plano.registosManuais = novaLista; desenharRegistosManuais(plano); } catch(err) {}
            });
        });
    }

    document.getElementById('sheet-horas-feitas').innerText = totalRealizado; document.getElementById('sheet-horas-totais').innerText = plano.horasPresenciais || 0;
    const btnConcluir = document.getElementById('sheet-btn-concluir'); const progressFill = document.getElementById('sheet-btn-progress-fill'); const progressText = document.getElementById('sheet-btn-progress-text'); const txtRegisto = document.getElementById('txt-btn-registo');
    const hP = plano.horasPresenciais || 0; let perc = hP > 0 ? Math.min((totalRealizado / hP) * 100, 100) : 100; 
    progressFill.style.width = `${perc}%`; progressText.innerHTML = `<i class="fa-solid fa-check"></i> Concluído (${Math.floor(perc || 0)}%)`; 
    if(totalRealizado >= hP && hP > 0) { btnConcluir.classList.add('ready'); btnConcluir.disabled = false; txtRegisto.innerText = "Retificar Presenciais"; } else { btnConcluir.classList.remove('ready'); btnConcluir.disabled = true; txtRegisto.innerText = "Registar Presenciais"; }
}

function abrirFolhaPRHF(id) {
    const p = prhfsMemoria.find(x => x.id === id); if(!p) return; idPrhfAtivo = id; 
    const sM = (p.modulo||"").includes('M') ? p.modulo : 'M'+p.modulo;
    const dp = (p.prazo||"").split('-'); const dF = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : p.prazo;
    document.getElementById('sheet-title').innerText = `${p.disciplina}_${sM}`; document.getElementById('sheet-prazo').innerText = dF;
    document.getElementById('sheet-hp').innerText = p.horasPresenciais || 0; document.getElementById('sheet-ha').innerText = p.horasNaoPresenciais || 0;
    document.getElementById('sheet-desc').innerText = p.descricao;
    const btnDownload = document.getElementById('sheet-btn-download-pdf');
    if(p.pdfFile) { btnDownload.style.display = 'flex'; btnDownload.href = p.pdfFile; btnDownload.download = p.pdfName || `Anexo_${p.disciplina}.pdf`; } else { btnDownload.style.display = 'none'; }
    const badge = document.getElementById('sheet-status'); badge.innerText = p.status.toUpperCase(); 
    if(p.status === 'ativa') badge.className = `paper-status ${p.moduloTerminado ? 'ativa-terminado' : 'ativa-decorrer'}`; else badge.className = `paper-status concluida`;

    if (p.status === 'concluida') {
        document.getElementById('sheet-btn-concluir').style.display = 'none'; document.getElementById('sheet-btn-reverter').style.display = 'flex';
        document.getElementById('sheet-btn-toggle-manual').style.display = 'none'; document.getElementById('manual-presence-box').style.display = 'none';
    } else {
        document.getElementById('sheet-btn-concluir').style.display = 'block'; document.getElementById('sheet-btn-reverter').style.display = 'none';
        document.getElementById('sheet-btn-toggle-manual').style.display = 'flex'; document.getElementById('manual-presence-box').style.display = 'none'; 
    }
    desenharRegistosManuais(p); modalFolha.style.display = 'flex';
}
document.querySelector('.btn-close-paper')?.addEventListener('click', () => modalFolha.style.display = 'none');
document.getElementById('sheet-btn-toggle-manual')?.addEventListener('click', () => { const box = document.getElementById('manual-presence-box'); box.style.display = box.style.display === 'none' ? 'block' : 'none'; });

document.getElementById('btn-save-manual-pres')?.addEventListener('click', async (e) => {
    const d = document.getElementById('reg-pres-data').value; const i = document.getElementById('reg-pres-inicio').value; const f = document.getElementById('reg-pres-fim').value;
    if(!d || !i || !f) return alert("Preenche Data, Início e Fim!");
    const [hI, mI] = i.split(':').map(Number); const [hF, mF] = f.split(':').map(Number);
    let diff = (hF + mF/60) - (hI + mI/60); const horasCalc = diff > 0 ? Math.floor(diff) : 0; 
    if(horasCalc <= 0) return alert("A diferença deve ser pelo menos 1h!");
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

document.getElementById('sheet-btn-concluir')?.addEventListener('click', async () => {
    const p = prhfsMemoria.find(x => x.id === idPrhfAtivo); if(p.status === 'concluida' || document.getElementById('sheet-btn-concluir').disabled) return;
    if(!confirm("Marcar como CONCLUÍDO?")) return;
    try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { status: 'concluida' }); modalFolha.style.display = 'none'; carregarListaPRHF(alunoAtualId); } catch(err){}
});
document.getElementById('sheet-btn-reverter')?.addEventListener('click', async (e) => {
    if(!confirm("REVERTER para ATIVA?")) return; e.currentTarget.innerText = "A reverter...";
    try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { status: 'ativa' }); modalFolha.style.display = 'none'; carregarListaPRHF(alunoAtualId); } catch(err){ e.currentTarget.innerText = "Reverter para Ativa"; }
});


// ==========================================
// 8. MOTOR DE FALTAS (100% OPERACIONAL: ALTERAR, JUSTIFICAR E REFRESH)
// ==========================================
let optFaltasDiscOptionsOnly = ""; let faltasMemoria = [];
for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) optFaltasDiscOptionsOnly += `<option value="${d}">${d}</option>`; }

document.getElementById('btn-hub-faltas')?.addEventListener('click', () => { 
    esconderTudoMenos(viewFaltas); 
    document.getElementById('tab-faltas-disciplina').classList.add('active'); document.getElementById('tab-faltas-data').classList.remove('active');
    document.getElementById('faltas-container-disciplina').style.display = 'block'; document.getElementById('faltas-container-data').style.display = 'none';
    document.getElementById('toolbar-faltas-data').style.display = 'none';
    
    document.getElementById('filtro-disc-faltas').innerHTML = '<option value="">Todas as Disc.</option>' + optFaltasDiscOptionsOnly;
    document.getElementById('nf-disc').innerHTML = '<option value="">Disciplina</option>' + optFaltasDiscOptionsOnly;
    document.getElementById('af-disc').innerHTML = '<option value="">Disciplina</option>' + optFaltasDiscOptionsOnly;
    construirMatrizVisual(document.getElementById('faltas-container-disciplina'), abrirModulosDisciplinaFaltas); 
});
document.getElementById('tab-faltas-disciplina')?.addEventListener('click', (e) => { 
    e.currentTarget.classList.add('active'); document.getElementById('tab-faltas-data').classList.remove('active'); 
    document.getElementById('faltas-container-disciplina').style.display = 'block'; document.getElementById('faltas-container-data').style.display = 'none'; 
    document.getElementById('toolbar-faltas-data').style.display = 'none';
});
document.getElementById('tab-faltas-data')?.addEventListener('click', (e) => { 
    e.currentTarget.classList.add('active'); document.getElementById('tab-faltas-disciplina').classList.remove('active'); 
    document.getElementById('faltas-container-disciplina').style.display = 'none'; document.getElementById('faltas-container-data').style.display = 'block'; 
    document.getElementById('toolbar-faltas-data').style.display = 'flex';
    carregarHistoricoFaltas();
});

// Ações do Menu de Faltas
document.getElementById('filtro-mes-faltas')?.addEventListener('change', carregarHistoricoFaltas);
document.getElementById('filtro-disc-faltas')?.addEventListener('change', carregarHistoricoFaltas);
document.getElementById('btn-nova-falta')?.addEventListener('click', () => { document.getElementById('modal-nova-falta').style.display = 'flex'; });
document.getElementById('btn-cancelar-nova-falta')?.addEventListener('click', () => { document.getElementById('modal-nova-falta').style.display = 'none'; });
document.getElementById('btn-menos-hora')?.addEventListener('click', () => { const input = document.getElementById('nf-horas'); let v = parseInt(input.value) || 1; if(v > 1) input.value = v - 1; });
document.getElementById('btn-mais-hora')?.addEventListener('click', () => { const input = document.getElementById('nf-horas'); let v = parseInt(input.value) || 1; if(v < 8) input.value = v + 1; });

let modoFaltaAtual = 'simples';
document.getElementById('tab-falta-simples')?.addEventListener('click', (e) => { modoFaltaAtual = 'simples'; e.currentTarget.classList.add('active'); document.getElementById('tab-falta-multipla').classList.remove('active'); document.getElementById('view-falta-simples').style.display = 'block'; document.getElementById('view-falta-multipla').style.display = 'none'; });
document.getElementById('tab-falta-multipla')?.addEventListener('click', (e) => { modoFaltaAtual = 'multipla'; e.currentTarget.classList.add('active'); document.getElementById('tab-falta-simples').classList.remove('active'); document.getElementById('view-falta-simples').style.display = 'none'; document.getElementById('view-falta-multipla').style.display = 'block'; });

document.getElementById('btn-add-linha-falta')?.addEventListener('click', () => {
    const div = document.createElement('div'); div.className = "falta-linha-multipla";
    div.innerHTML = `<select class="lf-disc" style="margin:0; padding:8px; flex:2;"><option value="">Disc.</option>${optFaltasDiscOptionsOnly}</select><select class="lf-mod" style="margin:0; padding:8px; flex:2;"><option value="">Mod.</option></select><input type="number" class="lf-horas" value="1" min="1" max="8" style="margin:0; padding:8px; flex:1; text-align:center;"><button class="danger-btn small-btn btn-remover-linha-falta" style="padding:8px;"><i class="fa-solid fa-xmark"></i></button>`;
    document.getElementById('lista-linhas-faltas').appendChild(div);
    div.querySelector('.lf-disc').addEventListener('change', (e) => {
        const d = e.target.value; let modsObj = {}; for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } 
        let optMod = '<option value="">Mod.</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); div.querySelector('.lf-mod').innerHTML = optMod; 
    });
    div.querySelector('.btn-remover-linha-falta').addEventListener('click', () => div.remove());
});

document.getElementById('nf-disc')?.addEventListener('change', (e) => {
    const d = e.target.value; let modsObj = {}; for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } 
    let optMod = '<option value="">Módulo</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); document.getElementById('nf-mod').innerHTML = optMod; 
});

// GRAVAR NOVA FALTA E REFRESH AUTOMÁTICO
document.getElementById('btn-gravar-nova-falta')?.addEventListener('click', async (e) => {
    const justificada = document.getElementById('nf-justificada').checked;
    e.currentTarget.innerText = "A registar...";
    try {
        if(modoFaltaAtual === 'simples') {
            const dInicio = document.getElementById('nf-data').value; const disc = document.getElementById('nf-disc').value; const mod = document.getElementById('nf-mod').value; const horas = parseInt(document.getElementById('nf-horas').value) || 1;
            if(!dInicio || !disc || !mod) return alert("Preenche todos os campos!");
            await addDoc(collection(db, "utilizadores", alunoAtualId, "faltas"), { dataInicio: dInicio, disciplina: disc, modulo: mod, horas, justificada, criadoEm: new Date().toISOString() });
        } else {
            const dIn = document.getElementById('nfm-data-inicio').value; const dFi = document.getElementById('nfm-data-fim').value || dIn;
            if(!dIn) return alert("Preenche a Data Inicial!");
            let dtStart = new Date(dIn); let dtEnd = new Date(dFi); let dArr = [];
            while(dtStart <= dtEnd) { const yyyy = dtStart.getFullYear(); const mm = String(dtStart.getMonth() + 1).padStart(2, '0'); const dd = String(dtStart.getDate()).padStart(2, '0'); dArr.push(`${yyyy}-${mm}-${dd}`); dtStart.setDate(dtStart.getDate() + 1); }
            const linhas = document.querySelectorAll('.falta-linha-multipla');
            for(let dataStr of dArr) {
                for(let linha of linhas) {
                    const disc = linha.querySelector('.lf-disc').value; const mod = linha.querySelector('.lf-mod').value; const horas = parseInt(linha.querySelector('.lf-horas').value) || 1;
                    if(disc && mod) await addDoc(collection(db, "utilizadores", alunoAtualId, "faltas"), { dataInicio: dataStr, disciplina: disc, modulo: mod, horas, justificada, criadoEm: new Date().toISOString() });
                }
            }
        }
        document.getElementById('modal-nova-falta').style.display = 'none'; e.currentTarget.innerText = "Registar"; 
        await carregarHistoricoFaltas(); 
    } catch(err) { e.currentTarget.innerText = "Erro!"; }
});

// HISTÓRICO COM DIVISORES DE DATA E CHECKBOXES
async function carregarHistoricoFaltas() {
    const container = document.getElementById('lista-historico-faltas-container'); container.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar faltas...</p>';
    const filtroMes = document.getElementById('filtro-mes-faltas').value; const filtroDisc = document.getElementById('filtro-disc-faltas').value;
    try {
        const res = await getDocs(query(collection(db, "utilizadores", alunoAtualId, "faltas")));
        if(res.empty) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Sem faltas registadas.</p>'; return; }
        
        faltasMemoria = []; res.forEach(d => { const f = d.data(); f.id = d.id; faltasMemoria.push(f); });
        
        let faltasFiltradas = faltasMemoria;
        if (filtroDisc) faltasFiltradas = faltasFiltradas.filter(f => f.disciplina === filtroDisc);
        if (filtroMes) faltasFiltradas = faltasFiltradas.filter(f => f.dataInicio.split('-')[1] === filtroMes);
        
        if(faltasFiltradas.length === 0) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Nenhuma falta corresponde a estes filtros.</p>'; return; }
        
        faltasFiltradas.sort((a,b) => b.dataInicio.localeCompare(a.dataInicio));

        let html = ''; let currentDate = ''; const mesArr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        faltasFiltradas.forEach(f => {
            if(f.dataInicio !== currentDate) {
                currentDate = f.dataInicio; const dp = currentDate.split('-'); const dateStr = `${dp[2]} de ${mesArr[parseInt(dp[1])-1]} de ${dp[0]}`;
                html += `<div class="falta-date-divider">${dateStr}</div>`;
            }
            const cBar = f.justificada ? 'justificada' : 'injustificada'; const cMeta = f.justificada ? 'var(--success-green)' : 'var(--danger-red)'; const tMeta = f.justificada ? 'Justificada' : 'Injustificada';
            html += `
            <div class="falta-registo-card" style="flex-direction: row; align-items:center; background:var(--bg-dark);">
                <div class="falta-status-bar ${cBar}" style="align-self: stretch;"></div>
                <input type="checkbox" class="falta-card-checkbox" data-id="${f.id}">
                <div class="falta-registo-info" style="flex:1;">
                    <div><strong>${f.disciplina} - ${f.modulo}</strong><span class="falta-registo-meta" style="color:${cMeta};">${tMeta}</span></div>
                    <div style="text-align:right;"><strong>${f.horas}h</strong></div>
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch(err) { container.innerHTML = '<p class="text-muted" style="color:var(--danger-red); text-align:center;">Erro ao carregar faltas.</p>'; }
}

// AÇÕES DA TOOLBAR DE FALTAS (Eliminar, Justificar Rápido, Alterar)
document.getElementById('btn-eliminar-falta')?.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.falta-card-checkbox:checked');
    if(checkboxes.length === 0) return alert("Seleciona pelo menos uma falta para eliminar.");
    if(!confirm(`Tens a certeza que queres eliminar ${checkboxes.length} falta(s)?`)) return;
    const btn = document.getElementById('btn-eliminar-falta'); const originalHTML = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ...';
    for(let cb of checkboxes) { await deleteDoc(doc(db, "utilizadores", alunoAtualId, "faltas", cb.getAttribute('data-id'))); }
    btn.innerHTML = originalHTML; await carregarHistoricoFaltas();
});

document.getElementById('btn-justificar-falta')?.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.falta-card-checkbox:checked');
    if(checkboxes.length === 0) return alert("Seleciona pelo menos uma falta.");
    const btn = document.getElementById('btn-justificar-falta'); const originalHTML = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ...';
    for(let cb of checkboxes) { 
        const id = cb.getAttribute('data-id'); const f = faltasMemoria.find(x => x.id === id);
        if(f) { await updateDoc(doc(db, "utilizadores", alunoAtualId, "faltas", id), { justificada: !f.justificada }); }
    }
    btn.innerHTML = originalHTML; await carregarHistoricoFaltas();
});

let idFaltaEmEdicao = null;
document.getElementById('btn-alterar-falta')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.falta-card-checkbox:checked');
    if(checkboxes.length !== 1) return alert("Seleciona exatamente UMA falta para alterar.");
    
    const id = checkboxes[0].getAttribute('data-id'); const f = faltasMemoria.find(x => x.id === id); if(!f) return;
    idFaltaEmEdicao = id;
    
    document.getElementById('af-data').value = f.dataInicio;
    document.getElementById('af-disc').value = f.disciplina;
    const d = f.disciplina; let modsObj = {}; for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } 
    let optMod = '<option value="">Módulo</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); 
    document.getElementById('af-mod').innerHTML = optMod; 
    document.getElementById('af-mod').value = f.modulo;
    document.getElementById('af-horas').value = f.horas;
    document.getElementById('af-justificada').checked = f.justificada;
    
    document.getElementById('modal-alterar-falta').style.display = 'flex';
});

document.getElementById('af-disc')?.addEventListener('change', (e) => {
    const d = e.target.value; let modsObj = {}; for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } 
    let optMod = '<option value="">Módulo</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); document.getElementById('af-mod').innerHTML = optMod; 
});
document.getElementById('btn-cancelar-alteracao-falta')?.addEventListener('click', () => document.getElementById('modal-alterar-falta').style.display = 'none');
document.getElementById('btn-gravar-alteracao-falta')?.addEventListener('click', async (e) => {
    const dataInicio = document.getElementById('af-data').value; const disciplina = document.getElementById('af-disc').value; const modulo = document.getElementById('af-mod').value;
    const horas = parseInt(document.getElementById('af-horas').value) || 1; const justificada = document.getElementById('af-justificada').checked;
    if(!dataInicio || !disciplina || !modulo) return alert("Preenche os campos!");
    
    e.currentTarget.innerText = "A guardar...";
    try {
        await updateDoc(doc(db, "utilizadores", alunoAtualId, "faltas", idFaltaEmEdicao), { dataInicio, disciplina, modulo, horas, justificada });
        document.getElementById('modal-alterar-falta').style.display = 'none'; e.currentTarget.innerText = "Guardar"; await carregarHistoricoFaltas();
    } catch(err) { e.currentTarget.innerText = "Erro!"; }
});

async function abrirModulosDisciplinaFaltas(disciplina) {
    esconderTudoMenos(viewFaltasModulos); document.getElementById('titulo-falta-disciplina').innerText = disciplina;
    const container = document.getElementById('lista-faltas-disciplina'); container.innerHTML = '<p class="text-muted">A preparar faltas...</p>';
    let html = `<p class="text-muted" style="margin-bottom:15px;">Gestão de assiduidade por módulo:</p>`;
    let modulosArray = []; for (const comp of Object.values(matrizCurso)) { if (comp[disciplina]) modulosArray = Object.keys(comp[disciplina]); }
    modulosArray.forEach(mod => {
        html += `<div style="background:var(--bg-dark); padding:15px; border-radius:8px; border:1px solid #333; margin-bottom:12px;">
            <div style="display:flex; justify-content:space-between; margin-bottom:10px;"><strong>${mod}</strong><span class="falta-badge" id="badge-falta-${mod}">0h / ${matrizCurso[Object.keys(matrizCurso).find(c => matrizCurso[c][disciplina])][disciplina][mod]}h</span></div>
            <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:0%;"></div></div>
        </div>`;
    });
    container.innerHTML = html;
}

// ==========================================
// 9. MODO DE ESTUDO (POMODORO)
// ==========================================
let studyTimer; let tempoRestante = 25 * 60; 
const elText = document.getElementById('study-timer-text'); const elCircle = document.getElementById('study-timer-circle');

document.getElementById('btn-start-study')?.addEventListener('click', (e) => {
    e.currentTarget.style.display = 'none'; document.getElementById('btn-stop-study').style.display = 'block'; elCircle.classList.add('active');
    studyTimer = setInterval(() => {
        tempoRestante--; const m = Math.floor(tempoRestante / 60); const s = tempoRestante % 60;
        elText.innerText = `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        if(tempoRestante <= 0) {
            clearInterval(studyTimer); elCircle.classList.remove('active'); elText.innerText = "00:00";
            alert("Foco concluído! +50 XP!");
            document.getElementById('btn-stop-study').style.display = 'none'; document.getElementById('btn-start-study').style.display = 'block'; tempoRestante = 25 * 60;
        }
    }, 1000);
});
document.getElementById('btn-stop-study')?.addEventListener('click', (e) => {
    if(confirm("Desistir da sessão de foco?")) {
        clearInterval(studyTimer); e.currentTarget.style.display = 'none'; document.getElementById('btn-start-study').style.display = 'block';
        elCircle.classList.remove('active'); tempoRestante = 25 * 60; elText.innerText = "25:00";
    }
});
