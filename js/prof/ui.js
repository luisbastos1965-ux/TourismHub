import { db } from "../firebase.js";
import { doc, getDoc, collection, getDocs, query, where, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state, ACADEMIAS_INFO, ordemDisciplinasGlobal, nomeCurto, getDisciplinasPermitidas } from "./store.js";

// Função para calcular o atraso
function obterEstadoPrazo(dataLimite) {
    if (!dataLimite) return { cor: 'var(--text-muted)', icone: '<i class="fa-regular fa-calendar"></i>', aviso: 'Prazo: ' + dataLimite };
    
    const hoje = new Date();
    hoje.setHours(0,0,0,0); 
    const limite = new Date(dataLimite);
    
    const diferencaTempo = limite.getTime() - hoje.getTime();
    const diasRestantes = Math.ceil(diferencaTempo / (1000 * 3600 * 24));

    if (diasRestantes < 0) {
        return { cor: 'var(--danger-red)', icone: '<i class="fa-solid fa-triangle-exclamation"></i>', aviso: 'ATRASADO (' + Math.abs(diasRestantes) + ' dias)' };
    } else if (diasRestantes <= 2) {
        return { cor: 'var(--warning-yellow)', icone: '<i class="fa-solid fa-clock"></i>', aviso: 'TERMINA EM ' + diasRestantes + ' DIAS' };
    } else {
        return { cor: 'var(--text-muted)', icone: '', aviso: 'Prazo: ' + dataLimite };
    }
}

// ==========================================
// A TUA TABELA DE DADOS BASE
// ==========================================
export const ESTRUTURA_MODULAR = {
  'PORT': { 10: [1, 2, 3], 11: [4, 5, 6], 12: [7, 8, 9] },
  'ING': { 10: [1, 2, 3], 11: [4, 5, 6], 12: [7, 8, 9] },
  'AI': { 10: [1, 2, 3], 11: [4, 5, 6] },
  'EF': { 10: [1, 2, 3, 4, 5], 11: [6, 7, 8, 9, 10], 12: [11, 12, 13, 14, 15, 16] },
  'TIC': { 10: [1, 2, 3, 4] },
  'GEO': { 10: [1, 2], 11: [3, 4, 5], 12: [6, 7, 8] },
  'HCA': { 10: [1, 2, 3], 11: [4, 5, 6, 7], 12: [8, 9, 10] },
  'MAT': { 10: [1, 2, 3, 4] },
  'CF': { 10: [1, 2, 3], 11: [4, 5, 6, 7, 8, 9] },
  'TIAT': { 10: [1, 2, 3, 4], 11: [5, 6, 7, 8, 9], 12: [10, 11, 12, 13] },
  'TCAT': { 10: [1, 2, 3, 4], 11: [5, 6, 7] },
  'OTET': { 10: [1, 2, 3, 4], 11: [5, 6, 7, 8], 12: [9, 10, 11, 12] },
  'AET': { 10: [1, 2, 3], 11: [4, 5, 6, 7], 12: [8, 9] },
  'OGOT': { 10: [1, 2, 3, 4, 5], 11: [6, 7, 8, 9, 10], 12: [11] },
  'CMET': { 10: [1, 2, 3], 11: [4, 5], 12: [6, 7, 8, 9, 10] },
  'LNTT': { 10: [1, 2], 11: [3, 4] }
};

export function filtrarDisciplinasDoAno(turmaStr, disciplinasArray) {
    if (!turmaStr || !disciplinasArray) return disciplinasArray || [];
    const ano = parseInt((turmaStr).match(/\d+/)?.[0]) || 10;
    
    return disciplinasArray.filter(disc => {
        const dUpper = disc.toUpperCase().trim();
        if (ESTRUTURA_MODULAR[dUpper]) {
            return ESTRUTURA_MODULAR[dUpper][ano] !== undefined;
        }
        return true; 
    });
}

export function atualizarDropdownModulos(turmaStr, disciplina, selectElement) {
    if (!selectElement) return;
    const ano = parseInt((turmaStr||"10").match(/\d+/)?.[0]) || 10;
    const disc = (disciplina || "").toUpperCase().trim();
    
    let html = '<option value="">Mod...</option>';
    
    if (ESTRUTURA_MODULAR[disc]) {
        for (let y = 10; y <= ano; y++) {
            if (ESTRUTURA_MODULAR[disc][y]) {
                ESTRUTURA_MODULAR[disc][y].forEach(m => {
                    let label = `Módulo ${m}`;
                    if (y === ano) label += ' (Atual)';
                    else label += ' (Em atraso)';
                    html += `<option value="${m}">${label}</option>`;
                });
            }
        }
    } else {
        for(let i=1; i<=15; i++) {
            html += `<option value="${i}">Módulo ${i}</option>`;
        }
    }
    selectElement.innerHTML = html;
}

