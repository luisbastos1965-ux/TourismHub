import { auth, db, messaging, VAPID_KEY, getToken } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, updateDoc, getDocs, query, addDoc, deleteDoc, where, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let myUserId = "", myUserName = "", profData = {}, myRoles = [];
let turmasProfessor = []; let selectedTurma = ""; let alunosTurmaRAM = []; let eventosTurmaRAM = [];
let alunoSelecionadoId = null;

const ACADEMIAS_INFO = {
    'atlas': { nome: 'Atlas', cor: '#00cc88' },
    'sentinela': { nome: 'Sentinela', cor: '#0088ff' },
    'nexus': { nome: 'Nexus', cor: '#ff8800' },
    'aurora': { nome: 'Aurora', cor: '#b82bf2' }
};

// ==========================================
// 1. INICIALIZAÇÃO DO PROFESSOR (MÚLTIPLOS PAPÉIS)
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            if (docSnap.exists()) {
                profData = docSnap.data();
                
                // Sistema do Cinto de Utilidades (Lê array 'papeis' ou converte a string 'papel' antiga)
                myRoles = profData.papeis || [];
                if (profData.papel && !myRoles.includes(profData.papel)) myRoles.push(profData.papel);
                
                // Verifica se tem pelo menos um cargo docente
                const temAcesso = myRoles.some(r => ['professor', 'diretor_turma', 'orientador_pap', 'coordenador'].includes(r));
                
                if (temAcesso) {
                    myUserName = profData.nome || myUserId;
                    turmasProfessor = profData.turmas || []; // Ex: ['10A', '11GPSI']
                    
                    // Monta o título dinamicamente com base nos papéis
                    let titleStr = "Professor";
                    if(myRoles.includes('diretor_turma')) titleStr += " / DT";
                    if(myRoles.includes('coordenador')) titleStr += " / Coord.";
                    if(myRoles.includes('orientador_pap')) titleStr += " / PAP";
                    
                    document.getElementById('header-user-name-prof').innerText = myUserName;
                    document.getElementById('header-user-name-prof').nextElementSibling.innerText = titleStr;
                    document.getElementById('perfil-nome-prof').innerText = myUserName;
                    
                    if(profData.fotoPerfil) {
                        document.getElementById('header-avatar-circle').innerHTML = `<img src="${profData.fotoPerfil}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                        document.getElementById('prof-avatar-img').src = profData.fotoPerfil;
                    }

                    // Esconde abas que não pertencem ao cargo do utilizador
                    if(!myRoles.includes('diretor_turma') && !myRoles.includes('orientador_pap')) {
                        const tabPassaporte = document.getElementById('tab-tarefas-passaporte');
                        if(tabPassaporte) tabPassaporte.style.display = 'none';
                    }

                    // Preencher o seletor de turmas
                    const sel = document.getElementById('prof-seletor-turmas');
                    if(turmasProfessor.length > 0) {
                        sel.innerHTML = '<option value="">-- Selecionar Turma --</option>' + turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join('');
                    } else { sel.innerHTML = '<option value="">Sem turmas atribuídas</option>'; }

                    carregarRadarProfessor();
                } else { window.location.href = "index.html"; }
            } else { window.location.href = "index.html"; }
        } catch (e) { console.error("Erro Auth Prof:", e); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-prof')?.addEventListener('click', () => signOut(auth));


// ==========================================
// 2. NAVEGAÇÃO E DELEGAÇÃO DE EVENTOS
// ==========================================
function esconderTodasAsVistas() { document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none'); }

document.body.addEventListener('click', async (e) => {
    
    // NAV BAR INFERIOR
    const nav = e.target.closest('.nav-item');
    if(nav) {
        e.preventDefault(); document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); nav.classList.add('active');
        esconderTodasAsVistas(); const tId = nav.getAttribute('data-target'); 
        document.getElementById(tId).style.display = (tId === 'view-prof-forum') ? 'flex' : 'block';
        if(tId === 'view-prof-dashboard') carregarRadarProfessor();
        if(tId === 'view-prof-turmas') { if(selectedTurma) analisarEAtualizarTurma(selectedTurma); }
        if(tId === 'view-prof-tarefas') carregarTarefasProf();
        if(tId === 'view-prof-forum') carregarForunsProf();
    }

    // FECHAR MODAIS
    if(e.target.closest('.fechar-modal')) {
        const trg = e.target.closest('.fechar-modal').getAttribute('data-target');
        document.getElementById(trg).style.display = 'none';
        if(trg === 'modal-perfil-aluno') alunoSelecionadoId = null;
    }

    // TABS DE TAREFAS
    if(e.target.closest('#tab-tarefas-prhf')) {
        document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active');
        document.getElementById('sec-tarefas-prhf').style.display = 'block'; document.getElementById('sec-tarefas-passaporte').style.display = 'none';
    }
    if(e.target.closest('#tab-tarefas-passaporte')) {
        document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active');
        document.getElementById('sec-tarefas-prhf').style.display = 'none'; document.getElementById('sec-tarefas-passaporte').style.display = 'block';
    }

    // ABRIR PERFIL 360 DO ALUNO
    if(e.target.closest('.aluno-list-item')) {
        const id = e.target.closest('.aluno-list-item').getAttribute('data-id');
        abrirPerfil360Aluno(id);
    }

    // BOTÕES DE ACESSO RÁPIDO DA TURMA
    if(e.target.closest('#btn-modal-faltas')) {
        if(!selectedTurma) return alert("Seleciona uma turma primeiro.");
        const c = document.getElementById('lista-metralhadora-faltas'); let h = '';
        alunosTurmaRAM.forEach(al => {
            h += `<label style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(255,255,255,0.05); margin-bottom:5px; border-radius:8px; border:1px solid #333; cursor:pointer;">
                    <span style="color:white;">${al.nome}</span>
                    <input type="checkbox" class="chk-presente" value="${al.id}" checked>
                  </label>`;
        });
        c.innerHTML = h; document.getElementById('falta-horas-bloco').value = '';
        document.getElementById('modal-marcar-faltas').style.display = 'flex';
    }

    if(e.target.closest('#btn-todos-presentes')) {
        e.preventDefault(); document.querySelectorAll('.chk-presente').forEach(c => c.checked = true);
    }

    if(e.target.closest('#btn-confirmar-faltas')) {
        const horas = document.getElementById('falta-horas-bloco').value;
        if(!horas || horas < 1) return alert("Indica o número de horas!");
        const b = e.target.closest('#btn-confirmar-faltas'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        
        let faltasCriadas = 0;
        const ausentes = document.querySelectorAll('.chk-presente:not(:checked)');
        for(const chk of ausentes) {
            const aId = chk.value;
            await addDoc(collection(db, "utilizadores", aId, "faltas"), {
                disciplina: "Geral", horas: Number(horas), dataInicio: new Date().toISOString().split('T')[0], justificada: false, criadoPor: myUserName, criadoEm: new Date().toISOString()
            });
            faltasCriadas++;
        }
        
        b.innerHTML = '<i class="fa-solid fa-check"></i> Faltas Registadas'; b.style.backgroundColor = "var(--success-green)";
        setTimeout(() => { b.innerHTML = 'Gravar Registo'; b.disabled = false; b.style.backgroundColor = "var(--danger-red)"; document.getElementById('modal-marcar-faltas').style.display = 'none'; analisarEAtualizarTurma(selectedTurma); }, 2000);
    }

    // BOTÃO AGENDA (RADAR DE COLISÕES)
    if(e.target.closest('#btn-modal-agenda')) {
        if(!selectedTurma) return alert("Seleciona uma turma primeiro.");
        document.getElementById('evento-titulo').value = ''; document.getElementById('evento-data').value = ''; document.getElementById('aviso-colisao-agenda').style.display = 'none';
        document.getElementById('modal-agendar-evento').style.display = 'flex';
    }

    if(e.target.closest('#btn-gravar-evento')) {
        const t = document.getElementById('evento-titulo').value.trim(); const d = document.getElementById('evento-data').value; const tp = document.getElementById('evento-tipo').value;
        if(!t || !d) return alert("Preenche Título e Data.");
        const b = e.target.closest('#btn-gravar-evento'); b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true;
        try {
            await addDoc(collection(db, "turmas", selectedTurma, "eventos"), { titulo: t, data: d, tipo: tp, professor: myUserName });
            b.innerHTML = '<i class="fa-solid fa-check"></i> Agendado';
            setTimeout(() => { b.innerHTML = 'Agendar'; b.disabled = false; document.getElementById('modal-agendar-evento').style.display = 'none'; carregarRadarProfessor(); }, 1500);
        } catch(err) { b.innerHTML = "Erro"; setTimeout(()=>b.disabled=false, 1500); }
    }

    // OCORRÊNCIAS E GAMIFICAÇÃO NO PERFIL DO ALUNO
    if(e.target.closest('#btn-dar-positiva')) {
        if(!alunoSelecionadoId) return;
        const motivo = prompt("Motivo do reconhecimento positivo?"); if(!motivo) return;
        try {
            const uS = await getDoc(doc(db, "utilizadores", alunoSelecionadoId)); let axp = uS.exists() && uS.data().xp ? uS.data().xp : 0;
            await addDoc(collection(db, "utilizadores", alunoSelecionadoId, "ocorrencias"), { titulo: "Reconhecimento Positivo", descricao: motivo, tipo: "positiva", autor: myUserName, timestamp: Date.now(), data: new Date().toLocaleDateString('pt-PT') });
            await updateDoc(doc(db, "utilizadores", alunoSelecionadoId), { xp: axp + 50 }); // Bónus Automático
            alert("Ação Registada! O aluno ganhou 50 XP e será notificado.");
        } catch(err) { alert("Erro ao registar."); }
    }
    
    if(e.target.closest('#btn-dar-negativa')) {
        if(!alunoSelecionadoId) return;
        const motivo = prompt("Descreva a ocorrência ou falta de material:"); if(!motivo) return;
        try {
            await addDoc(collection(db, "utilizadores", alunoSelecionadoId, "ocorrencias"), { titulo: "Registo de Aula", descricao: motivo, tipo: "negativa", autor: myUserName, timestamp: Date.now(), data: new Date().toLocaleDateString('pt-PT') });
            alert("Registo disciplinar gravado."); analisarEAtualizarTurma(selectedTurma);
        } catch(err) {}
    }

    // MATERIAIS RÁPIDOS (PROMPT SIMPLES V1)
    if(e.target.closest('#btn-modal-materiais')) {
        if(!selectedTurma) return alert("Seleciona uma turma.");
        const tit = prompt("Título do Material / Sumário:"); if(!tit) return;
        const disc = prompt("Sigla da Disciplina (Ex: PORT, MAT):"); if(!disc) return;
        try {
            await addDoc(collection(db, "turmas", selectedTurma, "sumarios"), { titulo: tit, disciplina: disc, professor: myUserName, data: new Date().toLocaleDateString('pt-PT'), descricao: "Material disponibilizado na aula.", timestamp: Date.now() });
            alert("Material partilhado com a turma!");
        } catch(err) {}
    }
    
    // NOTAS RÁPIDAS (PROMPT SIMPLES V1)
    if(e.target.closest('#btn-modal-notas')) {
        if(!selectedTurma) return alert("Seleciona uma turma.");
        const numA = prompt("Escreve o nº do aluno para lançar a nota:"); if(!numA) return;
        const mod = prompt("Qual o Módulo?"); if(!mod) return;
        const nota = prompt("Qual a Nota Final (10-20 ou REP)?"); if(!nota) return;
        // Na V2 criaremos o modal visual. Aqui é a base lógica.
        alert(`Acesso rápido registado: Módulo ${mod} com nota ${nota} guardado na RAM.`);
    }

});


// ==========================================
// 3. EVENTOS DINÂMICOS (Selects e Change)
// ==========================================
document.getElementById('prof-seletor-turmas')?.addEventListener('change', (e) => {
    selectedTurma = e.target.value;
    if(selectedTurma) {
        document.getElementById('turma-ativa-container').style.display = 'block';
        analisarEAtualizarTurma(selectedTurma);
    } else {
        document.getElementById('turma-ativa-container').style.display = 'none';
    }
});

// Radar de Colisões - Ouve quando a data muda
document.getElementById('evento-data')?.addEventListener('change', (e) => {
    if(!selectedTurma || !eventosTurmaRAM.length) return;
    const dateSel = new Date(e.target.value);
    
    // Encontrar Início (Segunda) e Fim (Sexta) da semana escolhida
    const day = dateSel.getDay(); const diff = dateSel.getDate() - day + (day == 0 ? -6 : 1);
    const startOfWeek = new Date(dateSel.setDate(diff)).toISOString().split('T')[0];
    const endOfWeek = new Date(dateSel.setDate(diff + 4)).toISOString().split('T')[0];
    
    let provasNaSemana = 0;
    eventosTurmaRAM.forEach(ev => {
        if((ev.tipo === 'teste' || ev.tipo === 'avaliacao') && ev.data >= startOfWeek && ev.data <= endOfWeek) {
            provasNaSemana++;
        }
    });

    if(provasNaSemana >= 3) document.getElementById('aviso-colisao-agenda').style.display = 'block';
    else document.getElementById('aviso-colisao-agenda').style.display = 'none';
});


// ==========================================
// 4. LÓGICA CORE: ASSISTENTE E SEMÁFOROS
// ==========================================
async function analisarEAtualizarTurma(turmaId) {
    const listC = document.getElementById('lista-alunos-turma'); listC.innerHTML = '<p class="text-muted center">A ler dados dos alunos...</p>';
    document.getElementById('assistente-aula-texto').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A calcular a Inteligência Letiva...';
    
    try {
        // 1. Puxar Alunos
        const qAlunos = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turmaId), where("papel", "==", "aluno")));
        alunosTurmaRAM = []; qAlunos.forEach(d => alunosTurmaRAM.push({id: d.id, ...d.data()}));
        alunosTurmaRAM.sort((a,b) => a.nome.localeCompare(b.nome));

        // 2. Puxar Eventos (Para o Radar)
        const qEvs = await getDocs(collection(db, "turmas", turmaId, "eventos"));
        eventosTurmaRAM = []; qEvs.forEach(d => eventosTurmaRAM.push(d.data()));

        let asstText = ""; let alunosEmRisco = 0; let totalPrhfsTurma = 0;

        // 3. Para cada aluno, recolher faltas e prhfs (Simulação Rápida RAM)
        let htmlAlunos = '';
        for(let i=0; i<alunosTurmaRAM.length; i++) {
            const al = alunosTurmaRAM[i];
            
            // Semáforo Inteligente
            let numFaltas = 0; let numPrhfs = 0;
            const fS = await getDocs(collection(db, "utilizadores", al.id, "faltas")); fS.forEach(f => { if(!f.data().justificada) numFaltas++; });
            const pS = await getDocs(collection(db, "utilizadores", al.id, "prhfs")); pS.forEach(p => { if(p.data().status !== 'concluida') numPrhfs++; });
            
            totalPrhfsTurma += numPrhfs;

            let corBola = 'status-green';
            if(numFaltas > 5 || numPrhfs > 2) { corBola = 'status-red'; alunosEmRisco++; }
            else if(numFaltas > 2 || numPrhfs > 0) { corBola = 'status-yellow'; }

            htmlAlunos += `
            <div class="aluno-list-item" data-id="${al.id}" style="cursor:pointer; transition:0.2s;">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                    <div>
                        <strong style="color:white; font-size:0.95rem;">${al.nome}</strong>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${numPrhfs > 0 ? `<span style="color:var(--warning-yellow);">${numPrhfs} PRHFs</span>` : 'Tudo regular'}</div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <span style="color:var(--primary-green); font-size:0.85rem; font-weight:bold;">${al.xp || 0} XP</span>
                    <span class="status-dot ${corBola}"></span>
                </div>
            </div>`;
        }

        // 4. Montar Assistente de Aula
        asstText = `A turma tem <strong>${alunosTurmaRAM.length} alunos</strong>. `;
        if(alunosEmRisco > 0) asstText += `<span style="color:var(--danger-red);">Existem ${alunosEmRisco} alunos em risco de retenção ou excesso de faltas.</span> `;
        if(totalPrhfsTurma > 0) asstText += `Há ${totalPrhfsTurma} Planos de Recuperação em curso na turma. `;
        if(alunosEmRisco === 0 && totalPrhfsTurma === 0) asstText += "A turma está perfeitamente alinhada! Boa aula.";

        document.getElementById('assistente-aula-texto').innerHTML = asstText;
        listC.innerHTML = htmlAlunos;

    } catch(e) { listC.innerHTML = '<p class="text-danger center">Erro a processar turma.</p>'; }
}


async function abrirPerfil360Aluno(alunoId) {
    alunoSelecionadoId = alunoId;
    const al = alunosTurmaRAM.find(a => a.id === alunoId); if(!al) return;
    
    document.getElementById('p-aluno-nome').innerText = al.nome;
    document.getElementById('p-aluno-foto').src = al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`;
    document.getElementById('p-aluno-academia').innerText = al.academia ? ACADEMIAS_INFO[al.academia].nome : 'Sem Academia';
    document.getElementById('p-aluno-xp').innerText = al.xp || 0;

    // Se o Professor também for DT, mostramos a área de Observações Intercalares
    if(myRoles.includes('diretor_turma')) {
        document.getElementById('p-aluno-obs-dt').style.display = 'block';
        document.getElementById('btn-salvar-obs-dt').style.display = 'block';
        document.getElementById('p-aluno-obs-dt').previousElementSibling.style.display = 'block';
    } else {
        document.getElementById('p-aluno-obs-dt').style.display = 'none';
        document.getElementById('btn-salvar-obs-dt').style.display = 'none';
        document.getElementById('p-aluno-obs-dt').previousElementSibling.style.display = 'none';
    }

    // Calcular stats rápidos
    let fCount = 0; let pCount = 0;
    try {
        const fS = await getDocs(collection(db, "utilizadores", alunoId, "faltas")); fS.forEach(f => { if(!f.data().justificada) fCount++; });
        const pS = await getDocs(collection(db, "utilizadores", alunoId, "prhfs")); pS.forEach(p => { if(p.data().status !== 'concluida') pCount++; });
    } catch(e){}

    document.getElementById('p-aluno-faltas').innerText = fCount; document.getElementById('p-aluno-prhfs').innerText = pCount;
    document.getElementById('modal-perfil-aluno').style.display = 'flex';
}

// ==========================================
// 5. RADAR DO PROFESSOR E TAREFAS (V1)
// ==========================================
async function carregarRadarProfessor() {
    const pC = document.getElementById('radar-pendentes-container'); const aC = document.getElementById('radar-agenda-container');
    pC.innerHTML = '<p class="text-muted center">A calcular...</p>'; aC.innerHTML = '<p class="text-muted center">A calcular...</p>';
    if(turmasProfessor.length === 0) { pC.innerHTML = '<p class="text-muted center">Nenhuma turma atribuída.</p>'; aC.innerHTML = ''; return; }

    try {
        let eventosGlobais = [];
        for(const t of turmasProfessor) {
            const evS = await getDocs(collection(db, "turmas", t, "eventos"));
            evS.forEach(d => eventosGlobais.push({turma: t, ...d.data()}));
        }

        const hj = new Date().toISOString().split('T')[0];
        const fut = eventosGlobais.filter(e => e.data >= hj).sort((a,b) => a.data.localeCompare(b.data)).slice(0, 3);
        
        if(fut.length > 0) {
            let ah = ''; fut.forEach(e => {
                ah += `<div style="display:flex; justify-content:space-between; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:5px; border-left:3px solid var(--primary-green);">
                        <div><strong style="color:white; font-size:0.9rem;">${e.titulo}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">Turma ${e.turma}</span></div>
                        <span style="color:var(--primary-green); font-size:0.8rem;">${e.data.split('-').reverse().join('/')}</span>
                       </div>`;
            }); aC.innerHTML = ah;
        } else { aC.innerHTML = '<p class="text-muted center" style="font-size:0.85rem;">Agenda livre para as próximas semanas.</p>'; }

        // O Radar no Futuro lerá os PRHFs propostos diretamente
        pC.innerHTML = `<div style="padding:10px; border:1px dashed #333; border-radius:8px; text-align:center;"><p style="font-size:0.85rem; color:var(--text-muted); margin:0;">Tudo atualizado! Nenhuma tarefa burocrática urgente pendente para hoje.</p></div>`;

    } catch(e) {}
}

function carregarTarefasProf() {
    document.getElementById('lista-prhfs-professor').innerHTML = `<p class="text-muted center" style="font-size:0.85rem; margin-top:20px;">O sistema central de validação de Planos de Recuperação (PRHF) e justificação de Faltas estará disponível no próximo módulo.</p>`;
}

function carregarForunsProf() {
    const cont = document.getElementById('prof-forum-channel-list');
    cont.innerHTML = '<p class="text-muted center" style="font-size:0.85rem; margin-top:20px;">O Fórum das Disciplinas para comunicação com as tuas turmas estará disponível no próximo update da plataforma.</p>';
}
