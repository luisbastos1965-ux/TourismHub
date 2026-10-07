import { db } from "../../firebase.js";
import { collection, getDocs, query, where, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state, nomeCurto } from "../store.js";
import "./coord.js";

let ultimaAba = '';

export async function carregarEcraProjetosCoord() {
    const container = document.getElementById('lista-coord-projetos-dinamico');
    const filtroTurmaSelect = document.getElementById('coord-filtro-turma');

    const isFCT = document.getElementById('tab-coord-fct')?.classList.contains('active');
    const coordTabAtiva = isFCT ? 'fct' : 'pap';

    if (ultimaAba !== coordTabAtiva) {
        if (filtroTurmaSelect) filtroTurmaSelect.innerHTML = '';
        ultimaAba = coordTabAtiva;
    }

    container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A cruzar dados...</p>';

    try {
        let turmasFinais = state.turmasProfessor.filter(t => {
            const ano = parseInt(t.match(/\d+/)?.[0]) || 10;
            return coordTabAtiva === 'fct' ? ano >= 11 : ano === 12;
        });

        if (filtroTurmaSelect && filtroTurmaSelect.options.length <= 1) {
            filtroTurmaSelect.innerHTML = '<option value="">Mostrar Todas as Turmas</option>' +
                turmasFinais.map(t => `<option value="${t}">Turma ${t}</option>`).join('');
            filtroTurmaSelect.onchange = () => carregarEcraProjetosCoord();
        }

        const turmaEscolhida = filtroTurmaSelect ? filtroTurmaSelect.value : '';
        let turmasParaProcurar = turmaEscolhida ? [turmaEscolhida] : turmasFinais;

        let alunosAvaliados = [];
        for (const t of turmasParaProcurar) {
            const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
            snap.forEach(d => alunosAvaliados.push({ id: d.id, ...d.data() }));
        }

        let html = '';

        if (coordTabAtiva === 'fct') {
            html += `<h4 style="color:var(--text-light); margin-bottom:10px; margin-top:10px; font-size:0.9rem;"><i class="fa-solid fa-list-check" style="color:var(--primary-green);"></i> Acompanhamento de Estágio</h4>`;

            alunosAvaliados.sort((a, b) => {
                const horasA = a.fct?.horasRealizadas || 0;
                const horasB = b.fct?.horasRealizadas || 0;

                if (horasB !== horasA) {
                    return horasB - horasA; // Quem tem mais horas fica primeiro
                }
                // Desempate por nome alfabético
                return (a.nome || '').localeCompare(b.nome || '');
            });

            alunosAvaliados.forEach(al => {
                const horas = al.fct?.horasRealizadas || 0;

                const anoTurma = parseInt(al.turma?.match(/\d+/)?.[0]) || 12;
                const horasTotais = (anoTurma === 11) ? 120 : 480;

                let statusColor = '#333';
                let barraWidth = Math.min((horas / horasTotais) * 100, 100);

                if (horas === 0) statusColor = 'var(--danger-red)';
                else if (al.fct?.validadoDT) statusColor = 'var(--success-green)';
                else statusColor = 'var(--warning-yellow)';

                const docsRef = [
                    { id: 'protocolo', nome: 'Protocolo' },
                    { id: 'plano', nome: 'Plano' },
                    { id: 'folhas', nome: 'Folhas Registo' },
                    { id: 'registos', nome: 'Reg. Tutor' },
                    { id: 'avaliacao', nome: 'Avaliações' }
                ];

                let docsPorEntregar = [];
                let docsEmAnalise = [];
                let docsValidados = [];

                docsRef.forEach(d => {
                    let st = al.fct?.burocracia?.[d.id] || 0;
                    if (st === 0) docsPorEntregar.push(d.nome);
                    else if (st === 1) docsEmAnalise.push(d.nome);
                    else if (st === 2) docsValidados.push(d.nome);
                });

                const renderColunaDocs = (titulo, lista, corBorda, icone) => `
                    <div style="flex:1; background:rgba(0,0,0,0.25); border:1px solid #333; border-top:3px solid ${corBorda}; border-radius:6px; padding:8px; min-width:0;">
                        <div style="font-size:0.7rem; color:var(--text-muted); font-weight:bold; margin-bottom:6px; text-transform:uppercase; display:flex; align-items:center; gap:4px;">
                            <i class="fa-solid ${icone}"></i> ${titulo} (${lista.length})
                        </div>
                        <div style="display:flex; flex-direction:column; gap:4px;">
                            ${lista.length > 0 ? lista.map(n => `<span style="font-size:0.75rem; color:var(--text-light); background:rgba(255,255,255,0.03); padding:3px 6px; border-radius:4px; white-space:nowrap; overflow:hidden; text-overflow:ellipsis;" title="${n}">${n}</span>`).join('') : '<span style="font-size:0.7rem; color:#555; font-style:italic;">Nenhum</span>'}
                        </div>
                    </div>`;

                let burocHtml = `
                <div style="margin-top:12px; padding-top:12px; border-top:1px dashed #333; display:grid; grid-template-columns: 1fr 1fr 1fr; gap:10px; width:100%;">
                    ${renderColunaDocs('Por Entregar', docsPorEntregar, 'var(--danger-red)', 'fa-circle-xmark')}
                    ${renderColunaDocs('Em Análise', docsEmAnalise, 'var(--warning-yellow)', 'fa-clock')}
                    ${renderColunaDocs('Validado', docsValidados, 'var(--success-green)', 'fa-circle-check')}
                </div>`;

                let historicoDiasHtml = '';
                if (al.fct?.registosDiarios && al.fct.registosDiarios.length > 0) {
                    const totalDias = al.fct.registosDiarios.length;
                    const textoDias = totalDias === 1 ? '1 dia registado' : `${totalDias} dias registados`;

                    let itensDias = al.fct.registosDiarios.map(reg => `
                        <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; background:rgba(255,255,255,0.03); padding:8px 12px; border-radius:6px; margin-bottom:4px; border:1px solid rgba(255,255,255,0.03);">
                            <div style="display:flex; align-items:center; gap:8px; color:var(--text-light);">
                                <i class="fa-solid fa-calendar-day" style="color:#0ea5e9; font-size:0.85rem;"></i>
                                <span><strong>${reg.data}</strong> <span style="color:var(--text-muted); font-size:0.75rem; margin-left:5px;">(${reg.descricao || ''})</span></span>
                            </div>
                            <span style="background:rgba(14,165,233,0.15); color:#0ea5e9; font-weight:bold; font-size:0.8rem; padding:2px 8px; border-radius:4px;">+${reg.horas}h</span>
                        </div>
                    `).join('');

                    historicoDiasHtml = `
                        <div style="margin-top:12px; padding-top:12px; border-top:1px dashed #333;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                                <span style="font-size:0.75rem; color:var(--text-muted); font-weight:bold; text-transform:uppercase; letter-spacing:0.5px;">
                                    <i class="fa-solid fa-clock-rotate-left"></i> Registo Diário de Horas
                                </span>
                                <span style="font-size:0.7rem; color:#0ea5e9; background:rgba(14,165,233,0.1); padding:2px 6px; border-radius:4px; font-weight:bold;">${textoDias}</span>
                            </div>
                            <div style="max-height:130px; overflow-y:auto; display:flex; flex-direction:column; padding-right:2px;">
                                ${itensDias}
                            </div>
                        </div>`;
                } else {
                    historicoDiasHtml = `
                        <div style="margin-top:12px; padding-top:12px; border-top:1px dashed #333; font-size:0.8rem; color:var(--text-muted); font-style:italic; display:flex; align-items:center; gap:6px;">
                            <i class="fa-solid fa-triangle-exclamation" style="color:var(--warning-yellow);"></i> Nenhum dia de estágio submetido ainda.
                        </div>`;
                }

                let btnEditarFCT = `<button class="secondary-btn small-btn btn-editar-fct-coord" data-id="${al.id}" style="margin-top:12px; width:100%; border-color:#0ea5e9; color:#0ea5e9;"><i class="fa-solid fa-pen"></i> Editar Entidade / Horas</button>`;

                html += `
                <div class="card aluno-list-item" style="border-left: 4px solid ${statusColor}; padding: 18px; margin-bottom: 15px; cursor:default; display:flex; flex-direction:column; gap:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <strong style="color:white; font-size:1.1rem;">${nomeCurto(al.nome)}</strong> 
                            <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma} - ${anoTurma}º Ano)</span>
                        </div>
                        <div style="text-align:right;">
                            <span style="color:${statusColor}; font-size:1.25rem; font-weight:bold;">${horas}h</span>
                            <span style="font-size:0.75rem; color:var(--text-muted);">/ ${horasTotais}h</span>
                        </div>
                    </div>

                    <div style="font-size:0.82rem; color:var(--text-light); background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:6px;">
                        Entidade: <strong style="color:#0ea5e9;">${al.fct?.empresa || 'Não definida'}</strong>
                        ${al.fct?.orientadorEntidade ? `<br>Tutor: <span style="color:var(--text-muted);">${al.fct.orientadorEntidade}</span>` : ''}
                    </div>

                    <div style="height: 6px; width: 100%; background: #222; border-radius: 3px; overflow:hidden;">
                        <div style="height: 100%; width: ${barraWidth}%; background: ${statusColor}; transition:0.3s;"></div>
                    </div>

                    ${burocHtml}
                    ${historicoDiasHtml}
                    ${btnEditarFCT}
                </div>`;
            });

        } else {
            // Tab PAP
            alunosAvaliados.sort((a, b) => a.nome.localeCompare(b.nome));

            alunosAvaliados.forEach(al => {
                let txtStatus = '<i class="fa-solid fa-triangle-exclamation"></i> Por Iniciar';
                let statusColor = 'var(--danger-red)';

                if (al.pap?.faseApresentacao) { txtStatus = '<i class="fa-solid fa-award"></i> Apresentação Concluída'; statusColor = 'var(--success-green)'; }
                else if (al.pap?.faseRelatorio || al.pap?.relatorioAprovado) { txtStatus = '<i class="fa-solid fa-flag-checkered"></i> Apto para Defesa'; statusColor = 'var(--success-green)'; }
                else if (al.pap?.faseDesenvolvimento) { txtStatus = '<i class="fa-solid fa-laptop-code"></i> Em Desenvolvimento'; statusColor = '#00d2ff'; }
                else if (al.pap?.faseAprovacao || al.pap?.temaAprovado) { txtStatus = '<i class="fa-solid fa-check"></i> Tema Aprovado'; statusColor = 'var(--warning-yellow)'; }
                else if (al.pap?.faseTema || al.pap?.tema) { txtStatus = '<i class="fa-solid fa-magnifying-glass"></i> Tema Escolhido'; statusColor = 'var(--warning-yellow)'; }

                // --- CÁLCULO SEGURO DO PROGRESSO (Adeus NaN%) ---
                const fasesTotais = 5;
                let fasesConcluidas = 0;
                if (al.pap?.fases) {
                    fasesConcluidas = Object.values(al.pap.fases).filter(Boolean).length;
                } else {
                    if (al.pap?.faseTema) fasesConcluidas++;
                    if (al.pap?.faseAprovacao) fasesConcluidas++;
                    if (al.pap?.faseDesenvolvimento) fasesConcluidas++;
                    if (al.pap?.faseRelatorio) fasesConcluidas++;
                    if (al.pap?.faseApresentacao) fasesConcluidas++;
                }
                const progressoPerc = Math.min(Math.round((fasesConcluidas / fasesTotais) * 100), 100);

                html += `
                <div class="card aluno-list-item" data-id="${al.id}" style="border-left: 4px solid ${statusColor}; padding: 15px; margin-bottom: 12px; cursor:default; display:flex; flex-direction:column; gap:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="flex:1; min-width:0;">
                            <strong style="color:white; font-size:1.1rem;">${nomeCurto(al.nome)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span>
                            <div style="font-size:0.85rem; color:var(--text-light); margin-top:8px;">Orientador: ${al.pap?.orientador ? `<strong style="color:var(--accent-purple);">${nomeCurto(al.pap.orientador)}</strong>` : '<strong style="color:var(--danger-red);">Sem Orientador</strong>'}</div>
                            <div style="font-size:0.85rem; color:var(--text-light); margin-top:4px; word-wrap:break-word;">Tema: <strong style="color:white;">${al.pap?.tema || 'Não definido'}</strong></div>
                        </div>
                        <div style="text-align:right; margin-left:10px; flex-shrink:0;">
                            <span style="font-size:0.75rem; color:${statusColor}; font-weight:bold;">${txtStatus}</span>
                        </div>
                    </div>

                    <div>
                        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-bottom:4px;">
                            <span>Progresso da PAP:</span>
                            <span style="color:var(--primary-green); font-weight:bold;">${progressoPerc}%</span>
                        </div>
                        <div style="height: 6px; width: 100%; background: #222; border-radius: 3px; overflow:hidden;">
                            <div style="height: 100%; width: ${progressoPerc}%; background: var(--primary-green); transition:0.3s;"></div>
                        </div>
                    </div>

                    <!-- GRELHA COM OS 3 BOTÕES DA IMAGEM -->
                    <div style="display:grid; grid-template-columns: 1fr 1fr 1fr; gap:8px;">
                        <button class="secondary-btn small-btn btn-editar-pap-coord" data-id="${al.id}" style="border-color:#9333ea; color:#9333ea; font-size:0.8rem; padding: 8px 4px;">
                            <i class="fa-solid fa-server"></i> Fases
                        </button>
                        <button class="secondary-btn small-btn btn-cofre-pap-coord" data-id="${al.id}" data-nome="${nomeCurto(al.nome)}" style="border-color:var(--primary-green); color:var(--primary-green); font-size:0.8rem; padding: 8px 4px;">
                            <i class="fa-solid fa-vault"></i> Cofre
                        </button>
                        <button class="secondary-btn small-btn btn-observar-pap-coord" data-id="${al.id}" data-nome="${nomeCurto(al.nome)}" style="border-color:var(--warning-yellow); color:var(--warning-yellow); font-size:0.8rem; padding: 8px 4px;">
                            <i class="fa-solid fa-eye"></i> Observar
                        </button>
                    </div>
                </div>`;
            });
        } // <-- ESTA ERA A CHAVETA QUE FALTAVA (Fecha o Else da Tab PAP)

        container.innerHTML = html === '' ? '<p class="text-muted center">Sem dados para mostrar.</p>' : html;

        // Ligar os botões de edição criados dinamicamente
        setTimeout(() => {
            document.querySelectorAll('.btn-editar-fct-coord').forEach(btn => {
                btn.onclick = (e) => {
                    const idAluno = e.currentTarget.getAttribute('data-id');
                    if (window.abrirModalEdicaoFCT) window.abrirModalEdicaoFCT(idAluno);
                };
            });
            document.querySelectorAll('.btn-editar-pap-coord').forEach(btn => {
                btn.onclick = (e) => {
                    const idAluno = e.currentTarget.getAttribute('data-id');
                    if (window.abrirModalEdicaoPAP) window.abrirModalEdicaoPAP(idAluno);
                };
            });
            // NOVO: Ligações para o Cofre e Observatório
            document.querySelectorAll('.btn-cofre-pap-coord').forEach(btn => {
                btn.onclick = (e) => {
                    const idAluno = e.currentTarget.getAttribute('data-id');
                    const nomeAluno = e.currentTarget.getAttribute('data-nome');
                    if (window.abrirModalCofrePAP) window.abrirModalCofrePAP(idAluno, nomeAluno);
                };
            });
            document.querySelectorAll('.btn-observar-pap-coord').forEach(btn => {
                btn.onclick = (e) => {
                    const idAluno = e.currentTarget.getAttribute('data-id');
                    const nomeAluno = e.currentTarget.getAttribute('data-nome');
                    if (window.abrirModalObservatorioPAP) window.abrirModalObservatorioPAP(idAluno, nomeAluno);
                };
            });
        }, 50);

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="text-danger center">Erro a carregar projetos.</p>';
    }
}

