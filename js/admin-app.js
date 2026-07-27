import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, setDoc, updateDoc, addDoc, deleteDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const matrizCurso = {
    "Sociocultural": { "PORT": {"M1": 27, "M2": 24, "M3": 27}, "ING": {"M1": 24, "M2": 24, "M3": 24}, "AI": {"M1": 30, "M2": 30}, "EF": {"M1": 20, "M2": 20, "M3": 20, "M4": 20, "M5": 20}, "TIC": {"M1": 24, "M2": 24, "M3": 27, "M4": 24} },
    "Científica": { "GEO": {"M1": 27, "M2": 24}, "HCA": {"M1": 24, "M2": 24, "M3": 27}, "MAT": {"M1": 30, "M2": 30, "M3": 30} },
    "Técnica": { "CF": {"M1": 30, "M2": 30, "M3": 30}, "TIAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "TCAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "OTET": {"M1": 25, "M2": 25, "M3": 25, "M4": 25} }
};

const adminDashboard = document.getElementById('admin-dashboard');
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

let alunoAtualId = ""; 
let turmaAtual = ""; 
let myUserName = ""; 
let nomePessoaContactoModal = ""; 
let idPrhfAtivo = ""; 
let pdfBase64Temporario = ""; 
let pdfNomeTemporario = "";
let forumAtivoId = null;

function esconderTudoMenos(ecraAtivo) {
    [adminDashboard, classHubView, classView, studentDetailView, viewAvaliacoes, viewDisciplinaModulos, 
     viewInformacoes, viewPrhf, viewFaltas, viewFaltasModulos, viewClassCalendario, 
     viewClassHorario, viewClassForum, viewClassEstatisticas, viewValidarJustificacoes].forEach(el => { if(el) el.style.display = 'none'; });
    if(ecraAtivo) ecraAtivo.style.display = 'block';
}

