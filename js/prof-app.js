import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, addDoc, updateDoc, deleteDoc, setDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

import { state, getDisciplinasPermitidas, nomeCurto } from "./prof/store.js";
import { gerarRadarConflitos } from "./prof/roles/dt.js";
import { validarFCT } from "./prof/roles/coord.js"; 
import { aprovarTemaPAP, rejeitarTemaPAPExecutar, aprovarRelatorioPAP } from "./prof/roles/pap.js";
import { carregarRadarProfessor, analisarEAtualizarTurma, renderizarPautaTurma, renderizarFaltasTurma, desenharGraficoAluno, abrirPerfil360Aluno, carregarTarefasProf, carregarForunsProf, abrirChatForum, atualizarDropdownModulos, filtrarDisciplinasDoAno } from "./prof/ui.js";

import { carregarEcraOrientandos, carregarEcraDiario, prepararModalNovaSessao } from "./prof/roles/pap-diario.js";
import { carregarEcraProjetosCoord } from "./prof/roles/coord-dashboard.js";

const CONFIG_SALAS = {
    'sala4': { colunas: 4, linhas: 3, formato: 'dupla' },
    'sala7': { colunas: 3, linhas: 6, formato: 'dupla' },
    'sala8': { colunas: 3, linhas: 6, formato: 'dupla' },
    'sala11': { colunas: 3, linhas: 4, formato: 'mista_centro_individual' },
    'sala12': { colunas: 3, linhas: 4, formato: 'dupla' },
    'sala13': { colunas: 4, linhas: 4, formato: 'dupla' },
    'labCTE': { colunas: 4, linhas: 5, formato: 'individual' }
};

function getIniciais(nomeStr) {
    if (!nomeStr) return "PR";
    const parts = nomeStr.trim().split(/\s+/);
    if (parts.length >= 2) return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
    return parts[0][0].toUpperCase();
}

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
                        if(configuracaoPerfis[papel]) {
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
                        badge.innerText = config.nome;
                        badge.style.backgroundColor = config.cor;
                        
                        const navBase = document.querySelectorAll('.nav-role-base');
                        const navPap = document.querySelectorAll('.nav-role-pap');
                        const navCoord = document.querySelectorAll('.nav-role-coord');
                        
                        if (novoPapel === 'orientador_pap') { 
                            navBase.forEach(el => el.style.display = 'none'); 
                            navCoord.forEach(el => el.style.display = 'none'); 
                            navPap.forEach(el => el.style.display = 'flex'); 
                        } else if (novoPapel === 'coordenador') { 
                            navBase.forEach(el => el.style.display = 'none'); 
                            navPap.forEach(el => el.style.display = 'none'); 
                            navCoord.forEach(el => el.style.display = 'flex'); 
                        } else { 
                            navPap.forEach(el => el.style.display = 'none'); 
                            navCoord.forEach(el => el.style.display = 'none'); 
                            navBase.forEach(el => el.style.display = 'flex'); 
                        }

                        document.getElementById('dropdown-perfis').style.display = 'none';
                        document.querySelector('.nav-item[data-target="view-prof-dashboard"]').click();
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
                    if (state.turmasProfessor.length > 0) { 
                        sel.innerHTML = '<option value="">-- Selecionar Turma --</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join(''); 
                    } else { 
                        sel.innerHTML = '<option value="">Sem turmas atribuídas</option>'; 
                    }

                    carregarRadarProfessor(); 
                } else { 
                    window.location.href = "index.html"; 
                }
            }
        } catch (e) { console.error("Erro na inicialização:", e); }
    } else { 
        window.location.href = "index.html"; 
    }
});


// ========================================================
// FÓRUM - CARREGAR ANEXOS 
// ========================================================
document.getElementById('prof-forum-file-input')?.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    
    if (file.size > 2 * 1024 * 1024) return alert("Ficheiro demasiado grande (Máx: 2MB).");
    
    const reader = new FileReader();
    reader.onload = (event) => {
        state.chatAttachmentBase64 = event.target.result;
        state.chatAttachmentName = file.name;
        document.getElementById('prof-forum-attachment-name').innerHTML = `<i class="fa-solid fa-file"></i> ${file.name}`;
        document.getElementById('prof-forum-attachment-preview').style.display = 'flex';
    };
    reader.readAsDataURL(file);
});


