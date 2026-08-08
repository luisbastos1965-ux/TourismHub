// js/prof/roles/pap-diario.js
import { db } from "../../firebase.js";
import { collection, addDoc, getDocs, doc, updateDoc, query, where, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state, nomeCurto } from "../store.js";

// Estado local do modal de presença
let modalPresencaAtiva = true; 

/**
 * Carrega e separa os alunos no ecrã "Orientandos"
 */
export async function carregarEcraOrientandos() {
    const listaMeus = document.getElementById('lista-meus-orientandos');
    const listaRestantes = document.getElementById('lista-restantes-alunos-pap');
    
    listaMeus.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar os teus orientandos...</p>';
    listaRestantes.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A ler dados dos colegas...</p>';

    try {
        let todosAlunos12 = [];
        // Procurar alunos de 12º ano nas turmas do professor
        for (const t of state.turmasProfessor) {
            const ano = parseInt(t.match(/\d+/)?.[0]) || 10;
            if (ano === 12) {
                const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                snap.forEach(d => todosAlunos12.push({ id: d.id, ...d.data() }));
            }
        }

        let htmlMeus = '';
        let htmlRestantes = '';

        todosAlunos12.forEach(al => {
            const tema = (al.pap && al.pap.tema) ? al.pap.tema : 'Tema não definido';
            const orientador = (al.pap && al.pap.orientador) ? al.pap.orientador : 'Sem orientador';
            
            // Verifica se o aluno é orientado por este professor (nome ou ID)
            const isMeuOrientando = (orientador === state.myUserName || orientador === state.myUserId);

            if (isMeuOrientando) {
                // Fases da PAP (Exemplo visual simplificado)
                const faseTema = (al.pap && al.pap.temaAprovado) ? 'var(--success-green)' : 'var(--warning-yellow)';
                const faseRelatorio = (al.pap && al.pap.relatorioAprovado) ? 'var(--success-green)' : '#333';
                
                htmlMeus += `
                <div class="card" style="border-left: 4px solid var(--success-green); padding: 15px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                        <div>
                            <strong style="color:white; font-size:1.1rem;">${nomeCurto(al.nome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span></strong>
                            <div style="color:var(--text-light); font-size:0.85rem; margin-top:5px;"><strong>Tema:</strong> ${tema}</div>
                        </div>
                        <img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                    </div>
                    
                    <div style="margin-top: 15px; margin-bottom: 15px;">
                        <span style="font-size: 0.75rem; color: var(--text-muted); display: block; margin-bottom: 5px;">Progresso do Projeto:</span>
                        <div style="display: flex; gap: 5px;">
                            <div style="height: 6px; flex: 1; background: ${faseTema}; border-radius: 3px;" title="Tema"></div>
                            <div style="height: 6px; flex: 1; background: ${faseRelatorio}; border-radius: 3px;" title="Relatório"></div>
                            <div style="height: 6px; flex: 1; background: #333; border-radius: 3px;" title="Defesa"></div>
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:10px;">
                        <button class="secondary-btn small-btn" style="flex:1; border-color:#0099ff; color:#0099ff;"><i class="fa-solid fa-folder-open"></i> Entregas</button>
                        <button class="secondary-btn small-btn" style="flex:1; border-color:var(--warning-yellow); color:var(--warning-yellow);"><i class="fa-solid fa-star-half-stroke"></i> Avaliar</button>
                    </div>
                </div>`;
            } else {
                htmlRestantes += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border:1px solid #333; opacity:0.8;">
                    <div>
                        <strong style="color:white; font-size:0.9rem;">${nomeCurto(al.nome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span></strong><br>
                        <span style="font-size:0.75rem; color:var(--text-light);">Tema: ${tema}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.7rem; color:var(--text-muted);">Orientador</span><br>
                        <strong style="font-size:0.8rem; color:white;">${nomeCurto(orientador)}</strong>
                    </div>
                </div>`;
            }
        });

        listaMeus.innerHTML = htmlMeus === '' ? '<p class="text-muted center">Não tens alunos sob a tua orientação direta.</p>' : htmlMeus;
        listaRestantes.innerHTML = htmlRestantes === '' ? '<p class="text-muted center">Não há outros alunos de 12º ano.</p>' : htmlRestantes;

    } catch (err) {
        listaMeus.innerHTML = '<p class="text-danger center">Erro ao carregar orientandos.</p>';
    }
}

/**
 * Carrega as sessões (reuniões) para o ecrã do Diário de Bordo
 */
export async function carregarEcraDiario() {
    const container = document.getElementById('lista-sessoes-diario');
    container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar diário...</p>';

    try {
        let todasSessoes = [];
        const qAlunos = await getDocs(query(collection(db, "utilizadores"), where("papel", "==", "aluno")));
        
        for (const docAl of qAlunos.docs) {
            const alData = docAl.data();
            const isMeuOrientando = (alData.pap && (alData.pap.orientador === state.myUserName || alData.pap.orientador === state.myUserId));
            
            if (isMeuOrientando) {
                const sS = await getDocs(collection(db, "utilizadores", docAl.id, "sessoes_pap"));
                sS.forEach(s => todasSessoes.push({ id: s.id, alunoId: docAl.id, alunoNome: alData.nome, ...s.data() }));
            }
        }

        // Ordenar por data (mais recentes primeiro)
        todasSessoes.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

        let html = '';
        if (todasSessoes.length === 0) {
            html = '<p class="text-muted center">Ainda não registaste nenhuma sessão de orientação.</p>';
        } else {
            todasSessoes.forEach(s => {
                const corPresenca = s.compareceu ? 'var(--success-green)' : 'var(--danger-red)';
                const iconPresenca = s.compareceu ? 'fa-check' : 'fa-xmark';
                const txtPresenca = s.compareceu ? 'Compareceu' : 'Faltou';
                const dataFormatada = s.data ? s.data.split('-').reverse().join('/') : 'S/ Data';

                html += `
                <div style="background:rgba(0,0,0,0.2); border-left:4px solid ${corPresenca}; padding:15px; border-radius:8px; border-top:1px solid #333; border-right:1px solid #333; border-bottom:1px solid #333;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <strong style="color:white; font-size:1rem;">${nomeCurto(s.alunoNome)}</strong>
                        <span style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-regular fa-calendar"></i> ${dataFormatada}</span>
                    </div>
                    <div style="font-size:0.75rem; color:${corPresenca}; margin-bottom:8px; font-weight:bold;">
                        <i class="fa-solid ${iconPresenca}"></i> ${txtPresenca}
                    </div>
                    <p style="font-size:0.85rem; color:var(--text-light); line-height:1.4; margin:0;">
                        ${s.notas || 'Sem observações.'}
                    </p>
                </div>`;
            });
        }
        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = '<p class="text-danger center">Erro ao carregar o diário de bordo.</p>';
    }
}

/**
 * Prepara e abre o modal de Nova Sessão
 */
export async function prepararModalNovaSessao() {
    const selAluno = document.getElementById('sessao-pap-aluno');
    selAluno.innerHTML = '<option value="">A carregar alunos...</option>';
    
    // Configura a data de hoje por defeito
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('sessao-pap-data').value = hoje;
    document.getElementById('sessao-pap-notas').value = '';
    
    // Reset da presença para 'Compareceu'
    modalPresencaAtiva = true;
    atualizarBotoesPresenca();

    document.getElementById('modal-nova-sessao-pap').style.display = 'flex';

    try {
        let optionsHtml = '<option value="">-- Seleciona o Orientando --</option>';
        for (const t of state.turmasProfessor) {
            const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
            snap.forEach(d => {
                const data = d.data();
                if (data.pap && (data.pap.orientador === state.myUserName || data.pap.orientador === state.myUserId)) {
                    optionsHtml += `<option value="${d.id}">${nomeCurto(data.nome)} (${data.turma})</option>`;
                }
            });
        }
        selAluno.innerHTML = optionsHtml;
    } catch (err) {
        selAluno.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

/**
 * Controla visualmente o toggle de presenças no modal
 */
export function atualizarBotoesPresenca() {
    const btnSim = document.getElementById('btn-presenca-sim');
    const btnNao = document.getElementById('btn-presenca-nao');
    
    if (modalPresencaAtiva) {
        btnSim.classList.add('active');
        btnSim.style.borderColor = 'var(--success-green)';
        btnSim.style.color = 'var(--success-green)';
        btnSim.style.background = 'rgba(16,185,129,0.1)';
        
        btnNao.classList.remove('active');
        btnNao.style.borderColor = '#333';
        btnNao.style.color = 'var(--text-muted)';
        btnNao.style.background = 'transparent';
    } else {
        btnNao.classList.add('active');
        btnNao.style.borderColor = 'var(--danger-red)';
        btnNao.style.color = 'var(--danger-red)';
        btnNao.style.background = 'rgba(239,68,68,0.1)';
        
        btnSim.classList.remove('active');
        btnSim.style.borderColor = '#333';
        btnSim.style.color = 'var(--text-muted)';
        btnSim.style.background = 'transparent';
    }
}

/**
 * Grava a sessão na Base de Dados e (no futuro) notifica o aluno
 */
export async function gravarSessaoPAP(e) {
    const alunoId = document.getElementById('sessao-pap-aluno').value;
    const data = document.getElementById('sessao-pap-data').value;
    const notas = document.getElementById('sessao-pap-notas').value.trim();

    if (!alunoId || !data) {
        return alert("Por favor, seleciona o aluno e a data da sessão.");
    }

    const btn = e.target.closest('#btn-gravar-sessao-pap');
    const originalHtml = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        await addDoc(collection(db, "utilizadores", alunoId, "sessoes_pap"), {
            data: data,
            compareceu: modalPresencaAtiva,
            notas: notas,
            registadoEm: Date.now(),
            orientador: state.myUserName
        });

        // Se o aluno faltou, podemos criar um alerta automático no histórico dele
        if (!modalPresencaAtiva) {
            await addDoc(collection(db, "utilizadores", alunoId, "ocorrencias"), {
                titulo: "Falta a Sessão de Orientação (PAP)",
                descricao: "O aluno não compareceu à sessão agendada. " + notas,
                tipo: "negativa",
                autor: state.myUserName,
                timestamp: Date.now(),
                data: data.split('-').reverse().join('/')
            });
        }

        btn.innerHTML = '<i class="fa-solid fa-check"></i> Gravado';
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
            document.getElementById('modal-nova-sessao-pap').style.display = 'none';
            carregarEcraDiario();
        }, 1500);

    } catch (err) {
        btn.innerHTML = 'Erro!';
        setTimeout(() => {
            btn.innerHTML = originalHtml;
            btn.disabled = false;
        }, 2000);
    }
}

// Configurar Eventos Globais de UI para o Modal
document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-presenca-sim')) {
        modalPresencaAtiva = true;
        atualizarBotoesPresenca();
    }
    if (e.target.closest('#btn-presenca-nao')) {
        modalPresencaAtiva = false;
        atualizarBotoesPresenca();
    }
    if (e.target.closest('#btn-gravar-sessao-pap')) {
        gravarSessaoPAP(e);
    }
});