// 1. SEGURANÇA E INICIALIZAÇÃO ADMIN
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", userId));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                if(dados.papel !== 'admin') {
                    window.location.href = "index.html"; 
                    return;
                }
                myUserName = dados.nome.split(' ')[0];
                document.getElementById('header-user-name-staff').innerText = `Olá, ${myUserName} (Admin)`;
                document.getElementById('header-staff').style.display = 'flex';
                esconderTudoMenos(adminDashboard);
            }
        } catch (e) { console.error(e); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-staff')?.addEventListener('click', () => { signOut(auth).then(() => window.location.href = "index.html"); });

// NAVEGAÇÃO GERAL DO ADMIN
document.querySelectorAll('.turma-card-large').forEach(botao => {
    botao.addEventListener('click', () => {
        turmaAtual = botao.getAttribute('data-turma'); 
        if(turmaAtual === 'TUR') { 
            document.getElementById('class-title').innerHTML = `<i class="fa-solid fa-globe"></i> Turma TUR`; 
            esconderTudoMenos(classView); carregarAlunos('TUR'); 
        } else { 
            document.getElementById('class-hub-title').innerHTML = `Turma ${turmaAtual}`; 
            esconderTudoMenos(classHubView); 
        }
    });
});

document.getElementById('btn-voltar-turmas-hub')?.addEventListener('click', () => esconderTudoMenos(adminDashboard));
document.getElementById('btn-voltar-class-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));
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

// ACESSOS A PARTIR DO HUB DA TURMA
document.getElementById('btn-hub-alunos')?.addEventListener('click', () => { esconderTudoMenos(classView); carregarAlunos(turmaAtual); });
document.getElementById('btn-hub-calendario')?.addEventListener('click', () => { esconderTudoMenos(viewClassCalendario); carregarEventosCalendario(); });
document.getElementById('btn-hub-horario')?.addEventListener('click', () => { esconderTudoMenos(viewClassHorario); carregarHorario(); });
document.getElementById('btn-hub-forum')?.addEventListener('click', () => { esconderTudoMenos(viewClassForum); carregarForuns(); });
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
            html += `<li class="student-item"><div style="display:flex; align-items:center; gap:12px;">${miniatura}<div class="student-info"><strong>${aluno.nome}${tagTurma}</strong><span>${doc.id.toUpperCase()}</span></div></div><button class="secondary-btn small-btn btn-ver-aluno" data-nome="${aluno.nome}" data-numero="${doc.id}"><i class="fa-solid fa-eye"></i> Ver</button></li>`;
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

// CAIXA DE ENTRADA: VALIDAR JUSTIFICAÇÕES
document.getElementById('btn-hub-justificacoes')?.addEventListener('click', () => { esconderTudoMenos(viewValidarJustificacoes); carregarJustificacoesPendentes(); });
document.getElementById('btn-voltar-justificacoes-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView));

let faltaPendenteSelecionada = null; let alunoPendenteSelecionadoId = null;

async function carregarJustificacoesPendentes() {
    const container = document.getElementById('lista-justificacoes-pendentes'); container.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar caixa de entrada...</p>';
    try {
        const qAlunos = query(collection(db, "utilizadores"), where("turma", "==", turmaAtual), where("papel", "==", "aluno"));
        const snapshotAlunos = await getDocs(qAlunos); let pendentes = [];
        for (let alunoDoc of snapshotAlunos.docs) {
            const faltasDb = await getDocs(collection(db, "utilizadores", alunoDoc.id, "faltas"));
            faltasDb.forEach(f => {
                const dadosFalta = f.data();
                if (!dadosFalta.justificada && dadosFalta.comprovativoEnviado) { pendentes.push({ idFalta: f.id, idAluno: alunoDoc.id, nomeAluno: alunoDoc.data().nome, ...dadosFalta }); }
            });
        }
        if (pendentes.length === 0) { container.innerHTML = '<div style="text-align:center; padding:30px;"><i class="fa-solid fa-check-circle" style="font-size:3rem; color:var(--success-green); margin-bottom:15px;"></i><p class="text-muted">Tudo limpo! Não há atestados pendentes.</p></div>'; return; }
        pendentes.sort((a,b) => b.dataEnvioJustificacao.localeCompare(a.dataEnvioJustificacao));
        let html = '';
        pendentes.forEach(p => {
            html += `<div class="card" style="margin-bottom:15px; border-left: 4px solid var(--warning-yellow);"><div style="display:flex; justify-content:space-between; align-items:flex-start;"><div><h4 style="margin:0; color:white;">${p.nomeAluno}</h4><p style="font-size:0.85rem; color:var(--text-muted); margin-top:3px;">Faltou a: ${p.disciplina} (${p.dataInicio})</p></div><button class="primary-btn small-btn btn-ver-anexo" data-idaluno="${p.idAluno}" data-idfalta="${p.idFalta}" data-nome="${p.nomeAluno}" data-disc="${p.disciplina}" data-data="${p.dataInicio}" style="width:auto; padding:8px 15px;"><i class="fa-solid fa-eye"></i> Ver Anexo</button></div></div>`;
        });
        container.innerHTML = html;
        container.querySelectorAll('.btn-ver-anexo').forEach(btn => {
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
        document.getElementById('modal-ver-atestado').style.display = 'none'; carregarJustificacoesPendentes();
    } catch(err) {}
    btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Aprovar Falta';
});

document.getElementById('btn-rejeitar-atestado')?.addEventListener('click', async (e) => {
    if(!confirm("Tem a certeza que deseja rejeitar esta justificação? O atestado será apagado.")) return;
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        await updateDoc(doc(db, "utilizadores", alunoPendenteSelecionadoId, "faltas", faltaPendenteSelecionada), { justificada: false, comprovativoEnviado: false, anexoJustificacao: "" });
        document.getElementById('modal-ver-atestado').style.display = 'none'; carregarJustificacoesPendentes();
    } catch(err) {}
    btnRef.innerHTML = '<i class="fa-solid fa-xmark"></i> Rejeitar';
});
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
    document.getElementById('stat-media-turma').innerText = '...'; document.getElementById('stat-faltas-totais').innerText = '...'; document.getElementById('stat-prhf-ativos').innerText = '...'; document.getElementById('stat-alunos-risco').innerText = '...';
    document.getElementById('stat-med-socio').innerText = '...'; document.getElementById('stat-med-cient').innerText = '...'; document.getElementById('stat-med-tec').innerText = '...';
    const tabelaAlunos = document.getElementById('tabela-stats-alunos'); tabelaAlunos.innerHTML = '<tr><td colspan="4" class="text-muted center">A compilar...</td></tr>';
    try {
        const qAlunos = turmaAtual === 'TUR' ? query(collection(db, "utilizadores"), where("papel", "==", "aluno")) : query(collection(db, "utilizadores"), where("turma", "==", turmaAtual), where("papel", "==", "aluno"));
        const snapshotAlunos = await getDocs(qAlunos);
        if(snapshotAlunos.empty) { tabelaAlunos.innerHTML = '<tr><td colspan="4" class="text-muted center">Sem alunos registados.</td></tr>'; return; }
        
        let sumGlobalTotal = 0; let countGlobalTotal = 0; let sumSocio = 0; let countSocio = 0; let sumCient = 0; let countCient = 0; let sumTec = 0; let countTec = 0;
        let prhfsAtivosGerais = 0; let hPrhfPlan = 0; let hPrhfCump = 0; let alunosEmRiscoCount = 0; let totalHorasFaltasTurma = 0; let listaTrAlunos = [];

        for(let alunoDoc of snapshotAlunos.docs) {
            const aId = alunoDoc.id; const dAluno = alunoDoc.data(); let sumAluno = 0; let countAluno = 0; let negAluno = 0; let faltasAluno = 0;
            try {
                const notas = await getDocs(collection(db, "utilizadores", aId, "notas"));
                notas.forEach(n => {
                    const disc = n.data().disciplina; const val = n.data().nota;
                    if(val !== 'REP' && !isNaN(val)) { 
                        const vNum = Number(val); sumAluno += vNum; countAluno++; sumGlobalTotal += vNum; countGlobalTotal++;
                        if(vNum < 10) negAluno++;
                        if(matrizCurso["Sociocultural"] && matrizCurso["Sociocultural"][disc]) { sumSocio += vNum; countSocio++; } 
                        else if(matrizCurso["Científica"] && matrizCurso["Científica"][disc]) { sumCient += vNum; countCient++; } 
                        else if(matrizCurso["Técnica"] && matrizCurso["Técnica"][disc]) { sumTec += vNum; countTec++; }
                    } else if (val === 'REP') { negAluno++; }
                });
                const faltas = await getDocs(collection(db, "utilizadores", aId, "faltas")); faltas.forEach(f => { if(!f.data().justificada) { faltasAluno += f.data().horas; totalHorasFaltasTurma += f.data().horas; } });
                const prhfs = await getDocs(collection(db, "utilizadores", aId, "prhfs")); prhfs.forEach(p => { const dataP = p.data(); if(dataP.status === 'ativa') prhfsAtivosGerais++; hPrhfPlan += (dataP.horasPresenciais || 0); if(dataP.registosManuais) { dataP.registosManuais.forEach(r => hPrhfCump += r.horas); } });
            } catch(subErr) {}
            if(negAluno >= 3) alunosEmRiscoCount++;
            const medInd = countAluno > 0 ? (sumAluno/countAluno).toFixed(1) : '-';
            const estadoBadge = negAluno >= 3 ? `<span class="badge-risco">EM RISCO</span>` : `<span class="badge-ok">REGULAR</span>`;
            listaTrAlunos.push(`<tr><td><strong>${dAluno.nome}</strong><br><span style="font-size:0.75rem; color:#888;">${aId.toUpperCase()}</span></td><td class="center" style="font-weight:bold;">${medInd}</td><td class="center">${faltasAluno}</td><td class="center">${estadoBadge}</td></tr>`);
        }
        document.getElementById('stat-media-turma').innerText = countGlobalTotal > 0 ? (sumGlobalTotal / countGlobalTotal).toFixed(1) : '-'; document.getElementById('stat-med-socio').innerText = countSocio > 0 ? (sumSocio / countSocio).toFixed(1) : '-'; document.getElementById('stat-med-cient').innerText = countCient > 0 ? (sumCient / countCient).toFixed(1) : '-'; document.getElementById('stat-med-tec').innerText = countTec > 0 ? (sumTec / countTec).toFixed(1) : '-'; document.getElementById('stat-prhf-ativos').innerText = prhfsAtivosGerais; if(document.getElementById('stat-prhf-plan')) document.getElementById('stat-prhf-plan').innerText = hPrhfPlan; if(document.getElementById('stat-prhf-cump')) document.getElementById('stat-prhf-cump').innerText = hPrhfCump; document.getElementById('stat-alunos-risco').innerText = alunosEmRiscoCount; document.getElementById('stat-faltas-totais').innerText = totalHorasFaltasTurma; tabelaAlunos.innerHTML = listaTrAlunos.length > 0 ? listaTrAlunos.join('') : '<tr><td colspan="4" class="text-muted center">Sem dados.</td></tr>';
    } catch(e) {}
}

// FÓRUM / CANAIS 
document.getElementById('btn-novo-forum')?.addEventListener('click', async () => { 
    document.getElementById('modal-novo-forum').style.display = 'flex'; const cList = document.getElementById('novo-forum-membros-list'); cList.innerHTML = '<p class="text-muted" style="text-align:center;">A procurar...</p>';
    try { const qAlunos = turmaAtual === 'TUR' ? query(collection(db, "utilizadores"), where("papel", "==", "aluno")) : query(collection(db, "utilizadores"), where("turma", "==", turmaAtual), where("papel", "==", "aluno")); const snapshot = await getDocs(qAlunos); let h = ''; snapshot.forEach(d => { h += `<label class="membro-checkbox-item"><input type="checkbox" class="cb-membro-forum" value="${d.id}" checked> ${d.data().nome}</label>`; }); cList.innerHTML = h || '<p class="text-muted" style="text-align:center;">Sem alunos registados.</p>'; } catch(e) {}
});
document.getElementById('btn-cancelar-forum')?.addEventListener('click', () => { document.getElementById('modal-novo-forum').style.display = 'none'; });
document.getElementById('btn-selecionar-todos-forum')?.addEventListener('click', () => { const cbs = document.querySelectorAll('.cb-membro-forum'); const todosMarcados = Array.from(cbs).every(cb => cb.checked); cbs.forEach(cb => cb.checked = !todosMarcados); });
document.getElementById('novo-forum-tipo')?.addEventListener('change', (e) => { document.getElementById('box-forum-expira').style.display = e.target.value === 'temporario' ? 'block' : 'none'; });

document.getElementById('btn-gravar-forum')?.addEventListener('click', async (e) => {
    const nome = document.getElementById('novo-forum-nome').value.trim(); const tipo = document.getElementById('novo-forum-tipo').value; const expira = document.getElementById('novo-forum-expira').value;
    if(!nome) return alert("Dá um nome ao canal!"); let membrosSelecionados = []; document.querySelectorAll('.cb-membro-forum:checked').forEach(cb => membrosSelecionados.push(cb.value));
    if(membrosSelecionados.length === 0) return alert("Tens de adicionar pelo menos 1 membro!");
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try { await addDoc(collection(db, "turmas", turmaAtual, "foruns"), { nome: nome, tipo: tipo, expiraEm: tipo==='temporario'?expira:'', membros: membrosSelecionados, criadoEm: new Date().toISOString() }); document.getElementById('modal-novo-forum').style.display = 'none'; document.getElementById('novo-forum-nome').value = ""; btnRef.innerText = "Criar"; carregarForuns(); } catch(err) { btnRef.innerText = "Erro!"; }
});

async function carregarForuns() {
    const container = document.getElementById('lista-canais-forum'); container.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar canais...</p>';
    try {
        const res = await getDocs(query(collection(db, "turmas", turmaAtual, "foruns"))); if(res.empty) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Ainda não existem fóruns criados para esta turma.</p>'; return; }
        let html = ''; res.forEach(docSnap => { const f = docSnap.data(); const icon = f.tipo === 'permanente' ? 'fa-comments' : 'fa-stopwatch'; html += `<div class="canal-card" data-id="${docSnap.id}" data-json='${JSON.stringify(f)}'><div class="canal-icon"><i class="fa-solid ${icon}"></i></div><div class="canal-info"><h4>${f.nome}</h4><p>${f.membros.length} Membro(s)</p></div></div>`; }); container.innerHTML = html;
        container.querySelectorAll('.canal-card').forEach(card => card.addEventListener('click', (e) => { const fData = JSON.parse(e.currentTarget.getAttribute('data-json')); forumAtivoId = e.currentTarget.getAttribute('data-id'); document.getElementById('chat-active-title').innerText = fData.nome; document.getElementById('mif-nome').innerText = fData.nome; document.getElementById('mif-tipo').innerText = fData.tipo.toUpperCase() + (fData.expiraEm ? ` (até ${fData.expiraEm})` : ''); document.getElementById('mif-membros').innerText = fData.membros.length + " aluno(s)"; document.getElementById('forum-channel-list').style.display = 'none'; document.getElementById('forum-chat-view').style.display = 'flex'; iniciarChat(forumAtivoId); }));
    } catch(err) {}
}
document.getElementById('btn-info-canal')?.addEventListener('click', () => document.getElementById('modal-info-forum').style.display = 'flex');

let chatUnsubscribe = null;
function iniciarChat(fId) {
    const chatContainer = document.getElementById('chat-messages-container'); chatContainer.innerHTML = ''; if(chatUnsubscribe) chatUnsubscribe();
    chatUnsubscribe = onSnapshot(query(collection(db, "turmas", turmaAtual, "foruns", fId, "mensagens"), orderBy("timestamp")), (snapshot) => { let html = ''; snapshot.forEach(doc => { const msg = doc.data(); const isMe = msg.remetente === myUserName; const classe = isMe ? 'admin' : 'student'; html += `<div class="chat-bubble ${classe}"><strong>${isMe ? 'Tu' : msg.remetente}</strong><br>${msg.texto}<span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span></div>`; }); chatContainer.innerHTML = html; chatContainer.scrollTop = chatContainer.scrollHeight; });
}
document.getElementById('btn-send-msg')?.addEventListener('click', async () => { const inp = document.getElementById('input-forum-msg'); const txt = inp.value.trim(); if(!txt || !forumAtivoId) return; try { await addDoc(collection(db, "turmas", turmaAtual, "foruns", forumAtivoId, "mensagens"), { remetente: myUserName, texto: txt, timestamp: Date.now() }); inp.value = ''; } catch(e){} });

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
    listaModulosUI.querySelectorAll('.btn-gravar-nota').forEach(b => b.addEventListener('click', async (e) => { const d = e.currentTarget.getAttribute('data-disc'); const m = e.currentTarget.getAttribute('data-mod'); const v = notaSelecionadaTemporaria[m]; if(!v) return; const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ...'; try { const valorDb = v === "REP" ? "REP" : Number(v); const motivo = v === "REP" ? document.getElementById(`input-reason-${d}-${m}`).value : ""; await setDoc(doc(db, "utilizadores", alunoAtualId, "notas", `${d}_${m}`), { disciplina: d, modulo: m, nota: valorDb, motivoRep: motivo, data: new Date().toISOString() }); btnRef.innerText = "Gravado!"; setTimeout(() => { btnRef.innerText = "OK (Gravar)"; abrirModulosDisciplinaAvaliacao(d); }, 800); } catch(err){ btnRef.innerText = "Erro!"; } }));
}

// INFORMAÇÕES PESSOAIS
document.querySelectorAll('.btn-fechar-modal').forEach(b => b.addEventListener('click', () => { document.getElementById('modal-telefone').style.display='none'; document.getElementById('modal-email').style.display='none'; document.getElementById('modal-nova-falta').style.display='none'; document.getElementById('modal-alterar-falta').style.display='none'; document.getElementById('modal-novo-evento').style.display='none'; document.getElementById('modal-editar-horario').style.display='none'; document.getElementById('modal-novo-forum').style.display='none'; document.getElementById('modal-info-forum').style.display='none'; document.getElementById('modal-evento-info').style.display='none'; document.getElementById('modal-ver-atestado').style.display='none'; }));
document.addEventListener('click', (e) => { if (e.target.classList.contains('clickable-contact')) { const tipo = e.target.getAttribute('data-type'); const valor = e.target.innerText; if(valor === "-" || valor === "") return; nomePessoaContactoModal = e.target.id.includes('aluno') ? document.getElementById('detail-student-name').innerText : (document.getElementById('display-ee-nome').innerText || "Enc. Educação"); window.contactoTemp = valor; if (tipo === 'tel') { document.getElementById('action-ligar').href = `tel:${valor}`; document.getElementById('modal-telefone').style.display = 'flex'; } else if (tipo === 'email') { document.getElementById('action-enviar-email').href = `mailto:${valor}`; document.getElementById('modal-email').style.display = 'flex'; } } });
document.getElementById('action-guardar-vcard')?.addEventListener('click', () => { const vcard = `BEGIN:VCARD\nVERSION:3.0\nFN:${nomePessoaContactoModal}\nTEL:${window.contactoTemp}\nEND:VCARD`; const blob = new Blob([vcard], { type: 'text/vcard' }); const link = document.createElement('a'); link.href = URL.createObjectURL(blob); link.download = `${nomePessoaContactoModal.replace(/\s+/g,'_')}.vcf`; document.body.appendChild(link); link.click(); document.body.removeChild(link); document.getElementById('modal-telefone').style.display = 'none'; });
document.getElementById('btn-hub-informacoes')?.addEventListener('click', async () => { esconderTudoMenos(viewInformacoes); try { const docSnap = await getDoc(doc(db, "utilizadores", alunoAtualId)); if (docSnap.exists()) { const d = docSnap.data(); document.getElementById('display-aluno-idade').innerText = d.idade || "-"; document.getElementById('display-aluno-tel').innerText = d.telAluno || "-"; document.getElementById('display-aluno-email').innerText = d.emailAluno || "-"; document.getElementById('display-aluno-morada').innerText = d.morada || "-"; document.getElementById('display-ee-nome').innerText = d.nomeEE || "-"; document.getElementById('display-ee-filiacao').innerText = d.filiacaoEE || "-"; document.getElementById('display-ee-tel').innerText = d.telEE || "-"; document.getElementById('display-ee-email').innerText = d.emailEE || "-"; } } catch (error) {} });

// PRHF
const selDisc = document.getElementById('prhf-disciplina'); const selMod = document.getElementById('prhf-modulo');
let optDisc = '<option value="">Disc.</option>'; for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) optDisc += `<option value="${d}">${d}</option>`; } selDisc.innerHTML = optDisc;
const optDiscFilter = '<option value="">Todas as Disciplinas</option>' + optDisc; document.getElementById('filtro-prhf-disc').innerHTML = optDiscFilter;
selDisc.addEventListener('change', (e) => { const d = e.target.value; let modsObj = {}; for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } let optMod = '<option value="">Mod.</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); selMod.innerHTML = optMod; });
document.getElementById('prhf-file-upload')?.addEventListener('change', (e) => { const file = e.target.files[0]; if(!file) return; if(file.size > 716800) { alert("Ficheiro demasiado grande! O limite é 700KB."); return; } pdfNomeTemporario = file.name; document.getElementById('prhf-file-name').innerText = pdfNomeTemporario; const reader = new FileReader(); reader.onload = (ev) => { pdfBase64Temporario = ev.target.result; }; reader.readAsDataURL(file); });

let tabAtivaPrhf = 'ativas'; const modalFolha = document.getElementById('modal-prhf-sheet');
if(document.getElementById('btn-hub-prhf')) { document.getElementById('btn-hub-prhf').addEventListener('click', () => { esconderTudoMenos(viewPrhf); tabAtivaPrhf = 'ativas'; document.getElementById('tab-prhf-ativas').classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId); }); }
document.getElementById('tab-prhf-ativas')?.addEventListener('click', (e) => { tabAtivaPrhf = 'ativas'; e.currentTarget.classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId); });
document.getElementById('tab-prhf-concluidas')?.addEventListener('click', (e) => { tabAtivaPrhf = 'concluidas'; e.currentTarget.classList.add('active'); document.getElementById('tab-prhf-ativas').classList.remove('active'); carregarListaPRHF(alunoAtualId); });
document.getElementById('filtro-prhf-disc')?.addEventListener('change', () => carregarListaPRHF(alunoAtualId));

document.getElementById('btn-guardar-prhf')?.addEventListener('click', async (e) => {
    const disc = selDisc.value; const mod = selMod.value; const prazo = document.getElementById('prhf-prazo').value; const desc = document.getElementById('prhf-descricao').value.trim(); const htInput = document.getElementById('prhf-horas').value; const isTerminado = document.getElementById('prhf-modulo-terminado').checked;
    if(!disc || !mod || !prazo || !desc || !htInput) return alert("Preenche todos os campos!");
    const hT = parseInt(htInput); const hP = hT > 4 ? Math.ceil(hT * 0.3) : 0; const hN = hT - hP; const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
    try { await addDoc(collection(db, "utilizadores", alunoAtualId, "prhfs"), { disciplina: disc, modulo: mod, prazo: prazo, descricao: desc, horasNaoPresenciais: hN, horasPresenciais: hP, moduloTerminado: isTerminado, status: 'ativa', dataRegisto: new Date().toISOString(), registosManuais: [], pdfName: pdfNomeTemporario, pdfFile: pdfBase64Temporario }); selDisc.value = ""; selMod.value = ""; document.getElementById('prhf-prazo').value = ""; document.getElementById('prhf-descricao').value = ""; document.getElementById('prhf-horas').value = ""; document.getElementById('prhf-modulo-terminado').checked = false; pdfBase64Temporario = ""; pdfNomeTemporario = ""; document.getElementById('prhf-file-name').innerText = ""; document.getElementById('prhf-file-upload').value = ""; btnRef.innerText = "Gravado!"; setTimeout(() => { btnRef.innerText = "Processar e Gravar"; }, 1000); tabAtivaPrhf = 'ativas'; document.getElementById('tab-prhf-ativas').classList.add('active'); document.getElementById('tab-prhf-concluidas').classList.remove('active'); carregarListaPRHF(alunoAtualId); } catch (err) { btnRef.innerText = "Erro!"; } 
});

let prhfsMemoria = [];
async function carregarListaPRHF(idAluno) {
    const container = document.getElementById('lista-prhf-container'); container.innerHTML = '<p class="text-muted">A carregar...</p>'; prhfsMemoria = []; const filtroDisc = document.getElementById('filtro-prhf-disc').value;
    try { const res = await getDocs(query(collection(db, "utilizadores", idAluno, "prhfs"))); let html = ''; res.forEach(doc => { const data = doc.data(); data.id = doc.id; if (filtroDisc !== "" && data.disciplina !== filtroDisc) return; if ((tabAtivaPrhf === 'ativas' && data.status === 'ativa') || (tabAtivaPrhf === 'concluidas' && data.status === 'concluida')) { prhfsMemoria.push(data); let classeCor = 'concluida'; if(data.status === 'ativa') classeCor = data.moduloTerminado ? 'ativa-terminado' : 'ativa-decorrer'; const sM = (data.modulo||"").includes('M') ? data.modulo : 'M'+data.modulo; html += `<div class="prhf-mini-card ${classeCor}" data-id="${data.id}"><strong>${data.disciplina}_${sM}</strong><i class="fa-solid fa-chevron-right" style="color:var(--text-muted); font-size:0.8rem;"></i></div>`; } }); if (html === '') { container.innerHTML = `<p class="text-muted">Sem tarefas ${tabAtivaPrhf}.</p>`; return; } container.innerHTML = html; container.querySelectorAll('.prhf-mini-card').forEach(card => card.addEventListener('click', (e) => abrirFolhaPRHF(e.currentTarget.getAttribute('data-id')))); } catch (err) {}
}

function desenharRegistosManuais(plano) {
    const container = document.getElementById('lista-presencias-manuais'); let totalRealizado = 0;
    if(!plano.registosManuais || plano.registosManuais.length === 0) { container.innerHTML = ""; } else { let h = "<p style='margin-bottom:5px;'><strong>Já Registadas:</strong></p>"; plano.registosManuais.forEach((r, idx) => { totalRealizado += r.horas; h += `<div class="registo-item"><span>${r.data} (${r.inicio} - ${r.fim}) [${r.horas}h]</span><i class="fa-solid fa-trash registo-item-del" data-idx="${idx}"></i></div>`; }); container.innerHTML = h; container.querySelectorAll('.registo-item-del').forEach(icon => { icon.addEventListener('click', async (e) => { if(!confirm("Apagar este registo?")) return; const indexToRemove = e.currentTarget.getAttribute('data-idx'); const novaLista = [...plano.registosManuais]; novaLista.splice(indexToRemove, 1); try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { registosManuais: novaLista }); plano.registosManuais = novaLista; desenharRegistosManuais(plano); } catch(err) {} }); }); }
    document.getElementById('sheet-horas-feitas').innerText = totalRealizado; document.getElementById('sheet-horas-totais').innerText = plano.horasPresenciais || 0; const btnConcluir = document.getElementById('sheet-btn-concluir'); const progressFill = document.getElementById('sheet-btn-progress-fill'); const progressText = document.getElementById('sheet-btn-progress-text'); const txtRegisto = document.getElementById('txt-btn-registo'); const hP = plano.horasPresenciais || 0; let perc = hP > 0 ? Math.min((totalRealizado / hP) * 100, 100) : 100; progressFill.style.width = `${perc}%`; progressText.innerHTML = `<i class="fa-solid fa-check"></i> Concluído (${Math.floor(perc || 0)}%)`; if(totalRealizado >= hP && hP > 0) { btnConcluir.classList.add('ready'); btnConcluir.disabled = false; txtRegisto.innerText = "Retificar Presenciais"; } else { btnConcluir.classList.remove('ready'); btnConcluir.disabled = true; txtRegisto.innerText = "Registar Presenciais"; }
}

