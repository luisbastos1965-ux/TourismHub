import { db } from "../../firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state, nomeCurto } from "../store.js";

export async function gerarRadarConflitos() {
    const isDT = (state.myRoles.includes('diretor_turma') && state.selectedTurma === state.minhaTurmaDT);
    if(!isDT) return;
    document.getElementById('modal-radar-conflitos').style.display = 'flex';
    const c = document.getElementById('radar-conflitos-lista'); c.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A ler horários...</p>';
    try {
        let eventosConflito = [];
        const snapAl = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", state.selectedTurma), where("papel", "==", "aluno")));
        for(const docAl of snapAl.docs) {
            const pSnap = await getDocs(collection(db, "utilizadores", docAl.id, "prhfs"));
            pSnap.forEach(p => {
                if (p.data().propostaLidaDT === true) {
                    const dataMarcada = p.data().propostaProfessor || p.data().propostaAluno || "Sem data";
                    eventosConflito.push({ aluno: docAl.data().nome, disciplina: p.data().disciplina, dataDesc: dataMarcada });
                }
            });
        }
        let html = '';
        if(eventosConflito.length === 0) { html = '<p class="text-success center"><i class="fa-solid fa-circle-check"></i> Nenhum PRHF agendado atualmente.</p>'; }
        else { eventosConflito.forEach(e => { html += `<div style="background:rgba(0,0,0,0.2); border-left:3px solid var(--danger-red); padding:10px; margin-bottom:8px; border-radius:6px;"><strong>${nomeCurto(e.aluno)}</strong> - ${e.disciplina}<br><span style="font-size:0.8rem; color:var(--text-muted);">${e.dataDesc}</span></div>`; }); }
        c.innerHTML = html;
    } catch(e) { c.innerHTML = '<p class="text-danger center">Erro ao carregar radar.</p>'; }
}

