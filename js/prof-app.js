import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, setDoc, collection, query, where, getDocs, addDoc, orderBy, limit } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { state, getDisciplinasPermitidas, nomeCurto } from "./prof/store.js";
import { carregarRadarProfessor, analisarEAtualizarTurma, carregarTarefasProf, carregarForunsProf, atualizarDropdownModulos, renderizarPautaTurma, renderizarFaltasTurma, abrirPerfil360Aluno } from "./prof/ui.js";

window.abrirPerfil360Aluno = abrirPerfil360Aluno;

import { carregarEcraOrientandos, carregarEcraDiario, prepararModalNovaSessao } from "./prof/roles/pap-diario.js";
import { carregarEcraProjetosCoord } from "./prof/roles/coord-dashboard.js";
import { validarFCT } from "./prof/roles/coord.js";
import { aprovarTemaPAP, rejeitarTemaPAPExecutar, aprovarRelatorioPAP } from "./prof/roles/pap.js";
import { gerarRadarConflitos } from "./prof/roles/dt.js";

// OS NOSSOS 4 MÓDULOS 
import { gerirCliquesForum } from "./prof/roles/forum.js";
import { gerirCliquesPRHF } from "./prof/roles/prhf.js";
import { gerirCliquesTurmas } from "./prof/roles/turmas.js";
import { gerirCliquesInicio } from "./prof/roles/inicio.js";

window.abrirPerfil360Aluno = abrirPerfil360Aluno;

window.analisarEAtualizarTurma = analisarEAtualizarTurma;

window.abrirAcaoRapida = async function (acaoId) {
    // 1. Fecha o menu verde do Raio
    document.getElementById('modal-fab-menu').style.display = 'none';

    if (state.selectedTurma) {
        // Se a app já tem uma turma memorizada, garante que os dados estão carregados e abre o modal.
        if (!state.alunosTurmaRAM || state.alunosTurmaRAM.length === 0) {
            await window.analisarEAtualizarTurma(state.selectedTurma);
        }
        document.getElementById(acaoId).click();
    } else {
        // Se abriste a App AGORA e não tens turma escolhida, surge a magia:
        let m = document.createElement('div');
        m.id = 'modal-quick-turma';
        m.className = 'modal-overlay';
        m.style.zIndex = '9999';
        m.style.display = 'flex';

        let botoesTurma = state.turmasProfessor.map(t =>
            `<button class="primary-btn" style="margin-bottom:10px; width:100%;" onclick="window.processarAcaoRapida('${t}', '${acaoId}')">Turma ${t}</button>`
        ).join('');

        m.innerHTML = `
        <div class="action-sheet" style="max-width: 300px; padding: 20px; text-align:center;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h3 style="color: white; margin:0;"><i class="fa-solid fa-users"></i> Qual a Turma?</h3>
                <button onclick="document.getElementById('modal-quick-turma').remove();" style="background:none; border:none; color:white; font-size:1.3rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            ${botoesTurma}
        </div>`;
        document.body.appendChild(m);
    }
};

// GRAVAR UMA NOVA ATIVIDADE NA FIREBASE
window.registarAtividadeProfessor = async function (tipo, descricao, subtexto) {
    if (!state.myUserId) return;
    try {
        await addDoc(collection(db, "utilizadores", state.myUserId, "atividades"), {
            tipo: tipo, // 'falta', 'nota', 'sintese', 'ocorrencia'
            descricao: descricao,
            subtexto: subtexto,
            data: new Date().toISOString()
        });
        // Tenta atualizar a lista no ecrã imediatamente
        if (document.getElementById('dashboard-atividade-container')) {
            window.carregarAtividadeRecente();
        }
    } catch (e) { console.error("Erro ao registar atividade:", e); }
};

// LER E MOSTRAR A ATIVIDADE NO DASHBOARD
window.carregarAtividadeRecente = async function () {
    const container = document.getElementById('dashboard-atividade-container');
    if (!container || !state.myUserId) return;

    try {
        const q = query(
            collection(db, "utilizadores", state.myUserId, "atividades"),
            orderBy("data", "desc"),
            limit(4) // Quantas queres mostrar no máximo
        );
        const snaps = await getDocs(q);

        if (snaps.empty) {
            container.innerHTML = '<p class="text-muted center" style="font-size:0.85rem;">Ainda não tens atividade recente registada.</p>';
            return;
        }

        let html = '';
        snaps.forEach(doc => {
            const ativ = doc.data();

            // Lógica de cores baseada no tipo de ação
            let icon = 'fa-check'; let color = '#10b981'; let bg = 'rgba(16, 185, 129, 0.15)';
            if (ativ.tipo === 'falta') { icon = 'fa-user-xmark'; color = 'var(--danger-red)'; bg = 'rgba(239, 68, 68, 0.15)'; }
            if (ativ.tipo === 'nota') { icon = 'fa-star'; color = 'var(--warning-yellow)'; bg = 'rgba(245, 158, 11, 0.15)'; }
            if (ativ.tipo === 'sintese') { icon = 'fa-clipboard'; color = '#3b82f6'; bg = 'rgba(59, 130, 246, 0.15)'; }
            if (ativ.tipo === 'ocorrencia') { icon = 'fa-triangle-exclamation'; color = 'var(--danger-red)'; bg = 'rgba(239, 68, 68, 0.15)'; }

            const d = new Date(ativ.data);
            const hora = d.toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' });
            const dia = d.toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit' });

            html += `
            <div style="display:flex; gap:12px; align-items:flex-start; padding-bottom: 10px; border-bottom: 1px solid rgba(255,255,255,0.05);">
                <div style="background:${bg}; color:${color}; width:32px; height:32px; border-radius:50%; display:flex; justify-content:center; align-items:center; flex-shrink:0; font-size:0.8rem;"><i class="fa-solid ${icon}"></i></div>
                <div>
                    <p style="margin:0; font-size:0.9rem; color:white;">${ativ.descricao}</p>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${dia} às ${hora} - ${ativ.subtexto}</span>
                </div>
            </div>`;
        });
        container.innerHTML = html;

    } catch (e) {
        console.error("ERRO FIREBASE ATIVIDADE:", e); // Isto vai dizer-nos o erro exato no F12
        container.innerHTML = `<p class="text-muted center" style="font-size:0.85rem; color:var(--danger-red);">Erro: ${e.message}</p>`;
    }
};
window.processarAcaoRapida = async function (turma, acaoId) {
    let loading = null;
    try {
        const modalQuick = document.getElementById('modal-quick-turma');
        if (modalQuick) modalQuick.remove();

        // Ecrã de Loading hiper rápido para a App fazer o trabalho sujo
        loading = document.createElement('div');
        loading.className = 'modal-overlay';
        loading.style.zIndex = '9999';
        loading.style.display = 'flex';
        loading.innerHTML = '<div style="background:rgba(0,0,0,0.8); padding:20px; border-radius:8px; color:white; text-align:center;"><i class="fa-solid fa-spinner fa-spin" style="font-size:2rem; margin-bottom:10px;"></i><br>A preparar dados...</div>';
        document.body.appendChild(loading);

        // Guarda a turma no sistema de forma global!
        state.selectedTurma = turma;
        const seletorGlobal = document.getElementById('prof-seletor-turmas');
        if (seletorGlobal) seletorGlobal.value = turma;

        // Puxa os dados dos alunos
        await window.analisarEAtualizarTurma(turma);

        if (loading) loading.remove();

        // Finge que o utilizador clicou no botão original e abre o modal certo!
        const btn = document.getElementById(acaoId);
        if (btn) btn.click();

        // Bónus de usabilidade: Se escolheste PRHF, preenche o dropdown lá dentro sozinho!
        setTimeout(() => {
            if (acaoId === 'btn-novo-prhf') {
                const prhfTurma = document.getElementById('prhf-turma');
                if (prhfTurma) {
                    prhfTurma.value = turma;
                    prhfTurma.dispatchEvent(new Event('change', { bubbles: true }));
                }
            }
        }, 100);
    } catch (err) {
        console.error("Erro em processarAcaoRapida:", err);
        if (loading) loading.remove();
    }
};
function getIniciais(nomeStr) {
    if (!nomeStr) return "PR";
    const parts = nomeStr.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
}

function esconderTodasAsVistas() {
    document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none');
}

