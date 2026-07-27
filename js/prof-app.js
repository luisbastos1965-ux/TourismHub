import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, setDoc, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const matrizCurso = {
    "Sociocultural": { "PORT": {"M1": 27, "M2": 24, "M3": 27}, "ING": {"M1": 24, "M2": 24, "M3": 24}, "AI": {"M1": 30, "M2": 30}, "EF": {"M1": 20, "M2": 20, "M3": 20, "M4": 20, "M5": 20}, "TIC": {"M1": 24, "M2": 24, "M3": 27, "M4": 24} },
    "Científica": { "GEO": {"M1": 27, "M2": 24}, "HCA": {"M1": 24, "M2": 24, "M3": 27}, "MAT": {"M1": 30, "M2": 30, "M3": 30} },
    "Técnica": { "CF": {"M1": 30, "M2": 30, "M3": 30}, "TIAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "TCAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "OTET": {"M1": 25, "M2": 25, "M3": 25, "M4": 25} }
};

const profDashboard = document.getElementById('prof-dashboard');
const classHubView = document.getElementById('class-hub-view'); 
const classView = document.getElementById('class-view'); 
const studentDetailView = document.getElementById('student-detail-view'); 
const viewAvaliacoes = document.getElementById('view-avaliacoes'); 
const viewDisciplinaModulos = document.getElementById('view-disciplina-modulos');
const viewFaltas = document.getElementById('view-faltas'); 
const viewPrhf = document.getElementById('view-prhf');
const viewClassCalendario = document.getElementById('view-class-calendario');
const viewSumarios = document.getElementById('view-sumarios');

let turmaAtual = ""; 
let alunoAtualId = ""; 

function esconderTudoMenos(ecraAtivo) {
    [profDashboard, classHubView, classView, studentDetailView, viewAvaliacoes, viewDisciplinaModulos, 
     viewFaltas, viewPrhf, viewClassCalendario].forEach(el => { if(el) el.style.display = 'none'; });
    if(ecraAtivo) ecraAtivo.style.display = 'block';
}

// 1. AUTENTICAÇÃO
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", userId));
            if (docSnap.exists() && docSnap.data().papel === 'professor') {
                const nome = docSnap.data().nome.split(' ')[0];
                document.getElementById('header-user-name-staff').innerText = `Olá, ${nome}`;
                document.getElementById('header-staff').style.display = 'flex';
                esconderTudoMenos(profDashboard);
            } else { window.location.href = "index.html"; }
        } catch (e) {}
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-staff')?.addEventListener('click', () => { signOut(auth).then(() => window.location.href = "index.html"); });
document.querySelectorAll('.btn-fechar-modal').forEach(b => b.addEventListener('click', () => { 
    document.getElementById('modal-nova-falta').style.display='none'; 
    document.getElementById('modal-prhf-sheet').style.display='none'; 
}));

// NAVEGAÇÃO
document.querySelectorAll('.turma-card-large').forEach(botao => {
    botao.addEventListener('click', () => {
        turmaAtual = botao.getAttribute('data-turma'); 
        document.getElementById('class-hub-title').innerHTML = `Turma ${turmaAtual}`; 
        esconderTudoMenos(classHubView); 
    });
});