// ========================================================
// EVENT DELEGATION - O SEGREDO CONTRA BUGS DE INPUT!
// ========================================================
document.body.addEventListener('input', (e) => {
    // Cálculo Rápido de Horas PRHF
    if (e.target.id === 'prhf-horas-totais') {
        const val = parseInt(e.target.value) || 0;
        
        // ==========================================
        // ÁREA RESERVADA PARA A TUA FÓRMULA OFICIAL!
        // ==========================================
        // Por agora fica o padrão de 30% (mínimo 4h) para não dar erro
        document.getElementById('prhf-horas-presenciais').value = val <= 4 ? 0 : Math.ceil(val * 0.3);
    }
});

document.body.addEventListener('change', async (e) => {
    
    // ----------------------------------------------------
    // LÓGICA DO FÓRUM - COLORIR LABELS 
    // ----------------------------------------------------
    if (e.target.classList.contains('forum-aluno-check') || e.target.classList.contains('edit-forum-aluno-check') || e.target.classList.contains('prhf-aluno-check')) {
        const chk = e.target; 
        const lbl = chk.closest('label');
        
        if (chk.checked) { 
            // Se for do PRHF acende a vermelho, se for do Fórum a verde
            if (chk.classList.contains('prhf-aluno-check')) {
                lbl.style.background = 'rgba(239, 68, 68, 0.15)'; 
                lbl.style.borderColor = 'var(--danger-red)'; 
            } else {
                lbl.style.background = 'rgba(0, 204, 136, 0.15)'; 
                lbl.style.borderColor = 'var(--primary-green)'; 
            }
        } else { 
            lbl.style.background = 'rgba(0,0,0,0.2)'; 
            lbl.style.borderColor = '#333'; 
        }
    }

    // ----------------------------------------------------
    // PRHF - LISTAR ALUNOS (BULK ACTION)
    // ----------------------------------------------------
    if (e.target.id === 'prhf-turma') {
        const t = e.target.value;
        const cCont = document.getElementById('prhf-alunos-bulk-container');
        const discSelect = document.getElementById('prhf-disciplina');
        
        if (!t) {
            cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; margin:0;">Selecione primeiro a Turma</p>';
            return;
        }
        
        cCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; margin:0;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar alunos...</p>';
        
        try {
            if (discSelect && discSelect.value) {
                atualizarDropdownModulos(t, discSelect.value, document.getElementById('prhf-modulo'));
            }

            const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
            let arr = []; 
            cS.forEach(d => arr.push({id: d.id, ...d.data()}));
            
            // Ordenação Alfabética
            arr.sort((a,b) => a.nome.localeCompare(b.nome));
            
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
            cCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Turma vazia.</p>' : cH;
        } catch(err) { 
            cCont.innerHTML = '<p class="text-danger center" style="font-size:0.8rem;">Erro ao carregar alunos.</p>'; 
        }
    }

    // PRHF - ATUALIZAR MÓDULOS AO MUDAR DISCIPLINA
    if (e.target.id === 'prhf-disciplina') {
        const t = document.getElementById('prhf-turma').value;
        if (t) atualizarDropdownModulos(t, e.target.value, document.getElementById('prhf-modulo'));
    }
});

function esconderTodasAsVistas() { 
    document.querySelectorAll('.app-content > div').forEach(v => v.style.display = 'none'); 
}

