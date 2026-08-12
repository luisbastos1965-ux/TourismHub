import { collection, getDocs, getDoc, doc, query, addDoc, updateDoc, onSnapshot, orderBy, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { obterDisciplinasDoAno } from "./aluno-caderneta.js"; // Importa disciplinas para criar os chats oficiais

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

    // BOTÃO NOVO CHAT + LÓGICA DO MODAL TOTALMENTE RECUPERADA!
    const btnCreate = document.getElementById('btn-create-chat-aluno');
    if(btnCreate) {
        btnCreate.innerHTML = '<i class="fa-solid fa-plus"></i> Novo Chat';
        btnCreate.addEventListener('click', async () => {
            document.getElementById('modal-criar-forum').style.display = 'flex';
            const cList = document.getElementById('lista-colegas-forum');
            cList.innerHTML = '<p class="text-muted center" style="font-size:0.8rem;">A procurar colegas...</p>';
            
            if(window.minhaTurma) {
                try {
                    const snap = await getDocs(query(collection(window.db, "utilizadores"), where("turma", "==", window.minhaTurma), where("papel", "==", "aluno")));
                    let html = '';
                    snap.forEach(d => {
                        const col = d.data();
                        if(d.id !== window.myUserId) {
                            html += `<label style="display:flex; align-items:center; gap:10px; padding:8px; border-bottom:1px solid #222; font-size:0.9rem; color:var(--text-light); cursor:pointer;">
                                        <input type="checkbox" class="coleta-chk" value="${d.id}" style="margin:0;">
                                        <img src="${col.fotoPerfil || `https://ui-avatars.com/api/?name=${col.nome}&background=00cc88&color=fff`}" style="width:25px; height:25px; border-radius:50%; object-fit:cover;">
                                        ${col.nome}
                                     </label>`;
                        }
                    });
                    cList.innerHTML = html === '' ? '<p class="text-muted center" style="font-size:0.8rem;">Nenhum colega encontrado.</p>' : html;
                } catch(e) { cList.innerHTML = '<p class="text-danger center">Erro a carregar colegas.</p>'; }
            }
        });
    }

    // BOTÕES DE AÇÃO DO MODAL
    document.getElementById('btn-cancelar-novo-forum')?.addEventListener('click', () => { 
        document.getElementById('modal-criar-forum').style.display = 'none'; 
    });

    document.getElementById('btn-confirm-novo-forum')?.addEventListener('click', async (e) => {
        const nInput = document.getElementById('input-nome-novo-forum'); const nome = nInput.value.trim();
        if(!nome) { alert("Dá um nome ao grupo!"); return; }
        const selecionados = Array.from(document.querySelectorAll('.coleta-chk:checked')).map(cb => cb.value);
        if(selecionados.length === 0) { alert("Seleciona pelo menos um colega."); return; }
        
        const participantes = [window.myUserId, ...selecionados];
        const btn = e.currentTarget; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
        
        try {
            await addDoc(collection(window.db, "forums"), { nome: nome, isGlobal: false, criador: window.myUserId, participantes: participantes, dataCriacao: Date.now(), lastMessage: null, unread: {} });
            document.getElementById('modal-criar-forum').style.display = 'none'; nInput.value = ''; carregarCanaisForumAluno();
        } catch(err) { alert("Erro ao criar."); }
        btn.innerHTML = 'Criar Chat'; btn.disabled = false;
    });

    // CHAT - Voltar e Enviar Mensagem
    document.getElementById('btn-aluno-voltar-canais')?.addEventListener('click', () => {
        alunoForumAtivoId = null; if(chatUnsubscribeAluno) chatUnsubscribeAluno();
        document.getElementById('aluno-forum-chat-view').style.display = 'none';
        document.getElementById('btn-create-chat-aluno').style.display = 'block'; 
        document.getElementById('aluno-forum-channel-list').style.display = 'block';
    });

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

    // NOTIFICAÇÕES
    document.querySelectorAll('#notificacoes-filtros .filter-chip').forEach(chip => {
        chip.addEventListener('click', (e) => { 
            document.querySelectorAll('#notificacoes-filtros .filter-chip').forEach(c => c.classList.remove('active')); 
            e.target.classList.add('active'); 
            window.notifFilterCat = e.target.getAttribute('data-cat'); 
            carregarNotificacoesAluno(); 
        });
    });

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
        const q = query(collection(window.db, "forums")); 
        onSnapshot(q, (snap) => {
            let html = ''; let grupos = [];
            
            // 1. INJEÇÃO DOS CHATS FIXOS/PERMANENTES NA LISTA
            const mAcad = window.myAcademia ? window.myAcademia.charAt(0).toUpperCase() + window.myAcademia.slice(1) : 'Academia';
            grupos.push({ id: `chat_dt_${window.minhaTurma}`, nome: "Diretor de Turma (Privado)", isGlobal: false, icone: "fa-user-tie", cor: "var(--warning-yellow)", isStatic: true });
            grupos.push({ id: `chat_turma_${window.minhaTurma}`, nome: `Turma ${window.minhaTurma}`, isGlobal: false, icone: "fa-users", cor: "#0ea5e9", isStatic: true });
            grupos.push({ id: `chat_acad_${window.myAcademia}`, nome: `Academia dos ${mAcad}`, isGlobal: false, icone: "fa-chess-knight", cor: "var(--primary-green)", isStatic: true });
            
            obterDisciplinasDoAno().forEach(d => {
                grupos.push({ id: `chat_disc_${window.minhaTurma}_${d}`, nome: `${d} - Geral`, isGlobal: false, icone: "fa-book", cor: "#8b5cf6", isStatic: true });
            });

            // 2. ADICIONA OS GRUPOS QUE ESTÃO NA BASE DE DADOS
            snap.forEach(d => {
                const ch = d.data();
                if (ch.isGlobal || !ch.participantes || ch.participantes.includes(window.myUserId)) {
                    // Evita duplicar os chats estáticos caso a base de dados os tenha registado
                    const exists = grupos.findIndex(g => g.id === d.id);
                    if (exists !== -1) {
                        grupos[exists] = { ...grupos[exists], ...ch, isStatic: true }; // Atualiza com os dados (ex: unread messages)
                    } else {
                        grupos.push({ id: d.id, ...ch });
                    }
                }
            });

            // Ordenar: Primeiro os Oficiais (Estáticos), depois os criados organizados por data
            grupos.sort((a,b) => {
                if (a.isStatic && !b.isStatic) return -1;
                if (!a.isStatic && b.isStatic) return 1;
                return (b.dataCriacao || 0) - (a.dataCriacao || 0);
            });

            grupos.forEach(ch => {
                const iconeDefault = ch.icone ? `<i class="fa-solid ${ch.icone}" style="color:${ch.cor}; font-size: 1.2rem; min-width: 25px; text-align:center;"></i>` : (ch.isGlobal ? `<i class="fa-solid fa-earth-americas" style="color:var(--primary-green);" title="Escola Inteira"></i>` : `<i class="fa-solid fa-comments" style="color:var(--text-muted);"></i>`);
                const unread = (ch.unread && ch.unread[window.myUserId]) ? `<span style="background:var(--danger-red); color:white; font-size:0.7rem; font-weight:bold; padding:2px 8px; border-radius:12px;">Nova</span>` : '';
                const lM = ch.lastMessage ? `<p style="margin:5px 0 0 0; font-size:0.8rem; color:var(--text-muted); white-space:nowrap; overflow:hidden; text-overflow:ellipsis;">${ch.lastMessage.sender === window.myUserId ? 'Tu: ' : ''}${ch.lastMessage.text}</p>` : '';
                
                html += `<div class="card" style="margin-bottom:10px; cursor:pointer; display:flex; align-items:center; gap: 15px; justify-content:space-between; border: 1px solid #333;" onclick="window.abrirChatForumAluno('${ch.id}', '${ch.nome}')">
                            ${iconeDefault}
                            <div style="flex:1; overflow:hidden;">
                                <div style="display:flex; justify-content:space-between; align-items:center;">
                                    <h4 style="margin:0; color:var(--text-light); font-size:1rem;">${ch.nome}</h4>
                                    ${unread}
                                </div>
                                ${lM}
                            </div>
                         </div>`;
            });
            list.innerHTML = html === '' ? getEmptyState('Ainda não tens chats ativos.', 'fa-comments') : html;
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
