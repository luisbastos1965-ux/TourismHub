import { db } from "../../firebase.js";
import { doc, getDoc, getDocs, collection, addDoc, updateDoc, query, where, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state, getDisciplinasPermitidas } from "../store.js";
import { carregarTarefasProf, analisarEAtualizarTurma } from "../ui.js";

export async function gerirCliquesPRHF(e) {
    try {
        if (e.target.closest('#btn-prhf-select-all')) {
            e.preventDefault();
            document.querySelectorAll('.prhf-aluno-check').forEach(chk => { 
                chk.checked = true; 
                const lbl = chk.closest('label'); 
                if (lbl) { lbl.style.background = 'rgba(239, 68, 68, 0.15)'; lbl.style.borderColor = 'var(--danger-red)'; }
            });
            return true;
        }

        if (e.target.closest('#btn-prhf-deselect-all')) {
            e.preventDefault();
            document.querySelectorAll('.prhf-aluno-check').forEach(chk => { 
                chk.checked = false; 
                const lbl = chk.closest('label'); 
                if (lbl) { lbl.style.background = 'rgba(0,0,0,0.2)'; lbl.style.borderColor = '#333'; }
            });
            return true;
        }

        if (e.target.closest('#btn-novo-prhf')) {
            document.getElementById('prhf-modal-title').innerHTML = '<i class="fa-solid fa-file-medical" style="color:var(--danger-red);"></i> Novo PRHF';
            document.getElementById('erro-modal-prhf').style.display = 'none'; 
            document.getElementById('prhf-urgente').checked = false;
            document.getElementById('prhf-edit-id').value = '';
            document.getElementById('prhf-edit-aluno-id').value = '';
            
            document.getElementById('prhf-turma').style.display = 'block';
            document.getElementById('prhf-alunos-bulk-container').style.display = 'block';
            document.getElementById('prhf-edit-aluno-name').style.display = 'none';
            
            document.getElementById('prhf-turma').innerHTML = '<option value="">-- Selecionar Turma --</option>' + state.turmasProfessor.map(t => `<option value="${t}">${t}</option>`).join('');
            document.getElementById('prhf-alunos-bulk-container').innerHTML = '<p class="text-muted center" style="font-size:0.8rem; margin:0;">Selecione primeiro a Turma</p>';
            
            const permitidas = getDisciplinasPermitidas();
            document.getElementById('prhf-disciplina').innerHTML = permitidas.length > 0 ? permitidas.map(dc => `<option value="${dc}">${dc}</option>`).join('') : '<option value="">Sem disciplinas</option>';
            document.getElementById('prhf-modulo').innerHTML = '<option value="">Mod...</option>';
            document.getElementById('prhf-file').value = ''; 
            state.prhfBase64 = null; 
            document.getElementById('prhf-file-name').innerText = 'Toca para PDF ou Imagem';
            document.getElementById('prhf-horas-totais').value = ''; 
            document.getElementById('prhf-horas-presenciais').value = '';

            document.getElementById('btn-apagar-prhf-definitivo').style.display = 'none';
            
            document.getElementById('modal-criar-prhf').style.display = 'flex'; 
            return true;
        }

    // 1. ABRIR O MODAL BONITO DE ELIMINAR PRHF
    if (e.target.closest('#btn-apagar-prhf-definitivo')) {
        e.preventDefault();
        const prhfId = document.getElementById('prhf-edit-id').value;
        const alunoId = document.getElementById('prhf-edit-aluno-id').value;

        if (!prhfId || !alunoId) return true;

        // Passa os dados para os inputs invisíveis do nosso novo modal
        document.getElementById('apagar-prhf-aluno-id').value = alunoId;
        document.getElementById('apagar-prhf-id').value = prhfId;
        
        // Esconde o modal de edição normal e abre o de confirmação vermelho
        document.getElementById('modal-criar-prhf').style.display = 'none';
        document.getElementById('modal-confirm-apagar-prhf').style.display = 'flex';
        return true;
    }

    // 2. EXECUTAR A ELIMINAÇÃO NA BASE DE DADOS (COM REFRESH INSTANTÂNEO)
    if (e.target.closest('#btn-executar-apagar-prhf')) {
        e.preventDefault();
        const btn = e.target.closest('#btn-executar-apagar-prhf');
        const alunoId = document.getElementById('apagar-prhf-aluno-id').value;
        const prhfId = document.getElementById('apagar-prhf-id').value;

        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
        btn.disabled = true;

        try {
            const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
            
            // Apaga da base de dados
            await deleteDoc(doc(window.db || db, "utilizadores", alunoId, "prhfs", prhfId));
            
            // Fecha o modal de confirmação
            document.getElementById('modal-confirm-apagar-prhf').style.display = 'none';
            btn.innerHTML = 'Sim, Eliminar';
            btn.disabled = false;
            
            // --- MAGIA INSTANTÂNEA ---
            // 1. Remove o cartão visualmente do ecrã de imediato (sem esperar pelo fetch)
            // (Procura o cartão que tinha o botão de editar com este id de aluno/prhf e apaga-o)
            const cartaoPRHF = document.querySelector(`.btn-edit-prhf[data-prhf="${prhfId}"]`)?.closest('.card');
            if (cartaoPRHF) {
                cartaoPRHF.style.transition = '0.3s';
                cartaoPRHF.style.transform = 'scale(0.9)';
                cartaoPRHF.style.opacity = '0';
                setTimeout(() => cartaoPRHF.remove(), 300);
            }

            // 2. Dispara a função para revalidar a lista de fundo em background
            if (window.carregarTarefasProf) {
                window.carregarTarefasProf();
            }
            // --------------------------

        } catch(err) {
            console.error("Erro ao apagar PRHF:", err);
            alert("Erro ao tentar eliminar o PRHF da base de dados.");
            btn.innerHTML = 'Sim, Eliminar';
            btn.disabled = false;
        }
        return true;
    }

        if (e.target.closest('.btn-edit-prhf')) {
            const btn = e.target.closest('.btn-edit-prhf');
            const pId = btn.getAttribute('data-prhf');
            const aId = btn.getAttribute('data-aluno');
            
            document.getElementById('prhf-modal-title').innerHTML = '<i class="fa-solid fa-pen" style="color:var(--warning-yellow);"></i> Editar PRHF';
            document.getElementById('erro-modal-prhf').style.display = 'none';
            
            document.getElementById('prhf-edit-id').value = pId;
            document.getElementById('prhf-edit-aluno-id').value = aId;
            document.getElementById('prhf-turma').style.display = 'none';
            document.getElementById('prhf-alunos-bulk-container').style.display = 'none';
            
            const nameCont = document.getElementById('prhf-edit-aluno-name');
            nameCont.style.display = 'block';
            nameCont.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A carregar dados...';
            
            document.getElementById('btn-apagar-prhf-definitivo').style.display = 'block';

            document.getElementById('modal-criar-prhf').style.display = 'flex';
            
            try {
                const pSnap = await getDoc(doc(db, "utilizadores", aId, "prhfs", pId));
                if(pSnap.exists()) {
                    const data = pSnap.data();
                    const uSnap = await getDoc(doc(db, "utilizadores", aId));
                    const nomeAluno = uSnap.exists() ? uSnap.data().nome : "Aluno";
                    
                    nameCont.innerText = `A editar plano de: ${nomeAluno}`;
                    const permitidas = getDisciplinasPermitidas();
                    document.getElementById('prhf-disciplina').innerHTML = permitidas.length > 0 ? permitidas.map(dc => `<option value="${dc}" ${dc === data.disciplina ? 'selected' : ''}>${dc}</option>`).join('') : '<option value="">Sem disciplinas</option>';
                    document.getElementById('prhf-modulo').innerHTML = `<option value="${data.modulo}">Módulo ${data.modulo}</option>`;
                    document.getElementById('prhf-horas-totais').value = data.horasTotais || '';
                    document.getElementById('prhf-horas-presenciais').value = data.horasPresenciais !== undefined ? data.horasPresenciais : '';
                    document.getElementById('prhf-urgente').checked = data.urgente || false;
                    document.getElementById('prhf-prazo').value = data.prazo || '';
                    document.getElementById('prhf-descricao').value = data.descricao || '';
                    
                    if (data.ficheiroBase64) {
                        state.prhfBase64 = data.ficheiroBase64;
                        document.getElementById('prhf-file-name').innerText = "Ficheiro Anexado (Toca para trocar)";
                    } else {
                        state.prhfBase64 = null;
                        document.getElementById('prhf-file-name').innerText = "Toca para PDF ou Imagem";
                    }
                }
            } catch(err) {
                nameCont.innerText = "Erro ao carregar os dados.";
            }
            return true;
        }

        if (e.target.closest('#btn-gravar-novo-prhf')) { 
            const isEdit = document.getElementById('prhf-edit-id').value !== '';
            const aIdEdit = document.getElementById('prhf-edit-aluno-id').value;
            const tDisc = document.getElementById('prhf-disciplina').value; 
            const tMod = document.getElementById('prhf-modulo').value; 
            const tPrazo = document.getElementById('prhf-prazo').value; 
            const tHorasT = document.getElementById('prhf-horas-totais').value; 
            const tDesc = document.getElementById('prhf-descricao').value.trim(); 
            const urg = document.getElementById('prhf-urgente').checked; 
            const errDiv = document.getElementById('erro-modal-prhf'); 
            
            let tHorasP = document.getElementById('prhf-horas-presenciais').value;
            if (tHorasP === '') {
                const val = parseInt(tHorasT) || 0;
                tHorasP = val <= 4 ? 0 : Math.ceil(val * 0.3);
            }
            
            let alunosSelecionados = [];
            if (isEdit) {
                alunosSelecionados = [aIdEdit]; 
            } else {
                const chks = document.querySelectorAll('.prhf-aluno-check:checked');
                alunosSelecionados = Array.from(chks).map(c => c.value);
            }

            if (alunosSelecionados.length === 0) {
                alert("Atenção: Não selecionaste nenhum aluno! Pica os nomes na lista ou clica em 'Selecionar Todos'.");
                return true;
            }
            if (!tDisc || !tMod || tHorasT === '' || !tPrazo || !tDesc) { 
                alert("Erro: Faltam campos obrigatórios! Verifica o Módulo, as Horas Totais, o Prazo e a Descrição da tarefa.");
                return true; 
            }
            
            const b = e.target.closest('#btn-gravar-novo-prhf'); 
            b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...'; 
            b.disabled = true; 
            
            try { 
                if (isEdit) {
                    await updateDoc(doc(db, "utilizadores", aIdEdit, "prhfs", document.getElementById('prhf-edit-id').value), {
                        disciplina: tDisc, modulo: Number(tMod), prazo: tPrazo, horasTotais: Number(tHorasT), 
                        horasPresenciais: Number(tHorasP), descricao: tDesc, urgente: urg, ficheiroBase64: state.prhfBase64
                    });
                } else {
                    for(const aId of alunosSelecionados) {
                        await addDoc(collection(db, "utilizadores", aId, "prhfs"), { 
                            disciplina: tDisc, modulo: Number(tMod), prazo: tPrazo, horasTotais: Number(tHorasT), 
                            horasPresenciais: Number(tHorasP), descricao: tDesc, status: 'ativa',
                            dataCriacao: new Date().toISOString(), professor: state.myUserName, 
                            ficheiroBase64: state.prhfBase64, urgente: urg, presencaValidada: false 
                        }); 

                        await addDoc(collection(db, "utilizadores", aId, "notificacoes"), {
                            titulo: "Novo PRHF a " + tDisc,
                            mensagem: `O professor ${state.myUserName} atribuiu-te um plano de recuperação (Módulo ${tMod}).`,
                            lida: false, data: Date.now(), tipo: "prhf"
                        });
                    }
                }
                
                const querGuardarTemplate = document.getElementById('prhf-save-template').checked;
                const nomeTemplate = document.getElementById('prhf-nome-template').value.trim();
                
                if (querGuardarTemplate && nomeTemplate !== "") {
                    try {
                        const templateRef = doc(collection(db, "utilizadores", state.myUserId, "templates_prhf"));
                        await setDoc(templateRef, {
                            nome: nomeTemplate,
                            descricao: tDesc,
                            horasTotais: Number(tHorasT),
                            horasPresenciais: Number(tHorasP),
                            dataCriacao: new Date().toISOString()
                        });
                    } catch (err) {}
                }

                b.innerHTML = '<i class="fa-solid fa-check"></i> ' + (isEdit ? 'Atualizado!' : 'Criados!'); 
                setTimeout(() => { 
                    b.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gravar PRHF'; 
                    b.disabled = false; 
                    document.getElementById('modal-criar-prhf').style.display = 'none'; 
                    carregarTarefasProf(); 
                    if(state.selectedTurma && !isEdit) analisarEAtualizarTurma(state.selectedTurma); 
                }, 1500); 
            } catch (err) { 
                errDiv.innerText = "Erro na gravação. Tenta novamente."; 
                errDiv.style.display = 'block'; 
                b.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Gravar PRHF'; 
                b.disabled = false; 
            } 
            return true; 
        }

        // ==========================================
        // FLUXO DE NEGOCIAÇÃO DE HORÁRIO (MÚLTIPLOS DIAS)
        // ==========================================
        
        if (e.target.closest('.btn-propor-prof')) {
            const btn = e.target.closest('.btn-propor-prof');
            const alunoId = btn.getAttribute('data-aluno');
            const prhfId = btn.getAttribute('data-prhf');

            document.getElementById('prop-prof-aluno-id').value = alunoId;
            document.getElementById('prop-prof-prhf-id').value = prhfId;
            document.getElementById('prop-prof-data').value = '';
            document.getElementById('prop-prof-inicio').value = '';
            document.getElementById('prop-prof-fim').value = '';
            document.getElementById('prop-prof-tarefa').value = '';

            const modal = document.getElementById('modal-propor-prhf-prof');
            if(modal) modal.style.display = 'flex';

            const agendaCont = document.getElementById('mini-agenda-aluno');
            agendaCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; margin:0;"><i class="fa-solid fa-spinner fa-spin"></i> A ler agenda...</p>';

            try {
                const prhfSnap = await getDocs(collection(db, "utilizadores", alunoId, "prhfs"));
                let compromissos = [];
                const hojeStr = new Date().toISOString().split('T')[0];

                prhfSnap.forEach(p => {
                    const dados = p.data();
                    if (dados && dados.status !== 'concluida') {
                        if (dados.sessoesPresenciais && Array.isArray(dados.sessoesPresenciais)) {
                            dados.sessoesPresenciais.forEach(s => {
                                if (s && s.data && s.data >= hojeStr) {
                                    compromissos.push({
                                        disciplina: dados.disciplina || 'Outra',
                                        data: s.data,
                                        hora: `${s.inicio || '--:--'} às ${s.fim || '--:--'}`,
                                        isMeu: p.id === prhfId,
                                        tarefa: s.tarefa || ''
                                    });
                                }
                            });
                        }
                    }
                });

                if (compromissos.length === 0) {
                    agendaCont.innerHTML = '<p style="color:var(--success-green); font-size:0.85rem; margin:0; text-align:center;"><i class="fa-solid fa-check"></i> O aluno não tem marcações futuras.</p>';
                } else {
                    let htmlAgenda = '';
                    compromissos.forEach(c => {
                        const cor = c.isMeu ? 'var(--primary-green)' : 'var(--warning-yellow)';
                        const dataPt = c.data && c.data.includes('-') ? c.data.split('-').reverse().join('/') : (c.data || '');
                        htmlAgenda += `
                        <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.05); padding:6px 10px; border-radius:6px; border-left: 2px solid ${cor}; margin-bottom:5px;">
                            <span style="color:white; font-size:0.8rem;">${c.disciplina} (${c.isMeu ? 'Este Plano' : 'Outro'})</span>
                            <span style="color:var(--text-light); font-size:0.8rem; font-weight:bold;">${dataPt} (${c.hora})</span>
                        </div>`;
                        if (c.tarefa) {
                            htmlAgenda += `<div style="font-size:0.75rem; color:var(--text-muted); padding-left:10px; margin-bottom:5px;">Tarefa: ${c.tarefa}</div>`;
                        }
                    });
                    agendaCont.innerHTML = htmlAgenda;
                }
            } catch(err) {
                agendaCont.innerHTML = '<p style="color:var(--warning-yellow); font-size:0.8rem; margin:0; text-align:center;">Sem marcações futuras registadas.</p>';
            }
            return true;
        }

        if (e.target.closest('#btn-confirmar-proposta-prof')) {
            const alunoId = document.getElementById('prop-prof-aluno-id').value;
            const prhfId = document.getElementById('prop-prof-prhf-id').value;
            const data = document.getElementById('prop-prof-data').value;
            const inicio = document.getElementById('prop-prof-inicio').value;
            const fim = document.getElementById('prop-prof-fim').value;
            const tarefa = document.getElementById('prop-prof-tarefa').value ? document.getElementById('prop-prof-tarefa').value.trim() : "";

            if (!data || !inicio || !fim) {
                alert("Preenche a data, hora de início e hora de fim.");
                return true;
            }

            // Calcular horas da sessão (arredondadas com proteção para a meia-noite)
            const [hIni, mIni] = inicio.split(':').map(Number);
            const [hFim, mFim] = fim.split(':').map(Number);
            
            let hI = hIni, hF = hFim;
            if (hF < hI) hF += 24; 
            
            const diffMinutos = (hF * 60 + mFim) - (hI * 60 + mIni);
            const horasSessao = Math.max(1, Math.round(diffMinutos / 60));

            // --- VALIDAÇÃO DE CONFLITOS ESTRITA ---
            try {
                const prhfSnap = await getDocs(collection(db, "utilizadores", alunoId, "prhfs"));
                let conflitoEncontrado = false;

                prhfSnap.forEach(p => {
                    const dados = p.data();
                    if (dados && dados.status !== 'concluida') {
                        let blocosComparacao = [];
                        if (dados.sessoesPresenciais && Array.isArray(dados.sessoesPresenciais)) {
                            blocosComparacao = dados.sessoesPresenciais;
                        }

                        blocosComparacao.forEach(existente => {
                            if (p.id === prhfId) return; // Permite acumular no mesmo plano
                            if (existente && existente.data === data && existente.inicio && existente.fim) {
                                // Verifica sobreposição de horários
                                if (inicio < existente.fim && existente.inicio < fim) {
                                    conflitoEncontrado = true;
                                }
                            }
                        });
                    }
                });

                if (conflitoEncontrado) {
                    alert("⚠️️ Conflito de Horário Detetado!\n\nO aluno já tem outra sessão presencial agendada para esse mesmo dia e horário noutro plano.");
                    return true;
                }
            } catch(err) {
                console.error("Erro na validação de conflitos:", err);
            }
            // ---------------------------------------

            const btn = e.target.closest('#btn-confirmar-proposta-prof');
            const txtOriginal = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
            btn.disabled = true;

            try {
                const prhfRef = doc(db, "utilizadores", alunoId, "prhfs", prhfId);
                const docSnap = await getDoc(prhfRef);
                let sessoesAtuais = [];

                if (docSnap.exists() && docSnap.data().sessoesPresenciais && Array.isArray(docSnap.data().sessoesPresenciais)) {
                    sessoesAtuais = [...docSnap.data().sessoesPresenciais];
                }

                // Adiciona a nova sessão proposta pelo professor como 'aceite' (verde) e empilha na lista
                sessoesAtuais.push({ data, inicio, fim, tarefa, horas: horasSessao, status: 'aceite' });
                const propostaString = sessoesAtuais.map(s => `${s.data} das ${s.inicio} às ${s.fim} (${s.horas}h)`).join(' | ');

                await updateDoc(prhfRef, {
                    sessoesPresenciais: sessoesAtuais,
                    propostaProfessor: propostaString,
                    tarefaPresencial: tarefa || (docSnap.exists() ? docSnap.data().tarefaPresencial : ''),
                    propostaLidaDT: true // Fica imediatamente validado porque foi o professor a mandar
                });
                
                document.getElementById('modal-propor-prhf-prof').style.display = 'none';
                btn.innerHTML = txtOriginal;
                btn.disabled = false;
                carregarTarefasProf(); 
            } catch(err) {
                console.error("Erro ao gravar sugestão:", err);
                alert("Erro ao gravar sugestão. Tenta novamente.");
                btn.innerHTML = txtOriginal;
                btn.disabled = false;
            }
            return true;
        }

        // NOVO: Professor Eliminar Proposta (Abre o modal)
        if (e.target.closest('.btn-eliminar-proposta')) {
            const btn = e.target.closest('.btn-eliminar-proposta');
            const aId = btn.getAttribute('data-aluno');
            const pId = btn.getAttribute('data-prhf');
            
            document.getElementById('anular-prop-aluno-id').value = aId;
            document.getElementById('anular-prop-prhf-id').value = pId;
            
            const modalConfirm = document.getElementById('modal-confirm-anular-proposta');
            if (modalConfirm) modalConfirm.style.display = 'flex';
            return true;
        }

        // NOVO: Confirma a anulação através do modal
        if (e.target.closest('#btn-executar-anular-proposta')) {
            const aId = document.getElementById('anular-prop-aluno-id').value;
            const pId = document.getElementById('anular-prop-prhf-id').value;
            const btn = e.target.closest('#btn-executar-anular-proposta');
            
            const txtOriginal = btn.innerHTML;
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            btn.disabled = true;
            
            try {
                await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), {
                    propostaProfessor: null,
                    propostaAluno: null,
                    tarefaPresencial: null,
                    propostaLidaDT: false
                });
                document.getElementById('modal-confirm-anular-proposta').style.display = 'none';
                btn.innerHTML = txtOriginal;
                btn.disabled = false;
                carregarTarefasProf();
            } catch(err) { 
                btn.innerHTML = 'Erro!';
                setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
            }
            return true;
        }

        if (e.target.closest('.btn-aceitar-proposta')) {
            const btn = e.target.closest('.btn-aceitar-proposta');
            const aId = btn.getAttribute('data-aluno');
            const pId = btn.getAttribute('data-prhf');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
            try {
                const prhfRef = doc(db, "utilizadores", aId, "prhfs", pId);
                const docSnap = await getDoc(prhfRef);
                let updateData = { propostaLidaDT: true };
                
                if (docSnap.exists() && docSnap.data().sessoesPresenciais) {
                    // Passa todas as sessões para estado 'aceite'
                    const sessoes = docSnap.data().sessoesPresenciais.map(s => ({...s, status: 'aceite'}));
                    updateData.sessoesPresenciais = sessoes;
                }
                
                await updateDoc(prhfRef, updateData); 
                carregarTarefasProf();
            } catch(err) { btn.innerHTML = "Erro"; btn.disabled = false; }
            return true;
        }

        if (e.target.closest('.btn-rejeitar-proposta')) {
            const btn = e.target.closest('.btn-rejeitar-proposta');
            const aId = btn.getAttribute('data-aluno');
            const pId = btn.getAttribute('data-prhf');
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
            try {
                const prhfRef = doc(db, "utilizadores", aId, "prhfs", pId);
                const docSnap = await getDoc(prhfRef);
                let updateData = { propostaAluno: null };
                
                if (docSnap.exists() && docSnap.data().sessoesPresenciais) {
                    // Retira apenas as pendentes e mantém as que já tinham sido aceites!
                    const sessoes = docSnap.data().sessoesPresenciais.filter(s => s.status === 'aceite');
                    updateData.sessoesPresenciais = sessoes;
                }
                
                await updateDoc(prhfRef, updateData);
                carregarTarefasProf();
            } catch(err) { btn.innerHTML = "Erro"; btn.disabled = false; }
            return true;
        }

        // ==========================================
        // FECHAR PLANOS
        // ==========================================
        if (e.target.closest('.btn-validar-presenca')) { 
            const btn = e.target.closest('.btn-validar-presenca'); 
            const aId = btn.getAttribute('data-aluno'); 
            const pId = btn.getAttribute('data-prhf'); 
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; 
            try { await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { presencaValidada: true }); carregarTarefasProf(); } catch (err) { btn.innerHTML = "Erro"; btn.disabled = false; } 
            return true; 
        }

        if (e.target.closest('.btn-concluir-prhf')) { 
            const btn = e.target.closest('.btn-concluir-prhf'); 
            document.getElementById('conc-aluno-id').value = btn.getAttribute('data-aluno'); 
            document.getElementById('conc-prhf-id').value = btn.getAttribute('data-prhf'); 
            document.getElementById('conc-motivo').value = ''; 
            document.getElementById('modal-concluir-prhf').style.display = 'flex'; 
            return true; 
        }

        if (e.target.closest('#btn-confirmar-conclusao-prhf')) { 
            const aId = document.getElementById('conc-aluno-id').value; 
            const pId = document.getElementById('conc-prhf-id').value; 
            const feedback = document.getElementById('conc-motivo').value.trim() || "Concluído com sucesso."; 
            const b = e.target.closest('#btn-confirmar-conclusao-prhf'); 
            b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; b.disabled = true; 
            try { 
                await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { status: 'concluida', feedbackProfessor: feedback }); 
                b.innerHTML = '<i class="fa-solid fa-check"></i> Plano Fechado'; 
                setTimeout(() => { b.innerHTML = 'Aprovar e Fechar Plano'; b.disabled = false; document.getElementById('modal-concluir-prhf').style.display = 'none'; carregarTarefasProf(); if(state.selectedTurma) analisarEAtualizarTurma(state.selectedTurma); }, 1500); 
            } catch (err) { b.innerHTML = "Erro"; setTimeout(() => b.disabled = false, 1500); } 
            return true; 
        }

        return false;
    } catch (error) {
        console.error("Erro no PRHF:", error);
        return false;
    }
}

