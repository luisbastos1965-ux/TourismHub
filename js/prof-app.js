import { auth, db, messaging, VAPID_KEY, getToken } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, updateDoc, getDocs, query, addDoc, deleteDoc, where, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let myUserId = "", myUserName = "", profData = {}, myRoles = [];
let turmasProfessor = []; let selectedTurma = ""; let alunosTurmaRAM = []; let eventosTurmaRAM = [];
let alunoSelecionadoId = null; let materialBase64 = null;

const ordemDisciplinasGlobal = ['PORT', 'ING', 'AI', 'EF', 'TIC', 'GEO', 'HCA', 'MAT', 'CF', 'TIAT', 'TCAT', 'OTET'];
const ACADEMIAS_INFO = { 'atlas': { nome: 'Atlas' }, 'sentinela': { nome: 'Sentinela' }, 'nexus': { nome: 'Nexus' }, 'aurora': { nome: 'Aurora' } };

// ==========================================
// 1. INICIALIZAÇÃO
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            if (docSnap.exists()) {
                profData = docSnap.data();
                myRoles = profData.papeis || [];
                if (profData.papel && !myRoles.includes(profData.papel)) myRoles.push(profData.papel);
                
                if (myRoles.some(r => ['professor', 'diretor_turma', 'orientador_pap', 'coordenador'].includes(r))) {
                    myUserName = profData.nome || myUserId;
                    turmasProfessor = profData.turmas || []; 
                    
                    let titleStr = "Professor";
                    if(myRoles.includes('diretor_turma')) titleStr += " / DT";
                    if(myRoles.includes('orientador_pap')) titleStr += " / PAP";
                    
                    document.getElementById('header-user-name-prof').innerText = myUserName;
                    document.getElementById('header-user-name-prof').nextElementSibling.innerText = titleStr;
                    document.getElementById('perfil-nome-prof').innerText = myUserName;
                    
                    if(profData.fotoPerfil) {
                        document.getElementById('header-avatar-circle').innerHTML = `<img src="${profData.fotoPerfil}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                        document.getElementById('prof-avatar-img').src = profData.fotoPerfil;
                    }
                    if(!myRoles.includes('diretor_turma') && !myRoles.includes('orientador_pap')) { document.getElementById('tab-tarefas-passaporte').style.display = 'none'; }

                    const sel = document.getElementById('prof-seletor-turmas');
                    if(turmasProfessor.length > 0) sel.innerHTML = '<option value="">-- Selecionar Turma --</option>' + turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join('');
                    else sel.innerHTML = '<option value="">Sem turmas atribuídas</option>';

                    carregarRadarProfessor();
                } else { window.location.href = "index.html"; }
            }
        } catch (e) { console.error(e); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-prof')?.addEventListener('click', () => signOut(auth));

// ==========================================
// 2. CONVERSÃO DE FICHEIROS PARA BASE64
// ==========================================
document.getElementById('mat-file')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if(!file) return;
    
    // Limite de 5MB por segurança
    if(file.size > 5 * 1024 * 1024) { alert("O ficheiro é muito grande. O limite máximo é 5MB."); return; }
    
    document.getElementById('mat-file-name').innerText = file.name;
    document.getElementById('mat-file-name').style.color = "#0099ff";
    
    const reader = new FileReader();
    reader.onload = (event) => { materialBase64 = event.target.result; };
    reader.readAsDataURL(file);
});

// ==========================================
// 3. NAVEGAÇÃO E EVENTOS
// ==========================================
function esconderTodasAsVistas() { document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none'); }

document.body.addEventListener('click', async (e) => {
    const nav = e.target.closest('.nav-item');
    if(nav) {
        e.preventDefault(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); nav.classList.add('active');
        esconderTodasAsVistas(); const tId = nav.getAttribute('data-target'); document.getElementById(tId).style.display = (tId === 'view-prof-forum') ? 'flex' : 'block';
        if(tId === 'view-prof-dashboard') carregarRadarProfessor();
        if(tId === 'view-prof-turmas') { if(selectedTurma) analisarEAtualizarTurma(selectedTurma); }
        if(tId === 'view-prof-tarefas') carregarTarefasProf();
        if(tId === 'view-prof-forum') carregarForunsProf();
    }

    if(e.target.closest('.fechar-modal')) { document.getElementById(e.target.closest('.fechar-modal').getAttribute('data-target')).style.display = 'none'; }
    if(e.target.closest('.aluno-list-item')) { abrirPerfil360Aluno(e.target.closest('.aluno-list-item').getAttribute('data-id')); }
    
    if(e.target.closest('#tab-tarefas-prhf')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'block'; document.getElementById('sec-tarefas-passaporte').style.display = 'none'; carregarTarefasProf(); }
    if(e.target.closest('#tab-tarefas-passaporte')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'none'; document.getElementById('sec-tarefas-passaporte').style.display = 'block'; carregarTarefasProf(); }

    // --- MODAIS SUBSTITUTOS DOS PROMPTS ---
    
    // 1. OCORRÊNCIAS (POSITIVAS / NEGATIVAS)
    if(e.target.closest('#btn-dar-positiva')) {
        if(!alunoSelecionadoId) return;
        document.getElementById('oco-tipo').value = 'positiva';
        document.getElementById('oco-titulo').innerHTML = '<i class="fa-solid fa-star" style="color:var(--success-green);"></i> Ocorrência Positiva';
        document.getElementById('oco-motivo').value = '';
        document.getElementById('btn-gravar-ocorrencia').style.background = 'var(--success-green)';
        document.getElementById('modal-ocorrencia').style.display = 'flex';
    }
    
    if(e.target.closest('#btn-dar-negativa')) {
        if(!alunoSelecionadoId) return;
        document.getElementById('oco-tipo').value = 'negativa';
        document.getElementById('oco-titulo').innerHTML = '<i class="fa-solid fa-triangle-exclamation" style="color:var(--danger-red);"></i> Ocorrência Negativa';
        document.getElementById('oco-motivo').value = '';
        document.getElementById('btn-gravar-ocorrencia').style.background = 'var(--danger-red)';
        document.getElementById('modal-ocorrencia').style.display = 'flex';
    }

    if(e.target.closest('#btn-gravar-ocorrencia')) {
        const tipo = document.getElementById('oco-tipo').value;
        const motivo = document.getElementById('oco-motivo').value.trim();
        if(!motivo) return alert("Preenche o motivo da ocorrência!");
        const b = e.target.closest('#btn-gravar-ocorrencia'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            if(tipo === 'positiva') {
                const uS = await getDoc(doc(db, "utilizadores", alunoSelecionadoId)); let axp = uS.exists() && uS.data().xp ? uS.data().xp : 0;
                await addDoc(collection(db, "utilizadores", alunoSelecionadoId, "ocorrencias"), { titulo: "Reconhecimento Positivo", descricao: motivo, tipo: "positiva", autor: myUserName, timestamp: Date.now(), data: new Date().toLocaleDateString('pt-PT') });
                await updateDoc(doc(db, "utilizadores", alunoSelecionadoId), { xp: axp + 50 });
            } else {
                await addDoc(collection(db, "utilizadores", alunoSelecionadoId, "ocorrencias"), { titulo: "Registo de Aula", descricao: motivo, tipo: "negativa", autor: myUserName, timestamp: Date.now(), data: new Date().toLocaleDateString('pt-PT') });
            }
            b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado';
            setTimeout(() => { b.innerHTML = 'Confirmar Registo'; b.disabled = false; document.getElementById('modal-ocorrencia').style.display='none'; document.getElementById('modal-perfil-aluno').style.display='none'; analisarEAtualizarTurma(selectedTurma); }, 1500);
        } catch(err) { b.innerHTML = "Erro"; setTimeout(()=>b.disabled=false, 1500); }
    }

    // 2. MATERIAIS COM UPLOAD
    if(e.target.closest('#btn-modal-materiais')) {
        if(!selectedTurma) return alert("Seleciona uma turma na barra superior.");
        document.getElementById('mat-titulo').value = '';
        document.getElementById('mat-disciplina').innerHTML = ordemDisciplinasGlobal.map(dc => `<option value="${dc}">${dc}</option>`).join('');
        document.getElementById('mat-file').value = ''; materialBase64 = null;
        document.getElementById('mat-file-name').innerText = 'Toca para selecionar um PDF, DOCX ou Imagem';
        document.getElementById('mat-file-name').style.color = "var(--text-muted)";
        document.getElementById('modal-materiais').style.display = 'flex';
    }

    if(e.target.closest('#btn-gravar-material')) {
        const tit = document.getElementById('mat-titulo').value.trim();
        const disc = document.getElementById('mat-disciplina').value;
        if(!tit) return alert("Preenche o título do material!");
        
        const b = e.target.closest('#btn-gravar-material'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            await addDoc(collection(db, "turmas", selectedTurma, "sumarios"), { 
                titulo: tit, disciplina: disc, professor: myUserName, data: new Date().toLocaleDateString('pt-PT'), 
                descricao: materialBase64 ? "Ficheiro em anexo." : "Material partilhado pelo professor.",
                ficheiroBase64: materialBase64, timestamp: Date.now() 
            });
            b.innerHTML = '<i class="fa-solid fa-check"></i> Partilhado'; b.style.backgroundColor = "var(--success-green)";
            setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Partilhar com a Turma'; b.disabled = false; b.style.backgroundColor = "#0099ff"; document.getElementById('modal-materiais').style.display = 'none'; }, 1500);
        } catch(err) { b.innerHTML = "Erro"; setTimeout(()=>b.disabled=false, 1500); }
    }

    // 3. REJEIÇÃO PRHF
    if(e.target.closest('.btn-rejeitar-proposta')) {
        const btn = e.target.closest('.btn-rejeitar-proposta'); 
        document.getElementById('rej-aluno-id').value = btn.getAttribute('data-aluno');
        document.getElementById('rej-prhf-id').value = btn.getAttribute('data-prhf');
        document.getElementById('rej-motivo').value = '';
        document.getElementById('modal-rejeitar-prhf').style.display = 'flex';
    }
    if(e.target.closest('#btn-confirmar-rejeicao')) {
        const aId = document.getElementById('rej-aluno-id').value;
        const pId = document.getElementById('rej-prhf-id').value;
        const feedback = document.getElementById('rej-motivo').value.trim();
        if(!feedback) return alert("Indica o motivo da rejeição.");
        
        const b = e.target.closest('#btn-confirmar-rejeicao'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { propostaLidaDT: true, propostaAluno: null, feedbackProfessor: "Proposta Rejeitada: " + feedback });
            b.innerHTML = '<i class="fa-solid fa-check"></i> Rejeitado';
            setTimeout(() => { b.innerHTML = 'Rejeitar Agendamento'; b.disabled = false; document.getElementById('modal-rejeitar-prhf').style.display = 'none'; carregarTarefasProf(); }, 1500);
        } catch(err) { b.innerHTML = "Erro"; setTimeout(()=>b.disabled=false, 1500); }
    }

    // --- FUNÇÕES ANTIGAS MANTIDAS ---
    if(e.target.closest('#btn-modal-faltas')) {
        if(!selectedTurma || alunosTurmaRAM.length === 0) return alert("Seleciona uma turma com alunos primeiro.");
        const c = document.getElementById('lista-metralhadora-faltas'); let h = '';
        alunosTurmaRAM.forEach(al => { h += `<label style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); margin-bottom:5px; border-radius:8px; border:1px solid #333; cursor:pointer;"><span style="color:white; font-size:0.95rem;">${al.nome}</span><input type="checkbox" class="chk-presente" value="${al.id}" checked></label>`; });
        c.innerHTML = h; document.getElementById('falta-horas-bloco').value = ''; document.getElementById('modal-marcar-faltas').style.display = 'flex';
    }
    if(e.target.closest('#btn-todos-presentes')) { e.preventDefault(); document.querySelectorAll('.chk-presente').forEach(c => c.checked = true); }
    
    if(e.target.closest('#btn-confirmar-faltas')) {
        const horas = document.getElementById('falta-horas-bloco').value; if(!horas || horas < 1) return alert("Indica o número de horas!");
        const b = e.target.closest('#btn-confirmar-faltas'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        const ausentes = document.querySelectorAll('.chk-presente:not(:checked)');
        for(const chk of ausentes) { await addDoc(collection(db, "utilizadores", chk.value, "faltas"), { disciplina: "Geral", horas: Number(horas), dataInicio: new Date().toISOString().split('T')[0], justificada: false, criadoPor: myUserName, criadoEm: new Date().toISOString() }); }
        b.innerHTML = '<i class="fa-solid fa-check"></i> Faltas Registadas'; b.style.backgroundColor = "var(--success-green)"; setTimeout(() => { b.innerHTML = 'Gravar Registo'; b.disabled = false; b.style.backgroundColor = "var(--danger-red)"; document.getElementById('modal-marcar-faltas').style.display = 'none'; analisarEAtualizarTurma(selectedTurma); }, 2000);
    }

    if(e.target.closest('#btn-modal-notas')) {
        if(!selectedTurma || alunosTurmaRAM.length === 0) return alert("Seleciona uma turma com alunos primeiro.");
        document.getElementById('lancar-nota-disciplina').innerHTML = ordemDisciplinasGlobal.map(dc => `<option value="${dc}">${dc}</option>`).join(''); document.getElementById('lancar-nota-modulo').value = '';
        const grid = document.getElementById('grid-notas-alunos'); let h = '';
        alunosTurmaRAM.forEach(al => { h += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); border-radius:8px; border:1px solid #333;"><div style="display:flex; align-items:center; gap:10px;"><img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:30px; height:30px; border-radius:50%; object-fit:cover;"><span style="color:white; font-size:0.9rem;">${al.nome}</span></div><input type="text" class="input-nota-aluno input-padrao" data-id="${al.id}" placeholder="Nota" style="width:70px; text-align:center; padding:5px; margin:0; text-transform:uppercase;"></div>`; });
        grid.innerHTML = h; document.getElementById('modal-lancamento-notas').style.display = 'flex';
    }

    if(e.target.closest('#btn-confirmar-notas')) {
        const disc = document.getElementById('lancar-nota-disciplina').value; const mod = document.getElementById('lancar-nota-modulo').value;
        if(!disc || !mod) return alert("Preenche a Disciplina e o Módulo!");
        const inputs = document.querySelectorAll('.input-nota-aluno'); let notasParaGravar = [];
        inputs.forEach(inp => { const v = inp.value.trim().toUpperCase(); if(v) notasParaGravar.push({ id: inp.getAttribute('data-id'), nota: v }); });
        if(notasParaGravar.length === 0) return alert("Não inseriste nenhuma nota nos alunos.");
        const b = e.target.closest('#btn-confirmar-notas'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...'; b.disabled = true;
        try {
            for(const n of notasParaGravar) {
                await addDoc(collection(db, "utilizadores", n.id, "notas"), { disciplina: disc, modulo: Number(mod), nota: n.nota, data: new Date().toISOString(), professor: myUserName });
                if(n.nota !== 'REP' && !isNaN(n.nota) && Number(n.nota) >= 10) { const uS = await getDoc(doc(db, "utilizadores", n.id)); if(uS.exists()) { await updateDoc(doc(db, "utilizadores", n.id), { xp: (uS.data().xp || 0) + 20 }); } }
            }
            b.innerHTML = '<i class="fa-solid fa-check"></i> Turma Atualizada!'; b.style.backgroundColor = "var(--success-green)"; b.style.color = "white";
            setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-save"></i> Gravar Notas na Turma'; b.disabled = false; b.style.backgroundColor = "var(--warning-yellow)"; b.style.color="black"; document.getElementById('modal-lancamento-notas').style.display = 'none'; analisarEAtualizarTurma(selectedTurma); }, 2000);
        } catch(err) { b.innerHTML = "Erro Interno"; setTimeout(()=>b.disabled=false, 2000); }
    }

    if(e.target.closest('#btn-modal-agenda')) {
        if(!selectedTurma) return alert("Seleciona uma turma primeiro.");
        document.getElementById('evento-titulo').value = ''; document.getElementById('evento-data').value = ''; document.getElementById('aviso-colisao-agenda').style.display = 'none'; document.getElementById('modal-agendar-evento').style.display = 'flex';
    }

    if(e.target.closest('#btn-gravar-evento')) {
        const t = document.getElementById('evento-titulo').value.trim(); const d = document.getElementById('evento-data').value; const tp = document.getElementById('evento-tipo').value;
        if(!t || !d) return alert("Preenche Título e Data.");
        const b = e.target.closest('#btn-gravar-evento'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            await addDoc(collection(db, "turmas", selectedTurma, "eventos"), { titulo: t, data: d, tipo: tp, professor: myUserName });
            b.innerHTML = '<i class="fa-solid fa-check"></i> Agendado'; setTimeout(() => { b.innerHTML = 'Agendar'; b.disabled = false; document.getElementById('modal-agendar-evento').style.display = 'none'; carregarRadarProfessor(); analisarEAtualizarTurma(selectedTurma); }, 1500);
        } catch(err) { b.innerHTML = "Erro"; setTimeout(()=>b.disabled=false, 1500); }
    }

    // PRHF Actions Extras
    if(e.target.closest('#btn-novo-prhf')) {
        document.getElementById('prhf-turma').innerHTML = '<option value="">-- Turma --</option>' + turmasProfessor.map(t => `<option value="${t}">${t}</option>`).join('');
        document.getElementById('prhf-disciplina').innerHTML = ordemDisciplinasGlobal.map(dc => `<option value="${dc}">${dc}</option>`).join('');
        document.getElementById('modal-criar-prhf').style.display = 'flex';
    }

    if(e.target.closest('#btn-gravar-novo-prhf')) {
        const tTurma = document.getElementById('prhf-turma').value; const tAluno = document.getElementById('prhf-aluno').value; const tDisc = document.getElementById('prhf-disciplina').value; const tMod = document.getElementById('prhf-modulo').value; const tPrazo = document.getElementById('prhf-prazo').value; const tHoras = document.getElementById('prhf-horas').value; const tDesc = document.getElementById('prhf-descricao').value.trim();
        if(!tAluno || !tDisc || !tMod || !tPrazo || !tHoras || !tDesc) return alert("Preenche todos os campos obrigatórios!");
        const b = e.target.closest('#btn-gravar-novo-prhf'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            await addDoc(collection(db, "utilizadores", tAluno, "prhfs"), { disciplina: tDisc, modulo: Number(tMod), prazo: tPrazo, horasPresenciais: Number(tHoras), descricao: tDesc, status: 'pendente', dataCriacao: new Date().toISOString(), professor: myUserName });
            b.innerHTML = '<i class="fa-solid fa-check"></i> Plano Ativado'; b.style.backgroundColor = "var(--success-green)"; setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar para o Aluno'; b.disabled = false; b.style.backgroundColor = "var(--danger-red)"; document.getElementById('modal-criar-prhf').style.display = 'none'; carregarTarefasProf(); }, 2000);
        } catch(err) { b.innerHTML = "Erro"; setTimeout(()=>b.disabled=false, 2000); }
    }

    if(e.target.closest('.btn-aceitar-proposta')) {
        const btn = e.target.closest('.btn-aceitar-proposta'); const aId = btn.getAttribute('data-aluno'); const pId = btn.getAttribute('data-prhf'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
        try { await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { propostaLidaDT: true, feedbackProfessor: "Proposta Aceite! Comparece no dia/hora combinados." }); carregarTarefasProf(); } catch(err) {}
    }

    if(e.target.closest('.btn-concluir-prhf')) {
        const btn = e.target.closest('.btn-concluir-prhf'); const aId = btn.getAttribute('data-aluno'); const pId = btn.getAttribute('data-prhf'); const currXP = parseInt(btn.getAttribute('data-xp')) || 0;
        if(confirm("Confirma que o aluno concluiu a recuperação com sucesso? Ele receberá +100 XP.")) {
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
            try { await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { status: 'concluida', feedbackProfessor: "Recuperação concluída com sucesso." }); await updateDoc(doc(db, "utilizadores", aId), { xp: currXP + 100 }); carregarTarefasProf(); } catch(err) {}
        }
    }

    // Ações DT
    if(e.target.closest('#btn-salvar-obs-dt')) {
        if(!alunoSelecionadoId) return; const txt = document.getElementById('p-aluno-obs-dt').value.trim();
        const b = e.target.closest('#btn-salvar-obs-dt'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try { await setDoc(doc(db, "utilizadores", alunoSelecionadoId, "reunioes", "1_avaliacao"), { global: txt }, { merge: true }); b.innerHTML = '<i class="fa-solid fa-check"></i> Gravado'; b.style.backgroundColor = "var(--success-green)"; setTimeout(() => { b.innerHTML = 'Gravar Observação'; b.disabled = false; b.style.backgroundColor = "var(--primary-green)"; }, 2000); } catch(err) { b.innerHTML = "Erro"; setTimeout(()=>b.disabled=false, 2000); }
    }

    if(e.target.closest('#btn-justificar-faltas')) {
        if(!alunoSelecionadoId) return;
        if(confirm("Pretendes justificar todas as faltas pendentes deste aluno?")) {
            const b = e.target.closest('#btn-justificar-faltas'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
            try {
                const fS = await getDocs(query(collection(db, "utilizadores", alunoSelecionadoId, "faltas"), where("justificada", "==", false)));
                for(const f of fS.docs) { await updateDoc(doc(db, "utilizadores", alunoSelecionadoId, "faltas", f.id), { justificada: true, justificadaPor: myUserName }); }
                b.innerHTML = '<i class="fa-solid fa-check"></i> Faltas Justificadas'; b.style.color = "var(--success-green)"; b.style.borderColor = "var(--success-green)";
                setTimeout(() => { b.innerHTML = '<i class="fa-solid fa-clipboard-check"></i> Justificar Todas as Faltas Pendentes'; b.disabled = false; b.style.color="#00d2ff"; b.style.borderColor="#00d2ff"; abrirPerfil360Aluno(alunoSelecionadoId); analisarEAtualizarTurma(selectedTurma); }, 2000);
            } catch(err) { b.innerHTML = "Erro"; setTimeout(()=>b.disabled=false, 2000); }
        }
    }

    if(e.target.closest('.btn-validar-fct')) {
        const btn = e.target.closest('.btn-validar-fct'); const aId = btn.getAttribute('data-id'); btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
        try { await updateDoc(doc(db, "utilizadores", aId), { "fct.validadoDT": true }); carregarTarefasProf(); } catch(err) { btn.innerHTML = "Erro"; setTimeout(()=>btn.disabled=false, 2000); }
    }
});

// ==========================================
// 4. LÓGICA DE SELECTS E ESTATÍSTICAS
// ==========================================
document.getElementById('prof-seletor-turmas')?.addEventListener('change', (e) => {
    selectedTurma = e.target.value;
    if(selectedTurma) { document.getElementById('turma-ativa-container').style.display = 'block'; analisarEAtualizarTurma(selectedTurma); } 
    else { document.getElementById('turma-ativa-container').style.display = 'none'; }
});

document.getElementById('prhf-turma')?.addEventListener('change', async (e) => {
    const s = document.getElementById('prhf-aluno'); const t = e.target.value;
    if(!t) { s.innerHTML = '<option value="">Selecione primeiro a Turma</option>'; return; }
    s.innerHTML = '<option value="">A carregar alunos...</option>';
    try {
        const qS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
        let arr = []; qS.forEach(d => arr.push({id: d.id, nome: d.data().nome})); arr.sort((a,b) => a.nome.localeCompare(b.nome));
        s.innerHTML = '<option value="">-- Selecione o Aluno --</option>' + arr.map(a => `<option value="${a.id}">${a.nome}</option>`).join('');
    } catch(err) { s.innerHTML = '<option value="">Erro ao carregar</option>'; }
});

document.getElementById('evento-data')?.addEventListener('change', (e) => {
    if(!selectedTurma || !eventosTurmaRAM.length) return;
    const dateSel = new Date(e.target.value); const day = dateSel.getDay(); const diff = dateSel.getDate() - day + (day == 0 ? -6 : 1);
    const startOfWeek = new Date(dateSel.setDate(diff)).toISOString().split('T')[0]; const endOfWeek = new Date(dateSel.setDate(diff + 4)).toISOString().split('T')[0];
    let provasNaSemana = 0; eventosTurmaRAM.forEach(ev => { if((ev.tipo === 'teste' || ev.tipo === 'avaliacao') && ev.data >= startOfWeek && ev.data <= endOfWeek) { provasNaSemana++; } });
    if(provasNaSemana >= 3) document.getElementById('aviso-colisao-agenda').style.display = 'block'; else document.getElementById('aviso-colisao-agenda').style.display = 'none';
});

async function analisarEAtualizarTurma(turmaId) {
    const listC = document.getElementById('lista-alunos-turma'); listC.innerHTML = '<p class="text-muted center">A ler dados dos alunos...</p>';
    document.getElementById('assistente-aula-texto').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A calcular a Inteligência Letiva...';
    try {
        const qAlunos = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turmaId), where("papel", "==", "aluno")));
        alunosTurmaRAM = []; qAlunos.forEach(d => alunosTurmaRAM.push({id: d.id, ...d.data()})); alunosTurmaRAM.sort((a,b) => a.nome.localeCompare(b.nome));
        const qEvs = await getDocs(collection(db, "turmas", turmaId, "eventos")); eventosTurmaRAM = []; qEvs.forEach(d => eventosTurmaRAM.push(d.data()));

        let asstText = ""; let alunosEmRisco = 0; let totalPrhfsTurma = 0; let htmlAlunos = '';
        for(let i=0; i<alunosTurmaRAM.length; i++) {
            const al = alunosTurmaRAM[i]; let numFaltas = 0; let numPrhfs = 0;
            const fS = await getDocs(collection(db, "utilizadores", al.id, "faltas")); fS.forEach(f => { if(!f.data().justificada) numFaltas++; });
            const pS = await getDocs(collection(db, "utilizadores", al.id, "prhfs")); pS.forEach(p => { if(p.data().status !== 'concluida') numPrhfs++; });
            
            totalPrhfsTurma += numPrhfs; let corBola = 'status-green';
            if(numFaltas > 5 || numPrhfs > 2) { corBola = 'status-red'; alunosEmRisco++; } else if(numFaltas > 2 || numPrhfs > 0) { corBola = 'status-yellow'; }

            htmlAlunos += `<div class="aluno-list-item" data-id="${al.id}" style="cursor:pointer; transition:0.2s;"><div style="display:flex; align-items:center; gap:10px;"><img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;"><div><strong style="color:white; font-size:0.95rem;">${al.nome}</strong><div style="font-size:0.75rem; color:var(--text-muted);">${numPrhfs > 0 ? `<span style="color:var(--warning-yellow);">${numPrhfs} PRHFs</span>` : 'Tudo regular'}</div></div></div><div style="display:flex; align-items:center; gap:15px;"><span style="color:var(--primary-green); font-size:0.85rem; font-weight:bold;">${al.xp || 0} XP</span><span class="status-dot ${corBola}"></span></div></div>`;
        }

        asstText = `A turma tem <strong>${alunosTurmaRAM.length} alunos</strong>. `;
        if(alunosEmRisco > 0) asstText += `<span style="color:var(--danger-red);">Existem ${alunosEmRisco} alunos em risco de retenção.</span> `;
        if(totalPrhfsTurma > 0) asstText += `Há ${totalPrhfsTurma} Planos de Recuperação em curso. `;
        if(alunosEmRisco === 0 && totalPrhfsTurma === 0) asstText += "A turma está perfeitamente alinhada! Boa aula.";

        document.getElementById('assistente-aula-texto').innerHTML = asstText; listC.innerHTML = htmlAlunos;
    } catch(e) { listC.innerHTML = '<p class="text-danger center">Erro a processar turma.</p>'; }
}

