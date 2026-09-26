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
            
            alunosAvaliados.sort((a,b) => {
                const hA = a.fct?.horasRealizadas || 0;
                const hB = b.fct?.horasRealizadas || 0;
                if (hA !== hB) return hA - hB;
                return a.nome.localeCompare(b.nome);
            });
            
            alunosAvaliados.forEach(al => {
                const horas = al.fct?.horasRealizadas || 0;
                let statusColor = '#333';
                let barraWidth = (horas / 400) * 100;
                if(barraWidth > 100) barraWidth = 100;

                if(horas === 0) statusColor = 'var(--danger-red)';
                else if(al.fct?.validadoDT) statusColor = 'var(--success-green)';
                else statusColor = 'var(--warning-yellow)';

                const docsRef = [
                    { id: 'protocolo', nome: 'Protocolo de Estágio' },
                    { id: 'plano', nome: 'Plano de Estágio' },
                    { id: 'folhas', nome: 'Folhas de Registo' },
                    { id: 'registos', nome: 'Registos do Tutor' },
                    { id: 'avaliacao', nome: 'Avaliações Finais' }
                ];
                
                let burocHtml = '<div style="margin-top:15px; padding-top:10px; border-top:1px dashed #333; display:flex; flex-direction:column; gap:5px;">';
                docsRef.forEach(d => {
                    let st = al.fct?.burocracia?.[d.id] || 0;
                    let act = '';
                    if(st === 0) act = '<span style="color:var(--text-muted); font-size:0.7rem;"><i class="fa-solid fa-xmark"></i> Pendente</span>';
                    else act = '<span style="color:var(--success-green); font-size:0.75rem; font-weight:bold;"><i class="fa-solid fa-check-double"></i> Validado</span>';
                    burocHtml += `<div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; background:rgba(0,0,0,0.2); padding:8px 10px; border-radius:4px;"><span style="color:var(--text-light);">${d.nome}</span>${act}</div>`;
                });
                burocHtml += '</div>';

                let btnEditarFCT = state.activeRole === 'coordenador' ? `<button class="secondary-btn small-btn btn-editar-fct-coord" data-id="${al.id}" style="margin-top:10px; width:100%; border-color:#0ea5e9; color:#0ea5e9;"><i class="fa-solid fa-pen"></i> Editar Entidade / Horas</button>` : '';

                html += `
                <div class="card aluno-list-item" style="border-left: 4px solid ${statusColor}; padding: 15px; margin-bottom: 15px; cursor:default;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                        <div style="flex:1;">
                            <strong style="color:white; font-size:1.1rem;">${nomeCurto(al.nome)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span>
                            <div style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">
                                Entidade: <strong style="color:#0ea5e9;">${al.fct?.empresa || 'Não definida'}</strong>
                                ${al.fct?.orientadorEntidade ? `<br>Tutor: <span style="color:var(--text-muted);">${al.fct.orientadorEntidade}</span>` : ''}
                                ${al.fct?.contactoTelefone ? `<br><i class="fa-solid fa-phone"></i> ${al.fct.contactoTelefone}` : ''}
                            </div>
                        </div>
                        <div style="text-align:right;">
                            <strong style="color:${statusColor}; font-size:1.3rem; display:block;">${horas}h</strong>
                        </div>
                    </div>
                    <div style="height: 6px; width: 100%; background: #222; border-radius: 3px; overflow:hidden;">
                        <div style="height: 100%; width: ${barraWidth}%; background: ${statusColor}; transition:0.3s;"></div>
                    </div>
                    ${burocHtml}
                    ${btnEditarFCT}
                </div>`;
            });

        } else {
            // Tab PAP
            alunosAvaliados.sort((a,b) => a.nome.localeCompare(b.nome));

            alunosAvaliados.forEach(al => {
                let txtStatus = '<i class="fa-solid fa-triangle-exclamation"></i> Por Iniciar';
                let statusColor = 'var(--danger-red)';

                if (al.pap?.faseApresentacao) { txtStatus = '<i class="fa-solid fa-award"></i> Apresentação Concluída'; statusColor = 'var(--success-green)'; } 
                else if (al.pap?.faseRelatorio || al.pap?.relatorioAprovado) { txtStatus = '<i class="fa-solid fa-flag-checkered"></i> Apto para Defesa'; statusColor = 'var(--success-green)'; } 
                else if (al.pap?.faseDesenvolvimento) { txtStatus = '<i class="fa-solid fa-laptop-code"></i> Em Desenvolvimento'; statusColor = '#00d2ff'; } 
                else if (al.pap?.faseAprovacao || al.pap?.temaAprovado) { txtStatus = '<i class="fa-solid fa-check"></i> Tema Aprovado'; statusColor = 'var(--warning-yellow)'; } 
                else if (al.pap?.faseTema || al.pap?.tema) { txtStatus = '<i class="fa-solid fa-magnifying-glass"></i> Tema Escolhido'; statusColor = 'var(--warning-yellow)'; }

                let btnEditar = state.activeRole === 'coordenador' ? `<button class="secondary-btn small-btn btn-editar-pap-coord" data-id="${al.id}" style="margin-top:10px; width:100%; border-color:#9333ea; color:#9333ea;"><i class="fa-solid fa-pen"></i> Editar Fases / Orientador</button>` : '';

                html += `
                <div class="card aluno-list-item" data-id="${al.id}" style="border-left: 4px solid ${statusColor}; padding: 15px; margin-bottom: 12px; cursor:default;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="flex:1;">
                            <strong style="color:white; font-size:1.1rem;">${nomeCurto(al.nome)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span>
                            <div style="font-size:0.85rem; color:var(--text-light); margin-top:8px;">Orientador: ${al.pap?.orientador ? `<strong style="color:var(--accent-purple);">${nomeCurto(al.pap.orientador)}</strong>` : '<strong style="color:var(--danger-red);">Sem Orientador</strong>'}</div>
                            <div style="font-size:0.85rem; color:var(--text-light); margin-top:4px;">Tema: <strong style="color:white;">${al.pap?.tema || 'Não definido'}</strong></div>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:0.75rem; color:${statusColor}; font-weight:bold;">${txtStatus}</span>
                        </div>
                    </div>
                    ${btnEditar}
                </div>`;
            });
        }

        container.innerHTML = html === '' ? '<p class="text-muted center">Sem dados para mostrar.</p>' : html;

    } catch (err) {
        console.error(err);
        container.innerHTML = '<p class="text-danger center">Erro a carregar projetos.</p>';
    }
}

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
        if(alunoSnap.exists()) {
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
    } catch(err) {
        document.getElementById('edit-pap-aluno-nome').innerText = "Erro ao carregar dados.";
    }
}

