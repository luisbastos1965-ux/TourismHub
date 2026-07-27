import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, getDocs, updateDoc, addDoc, onSnapshot, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const matrizCurso = {
    "Sociocultural": { "PORT": {"M1": 27, "M2": 24, "M3": 27}, "ING": {"M1": 24, "M2": 24, "M3": 24}, "AI": {"M1": 30, "M2": 30}, "EF": {"M1": 20, "M2": 20, "M3": 20, "M4": 20, "M5": 20}, "TIC": {"M1": 24, "M2": 24, "M3": 27, "M4": 24} },
    "Científica": { "GEO": {"M1": 27, "M2": 24}, "HCA": {"M1": 24, "M2": 24, "M3": 27}, "MAT": {"M1": 30, "M2": 30, "M3": 30} },
    "Técnica": { "CF": {"M1": 30, "M2": 30, "M3": 30}, "TIAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "TCAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "OTET": {"M1": 25, "M2": 25, "M3": 25, "M4": 25} }
};

let myUserName = ""; let educandoId = ""; let educandoNome = ""; let faltaSelecionadaId = ""; let comprovativoBase64 = "";

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", userId));
            if (docSnap.exists() && docSnap.data().papel === 'ee') {
                const dados = docSnap.data(); myUserName = dados.nome.split(' ')[0]; educandoId = dados.educando; 
                document.getElementById('ee-welcome-name').innerText = `Bem-vindo(a), ${myUserName}!`;
                if (educandoId) { await carregarDadosEducando(educandoId); } else { document.getElementById('ee-nome-aluno').innerText = "Nenhum educando associado."; }
            } else { window.location.href = "index.html"; }
        } catch (e) { console.error("Erro EE", e); }
    } else { window.location.href = "index.html"; }
});

document.getElementById('btn-logout-ee')?.addEventListener('click', () => { signOut(auth).then(() => window.location.href = "index.html"); });
document.querySelectorAll('.btn-fechar-modal').forEach(b => b.addEventListener('click', () => { document.getElementById('modal-ee-justificar').style.display = 'none'; document.getElementById('modal-ee-caderneta').style.display = 'none'; document.getElementById('modal-ee-chat').style.display = 'none'; }));

async function carregarDadosEducando(idAluno) {
    try {
        const alunoSnap = await getDoc(doc(db, "utilizadores", idAluno));
        if (alunoSnap.exists()) { educandoNome = alunoSnap.data().nome; document.getElementById('ee-nome-aluno').innerText = educandoNome; } else { return; }
        const notasDb = await getDocs(collection(db, "utilizadores", idAluno, "notas")); let sumNotas = 0; let countNotas = 0;
        notasDb.forEach(n => { const val = n.data().nota; if (val !== 'REP' && !isNaN(val)) { sumNotas += Number(val); countNotas++; } });
        const media = countNotas > 0 ? (sumNotas / countNotas).toFixed(1) : '--'; const elMedia = document.getElementById('ee-media-aluno'); elMedia.innerText = media; if(media !== '--' && Number(media) < 10) elMedia.style.color = "var(--danger-red)";
        const faltasDb = await getDocs(collection(db, "utilizadores", idAluno, "faltas")); let totalFInjustificadas = 0;
        faltasDb.forEach(f => { if (!f.data().justificada) totalFInjustificadas += f.data().horas; }); document.getElementById('ee-faltas-aluno').innerText = totalFInjustificadas;
    } catch (e) { console.error(e); }
}