// ----------------------------------------------------
// 1. AUTENTICAÇÃO E ARRANQUE
// ----------------------------------------------------
onAuthStateChanged(auth, async (user) => {
    if (user) {
        state.myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", state.myUserId));

            if (docSnap.exists()) {
                state.profData = docSnap.data();
                state.myRoles = state.profData.papeis || [];
                state.disciplinasProfessor = state.profData.disciplinas || [];
                state.turmasProfessor = state.profData.turmas || [];
                state.minhaTurmaDT = state.profData.turmaDT || (state.turmasProfessor.length > 0 ? state.turmasProfessor[0] : "10T");

                if (state.profData.papel && !state.myRoles.includes(state.profData.papel)) {
                    state.myRoles.push(state.profData.papel);
                }

                if (state.myRoles.some(r => ['professor', 'diretor_turma', 'orientador_pap', 'coordenador'].includes(r))) {
                    let baseName = state.profData.nome || state.profData.nomeCompleto || state.profData.Nome || state.myUserId;
                    state.myUserName = baseName.replace(/^(Prof\.|Professor|Professora|Prof)\s+/i, '').trim();

                    document.getElementById('header-user-name-prof').innerText = state.myUserName;

                    const configuracaoPerfis = {
                        'professor': { nome: 'Professor', cor: '#64748b' },
                        'diretor_turma': { nome: 'Diretor de Turma', cor: '#f59e0b' },
                        'coordenador': { nome: 'Coordenador', cor: '#9333ea' },
                        'orientador_pap': { nome: 'Orientador PAP', cor: '#10b981' }
                    };

                    let dropdownHtml = '';
                    state.myRoles.forEach(papel => {
                        if (configuracaoPerfis[papel]) {
                            dropdownHtml += `
                            <button onclick="window.mudarCapaProfessor('${papel}')" style="width: 100%; text-align: left; padding: 12px 15px; background: transparent; border: none; color: white; cursor: pointer; border-bottom: 1px solid #333; display: flex; align-items: center; gap: 10px;">
                                <span style="width: 10px; height: 10px; border-radius: 50%; background-color: ${configuracaoPerfis[papel].cor};"></span> ${configuracaoPerfis[papel].nome}
                            </button>`;
                        }
                    });
                    document.getElementById('lista-capas-dropdown').innerHTML = dropdownHtml;

                    window.mudarCapaProfessor = (novoPapel) => {
                        state.activeRole = novoPapel;
                        const config = configuracaoPerfis[novoPapel];
                        const badge = document.getElementById('badge-perfil-ativo');
                        if (badge) { badge.innerText = config.nome; badge.style.backgroundColor = config.cor; }

                        const navBase = document.querySelectorAll('.nav-role-base');
                        const navPap = document.querySelectorAll('.nav-role-pap');
                        const navCoord = document.querySelectorAll('.nav-role-coord');
                        const navDt = document.querySelectorAll('.nav-role-dt');

                        // Esconde tudo primeiro
                        [...navBase, ...navPap, ...navCoord, ...navDt].forEach(el => el.style.display = 'none');

                        // Lógica de Vistas e Menus Ativos conforme a Capa
                        if (novoPapel === 'orientador_pap') {
                            navPap.forEach(el => el.style.display = 'flex');
                            // O Orientador salta direto para os Orientandos
                            setTimeout(() => {
                                const btnOrientandos = document.querySelector('.nav-role-pap[data-target="view-prof-orientandos"]');
                                if (btnOrientandos) btnOrientandos.click();
                            }, 50);
                        } else if (novoPapel === 'coordenador') {
                            navCoord.forEach(el => el.style.display = 'flex');
                            // O Coordenador salta direto para as Turmas
                            setTimeout(() => {
                                const btnTurmasCoord = document.querySelector('.nav-role-coord[data-target="view-prof-turmas"]');
                                if (btnTurmasCoord) btnTurmasCoord.click();
                            }, 50);
                        } else if (novoPapel === 'diretor_turma') {
                            navDt.forEach(el => el.style.display = 'flex');
                            state.selectedTurma = state.minhaTurmaDT; // O DT aterra logo na sua turma
                            setTimeout(() => {
                                const btnPainelDT = document.querySelector('.nav-role-dt[data-target="view-dt-dashboard"]');
                                if (btnPainelDT) btnPainelDT.click();
                            }, 50);
                        } else {
                            navBase.forEach(el => el.style.display = 'flex');
                            setTimeout(() => {
                                const btnInicio = document.querySelector('.nav-role-base[data-target="view-prof-dashboard"]');
                                if (btnInicio) btnInicio.click();
                            }, 50);
                        }

                        document.getElementById('dropdown-perfis').style.display = 'none';

                        // Ocultar o Botão Flutuante (FAB) nas capas de Orientador e Coordenador
                        const btnFab = document.getElementById('btn-fab-global');
                        if (btnFab) {
                            btnFab.style.display = (novoPapel === 'orientador_pap' || novoPapel === 'coordenador') ? 'none' : 'flex';
                        }

                        // Forçar o fecho do menu das bolinhas ao mudar de capa
                        const modalFab = document.getElementById('modal-fab-menu');
                        if (modalFab) modalFab.style.display = 'none';
                    };

                    window.mudarCapaProfessor('professor');

                    document.getElementById('btn-toggle-perfis').addEventListener('click', (e) => {
                        e.stopPropagation();
                        const drop = document.getElementById('dropdown-perfis');
                        drop.style.display = drop.style.display === 'none' ? 'block' : 'none';
                    });

                    document.getElementById('perfil-nome-prof-view').innerText = state.myUserName;
                    document.getElementById('perfil-disciplinas-lista').innerText = state.disciplinasProfessor.length > 0 ? state.disciplinasProfessor.join(' • ') : 'Nenhuma disciplina configurada.';
                    document.getElementById('perfil-papeis-lista').innerText = state.myRoles.map(r => r.toUpperCase().replace('_', ' ')).join(' • ');

                    const iniciais = getIniciais(state.myUserName);
                    const fotoUrl = state.profData.fotoPerfil || `https://ui-avatars.com/api/?name=${iniciais}&background=333&color=fff&font-size=0.4`;

                    document.getElementById('header-avatar-circle').innerHTML = `<img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                    document.getElementById('prof-avatar-img').src = fotoUrl;

                    const sel = document.getElementById('prof-seletor-turmas');
                    if (sel) {
                        if (state.turmasProfessor.length > 0) { sel.innerHTML = '<option value="">-- Selecionar Turma --</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join(''); }
                        else { sel.innerHTML = '<option value="">Sem turmas atribuídas</option>'; }
                    }

                    const selTurmaCurso = document.getElementById('filtro-curso-turma');
                    if (selTurmaCurso && state.turmasProfessor.length > 0) {
                        selTurmaCurso.innerHTML = '<option value="">Todas as Turmas</option>' + state.turmasProfessor.map(t => `<option value="${t}">${t}</option>`).join('');
                    }

                    carregarRadarProfessor();
                } else {
                    window.location.href = "index.html";
                }
            } else {
                window.location.href = "index.html";
            }
        } catch (e) {
            console.error("Erro na inicialização:", e);
        }
    } else {
        window.location.href = "index.html";
    }
});

// ----------------------------------------------------
// 2. EVENTOS DE MUDANÇA (CHANGE) UNIFICADOS
// ----------------------------------------------------
document.body.addEventListener('change', async (e) => {
    // --- FILTRO DE TURMA DO COORDENADOR ---
    if (e.target.id === 'coord-filtro-turma') {
        import('./prof/roles/coord-dashboard.js').then(m => m.carregarEcraProjetosCoord());
        return;
    }

    // --- LER LAYOUT QUANDO O COORDENADOR MUDA A TURMA ---
    if (e.target.id === 'coord-filtro-turma') {
        import('./prof/roles/coord-dashboard.js').then(m => m.carregarEcraProjetosCoord());

        // NOVO: Vai ver se a turma já tem um layout gravado
        const turma = e.target.value;
        const statusDiv = document.getElementById('layout-pap-coord-status');
        if (turma && statusDiv) {
            statusDiv.innerHTML = '<p class="text-muted center" style="margin:0;"><i class="fa-solid fa-spinner fa-spin"></i> A verificar layout...</p>';
            getDoc(doc(db, "turmas", turma, "pap_config", "layout")).then(snap => {
                if (snap.exists() && snap.data().base64) {
                    statusDiv.innerHTML = `<p style="color:var(--primary-green); font-size:0.85rem; margin:0;"><i class="fa-solid fa-file-circle-check"></i> Ativo: <strong>${snap.data().nome}</strong></p>`;
                    document.getElementById('btn-remover-layout-coord').style.display = 'block'; // Mostra o botão
                } else {
                    statusDiv.innerHTML = `<p class="text-muted" style="font-size:0.85rem; margin:0; text-align:center;">Nenhum layout definido para a ${turma}.</p>`;
                    document.getElementById('btn-remover-layout-coord').style.display = 'none'; // Esconde o botão
                }
            });
        }
        return;
    }

    // --- UPLOAD DO NOVO LAYOUT OFICIAL ---
    if (e.target.id === 'upload-layout-pap-coord') {
        const f = e.target.files[0];
        if (!f) return;

        const turma = document.getElementById('coord-filtro-turma').value || state.selectedTurma;
        if (!turma) { alert("Seleciona uma turma no dropdown primeiro!"); e.target.value = ''; return; }
        if (f.size > 2 * 1024 * 1024) { alert("Ficheiro muito pesado. O limite são 2MB."); e.target.value = ''; return; }

        const statusDiv = document.getElementById('layout-pap-coord-status');
        statusDiv.innerHTML = '<p class="text-muted center" style="margin:0;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar ficheiro...</p>';

        const reader = new FileReader();
        reader.onload = async () => {
            try {
                await setDoc(doc(db, "turmas", turma, "pap_config", "layout"), {
                    nome: f.name,
                    base64: reader.result,
                    dataModificacao: new Date().toISOString()
                });
                statusDiv.innerHTML = `<p style="color:var(--success-green); font-size:0.85rem; margin:0;"><i class="fa-solid fa-check"></i> <strong>${f.name}</strong> disponibilizado à turma com sucesso!</p>`;
            } catch (err) {
                console.error(err);
                statusDiv.innerHTML = '<p class="text-danger center" style="margin:0;">Erro ao guardar layout.</p>';
            }
        };
        reader.readAsDataURL(f);
    }

    // --- MUDANÇA DE TURMA NO MENU PRINCIPAL ---
    if (e.target.id === 'prof-seletor-turmas') {
        const turmaSelecionada = e.target.value;
        if (!turmaSelecionada) {
            document.getElementById('lista-alunos-turma').innerHTML = '<p class="text-muted center" style="padding: 20px;">Por favor, seleciona uma turma acima.</p>';
            document.getElementById('assistente-aula-texto').innerHTML = 'A aguardar seleção...';
            state.selectedTurma = null;
            return;
        }
        state.selectedTurma = turmaSelecionada;
        analisarEAtualizarTurma(turmaSelecionada);
        return;
    }

    // --- MUDANÇA DO MOMENTO DA SÍNTESE DO ALUNO ---
    if (e.target.id === 'sintese-momento' || e.target.id === 'perfil-sintese-disc-select') {
        const momento = document.getElementById('sintese-momento').value;
        const alunoId = document.getElementById('perfil-aluno-id-hidden').value;

        // CORREÇÃO: Lê sempre o valor do seletor, quer seja DT ou Professor com várias disciplinas
        const discFiltro = document.getElementById('perfil-sintese-disc-select');
        const filtroAtivo = discFiltro ? discFiltro.value : state.disciplinasProfessor[0];

        const displayBox = document.getElementById('p-aluno-obs-dt-display');
        displayBox.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A ler síntese...';

        try {
            const snap = await getDoc(doc(db, "utilizadores", alunoId, "reunioes", momento));
            let textoParaMostrar = null;

            if (snap.exists()) {
                const dados = snap.data();
                // Se o filtro for GLOBAL, lê a síntese do DT. Senão, vai à disciplina escolhida
                if (filtroAtivo === 'GLOBAL') {
                    textoParaMostrar = dados.sintese_global;
                } else {
                    textoParaMostrar = dados.sinteses_disciplinas ? dados.sinteses_disciplinas[filtroAtivo] : null;
                }
            }

            if (textoParaMostrar) {
                displayBox.innerText = textoParaMostrar;
            } else {
                displayBox.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Sem síntese registada para este momento.</span>';
            }
        } catch (err) {
            displayBox.innerText = "Erro ao carregar síntese.";
        }
        return;
    }

    // --- MOSTRAR/ESCONDER CAMPO DE HORA EXATA NA AGENDA ---
    if (e.target.id === 'evento-periodo') {
        const inputHora = document.getElementById('evento-hora');
        if (inputHora) {
            inputHora.style.display = e.target.value === 'hora' ? 'block' : 'none';
        }
        return;
    }

    // --- MUDANÇA DE DISCIPLINA NOS MODAIS DE FALTAS E NOTAS ---
    if (e.target.id === 'lancar-falta-disciplina' || e.target.id === 'lancar-nota-disciplina' || e.target.id === 'lancar-nota-modulo') {
        const turma = state.selectedTurma;
        if (turma) {
            if (e.target.id === 'lancar-falta-disciplina') {
                import('./prof/ui.js').then(m => m.atualizarDropdownModulos(turma, e.target.value, document.getElementById('falta-modulo-select')));
            } else if (e.target.id === 'lancar-nota-disciplina') {
                import('./prof/ui.js').then(m => m.atualizarDropdownModulos(turma, e.target.value, document.getElementById('lancar-nota-modulo')));
            }

            // A MAGIA: Carregar as notas já atribuídas para atualizar os botões!
            if (e.target.id === 'lancar-nota-disciplina' || e.target.id === 'lancar-nota-modulo') {
                setTimeout(() => {
                    const disc = document.getElementById('lancar-nota-disciplina').value;
                    const mod = document.getElementById('lancar-nota-modulo').value;
                    if (!disc || !mod) return;

                    document.querySelectorAll('.aluno-nota-row').forEach(async (row) => {
                        const alunoId = row.getAttribute('data-id');
                        const btn = row.querySelector('.btn-abrir-escolha-nota');
                        const btnLixo = row.querySelector('.btn-limpar-nota');
                        const hiddenNota = row.querySelector('.input-nota-aluno-hidden');

                        // 1. Fazer reset visual ao botão
                        btn.innerText = 'Atribuir';
                        btn.style.color = 'var(--primary-green)';
                        btn.style.background = 'transparent';
                        btn.style.borderColor = '#333';
                        hiddenNota.value = '';
                        if (btnLixo) btnLixo.style.display = 'none';

                        try {
                            let notaVal = null;

                            // 2. Procurar na nova gaveta
                            const snap = await getDoc(doc(db, "utilizadores", alunoId, "avaliacoes", `${disc}_${mod}`));
                            if (snap.exists()) {
                                notaVal = snap.data().nota;
                            } else {
                                // 3. Procurar na velha gaveta (Ignora o formato Número vs Texto)
                                const oldNotas = await getDocs(query(collection(db, "utilizadores", alunoId, "notas"), where("disciplina", "==", disc)));
                                oldNotas.forEach(nDoc => {
                                    if (String(nDoc.data().modulo) === String(mod)) notaVal = nDoc.data().nota;
                                });
                            }

                            // 4. Se a nota existir, pinta o botão e mostra o lixo!
                            if (notaVal && notaVal !== "") {
                                hiddenNota.value = notaVal;
                                if (btnLixo) btnLixo.style.display = 'flex'; // MOSTRA O LIXO

                                if (notaVal === 'REP') {
                                    btn.innerText = 'REP';
                                    btn.style.color = 'var(--danger-red)';
                                    btn.style.borderColor = 'var(--danger-red)';
                                } else {
                                    btn.innerText = notaVal;
                                    btn.style.color = 'white';
                                    btn.style.background = 'var(--primary-green)';
                                    btn.style.borderColor = 'var(--primary-green)';
                                }
                            }
                        } catch (err) { }
                    });
                }, 300); // Pequeno atraso para deixar o dropdown preencher primeiro
            }
        } // <- As chaves que faltavam estavam aqui!
        return;
    }

    // --- MUDANÇA DE DISCIPLINA NA PAUTA ---
    if (e.target.id === 'pauta-disc-select') {
        import('./prof/ui.js').then(m => m.renderizarPautaTurma());
        return;
    }

    // --- MUDANÇA DE SALA NA PLANTA DA SALA ---
    if (e.target.id === 'select-sala-aula') {
        window.renderizarPlantaSala(e.target.value, disposicaoAtualAlunos);
        return;
    }

    // --- MOSTRAR INPUT DO TEMPLATE PRHF ---
    if (e.target.id === 'prhf-save-template') {
        const inputNome = document.getElementById('prhf-nome-template');
        inputNome.style.display = e.target.checked ? 'block' : 'none';
        if (e.target.checked) inputNome.focus();
    }

    // --- CHECKBOXES GERAIS (ESTILO) ---
    if (e.target.classList.contains('forum-aluno-check') || e.target.classList.contains('edit-forum-aluno-check') || e.target.classList.contains('prhf-aluno-check')) {
        const chk = e.target;
        const lbl = chk.closest('label');
        if (lbl) {
            if (chk.checked) {
                if (chk.classList.contains('prhf-aluno-check')) { lbl.style.background = 'rgba(239, 68, 68, 0.15)'; lbl.style.borderColor = 'var(--danger-red)'; }
                else { lbl.style.background = 'rgba(0, 204, 136, 0.15)'; lbl.style.borderColor = 'var(--primary-green)'; }
            } else { lbl.style.background = 'rgba(0,0,0,0.2)'; lbl.style.borderColor = '#333'; }
        }
    }

    if (e.target.id === 'filtro-workflow-prhf' || e.target.classList.contains('filtro-prhf-curso')) {
        carregarTarefasProf();
        return;
    }

    if (e.target.id === 'prhf-disciplina') {
        const t = document.getElementById('prhf-turma').value;
        if (t) atualizarDropdownModulos(t, e.target.value, document.getElementById('prhf-modulo'));
    }

    if (e.target.id === 'prhf-turma') {
        const t = e.target.value;
        const cCont = document.getElementById('prhf-alunos-bulk-container');
        const discSelect = document.getElementById('prhf-disciplina');
        if (!t) {
            if (cCont) cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; margin:0;">Selecione primeiro a Turma</p>';
            return;
        }
        if (cCont) cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; margin:0;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>';
        try {
            if (discSelect && discSelect.value) atualizarDropdownModulos(t, discSelect.value, document.getElementById('prhf-modulo'));
            const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
            let arr = []; cS.forEach(d => arr.push({ id: d.id, ...d.data() }));
            arr.sort((a, b) => a.nome.localeCompare(b.nome));
            let cH = `
            <div style="display:flex; gap:10px; margin-bottom:10px;">
                <button id="btn-prhf-select-all" class="secondary-btn small-btn" style="flex:1; border-color:var(--danger-red); color:var(--danger-red); padding:4px;">Selecionar Todos</button>
                <button id="btn-prhf-deselect-all" class="secondary-btn small-btn" style="flex:1; border-color:var(--text-muted); color:white; padding:4px;">Nenhum</button>
            </div>`;
            arr.forEach(d => {
                cH += `
                <label style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; margin-bottom:5px; cursor:pointer; transition: 0.2s;">
                    <span style="color:white; font-size:0.85rem;">${nomeCurto(d.nome)}</span>
                    <input type="checkbox" class="prhf-aluno-check" value="${d.id}" style="width:16px; height:16px; accent-color:var(--danger-red); margin:0;">
                </label>`;
            });
            if (cCont) cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH;
        } catch (err) { if (cCont) cCont.innerHTML = '<p class="text-danger center" style="font-size:0.8rem;">Erro ao carregar alunos.</p>'; }
    }

    if (e.target.id === 'forum-turma-select') {
        const t = e.target.value;
        const cCont = document.getElementById('lista-alunos-forum');
        const bulkBtns = document.getElementById('forum-bulk-actions');
        if (!t) {
            if (cCont) cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; grid-column: span 2;">Seleciona turma primeiro.</p>';
            if (bulkBtns) bulkBtns.style.display = 'none';
            return;
        }
        if (bulkBtns) bulkBtns.style.display = 'flex';
        if (cCont) cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; grid-column: span 2;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>';
        try {
            const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
            let arr = []; cS.forEach(d => arr.push({ id: d.id, ...d.data() }));
            arr.sort((a, b) => a.nome.localeCompare(b.nome));
            let cH = '';
            arr.forEach(d => {
                cH += `
                <label class="forum-member-card" style="display:flex; justify-content:center; align-items:center; background:rgba(0, 204, 136, 0.15); border:1px solid var(--primary-green); padding:10px; border-radius:8px; cursor:pointer; transition:all 0.2s; text-align:center; height: 100%;">
                    <span style="color:white; font-size:0.9rem; font-weight:500; text-align:center;">${nomeCurto(d.nome)}</span>
                    <input type="checkbox" class="forum-aluno-check" value="${d.id}" checked style="display:none;">
                </label>`;
            });
            if (cCont) cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem; grid-column: span 2;">Turma vazia.</p>' : cH;
        } catch (err) { if (cCont) cCont.innerHTML = '<p class="text-danger center" style="grid-column: span 2;">Erro.</p>'; }
    }
});

// ====================================================
// CÁLCULO EM TEMPO REAL DAS HORAS PRESENCIAIS DO PRHF
// ====================================================
document.body.addEventListener('input', (e) => {
    if (e.target.id === 'prhf-horas-totais') {
        const horasTotais = parseInt(e.target.value) || 0;
        const campoPresenciais = document.getElementById('prhf-horas-presenciais');

        if (campoPresenciais) {
            campoPresenciais.value = horasTotais <= 4 ? 0 : Math.ceil(horasTotais * 0.3);
        }
    }
});
// ====================================================

// ----------------------------------------------------
// 3. MOTOR CENTRAL DE CLIQUES
// ----------------------------------------------------
document.body.addEventListener('click', async (e) => {
    const nav = e.target.closest('.nav-item');

    // =========================================================================
    // MEDIDAS INCLUSIVAS (MUSAI - DL 54/2018) - A LÓGICA MESTRA
    // =========================================================================

    // ABRIR O MODAL MUSAI A PARTIR DO PAINEL DO DT (Abre o aluno rápido)
    if (e.target.closest('#btn-dt-dashboard-musai')) {
        e.preventDefault();
        const turma = state.selectedTurma;
        if (!turma) return alert("Selecione uma turma primeiro no menu de topo.");

        let m = document.createElement('div');
        m.id = 'modal-quick-musai-list';
        m.className = 'modal-overlay';
        m.style.zIndex = '9999';
        m.style.display = 'flex';
        m.innerHTML = `
        <div class="action-sheet" style="max-width: 400px; padding: 20px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                <h3 style="color: #0099ff; margin:0;"><i class="fa-solid fa-users"></i> Escolher Aluno</h3>
                <button onclick="document.getElementById('modal-quick-musai-list').remove();" style="background:none; border:none; color:white; font-size:1.3rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="lista-alunos-quick-musai" style="max-height:350px; overflow-y:auto; display:flex; flex-direction:column; gap:8px; padding-right:5px;">
                <p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>
            </div>
        </div>`;
        document.body.appendChild(m);

        try {
            const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno")));
            let arr = []; snap.forEach(d => arr.push({ id: d.id, ...d.data() }));
            arr.sort((a, b) => a.nome.localeCompare(b.nome));

            let html = '';
            arr.forEach(a => {
                let badge = '';
                if (a.maai === 'adicionais') badge = '<span style="color:var(--danger-red); font-size:0.7rem;"><i class="fa-solid fa-layer-group"></i> Adic.</span>';
                else if (a.maai === 'seletivas') badge = '<span style="color:var(--warning-yellow); font-size:0.7rem;"><i class="fa-solid fa-filter"></i> Selet.</span>';
                else if (a.maai === 'universais') badge = '<span style="color:var(--primary-green); font-size:0.7rem;"><i class="fa-solid fa-globe"></i> Univ.</span>';

                html += `
                <div class="quick-musai-aluno-row" data-id="${a.id}" data-nome="${nomeCurto(a.nome)}" style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; cursor:pointer; transition: 0.2s;" onmouseover="this.style.borderColor='#0099ff'" onmouseout="this.style.borderColor='#333'">
                    <span style="color:white; font-size:0.9rem;">${nomeCurto(a.nome)}</span>
                    ${badge}
                </div>`;
            });
            document.getElementById('lista-alunos-quick-musai').innerHTML = html || '<p class="text-muted">Sem alunos.</p>';
        } catch (err) {
            document.getElementById('lista-alunos-quick-musai').innerHTML = '<p class="text-danger">Erro a carregar.</p>';
        }
        return;
    }

    // CLIQUE NUM ALUNO NA LISTA RÁPIDA DO PAINEL DT
    if (e.target.closest('.quick-musai-aluno-row')) {
        const row = e.target.closest('.quick-musai-aluno-row');
        document.getElementById('perfil-aluno-id-hidden').value = row.getAttribute('data-id');
        document.getElementById('p-aluno-nome').innerText = row.getAttribute('data-nome');
        document.getElementById('modal-quick-musai-list').remove();

        // Dispara o clique virtual no botão de abrir MUSAI como se tivesse vindo do Perfil 360
        const btnFalso = document.createElement('button');
        btnFalso.id = 'btn-abrir-musai'; document.body.appendChild(btnFalso);
        btnFalso.click(); btnFalso.remove();
        return;
    }

    // ABRIR O MODAL MUSAI OFICIAL (E LER QUEM É QUEM)
    if (e.target.closest('#btn-abrir-musai')) {
        e.preventDefault();
        const alunoId = document.getElementById('perfil-aluno-id-hidden').value;
        const alunoNome = document.getElementById('p-aluno-nome').innerText;
        if (!alunoId) return;

        document.getElementById('musai-aluno-id').value = alunoId;
        document.getElementById('musai-aluno-nome').innerText = alunoNome;

        const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
        const disciplinaProf = state.disciplinasProfessor[0] || "Geral";

        const btn = e.target.closest('#btn-abrir-musai') || document.getElementById('btn-abrir-musai');
        const originalHTML = btn ? btn.innerHTML : '';
        if (btn) btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';

        try {
            // 1. Vai buscar a Matriz Matriz do Diretor de Turma (A Global)
            const dtSnap = await getDoc(doc(db, "utilizadores", alunoId, "musai", "dt_global"));
            const medidasDT = dtSnap.exists() ? dtSnap.data().medidas || [] : [];

            // 2. Vai buscar tudo o que os Professores inseriram de extra
            const profsSnap = await getDocs(collection(db, "utilizadores", alunoId, "musai"));
            let medidasMeuProf = [];
            let acrescimosProfs = {}; // Para o DT ler: { "Matemática": ["apoio_psico", "enriquecimento"] }

            profsSnap.forEach(d => {
                if (d.id === "dt_global") return; // Ignora o documento central
                const profData = d.data();
                if (d.id === disciplinaProf) medidasMeuProf = profData.medidas || [];

                // Pescamos apenas o que o professor ativou ALÉM do que o DT mandou
                const extras = (profData.medidas || []).filter(m => !medidasDT.includes(m));
                if (extras.length > 0) acrescimosProfs[d.id] = extras;
            });

            // 3. Pintar a Interface (Checkbox por Checkbox)
            document.querySelectorAll('.check-musai').forEach(chk => {
                const val = chk.value;
                const badge = chk.parentElement.querySelector('.badge-dt');

                chk.disabled = false;
                chk.checked = false;
                badge.style.display = 'none';

                if (isDT) {
                    // O DT vê a sua matriz nua e crua. O que ele marca, dita a lei.
                    if (medidasDT.includes(val)) chk.checked = true;
                } else {
                    // O Professor vê as regras do DT intocáveis (Bloqueadas)
                    if (medidasDT.includes(val)) {
                        chk.checked = true;
                        chk.disabled = true; // Proíbe o professor de desmarcar
                        badge.style.display = 'inline-block'; // Mostra a etiqueta "Definido por DT"
                    }
                    // Mas pode marcar outras que sejam exclusivas da sua disciplina!
                    else if (medidasMeuProf.includes(val)) {
                        chk.checked = true;
                    }
                }
            });

            // 4. Se for o DT, mostramos no fundo o painel secreto das adições dos professores
            const divExtras = document.getElementById('musai-professores-extra');
            if (isDT) {
                divExtras.style.display = 'block';
                const dicionarioLei = {
                    'diferenciacao': 'Diferenciação', 'acomodacoes': 'Acomodações', 'enriquecimento': 'Enriquecimento', 'pro_social': 'Pró-social',
                    'percursos_dif': 'Perc. Diferenciados', 'adaptacoes_nsig': 'Adaptações N. Signif.', 'apoio_psico': 'Apoio Psico.', 'antecipacao': 'Antecipação',
                    'freq_disciplinas': 'Freq. Disciplinas', 'adaptacoes_sig': 'PEI', 'pit': 'PIT', 'ensino_estruturado': 'Ensino Estruturado'
                };

                let htmlExtras = '';
                for (const [disc, extrasArr] of Object.entries(acrescimosProfs)) {
                    const nomesLegais = extrasArr.map(v => dicionarioLei[v] || v);
                    htmlExtras += `<div style="margin-bottom:10px;"><strong style="color:var(--primary-green); font-size:0.85rem;">${disc}:</strong> <span style="color:var(--text-light); font-size:0.85rem;">${nomesLegais.join(' • ')}</span></div>`;
                }
                document.getElementById('musai-lista-extras').innerHTML = htmlExtras || '<p class="text-muted" style="font-size:0.8rem; margin:0;">Nenhum professor aplicou medidas exclusivas de disciplina.</p>';
            } else {
                divExtras.style.display = 'none';
            }

            document.getElementById('modal-musai').style.display = 'flex';
        } catch (err) {
            console.error("Erro MUSAI:", err);
            alert("Aconteceu um erro ao tentar abrir as medidas.");
        }
        if (btn) btn.innerHTML = originalHTML;
        return;
    }

    // GRAVAR O MUSAI NA BASE DE DADOS (SEPARA O TRIGO DO JOIO)
    if (e.target.closest('#btn-gravar-musai')) {
        e.preventDefault();
        const btn = e.target.closest('#btn-gravar-musai');
        const alunoId = document.getElementById('musai-aluno-id').value;
        const disciplinaProf = state.disciplinasProfessor[0] || "Geral";
        const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);

        const medidasParaGravar = [];
        document.querySelectorAll('.check-musai:checked').forEach(chk => {
            // Se fores professor, só guardas as TUAS checkboxes (ignorando as bloqueadas do DT)
            if (isDT || !chk.disabled) {
                medidasParaGravar.push(chk.value);
            }
        });

        const originalHTML = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
        btn.disabled = true;

        try {
            let nivel = 'Nenhuma';
            if (medidasParaGravar.some(m => ['freq_disciplinas', 'adaptacoes_sig', 'pit', 'ensino_estruturado'].includes(m))) nivel = 'adicionais';
            else if (medidasParaGravar.some(m => ['percursos_dif', 'adaptacoes_nsig', 'apoio_psico', 'antecipacao'].includes(m))) nivel = 'seletivas';
            else if (medidasParaGravar.length > 0) nivel = 'universais';

            if (isDT) {
                // DT grava na GAVETA CENTRAL
                await setDoc(doc(db, "utilizadores", alunoId, "musai", "dt_global"), {
                    medidas: medidasParaGravar,
                    atualizadoEm: new Date().toISOString()
                }, { merge: true });

                // DT atualiza a cor primária no Perfil 360 do Aluno
                await setDoc(doc(db, "utilizadores", alunoId), { maai: nivel }, { merge: true });
            } else {
                // PROFESSOR grava na sua GAVETA DA DISCIPLINA
                await setDoc(doc(db, "utilizadores", alunoId, "musai", disciplinaProf), {
                    medidas: medidasParaGravar,
                    atualizadoEm: new Date().toISOString()
                }, { merge: true });
            }

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Gravado com sucesso!';
            setTimeout(() => {
                btn.innerHTML = originalHTML;
                btn.disabled = false;
                document.getElementById('modal-musai').style.display = 'none';
            }, 1500);
        } catch (err) {
            btn.innerHTML = 'Erro!';
            setTimeout(() => { btn.innerHTML = originalHTML; btn.disabled = false; }, 2000);
        }
        return;
    }

    // TROCA DE ABAS DO MEGA-CARTÃO UNIFICADO
    if (e.target.closest('.mega-tab-btn')) {
        const btnClicado = e.target.closest('.mega-tab-btn');
        const targetId = btnClicado.getAttribute('data-target');

        // 1. Reset de todos os botões (voltam a cinzento)
        const todosBotoes = btnClicado.parentElement.querySelectorAll('.mega-tab-btn');
        todosBotoes.forEach(b => {
            b.classList.remove('active');
            b.style.color = 'var(--text-muted)';
            b.style.borderBottomColor = 'transparent';
        });

        // 2. Pintar o botão ativo consoante o seu tipo
        btnClicado.classList.add('active');
        if (targetId === 'conteudo-horario') {
            btnClicado.style.color = '#0099ff';
            btnClicado.style.borderBottomColor = '#0099ff';
        } else if (targetId === 'conteudo-agenda') {
            btnClicado.style.color = 'var(--warning-yellow)';
            btnClicado.style.borderBottomColor = 'var(--warning-yellow)';
        } else if (targetId === 'conteudo-atividade') {
            btnClicado.style.color = '#a855f7';
            btnClicado.style.borderBottomColor = '#a855f7';
        }

        // 3. Esconder todos os conteúdos e mostrar apenas o correto
        const todosConteudos = btnClicado.closest('.card').querySelectorAll('.mega-tab-content');
        todosConteudos.forEach(c => c.style.display = 'none');
        document.getElementById(targetId).style.display = 'block';

        return;
    }

    if (nav) {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        esconderTodasAsVistas();

        const tId = nav.getAttribute('data-target');
        const targetView = document.getElementById(tId);
        if (targetView) targetView.style.display = (tId === 'view-prof-forum') ? 'flex' : 'block';

        if (tId === 'view-prof-dashboard') {
            carregarRadarProfessor();
            if (window.carregarAlertasBurocraticos) window.carregarAlertasBurocraticos();
        }
        if (tId === 'view-dt-dashboard') { 
            let turmasDoDT = [];
            if (Array.isArray(state.profData.turmaDT)) turmasDoDT = state.profData.turmaDT;
            else if (state.profData.turmaDT) turmasDoDT = [state.profData.turmaDT];
            else if (state.profData.turmasDT) turmasDoDT = state.profData.turmasDT;
            else turmasDoDT = state.turmasProfessor;

            // Função ajudante para carregar as coisas do DT e os alertas
            const arrancarDT = () => {
                import('./prof/roles/dt.js').then(m => m.carregarPainelDT());
                if (window.carregarAlertasBurocraticos) window.carregarAlertasBurocraticos(state.selectedTurma);
            };

            // Se fores DT de várias turmas e ainda não tiveres escolhido uma delas:
            if (turmasDoDT.length > 1 && !turmasDoDT.includes(state.selectedTurma)) {
                // Cria o pop-up à força para não haver bugs
                let m = document.createElement('div');
                m.className = 'modal-overlay';
                m.style.zIndex = '9999';
                m.style.display = 'flex';
                
                let botoes = turmasDoDT.map(t => 
                    `<button class="primary-btn" style="margin-bottom:10px; width:100%; background: #b82bf2;" 
                        onclick="state.selectedTurma='${t}'; state.minhaTurmaDT='${t}'; 
                        if(document.getElementById('prof-seletor-turmas')) document.getElementById('prof-seletor-turmas').value='${t}'; 
                        this.parentElement.parentElement.remove(); 
                        import('./prof/roles/dt.js').then(mod => mod.carregarPainelDT());
                        if (window.carregarAlertasBurocraticos) window.carregarAlertasBurocraticos('${t}');">
                        Turma ${t}
                    </button>`
                ).join('');
                
                m.innerHTML = `<div class="action-sheet" style="max-width: 300px; padding: 20px; text-align:center; border: 1px solid #b82bf2;">
                    <h3 style="color: white; margin-bottom:15px;"><i class="fa-solid fa-users-viewfinder" style="color: #b82bf2;"></i> Gerir qual Turma?</h3>
                    ${botoes}
                </div>`;
                document.body.appendChild(m);
                return; // O código pára aqui até tu clicares num dos botões!
            } else {
                // Se só tiveres 1 turma de DT, ele avança logo
                if (turmasDoDT.length === 1) state.selectedTurma = turmasDoDT[0];
                state.minhaTurmaDT = state.selectedTurma;
                arrancarDT(); // Chama o módulo do DT e os alertas
            }
        }
        if (tId === 'view-prof-turmas' && state.selectedTurma) analisarEAtualizarTurma(state.selectedTurma);
        if (tId === 'view-prof-tarefas') carregarTarefasProf();
        if (tId === 'view-prof-orientandos') carregarEcraOrientandos();
        if (tId === 'view-prof-diario') carregarEcraDiario();
        if (tId === 'view-coord-projetos') carregarEcraProjetosCoord();
        if (tId === 'view-prof-forum') {
            if (state.chatUnsubscribe) { state.chatUnsubscribe(); state.chatUnsubscribe = null; }
            if (state.chatMetaUnsubscribe) { state.chatMetaUnsubscribe(); state.chatMetaUnsubscribe = null; }
            document.getElementById('prof-forum-chat-view').style.display = 'none';
            document.getElementById('btn-create-chat-prof').style.display = 'block';
            document.getElementById('prof-forum-channel-list').style.display = 'block';
            carregarForunsProf();
        }
        return;
    }

    if (!e.target.closest('#header-prof') && !e.target.closest('#modal-fab-menu') && !e.target.closest('#btn-fab-global')) {
        const drop = document.getElementById('dropdown-perfis'); if (drop) drop.style.display = 'none';
        const fab = document.getElementById('modal-fab-menu'); if (fab) fab.style.display = 'none';
    }

    if (e.target.closest('#btn-logout-dropdown')) { signOut(auth); return; }

    if (e.target.closest('.fechar-modal')) {
        const targetId = e.target.closest('.fechar-modal').getAttribute('data-target');
        const modal = document.getElementById(targetId);
        if (modal) modal.style.display = 'none';
        return;
    }

    // ABRIR MODAL DA ATA DO DT
    if (e.target.closest('#btn-gerar-resumo-ata')) {
        import('./prof/roles/dt.js').then(m => m.abrirModalResumoAta());
        return;
    }

    // CLIQUE NO BOTÃO "IR PARA GESTÃO PRHF" DO DASHBOARD
    if (e.target.closest('#btn-dashboard-ir-prhf')) {
        const tabPrhf = document.querySelector('.nav-item[data-target="view-prof-tarefas"]');
        if (tabPrhf) tabPrhf.click();
        return;
    }

    // --- EDIÇÃO DE PAP E FCT (COORDENADOR) DE FORMA DIRETA ---
    if (e.target.closest('.btn-editar-pap-coord')) {
        const id = e.target.closest('.btn-editar-pap-coord').getAttribute('data-id');
        import('./prof/roles/coord-dashboard.js').then(m => m.abrirModalEdicaoPAP(id)).catch(err => console.error(err));
        return;
    }
    if (e.target.closest('#btn-salvar-edicao-pap')) {
        const btn = e.target.closest('#btn-salvar-edicao-pap');
        import('./prof/roles/coord-dashboard.js').then(m => m.salvarEdicaoPAP(btn)).catch(err => console.error(err));
        return;
    }
    if (e.target.closest('.btn-editar-fct-coord')) {
        const id = e.target.closest('.btn-editar-fct-coord').getAttribute('data-id');
        import('./prof/roles/coord-dashboard.js').then(m => m.abrirModalEdicaoFCT(id)).catch(err => console.error(err));
        return;
    }
    if (e.target.closest('#btn-salvar-edicao-fct')) {
        const btn = e.target.closest('#btn-salvar-edicao-fct');
        import('./prof/roles/coord-dashboard.js').then(m => m.salvarEdicaoFCT(btn)).catch(err => console.error(err));
        return;
    }

    // PERMITIR AO PROFESSOR RESPONDER ÀS MENSAGENS MANUAIS (EE ou PAP)
    if (e.target.closest('#btn-prof-send-msg')) {
        e.preventDefault(); // Impede comportamentos estranhos do clique
        const inp = document.getElementById('prof-input-forum-msg');
        const txt = inp.value.trim();
        if (!txt) return true;

        const btnSend = e.target.closest('#btn-prof-send-msg');

        // LÓGICA 1: CHAT DA PAP (O túnel direto corrigido)
        if (state.activeChatType === 'pap' && state.activeChatId) {
            btnSend.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                // Gravamos com múltiplas chaves (texto e mensagem) para garantir que a App do Aluno a lê sem falhas!
                await addDoc(collection(db, "forums", state.activeChatId, "mensagens"), {
                    remetente: state.myUserName,
                    autor: state.myUserName,
                    texto: txt,
                    mensagem: txt,
                    timestamp: Date.now()
                });
                inp.value = '';
            } catch (err) {
                console.error("Erro ao enviar mensagem PAP:", err);
            }
            btnSend.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
            return true;
        }

        // LÓGICA 2: CHAT DO EE (Original)
        if (state.activeChatTurma === 'EE') {
            btnSend.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try {
                await addDoc(collection(db, "utilizadores", state.activeChatDisc, "chat_dt"), {
                    remetente: state.myUserName, autor: 'dt', texto: txt, timestamp: Date.now()
                });
                inp.value = '';
            } catch (err) { }
            btnSend.innerHTML = '<i class="fa-solid fa-paper-plane"></i>';
            return true;
        }
    }

    if (await gerirCliquesForum(e)) return;
    if (await gerirCliquesPRHF(e)) return;
    if (await gerirCliquesTurmas(e)) return;
    if (await gerirCliquesInicio(e)) return;

    if (e.target.closest('#tab-coord-fct')) { document.getElementById('tab-coord-fct').classList.add('active'); document.getElementById('tab-coord-pap').classList.remove('active'); const cLayout = document.getElementById('card-layout-pap-coord'); if (cLayout) cLayout.style.display = 'none'; import('./prof/roles/coord-dashboard.js').then(module => { module.carregarEcraProjetosCoord(); }); return; }
    if (e.target.closest('#tab-coord-pap')) { document.getElementById('tab-coord-pap').classList.add('active'); document.getElementById('tab-coord-fct').classList.remove('active'); const cLayout = document.getElementById('card-layout-pap-coord'); if (cLayout) cLayout.style.display = 'block'; import('./prof/roles/coord-dashboard.js').then(module => { module.carregarEcraProjetosCoord(); }); return; }

    if (e.target.closest('#btn-remover-layout-coord')) {
        const turma = document.getElementById('coord-filtro-turma').value || window.state?.selectedTurma;
        if (!turma) return;
        if (!confirm("Tens a certeza que queres eliminar o layout para esta turma?")) return;
        import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js").then(({ deleteDoc, doc }) => {
            deleteDoc(doc(db, "turmas", turma, "pap_config", "layout")).then(() => {
                document.getElementById('coord-filtro-turma').dispatchEvent(new Event('change', { bubbles: true }));
            });
        });
        return;
    }
    if (e.target.closest('#tab-tarefas-prhf')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'block'; document.getElementById('sec-tarefas-passaporte').style.display = 'none'; carregarTarefasProf(); return; }
    if (e.target.closest('#tab-tarefas-passaporte')) { document.querySelectorAll('.falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.closest('.falta-tab-btn').classList.add('active'); document.getElementById('sec-tarefas-prhf').style.display = 'none'; document.getElementById('sec-tarefas-passaporte').style.display = 'block'; carregarTarefasProf(); return; }
    if (e.target.closest('#btn-nova-sessao-pap')) { prepararModalNovaSessao(); return; }
    if (e.target.closest('#btn-radar-conflitos')) { gerarRadarConflitos(); return; }
    if (e.target.closest('.btn-validar-fct')) { validarFCT(e.target.closest('.btn-validar-fct').getAttribute('data-id'), e.target.closest('.btn-validar-fct')); return; }
    if (e.target.closest('.btn-aprovar-tema')) { aprovarTemaPAP(e.target.closest('.btn-aprovar-tema').getAttribute('data-id'), e.target.closest('.btn-aprovar-tema')); return; }
    if (e.target.closest('.btn-rejeitar-tema')) { document.getElementById('rej-pap-aluno-id').value = e.target.closest('.btn-rejeitar-tema').getAttribute('data-id'); document.getElementById('rej-pap-motivo').value = ''; document.getElementById('modal-rejeitar-tema-pap').style.display = 'flex'; return; }
    if (e.target.closest('#btn-confirmar-rejeicao-pap')) { const motivo = document.getElementById('rej-pap-motivo').value.trim(); if (!motivo) return alert("Indica o motivo."); rejeitarTemaPAPExecutar(document.getElementById('rej-pap-aluno-id').value, motivo, e.target.closest('#btn-confirmar-rejeicao-pap')); return; }
    if (e.target.closest('.btn-aprovar-relatorio')) { aprovarRelatorioPAP(e.target.closest('.btn-aprovar-relatorio').getAttribute('data-id'), e.target.closest('.btn-aprovar-relatorio')); return; }

    // --- BOTÕES DA VISTA TURMAS ---
    if (e.target.closest('#btn-ver-pauta')) {
        renderizarPautaTurma();
        return;
    }
    if (e.target.closest('#btn-ver-faltas-turma')) {
        renderizarFaltasTurma();
        return;
    }

    // ABRIR PERFIL DO ALUNO (LISTA DE TURMAS)
    if (e.target.closest('.aluno-list-item')) {
        const card = e.target.closest('.aluno-list-item');
        const alunoId = card.getAttribute('data-id');
        if (alunoId) {
            // 1. Abre o perfil normalmente
            abrirPerfil360Aluno(alunoId);

            // 2. Acorda o Botão de Justificar Faltas (meio segundo depois para dar tempo à janela de abrir)
            setTimeout(async () => {
                const btnJustificar = document.getElementById('btn-justificar-faltas');
                if (btnJustificar) {
                    const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);

                    if (isDT) {
                        try {
                            // Vai espreitar se o pai enviou alguma justificação nova
                            const q = query(collection(db, "utilizadores", alunoId, "atestados"), where("status", "==", "pendente"));
                            const snap = await getDocs(q);

                            btnJustificar.style.display = 'block'; // Mostra o botão

                            if (!snap.empty) {
                                // Se houver atestados pendentes, grita por atenção (Vermelho)!
                                btnJustificar.innerHTML = `<i class="fa-solid fa-bell fa-shake"></i> Analisar Comprovativos (${snap.size} novo!)`;
                                btnJustificar.style.background = 'var(--danger-red)';
                                btnJustificar.style.color = 'white';
                            } else {
                                // Se não houver, fica sereno (Amarelo)
                                btnJustificar.innerHTML = `<i class="fa-solid fa-file-signature"></i> Histórico de Comprovativos`;
                                btnJustificar.style.background = 'var(--warning-yellow)';
                                btnJustificar.style.color = 'black';
                            }
                        } catch (e) {
                            console.error(e);
                            btnJustificar.style.display = 'block';
                        }
                    } else {
                        // Se for um Professor normal, o botão desaparece
                        btnJustificar.style.display = 'none';
                    }
                }
            }, 600);
        }
        return;
    }

    // ABRIR MODAL DE MARCAR FALTAS
    if (e.target.closest('#btn-modal-faltas')) {
        const turma = state.selectedTurma;
        if (!turma) {
            alert("Seleciona primeiro uma turma no menu superior.");
            return;
        }

        const turmaSelect = document.getElementById('lancar-falta-turma');
        if (turmaSelect) turmaSelect.innerHTML = `<option value="${turma}">Turma ${turma}</option>`;

        const discSelect = document.getElementById('lancar-falta-disciplina');
        if (discSelect && state.disciplinasProfessor) {
            discSelect.innerHTML = state.disciplinasProfessor.map(d => `<option value="${d}">${d}</option>`).join('');
            discSelect.style.display = 'block';

            if (state.disciplinasProfessor.length > 0) {
                atualizarDropdownModulos(turma, state.disciplinasProfessor[0], document.getElementById('falta-modulo-select'));
            }
        }

        const dataInput = document.getElementById('falta-data-input');
        if (dataInput) {
            const hoje = new Date().toISOString().split('T')[0];
            dataInput.value = hoje;
        }

        const cCont = document.getElementById('lista-metralhadora-faltas');
        if (cCont) {
            cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>';

            try {
                const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno")));
                let arr = [];
                cS.forEach(d => arr.push({ id: d.id, ...d.data() }));
                arr.sort((a, b) => a.nome.localeCompare(b.nome));

                let cH = '';
                arr.forEach(d => {
                    cH += `
                    <label style="display:flex; justify-content:space-between; align-items:center; padding:8px 10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; cursor:pointer; transition: 0.2s;">
                        <span style="color:white; font-size:0.85rem;">${nomeCurto(d.nome)}</span>
                        <input type="checkbox" class="falta-aluno-check" value="${d.id}" style="width:18px; height:18px; accent-color:var(--danger-red); margin:0;">
                    </label>`;
                });
                cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH;
            } catch (err) {
                console.error("Erro ao carregar alunos:", err);
                cCont.innerHTML = '<p class="text-danger center" style="font-size:0.8rem;">Erro ao carregar alunos.</p>';
            }
        }

        const modal = document.getElementById('modal-marcar-faltas');
        if (modal) modal.style.display = 'flex';
        return;
    }

    // --- GRAVAR FALTAS NA BASE DE DADOS (O REMENDO!) ---
    if (e.target.closest('#btn-confirmar-faltas')) {
        const btn = e.target.closest('#btn-confirmar-faltas');
        const turma = document.getElementById('lancar-falta-turma').value;
        const disciplina = document.getElementById('lancar-falta-disciplina').value;
        const modulo = document.getElementById('falta-modulo-select').value;
        const dataFalta = document.getElementById('falta-data-input').value;
        const duracao = parseInt(document.getElementById('falta-aula-select').value) || 2;

        // Vai buscar todas as checkboxes de alunos que foram selecionadas (marcadas com falta)
        const checksFaltas = document.querySelectorAll('.falta-aluno-check:checked');

        if (checksFaltas.length === 0) {
            alert("Atenção: Não selecionaste nenhum aluno para marcar falta.");
            return;
        }

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
        btn.disabled = true;

        try {
            // Cria um pacote (promessa) para cada aluno que levou falta
            const gravacoes = Array.from(checksFaltas).map(chk => {
                const alunoId = chk.value;
                return addDoc(collection(db, "utilizadores", alunoId, "faltas"), {
                    turma: turma,
                    disciplina: disciplina,
                    modulo: modulo,
                    dataFalta: dataFalta,
                    duracaoBlocos: duracao,
                    dataRegisto: new Date().toISOString(),
                    professor: state.myUserName,
                    justificada: false
                });
            });

            // Dispara todos os pacotes para a Firebase ao mesmo tempo!
            await Promise.all(gravacoes);

            // Regista no log do professor
            if (window.registarAtividadeProfessor) {
                await window.registarAtividadeProfessor('falta', `Faltas marcadas a ${checksFaltas.length} aluno(s)`, `Turma ${turma} | ${disciplina}`);
            }

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Faltas Gravadas!';
            setTimeout(() => {
                btn.innerHTML = txtOriginal;
                btn.disabled = false;
                document.getElementById('modal-marcar-faltas').style.display = 'none';
            }, 2000);

        } catch (err) {
            console.error(err);
            btn.innerHTML = 'Erro ao gravar!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ABRIR MODAL DE NOTAS COM BOTÃO DE ATRIBUIR E ESCOLHER NOTA
    if (e.target.closest('#btn-modal-notas')) {
        const turma = state.selectedTurma;
        if (!turma) { alert("Seleciona primeiro uma turma."); return; }

        const discSelect = document.getElementById('lancar-nota-disciplina');
        if (discSelect && state.disciplinasProfessor) {
            discSelect.innerHTML = state.disciplinasProfessor.map(d => `<option value="${d}">${d}</option>`).join('');
            if (state.disciplinasProfessor.length > 0) {
                atualizarDropdownModulos(turma, state.disciplinasProfessor[0], document.getElementById('lancar-nota-modulo'));
            }
        }

        const grid = document.getElementById('grid-notas-alunos');
        if (grid) {
            grid.innerHTML = '<p class="text-muted center" style="padding:15px; font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>';

            try {
                const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno")));
                let arr = [];
                cS.forEach(d => arr.push({ id: d.id, ...d.data() }));
                arr.sort((a, b) => a.nome.localeCompare(b.nome));

                let cH = '';
                arr.forEach(d => {
                    cH += `
                    <div class="aluno-nota-row" data-id="${d.id}" style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px;">
                        <span style="color:white; font-size:0.85rem; flex: 1;">${nomeCurto(d.nome)}</span>
                        
                        <div style="display: flex; gap: 5px; align-items: center;">
                            <button class="btn-limpar-nota" data-id="${d.id}" style="display: none; width: 35px; height: 35px; border-radius: 6px; background: rgba(239, 68, 68, 0.15); border: 1px solid var(--danger-red); color: var(--danger-red); cursor: pointer; align-items: center; justify-content: center; padding: 0;"><i class="fa-solid fa-trash"></i></button>
                            <button class="btn-abrir-escolha-nota secondary-btn small-btn" data-id="${d.id}" data-nome="${nomeCurto(d.nome)}" style="min-width: 80px; height: 35px; font-weight: bold; color: var(--primary-green);">Atribuir</button>
                        </div>
                        
                        <input type="hidden" class="input-nota-aluno-hidden" value="">
                        <input type="hidden" class="input-motivo-aluno-hidden" value="">
                    </div>`;
                });
                grid.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH;
            } catch (err) {
                console.error("Erro ao carregar:", err);
                grid.innerHTML = '<p class="text-danger center" style="font-size:0.8rem;">Erro ao carregar alunos.</p>';
            }
        }

        const modal = document.getElementById('modal-lancamento-notas');
        if (modal) modal.style.display = 'flex';
        return;
    }

    // CLIQUE NO BOTÃO "ATRIBUIR" NA GRELHA PARA ABRIR O MINI-MODAL
    if (e.target.closest('.btn-abrir-escolha-nota')) {
        const modulo = document.getElementById('lancar-nota-modulo').value;
        if (!modulo) {
            alert("⚠️️ Atenção: Tens de selecionar o Módulo/UFCD no topo da janela antes de atribuir uma nota!");
            return;
        }

        const row = e.target.closest('.aluno-nota-row');
        window.carregarAlunoNoMiniModal(row);
        const modal = document.getElementById('modal-escolher-nota');
        if (modal) modal.style.display = 'flex';
        return;
    }

    // NAVEGAÇÃO MANUAL NO MINI-MODAL (Setas < e >)
    if (e.target.closest('#btn-nota-anterior') || e.target.closest('#btn-nota-seguinte')) {
        const isNext = e.target.closest('#btn-nota-seguinte') !== null;
        const atualId = document.getElementById('aluno-id-nota-atual').value;
        const linhas = Array.from(document.querySelectorAll('.aluno-nota-row'));
        const indexAtual = linhas.findIndex(r => r.getAttribute('data-id') === atualId);

        if (indexAtual !== -1) {
            const novoIndex = isNext ? indexAtual + 1 : indexAtual - 1;
            if (novoIndex >= 0 && novoIndex < linhas.length) {
                window.carregarAlunoNoMiniModal(linhas[novoIndex]);
            }
        }
        return;
    }

    // SELEÇÃO DE UMA NOTA NO MINI-MODAL (10 a 20 ou REP)
    if (e.target.closest('.btn-nota-opcao')) {
        const btn = e.target.closest('.btn-nota-opcao');
        document.querySelectorAll('.btn-nota-opcao').forEach(b => {
            b.classList.remove('active-nota');
            b.style.boxShadow = 'none';
            b.style.background = '';
        });

        btn.classList.add('active-nota');
        btn.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.2)';
        btn.style.background = 'rgba(255,255,255,0.1)';

        const val = btn.getAttribute('data-val');
        const repContainer = document.getElementById('container-justificacao-rep');
        if (repContainer) {
            repContainer.style.display = (val === 'REP') ? 'block' : 'none';
        }
        return;
    }

    // CONFIRMAR A NOTA E SALTAR PARA O PRÓXIMO ALUNO
    if (e.target.closest('#btn-confirmar-nota-modal')) {
        const btnActive = document.querySelector('.btn-nota-opcao.active-nota');
        if (!btnActive) {
            alert("Por favor, clica numa nota primeiro (10 a 20 ou REP).");
            return;
        }

        const val = btnActive.getAttribute('data-val');
        const motivoSelect = document.getElementById('motivo-rep-select');
        const motivo = (val === 'REP' && motivoSelect) ? motivoSelect.value : "";

        const alunoId = document.getElementById('aluno-id-nota-atual').value;
        const linhas = Array.from(document.querySelectorAll('.aluno-nota-row'));
        const indexAtual = linhas.findIndex(r => r.getAttribute('data-id') === alunoId);

        if (indexAtual !== -1) {
            const row = linhas[indexAtual];
            const btnAtribuir = row.querySelector('.btn-abrir-escolha-nota');
            const btnLixo = row.querySelector('.btn-limpar-nota');
            const hiddenNota = row.querySelector('.input-nota-aluno-hidden');
            const hiddenMotivo = row.querySelector('.input-motivo-aluno-hidden');

            if (hiddenNota) hiddenNota.value = val;
            if (hiddenMotivo) hiddenMotivo.value = motivo;

            if (btnLixo) btnLixo.style.display = 'flex'; // Mostra o lixo mal atribuis nota

            if (val === 'REP') {
                btnAtribuir.innerText = `REP`;
                btnAtribuir.style.color = 'var(--danger-red)';
                btnAtribuir.style.borderColor = 'var(--danger-red)';
                btnAtribuir.style.background = 'transparent';
            } else {
                btnAtribuir.innerText = val;
                btnAtribuir.style.color = '#fff';
                btnAtribuir.style.background = 'var(--primary-green)';
                btnAtribuir.style.borderColor = 'var(--primary-green)';
            }

            // Salta automaticamente para o próximo aluno
            if (indexAtual + 1 < linhas.length) {
                window.carregarAlunoNoMiniModal(linhas[indexAtual + 1]);
            } else {
                const modal = document.getElementById('modal-escolher-nota');
                if (modal) modal.style.display = 'none';
            }
        }
        return;
    }

    // CLIQUE NO BOTÃO DE LIXO (APAGAR A NOTA)
    if (e.target.closest('.btn-limpar-nota')) {
        if (!confirm("Tens a certeza que queres eliminar esta avaliação? Terás de clicar em 'Gravar Avaliações' no fim para confirmar.")) return;

        const btnLixo = e.target.closest('.btn-limpar-nota');
        const row = btnLixo.closest('.aluno-nota-row');

        const btnAtribuir = row.querySelector('.btn-abrir-escolha-nota');
        const hiddenNota = row.querySelector('.input-nota-aluno-hidden');
        const hiddenMotivo = row.querySelector('.input-motivo-aluno-hidden');

        // Em vez de limpar, enviamos um código secreto que a função de gravar entende como "APAGAR"
        hiddenNota.value = "APAGAR_NOTA";
        hiddenMotivo.value = "";

        btnLixo.style.display = 'none'; // Esconde o lixo

        btnAtribuir.innerText = 'Eliminada';
        btnAtribuir.style.color = 'var(--text-muted)';
        btnAtribuir.style.background = 'transparent';
        btnAtribuir.style.borderColor = '#333';
        btnAtribuir.style.textDecoration = 'line-through'; // Riscado para o Prof ver que vai apagar

        return;
    }

    // CLIQUE NO BOTÃO DE LIXO (APAGAR A NOTA)
    if (e.target.closest('.btn-limpar-nota')) {
        if (!confirm("Tens a certeza que queres eliminar esta avaliação? Terás de clicar em 'Gravar Avaliações' no fim para confirmar.")) return;

        const btnLixo = e.target.closest('.btn-limpar-nota');
        const row = btnLixo.closest('.aluno-nota-row');

        const btnAtribuir = row.querySelector('.btn-abrir-escolha-nota');
        const hiddenNota = row.querySelector('.input-nota-aluno-hidden');
        const hiddenMotivo = row.querySelector('.input-motivo-aluno-hidden');

        // Limpa a nota (ao enviar nota vazia, a base de dados elimina-a se quiseres)
        hiddenNota.value = "";
        hiddenMotivo.value = "";

        btnLixo.style.display = 'none'; // Esconde o lixo

        btnAtribuir.innerText = 'Atribuir';
        btnAtribuir.style.color = 'var(--primary-green)';
        btnAtribuir.style.background = 'transparent';
        btnAtribuir.style.borderColor = '#333';

        return;
    }

    // GRAVAR NOTAS NA BASE DE DADOS
    if (e.target.closest('#btn-gravar-notas-turma')) {
        const btn = e.target.closest('#btn-gravar-notas-turma');
        const turma = state.selectedTurma;
        const disciplina = document.getElementById('lancar-nota-disciplina').value;
        const modulo = document.getElementById('lancar-nota-modulo').value;

        if (!modulo) {
            alert("Por favor, aguarda ou seleciona um módulo válido.");
            return;
        }

        const linhas = document.querySelectorAll('.aluno-nota-row');
        const notasParaGravar = [];
        const notasParaApagar = [];

        linhas.forEach(row => {
            const alunoId = row.getAttribute('data-id');
            const notaVal = row.querySelector('.input-nota-aluno-hidden').value;
            const motivoVal = row.querySelector('.input-motivo-aluno-hidden').value;

            if (notaVal === "APAGAR_NOTA") {
                notasParaApagar.push(alunoId);
            } else if (notaVal !== "") {
                notasParaGravar.push({
                    alunoId: alunoId,
                    nota: notaVal, // Pode ser '10' a '20' ou 'REP'
                    motivo: motivoVal
                });
            }
        });

        if (notasParaGravar.length === 0 && notasParaApagar.length === 0) {
            alert("Não efetuaste nenhuma alteração nas notas.");
            return;
        }

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
        btn.disabled = true;

        try {
            // Importar a função de apagar
            const { deleteDoc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            const operacoes = [];

            // 1. Apagar as notas que levaram com o lixo
            notasParaApagar.forEach(alunoId => {
                operacoes.push(deleteDoc(doc(db, "utilizadores", alunoId, "avaliacoes", `${disciplina}_${modulo}`)));
            });

            // 2. Gravar as notas novas ou alteradas
            notasParaGravar.forEach(n => {
                operacoes.push(
                    setDoc(doc(db, "utilizadores", n.alunoId, "avaliacoes", `${disciplina}_${modulo}`), {
                        turma: turma,
                        disciplina: disciplina,
                        modulo: modulo,
                        nota: n.nota,
                        motivoREP: n.motivo || null,
                        dataLancamento: new Date().toISOString(),
                        professor: state.myUserName
                    }, { merge: true })
                );
            });

            await Promise.all(operacoes);

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Alterações Guardadas!';
            setTimeout(() => {
                btn.innerHTML = txtOriginal;
                btn.disabled = false;
                document.getElementById('modal-lancamento-notas').style.display = 'none';
            }, 2000);

        } catch (err) {
            console.error(err);
            btn.innerHTML = 'Erro ao gravar!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ABRIR MODAL DOS MATERIAIS / SUMÁRIOS
    if (e.target.closest('#btn-modal-materiais')) {
        const turma = state.selectedTurma;
        if (!turma) {
            alert("Seleciona primeiro uma turma.");
            return;
        }

        const discSelect = document.getElementById('mat-disciplina');
        if (discSelect && state.disciplinasProfessor) {
            discSelect.innerHTML = state.disciplinasProfessor.map(d => `<option value="${d}">${d}</option>`).join('');
        }
        const turmaSelect = document.getElementById('lancar-sumario-turma');
        if (turmaSelect) {
            turmaSelect.innerHTML = `<option value="${turma}">${turma}</option>`;
        }
        const modal = document.getElementById('modal-materiais');
        if (modal) modal.style.display = 'flex';
        return;
    }

    // A MÁGICA DA IA A ESCREVER O SUMÁRIO POR EXTENSO
    if (e.target.closest('#btn-ia-formatar-sumario')) {
        e.preventDefault();
        const btnIA = e.target.closest('#btn-ia-formatar-sumario');
        const textArea = document.getElementById('mat-sumario');
        let textoRaw = textArea.value.trim();

        if (!textoRaw) {
            alert("Escreve alguns tópicos soltos primeiro para a IA ter matéria-prima!");
            return;
        }

        const iconOriginal = btnIA.innerHTML;
        btnIA.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btnIA.disabled = true;

        setTimeout(() => {
            // 1. Extrair os tópicos isolados (por vírgula, ponto ou nova linha)
            let items = textoRaw.split(/[\n,.]+/).map(t => t.trim()).filter(t => t.length > 0);

            // 2. Colocar a primeira letra minúscula para a frase encaixar perfeitamente
            items = items.map(t => t.charAt(0).toLowerCase() + t.slice(1));

            let resultadoFinal = "";

            // 3. Montar o texto corrido de forma fluida consoante o número de tópicos
            if (items.length === 1) {
                resultadoFinal = `Nesta sessão, procedeu-se à exploração e desenvolvimento de ${items[0]}. Os conteúdos foram lecionados de forma a consolidar as aprendizagens, tendo os alunos demonstrado empenho na execução das tarefas.`;
            } else if (items.length === 2) {
                resultadoFinal = `A aula de hoje centrou-se inicialmente na análise de ${items[0]}, com posterior transição e abordagem a ${items[1]}. O envolvimento e a postura da turma foram genericamente positivos ao longo da sessão.`;
            } else {
                const ultimo = items.pop();
                const primeiro = items.shift();
                resultadoFinal = `A sessão letiva teve início com a exploração de ${primeiro}. Posteriormente, procedeu-se ao desenvolvimento dos seguintes conteúdos práticos e teóricos: ${items.join(", ")}, culminando com ${ultimo}. A turma mostrou-se globalmente atenta e participativa.`;
            }

            // 4. Afinar ligações da língua portuguesa (corrigir "de o" para "do", etc.)
            resultadoFinal = resultadoFinal.replace(/ de o /g, " do ").replace(/ de a /g, " da ").replace(/ de os /g, " dos ").replace(/ de as /g, " das ");

            // Capitalizar sempre a primeira letra
            resultadoFinal = resultadoFinal.charAt(0).toUpperCase() + resultadoFinal.slice(1);

            textArea.value = resultadoFinal;

            btnIA.innerHTML = '<i class="fa-solid fa-check" style="color: #10b981;"></i>';
            setTimeout(() => {
                btnIA.innerHTML = iconOriginal;
                btnIA.disabled = false;
            }, 2000);
        }, 1500);
        return;
    }

    // GRAVAR O SUMÁRIO NA BASE DE DADOS (COM UPLOAD DE FICHEIRO)
    if (e.target.closest('#btn-gravar-material')) {
        const btn = e.target.closest('#btn-gravar-material');
        const turma = state.selectedTurma || document.getElementById('lancar-sumario-turma').value;
        const disciplina = document.getElementById('mat-disciplina').value;
        const titulo = document.getElementById('mat-titulo').value.trim();
        const sumario = document.getElementById('mat-sumario').value.trim();

        // Vamos procurar o input file com segurança (se não existir, não encrava a app)
        const fileInput = document.getElementById('mat-file');
        const file = (fileInput && fileInput.files && fileInput.files.length > 0) ? fileInput.files[0] : null;

        if (!turma) { alert("Seleciona a turma primeiro."); return; }
        if (!titulo || !sumario) { alert("O título e o sumário são obrigatórios."); return; }

        // Segurança: Evitar ficheiros gigantes que encravem a base de dados (Limite 2.5MB)
        if (file && file.size > 2.5 * 1024 * 1024) {
            alert("O ficheiro é demasiado grande. O limite máximo é 2.5MB (ideal para PDFs e Fichas).");
            return;
        }

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A registar...';
        btn.disabled = true;

        // Função interna que faz a gravação final na BD
        const gravarNaBD = async (base64Data, nomeFicheiro) => {
            try {
                await addDoc(collection(db, "turmas", turma, "sumarios"), {
                    disciplina: disciplina,
                    titulo: titulo,
                    texto: sumario,
                    dataLancamento: new Date().toISOString(),
                    professor: state.myUserName,
                    temAnexo: !!base64Data, // Será true se existir ficheiro
                    anexoBase64: base64Data || null, // O código do ficheiro em si
                    anexoNome: nomeFicheiro || null // O nome (ex: Ficha1.pdf)
                });

                btn.innerHTML = '<i class="fa-solid fa-check"></i> Aula Registada!';

                // Limpa o formulário
                document.getElementById('mat-titulo').value = '';
                document.getElementById('mat-sumario').value = '';
                if (fileInput) fileInput.value = '';

                setTimeout(() => {
                    btn.innerHTML = txtOriginal;
                    btn.disabled = false;
                    document.getElementById('modal-materiais').style.display = 'none';
                }, 1500);

            } catch (err) {
                console.error(err);
                btn.innerHTML = 'Erro ao gravar!';
                setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
            }
        };

        // Se houver ficheiro, lê o ficheiro e depois grava. Se não houver, grava logo sem anexo!
        if (file) {
            const reader = new FileReader();
            reader.onload = () => {
                gravarNaBD(reader.result, file.name); // reader.result é o nosso Base64
            };
            reader.onerror = () => {
                alert("Erro ao ler o ficheiro. A guardar apenas o texto...");
                gravarNaBD(null, null);
            };
            reader.readAsDataURL(file);
        } else {
            gravarNaBD(null, null);
        }
        return;
    }

    // ABRIR MODAL AGENDA
    if (e.target.closest('#btn-modal-agenda')) {
        const discSelect = document.getElementById('agendar-disciplina');
        if (discSelect && state.disciplinasProfessor) {
            discSelect.innerHTML = state.disciplinasProfessor.map(d => `<option value="${d}">${d}</option>`).join('');
            discSelect.style.display = 'block';
        }
        const modal = document.getElementById('modal-agendar-evento');
        if (modal) modal.style.display = 'flex';
        return;
    }

    // GRAVAR EVENTO NA AGENDA DA TURMA
    if (e.target.closest('#btn-gravar-evento')) {
        const btn = e.target.closest('#btn-gravar-evento');
        const titulo = document.getElementById('evento-titulo').value.trim();
        const disciplina = document.getElementById('agendar-disciplina').value;
        const dataStr = document.getElementById('evento-data').value;
        const tipo = document.getElementById('evento-tipo').value;
        const periodo = document.getElementById('evento-periodo').value;
        const hora = document.getElementById('evento-hora').value;
        const turma = state.selectedTurma;

        if (!turma) return alert("Erro: Seleciona uma turma primeiro no menu superior.");
        if (!titulo || !dataStr) return alert("Erro: O título e a data do evento são obrigatórios.");

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A agendar...';
        btn.disabled = true;

        try {
            await addDoc(collection(db, "turmas", turma, "eventos"), {
                titulo: titulo,
                disciplina: disciplina,
                data: dataStr,
                tipo: tipo,
                periodo: periodo,
                hora: periodo === 'hora' ? hora : '',
                professor: state.myUserName,
                dataRegisto: new Date().toISOString()
            });

            // Regista no histórico de atividade do Professor
            if (window.registarAtividadeProfessor) {
                await window.registarAtividadeProfessor('sintese', `Agendou um evento: ${titulo}`, `Turma ${turma} | ${dataStr}`);
            }

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Agendado!';
            setTimeout(() => {
                btn.innerHTML = txtOriginal;
                btn.disabled = false;
                document.getElementById('modal-agendar-evento').style.display = 'none';
                document.getElementById('evento-titulo').value = '';
                document.getElementById('evento-data').value = '';

                // Atualiza o radar do dashboard
                if (window.carregarRadarProfessor) window.carregarRadarProfessor();
            }, 1500);
        } catch (err) {
            console.error("Erro ao agendar evento:", err);
            btn.innerHTML = 'Erro ao agendar!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ==========================================
    // 1. ABRIR PROJETO DE CIDADANIA (LEITURA VS EDIÇÃO)
    // ==========================================
    if (e.target.closest('#btn-ver-cidadania')) {

        // Proteção de Turma (Aplica a mesma lógica que usámos na Planta!)
        let turmasDoDT = [];
        if (Array.isArray(state.profData.turmaDT)) turmasDoDT = state.profData.turmaDT;
        else if (state.profData.turmaDT) turmasDoDT = [state.profData.turmaDT];
        else if (state.profData.turmasDT) turmasDoDT = state.profData.turmasDT;
        else turmasDoDT = state.turmasProfessor;

        if (!state.selectedTurma) {
            if (state.activeRole === 'diretor_turma' && turmasDoDT.length === 1) {
                state.selectedTurma = turmasDoDT[0];
            } else {
                window.abrirAcaoRapida('btn-ver-cidadania');
                return;
            }
        }

        const modal = document.getElementById('modal-projeto-cidadania');
        if (!modal) return;

        const turma = state.selectedTurma;
        document.getElementById('cid-turma-badge').innerText = `Turma ${turma}`;

        // Verifica se é o DT DESTA turma
        const isDT = (state.activeRole === 'diretor_turma' && turmasDoDT.includes(turma));

        const viewMode = document.getElementById('cid-view-mode');
        const editMode = document.getElementById('cid-edit-mode');

        // Alterna os ecrãs
        if (isDT) {
            viewMode.style.display = 'none';
            editMode.style.display = 'block';
        } else {
            viewMode.style.display = 'block';
            editMode.style.display = 'none';
            document.getElementById('cidadania-sugestao-dt').value = ""; // Limpa a caixa de envio
        }

        modal.style.display = 'flex';

        try {
            // 1. CARREGAR O PROJETO OFICIAL
            const docSnap = await getDoc(doc(db, "turmas", turma, "cidadania", "projeto"));
            if (docSnap.exists()) {
                const dados = docSnap.data();

                // Preenche o Modo Leitura (Professores)
                document.getElementById('cid-tema-view').innerText = dados.tema || "Sem tema definido.";
                document.getElementById('cid-produto-view').innerText = dados.produto || "Sem produto definido.";
                document.getElementById('cid-etapas-view').innerText = dados.etapas || "Sem etapas definidas.";

                // Preenche o Modo Edição (DT)
                document.getElementById('cid-tema-edit').value = dados.tema || "";
                document.getElementById('cid-produto-edit').value = dados.produto || "";
                document.getElementById('cid-etapas-edit').value = dados.etapas || "";
            } else {
                document.getElementById('cid-tema-view').innerText = "O Diretor de Turma ainda não configurou o projeto.";
                document.getElementById('cid-produto-view').innerText = "-";
                document.getElementById('cid-etapas-view').innerText = "-";

                document.getElementById('cid-tema-edit').value = "";
                document.getElementById('cid-produto-edit').value = "";
                document.getElementById('cid-etapas-edit').value = "";
            }

            // 2. CARREGAR AS SUGESTÕES DOS PROFESSORES (SÓ SE FOR O DT)
            if (isDT) {
                const listaSugestoes = document.getElementById('cid-lista-sugestoes-dt');
                listaSugestoes.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A ler a caixa de correio...</p>';

                const q = query(collection(db, "turmas", turma, "cidadania_sugestoes"));
                const sugSnap = await getDocs(q);

                if (sugSnap.empty) {
                    listaSugestoes.innerHTML = '<p class="text-muted center" style="font-size:0.85rem; padding: 10px;">Ainda não recebeste sugestões dos colegas.</p>';
                } else {
                    let htmlSugestoes = '';
                    sugSnap.forEach(docS => {
                        const sug = docS.data();
                        const dataStr = sug.data ? new Date(sug.data).toLocaleDateString('pt-PT') : '';

                        htmlSugestoes += `
                        <div style="background: rgba(255,255,255,0.05); border-left: 3px solid var(--warning-yellow); padding: 10px; border-radius: 6px; margin-bottom: 10px;">
                            <div style="display:flex; justify-content:space-between; margin-bottom: 5px;">
                                <strong style="color: white; font-size: 0.85rem;">${sug.professor} <span style="color:var(--text-muted); font-size:0.75rem; font-weight:normal;">(${sug.disciplina})</span></strong>
                                <span style="font-size:0.7rem; color:var(--text-muted);">${dataStr}</span>
                            </div>
                            <p style="font-size: 0.85rem; color: var(--text-light); margin: 0; white-space: pre-wrap;">${sug.texto}</p>
                        </div>`;
                    });
                    listaSugestoes.innerHTML = htmlSugestoes;
                }
            }
        } catch (err) {
            console.error("Erro a carregar cidadania:", err);
            document.getElementById('cid-tema-view').innerText = "Erro ao carregar dados.";
        }
        return;
    }

    // ==========================================
    // 2. O PROFESSOR ENVIA UMA SUGESTÃO AO DT
    // ==========================================
    if (e.target.closest('#btn-enviar-sugestao-cidadania')) {
        const btn = e.target.closest('#btn-enviar-sugestao-cidadania');
        const sugestao = document.getElementById('cidadania-sugestao-dt').value.trim();
        const turma = state.selectedTurma;
        const disciplina = state.disciplinasProfessor[0] || "Geral";

        if (!sugestao) {
            alert("Escreve uma sugestão na caixa primeiro!");
            return;
        }

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar para o DT...';
        btn.disabled = true;

        try {
            await addDoc(collection(db, "turmas", turma, "cidadania_sugestoes"), {
                professor: state.myUserName,
                disciplina: disciplina,
                texto: sugestao,
                data: new Date().toISOString()
            });

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviado com sucesso!';
            document.getElementById('cidadania-sugestao-dt').value = ''; // Limpa a caixa
            setTimeout(() => {
                btn.innerHTML = txtOriginal;
                btn.disabled = false;
            }, 2000);
        } catch (err) {
            console.error(err);
            btn.innerHTML = 'Erro ao enviar!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ==========================================
    // 3. O DT GRAVA O PROJETO OFICIAL
    // ==========================================
    if (e.target.closest('#btn-gravar-cidadania-dt')) {
        const btn = e.target.closest('#btn-gravar-cidadania-dt');
        const turma = state.selectedTurma;

        const tema = document.getElementById('cid-tema-edit').value.trim();
        const produto = document.getElementById('cid-produto-edit').value.trim();
        const etapas = document.getElementById('cid-etapas-edit').value.trim();

        if (!tema) {
            alert("O Tema/Domínio é obrigatório.");
            return;
        }

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar na Turma...';
        btn.disabled = true;

        try {
            // Grava na gaveta central da Cidadania da Turma
            await setDoc(doc(db, "turmas", turma, "cidadania", "projeto"), {
                tema: tema,
                produto: produto,
                etapas: etapas,
                atualizadoPor: state.myUserName,
                atualizadoEm: new Date().toISOString()
            }, { merge: true });

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Projeto Atualizado!';
            setTimeout(() => {
                btn.innerHTML = txtOriginal;
                btn.disabled = false;
            }, 2000);
        } catch (err) {
            console.error("Erro ao gravar cidadania:", err);
            btn.innerHTML = 'Erro!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // LÓGICA DA PLANTA DA SALA
    const carteira = e.target.closest('.carteira-lugar');
    if (carteira) {
        const posClicked = parseInt(carteira.getAttribute('data-pos'));

        if (lugarSelecionadoIndex === null) {
            if (!disposicaoAtualAlunos[posClicked]) {
                alert("Este lugar está vazio. Clica num aluno para o selecionar primeiro.");
                return;
            }
            lugarSelecionadoIndex = posClicked;
        } else {
            const temp = disposicaoAtualAlunos[lugarSelecionadoIndex];
            disposicaoAtualAlunos[lugarSelecionadoIndex] = disposicaoAtualAlunos[posClicked] || null;
            disposicaoAtualAlunos[posClicked] = temp;

            lugarSelecionadoIndex = null;
            const salaId = document.getElementById('select-sala-aula').value;
            window.renderizarPlantaSala(salaId, disposicaoAtualAlunos);
        }

        const salaId = document.getElementById('select-sala-aula').value;
        window.renderizarPlantaSala(salaId, disposicaoAtualAlunos);
        return;
    }

    // ==========================================
    // 1. ABRIR O MODAL DA PLANTA DA SALA
    // ==========================================
    if (e.target.closest('#btn-ver-planta') || e.target.closest('#btn-modal-planta')) {

        let turmasDoDT = [];
        if (Array.isArray(state.profData.turmaDT)) turmasDoDT = state.profData.turmaDT;
        else if (state.profData.turmaDT) turmasDoDT = [state.profData.turmaDT];
        else if (state.profData.turmasDT) turmasDoDT = state.profData.turmasDT;
        else turmasDoDT = state.turmasProfessor;

        if (!state.selectedTurma) {
            if (state.activeRole === 'diretor_turma' && turmasDoDT.length === 1) {
                state.selectedTurma = turmasDoDT[0];
            } else {
                window.abrirAcaoRapida(e.target.closest('.btn')?.id || 'btn-ver-planta');
                return;
            }
        }

        const modal = document.getElementById('modal-planta-sala');
        if (modal) {
            modal.style.display = 'flex';
            const turma = state.selectedTurma;
            const disciplina = state.disciplinasProfessor[0] || "Geral";

            document.getElementById('planta-turma-badge').innerText = `Turma ${turma}`;

            const isDT = (state.activeRole === 'diretor_turma' && turmasDoDT.includes(turma));
            const btnGuardarDT = document.getElementById('btn-guardar-planta-dt');
            const btnGuardarProf = document.getElementById('btn-guardar-planta-prof');
            const btnCopiar = document.getElementById('btn-copiar-planta-dt');
            const blocoAssistente = document.getElementById('bloco-assistente-planta');

            if (btnGuardarDT) btnGuardarDT.style.display = isDT ? 'inline-block' : 'none';
            if (blocoAssistente) blocoAssistente.style.display = isDT ? 'block' : 'none';
            if (btnGuardarProf) btnGuardarProf.style.display = isDT ? 'none' : 'inline-block';
            if (btnCopiar) btnCopiar.style.display = isDT ? 'none' : 'inline-block';

            const inputIA = document.getElementById('input-planta-ia');
            if (inputIA) inputIA.value = "";

            try {
                let salaAtual = 'vertical';
                let lugaresCarregados = {};

                // 1. Decidir que planta carregar
                if (isDT) {
                    const dtSnap = await getDoc(doc(db, "turmas", turma, "cidadania", "planta_dt"));
                    if (dtSnap.exists()) {
                        salaAtual = dtSnap.data().sala || 'vertical';
                        lugaresCarregados = dtSnap.data().lugares || {};
                    }
                } else {
                    const docSnap = await getDoc(doc(db, "turmas", turma, "plantas_professors", `${state.myUserId}_${disciplina}`));
                    if (docSnap.exists()) {
                        salaAtual = docSnap.data().sala || 'vertical';
                        lugaresCarregados = docSnap.data().lugares || {};
                    } else {
                        const dtSnap = await getDoc(doc(db, "turmas", turma, "cidadania", "planta_dt"));
                        if (dtSnap.exists()) {
                            salaAtual = dtSnap.data().sala || 'vertical';
                            lugaresCarregados = dtSnap.data().lugares || {};
                        }
                    }
                }

                document.getElementById('select-sala-aula').value = salaAtual;
                window.renderizarPlantaSala(salaAtual, lugaresCarregados);

                // 2. MAGIA NEGRA: Se a sala estiver 100% vazia, invoca os alunos automaticamente!
                const temAlunosSentados = Object.values(lugaresCarregados).some(n => n && n !== 'Lugar Vago');
                if (!temAlunosSentados) {
                    const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno")));
                    let alunosArr = [];
                    snap.forEach(d => alunosArr.push(nomeCurto(d.data().nome)));
                    alunosArr.sort((a, b) => a.localeCompare(b)); // Ordem alfabética

                    disposicaoAtualAlunos = {};
                    for (let i = 0; i < alunosArr.length; i++) {
                        disposicaoAtualAlunos[i + 1] = alunosArr[i];
                    }
                    window.renderizarPlantaSala(salaAtual, disposicaoAtualAlunos);
                }
            } catch (err) {
                console.error(err);
                window.renderizarPlantaSala('vertical', {});
            }
        }
        return;
    }

    // ==========================================
    // 2. BOTÃO IA / AUTO-PREENCHER INTELIGENTE
    // ==========================================
    if (e.target.closest('#btn-ia-planta')) {
        const btn = e.target.closest('#btn-ia-planta');
        const turma = state.selectedTurma;
        if (!turma) return alert("Erro: Não foi detetada nenhuma turma.");

        const inputIA = document.getElementById('input-planta-ia');
        const promptIA = inputIA ? inputIA.value.trim().toLowerCase() : "";

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A desenhar...';
        btn.disabled = true;

        try {
            const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno")));
            let alunosNomes = [];
            snap.forEach(d => alunosNomes.push(nomeCurto(d.data().nome)));

            setTimeout(() => {
                const salaId = document.getElementById('select-sala-aula').value;
                const config = dimensoesSalas[salaId] || dimensoesSalas['vertical'];
                const multiplicador = config.tipo === 'dupla' ? 2 : 1;
                const totalLugares = config.cols * multiplicador * config.linhas;

                let lugaresAtribuidos = {};
                for (let i = 1; i <= totalLugares; i++) lugaresAtribuidos[i] = null;

                if (!promptIA) {
                    alunosNomes.sort((a, b) => a.localeCompare(b));
                    for (let i = 0; i < alunosNomes.length; i++) {
                        lugaresAtribuidos[i + 1] = alunosNomes[i];
                    }
                } else {
                    let alunosParaAlocarFrente = [];
                    let alunosParaAlocarTras = [];
                    let outrosAlunos = [];

                    const frases = promptIA.split(/[.,;]+/);

                    alunosNomes.forEach(nomeCompleto => {
                        const primeiroNome = nomeCompleto.toLowerCase().split(' ')[0];
                        let encontrouEmRegra = false;

                        frases.forEach(frase => {
                            if (frase.includes(primeiroNome)) {
                                encontrouEmRegra = true;
                                if (frase.includes('trás') || frase.includes('tras') || frase.includes('fundo') || frase.includes('fim')) {
                                    alunosParaAlocarTras.push(nomeCompleto);
                                } else if (frase.includes('frente') || frase.includes('quadro') || frase.includes('primeir')) {
                                    alunosParaAlocarFrente.push(nomeCompleto);
                                } else {
                                    alunosParaAlocarFrente.push(nomeCompleto);
                                }
                            }
                        });

                        if (!encontrouEmRegra) outrosAlunos.push(nomeCompleto);
                    });

                    let currentIndexFrente = 1;
                    alunosParaAlocarFrente.forEach(nome => {
                        if (currentIndexFrente <= totalLugares) {
                            lugaresAtribuidos[currentIndexFrente] = nome;
                            currentIndexFrente++;
                        }
                    });

                    let currentIndexTras = totalLugares;
                    alunosParaAlocarTras.forEach(nome => {
                        while (currentIndexTras > 0 && lugaresAtribuidos[currentIndexTras] !== null) {
                            currentIndexTras--;
                        }
                        if (currentIndexTras > 0) lugaresAtribuidos[currentIndexTras] = nome;
                    });

                    outrosAlunos.sort(() => Math.random() - 0.5);
                    let ptrResto = 0;
                    for (let i = 1; i <= totalLugares; i++) {
                        if (lugaresAtribuidos[i] === null && ptrResto < outrosAlunos.length) {
                            lugaresAtribuidos[i] = outrosAlunos[ptrResto];
                            ptrResto++;
                        }
                    }
                }

                disposicaoAtualAlunos = lugaresAtribuidos;
                window.renderizarPlantaSala(salaId, disposicaoAtualAlunos);

                btn.innerHTML = '<i class="fa-solid fa-check"></i> Feito!';
                setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 1500);
            }, 600);

        } catch (err) {
            console.error(err);
            btn.innerHTML = 'Erro!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 1500);
        }
        return;
    }

    // ==========================================
    // 3. BOTÃO BARALHAR TURMA
    // ==========================================
    if (e.target.closest('#btn-shuffle-planta')) {
        const btn = e.target.closest('#btn-shuffle-planta');

        let alunosSentados = Object.values(disposicaoAtualAlunos).filter(n => n && n !== "Lugar Vago");

        if (alunosSentados.length === 0) {
            alert("A sala está vazia! Clica no botão amarelo 'Gerar' primeiro.");
            return;
        }

        // Mistura a array (Fisher-Yates Shuffle)
        for (let i = alunosSentados.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [alunosSentados[i], alunosSentados[j]] = [alunosSentados[j], alunosSentados[i]];
        }

        disposicaoAtualAlunos = {};
        for (let i = 0; i < alunosSentados.length; i++) {
            disposicaoAtualAlunos[i + 1] = alunosSentados[i];
        }

        const salaId = document.getElementById('select-sala-aula').value;
        window.renderizarPlantaSala(salaId, disposicaoAtualAlunos);

        const ico = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => { btn.innerHTML = ico; }, 1000);

        return;
    }

    // ==========================================
    // 3. DIRETOR DE TURMA GRAVA A MATRIZ OFICIAL
    // ==========================================
    if (e.target.closest('#btn-guardar-planta-dt')) {
        const btn = e.target.closest('#btn-guardar-planta-dt');
        const turma = state.selectedTurma;
        const salaId = document.getElementById('select-sala-aula').value;

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar Matriz...';
        btn.disabled = true;

        try {
            await setDoc(doc(db, "turmas", turma, "cidadania", "planta_dt"), {
                sala: salaId,
                lugares: disposicaoAtualAlunos,
                atualizadoEm: new Date().toISOString(),
                dt: state.myUserName
            });

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Matriz Oficial Guardada!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        } catch (err) {
            console.error(err);
            btn.innerHTML = 'Erro ao guardar!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ==========================================
    // 4. PROFESSOR NORMAL COPIA A PLANTA DO DT
    // ==========================================
    if (e.target.closest('#btn-copiar-planta-dt')) {
        const turma = state.selectedTurma;
        try {
            const dtSnap = await getDoc(doc(db, "turmas", turma, "cidadania", "planta_dt"));
            if (dtSnap.exists()) {
                const dadosDt = dtSnap.data();
                if (dadosDt.sala) document.getElementById('select-sala-aula').value = dadosDt.sala;
                window.renderizarPlantaSala(dadosDt.sala || 'sala_1', dadosDt.lugares || {});
            } else {
                alert("O Diretor de Turma ainda não definiu nenhuma planta oficial para esta turma. Podes clicar em 'Auto-Preencher' para gerar a tua própria planta do zero!");
            }
        } catch (err) {
            alert("Erro ao copiar a planta do DT.");
        }
        return;
    }

    // ==========================================
    // 5. PROFESSOR NORMAL GUARDA A SUA VERSÃO
    // ==========================================
    if (e.target.closest('#btn-guardar-planta-prof')) {
        const btn = e.target.closest('#btn-guardar-planta-prof');
        const turma = state.selectedTurma;
        const disciplina = state.disciplinasProfessor[0] || "Geral";
        const salaId = document.getElementById('select-sala-aula').value;

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...';
        btn.disabled = true;

        try {
            await setDoc(doc(db, "turmas", turma, "plantas_professors", `${state.myUserId}_${disciplina}`), {
                sala: salaId,
                lugares: disposicaoAtualAlunos,
                atualizadoEm: new Date().toISOString()
            }, { merge: true });

            btn.innerHTML = '<i class="fa-solid fa-check"></i> A Minha Planta Guardada!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        } catch (err) {
            console.error(err);
            btn.innerHTML = 'Erro ao guardar!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ABRIR MODAL PRINCIPAL DAS SÍNTESES
    if (e.target.closest('#btn-ver-sinteses-turma') || e.target.closest('#btn-modal-sinteses')) {
        const turma = state.selectedTurma;
        if (!turma) { alert("Seleciona primeiro uma turma no menu superior."); return; }

        const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
        const areaPublicar = document.getElementById('area-publicar-sinteses-dt');
        if (areaPublicar) areaPublicar.style.display = isDT ? 'block' : 'none';

        // NOVO: Preencher as disciplinas do Professor
        const discSelectModal = document.getElementById('lancar-sintese-disciplina');
        if (discSelectModal) {
            discSelectModal.innerHTML = state.disciplinasProfessor.map(d => `<option value="${d}">${d}</option>`).join('');
        }

        const grid = document.getElementById('grid-sinteses-alunos');
        if (grid) {
            grid.innerHTML = '<p class="text-muted center" style="padding:15px; font-size:0.85rem;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>';
            try {
                const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno")));
                let arr = [];
                cS.forEach(d => arr.push({ id: d.id, ...d.data() }));
                arr.sort((a, b) => a.nome.localeCompare(b.nome));

                let cH = '';
                arr.forEach(d => {
                    cH += `
                    <div class="aluno-sintese-row" data-id="${d.id}" style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px; margin-bottom:5px;">
                        <span class="nome-aluno-span" style="color:white; font-size:0.85rem; flex: 1;">${nomeCurto(d.nome)}</span>
                        <button class="btn-abrir-gerador-sintese secondary-btn small-btn" style="width: 90px; color: #3b82f6; border-color: #3b82f6;">Avaliar</button>
                        <input type="hidden" class="input-sintese-hidden" value="">
                        <i class="fa-solid fa-check icon-sintese-feita" style="color:var(--success-green); display:none; margin-left:10px;"></i>
                    </div>`;
                });
                grid.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH;
            } catch (err) { grid.innerHTML = '<p class="text-danger center">Erro a carregar alunos.</p>'; }
        }

        // Tenta encontrar o modal com o nome novo ou com o nome antigo
        const modalSintese = document.getElementById('modal-lancamento-sinteses') || document.getElementById('modal-sinteses') || document.getElementById('modal-sintese');

        if (modalSintese) {
            modalSintese.style.display = 'flex';
        } else {
            console.error("IDs não encontrados. Verifica o teu HTML!");
            alert("Atenção: O modal existe no código, mas o JavaScript não encontra o ID dele no ficheiro HTML! Confirma se a div do modal se chama 'modal-lancamento-sinteses' ou 'modal-sinteses'.");
        }

        return;
    }

    // NAVEGAÇÃO DE SETAS NA SÍNTESE
    if (e.target.closest('#btn-sint-anterior') || e.target.closest('#btn-sint-seguinte')) {
        const isNext = e.target.closest('#btn-sint-seguinte') !== null;
        const atualId = document.getElementById('sintese-aluno-id-atual').value;
        const linhas = Array.from(document.querySelectorAll('.aluno-sintese-row'));
        const indexAtual = linhas.findIndex(r => r.getAttribute('data-id') === atualId);

        if (indexAtual !== -1) {
            const novoIndex = isNext ? indexAtual + 1 : indexAtual - 1;
            if (novoIndex >= 0 && novoIndex < linhas.length) {
                window.carregarAlunoNoMiniModalSintese(linhas[novoIndex]);
            }
        }
        return;
    }

    // O "PULO DO GATO": IA GERADORA DE TEXTO
    if (e.target.closest('#btn-auto-gerar-sintese')) {
        const btn = e.target.closest('#btn-auto-gerar-sintese');
        const originalIcon = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A compilar avaliação...';

        setTimeout(async () => {
            const alunoId = document.getElementById('sintese-aluno-id-atual').value;
            let partesTexto = [];

            // Costura as frases qualitativas com base nas escalas tocadas pelo professor
            if (estadoEscalasAluno.assiduidade && estadoEscalasAluno.pontualidade) {
                partesTexto.push(`O aluno revela-se um elemento ${estadoEscalasAluno.assiduidade.toLowerCase()} e ${estadoEscalasAluno.pontualidade.toLowerCase()}.`);
            }
            if (estadoEscalasAluno.interesse && estadoEscalasAluno.empenho) {
                partesTexto.push(`Demonstra-se ${estadoEscalasAluno.interesse.toLowerCase()} face à disciplina, evidenciando um perfil ${estadoEscalasAluno.empenho.toLowerCase()} nas tarefas propostas.`);
            }
            if (estadoEscalasAluno.participacao && estadoEscalasAluno.autonomia) {
                partesTexto.push(`A sua participação em aula tem sido ${estadoEscalasAluno.participacao.toLowerCase()}, mostrando-se ${estadoEscalasAluno.autonomia.toLowerCase()} na resolução das atividades.`);
            }
            if (estadoEscalasAluno.responsabilidade && estadoEscalasAluno.comportamento) {
                partesTexto.push(`A nível comportamental adota uma postura ${estadoEscalasAluno.comportamento.toLowerCase()}, revelando-se ${estadoEscalasAluno.responsabilidade.toLowerCase()} perante os deveres escolares.`);
            }
            if (estadoEscalasAluno.tarefas && estadoEscalasAluno.organizacao) {
                partesTexto.push(`No que respeita ao trabalho autónomo, ${estadoEscalasAluno.tarefas.toLowerCase()} e apresenta um nível ${estadoEscalasAluno.organizacao.toLowerCase()} na organização.`);
            }
            if (estadoEscalasAluno.relacao && estadoEscalasAluno.evolucao) {
                partesTexto.push(`Relativamente à dinâmica relacional, demonstra ser ${estadoEscalasAluno.relacao.toLowerCase()}, registando-se ${estadoEscalasAluno.evolucao.toLowerCase()} ao longo do período.`);
            }

            let textoFinal = partesTexto.join(" ");

            // --- MANTER AS FUNÇÕES DE PRHFS E MÓDULOS EM ATRASO ---
            if (document.getElementById('sint-check-prhfs')?.checked) {
                try {
                    const disciplinaAtual = state.disciplinasProfessor[0];
                    let prhfsAtivos = 0;
                    const pS = await getDocs(collection(db, "utilizadores", alunoId, "prhfs"));
                    pS.forEach(p => { if (p.data().status !== 'concluida' && p.data().disciplina === disciplinaAtual) prhfsAtivos++; });

                    if (prhfsAtivos > 0) {
                        textoFinal += `\n\nNeste momento, o aluno tem ativados ${prhfsAtivos} Plano(s) de Recuperação (PRHF) na disciplina, encontrando-se em processo de recuperação de aprendizagens.`;
                    }
                } catch (err) { }
            }

            if (document.getElementById('sint-check-atrasos')?.checked) {
                textoFinal += `\nDe salientar que o aluno possui módulos em atraso que carecem de recuperação.`;
            }

            document.getElementById('texto-sintese-final').value = textoFinal;
            btn.innerHTML = originalIcon;
        }, 600);
        return;
    }

    // =========================================================================
    // SUPER-PODERES DO DIRETOR DE TURMA: ABRIR MODAL, USAR IA E GUARDAR
    // =========================================================================

    // 1. ABRIR O MODAL DA SÍNTESE (LÓGICA UNIFICADA: PROFESSOR vs DT)
    if (e.target.closest('.btn-abrir-gerador-sintese')) {
        const btn = e.target.closest('.btn-abrir-gerador-sintese');
        const row = btn.closest('.aluno-sintese-row');
        const alunoId = row.getAttribute('data-id');
        const nomeAluno = row.querySelector('.nome-aluno-span').innerText;
        const momento = document.getElementById('lancar-sintese-momento-global').value;

        // O famoso semáforo
        const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);

        if (isDT) {
            // ==========================================
            // CAMINHO 1: MODO DIRETOR DE TURMA
            // ==========================================
            document.getElementById('dt-sintese-aluno-id').value = alunoId;
            document.getElementById('dt-nome-aluno-sintese').innerText = nomeAluno;
            document.getElementById('texto-sintese-final-dt').value = "";

            const modalDt = document.getElementById('modal-gerador-sintese-dt');
            const listaColegas = document.getElementById('dt-lista-sinteses-colegas');
            listaColegas.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A ler sínteses dos colegas...</p>';
            modalDt.style.display = 'flex';

            try {
                // Vai buscar os textos dos colegas à gaveta certa
                const snap = await getDoc(doc(db, "utilizadores", alunoId, "reunioes", momento));
                let htmlSinteses = '';
                let textoParaIA = '';

                if (snap.exists() && snap.data().sinteses_disciplinas) {
                    const sDisc = snap.data().sinteses_disciplinas;
                    for (const [disc, texto] of Object.entries(sDisc)) {
                        htmlSinteses += `<div style="margin-bottom:10px; padding-bottom:10px; border-bottom:1px solid #444;">
                            <strong style="color:var(--primary-green); font-size:0.9rem;">${disc}</strong>
                            <p style="font-size:0.85rem; color:var(--text-light); margin:5px 0 0 0; white-space:pre-wrap;">${texto}</p>
                        </div>`;
                        textoParaIA += `[Disciplina: ${disc}]\n${texto}\n\n`;
                    }
                }

                if (htmlSinteses === '') {
                    listaColegas.innerHTML = '<p class="text-muted center" style="margin-top:15px;">Nenhum professor registou sínteses para este momento.</p>';
                    listaColegas.setAttribute('data-texto-bruto', '');
                } else {
                    listaColegas.innerHTML = htmlSinteses;
                    listaColegas.setAttribute('data-texto-bruto', textoParaIA); // Guarda o texto invisível para a IA ler
                }

                // Carrega Parecer Global antigo se já existir
                if (snap.exists() && snap.data().sintese_global) {
                    document.getElementById('texto-sintese-final-dt').value = snap.data().sintese_global;
                }
            } catch (err) {
                listaColegas.innerHTML = '<p class="text-danger center">Erro a carregar dados.</p>';
            }

        } else {
            // ==========================================
            // CAMINHO 2: MODO PROFESSOR DA DISCIPLINA
            // ==========================================
            document.getElementById('sintese-aluno-id-atual').value = alunoId;
            document.getElementById('nome-aluno-sintese-atual').innerText = nomeAluno;
            document.getElementById('texto-sintese-final').value = ""; // Limpa a caixa

            // Desenha as 12 escalas interativas imediatamente
            if (window.renderizarDimensoesQualitativas) {
                window.renderizarDimensoesQualitativas();
            }

            const discSelectModal = document.getElementById('lancar-sintese-disciplina');
            const disciplina = discSelectModal ? discSelectModal.value : state.disciplinasProfessor[0];

            try {
                const snap = await getDoc(doc(db, "utilizadores", alunoId, "reunioes", momento));
                if (snap.exists() && snap.data().sinteses_disciplinas && snap.data().sinteses_disciplinas[disciplina]) {
                    document.getElementById('texto-sintese-final').value = snap.data().sinteses_disciplinas[disciplina];
                }
            } catch (err) { }

            document.getElementById('modal-gerador-sintese').style.display = 'flex';
        }
        return;
    }

    // 2. O COMPILADOR DE SIMBIOSE (ALGORITMO INTERNO)
    if (e.target.closest('#btn-auto-gerar-sintese-dt')) {
        const btn = e.target.closest('#btn-auto-gerar-sintese-dt');
        const txtBox = document.getElementById('texto-sintese-final-dt');
        const alunoId = document.getElementById('dt-sintese-aluno-id').value;
        const momento = document.getElementById('lancar-sintese-momento-global').value;

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A unificar relatórios...';
        btn.disabled = true;

        setTimeout(async () => {
            try {
                const snap = await getDoc(doc(db, "utilizadores", alunoId, "reunioes", momento));

                if (snap.exists() && snap.data().sinteses_disciplinas) {
                    const sDisc = snap.data().sinteses_disciplinas;
                    const entries = Object.entries(sDisc);

                    if (entries.length === 0) {
                        alert("Ainda não existem sínteses dos colegas para compilar.");
                        btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Unificar Sínteses';
                        btn.disabled = false;
                        return;
                    }

                    // 1. INÍCIO DO TEXTO
                    let textoFinal = "O Conselho de Turma procedeu à análise detalhada e integrada do percurso do aluno neste momento de avaliação. Do balanço global, reuniram-se os seguintes contributos específicos que atestam a sua prestação:\n\n";

                    // 2. O ALGORITMO DE COSTURA (Junta as disciplinas com conectores fluidos)
                    let i = 0;
                    for (const [disc, texto] of entries) {
                        let textoLimpo = texto.trim();

                        // Garante que a frase acaba sempre com pontuação
                        if (!textoLimpo.match(/[.!?]$/)) textoLimpo += ".";

                        // Primeira letra minúscula para colar melhor nas frases (ex: "tem bom comportamento" em vez de "Tem bom comportamento")
                        let textoLower = textoLimpo.charAt(0).toLowerCase() + textoLimpo.slice(1);

                        // Aplica uma rotação de conectores para o texto não parecer um robô a falar
                        if (i === 0) {
                            textoFinal += `Na disciplina de ${disc}, a avaliação destaca que ${textoLower} `;
                        } else if (i % 3 === 0) {
                            // Quebra de parágrafo a cada 3 disciplinas para o texto respirar
                            textoFinal += `\n\nPor sua vez, no âmbito de ${disc}, é de salientar a seguinte apreciação: ${textoLimpo} `;
                        } else if (i % 2 === 0) {
                            textoFinal += `Adicionalmente, em ${disc}, a observação denota que ${textoLower} `;
                        } else {
                            textoFinal += `Relativamente a ${disc}, o parecer do docente indica: ${textoLimpo} `;
                        }

                        i++;
                    }

                    // 3. REMATE FINAL DO TEXTO
                    textoFinal += "\n\nEm suma, a equipa pedagógica incentiva o aluno a manter o empenho e a regularidade no trabalho autónomo, de modo a consolidar as aprendizagens e a atingir os objetivos propostos para as próximas etapas letivas.";

                    // Escreve na caixa para o DT ver e (se quiser) dar um retoque
                    txtBox.value = textoFinal;

                } else {
                    alert("Ainda não existem sínteses dos colegas para este aluno.");
                }
            } catch (err) {
                console.error("Erro na simbiose de textos: ", err);
            }

            // Restaura o botão
            btn.innerHTML = '<i class="fa-solid fa-wand-magic-sparkles"></i> Unificar Sínteses';
            btn.disabled = false;
        }, 1000); // 1 segundo de simulação para dar aquele ar premium de processamento

        return;
    }

    // 3. O DT GUARDA A SUA SÍNTESE GLOBAL FINAL
    if (e.target.closest('#btn-salvar-sintese-bd-dt')) {
        const btn = e.target.closest('#btn-salvar-sintese-bd-dt');
        const textoF = document.getElementById('texto-sintese-final-dt').value.trim();
        const alunoId = document.getElementById('dt-sintese-aluno-id').value;
        const momento = document.getElementById('lancar-sintese-momento-global').value;

        if (!textoF) { alert("O parecer global está vazio."); return; }

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
        btn.disabled = true;

        try {
            const updateData = {
                turma: state.selectedTurma,
                atualizadoEm: new Date().toISOString(),
                sintese_global: textoF,
                dt: state.myUserName
            };

            await setDoc(doc(db, "utilizadores", alunoId, "reunioes", momento), updateData, { merge: true });

            // Dá feedback visual de sucesso na linha do aluno (o visto verde)
            const linhas = Array.from(document.querySelectorAll('.aluno-sintese-row'));
            const indexAtual = linhas.findIndex(r => r.getAttribute('data-id') === alunoId);
            if (indexAtual !== -1) {
                linhas[indexAtual].querySelector('.icon-sintese-feita').style.display = 'block';
            }

            document.getElementById('modal-gerador-sintese-dt').style.display = 'none';
            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Parecer Global';
            btn.disabled = false;
        } catch (err) {
            btn.innerHTML = 'Erro!';
            setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar Parecer Global'; btn.disabled = false; }, 2000);
        }
        return;
    }

    // GUARDAR SÍNTESE
    if (e.target.closest('#btn-salvar-sintese-bd')) {
        const btn = e.target.closest('#btn-salvar-sintese-bd');
        const textoF = document.getElementById('texto-sintese-final').value.trim();
        const alunoId = document.getElementById('sintese-aluno-id-atual').value;
        const momento = document.getElementById('lancar-sintese-momento-global').value;

        const discSelectModal = document.getElementById('lancar-sintese-disciplina');
        const disciplina = discSelectModal ? discSelectModal.value : state.disciplinasProfessor[0];

        const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);

        if (!textoF) { alert("A síntese está vazia."); return; }
        if (!disciplina && !isDT) { alert("Erro: Nenhuma disciplina detetada."); return; }

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
        btn.disabled = true;

        try {
            const docRef = doc(db, "utilizadores", alunoId, "reunioes", momento);
            
            // 1. Ler a "gaveta" primeiro para NÃO APAGAR as sínteses dos colegas!
            const snapAtual = await getDoc(docRef);
            let sintesesExistentes = {};
            if (snapAtual.exists() && snapAtual.data().sinteses_disciplinas) {
                sintesesExistentes = snapAtual.data().sinteses_disciplinas;
            }

            // 2. Adicionar apenas a tua disciplina ao pacote
            sintesesExistentes[disciplina] = textoF;

            const updateData = {
                turma: state.selectedTurma,
                atualizadoEm: new Date().toISOString()
            };

            if (isDT) {
                updateData.sintese_global = textoF;
                updateData.dt = state.myUserName;
            } else {
                // Guarda o pacote inteiro (antigas + a nova) de forma segura
                updateData.sinteses_disciplinas = sintesesExistentes;
                updateData.professor = state.myUserName;
            }

            // 3. Gravar na base de dados
            await setDoc(docRef, updateData, { merge: true });

            // Atualização Visual (Dá o "Visto" verde na lista de alunos)
            const linhas = Array.from(document.querySelectorAll('.aluno-sintese-row'));
            const indexAtual = linhas.findIndex(r => r.getAttribute('data-id') === alunoId);

            if (indexAtual !== -1) {
                const row = linhas[indexAtual];
                row.querySelector('.input-sintese-hidden').value = textoF;
                row.querySelector('.icon-sintese-feita').style.display = 'block';

                if (indexAtual + 1 < linhas.length) {
                    window.carregarAlunoNoMiniModalSintese(linhas[indexAtual + 1]);
                } else {
                    const modalS = document.getElementById('modal-gerador-sintese');
                    if (modalS) modalS.style.display = 'none';
                }
            }

            btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar e Avançar';
            btn.disabled = false;
        } catch (err) {
            console.error("Erro ao guardar síntese: ", err);
            btn.innerHTML = 'Erro!';
            setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-floppy-disk"></i> Guardar e Avançar'; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ==========================================
    // PUBLICAR SÍNTESES (CONTROLO DE VISIBILIDADE PARA E.E.)
    // ==========================================
    if (e.target.closest('#btn-publicar-sinteses-turma')) {
        const btn = e.target.closest('#btn-publicar-sinteses-turma');
        const turma = state.selectedTurma;
        const momentoSelect = document.getElementById('lancar-sintese-momento-global');
        const momentoNome = momentoSelect.options[momentoSelect.selectedIndex].text;
        const momento = momentoSelect.value;

        // O DT tem a escolha de PUBLICAR ou OCULTAR com um único botão
        const resposta = confirm(`Vais alterar a visibilidade do [${momentoNome}].\n\nClica em [OK] para PUBLICAR e permitir que Pais e Alunos leiam os pareceres na app deles.\n\nClica em [CANCELAR] se quiseres OCULTAR e proteger as sínteses.`);

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A aplicar na base de dados...';
        btn.disabled = true;

        try {
            // Vai buscar todos os alunos da turma
            const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno")));
            
            const operacoes = [];
            cS.forEach(d => {
                // Injeta a permissão "publicado" na avaliação deste momento para cada aluno
                operacoes.push(
                    setDoc(doc(db, "utilizadores", d.id, "reunioes", momento), {
                        publicado: resposta,
                        dataPublicacao: resposta ? new Date().toISOString() : null
                    }, { merge: true })
                );
            });

            // Grava tudo de uma vez (Hyper Rápido)
            await Promise.all(operacoes);

            if (resposta) {
                btn.innerHTML = '<i class="fa-solid fa-check-double"></i> Sínteses Publicadas com Sucesso!';
                btn.style.background = 'var(--success-green)';
                btn.style.color = 'black';
            } else {
                btn.innerHTML = '<i class="fa-solid fa-eye-slash"></i> Sínteses Ocultadas e Protegidas!';
                btn.style.background = '#555';
                btn.style.color = 'white';
            }

            // Restaura o botão ao estado normal após 3 segundos
            setTimeout(() => {
                btn.innerHTML = txtOriginal;
                btn.style.background = '#b82bf2';
                btn.style.color = 'white';
                btn.disabled = false;
            }, 3500);

        } catch (err) {
            console.error("Erro ao publicar sínteses:", err);
            btn.innerHTML = 'Erro na publicação!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // =========================================================================
    // GAMIFICAÇÃO & OCORRÊNCIAS
    // =========================================================================

    // MUDAR TIPO DE OCORRÊNCIA (Positiva vs Negativa)
    if (e.target.closest('#btn-oco-pos') || e.target.closest('#btn-oco-neg')) {
        const isPos = e.target.closest('#btn-oco-pos') !== null;

        document.getElementById('btn-oco-pos').style.background = isPos ? 'rgba(16,185,129,0.1)' : 'transparent';
        document.getElementById('btn-oco-pos').style.borderColor = isPos ? 'var(--success-green)' : '#333';
        document.getElementById('btn-oco-pos').style.color = isPos ? 'var(--success-green)' : 'var(--text-muted)';

        document.getElementById('btn-oco-neg').style.background = !isPos ? 'rgba(239,68,68,0.1)' : 'transparent';
        document.getElementById('btn-oco-neg').style.borderColor = !isPos ? 'var(--danger-red)' : '#333';
        document.getElementById('btn-oco-neg').style.color = !isPos ? 'var(--danger-red)' : 'var(--text-muted)';

        document.getElementById('oco-tipo-hidden').value = isPos ? 'positiva' : 'negativa';
        document.getElementById('area-skills-xp').style.display = isPos ? 'block' : 'none';

        // Mudar o aspeto para ajudar o professor
        document.getElementById('oco-titulo-registo').placeholder = isPos ? "Ex: Participação brilhante" : "Ex: Interrupção constante";
        document.getElementById('oco-titulo-registo').style.borderColor = isPos ? "var(--success-green)" : "var(--danger-red)";

        const btnGravar = document.getElementById('btn-gravar-ocorrencia');
        btnGravar.style.background = isPos ? "var(--success-green)" : "var(--danger-red)";
        btnGravar.style.color = isPos ? "black" : "white";
        btnGravar.innerHTML = isPos ? '<i class="fa-solid fa-bolt"></i> Gravar Registo & Atribuir XP' : '<i class="fa-solid fa-triangle-exclamation"></i> Registar Falta Disciplinar';
        return;
    }

    // ESCOLHER A COMPETÊNCIA (SKILL)
    if (e.target.closest('.btn-skill-oco')) {
        const btn = e.target.closest('.btn-skill-oco');

        // Reset a todas as caixas
        document.querySelectorAll('.btn-skill-oco').forEach(b => {
            b.style.background = 'transparent';
            b.style.borderColor = '#333';
            b.style.color = 'var(--text-muted)';
        });

        // Aplica a cor certa à competência escolhida
        const skill = btn.getAttribute('data-skill');
        if (skill === 'comunicacao') { btn.style.borderColor = '#0ea5e9'; btn.style.color = '#0ea5e9'; btn.style.background = 'rgba(14,165,233,0.1)'; }
        if (skill === 'criatividade') { btn.style.borderColor = '#8b5cf6'; btn.style.color = '#8b5cf6'; btn.style.background = 'rgba(139,92,246,0.1)'; }
        if (skill === 'lideranca') { btn.style.borderColor = '#f97316'; btn.style.color = '#f97316'; btn.style.background = 'rgba(249,115,22,0.1)'; }
        if (skill === 'organizacao') { btn.style.borderColor = '#10b981'; btn.style.color = '#10b981'; btn.style.background = 'rgba(16,185,129,0.1)'; }

        document.getElementById('oco-skill-hidden').value = skill;
        return;
    }

    // ABRIR MODAL (A PARTIR DO PERFIL 360º)
    if (e.target.closest('#btn-abrir-ocorrencia-360')) {
        const alunoId = document.getElementById('perfil-aluno-id-hidden').value;
        const alunoNome = document.getElementById('p-aluno-nome').innerText;
        if (!alunoId) return;

        // Limpar o formulário todo
        document.getElementById('oco-titulo-registo').value = '';
        document.getElementById('oco-motivo').value = '';
        document.getElementById('oco-notificar-ee').checked = true;

        // Força a voltar ao modo Positivo (+XP) por defeito!
        const btnPos = document.getElementById('btn-oco-pos');
        if (btnPos) btnPos.click();

        document.getElementById('oco-titulo').innerText = `Avaliar: ${alunoNome}`;
        document.getElementById('modal-ocorrencia').style.display = 'flex';
        return;
    }

    // GRAVAR A OCORRÊNCIA NA BASE DE DADOS E APLICAR XP
    if (e.target.closest('#btn-gravar-ocorrencia')) {
        const btn = e.target.closest('#btn-gravar-ocorrencia');
        const alunoId = document.getElementById('perfil-aluno-id-hidden').value;
        const titulo = document.getElementById('oco-titulo-registo').value.trim();
        const motivo = document.getElementById('oco-motivo').value.trim();
        const notificarEE = document.getElementById('oco-notificar-ee').checked;

        const tipoOco = document.getElementById('oco-tipo-hidden').value;
        const skill = document.getElementById('oco-skill-hidden').value;

        const turma = state.selectedTurma;
        const disciplina = state.disciplinasProfessor[0] || "Geral";

        if (!titulo || !motivo) { alert("Preenche o título e a descrição do registo."); return; }

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A calcular...';
        btn.disabled = true;

        try {
            // A MAGIA DO XP: Se for positivo ganha 50 pontos. Se for negativo perde 20.
            const xpGanho = tipoOco === 'positiva' ? 50 : -20;

            // 1. Grava no Histórico do Aluno (Para a App do Pai ler a cronologia)
            await addDoc(collection(db, "utilizadores", alunoId, "ocorrencias"), {
                turma: turma,
                disciplina: disciplina,
                titulo: titulo,
                descricao: motivo,
                tipo: tipoOco, // 'positiva' ou 'negativa'
                skill: tipoOco === 'positiva' ? skill : null,
                xp: xpGanho,
                data: new Date().toISOString(),
                autor: state.myUserName,
                notificarEE: notificarEE,
                lidaEE: false
            });

            // 2. Vai ao documento PRINCIPAL do aluno injetar os pontos nos gráficos de radar!
            const alunoRef = doc(db, "utilizadores", alunoId);
            const alunoSnap = await getDoc(alunoRef);

            if (alunoSnap.exists()) {
                const aData = alunoSnap.data();
                const xpAtualGlobal = aData.xp || 0;

                // O XP nunca pode ser menor que Zero
                const updates = { xp: Math.max(0, xpAtualGlobal + xpGanho) };

                // Atualiza o ramo específico para os gráficos do E.E.
                if (tipoOco === 'positiva') {
                    const campoSkill = `xp_${skill}`; // ex: 'xp_lideranca'
                    const xpSkillAtual = aData[campoSkill] || 0;
                    updates[campoSkill] = xpSkillAtual + xpGanho;
                }

                await setDoc(alunoRef, updates, { merge: true });
            }

            // 3. Regista no Livro de Ponto do Professor
            if (window.registarAtividadeProfessor) {
                const acao = tipoOco === 'positiva' ? `Atribuiu +50 XP (${skill}) a um aluno` : `Registou ocorrência negativa (-20 XP)`;
                await window.registarAtividadeProfessor('ocorrencia', acao, `Turma ${turma}`);
            }

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Registado!';
            setTimeout(() => {
                btn.innerHTML = txtOriginal;
                btn.disabled = false;
                document.getElementById('modal-ocorrencia').style.display = 'none';
            }, 1500);

        } catch (err) {
            console.error("Erro ao gravar registo:", err);
            btn.innerHTML = 'Erro ao gravar!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
        return;
    }

    // LANÇAR MISSÃO PARA A TURMA
    if (e.target.closest('#btn-prof-lancar-missao')) {
        const btn = e.target.closest('#btn-prof-lancar-missao');
        const titulo = document.getElementById('prof-missao-titulo').value.trim();
        const desc = document.getElementById('prof-missao-desc').value.trim();
        const xp = parseInt(document.getElementById('prof-missao-xp').value) || 100;
        const prazo = document.getElementById('prof-missao-prazo').value; // Apanha a data
        const turma = state.selectedTurma;

        if (!turma) { alert("Seleciona uma turma primeiro."); return; }
        if (!titulo || !desc) { alert("Preenche o título e a descrição da missão."); return; }

        const btnOriginalText = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A lançar...';
        btn.disabled = true;

        try {
            await addDoc(collection(db, "turmas", turma, "missoes"), {
                titulo: titulo,
                descricao: desc,
                xpRecompensa: xp,
                dataLimite: prazo || null, // Guarda a data limite se houver
                status: 'ativa', // Nasce sempre ativa
                concluidoPor: [],
                dataCriacao: new Date().toISOString()
            });

            if (window.registarAtividadeProfessor) {
                await window.registarAtividadeProfessor('sintese', `Lançou a missão: ${titulo} (+${xp}XP)`, `Turma ${turma}`);
            }

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Missão Lançada!';
            document.getElementById('prof-missao-titulo').value = '';
            document.getElementById('prof-missao-desc').value = '';
            document.getElementById('prof-missao-prazo').value = ''; // Limpa a data

            if (window.carregarMissoesDaTurmaProf) window.carregarMissoesDaTurmaProf();

            setTimeout(() => {
                btn.innerHTML = btnOriginalText;
                btn.disabled = false;
            }, 2000);
        } catch (err) {
            console.error("Erro ao lançar missão:", err);
            btn.innerHTML = 'Erro ao lançar!';
            setTimeout(() => { btn.innerHTML = btnOriginalText; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ABRIR MODAL PARA VALIDAR MISSÃO (Ver lista de alunos)
    if (e.target.closest('.btn-abrir-validar-missao')) {
        const btn = e.target.closest('.btn-abrir-validar-missao');
        const missaoId = btn.getAttribute('data-id');
        document.getElementById('val-missao-id').value = missaoId;
        document.getElementById('val-missao-xp').value = btn.getAttribute('data-xp');
        document.getElementById('val-missao-titulo').innerText = btn.getAttribute('data-titulo');
        document.getElementById('val-missao-recompensa').innerText = `Recompensa: +${btn.getAttribute('data-xp')} XP`;

        const container = document.getElementById('lista-alunos-validar-missao');
        container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A cruzar dados da turma...</p>';
        document.getElementById('modal-validar-missao').style.display = 'flex';

        try {
            // 1. Vai buscar a missão para saber quem já concluiu
            const mSnap = await getDoc(doc(db, "turmas", state.selectedTurma, "missoes", missaoId));
            const concluidosArray = mSnap.exists() ? (mSnap.data().concluidoPor || []) : [];

            // 2. Vai buscar todos os alunos da turma
            const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", state.selectedTurma), where("papel", "==", "aluno")));
            let arr = []; cS.forEach(d => arr.push({ id: d.id, ...d.data() }));
            arr.sort((a, b) => a.nome.localeCompare(b.nome));

            let html = '';
            arr.forEach(d => {
                const jaConcluiu = concluidosArray.includes(d.id);
                if (jaConcluiu) {
                    html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(16,185,129,0.1); border:1px solid var(--success-green); border-radius:6px;">
                        <span style="color:var(--text-muted); font-size:0.9rem; text-decoration:line-through;">${nomeCurto(d.nome)}</span>
                        <span style="color:var(--success-green); font-size:0.8rem; font-weight:bold;"><i class="fa-solid fa-check-double"></i> Validado</span>
                    </div>`;
                } else {
                    html += `
                    <div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border:1px solid #333; border-radius:6px;">
                        <span style="color:white; font-size:0.9rem;">${nomeCurto(d.nome)}</span>
                        <button class="btn-dar-xp-missao primary-btn small-btn" data-aluno="${d.id}" style="background:#a855f7; border:none; color:white; font-size:0.8rem; padding: 6px 12px;"><i class="fa-solid fa-bolt"></i> Atribuir XP</button>
                    </div>`;
                }
            });
            container.innerHTML = html === '' ? '<p class="text-muted center">Sem alunos nesta turma.</p>' : html;
        } catch (err) {
            container.innerHTML = '<p class="text-danger center">Erro ao ler dados.</p>';
        }
        return;
    }

    // O PROFESSOR CLICA NO BOTÃO PARA DAR O XP AO ALUNO
    if (e.target.closest('.btn-dar-xp-missao')) {
        const btn = e.target.closest('.btn-dar-xp-missao');
        const alunoId = btn.getAttribute('data-aluno');
        const missaoId = document.getElementById('val-missao-id').value;
        const xpRecompensa = parseInt(document.getElementById('val-missao-xp').value) || 0;
        const tituloMissao = document.getElementById('val-missao-titulo').innerText;

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            // 1. Adiciona o aluno ao array de conclusões da Missão
            const mRef = doc(db, "turmas", state.selectedTurma, "missoes", missaoId);
            const mSnap = await getDoc(mRef);
            if (mSnap.exists()) {
                let concluidos = mSnap.data().concluidoPor || [];
                if (!concluidos.includes(alunoId)) {
                    concluidos.push(alunoId);
                    await setDoc(mRef, { concluidoPor: concluidos }, { merge: true });
                }
            }

            // 2. Injéta o XP diretamente no perfil do aluno
            const aRef = doc(db, "utilizadores", alunoId);
            const aSnap = await getDoc(aRef);
            if (aSnap.exists()) {
                const xpAtual = aSnap.data().xp || 0;
                await setDoc(aRef, { xp: xpAtual + xpRecompensa }, { merge: true });

                // Bónus: Atira uma notificação para o sino do aluno comemorar!
                await addDoc(collection(db, "utilizadores", alunoId, "ocorrencias"), {
                    turma: state.selectedTurma,
                    titulo: `Missão Concluída!`,
                    descricao: `O professor validou a missão: "${tituloMissao}"`,
                    tipo: 'positiva',
                    xp: xpRecompensa,
                    data: new Date().toISOString(),
                    autor: state.myUserName,
                    lidaAluno: false
                });
            }

            // 3. Atualiza o visual da linha para "verde" instantaneamente (sem reload)
            const row = btn.parentElement;
            row.style.background = 'rgba(16,185,129,0.1)';
            row.style.borderColor = 'var(--success-green)';
            row.innerHTML = `
                <span style="color:var(--text-muted); font-size:0.9rem; text-decoration:line-through;">${aSnap.exists() ? nomeCurto(aSnap.data().nome) : 'Aluno'}</span>
                <span style="color:var(--success-green); font-size:0.8rem; font-weight:bold;"><i class="fa-solid fa-check-double"></i> Validado</span>
            `;

        } catch (err) {
            console.error("Erro ao dar XP:", err);
            btn.innerHTML = 'Erro!';
            setTimeout(() => { btn.innerHTML = 'Atribuir XP'; btn.disabled = false; }, 2000);
        }
        return;
    }

    // ENCERRAR MISSÃO MANUALMENTE
    if (e.target.closest('.btn-encerrar-missao')) {
        const btn = e.target.closest('.btn-encerrar-missao');
        const missaoId = btn.getAttribute('data-id');

        if (!confirm("Tens a certeza que queres encerrar esta missão? Ela desaparecerá do painel dos alunos que ainda não a completaram.")) return;

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            await setDoc(doc(db, "turmas", state.selectedTurma, "missoes", missaoId), {
                status: 'encerrada'
            }, { merge: true });

            if (window.carregarMissoesDaTurmaProf) window.carregarMissoesDaTurmaProf();
        } catch (err) {
            console.error(err);
            btn.innerHTML = 'Erro!';
            setTimeout(() => { btn.disabled = false; }, 2000);
        }
        return;
    }

    // 1. ABRIR MODAL E CARREGAR ATESTADOS PENDENTES OU FORÇAR JUSTIFICAÇÃO
    if (e.target.closest('#btn-justificar-faltas')) {
        const alunoId = document.getElementById('perfil-aluno-id-hidden').value;
        const nomeAluno = document.getElementById('p-aluno-nome').innerText;
        if (!alunoId) return;

        // Se o DT quiser forçar a justificação manual (Papel escrito, Reunião presencial, etc)
        const forcar = confirm(`Queres abrir os Comprovativos Digitais enviados pelo E.E. ou Justificar Manualmente as Faltas deste aluno? \n\n[OK] = Ver Atestados Digitais\n[Cancelar] = Justificação Manual / Papel`);

        if (!forcar) {
            // Caminho de Justificação Forçada Manual (O DT justificou com um papel na mão)
            const motivoManual = prompt(`A justificar faltas de ${nomeAluno}.\nIndica o motivo da justificação (Ex: "Atestado Médico Entregue em Papel"):`);

            if (motivoManual) {
                const btnPrincipal = document.getElementById('btn-justificar-faltas');
                const txtOriginalBtn = btnPrincipal.innerHTML;
                btnPrincipal.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar justificação...';

                try {
                    // Vai buscar todas as faltas injustificadas
                    const qFaltas = query(collection(db, "utilizadores", alunoId, "faltas"), where("justificada", "==", false));
                    const faltasSnap = await getDocs(qFaltas);

                    if (faltasSnap.empty) {
                        alert(`O aluno ${nomeAluno} não tem faltas injustificadas no sistema.`);
                        btnPrincipal.innerHTML = txtOriginalBtn;
                        return;
                    }

                    const gravacoesFaltas = [];
                    faltasSnap.forEach(fDoc => {
                        gravacoesFaltas.push(setDoc(doc(db, "utilizadores", alunoId, "faltas", fDoc.id), {
                            justificada: true,
                            justificadaEm: new Date().toISOString(),
                            justificadaPorDT: state.myUserName,
                            motivoPapel: motivoManual
                        }, { merge: true }));
                    });

                    await Promise.all(gravacoesFaltas);

                    if (window.registarAtividadeProfessor) {
                        await window.registarAtividadeProfessor('falta', `Forçou a justificação de ${gravacoesFaltas.length} falta(s) a ${nomeAluno}.`, `Motivo: ${motivoManual}`);
                    }

                    alert(`Sucesso! ${gravacoesFaltas.length} faltas injustificadas de ${nomeAluno} foram dadas como justificadas.`);

                    // Se o modal do Perfil 360 do Aluno estiver aberto, fechamo-lo para dar a sensação de refresh
                    const btnFecharPerfil = document.querySelector('#modal-perfil-aluno .fechar-modal');
                    if (btnFecharPerfil) btnFecharPerfil.click();

                    btnPrincipal.innerHTML = txtOriginalBtn;
                } catch (e) {
                    console.error("Erro ao justificar faltas manualmente:", e);
                    alert("Erro ao tentar justificar as faltas manualmente.");
                    btnPrincipal.innerHTML = txtOriginalBtn;
                }
                return;
            } else {
                return; // Cancelou o prompt
            }
        }

        // --- DAQUI PARA BAIXO É O CÓDIGO ORIGINAL QUE JÁ TINHAS (O Caminho Normal dos Atestados) ---
        const btnPrincipal = document.getElementById('btn-justificar-faltas');
        const modal = document.getElementById('modal-justificar-faltas');
        const container = document.getElementById('lista-atestados-pendentes');

        if (!modal) return;
        modal.style.display = 'flex';
        container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A ler base de dados...</p>';

        try {
            // Vai à gaveta dos atestados procurar os que estão pendentes
            const qAtestados = query(collection(db, "utilizadores", alunoId, "atestados"), where("status", "==", "pendente"));
            const snap = await getDocs(qAtestados);

            // CORREÇÃO 2: ATUALIZA O BOTÃO EXTERIOR NA HORA (Limpa o aviso se já tiveres validado tudo!)
            if (btnPrincipal) {
                if (snap.empty) {
                    btnPrincipal.innerHTML = `<i class="fa-solid fa-file-signature"></i> Histórico de Comprovativos`;
                    btnPrincipal.style.background = 'var(--warning-yellow)';
                    btnPrincipal.style.color = 'black';
                    btnPrincipal.style.borderColor = 'var(--warning-yellow)';
                } else {
                    btnPrincipal.innerHTML = `<i class="fa-solid fa-bell fa-shake"></i> Analisar Comprovativos (${snap.size} pendente(s))`;
                    btnPrincipal.style.background = 'var(--danger-red)';
                    btnPrincipal.style.color = 'white';
                    btnPrincipal.style.borderColor = 'var(--danger-red)';
                }
            }

            if (snap.empty) {
                container.innerHTML = '<div style="text-align:center; padding: 30px 10px;"><i class="fa-solid fa-clipboard-check" style="font-size:3rem; color:var(--success-green); margin-bottom:10px;"></i><p style="color:var(--text-muted); font-size:0.9rem;">Tudo em dia! Não há comprovativos pendentes para análise.</p></div>';
                return;
            }

            let html = '';
            // CORREÇÃO 1: Fazer o cruzamento de dados para mostrar os dias/horas das faltas ao DT
            for (const docSnap of snap.docs) {
                const atestado = docSnap.data();
                const docId = docSnap.id;
                const dataEnvio = new Date(atestado.dataEnvio).toLocaleDateString('pt-PT', { day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit' });
                const obs = atestado.observacoes || 'Sem observações adicionais.';
                const anexo = atestado.ficheiroBase64;

                let extensao = 'pdf';
                if (anexo && anexo.startsWith('data:image/png')) extensao = 'png';
                else if (anexo && anexo.startsWith('data:image/jpeg')) extensao = 'jpg';

                const nomeFicheiro = `comprovativo_${alunoId}_${docId}.${extensao}`;

                // --- MAGIA: IR BUSCAR OS DETALHES EXATOS DAS FALTAS SELECIONADAS ---
                let detalhesFaltas = "";
                if (atestado.faltasAssociadas && atestado.faltasAssociadas.length > 0) {
                    detalhesFaltas = `<ul style="margin: 5px 0 0 20px; padding: 0; color: var(--warning-yellow); font-size: 0.85rem; line-height: 1.4;">`;
                    for (const fId of atestado.faltasAssociadas) {
                        const fSnap = await getDoc(doc(db, "utilizadores", alunoId, "faltas", fId));
                        if (fSnap.exists()) {
                            const fData = fSnap.data();
                            const dataFormatada = fData.dataFalta || new Date(fData.dataRegisto).toLocaleDateString('pt-PT');
                            detalhesFaltas += `<li><strong>${fData.disciplina}</strong> - Dia ${dataFormatada} (${fData.duracaoBlocos || fData.horas || 2} tempos)</li>`;
                        }
                    }
                    detalhesFaltas += `</ul>`;
                } else {
                    detalhesFaltas = `<span style="color:var(--danger-red); font-size: 0.8rem;"><br>(Aviso: Atestado genérico. Ao aceitar, justificará TODAS as faltas pendentes)</span>`;
                }
                // -------------------------------------------------------------

                // Constrói o "Card" do atestado para o Diretor de Turma
                html += `
                <div class="card" style="border-left: 4px solid var(--warning-yellow); margin-bottom: 0; background: rgba(0,0,0,0.2);">
                    <div style="display:flex; justify-content:space-between; margin-bottom: 10px;">
                        <strong style="color:var(--text-light); font-size:0.9rem;"><i class="fa-regular fa-clock"></i> Enviado a ${dataEnvio}</strong>
                    </div>
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom: 10px;"><strong>Motivo do E.E:</strong> ${obs}</p>
                    
                    <div style="font-size:0.85rem; color:white; margin-bottom: 15px; border-top: 1px dashed #444; padding-top: 10px;">
                        <strong>Faltas a Justificar:</strong>
                        ${detalhesFaltas}
                    </div>
                    
                    <!-- PRÉ-VISUALIZAÇÃO DO DOCUMENTO -->
                    <div style="margin-bottom: 10px; border-radius: 8px; border: 1px solid #444; background:#111; overflow:hidden;">
                        ${anexo && anexo.startsWith('data:image')
                        ? `<img src="${anexo}" style="width:100%; max-height:200px; object-fit:contain; display:block;">`
                        : `<div style="padding:20px; text-align:center;"><i class="fa-solid fa-file-pdf" style="font-size:3rem; color:var(--primary-green); margin-bottom:10px;"></i><br><span style="color:white; font-size:0.9rem;">Documento PDF</span></div>`
                    }
                    </div>

                    <!-- BOTÃO DE DESCARREGAR PARA IMPRIMIR -->
                    <div style="margin-bottom: 15px;">
                        <a href="${anexo}" download="${nomeFicheiro}" style="display:block; text-align:center; padding:8px; background:rgba(255,255,255,0.1); color:white; text-decoration:none; border-radius:6px; font-size:0.85rem; border:1px solid #555; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.2)'" onmouseout="this.style.background='rgba(255,255,255,0.1)'">
                            <i class="fa-solid fa-download" style="margin-right: 5px;"></i> Descarregar Documento Original
                        </a>
                    </div>

                    <!-- BOTÕES DE DECISÃO -->
                    <div style="display:flex; gap: 10px;">
                        <button class="primary-btn btn-aprovar-atestado" data-id="${docId}" data-aluno="${alunoId}" style="flex:1; background:var(--success-green); border-color:var(--success-green); color:black;"><i class="fa-solid fa-check"></i> Aceitar</button>
                        <button class="secondary-btn btn-rejeitar-atestado" data-id="${docId}" data-aluno="${alunoId}" style="flex:1; border-color:var(--danger-red); color:var(--danger-red);"><i class="fa-solid fa-xmark"></i> Recusar</button>
                    </div>
                </div>`;
            }
            container.innerHTML = html;
        } catch (err) {
            console.error("Erro ao carregar atestados:", err);
            container.innerHTML = '<p class="text-danger center">Erro a ler documentos.</p>';
        }
        return;
    }

    // 2. APROVAR O ATESTADO E JUSTIFICAR APENAS AS FALTAS SELECIONADAS
    if (e.target.closest('.btn-aprovar-atestado')) {
        const btn = e.target.closest('.btn-aprovar-atestado');
        const atestadoId = btn.getAttribute('data-id');
        const alunoId = btn.getAttribute('data-aluno');

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            // A. Vai ler o documento do atestado para saber que faltas foram selecionadas
            const atestadoSnap = await getDoc(doc(db, "utilizadores", alunoId, "atestados", atestadoId));
            if (!atestadoSnap.exists()) throw new Error("Atestado não encontrado");
            const dadosAtestado = atestadoSnap.data();
            const faltasAlvo = dadosAtestado.faltasAssociadas || []; // Lê o Array gravado pelo Pai

            // B. Regista o atestado como "aceite"
            await setDoc(doc(db, "utilizadores", alunoId, "atestados", atestadoId), {
                status: "aceite",
                dataDecisao: new Date().toISOString(),
                dtAprovador: state.myUserName
            }, { merge: true });

            // C. Justifica APENAS as faltas que constam no Array!
            const gravacoesFaltas = [];
            if (faltasAlvo.length > 0) {
                faltasAlvo.forEach(faltaId => {
                    gravacoesFaltas.push(
                        setDoc(doc(db, "utilizadores", alunoId, "faltas", faltaId), {
                            justificada: true,
                            justificadaEm: new Date().toISOString()
                        }, { merge: true })
                    );
                });
            } else {
                // Sistema de Segurança (Fallback): Se o atestado for muito antigo e não tiver a lista de faltas, aprova todas as vermelhas como acontecia dantes.
                const qFaltas = query(collection(db, "utilizadores", alunoId, "faltas"), where("justificada", "==", false));
                const faltasSnap = await getDocs(qFaltas);
                faltasSnap.forEach(fDoc => {
                    gravacoesFaltas.push(setDoc(doc(db, "utilizadores", alunoId, "faltas", fDoc.id), { justificada: true, justificadaEm: new Date().toISOString() }, { merge: true }));
                });
            }

            await Promise.all(gravacoesFaltas);

            // D. Regista no log de Atividades do Professor
            if (window.registarAtividadeProfessor) {
                const qtd = faltasAlvo.length > 0 ? faltasAlvo.length : gravacoesFaltas.length;
                await window.registarAtividadeProfessor('falta', `Aprovou um atestado. ${qtd} falta(s) justificada(s).`, `Aluno ID: ${alunoId}`);
            }

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Aceite!';
            btn.style.background = '#059669';

            setTimeout(() => {
                document.getElementById('btn-justificar-faltas').click();
            }, 1000);

        } catch (err) {
            console.error("Erro ao aprovar atestado:", err);
            btn.innerHTML = 'Erro!';
            btn.disabled = false;
        }
        return;
    }

    // 3. REJEITAR O ATESTADO
    if (e.target.closest('.btn-rejeitar-atestado')) {
        const btn = e.target.closest('.btn-rejeitar-atestado');
        const atestadoId = btn.getAttribute('data-id');
        const alunoId = btn.getAttribute('data-aluno');

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            // Muda apenas o status para rejeitado, as faltas continuam vermelhas
            await setDoc(doc(db, "utilizadores", alunoId, "atestados", atestadoId), {
                status: "rejeitado",
                dataDecisao: new Date().toISOString(),
                dtAprovador: state.myUserName
            }, { merge: true });

            btn.innerHTML = '<i class="fa-solid fa-xmark"></i> Recusado';
            setTimeout(() => {
                document.getElementById('btn-justificar-faltas').click();
            }, 1000);

        } catch (err) {
            console.error("Erro ao rejeitar atestado:", err);
            btn.innerHTML = 'Erro!';
            btn.disabled = false;
        }
        return;
    }

    // ABRIR/FECHAR MENU FLUTUANTE (Ações Rápidas)
    if (e.target.closest('#btn-fab-global')) {
        const menu = document.getElementById('modal-fab-menu');
        if (menu) {
            menu.style.display = (menu.style.display === 'none' || menu.style.display === '') ? 'flex' : 'none';
        }
        return;
    }
}); // <-- FIM DO MOTOR DE CLIQUES

