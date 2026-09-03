import { auth, db, messaging, VAPID_KEY, getToken, onMessage } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, addDoc, deleteDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

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
const viewClassCalendario = document.getElementById('view-class-calendario'); 
const viewClassHorario = document.getElementById('view-class-horario');
const viewClassForum = document.getElementById('view-class-forum'); 
const viewClassEstatisticas = document.getElementById('view-class-estatisticas');
const viewAvaliacoes = document.getElementById('view-avaliacoes'); 
const viewDisciplinaModulos = document.getElementById('view-disciplina-modulos');
const viewInformacoes = document.getElementById('view-informacoes'); 
const viewPrhf = document.getElementById('view-prhf');
const viewFaltas = document.getElementById('view-faltas'); 
const viewFaltasModulos = document.getElementById('view-faltas-modulos');
const viewValidarJustificacoes = document.getElementById('view-validar-justificacoes');
const viewMusai = document.getElementById('view-musai');
const viewObservacoes = document.getElementById('view-observacoes');
const viewComportamento = document.getElementById('view-comportamento');

let alunoAtualId = ""; 
let turmaAtual = ""; 
let myUserName = ""; 
let myUserId = "";
let nomePessoaContactoModal = ""; 
let idPrhfAtivo = ""; 
let pdfBase64Temporario = ""; 
let pdfNomeTemporario = "";
let forumAtivoId = null;
let coordTabAtiva = 'fct';

const nomeCurto = (nomeStr) => { if(!nomeStr) return 'Desconhecido'; const p = nomeStr.split(' '); return p.length > 1 ? `${p[0]} ${p[p.length-1]}` : p[0]; };

function esconderTudoMenos(ecraAtivo) {
    [adminDashboard, viewAdminTurmas, viewCoordProjetos, classHubView, classView, studentDetailView, viewAvaliacoes, viewDisciplinaModulos, 
     viewInformacoes, viewPrhf, viewFaltas, viewFaltasModulos, viewClassCalendario, 
     viewClassHorario, viewClassForum, viewClassEstatisticas, viewValidarJustificacoes, viewMusai, viewObservacoes, viewComportamento].forEach(el => { if(el) el.style.display = 'none'; });
    if(ecraAtivo) ecraAtivo.style.display = 'block';
}

