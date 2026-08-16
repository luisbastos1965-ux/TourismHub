import { db } from "./firebase.js";

export async function gerirCliquesInicio(e) {
    if (e.target.closest('#btn-fab-global')) { 
        const fab = document.getElementById('modal-fab-menu');
        if(fab) fab.style.display = 'flex'; 
        return true; 
    }
    return false;
}