// ----------------------------------------------------
// 4. FUNÇÕES GERAIS / MOTOR DA PLANTA E MODAIS
// ----------------------------------------------------
window.mudarTurmaManualmente = function (caixaSelect) {
    const turma = caixaSelect.value;
    const painelTurma = document.getElementById('turma-ativa-container');

    if (turma) {
        state.selectedTurma = turma;
        if (painelTurma) painelTurma.style.display = 'block';
        analisarEAtualizarTurma(turma);
        if (window.carregarMissoesDaTurmaProf) window.carregarMissoesDaTurmaProf();
    } else {
        if (painelTurma) painelTurma.style.display = 'none';
        state.selectedTurma = null;
    }
};

// Dicionário Limpo com apenas as 3 Disposições
const dimensoesSalas = {
    'vertical': { cols: 3, linhas: 5, tipo: 'dupla' },     // 3 Filas duplas x 5 Linhas = 30 alunos
    'horizontal': { cols: 4, linhas: 4, tipo: 'dupla' },   // 4 Filas duplas x 4 Linhas = 32 alunos
    'cte': { cols: 5, linhas: 5, tipo: 'individual' }      // 5x5 Individual = 25 alunos
};

let lugarSelecionadoIndex = null;
let disposicaoAtualAlunos = {};