// ==========================================
// VISTAS E GERAÇÃO DE DADOS 
// ==========================================
export async function carregarRadarProfessor() {
    const cardAssistente = document.getElementById('assistente-resumo-rapido'); // Agora aponta para a div interior
    const divCarrossel = document.getElementById('stats-carousel-container')?.parentNode;
    const cardModulos = document.getElementById('dashboard-modulos-container')?.closest('.card');
    const megaCartao = document.getElementById('dashboard-horario-container')?.closest('.card');
    const cardAlertas = document.getElementById('dashboard-alertas-container')?.closest('.card');
    
    const papContainerId = 'dyn-pap-dashboard'; 
    let papCont = document.getElementById(papContainerId);
    if (!papCont) { 
        papCont = document.createElement('div'); 
        papCont.id = papContainerId; 
        document.getElementById('view-prof-dashboard').prepend(papCont); 
    }

    if (state.activeRole === 'orientador_pap' || state.activeRole === 'coordenador') {
        if(megaCartao) megaCartao.style.display = 'none'; 
        if(cardAlertas) cardAlertas.style.display = 'none';
        const avisosDT = document.getElementById('avisos-dt-container');
        if(avisosDT) avisosDT.style.display = 'none';
        papCont.style.display = 'none'; 
        if (window.carregarAtividadeRecente) window.carregarAtividadeRecente();
        return; 
    }

    // ====================================================
    // VISTA DO PROFESSOR NORMAL (SIMBIOSE ASSISTENTE + ALERTAS)
    // ====================================================
    papCont.style.display = 'none';
    if(divCarrossel) divCarrossel.style.display = 'none'; 
    if(cardModulos) cardModulos.style.display = 'none'; // Apagamos os Módulos Concluídos (não acrescentavam valor aqui)
    if(megaCartao) megaCartao.style.display = 'block'; 
    if(cardAlertas) cardAlertas.style.display = 'block';
    
    const avisosDT = document.getElementById('avisos-dt-container');
    if (state.activeRole === 'diretor_turma' || state.activeRole === 'coordenador') {
        if(avisosDT) avisosDT.style.display = 'grid'; 
    } else {
        if(avisosDT) avisosDT.style.display = 'none'; 
    }

    const aText = document.getElementById('assistente-resumo-rapido'); 
    const dataHojeCont = document.getElementById('data-hoje-assistente');
    const hCont = document.getElementById('dashboard-horario-container'); 
    const eCont = document.getElementById('radar-agenda-container'); 
    const alCont = document.getElementById('dashboard-alertas-container');
    const abasTurmasCont = document.getElementById('abas-turmas-alertas');
    
    if (aText) aText.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A ler pendências...';
    if (dataHojeCont) {
        const dOpt = { weekday: 'long', day: 'numeric', month: 'long' };
        dataHojeCont.innerText = new Date().toLocaleDateString('pt-PT', dOpt).toUpperCase();
    }
    
    if (!state.turmasProfessor || state.turmasProfessor.length === 0) { 
        if(aText) aText.innerHTML = 'Não tens turmas atribuídas no teu perfil.'; 
        return; 
    }

    try {
        const hjD = new Date(); 
        const hjStr = `${hjD.getFullYear()}-${String(hjD.getMonth()+1).padStart(2,'0')}-${String(hjD.getDate()).padStart(2,'0')}`;
        const hjStrFull = hjD.toISOString().split('T')[0];
        
        let profAulasHoje = [];
        let eventosGlobais = [];
        let missoesGlobais = [];
        let mapAlunosRisco = {}; 
        
        let totais = { prhfs: 0, faltas: 0, avaliacoes: 0 };
        const matVerificar = state.disciplinasProfessor || [];

        // 1. LER DADOS DAS TURMAS EM PARALELO
        const promisesTurmas = state.turmasProfessor.map(async (t) => {
            mapAlunosRisco[t] = [];
            try { 
                const tSnap = await getDoc(doc(db, "turmas", t)); 
                if(tSnap.exists() && tSnap.data().horario) { 
                    const hT = tSnap.data().horario; 
                    const bK = ['1', '2', '3', '4', '1300', '5', '6', '7']; 
                    const bT = { '1': '08:30', '2': '09:35', '3': '10:50', '4': '11:55', '1300': '13:00', '5': '14:05', '6': '15:15', '7': '16:20' };
                    bK.forEach(b => {
                        const disc = hT[`${hjStr}_${b}`];
                        if (disc && state.disciplinasProfessor.includes(disc)) profAulasHoje.push({ bloco: b, turma: t, disciplina: disc, hora: bT[b] });
                    });
                } 
            } catch(e) {}
            
            try { 
                const evSnap = await getDocs(collection(db, "turmas", t, "eventos")); 
                evSnap.forEach(d => eventosGlobais.push({ turma: t, ...d.data() })); 
            } catch(e) {}

            try { 
                const missSnap = await getDocs(collection(db, "turmas", t, "missoes")); 
                missSnap.forEach(d => {
                    const m = d.data();
                    if(m.status !== 'encerrada') missoesGlobais.push({ turma: t, id: d.id, ...m });
                }); 
            } catch(e) {}
            
            // LER ALUNOS DA TURMA E AS SUAS ESTATÍSTICAS
            try {
                const snapAl = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); 
                const isDT = (state.activeRole === 'diretor_turma' && t === state.minhaTurmaDT);

                const promessasAlunos = snapAl.docs.map(async (docAluno) => {
                    let d = docAluno.data();
                    const alId = docAluno.id;
                    let numPrhfs = 0;
                    let numRepsSemPlano = 0;
                    let hsFalta = 0;
                    
                    const matVerificarRadar = isDT ? state.disciplinasProfessor : matVerificar;

                    // Recolha para PRHFs e Faltas
                    const [pSnap, fSnap, avalSnap, notasOldSnap] = await Promise.all([
                        getDocs(collection(db, "utilizadores", alId, "prhfs")),
                        getDocs(collection(db, "utilizadores", alId, "faltas")),
                        getDocs(collection(db, "utilizadores", alId, "avaliacoes")),
                        getDocs(collection(db, "utilizadores", alId, "notas"))
                    ]);

                    // Lista dos módulos onde já existe um PRHF a decorrer
                    const modulosComPrhf = [];
                    pSnap.forEach(p => { 
                        if(p.data().status !== 'concluida' && matVerificarRadar.includes(p.data().disciplina)) { 
                            numPrhfs++; 
                            totais.prhfs++; 
                            modulosComPrhf.push(`${p.data().disciplina}_${p.data().modulo}`);
                        } 
                    });
                    
                    if (isDT) {
                        // O DT quer ver as faltas
                        fSnap.forEach(f => { if(!f.data().justificada) hsFalta += Number(f.data().horas || f.data().duracaoBlocos || 0); });
                    } else {
                        // O Professor quer ver que Notas REP estão "orfãs" de plano
                        const notasCombinadas = [...avalSnap.docs, ...notasOldSnap.docs];
                        notasCombinadas.forEach(n => {
                            if (matVerificarRadar.includes(n.data().disciplina) && n.data().nota === 'REP') {
                                const mId = `${n.data().disciplina}_${n.data().modulo}`;
                                // Se teve REP e não há PRHF aberto para este módulo, é um alerta vermelho!
                                if (!modulosComPrhf.includes(mId)) numRepsSemPlano++;
                            }
                        });
                    }

                    // Se tem risco (depende de quem está a olhar), atira para o painel
                    if ((isDT && hsFalta > 6) || numPrhfs > 0 || numRepsSemPlano > 0) {
                        mapAlunosRisco[t].push({ id: alId, nome: d.nome, faltas: hsFalta, prhfs: numPrhfs, reps: numRepsSemPlano });
                    }
                });
                await Promise.all(promessasAlunos);
            } catch(e) {}
        });
        
        await Promise.all(promisesTurmas);

        const avaliacoesPassadas = eventosGlobais.filter(e => e.tipo === 'avaliacao' && e.data < hjStrFull && e.professor === state.myUserName);
        totais.avaliacoes = avaliacoesPassadas.length; 

        // 2. DESENHAR A SAUDAÇÃO INICIAL E OS LEMBRETES DO DT
        if (aText) {
            const horaAtual = new Date().getHours();
            let saudacao = 'Olá';
            if (horaAtual < 12) saudacao = 'Bom dia';
            else if (horaAtual < 20) saudacao = 'Boa tarde';
            else saudacao = 'Boa noite';

            const turmasComProblemas = state.turmasProfessor.filter(t => mapAlunosRisco[t].length > 0);
            
            if (turmasComProblemas.length > 0) {
                aText.innerHTML = `${saudacao}, <strong>${state.myUserName.split(' ')[0]}</strong>! Alunos a necessitar da tua intervenção:`;
            } else {
                aText.innerHTML = `${saudacao}, <strong>${state.myUserName.split(' ')[0]}</strong>! A tua mesa está limpa hoje.`;
            }
        }

        // 2. LER, RESTAURAR E ALTERAR OS ALERTAS DO DIRETOR DE TURMA
        const avisosDT = document.getElementById('avisos-dt-container');
        if (avisosDT) {
            avisosDT.style.display = 'grid'; // Visível para todos os professores
            
            // FUNÇÃO NOVA: Permite ao DT clicar para ligar/desligar o aviso!
            window.toggleLembreteDT = async (tipoAviso, estadoAtual) => {
                // Só o DT ou Coordenador podem clicar
                if (state.activeRole !== 'diretor_turma' && state.activeRole !== 'coordenador') return;
                
                try {
                    const ref = doc(db, "utilizadores", state.myUserId, "alertas", "dt");
                    // Inverte o estado (Se estava true passa a false, e vice-versa)
                    await setDoc(ref, { [tipoAviso]: !estadoAtual }, { merge: true });
                    // Recarrega visualmente os botões
                    window.carregarLembretesDT();
                } catch(e) {
                    console.error("Erro ao alternar aviso:", e);
                }
            };

            window.carregarLembretesDT = async () => {
                try {
                    const docAvisos = await getDoc(doc(db, "utilizadores", state.myUserId, "alertas", "dt"));
                    const avisos = docAvisos.exists() ? docAvisos.data() : { sinteses: false, pct: false };
                    
                    const isDT = (state.activeRole === 'diretor_turma' || state.activeRole === 'coordenador');
                    const cursorEstilo = isDT ? 'cursor: pointer;' : 'cursor: default;';
                    
                    // Agora o HTML gerado tem o evento "onclick" se fores o DT!
                    const buildCaixa = (nome, idDb, ativo, icon, cor) => `
                        <div ${isDT ? `onclick="window.toggleLembreteDT('${idDb}',${ativo})"` : ''} style="background: rgba(0,0,0,0.2); border: 1px solid ${ativo ? cor : '#333'}; box-shadow: ${ativo ? `0 0 10px ${cor}40` : 'none'}; border-radius: 8px; padding: 10px; display: flex; align-items: center; justify-content: center; gap: 10px; opacity: ${ativo ? '1' : '0.4'}; transition: 0.3s; ${cursorEstilo}">
                            <div style="background: ${ativo ? cor : '#333'}; color: ${ativo ? 'black' : 'var(--text-muted)'}; width: 30px; height: 30px; border-radius: 50%; display: flex; justify-content: center; align-items: center;"><i class="${icon}"></i></div>
                            <strong style="color: ${ativo ? 'white' : 'var(--text-muted)'}; font-size: 0.95rem; display:block; margin: 0;">${nome}</strong>
                        </div>`;

                    avisosDT.innerHTML = `
                        ${buildCaixa('Sínteses', 'sinteses', avisos.sinteses, 'fa-solid fa-clipboard', '#10b981')}
                        ${buildCaixa('PCT', 'pct', avisos.pct, 'fa-solid fa-users-rectangle', '#b82bf2')}
                    `;
                } catch(e) { 
                    avisosDT.innerHTML = '<p class="text-muted" style="grid-column: span 2; text-align: center;">Erro ao carregar lembretes.</p>'; 
                }
            };

            // Chama a função visual quando a página carrega
            window.carregarLembretesDT();
        }

        // 3. DESENHAR AS ABAS DAS TURMAS (VISUAL LIMPO E UNIFORME) E OS ALUNOS
        if (abasTurmasCont && alCont) {
            let abasHTML = '';
            
            const turmasComProblemas = state.turmasProfessor.filter(t => mapAlunosRisco[t].length > 0);
            
            if (turmasComProblemas.length === 0) {
                abasTurmasCont.style.display = 'none';
                alCont.innerHTML = '<div class="empty-state" style="padding: 10px;"><i class="fa-solid fa-check-circle empty-state-icon" style="color:var(--success-green); font-size: 2rem;"></i><p class="empty-state-desc" style="margin-top: 10px;">Sem alunos em risco ou módulos em atraso.</p></div>';
            } else {
                abasTurmasCont.style.display = 'flex';
                // Criação das abas estilo "Segmented Control"
                turmasComProblemas.forEach((t, index) => {
                    const isActive = index === 0;
                    const totalRisco = mapAlunosRisco[t].length;
                    
                    const bgBtn = isActive ? 'var(--bg-dark)' : 'transparent';
                    const corTexto = isActive ? 'white' : 'var(--text-muted)';
                    const shadow = isActive ? 'box-shadow: 0 2px 5px rgba(0,0,0,0.3);' : '';
                    
                    abasHTML += `
                    <button class="tab-risco-turma" data-turma="${t}" style="flex: 1; padding: 8px 5px; background: ${bgBtn}; color: ${corTexto}; border: none; border-radius: 6px; cursor: pointer; transition: 0.2s; font-weight: bold; ${shadow}">
                        ${t} <span style="background: var(--danger-red); color: white; border-radius: 10px; padding: 2px 6px; font-size: 0.65rem; margin-left: 5px;">${totalRisco}</span>
                    </button>`;
                });
                abasTurmasCont.innerHTML = abasHTML;

                window.renderizarAlunosRisco = (turma) => {
                    let htmlAlunos = '';
                    const lista = mapAlunosRisco[turma];
                    
                    // Ordena por maior prioridade: 1º Avaliações (A), 2º Planos (P)
                    lista.sort((a,b) => (b.reps || 0) - (a.reps || 0) || (b.prhfs || 0) - (a.prhfs || 0));

                    lista.forEach(a => {
                        const hasPRHF = a.prhfs > 0;
                        const hasAtraso = a.reps > 0;

                        // Estética do Botão P (Planos) - Esquerda
                        const prhfCor = hasPRHF ? 'var(--warning-yellow)' : '#555';
                        const prhfSombra = hasPRHF ? 'box-shadow: 0 0 10px rgba(245, 158, 11, 0.4);' : '';
                        const prhfOpacidade = hasPRHF ? '1' : '0.3';
                        const prhfTexto = hasPRHF ? `${a.prhfs}P` : `0P`;

                        // Estética do Botão A (Avaliações/Atrasos) - Direita
                        const atrasoCor = hasAtraso ? 'var(--danger-red)' : '#555';
                        const atrasoSombra = hasAtraso ? 'box-shadow: 0 0 10px rgba(239, 68, 68, 0.4);' : '';
                        const atrasoOpacidade = hasAtraso ? '1' : '0.3';
                        const atrasoTexto = hasAtraso ? `${a.reps}A` : `0A`;

                        // A barra lateral da caixa indica a gravidade
                        const corBorda = hasAtraso ? 'var(--danger-red)' : (hasPRHF ? 'var(--warning-yellow)' : '#444');

                        htmlAlunos += `
                        <div onclick="window.abrirPerfil360Aluno('${a.id}')" style="cursor:pointer; transition:0.2s; display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px 15px; border-radius:8px; border-left:4px solid ${corBorda}; margin-bottom:8px;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background='rgba(0,0,0,0.2)'">
                            
                            <!-- Nome Longo -->
                            <strong style="color:white; font-size:0.95rem; flex-grow: 1;">${nomeCurto(a.nome)}</strong>
                            
                            <!-- Grelha de Botões Numéricos -->
                            <div style="display:flex; gap:6px;">
                                
                                <!-- Luz P (Planos) -->
                                <div style="border: 1px solid ${prhfCor}; ${prhfSombra} opacity: ${prhfOpacidade}; background: rgba(0,0,0,0.4); padding: 4px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center; min-width: 42px; transition: 0.3s;" title="Planos de Recuperação">
                                    <span style="color:${prhfCor}; font-weight:900; font-size:0.9rem; letter-spacing: 1px;">${prhfTexto}</span>
                                </div>

                                <!-- Luz A (Avaliações) -->
                                <div style="border: 1px solid ${atrasoCor}; ${atrasoSombra} opacity: ${atrasoOpacidade}; background: rgba(0,0,0,0.4); padding: 4px 10px; border-radius: 6px; display: flex; align-items: center; justify-content: center; min-width: 42px; transition: 0.3s;" title="Avaliações em Atraso">
                                    <span style="color:${atrasoCor}; font-weight:900; font-size:0.9rem; letter-spacing: 1px;">${atrasoTexto}</span>
                                </div>

                            </div>
                        </div>`;
                    });
                    alCont.innerHTML = htmlAlunos;
                };

                // Eventos de clique nas abas (com o novo estilo)
                document.querySelectorAll('.tab-risco-turma').forEach(btn => {
                    btn.addEventListener('click', (e) => {
                        document.querySelectorAll('.tab-risco-turma').forEach(b => {
                            b.style.background = 'transparent';
                            b.style.color = 'var(--text-muted)';
                            b.style.boxShadow = 'none';
                        });
                        const currentBtn = e.target.closest('.tab-risco-turma');
                        currentBtn.style.background = 'var(--bg-dark)';
                        currentBtn.style.color = 'white';
                        currentBtn.style.boxShadow = '0 2px 5px rgba(0,0,0,0.3)';
                        
                        window.renderizarAlunosRisco(currentBtn.getAttribute('data-turma'));
                    });
                });

                window.renderizarAlunosRisco(turmasComProblemas[0]);
            }
        }

        // 4. DESENHAR HORÁRIO DO DIA
        if(profAulasHoje.length > 0) {
            try { 
                profAulasHoje.sort((a,b) => { 
                    if(!a.hora || !b.hora) return 0; 
                    const getMin = (hx) => parseInt(hx.split(':')[0])*60 + parseInt(hx.split(':')[1]); 
                    return getMin(a.hora) - getMin(b.hora); 
                }); 
                let hHtml = ''; 
                profAulasHoje.forEach(aula => { 
                    hHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:5px; border-left:3px solid #0099ff;"><div><strong style="color:white; font-size:0.9rem;">${aula.disciplina}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">Turma ${aula.turma}</span></div><span style="color:#0099ff; font-weight:bold; font-size:0.85rem;">${aula.hora}</span></div>`; 
                }); 
                if(hCont) hCont.innerHTML = hHtml; 
            } catch(sortErr) {}
        } else { 
            if(hCont) hCont.innerHTML = '<div class="empty-state"><i class="fa-solid fa-clock empty-state-icon" style="color:#0099ff;"></i><p class="empty-state-desc">Não tens aulas no sistema hoje.</p></div>'; 
        }

        // 5. DESENHAR EVENTOS FUTUROS
        const fut = eventosGlobais.filter(e => e.data && e.data >= hjStrFull).sort((a,b) => a.data.localeCompare(b.data)).slice(0, 4);
        if (fut.length > 0) { 
            let ah = ''; 
            fut.forEach(e => { 
                const datePrint = e.data ? e.data.split('-').reverse().join('/') : 'Brevemente'; 
                const timePrint = e.periodo === 'hora' ? ` às ${e.hora}` : (e.periodo === 'manha' ? ' (Manhã)' : (e.periodo === 'tarde' ? ' (Tarde)' : '')); 
                ah += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:5px; border-left:3px solid var(--warning-yellow);"><div><strong style="color:white; font-size:0.9rem;">${e.titulo}</strong><br><span style="font-size:0.75rem; color:var(--text-muted);">Turma ${e.turma}</span></div><div><span style="color:var(--warning-yellow); font-size:0.8rem; display:block;">${datePrint}${timePrint}</span></div></div>`; 
            }); 
            if(eCont) eCont.innerHTML = ah; 
        } else { 
            if(eCont) eCont.innerHTML = '<div class="empty-state"><i class="fa-solid fa-calendar empty-state-icon" style="color:var(--warning-yellow);"></i><p class="empty-state-desc">A tua agenda de eventos futuros está livre.</p></div>'; 
        }
        
    } catch (e) { 
        if(aText) aText.innerHTML = "Problema na ligação a recolher dados estatísticos globais."; 
    }
    
    // CARREGAR A ATIVIDADE RECENTE
    if (window.carregarAtividadeRecente) window.carregarAtividadeRecente();
}

