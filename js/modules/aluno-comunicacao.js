import { collection, getDocs, getDoc, doc, query, addDoc, updateDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let alunoForumAtivoId = null;
let chatUnsubscribeAluno = null;

function getEmptyState(mensagem, icone = "fa-folder-open") {
    return `<div style="text-align:center; padding: 40px 20px; opacity: 0.5;">
                <i class="fa-solid ${icone}" style="font-size: 3.5rem; margin-bottom: 15px; color: var(--text-muted);"></i>
                <p style="font-size: 0.95rem; color: var(--text-muted);">${mensagem}</p>
            </div>`;
}

export function setupComunicacao() {
    window.carregarCanaisForumAluno = carregarCanaisForumAluno;

    // Fórum - Voltar à lista
    document.getElementById('btn-aluno-voltar-canais')?.addEventListener('click', () => {
        alunoForumAtivoId = null; if(chatUnsubscribeAluno) chatUnsubscribeAluno();
        document.getElementById('aluno-forum-chat-view').style.display = 'none';
        document.getElementById('btn-create-chat-aluno').style.display = 'block'; 
        document.getElementById('aluno-forum-channel-list').style.display = 'block';
    });

    // Fórum - Enviar Mensagem
    document.getElementById('btn-aluno-send-msg')?.addEventListener('click', async () => {
        if(!alunoForumAtivoId) return; 
        const inp = document.getElementById('aluno-input-forum-msg'); const t = inp.value.trim(); if(!t) return;
        inp.value = '';
        try {
            await addDoc(collection(window.db, "forums", alunoForumAtivoId, "mensagens"), { sender: window.myUserId, senderName: window.myUserName, text: t, timestamp: Date.now() });
            const chSnap = await getDoc(doc(window.db, "forums", alunoForumAtivoId));
            if(chSnap.exists()) {
                let u = chSnap.data().unread || {};
                const part = chSnap.data().participantes || [];
                part.forEach(p => { if(p !== window.myUserId) u[p] = true; });
                await updateDoc(doc(window.db, "forums", alunoForumAtivoId), { lastMessage: { sender: window.myUserId, text: t, timestamp: Date.now() }, unread: u });
            }
        } catch(e) {}
    });

    // Notificações - Filtros
    document.querySelectorAll('#notificacoes-filtros .filter-chip').forEach(chip => {
        chip.addEventListener('click', (e) => { 
            document.querySelectorAll('#notificacoes-filtros .filter-chip').forEach(c => c.classList.remove('active')); 
            e.target.classList.add('active'); 
            window.notifFilterCat = e.target.getAttribute('data-cat'); 
            carregarNotificacoesAluno(); 
        });
    });

    // Notificações - Abrir e Fechar (Resolução do Botão Voltar Preso!)
    document.getElementById('btn-open-notificacoes')?.addEventListener('click', () => {
        document.querySelectorAll('.app-content > div:not(.modal-overlay)').forEach(d => d.style.display = 'none');
        document.getElementById('view-aluno-notificacoes').style.display = 'block';
        carregarNotificacoesAluno();
    });

    document.getElementById('btn-voltar-notificacoes')?.addEventListener('click', () => {
        document.getElementById('view-aluno-notificacoes').style.display = 'none';
        const activeTab = document.querySelector('.bottom-nav .nav-item.active');
        if(activeTab) {
            document.getElementById(activeTab.getAttribute('data-target')).style.display = 'block';
        } else {
            document.getElementById('student-dashboard').style.display = 'block';
        }
    });
}

function carregarCanaisForumAluno() {
    const list = document.getElementById('aluno-forum-channel-list'); if(!list) return;
    list.innerHTML = '<p class="text-muted center">A carregar conversas...</p>';
    
    try {
        // Query solta para apanhar até os grupos antigos que não tinham data
        const q = query(collection(window.db, "forums")); 
        onSnapshot(q, (snap) => {
            let html = '';
            let grupos = [];
            
            snap.forEach(d => {
                const ch = d.data();
                if (ch.isGlobal || !ch.participantes || ch.participantes.includes(window.myUserId)) {
                    grupos.push({ id: d.id, ...ch });
                }
            });

            // Ordena manualmente para evitar que o firebase esconda fóruns sem "dataCriacao"
            grupos.sort((a,b) => (b.dataCriacao || 0) - (a.dataCriacao || 0));

            grupos.forEach(ch => {
                const eGlobal = ch.isGlobal ? `<i class="fa-solid fa-earth-americas" style="color:var(--primary-green);" title="Escola Inteira"></i> ` : '';
                const unread = (ch.unread && ch.unread[window.myUserId]) ? `<span style="background:var(--danger-red); color:white; font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:12px;">Nova</span>` : '';
                const lM = ch.lastMessage ? `<p style="margin:5px 0 0 0; font-size:0.8rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ch.lastMessage.sender === window.myUserId ? 'Tu: ' : ''}${ch.lastMessage.text}</p>` : '';
                
                html += `<div class="card" style="margin-bottom:10px; cursor:pointer; display:flex; align-items:center; justify-content:space-between; border: 1px solid #333;" onclick="window.abrirChatForumAluno('${ch.id}', '${ch.nome}')">
                            <div style="flex:1; overflow:hidden;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <h4 style="margin:0; color:var(--text-light); font-size:1rem;">${eGlobal}${ch.nome}</h4>
                                    ${unread}
                                </div>
                                ${lM}
                            </div>
                         </div>`;
            });
            list.innerHTML = html === '' ? getEmptyState('Ainda não tens grupos de estudo.', 'fa-comments') : html;
        });
    } catch(e) {}
}

window.abrirChatForumAluno = async (chatId, chatNome) => {
    alunoForumAtivoId = chatId;
    document.getElementById('aluno-chat-active-title').innerText = chatNome;
    document.getElementById('btn-create-chat-aluno').style.display = 'none'; 
    document.getElementById('aluno-forum-channel-list').style.display = 'none';
    document.getElementById('aluno-forum-chat-view').style.display = 'flex';
    
    try { await updateDoc(doc(window.db, "forums", chatId), { [`unread.${window.myUserId}`]: false }); } catch(e){}
    
    const mc = document.getElementById('aluno-chat-messages-container'); mc.innerHTML = '<p class="text-muted center">A ler mensagens...</p>';
    if(chatUnsubscribeAluno) chatUnsubscribeAluno();
    
    chatUnsubscribeAluno = onSnapshot(query(collection(window.db, "forums", chatId, "mensagens"), orderBy("timestamp", "asc")), (snap) => {
        let h = '';
        snap.forEach(d => {
            const m = d.data(); const mMinha = m.sender === window.myUserId;
            const al = mMinha ? 'flex-end' : 'flex-start'; const bg = mMinha ? 'var(--primary-green)' : '#333'; const c = mMinha ? '#000' : 'var(--text-light)'; const br = mMinha ? '12px 12px 0 12px' : '12px 12px 12px 0';
            const sN = mMinha ? '' : `<div style="font-size:0.7rem; color:var(--text-muted); margin-bottom:3px; margin-left:5px;">${m.senderName}</div>`;
            h += `<div style="display:flex; flex-direction:column; align-items:${al}; width:100%;">${sN}<div style="background:${bg}; color:${c}; padding:10px 14px; border-radius:${br}; max-width:85%; font-size:0.95rem; line-height:1.4; box-shadow:0 2px 5px rgba(0,0,0,0.2);">${m.text}</div></div>`;
        });
        mc.innerHTML = h === '' ? '<p class="text-muted center" style="margin-top:20px;">Sê o primeiro a dizer olá!</p>' : h;
        setTimeout(() => mc.scrollTop = mc.scrollHeight, 100);
    });
};

async function carregarNotificacoesAluno() {
    const c = document.getElementById('aluno-notificacoes-container'); c.innerHTML = '<p class="text-muted center">A verificar avisos...</p>';
    try {
        const snap = await getDocs(query(collection(window.db, "utilizadores", window.myUserId, "notificacoes"), orderBy("timestamp", "desc")));
        let h = ''; let nC = 0;
        snap.forEach(d => {
            const n = d.data();
            if(window.notifFilterCat === 'all' || window.notifFilterCat === n.categoria) {
                if(!n.lida) nC++;
                const ic = n.categoria==='importante'?'fa-triangle-exclamation':'fa-bell'; 
                const co = n.categoria==='importante'?'var(--danger-red)':'var(--primary-green)';
                h += `<div class="card" style="border-left: 4px solid ${co}; margin-bottom:10px; opacity:${n.lida?'0.6':'1'};">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;"><strong style="color:var(--text-light);"><i class="fa-solid ${ic}" style="color:${co};"></i> ${n.titulo}</strong></div>
                        <p style="font-size:0.85rem; color:var(--text-muted); margin:0;">${n.mensagem}</p>
                      </div>`;
            }
        });
        c.innerHTML = h === '' ? getEmptyState('Não tens notificações nesta categoria.', 'fa-bell-slash') : h;
        const b = document.getElementById('badge-notificacoes');
        if(b) { if(nC > 0) { b.style.display = 'block'; b.innerText = nC; } else { b.style.display = 'none'; } }
    } catch(e) {}
}