window.renderizarPlantaSala = function (salaId, lugaresOcupados = {}) {
    const config = dimensoesSalas[salaId] || dimensoesSalas['vertical'];
    const container = document.getElementById('grid-planta-sala');
    if (!container) return;

    disposicaoAtualAlunos = { ...lugaresOcupados };

    // Grelha
    if (config.tipo === 'dupla') {
        container.style.gridTemplateColumns = `repeat(${config.cols}, 1fr 1fr)`;
        container.style.columnGap = '20px'; // Corredor
    } else {
        container.style.gridTemplateColumns = `repeat(${config.cols}, 1fr)`;
        container.style.columnGap = '10px';
    }

    let html = '';
    const multiplicador = config.tipo === 'dupla' ? 2 : 1;
    const totalLugares = config.cols * multiplicador * config.linhas;

    for (let i = 1; i <= totalLugares; i++) {
        const alunoNome = disposicaoAtualAlunos[i] || `Lugar Vago`;
        const isVago = !disposicaoAtualAlunos[i];

        let estiloExtra = 'background: rgba(255,255,255,0.03); border-color: #444; color: var(--text-muted);';
        if (!isVago) {
            estiloExtra = 'background: rgba(0, 204, 136, 0.15); border-color: var(--primary-green); color: white;';
        }
        if (lugarSelecionadoIndex === i) {
            estiloExtra = 'background: rgba(245, 158, 11, 0.25); border-color: var(--warning-yellow); color: var(--warning-yellow); box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);';
        }

        let marginFix = '';
        if (config.tipo === 'dupla' && i % 2 !== 0) {
            marginFix = 'margin-right: -10px;'; // Junta a dupla
        }

        // min-width: 90px; garante que o nome do aluno tem espaço para respirar mesmo que o ecrã seja pequeno
        html += `
            <div class="carteira-lugar" data-pos="${i}" style="${estiloExtra} ${marginFix} min-width: 90px; border: 1px solid; height: 55px; border-radius: 6px; display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 4px; cursor: pointer; transition: 0.2s;">
                <span style="font-size: 0.6rem; opacity: 0.6;">#${i}</span>
                <span style="font-size: 0.75rem; text-align: center; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; width: 100%; font-weight: ${!isVago ? 'bold' : 'normal'};">${alunoNome}</span>
            </div>
        `;
    }
    container.innerHTML = html;
};