// ==========================================
// FUNÇÕES AUXILIARES DE SESSÕES MÚLTIPLAS
// ==========================================
window.renderizarLinhasSessoes = function(arraySessoes) {
    const container = document.getElementById('container-sessoes-dinamicas');
    if (!container) return;

    let html = '';
    arraySessoes.forEach((s, idx) => {
        html += `
        <div class="sessao-item-linha" style="background: rgba(0,0,0,0.2); border: 1px solid #444; border-radius: 8px; padding: 12px; position: relative; margin-bottom: 8px;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                <span style="font-size:0.75rem; color:var(--primary-green); font-weight:bold;">Sessão Presencial #${idx + 1}</span>
                <button type="button" class="btn-remover-sessao-linha" style="background:none; border:none; color:var(--danger-red); cursor:pointer; font-size:0.9rem;" title="Remover"><i class="fa-solid fa-trash"></i></button>
            </div>
            
            <div style="display: flex; gap: 8px; margin-bottom: 8px;">
                <div style="flex: 2;"><label style="font-size:0.7rem; color:var(--text-muted);">Data</label><input type="date" value="${s.data || ''}" class="input-padrao input-data-sessao" style="width:100%; margin:0; font-size:0.85rem;"></div>
                <div style="flex: 1;"><label style="font-size:0.7rem; color:var(--text-muted);">Início</label><input type="time" value="${s.inicio || ''}" class="input-padrao input-inicio-sessao" style="width:100%; margin:0; font-size:0.85rem;"></div>
                <div style="flex: 1;"><label style="font-size:0.7rem; color:var(--text-muted);">Fim</label><input type="time" value="${s.fim || ''}" class="input-padrao input-fim-sessao" style="width:100%; margin:0; font-size:0.85rem;"></div>
            </div>
            
            <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:3px;">Tarefa para esta aula específica (Opcional)</label>
            <input type="text" value="${s.tarefa || ''}" placeholder="Ex: Resolver exercícios 1 a 5 da ficha..." class="input-padrao input-tarefa-sessao" style="width:100%; margin:0; font-size:0.85rem;">
        </div>`;
    });
    container.innerHTML = html;
};