// ========================================================
// LISTENER GLOBAL DE CLIQUES
// ========================================================
document.body.addEventListener('click', async (e) => {
    
    // NAVEGAÇÃO BÁSICA
    const nav = e.target.closest('.nav-item');
    if (nav) {
        e.preventDefault();
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        esconderTodasAsVistas();
        
        const tId = nav.getAttribute('data-target');
        const targetView = document.getElementById(tId);
        
        if (targetView) {
            targetView.style.display = (tId === 'view-prof-forum') ? 'flex' : 'block';
        }
        
        if (tId === 'view-prof-dashboard') carregarRadarProfessor();
        if (tId === 'view-prof-turmas' && state.selectedTurma) analisarEAtualizarTurma(state.selectedTurma);
        if (tId === 'view-prof-tarefas') carregarTarefasProf();
        if (tId === 'view-prof-orientandos') carregarEcraOrientandos();
        if (tId === 'view-prof-diario') carregarEcraDiario();
        if (tId === 'view-coord-projetos') carregarEcraProjetosCoord();
        return; 
    }

    if (!e.target.closest('#header-prof') && !e.target.closest('#modal-fab-menu') && !e.target.closest('#btn-fab-global')) { 
        const drop = document.getElementById('dropdown-perfis'); 
        if(drop) drop.style.display = 'none'; 
        document.getElementById('modal-fab-menu').style.display = 'none';
    }

    if (e.target.closest('#btn-logout-dropdown')) signOut(auth);

    if (e.target.closest('.fechar-modal')) { 
        document.getElementById(e.target.closest('.fechar-modal').getAttribute('data-target')).style.display = 'none'; 
        return; 
    }

    if (e.target.closest('#btn-fab-global')) { 
        document.getElementById('modal-fab-menu').style.display = 'flex'; 
        return; 
    }

    // ========================================================
    // PRHF - SELEÇÃO EM MASSA (BOTÕES RÁPIDOS)
    // ========================================================
    if (e.target.closest('#btn-prhf-select-all')) {
        e.preventDefault();
        document.querySelectorAll('.prhf-aluno-check').forEach(chk => { 
            chk.checked = true; 
            const lbl = chk.closest('label'); 
            lbl.style.background = 'rgba(239, 68, 68, 0.15)'; 
            lbl.style.borderColor = 'var(--danger-red)'; 
        });
        return;
    }

    if (e.target.closest('#btn-prhf-deselect-all')) {
        e.preventDefault();
        document.querySelectorAll('.prhf-aluno-check').forEach(chk => { 
            chk.checked = false; 
            const lbl = chk.closest('label'); 
            lbl.style.background = 'rgba(0,0,0,0.2)'; 
            lbl.style.borderColor = '#333'; 
        });
        return;
    }

    // ========================================================
    // PRHF - AÇÕES GERAIS E BULK CREATE
    // ========================================================
    
    if (e.target.closest('#btn-novo-prhf')) {
        document.getElementById('erro-modal-prhf').style.display = 'none'; 
        document.getElementById('prhf-urgente').checked = false;
        document.getElementById('prhf-turma').innerHTML = '<option value="">-- Selecionar Turma --</option>' + state.turmasProfessor.map(t => `<option value="${t}">${t}</option>`).join('');
        
        // Reset da lista de alunos
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
        return;
    }

    // O NOVO MOTOR DE CRIAÇÃO EM MASSA!
    if (e.target.closest('#btn-gravar-novo-prhf')) { 
        const tTurma = document.getElementById('prhf-turma').value; 
        const tDisc = document.getElementById('prhf-disciplina').value; 
        const tMod = document.getElementById('prhf-modulo').value; 
        const tPrazo = document.getElementById('prhf-prazo').value; 
        const tHorasT = document.getElementById('prhf-horas-totais').value; 
        const tHorasP = document.getElementById('prhf-horas-presenciais').value; 
        const tDesc = document.getElementById('prhf-descricao').value.trim(); 
        const urg = document.getElementById('prhf-urgente').checked; 
        const errDiv = document.getElementById('erro-modal-prhf'); 
        
        const chks = document.querySelectorAll('.prhf-aluno-check:checked');
        let alunosSelecionados = Array.from(chks).map(c => c.value);

        if (alunosSelecionados.length === 0 || !tDisc || !tMod || !tHorasT || !tPrazo || !tDesc) { 
            errDiv.innerText = "Por favor, preenche todos os campos e seleciona pelo menos um aluno."; 
            errDiv.style.display = 'block'; 
            return; 
        } 
        
        const b = e.target.closest('#btn-gravar-novo-prhf'); 
        b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A criar...'; 
        b.disabled = true; 
        
        try { 
            for(const aId of alunosSelecionados) {
                // 1. Criar o Plano de Recuperação
                await addDoc(collection(db, "utilizadores", aId, "prhfs"), { 
                    disciplina: tDisc, 
                    modulo: Number(tMod), 
                    prazo: tPrazo, 
                    horasTotais: Number(tHorasT), 
                    horasPresenciais: Number(tHorasP), 
                    descricao: tDesc, 
                    status: 'pendente', 
                    dataCriacao: new Date().toISOString(), 
                    professor: state.myUserName, 
                    ficheiroBase64: state.prhfBase64, 
                    urgente: urg, 
                    presencaValidada: false 
                }); 

                // 2. Enviar Notificação Push para o Aluno!
                await addDoc(collection(db, "utilizadores", aId, "notificacoes"), {
                    titulo: "Novo PRHF a " + tDisc,
                    mensagem: `O professor ${state.myUserName} atribuiu-te um plano de recuperação (Módulo ${tMod}).`,
                    lida: false,
                    data: Date.now(),
                    tipo: "prhf"
                });
            }
            
            b.innerHTML = '<i class="fa-solid fa-check"></i> ' + alunosSelecionados.length + ' Planos Criados!'; 
            setTimeout(() => { 
                b.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Atribuir PRHF'; 
                b.disabled = false; 
                document.getElementById('modal-criar-prhf').style.display = 'none'; 
                carregarTarefasProf(); 
                if(state.selectedTurma) analisarEAtualizarTurma(state.selectedTurma); 
            }, 1500); 
        } catch (err) { 
            errDiv.innerText = "Erro na gravação múltipla. Tenta novamente."; 
            errDiv.style.display = 'block'; 
            b.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Atribuir PRHF'; 
            b.disabled = false; 
        } 
        return; 
    }

    if (e.target.closest('.btn-validar-presenca')) { 
        const btn = e.target.closest('.btn-validar-presenca'); 
        const aId = btn.getAttribute('data-aluno'); 
        const pId = btn.getAttribute('data-prhf'); 
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
        btn.disabled = true; 
        try { 
            await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { presencaValidada: true }); 
            carregarTarefasProf(); 
        } catch (err) { 
            btn.innerHTML = "Erro"; 
            btn.disabled = false; 
        } 
        return; 
    }

    if (e.target.closest('.btn-propor-prof')) { 
        const btn = e.target.closest('.btn-propor-prof'); 
        document.getElementById('prop-prof-aluno-id').value = btn.getAttribute('data-aluno'); 
        document.getElementById('prop-prof-prhf-id').value = btn.getAttribute('data-prhf'); 
        document.getElementById('prop-prof-data').value = ''; 
        document.getElementById('prop-prof-inicio').value = ''; 
        document.getElementById('prop-prof-fim').value = ''; 
        document.getElementById('modal-propor-prhf-prof').style.display = 'flex'; 
        return; 
    }

    if (e.target.closest('#btn-confirmar-proposta-prof')) { 
        const aId = document.getElementById('prop-prof-aluno-id').value; 
        const pId = document.getElementById('prop-prof-prhf-id').value; 
        const pd = document.getElementById('prop-prof-data').value; 
        const pi = document.getElementById('prop-prof-inicio').value; 
        const pf = document.getElementById('prop-prof-fim').value; 
        
        if(!pd || !pi || !pf) return alert("Preenche todos os campos."); 
        
        const btn = e.target.closest('#btn-confirmar-proposta-prof'); 
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
        btn.disabled = true; 
        
        try { 
            await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { 
                propostaProfessor: `Dia ${pd.split('-').reverse().join('/')} das ${pi} às ${pf}` 
            }); 
            btn.innerHTML = '<i class="fa-solid fa-check"></i> Sugerido'; 
            setTimeout(() => { 
                btn.innerHTML = 'Sugerir Horário'; 
                btn.disabled = false; 
                document.getElementById('modal-propor-prhf-prof').style.display = 'none'; 
                carregarTarefasProf(); 
            }, 1500); 
        } catch(err) { 
            btn.innerHTML = 'Erro'; 
            setTimeout(()=>btn.disabled=false, 1500); 
        } 
        return; 
    }

    if (e.target.closest('.btn-concluir-prhf')) { 
        const btn = e.target.closest('.btn-concluir-prhf'); 
        document.getElementById('conc-aluno-id').value = btn.getAttribute('data-aluno'); 
        document.getElementById('conc-prhf-id').value = btn.getAttribute('data-prhf'); 
        document.getElementById('conc-motivo').value = ''; 
        document.getElementById('modal-concluir-prhf').style.display = 'flex'; 
        return; 
    }

    if (e.target.closest('#btn-confirmar-conclusao-prhf')) { 
        const aId = document.getElementById('conc-aluno-id').value; 
        const pId = document.getElementById('conc-prhf-id').value; 
        const feedback = document.getElementById('conc-motivo').value.trim() || "Concluído com sucesso."; 
        const b = e.target.closest('#btn-confirmar-conclusao-prhf'); 
        
        b.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
        b.disabled = true; 
        
        try { 
            await updateDoc(doc(db, "utilizadores", aId, "prhfs", pId), { 
                status: 'concluida', 
                feedbackProfessor: feedback 
            }); 
            b.innerHTML = '<i class="fa-solid fa-check"></i> Plano Fechado'; 
            setTimeout(() => { 
                b.innerHTML = 'Aprovar e Fechar Plano'; 
                b.disabled = false; 
                document.getElementById('modal-concluir-prhf').style.display = 'none'; 
                carregarTarefasProf(); 
                if(state.selectedTurma) analisarEAtualizarTurma(state.selectedTurma); 
            }, 1500); 
        } catch (err) { 
            b.innerHTML = "Erro"; 
            setTimeout(() => b.disabled = false, 1500); 
        } 
        return; 
    }

});