// 1. SEGURANÇA E INICIALIZAÇÃO ADMIN
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
                carregarJustificacoesPendentesGlobal();
                carregarEstatisticaRiscoGlobal();
            }
        } catch (e) { console.error(e); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-staff')?.addEventListener('click', () => { signOut(auth).then(() => window.location.href = "index.html"); });

// NAVEGAÇÃO BOTTOM NAV
document.body.addEventListener('click', (e) => {
    const nav = e.target.closest('.nav-item');
    if (nav) {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active')); nav.classList.add('active');
        esconderTudoMenos();
        const tId = nav.getAttribute('data-target');
        document.getElementById(tId).style.display = (tId === 'view-class-forum') ? 'flex' : 'block';
        
        if (tId === 'admin-dashboard') { carregarJustificacoesPendentesGlobal(); carregarEstatisticaRiscoGlobal(); }
        if (tId === 'view-coord-projetos') carregarEcraProjetosCoord();
        if (tId === 'view-class-forum') { turmaAtual = 'TUR'; carregarTodosForunsAdmin(); }
    }
});

// NAVEGAÇÃO GERAL DO ADMIN
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
document.getElementById('btn-voltar-lista')?.addEventListener('click', () => esconderTudoMenos(classView));
document.getElementById('btn-voltar-hub-avaliacoes')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-disciplinas')?.addEventListener('click', () => esconderTudoMenos(viewAvaliacoes));
document.getElementById('btn-voltar-hub-info')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-hub-prhf')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-hub-faltas')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-faltas-disc')?.addEventListener('click', () => esconderTudoMenos(viewFaltas));
document.getElementById('btn-voltar-cal-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));
document.getElementById('btn-voltar-horario-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));
document.getElementById('btn-voltar-forum-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));
document.getElementById('btn-voltar-canais')?.addEventListener('click', () => { document.getElementById('forum-chat-view').style.display = 'none'; document.getElementById('forum-channel-list').style.display = 'block'; });
document.getElementById('btn-voltar-stats-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));
document.getElementById('btn-voltar-hub-musai')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-hub-observacoes')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-hub-comportamento')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));

// ACESSOS A PARTIR DO HUB DA TURMA
document.getElementById('btn-hub-alunos')?.addEventListener('click', () => { esconderTudoMenos(classView); carregarAlunos(turmaAtual); });
document.getElementById('btn-hub-calendario')?.addEventListener('click', () => { esconderTudoMenos(viewClassCalendario); carregarEventosCalendario(); });
document.getElementById('btn-hub-horario')?.addEventListener('click', () => { esconderTudoMenos(viewClassHorario); carregarHorario(); });
document.getElementById('btn-hub-forum')?.addEventListener('click', () => { esconderTudoMenos(viewClassForum); carregarTodosForunsAdmin(turmaAtual); });
document.getElementById('btn-hub-estatisticas')?.addEventListener('click', () => { esconderTudoMenos(viewClassEstatisticas); calcularEstatisticasTurma(); });

async function carregarAlunos(turmaEscolhida) {
    const container = document.querySelector('.students-list-container'); container.innerHTML = '<p class="text-muted">A carregar...</p>';
    try {
        const q = turmaEscolhida === 'TUR' ? query(collection(db, "utilizadores"), where("papel", "==", "aluno")) : query(collection(db, "utilizadores"), where("turma", "==", turmaEscolhida), where("papel", "==", "aluno"));
        const res = await getDocs(q); if (res.empty) { container.innerHTML = '<p class="text-muted">Sem alunos.</p>'; return; }
        let html = '<ul class="students-list">';
        res.forEach((doc) => {
            const aluno = doc.data(); const tagTurma = turmaEscolhida === 'TUR' ? ` (${aluno.turma})` : '';
            const miniatura = aluno.fotoPerfil ? `<img src="${aluno.fotoPerfil}" class="list-avatar">` : `<div class="list-avatar"><i class="fa-solid fa-user"></i></div>`;
            html += `<li class="student-item"><div style="display:flex; align-items:center; gap:12px;">${miniatura}<div class="student-info"><strong>${aluno.nome}${tagTurma}</strong><span>${doc.id.toUpperCase()}</span></div></div><button class="secondary-btn small-btn btn-ver-aluno" data-nome="${aluno.nome}" data-numero="${doc.id}" data-turma="${aluno.turma}"><i class="fa-solid fa-eye"></i> Ver</button></li>`;
        });
        container.innerHTML = html + '</ul>';
        container.querySelectorAll('.btn-ver-aluno').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                document.getElementById('detail-student-name').innerText = e.currentTarget.getAttribute('data-nome'); 
                alunoAtualId = e.currentTarget.getAttribute('data-numero'); 
                document.getElementById('detail-student-number').innerText = alunoAtualId.toUpperCase();
                
                const turmaDesteAluno = e.currentTarget.getAttribute('data-turma') || "";
                const anoMatch = turmaDesteAluno.match(/\d+/);
                const ano = anoMatch ? parseInt(anoMatch[0]) : 0;
                
                const btnFctPap = document.getElementById('btn-hub-fct-pap');
                if (btnFctPap) { if (ano === 10) { btnFctPap.style.display = 'none'; } else { btnFctPap.style.display = 'flex'; } }

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

// CAIXA DE ENTRADA: VALIDAR JUSTIFICAÇÕES (DASHBOARD)
let faltaPendenteSelecionada = null; let alunoPendenteSelecionadoId = null;

async function carregarJustificacoesPendentesGlobal() {
    const container = document.getElementById('lista-justificacoes-pendentes-global'); container.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar caixa de entrada...</p>';
    try {
        const snapshotAlunos = await getDocs(query(collection(db, "utilizadores"), where("papel", "==", "aluno"))); let pendentes = [];
        for (let alunoDoc of snapshotAlunos.docs) {
            const faltasDb = await getDocs(collection(db, "utilizadores", alunoDoc.id, "faltas"));
            faltasDb.forEach(f => {
                const dadosFalta = f.data();
                if (!dadosFalta.justificada && dadosFalta.comprovativoEnviado) { pendentes.push({ idFalta: f.id, idAluno: alunoDoc.id, nomeAluno: alunoDoc.data().nome, turma: alunoDoc.data().turma, ...dadosFalta }); }
            });
        }
        if (pendentes.length === 0) { container.innerHTML = '<p class="text-success center" style="margin:0;"><i class="fa-solid fa-check-circle"></i> Tudo limpo!</p>'; return; }
        pendentes.sort((a,b) => b.dataEnvioJustificacao.localeCompare(a.dataEnvioJustificacao));
        let html = '';
        pendentes.forEach(p => {
            html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; margin-bottom:8px; border:1px solid #333;"><div><strong style="color:white; font-size:0.95rem;">${nomeCurto(p.nomeAluno)} <span style="font-size:0.75rem; color:var(--text-muted);">(${p.turma})</span></strong><br><span style="font-size:0.8rem; color:var(--text-light);">${p.disciplina} (${p.dataInicio})</span></div><button class="primary-btn small-btn btn-ver-anexo-global" data-idaluno="${p.idAluno}" data-idfalta="${p.idFalta}" data-nome="${p.nomeAluno}" data-disc="${p.disciplina}" data-data="${p.dataInicio}" style="width:auto; padding:5px 10px; background:var(--warning-yellow); color:black;"><i class="fa-solid fa-eye"></i></button></div>`;
        });
        container.innerHTML = html;
        container.querySelectorAll('.btn-ver-anexo-global').forEach(btn => {
            btn.addEventListener('click', async (e) => {
                const el = e.currentTarget; alunoPendenteSelecionadoId = el.getAttribute('data-idaluno'); faltaPendenteSelecionada = el.getAttribute('data-idfalta');
                document.getElementById('txt-atestado-detalhe').innerText = `Aluno: ${el.getAttribute('data-nome')} \nFalta: ${el.getAttribute('data-disc')} a ${el.getAttribute('data-data')}`;
                const imgPreview = document.getElementById('img-atestado-preview'); const pdfPreview = document.getElementById('pdf-atestado-preview');
                imgPreview.style.display = 'none'; pdfPreview.style.display = 'none';
                const iconNormal = el.innerHTML; el.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
                try {
                    const docSnap = await getDoc(doc(db, "utilizadores", alunoPendenteSelecionadoId, "faltas", faltaPendenteSelecionada));
                    if (docSnap.exists() && docSnap.data().anexoJustificacao) {
                        const base64 = docSnap.data().anexoJustificacao;
                        if (base64.startsWith('data:image')) { imgPreview.src = base64; imgPreview.style.display = 'block'; } else if (base64.startsWith('data:application/pdf')) { pdfPreview.src = base64; pdfPreview.style.display = 'block'; }
                        document.getElementById('modal-ver-atestado').style.display = 'flex';
                    }
                } catch(err) { console.error(err); alert("Erro ao carregar anexo."); }
                el.innerHTML = iconNormal;
            });
        });
    } catch (e) { container.innerHTML = '<p class="text-danger center">Erro ao carregar caixa de entrada.</p>'; }
}

document.getElementById('btn-aprovar-atestado')?.addEventListener('click', async (e) => {
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        await updateDoc(doc(db, "utilizadores", alunoPendenteSelecionadoId, "faltas", faltaPendenteSelecionada), { justificada: true, comprovativoEnviado: false });
        document.getElementById('modal-ver-atestado').style.display = 'none'; carregarJustificacoesPendentesGlobal();
    } catch(err) {}
    btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Aprovar Falta';
});

document.getElementById('btn-rejeitar-atestado')?.addEventListener('click', async (e) => {
    if(!confirm("Tem a certeza que deseja rejeitar esta justificação? O atestado será apagado.")) return;
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        await updateDoc(doc(db, "utilizadores", alunoPendenteSelecionadoId, "faltas", faltaPendenteSelecionada), { justificada: false, comprovativoEnviado: false, anexoJustificacao: "" });
        document.getElementById('modal-ver-atestado').style.display = 'none'; carregarJustificacoesPendentesGlobal();
    } catch(err) {}
    btnRef.innerHTML = '<i class="fa-solid fa-xmark"></i> Rejeitar';
});

// ESTATÍSTICA RISCO GLOBAL (DASHBOARD)
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

// FCT / PAP (GLOBAL COORDENADOR MODE)
document.getElementById('tab-coord-fct')?.addEventListener('click', (e) => {
    coordTabAtiva = 'fct'; e.currentTarget.classList.add('active'); document.getElementById('tab-coord-pap').classList.remove('active'); carregarEcraProjetosCoord();
});
document.getElementById('tab-coord-pap')?.addEventListener('click', (e) => {
    coordTabAtiva = 'pap'; e.currentTarget.classList.add('active'); document.getElementById('tab-coord-fct').classList.remove('active'); carregarEcraProjetosCoord();
});

async function carregarEcraProjetosCoord() {
    const container = document.getElementById('lista-coord-projetos-dinamico');
    container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A cruzar dados globais...</p>';

    try {
        let alunosAvaliados = [];
        const snap = await getDocs(query(collection(db, "utilizadores"), where("papel", "==", "aluno")));
        snap.forEach(d => {
            const ano = parseInt(d.data().turma.match(/\d+/)?.[0]) || 10;
            if (ano >= 11) alunosAvaliados.push({ id: d.id, ...d.data() });
        });

        let html = '';

        if (coordTabAtiva === 'fct') {
            alunosAvaliados.sort((a,b) => (a.fct?.horasRealizadas || 0) - (b.fct?.horasRealizadas || 0));
            alunosAvaliados.forEach(al => {
                const horas = al.fct?.horasRealizadas || 0;
                let statusColor = '#333'; let barraWidth = (horas / 200) * 100; if(barraWidth > 100) barraWidth = 100;
                if(horas === 0) statusColor = 'var(--danger-red)'; else if(al.fct?.validadoDT) statusColor = 'var(--success-green)'; else statusColor = 'var(--warning-yellow)';
                html += `
                <div class="card aluno-list-item" data-id="${al.id}" style="border-left: 4px solid ${statusColor}; cursor: pointer; padding: 12px; background:rgba(0,0,0,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div><strong style="color:white; font-size:1rem;">${nomeCurto(al.nome)}</strong><span style="font-size:0.75rem; color:var(--text-muted); margin-left:5px;">${al.turma}</span></div>
                        <strong style="color:${statusColor};">${horas}h</strong>
                    </div>
                    <div style="height: 6px; width: 100%; background: #222; border-radius: 3px; overflow:hidden;"><div style="height: 100%; width: ${barraWidth}%; background: ${statusColor};"></div></div>
                    <div style="text-align:right; font-size:0.7rem; color:var(--text-muted); margin-top:5px;">${al.fct?.validadoDT ? 'Horas Validadas' : (horas>0 ? 'Por Validar (Edita no Perfil)' : 'Sem Registos')}</div>
                </div>`;
            });
        } else {
            alunosAvaliados.forEach(al => {
                const ano = parseInt(al.turma.match(/\d+/)?.[0]) || 10; if(ano !== 12) return;
                const temTema = al.pap?.temaAprovado; const temRelatorio = al.pap?.relatorioAprovado;
                const statusColor = temRelatorio ? 'var(--success-green)' : (temTema ? 'var(--warning-yellow)' : 'var(--danger-red)');
                const txtStatus = temRelatorio ? 'Apto para Defesa' : (temTema ? 'Em Desenvolvimento' : 'Atrasado / Sem Tema');
                html += `
                <div class="card aluno-list-item" data-id="${al.id}" style="border-left: 4px solid ${statusColor}; cursor: pointer; padding: 12px; background:rgba(0,0,0,0.2);">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div><strong style="color:white; font-size:1rem;">${nomeCurto(al.nome)}</strong><span style="font-size:0.75rem; color:var(--text-muted); margin-left:5px;">${al.turma}</span><div style="font-size:0.8rem; color:var(--text-light); margin-top:5px;">Orientador: ${al.pap?.orientador ? nomeCurto(al.pap.orientador) : '<span style="color:var(--danger-red);">Sem Orientador</span>'}</div></div>
                        <div style="text-align:right;"><span style="font-size:0.75rem; color:${statusColor}; font-weight:bold;">${txtStatus}</span></div>
                    </div>
                </div>`;
            });
        }
        container.innerHTML = html === '' ? '<p class="text-muted center">Sem dados para mostrar.</p>' : html;
        container.querySelectorAll('.aluno-list-item').forEach(card => card.addEventListener('click', async (e) => {
            alunoAtualId = e.currentTarget.getAttribute('data-id'); const dS = await getDoc(doc(db, "utilizadores", alunoAtualId));
            if(dS.exists()) { document.getElementById('detail-student-name').innerText = dS.data().nome; document.getElementById('detail-student-number').innerText = alunoAtualId.toUpperCase(); esconderTudoMenos(studentDetailView); document.getElementById('btn-hub-fct-pap').click(); }
        }));
    } catch (err) { container.innerHTML = '<p class="text-danger center">Erro a carregar projetos.</p>'; }
}


// CALENDÁRIO DA TURMA 
let idEventoEmEdicao = null;
document.getElementById('btn-refresh-calendario')?.addEventListener('click', (e) => { e.currentTarget.querySelector('i').classList.add('fa-spin'); carregarEventosCalendario().finally(() => setTimeout(() => e.target.closest('button').querySelector('i').classList.remove('fa-spin'), 500)); });
document.getElementById('btn-abrir-modal-evento')?.addEventListener('click', () => {
    idEventoEmEdicao = null; document.getElementById('modal-evento-title').innerHTML = '<i class="fa-solid fa-calendar-plus"></i> Novo Evento / Teste';
    document.getElementById('ev-titulo').value = ""; document.getElementById('ev-data').value = ""; document.getElementById('ev-hora').value = "09:00";
    document.getElementById('modal-novo-evento').style.display = 'flex';
    let opt = '<option value="">Disciplina Relacionada (Opcional)</option>';
    for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) opt += `<option value="${d}">${d}</option>`; }
    document.getElementById('ev-disc').innerHTML = opt; document.getElementById('ev-disc').value = "";
});
document.getElementById('btn-cancelar-evento')?.addEventListener('click', () => document.getElementById('modal-novo-evento').style.display = 'none');
document.getElementById('btn-gravar-evento')?.addEventListener('click', async (e) => {
    const titulo = document.getElementById('ev-titulo').value.trim(); const tipo = document.getElementById('ev-tipo').value;
    const data = document.getElementById('ev-data').value; const hora = document.getElementById('ev-hora').value; const disc = document.getElementById('ev-disc').value;
    if(!titulo || !data) return alert("Preenche Título e Data!");
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Guardando...';
    try {
        if(idEventoEmEdicao) { await updateDoc(doc(db, "turmas", turmaAtual, "eventos", idEventoEmEdicao), { titulo, tipo, data, hora, disciplina: disc }); } 
        else { await addDoc(collection(db, "turmas", turmaAtual, "eventos"), { titulo, tipo, data, hora, disciplina: disc, criadoEm: new Date().toISOString() }); }
        document.getElementById('modal-novo-evento').style.display = 'none'; btnRef.innerText = "Guardar"; await carregarEventosCalendario(); await carregarHorario(); 
    } catch(err) { btnRef.innerText = "Erro!"; }
});

