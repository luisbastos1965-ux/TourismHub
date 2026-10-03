import { auth, db, messaging, VAPID_KEY, getToken, onMessage } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, addDoc, deleteDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Matriz do Curso
const matrizCurso = {
    "Sociocultural": { "PORT": {"M1": 27, "M2": 24, "M3": 27}, "ING": {"M1": 24, "M2": 24, "M3": 24}, "AI": {"M1": 30, "M2": 30}, "EF": {"M1": 20, "M2": 20, "M3": 20, "M4": 20, "M5": 20}, "TIC": {"M1": 24, "M2": 24, "M3": 27, "M4": 24} },
    "Científica": { "GEO": {"M1": 27, "M2": 24}, "HCA": {"M1": 24, "M2": 24, "M3": 27}, "MAT": {"M1": 30, "M2": 30, "M3": 30} },
    "Técnica": { "CF": {"M1": 30, "M2": 30, "M3": 30}, "TIAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "TCAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "OTET": {"M1": 25, "M2": 25, "M3": 25, "M4": 25} }
};

const adminDashboard = document.getElementById('admin-dashboard');
const viewAdminTurmas = document.getElementById('view-admin-turmas');
const viewCoordProjetos = document.getElementById('view-coord-projetos');
const classHubView = document.getElementById('class-hub-view'); 
const classView = document.getElementById('class-view'); 
const studentDetailView = document.getElementById('student-detail-view'); 
const viewClassForum = document.getElementById('view-class-forum'); 
const viewClassHorario = document.getElementById('view-class-horario');
const viewAdminUtilizadores = document.getElementById('view-admin-utilizadores');

let alunoAtualId = ""; 
let turmaAtual = ""; 
let myUserName = ""; 
let myUserId = "";
let nomePessoaContactoModal = ""; 
let forumAtivoId = null;
let tabUsersAtiva = 'professor';

const nomeCurto = (nomeStr) => { if(!nomeStr) return 'Desconhecido'; const p = nomeStr.split(' '); return p.length > 1 ? `${p[0]} ${p[p.length-1]}` : p[0]; };

function esconderTudoMenos(vistaAtiva) {
    const todasAsVistas = document.querySelectorAll('main.app-content > div');
    todasAsVistas.forEach(vista => { vista.style.display = 'none'; });
    if(vistaAtiva) { vistaAtiva.style.display = 'block'; }
}

// ==========================================
// 1. SEGURANÇA E INICIALIZAÇÃO ADMIN
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                if(dados.papel !== 'admin') {
                    window.location.href = "index.html"; 
                    return;
                }
                myUserName = dados.nome.split(' ')[0];
                document.getElementById('header-user-name-staff').innerText = `Olá, ${myUserName}`;
                document.getElementById('header-staff').style.display = 'flex';
                esconderTudoMenos(adminDashboard);
                carregarEstatisticaRiscoGlobal();
            }
        } catch (e) { console.error(e); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-staff')?.addEventListener('click', () => { signOut(auth).then(() => window.location.href = "index.html"); });

// NAVEGAÇÃO BOTTOM NAV E VOLTAR
document.body.addEventListener('click', (e) => {
    const nav = e.target.closest('.nav-item');
    if (nav) {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); nav.classList.add('active');
        esconderTudoMenos();
        const tId = nav.getAttribute('data-target');
        document.getElementById(tId).style.display = (tId === 'view-class-forum') ? 'flex' : 'block';
        
        if (tId === 'admin-dashboard') { carregarEstatisticaRiscoGlobal(); }
        if (tId === 'view-coord-projetos') carregarListaProjetos('TUR');
        if (tId === 'view-class-forum') { turmaAtual = 'TUR'; carregarTodosForunsAdmin(); }
    }
});

document.querySelectorAll('.turma-card-large').forEach(botao => {
    botao.addEventListener('click', () => {
        turmaAtual = botao.getAttribute('data-turma'); 
        if(turmaAtual === 'TUR') { 
            document.getElementById('class-title').innerHTML = `<i class="fa-solid fa-globe"></i> Toda a Escola`; 
            esconderTudoMenos(classView); carregarAlunos('TUR'); 
        } else { 
            document.getElementById('class-hub-title').innerHTML = `Turma ${turmaAtual}`; 
            esconderTudoMenos(classHubView); 
        }
    });
});

document.getElementById('btn-voltar-turmas-hub')?.addEventListener('click', () => esconderTudoMenos(viewAdminTurmas));
document.getElementById('btn-voltar-class-hub')?.addEventListener('click', () => { if(turmaAtual === 'TUR') esconderTudoMenos(viewAdminTurmas); else esconderTudoMenos(classHubView); });
document.getElementById('btn-voltar-lista')?.addEventListener('click', () => { 
    alternarModoEdicaoFicha(false); 
    esconderTudoMenos(classView); 
});
document.getElementById('btn-voltar-canais')?.addEventListener('click', () => { document.getElementById('forum-chat-view').style.display = 'none'; document.getElementById('forum-channel-list').style.display = 'block'; });
document.getElementById('btn-voltar-horario-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));
document.getElementById('btn-voltar-admin-users')?.addEventListener('click', () => esconderTudoMenos(adminDashboard));

// ACESSOS A PARTIR DO HUB DA TURMA
document.getElementById('btn-hub-alunos')?.addEventListener('click', () => { 
    document.getElementById('class-title').innerHTML = `<i class="fa-solid fa-users"></i> Turma ${turmaAtual}`;
    esconderTudoMenos(classView); 
    carregarAlunos(turmaAtual); 
});
document.getElementById('btn-hub-forum')?.addEventListener('click', () => { esconderTudoMenos(viewClassForum); carregarTodosForunsAdmin(turmaAtual); });
document.getElementById('btn-hub-horario')?.addEventListener('click', () => { esconderTudoMenos(viewClassHorario); carregarHorario(); });

// ==========================================
// CARREGAR ALUNOS E GESTÃO DA FICHA DIRETA
// ==========================================
let containerAlunosGlobal = null;

async function carregarAlunos(turmaEscolhida) {
    // CORREÇÃO: Força o código a buscar a lista estritamente dentro da vista da turma
    containerAlunosGlobal = document.querySelector('#class-view .students-list-container'); 
    if(!containerAlunosGlobal) return;
    containerAlunosGlobal.innerHTML = '<p class="text-muted">A carregar...</p>';
    
    try {
        const q = turmaEscolhida === 'TUR' ? query(collection(db, "utilizadores"), where("papel", "==", "aluno")) : query(collection(db, "utilizadores"), where("turma", "==", turmaEscolhida), where("papel", "==", "aluno"));
        const res = await getDocs(q); 
        if (res.empty) { containerAlunosGlobal.innerHTML = '<p class="text-muted">Sem alunos.</p>'; return; }
        
        let html = '<ul class="students-list">';
        res.forEach((doc) => {
            const aluno = doc.data(); 
            const tagTurma = turmaEscolhida === 'TUR' ? ` (${aluno.turma})` : '';
            const miniatura = aluno.fotoPerfil ? `<img src="${aluno.fotoPerfil}" class="list-avatar" style="flex-shrink:0;">` : `<div class="list-avatar" style="flex-shrink:0;"><i class="fa-solid fa-user"></i></div>`;
            
            // O segredo do alinhamento está nos estilos "flex:1" e "min-width:0" adicionados abaixo
            html += `
            <li class="student-item" style="display:flex; justify-content:space-between; align-items:center; gap:10px; overflow:hidden; padding: 12px;">
                <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0; overflow:hidden;">
                    ${miniatura}
                    <div class="student-info" style="display:flex; flex-direction:column; min-width:0; overflow:hidden; flex:1;">
                        <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${aluno.nome}${tagTurma}</strong>
                        <span style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${doc.id.toLowerCase()}</span>
                    </div>
                </div>
                <button class="secondary-btn small-btn btn-ver-aluno" data-nome="${aluno.nome}" data-numero="${doc.id}" data-turma="${aluno.turma}" style="flex-shrink:0;">
                    <i class="fa-solid fa-eye"></i> Ver
                </button>
            </li>`;
        });
        containerAlunosGlobal.innerHTML = html + '</ul>';
        
        // ABRIR PERFIL DO ALUNO (MODO LEITURA)
        containerAlunosGlobal.querySelectorAll('.btn-ver-aluno').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                alunoAtualId = e.currentTarget.getAttribute('data-numero'); 
                const nomeAlunoCol = e.currentTarget.getAttribute('data-nome');
                
                document.getElementById('detail-student-name').innerText = nomeAlunoCol;
                document.getElementById('detail-student-number').innerText = alunoAtualId.toUpperCase();
                
                const turmaDesteAluno = e.currentTarget.getAttribute('data-turma') || "";
                const anoMatch = turmaDesteAluno.match(/\d+/);
                const ano = anoMatch ? parseInt(anoMatch[0]) : 0;
                
                const btnFctPap = document.getElementById('btn-hub-fct-pap');
                if (btnFctPap) { if (ano === 10) { btnFctPap.style.display = 'none'; } else { btnFctPap.style.display = 'flex'; } }

                alternarModoEdicaoFicha(false);
                esconderTudoMenos(studentDetailView); 
                document.getElementById('avatar-img').style.display = 'none'; 
                document.getElementById('avatar-icon').style.display = 'block';
                
                try {
                    const docSnap = await getDoc(doc(db, "utilizadores", alunoAtualId));
                    if (docSnap.exists()) {
                        const d = docSnap.data();
                        if(d.fotoPerfil) { 
                            document.getElementById('avatar-img').src = d.fotoPerfil; 
                            document.getElementById('avatar-img').style.display = 'block'; 
                            document.getElementById('avatar-icon').style.display = 'none'; 
                        }
                        document.getElementById('detail-student-name').innerText = d.nome || nomeAlunoCol;
                        document.getElementById('display-aluno-idade').innerText = d.idade || "-"; 
                        document.getElementById('display-aluno-tel').innerText = d.telAluno || "-"; 
                        document.getElementById('display-aluno-email').innerText = d.emailAluno || "-"; 
                        document.getElementById('display-aluno-morada').innerText = d.morada || "-"; 
                        document.getElementById('display-ee-nome').innerText = d.nomeEE || "-"; 
                        document.getElementById('display-ee-filiacao').innerText = d.filiacaoEE || "-"; 
                        document.getElementById('display-ee-tel').innerText = d.telEE || "-"; 
                        document.getElementById('display-ee-email').innerText = d.emailEE || "-";
                    }
                } catch(e){}
            });
        });
    } catch (e) {}
}

