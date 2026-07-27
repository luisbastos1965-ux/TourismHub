import { db } from "./firebase.js";
import { collection, query, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export async function carregarDashboardAluno(alunoId, turmaId, nomeAluno) {
    document.getElementById('lms-welcome-name').innerText = `Olá, ${nomeAluno.split(' ')[0]}!`;

    // 1. Pesquisar o Próximo Evento da Turma
    try {
        const hoje = new Date().toISOString().split('T')[0];
        const resEvts = await getDocs(query(collection(db, "turmas", turmaId, "eventos")));
        let futuros = [];
        resEvts.forEach(d => {
            const ev = d.data();
            if (ev.data >= hoje && (ev.tipo === 'teste' || ev.tipo === 'avaliacao')) { futuros.push(ev); }
        });
        futuros.sort((a,b) => a.data.localeCompare(b.data));

        const elEvento = document.getElementById('aluno-proximo-evento');
        if(futuros.length > 0) {
            const dp = futuros[0].data.split('-');
            elEvento.innerText = `${dp[2]}/${dp[1]} - ${futuros[0].disciplina || futuros[0].titulo}`;
            elEvento.style.color = "var(--warning-yellow)";
        } else {
            elEvento.innerText = "Sem avaliações";
            elEvento.style.color = "var(--success-green)";
        }
    } catch(e) { console.error("Erro eventos aluno", e); }

    // 2. Pesquisar os PRHFs pendentes deste aluno
    try {
        const resPrhf = await getDocs(query(collection(db, "utilizadores", alunoId, "prhfs")));
        let ativos = 0;
        resPrhf.forEach(d => { if(d.data().status === 'ativa') ativos++; });
        
        const elPrhf = document.getElementById('aluno-prhf-count');
        elPrhf.innerText = `${ativos} Planos`;
        elPrhf.style.color = ativos > 0 ? "var(--danger-red)" : "var(--success-green)";
    } catch(e) { console.error("Erro PRHF aluno", e); }
}
