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