// GUARDAR ALTERAÇÕES DA FICHA 
document.getElementById('btn-guardar-ficha-edicao')?.addEventListener('click', async (e) => {
    if(!alunoAtualId) return;
    const nomeNovo = document.getElementById('edit-aluno-nome').value.trim();
    if(!nomeNovo) return alert("O Nome do aluno não pode estar vazio!");

    const btnRef = e.currentTarget;
    btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...';
    btnRef.disabled = true;

    try {
        const dadosAtualizados = {
            nome: nomeNovo,
            turma: document.getElementById('edit-aluno-turma').value.trim().toUpperCase(),
            idade: document.getElementById('edit-aluno-idade').value.trim(),
            telAluno: document.getElementById('edit-aluno-tel').value.trim(),
            emailAluno: document.getElementById('edit-aluno-email').value.trim(),
            morada: document.getElementById('edit-aluno-morada').value.trim(),
            nomeEE: document.getElementById('edit-ee-nome').value.trim(),
            filiacaoEE: document.getElementById('edit-ee-filiacao').value.trim(),
            telEE: document.getElementById('edit-ee-tel').value.trim(),
            emailEE: document.getElementById('edit-ee-email').value.trim()
        };

        await updateDoc(doc(db, "utilizadores", alunoAtualId), dadosAtualizados);
        await registarLogAuditoria(`Atualizou diretamente a ficha do aluno ${nomeNovo}`);

        document.getElementById('detail-student-name').innerText = nomeNovo;
        document.getElementById('display-aluno-idade').innerText = dadosAtualizados.idade || "-"; 
        document.getElementById('display-aluno-tel').innerText = dadosAtualizados.telAluno || "-"; 
        document.getElementById('display-aluno-email').innerText = dadosAtualizados.emailAluno || "-"; 
        document.getElementById('display-aluno-morada').innerText = dadosAtualizados.morada || "-"; 
        document.getElementById('display-ee-nome').innerText = dadosAtualizados.nomeEE || "-"; 
        document.getElementById('display-ee-filiacao').innerText = dadosAtualizados.filiacaoEE || "-"; 
        document.getElementById('display-ee-tel').innerText = dadosAtualizados.telEE || "-"; 
        document.getElementById('display-ee-email').innerText = dadosAtualizados.emailEE || "-";

        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Gravado com Sucesso!';
        setTimeout(() => {
            btnRef.innerHTML = 'Guardar Alterações';
            btnRef.disabled = false;
            alternarModoEdicaoFicha(false); 
        }, 1200);
    } catch(err) {
        alert("Erro ao gravar alterações.");
        btnRef.innerHTML = 'Guardar Alterações';
        btnRef.disabled = false;
    }
});

// APAGAR ALUNO A PARTIR DA FICHA
document.getElementById('btn-apagar-aluno-ficha')?.addEventListener('click', async () => {
    if(!alunoAtualId) return;
    if(!confirm("Tem a certeza absoluta que deseja APAGAR este aluno? A ação é irreversível!")) return;

    try {
        await deleteDoc(doc(db, "utilizadores", alunoAtualId));
        await registarLogAuditoria(`Eliminou o perfil do aluno (${alunoAtualId})`);
        alternarModoEdicaoFicha(false);
        esconderTudoMenos(classView);
        if(containerAlunosGlobal) {
            carregarAlunos(turmaAtual);
        }
    } catch(err) {
        alert("Erro ao apagar o perfil.");
    }
});

// ==========================================
// 2. DASHBOARD GLOBAL
// ==========================================
async function carregarEstatisticaRiscoGlobal() {
    const container = document.getElementById('admin-risco-content');
    try {
        let alunosEmRiscoFull = [];
        const snap = await getDocs(query(collection(db, "utilizadores"), where("papel", "==", "aluno")));
        for(const docAl of snap.docs) {
            let countPRHF = 0; let countFaltas = 0;
            const pSnap = await getDocs(collection(db, "utilizadores", docAl.id, "prhfs"));
            pSnap.forEach(p => { if (p.data().status !== 'concluida') countPRHF++; });
            const fSnap = await getDocs(collection(db, "utilizadores", docAl.id, "faltas"));
            fSnap.forEach(f => { if (!f.data().justificada) countFaltas += Number(f.data().horas || 0); });
            
            if (countPRHF >= 2 || countFaltas >= 10) {
                alunosEmRiscoFull.push({ id: docAl.id, nome: docAl.data().nome, turma: docAl.data().turma, faltas: countFaltas, prhfs: countPRHF });
            }
        }
        alunosEmRiscoFull.sort((a,b) => (b.prhfs * 10 + b.faltas) - (a.prhfs * 10 + a.faltas));
        
        let htmlRisco = '';
        if(alunosEmRiscoFull.length === 0) {
            htmlRisco = '<p class="text-success center" style="margin:0;"><i class="fa-solid fa-shield-halved"></i> Escola Saudável! Sem alunos críticos.</p>';
        } else {
            alunosEmRiscoFull.slice(0,5).forEach(ar => {
                htmlRisco += `
                <div class="aluno-list-item" data-id="${ar.id}" style="border-left: 4px solid var(--danger-red); margin-bottom:10px; cursor:pointer; padding:10px; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); border-radius:6px; border-top:1px solid #333; border-right:1px solid #333; border-bottom:1px solid #333;">
                    <div>
                        <strong style="color:white;">${nomeCurto(ar.nome)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${ar.turma})</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.75rem; color:var(--warning-yellow);">${ar.prhfs} PRHFs</span> | 
                        <span style="font-size:0.75rem; color:var(--danger-red); font-weight:bold;">${ar.faltas}h Faltas</span>
                    </div>
                </div>`;
            });
        }
        container.innerHTML = htmlRisco;
        container.querySelectorAll('.aluno-list-item').forEach(card => card.addEventListener('click', async (e) => {
            alunoAtualId = e.currentTarget.getAttribute('data-id');
            const dS = await getDoc(doc(db, "utilizadores", alunoAtualId));
            if(dS.exists()) {
                document.getElementById('detail-student-name').innerText = dS.data().nome; 
                document.getElementById('detail-student-number').innerText = alunoAtualId.toUpperCase();
                esconderTudoMenos(studentDetailView);
            }
        }));
    } catch(e) {}
}