async function carregarEventosCalendario() {
    const container = document.getElementById('lista-calendario-container'); container.innerHTML = '<p class="text-muted">A carregar eventos...</p>';
    try {
        const res = await getDocs(query(collection(db, "turmas", turmaAtual, "eventos")));
        if(res.empty) { container.innerHTML = '<p class="text-muted">Sem eventos agendados.</p>'; return; }
        let evs = []; res.forEach(d => { let ed = d.data(); ed.id = d.id; evs.push(ed); });
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
            return `<div class="calendar-event-card ${classeCard}"><div class="calendar-date-box"><span class="day">${diaStr}</span><span class="month">${mesStr}</span></div><div class="calendar-info"><span class="badge-tipo-evento ${badgeClass}">${badgeTexto}</span><h4>${ev.titulo}</h4>${pDisc}</div><div class="event-actions"><button class="edit-evt" data-id="${ev.id}" data-json='${JSON.stringify(ev)}'><i class="fa-solid fa-pen"></i></button><button class="del-evt" data-id="${ev.id}"><i class="fa-solid fa-trash"></i></button></div></div>`;
        }
        futuros.forEach(e => html += renderCard(e, false));
        if(passados.length > 0) { html += `<div class="calendar-divider"><span>Eventos Passados</span></div>`; passados.forEach(e => html += renderCard(e, true)); }
        container.innerHTML = html;
        container.querySelectorAll('.edit-evt').forEach(btn => btn.addEventListener('click', (e) => {
            const data = JSON.parse(e.currentTarget.getAttribute('data-json')); idEventoEmEdicao = data.id;
            document.getElementById('modal-evento-title').innerHTML = '<i class="fa-solid fa-pen"></i> Editar Evento';
            document.getElementById('ev-titulo').value = data.titulo; document.getElementById('ev-tipo').value = data.tipo;
            document.getElementById('ev-data').value = data.data; document.getElementById('ev-hora').value = data.hora;
            let opt = '<option value="">Disciplina Relacionada (Opcional)</option>'; for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) opt += `<option value="${d}">${d}</option>`; } document.getElementById('ev-disc').innerHTML = opt;
            document.getElementById('ev-disc').value = data.disciplina || ""; document.getElementById('modal-novo-evento').style.display = 'flex';
        }));
        container.querySelectorAll('.del-evt').forEach(btn => btn.addEventListener('click', async (e) => {
            if(!confirm("Eliminar este evento?")) return;
            await deleteDoc(doc(db, "turmas", turmaAtual, "eventos", e.currentTarget.getAttribute('data-id'))); carregarEventosCalendario(); carregarHorario();
        }));
    } catch(err) { container.innerHTML = '<p class="text-muted" style="color:var(--danger-red);">Erro ao carregar calendário.</p>'; }
}

// HORÁRIO DINÂMICO
let modoEdicaoHorario = false; let slotSelecionado = null;
let dataInicioSemana = new Date(); dataInicioSemana.setDate(dataInicioSemana.getDate() - (dataInicioSemana.getDay() === 0 ? 6 : dataInicioSemana.getDay() - 1));
document.getElementById('btn-prev-week')?.addEventListener('click', () => { dataInicioSemana.setDate(dataInicioSemana.getDate() - 7); carregarHorario(); });
document.getElementById('btn-next-week')?.addEventListener('click', () => { dataInicioSemana.setDate(dataInicioSemana.getDate() + 7); carregarHorario(); });

function formatarDataHeader(dt) { const dp = String(dt.getDate()).padStart(2,'0'); const mp = String(dt.getMonth()+1).padStart(2,'0'); return `${dp}/${mp}`; }
function dataParaStringDb(dt) { const y = dt.getFullYear(); const m = String(dt.getMonth()+1).padStart(2,'0'); const d = String(dt.getDate()).padStart(2,'0'); return `${y}-${m}-${d}`; }

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
        if(modoEdicaoHorario) {
            slotSelecionado = e.currentTarget; let opt = '<option value="">Sem Aula (Limpar)</option>';
            for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) opt += `<option value="${d}">${d}</option>`; }
            opt += `<option disabled>──────────</option><option value="ALM">Almoço</option><option value="Visita">Visita Estudo</option><option value="FCT">FCT</option><option value="PAP">PAP</option><option value="PRHF">PRHF</option>`;
            document.getElementById('ed-horario-disc').innerHTML = opt; document.getElementById('modal-editar-horario').style.display = 'flex';
        } else {
            if(e.currentTarget.querySelector('.slot-event-badge')) {
                const badge = e.currentTarget.querySelector('.slot-event-badge');
                document.getElementById('mei-titulo').innerText = badge.getAttribute('data-titulo'); document.getElementById('mei-tipo').innerText = badge.getAttribute('data-tipo').toUpperCase();
                document.getElementById('mei-hora').innerText = badge.getAttribute('data-hora') || 'N/A'; document.getElementById('mei-disc').innerText = badge.getAttribute('data-disc') || 'N/A';
                document.getElementById('modal-evento-info').style.display = 'flex';
            }
        }
    });
});
document.getElementById('btn-cancelar-bloco-horario')?.addEventListener('click', () => document.getElementById('modal-editar-horario').style.display = 'none');
document.getElementById('btn-gravar-bloco-horario')?.addEventListener('click', async (e) => {
    if(!slotSelecionado) return; const novaDisc = document.getElementById('ed-horario-disc').value;
    const dataReal = slotSelecionado.getAttribute('data-datareal'); const horaId = slotSelecionado.getAttribute('data-hora');
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try { await setDoc(doc(db, "turmas", turmaAtual), { horario: { [`${dataReal}_${horaId}`]: novaDisc } }, {merge:true}); document.getElementById('modal-editar-horario').style.display = 'none'; btnRef.innerText = "Confirmar"; carregarHorario(); } catch(err) { btnRef.innerText = "Erro!"; }
});