function abrirFolhaPRHF(id) {
    const p = prhfsMemoria.find(x => x.id === id); if(!p) return; idPrhfAtivo = id; const sM = (p.modulo||"").includes('M') ? p.modulo : 'M'+p.modulo; const dp = (p.prazo||"").split('-'); const dF = dp.length === 3 ? `${dp[2]}/${dp[1]}/${dp[0]}` : p.prazo; document.getElementById('sheet-title').innerText = `${p.disciplina}_${sM}`; document.getElementById('sheet-prazo').innerText = dF; document.getElementById('sheet-hp').innerText = p.horasPresenciais || 0; document.getElementById('sheet-ha').innerText = p.horasNaoPresenciais || 0; document.getElementById('sheet-desc').innerText = p.descricao; const btnDownload = document.getElementById('sheet-btn-download-pdf'); if(p.pdfFile) { btnDownload.style.display = 'flex'; btnDownload.href = p.pdfFile; btnDownload.download = p.pdfName || `Anexo_${p.disciplina}.pdf`; } else { btnDownload.style.display = 'none'; } const badge = document.getElementById('sheet-status'); badge.innerText = p.status.toUpperCase(); if(p.status === 'ativa') badge.className = `paper-status ${p.moduloTerminado ? 'ativa-terminado' : 'ativa-decorrer'}`; else badge.className = `paper-status concluida`; if (p.status === 'concluida') { document.getElementById('sheet-btn-concluir').style.display = 'none'; document.getElementById('sheet-btn-reverter').style.display = 'flex'; document.getElementById('sheet-btn-toggle-manual').style.display = 'none'; document.getElementById('manual-presence-box').style.display = 'none'; } else { document.getElementById('sheet-btn-concluir').style.display = 'block'; document.getElementById('sheet-btn-reverter').style.display = 'none'; document.getElementById('sheet-btn-toggle-manual').style.display = 'flex'; document.getElementById('manual-presence-box').style.display = 'none'; } desenharRegistosManuais(p); modalFolha.style.display = 'flex';
}
document.querySelector('.btn-close-paper')?.addEventListener('click', () => modalFolha.style.display = 'none');
document.getElementById('sheet-btn-toggle-manual')?.addEventListener('click', () => { const box = document.getElementById('manual-presence-box'); box.style.display = box.style.display === 'none' ? 'block' : 'none'; });