document.getElementById('btn-voltar-turmas-hub')?.addEventListener('click', () => esconderTudoMenos(profDashboard));
document.getElementById('btn-voltar-class-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));
document.getElementById('btn-voltar-lista')?.addEventListener('click', () => esconderTudoMenos(classView));
document.getElementById('btn-voltar-hub-avaliacoes')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-disciplinas')?.addEventListener('click', () => esconderTudoMenos(viewAvaliacoes));
document.getElementById('btn-voltar-hub-faltas')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-hub-prhf')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-cal-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));

document.getElementById('btn-hub-alunos')?.addEventListener('click', () => { esconderTudoMenos(classView); carregarAlunos(turmaAtual); });
document.getElementById('btn-hub-calendario')?.addEventListener('click', () => { esconderTudoMenos(viewClassCalendario); carregarEventosCalendario(); });

// CARREGAR ALUNOS
async function carregarAlunos(turma) {
    const container = document.querySelector('.students-list-container'); container.innerHTML = '<p class="text-muted">A carregar...</p>';
    try {
        const res = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno"))); 
        if (res.empty) { container.innerHTML = '<p class="text-muted">Sem alunos.</p>'; return; }
        let html = '<ul class="students-list">';
        res.forEach((doc) => {
            const aluno = doc.data();
            const miniatura = aluno.fotoPerfil ? `<img src="${aluno.fotoPerfil}" class="list-avatar">` : `<div class="list-avatar"><i class="fa-solid fa-user"></i></div>`;
            html += `<li class="student-item"><div style="display:flex; align-items:center; gap:12px;">${miniatura}<div class="student-info"><strong>${aluno.nome}</strong><span>${doc.id.toUpperCase()}</span></div></div><button class="secondary-btn small-btn btn-ver-aluno" data-nome="${aluno.nome}" data-numero="${doc.id}"><i class="fa-solid fa-eye"></i> Ver</button></li>`;
        });
        container.innerHTML = html + '</ul>';
        container.querySelectorAll('.btn-ver-aluno').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.getElementById('detail-student-name').innerText = e.currentTarget.getAttribute('data-nome'); 
                alunoAtualId = e.currentTarget.getAttribute('data-numero'); 
                document.getElementById('detail-student-number').innerText = alunoAtualId.toUpperCase();
                esconderTudoMenos(studentDetailView); 
                document.getElementById('avatar-img').style.display = 'none'; document.getElementById('avatar-icon').style.display = 'block';
                try {
                    const docSnap = await getDoc(doc(db, "utilizadores", alunoAtualId));
                    if (docSnap.exists() && docSnap.data().fotoPerfil) { document.getElementById('avatar-img').src = docSnap.data().fotoPerfil; document.getElementById('avatar-img').style.display = 'block'; document.getElementById('avatar-icon').style.display = 'none'; }
                } catch(e){}
            });
        });
    } catch (e) {}
}

// AVALIAÇÕES DO PROFESSOR
document.getElementById('btn-hub-avaliacoes')?.addEventListener('click', () => { esconderTudoMenos(viewAvaliacoes); construirMatrizVisual(document.getElementById('matriz-disciplinas-container'), abrirModulos); });

function construirMatrizVisual(containerEl, funcaoClique) { 
    let html = ""; 
    for (const [nomeComponente, disciplines] of Object.entries(matrizCurso)) { 
        html += `<div class="component-section"><div class="component-header">${nomeComponente}</div><div class="subject-grid">`; 
        for (const nomeDisciplina of Object.keys(disciplines)) { html += `<button class="subject-btn" data-disc="${nomeDisciplina}">${nomeDisciplina}</button>`; } 
        html += `</div></div>`; 
    } 
    containerEl.innerHTML = html; 
    containerEl.querySelectorAll('.subject-btn').forEach(btn => btn.addEventListener('click', (e) => funcaoClique(e.currentTarget.getAttribute('data-disc')))); 
}