export async function analisarEAtualizarTurma(turmaId) {
    const listC = document.getElementById('lista-alunos-turma'); 
    listC.innerHTML = '<p class="text-muted center">A ler dados dos alunos...</p>';
    document.getElementById('assistente-aula-texto').innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A analisar a turma...';
    
    const isDT = (state.activeRole === 'diretor_turma' && turmaId === state.minhaTurmaDT);
    if(isDT) { 
        document.getElementById('badge-dt-turma').style.display = 'inline-block'; 
    } else { 
        document.getElementById('badge-dt-turma').style.display = 'none'; 
    }
    
    const lmsGrid = document.querySelector('.lms-action-grid');
    const btnMateriais = document.getElementById('btn-modal-materiais');
    
    if (lmsGrid) {
        lmsGrid.style.display = 'grid';
        if (state.activeRole === 'diretor_turma' && isDT) {
            lmsGrid.style.setProperty('grid-template-columns', '1fr 1fr', 'important');
            if (btnMateriais) btnMateriais.style.display = 'none';
        } else {
            lmsGrid.style.setProperty('grid-template-columns', '1fr 1fr', 'important');
            if (btnMateriais) btnMateriais.style.display = '';
        }
    }

    try {
        const matVerificar = isDT ? (typeof ordemDisciplinasGlobal !== 'undefined' ? ordemDisciplinasGlobal : state.disciplinasProfessor) : state.disciplinasProfessor;
        
        let alunosProcessados = [];
        const cacheChave = `cache_prof_turma_${turmaId}_${matVerificar.join('')}`; 
        const tempoChave = `tempo_${cacheChave}`;
        const agora = Date.now();
        const tempoGuardado = localStorage.getItem(tempoChave);

        if (tempoGuardado && (agora - parseInt(tempoGuardado) < 43200000)) {
            alunosProcessados = JSON.parse(localStorage.getItem(cacheChave));
            state.alunosTurmaRAM = alunosProcessados; 
        } 
        else {
            const qAlunos = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turmaId), where("papel", "==", "aluno")));
            state.alunosTurmaRAM = []; 
            qAlunos.forEach(d => state.alunosTurmaRAM.push({ id: d.id, ...d.data() })); 
            state.alunosTurmaRAM.sort((a,b) => a.nome.localeCompare(b.nome));

            const promisesAlunos = state.alunosTurmaRAM.map(async (al) => {
                let nFaltas = 0; let nPrhfs = 0; let nAtrasos = 0;
                
                const [fS, pS, avalSnap, notasOldSnap] = await Promise.all([
                    getDocs(collection(db, "utilizadores", al.id, "faltas")).catch(() => ({ forEach: () => {} })),
                    getDocs(collection(db, "utilizadores", al.id, "prhfs")).catch(() => ({ forEach: () => {} })),
                    getDocs(collection(db, "utilizadores", al.id, "avaliacoes")).catch(() => ({ docs: [] })),
                    getDocs(collection(db, "utilizadores", al.id, "notas")).catch(() => ({ docs: [] }))
                ]);

                fS.forEach(f => { if(!f.data().justificada && matVerificar.includes(f.data().disciplina)) nFaltas++; });

                const modulosComPrhf = [];
                pS.forEach(p => { 
                    if(p.data().status !== 'concluida' && matVerificar.includes(p.data().disciplina)) {
                        nPrhfs++; modulosComPrhf.push(`${p.data().disciplina}_${p.data().modulo}`);
                    } 
                });

                // --- O DESEMPACOTADOR ENTRA AQUI ---
                let notasCombinadas = [...(avalSnap.docs || [])];
                if(notasOldSnap && notasOldSnap.docs) {
                    notasOldSnap.forEach(d => {
                        const data = d.data();
                        if (data.lista_notas) data.lista_notas.forEach(n => notasCombinadas.push({ data: () => n }));
                        else if (data.disciplina) notasCombinadas.push(d);
                    });
                }

                notasCombinadas.forEach(n => {
                    if (matVerificar.includes(n.data().disciplina) && n.data().nota === 'REP') {
                        const mId = `${n.data().disciplina}_${n.data().modulo}`;
                        if (!modulosComPrhf.includes(mId)) nAtrasos++;
                    }
                });

                return { id: al.id, nome: al.nome, fotoPerfil: al.fotoPerfil, nFaltas: nFaltas, nPrhfs: nPrhfs, nAtrasos: nAtrasos };
            });

            alunosProcessados = await Promise.all(promisesAlunos);
            state.alunosTurmaRAM = alunosProcessados; 
            
            localStorage.setItem(cacheChave, JSON.stringify(alunosProcessados));
            localStorage.setItem(tempoChave, agora.toString());
        }

        let alunosEmRisco = 0; let totalPrhfs = 0; let totalRepsAtraso = 0; let htmlAlunos = '';

        alunosProcessados.forEach(al => {
            totalPrhfs += al.nPrhfs;
            totalRepsAtraso += al.nAtrasos;

            let corBola = 'status-green';
            if (al.nFaltas > 5 || al.nPrhfs > 2) { corBola = 'status-red'; alunosEmRisco++; } 
            else if (al.nFaltas > 2 || al.nPrhfs > 0) { corBola = 'status-yellow'; }

            htmlAlunos += `
            <div class="aluno-list-item" data-id="${al.id}" onclick="window.abrirPerfil360Aluno('${al.id}')" style="cursor: pointer; transition: 0.2s;" onmouseover="this.style.background='rgba(255,255,255,0.05)'" onmouseout="this.style.background=''">
                <div style="display:flex; align-items:center; gap:10px;">
                    <img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:35px; height:35px; border-radius:50%; object-fit:cover;">
                    <div>
                        <strong style="color:white; font-size:0.95rem;">${nomeCurto(al.nome)}</strong>
                        <div style="font-size:0.75rem; color:var(--text-muted);">${al.nPrhfs > 0 ? `<span style="color:#00d2ff;">${al.nPrhfs} PRHFs em curso</span>` : 'Tudo em dia'}</div>
                    </div>
                </div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <span class="status-dot ${corBola}"></span>
                </div>
            </div>`;
        });
        
        let asstHtml = `
            <div style="display: flex; gap: 15px; align-items: stretch; flex-wrap: wrap; justify-content: center;">
                <div style="flex: 1; min-width: 120px; display: flex; flex-direction: column; border-bottom: 2px solid #3b82f6; padding-bottom: 8px;">
                    <span style="color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; letter-spacing: 0.5px;">Total da Turma</span>
                    <div style="display: flex; align-items: baseline; gap: 8px;"><span style="color: white; font-size: 1.4rem; font-weight: 900;">${alunosProcessados.length}</span><i class="fa-solid fa-users" style="color: #3b82f6; font-size: 1rem;"></i></div>
                </div>
                <div style="flex: 1; min-width: 120px; display: flex; flex-direction: column; border-bottom: 2px solid ${alunosEmRisco > 0 ? 'var(--danger-red)' : 'var(--success-green)'}; padding-bottom: 8px;">
                    <span style="color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; letter-spacing: 0.5px;">Em Risco</span>
                    <div style="display: flex; align-items: baseline; gap: 8px;"><span style="color: white; font-size: 1.4rem; font-weight: 900;">${alunosEmRisco}</span><i class="fa-solid ${alunosEmRisco > 0 ? 'fa-triangle-exclamation' : 'fa-check'}" style="color: ${alunosEmRisco > 0 ? 'var(--danger-red)' : 'var(--success-green)'}; font-size: 1rem;"></i></div>
                </div>
                <div style="flex: 1; min-width: 120px; display: flex; flex-direction: column; border-bottom: 2px solid ${totalRepsAtraso > 0 ? 'var(--danger-red)' : '#444'}; padding-bottom: 8px;">
                    <span style="color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; letter-spacing: 0.5px;">Atrasos (REP)</span>
                    <div style="display: flex; align-items: baseline; gap: 8px;"><span style="color: ${totalRepsAtraso > 0 ? 'white' : '#666'}; font-size: 1.4rem; font-weight: 900;">${totalRepsAtraso}</span><span style="color: ${totalRepsAtraso > 0 ? 'var(--danger-red)' : '#666'}; font-size: 0.9rem; font-weight: bold;">A</span></div>
                </div>
                <div style="flex: 1; min-width: 120px; display: flex; flex-direction: column; border-bottom: 2px solid ${totalPrhfs > 0 ? 'var(--warning-yellow)' : '#444'}; padding-bottom: 8px;">
                    <span style="color: var(--text-muted); font-size: 0.7rem; text-transform: uppercase; font-weight: bold; margin-bottom: 5px; letter-spacing: 0.5px;">Planos Ativos</span>
                    <div style="display: flex; align-items: baseline; gap: 8px;"><span style="color: ${totalPrhfs > 0 ? 'white' : '#666'}; font-size: 1.4rem; font-weight: 900;">${totalPrhfs}</span><span style="color: ${totalPrhfs > 0 ? 'var(--warning-yellow)' : '#666'}; font-size: 0.9rem; font-weight: bold;">P</span></div>
                </div>
            </div>
        `;

        document.getElementById('assistente-aula-texto').innerHTML = asstHtml; 
        listC.innerHTML = htmlAlunos;
    } catch (e) { 
        listC.innerHTML = '<p class="text-danger center">Problema de Ligação.</p>'; 
    }
}

export async function renderizarPautaTurma() {
    const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
    const cont = document.getElementById('tabela-pauta-conteudo'); 
    cont.innerHTML = '<tr><td colspan="5" class="center text-muted"><i class="fa-solid fa-spinner fa-spin"></i> A ler notas e a limpar dados...</td></tr>';
    document.getElementById('modal-pauta-turma').style.display = 'flex';
    
    const discSelect = document.getElementById('pauta-disc-select');
    
    discSelect.style.display = 'block'; 
    
    if(isDT) { 
        const discValidas = typeof filtrarDisciplinasDoAno === "function" ? filtrarDisciplinasDoAno(state.selectedTurma, ordemDisciplinasGlobal) : ordemDisciplinasGlobal;
        discSelect.innerHTML = discValidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); 
    } else { 
        const discValidas = state.disciplinasProfessor || [];
        discSelect.innerHTML = discValidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); 
    }

    const curDisc = discSelect.value;
    if (!curDisc) {
        cont.innerHTML = '<tr><td colspan="5" class="center text-muted">Sem disciplina selecionada.</td></tr>';
        return;
    }

    try {
        let html = `<tr><th style="text-align:left;">Aluno</th><th style="text-align:center;">Mod. 1</th><th style="text-align:center;">Mod. 2</th><th style="text-align:center;">Mod. 3</th><th style="text-align:center;">Média</th></tr>`;
        
        for(const al of state.alunosTurmaRAM) {
            const nS_novas = await getDocs(collection(db, "utilizadores", al.id, "avaliacoes"));
            const nS_antigas = await getDocs(collection(db, "utilizadores", al.id, "notas"));
            
            // --- O DESEMPACOTADOR AQUI ---
            let todosRegistos = [...nS_novas.docs];
            nS_antigas.forEach(d => {
                const data = d.data();
                if(data.lista_notas) data.lista_notas.forEach(n => todosRegistos.push({ data: () => n }));
                else if(data.disciplina) todosRegistos.push(d);
            });

            let m1='-', m2='-', m3='-'; 
            let sum = 0; let count = 0;
            
            todosRegistos.forEach(n => {
                const d = n.data();
                const nomeDisciplina = String(d.disciplina || '').trim();
                
                if(nomeDisciplina === curDisc) {
                    const modStr = String(d.modulo || '').replace(/\D/g, ''); 
                    const modNum = parseInt(modStr, 10);
                    
                    const notaRaw = String(d.nota || '').trim().toUpperCase();
                    
                    if(modNum === 1) m1 = notaRaw;
                    else if(modNum === 2) m2 = notaRaw;
                    else if(modNum === 3) m3 = notaRaw;
                    
                    if(notaRaw !== 'REP' && !isNaN(notaRaw) && notaRaw !== '') { 
                        sum += Number(notaRaw); 
                        count++; 
                    }
                }
            });
            
            const media = count > 0 ? (sum / count).toFixed(1) : '-';
            const medColor = (media !== '-' && media < 10) ? 'color:var(--danger-red);' : 'color:var(--success-green);';
            
            html += `<tr>
                <td style="text-align:left;">${nomeCurto(al.nome)}</td>
                <td style="text-align:center; color: ${m1 === 'REP' ? 'var(--danger-red)' : 'white'};">${m1}</td>
                <td style="text-align:center; color: ${m2 === 'REP' ? 'var(--danger-red)' : 'white'};">${m2}</td>
                <td style="text-align:center; color: ${m3 === 'REP' ? 'var(--danger-red)' : 'white'};">${m3}</td>
                <td style="text-align:center; font-weight:bold; ${medColor}">${media}</td>
            </tr>`;
        }
        cont.innerHTML = html;
    } catch(e) { 
        console.error(e);
        cont.innerHTML = '<tr><td colspan="5" class="center text-danger">Erro ao carregar a pauta.</td></tr>'; 
    }
}

export async function renderizarFaltasTurma() {
    const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
    const cont = document.getElementById('tabela-faltas-conteudo'); 
    cont.innerHTML = '<tr><td colspan="5" class="center text-muted">A ler faltas...</td></tr>';
    document.getElementById('modal-faltas-turma').style.display = 'flex';
    
    const discSelect = document.getElementById('faltas-disc-select');
    if(isDT) { 
        discSelect.style.display = 'block'; 
        const discValidas = filtrarDisciplinasDoAno(state.selectedTurma, ordemDisciplinasGlobal);
        if(discSelect.options.length <= 1) discSelect.innerHTML = discValidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); 
    } else { 
        discSelect.style.display = 'none'; 
        const discValidas = filtrarDisciplinasDoAno(state.selectedTurma, state.disciplinasProfessor);
        discSelect.innerHTML = discValidas.map(dc => `<option value="${dc}">${dc}</option>`).join(''); 
    }

    const curDisc = discSelect.value || (isDT ? ordemDisciplinasGlobal[0] : state.disciplinasProfessor[0]);

    try {
        let html = '<tr><th>Aluno</th><th>Mod. 1</th><th>Mod. 2</th><th>Mod. 3</th><th>Total</th></tr>';
        for(const al of state.alunosTurmaRAM) {
            const fS = await getDocs(collection(db, "utilizadores", al.id, "faltas"));
            let m1=0, m2=0, m3=0, tot=0;
            fS.forEach(f => {
                if(f.data().disciplina === curDisc) {
                    let h = Number(f.data().horas || 0); 
                    tot += h;
                    let mod = f.data().modulo;
                    if(mod == 1) m1 += h; 
                    else if(mod == 2) m2 += h; 
                    else if(mod == 3) m3 += h;
                }
            });
            html += `<tr><td>${nomeCurto(al.nome)}</td><td>${m1?m1+'h':'-'}</td><td>${m2?m2+'h':'-'}</td><td>${m3?m3+'h':'-'}</td><td style="font-weight:bold; color:var(--danger-red);">${tot}h</td></tr>`;
        }
        cont.innerHTML = html;
    } catch(e) { 
        cont.innerHTML = '<tr><td colspan="5" class="center text-danger">Erro de ligação.</td></tr>'; 
    }
}

