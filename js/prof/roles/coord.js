import { db } from "../../firebase.js";
import { collection, getDocs, doc, updateDoc, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { carregarEcraProjetosCoord } from "./coord-dashboard.js";

// Utilitário de Alertas
function mostrarAlerta(msg, erro = true) {
    const cor = erro ? 'var(--danger-red)' : 'var(--success-green)';
    const div = document.createElement('div');
    div.style.cssText = `position:fixed; top:20px; left:50%; transform:translateX(-50%); background:${cor}; color:white; padding:12px 24px; border-radius:30px; font-size:0.9rem; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:10000; display:flex; align-items:center; gap:10px; opacity:0; transition: opacity 0.3s ease;`;
    div.innerHTML = `<i class="fa-solid ${erro ? 'fa-triangle-exclamation' : 'fa-check'}"></i> ${msg}`;
    document.body.appendChild(div);
    requestAnimationFrame(() => div.style.opacity = '1');
    setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 3000);
}

// 1. Validar as Horas Finais de FCT
export async function validarFCT(alunoId, btnElement) {
    if (!confirm("Tens a certeza que pretendes validar e fechar as horas de estágio (FCT) deste aluno? Esta ação é definitiva.")) return;
    const originalText = btnElement.innerHTML; btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btnElement.disabled = true;
    try {
        await updateDoc(doc(db, "utilizadores", alunoId), { "fct.validadoDT": true });
        mostrarAlerta("Horas do Estágio fechadas com sucesso!", false);
        btnElement.innerHTML = '<i class="fa-solid fa-check-double"></i> Fechado'; 
        btnElement.style.color = "var(--success-green)"; btnElement.style.borderColor = "transparent"; btnElement.style.background = "transparent";
        setTimeout(() => { carregarEcraProjetosCoord(); }, 1500);
    } catch (error) {
        mostrarAlerta("Erro ao validar horas.");
        btnElement.innerHTML = "Erro"; setTimeout(() => { btnElement.innerHTML = originalText; btnElement.disabled = false; }, 2000);
    }
}
window.validarFCTHoras = validarFCT; // Exporta para uso inline

// 2. Desbloquear a FCT para uma Turma Inteira (11º Ano)
window.desbloquearFCTTurma = async function(turmaId, btnElement) {
    if(!confirm(`Isto vai desbloquear o menu de FCT para TODOS os alunos da Turma ${turmaId}. Queres avançar?`)) return;
    
    const orig = btnElement.innerHTML; btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btnElement.disabled = true;
    try {
        const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turmaId), where("papel", "==", "aluno")));
        for(const d of snap.docs) {
            // Define o fctBloqueada para false no perfil do aluno
            await updateDoc(doc(db, "utilizadores", d.id), { fctBloqueada: false });
        }
        mostrarAlerta(`Acesso à FCT libertado para a Turma ${turmaId}!`, false);
        btnElement.innerHTML = '<i class="fa-solid fa-lock-open"></i> Acesso Livre';
        btnElement.style.backgroundColor = 'var(--success-green)';
    } catch(e) { 
        mostrarAlerta("Erro ao desbloquear o acesso."); 
        btnElement.innerHTML = orig; btnElement.disabled = false; 
    }
};

// 3. Validar Documento da Burocracia Individualmente
window.validarDocFCT = async function(alunoId, docId, btnElement) {
    const orig = btnElement.innerHTML; btnElement.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btnElement.disabled = true;
    try {
        // Altera o estado do documento para 2 (Validado)
        await updateDoc(doc(db, "utilizadores", alunoId), { [`fct.burocracia.${docId}`]: 2 });
        mostrarAlerta("Documento validado!", false);
        carregarEcraProjetosCoord();
    } catch(e) { 
        mostrarAlerta("Erro ao validar documento."); 
        btnElement.innerHTML = orig; btnElement.disabled = false; 
    }
};
