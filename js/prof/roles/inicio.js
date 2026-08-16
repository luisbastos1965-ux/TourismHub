export async function gerirCliquesInicio(e) {
    try {
        if (e.target.closest('#btn-fab-global')) {
            const fab = document.getElementById('modal-fab-menu');
            if (fab) fab.style.display = 'flex';
            return true;
        }
        return false;
    } catch (error) {
        console.error("Erro no módulo Início:", error);
        return false;
    }
}