export function desenharGraficoAluno(modo) {
    const ctx = document.getElementById('chartEvolucaoAluno').getContext('2d');
    if(state.chartEvolucao) state.chartEvolucao.destroy();
    
    let gradient = ctx.createLinearGradient(0, 0, 0, 150); 
    gradient.addColorStop(0, 'rgba(0, 204, 136, 0.6)'); 
    gradient.addColorStop(1, 'rgba(0, 204, 136, 0.0)');

    const selDisc = document.getElementById('perfil-disc-select')?.value || state.disciplinasProfessor[0];

    if(modo === 'disc') {
        let dadosFiltrados = state.notasAlunoRAM.filter(n => n.disciplina === selDisc && !isNaN(n.valor) && n.valor > 0); 
        dadosFiltrados.sort((a,b) => a.moduloReal - b.moduloReal);
        state.chartEvolucao = new Chart(ctx, { 
            type: 'line', 
            data: { 
                labels: dadosFiltrados.length > 0 ? dadosFiltrados.map(n => `Mod ${n.moduloReal}`) : ['Sem Aval.'], 
                datasets: [{ 
                    label: selDisc, 
                    data: dadosFiltrados.length > 0 ? dadosFiltrados.map(n => n.valor) : [0], 
                    borderColor: '#00cc88', 
                    backgroundColor: gradient, 
                    borderWidth: 3, 
                    fill: true, 
                    tension: 0.4, 
                    pointBackgroundColor: '#00cc88', 
                    pointBorderColor: '#fff', 
                    pointBorderWidth: 2, 
                    pointRadius: 5 
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { y: { min: 10, max: 20, grid: { color: '#333' } }, x: { grid: { display: false } } }, 
                plugins: { legend: { display: false } } 
            } 
        });
    } else {
        let medias = {}; 
        state.notasAlunoRAM.forEach(n => { 
            if(!isNaN(n.valor) && n.valor > 0) { 
                if(!medias[n.disciplina]) medias[n.disciplina] = { soma: 0, count: 0 }; 
                medias[n.disciplina].soma += n.valor; 
                medias[n.disciplina].count++; 
            } 
        });
        
        let labels = []; 
        let values = []; 
        let colors = []; 
        
        Object.keys(medias).forEach(d => { 
            labels.push(d); 
            const m = medias[d].soma / medias[d].count; 
            values.push(m.toFixed(1)); 
            colors.push(m >= 10 ? '#00cc88' : '#ff4d4d'); 
        });
        
        state.chartEvolucao = new Chart(ctx, { 
            type: 'bar', 
            data: { 
                labels: labels.length > 0 ? labels : ['Sem Aval.'], 
                datasets: [{ 
                    label: 'Média Global', 
                    data: values.length > 0 ? values : [0], 
                    backgroundColor: colors, 
                    borderRadius: 6 
                }] 
            }, 
            options: { 
                responsive: true, 
                maintainAspectRatio: false, 
                scales: { y: { min: 10, max: 20, grid: { color: '#333' } }, x: { grid: { display: false } } }, 
                plugins: { legend: { display: false } } 
            } 
        });
    }
}

// Variável global para evitar sobreposição de gráficos
let graficoAlunoInstance = null;

export async function abrirPerfil360Aluno(alunoId) {
    state.alunoSelecionadoId = alunoId; 
    const al = state.alunosTurmaRAM.find(a => a.id === alunoId); 
    if (!al) return;
    
    // 1. DADOS BASE (Com proteções de nulidade)
    const elNome = document.getElementById('p-aluno-nome');
    if (elNome) elNome.innerText = nomeCurto(al.nome); 
    
    const elFoto = document.getElementById('p-aluno-foto');
    if (elFoto) elFoto.src = al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`; 
    
    const inputHidden = document.getElementById('perfil-aluno-id-hidden');
    if (inputHidden) inputHidden.value = alunoId;

    const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
    
    const titleEstat = document.getElementById('perfil-aluno-title-estat');
    if (titleEstat) titleEstat.innerText = isDT ? 'Estatísticas Globais' : 'Estatísticas na Tua Disciplina';
    
    const togDiv = document.getElementById('dt-graph-toggles'); 
    if (togDiv) togDiv.style.display = isDT ? 'flex' : 'none';

    // 2. MEDIDAS MAAI E MÉDIA (Zera a média para carregar novo)
    const elMedia = document.getElementById('p-aluno-media');
    if (elMedia) elMedia.innerHTML = '<i class="fa-solid fa-spinner fa-spin" style="font-size:0.8rem;"></i>';

    const elMaai = document.getElementById('badge-maai-aluno');
    if (elMaai) {
        let maaiHtml = '<span style="background:#333; color:var(--text-muted); padding:4px 8px; border-radius:4px; font-size:0.75rem;">Nenhuma Medida Ativa</span>';
        if (al.maai === 'adicionais') maaiHtml = '<span style="background:var(--danger-red); color:white; padding:4px 8px; border-radius:4px; font-size:0.75rem;"><i class="fa-solid fa-layer-group"></i> Medidas Adicionais</span>';
        else if (al.maai === 'seletivas') maaiHtml = '<span style="background:var(--warning-yellow); color:black; padding:4px 8px; border-radius:4px; font-size:0.75rem;"><i class="fa-solid fa-filter"></i> Medidas Seletivas</span>';
        else if (al.maai === 'universais') maaiHtml = '<span style="background:var(--primary-green); color:black; padding:4px 8px; border-radius:4px; font-size:0.75rem;"><i class="fa-solid fa-globe"></i> Medidas Universais</span>';
        elMaai.innerHTML = maaiHtml;
    }

    // ================================================================
    // O SEGREDO DA ACADEMIA: Leitura segura blindada a maiúsculas/minúsculas
    // ================================================================
    const elAcademia = document.getElementById('p-aluno-academia');
    if (elAcademia) {
        if (al.academia && typeof al.academia === 'string' && al.academia.trim() !== '') {
            // Normalizamos para minúsculas para encontrar na ACADEMIAS_INFO do store.js
            const academiaChave = al.academia.toLowerCase().trim();
            
            if (typeof ACADEMIAS_INFO !== 'undefined' && ACADEMIAS_INFO[academiaChave]) {
                elAcademia.innerText = `Academia ${ACADEMIAS_INFO[academiaChave].nome}`;
                elAcademia.style.color = "var(--primary-green)";
            } else {
                // Fallback: se a academia não existir no store, mas estiver na base de dados
                const nomeCapitalizado = al.academia.charAt(0).toUpperCase() + al.academia.slice(1).toLowerCase();
                elAcademia.innerText = `Academia ${nomeCapitalizado}`;
                elAcademia.style.color = "var(--primary-green)";
            }
        } else {
            elAcademia.innerText = "Sem Academia";
            elAcademia.style.color = "var(--text-muted)";
        }
    }
    // ================================================================

    // 3. DROPDOWN DE DISCIPLINAS E SÍNTESES
    let discSelect = document.getElementById('perfil-disc-select');
    
    // Se o HTML não tiver a caixa de seleção de disciplina, nós criamo-la dinamicamente!
    if (!discSelect) {
        discSelect = document.createElement('select');
        discSelect.id = 'perfil-disc-select';
        discSelect.className = 'input-padrao';
        discSelect.style.marginBottom = '15px';
        discSelect.style.width = '100%';
        
        const chartCanvas = document.getElementById('chartEvolucaoAluno');
        if (chartCanvas) {
            const containerDoGrafico = chartCanvas.parentNode;
            containerDoGrafico.parentNode.insertBefore(discSelect, containerDoGrafico);
        }
    }

    const disciplinasDoAno = filtrarDisciplinasDoAno(state.selectedTurma, isDT ? ordemDisciplinasGlobal : state.disciplinasProfessor);
    
    if (discSelect) {
        discSelect.innerHTML = disciplinasDoAno.map(dc => `<option value="${dc}">${dc}</option>`).join('');
        
        discSelect.onchange = async () => {
            const d = discSelect.value;

            // 1. Histórico de Notas e Lista Inferior
            let notasHtml = '<div style="display:flex; flex-direction:column; gap:8px;">';
            let notasParaMostrar = state.notasAlunoRAM.filter(n => n.disciplina === d);
            notasParaMostrar.sort((a,b) => a.moduloReal - b.moduloReal);
            
            let somaMedia = 0; let countNotas = 0; let notasParaGrafico = [];

            notasParaMostrar.forEach(n => {
                const isRep = n.notaOriginal === 'REP';
                const cor = (isRep || n.valor < 10) ? 'var(--danger-red)' : 'var(--success-green)';
                notasHtml += `
                <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border-left:3px solid ${cor}; display:flex; justify-content:space-between; align-items:center;">
                    <div><span style="font-size:0.85rem; color:var(--text-muted);">${n.disciplina}</span><br><span style="color:white; font-size:0.9rem;">Módulo ${n.moduloReal || '?'}</span></div>
                    <strong style="color:${cor}; font-size:1.1rem;">${n.notaOriginal}</strong>
                </div>`;

                // Guarda as notas positivas para fazer a média e o gráfico
                if(!isRep && n.valor > 0) {
                    somaMedia += n.valor;
                    countNotas++;
                    notasParaGrafico.push({ modulo: n.moduloReal, nota: n.valor });
                }
            });
            
            notasHtml += '</div>';
            if(notasParaMostrar.length === 0) notasHtml = '<p class="text-muted" style="font-size:0.85rem; margin-bottom:10px;">Sem avaliações a '+d+'.</p>';
            
            const histCont = document.getElementById('historico-notas-container');
            if (histCont) histCont.innerHTML = notasHtml;

            // 2. Atualizar a Média no ecrã
            const elMedia = document.getElementById('p-aluno-media');
            if (elMedia) {
                elMedia.innerText = countNotas > 0 ? (somaMedia / countNotas).toFixed(1) : '-';
            }

            // 3. Desenhar o Gráfico Blindado
            const ctxEl = document.getElementById('chartEvolucaoAluno');
            if (ctxEl) {
                if (window.graficoAlunoInstance) window.graficoAlunoInstance.destroy();
                if (state.chartEvolucao) { state.chartEvolucao.destroy(); state.chartEvolucao = null; }

                window.graficoAlunoInstance = new Chart(ctxEl, {
                    type: 'line',
                    data: {
                        labels: notasParaGrafico.length > 0 ? notasParaGrafico.map(n => `Mod ${n.modulo}`) : ['Sem Aval.'],
                        datasets: [{
                            label: 'Nota',
                            data: notasParaGrafico.length > 0 ? notasParaGrafico.map(n => n.nota) : [0],
                            borderColor: '#00cc88',
                            backgroundColor: 'rgba(0, 204, 136, 0.1)',
                            pointBackgroundColor: '#00cc88',
                            pointBorderColor: '#fff',
                            tension: 0.3,
                            fill: true
                        }]
                    },
                    options: { 
                        responsive: true, maintainAspectRatio: false, plugins: { legend: { display: false } }, 
                        scales: { y: { min: 10, max: 20, grid: { color: 'rgba(255,255,255,0.05)' }, ticks: { color: 'rgba(255,255,255,0.5)' } }, x: { grid: { display: false }, ticks: { color: 'rgba(255,255,255,0.5)' } } }
                    }
                });
            }

            // 4. Síntese da Disciplina
            if(!isDT) {
                const elMom = document.getElementById('sintese-momento');
                if (elMom) {
                    try {
                        const rS = await getDoc(doc(db, "utilizadores", alunoId, "reunioes", `sintese_${d}_${elMom.value}`)); 
                        const obsDt = document.getElementById('p-aluno-obs-dt-display');
                        if (obsDt) {
                            if (rS.exists() && rS.data().texto) {
                                obsDt.innerText = rS.data().texto;
                            } else {
                                obsDt.innerHTML = '<span style="color:var(--text-muted); font-style:italic;">Sem síntese registada para este momento.</span>';
                            }
                        }
                    } catch(e) {}
                }
            }
        };
    }

    const elMomento = document.getElementById('sintese-momento');
    if (elMomento) {
        elMomento.onchange = async () => { if(discSelect) discSelect.onchange(); };
        elMomento.value = 'momento_1'; 
    }

    // 4. CARREGAR DADOS DO FIREBASE (Faltas, PRHFs, Notas)
    let fCount = 0; let pCount = 0; state.notasAlunoRAM = [];
    
    try {
        const fS = await getDocs(collection(db, "utilizadores", alunoId, "faltas")); 
        fS.forEach(f => { if(disciplinasDoAno.includes(f.data().disciplina)) fCount += Number(f.data().horas || f.data().duracaoBlocos || 0); });
        
        const pS = await getDocs(collection(db, "utilizadores", alunoId, "prhfs")); 
        pS.forEach(p => { if(p.data().status !== 'concluida' && disciplinasDoAno.includes(p.data().disciplina)) pCount++; });
        
        const extrairMod = (dados, idDoc) => {
            let m = dados.modulo || dados.mod || dados.ufcd;
            if (!m && idDoc && idDoc !== 'hist') m = idDoc.split('_').pop();
            return parseInt(String(m).replace(/\D/g, '')) || m || "?";
        };

        const nS = await getDocs(collection(db, "utilizadores", alunoId, "avaliacoes")); 
        const oldS = await getDocs(collection(db, "utilizadores", alunoId, "notas")); 

        // --- O DESEMPACOTADOR ENTRA AQUI ---
        let notasProcessadas = [...nS.docs];
        oldS.forEach(d => {
            const data = d.data();
            if(data.lista_notas) data.lista_notas.forEach(n => notasProcessadas.push({ data: () => n, id: 'hist' })); // id mock para evitar quebra no extrairMod
            else if(data.disciplina) notasProcessadas.push(d);
        });

        // Agora processamos o array unificado (antigas + novas)
        notasProcessadas.forEach(n => { 
            const dados = n.data();
            if(disciplinasDoAno.includes(dados.disciplina)) { 
                const mFormatado = extrairMod(dados, n.id);
                // Evita notas duplicadas caso exista migração
                if (!state.notasAlunoRAM.some(existente => existente.disciplina === dados.disciplina && String(existente.moduloReal) === String(mFormatado))) {
                    state.notasAlunoRAM.push({ 
                        disciplina: dados.disciplina, 
                        moduloReal: mFormatado, 
                        notaOriginal: dados.nota, 
                        valor: isNaN(dados.nota) ? 0 : Number(dados.nota) 
                    }); 
                }
            } 
        });

        // 6. TRATAR ZONA DAS SÍNTESES
        const areaSintese = document.getElementById('area-sintese-prof');
        if (areaSintese) {
            areaSintese.style.display = 'block';
            
            const tituloSint = areaSintese.querySelector('h4'); 
            const elMomento = document.getElementById('sintese-momento');

            let discSintSelect = document.getElementById('perfil-sintese-disc-select');
            if (!discSintSelect) {
                discSintSelect = document.createElement('select');
                discSintSelect.id = 'perfil-sintese-disc-select';
                discSintSelect.className = 'input-padrao';
                discSintSelect.style.marginBottom = '10px';
                discSintSelect.style.width = '100%';
                if (elMomento) elMomento.insertAdjacentElement('afterend', discSintSelect);
            }

            if (isDT) { 
                const btnJustFaltas = document.getElementById('btn-justificar-faltas');
                if (btnJustFaltas) btnJustFaltas.style.display = fCount > 0 ? 'block' : 'none'; 
                
                if (tituloSint) tituloSint.innerHTML = '<i class="fa-solid fa-clipboard-user"></i> Observações Globais (DT)';
                if (elMomento) elMomento.style.display = 'block'; 
                
                let opts = '<option value="GLOBAL">A Minha Observação Global</option>';
                disciplinasDoAno.forEach(d => {
                    opts += `<option value="${d}">Ver Síntese de ${d}</option>`;
                });
                discSintSelect.innerHTML = opts;
                discSintSelect.style.display = 'block';
                discSintSelect.disabled = false; // Garante que o DT pode clicar

            } else { 
                const btnJustFaltas = document.getElementById('btn-justificar-faltas');
                if (btnJustFaltas) btnJustFaltas.style.display = 'none'; 
                
                if (tituloSint) tituloSint.innerHTML = '<i class="fa-solid fa-clipboard-user"></i> Sínteses das Minhas Disciplinas';
                if (elMomento) elMomento.style.display = 'block';
                
                let opts = '';
                state.disciplinasProfessor.forEach(d => {
                    opts += `<option value="${d}">Síntese de ${d}</option>`;
                });
                discSintSelect.innerHTML = opts;
                
                discSintSelect.style.display = 'block';
                discSintSelect.disabled = state.disciplinasProfessor.length === 1;
            }
            
            if (elMomento) {
                elMomento.dispatchEvent(new Event('change', { bubbles: true }));
            }
        }
        
        if (discSelect) discSelect.onchange();

    } catch (e) {
        console.error("Erro a carregar dados do Firebase no perfil 360:", e);
    }

    // 7. ATUALIZAR CONTADORES GERAIS
    const elFaltas = document.getElementById('p-aluno-faltas');
    if (elFaltas) elFaltas.innerText = fCount; 
    
    const elPrhfs = document.getElementById('p-aluno-prhfs');
    if (elPrhfs) elPrhfs.innerText = pCount; 
    
    const elNotas = document.getElementById('p-aluno-notas');
    if (elNotas) elNotas.innerText = state.notasAlunoRAM.length;
    
    const btnGraphDisc = document.getElementById('btn-graph-disc');
    if (btnGraphDisc) btnGraphDisc.classList.add('active'); 
    
    const btnGraphGlobal = document.getElementById('btn-graph-global');
    if (btnGraphGlobal) btnGraphGlobal.classList.remove('active');
    
    // 8. MOSTRAR O MODAL FINALMENTE
    const modalPerfil = document.getElementById('modal-perfil-aluno');
    if (modalPerfil) modalPerfil.style.display = 'flex';
}

export async function carregarTarefasProf() {
    let isPRHFTab = true; 
    const tabPrhf = document.getElementById('tab-tarefas-prhf');
    const tabPassaporte = document.getElementById('tab-tarefas-passaporte');
    
    if (tabPrhf) {
        isPRHFTab = tabPrhf.classList.contains('active');
        const canSeePassaporteTab = (state.activeRole === 'diretor_turma' || state.activeRole === 'orientador_pap' || state.activeRole === 'coordenador');
        if (tabPassaporte) tabPassaporte.style.display = canSeePassaporteTab ? 'inline-block' : 'none';
        if (!canSeePassaporteTab && !isPRHFTab) { tabPrhf.click(); return; }
    }

    if (isPRHFTab) {
        const isDT = (state.activeRole === 'diretor_turma' && state.selectedTurma === state.minhaTurmaDT);
        const dtToggles = document.getElementById('prhf-dt-toggles');
        
        // Agora não dependemos de um botão com ID fixo que causa erro
        const btnRadar = document.getElementById('btn-radar-conflitos');
        if(isDT) { 
            if(btnRadar) {
                btnRadar.style.display = 'block';
                btnRadar.onclick = async () => {
                    let modal = document.getElementById('modal-radar-conflitos');
                    if (!modal) {
                        const html = `
                        <div id="modal-radar-conflitos" class="modal-overlay" style="display: flex; z-index: 9999; align-items: center; justify-content: center;">
                            <div class="action-sheet" style="max-width: 700px; width: 95%; padding: 20px; max-height: 90vh; overflow-y: auto; background: var(--bg-card); border: 1px solid #333;">
                                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom: 15px;">
                                    <h3 style="color: var(--warning-yellow); margin:0;"><i class="fa-solid fa-satellite-dish"></i> Agenda Global de Presenciais (Turma ${state.minhaTurmaDT})</h3>
                                    <button type="button" onclick="document.getElementById('modal-radar-conflitos').style.display='none'" style="background:none; border:none; color:white; font-size:1.3rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                                </div>
                                <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Usa os filtros abaixo para encontrar sobreposições ou consultar o horário das sessões por disciplina ou aluno.</p>
                                
                                <div style="display:flex; gap:10px; margin-bottom: 15px; flex-wrap: wrap; background: rgba(0,0,0,0.2); padding: 10px; border-radius: 8px; border: 1px solid #444;">
                                    <select id="radar-filtro-aluno" class="input-padrao" style="flex:1; min-width: 150px; margin:0;" onchange="window.renderRadarData()">
                                        <option value="">Todos os Alunos</option>
                                    </select>
                                    <select id="radar-filtro-disc" class="input-padrao" style="flex:1; min-width: 150px; margin:0;" onchange="window.renderRadarData()">
                                        <option value="">Todas as Disciplinas</option>
                                    </select>
                                    <select id="radar-sort" class="input-padrao" style="flex:1; min-width: 150px; margin:0;" onchange="window.renderRadarData()">
                                        <option value="data_desc">Mais Recentes (Data)</option>
                                        <option value="data_asc">Mais Antigas (Data)</option>
                                        <option value="aluno">Agrupar por Aluno (A-Z)</option>
                                        <option value="disc">Agrupar por Disciplina (A-Z)</option>
                                    </select>
                                </div>

                                <div id="radar-conflitos-conteudo"><p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A mapear horários...</p></div>
                            </div>
                        </div>`;
                        document.body.insertAdjacentHTML('beforeend', html);
                        modal = document.getElementById('modal-radar-conflitos');

                        window.renderRadarData = function() {
                            const cont = document.getElementById('radar-conflitos-conteudo');
                            if (!cont) return;

                            const fAluno = document.getElementById('radar-filtro-aluno').value;
                            const fDisc = document.getElementById('radar-filtro-disc').value;
                            const sortModo = document.getElementById('radar-sort').value;

                            if (!window.radarAgendaData || window.radarAgendaData.length === 0) {
                                cont.innerHTML = '<div class="empty-state"><i class="fa-solid fa-calendar-check empty-state-icon" style="color:var(--success-green);"></i><p class="empty-state-desc">Nenhuma sessão presencial agendada na tua turma.</p></div>';
                                return;
                            }

                            let filtered = window.radarAgendaData.filter(s => {
                                if (fAluno && s.alunoNome !== fAluno) return false;
                                if (fDisc && s.disciplina !== fDisc) return false;
                                return true;
                            });

                            filtered.sort((a, b) => {
                                if (sortModo === 'data_desc') {
                                    if (a.data !== b.data) return b.data.localeCompare(a.data);
                                    return b.inicio.localeCompare(a.inicio);
                                } else if (sortModo === 'data_asc') {
                                    if (a.data !== b.data) return a.data.localeCompare(b.data);
                                    return a.inicio.localeCompare(b.inicio);
                                } else if (sortModo === 'aluno') {
                                    if (a.alunoNome !== b.alunoNome) return a.alunoNome.localeCompare(b.alunoNome);
                                    return b.data.localeCompare(a.data); 
                                } else if (sortModo === 'disc') {
                                    if (a.disciplina !== b.disciplina) return a.disciplina.localeCompare(b.disciplina);
                                    const modA = parseInt(a.modulo) || 0;
                                    const modB = parseInt(b.modulo) || 0;
                                    if (modA !== modB) return modA - modB;
                                    return b.data.localeCompare(a.data); 
                                }
                                return 0;
                            });

                            if (filtered.length === 0) {
                                cont.innerHTML = '<p class="text-muted center" style="margin-top:20px;">Nenhuma sessão encontrada com os filtros atuais.</p>';
                                return;
                            }

                            let htmlStr = '<div style="display:flex; flex-direction:column; gap:10px;">';
                            let lastGroup = '';

                            filtered.forEach(s => {
                                let currentGroup = '';
                                let headerText = '';

                                if (sortModo.startsWith('data')) {
                                    currentGroup = s.data;
                                    const datePrint = s.data && s.data.includes('-') ? s.data.split('-').reverse().join('/') : s.data;
                                    headerText = `<i class="fa-regular fa-calendar-days"></i> ${datePrint}`;
                                } else if (sortModo === 'aluno') {
                                    currentGroup = s.alunoNome;
                                    const nm = typeof nomeCurto === 'function' ? nomeCurto(s.alunoNome) : s.alunoNome;
                                    headerText = `<i class="fa-solid fa-user"></i> ${nm}`;
                                } else if (sortModo === 'disc') {
                                    currentGroup = `${s.disciplina} - M${s.modulo}`;
                                    headerText = `<i class="fa-solid fa-book"></i> ${s.disciplina} (Módulo ${s.modulo})`;
                                }

                                if (currentGroup !== lastGroup) {
                                    htmlStr += `<h4 style="color:white; margin:15px 0 5px 0; border-bottom:1px solid #333; padding-bottom:5px;">${headerText}</h4>`;
                                    lastGroup = currentGroup;
                                }

                                const isAceite = s.status === 'aceite';
                                const corBorda = isAceite ? 'var(--success-green)' : 'var(--warning-yellow)';
                                const bgCor = isAceite ? 'rgba(0,204,136,0.08)' : 'rgba(255,204,0,0.08)';
                                const icone = isAceite ? '<i class="fa-solid fa-check"></i> Confirmado' : '<i class="fa-solid fa-clock"></i> Pendente';
                                const nomeSeguro = typeof nomeCurto === 'function' ? nomeCurto(s.alunoNome) : s.alunoNome;
                                const datePrint = s.data && s.data.includes('-') ? s.data.split('-').reverse().join('/') : s.data;

                                htmlStr += `
                                <div style="background:${bgCor}; border-left:4px solid ${corBorda}; padding:10px; border-radius:6px; display:flex; justify-content:space-between; align-items:center;">
                                    <div>
                                        <strong style="color:white; font-size:0.95rem;">${nomeSeguro}</strong> <span style="font-size:0.8rem; color:var(--text-muted);">(${s.disciplina} - M${s.modulo})</span>
                                        <div style="font-size:0.85rem; color:var(--text-light); margin-top:3px;"><strong><i class="fa-regular fa-calendar"></i> ${datePrint} das ${s.inicio} às ${s.fim}</strong> (${s.horas}h)</div>
                                    </div>
                                    <div style="text-align:right;">
                                        <span style="font-size:0.75rem; color:${corBorda}; font-weight:bold;">${icone}</span>
                                    </div>
                                </div>`;
                            });

                            htmlStr += '</div>';
                            cont.innerHTML = htmlStr;
                        };
                    } else {
                        modal.style.display = 'flex';
                        document.getElementById('radar-conflitos-conteudo').innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A mapear horários...</p>';
                        document.getElementById('radar-filtro-aluno').innerHTML = '<option value="">Todos os Alunos</option>';
                        document.getElementById('radar-filtro-disc').innerHTML = '<option value="">Todas as Disciplinas</option>';
                        document.getElementById('radar-sort').value = 'data_desc';
                    }

                    try {
                        const { getDocs, query, collection, where } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                        const alunosSnap = await getDocs(query(collection(window.db || db, "utilizadores"), where("turma", "==", state.minhaTurmaDT), where("papel", "==", "aluno")));
                        let agenda = [];

                        const promises = [];
                        alunosSnap.forEach(docAl => {
                            const al = { id: docAl.id, ...docAl.data() };
                            promises.push(
                                getDocs(collection(window.db || db, "utilizadores", al.id, "prhfs")).then(pSnap => {
                                    pSnap.forEach(pDoc => {
                                        const p = pDoc.data();
                                        if (p.status !== 'concluida' && p.sessoesPresenciais && Array.isArray(p.sessoesPresenciais)) {
                                            p.sessoesPresenciais.forEach(s => {
                                                if (s.data && s.inicio && s.fim) {
                                                    agenda.push({
                                                        alunoNome: al.nome,
                                                        disciplina: p.disciplina,
                                                        modulo: p.modulo,
                                                        data: s.data,
                                                        inicio: s.inicio,
                                                        fim: s.fim,
                                                        horas: s.horas || 1,
                                                        status: s.status || 'aceite',
                                                        tarefa: s.tarefa || ''
                                                    });
                                                }
                                            });
                                        }
                                    });
                                })
                            );
                        });

                        await Promise.all(promises);
                        window.radarAgendaData = agenda;

                        const alunosSet = new Set();
                        const discSet = new Set();
                        agenda.forEach(s => {
                            alunosSet.add(s.alunoNome);
                            discSet.add(s.disciplina);
                        });

                        const selectAluno = document.getElementById('radar-filtro-aluno');
                        const selectDisc = document.getElementById('radar-filtro-disc');

                        Array.from(alunosSet).sort((a, b) => a.localeCompare(b)).forEach(a => {
                            selectAluno.insertAdjacentHTML('beforeend', `<option value="${a}">${typeof nomeCurto === 'function' ? nomeCurto(a) : a}</option>`);
                        });

                        Array.from(discSet).sort((a, b) => a.localeCompare(b)).forEach(d => {
                            selectDisc.insertAdjacentHTML('beforeend', `<option value="${d}">${d}</option>`);
                        });

                        window.renderRadarData();

                    } catch (err) {
                        console.error("Erro no Radar:", err);
                        document.getElementById('radar-conflitos-conteudo').innerHTML = '<p class="text-danger center">Erro ao mapear a agenda.</p>';
                    }
                };
            }
        } else { 
            if(btnRadar) btnRadar.style.display = 'none';
        }

        const container = document.getElementById('lista-prhfs-professor'); 
        const histContainer = document.getElementById('lista-prhfs-historico');
        
        const workflowFiltroEl = document.getElementById('filtro-workflow-prhf');
        const workflowFiltro = workflowFiltroEl ? workflowFiltroEl.value : 'todos';

        // LER OS NOVOS FILTROS
        const turmaFiltroEl = document.getElementById('filtro-curso-turma');
        const moduloFiltroEl = document.getElementById('filtro-curso-modulo');
        const discFiltroEl = document.getElementById('filtro-curso-disciplina'); 
        
        const turmaFiltro = turmaFiltroEl ? turmaFiltroEl.value : '';
        const moduloFiltro = moduloFiltroEl ? moduloFiltroEl.value : '';
        const discFiltro = discFiltroEl ? discFiltroEl.value : ''; 
        
        // POPULA A CAIXA DE DISCIPLINAS COM BASE NA TURMA ESCOLHIDA
        if (discFiltroEl && discFiltroEl.options.length <= 1 && state.turmasProfessor && state.turmasProfessor.length > 0) {
            const turminha = turmaFiltro || state.turmasProfessor[0];
            const discValidas = isDT ? (typeof ordemDisciplinasGlobal !== 'undefined' ? ordemDisciplinasGlobal : state.disciplinasProfessor) : state.disciplinasProfessor;
            const validForTurma = typeof filtrarDisciplinasDoAno === 'function' ? filtrarDisciplinasDoAno(turminha, discValidas) : discValidas;
            
            let opts = '<option value="">Todas as Disciplinas</option>';
            validForTurma.forEach(d => opts += `<option value="${d}">${d}</option>`);
            discFiltroEl.innerHTML = opts;
            discFiltroEl.value = discFiltro; 
        }

        if(!container || !histContainer) return;

        container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A procurar PRHFs...</p>';
        histContainer.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar histórico...</p>';
        
        if (!state.turmasProfessor || state.turmasProfessor.length === 0) { 
            container.innerHTML = '<div class="empty-state"><i class="fa-solid fa-ban empty-state-icon"></i><p class="empty-state-desc">Sem turmas atribuídas.</p></div>'; 
            histContainer.innerHTML = '<div class="empty-state"><i class="fa-solid fa-ban empty-state-icon"></i><p class="empty-state-desc">Sem turmas atribuídas.</p></div>';
            return; 
        }
        
        try {
            let todosAlunos = []; 
            let turmasParaProcurar = turmaFiltro ? [turmaFiltro] : state.turmasProfessor;

            const promessasTurmas = turmasParaProcurar.map(t => 
                getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")))
            );
            const resultadosTurmas = await Promise.all(promessasTurmas);
            
            resultadosTurmas.forEach(snap => {
                snap.forEach(d => todosAlunos.push({ id: d.id, ...d.data() })); 
            });

            let todosPrhfs = [];
            const promessasPrhfs = todosAlunos.map(async (al) => {
                const pSnap = await getDocs(collection(db, "utilizadores", al.id, "prhfs"));
                let prhfsDoAluno = [];
                pSnap.forEach(p => prhfsDoAluno.push({ id: p.id, alunoId: al.id, alunoNome: al.nome, turma: al.turma, ...p.data() }));
                return prhfsDoAluno;
            });
            
            const resultadosPrhfs = await Promise.all(promessasPrhfs);
            resultadosPrhfs.forEach(arr => todosPrhfs.push(...arr));
            
            todosPrhfs.sort((a,b) => {
                if (a.urgente && !b.urgente) return -1;
                if (!a.urgente && b.urgente) return 1;
                return new Date(a.prazo || 0) - new Date(b.prazo || 0);
            }); 
            
            const matVerificar = (isDT && state.prhfViewMode === 'todas') ? (typeof ordemDisciplinasGlobal !== 'undefined' ? ordemDisciplinasGlobal : state.disciplinasProfessor) : state.disciplinasProfessor;
            let pendentes = todosPrhfs.filter(p => p.status !== 'concluida' && matVerificar.includes(p.disciplina));
            let concluidos = todosPrhfs.filter(p => p.status === 'concluida' && matVerificar.includes(p.disciplina));
            
            // APLICAR OS NOVOS FILTROS
            if (workflowFiltro === 'acao_prof') {
                pendentes = pendentes.filter(p => {
                    if (p.sessoesPresenciais) return p.sessoesPresenciais.some(s => s.status === 'pendente');
                    return p.propostaAluno && !p.propostaLidaDT;
                });
            }
            if (moduloFiltro) {
                pendentes = pendentes.filter(p => String(p.modulo) === moduloFiltro);
            }
            if (discFiltro) { // <-- FILTRO APLICADO AQUI!
                pendentes = pendentes.filter(p => p.disciplina === discFiltro);
            }

            let h = ''; 
            if (pendentes.length === 0) { 
                h = `<div class="empty-state"><i class="fa-solid fa-check empty-state-icon" style="color:var(--success-green);"></i><p class="empty-state-desc">Não há PRHFs pendentes para esta vista.</p></div>`; 
            }
            
            pendentes.forEach(p => {
                const souOProfessorDoPRHF = state.disciplinasProfessor.includes(p.disciplina) || p.professor === state.myUserName;
                let acoesProposta = '';
                let progresso = 25;
                let caixasSessoesHtml = '';
                let sessoesList = [];
                let temPendentes = false;
                let totalHorasMarcadas = 0; // NOVO CONTADOR DO PROFESSOR
                
                if (p.sessoesPresenciais && Array.isArray(p.sessoesPresenciais)) {
                    sessoesList = p.sessoesPresenciais;
                } else if (p.propostaProfessor) {
                    sessoesList = [{ data: 'Acordado', inicio: '', fim: '', tarefa: p.propostaProfessor, status: 'aceite', horas: p.horasPresenciais || 1 }];
                } else if (p.propostaAluno) {
                    sessoesList = [{ data: 'Proposto', inicio: '', fim: '', tarefa: p.propostaAluno, status: (p.propostaLidaDT ? 'aceite' : 'pendente'), horas: p.horasPresenciais || 1 }];
                }

                if (sessoesList.length > 0) {
                    progresso = 40;
                    sessoesList.forEach((s, idx) => {
                        const sHoras = Number(s.horas || 1);
                        totalHorasMarcadas += sHoras; // SOMA AS HORAS DESTA CAIXA

                        const dataFormatada = s.data && s.data.includes('-') ? s.data.split('-').reverse().join('/') : (s.data || '');
                        const horaFormatada = s.inicio && s.fim ? `das ${s.inicio} às ${s.fim}` : '';
                        const horasTotaisTxt = ` — <strong>${sHoras}h</strong>`;
                        
                        const isAceite = s.status === 'aceite' || p.propostaLidaDT === true;
                        if (!isAceite) temPendentes = true;

                        const corBorda = isAceite ? 'var(--success-green)' : 'var(--warning-yellow)';
                        const bgCor = isAceite ? 'rgba(0,204,136,0.08)' : 'rgba(255,204,0,0.08)';
                        const iconeStatus = isAceite ? '<i class="fa-solid fa-calendar-check" style="color:var(--success-green);"></i>' : '<i class="fa-solid fa-clock" style="color:var(--warning-yellow);"></i>';
                        const labelStatus = isAceite ? 'Sessão Confirmada' : 'A aguardar a tua validação';
                        const labelSugestao = isAceite ? 'Agendado' : 'Aluno Sugere';
                        const tarefaInfo = s.tarefa ? `<p style="font-size:0.8rem; color:var(--text-light); margin:5px 0 0 0;"><strong>Nota/Tarefa:</strong> ${s.tarefa}</p>` : '';

                        caixasSessoesHtml += `
                        <div style="background:${bgCor}; border:1px dashed ${corBorda}; padding:10px; border-radius:8px; margin-top:10px; position:relative;">
                            ${souOProfessorDoPRHF ? `<button class="btn-eliminar-proposta" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="position:absolute; top:10px; right:10px; background:none; border:none; color:var(--danger-red); cursor:pointer;"><i class="fa-solid fa-trash"></i></button>` : ''}
                            <strong style="color:${corBorda}; font-size:0.85rem;">${iconeStatus} ${labelSugestao} (Sessão #${idx + 1})</strong>
                            <p style="font-size:0.85rem; color:white; margin:5px 0; font-weight:bold;">${dataFormatada} ${horaFormatada}${horasTotaisTxt}</p>
                            ${tarefaInfo}
                            <span style="font-size:0.75rem; color:var(--text-muted);">${labelStatus}</span>
                        </div>`;
                    });
                }

                if (temPendentes) {
                    progresso = 50;
                    if (souOProfessorDoPRHF) {
                        caixasSessoesHtml += `
                        <div style="display:flex; gap:10px; margin-top:10px;">
                            <button class="primary-btn small-btn btn-aceitar-proposta" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1; background:var(--success-green);"><i class="fa-solid fa-check"></i> Aceitar Novas</button>
                            <button class="secondary-btn small-btn btn-rejeitar-proposta" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1; border-color:var(--danger-red); color:var(--danger-red);"><i class="fa-solid fa-xmark"></i> Rejeitar</button>
                        </div>`;
                    }
                } else if (sessoesList.length > 0) {
                    progresso = 75;
                }

                acoesProposta = caixasSessoesHtml;
                if(p.presencaValidada) progresso = 90;

                let conflitoTag = ''; 
                if(isDT && p.propostaLidaDT) { 
                    conflitoTag = ''; 
                }

                const isUrgente = p.urgente; 
                const corCard = isUrgente ? 'var(--danger-red)' : 'var(--warning-yellow)'; 
                const txtSt = isUrgente ? 'URGENTE' : 'EM CURSO'; 
                
                const barraProgressoHtml = `<div style="width:100%; background:rgba(255,255,255,0.1); height:6px; border-radius:3px; margin: 10px 0; overflow:hidden;"><div style="width:${progresso}%; background:${corCard}; height:100%; border-radius:3px; transition:width 0.5s ease;"></div></div>`;

                const hPres = Number(p.horasPresenciais || 0);
                const estadoPrazo = obterEstadoPrazo(p.prazo);

                let btnAction = '';
                let btnSugerir = '';

                if(souOProfessorDoPRHF) { 
                    if (hPres > 0) { 
                        // GESTÃO DO BOTÃO COM BASE NO LIMITE DE HORAS
                        if (totalHorasMarcadas < hPres) {
                            btnSugerir = `<button class="secondary-btn small-btn btn-propor-prof" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="flex:1;"><i class="fa-regular fa-calendar"></i> Sugerir (${totalHorasMarcadas}/${hPres}h)</button>`; 
                        } else {
                            btnSugerir = `<button class="secondary-btn small-btn" disabled style="flex:1; opacity:0.5; border-color:var(--success-green); color:var(--success-green); cursor:not-allowed;"><i class="fa-solid fa-calendar-check"></i> Horas Preenchidas (${hPres}h)</button>`;
                        }

                        if (!p.propostaLidaDT && temPendentes) { 
                            btnAction = `<button class="secondary-btn small-btn" disabled style="width:100%; opacity:0.5;"><i class="fa-solid fa-clock"></i> Aguarda Validação</button>`; 
                        } else if (!p.presencaValidada) { 
                            btnAction = `<button class="primary-btn small-btn btn-validar-presenca" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="width:100%; background:var(--warning-yellow); color:black;"><i class="fa-solid fa-user-check"></i> Validar Presença</button>`; 
                        } else { 
                            btnAction = `<button class="btn-concluir-prhf primary-btn small-btn" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="width:100%; background:var(--success-green); color:white;"><i class="fa-solid fa-clipboard-check"></i> Fechar Plano</button>`; 
                        } 
                    } else { 
                        btnAction = `<button class="btn-concluir-prhf primary-btn small-btn" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="width:100%; background:var(--success-green); color:white;"><i class="fa-solid fa-clipboard-check"></i> Fechar Plano</button>`; 
                    } 
                }
                
                h += `
                <div class="card" style="margin-bottom:15px; border-left: 4px solid ${corCard}; position:relative;">
                    <button class="btn-edit-prhf" data-aluno="${p.alunoId}" data-prhf="${p.id}" style="position:absolute; top:15px; right:15px; background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem;"><i class="fa-solid fa-pen"></i></button>
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="width: 85%;">
                            <strong style="color:white; font-size:1.05rem;">${nomeCurto(p.alunoNome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${p.turma})</span></strong>
                            <div style="color:${corCard}; font-weight:bold; font-size:0.9rem; margin-top:3px;">${p.disciplina} (Mod. ${p.modulo}) - ${txtSt} ${conflitoTag}</div>
                            ${barraProgressoHtml}
                        </div>
                    </div>
                    <p style="font-size:0.85rem; color:var(--text-light); margin:5px 0 10px 0;">${p.descricao}</p>
                    <p style="font-size:0.8rem; color:${estadoPrazo.cor}; font-weight: bold; margin-bottom: 10px; background: rgba(0,0,0,0.2); padding: 5px; border-radius: 4px; display: inline-block;">
                        ${estadoPrazo.icone} ${estadoPrazo.aviso} | Presenciais: <strong>${hPres}h</strong>
                    </p>
                    ${acoesProposta} 
                    <div style="display:flex; gap:10px; margin-top:10px;">
                        ${btnSugerir} 
                        ${btnAction}
                    </div>
                </div>`;
            }); 
            container.innerHTML = h;

            const filtroDataEl = document.getElementById('filtro-prhf-data');
            const filtroModEl = document.getElementById('filtro-prhf-modulo');
            const dFiltro = filtroDataEl ? filtroDataEl.value : 'desc'; 
            const mFiltro = filtroModEl ? filtroModEl.value : ''; 
            
            let concluidosFiltrados = concluidos;
            
            // FILTROS ATUALIZADOS PARA O HISTÓRICO
            if (turmaFiltro) concluidosFiltrados = concluidosFiltrados.filter(c => c.turma === turmaFiltro);
            if (discFiltro) concluidosFiltrados = concluidosFiltrados.filter(c => c.disciplina === discFiltro);
            if (mFiltro) concluidosFiltrados = concluidosFiltrados.filter(c => c.modulo == mFiltro);
            
            concluidosFiltrados.sort((a,b) => {
                const da = a.dataCriacao ? new Date(a.dataCriacao) : 0; 
                const db = b.dataCriacao ? new Date(b.dataCriacao) : 0; 
                return dFiltro === 'desc' ? db - da : da - db; 
            });

            let histHtml = '';
            if (concluidosFiltrados.length === 0) { 
                histHtml += `<div class="empty-state"><i class="fa-solid fa-clock-rotate-left empty-state-icon"></i><p class="empty-state-desc">Nenhum plano registado no histórico com estes filtros.</p></div>`; 
            } else { 
                concluidosFiltrados.forEach(c => { 
                    const dataConcluida = c.dataCriacao ? new Date(c.dataCriacao).toLocaleDateString('pt-PT') : 'Antigo'; 
                    const hPres = Number(c.horasPresenciais || 0);
                    const presInfo = hPres > 0 ? `<span style="font-size:0.75rem; color:var(--warning-yellow); display:inline-block; margin-top:3px;"><i class="fa-solid fa-clock"></i> ${hPres}h Presenciais cumpridas</span>` : '';
                    const tarefaPresencialInfo = c.tarefaPresencial ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:5px; border-top: 1px dashed #333; padding-top:5px;"><strong>Trabalho Aula:</strong> ${c.tarefaPresencial}</div>` : '';
                    
                    histHtml += `
                    <div style="background:rgba(0,0,0,0.2); border-left: 3px solid var(--success-green); padding:12px; border-radius:6px; margin-bottom:10px;">
                        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                            <div>
                                <strong style="color:white; font-size:0.95rem;">${nomeCurto(c.alunoNome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${c.turma})</span></strong><br>
                                <span style="font-size:0.8rem; color:var(--success-green); font-weight:bold;">${c.disciplina} - Módulo ${c.modulo}</span><br>
                                ${presInfo}
                            </div>
                            <div style="text-align:right;">
                                <span style="font-size:0.7rem; color:var(--text-muted);">Fechado a</span><br>
                                <strong style="font-size:0.8rem; color:white;">${dataConcluida}</strong>
                            </div>
                        </div>
                        <div style="font-size:0.8rem; color:var(--text-light); margin-top:8px; line-height:1.4;">
                            <strong>Tarefa Geral:</strong> ${c.descricao || 'Sem descrição global'}
                        </div>
                        ${tarefaPresencialInfo}
                        ${c.feedbackProfessor ? `<div style="font-size:0.8rem; color:black; margin-top:8px; background:rgba(0, 204, 136, 0.7); padding:6px; border-radius:4px;"><strong>Feedback:</strong> ${c.feedbackProfessor}</div>` : ''}
                    </div>`; 
                }); 
            }
            histContainer.innerHTML = histHtml;
        } catch (e) { 
            console.error("Erro PRHF:", e);
            container.innerHTML = '<p class="text-danger center">Erro ao carregar PRHFs pendentes.</p>'; 
            histContainer.innerHTML = '<p class="text-danger center">Erro ao carregar histórico.</p>';
        }
    } else {
        // ... (código FCT e PAP permanece igual)
        const container = document.getElementById('lista-passaportes-professor'); 
        if(!container) return;
        container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar passaportes...</p>';
        try {
            let todosAlunos = []; 
            
            // 👉 ACELERAÇÃO PARA O PASSAPORTE / PAP (Paralelo)
            const promessasPassaporte = state.turmasProfessor.map(t => 
                getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")))
            );
            const resultadosPassaporte = await Promise.all(promessasPassaporte);
            
            resultadosPassaporte.forEach(snap => {
                snap.forEach(d => todosAlunos.push({ id: d.id, ...d.data() })); 
            });
            
            const sortMode = document.getElementById('sort-passaporte') ? document.getElementById('sort-passaporte').value : 'fct';
            if(sortMode === 'fct') { 
                todosAlunos.sort((a,b) => (b.fct?.horasRealizadas || 0) - (a.fct?.horasRealizadas || 0)); 
            }

            let h = '';
            todosAlunos.forEach(al => {
                const turmaAno = parseInt(al.turma.match(/\d+/)?.[0]) || 10;
                let showFCT = turmaAno >= 11; let showPAP = turmaAno === 12;
                if(!showFCT && !showPAP) return;

                let fctHtml = ''; 
                if (showFCT) { 
                    if (al.fct && al.fct.horasRealizadas > 0) { 
                        if (al.fct.validadoDT) { 
                            fctHtml = `<span style="color:var(--success-green); font-size:0.8rem;"><i class="fa-solid fa-check-double"></i> ${al.fct.horasRealizadas}h Validadas</span>`; 
                        } else { 
                            let btnValidar = state.activeRole === 'coordenador' || state.activeRole === 'diretor_turma' ? `<button class="primary-btn small-btn btn-validar-fct" data-id="${al.id}" style="width:auto; padding:4px 10px;">Validar</button>` : `<span style="font-size:0.75rem; color:var(--text-muted);">A aguardar validação.</span>`; 
                            fctHtml = `<div style="display:flex; justify-content:space-between; align-items:center;"><span style="color:var(--warning-yellow); font-size:0.8rem;">${al.fct.horasRealizadas}h declaradas</span> ${btnValidar}</div>`; 
                        } 
                    } else { 
                        fctHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Sem registos FCT.</span>`; 
                    } 
                }

                let papHtml = ''; 
                if (showPAP) { 
                    if (al.papFicheiroEnviado && al.papFicheiroBase64) { 
                        if (state.activeRole === 'orientador_pap' || state.activeRole === 'diretor_turma' || state.activeRole === 'coordenador') { 
                            papHtml = `
                            <span style="color:white; font-size:0.85rem; display:block; margin-bottom:5px;">Tema: ${al.pap?.tema || 'Desconhecido'}</span>
                            <a href="${al.papFicheiroBase64}" download="PAP_${al.nome.replace(/\s+/g, '_')}" class="secondary-btn small-btn" style="color:#0099ff; border-color:#0099ff; display:inline-block; text-align:center; margin-bottom:5px;"><i class="fa-solid fa-download"></i> Baixar Relatório Final</a>`; 
                            
                            if (state.activeRole === 'orientador_pap') { 
                                if (!al.pap.relatorioAprovado) { 
                                    papHtml += `<button class="primary-btn small-btn btn-aprovar-relatorio" data-id="${al.id}" style="width:100%; background:var(--success-green); margin-top:5px;"><i class="fa-solid fa-check"></i> Aprovar Relatório</button>`; 
                                } else { 
                                    papHtml += `<span style="color:var(--success-green); font-size:0.8rem; display:block; margin-top:5px;"><i class="fa-solid fa-check-double"></i> Apto para Apresentação Final</span>`; 
                                } 
                            } 
                        } else { 
                            papHtml = `<span style="color:var(--success-green); font-size:0.8rem;"><i class="fa-solid fa-check"></i> Relatório submetido</span>`; 
                        } 
                    } else if (al.pap && al.pap.tema) { 
                        let statusTag = al.pap.temaAprovado ? `<span style="color:var(--warning-yellow);">Em Desenvolvimento</span>` : `<span style="color:#00d2ff;">A Aguardar Aprovação</span>`; 
                        papHtml = `<span style="color:var(--text-light); font-size:0.8rem;">Tema: <strong style="color:white;">${al.pap.tema}</strong><br>${statusTag}</span>`; 
                        if (state.activeRole === 'orientador_pap' && !al.pap.temaAprovado) { 
                            papHtml += `<div style="display:flex; gap:10px; margin-top:10px;"><button class="primary-btn small-btn btn-aprovar-tema" data-id="${al.id}" style="flex:1; background:var(--success-green);"><i class="fa-solid fa-check"></i> Aceitar</button><button class="secondary-btn small-btn btn-rejeitar-tema" data-id="${al.id}" style="flex:1; border-color:var(--danger-red); color:var(--danger-red);"><i class="fa-solid fa-xmark"></i> Rejeitar</button></div>`; 
                        } 
                    } else { 
                        papHtml = `<span style="color:var(--text-muted); font-size:0.8rem;">Por iniciar.</span>`; 
                    } 
                }

                let bodyHtml = '';
                if(showFCT) bodyHtml += `<div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px dashed #333;"><strong style="font-size:0.85rem; color:white;"><i class="fa-solid fa-briefcase" style="color:var(--primary-green);"></i> FCT (Estágio)</strong><div style="margin-top:5px;">${fctHtml}</div></div>`;
                if(showPAP) bodyHtml += `<div style="margin-top:10px; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px dashed #333;"><strong style="font-size:0.85rem; color:white;"><i class="fa-solid fa-laptop-code" style="color:#0099ff;"></i> Projeto de Aptidão Profissional (PAP)</strong><div style="margin-top:5px;">${papHtml}</div></div>`;
                h += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #ff9900;"><strong style="color:white; font-size:1.05rem;">${nomeCurto(al.nome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span></strong>${bodyHtml}</div>`;
            }); 
            container.innerHTML = h === '' ? '<div class="empty-state"><i class="fa-solid fa-briefcase empty-state-icon"></i><p class="empty-state-desc">Nenhum aluno submeteu dados de Passaporte.</p></div>' : h;
        } catch (e) { container.innerHTML = '<p class="text-danger center">Erro ao carregar passaportes.</p>'; }
    }
}

export async function carregarForunsProf() {
    const cont = document.getElementById('prof-forum-channel-list'); 
    cont.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A ler canais...</p>';
    if(!state.turmasProfessor || state.turmasProfessor.length === 0) { 
        cont.innerHTML = '<div class="empty-state"><i class="fa-solid fa-comments empty-state-icon"></i><p class="empty-state-desc">Não tens turmas atribuídas para visualizar fóruns.</p></div>'; 
        return; 
    }

    // ==========================================
    // 1. MODO: ORIENTADOR PAP
    // ==========================================
    if (state.activeRole === 'orientador_pap') {
        let html = '<h3 style="font-size:1rem; color:var(--text-muted); margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">Rede de Orientação</h3><div class="canal-card" data-turma="Global" data-disc="Orientadores" data-nome="Equipa de Orientadores"><div class="canal-icon" style="color:var(--success-green); border-color:var(--success-green);"><i class="fa-solid fa-users-viewfinder"></i></div><div class="canal-info" style="flex:1;"><h4>Equipa de Orientadores</h4><p>Chat fechado de coordenação</p></div></div><h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Os Meus Orientandos</h3>';
        let temAlunos = false;
        try {
            let meusOrientandos = [];
            for (const t of state.turmasProfessor) { 
                const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); 
                snap.forEach(d => { 
                    const data = d.data(); 
                    if (data.pap && (data.pap.orientador === state.myUserName || data.pap.orientador === state.myUserId)) { 
                        meusOrientandos.push({ id: d.id, ...data }); 
                    } 
                }); 
            }
            if (meusOrientandos.length > 0) {
                temAlunos = true;
                html += `<div class="canal-card" data-turma="Global" data-disc="Avisos_Orientandos_${state.myUserId}" data-nome="Avisos (Todos os Orientandos)"><div class="canal-icon" style="color:#0099ff; border-color:#0099ff;"><i class="fa-solid fa-bullhorn"></i></div><div class="canal-info" style="flex:1;"><h4>Avisos Gerais</h4><p>Mensagem para os teus alunos</p></div></div>`;
                meusOrientandos.forEach(al => { 
                    html += `<div class="canal-card" data-turma="${al.turma}" data-disc="PAP_${al.id}" data-nome="PAP - ${nomeCurto(al.nome)}"><div class="canal-icon" style="color:var(--warning-yellow); border-color:var(--warning-yellow); padding:0; overflow:hidden;"><img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:100%;height:100%;object-fit:cover;"></div><div class="canal-info" style="flex:1;"><h4>${nomeCurto(al.nome)}</h4><p>Apoio Individual</p></div></div>`; 
                });
            }
        } catch(e) {}
        if (!temAlunos) html += '<p class="text-muted center" style="font-size:0.85rem;">Não tens orientandos atribuídos neste momento.</p>';
        cont.innerHTML = `<div class="forum-canais-grid">${html}</div>`; 
        return; 
    }

    // ==========================================
    // 2. MODO: DIRETOR DE TURMA (Estrutura Focada + Múltiplas Turmas)
    // ==========================================
    if (state.activeRole === 'diretor_turma') {
        let turmasDoDT = [];
        if (state.profData.turmasDT) {
            turmasDoDT = Array.isArray(state.profData.turmasDT) ? state.profData.turmasDT : [state.profData.turmasDT];
        } else if (state.profData.turmaDT) {
            turmasDoDT = Array.isArray(state.profData.turmaDT) ? state.profData.turmaDT : [state.profData.turmaDT];
        } else {
            turmasDoDT = state.turmasProfessor; 
        }

        let html = '<h3 style="font-size:1rem; color:var(--text-muted); margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">Estrutura da Turma</h3>';
        html += `<div class="canal-card" data-turma="Global" data-disc="Coordenador" data-nome="Coordenador de Curso"><div class="canal-icon" style="color:#ff4d4d; border-color:#ff4d4d;"><i class="fa-solid fa-sitemap"></i></div><div class="canal-info" style="flex:1; display:flex; justify-content:space-between; align-items:center;"><h4>Coordenador de Curso</h4><span class="notification-badge" style="position:relative; top:0; right:0; display:none;">!</span></div></div>`;

        turmasDoDT.forEach(t => {
            html += `<div class="canal-card" data-turma="${t}" data-disc="Professores" data-nome="Conselho de Turma - ${t}"><div class="canal-icon" style="color:#b82bf2; border-color:#b82bf2;"><i class="fa-solid fa-chalkboard-user"></i></div><div class="canal-info" style="flex:1; display:flex; justify-content:space-between; align-items:center;"><h4>Conselho de Turma - ${t}</h4><span class="notification-badge" style="position:relative; top:0; right:0; display:none;">!</span></div></div>`;
        });

        html += `<h3 style="font-size:1rem; color:var(--warning-yellow); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;"><i class="fa-solid fa-user-tie"></i> Atendimento a Encarregados de Educação</h3>`;
        
        try {
            // A MAGIA: Pesquisar todos os E.E. na base de dados e criar um dicionário!
            let mapaEEs = {};
            const snapTodosEEs = await getDocs(query(collection(db, "utilizadores"), where("papel", "==", "ee")));
            snapTodosEEs.forEach(eeDoc => {
                const eeData = eeDoc.data();
                let arr = [];
                if (Array.isArray(eeData.educandos)) arr = eeData.educandos;
                else if (Array.isArray(eeData.educandoId)) arr = eeData.educandoId;
                else if (typeof eeData.educandoId === 'string') arr = [eeData.educandoId];
                else if (eeData.educando) arr = [eeData.educando];
                
                arr.forEach(alId => {
                    if(alId) mapaEEs[alId] = eeData.nome || "Encarregado(a) de Educação";
                });
            });

            let arrAlunos = [];
            for (const t of turmasDoDT) {
                const snapAlunos = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                snapAlunos.forEach(d => arrAlunos.push({id: d.id, ...d.data()}));
            }
            arrAlunos.sort((a,b) => a.nome.localeCompare(b.nome));
            
            if(arrAlunos.length === 0) {
                html += '<p class="text-muted" style="font-size:0.85rem;">Turmas sem alunos registados.</p>';
            } else {
                arrAlunos.forEach(al => {
                    const nomeDoEE = mapaEEs[al.id];
                    let tituloChat = '';
                    let subtituloChat = '';
                    let nomeParaTopo = '';

                    // Se o nome do E.E. existir na BD
                    if (nomeDoEE) {
                        tituloChat = nomeDoEE;
                        subtituloChat = `E.E. de ${nomeCurto(al.nome)} • Turma ${al.turma}`;
                        nomeParaTopo = `${nomeDoEE} (E.E. de ${nomeCurto(al.nome)}, Turma ${al.turma})`;
                    } else {
                        // Se não existir na BD (Fallback)
                        tituloChat = `E.E. de ${nomeCurto(al.nome)}`;
                        subtituloChat = `Turma ${al.turma}`;
                        nomeParaTopo = tituloChat;
                    }

                    html += `<div class="canal-card" data-turma="EE" data-disc="${al.id}" data-nome="${nomeParaTopo}">
                        <div class="canal-icon" style="color:var(--warning-yellow); border-color:var(--warning-yellow); padding:0; overflow:hidden;">
                            <img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:100%;height:100%;object-fit:cover;">
                        </div>
                        <div class="canal-info" style="flex:1; display:flex; justify-content:space-between; align-items:center;">
                            <div>
                                <h4>${tituloChat}</h4>
                                <p style="font-size:0.75rem;">${subtituloChat}</p>
                            </div>
                        </div>
                    </div>`;
                });
            }
        } catch(e) { console.error(e); }
        
        cont.innerHTML = `<div class="forum-canais-grid">${html}</div>`;
        return; 
    }

    // ==========================================
    // 3. MODO: PROFESSOR (O TEU CÓDIGO ORIGINAL INTACTO!)
    // ==========================================
    let html = '<h3 style="font-size:1rem; color:var(--text-muted); margin-bottom:10px; border-bottom:1px solid #333; padding-bottom:5px;">Estrutura da Turma</h3>';
    html += `<div class="canal-card" data-turma="Global" data-disc="Coordenador" data-nome="Coordenador de Curso"><div class="canal-icon" style="color:#ff4d4d; border-color:#ff4d4d;"><i class="fa-solid fa-sitemap"></i></div><div class="canal-info" style="flex:1; display:flex; justify-content:space-between; align-items:center;"><h4>Coordenador de Curso</h4><span class="notification-badge" style="position:relative; top:0; right:0; display:none;">!</span></div></div>`;

    state.turmasProfessor.forEach(t => {
        html += `<div class="canal-card" data-turma="${t}" data-disc="Professores" data-nome="Conselho de Turma - ${t}"><div class="canal-icon" style="color:#b82bf2; border-color:#b82bf2;"><i class="fa-solid fa-chalkboard-user"></i></div><div class="canal-info" style="flex:1; display:flex; justify-content:space-between; align-items:center;"><h4>Conselho de Turma - ${t}</h4><span class="notification-badge" style="position:relative; top:0; right:0; display:none;">!</span></div></div>`;
        html += `<div class="canal-card" data-turma="${t}" data-disc="DT_Privado" data-nome="Diretor de Turma - ${t}"><div class="canal-icon" style="color:#ffaa00; border-color:#ffaa00;"><i class="fa-solid fa-user-tie"></i></div><div class="canal-info" style="flex:1; display:flex; justify-content:space-between; align-items:center;"><h4>Diretor de Turma - ${t}</h4><span class="notification-badge" style="position:relative; top:0; right:0; display:none;">!</span></div></div>`;
    });
    
    html += '<h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">A Minha Disciplina</h3>';
    state.turmasProfessor.forEach(t => { 
        const discValidas = filtrarDisciplinasDoAno(t, state.disciplinasProfessor);
        discValidas.forEach(d => { 
            html += `<div class="canal-card" data-turma="${t}" data-disc="${d}" data-nome="Apoio a ${d}"><div class="canal-icon" style="color:#00d2ff; border-color:#00d2ff;"><i class="fa-solid fa-book-open"></i></div><div class="canal-info" style="flex:1; display:flex; justify-content:space-between; align-items:center;"><div><h4>Apoio a ${d}</h4><p>Turma${t}</p></div><span class="notification-badge" style="position:relative; top:0; right:0; display:none;">!</span></div></div>`; 
        }); 
    });

    html += '<h3 style="font-size:1rem; color:var(--text-muted); margin:20px 0 10px 0; border-bottom:1px solid #333; padding-bottom:5px;">Chats Personalizados</h3>';
    let encontrouPersonalizado = false; let htmlPersonalizado = '<div style="display:flex; flex-direction:column; gap:10px;">';
    
    try {
        const s = await getDocs(collection(db, "forums")); 
        let arr = []; 
        s.forEach(d => arr.push({id: d.id, ...d.data()}));
        
        arr.forEach(f => { 
            let souParticipante = false;
            
            if (f.criadoPor === state.myUserName) souParticipante = true;
            else if (f.participantes && Array.isArray(f.participantes) && f.participantes.includes(state.myUserId)) souParticipante = true;
            else if (f.membros && Array.isArray(f.membros) && f.membros.includes(state.myUserId)) souParticipante = true;
            else if (f.turma && state.turmasProfessor && state.turmasProfessor.includes(f.turma)) souParticipante = true;
            
            if (souParticipante && !f.isDefault && f.isGlobal !== true) { 
                encontrouPersonalizado = true;
                const iconConfig = f.criadoPor === state.myUserName ? `<i class="fa-solid fa-gear btn-edit-chat" data-id="${f.id}" data-turma="${f.turma || ''}" style="color:var(--warning-yellow); font-size:1.2rem; cursor:pointer; padding:5px;"></i>` : ``;
                
                htmlPersonalizado += `<div class="canal-card" data-turma="custom" data-disc="${f.id}" data-nome="${f.nome}" style="position:relative;">
                    <div class="canal-icon" style="color:#00cc88; border-color:#00cc88;"><i class="fa-solid fa-comments"></i></div>
                    <div class="canal-info" style="flex:1; display:flex; justify-content:space-between; align-items:center;">
                        <div>
                            <h4>${f.nome}</h4>
                            <p>${f.turma ? `Turma ${f.turma}` : 'Grupo de Estudo'}</p>
                        </div>
                        <span class="notification-badge" style="position:relative; top:0; right:0; display:none;">!</span>
                    </div>
                    ${iconConfig}
                </div>`; 
            } 
        });
        
        if (!encontrouPersonalizado) { htmlPersonalizado += '<div class="empty-state"><i class="fa-solid fa-comments empty-state-icon"></i><p class="empty-state-desc">Nenhum chat extra criado.</p></div>'; }
        htmlPersonalizado += '</div>'; cont.innerHTML = `<div class="forum-canais-grid">${html}${htmlPersonalizado}</div>`;
    } catch (e) { console.error(e); cont.innerHTML = '<p class="text-danger center">Erro a carregar chats.</p>'; }
}

