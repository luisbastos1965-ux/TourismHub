import { db } from "../../firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { carregarTarefasProf } from "../ui.js";

export async function aprovarTemaPAP(alunoId, btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;
    try {
        await updateDoc(doc(db, "utilizadores", alunoId), { "pap.temaAprovado": true });
        carregarTarefasProf();
    } catch(e) {
        alert("Erro ao aprovar tema.");
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Aceitar';
        btn.disabled = false;
    }
}

export async function rejeitarTemaPAPExecutar(alunoId, motivo, btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;
    try {
        await updateDoc(doc(db, "utilizadores", alunoId), { 
            "pap.temaAprovado": false,
            "pap.tema": null,
            "pap.motivoRejeicao": motivo 
        });
        const modal = document.getElementById('modal-rejeitar-tema-pap');
        if (modal) modal.style.display = 'none';
        carregarTarefasProf();
    } catch(e) {
        alert("Erro ao rejeitar tema.");
        btn.innerHTML = 'Rejeitar Tema';
        btn.disabled = false;
    }
}

export async function aprovarRelatorioPAP(alunoId, btn) {
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;
    try {
        await updateDoc(doc(db, "utilizadores", alunoId), { "pap.relatorioAprovado": true });
        carregarTarefasProf();
    } catch(e) {
        alert("Erro ao aprovar relatório.");
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Aprovar Relatório';
        btn.disabled = false;
    }
}