async function abrirPerfil360Aluno(alunoId) {
    alunoSelecionadoId = alunoId; const al = alunosTurmaRAM.find(a => a.id === alunoId); if(!al) return;
    document.getElementById('p-aluno-nome').innerText = al.nome; document.getElementById('p-aluno-foto').src = al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`; document.getElementById('p-aluno-academia').innerText = al.academia ? ACADEMIAS_INFO[al.academia].nome : 'Sem Academia'; document.getElementById('p-aluno-xp').innerText = al.xp || 0;
    let fCount = 0; let pCount = 0;
    try {
        const fS = await getDocs(collection(db, "utilizadores", alunoId, "faltas")); fS.forEach(f => { if(!f.data().justificada) fCount++; });
        const pS = await getDocs(collection(db, "utilizadores", alunoId, "prhfs")); pS.forEach(p => { if(p.data().status !== 'concluida') pCount++; });
        if(myRoles.includes('diretor_turma')) {
            document.getElementById('area-obs-dt').style.display = 'block'; document.getElementById('btn-justificar-faltas').style.display = fCount > 0 ? 'block' : 'none';
            const rS = await getDoc(doc(db, "utilizadores", alunoId, "reunioes", "1_avaliacao"));
            if(rS.exists() && rS.data().global) document.getElementById('p-aluno-obs-dt').value = rS.data().global; else document.getElementById('p-aluno-obs-dt').value = '';
        }
    } catch(e){}
    document.getElementById('p-aluno-faltas').innerText = fCount; document.getElementById('p-aluno-prhfs').innerText = pCount;
    document.getElementById('modal-perfil-aluno').style.display = 'flex';
}

async function carregarRadarProfessor() {
    const pC = document.getElementById('radar-pendentes-container'); const aC = document.getElementById('radar-agenda-container');
    pC.innerHTML = '<p class="text-muted center">A calcular...</p>'; aC.innerHTML = '<p class="text-muted center">A calcular...</p>';
    if(turmasProfessor.length === 0) { pC.innerHTML = '<p class="text-muted center">Nenhuma turma atribuída.</p>'; aC.innerHTML = ''; return; }
    try {
        let eventosGlobais = [];
        for(const t of turmasProfessor) { const evS = await getDocs(collection(db, "turmas", t, "eventos")); evS.forEach(d => eventosGlobais.push({turma: t, ...d.data()})); }
        const hj = new Date().toISOString().split('T')[0];
        const fut = eventosGlobais.filter(e => e.data >= hj).sort((a,b) => a.data.localeCompare(b.data)).slice(0, 3);
        if(fut.length > 0) {
            let ah = ''; fut.forEach(e => { ah += `<div style="display:flex; justify-content:space-between; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:5px; border-left:3px solid var(--primary-green);"><div><strong style="color:white; font-size:0.9rem;">${e.titulo}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">Turma ${e.turma}</span></div><span style="color:var(--primary-green); font-size:0.8rem;">${e.data.split('-').reverse().join('/')}</span></div>`; }); aC.innerHTML = ah;
        } else { aC.innerHTML = '<p class="text-muted center" style="font-size:0.85rem;">Agenda livre para as próximas semanas.</p>'; }
        pC.innerHTML = `<div style="padding:10px; border:1px dashed #333; border-radius:8px; text-align:center;"><p style="font-size:0.85rem; color:var(--text-muted); margin:0;">Tudo atualizado! Nenhuma tarefa urgente para hoje.</p></div>`;
    } catch(e) {}
}