window.carregarAlunoNoMiniModal = function (linhaHTML) {
    if (!linhaHTML) return;
    const alunoId = linhaHTML.getAttribute('data-id');
    const btnAtribuir = linhaHTML.querySelector('.btn-abrir-escolha-nota');
    const alunoNome = btnAtribuir.getAttribute('data-nome');

    const inputId = document.getElementById('aluno-id-nota-atual');
    const labelNome = document.getElementById('nome-aluno-nota-atual');
    if (inputId) inputId.value = alunoId;
    if (labelNome) labelNome.innerText = alunoNome;

    document.querySelectorAll('.btn-nota-opcao').forEach(b => {
        b.classList.remove('active-nota');
        b.style.boxShadow = 'none';
        b.style.background = '';
    });

    const repContainer = document.getElementById('container-justificacao-rep');
    const motivoSelect = document.getElementById('motivo-rep-select');
    if (repContainer) repContainer.style.display = 'none';
    if (motivoSelect) motivoSelect.value = 'Falta de Plano';

    const notaAtual = linhaHTML.querySelector('.input-nota-aluno-hidden').value;
    if (notaAtual) {
        const btnOpt = document.querySelector(`.btn-nota-opcao[data-val="${notaAtual}"]`);
        if (btnOpt) {
            btnOpt.classList.add('active-nota');
            btnOpt.style.boxShadow = '0 0 10px rgba(255, 255, 255, 0.2)';
            btnOpt.style.background = 'rgba(255,255,255,0.1)';
            if (notaAtual === 'REP') {
                if (repContainer) repContainer.style.display = 'block';
                const motivoAtual = linhaHTML.querySelector('.input-motivo-aluno-hidden').value;
                if (motivoSelect && motivoAtual) motivoSelect.value = motivoAtual;
            }
        }
    }
};

