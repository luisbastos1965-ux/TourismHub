import { db } from "../../firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { carregarTarefasProf } from "../ui.js";

export async function aprovarTemaPAP(alunoId, btnElement) {
    const originalText = btnElement.innerHTML; btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btnElement.disabled = true;
    try {
        await updateDoc(doc(db, "utilizadores", alunoId), { "pap.temaAprovado": true, "pap.feedbackOrientador": "Tema Aprovado! Podes avançar para o desenvolvimento." });
        btnElement.innerHTML = '<i class="fa-solid fa-check"></i>'; setTimeout(() => carregarTarefasProf(), 1000);
    } catch (e) { btnElement.innerHTML = 'Erro'; setTimeout(() => { btnElement.innerHTML = originalText; btnElement.disabled = false; }, 1500); }
}

export async function rejeitarTemaPAPExecutar(alunoId, motivo, btnElement) {
    const originalText = btnElement.innerHTML; btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btnElement.disabled = true;
    try {
        await updateDoc(doc(db, "utilizadores", alunoId), { "pap.tema": null, "pap.feedbackOrientador": "Tema Rejeitado: " + motivo });
        btnElement.innerHTML = '<i class="fa-solid fa-check"></i>';
        setTimeout(() => { document.getElementById('modal-rejeitar-tema-pap').style.display = 'none'; carregarTarefasProf(); btnElement.innerHTML = originalText; btnElement.disabled = false; }, 1000);
    } catch (e) { btnElement.innerHTML = 'Erro'; setTimeout(() => { btnElement.innerHTML = originalText; btnElement.disabled = false; }, 1500); }
}

export async function aprovarRelatorioPAP(alunoId, btnElement) {
    if (!confirm("Confirmas que o relatório final cumpre todos os requisitos e o aluno está apto para apresentação a júri?")) return;
    const originalText = btnElement.innerHTML; btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btnElement.disabled = true;
    try {
        await updateDoc(doc(db, "utilizadores", alunoId), { "pap.relatorioAprovado": true, "pap.feedbackOrientador": "Relatório Final Aprovado! Estás apto para a defesa da PAP." });
        btnElement.innerHTML = '<i class="fa-solid fa-check"></i> Aprovado'; btnElement.style.backgroundColor = "var(--success-green)"; setTimeout(() => carregarTarefasProf(), 1000);
    } catch (e) { btnElement.innerHTML = 'Erro'; setTimeout(() => { btnElement.innerHTML = originalText; btnElement.disabled = false; }, 1500); }
}