async function carregarHorario() {
    const diasUIAbrv = ['seg', 'ter', 'qua', 'qui', 'sex']; const mapDiasParaDataReal = {}; 
    let endOfWeek = new Date(dataInicioSemana); endOfWeek.setDate(endOfWeek.getDate() + 4);
    document.getElementById('week-display').innerText = `${formatarDataHeader(dataInicioSemana)} a ${formatarDataHeader(endOfWeek)}`;
    let iterDate = new Date(dataInicioSemana);
    for(let i=0; i<5; i++) {
        const dStr = dataParaStringDb(iterDate); document.getElementById(`h-${diasUIAbrv[i]}-dt`).innerText = formatarDataHeader(iterDate);
        mapDiasParaDataReal[diasUIAbrv[i]] = dStr; document.querySelectorAll(`.horario-slot[data-dia="${diasUIAbrv[i]}"]`).forEach(s => s.setAttribute('data-datareal', dStr)); iterDate.setDate(iterDate.getDate() + 1);
    }
    document.querySelectorAll('.horario-slot').forEach(slot => { slot.innerHTML = ""; slot.classList.remove('filled'); });
    try {
        const docSnap = await getDoc(doc(db, "turmas", turmaAtual)); let horarioBase = {}; if(docSnap.exists() && docSnap.data().horario) horarioBase = docSnap.data().horario;
        let eventosTurma = []; const resEvts = await getDocs(query(collection(db, "turmas", turmaAtual, "eventos"))); resEvts.forEach(d => eventosTurma.push(d.data()));
        for(const key in horarioBase) {
            const [dataReal, hora] = key.split('_'); const disc = horarioBase[key]; const slot = document.querySelector(`.horario-slot[data-datareal="${dataReal}"][data-hora="${hora}"]`);
            if(slot && disc) { 
                slot.innerHTML = `<strong>${disc}</strong>`; slot.classList.add('filled'); 
                const evtEncontrado = eventosTurma.find(e => e.data === dataReal && e.disciplina === disc);
                if(evtEncontrado) { slot.innerHTML += `<div class="slot-event-badge" data-titulo="${evtEncontrado.titulo}" data-tipo="${evtEncontrado.tipo}" data-disc="${evtEncontrado.disciplina}" data-hora="${evtEncontrado.hora}"><i class="fa-solid fa-star"></i></div>`; }
            }
        }
    } catch(err){}
}

// ESTATÍSTICAS REAIS
async function calcularEstatisticasTurma() {
    document.getElementById('stat-media-turma').innerText = '...'; document.getElementById('stat-faltas-totais').innerText = '...';
    try {
        const qAlunos = turmaAtual === 'TUR' ? query(collection(db, "utilizadores"), where("papel", "==", "aluno")) : query(collection(db, "utilizadores"), where("turma", "==", turmaAtual), where("papel", "==", "aluno"));
        const snapshotAlunos = await getDocs(qAlunos);
        if(snapshotAlunos.empty) return;
        
        let sumGlobalTotal = 0; let countGlobalTotal = 0; let totalHorasFaltasTurma = 0;

        for(let alunoDoc of snapshotAlunos.docs) {
            const aId = alunoDoc.id;
            try {
                const notas = await getDocs(collection(db, "utilizadores", aId, "notas"));
                notas.forEach(n => {
                    const val = n.data().nota;
                    if(val !== 'REP' && !isNaN(val)) { 
                        sumGlobalTotal += Number(val); countGlobalTotal++;
                    }
                });
                const faltas = await getDocs(collection(db, "utilizadores", aId, "faltas")); 
                faltas.forEach(f => { if(!f.data().justificada) totalHorasFaltasTurma += f.data().horas; });
            } catch(subErr) {}
        }
        document.getElementById('stat-media-turma').innerText = countGlobalTotal > 0 ? (sumGlobalTotal / countGlobalTotal).toFixed(1) : '-'; document.getElementById('stat-faltas-totais').innerText = totalHorasFaltasTurma;
    } catch(e) {}
}

// FÓRUM / CANAIS GLOBAIS (ADMIN VÊ TUDO)
document.getElementById('btn-novo-forum')?.addEventListener('click', async () => { 
    document.getElementById('modal-novo-forum').style.display = 'flex'; const cList = document.getElementById('novo-forum-membros-list'); cList.innerHTML = '<p class="text-muted" style="text-align:center;">A procurar...</p>';
    try { const qAlunos = turmaAtual === 'TUR' ? query(collection(db, "utilizadores"), where("papel", "==", "aluno")) : query(collection(db, "utilizadores"), where("turma", "==", turmaAtual), where("papel", "==", "aluno")); const snapshot = await getDocs(qAlunos); let h = ''; snapshot.forEach(d => { h += `<label class="membro-checkbox-item"><input type="checkbox" class="cb-membro-forum" value="${d.id}" checked> ${d.data().nome} (${d.data().turma})</label>`; }); cList.innerHTML = h || '<p class="text-muted" style="text-align:center;">Sem alunos registados.</p>'; } catch(e) {}
});
document.getElementById('btn-cancelar-forum')?.addEventListener('click', () => { document.getElementById('modal-novo-forum').style.display = 'none'; });
document.getElementById('btn-selecionar-todos-forum')?.addEventListener('click', () => { const cbs = document.querySelectorAll('.cb-membro-forum'); const todosMarcados = Array.from(cbs).every(cb => cb.checked); cbs.forEach(cb => cb.checked = !todosMarcados); });
document.getElementById('novo-forum-tipo')?.addEventListener('change', (e) => { document.getElementById('box-forum-expira').style.display = e.target.value === 'temporario' ? 'block' : 'none'; });

document.getElementById('btn-gravar-forum')?.addEventListener('click', async (e) => {
    const nome = document.getElementById('novo-forum-nome').value.trim(); const tipo = document.getElementById('novo-forum-tipo').value; const expira = document.getElementById('novo-forum-expira').value;
    if(!nome) return alert("Dá um nome ao canal!"); let membrosSelecionados = []; document.querySelectorAll('.cb-membro-forum:checked').forEach(cb => membrosSelecionados.push(cb.value));
    if(membrosSelecionados.length === 0) return alert("Tens de adicionar pelo menos 1 membro!");
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try { await addDoc(collection(db, "turmas", turmaAtual === 'TUR' ? 'Global' : turmaAtual, "foruns"), { nome: nome, tipo: tipo, expiraEm: tipo==='temporario'?expira:'', membros: membrosSelecionados, criadoEm: new Date().toISOString() }); document.getElementById('modal-novo-forum').style.display = 'none'; document.getElementById('novo-forum-nome').value = ""; btnRef.innerText = "Criar"; carregarTodosForunsAdmin(); } catch(err) { btnRef.innerText = "Erro!"; }
});