// JUSTIFICAR FALTAS (CÓDIGO ORIGINAL MANTIDO)
document.getElementById('btn-ee-justificacoes')?.addEventListener('click', () => { document.getElementById('modal-ee-justificar').style.display = 'flex'; document.getElementById('ee-form-anexo').style.display = 'none'; carregarFaltasInjustificadas(); });
async function carregarFaltasInjustificadas() { const container = document.getElementById('ee-lista-faltas-injustificadas'); container.innerHTML = '<p class="text-muted center">A procurar...</p>'; if(!educandoId) return; try { const res = await getDocs(collection(db, "utilizadores", educandoId, "faltas")); let faltas = []; res.forEach(d => { const f = d.data(); if (!f.justificada && !f.comprovativoEnviado) { f.id = d.id; faltas.push(f); } }); if (faltas.length === 0) { container.innerHTML = '<p class="text-muted center" style="color:var(--success-green);">Todas as faltas estão justificadas! 🎉</p>'; return; } faltas.sort((a,b) => b.dataInicio.localeCompare(a.dataInicio)); let html = ''; faltas.forEach(f => { html += `<div class="alert-card" style="margin-bottom:10px; cursor:pointer;" id="card-falta-${f.id}"><div class="alert-icon" style="color:var(--danger-red); background:rgba(255,77,77,0.1);"><i class="fa-solid fa-triangle-exclamation"></i></div><div class="alert-info" style="flex:1;"><h4 style="font-size:0.95rem;">${f.dataInicio} (${f.horas}h)</h4><span>${f.disciplina} - ${f.modulo}</span></div><button class="secondary-btn small-btn btn-selecionar-falta" data-id="${f.id}" data-desc="${f.dataInicio} | ${f.disciplina}" style="width:auto; padding:5px 10px;">Selecionar</button></div>`; }); container.innerHTML = html; container.querySelectorAll('.btn-selecionar-falta').forEach(btn => { btn.addEventListener('click', (e) => { faltaSelecionadaId = e.currentTarget.getAttribute('data-id'); const desc = e.currentTarget.getAttribute('data-desc'); container.querySelectorAll('.alert-card').forEach(c => c.style.borderColor = 'transparent'); document.getElementById(`card-falta-${faltaSelecionadaId}`).style.borderColor = '#0099ff'; document.getElementById('ee-falta-selecionada-txt').innerText = desc; document.getElementById('ee-form-anexo').style.display = 'block'; document.getElementById('ee-upload-atestado').value = ""; document.getElementById('ee-atestado-nome').innerText = ""; comprovativoBase64 = ""; }); }); } catch(err) { container.innerHTML = '<p class="text-danger center">Erro ao carregar faltas.</p>'; } }
document.getElementById('ee-upload-atestado')?.addEventListener('change', (e) => { const file = e.target.files[0]; if(!file) return; if(file.size > 716800) { alert("Ficheiro demasiado grande! Tente tirar uma foto com menos resolução ou cortar a imagem.."); return; } document.getElementById('ee-atestado-nome').innerText = "Ficheiro anexado: " + file.name; document.getElementById('ee-atestado-nome').style.color = "var(--success-green)"; const reader = new FileReader(); reader.onload = (ev) => { comprovativoBase64 = ev.target.result; }; reader.readAsDataURL(file); });
document.getElementById('btn-ee-enviar-justificacao')?.addEventListener('click', async (e) => { if(!faltaSelecionadaId) return alert("Selecione uma falta primeiro."); if(!comprovativoBase64) return alert("Tem de anexar uma fotografia ou PDF do atestado."); const btnRef = e.currentTarget; const originalText = btnRef.innerHTML; btnRef.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A enviar...'; try { await updateDoc(doc(db, "utilizadores", educandoId, "faltas", faltaSelecionadaId), { comprovativoEnviado: true, anexoJustificacao: comprovativoBase64, dataEnvioJustificacao: new Date().toISOString() }); btnRef.style.backgroundColor = "var(--success-green)"; btnRef.innerHTML = '<i class="fa-solid fa-check"></i> Enviado com Sucesso!'; setTimeout(() => { document.getElementById('ee-form-anexo').style.display = 'none'; btnRef.style.backgroundColor = "#0099ff"; btnRef.innerHTML = originalText; carregarFaltasInjustificadas(); }, 1500); } catch(err) { btnRef.innerHTML = "Erro ao enviar!"; setTimeout(() => btnRef.innerHTML = originalText, 2000); } });

// VER CADERNETA (CÓDIGO ORIGINAL MANTIDO)
document.getElementById('btn-ee-caderneta')?.addEventListener('click', async () => { if(!educandoId) return alert("Nenhum educando associado."); document.getElementById('modal-ee-caderneta').style.display = 'flex'; const container = document.getElementById('ee-caderneta-content'); container.innerHTML = '<p class="text-muted" style="text-align:center;">A compilar notas da pauta...</p>'; try { const notasDb = await getDocs(collection(db, "utilizadores", educandoId, "notas")); const mapNotas = {}; notasDb.forEach(d => { mapNotas[`${d.data().disciplina}_${d.data().modulo}`] = d.data().nota; }); let html = ''; for (const [comp, disciplinas] of Object.entries(matrizCurso)) { html += `<div class="pauta-global-componente"><div class="pauta-global-header">${comp}</div>`; for (const [nomeDisc, modulos] of Object.entries(disciplinas)) { html += `<div class="pauta-global-disc"><div class="pauta-global-disc-title">${nomeDisc}</div><div class="pauta-global-notas">`; for(const mod of Object.keys(modulos)) { const nota = mapNotas[`${nomeDisc}_${mod}`] || 'SN'; let cor = "sn"; if(nota !== 'SN' && nota !== 'REP' && nota >= 10) cor = "positiva"; else if(nota === 'REP' || nota < 10) cor = "negativa"; html += `<div class="pg-nota-item"><span>${mod}</span><span class="pg-nota-val ${cor}">${nota}</span></div>`; } html += `</div></div>`; } html += `</div>`; } container.innerHTML = html; } catch(err) { container.innerHTML = '<p class="text-danger center">Erro ao carregar a pauta.</p>'; } });

// ==========================================
// MÓDULO NOVO: CHAT DIRETO COM O DT
// ==========================================
let chatUnsubscribeEE = null;

document.getElementById('btn-ee-mensagens')?.addEventListener('click', () => {
    if(!educandoId) return alert("Nenhum educando associado.");
    document.getElementById('modal-ee-chat').style.display = 'flex';
    iniciarChatEE();
});

function iniciarChatEE() {
    const chatContainer = document.getElementById('ee-chat-messages');
    chatContainer.innerHTML = '';
    if(chatUnsubscribeEE) chatUnsubscribeEE();

    // Lê as mensagens da pasta confidencial deste aluno
    chatUnsubscribeEE = onSnapshot(query(collection(db, "utilizadores", educandoId, "chat_dt"), orderBy("timestamp")), (snapshot) => {
        let html = '';
        snapshot.forEach(doc => {
            const msg = doc.data();
            const isMe = msg.autor === 'ee';
            // Se for do EE (Eu), usa a classe admin (fundo verde na direita), senão usa student (fundo escuro na esquerda)
            const classe = isMe ? 'admin' : 'student'; 
            html += `<div class="chat-bubble ${classe}">
                        <strong>${isMe ? 'Tu' : 'Diretor(a) de Turma'}</strong><br>
                        ${msg.texto}
                        <span class="chat-meta">${new Date(msg.timestamp).toLocaleTimeString([], {hour:'2-digit', minute:'2-digit'})}</span>
                     </div>`;
        });
        chatContainer.innerHTML = html;
        chatContainer.scrollTop = chatContainer.scrollHeight;
    });
}

document.getElementById('btn-ee-chat-send')?.addEventListener('click', async () => {
    const inp = document.getElementById('ee-chat-input');
    const txt = inp.value.trim();
    if(!txt || !educandoId) return;
    
    try {
        await addDoc(collection(db, "utilizadores", educandoId, "chat_dt"), {
            remetente: myUserName,
            autor: 'ee',
            texto: txt,
            timestamp: Date.now()
        });
        inp.value = '';
    } catch(e) { console.error("Erro a enviar mensagem", e); }
});