async function abrirModulos(disciplina) {
    esconderTudoMenos(viewDisciplinaModulos); document.getElementById('titulo-disciplina').innerText = disciplina;
    const listaModulosUI = document.getElementById('lista-modulos-disciplina'); listaModulosUI.innerHTML = '<p class="text-muted">A preparar pauta...</p>';
    const notasMapa = {}; 
    try { const qNotas = await getDocs(collection(db, "utilizadores", alunoAtualId, "notas")); qNotas.forEach(d => { if (d.data().disciplina === disciplina) { notasMapa[d.data().modulo] = d.data().nota; notasMapa[d.data().modulo + "_motivo"] = d.data().motivoRep; } }); } catch(e){}
    
    let modulosArray = []; for (const comp of Object.values(matrizCurso)) { if (comp[disciplina]) modulosArray = Object.keys(comp[disciplina]); } 
    let gridBtns = ""; for(let i=10; i<=20; i++) { gridBtns += `<button class="grade-btn" data-val="${i}">${i}</button>`; } gridBtns += `<button class="grade-btn rep" data-val="REP">REP</button>`;
    
    let html = ""; 
    modulosArray.forEach(mod => { 
        const nEx = notasMapa[mod] !== undefined ? notasMapa[mod] : "SN"; let classeBadge = ""; if(nEx === "SN") classeBadge = "sn"; else if(nEx === "REP") classeBadge = "rep"; 
        const txtMotivo = (nEx === "REP" && notasMapa[mod+"_motivo"]) ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:5px;"><i>Motivo: ${notasMapa[mod+"_motivo"]}</i></div>` : ""; 
        html += `<div class="modulo-avaliar-item" style="display:flex; flex-direction:column;"><div class="mod-view" id="view-${disciplina}-${mod}" style="display:flex; justify-content:space-between; width:100%; align-items:center;"><div><strong>${mod}</strong>${txtMotivo}</div><div style="display:flex; align-items:center; gap:15px;"><span class="nota-badge ${classeBadge}" id="badge-${disciplina}-${mod}">${nEx}</span><button class="secondary-btn small-btn btn-abrir-edicao-nota" data-mod="${mod}"><i class="fa-solid fa-pen"></i></button></div></div><div class="mod-edit" id="edit-${disciplina}-${mod}" style="display:none; flex-direction:column; width:100%;"><div class="grade-grid" id="grid-${disciplina}-${mod}">${gridBtns}</div><div id="rep-reason-box-${disciplina}-${mod}" style="display:none; width:100%; margin-bottom:10px;"><input type="text" id="input-reason-${disciplina}-${mod}" placeholder="Motivo do REP" style="margin:0; padding:8px; font-size:0.9rem;"></div><div style="display:flex; gap:10px;"><button class="primary-btn small-btn btn-gravar-nota" data-disc="${disciplina}" data-mod="${mod}" style="flex:1;">OK (Gravar)</button><button class="secondary-btn small-btn btn-fechar-edicao-nota" data-mod="${mod}" style="flex:1;">Cancelar</button></div></div></div>`; 
    });
    
    listaModulosUI.innerHTML = html; 
    listaModulosUI.querySelectorAll('.btn-abrir-edicao-nota').forEach(b => b.addEventListener('click', (e) => { const m=e.currentTarget.getAttribute('data-mod'); document.getElementById(`view-${disciplina}-${m}`).style.display='none'; document.getElementById(`edit-${disciplina}-${m}`).style.display='flex'; })); 
    listaModulosUI.querySelectorAll('.btn-fechar-edicao-nota').forEach(b => b.addEventListener('click', (e) => { const m=e.currentTarget.getAttribute('data-mod'); document.getElementById(`view-${disciplina}-${m}`).style.display='flex'; document.getElementById(`edit-${disciplina}-${m}`).style.display='none'; }));
    
    let notaTemporaria = {}; 
    listaModulosUI.querySelectorAll('.grade-btn').forEach(btn => { btn.addEventListener('click', (e) => { const gridPai = e.currentTarget.parentElement; gridPai.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected')); e.currentTarget.classList.add('selected'); const modId = gridPai.id.split('-')[2]; const discId = gridPai.id.split('-')[1]; const v = e.currentTarget.getAttribute('data-val'); notaTemporaria[modId] = v; document.getElementById(`rep-reason-box-${discId}-${modId}`).style.display = v === "REP" ? "block" : "none"; }); });
    
    listaModulosUI.querySelectorAll('.btn-gravar-nota').forEach(b => b.addEventListener('click', async (e) => { const d = e.currentTarget.getAttribute('data-disc'); const m = e.currentTarget.getAttribute('data-mod'); const v = notaTemporaria[m]; if(!v) return; const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; try { const valorDb = v === "REP" ? "REP" : Number(v); const motivo = v === "REP" ? document.getElementById(`input-reason-${d}-${m}`).value : ""; await setDoc(doc(db, "utilizadores", alunoAtualId, "notas", `${d}_${m}`), { disciplina: d, modulo: m, nota: valorDb, motivoRep: motivo, data: new Date().toISOString() }); btnRef.innerText = "Gravado!"; setTimeout(() => { abrirModulos(d); }, 800); } catch(err){ btnRef.innerText = "Erro!"; } }));
}

// FALTAS (Professor lança apenas faltas Injustificadas que depois o DT/EE justificam)
document.getElementById('btn-hub-faltas')?.addEventListener('click', () => { 
    esconderTudoMenos(viewFaltas); 
    carregarFaltas(); 
});

document.getElementById('btn-nova-falta')?.addEventListener('click', () => { 
    let optDisc = '<option value="">Disciplina</option>'; 
    for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) optDisc += `<option value="${d}">${d}</option>`; }
    document.getElementById('nf-disc').innerHTML = optDisc;
    document.getElementById('modal-nova-falta').style.display = 'flex'; 
});

document.getElementById('nf-disc')?.addEventListener('change', (e) => { 
    const d = e.target.value; let modsObj = {}; 
    for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } 
    let optMod = '<option value="">Módulo</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); 
    document.getElementById('nf-mod').innerHTML = optMod; 
});

document.getElementById('btn-menos-hora')?.addEventListener('click', () => { const input = document.getElementById('nf-horas'); let v = parseInt(input.value) || 1; if(v > 1) input.value = v - 1; });
document.getElementById('btn-mais-hora')?.addEventListener('click', () => { const input = document.getElementById('nf-horas'); let v = parseInt(input.value) || 1; if(v < 8) input.value = v + 1; });

document.getElementById('btn-gravar-nova-falta')?.addEventListener('click', async (e) => {
    const dInicio = document.getElementById('nf-data').value; const disc = document.getElementById('nf-disc').value; const mod = document.getElementById('nf-mod').value; const horas = parseInt(document.getElementById('nf-horas').value) || 1;
    if(!dInicio || !disc || !mod) return alert("Preenche todos os campos!");
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        await addDoc(collection(db, "utilizadores", alunoAtualId, "faltas"), { dataInicio: dInicio, disciplina: disc, modulo: mod, horas, justificada: false, criadoEm: new Date().toISOString() });
        document.getElementById('modal-nova-falta').style.display = 'none'; btnRef.innerText = "Registar"; carregarFaltas(); 
    } catch(err) { btnRef.innerText = "Erro!"; }
});

