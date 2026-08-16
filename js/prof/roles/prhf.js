import { db } from "./firebase.js";
import { doc, getDoc, collection, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
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
            
            document.getElementById('modal-criar-prhf').style.display = 'flex'; 
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
                    document.getElementById('prhf-horas-presenciais').value = data.horasPresenciais || '';
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
            const tHorasP = document.getElementById('prhf-horas-presenciais').value; 
            const tDesc = document.getElementById('prhf-descricao').value.trim(); 
            const urg = document.getElementById('prhf-urgente').checked; 
            const errDiv = document.getElementById('erro-modal-prhf'); 
            
            let alunosSelecionados = [];
            if (isEdit) {
                alunosSelecionados = [aIdEdit]; 
            } else {
                const chks = document.querySelectorAll('.prhf-aluno-check:checked');
                alunosSelecionados = Array.from(chks).map(c => c.value);
            }

            if (alunosSelecionados.length === 0 || !tDisc || !tMod || !tHorasT || !tPrazo || !tDesc) { 
                errDiv.innerText = "Por favor, preenche todos os campos obrigatórios."; 
                errDiv.style.display = 'block'; 
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
                            horasPresenciais: Number(tHorasP), descricao: tDesc, status: 'pendente', 
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

        if (e.target.closest('.btn-validar-presenca')) { 
            const btn = e.target.closest('.btn-validar-presenca'); 
            const aId = btn.getAttribute('data-aluno'); 
            const pId = btn.getAttribute('data-prhf'); 
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; 
            try { await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { presencaValidada: true }); carregarTarefasProf(); } catch (err) { btn.innerHTML = "Erro"; btn.disabled = false; } 
            return true; 
        }

        if (e.target.closest('.btn-propor-prof')) { 
            const btn = e.target.closest('.btn-propor-prof'); 
            document.getElementById('prop-prof-aluno-id').value = btn.getAttribute('data-aluno'); 
            document.getElementById('prop-prof-prhf-id').value = btn.getAttribute('data-prhf'); 
            document.getElementById('prop-prof-data').value = ''; document.getElementById('prop-prof-inicio').value = ''; document.getElementById('prop-prof-fim').value = ''; 
            document.getElementById('modal-propor-prhf-prof').style.display = 'flex'; 
            return true; 
        }

        if (e.target.closest('#btn-confirmar-proposta-prof')) { 
            const aId = document.getElementById('prop-prof-aluno-id').value; 
            const pId = document.getElementById('prop-prof-prhf-id').value; 
            const pd = document.getElementById('prop-prof-data').value; const pi = document.getElementById('prop-prof-inicio').value; const pf = document.getElementById('prop-prof-fim').value; 
            if(!pd || !pi || !pf) return true; 
            
            const btn = e.target.closest('#btn-confirmar-proposta-prof'); 
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; 
            try { 
                await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { propostaProfessor: `Dia ${pd.split('-').reverse().join('/')} das ${pi} às ${pf}` }); 
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Sugerido'; 
                setTimeout(() => { btn.innerHTML = 'Sugerir Horário'; btn.disabled = false; document.getElementById('modal-propor-prhf-prof').style.display = 'none'; carregarTarefasProf(); }, 1500); 
            } catch(err) { btn.innerHTML = 'Erro'; setTimeout(()=>btn.disabled=false, 1500); } 
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