// Delegação global com captura de erros para depuração
document.addEventListener('click', (e) => {
    const btnFCT = e.target.closest('.btn-editar-fct-coord');
    if (btnFCT) {
        const alunoId = btnFCT.getAttribute('data-id');
        console.log("A tentar abrir FCT para o aluno:", alunoId);
        try {
            if (window.abrirModalEdicaoFCT) {
                window.abrirModalEdicaoFCT(alunoId);
            } else {
                console.error("A função window.abrirModalEdicaoFCT não está global!");
            }
        } catch (err) {
            console.error("ERRO DENTRO DA FUNÇÃO DE MODAL:", err);
        }
    }

    const btnPAP = e.target.closest('.btn-editar-pap-coord');
    if (btnPAP) {
        const alunoId = btnPAP.getAttribute('data-id');
        try {
            if (window.abrirModalEdicaoPAP) {
                window.abrirModalEdicaoPAP(alunoId);
            }
        } catch (err) {
            console.error("ERRO DENTRO DA FUNÇÃO DE PAP:", err);
        }
    }
});

// ==========================================
// FUNÇÕES DE EDIÇÃO (COORDENADOR)
// ==========================================

export async function abrirModalEdicaoPAP(alunoId) {
    document.getElementById('modal-editar-pap-coord').style.display = 'flex';
    document.getElementById('edit-pap-aluno-id').value = alunoId;
    document.getElementById('edit-pap-aluno-nome').innerText = "A procurar aluno...";
    document.getElementById('edit-pap-tema').value = '';

    ['tema', 'aprovacao', 'desenvolvimento', 'relatorio', 'apresentacao'].forEach(f => {
        document.getElementById(`edit-pap-fase-${f}`).checked = false;
    });

    const selOrientador = document.getElementById('edit-pap-orientador');
    selOrientador.innerHTML = '<option value="">A carregar equipa...</option>';

    try {
        const alunoSnap = await getDoc(doc(db, "utilizadores", alunoId));
        if (alunoSnap.exists()) {
            const data = alunoSnap.data();
            document.getElementById('edit-pap-aluno-nome').innerText = nomeCurto(data.nome);

            if (data.pap) {
                document.getElementById('edit-pap-tema').value = data.pap.tema || '';
                document.getElementById('edit-pap-fase-tema').checked = data.pap.faseTema || !!data.pap.tema;
                document.getElementById('edit-pap-fase-aprovacao').checked = data.pap.faseAprovacao || data.pap.temaAprovado || false;
                document.getElementById('edit-pap-fase-desenvolvimento').checked = data.pap.faseDesenvolvimento || false;
                document.getElementById('edit-pap-fase-relatorio').checked = data.pap.faseRelatorio || data.pap.relatorioAprovado || false;
                document.getElementById('edit-pap-fase-apresentacao').checked = data.pap.faseApresentacao || false;
            }

            const profsSnap = await getDocs(collection(db, "utilizadores"));
            let profsHtml = '<option value="">-- Deixar sem orientador --</option>';
            profsSnap.forEach(pDoc => {
                const pData = pDoc.data();
                if (pData.papel !== 'aluno' && pData.papel !== 'ee' && pData.nome) {
                    const isSelected = (data.pap && (data.pap.orientador === pData.nome || data.pap.orientador === pDoc.id)) ? 'selected' : '';
                    profsHtml += `<option value="${pData.nome}" ${isSelected}>${pData.nome}</option>`;
                }
            });
            selOrientador.innerHTML = profsHtml;
        }
    } catch (err) {
        document.getElementById('edit-pap-aluno-nome').innerText = "Erro ao carregar dados.";
    }
}

