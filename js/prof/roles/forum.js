import { db } from "../../firebase.js";
import { doc, setDoc, getDoc, collection, addDoc, updateDoc, deleteDoc, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state, nomeCurto } from "../store.js";
import { carregarForunsProf, abrirChatForum } from "../ui.js";

export async function gerirCliquesForum(e) {
    
    // 1. SELEÇÃO EM MASSA (CRIAR CHAT)
    if (e.target.closest('#btn-forum-select-all')) {
        e.preventDefault();
        document.querySelectorAll('.forum-aluno-check').forEach(chk => { 
            chk.checked = true; 
            const lbl = chk.closest('label'); 
            if (lbl) { lbl.style.background = 'rgba(0, 204, 136, 0.15)'; lbl.style.borderColor = 'var(--primary-green)'; }
        });
        return true;
    }

    if (e.target.closest('#btn-forum-deselect-all')) {
        e.preventDefault();
        document.querySelectorAll('.forum-aluno-check').forEach(chk => { 
            chk.checked = false; 
            const lbl = chk.closest('label'); 
            if (lbl) { lbl.style.background = 'rgba(0,0,0,0.2)'; lbl.style.borderColor = '#333'; }
        });
        return true;
    }

    // 2. SELEÇÃO EM MASSA (EDITAR CHAT)
    if (e.target.closest('#btn-edit-forum-select-all')) {
        e.preventDefault();
        document.querySelectorAll('.edit-forum-aluno-check').forEach(chk => { 
            chk.checked = true; 
            const lbl = chk.closest('label'); 
            if (lbl) { lbl.style.background = 'rgba(0, 204, 136, 0.15)'; lbl.style.borderColor = 'var(--primary-green)'; }
        });
        return true;
    }

    if (e.target.closest('#btn-edit-forum-deselect-all')) {
        e.preventDefault();
        document.querySelectorAll('.edit-forum-aluno-check').forEach(chk => { 
            chk.checked = false; 
            const lbl = chk.closest('label'); 
            if (lbl) { lbl.style.background = 'rgba(0,0,0,0.2)'; lbl.style.borderColor = '#333'; }
        });
        return true;
    }

    // 3. ABRIR MODAL EDIÇÃO
    if (e.target.closest('.btn-edit-chat')) { 
        e.stopPropagation(); 
        const btn = e.target.closest('.btn-edit-chat'); 
        const cId = btn.getAttribute('data-id'); 
        const t = btn.getAttribute('data-turma'); 
        
        document.getElementById('edit-forum-id').value = cId; 
        document.getElementById('edit-forum-turma').value = t; 
        
        const mCont = document.getElementById('lista-alunos-edit-forum'); 
        mCont.innerHTML = '<p class="text-muted center" style="font-size:0.8rem; grid-column: span 2;"><i class="fa-solid fa-spinner fa-spin"></i> A carregar...</p>'; 
        document.getElementById('modal-editar-forum').style.display = 'flex'; 
        
        const chatSnap = await getDoc(doc(db, "turmas", t, "foruns", cId)); 
        if(chatSnap.exists()) { 
            document.getElementById('input-nome-edit-forum').value = chatSnap.data().nome; 
            const membrosAtuais = chatSnap.data().membros || []; 
            const cS = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno"))); 
            
            let arr = []; 
            cS.forEach(d => arr.push({id: d.id, ...d.data()}));
            arr.sort((a,b) => a.nome.localeCompare(b.nome)); 
            
            let cH = ''; 
            arr.forEach(d => { 
                const isChecked = membrosAtuais.includes(d.id) ? 'checked' : ''; 
                const bg = isChecked ? 'rgba(0, 204, 136, 0.15)' : 'rgba(0,0,0,0.2)';
                const border = isChecked ? 'var(--primary-green)' : '#333';
                
                cH += `
                <label class="forum-member-card" style="display:flex; justify-content:center; align-items:center; background:${bg}; border:1px solid ${border}; padding:10px; border-radius:8px; cursor:pointer; transition:all 0.2s; text-align:center; height: 100%;">
                    <span style="color:white; font-size:0.95rem; font-weight:500;">${nomeCurto(d.nome)}</span>
                    <input type="checkbox" class="edit-forum-aluno-check" value="${d.id}" ${isChecked} style="display:none;">
                </label>`; 
            }); 
            mCont.innerHTML = cH === '' ? '<p class="text-muted center" style="font-size:0.8rem; grid-column: span 2;">Turma vazia.</p>' : cH; 
        } 
        return true; 
    }

    // 4. MENSAGENS FIXADAS E ANEXOS
    if (e.target.closest('#btn-prof-remove-attachment')) {
        state.chatAttachmentBase64 = null;
        state.chatAttachmentName = null;
        document.getElementById('prof-forum-file-input').value = '';
        document.getElementById('prof-forum-attachment-preview').style.display = 'none';
        return true;
    }

    if (e.target.closest('.btn-pin-msg')) {
        const btn = e.target.closest('.btn-pin-msg');
        const textToPin = btn.getAttribute('data-text');
        if(!state.activeChatTurma || !state.activeChatDisc) return true;
        await updateDoc(doc(db, "turmas", state.activeChatTurma, "foruns", state.activeChatDisc), { pinnedMessage: textToPin });
        return true;
    }

    if (e.target.closest('#btn-unpin-msg')) {
        if(!state.activeChatTurma || !state.activeChatDisc) return true;
        await updateDoc(doc(db, "turmas", state.activeChatTurma, "foruns", state.activeChatDisc), { pinnedMessage: null });
        return true;
    }

    // 5. GRAVAR / APAGAR CHAT
    if (e.target.closest('#btn-guardar-edit-forum')) { 
        const cId = document.getElementById('edit-forum-id').value; 
        const t = document.getElementById('edit-forum-turma').value; 
        const novoNome = document.getElementById('input-nome-edit-forum').value.trim(); 
        let mbr = [state.myUserId]; 
        document.querySelectorAll('.edit-forum-aluno-check:checked').forEach(c => mbr.push(c.value)); 
        
        if(!novoNome) return alert("O nome não pode estar vazio."); 
        const btn = e.target.closest('#btn-guardar-edit-forum'); 
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
        btn.disabled = true; 
        
        await updateDoc(doc(db, "turmas", t, "foruns", cId), { nome: novoNome, membros: mbr }); 
        document.getElementById('modal-editar-forum').style.display = 'none'; 
        btn.innerHTML = 'Guardar Alterações'; btn.disabled = false; 
        carregarForunsProf(); 
        return true; 
    }

    if (e.target.closest('#btn-apagar-forum')) { 
        if(confirm("Apagar definitivamente este grupo de chat?")) { 
            const cId = document.getElementById('edit-forum-id').value; 
            const t = document.getElementById('edit-forum-turma').value; 
            const btn = e.target.closest('#btn-apagar-forum'); 
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; 
            
            await deleteDoc(doc(db, "turmas", t, "foruns", cId)); 
            document.getElementById('modal-editar-forum').style.display = 'none'; 
            btn.innerHTML = '<i class="fa-solid fa-trash"></i> Apagar Chat Definitivamente'; btn.disabled = false; 
            carregarForunsProf(); 
        } 
        return true; 
    }

    // 6. ENTRAR NO CHAT
    if (e.target.closest('.canal-card')) { 
        const card = e.target.closest('.canal-card'); 
        const t = card.getAttribute('data-turma');
        const d = card.getAttribute('data-disc');
        
        setDoc(doc(db, "turmas", t, "foruns", d), { [`lastRead_${state.myUserId}`]: Date.now() }, { merge: true });
        abrirChatForum(t, d, card.getAttribute('data-nome')); 
        return true; 
    }

    // 7. SAIR DO CHAT
    if (e.target.closest('#btn-prof-voltar-canais')) { 
        if(state.activeChatTurma && state.activeChatDisc) {
            setDoc(doc(db, "turmas", state.activeChatTurma, "foruns", state.activeChatDisc), { [`lastRead_${state.myUserId}`]: Date.now() }, { merge: true });
        }
        if (state.chatUnsubscribe) { state.chatUnsubscribe(); state.chatUnsubscribe = null; } 
        if (state.chatMetaUnsubscribe) { state.chatMetaUnsubscribe(); state.chatMetaUnsubscribe = null; } 
        document.getElementById('prof-forum-chat-view').style.display = 'none'; 
        document.getElementById('btn-create-chat-prof').style.display = 'block'; 
        document.getElementById('prof-forum-channel-list').style.display = 'block'; 
        carregarForunsProf(); 
        return true; 
    }

    // 8. ENVIAR MENSAGEM
    if (e.target.closest('#btn-prof-send-msg')) { 
        const msgInput = document.getElementById('prof-input-forum-msg'); 
        const msg = msgInput.value.trim(); 
        if ((!msg && !state.chatAttachmentBase64) || !state.activeChatTurma || !state.activeChatDisc) return true; 
        
        await addDoc(collection(db, "turmas", state.activeChatTurma, "foruns", state.activeChatDisc, "mensagens"), { 
            texto: msg || "", 
            anexoBase64: state.chatAttachmentBase64 || null,
            anexoNome: state.chatAttachmentName || null,
            autor: state.myUserName, 
            papel: "professor", 
            timestamp: Date.now() 
        }); 
        
        msgInput.value = ''; 
        state.chatAttachmentBase64 = null;
        state.chatAttachmentName = null;
        document.getElementById('prof-forum-file-input').value = '';
        document.getElementById('prof-forum-attachment-preview').style.display = 'none';
        
        await updateDoc(doc(db, "turmas", state.activeChatTurma, "foruns", state.activeChatDisc), { lastMessageTimestamp: Date.now() });
        return true; 
    }

    // 9. CRIAR CHAT NOVO
    if (e.target.closest('#btn-create-chat-prof')) { 
        const selTurmas = document.getElementById('forum-turma-select');
        if (selTurmas && state.turmasProfessor) {
            selTurmas.innerHTML = '<option value="">Selecionar Turma...</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join('');
        }
        document.getElementById('input-nome-novo-forum').value = ''; 
        document.getElementById('lista-alunos-forum').innerHTML = '<p class="text-muted center" style="font-size:0.8rem; grid-column: span 2;">Seleciona turma primeiro.</p>'; 
        document.getElementById('forum-bulk-actions').style.display = 'none'; 
        document.getElementById('modal-criar-forum').style.display = 'flex'; 
        return true; 
    }

    if (e.target.closest('#btn-confirm-novo-forum')) { 
        const nome = document.getElementById('input-nome-novo-forum').value.trim(); 
        const turma = document.getElementById('forum-turma-select').value; 
        if(!nome || !turma) return alert("Preenche o nome do chat e a turma."); 
        
        let mbr = [state.myUserId]; 
        document.querySelectorAll('.forum-aluno-check:checked').forEach(c => mbr.push(c.value)); 
        
        const btnConf = e.target.closest('#btn-confirm-novo-forum'); 
        btnConf.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btnConf.disabled = true; 
        
        await addDoc(collection(db, "turmas", turma, "foruns"), { 
            nome: nome, tipo: 'permanente', isDefault: false, membros: mbr, 
            criadoPor: state.myUserName, lastMessageTimestamp: Date.now() 
        }); 
        
        document.getElementById('modal-criar-forum').style.display = 'none'; 
        btnConf.innerHTML = 'Criar Chat'; btnConf.disabled = false; 
        carregarForunsProf(); 
        return true; 
    }

    return false;
}