document.getElementById('btn-save-manual-pres')?.addEventListener('click', async (e) => { const d = document.getElementById('reg-pres-data').value; const i = document.getElementById('reg-pres-inicio').value; const f = document.getElementById('reg-pres-fim').value; if(!d || !i || !f) return alert("Preenche Data, Início e Fim!"); const [hI, mI] = i.split(':').map(Number); const [hF, mF] = f.split(':').map(Number); let diff = (hF + mF/60) - (hI + mI/60); const horasCalc = diff > 0 ? Math.floor(diff) : 0; if(horasCalc <= 0) return alert("A diferença deve ser pelo menos 1h!"); const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; try { const nR = { data: d, inicio: i, fim: f, horas: horasCalc }; const p = prhfsMemoria.find(x => x.id === idPrhfAtivo); const novaLista = p.registosManuais ? [...p.registosManuais, nR] : [nR]; await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { registosManuais: novaLista }); document.getElementById('reg-pres-data').value = ""; document.getElementById('reg-pres-inicio').value = ""; document.getElementById('reg-pres-fim').value = ""; p.registosManuais = novaLista; desenharRegistosManuais(p); btnRef.innerText = "Gravado!"; setTimeout(() => btnRef.innerText = "Guardar Registo", 1000); } catch(err){ btnRef.innerText = "Erro!"; } });
document.getElementById('sheet-btn-concluir')?.addEventListener('click', async () => { const p = prhfsMemoria.find(x => x.id === idPrhfAtivo); if(p.status === 'concluida' || document.getElementById('sheet-btn-concluir').disabled) return; if(!confirm("Marcar como CONCLUÍDO?")) return; try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { status: 'concluida' }); modalFolha.style.display = 'none'; carregarListaPRHF(alunoAtualId); } catch(err){} });
document.getElementById('sheet-btn-reverter')?.addEventListener('click', async (e) => { if(!confirm("REVERTER para ATIVA?")) return; e.currentTarget.innerText = "A reverter..."; try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "prhfs", idPrhfAtivo), { status: 'ativa' }); modalFolha.style.display = 'none'; carregarListaPRHF(alunoAtualId); } catch(err){ e.currentTarget.innerText = "Reverter para Ativa"; } });