async function carregarTarefasProf() {
    const isPRHFTab = document.getElementById('tab-tarefas-prhf').classList.contains('active');
    if(isPRHFTab) {
        const container = document.getElementById('lista-prhfs-professor'); container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A procurar PRHFs...</p>';
        if(turmasProfessor.length === 0) { container.innerHTML = '<p class="text-muted center">Sem turmas atribuídas.</p>'; return; }
        try {
            let todosAlunos = []; for (const t of turmasProfessor) { const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); snap.forEach(d => todosAlunos.push({id: d.id, ...d.data()})); }
            let todosPrhfs = []; for (const al of todosAlunos) { const pSnap = await getDocs(collection(db, "utilizadores", al.id, "prhfs")); pSnap.forEach(p => todosPrhfs.push({id: p.id, alunoId: al.id, alunoNome: al.nome, turma: al.turma, alunoXP: al.xp || 0, ...p.data()})); }
            todosPrhfs.sort((a,b) => new Date(a.prazo) - new Date(b.prazo)); let pendentes = todosPrhfs.filter(p => p.status !== 'concluida');
            let h = ''; if(pendentes.length === 0) h = '<div style="padding:15px; border:1px dashed var(--success-green); border-radius:8px; text-align:center;"><p style="color:var(--success-green); font-size:0.9rem; margin:0;">Excelente! Não há Planos de Recuperação em curso nas tuas turmas.</p></div>';
            pendentes.forEach(p => {
                let acoesProposta = '';
                if(p.propostaAluno && p.propostaLidaDT === false) { acoesProposta = `<div style="background:rgba(255,204,0,0.1); border:1px dashed var(--warning-yellow); padding:10px; border-radius:8px; margin-top:10px;"><strong style="color:var(--warning-yellow); font-size:0.85rem;"><i class="fa-solid fa-clock"></i> Proposta de Agendamento:</strong><p style="font-size:0.85rem; color:white; margin:5px 0;">${p.propostaAluno}</p><div style="display:flex; gap:10px; margin-top:10px;"><button class="primary-btn small-btn btn-aceitar-proposta" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1; background:var(--success-green);"><i class="fa-solid fa-check"></i> Aceitar</button><button class="secondary-btn small-btn btn-rejeitar-proposta" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1; border-color:var(--danger-red); color:var(--danger-red);"><i class="fa-solid fa-xmark"></i> Rejeitar</button></div></div>`; }
                else if (p.propostaAluno && p.propostaLidaDT === true) { acoesProposta = `<div style="margin-top:10px; font-size:0.8rem; color:var(--success-green);"><i class="fa-solid fa-check-double"></i> Agendamento confirmado com o Aluno.</div>`; }
                h += `<div class="card" style="margin-bottom:15px; border-left: 4px solid var(--danger-red);"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><strong style="color:white; font-size:1.05rem;">${p.alunoNome} <span style="font-size:0.75rem; color:var(--text-muted);">(${p.turma})</span></strong><div style="color:var(--danger-red); font-weight:bold; font-size:0.9rem; margin-top:3px;">${p.disciplina} (Módulo ${p.modulo})</div></div><button class="btn-concluir-prhf" data-aluno="${p.alunoId}" data-prhf="${p.id}" data-xp="${p.alunoXP}" style="background:var(--bg-dark); border:1px solid var(--success-green); color:var(--success-green); padding:5px 10px; border-radius:6px; cursor:pointer; font-size:0.8rem;"><i class="fa-solid fa-check"></i> Concluir</button></div><p style="font-size:0.85rem; color:var(--text-light); margin:10px 0;">${p.descricao}</p><div style="font-size:0.8rem; color:var(--text-muted);">Prazo: <strong style="color:white;">${p.prazo.split('-').reverse().join('/')}</strong> | Horas: <strong>${p.horasPresenciais}h</strong></div>${acoesProposta}</div>`;
            }); container.innerHTML = h;
        } catch(e) { container.innerHTML = '<p class="text-danger center">Erro a carregar PRHFs.</p>'; }
    } else {
        const container = document.getElementById('lista-passaportes-professor'); container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar passaportes...</p>';
        try {
            let todosAlunos = []; for (const t of turmasProfessor) { const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); snap.forEach(d => todosAlunos.push({id: d.id, ...d.data()})); }
            let h = '';
            todosAlunos.forEach(al => {
                let fctHtml = ''; if(al.fct && al.fct.horasRealizadas > 0) { if(al.fct.validadoDT) fctHtml = `<span style="color:var(--success-green); font-size:0.8rem;"><i class="fa-solid fa-check-double"></i> ${al.fct.horasRealizadas}h Validadas</span>`; else fctHtml = `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--warning-yellow); font-size:0.8rem;">${al.fct.horasRealizadas}h declaradas</span> <button class="primary-btn small-btn btn-validar-fct" data-id="${al.id}" style="width:auto; padding:4px 10px;">Validar</button></div>`; } else { fctHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Sem registos FCT.</span>`; }
                let papHtml = ''; if(al.papFicheiroEnviado && al.papFicheiroBase64) { papHtml = `<a href="${al.papFicheiroBase64}" download="PAP_${al.nome.replace(/\s+/g, '_')}" class="secondary-btn small-btn" style="color:#0099ff; border-color:#0099ff; display:inline-block; text-align:center;"><i class="fa-solid fa-download"></i> Baixar Relatório</a>`; } else if(al.pap && al.pap.tema) { papHtml = `<span style="color:var(--text-light); font-size:0.8rem;">Tema: ${al.pap.tema} (Pendente)</span>`; } else { papHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Sem registos PAP.</span>`; }
                if(fctHtml.includes('declaradas') || fctHtml.includes('Validadas') || papHtml.includes('Tema') || papHtml.includes('Baixar')) {
                    h += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #ff9900;"><strong style="color:white; font-size:1.05rem;">${al.nome} <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span></strong><div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px dashed #333;"><strong style="font-size:0.85rem; color:white;"><i class="fa-solid fa-briefcase" style="color:var(--primary-green);"></i> FCT (Estágio)</strong><div style="margin-top:5px;">${fctHtml}</div></div><div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px dashed #333;"><strong style="font-size:0.85rem; color:white;"><i class="fa-solid fa-laptop-code" style="color:#0099ff;"></i> Projeto de Aptidão Profissional (PAP)</strong><div style="margin-top:5px;">${papHtml}</div></div></div>`;
                }
            }); container.innerHTML = h === '' ? '<p class="text-muted center">Nenhum aluno submeteu horas ou relatórios ainda.</p>' : h;
        } catch(e) { container.innerHTML = '<p class="text-danger center">Erro ao carregar passaportes.</p>'; }
    }
}

function carregarForunsProf() {
    const cont = document.getElementById('prof-forum-channel-list');
    cont.innerHTML = '<p class="text-muted center" style="font-size:0.85rem; margin-top:20px;">O Fórum das Disciplinas estará disponível na próxima atualização (Ponto 3).</p>';
}