async function carregarFaltas() {
    const container = document.getElementById('lista-historico-faltas-container'); container.innerHTML = '<p class="text-muted">A carregar...</p>';
    try {
        const res = await getDocs(query(collection(db, "utilizadores", alunoAtualId, "faltas")));
        if(res.empty) { container.innerHTML = '<p class="text-muted center">Sem faltas registadas.</p>'; return; }
        let fArr = []; res.forEach(d => fArr.push(d.data())); fArr.sort((a,b) => b.dataInicio.localeCompare(a.dataInicio));
        let html = ''; fArr.forEach(f => { html += `<div class="card" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;"><div><strong>${f.disciplina}</strong> (${f.horas}h)<br><span style="font-size:0.8rem; color:var(--text-muted);">${f.dataInicio}</span></div></div>`; });
        container.innerHTML = html;
    } catch(e) {}
}

// PRHF
const selDisc = document.getElementById('prhf-disciplina'); const selMod = document.getElementById('prhf-modulo');
document.getElementById('btn-hub-prhf')?.addEventListener('click', () => {
    esconderTudoMenos(viewPrhf);
    let optDisc = '<option value="">Disc.</option>'; for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) optDisc += `<option value="${d}">${d}</option>`; } selDisc.innerHTML = optDisc;
    carregarPrhfs();
});

selDisc.addEventListener('change', (e) => { 
    const d = e.target.value; let modsObj = {}; for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } 
    let optMod = '<option value="">Mod.</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); selMod.innerHTML = optMod; 
});