export async function salvarEdicaoPAP(btn) {
    const alunoId = document.getElementById('edit-pap-aluno-id').value;
    if (!alunoId) return;

    const tema = document.getElementById('edit-pap-tema').value.trim();
    const orientador = document.getElementById('edit-pap-orientador').value;

    const fTema = document.getElementById('edit-pap-fase-tema').checked;
    const fAprovacao = document.getElementById('edit-pap-fase-aprovacao').checked;
    const fDesenv = document.getElementById('edit-pap-fase-desenvolvimento').checked;
    const fRelatorio = document.getElementById('edit-pap-fase-relatorio').checked;
    const fApresentacao = document.getElementById('edit-pap-fase-apresentacao').checked;

    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
    btn.disabled = true;

    try {
        await setDoc(doc(db, "utilizadores", alunoId), {
            pap: {
                tema: tema,
                orientador: orientador,
                faseTema: fTema,
                faseAprovacao: fAprovacao,
                faseDesenvolvimento: fDesenv,
                faseRelatorio: fRelatorio,
                faseApresentacao: fApresentacao,
                temaAprovado: fAprovacao,
                relatorioAprovado: fRelatorio
            }
        }, { merge: true });

        btn.innerHTML = '<i class="fa-solid fa-check"></i> Alterações Guardadas!';
        carregarEcraProjetosCoord();
        setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; document.getElementById('modal-editar-pap-coord').style.display = 'none'; }, 1500);
    } catch (err) {
        btn.innerHTML = 'Erro ao guardar!';
        setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
    }
}