async function carregarTodosForunsAdmin(turmaFiltro = 'TUR') {
    const container = document.getElementById('lista-canais-forum'); container.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar canais da escola...</p>';
    try {
        let html = '';
        const turmasPesquisa = turmaFiltro === 'TUR' ? ['10T', '11T', '12T', 'Global'] : [turmaFiltro];
        
        for (const t of turmasPesquisa) {
            const res = await getDocs(query(collection(db, "turmas", t, "foruns"))); 
            if(!res.empty) {
                if(turmaFiltro === 'TUR') html += `<h4 style="width:100%; color:var(--text-muted); border-bottom:1px solid #333; padding-bottom:5px; margin-top:10px;">Turma ${t}</h4>`;
                res.forEach(docSnap => { 
                    const f = docSnap.data(); const icon = f.tipo === 'permanente' ? 'fa-comments' : 'fa-stopwatch'; 
                    html += `<div class="canal-card" data-id="${docSnap.id}" data-turma="${t}" data-json='${JSON.stringify(f)}' style="background:rgba(0,0,0,0.2);"><div class="canal-icon" style="color:var(--primary-green); border-color:var(--primary-green);"><i class="fa-solid ${icon}"></i></div><div class="canal-info"><h4>${f.nome}</h4><p>${f.membros ? f.membros.length : 0} Membro(s)</p></div></div>`; 
                });
            }
        }
        
        if(html === '') { container.innerHTML = '<p class="text-muted" style="text-align:center;">Sem fóruns criados.</p>'; return; }
        container.innerHTML = html;
        container.querySelectorAll('.canal-card').forEach(card => card.addEventListener('click', (e) => { 
            const fData = JSON.parse(e.currentTarget.getAttribute('data-json')); forumAtivoId = e.currentTarget.getAttribute('data-id'); const fTurma = e.currentTarget.getAttribute('data-turma');
            document.getElementById('chat-active-title').innerText = `${fData.nome} (${fTurma})`; document.getElementById('forum-channel-list').style.display = 'none'; document.getElementById('forum-chat-view').style.display = 'flex'; 
            iniciarChatGlobal(fTurma, forumAtivoId); 
        }));
    } catch(err) {}
}

let chatUnsubscribeAdmin = null;
function iniciarChatGlobal(fTurma, fId) {
    const chatContainer = document.getElementById('chat-messages-container'); chatContainer.innerHTML = ''; if(chatUnsubscribeAdmin) chatUnsubscribeAdmin();
    chatUnsubscribeAdmin = onSnapshot(query(collection(db, "turmas", fTurma, "foruns", fId, "mensagens"), orderBy("timestamp")), (snapshot) => { let html = ''; snapshot.forEach(doc => { const msg = doc.data(); const isMe = msg.remetente === myUserName; const classe = isMe ? 'admin' : 'student'; html += `<div class="chat-bubble ${classe}"><strong>${isMe ? 'Tu' : msg.remetente}</strong><br>${msg.texto}<span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>`; }); chatContainer.innerHTML = html; chatContainer.scrollTop = chatContainer.scrollHeight; });
    
    // Atualiza o botão de envio
    const btnSend = document.getElementById('btn-send-msg');
    const novoBtnSend = btnSend.cloneNode(true); btnSend.parentNode.replaceChild(novoBtnSend, btnSend);
    novoBtnSend.addEventListener('click', async () => { const inp = document.getElementById('input-forum-msg'); const txt = inp.value.trim(); if(!txt || !forumAtivoId) return; try { await addDoc(collection(db, "turmas", fTurma, "foruns", forumAtivoId, "mensagens"), { remetente: myUserName, texto: txt, timestamp: Date.now() }); inp.value = ''; } catch(e){} });
}

// AVALIAÇÕES E PAUTA GLOBAL
document.getElementById('btn-hub-avaliacoes')?.addEventListener('click', () => { esconderTudoMenos(viewAvaliacoes); construirMatrizVisual(document.getElementById('matriz-disciplinas-container'), abrirModulosDisciplinaAvaliacao); });
function construirMatrizVisual(containerEl, funcaoClique) { let html = ""; for (const [nomeComponente, disciplines] of Object.entries(matrizCurso)) { html += `<div class="component-section"><div class="component-header">${nomeComponente}</div><div class="subject-grid">`; for (const nomeDisciplina of Object.keys(disciplines)) { html += `<button class="subject-btn" data-disc="${nomeDisciplina}">${nomeDisciplina}</button>`; } html += `</div></div>`; } containerEl.innerHTML = html; containerEl.querySelectorAll('.subject-btn').forEach(btn => btn.addEventListener('click', (e) => funcaoClique(e.currentTarget.getAttribute('data-disc')))); }
document.getElementById('btn-pauta-global')?.addEventListener('click', async () => { document.getElementById('modal-pauta-global').style.display = 'flex'; const container = document.getElementById('pauta-global-content'); container.innerHTML = '<p class="text-muted" style="text-align:center;">A compilar notas...</p>'; try { const notasDb = await getDocs(collection(db, "utilizadores", alunoAtualId, "notas")); const mapNotas = {}; notasDb.forEach(d => { const dt = d.data(); mapNotas[`${dt.disciplina}_${dt.modulo}`] = dt.nota; }); let html = ''; for (const [nomeComponente, disciplinas] of Object.entries(matrizCurso)) { html += `<div class="pauta-global-componente"><div class="pauta-global-header">${nomeComponente}</div>`; for (const [nomeDisc, modulos] of Object.entries(disciplinas)) { html += `<div class="pauta-global-disc"><div class="pauta-global-disc-title">${nomeDisc}</div><div class="pauta-global-notas">`; for(const mod of Object.keys(modulos)) { const nota = mapNotas[`${nomeDisc}_${mod}`] || 'SN'; let cor = "sn"; if(nota !== 'SN' && nota !== 'REP' && nota >= 10) cor = "positiva"; else if(nota === 'REP' || nota < 10) cor = "negativa"; html += `<div class="pg-nota-item"><span>${mod}</span><span class="pg-nota-val ${cor}">${nota}</span></div>`; } html += `</div></div>`; } html += `</div>`; } container.innerHTML = html; } catch(err) { container.innerHTML = '<p class="text-muted" style="color:var(--danger-red); text-align:center;">Erro ao carregar a pauta.</p>'; } });
document.getElementById('btn-close-pauta')?.addEventListener('click', () => document.getElementById('modal-pauta-global').style.display = 'none');