export async function salvarEdicaoPAP(btn) {
    const alunoId = document.getElementById('edit-pap-aluno-id').value;
    if(!alunoId) return;

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
    } catch(err) {
        btn.innerHTML = 'Erro ao guardar!';
        setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
    }
}

export async function abrirModalEdicaoFCT(alunoId) {
    document.getElementById('modal-editar-fct-coord').style.display = 'flex';
    document.getElementById('edit-fct-aluno-id').value = alunoId;
    document.getElementById('edit-fct-aluno-nome').innerText = "A procurar aluno...";
    
    document.getElementById('edit-fct-empresa').value = '';
    document.getElementById('edit-fct-orientador').value = '';
    document.getElementById('edit-fct-telefone').value = '';
    document.getElementById('edit-fct-email').value = '';
    document.getElementById('edit-fct-horas').value = '0';
    
    ['protocolo', 'plano', 'folhas', 'registos', 'avaliacao'].forEach(docId => {
        document.getElementById(`edit-fct-doc-${docId}`).checked = false;
    });

    try {
        const alunoSnap = await getDoc(doc(db, "utilizadores", alunoId));
        if(alunoSnap.exists()) {
            const data = alunoSnap.data();
            document.getElementById('edit-fct-aluno-nome').innerText = nomeCurto(data.nome);
            
            if (data.fct) {
                document.getElementById('edit-fct-empresa').value = data.fct.empresa || '';
                document.getElementById('edit-fct-orientador').value = data.fct.orientadorEntidade || '';
                document.getElementById('edit-fct-telefone').value = data.fct.contactoTelefone || '';
                document.getElementById('edit-fct-email').value = data.fct.contactoEmail || '';
                document.getElementById('edit-fct-horas').value = data.fct.horasRealizadas || 0;
                
                if (data.fct.burocracia) {
                    ['protocolo', 'plano', 'folhas', 'registos', 'avaliacao'].forEach(docId => {
                        document.getElementById(`edit-fct-doc-${docId}`).checked = (data.fct.burocracia[docId] === 2);
                    });
                }
            }
        }
    } catch(err) {
        document.getElementById('edit-fct-aluno-nome').innerText = "Erro ao carregar dados.";
    }
}

export async function salvarEdicaoFCT(btn) {
    const alunoId = document.getElementById('edit-fct-aluno-id').value;
    if(!alunoId) return;

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
    } catch(err) {
        btn.innerHTML = 'Erro ao guardar!';
        setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
    }
}