// Variável global para evitar sobreposição de gráficos
let graficoAlunoInstance = null;

window.abrirPerfilCompletoAluno = async function (alunoId, alunoNome, alunoFoto) {
    const modal = document.getElementById('modal-perfil-aluno');
    if (!modal) return;

    // 1. Reset da Interface
    document.getElementById('p-aluno-nome').innerText = alunoNome;
    document.getElementById('p-aluno-foto').src = alunoFoto || 'logo_tur.png';
    document.getElementById('perfil-aluno-id-hidden').value = alunoId;
    document.getElementById('p-aluno-media').innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:0.8rem;"></i>';
    document.getElementById('badge-maai-aluno').innerHTML = '<span style="background:#333; color:var(--text-muted); padding:4px 8px; border-radius:4px; font-size:0.75rem;">A verificar...</span>';

    // Dispara logo o dropdown das sínteses para carregar o Momento 1 por defeito
    document.getElementById('sintese-momento').value = 'momento_1';
    document.getElementById('sintese-momento').dispatchEvent(new Event('change', { bubbles: true }));

    modal.style.display = 'flex';

    try {
        const disciplina = state.disciplinasProfessor[0]; // Assume a 1ª disciplina do prof

        // 2. Carregar Dados do Aluno (Corrigir Academia)
        const alunoSnap = await getDoc(doc(db, "utilizadores", alunoId));
        if (alunoSnap.exists()) {
            const data = alunoSnap.data();

            // LER A ACADEMIA DO ALUNO CORRETAMENTE
            if (data.academia) {
                document.getElementById('p-aluno-academia').innerText = `Academia ${data.academia}`;
                document.getElementById('p-aluno-academia').style.color = "var(--primary-green)";
            } else {
                document.getElementById('p-aluno-academia').innerText = "Sem Academia Associada";
                document.getElementById('p-aluno-academia').style.color = "var(--text-muted)";
            }
        }

        // 3. Carregar Notas da disciplina e Calcular Média
        const notasSnap = await getDocs(query(collection(db, "utilizadores", alunoId, "avaliacoes"), where("disciplina", "==", disciplina)));
        let soma = 0;
        let count = 0;
        let notasParaGrafico = [];

        notasSnap.forEach(d => {
            const val = d.data().nota;
            if (val !== 'REP' && !isNaN(val)) {
                soma += parseFloat(val);
                count++;
                notasParaGrafico.push({ modulo: d.data().modulo, nota: parseFloat(val) });
            }
        });

        // Ordenar módulos para o gráfico ficar lógico (M1, M2, M3...)
        notasParaGrafico.sort((a, b) => parseInt(a.modulo) - parseInt(b.modulo));

        // Aplica a Média
        if (count > 0) {
            document.getElementById('p-aluno-media').innerText = (soma / count).toFixed(1);
        } else {
            document.getElementById('p-aluno-media').innerText = '-';
        }

        // 4. Desenhar o Gráfico Blindado
        const ctx = document.getElementById('chartEvolucaoAluno');
        if (ctx) {
            if (graficoAlunoInstance) {
                graficoAlunoInstance.destroy(); // Destrói o anterior para não sobrepor nem causar bugs visuais
            }

            graficoAlunoInstance = new Chart(ctx, {
                type: 'line',
                data: {
                    labels: notasParaGrafico.map(n => `Mod ${n.modulo}`),
                    datasets: [{
                        label: 'Classificação (0-20)',
                        data: notasParaGrafico.map(n => n.nota),
                        borderColor: '#00cc88',
                        backgroundColor: 'rgba(0, 204, 136, 0.1)',
                        pointBackgroundColor: '#00cc88',
                        pointBorderColor: '#fff',
                        pointRadius: 5,
                        tension: 0.3,
                        fill: true
                    }]
                },
                options: {
                    responsive: true,
                    maintainAspectRatio: false,
                    plugins: { legend: { display: false } },
                    scales: {
                        y: {
                            beginAtZero: true,
                            max: 20,
                            grid: { color: 'rgba(255,255,255,0.05)' },
                            ticks: { color: 'rgba(255,255,255,0.5)' }
                        },
                        x: {
                            grid: { display: false },
                            ticks: { color: 'rgba(255,255,255,0.5)' }
                        }
                    }
                }
            });
        }

        // 5. Puxar faltas e PRHFs (Exemplo estático rápido, podes ligar à tua lógica real de contagem de faltas a seguir)
        document.getElementById('p-aluno-faltas').innerText = "12"; // Substitui depois pela query real de faltas
        document.getElementById('p-aluno-prhfs').innerText = "1";   // Substitui depois pela query real de PRHFs

        // ==========================================
        // MAGIA DO BOTÃO DE JUSTIFICAR FALTAS (DT)
        // ==========================================
        let btnJustificar = document.getElementById('btn-justificar-faltas');

        // Se o botão não existir no HTML, o JavaScript cria-o na hora!
        if (!btnJustificar) {
            btnJustificar = document.createElement('button');
            btnJustificar.id = 'btn-justificar-faltas';
            btnJustificar.className = 'primary-btn';
            btnJustificar.style.width = '100%';
            btnJustificar.style.marginBottom = '15px';

            // Coloca o botão perfeitamente acima da caixa das Sínteses
            const areaSintese = document.getElementById('area-sintese-prof');
            if (areaSintese) {
                areaSintese.parentNode.insertBefore(btnJustificar, areaSintese);
            }
        }

        // Esconde o botão por defeito para os Professores
        btnJustificar.style.display = 'none';

        // Se o utilizador tiver a capa de Diretor de Turma vestida:
        if (state.activeRole === 'diretor_turma') {
            btnJustificar.style.display = 'block';
            btnJustificar.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> A verificar comprovativos...`;
            btnJustificar.style.background = 'var(--bg-dark)';
            btnJustificar.style.color = 'white';

            // Vai à base de dados ver se o Pai enviou documentos novos
            const qAtestados = query(collection(db, "utilizadores", alunoId, "atestados"), where("status", "==", "pendente"));
            const snapAtestados = await getDocs(qAtestados);

            if (!snapAtestados.empty) {
                // Há documentos novos! Fica VERMELHO a piscar.
                btnJustificar.innerHTML = `<i class="fa-solid fa-bell fa-shake"></i> Analisar Comprovativos (${snapAtestados.size} novo!)`;
                btnJustificar.style.background = 'var(--danger-red)';
                btnJustificar.style.color = 'white';
            } else {
                // Está tudo em dia! Fica AMARELO pacífico.
                btnJustificar.innerHTML = `<i class="fa-solid fa-file-signature"></i> Histórico de Comprovativos`;
                btnJustificar.style.background = 'var(--warning-yellow)';
                btnJustificar.style.color = 'black';
            }
        }

    } catch (err) {
        console.error("Erro ao carregar perfil:", err);
    }
};

window.carregarAlunoNoMiniModalSintese = function (linhaHTML) {
    if (!linhaHTML) return;
    const alunoId = linhaHTML.getAttribute('data-id');
    const alunoNome = linhaHTML.querySelector('.nome-aluno-span').innerText;

    document.getElementById('sintese-aluno-id-atual').value = alunoId;
    document.getElementById('nome-aluno-sintese-atual').innerText = alunoNome;

    // Reset Visual das 12 Escalas
    estadoEscalasAluno = {}; // Limpa as opções guardadas
    
    // Volta a desenhar o Assistente do zero, começando pelo Passo 1
    if (window.renderizarDimensoesQualitativas) {
        window.renderizarDimensoesQualitativas();
    }

    // Verifica se já tinha texto escondido no card e carrega
    const txtGuardado = linhaHTML.querySelector('.input-sintese-hidden').value;
    document.getElementById('texto-sintese-final').value = txtGuardado || "";
};

// =========================================================================
// OBSERVADOR GLOBAL: Injeta o botão do DT sempre que o perfil abrir!
// =========================================================================
const modalPerfilGlobal = document.getElementById('modal-perfil-aluno');
if (modalPerfilGlobal) {
    const observer = new MutationObserver((mutations) => {
        mutations.forEach((mutation) => {
            // Deteta se o modal acabou de ficar visível (display: flex)
            if (mutation.attributeName === 'style' && modalPerfilGlobal.style.display === 'flex') {

                // Dá um pequeno atraso (200ms) para garantir que o ui.js acabou de preencher os dados do aluno
                setTimeout(async () => {
                    const btnJustificar = document.getElementById('btn-justificar-faltas');
                    const alunoId = document.getElementById('perfil-aluno-id-hidden').value;

                    if (btnJustificar && alunoId) {
                        const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);

                        if (isDT) {
                            btnJustificar.style.display = 'block';
                            btnJustificar.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> A verificar atestados...`;

                            try {
                                // Espreita a base de dados em tempo real
                                const qAtestados = query(collection(db, "utilizadores", alunoId, "atestados"), where("status", "==", "pendente"));
                                const snapAtestados = await getDocs(qAtestados);

                                if (!snapAtestados.empty) {
                                    // Atestados Novos! Fica Vermelho e a tremer
                                    btnJustificar.innerHTML = `<i class="fa-solid fa-bell fa-shake"></i> Analisar Comprovativos (${snapAtestados.size} novo!)`;
                                    btnJustificar.style.background = 'var(--danger-red)';
                                    btnJustificar.style.color = 'white';
                                    btnJustificar.style.borderColor = 'var(--danger-red)';
                                } else {
                                    // Tudo lido! Fica Amarelo normal
                                    btnJustificar.innerHTML = `<i class="fa-solid fa-file-signature"></i> Histórico de Comprovativos`;
                                    btnJustificar.style.background = 'var(--warning-yellow)';
                                    btnJustificar.style.color = 'black';
                                    btnJustificar.style.borderColor = 'var(--warning-yellow)';
                                }
                            } catch (e) {
                                btnJustificar.innerHTML = `<i class="fa-solid fa-file-signature"></i> Comprovativos`;
                            }
                        } else {
                            // Se for só o professor da disciplina, esconde o botão
                            btnJustificar.style.display = 'none';
                        }
                    }
                }, 200);
            }
        });
    });
    // Inicia a vigilância ao Modal
    observer.observe(modalPerfilGlobal, { attributes: true });
}