// ==========================================
// PAINEL PRINCIPAL DO DIRETOR DE TURMA
// ==========================================
export async function carregarPainelDT() {
    const turma = state.minhaTurmaDT || state.selectedTurma;
    if (!turma) return;

    // 1. Reset da Interface
    document.getElementById('dt-modulos-atraso').innerText = '-';
    document.getElementById('dt-planos-ativos').innerText = '-';
    const faltasContainer = document.getElementById('dt-alertas-faltas-container');
    faltasContainer.innerHTML = '<p class="text-muted center" style="margin:0;"><i class="fa-solid fa-spinner fa-spin"></i> A cruzar dados da turma...</p>';

    try {
        // Precisamos da função da Matriz para saber o teto de faltas real
        let matrizDeHoras = {};
        try {
            // Caminho corrigido para ler do directório principal js/
            const { getMatriz } = await import("../aluno-caderneta.js");
            matrizDeHoras = getMatriz();
        } catch(e) {}

        // 2. Procurar todos os alunos desta turma
        const alunosSnap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno")));
        
        // 3. A ACELERAÇÃO: Criar uma "Promessa" para cada aluno correr em simultâneo
        const promessasAlunos = alunosSnap.docs.map(async (docAl) => {
            const alunoId = docAl.id;
            const alunoNome = nomeCurto(docAl.data().nome);
            
            let alunoTemAtrasos = 0;
            let alunoTemPlanos = 0;
            let faltasPorDisc = {};

            // Executar consultas de PRHFs, Notas e Faltas em paralelo para ESTE aluno
            const [prhfsSnap, avalSnap, faltasSnap] = await Promise.all([
                getDocs(collection(db, "utilizadores", alunoId, "prhfs")),
                getDocs(collection(db, "utilizadores", alunoId, "avaliacoes")),
                getDocs(collection(db, "utilizadores", alunoId, "faltas"))
            ]);

            // -- A. Contar Planos (PRHFs) Ativos --
            prhfsSnap.forEach(p => {
                if (p.data().status !== 'concluida') {
                    alunoTemPlanos++;
                }
            });

            // -- B. Contar Módulos em Atraso --
            avalSnap.forEach(a => {
                const valorNota = String(a.data().nota || a.data().Nota || "").trim().toUpperCase();
                if (valorNota === 'REP') {
                    alunoTemAtrasos++;
                }
            });

            // -- C. Tratar Faltas (Novo Formato) --
            faltasSnap.forEach(f => {
                const d = f.data();
                const disc = d.disciplina;
                const mod = d.modulo || '?';
                const duracaoDaFalta = parseInt(d.duracaoBlocos) || parseInt(d.horas) || 0;
                
                // Se a falta NÃO estiver justificada
                if (d.justificada === false || !d.hasOwnProperty('justificada')) {
                    if (!faltasPorDisc[disc]) faltasPorDisc[disc] = { horasFaltadas: 0, modulos: {} };
                    if (!faltasPorDisc[disc].modulos[mod]) faltasPorDisc[disc].modulos[mod] = 0;
                    
                    faltasPorDisc[disc].horasFaltadas += duracaoDaFalta;
                    faltasPorDisc[disc].modulos[mod] += duracaoDaFalta;
                }
            });

            // Retorna um "Pacote" consolidado deste aluno
            return {
                id: alunoId,
                nome: alunoNome,
                atrasos: alunoTemAtrasos,
                planos: alunoTemPlanos,
                faltas: faltasPorDisc
            };
        });

        // Espera que TODOS os alunos acabem os seus cálculos ao mesmo tempo
        const alunosProcessados = await Promise.all(promessasAlunos);

        // 4. Processar resultados para o ecrã
        let totalModulosAtraso = 0;
        let totalPlanosAtivos = 0;
        let alertasFaltasHTML = '';
        let dadosParaAta = [];

        alunosProcessados.forEach(aluno => {
            totalModulosAtraso += aluno.atrasos;
            totalPlanosAtivos += aluno.planos;
            dadosParaAta.push({ nome: aluno.nome, atrasos: aluno.atrasos, planos: aluno.planos });

            let alertasDesteAluno = [];
            let gravidadeMaximaAluno = 0;

            for (const [disc, dados] of Object.entries(aluno.faltas)) {
                for (const [mod, horasFaltadas] of Object.entries(dados.modulos)) {
                    let cargaHorariaDoModulo = 0;
                    
                    for (const comp in matrizDeHoras) {
                        if (matrizDeHoras[comp][disc] && matrizDeHoras[comp][disc][mod]) {
                            cargaHorariaDoModulo = Number(matrizDeHoras[comp][disc][mod]);
                            break;
                        }
                    }

                    const limite = cargaHorariaDoModulo > 0 ? Math.round(cargaHorariaDoModulo * 0.10) : 3;
                    const modLabel = mod.toString().startsWith('UC') ? mod : `M${mod}`;

                    if (horasFaltadas > limite) {
                        alertasDesteAluno.push({ disc: disc, mod: modLabel, hFalta: horasFaltadas, limite: limite, cor: 'var(--danger-red)', bg: 'rgba(239, 68, 68, 0.1)', icon: 'fa-xmark' });
                        gravidadeMaximaAluno = Math.max(gravidadeMaximaAluno, 2);
                    } else if (horasFaltadas === limite) {
                        alertasDesteAluno.push({ disc: disc, mod: modLabel, hFalta: horasFaltadas, limite: limite, cor: 'var(--warning-yellow)', bg: 'rgba(245, 158, 11, 0.1)', icon: 'fa-exclamation' });
                        gravidadeMaximaAluno = Math.max(gravidadeMaximaAluno, 1);
                    }
                }
            }

            if (alertasDesteAluno.length > 0) {
                alertasDesteAluno.sort((a, b) => {
                    if (a.cor === 'var(--danger-red)' && b.cor !== 'var(--danger-red)') return -1;
                    if (a.cor !== 'var(--danger-red)' && b.cor === 'var(--danger-red)') return 1;
                    return 0;
                });

                let tagsDisciplinas = '';
                alertasDesteAluno.forEach(a => {
                    tagsDisciplinas += `
                    <div style="background: ${a.bg}; border: 1px solid ${a.cor}; padding: 4px 8px; border-radius: 4px; font-size: 0.75rem; color: ${a.cor}; display: flex; justify-content: space-between; align-items: center; gap: 8px;">
                        <span><i class="fa-solid ${a.icon}" style="margin-right: 4px;"></i> <strong>${a.disc}</strong> (${a.mod})</span>
                        <span style="font-weight: bold; background: rgba(0,0,0,0.3); padding: 2px 6px; border-radius: 10px;">${a.hFalta}/${a.limite}h</span>
                    </div>`;
                });

                const corBordaCard = gravidadeMaximaAluno === 2 ? 'var(--danger-red)' : 'var(--warning-yellow)';
                
                alertasFaltasHTML += `
                <div style="background: rgba(0,0,0,0.2); border: 1px solid #333; border-left: 4px solid ${corBordaCard}; padding: 15px; border-radius: 8px; margin-bottom: 10px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 8px; margin-bottom: 10px;">
                        <strong style="color: white; font-size: 1rem;"><i class="fa-solid fa-user" style="color: var(--text-muted); margin-right: 5px;"></i> ${aluno.nome}</strong>
                        <span style="font-size: 0.75rem; color: ${corBordaCard}; font-weight: bold; background: rgba(255,255,255,0.05); padding: 4px 8px; border-radius: 12px;">${alertasDesteAluno.length} Alerta(s)</span>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(180px, 1fr)); gap: 8px;">
                        ${tagsDisciplinas}
                    </div>
                </div>`;
            }
        });

        // 5. Imprimir resultados finais no ecrã
        document.getElementById('dt-modulos-atraso').innerText = totalModulosAtraso;
        document.getElementById('dt-planos-ativos').innerText = totalPlanosAtivos;
        
        faltasContainer.innerHTML = alertasFaltasHTML === '' 
            ? '<p class="text-success center" style="margin:0;"><i class="fa-solid fa-shield-halved"></i> Assiduidade da turma estável e dentro dos limites.</p>' 
            : `<div style="display: flex; flex-direction: column; gap: 10px; max-height: 400px; overflow-y: auto; padding-right: 5px;">${alertasFaltasHTML}</div>`;

        window.memoriaAtaDT = dadosParaAta;

    } catch(err) {
        console.error("Erro a gerar dados do DT:", err);
        faltasContainer.innerHTML = '<p class="text-danger center">Erro a calcular assiduidade.</p>';
    }
}