// FALTAS ADMIN
let optFaltasDiscOptionsOnly = ""; let faltasMemoria = [];
for(const comp of Object.values(matrizCurso)) { for(const d of Object.keys(comp)) optFaltasDiscOptionsOnly += `<option value="${d}">${d}</option>`; }

document.getElementById('btn-hub-faltas')?.addEventListener('click', () => { esconderTudoMenos(viewFaltas); document.getElementById('tab-faltas-disciplina').classList.add('active'); document.getElementById('tab-faltas-data').classList.remove('active'); document.getElementById('faltas-container-disciplina').style.display = 'block'; document.getElementById('faltas-container-data').style.display = 'none'; document.getElementById('toolbar-faltas-data').style.display = 'none'; document.getElementById('filtro-disc-faltas').innerHTML = '<option value="">Todas as Disc.</option>' + optFaltasDiscOptionsOnly; document.getElementById('nf-disc').innerHTML = '<option value="">Disciplina</option>' + optFaltasDiscOptionsOnly; document.getElementById('af-disc').innerHTML = '<option value="">Disciplina</option>' + optFaltasDiscOptionsOnly; construirMatrizVisual(document.getElementById('faltas-container-disciplina'), abrirModulosDisciplinaFaltas); });
document.getElementById('tab-faltas-disciplina')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-faltas-data').classList.remove('active'); document.getElementById('faltas-container-disciplina').style.display = 'block'; document.getElementById('faltas-container-data').style.display = 'none'; document.getElementById('toolbar-faltas-data').style.display = 'none'; });
document.getElementById('tab-faltas-data')?.addEventListener('click', (e) => { e.currentTarget.classList.add('active'); document.getElementById('tab-faltas-disciplina').classList.remove('active'); document.getElementById('faltas-container-disciplina').style.display = 'none'; document.getElementById('faltas-container-data').style.display = 'block'; document.getElementById('toolbar-faltas-data').style.display = 'flex'; carregarHistoricoFaltas(); });
document.getElementById('btn-refresh-faltas')?.addEventListener('click', (e) => { e.currentTarget.querySelector('i').classList.add('fa-spin'); carregarHistoricoFaltas().finally(() => setTimeout(() => e.target.closest('button').querySelector('i').classList.remove('fa-spin'), 500)); });
document.getElementById('filtro-mes-faltas')?.addEventListener('change', carregarHistoricoFaltas); document.getElementById('filtro-disc-faltas')?.addEventListener('change', carregarHistoricoFaltas); document.getElementById('filtro-just-faltas')?.addEventListener('change', carregarHistoricoFaltas);
document.getElementById('btn-nova-falta')?.addEventListener('click', () => { document.getElementById('modal-nova-falta').style.display = 'flex'; });
document.getElementById('btn-cancelar-nova-falta')?.addEventListener('click', () => { document.getElementById('modal-nova-falta').style.display = 'none'; });
document.getElementById('btn-menos-hora')?.addEventListener('click', () => { const input = document.getElementById('nf-horas'); let v = parseInt(input.value) || 1; if(v > 1) input.value = v - 1; });
document.getElementById('btn-mais-hora')?.addEventListener('click', () => { const input = document.getElementById('nf-horas'); let v = parseInt(input.value) || 1; if(v < 8) input.value = v + 1; });

let modoFaltaAtual = 'simples';
document.getElementById('tab-falta-simples')?.addEventListener('click', (e) => { modoFaltaAtual = 'simples'; e.currentTarget.classList.add('active'); document.getElementById('tab-falta-multipla').classList.remove('active'); document.getElementById('view-falta-simples').style.display = 'block'; document.getElementById('view-falta-multipla').style.display = 'none'; });
document.getElementById('tab-falta-multipla')?.addEventListener('click', (e) => { modoFaltaAtual = 'multipla'; e.currentTarget.classList.add('active'); document.getElementById('tab-falta-simples').classList.remove('active'); document.getElementById('view-falta-simples').style.display = 'none'; document.getElementById('view-falta-multipla').style.display = 'block'; });

