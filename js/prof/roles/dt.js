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

    let totalModulosAtraso = 0;
    let totalPlanosAtivos = 0;
    let alertasFaltasHTML = '';
    let dadosParaAta = []; // Cofre invisível para alimentar o botão do resumo!

    try {
        // 2. Procurar todos os alunos desta turma
        const alunosSnap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno")));
        
        for (const docAl of alunosSnap.docs) {
            const alunoId = docAl.id;
            const alunoNome = nomeCurto(docAl.data().nome);
            let alunoTemAtrasos = 0;
            let alunoTemPlanos = 0;

            // -- A. Contar Planos (PRHFs) Ativos --
            const prhfsSnap = await getDocs(collection(db, "utilizadores", alunoId, "prhfs"));
            prhfsSnap.forEach(p => {
                if (p.data().status !== 'concluida') {
                    totalPlanosAtivos++;
                    alunoTemPlanos++;
                }
            });

            // -- B. Contar Módulos em Atraso (Classificações REP - À prova de Excel) --
            const avalSnap = await getDocs(collection(db, "utilizadores", alunoId, "avaliacoes"));
            avalSnap.forEach(a => {
                const dadosAval = a.data();
                // Apanha o campo 'nota', 'Nota' ou 'NOTA' e converte tudo para texto limpo e maiúsculo
                const valorNota = String(dadosAval.nota || dadosAval.Nota || "").trim().toUpperCase();
                
                if (valorNota === 'REP') {
                    totalModulosAtraso++;
                    alunoTemAtrasos++;
                }
            });

            // -- C. O CÁLCULO DOS 10% DE FALTAS --
            const faltasSnap = await getDocs(collection(db, "utilizadores", alunoId, "faltas"));
            let faltasPorDisc = {};
            faltasSnap.forEach(f => {
                const d = f.data();
                const disc = d.disciplina;
                // Previne erros definindo 50 como horas fallback se não existirem
                if (!faltasPorDisc[disc]) faltasPorDisc[disc] = { horasTotais: parseInt(d.horasTotaisDisciplina || 50), horasFaltadas: 0 };
                faltasPorDisc[disc].horasFaltadas += parseInt(d.duracao || 0);
            });

            let alertasDesteAluno = [];
            for (const [disc, dados] of Object.entries(faltasPorDisc)) {
                // A Tua Regra: 10% com arredondamento ao inteiro mais próximo
                const limite = Math.round(dados.horasTotais * 0.10);
                
                if (dados.horasFaltadas > limite) {
                    alertasDesteAluno.push(`<strong>${disc}</strong>: <span style="color:var(--danger-red);">${dados.horasFaltadas}h</span> (Ultrapassou limite de ${limite}h)`);
                } else if (dados.horasFaltadas === limite) {
                    alertasDesteAluno.push(`<strong>${disc}</strong>: <span style="color:var(--warning-yellow);">${dados.horasFaltadas}h</span> (Bateu no teto de ${limite}h)`);
                } else if (dados.horasFaltadas >= limite - 2) {
                    alertasDesteAluno.push(`<strong>${disc}</strong>: ${dados.horasFaltadas}h (Em risco. Limite: ${limite}h)`);
                }
            }

            if (alertasDesteAluno.length > 0) {
                alertasFaltasHTML += `
                <div style="background:rgba(239, 68, 68, 0.1); border: 1px solid var(--danger-red); padding: 10px; border-radius: 6px; margin-bottom: 8px;">
                    <strong style="color: white; font-size: 0.9rem;">${alunoNome}</strong>
                    <div style="font-size: 0.8rem; color: var(--text-light); margin-top: 4px; line-height: 1.5;">
                        ${alertasDesteAluno.join('<br>')}
                    </div>
                </div>`;
            }

            // 3. Guardar memória para o modal de resumo
            dadosParaAta.push({ nome: docAl.data().nome, atrasos: alunoTemAtrasos, planos: alunoTemPlanos });
        }

        // 4. Imprimir resultados finais no ecrã
        document.getElementById('dt-modulos-atraso').innerText = totalModulosAtraso;
        document.getElementById('dt-planos-ativos').innerText = totalPlanosAtivos;
        
        faltasContainer.innerHTML = alertasFaltasHTML === '' 
            ? '<p class="text-success center" style="margin:0;"><i class="fa-solid fa-shield-halved"></i> Assiduidade da turma estável e dentro dos limites.</p>' 
            : alertasFaltasHTML;

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