// ==========================================
// GERADOR DO RESUMO PORMENORIZADO PARA ATAS
// ==========================================
export function abrirModalResumoAta() {
    if (!window.memoriaAtaDT) return;

    let textoPlanos = "";
    let textoAtrasos = "";

    window.memoriaAtaDT.forEach(aluno => {
        if (aluno.atrasos > 0) textoAtrasos += `• ${aluno.nome}: ${aluno.atrasos} módulo(s) em atraso.\n`;
        if (aluno.planos > 0) textoPlanos += `• ${aluno.nome}: ${aluno.planos} PRHF(s) em curso.\n`;
    });

    if (textoAtrasos === "") textoAtrasos = "A turma não apresenta alunos com classificações pendentes ou módulos em atraso (REP) reportados.\n";
    if (textoPlanos === "") textoPlanos = "Não se encontram ativos Planos de Recuperação (PRHF) na turma.\n";

    const textoFinal = `PONTO DE SITUAÇÃO DA TURMA (${state.minhaTurmaDT || state.selectedTurma})\n\n[MÓDULOS EM ATRASO]\n${textoAtrasos}\n[PLANOS DE RECUPERAÇÃO ATIVOS]\n${textoPlanos}`;

    const bg = document.createElement('div');
    bg.className = 'modal-overlay'; bg.style.display = 'flex'; bg.style.zIndex = '10000';
    bg.innerHTML = `
        <div class="action-sheet" style="max-width:500px; padding:20px; animation: fadeSlide 0.3s ease;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="color:var(--warning-yellow); margin:0;"><i class="fa-solid fa-file-signature"></i> Resumo para Ata</h3>
                <button class="close-dyn-modal" style="background:none; border:none; color:white; font-size:1.3rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:10px;">Copia o texto gerado abaixo e cola no teu documento oficial.</p>
            <textarea id="txt-copiar-ata" class="input-padrao" style="width:100%; min-height:200px; font-size:0.85rem; font-family:monospace; line-height:1.5;" readonly>${textoFinal}</textarea>
            <button class="primary-btn" style="width:100%; margin-top:15px; background:var(--warning-yellow); color:black;" onclick="navigator.clipboard.writeText(document.getElementById('txt-copiar-ata').value); this.innerHTML='<i class=\\'fa-solid fa-check\\'></i> Copiado!'; setTimeout(() => this.innerHTML='Copiar Texto', 2000);">Copiar Texto</button>
        </div>`;
    document.body.appendChild(bg);
    bg.querySelector('.close-dyn-modal').onclick = () => bg.remove();
}