document.getElementById('btn-guardar-prhf')?.addEventListener('click', async (e) => {
    const disc = selDisc.value; const mod = selMod.value; const prazo = document.getElementById('prhf-prazo').value; const desc = document.getElementById('prhf-descricao').value.trim(); const htInput = document.getElementById('prhf-horas').value;
    if(!disc || !mod || !prazo || !desc || !htInput) return alert("Preenche todos os campos!");
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try { 
        await addDoc(collection(db, "utilizadores", alunoAtualId, "prhfs"), { disciplina: disc, modulo: mod, prazo: prazo, descricao: desc, horasPresenciais: parseInt(htInput), moduloTerminado: document.getElementById('prhf-modulo-terminado').checked, status: 'ativa', dataRegisto: new Date().toISOString() }); 
        document.getElementById('prhf-prazo').value = ""; document.getElementById('prhf-descricao').value = ""; document.getElementById('prhf-horas').value = ""; btnRef.innerText = "Gravar Plano"; carregarPrhfs(); 
    } catch (err) { btnRef.innerText = "Erro!"; } 
});

async function carregarPrhfs() {
    const container = document.getElementById('lista-prhf-container'); container.innerHTML = '<p class="text-muted">A carregar...</p>';
    try { 
        const res = await getDocs(query(collection(db, "utilizadores", alunoAtualId, "prhfs"))); let html = ''; 
        res.forEach(doc => { const d = doc.data(); const cor = d.status==='ativa' ? (d.moduloTerminado?'var(--warning-yellow)':'var(--primary-green)') : '#555'; html += `<div class="card" style="border-left:4px solid ${cor}; margin-bottom:10px;"><strong>${d.disciplina} (M${d.modulo})</strong><br><span style="font-size:0.8rem;">Prazo: ${d.prazo} | Status: ${d.status.toUpperCase()}</span></div>`; }); 
        container.innerHTML = html || '<p class="text-muted">Sem PRHFs.</p>'; 
    } catch (err) {}
}

// CALENDÁRIO (VISUALIZAÇÃO APENAS)
async function carregarEventosCalendario() {
    const container = document.getElementById('lista-calendario-container'); container.innerHTML = '<p class="text-muted">A carregar eventos do DT...</p>';
    try {
        const res = await getDocs(query(collection(db, "turmas", turmaAtual, "eventos"))); if(res.empty) { container.innerHTML = '<p class="text-muted">Sem eventos agendados.</p>'; return; }
        let html = ''; res.forEach(d => { const e = d.data(); html += `<div class="card" style="margin-bottom:10px;"><strong>${e.titulo}</strong><br><span style="font-size:0.8rem; color:var(--text-muted);">${e.data} | ${e.disciplina || 'Geral'}</span></div>`; }); container.innerHTML = html;
    } catch(err) { container.innerHTML = '<p class="text-danger center">Erro ao carregar calendário.</p>'; }
}

// ==========================================
// SUMÁRIOS E MATERIAIS DE AULA
// ==========================================
const viewSumarios = document.getElementById('view-sumarios');
let materialBase64Temporario = "";
let materialNomeTemporario = "";

document.querySelectorAll('.btn-fechar-modal').forEach(b => b.addEventListener('click', () => { 
    const mSum = document.getElementById('modal-novo-sumario');
    if(mSum) mSum.style.display = 'none'; 
}));

document.getElementById('btn-hub-sumarios')?.addEventListener('click', () => {
    esconderTudoMenos(viewSumarios);
    let optDisc = '<option value="">Todas as Disciplinas</option>';
    for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) optDisc += `<option value="${d}">${d}</option>`; }
    document.getElementById('filtro-sumarios-disc').innerHTML = optDisc;
    carregarSumarios();
});