window.adicionarLinhaSessaoModal = function() {
    const container = document.getElementById('container-sessoes-dinamicas');
    if (!container) return;

    const div = document.createElement('div');
    const idx = container.querySelectorAll('.sessao-item-linha').length + 1;
    div.className = 'sessao-item-linha';
    div.style.cssText = 'background: rgba(0,0,0,0.2); border: 1px solid #444; border-radius: 8px; padding: 12px; position: relative; margin-bottom: 8px;';
    div.innerHTML = `
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
            <span style="font-size:0.75rem; color:var(--primary-green); font-weight:bold;">Sessão Presencial #${idx}</span>
            <button type="button" class="btn-remover-sessao-linha" style="background:none; border:none; color:var(--danger-red); cursor:pointer; font-size:0.9rem;" title="Remover"><i class="fa-solid fa-trash"></i></button>
        </div>
        
        <div style="display: flex; gap: 8px; margin-bottom: 8px;">
            <div style="flex: 2;"><label style="font-size:0.7rem; color:var(--text-muted);">Data</label><input type="date" class="input-padrao input-data-sessao" style="width:100%; margin:0; font-size:0.85rem;"></div>
            <div style="flex: 1;"><label style="font-size:0.7rem; color:var(--text-muted);">Início</label><input type="time" class="input-padrao input-inicio-sessao" style="width:100%; margin:0; font-size:0.85rem;"></div>
            <div style="flex: 1;"><label style="font-size:0.7rem; color:var(--text-muted);">Fim</label><input type="time" class="input-padrao input-fim-sessao" style="width:100%; margin:0; font-size:0.85rem;"></div>
        </div>
        
        <label style="font-size:0.7rem; color:var(--text-muted); display:block; margin-bottom:3px;">Tarefa para esta aula específica (Opcional)</label>
        <input type="text" placeholder="Ex: Resolver exercícios 1 a 5 da ficha..." class="input-padrao input-tarefa-sessao" style="width:100%; margin:0; font-size:0.85rem;">
    `;
    container.appendChild(div);
};