document.getElementById('btn-add-linha-falta')?.addEventListener('click', () => { const div = document.createElement('div'); div.className = "falta-linha-multipla"; div.innerHTML = `<select class="lf-disc" style="margin:0; padding:8px; flex:2;"><option value="">Disc.</option>${optFaltasDiscOptionsOnly}</select><select class="lf-mod" style="margin:0; padding:8px; flex:2;"><option value="">Mod.</option></select><input type="number" class="lf-horas" value="1" min="1" max="8" style="margin:0; padding:8px; flex:1; text-align:center;"><button class="danger-btn small-btn btn-remover-linha-falta" style="padding:8px;"><i class="fa-solid fa-xmark"></i></button>`; document.getElementById('lista-linhas-faltas').appendChild(div); div.querySelector('.lf-disc').addEventListener('change', (e) => { const d = e.target.value; let modsObj = {}; for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } let optMod = '<option value="">Mod.</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); div.querySelector('.lf-mod').innerHTML = optMod; }); div.querySelector('.btn-remover-linha-falta').addEventListener('click', () => div.remove()); });
document.getElementById('nf-disc')?.addEventListener('change', (e) => { const d = e.target.value; let modsObj = {}; for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } let optMod = '<option value="">Módulo</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); document.getElementById('nf-mod').innerHTML = optMod; });

document.getElementById('btn-gravar-nova-falta')?.addEventListener('click', async (e) => {
    const justificada = document.getElementById('nf-justificada').checked; const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A registar...';
    try {
        if(modoFaltaAtual === 'simples') {
            const dInicio = document.getElementById('nf-data').value; const disc = document.getElementById('nf-disc').value; const mod = document.getElementById('nf-mod').value; const horas = parseInt(document.getElementById('nf-horas').value) || 1;
            if(!dInicio || !disc || !mod) { btnRef.innerText = "Registar"; return alert("Preenche todos os campos!"); }
            await addDoc(collection(db, "utilizadores", alunoAtualId, "faltas"), { dataInicio: dInicio, disciplina: disc, modulo: mod, horas, justificada, criadoEm: new Date().toISOString() });
        } else {
            const dIn = document.getElementById('nfm-data-inicio').value; const dFi = document.getElementById('nfm-data-fim').value || dIn;
            if(!dIn) { btnRef.innerText = "Registar"; return alert("Preenche a Data Inicial!"); }
            let dtStart = new Date(dIn); let dtEnd = new Date(dFi); let dArr = []; while(dtStart <= dtEnd) { const yyyy = dtStart.getFullYear(); const mm = String(dtStart.getMonth() + 1).padStart(2, '0'); const dd = String(dtStart.getDate()).padStart(2, '0'); dArr.push(`${yyyy}-${mm}-${dd}`); dtStart.setDate(dtStart.getDate() + 1); }
            const linhas = document.querySelectorAll('.falta-linha-multipla');
            for(let dataStr of dArr) { for(let linha of linhas) { const disc = linha.querySelector('.lf-disc').value; const mod = linha.querySelector('.lf-mod').value; const horas = parseInt(linha.querySelector('.lf-horas').value) || 1; if(disc && mod) await addDoc(collection(db, "utilizadores", alunoAtualId, "faltas"), { dataInicio: dataStr, disciplina: disc, modulo: mod, horas, justificada, criadoEm: new Date().toISOString() }); } }
        }
        document.getElementById('modal-nova-falta').style.display = 'none'; btnRef.innerText = "Registar"; await carregarHistoricoFaltas(); 
    } catch(err) { btnRef.innerText = "Erro!"; }
});

async function carregarHistoricoFaltas() {
    const container = document.getElementById('lista-historico-faltas-container'); container.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar faltas...</p>';
    const filtroMes = document.getElementById('filtro-mes-faltas').value; const filtroDisc = document.getElementById('filtro-disc-faltas').value; const filtroJust = document.getElementById('filtro-just-faltas').value;
    try {
        const res = await getDocs(query(collection(db, "utilizadores", alunoAtualId, "faltas")));
        if(res.empty) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Sem faltas registadas.</p>'; return; }
        faltasMemoria = []; res.forEach(d => { const f = d.data(); f.id = d.id; faltasMemoria.push(f); });
        let faltasFiltradas = faltasMemoria;
        if (filtroDisc) faltasFiltradas = faltasFiltradas.filter(f => f.disciplina === filtroDisc); if (filtroMes) faltasFiltradas = faltasFiltradas.filter(f => f.dataInicio.split('-')[1] === filtroMes);
        if (filtroJust === 'justificada') faltasFiltradas = faltasFiltradas.filter(f => f.justificada === true); else if (filtroJust === 'injustificada') faltasFiltradas = faltasFiltradas.filter(f => f.justificada === false);
        if(faltasFiltradas.length === 0) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Nenhuma falta corresponde a estes filtros.</p>'; return; }
        faltasFiltradas.sort((a,b) => b.dataInicio.localeCompare(a.dataInicio));
        let html = ''; let currentDate = ''; const mesArr = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez'];
        faltasFiltradas.forEach(f => {
            if(f.dataInicio !== currentDate) { currentDate = f.dataInicio; const dp = currentDate.split('-'); const dateStr = `${dp[2]} de ${mesArr[parseInt(dp[1])-1]} de ${dp[0]}`; html += `<div class="falta-date-divider">${dateStr}</div>`; }
            const cBar = f.justificada ? 'justificada' : 'injustificada'; const cMeta = f.justificada ? 'var(--success-green)' : 'var(--danger-red)'; const tMeta = f.justificada ? 'Justificada' : 'Injustificada';
            html += `<div class="falta-registo-card" style="flex-direction: row; align-items:center; background:var(--bg-dark);"><div class="falta-status-bar ${cBar}" style="align-self: stretch;"></div><input type="checkbox" class="falta-card-checkbox" data-id="${f.id}"><div class="falta-registo-info" style="flex:1;"><div><strong>${f.disciplina} - ${f.modulo} - ${f.horas}h</strong></div><div style="text-align:right;"><span class="falta-registo-meta" style="color:${cMeta}; font-weight:bold;">${tMeta}</span></div></div></div>`;
        });
        container.innerHTML = html;
    } catch(err) { container.innerHTML = '<p class="text-muted" style="color:var(--danger-red); text-align:center;">Erro ao carregar faltas.</p>'; }
}

document.getElementById('btn-eliminar-falta')?.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.falta-card-checkbox:checked'); if(checkboxes.length === 0) return alert("Seleciona pelo menos uma falta para eliminar.");
    if(!confirm(`Tens a certeza que queres eliminar ${checkboxes.length} falta(s)?`)) return;
    const btn = document.getElementById('btn-eliminar-falta'); const originalHTML = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ...';
    for(let cb of checkboxes) { await deleteDoc(doc(db, "utilizadores", alunoAtualId, "faltas", cb.getAttribute('data-id'))); } btn.innerHTML = originalHTML; await carregarHistoricoFaltas();
});
document.getElementById('btn-justificar-falta')?.addEventListener('click', async () => {
    const checkboxes = document.querySelectorAll('.falta-card-checkbox:checked'); if(checkboxes.length === 0) return alert("Seleciona pelo menos uma falta para (in)justificar.");
    const btn = document.getElementById('btn-justificar-falta'); const originalHTML = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> ...';
    for(let cb of checkboxes) { const id = cb.getAttribute('data-id'); const f = faltasMemoria.find(x => x.id === id); if(f) { await updateDoc(doc(db, "utilizadores", alunoAtualId, "faltas", id), { justificada: !f.justificada }); } }
    btn.innerHTML = originalHTML; await carregarHistoricoFaltas();
});

document.getElementById('btn-alterar-falta')?.addEventListener('click', () => {
    const checkboxes = document.querySelectorAll('.falta-card-checkbox:checked'); if(checkboxes.length !== 1) return alert("Seleciona exatamente UMA falta para alterar.");
    const id = checkboxes[0].getAttribute('data-id'); const f = faltasMemoria.find(x => x.id === id); if(!f) return;
    idFaltaEmEdicao = id; document.getElementById('af-data').value = f.dataInicio; document.getElementById('af-disc').value = f.disciplina;
    const d = f.disciplina; let modsObj = {}; for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } 
    let optMod = '<option value="">Módulo</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); 
    document.getElementById('af-mod').innerHTML = optMod; document.getElementById('af-mod').value = f.modulo;
    document.getElementById('af-horas').value = f.horas; document.getElementById('af-justificada').checked = f.justificada;
    document.getElementById('modal-alterar-falta').style.display = 'flex';
});

document.getElementById('af-disc')?.addEventListener('change', (e) => { const d = e.target.value; let modsObj = {}; for(const comp of Object.values(matrizCurso)) { if(comp[d]) modsObj = comp[d]; } let optMod = '<option value="">Módulo</option>'; Object.keys(modsObj).forEach(m => optMod += `<option value="${m}">${m}</option>`); document.getElementById('af-mod').innerHTML = optMod; });
document.getElementById('btn-cancelar-alteracao-falta')?.addEventListener('click', () => document.getElementById('modal-alterar-falta').style.display = 'none');
document.getElementById('btn-gravar-alteracao-falta')?.addEventListener('click', async (e) => {
    const dataInicio = document.getElementById('af-data').value; const disciplina = document.getElementById('af-disc').value; const modulo = document.getElementById('af-mod').value; const horas = parseInt(document.getElementById('af-horas').value) || 1; const justificada = document.getElementById('af-justificada').checked;
    if(!dataInicio || !disciplina || !modulo) return alert("Preenche os campos!");
    const btnRef = e.currentTarget; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...';
    try { await updateDoc(doc(db, "utilizadores", alunoAtualId, "faltas", idFaltaEmEdicao), { dataInicio, disciplina, modulo, horas, justificada }); document.getElementById('modal-alterar-falta').style.display = 'none'; btnRef.innerText = "Guardar"; await carregarHistoricoFaltas(); } catch(err) { btnRef.innerText = "Erro!"; }
});

async function abrirModulosDisciplinaFaltas(disciplina) {
    esconderTudoMenos(viewFaltasModulos); document.getElementById('titulo-falta-disciplina').innerText = disciplina;
    const container = document.getElementById('lista-faltas-disciplina'); container.innerHTML = '<p class="text-muted">A preparar faltas...</p>';
    let html = `<p class="text-muted" style="margin-bottom:15px;">Gestão de assiduidade por módulo:</p>`;
    let modulosArray = []; for (const comp of Object.values(matrizCurso)) { if (comp[disciplina]) modulosArray = Object.keys(comp[disciplina]); }
    modulosArray.forEach(mod => { html += `<div style="background:var(--bg-dark); padding:15px; border-radius:8px; border:1px solid #333; margin-bottom:12px;"><div style="display:flex; justify-content:space-between; margin-bottom:10px;"><strong>${mod}</strong><span class="falta-badge" id="badge-falta-${mod}">0h / ${matrizCurso[Object.keys(matrizCurso).find(c => matrizCurso[c][disciplina])][disciplina][mod]}h</span></div><div class="progress-bar-bg"><div class="progress-bar-fill" style="width:0%;"></div></div></div>`; });
    container.innerHTML = html;
}

// ==========================================
// MÓDULO NOVO: CHAT DIRETO COM O EE (DT)
// ==========================================
let chatUnsubscribeDTEE = null;

// Fechar este modal específico quando clicam no X
document.querySelectorAll('.btn-fechar-modal').forEach(b => b.addEventListener('click', () => { 
    const m = document.getElementById('modal-dt-chat-ee');
    if(m) m.style.display = 'none'; 
}));

document.getElementById('btn-hub-chat-ee')?.addEventListener('click', () => {
    if(!alunoAtualId) return;
    const nome = document.getElementById('detail-student-name').innerText;
    document.getElementById('dt-chat-ee-title').innerHTML = `<i class="fa-solid fa-envelope"></i> Família de ${nome}`;
    document.getElementById('modal-dt-chat-ee').style.display = 'flex';
    iniciarChatDTEE();
});

function iniciarChatDTEE() {
    const chatContainer = document.getElementById('dt-chat-ee-messages');
    chatContainer.innerHTML = '';
    if(chatUnsubscribeDTEE) chatUnsubscribeDTEE();

    chatUnsubscribeDTEE = onSnapshot(query(collection(db, "utilizadores", alunoAtualId, "chat_dt"), orderBy("timestamp")), (snapshot) => {
        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.autor === 'dt';
            // Se for do DT (Eu), usa verde (admin), senão usa cinza (student)
            const classe = isMe ? 'admin' : 'student'; 
            html += `<div class="chat-bubble ${classe}">
                        <strong>${isMe ? 'Tu' : msg.remetente} (EE)</strong><br>
                        ${msg.texto}
                        <span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                     </div>`;
        });
        chatContainer.innerHTML = html;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

document.getElementById('btn-dt-chat-ee-send')?.addEventListener('click', async () => {
    const inp = document.getElementById('dt-chat-ee-input');
    const txt = inp.value.trim();
    if(!txt || !alunoAtualId) return;
    
    try {
        await addDoc(collection(db, "utilizadores", alunoAtualId, "chat_dt"), {
            remetente: myUserName,
            autor: 'dt',
            texto: txt,
            timestamp: Date.now()
        });
        inp.value = '';
    } catch(e) { console.error("Erro a enviar mensagem", e); }
});

// ==========================================
// GESTÃO DO PASSAPORTE (FCT & PAP)
// ==========================================

// Fechar modal genérico (adicionamos a verificação para fechar este também)
document.querySelectorAll('.btn-fechar-modal').forEach(b => b.addEventListener('click', () => { 
    const mFct = document.getElementById('modal-dt-fct-pap');
    if(mFct) mFct.style.display = 'none'; 
}));

document.getElementById('btn-hub-fct-pap')?.addEventListener('click', async () => {
    if(!alunoAtualId) return;
    document.getElementById('modal-dt-fct-pap').style.display = 'flex';
    
    // Resetar campos para mostrar estado de loading
    document.getElementById('dt-fct-entidade').value = "A carregar...";
    document.getElementById('dt-fct-horas-feitas').value = "";
    document.getElementById('dt-fct-horas-totais').value = "";
    document.getElementById('dt-pap-tema').value = "A carregar...";
    document.getElementById('btn-dt-baixar-pap').style.display = 'none';
    document.getElementById('dt-pap-status-txt').innerText = "A procurar ficheiro...";

    try {
        const docSnap = await getDoc(doc(db, "utilizadores", alunoAtualId));
        if(docSnap.exists()) {
            const d = docSnap.data();
            
            // Preencher campos
            document.getElementById('dt-fct-entidade').value = d.fctEntidade || "";
            document.getElementById('dt-fct-horas-feitas').value = d.fctHorasFeitas || 0;
            document.getElementById('dt-fct-horas-totais').value = d.fctHorasTotais || 400;
            document.getElementById('dt-pap-tema').value = d.papTema || "";
            
            // Verificar se o aluno já enviou o PDF
            if(d.papFicheiroEnviado && d.papFicheiroBase64) {
                document.getElementById('dt-pap-status-txt').innerHTML = '<i class="fa-solid fa-file-pdf" style="color:var(--success-green);"></i> Anteprojeto Recebido!';
                const btnDownload = document.getElementById('btn-dt-baixar-pap');
                btnDownload.style.display = 'block';
                btnDownload.href = d.papFicheiroBase64;
                
                // Dar o nome do aluno ao ficheiro PDF para ser mais fácil de organizar no computador
                const nomeAlunoLimpo = d.nome.replace(/\s+/g, '_');
                btnDownload.download = `PAP_${nomeAlunoLimpo}.pdf`;
            } else {
                document.getElementById('dt-pap-status-txt').innerText = "O aluno ainda não enviou o ficheiro.";
            }
        }
    } catch(e) {
        console.error("Erro a carregar FCT/PAP:", e);
        document.getElementById('dt-pap-status-txt').innerText = "Erro ao carregar os dados.";
    }
});

// Guardar alterações feitas pelo DT
document.getElementById('btn-gravar-fct-pap')?.addEventListener('click', async (e) => {
    if(!alunoAtualId) return;
    const btnRef = e.currentTarget;
    const textOrig = btnRef.innerHTML;
    btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
    
    const entidade = document.getElementById('dt-fct-entidade').value.trim();
    const hFeitas = Number(document.getElementById('dt-fct-horas-feitas').value) || 0;
    const hTotais = Number(document.getElementById('dt-fct-horas-totais').value) || 400;
    const tema = document.getElementById('dt-pap-tema').value.trim();

    try {
        await updateDoc(doc(db, "utilizadores", alunoAtualId), {
            fctEntidade: entidade,
            fctHorasFeitas: hFeitas,
            fctHorasTotais: hTotais,
            papTema: tema
        });
        
        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Gravado com Sucesso!';
        setTimeout(() => {
            document.getElementById('modal-dt-fct-pap').style.display = 'none';
            btnRef.innerHTML = textOrig;
        }, 1200);
        
    } catch(err) {
        btnRef.innerHTML = "Erro ao gravar!";
        setTimeout(() => btnRef.innerHTML = textOrig, 2000);
    }
});

// ==========================================
// SUMÁRIOS E MATERIAIS DE AULA (DT / ADMIN)
// ==========================================
const viewSumarios = document.getElementById('view-sumarios');
let materialBase64Temporario = "";
let materialNomeTemporario = "";

// Adicionar a função extra para fechar a nova janela (modal)
document.querySelectorAll('.btn-fechar-modal').forEach(b => b.addEventListener('click', () => { 
    const mSum = document.getElementById('modal-novo-sumario');
    if(mSum) mSum.style.display = 'none'; 
}));

document.getElementById('btn-hub-sumarios')?.addEventListener('click', async () => {
    // Esconder o Hub Principal e mostrar os Sumários
    document.getElementById('class-hub-view').style.display = 'none';
    viewSumarios.style.display = 'block';
    
    let optDisc = '<option value="">Todas as Disciplinas</option>';
    if (typeof matrizCurso !== 'undefined') {
        for(const comp of Object.values(matrizCurso)) { 
            for(const d of Object.keys(comp)) optDisc += `<option value="${d}">${d}</option>`; 
        }
    }
    document.getElementById('filtro-sumarios-disc').innerHTML = optDisc;
    
    carregarSumariosGestao();
});

document.getElementById('btn-voltar-sumarios-hub')?.addEventListener('click', () => {
    viewSumarios.style.display = 'none';
    document.getElementById('class-hub-view').style.display = 'block';
});

document.getElementById('filtro-sumarios-disc')?.addEventListener('change', carregarSumariosGestao);

document.getElementById('btn-novo-sumario')?.addEventListener('click', () => {
    let optDisc = '<option value="">Disciplina</option>';
    if (typeof matrizCurso !== 'undefined') {
        for(const comp of Object.values(matrizCurso)) { 
            for(const d of Object.keys(comp)) optDisc += `<option value="${d}">${d}</option>`; 
        }
    }
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

    // Deteta se está no Admin ou no DT para encontrar a turma certa
    let turmaParaGravar = typeof turmaAtual !== 'undefined' ? turmaAtual : (typeof minhaTurma !== 'undefined' ? minhaTurma : null);
    
    if(!turmaParaGravar) {
         alert("Erro interno: Turma não identificada.");
         btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Publicar';
         btnRef.disabled = false;
         return;
    }

    try {
        await addDoc(collection(db, "turmas", turmaParaGravar, "sumarios"), {
            data: data,
            disciplina: disc,
            titulo: titulo,
            descricao: desc,
            anexoNome: materialNomeTemporario,
            anexoBase64: materialBase64Temporario,
            professor: typeof myUserName !== 'undefined' ? myUserName : "Direção/DT",
            criadoEm: new Date().toISOString()
        });
        
        btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Publicado!';
        setTimeout(() => {
            document.getElementById('modal-novo-sumario').style.display = 'none';
            btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Publicar';
            btnRef.disabled = false;
            carregarSumariosGestao();
        }, 1000);
    } catch(err) {
        btnRef.innerHTML = "Erro!";
        setTimeout(() => { btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Publicar'; btnRef.disabled = false; }, 2000);
    }
});

async function carregarSumariosGestao() {
    const container = document.getElementById('lista-sumarios-container');
    container.innerHTML = '<p class="text-muted" style="text-align:center;">A carregar sumários...</p>';
    const filtroDisc = document.getElementById('filtro-sumarios-disc').value;

    let turmaParaLer = typeof turmaAtual !== 'undefined' ? turmaAtual : (typeof minhaTurma !== 'undefined' ? minhaTurma : "TUR"); 

    try {
        const res = await getDocs(query(collection(db, "turmas", turmaParaLer, "sumarios")));
        if(res.empty) { container.innerHTML = '<p class="text-muted" style="text-align:center;">Nenhum sumário registado nesta turma.</p>'; return; }
        
        let sumarios = [];
        res.forEach(d => sumarios.push({id: d.id, ...d.data()}));
        
        if(filtroDisc) sumarios = sumarios.filter(s => s.disciplina === filtroDisc);
        sumarios.sort((a,b) => b.data.localeCompare(a.data)); 

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

// ==========================================
// GESTÃO DE COMPORTAMENTO / OCORRÊNCIAS
// ==========================================
const viewComportamento = document.getElementById('view-comportamento');
let tipoOcorrenciaAtual = "negativa"; 

document.getElementById('btn-hub-comportamento')?.addEventListener('click', () => {
    if(!alunoAtualId) return;
    document.getElementById('student-detail-view').style.display = 'none';
    if(viewComportamento) viewComportamento.style.display = 'block';
    carregarComportamento();
});

document.getElementById('btn-voltar-hub-comportamento')?.addEventListener('click', () => {
    if(viewComportamento) viewComportamento.style.display = 'none';
    document.getElementById('student-detail-view').style.display = 'block';
});

document.getElementById('btn-tipo-negativo')?.addEventListener('click', (e) => { 
    tipoOcorrenciaAtual = "negativa"; 
    e.currentTarget.classList.add('active'); 
    document.getElementById('btn-tipo-positivo').classList.remove('active'); 
});

document.getElementById('btn-tipo-positivo')?.addEventListener('click', (e) => { 
    tipoOcorrenciaAtual = "positiva"; 
    e.currentTarget.classList.add('active'); 
    document.getElementById('btn-tipo-negativo').classList.remove('active'); 
});

document.getElementById('btn-nova-ocorrencia')?.addEventListener('click', () => {
    document.getElementById('no-data').value = new Date().toISOString().split('T')[0];
    document.getElementById('no-titulo').value = ""; 
    document.getElementById('no-descricao').value = "";
    document.getElementById('modal-nova-ocorrencia').style.display = 'flex';
});

document.getElementById('btn-gravar-ocorrencia')?.addEventListener('click', async (e) => {
    const data = document.getElementById('no-data').value; 
    const titulo = document.getElementById('no-titulo').value.trim(); 
    const desc = document.getElementById('no-descricao').value.trim();
    
    if(!data || !titulo) return alert("Preencha Data e Motivo!");
    
    const btnRef = e.currentTarget; 
    const txtOrig = btnRef.innerText; 
    btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
    btnRef.disabled = true;
    
    try {
        await addDoc(collection(db, "utilizadores", alunoAtualId, "ocorrencias"), { 
            data: data, 
            tipo: tipoOcorrenciaAtual, 
            titulo: titulo, 
            descricao: desc, 
            autor: (typeof myUserName !== 'undefined') ? myUserName : "Gestão", 
            timestamp: Date.now() 
        });
        btnRef.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => { 
            document.getElementById('modal-nova-ocorrencia').style.display = 'none'; 
            btnRef.innerText = txtOrig; 
            btnRef.disabled = false; 
            carregarComportamento(); 
        }, 1000);
    } catch(err) { 
        btnRef.innerText = "Erro!"; 
        setTimeout(() => { 
            btnRef.innerText = txtOrig; 
            btnRef.disabled = false; 
        }, 2000); 
    }
});

async function carregarComportamento() {
    const container = document.getElementById('lista-comportamento-container'); 
    container.innerHTML = '<p class="text-muted center">A carregar...</p>';
    if(!alunoAtualId) return;
    
    try {
        const res = await getDocs(query(collection(db, "utilizadores", alunoAtualId, "ocorrencias")));
        if(res.empty) { 
            container.innerHTML = '<p class="text-muted center">Nenhum registo.</p>'; 
            return; 
        }
        
        let regs = []; 
        res.forEach(d => regs.push(d.data())); 
        regs.sort((a,b) => b.data.localeCompare(a.data));
        
        let html = '';
        regs.forEach(r => {
            const cor = r.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)';
            const ic = r.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>';
            html += `
            <div class="card" style="margin-bottom:15px; border-left: 4px solid ${cor};">
                <div>
                    <div style="display:flex; align-items:center; gap:8px; color:${cor}; margin-bottom:5px;">
                        ${ic} <strong>${r.titulo}</strong>
                    </div>
                    <span style="font-size:0.75rem; color:var(--text-muted);">Data: ${r.data} | Prof. ${r.autor}</span>
                    ${r.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px; background:var(--bg-dark); padding:8px; border-radius:6px;">${r.descricao}</p>` : ''}
                </div>
            </div>`;
        });
        container.innerHTML = html;
    } catch(e) { container.innerHTML = '<p class="text-danger center">Erro.</p>'; }
}