export async function abrirModalEdicaoFCT(alunoId) {
    const modal = document.getElementById('modal-editar-fct-coord');
    if (!modal) {
        console.error("ERRO: O elemento com o ID 'modal-editar-fct-coord' não existe no HTML!");
        alert("Erro: O modal de edição de FCT não foi encontrado na página HTML.");
        return;
    }

    modal.style.display = 'flex';

    const inputId = document.getElementById('edit-fct-aluno-id');
    const nomeEl = document.getElementById('edit-fct-aluno-nome');
    if (inputId) inputId.value = alunoId;
    if (nomeEl) nomeEl.innerText = "A procurar aluno...";

    document.getElementById('edit-fct-empresa').value = '';
    document.getElementById('edit-fct-orientador').value = '';
    document.getElementById('edit-fct-telefone').value = '';
    document.getElementById('edit-fct-email').value = '';
    document.getElementById('edit-fct-horas').value = '0';

    ['protocolo', 'plano', 'folhas', 'registos', 'avaliacao'].forEach(docId => {
        const chk = document.getElementById(`edit-fct-doc-${docId}`);
        if (chk) chk.checked = false;
    });

    try {
        const alunoSnap = await getDoc(doc(db, "utilizadores", alunoId));
        if (alunoSnap.exists()) {
            const data = alunoSnap.data();
            if (nomeEl) nomeEl.innerText = nomeCurto(data.nome);

            if (data.fct) {
                document.getElementById('edit-fct-empresa').value = data.fct.empresa || '';
                document.getElementById('edit-fct-orientador').value = data.fct.orientadorEntidade || '';
                document.getElementById('edit-fct-telefone').value = data.fct.contactoTelefone || '';
                document.getElementById('edit-fct-email').value = data.fct.contactoEmail || '';
                document.getElementById('edit-fct-horas').value = data.fct.horasRealizadas || 0;

                if (data.fct.burocracia) {
                    ['protocolo', 'plano', 'folhas', 'registos', 'avaliacao'].forEach(docId => {
                        const chk = document.getElementById(`edit-fct-doc-${docId}`);
                        if (chk) chk.checked = (data.fct.burocracia[docId] === 2);
                    });
                }
            }
        }
    } catch (err) {
        console.error("Erro ao carregar dados do aluno para edição:", err);
        if (nomeEl) nomeEl.innerText = "Erro ao carregar dados.";
    }
}