document.getElementById('btn-voltar-sumarios-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));
document.getElementById('filtro-sumarios-disc')?.addEventListener('change', carregarSumarios);

document.getElementById('btn-novo-sumario')?.addEventListener('click', () => {
    let optDisc = '<option value="">Disciplina</option>';
    for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) optDisc += `<option value="${d}">${d}</option>`; }
    document.getElementById('ns-disc').innerHTML = optDisc;
    document.getElementById('ns-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('ns-titulo').value = "";
    document.getElementById('ns-descricao').value = "";
    document.getElementById('ns-file-name').innerText = "";
    document.getElementById('ns-upload-material').value = "";
    materialBase64Temporario = "";
    materialNomeTemporario = "";
    document.getElementById('modal-novo-sumario').style.display = 'flex';
});

document.getElementById('ns-upload-material')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    if(file.size > 716800) { alert("Ficheiro demasiado grande! O limite é 700KB."); return; }
    
    materialNomeTemporario = file.name;
    document.getElementById('ns-file-name').innerText = materialNomeTemporario;
    
    const reader = new FileReader();
    reader.onload = (ev) => { materialBase64Temporario = ev.target.result; };
    reader.readAsDataURL(file);
});

document.getElementById('btn-gravar-sumario')?.addEventListener('click', async (e) => {
    const data = document.getElementById('ns-data').value;
    const disc = document.getElementById('ns-disc').value;
    const titulo = document.getElementById('ns-titulo').value.trim();
    const desc = document.getElementById('ns-descricao').value.trim();
    
    if(!data || !disc || !titulo) return alert("A Data, Disciplina e Título são obrigatórios!");
    
    const btnRef = e.currentTarget;
    btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A publicar...';
    btnRef.disabled = true;

    try {
        await addDoc(collection(db, "turmas", turmaAtual, "sumarios"), {
            data: data,
            disciplina: disc,
            titulo: titulo,
            descricao: desc,
            anexoNome: materialNomeTemporario,
            anexoBase64: materialBase64Temporario,
            professor: document.getElementById('header-user-name-staff').innerText.replace('Olá, ', ''),
            criadoEm: new Date().toISOString()
        });
        
        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Publicado!';
        setTimeout(() => {
            document.getElementById('modal-novo-sumario').style.display = 'none';
            btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Publicar';
            btnRef.disabled = false;
            carregarSumarios();
        }, 1000);
    } catch(err) {
        btnRef.innerHTML = "Erro!";
        setTimeout(() => { btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Publicar'; btnRef.disabled = false; }, 2000);
    }
});

async function carregarSumarios() {
    const container = document.getElementById('lista-sumarios-container');
    container.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar...</p>';
    const filtroDisc = document.getElementById('filtro-sumarios-disc').value;

    try {
        const res = await getDocs(query(collection(db, "turmas", turmaAtual, "sumarios")));
        if(res.empty) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Nenhum sumário registado.</p>'; return; }
        
        let sumarios = [];
        res.forEach(d => sumarios.push({id: d.id, ...d.data()}));
        
        if(filtroDisc) sumarios = sumarios.filter(s => s.disciplina === filtroDisc);
        sumarios.sort((a,b) => b.data.localeCompare(a.data)); // Mais recentes primeiro

        if(sumarios.length === 0) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Nenhum sumário para esta disciplina.</p>'; return; }

        let html = '';
        sumarios.forEach(s => {
            const anexoBtn = s.anexoBase64 ? `<a href="${s.anexoBase64}" download="${s.anexoNome}" class="secondary-btn small-btn" style="display:inline-block; margin-top:10px; width:auto; padding:5px 10px; border-color:var(--primary-green); color:var(--primary-green);"><i class="fa-solid fa-download"></i> ${s.anexoNome}</a>` : '';
            html += `
            <div class="card" style="margin-bottom:15px; border-left: 4px solid var(--primary-green);">
                <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                    <div>
                        <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">${s.data} | ${s.disciplina} | Prof. ${s.professor}</span>
                        <h4 style="margin:5px 0;">${s.titulo}</h4>
                        ${s.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">${s.descricao}</p>` : ''}
                    </div>
                </div>
                ${anexoBtn}
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p class="text-danger center">Erro ao ler sumários.</p>'; }
}