window.carregarMissoesDaTurmaProf = async function () {
    const container = document.getElementById('lista-missoes-prof');
    if (!container || !state.selectedTurma) return;

    container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar missões...</p>';
    try {
        const snap = await getDocs(collection(db, "turmas", state.selectedTurma, "missoes"));
        let html = '';
        const hoje = new Date().toISOString().split('T')[0];

        snap.forEach(d => {
            const m = d.data();
            if (m.status === 'encerrada') return; // Oculta as que já foram encerradas pelo professor

            // Verifica se a missão já passou do prazo
            const expirou = m.dataLimite && hoje > m.dataLimite;
            let statusText = '';
            let borderColor = '#a855f7';

            // O professor ainda as vê como vermelhas para poder validar quem entregou atrasado
            if (expirou) {
                statusText = `<span style="color:var(--danger-red); font-size:0.75rem;"><i class="fa-solid fa-clock"></i> Expirada (${m.dataLimite.split('-').reverse().join('/')})</span>`;
                borderColor = 'var(--danger-red)';
            } else if (m.dataLimite) {
                statusText = `<span style="color:var(--warning-yellow); font-size:0.75rem;"><i class="fa-solid fa-hourglass-half"></i> Limite: ${m.dataLimite.split('-').reverse().join('/')}</span>`;
            } else {
                statusText = `<span style="color:var(--text-muted); font-size:0.75rem;"><i class="fa-solid fa-infinity"></i> Sem prazo</span>`;
            }

            html += `
            <div style="background: rgba(0,0,0,0.2); border-left: 4px solid ${borderColor}; border-radius: 8px; padding: 12px; margin-bottom: 10px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px;">
                    <div>
                        <strong style="color: white; display: block; font-size: 1rem;">${m.titulo}</strong>
                        <span style="color: var(--warning-yellow); font-size: 0.8rem; font-weight: bold; margin-right: 10px;"><i class="fa-solid fa-bolt"></i> +${m.xpRecompensa} XP</span>
                        ${statusText}
                    </div>
                </div>
                <div style="display: flex; gap: 8px; justify-content: flex-end;">
                    <button class="secondary-btn btn-encerrar-missao small-btn" data-id="${d.id}" style="border-color: var(--danger-red); color: var(--danger-red); padding: 5px 10px;"><i class="fa-solid fa-ban"></i> Encerrar</button>
                    <button class="primary-btn btn-abrir-validar-missao small-btn" data-id="${d.id}" data-titulo="${m.titulo}" data-xp="${m.xpRecompensa}" style="background: ${borderColor}; color: white; border:none; padding: 5px 10px;"><i class="fa-solid fa-check-double"></i> Validar Entrega</button>
                </div>
            </div>`;
        });
        container.innerHTML = html === '' ? '<p class="text-muted center" style="font-size:0.85rem; padding: 15px; background: rgba(0,0,0,0.1); border-radius: 8px;">Nenhuma missão ativa neste momento.</p>' : html;
    } catch (e) {
        container.innerHTML = '<p class="text-danger center">Erro a carregar missões.</p>';
    }
};