async function abrirModulosDisciplinaAvaliacao(disciplina) {
    esconderTudoMenos(viewDisciplinaModulos); document.getElementById('titulo-disciplina').innerText = disciplina;
    const listaModulosUI = document.getElementById('lista-modulos-disciplina'); listaModulosUI.innerHTML = '<p class="text-muted">A preparar pauta...</p>';
    const notasMapa = {}; try { const qNotas = await getDocs(collection(db, "utilizadores", alunoAtualId, "notas")); qNotas.forEach(d => { if (d.data().disciplina === disciplina) { notasMapa[d.data().modulo] = d.data().nota; notasMapa[d.data().modulo + "_motivo"] = d.data().motivoRep; } }); } catch(e){}
    let modulosArray = []; for (const comp of Object.values(matrizCurso)) { if (comp[disciplina]) modulosArray = Object.keys(comp[disciplina]); } let gridBtns = ""; for(let i=10; i<=20; i++) { gridBtns += `<button class="grade-btn" data-val="${i}">${i}</button>`; } gridBtns += `<button class="grade-btn rep" data-val="REP">REP</button>`;
    let html = ""; modulosArray.forEach(mod => { const nEx = notasMapa[mod] !== undefined ? notasMapa[mod] : "SN"; let classeBadge = ""; if(nEx === "SN") classeBadge = "sn"; else if(nEx === "REP") classeBadge = "rep"; const txtMotivo = (nEx === "REP" && notasMapa[mod+"_motivo"]) ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:5px;"><i>Motivo: ${notasMapa[mod+"_motivo"]}</i></div>` : ""; html += `<div class="modulo-avaliar-item" style="display:flex; flex-direction:column;"><div class="mod-view" id="view-${disciplina}-${mod}" style="display:flex; justify-content:space-between; width:100%; align-items:center;"><div><strong>${mod}</strong>${txtMotivo}</div><div style="display:flex; align-items:center; gap:15px;"><span class="nota-badge ${classeBadge}" id="badge-${disciplina}-${mod}">${nEx}</span><button class="secondary-btn small-btn btn-abrir-edicao-nota" data-mod="${mod}"><i class="fa-solid fa-pen"></i></button></div></div><div class="mod-edit" id="edit-${disciplina}-${mod}" style="display:none; flex-direction:column; width:100%;"><div class="grade-grid" id="grid-${disciplina}-${mod}">${gridBtns}</div><div id="rep-reason-box-${disciplina}-${mod}" style="display:none; width:100%; margin-bottom:10px;"><input type="text" id="input-reason-${disciplina}-${mod}" placeholder="Motivo do REP" style="margin:0; padding:8px; font-size:0.9rem;"></div><div style="display:flex; gap:10px;"><button class="primary-btn small-btn btn-gravar-nota" data-disc="${disciplina}" data-mod="${mod}" style="flex:1;">OK (Gravar)</button><button class="secondary-btn small-btn btn-fechar-edicao-nota" data-mod="${mod}" style="flex:1;">Cancelar</button></div></div></div>`; });
    listaModulosUI.innerHTML = html; listaModulosUI.querySelectorAll('.btn-abrir-edicao-nota').forEach(b => b.addEventListener('click', (e) => { const m=e.currentTarget.getAttribute('data-mod'); document.getElementById(`view-${disciplina}-${m}`).style.display='none'; document.getElementById(`edit-${disciplina}-${m}`).style.display='flex'; })); listaModulosUI.querySelectorAll('.btn-fechar-edicao-nota').forEach(b => b.addEventListener('click', (e) => { const m=e.currentTarget.getAttribute('data-mod'); document.getElementById(`view-${disciplina}-${m}`).style.display='flex'; document.getElementById(`edit-${disciplina}-${m}`).style.display='none'; }));
    let notaSelecionadaTemporaria = {}; listaModulosUI.querySelectorAll('.grade-btn').forEach(btn => { btn.addEventListener('click', (e) => { const gridPai = e.currentTarget.parentElement; gridPai.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected')); e.currentTarget.classList.add('selected'); const modId = gridPai.id.split('-')[2]; const discId = gridPai.id.split('-')[1]; const v = e.currentTarget.getAttribute('data-val'); notaSelecionadaTemporaria[modId] = v; document.getElementById(`rep-reason-box-${discId}-${modId}`).style.display = v === "REP" ? "block" : "none"; }); });
    listaModulosUI.querySelectorAll('.btn-gravar-nota').forEach(b => b.addEventListener('click', async (e) => { const d = e.currentTarget.getAttribute('data-disc'); const m = e.currentTarget.getAttribute('data-mod'); const v = notaSelecionadaTemporaria[m]; if(!v) return; const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ...'; try { const valorDb = v === "REP" ? "REP" : Number(v); const motivo = v === "REP" ? document.getElementById(`input-reason-${d}-${m}`).value : ""; await setDoc(doc(db, "utilizadores", alunoAtualId, "notas", `${d}_${m}`), { disciplina: d, modulo: m, nota: valorDb, motivoRep: motivo, data: new Date().toISOString(), professor: myUserName }); btnRef.innerText = "Gravado!"; setTimeout(() => { btnRef.innerText = "OK (Gravar)"; abrirModulosDisciplinaAvaliacao(d); }, 800); } catch(err){ btnRef.innerText = "Erro!"; } }));
}

// INFORMAÇÕES PESSOAIS E FECHO DE MODAIS
document.querySelectorAll('.btn-fechar-modal').forEach(b => b.addEventListener('click', () => { document.getElementById('modal-telefone').style.display='none'; document.getElementById('modal-email').style.display='none'; document.getElementById('modal-nova-falta').style.display='none'; document.getElementById('modal-alterar-falta').style.display='none'; document.getElementById('modal-novo-evento').style.display='none'; document.getElementById('modal-editar-horario').style.display='none'; document.getElementById('modal-novo-forum').style.display='none'; document.getElementById('modal-ver-atestado').style.display='none'; document.getElementById('modal-dt-chat-ee').style.display='none'; document.getElementById('modal-dt-fct-pap').style.display='none'; document.getElementById('modal-novo-sumario').style.display='none'; document.getElementById('modal-nova-ocorrencia').style.display='none'; document.getElementById('modal-novo-utilizador').style.display='none'; document.getElementById('modal-admin-editar-aluno').style.display='none'; }));
document.addEventListener('click', (e) => { if (e.target.classList.contains('clickable-contact')) { const tipo = e.target.getAttribute('data-type'); const valor = e.target.innerText; if(valor === "-" || valor === "") return; nomePessoaContactoModal = e.target.id.includes('aluno') ? document.getElementById('detail-student-name').innerText : (document.getElementById('display-ee-nome').innerText || "Enc. Educação"); window.contactoTemp = valor; if (tipo === 'tel') { document.getElementById('action-ligar').href = `tel:${valor}`; document.getElementById('modal-telefone').style.display = 'flex'; } else if (tipo === 'email') { document.getElementById('action-enviar-email').href = `mailto:${valor}`; document.getElementById('modal-email').style.display = 'flex'; } } });
document.getElementById('action-guardar-vcard')?.addEventListener('click', () => { const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${nomePessoaContactoModal}\nTEL:${window.contactoTemp}\nEND:VCARD`; const blob = new Blob([vcard], { type: 'text/vcard' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${nomePessoaContactoModal.replace(/\s+/g,'_')}.vcf`; document.body.appendChild(link); link.click(); document.body.removeChild(link); document.getElementById('modal-telefone').style.display = 'none'; });
document.getElementById('btn-hub-informacoes')?.addEventListener('click', async () => { esconderTudoMenos(viewInformacoes); try { const docSnap = await getDoc(doc(db, "utilizadores", alunoAtualId)); if (docSnap.exists()) { const d = docSnap.data(); document.getElementById('display-aluno-idade').innerText = d.idade || "-"; document.getElementById('display-aluno-tel').innerText = d.telAluno || "-"; document.getElementById('display-aluno-email').innerText = d.emailAluno || "-"; document.getElementById('display-aluno-morada').innerText = d.morada || "-"; document.getElementById('display-ee-nome').innerText = d.nomeEE || "-"; document.getElementById('display-ee-filiacao').innerText = d.filiacaoEE || "-"; document.getElementById('display-ee-tel').innerText = d.telEE || "-"; document.getElementById('display-ee-email').innerText = d.emailEE || "-"; } } catch (error) {} });

// NOVO: BACKOFFICE - CRIAR UTILIZADOR
document.getElementById('btn-admin-novo-user')?.addEventListener('click', () => {
    document.getElementById('nu-id').value = ""; document.getElementById('nu-nome').value = ""; document.getElementById('nu-turma').value = "";
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
        setTimeout(() => { document.getElementById('modal-novo-utilizador').style.display = 'none'; btnRef.innerHTML = 'Criar Ficha na Base de Dados'; btnRef.disabled = false; }, 1500);
    } catch(err) { console.error("Erro a criar perfil", err); btnRef.innerHTML = 'Erro ao criar!'; setTimeout(() => { btnRef.innerHTML = 'Criar Ficha na Base de Dados'; btnRef.disabled = false; }, 2000); }
});

// NOVO: BACKOFFICE - EDITAR ALUNO (TRANSIÇÃO)
document.getElementById('btn-admin-editar-aluno')?.addEventListener('click', () => {
    if(!alunoAtualId) return;
    const nomeAtual = document.getElementById('detail-student-name').innerText;
    document.getElementById('ea-nome').value = nomeAtual; document.getElementById('ea-turma').value = turmaAtual === 'TUR' ? '' : turmaAtual;
    document.getElementById('modal-admin-editar-aluno').style.display = 'flex';
});

document.getElementById('btn-gravar-edicao-aluno')?.addEventListener('click', async (e) => {
    const nomeNovo = document.getElementById('ea-nome').value.trim(); const turmaNova = document.getElementById('ea-turma').value.trim().toUpperCase();
    if(!nomeNovo || !turmaNova) return alert("O Nome e a Turma não podem estar vazios!");
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...'; btnRef.disabled = true;
    try {
        await updateDoc(doc(db, "utilizadores", alunoAtualId), { nome: nomeNovo, turma: turmaNova });
        document.getElementById('detail-student-name').innerText = nomeNovo; btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Gravado!';
        setTimeout(() => { document.getElementById('modal-admin-editar-aluno').style.display = 'none'; btnRef.innerHTML = 'Guardar Alterações'; btnRef.disabled = false; if(turmaAtual !== 'TUR') carregarAlunos(turmaAtual); }, 1500);
    } catch(err) { btnRef.innerHTML = 'Erro!'; setTimeout(() => { btnRef.innerHTML = 'Guardar Alterações'; btnRef.disabled = false; }, 2000); }
});

// CHAT EE - ADMIN
let chatUnsubscribeDTEE = null;
document.getElementById('btn-hub-chat-ee')?.addEventListener('click', () => {
    if(!alunoAtualId) return;
    const nome = document.getElementById('detail-student-name').innerText;
    document.getElementById('dt-chat-ee-title').innerHTML = `<i class="fa-solid fa-envelope"></i> Família de ${nome}`;
    document.getElementById('modal-dt-chat-ee').style.display = 'flex';
    iniciarChatDTEE();
});

function iniciarChatDTEE() {
    const chatContainer = document.getElementById('dt-chat-ee-messages'); chatContainer.innerHTML = ''; if(chatUnsubscribeDTEE) chatUnsubscribeDTEE();
    chatUnsubscribeDTEE = onSnapshot(query(collection(db, "utilizadores", alunoAtualId, "chat_dt"), orderBy("timestamp")), (snapshot) => {
        let html = '';
        snapshot.forEach(doc => { const msg = doc.data(); const isMe = msg.autor === 'dt'; const classe = isMe ? 'admin' : 'student'; html += `<div class="chat-bubble ${classe}"><strong>${isMe ? 'Tu (Admin)' : msg.remetente + ' (EE)'}</strong><br>${msg.texto}<span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>`; });
        chatContainer.innerHTML = html; chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}
document.getElementById('btn-dt-chat-ee-send')?.addEventListener('click', async () => { const inp = document.getElementById('dt-chat-ee-input'); const txt = inp.value.trim(); if(!txt || !alunoAtualId) return; try { await addDoc(collection(db, "utilizadores", alunoAtualId, "chat_dt"), { remetente: myUserName, autor: 'dt', texto: txt, timestamp: Date.now() }); inp.value = ''; } catch(e) {} });

// GESTÃO DO PASSAPORTE (FCT & PAP) HUB DO ALUNO (MODO ADMIN)
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
    try { await updateDoc(doc(db, "utilizadores", alunoAtualId), { fctEntidade: entidade, "fct.horasRealizadas": hFeitas, "fct.validadoDT": true, fctHorasTotais: hTotais, "pap.tema": tema }); btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Gravado!'; setTimeout(() => { document.getElementById('modal-dt-fct-pap').style.display = 'none'; btnRef.innerHTML = textOrig; carregarEcraProjetosCoord(); }, 1200); } catch(err) { btnRef.innerHTML = "Erro!"; setTimeout(() => btnRef.innerHTML = textOrig, 2000); }
});

// PRHF
const selDisc = document.getElementById('prhf-disciplina'); const selMod = document.getElementById('prhf-modulo');
let optDisc = '<option value="">Disc.</option>'; for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) optDisc += `<option value="${d}">${d}</option>`; } selDisc.innerHTML = optDisc;
const optDiscFilter = '<option value="">Todas as Disciplinas</option>' + optDisc; document.getElementById('filtro-prhf-disc').innerHTML = optDiscFilter;
selDisc.addEventListener('change', (e) => { const d = e.target.value; let modsObj = {}; for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } let optMod = '<option value="">Mod.</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); selMod.innerHTML = optMod; });
document.getElementById('prhf-file-upload')?.addEventListener('change', (e) => { const file = e.target.files[0]; if(!file) return; if(file.size > 716800) { alert("Ficheiro demasiado grande!"); return; } pdfNomeTemporario = file.name; document.getElementById('prhf-file-name').innerText = pdfNomeTemporario; const reader = new FileReader(); reader.onload = (ev) => { pdfBase64Temporario = ev.target.result; }; reader.readAsDataURL(file); });
let tabAtivaPrhf = 'ativas'; const modalFolha = document.getElementById('modal-prhf-sheet');
if(document.getElementById('btn-hub-prhf')) { document.getElementById('btn-hub-prhf').addEventListener('click', () => { esconderTudoMenos(viewPrhf); tabAtivaPrhf = 'ativas'; document.getElementById('tab-prhf-ativas').classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId); }); }
document.getElementById('tab-prhf-ativas')?.addEventListener('click', (e) => { tabAtivaPrhf = 'ativas'; e.currentTarget.classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId); });
document.getElementById('tab-prhf-concluidas')?.addEventListener('click', (e) => { tabAtivaPrhf = 'concluidas'; e.currentTarget.classList.add('active'); document.getElementById('tab-prhf-ativas').classList.remove('active'); carregarListaPRHF(alunoAtualId); });
document.getElementById('filtro-prhf-disc')?.addEventListener('change', () => carregarListaPRHF(alunoAtualId));
document.getElementById('btn-guardar-prhf')?.addEventListener('click', async (e) => { const disc = selDisc.value; const mod = selMod.value; const prazo = document.getElementById('prhf-prazo').value; const desc = document.getElementById('prhf-descricao').value.trim(); const htInput = document.getElementById('prhf-horas').value; const isTerminado = document.getElementById('prhf-modulo-terminado').checked; if(!disc || !mod || !prazo || !desc || !htInput) return alert("Preenche todos os campos!"); const hT = parseInt(htInput); const hP = hT > 4 ? Math.ceil(hT * 0.3) : 0; const hN = hT - hP; const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...'; try { await addDoc(collection(db, "utilizadores", alunoAtualId, "prhfs"), { disciplina: disc, modulo: mod, prazo: prazo, descricao: desc, horasNaoPresenciais: hN, horasPresenciais: hP, moduloTerminado: isTerminado, status: 'ativa', dataRegisto: new Date().toISOString(), registosManuais: [], pdfName: pdfNomeTemporario, pdfFile: pdfBase64Temporario }); selDisc.value = ""; selMod.value = ""; document.getElementById('prhf-prazo').value = ""; document.getElementById('prhf-descricao').value = ""; document.getElementById('prhf-horas').value = ""; document.getElementById('prhf-modulo-terminado').checked = false; pdfBase64Temporario = ""; pdfNomeTemporario = ""; document.getElementById('prhf-file-name').innerText = ""; document.getElementById('prhf-file-upload').value = ""; btnRef.innerText = "Gravado!"; setTimeout(() => { btnRef.innerText = "Processar e Gravar"; }, 1000); tabAtivaPrhf = 'ativas'; document.getElementById('tab-prhf-ativas').classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId); } catch (err) { btnRef.innerText = "Erro!"; } });
let prhfsMemoria = [];
async function carregarListaPRHF(idAluno) { const container = document.getElementById('lista-prhf-container'); container.innerHTML = '<p class="text-muted">A carregar...</p>'; prhfsMemoria = []; const filtroDisc = document.getElementById('filtro-prhf-disc').value; try { const res = await getDocs(query(collection(db, "utilizadores", idAluno, "prhfs"))); let html = ''; res.forEach(doc => { const data = doc.data(); data.id = doc.id; if (filtroDisc !== "" && data.disciplina !== filtroDisc) return; if ((tabAtivaPrhf === 'ativas' && data.status === 'ativa') || (tabAtivaPrhf === 'concluidas' && data.status === 'concluida')) { prhfsMemoria.push(data); let classeCor = 'concluida'; if(data.status === 'ativa') classeCor = data.moduloTerminado ? 'ativa-terminado' : 'ativa-decorrer'; const sM = (data.modulo||"").includes('M') ? data.modulo : 'M'+data.modulo; html += `<div class="prhf-mini-card ${classeCor}" data-id="${data.id}"><strong>${data.disciplina}_${sM}</strong><i class="fa-solid fa-chevron-right" style="color:var(--text-muted); font-size:0.8rem;"></i></div>`; } }); if (html === '') { container.innerHTML = `<p class="text-muted">Sem tarefas ${tabAtivaPrhf}.</p>`; return; } container.innerHTML = html; container.querySelectorAll('.prhf-mini-card').forEach(card => card.addEventListener('click', (e) => abrirFolhaPRHF(e.currentTarget.getAttribute('data-id')))); } catch (err) {} }
function desenharRegistosManuais(plano) { const container = document.getElementById('lista-presencias-manuais'); let totalRealizado = 0; if(!plano.registosManuais || plano.registosManuais.length === 0) { container.innerHTML = ""; } else { let h = "<p style='margin-bottom:5px;'><strong>Já Registadas:</strong></p>"; plano.registosManuais.forEach((r, idx) => { totalRealizado += r.horas; h += `<div class="registo-item"><span>${r.data} (${r.inicio} - ${r.fim}) [${r.horas}h]</span><i class="fa-solid fa-trash registo-item-del" data-idx="${idx}"></i></div>`; }); container.innerHTML = h; container.querySelectorAll('.registo-item-del').forEach(icon => { icon.addEventListener('click', async (e) => { if(!confirm("Apagar este registo?")) return; const indexToRemove = e.currentTarget.getAttribute('data-idx'); const novaLista = [...plano.registosManuais]; novaLista.splice(indexToRemove, 1); try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { registosManuais: novaLista }); plano.registosManuais = novaLista; desenharRegistosManuais(plano); } catch(err) {} }); }); } document.getElementById('sheet-horas-feitas').innerText = totalRealizado; document.getElementById('sheet-horas-totais').innerText = plano.horasPresenciais || 0; const btnConcluir = document.getElementById('sheet-btn-concluir'); const progressFill = document.getElementById('sheet-btn-progress-fill'); const progressText = document.getElementById('sheet-btn-progress-text'); const txtRegisto = document.getElementById('txt-btn-registo'); const hP = plano.horasPresenciais || 0; let perc = hP > 0 ? Math.min((totalRealizado / hP) * 100, 100) : 100; progressFill.style.width = `${perc}%`; progressText.innerHTML = `<i class="fa-solid fa-check"></i> Concluído (${Math.floor(perc || 0)}%)`; if(totalRealizado >= hP && hP > 0) { btnConcluir.classList.add('ready'); btnConcluir.disabled = false; txtRegisto.innerText = "Retificar Presenciais"; } else { btnConcluir.classList.remove('ready'); btnConcluir.disabled = true; txtRegisto.innerText = "Registar Presenciais"; } }
function abrirFolhaPRHF(id) { const p = prhfsMemoria.find(x => x.id === id); if(!p) return; idPrhfAtivo = id; const sM = (p.modulo||"").includes('M') ? p.modulo : 'M'+p.modulo; const dp = (p.prazo||"").split('-'); const dF = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : p.prazo; document.getElementById('sheet-title').innerText = `${p.disciplina}_${sM}`; document.getElementById('sheet-prazo').innerText = dF; document.getElementById('sheet-hp').innerText = p.horasPresenciais || 0; document.getElementById('sheet-ha').innerText = p.horasNaoPresenciais || 0; document.getElementById('sheet-desc').innerText = p.descricao; const btnDownload = document.getElementById('sheet-btn-download-pdf'); if(p.pdfFile) { btnDownload.style.display = 'flex'; btnDownload.href = p.pdfFile; btnDownload.download = p.pdfName || `Anexo_${p.disciplina}.pdf`; } else { btnDownload.style.display = 'none'; } const badge = document.getElementById('sheet-status'); badge.innerText = p.status.toUpperCase(); if(p.status === 'ativa') badge.className = `paper-status ${p.moduloTerminado ? 'ativa-terminado' : 'ativa-decorrer'}`; else badge.className = `paper-status concluida`; if (p.status === 'concluida') { document.getElementById('sheet-btn-concluir').style.display = 'none'; document.getElementById('sheet-btn-reverter').style.display = 'flex'; document.getElementById('sheet-btn-toggle-manual').style.display = 'none'; document.getElementById('manual-presence-box').style.display = 'none'; } else { document.getElementById('sheet-btn-concluir').style.display = 'block'; document.getElementById('sheet-btn-reverter').style.display = 'none'; document.getElementById('sheet-btn-toggle-manual').style.display = 'flex'; document.getElementById('manual-presence-box').style.display = 'none'; } desenharRegistosManuais(p); modalFolha.style.display = 'flex'; }
document.querySelector('.btn-close-paper')?.addEventListener('click', () => modalFolha.style.display = 'none');
document.getElementById('sheet-btn-toggle-manual')?.addEventListener('click', () => { const box = document.getElementById('manual-presence-box'); box.style.display = box.style.display === 'none' ? 'block' : 'none'; });
document.getElementById('btn-save-manual-pres')?.addEventListener('click', async (e) => { const d = document.getElementById('reg-pres-data').value; const i = document.getElementById('reg-pres-inicio').value; const f = document.getElementById('reg-pres-fim').value; if(!d || !i || !f) return alert("Preenche Data, Início e Fim!"); const [hI, mI] = i.split(':').map(Number); const [hF, mF] = f.split(':').map(Number); let diff = (hF + mF/60) - (hI + mI/60); const horasCalc = diff > 0 ? Math.floor(diff) : 0; if(horasCalc <= 0) return alert("A diferença deve ser pelo menos 1h!"); const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; try { const nR = { data: d, inicio: i, fim: f, horas: horasCalc }; const p = prhfsMemoria.find(x => x.id === idPrhfAtivo); const novaLista = p.registosManuais ? [...p.registosManuais, nR] : [nR]; await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { registosManuais: novaLista }); document.getElementById('reg-pres-data').value = ""; document.getElementById('reg-pres-inicio').value = ""; document.getElementById('reg-pres-fim').value = ""; p.registosManuais = novaLista; desenharRegistosManuais(p); btnRef.innerText = "Gravado!"; setTimeout(() => btnRef.innerText = "Guardar Registo", 1000); } catch(err){ btnRef.innerText = "Erro!"; } });
document.getElementById('sheet-btn-concluir')?.addEventListener('click', async () => { const p = prhfsMemoria.find(x => x.id === idPrhfAtivo); if(p.status === 'concluida' || document.getElementById('sheet-btn-concluir').disabled) return; if(!confirm("Marcar como CONCLUÍDO?")) return; try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { status: 'concluida' }); modalFolha.style.display = 'none'; carregarListaPRHF(alunoAtualId); } catch(err){} });
document.getElementById('sheet-btn-reverter')?.addEventListener('click', async (e) => { if(!confirm("REVERTER para ATIVA?")) return; e.currentTarget.innerText = "A reverter..."; try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { status: 'ativa' }); modalFolha.style.display = 'none'; carregarListaPRHF(alunoAtualId); } catch(err){ e.currentTarget.innerText = "Reverter para Ativa"; } });

// ==========================================
// NOTIFICAÇÕES PUSH PARA STAFF (ADMIN)
// ==========================================
async function pedirPermissaoNotificacoes() {
    try {
        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
            const registration = await navigator.serviceWorker.register('./firebase-messaging-sw.js');
            const currentToken = await getToken(messaging, { vapidKey: VAPID_KEY, serviceWorkerRegistration: registration });
            if (currentToken) {
                await updateDoc(doc(db, "utilizadores", myUserId), { tokenNotificacao: currentToken });
            }
        }
    } catch (error) {}
}

if(typeof onMessage !== "undefined" && messaging) {
    onMessage(messaging, (payload) => {
        alert(`NOVA NOTIFICAÇÃO:\n\n${payload.notification.title}\n${payload.notification.body}`);
    });
}
setTimeout(() => { if(myUserId) pedirPermissaoNotificacoes(); }, 4000);