// ==========================================
// 3. HORÁRIO DA TURMA (ADMIN)
// ==========================================
let modoEdicaoHorario = false; 
let slotSelecionado = null;
let dataInicioSemana = new Date(); 
dataInicioSemana.setDate(dataInicioSemana.getDate() - (dataInicioSemana.getDay() === 0 ? 6 : dataInicioSemana.getDay() - 1));

document.getElementById('btn-prev-week')?.addEventListener('click', () => { dataInicioSemana.setDate(dataInicioSemana.getDate() - 7); carregarHorario(); });
document.getElementById('btn-next-week')?.addEventListener('click', () => { dataInicioSemana.setDate(dataInicioSemana.getDate() + 7); carregarHorario(); });

function formatarDataHeader(dt) { const dp = String(dt.getDate()).padStart(2,'0'); const mp = String(dt.getMonth()+1).padStart(2,'0'); return `${dp}/${mp}`; }
function dataParaStringDb(dt) { const y = dt.getFullYear(); const m = String(dt.getMonth()+1).padStart(2,'0'); const d = String(dt.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; }

document.getElementById('btn-editar-horario')?.addEventListener('click', (e) => {
    modoEdicaoHorario = true; 
    e.currentTarget.style.display = 'none'; 
    document.getElementById('btn-salvar-horario').style.display = 'flex';
    document.querySelectorAll('.horario-slot').forEach(slot => slot.classList.add('edit-mode'));
});

document.getElementById('btn-salvar-horario')?.addEventListener('click', (e) => {
    modoEdicaoHorario = false; 
    e.currentTarget.style.display = 'none'; 
    document.getElementById('btn-editar-horario').style.display = 'flex';
    document.querySelectorAll('.horario-slot').forEach(slot => slot.classList.remove('edit-mode'));
});

document.querySelectorAll('.horario-slot').forEach(slot => {
    slot.addEventListener('click', async (e) => {
        if(modoEdicaoHorario) {
            slotSelecionado = e.currentTarget; 
            let opt = '<option value="">Sem Aula (Limpar)</option>';
            
            try {
                const snapEstrutura = await getDocs(collection(db, "estrutura_modular"));
                let disciplinasUnicas = new Set();
                
                snapEstrutura.forEach(docSnap => {
                    const dados = docSnap.data();
                    if(dados.disciplina) { disciplinasUnicas.add(dados.disciplina); }
                });
                
                const disciplinasOrdenadas = Array.from(disciplinasUnicas).sort();
                disciplinasOrdenadas.forEach(disc => { opt += `<option value="${disc}">${disc}</option>`; });
            } catch (err) {}
            
            opt += `<option disabled>──────────</option><option value="ALM">Almoço</option><option value="Visita">Visita Estudo</option><option value="FCT">FCT</option><option value="PAP">PAP</option><option value="PRHF">PRHF</option>`;
            
            document.getElementById('ed-horario-disc').innerHTML = opt; 
            document.getElementById('modal-editar-horario').style.display = 'flex';
        }
    });
});

document.getElementById('btn-cancelar-bloco-horario')?.addEventListener('click', () => document.getElementById('modal-editar-horario').style.display = 'none');
document.getElementById('btn-gravar-bloco-horario')?.addEventListener('click', async (e) => {
    if(!slotSelecionado) return; 
    const novaDisc = document.getElementById('ed-horario-disc').value;
    const dataReal = slotSelecionado.getAttribute('data-datareal'); 
    const horaId = slotSelecionado.getAttribute('data-hora');
    const btnRef = e.currentTarget; 
    btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try { 
        await setDoc(doc(db, "turmas", turmaAtual), { horario: { [`${dataReal}_${horaId}`]: novaDisc } }, {merge:true}); 
        document.getElementById('modal-editar-horario').style.display = 'none'; 
        btnRef.innerText = "Confirmar"; 
        carregarHorario(); 
    } catch(err) { btnRef.innerText = "Erro!"; }
});

async function carregarHorario() {
    const diasUIAbrv = ['seg', 'ter', 'qua', 'qui', 'sex']; 
    let endOfWeek = new Date(dataInicioSemana); endOfWeek.setDate(endOfWeek.getDate() + 4);
    document.getElementById('week-display').innerText = `${formatarDataHeader(dataInicioSemana)} a ${formatarDataHeader(endOfWeek)}`;
    let iterDate = new Date(dataInicioSemana);
    
    for(let i=0; i<5; i++) {
        const dStr = dataParaStringDb(iterDate); 
        document.getElementById(`h-${diasUIAbrv[i]}-dt`).innerText = formatarDataHeader(iterDate);
        document.querySelectorAll(`.horario-slot[data-dia="${diasUIAbrv[i]}"]`).forEach(s => s.setAttribute('data-datareal', dStr)); 
        iterDate.setDate(iterDate.getDate() + 1);
    }
    
    document.querySelectorAll('.horario-slot').forEach(slot => { slot.innerHTML = ""; slot.classList.remove('filled'); });
    
    try {
        const docSnap = await getDoc(doc(db, "turmas", turmaAtual)); 
        let horarioBase = {}; 
        if(docSnap.exists() && docSnap.data().horario) horarioBase = docSnap.data().horario;
        
        for(const key in horarioBase) {
            const [dataReal, hora] = key.split('_'); 
            const disc = horarioBase[key]; 
            const slot = document.querySelector(`.horario-slot[data-datareal="${dataReal}"][data-hora="${hora}"]`);
            if(slot && disc) { 
                slot.innerHTML = `<strong>${disc}</strong>`; 
                slot.classList.add('filled'); 
            }
        }
    } catch(err){}
}

// ==========================================
// 4. FÓRUNS
// ==========================================
document.getElementById('btn-novo-forum')?.addEventListener('click', async () => { 
    document.getElementById('modal-novo-forum').style.display = 'flex'; const cList = document.getElementById('novo-forum-membros-list'); cList.innerHTML = '<p class="text-muted" style="text-align:center;">A procurar...</p>';
    try { const qAlunos = turmaAtual === 'TUR' ? query(collection(db, "utilizadores"), where("papel", "==", "aluno")) : query(collection(db, "utilizadores"), where("turma", "==", turmaAtual), where("papel", "==", "aluno")); const snapshot = await getDocs(qAlunos); let h = ''; snapshot.forEach(d => { h += `<label class="membro-checkbox-item"><input type="checkbox" class="cb-membro-forum" value="${d.id}" checked> ${d.data().nome} (${d.data().turma})</label>`; }); cList.innerHTML = h || '<p class="text-muted" style="text-align:center;">Sem alunos registados.</p>'; } catch(e) {}
});

// CORREÇÃO: Fechar o modal do novo fórum
document.getElementById('btn-cancelar-forum')?.addEventListener('click', () => {
    document.getElementById('modal-novo-forum').style.display = 'none';
});

document.getElementById('btn-selecionar-todos-forum')?.addEventListener('click', () => { const cbs = document.querySelectorAll('.cb-membro-forum'); const todosMarcados = Array.from(cbs).every(cb => cb.checked); cbs.forEach(cb => cb.checked = !todosMarcados); });
document.getElementById('novo-forum-tipo')?.addEventListener('change', (e) => { document.getElementById('box-forum-expira').style.display = e.target.value === 'temporario' ? 'block' : 'none'; });

document.getElementById('btn-gravar-forum')?.addEventListener('click', async (e) => {
    const nome = document.getElementById('novo-forum-nome').value.trim(); const tipo = document.getElementById('novo-forum-tipo').value; const expira = document.getElementById('novo-forum-expira').value;
    if(!nome) return alert("Dá um nome ao canal!"); let membrosSelecionados = []; document.querySelectorAll('.cb-membro-forum:checked').forEach(cb => membrosSelecionados.push(cb.value));
    if(membrosSelecionados.length === 0) return alert("Tens de adicionar pelo menos 1 membro!");
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try { await addDoc(collection(db, "turmas", turmaAtual === 'TUR' ? 'Global' : turmaAtual, "foruns"), { nome: nome, tipo: tipo, expiraEm: tipo==='temporario'?expira:'', membros: membrosSelecionados, criadoEm: new Date().toISOString() }); document.getElementById('modal-novo-forum').style.display = 'none'; document.getElementById('novo-forum-nome').value = ""; btnRef.innerText = "Criar"; carregarTodosForunsAdmin(); } catch(err) { btnRef.innerText = "Erro!"; }
});

// --- Lógica de Filtro dos Fóruns (Abas) ---
let filtroForumAtual = 'Todos';

document.querySelectorAll('.tab-forum-filter').forEach(btn => {
    btn.addEventListener('click', (e) => {
        document.querySelectorAll('.tab-forum-filter').forEach(b => b.classList.remove('active'));
        e.currentTarget.classList.add('active');
        filtroForumAtual = e.currentTarget.getAttribute('data-filter');
        carregarTodosForunsAdmin(); // Recarrega a lista baseada na aba selecionada
    });
});
// ------------------------------------------

async function carregarTodosForunsAdmin(turmaFiltro = 'TUR') {
    const container = document.getElementById('lista-canais-forum'); 
    container.innerHTML = '<p class="text-muted center">A procurar canais...</p>';
    try {
        let html = '';
        let turmasPesquisa = [];
        
        if (turmaAtual !== 'TUR') {
            turmasPesquisa = [turmaAtual];
            document.getElementById('tabs-filtro-foruns').style.display = 'none'; 
        } else {
            document.getElementById('tabs-filtro-foruns').style.display = 'flex'; 
            if (filtroForumAtual === 'Todos') {
                turmasPesquisa = ['Global', '10T', '11T', '12T']; // "Todos" apanha logo tudo
            } else {
                turmasPesquisa = [filtroForumAtual];
            }
        }
        
        for (const t of turmasPesquisa) {
            const res = await getDocs(query(collection(db, "turmas", t, "foruns"))); 
            if(!res.empty) {
                // Título agrupador melhorado
                if(filtroForumAtual === 'Todos' && turmaAtual === 'TUR') {
                    const tituloSeparador = t === 'Global' ? 'Canais Globais da Escola' : `Turma ${t}`;
                    html += `<h4 style="width:100%; color:#9b59b6; border-bottom:1px solid #333; padding-bottom:5px; margin-top:15px; font-size: 0.95rem;"><i class="fa-solid fa-layer-group"></i> ${tituloSeparador}</h4>`;
                }

                res.forEach(docSnap => { 
                    const f = docSnap.data(); 
                    const nomeCanal = f.nome || f.titulo || f.assunto || "Canal sem nome";
                    const icon = f.tipo === 'permanente' ? 'fa-comments' : 'fa-stopwatch'; 
                    const corIcone = f.tipo === 'permanente' ? 'var(--primary-green)' : '#ff8c42';
                    
                    html += `
                    <div class="card canal-card" data-id="${docSnap.id}" data-turma="${t}" data-json='${JSON.stringify({ ...f, nome: nomeCanal })}' style="cursor:pointer; display:flex; align-items:center; gap:15px; padding:15px; margin-bottom:0; transition: 0.2s;">
                        <div style="width: 45px; height: 45px; border-radius: 50%; background: rgba(255,255,255,0.05); display: flex; align-items: center; justify-content: center; color: ${corIcone}; font-size: 1.2rem; flex-shrink:0;">
                            <i class="fa-solid ${icon}"></i>
                        </div>
                        <div style="flex:1; min-width:0;">
                            <h4 style="margin: 0 0 4px 0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; font-size: 1.05rem;">${nomeCanal}</h4>
                            <p style="margin:0; font-size:0.8rem; color:var(--text-muted);"><i class="fa-solid fa-users"></i> ${f.membros ? f.membros.length : 0} Membro(s)</p>
                        </div>
                        <i class="fa-solid fa-chevron-right" style="color:var(--text-muted);"></i>
                    </div>`; 
                });
            }
        }
        
        if(html === '') { 
            container.innerHTML = '<p class="text-muted center" style="margin-top:20px;">Sem fóruns criados nesta secção.</p>'; 
            return; 
        }
        container.innerHTML = html;
        
        container.querySelectorAll('.canal-card').forEach(card => card.addEventListener('click', (e) => { 
            const fData = JSON.parse(e.currentTarget.getAttribute('data-json')); 
            forumAtivoId = e.currentTarget.getAttribute('data-id'); 
            const fTurma = e.currentTarget.getAttribute('data-turma');
            document.getElementById('chat-active-title').innerText = `${fData.nome} (${fTurma})`; 
            document.getElementById('forum-channel-list').style.display = 'none'; 
            document.getElementById('forum-chat-view').style.display = 'flex'; 
            iniciarChatGlobal(fTurma, forumAtivoId); 
        }));
    } catch(err) {
        console.error("Erro ao carregar os fóruns:", err);
    }
}

let chatUnsubscribeAdmin = null;
function iniciarChatGlobal(fTurma, fId) {
    const chatContainer = document.getElementById('chat-messages-container'); 
    chatContainer.innerHTML = ''; 
    if(chatUnsubscribeAdmin) chatUnsubscribeAdmin();
    
    chatUnsubscribeAdmin = onSnapshot(query(collection(db, "turmas", fTurma, "foruns", fId, "mensagens"), orderBy("timestamp")), (snapshot) => { 
        let html = ''; 
        snapshot.forEach(doc => { 
            const msg = doc.data(); 
            const isMe = msg.remetente === myUserName; 
            const classe = isMe ? 'admin' : 'student'; 
            html += `<div class="chat-bubble ${classe}"><strong>${isMe ? 'Tu' : msg.remetente}</strong><br>${msg.texto}<span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>`; 
        }); 
        chatContainer.innerHTML = html; 
        chatContainer.scrollTop = chatContainer.scrollHeight; 
    });
    
    const enviarMensagem = async () => {
        const inp = document.getElementById('input-forum-msg'); 
        const txt = inp.value.trim(); 
        if(!txt || !forumAtivoId) return; 
        try { 
            await addDoc(collection(db, "turmas", fTurma, "foruns", forumAtivoId, "mensagens"), { remetente: myUserName, texto: txt, timestamp: Date.now() }); 
            inp.value = ''; 
        } catch(e){}
    };

    const btnSend = document.getElementById('btn-send-msg');
    const novoBtnSend = btnSend.cloneNode(true); 
    btnSend.parentNode.replaceChild(novoBtnSend, btnSend);
    novoBtnSend.addEventListener('click', enviarMensagem);

    const inputMsg = document.getElementById('input-forum-msg');
    const novoInputMsg = inputMsg.cloneNode(true);
    inputMsg.parentNode.replaceChild(novoInputMsg, inputMsg);
    novoInputMsg.addEventListener('keypress', (e) => { if (e.key === 'Enter') enviarMensagem(); });

    const btnApagarCanal = document.getElementById('btn-apagar-canal');
    const novoBtnApagar = btnApagarCanal.cloneNode(true);
    btnApagarCanal.parentNode.replaceChild(novoBtnApagar, btnApagarCanal);
    novoBtnApagar.addEventListener('click', async () => {
        if(!confirm("Tem a certeza absoluta que deseja eliminar este canal de fórum e todas as suas mensagens?")) return;
        try {
            await deleteDoc(doc(db, "turmas", fTurma, "foruns", fId));
            await registarLogAuditoria(`Eliminou o canal de fórum (${fId})`);
            document.getElementById('forum-chat-view').style.display = 'none'; 
            document.getElementById('forum-channel-list').style.display = 'block';
            carregarTodosForunsAdmin(turmaAtual);
        } catch(err) { alert("Erro ao apagar o canal."); }
    });
}

// ==========================================
// 5. INFORMAÇÕES PESSOAIS E FECHO DE MODAIS (LIMPO DE DUPLICADOS)
// ==========================================
document.querySelectorAll('.btn-fechar-modal').forEach(b => b.addEventListener('click', () => { 
    const modais = ['modal-telefone', 'modal-email', 'modal-dt-fct-pap', 'modal-novo-forum', 'modal-novo-utilizador', 'modal-admin-editar-aluno', 'modal-atribuir-professor', 'modal-editar-horario', 'modal-admin-projetos'];
    modais.forEach(id => { const m = document.getElementById(id); if(m) m.style.display = 'none'; });
}));

document.addEventListener('click', (e) => { 
    if (e.target.classList.contains('clickable-contact')) { 
        const tipo = e.target.getAttribute('data-type'); 
        const valor = e.target.innerText; 
        if(valor === "-" || valor === "") return; 
        nomePessoaContactoModal = document.getElementById('detail-student-name').innerText; 
        window.contactoTemp = valor; 
        if (tipo === 'tel') { document.getElementById('action-ligar').href = `tel:${valor}`; document.getElementById('modal-telefone').style.display = 'flex'; } 
        else if (tipo === 'email') { document.getElementById('action-enviar-email').href = `mailto:${valor}`; document.getElementById('modal-email').style.display = 'flex'; } 
    } 
});

document.getElementById('btn-admin-editar-aluno')?.addEventListener('click', () => {
    if(!alunoAtualId) return;
    const nomeAtual = document.getElementById('detail-student-name').innerText;
    document.getElementById('ea-nome').value = nomeAtual; 
    document.getElementById('ea-turma').value = turmaAtual === 'TUR' ? '' : turmaAtual;
    document.getElementById('modal-admin-editar-aluno').style.display = 'flex';
});

// ==========================================
// 6. MÓDULO ADMIN: GESTÃO DE UTILIZADORES
// ==========================================
document.getElementById('btn-ir-utilizadores')?.addEventListener('click', () => {
    esconderTudoMenos(viewAdminUtilizadores);
    carregarListaUtilizadores();
});

document.getElementById('tab-usr-prof')?.addEventListener('click', (e) => { tabUsersAtiva = 'professor'; atualizarTabsUsers(e.currentTarget); carregarListaUtilizadores(); });
document.getElementById('tab-usr-aluno')?.addEventListener('click', (e) => { tabUsersAtiva = 'aluno'; atualizarTabsUsers(e.currentTarget); carregarListaUtilizadores(); });
document.getElementById('tab-usr-ee')?.addEventListener('click', (e) => { tabUsersAtiva = 'ee'; atualizarTabsUsers(e.currentTarget); carregarListaUtilizadores(); });

function atualizarTabsUsers(btnAtivo) {
    document.querySelectorAll('.tab-usr-btn').forEach(b => b.classList.remove('active'));
    if(btnAtivo) btnAtivo.classList.add('active');
}

async function carregarListaUtilizadores() {
    const container = document.getElementById('lista-utilizadores-container');
    container.innerHTML = '<p class="text-muted center">A procurar utilizadores...</p>';
    try {
        const snap = await getDocs(query(collection(db, "utilizadores"), where("papel", "==", tabUsersAtiva)));
        if(snap.empty) { container.innerHTML = `<p class="text-muted center">Sem registos de ${tabUsersAtiva}.</p>`; return; }
        
        let html = '';
        snap.forEach(docSnap => {
            const u = docSnap.data();
            const id = docSnap.id;
            let detalhes = '';
            
            if (tabUsersAtiva === 'professor') {
                const turmasStr = Array.isArray(u.turmas) ? u.turmas.join(', ') : (u.turmas || 'Nenhuma'); 
                const discsStr = Array.isArray(u.disciplinas) ? u.disciplinas.join(', ') : (u.disciplinas || 'Nenhuma');
                detalhes = `<i class="fa-solid fa-users"></i> Turmas: ${turmasStr} | <i class="fa-solid fa-book"></i> Disciplinas: ${discsStr}`;
            } else if (tabUsersAtiva === 'aluno') {
                detalhes = `<i class="fa-solid fa-graduation-cap"></i> Turma: ${u.turma || 'Sem turma'}`;
            } else {
                detalhes = `<i class="fa-solid fa-child"></i> Enc. Educação`;
            }

            html += `
            <div class="card" style="margin-bottom: 12px; background: rgba(0,0,0,0.2); border-left: 4px solid var(--primary-green);">
                <div style="display:flex; justify-content:space-between; align-items:center;">
                    <div>
                        <strong style="color:white; font-size:1rem;">${u.nome}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${id})</span>
                        <div style="font-size:0.85rem; color:var(--text-light); margin-top:4px;">${detalhes}</div>
                    </div>
                    <button class="secondary-btn small-btn btn-editar-user" data-id="${id}" data-json='${JSON.stringify(u)}' style="border-color:var(--warning-yellow); color:var(--warning-yellow);"><i class="fa-solid fa-pen"></i> Editar</button>
                </div>
            </div>`;
        });
        container.innerHTML = html;

        container.querySelectorAll('.btn-editar-user').forEach(btn => btn.addEventListener('click', (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const u = JSON.parse(e.currentTarget.getAttribute('data-json'));
            
            if (tabUsersAtiva === 'professor') {
                document.getElementById('ap-id').value = id; 
                document.getElementById('ap-nome').value = u.nome; 
                document.getElementById('ap-turmas').value = Array.isArray(u.turmas) ? u.turmas.join(', ') : (u.turmas || ''); 
                document.getElementById('ap-disciplinas').value = Array.isArray(u.disciplinas) ? u.disciplinas.join(', ') : (u.disciplinas || ''); 
                document.getElementById('modal-atribuir-professor').style.display = 'flex';
            } else {
                alunoAtualId = id; 
                document.getElementById('ea-nome').value = u.nome; 
                document.getElementById('ea-turma').value = u.turma || ''; 
                document.getElementById('modal-admin-editar-aluno').style.display = 'flex';
            }
        }));
    } catch(e) { container.innerHTML = '<p class="text-danger center">Erro ao carregar utilizadores.</p>'; }
}

document.getElementById('btn-admin-novo-user')?.addEventListener('click', () => {
    document.getElementById('nu-id').value = ""; document.getElementById('nu-nome').value = ""; document.getElementById('nu-turma').value = "";
    document.getElementById('nu-papel').value = tabUsersAtiva;
    document.getElementById('modal-novo-utilizador').style.display = 'flex';
});

document.getElementById('btn-gravar-novo-user')?.addEventListener('click', async (e) => {
    const id = document.getElementById('nu-id').value.trim().toLowerCase(); const nome = document.getElementById('nu-nome').value.trim();
    const papel = document.getElementById('nu-papel').value; const turma = document.getElementById('nu-turma').value.trim().toUpperCase();
    if(!id || !nome) return alert("Tens de preencher pelo menos o ID e o Nome!");
    if((papel === 'aluno' || papel === 'dt') && !turma) return alert("Alunos e DTs precisam de ter uma Turma preenchida!");
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A criar...'; btnRef.disabled = true;
    try {
        const novoUser = { nome: nome, papel: papel };
        if(papel === 'aluno' || papel === 'dt') novoUser.turma = turma;
        if(papel === 'professor') novoUser.turmas = turma ? [turma] : [];
        await setDoc(doc(db, "utilizadores", id), novoUser);
        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Perfil Criado!';
        setTimeout(() => { document.getElementById('modal-novo-utilizador').style.display = 'none'; btnRef.innerHTML = 'Criar Ficha na Base de Dados'; btnRef.disabled = false; carregarListaUtilizadores(); }, 1500);
    } catch(err) { console.error("Erro a criar perfil", err); btnRef.innerHTML = 'Erro ao criar!'; setTimeout(() => { btnRef.innerHTML = 'Criar Ficha na Base de Dados'; btnRef.disabled = false; }, 2000); }
});

document.getElementById('btn-gravar-edicao-aluno')?.addEventListener('click', async (e) => {
    const nomeNovo = document.getElementById('ea-nome').value.trim(); const turmaNova = document.getElementById('ea-turma').value.trim().toUpperCase();
    if(!nomeNovo) return alert("O Nome não pode estar vazio!");
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...'; btnRef.disabled = true;
    try {
        await updateDoc(doc(db, "utilizadores", alunoAtualId), { nome: nomeNovo, turma: turmaNova });
        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Gravado!';
        setTimeout(() => { document.getElementById('modal-admin-editar-aluno').style.display = 'none'; btnRef.innerHTML = 'Guardar Alterações'; btnRef.disabled = false; carregarListaUtilizadores(); }, 1500);
    } catch(err) { btnRef.innerHTML = 'Erro!'; setTimeout(() => { btnRef.innerHTML = 'Guardar Alterações'; btnRef.disabled = false; }, 2000); }
});

document.getElementById('btn-gravar-atribuicao-prof')?.addEventListener('click', async (e) => {
    const id = document.getElementById('ap-id').value.trim().toLowerCase(); const nome = document.getElementById('ap-nome').value.trim();
    const turmas = document.getElementById('ap-turmas').value.trim().toUpperCase().split(',').map(s => s.trim()).filter(Boolean); const disciplinas = document.getElementById('ap-disciplinas').value.trim().toUpperCase().split(',').map(s => s.trim()).filter(Boolean);
    if(!id || !nome) return alert("Preenche pelo menos o ID e o Nome!");
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
    try { await setDoc(doc(db, "utilizadores", id), { nome: nome, papel: 'professor', turmas: turmas, disciplinas: disciplinas }, { merge: true }); await registarLogAuditoria(`Alterou o perfil do utilizador ${nome}`); btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Gravado!'; setTimeout(() => { document.getElementById('modal-atribuir-professor').style.display = 'none'; btnRef.innerHTML = 'Guardar Atribuição'; carregarListaUtilizadores(); }, 1200); } catch(err) { btnRef.innerHTML = 'Erro!'; }
});

// ==========================================
// 7. AÇÕES GLOBAIS DA ESCOLA (LOGS E PUSH)
// ==========================================
async function registarLogAuditoria(acaoDesc) {
    try { await addDoc(collection(db, "escola_logs"), { acao: acaoDesc, autor: myUserName || "Admin", timestamp: new Date().toISOString() }); } catch(e) {}
}

async function carregarLogsAuditoria() {
    const container = document.getElementById('lista-logs-auditoria');
    if(!container) return;
    try {
        const q = query(collection(db, "escola_logs"), orderBy("timestamp", "desc"));
        const snap = await getDocs(q);
        if(snap.empty) { container.innerHTML = '<p class="text-muted center">Sem atividade recente registada.</p>'; return; }
        let html = ''; let count = 0;
        snap.forEach(d => {
            if(count < 5) {
                const log = d.data(); const horaFmt = new Date(log.timestamp).toLocaleString([], {dateStyle: 'short', timeStyle: 'short'});
                html += `<div style="font-size:0.85rem; padding:6px 0; border-bottom:1px solid rgba(255,255,255,0.05); display:flex; justify-content:space-between;"><span style="color:var(--text-light);"><i class="fa-solid fa-circle-dot" style="font-size:0.5rem; color:#0099ff; margin-right:6px;"></i> ${log.acao} <strong>(${log.autor})</strong></span><span style="color:var(--text-muted); font-size:0.75rem;">${horaFmt}</span></div>`; count++;
            }
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p class="text-muted center">Erro ao carregar logs.</p>'; }
}

document.getElementById('btn-ir-broadcast')?.addEventListener('click', () => {
    esconderTudoMenos(document.getElementById('view-admin-broadcast'));
    carregarLogsAuditoria();
});
document.getElementById('btn-voltar-admin-bc')?.addEventListener('click', () => esconderTudoMenos(adminDashboard));

document.getElementById('btn-enviar-broadcast')?.addEventListener('click', async (e) => {
    const alvo = document.getElementById('bc-alvo').value; const titulo = document.getElementById('bc-titulo').value.trim(); const mensagem = document.getElementById('bc-mensagem').value.trim();
    if(!titulo || !mensagem) return alert("Preenche o Título e a Mensagem do aviso!");
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar aviso...'; btnRef.disabled = true;
    try { await addDoc(collection(db, "escola_avisos_globais"), { alvo, titulo, mensagem, enviadoPor: myUserName || "Direção", timestamp: new Date().toISOString() }); await registarLogAuditoria(`Enviou aviso global em massa (${alvo}): "${titulo}"`); btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Aviso Enviado com Sucesso!'; setTimeout(() => { document.getElementById('bc-titulo').value = ""; document.getElementById('bc-mensagem').value = ""; btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Notificação Push'; btnRef.disabled = false; carregarLogsAuditoria(); }, 2000); } catch(err) { btnRef.innerHTML = 'Erro ao enviar!'; setTimeout(() => { btnRef.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Enviar Notificação Push'; btnRef.disabled = false; }, 2000); }
});

// GESTÃO FCT & PAP (HUB DO ALUNO)
document.getElementById('btn-hub-fct-pap')?.addEventListener('click', async () => {
    if(!alunoAtualId) return;
    document.getElementById('modal-dt-fct-pap').style.display = 'flex';
    document.getElementById('dt-fct-entidade').value = "A carregar..."; document.getElementById('dt-fct-horas-feitas').value = ""; document.getElementById('dt-fct-horas-totais').value = ""; document.getElementById('dt-pap-tema').value = "A carregar..."; document.getElementById('btn-dt-baixar-pap').style.display = 'none'; document.getElementById('dt-pap-status-txt').innerText = "A procurar ficheiro...";
    try {
        const docSnap = await getDoc(doc(db, "utilizadores", alunoAtualId));
        if(docSnap.exists()) {
            const d = docSnap.data();
            document.getElementById('dt-fct-entidade').value = d.fctEntidade || ""; document.getElementById('dt-fct-horas-feitas').value = d.fctHorasFeitas || d.fct?.horasRealizadas || 0; document.getElementById('dt-fct-horas-totais').value = d.fctHorasTotais || 400; document.getElementById('dt-pap-tema').value = d.papTema || d.pap?.tema || "";
            if(d.papFicheiroEnviado && d.papFicheiroBase64) { document.getElementById('dt-pap-status-txt').innerHTML = '<i class="fa-solid fa-file-pdf" style="color:var(--success-green);"></i> Anteprojeto Recebido!'; const btnDownload = document.getElementById('btn-dt-baixar-pap'); btnDownload.style.display = 'block'; btnDownload.href = d.papFicheiroBase64; const nomeAlunoLimpo = d.nome.replace(/\s+/g, '_'); btnDownload.download = `PAP_${nomeAlunoLimpo}.pdf`; } else { document.getElementById('dt-pap-status-txt').innerText = "O aluno ainda não enviou o ficheiro."; }
        }
    } catch(e) {}
});

document.getElementById('btn-gravar-fct-pap')?.addEventListener('click', async (e) => {
    if(!alunoAtualId) return;
    const btnRef = e.currentTarget; const textOrig = btnRef.innerHTML; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
    const entidade = document.getElementById('dt-fct-entidade').value.trim(); const hFeitas = Number(document.getElementById('dt-fct-horas-feitas').value) || 0; const hTotais = Number(document.getElementById('dt-fct-horas-totais').value) || 400; const tema = document.getElementById('dt-pap-tema').value.trim();
    try { 
        await updateDoc(doc(db, "utilizadores", alunoAtualId), { fctEntidade: entidade, "fct.horasRealizadas": hFeitas, "fct.validadoDT": true, fctHorasTotais: hTotais, "pap.tema": tema }); 
        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Gravado!'; 
        setTimeout(() => { document.getElementById('modal-dt-fct-pap').style.display = 'none'; btnRef.innerHTML = textOrig; carregarListaProjetos('TUR'); }, 1200); 
    } catch(err) { btnRef.innerHTML = "Erro!"; setTimeout(() => btnRef.innerHTML = textOrig, 2000); }
});

// ==========================================
// 8. EXCLUSÃO DE UTILIZADORES
// ==========================================
document.getElementById('btn-apagar-aluno')?.addEventListener('click', async (e) => {
    if(!alunoAtualId) return;
    if(!confirm("Tem a certeza absoluta que deseja APAGAR este utilizador? Todos os dados serão perdidos e a ação é irreversível!")) return;
    const btnRef = e.currentTarget; const textOrig = btnRef.innerHTML; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A apagar...'; btnRef.disabled = true;
    try { await deleteDoc(doc(db, "utilizadores", alunoAtualId)); await registarLogAuditoria(`Eliminou o perfil de aluno/EE (${alunoAtualId})`); document.getElementById('modal-admin-editar-aluno').style.display = 'none'; carregarListaUtilizadores(); } catch(err) { alert("Erro ao apagar utilizador."); } finally { btnRef.innerHTML = textOrig; btnRef.disabled = false; }
});

document.getElementById('btn-apagar-professor')?.addEventListener('click', async (e) => {
    const id = document.getElementById('ap-id').value.trim().toLowerCase();
    if(!id) return;
    if(!confirm("Tem a certeza absoluta que deseja APAGAR este professor? A ação é irreversível!")) return;
    const btnRef = e.currentTarget; const textOrig = btnRef.innerHTML; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A apagar...'; btnRef.disabled = true;
    try { await deleteDoc(doc(db, "utilizadores", id)); await registarLogAuditoria(`Eliminou o perfil de professor (${id})`); document.getElementById('modal-atribuir-professor').style.display = 'none'; carregarListaUtilizadores(); } catch(err) { alert("Erro ao apagar professor."); } finally { btnRef.innerHTML = textOrig; btnRef.disabled = false; }
});

// NOTIFICAÇÕES PUSH GLOBAIS
async function pedirPermissaoNotificacoes() { try { const permission = await Notification.requestPermission(); if (permission === 'granted') { const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js'); const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration }); if (currentToken) { await updateDoc(doc(db, "utilizadores", myUserId), { tokenNotificacao: currentToken }); } } } catch (error) {} }
if(typeof onMessage !== "undefined" && messaging) { onMessage(messaging, (payload) => { alert(`NOVA NOTIFICAÇÃO:\n\n${payload.notification.title}\n${payload.notification.body}`); }); }
setTimeout(() => { if(myUserId) pedirPermissaoNotificacoes(); }, 4000);

let emModoEdicaoFicha = false;
function alternarModoEdicaoFicha(ativar) {
    emModoEdicaoFicha = ativar; 
    const painelLeitura = document.getElementById('painel-aluno-leitura');
    const painelEdicao = document.getElementById('painel-aluno-edicao');
    const btnToggle = document.getElementById('btn-toggle-modo-edicao');

    if (emModoEdicaoFicha) {
        painelLeitura.style.display = 'none';
        painelEdicao.style.display = 'block';
        btnToggle.innerHTML = '<i class="fa-solid fa-xmark"></i> Cancelar';
        btnToggle.style.borderColor = 'var(--danger-red)';
        btnToggle.style.color = 'var(--danger-red)';
    } else {
        painelLeitura.style.display = 'block';
        painelEdicao.style.display = 'none';
        btnToggle.innerHTML = '<i class="fa-solid fa-pen"></i> Editar Ficha';
        btnToggle.style.borderColor = 'var(--warning-yellow)';
        btnToggle.style.color = 'var(--warning-yellow)';
    }
}

document.getElementById('btn-toggle-modo-edicao')?.addEventListener('click', async () => {
    if (!emModoEdicaoFicha) {
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", alunoAtualId));
            if(docSnap.exists()) {
                const d = docSnap.data();
                document.getElementById('edit-aluno-nome').value = d.nome || "";
                document.getElementById('edit-aluno-turma').value = d.turma || "";
                document.getElementById('edit-aluno-idade').value = d.idade || "";
                document.getElementById('edit-aluno-tel').value = d.telAluno || "";
                document.getElementById('edit-aluno-email').value = d.emailAluno || "";
                document.getElementById('edit-aluno-morada').value = d.morada || "";
                document.getElementById('edit-ee-nome').value = d.nomeEE || "";
                document.getElementById('edit-ee-filiacao').value = d.filiacaoEE || "";
                document.getElementById('edit-ee-tel').value = d.telEE || "";
                document.getElementById('edit-ee-email').value = d.emailEE || "";
            }
        } catch(e) {}
    }
    alternarModoEdicaoFicha(!emModoEdicaoFicha);
});

// ==========================================
// GESTÃO DE PROJETOS (FCT E PAP)
// ==========================================
async function carregarListaProjetos(turmaEscolhida) {
    const container = document.getElementById('lista-coord-projetos-dinamico');
    if(!container) return;
    container.innerHTML = '<p class="text-muted center">A carregar alunos...</p>';

    try {
        const q = turmaEscolhida === 'TUR' 
            ? query(collection(db, "utilizadores"), where("papel", "==", "aluno"))
            : query(collection(db, "utilizadores"), where("turma", "==", turmaEscolhida), where("papel", "==", "aluno"));
        
        const res = await getDocs(q);
        
        if (res.empty) { 
            container.innerHTML = '<p class="text-muted center">Sem alunos registados.</p>'; 
            return; 
        }

        let alunosAgrupados = {};
        let countElegiveis = 0;
        
        res.forEach((docSnap) => {
            const aluno = docSnap.data();
            const turmaStr = aluno.turma || "Sem Turma";
            const anoMatch = turmaStr.match(/\d+/);
            const ano = anoMatch ? parseInt(anoMatch[0]) : 0;

            if (ano < 11) return; // Ignora o 10º ano
            
            countElegiveis++;
            if (!alunosAgrupados[turmaStr]) { alunosAgrupados[turmaStr] = []; }
            alunosAgrupados[turmaStr].push({ id: docSnap.id, ...aluno });
        });

        if (countElegiveis === 0) {
            container.innerHTML = '<p class="text-muted center">Sem alunos elegíveis (apenas 11º e 12º ano).</p>';
            return;
        }

        let html = '';
        const turmasOrdenadas = Object.keys(alunosAgrupados).sort();
        
        turmasOrdenadas.forEach(turma => {
            html += `<h4 style="margin-top: 25px; margin-bottom: 10px; font-size: 0.95rem; color: #9b59b6; border-bottom: 1px solid #333; padding-bottom: 5px;"><i class="fa-solid fa-layer-group"></i> Turma ${turma}</h4>`;
            html += '<ul class="students-list">';
            
            alunosAgrupados[turma].sort((a, b) => a.nome.localeCompare(b.nome));
            
            alunosAgrupados[turma].forEach(aluno => {
                const miniatura = aluno.fotoPerfil ? `<img src="${aluno.fotoPerfil}" class="list-avatar" style="flex-shrink:0;">` : `<div class="list-avatar" style="flex-shrink:0;"><i class="fa-solid fa-user"></i></div>`;
                
                html += `
                    <li class="student-item" style="display:flex; justify-content:space-between; align-items:center; gap:10px; overflow:hidden; padding: 12px;">
                        <div style="display:flex; align-items:center; gap:12px; flex:1; min-width:0; overflow:hidden;">
                            ${miniatura}
                            <div class="student-info" style="display:flex; flex-direction:column; min-width:0; overflow:hidden; flex:1;">
                                <strong style="white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${aluno.nome}</strong>
                                <span style="font-size:0.75rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${aluno.id.toLowerCase()}</span>
                            </div>
                        </div>
                        <button class="secondary-btn small-btn btn-gerir-projeto" data-nome="${aluno.nome}" data-numero="${aluno.id}" style="border-color: #9b59b6; color: #9b59b6; flex-shrink:0; cursor: pointer; position: relative; z-index: 10;">
                            <i class="fa-solid fa-pen" style="pointer-events: none;"></i> Gerir
                        </button>
                    </li>`;
            });
            html += '</ul>';
        });

        container.innerHTML = html;

        container.onclick = (e) => {
            const btn = e.target.closest('.btn-gerir-projeto');
            if(btn) {
                e.preventDefault();
                const idAluno = btn.getAttribute('data-numero');
                const nomeAluno = btn.getAttribute('data-nome');
                window.alunoProjetosId = idAluno; 
                abrirModalGestaoProjetos(idAluno, nomeAluno);
            }
        };

    } catch (e) {
        container.innerHTML = '<p class="text-danger center">Erro ao carregar alunos.</p>';
    }
}

// --- LÓGICA DAS TABS DO MODAL ---
document.getElementById('tab-proj-fct')?.addEventListener('click', () => ativarTabProjetos('fct'));
document.getElementById('tab-proj-pap')?.addEventListener('click', () => ativarTabProjetos('pap'));

function ativarTabProjetos(tabAtiva) {
    document.getElementById('tab-proj-fct').classList.toggle('active', tabAtiva === 'fct');
    document.getElementById('tab-proj-pap').classList.toggle('active', tabAtiva === 'pap');
    
    document.getElementById('bloco-proj-fct').style.display = tabAtiva === 'fct' ? 'block' : 'none';
    document.getElementById('bloco-proj-pap').style.display = tabAtiva === 'pap' ? 'block' : 'none';
}
// --------------------------------

async function abrirModalGestaoProjetos(idAluno, nomeAluno) {
    try {
        const modal = document.getElementById('modal-admin-projetos');
        if(!modal) return;

        document.body.appendChild(modal);
        modal.style.zIndex = "9999";

        document.getElementById('projetos-aluno-nome').innerText = nomeAluno;
        
        // 1. Limpar e Resetar todos os campos
        document.getElementById('proj-fct-entidade').value = '';
        document.getElementById('proj-fct-orientador').value = '';
        document.getElementById('proj-fct-tel').value = '';
        document.getElementById('proj-fct-email').value = '';
        ['protocolo', 'plano', 'folhas', 'tutor', 'avaliacoes'].forEach(doc => document.getElementById(`doc-fct-${doc}`).value = 'por_entregar');
        
        document.getElementById('proj-pap-tema').value = '';
        ['tema', 'aprovacao', 'desenvolvimento', 'relatorio', 'apresentacao'].forEach(fase => document.getElementById(`fase-pap-${fase}`).checked = false);

        // 2. Carregar lista de Professores para a PAP (se ainda não carregou)
        const profSelect = document.getElementById('proj-pap-orientador');
        if (profSelect.options.length <= 1) {
            const profSnap = await getDocs(query(collection(db, "utilizadores"), where("papel", "==", "professor")));
            let opts = '<option value="">Selecione um professor...</option>';
            profSnap.forEach(p => opts += `<option value="${p.data().nome}">${p.data().nome}</option>`);
            profSelect.innerHTML = opts;
        }
        profSelect.value = '';

        // 3. Ativar Tab FCT por defeito e preparar visibilidade
        ativarTabProjetos('fct');
        const btnTabPap = document.getElementById('tab-proj-pap');
        if (btnTabPap) btnTabPap.style.display = 'block';

        modal.style.display = 'flex';

        // 4. Puxar os dados da Base de Dados
        const docSnap = await getDoc(doc(db, "utilizadores", idAluno));
        if(docSnap.exists()) {
            const d = docSnap.data();
            
            // Esconder a tab PAP se o aluno for do 11º ano
            const ano = (d.turma || "").match(/\d+/) ? parseInt((d.turma || "").match(/\d+/)[0]) : 0;
            if(ano === 11 && btnTabPap) btnTabPap.style.display = 'none';

            // Preencher campos FCT
            if(d.fctEntidade) document.getElementById('proj-fct-entidade').value = d.fctEntidade;
            if(d.fctOrientador) document.getElementById('proj-fct-orientador').value = d.fctOrientador;
            if(d.fctTel) document.getElementById('proj-fct-tel').value = d.fctTel;
            if(d.fctEmail) document.getElementById('proj-fct-email').value = d.fctEmail;
            
            if(d.fctDocProtocolo) document.getElementById('doc-fct-protocolo').value = d.fctDocProtocolo;
            if(d.fctDocPlano) document.getElementById('doc-fct-plano').value = d.fctDocPlano;
            if(d.fctDocFolhas) document.getElementById('doc-fct-folhas').value = d.fctDocFolhas;
            if(d.fctDocTutor) document.getElementById('doc-fct-tutor').value = d.fctDocTutor;
            if(d.fctDocAvaliacoes) document.getElementById('doc-fct-avaliacoes').value = d.fctDocAvaliacoes;

            // Preencher campos PAP
            if(d.papTema) document.getElementById('proj-pap-tema').value = d.papTema;
            if(d.papOrientador) document.getElementById('proj-pap-orientador').value = d.papOrientador;
            
            if(d.papFaseTema) document.getElementById('fase-pap-tema').checked = d.papFaseTema;
            if(d.papFaseAprovacao) document.getElementById('fase-pap-aprovacao').checked = d.papFaseAprovacao;
            if(d.papFaseDesenvolvimento) document.getElementById('fase-pap-desenvolvimento').checked = d.papFaseDesenvolvimento;
            if(d.papFaseRelatorio) document.getElementById('fase-pap-relatorio').checked = d.papFaseRelatorio;
            if(d.papFaseApresentacao) document.getElementById('fase-pap-apresentacao').checked = d.papFaseApresentacao;
        }
    } catch (err) {
        console.error("Erro ao abrir modal de projetos:", err);
    }
}

// Gravar as Alterações dos Projetos
document.getElementById('btn-guardar-projetos')?.addEventListener('click', async (e) => {
    if(!window.alunoProjetosId) return;
    const btnRef = e.currentTarget;
    btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...';
    btnRef.disabled = true;

    try {
        const dadosProjetos = {
            // FCT
            fctEntidade: document.getElementById('proj-fct-entidade').value.trim(),
            fctOrientador: document.getElementById('proj-fct-orientador').value.trim(),
            fctTel: document.getElementById('proj-fct-tel').value.trim(),
            fctEmail: document.getElementById('proj-fct-email').value.trim(),
            fctDocProtocolo: document.getElementById('doc-fct-protocolo').value,
            fctDocPlano: document.getElementById('doc-fct-plano').value,
            fctDocFolhas: document.getElementById('doc-fct-folhas').value,
            fctDocTutor: document.getElementById('doc-fct-tutor').value,
            fctDocAvaliacoes: document.getElementById('doc-fct-avaliacoes').value,
            
            // PAP
            papTema: document.getElementById('proj-pap-tema').value.trim(),
            papOrientador: document.getElementById('proj-pap-orientador').value,
            papFaseTema: document.getElementById('fase-pap-tema').checked,
            papFaseAprovacao: document.getElementById('fase-pap-aprovacao').checked,
            papFaseDesenvolvimento: document.getElementById('fase-pap-desenvolvimento').checked,
            papFaseRelatorio: document.getElementById('fase-pap-relatorio').checked,
            papFaseApresentacao: document.getElementById('fase-pap-apresentacao').checked
        };
        await updateDoc(doc(db, "utilizadores", window.alunoProjetosId), dadosProjetos);
        
        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Guardado!';
        setTimeout(() => {
            document.getElementById('modal-admin-projetos').style.display = 'none';
            btnRef.innerHTML = 'Guardar Projetos';
            btnRef.disabled = false;
        }, 1200);
    } catch(err) {
        console.error("Erro ao guardar os projetos:", err);
        btnRef.innerHTML = 'Guardar Projetos';
        btnRef.disabled = false;
    }
});