export async function salvarEdicaoFCT(btn) {
    const alunoId = document.getElementById('edit-fct-aluno-id').value;
    if (!alunoId) return;

    const empresa = document.getElementById('edit-fct-empresa').value.trim();
    const orientador = document.getElementById('edit-fct-orientador').value.trim();
    const telefone = document.getElementById('edit-fct-telefone').value.trim();
    const email = document.getElementById('edit-fct-email').value.trim();
    const horas = parseInt(document.getElementById('edit-fct-horas').value) || 0;

    const burocracia = {};
    let todasValidadas = true;
    ['protocolo', 'plano', 'folhas', 'registos', 'avaliacao'].forEach(docId => {
        const isChecked = document.getElementById(`edit-fct-doc-${docId}`).checked;
        burocracia[docId] = isChecked ? 2 : 0;
        if (!isChecked) todasValidadas = false;
    });

    const txtOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
    btn.disabled = true;

    try {
        await setDoc(doc(db, "utilizadores", alunoId), {
            fct: {
                empresa: empresa,
                orientadorEntidade: orientador,
                contactoTelefone: telefone,
                contactoEmail: email,
                horasRealizadas: horas,
                burocracia: burocracia,
                validadoDT: (todasValidadas && horas >= 400) // Assumindo que 400h fecha o estágio se os docs estiverem preenchidos
            }
        }, { merge: true });

        btn.innerHTML = '<i class="fa-solid fa-check"></i> Estágio Atualizado!';
        carregarEcraProjetosCoord();
        setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; document.getElementById('modal-editar-fct-coord').style.display = 'none'; }, 1500);
    } catch (err) {
        btn.innerHTML = 'Erro ao guardar!';
        setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
    }
}

window.abrirModalEdicaoFCT = abrirModalEdicaoFCT;
window.abrirModalEdicaoPAP = abrirModalEdicaoPAP;