export function abrirChatForum(turma, disciplina, nomeCustom) {
    state.activeChatTurma = turma; 
    state.activeChatDisc = disciplina;
    
    document.getElementById('prof-forum-channel-list').style.display = 'none'; 
    document.getElementById('btn-create-chat-prof').style.display = 'none'; 
    document.getElementById('prof-forum-chat-view').style.display = 'flex'; 
    
    const chatTitle = nomeCustom || disciplina;
    // Omitir o sufixo (EE) ou (custom) do título para ficar mais limpo
    document.getElementById('prof-chat-active-title').innerText = (turma !== 'custom' && turma !== 'EE') ? `${chatTitle} (${turma})` : chatTitle;
    
    const msgCont = document.getElementById('prof-chat-messages-container'); 
    msgCont.innerHTML = '<p class="text-muted center">A carregar mensagens...</p>';
    
    let forumDocRef;
    let mensagensCollRef;
    
    if (turma === 'custom') {
        forumDocRef = doc(db, "forums", disciplina);
        mensagensCollRef = collection(db, "forums", disciplina, "mensagens");
    } else if (turma === 'EE') {
        // A MAGIA DO DT: Encaminha diretamente para a pasta secreta do Aluno
        forumDocRef = doc(db, "utilizadores", disciplina); 
        mensagensCollRef = collection(db, "utilizadores", disciplina, "chat_dt");
    } else {
        forumDocRef = doc(db, "turmas", turma, "foruns", disciplina);
        mensagensCollRef = collection(db, "turmas", turma, "foruns", disciplina, "mensagens");
    }

    if (state.chatMetaUnsubscribe) state.chatMetaUnsubscribe();
    state.chatMetaUnsubscribe = onSnapshot(forumDocRef, (docSnap) => {
        if(docSnap.exists() && docSnap.data().pinnedMessage) {
            document.getElementById('prof-chat-pinned-banner').style.display = 'flex';
            document.getElementById('prof-chat-pinned-text').innerText = docSnap.data().pinnedMessage;
        } else {
            document.getElementById('prof-chat-pinned-banner').style.display = 'none';
        }
    });

    const q = query(mensagensCollRef, orderBy("timestamp", "asc"));
    
    if (state.chatUnsubscribe) state.chatUnsubscribe(); 
    state.chatUnsubscribe = onSnapshot(q, (snapshot) => {
        let h = '';
        snapshot.forEach(docSnap => { 
            const m = docSnap.data(); 
            const d = new Date(m.timestamp); 
            const hora = isNaN(d.getTime()) ? '' : `${d.getHours().toString().padStart(2,'0')}:${d.getMinutes().toString().padStart(2,'0')}`; 
            
            // CORREÇÃO CRÍTICA: Identifica o DT quer pelo username, quer pela tag 'dt'
            const isMe = m.autor === state.myUserName || m.autor === 'dt' || m.remetente === state.myUserName || m.sender === state.myUserId; 
            const nomeStr = isMe ? 'Eu (Diretor de Turma)' : (m.remetente || m.autor || 'Encarregado de Educação');
            
            const pinBtn = `<button class="btn-pin-msg" data-text="${m.texto || m.text}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:0.75rem; margin-left:10px;"><i class="fa-solid fa-thumbtack"></i></button>`;
            
            let anexoHtml = '';
            if (m.anexoBase64 && m.anexoNome) { anexoHtml = `<div style="background:rgba(0,0,0,0.2); padding:8px; border-radius:6px; margin-top:5px; font-size:0.8rem;"><i class="fa-solid fa-file" style="color:var(--primary-green);"></i> <a href="${m.anexoBase64}" download="${m.anexoNome}" style="color:white; text-decoration:none;">${m.anexoNome}</a></div>`; }

            const textoDaMensagem = m.texto || m.text || '';

            if (isMe) { 
                h += `<div class="chat-bubble admin"><strong>${nomeStr}</strong>${pinBtn}<br>${textoDaMensagem}${anexoHtml}<span class="chat-meta">${hora}</span></div>`; 
            } else { 
                // As mensagens do Pai ficam a amarelo para destacar
                h += `<div class="chat-bubble student"><strong style="color:var(--warning-yellow);">${nomeStr}</strong>${pinBtn}<br>${textoDaMensagem}${anexoHtml}<span class="chat-meta">${hora}</span></div>`; 
            }
        });
        
        if (h === '') h = '<div class="empty-state" style="margin-top:20px;"><i class="fa-solid fa-comment-dots empty-state-icon" style="color:var(--warning-yellow);"></i><p class="empty-state-desc">Sê o primeiro a enviar uma mensagem para este canal!</p></div>';
        
        msgCont.innerHTML = h; 
        setTimeout(() => { msgCont.scrollTop = msgCont.scrollHeight; }, 100);
    });
}

