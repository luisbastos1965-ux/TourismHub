// js/prof/roles/coord.js
import { db } from "../../firebase.js";
import { doc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { carregarTarefasProf } from "../ui.js";

export async function validarFCT(alunoId, btnElement) {
    if (!confirm("Tens a certeza que pretendes validar as horas de estágio (FCT) deste aluno? Esta ação confirma o registo perante a secretaria.")) {
        return;
    }
    
    const originalText = btnElement.innerHTML;
    btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btnElement.disabled = true;

    try {
        // Atualiza a base de dados do aluno, trancando as horas
        await updateDoc(doc(db, "utilizadores", alunoId), {
            "fct.validadoDT": true 
        });
        
        btnElement.innerHTML = '<i class="fa-solid fa-check"></i> Validado';
        btnElement.style.backgroundColor = "var(--success-green)";
        btnElement.style.borderColor = "var(--success-green)";
        
        // Atualiza a UI para a barra ficar verde com o check duplo
        setTimeout(() => {
            carregarTarefasProf(); 
        }, 1500);

    } catch (error) {
        console.error("Erro a validar FCT:", error);
        btnElement.innerHTML = "Erro";
        setTimeout(() => {
            btnElement.innerHTML = originalText;
            btnElement.disabled = false;
        }, 2000);
    }
}