// ==========================================
// MENSAGEM DIRETA DO ORIENTADOR PARA O ALUNO
// ==========================================
window.abrirChatDiretoAluno = async function (alunoId, alunoNome) {
    const chatId = `chat_pap_${alunoId}`;
    const chatNome = `PAP: ${alunoNome}`;

    try {
        // Importamos APENAS o onSnapshot, porque o resto já está importado no topo do teu ficheiro!
        const { onSnapshot } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        const chatRef = doc(db, "forums", chatId);
        const chatSnap = await getDoc(chatRef);

        // Se não existir, cria o chat
        if (!chatSnap.exists()) {
            await setDoc(chatRef, {
                nome: `Orientação PAP - ${alunoNome}`,
                isGlobal: false,
                criador: alunoId,
                participantes: [alunoId, state.myUserId],
                dataCriacao: Date.now(),
                lastMessage: null,
                unread: {},
                type: 'pap'
            });
        }

        // 1. Pula para a aba do fórum
        const abaForum = document.querySelector('.nav-item[data-target="view-prof-forum"]');
        if (abaForum) abaForum.click();

        // 2. Configura a janela do chat MANUALMENTE no ecrã
        setTimeout(() => {
            const btnCreate = document.getElementById('btn-create-chat-prof');
            const channelList = document.getElementById('prof-forum-channel-list');
            if (btnCreate) btnCreate.style.display = 'none';
            if (channelList) channelList.style.display = 'none';

            const chatView = document.getElementById('prof-forum-chat-view');
            if (chatView) chatView.style.display = 'flex';

            const chatTitle = document.getElementById('prof-chat-active-title');
            if (chatTitle) chatTitle.innerText = chatNome;

            state.activeChatId = chatId;
            state.activeChatType = 'pap';

            const msgContainer = document.getElementById('prof-chat-messages-container');
            if (!msgContainer) return;

            msgContainer.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar mensagens...</p>';

            if (state.chatUnsubscribe) { state.chatUnsubscribe(); }

            // 3. LÊ AS MENSAGENS EM TEMPO REAL E DESENHA-AS (COM BLINDAGEM ANTI-UNDEFINED)
            const q = query(collection(db, "forums", chatId, "mensagens"), orderBy("timestamp", "asc"));
            state.chatUnsubscribe = onSnapshot(q, (snapshot) => {
                if (snapshot.empty) {
                    msgContainer.innerHTML = '<p class="text-muted center" style="margin-top:20px;">Ainda não há mensagens. Envia a primeira!</p>';
                    return;
                }

                let html = '';
                snapshot.forEach(docSnap => {
                    const msg = docSnap.data();

                    // BLINDAGEM: Lê as propriedades venham elas com que nome vierem!
                    const textoMsg = msg.texto || msg.mensagem || msg.text || msg.message || '[Mensagem vazia]';
                    const autorMsg = msg.remetente || msg.autor || msg.sender || msg.nome || 'Aluno';
                    const timestampMsg = msg.timestamp || msg.dataCriacao || Date.now();

                    const isMe = (autorMsg === state.myUserName);
                    const align = isMe ? 'flex-end' : 'flex-start';
                    const bg = isMe ? 'var(--primary-green)' : '#333';
                    const color = isMe ? 'black' : 'white';

                    let time = '';
                    try { time = new Date(timestampMsg).toLocaleTimeString('pt-PT', { hour: '2-digit', minute: '2-digit' }); }
                    catch (e) { time = 'Agora'; }

                    html += `
                    <div style="display:flex; flex-direction:column; align-items:${align}; margin-bottom:15px; width:100%;">
                        <span style="font-size:0.7rem; color:var(--text-muted); margin-bottom:3px;">${autorMsg} • ${time}</span>
                        <div style="background:${bg}; color:${color}; padding:10px 15px; border-radius:12px; max-width:85%; word-wrap:break-word;">
                            ${textoMsg}
                        </div>
                    </div>`;
                });
                msgContainer.innerHTML = html;

                setTimeout(() => { msgContainer.scrollTop = msgContainer.scrollHeight; }, 100);
            });
        }, 150);

    } catch (e) {
        alert("Erro ao iniciar a conversa.");
        console.error(e);
    }
};

// ==========================================
// FEEDBACK VISUAL DOS FICHEIROS E RESET
// ==========================================

// 1. Muda a cor para verde quando se escolhe um ficheiro (MATERIAL E PRHF)
document.addEventListener('change', function(e) {
    // Para o modal de Material/Sumário
    if (e.target && e.target.id === 'mat-file') {
        const fileInput = e.target;
        const uploadArea = document.getElementById('mat-upload-area');
        
        if (fileInput.files.length > 0) {
            const fileName = fileInput.files[0].name;
            uploadArea.innerHTML = `
                <i class="fa-solid fa-file-circle-check" style="font-size:1.5rem; color:var(--success-green); margin-bottom:10px;"></i>
                <h4 style="color:var(--success-green); margin-bottom:5px; font-size:0.85rem;">${fileName}</h4>
                <p style="font-size:0.7rem; color:var(--text-muted); margin:0;">Clica para alterar</p>
            `;
            uploadArea.style.borderColor = 'var(--success-green)';
            uploadArea.style.background = 'rgba(16, 185, 129, 0.05)';
        } else {
            uploadArea.innerHTML = `
                <i class="fa-solid fa-paperclip" style="font-size:1.5rem; color:#0099ff; margin-bottom:10px;"></i>
                <h4 style="color:white; margin-bottom:5px; font-size:0.85rem;">Anexar Ficha (Opcional)</h4>
            `;
            uploadArea.style.borderColor = '#0099ff';
            uploadArea.style.background = 'rgba(0,153,255,0.05)';
        }
    }

    // Para o modal de Criação de PRHF
    if (e.target && e.target.id === 'prhf-file') {
        const fileInput = e.target;
        const uploadArea = document.getElementById('prhf-upload-area');
        
        if (fileInput.files.length > 0) {
            const fileName = fileInput.files[0].name;
            uploadArea.innerHTML = `
                <i class="fa-solid fa-file-circle-check" style="font-size:1.5rem; color:var(--success-green); margin-bottom:5px;"></i>
                <h4 style="color:var(--success-green); margin-bottom:5px; font-size:0.9rem;">${fileName}</h4>
                <span id="prhf-file-name" style="font-size:0.75rem; color:var(--text-muted);">Clica para alterar</span>
            `;
            uploadArea.style.borderColor = 'var(--success-green)';
            uploadArea.style.background = 'rgba(16, 185, 129, 0.05)';
            
            // Lê o ficheiro e guarda na variável de estado para enviar para o Firebase
            const reader = new FileReader();
            reader.onload = function(e) {
                state.prhfBase64 = e.target.result;
            };
            reader.readAsDataURL(fileInput.files[0]);
        } else {
            uploadArea.innerHTML = `
                <i class="fa-solid fa-paperclip" style="font-size:1.5rem; color:var(--danger-red); margin-bottom:5px;"></i>
                <h4 style="color:white; margin-bottom:5px; font-size:0.9rem;">Anexar Ficha / Teste</h4>
                <span id="prhf-file-name" style="font-size:0.75rem; color:var(--text-muted);">Toca para PDF ou Imagem</span>
            `;
            uploadArea.style.borderColor = 'var(--danger-red)';
            uploadArea.style.background = 'rgba(239,68,68,0.05)';
            state.prhfBase64 = null;
        }
    }
});

// 2. Faz o "Reset" do formulário sempre que clicas no X de um modal
document.addEventListener('click', function(e) {
    if (e.target.closest('.fechar-modal')) {
        // Reset do Material
        const uploadAreaMat = document.getElementById('mat-upload-area');
        if(uploadAreaMat) {
            uploadAreaMat.innerHTML = `
                <i class="fa-solid fa-paperclip" style="font-size:1.5rem; color:#0099ff; margin-bottom:10px;"></i>
                <h4 style="color:white; margin-bottom:5px; font-size:0.85rem;">Anexar Ficha (Opcional)</h4>
            `;
            uploadAreaMat.style.borderColor = '#0099ff';
            uploadAreaMat.style.background = 'rgba(0,153,255,0.05)';
            const matFile = document.getElementById('mat-file');
            if (matFile) matFile.value = ""; 
        }

        // Reset do PRHF
        const uploadAreaPrhf = document.getElementById('prhf-upload-area');
        if(uploadAreaPrhf) {
            uploadAreaPrhf.innerHTML = `
                <i class="fa-solid fa-paperclip" style="font-size:1.5rem; color:var(--danger-red); margin-bottom:5px;"></i>
                <h4 style="color:white; margin-bottom:5px; font-size:0.9rem;">Anexar Ficha / Teste</h4>
                <span id="prhf-file-name" style="font-size:0.75rem; color:var(--text-muted);">Toca para PDF ou Imagem</span>
            `;
            uploadAreaPrhf.style.borderColor = 'var(--danger-red)';
            uploadAreaPrhf.style.background = 'rgba(239,68,68,0.05)';
            const prhfFile = document.getElementById('prhf-file');
            if (prhfFile) prhfFile.value = "";
            state.prhfBase64 = null;
        }
    }
});

// 2. Faz o "Reset" do formulário sempre que clicas no X de um modal
document.addEventListener('click', function (e) {
    if (e.target.closest('.fechar-modal')) {
        const uploadArea = document.getElementById('mat-upload-area');
        if (uploadArea) {
            uploadArea.innerHTML = `
                <i class="fa-solid fa-paperclip" style="font-size:1.5rem; color:#0099ff; margin-bottom:10px;"></i>
                <h4 style="color:white; margin-bottom:5px; font-size:0.85rem;">Anexar Ficha (Opcional)</h4>
            `;
            uploadArea.style.borderColor = '#0099ff';
            uploadArea.style.background = 'rgba(0,153,255,0.05)';
            const matFile = document.getElementById('mat-file');
            if (matFile) matFile.value = "";
        }
    }
});

// =========================================================================
    // ALERTAS BUROCRÁTICOS (SÍNTESES E PCT) - O INTERRUPTOR DO DT
    // =========================================================================

    window.carregarAlertasBurocraticos = async function() {
        const containerProf = document.getElementById('avisos-dt-container'); // Início dos Profs
        const containerDT = document.getElementById('avisos-dt-dashboard-container'); // Painel do DT
        
        try {
            // 1. MODO DIRETOR DE TURMA (Painel DT - Interrutores)
            if (containerDT && state.activeRole === 'diretor_turma' && state.minhaTurmaDT) {
                const turmaDT = state.selectedTurma || state.minhaTurmaDT;
                const snapDT = await getDoc(doc(db, "turmas", turmaDT, "alertas", "dt"));
                const alertasDT = snapDT.exists() ? snapDT.data() : { sinteses: false, pct: false };
                
                containerDT.innerHTML = `
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:5px;">Ativar alertas no Início dos Professores:</p>
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px;">
                        ${buildBotaoAlerta('Sínteses', 'fa-solid fa-clipboard', '#10b981', alertasDT.sinteses, true, 'sinteses', turmaDT)}
                        ${buildBotaoAlerta('PCT', 'fa-solid fa-users-rectangle', '#b82bf2', alertasDT.pct, true, 'pct', turmaDT)}
                    </div>
                `;
            }

            // 2. MODO PROFESSOR (Início - Painel de Leitura de TODAS as turmas)
            if (containerProf && state.turmasProfessor) {
                let htmlProf = '';
                
                // Varre TODAS as turmas do professor
                const promessas = state.turmasProfessor.map(t => getDoc(doc(db, "turmas", t, "alertas", "dt")));
                const snaps = await Promise.all(promessas);
                
                snaps.forEach((snap, index) => {
                    const turma = state.turmasProfessor[index];
                    
                    // Se a base de dados existir para esta turma, lê os valores, senão assume false
                    const al = snap.exists() ? snap.data() : { sinteses: false, pct: false };
                    
                    // Desenha SEMPRE os dois botões, mas passa o estado (true ou false) para eles brilharem ou ficarem apagados
                    htmlProf += buildBotaoAlerta(`Sínteses ${turma}`, 'fa-solid fa-clipboard', '#10b981', al.sinteses, false, 'sinteses', turma);
                    htmlProf += buildBotaoAlerta(`PCT ${turma}`, 'fa-solid fa-users-rectangle', '#b82bf2', al.pct, false, 'pct', turma);
                });

                containerProf.style.display = 'grid'; // Mostra sempre a grelha
                containerProf.innerHTML = htmlProf;
            }
        } catch(e) {
            console.error("Erro ao carregar alertas burocráticos:", e);
        }
    };

    function buildBotaoAlerta(nome, icon, cor, ativo, isDT, dbKey, turma) {
        const onClick = isDT ? `onclick="window.toggleAlertaBurocratico('${dbKey}', ${ativo}, '${turma}')"` : '';
        const cursor = isDT ? 'cursor: pointer;' : 'cursor: default;';
        const opacity = ativo ? '1' : '0.4';
        const shadow = ativo ? `0 0 15px ${cor}60` : 'none';
        const border = ativo ? cor : '#333';
        const colorBg = ativo ? cor : '#333';
        const colorIcon = ativo ? 'black' : 'var(--text-muted)';
        const colorText = ativo ? 'white' : 'var(--text-muted)';

        return `
        <div ${onClick} style="background: rgba(0,0,0,0.2); border: 1px solid ${border}; box-shadow: ${shadow}; border-radius: 8px; padding: 12px; display: flex; align-items: center; justify-content: center; gap: 10px; opacity: ${opacity}; transition: 0.3s; ${cursor}">
            <div style="background: ${colorBg}; color: ${colorIcon}; width: 32px; height: 32px; border-radius: 50%; display: flex; justify-content: center; align-items: center;"><i class="${icon}"></i></div>
            <strong style="color: ${colorText}; font-size: 0.9rem; margin: 0;">${nome}</strong>
        </div>`;
    }

    window.toggleAlertaBurocratico = async function(dbKey, estadoAtual, turma) {
        if (!turma) return;
        
        try {
            await setDoc(doc(db, "turmas", turma, "alertas", "dt"), {
                [dbKey]: !estadoAtual 
            }, { merge: true });
            
            // Recarrega as luzes na hora
            window.carregarAlertasBurocraticos();
        } catch(e) {
            console.error("Erro ao alternar alerta:", e);
        }
    };

    // ==========================================
// 12 DIMENSÕES QUALITATIVAS (ESCALAS DE SÍNTESE)
// ==========================================
const DIMENSOES_AVALIACAO = [
    { id: 'assiduidade', categoria: '1. Dinâmica Diária', nome: 'Assiduidade', niveis: ['Assíduo', 'Assiduidade irregular', 'Assiduidade muito irregular'] },
    { id: 'pontualidade', categoria: '1. Dinâmica Diária', nome: 'Pontualidade', niveis: ['Pontual', 'Pontualidade irregular', 'Frequentemente atrasado'] },
    { id: 'participacao', categoria: '1. Dinâmica Diária', nome: 'Participação', niveis: ['Muito participativo', 'Participativo', 'Pouco participativo', 'Não participativo'] },
    { id: 'interesse', categoria: '1. Dinâmica Diária', nome: 'Interesse / Motivação', niveis: ['Muito interessado', 'Interessado', 'Pouco interessado', 'Desinteressado'] },
    
    { id: 'empenho', categoria: '2. Postura e Trabalho', nome: 'Empenho', niveis: ['Muito empenhado', 'Empenhado', 'Pouco empenhado', 'Sem empenho'] },
    { id: 'autonomia', categoria: '2. Postura e Trabalho', nome: 'Autonomia', niveis: ['Muito autónomo', 'Autónomo', 'Necessita de orientação', 'Muito dependente'] },
    { id: 'responsabilidade', categoria: '2. Postura e Trabalho', nome: 'Responsabilidade', niveis: ['Muito responsável', 'Responsável', 'Irregular', 'Pouco responsável'] },
    { id: 'comportamento', categoria: '2. Postura e Trabalho', nome: 'Comportamento / Atitude', niveis: ['Exemplar', 'Adequado', 'Irregular', 'Inadequado'] },
    
    { id: 'relacao', categoria: '3. Relação e Evolução', nome: 'Relação com pares', niveis: ['Muito colaborativo', 'Colaborativo', 'Pouco colaborativo', 'Conflituoso'] },
    { id: 'organizacao', categoria: '3. Relação e Evolução', nome: 'Organização', niveis: ['Muito organizado', 'Organizado', 'Pouco organizado', 'Desorganizado'] },
    { id: 'tarefas', categoria: '3. Relação e Evolução', nome: 'Cumprimento de tarefas', niveis: ['Cumpre sempre', 'Cumpre habitualmente', 'Cumpre irregularmente', 'Não cumpre'] },
    { id: 'evolucao', categoria: '3. Relação e Evolução', nome: 'Evolução / Progresso', niveis: ['Evolução muito significativa', 'Evolução significativa', 'Evolução pouco significativa', 'Sem evolução significativa'] }
];

let estadoEscalasAluno = {};
let passoAtualIndex = 0; // Controla qual a dimensão visível de 0 a 11

window.renderizarDimensoesQualitativas = function() {
    passoAtualIndex = 0; // Sempre que abre o modal, começa na primeira dimensão
    desenharPassoAtual();
};

function desenharPassoAtual() {
    const container = document.getElementById('container-dimensoes-qualitativas');
    const contador = document.getElementById('passo-indicador-contador');
    if (!container) return;

    if (contador) {
        contador.innerText = `Passo ${passoAtualIndex + 1} de ${DIMENSOES_AVALIACAO.length}`;
    }

    // Efeito de Fade-Out rápido antes de mudar o conteúdo
    container.style.opacity = '0';
    container.style.transform = 'translateY(5px)';
    container.style.transition = 'opacity 0.2s ease, transform 0.2s ease';

    // Atraso de 150ms para deixar a caixa apagar e depois desenhar o novo conteúdo
    setTimeout(() => {
        if (passoAtualIndex >= DIMENSOES_AVALIACAO.length) {
            container.innerHTML = `
            <div style="text-align: center; padding: 20px 5px; display: flex; flex-direction: column; justify-content: center; height: 100%;">
                <i class="fa-solid fa-circle-check" style="font-size: 3.5rem; color: var(--success-green); margin-bottom: 15px;"></i>
                <h4 style="color: white; font-size: 1.2rem; margin-bottom: 8px;">Avaliação Concluída!</h4>
                <p style="font-size: 0.9rem; color: var(--text-muted); margin-bottom: 25px;">Todas as 12 dimensões foram registadas com sucesso.</p>
                <button type="button" onclick="passoAtualIndex = 0; desenharPassoAtual();" class="secondary-btn small-btn" style="border-color: #3b82f6; color: #3b82f6; padding: 10px 18px; font-size: 0.85rem; align-self: center;">
                    <i class="fa-solid fa-rotate-left"></i> Rever Respostas
                </button>
            </div>`;
        } else {
            const dim = DIMENSOES_AVALIACAO[passoAtualIndex];

            let html = `
            <div style="margin-bottom: 15px;">
                <span style="font-size: 0.8rem; color: var(--warning-yellow); text-transform: uppercase; font-weight: bold; display: block; margin-bottom: 6px; letter-spacing: 0.5px;">
                    <i class="fa-solid fa-layer-group"></i> ${dim.categoria}
                </span>
                <h4 style="color: white; font-size: 1.2rem; margin: 0; font-weight: 700;">${dim.nome}</h4>
            </div>
            <div style="display: flex; flex-direction: column; gap: 10px;" data-dimensao="${dim.id}">
            `;

            dim.niveis.forEach((nivel) => {
                const isSelected = estadoEscalasAluno[dim.id] === nivel;
                const bg = isSelected ? 'rgba(59, 130, 246, 0.25)' : 'rgba(255,255,255,0.03)';
                const color = isSelected ? 'white' : 'var(--text-light)';
                const border = isSelected ? '#3b82f6' : '#444';

                html += `
                <button type="button" class="btn-nivel-escala-passo" data-dimensao="${dim.id}" data-nivel="${nivel}" style="background: ${bg}; color: ${color}; border: 1px solid ${border}; border-radius: 8px; padding: 14px 15px; font-size: 0.95rem; cursor: pointer; transition: 0.2s; text-align: left; display: flex; justify-content: space-between; align-items: center; box-shadow: 0 2px 5px rgba(0,0,0,0.15);">
                    <span style="font-weight: 500;">${nivel}</span>
                    ${isSelected ? '<i class="fa-solid fa-check-circle" style="color: #3b82f6; font-size: 1.2rem;"></i>' : '<i class="fa-regular fa-circle" style="color: #555; font-size: 1.2rem;"></i>'}
                </button>`;
            });

            html += `</div>`;

            // Botões de navegação inferior com MARGIN-TOP: AUTO para serem empurrados até ao fundo da caixa
            html += `
            <div style="display: flex; justify-content: space-between; margin-top: auto; padding-top: 25px;">
                <button type="button" id="btn-passo-ant" ${passoAtualIndex === 0 ? 'style="opacity:0; pointer-events:none;"' : 'style="padding: 8px 15px; font-size: 0.85rem;"'} class="secondary-btn small-btn">
                    <i class="fa-solid fa-arrow-left"></i> Anterior
                </button>
                <span style="font-size: 0.75rem; color: var(--text-muted); align-self: center;">Clica para avançar</span>
                <button type="button" id="btn-passo-seguinte" class="secondary-btn small-btn" style="padding: 8px 15px; font-size: 0.85rem; border-color: #3b82f6; color: #3b82f6;">
                    Seguinte <i class="fa-solid fa-arrow-right"></i>
                </button>
            </div>
            `;

            container.innerHTML = html;
        }

        // Fade-In suave com a nova dimensão carregada
        container.style.opacity = '1';
        container.style.transform = 'translateY(0)';
    }, 150);
}

// Evento de clique num nível (guarda e avança automaticamente para o próximo passo)
document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.btn-nivel-escala-passo');
    if (!btn) return;

    const dimId = btn.getAttribute('data-dimensao');
    const nivelVal = btn.getAttribute('data-nivel');

    estadoEscalasAluno[dimId] = nivelVal;

    // Pintar o botão instantaneamente para o utilizador sentir que clicou
    btn.style.background = 'rgba(59, 130, 246, 0.25)';
    btn.style.borderColor = '#3b82f6';
    btn.querySelector('i').className = 'fa-solid fa-check-circle';
    btn.querySelector('i').style.color = '#3b82f6';

    // Avança automaticamente para a dimensão seguinte após 250ms (dá tempo para ver o clique)
    setTimeout(() => {
        passoAtualIndex++;
        desenharPassoAtual();
    }, 250);
});

// Eventos dos botões de navegação "Anterior" e "Seguinte"
document.body.addEventListener('click', (e) => {
    if (e.target.closest('#btn-passo-ant')) {
        if (passoAtualIndex > 0) {
            passoAtualIndex--;
            desenharPassoAtual();
        }
    }
    if (e.target.closest('#btn-passo-seguinte')) {
        if (passoAtualIndex < DIMENSOES_AVALIACAO.length) {
            passoAtualIndex++;
            desenharPassoAtual();
        }
    }
});