window.exportarCSV = function(tableId, filename) {
    const table = document.getElementById(tableId);
    if (!table) return alert("Tabela não encontrada.");
    let csv = [];
    for (let i = 0; i < table.rows.length; i++) {
        let row = [], cols = table.rows[i].querySelectorAll("td, th");
        for (let j = 0; j < cols.length; j++) {
            let data = cols[j].innerText.replace(/(\r\n|\n|\r)/gm, " ").trim();
            data = data.replace(/"/g, '""');
            row.push(`"${data}"`);
        }
        csv.push(row.join(","));
    }
    const csvFile = new Blob(["\uFEFF" + csv.join("\n")], { type: "text/csv;charset=utf-8;" });
    const downloadLink = document.createElement("a"); downloadLink.download = filename; downloadLink.href = window.URL.createObjectURL(csvFile);
    downloadLink.style.display = "none"; document.body.appendChild(downloadLink); downloadLink.click(); document.body.removeChild(downloadLink);
};

// ==========================================
// MOCK: DASHBOARD DA DIREÇÃO (DADOS FICTÍCIOS)
// ==========================================
export async function carregarRadarDirecao() {
    const kpiCont = document.getElementById('dir-kpi-container');
    const alertasCont = document.getElementById('dir-alertas-turmas');

    if(kpiCont) {
        kpiCont.innerHTML = `
            <div class="stat-card" style="border-bottom:3px solid #ff4d4d;"><h2 style="color: #ff4d4d; margin-bottom: 5px;">3</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Turmas</span></div>
            <div class="stat-card" style="border-bottom:3px solid #0099ff;"><h2 style="color: #0099ff; margin-bottom: 5px;">68</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Alunos</span></div>
            <div class="stat-card" style="border-bottom:3px solid var(--danger-red);"><h2 style="color: var(--danger-red); margin-bottom: 5px;">14%</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Faltas (Global)</span></div>
            <div class="stat-card" style="border-bottom:3px solid var(--warning-yellow);"><h2 style="color: var(--warning-yellow); margin-bottom: 5px;">12</h2><span style="font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">PRHFs Ativos</span></div>
        `;
    }

    if(alertasCont) {
        alertasCont.innerHTML = `
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:15px; border-radius:8px; border-left:4px solid var(--danger-red); margin-bottom:10px;">
                <div>
                    <strong style="color:white; font-size:1rem;">Turma 10T</strong>
                    <p style="font-size:0.8rem; color:var(--text-light); margin:5px 0 0 0;">8 alunos em risco por faltas e 5 PRHFs atrasados.</p>
                </div>
                <button class="secondary-btn small-btn" style="border-color:#ff4d4d; color:#ff4d4d;">Ver Raio-X</button>
            </div>
            <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:15px; border-radius:8px; border-left:4px solid var(--warning-yellow); margin-bottom:10px;">
                <div>
                    <strong style="color:white; font-size:1rem;">Turma 11T</strong>
                    <p style="font-size:0.8rem; color:var(--text-light); margin:5px 0 0 0;">2 Ocorrências disciplinares registadas esta semana.</p>
                </div>
                <button class="secondary-btn small-btn" style="border-color:var(--warning-yellow); color:var(--warning-yellow);">Ver Raio-X</button>
            </div>
             <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:15px; border-radius:8px; border-left:4px solid var(--success-green); margin-bottom:10px;">
                <div>
                    <strong style="color:white; font-size:1rem;">Turma 12T</strong>
                    <p style="font-size:0.8rem; color:var(--text-light); margin:5px 0 0 0;">Tudo dentro da normalidade.</p>
                </div>
                <button class="secondary-btn small-btn" style="border-color:var(--success-green); color:var(--success-green);">Ver Raio-X</button>
            </div>
        `;
    }
}
