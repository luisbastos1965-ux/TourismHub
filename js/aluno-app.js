// js/aluno-app.js
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs, query, addDoc, onSnapshot, orderBy, where, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Importar os Módulos
import { setupGamificacao, aplicarTemaAcademia } from "./modules/aluno-gamificacao.js";
import { setupCaderneta } from "./modules/aluno-caderneta.js";
import { setupHorario, carregarMateriaisAluno } from "./modules/aluno-horario.js";
import { setupComunicacao } from "./modules/aluno-comunicacao.js";
import { setupPassaporte } from "./modules/aluno-passaporte.js";

// Partilhar variáveis globalmente para os módulos usarem
window.db = db;
window.myUserId = "";
window.myUserName = "";
window.minhaTurma = "";
window.myAcademia = "";

try { enableIndexedDbPersistence(db).catch(function(){}); } catch(e){}

// ==========================================
// INICIALIZAÇÃO DA APP
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        window.myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", window.myUserId));
            if (docSnap.exists() && docSnap.data().papel === 'aluno') {
                const d = docSnap.data(); 
                window.myUserName = (d.nome || "Aluno").split(' ')[0]; 
                window.minhaTurma = d.turma || ""; 
                window.myAcademia = d.academia || null;
                
                // Preencher Interface Básica
                document.getElementById('header-user-name-aluno').innerText = window.myUserName; 
                document.getElementById('welcome-nome').innerText = window.myUserName;
                
                const centralNome = document.getElementById('perfil-nome-central'); 
                if(centralNome) centralNome.innerText = d.nome || window.myUserName;
                
                if(d.cargo === 'delegado' || d.cargo === 'subdelegado') {
                    const btnDel = document.getElementById('btn-modo-delegado');
                    if(btnDel) btnDel.style.display = 'inline-block';
                }

                const avatarCircle = document.getElementById('header-avatar-circle'); 
                const perfilImg = document.getElementById('perfil-avatar-img');
                if(d.fotoPerfil) { 
                    if(avatarCircle) avatarCircle.innerHTML = `<img src="${d.fotoPerfil}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`; 
                    if(perfilImg) perfilImg.src = d.fotoPerfil; 
                } else { 
                    if(perfilImg) perfilImg.src = `https://ui-avatars.com/api/?name=${window.myUserName}&background=00cc88&color=fff&size=100`; 
                }

                // Lógica de Visibilidade do Botão FCT/PAP
                const mStr = window.minhaTurma || "";
                const mMatch = mStr.match(/\d+/);
                const turmaAno = mMatch ? parseInt(mMatch[0]) : (d.ano || 10);
                
                // Simula o bloqueio (que depois será alterado pelo Professor na BD)
                const fctBloqueada = d.fctBloqueada !== false; 
                
                const btnPassaporte = document.getElementById('btn-abrir-passaporte');
                if (btnPassaporte) {
                    if (turmaAno === 10) {
                        btnPassaporte.style.setProperty('display', 'none', 'important');
                    } else if (turmaAno === 11 && fctBloqueada) {
                        btnPassaporte.style.display = 'flex';
                        btnPassaporte.style.filter = 'grayscale(100%)';
                        btnPassaporte.style.opacity = '0.5';
                        btnPassaporte.style.cursor = 'not-allowed';
                        btnPassaporte.style.pointerEvents = 'none';
                    } else {
                        btnPassaporte.style.display = 'flex';
                        btnPassaporte.style.filter = 'none';
                        btnPassaporte.style.opacity = '1';
                        btnPassaporte.style.cursor = 'pointer';
                        btnPassaporte.style.pointerEvents = 'auto';
                    }
                }
                
                // Iniciar Módulos
                setupGamificacao(d);
                setupCaderneta(d);
                setupHorario();
                setupComunicacao();
                setupPassaporte(); // <-- NOVO MÓDULO ATIVADO AQUI

                // ==========================================
                // LIGA O MOTOR DE NOTIFICAÇÕES DA GAMIFICAÇÃO
                // ==========================================
                window.iniciarEscutaNotificacoesAluno();

                // --- NAVEGAÇÃO DO SINO ---
                document.getElementById('btn-open-notificacoes')?.addEventListener('click', () => {
                    document.querySelectorAll('.app-content > div:not(.modal-overlay)').forEach(d => d.style.display = 'none');
                    document.getElementById('view-aluno-notificacoes').style.display = 'block';
                    
                    const bellBadge = document.getElementById('badge-notificacoes');
                    if (bellBadge) bellBadge.style.display = 'none';
                });

                document.getElementById('btn-voltar-notificacoes')?.addEventListener('click', () => {
                    const abaAtiva = document.querySelector('.bottom-nav .nav-item.active');
                    if (abaAtiva) abaAtiva.click();
                });
                // 👆 FIM DO SISTEMA DE NOTIFICAÇÕES 👆

                // Verificar Academia
                if (!window.myAcademia) {
                    document.getElementById('modal-academia-quiz').style.display = 'flex'; 
                } else {
                    aplicarTemaAcademia(window.myAcademia);
                }
            } else {
                window.location.href = "index.html";
            }
        } catch (e) { console.error("Erro na leitura inicial:", e); }
    } else {
        window.location.href = "index.html";
    }
});

const btnLogout = document.getElementById('btn-logout-aluno');
if(btnLogout) btnLogout.addEventListener('click', () => signOut(auth));

// ==========================================
// NAVEGAÇÃO INFERIOR
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.app-content > div:not(.modal-overlay)').forEach(d => { if(d.id !== 'student-dashboard') d.style.display = 'none'; });
    
    document.querySelectorAll('.bottom-nav .nav-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            document.querySelectorAll('.bottom-nav .nav-item').forEach(n => n.classList.remove('active'));
            item.classList.add('active');
            
            document.querySelectorAll('.app-content > div:not(.modal-overlay)').forEach(d => d.style.display = 'none');
            const targetId = item.getAttribute('data-target');
            document.getElementById(targetId).style.display = 'block';
            
            // Disparar gatilhos específicos ao mudar de aba
            if(targetId === 'view-aluno-perfil') document.getElementById('badges-wrapper').style.display = 'none';
            if(targetId === 'view-aluno-caderneta') setTimeout(() => document.getElementById('tab-aluno-timeline').click(), 50);
            if(targetId === 'view-aluno-agenda') setTimeout(() => document.getElementById('tab-aluno-eventos').click(), 50);
            if(targetId === 'view-aluno-forum') {
                if(window.carregarCanaisForumAluno) window.carregarCanaisForumAluno();
            }
        });
    });

    document.getElementById('btn-open-materiais')?.addEventListener('click', () => {
        document.querySelectorAll('.app-content > div:not(.modal-overlay)').forEach(d => d.style.display = 'none');
        document.getElementById('view-aluno-materiais').style.display = 'block';
        carregarMateriaisAluno();
    });
    document.getElementById('btn-voltar-materiais')?.addEventListener('click', () => document.querySelector('.bottom-nav .nav-item.active').click());
});

// =========================================================================
// SISTEMA DE NOTIFICAÇÕES UNIFICADO (Caixa Blindada Anti-Conflitos)
// =========================================================================
let unsubNotificacoesOco = null;
let unsubNotificacoesAvisos = null;
let globalOcorrencias = [];
let globalAvisosVIP = [];
let filtroAtualAluno = 'Todas';

window.iniciarEscutaNotificacoesAluno = function() {
    const userId = window.myUserId; 
    if (!userId) return; 
    
    if (unsubNotificacoesOco) unsubNotificacoesOco();
    if (unsubNotificacoesAvisos) unsubNotificacoesAvisos();

    // 1. MOTOR DAS OCORRÊNCIAS (RPG E DISCIPLINA)
    const qOco = query(collection(db, "utilizadores", userId, "ocorrencias"));
    unsubNotificacoesOco = onSnapshot(qOco, (snap) => {
        globalOcorrencias = [];
        snap.forEach(docSnap => {
            const oco = docSnap.data();
            if (oco.apagadaAluno) return; 
            
            oco.id = docSnap.id;
            oco._source = 'ocorrencia';
            oco._timestamp = oco.data ? new Date(oco.data).getTime() : 0;
            globalOcorrencias.push(oco);
        });
        atualizarSinoERenderizar();
    });

    // 2. MOTOR DOS AVISOS DA DIREÇÃO (VIP)
    const qAvisos = collection(db, "escola_avisos_globais");
    unsubNotificacoesAvisos = onSnapshot(qAvisos, (snap) => {
        globalAvisosVIP = [];
        let avisosLidos = JSON.parse(localStorage.getItem('avisos_lidos_popup') || '[]');
        let avisosApagados = JSON.parse(localStorage.getItem('avisos_apagados_aluno') || '[]');
        
        snap.forEach(docSnap => {
            const avisoId = docSnap.id;
            if (avisosApagados.includes(avisoId)) return;

            const aviso = docSnap.data();
            const alvoAviso = (aviso.alvo || "").trim().toUpperCase();
            const turmaAluno = (window.minhaTurma || "").trim().toUpperCase();
            
            if (alvoAviso === "TODOS" || alvoAviso === turmaAluno) {
                aviso.id = avisoId;
                aviso._source = 'aviso_vip';
                
                let ts = 0;
                if (aviso.timestamp) {
                    if (typeof aviso.timestamp.toDate === 'function') { ts = aviso.timestamp.toDate().getTime(); }
                    else if (typeof aviso.timestamp === 'string' || typeof aviso.timestamp === 'number') { ts = new Date(aviso.timestamp).getTime(); }
                }
                aviso._timestamp = ts || Date.now();
                
                globalAvisosVIP.push(aviso);

                if (!avisosLidos.includes(avisoId)) {
                    mostrarPopupAvisoVIP(aviso);
                }
            }
        });
        atualizarSinoERenderizar();
    });
};

function atualizarSinoERenderizar() {
    let naoLidas = globalOcorrencias.filter(o => !o.lidaAluno).length;
    const bellBadge = document.getElementById('badge-notificacoes');
    if (bellBadge) {
        if (naoLidas > 0) {
            bellBadge.style.display = 'flex';
            bellBadge.innerText = naoLidas;
            bellBadge.style.background = 'var(--danger-red)';
        } else {
            bellBadge.style.display = 'none';
        }
    }
    renderizarNotificacoesAluno();
}

function mostrarPopupAvisoVIP(aviso) {
    let avisosLidos = JSON.parse(localStorage.getItem('avisos_lidos_popup') || '[]');
    let modalApp = document.getElementById('modal-aviso-direcao-dinamico');
    
    if (!modalApp) {
        const modalHTML = `
        <div id="modal-aviso-direcao-dinamico" class="modal-overlay" style="display: flex; z-index: 9999; align-items: center; justify-content: center;">
            <div class="action-sheet" style="border-radius: 12px; max-width: 350px; width: 90%; margin: auto; text-align: center; border: 2px solid #9333ea; box-shadow: 0 10px 30px rgba(147, 51, 234, 0.4); background: var(--bg-card);">
                <div style="background-color: rgba(147, 51, 234, 0.15); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto;">
                    <i class="fa-solid fa-bullhorn" style="color: #9333ea; font-size: 1.8rem;"></i>
                </div>
                <h3 id="modal-aviso-titulo" style="color: #9333ea; margin-bottom: 15px; font-size: 1.2rem;">${aviso.titulo}</h3>
                <p id="modal-aviso-mensagem" style="color: var(--text-light); font-size: 0.95rem; margin-bottom: 25px; line-height: 1.5; text-align: left; background: var(--bg-dark); padding: 15px; border-radius: 8px; border-left: 3px solid #9333ea;">
                    ${aviso.mensagem}
                </p>
                <button id="btn-fechar-modal-aviso" class="primary-btn" style="background-color: #9333ea; color: #fff; width: 100%;">Entendido</button>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);

        document.getElementById('btn-fechar-modal-aviso').addEventListener('click', () => {
            document.getElementById('modal-aviso-direcao-dinamico').style.display = 'none';
            avisosLidos.push(aviso.id);
            localStorage.setItem('avisos_lidos_popup', JSON.stringify(avisosLidos));
        });
    } else {
        document.getElementById('modal-aviso-titulo').innerText = aviso.titulo;
        document.getElementById('modal-aviso-mensagem').innerText = aviso.mensagem;
        modalApp.style.display = 'flex';
        
        const btnFechar = document.getElementById('btn-fechar-modal-aviso');
        const novoClone = btnFechar.cloneNode(true);
        btnFechar.parentNode.replaceChild(novoClone, btnFechar);
        
        novoClone.addEventListener('click', () => {
            document.getElementById('modal-aviso-direcao-dinamico').style.display = 'none';
            avisosLidos.push(aviso.id);
            localStorage.setItem('avisos_lidos_popup', JSON.stringify(avisosLidos));
        });
    }
}

function mostrarModalApagarPasta(callbackExecucao) {
    let modalDel = document.getElementById('modal-confirmar-apagar-pasta');
    
    if (!modalDel) {
        const modalHTML = `
        <div id="modal-confirmar-apagar-pasta" class="modal-overlay" style="display: flex; z-index: 9999; align-items: center; justify-content: center;">
            <div class="action-sheet" style="border-radius: 12px; max-width: 320px; width: 90%; margin: auto; text-align: center; border: 1px solid #333; background: #111; padding: 25px;">
                <div style="background-color: rgba(239, 68, 68, 0.1); width: 60px; height: 60px; border-radius: 50%; display: flex; align-items: center; justify-content: center; margin: 0 auto 15px auto;">
                    <i class="fa-solid fa-trash-can" style="color: var(--danger-red); font-size: 1.5rem;"></i>
                </div>
                <h3 style="color: white; margin-bottom: 10px; font-size: 1.1rem;">Limpar Categoria</h3>
                <p style="color: var(--text-muted); font-size: 0.9rem; margin-bottom: 25px; line-height: 1.4;">
                    Tens a certeza que queres eliminar todas as notificações visíveis? Esta ação não pode ser desfeita.
                </p>
                <div style="display: flex; gap: 10px;">
                    <button id="btn-cancelar-apagar-pasta" class="secondary-btn" style="flex: 1; border: 1px solid #444; color: var(--text-muted); background: transparent;">Cancelar</button>
                    <button id="btn-confirmar-apagar-pasta" class="primary-btn" style="flex: 1; background-color: var(--danger-red); color: white; border: none;">Eliminar</button>
                </div>
            </div>
        </div>`;
        document.body.insertAdjacentHTML('beforeend', modalHTML);
        modalDel = document.getElementById('modal-confirmar-apagar-pasta');
    } else {
        modalDel.style.display = 'flex';
    }

    const btnConf = document.getElementById('btn-confirmar-apagar-pasta');
    const btnCanc = document.getElementById('btn-cancelar-apagar-pasta');
    
    const novoBtnConf = btnConf.cloneNode(true);
    const novoBtnCanc = btnCanc.cloneNode(true);
    btnConf.parentNode.replaceChild(novoBtnConf, btnConf);
    btnCanc.parentNode.replaceChild(novoBtnCanc, btnCanc);

    novoBtnCanc.addEventListener('click', () => { modalDel.style.display = 'none'; });
    novoBtnConf.addEventListener('click', () => { 
        modalDel.style.display = 'none'; 
        callbackExecucao(); 
    });
}

function renderizarNotificacoesAluno() {
    const viewNotificacoes = document.getElementById('view-aluno-notificacoes');
    if (!viewNotificacoes) return;

    // 1. DESLIGAR A CAIXA VELHA: Escondemos para os outros scripts brincarem no escuro
    const velhaCaixa = document.getElementById('aluno-notificacoes-container');
    if (velhaCaixa) velhaCaixa.style.display = 'none';

    // 2. CRIAR A NOSSA CAIXA BLINDADA (Com ID novo para o código antigo não a encontrar)
    let cont = document.getElementById('caixa-blindada-notificacoes');
    if (!cont) {
        cont = document.createElement('div');
        cont.id = 'caixa-blindada-notificacoes';
        cont.style.width = '100%';
        viewNotificacoes.appendChild(cont);
    }

    let todosItems = [];

    if (filtroAtualAluno === 'Todas') {
        todosItems = [...globalOcorrencias, ...globalAvisosVIP];
    } else if (filtroAtualAluno === 'Gamificação') {
        todosItems = globalOcorrencias.filter(o => o.tipo === 'positiva');
    } else if (filtroAtualAluno === 'Importantes') {
        todosItems = globalOcorrencias.filter(o => o.tipo === 'negativa');
    } else if (filtroAtualAluno === 'Escola') {
        let ocosEscola = globalOcorrencias.filter(o => o.tipo !== 'positiva' && o.tipo !== 'negativa');
        todosItems = [...ocosEscola, ...globalAvisosVIP];
    }

    todosItems.sort((a, b) => b._timestamp - a._timestamp);

    if (todosItems.length === 0) {
        cont.innerHTML = `<div style="text-align:center; padding: 40px 20px; opacity: 0.5;">
                            <i class="fa-solid fa-bell-slash" style="font-size: 3.5rem; margin-bottom: 15px; color: var(--text-muted);"></i>
                            <p style="font-size: 0.95rem; color: var(--text-muted);">Não tens notificações nesta categoria.</p>
                          </div>`;
        return;
    }

    let html = `
    <div style="display:flex; justify-content:flex-end; margin-bottom: 15px;">
        <button id="btn-limpar-pasta" style="background:transparent; border:none; color:var(--text-muted); cursor:pointer; font-size:0.85rem; display:flex; align-items:center; gap:5px; transition:0.2s;">
            <i class="fa-solid fa-trash-can"></i> Limpar Pasta
        </button>
    </div>`;

    todosItems.forEach(item => {
        const btnApagarHTML = `<button class="btn-apagar-item" data-id="${item.id}" data-source="${item._source}" style="background:none; border:none; color:var(--text-muted); cursor:pointer; font-size:1.1rem; padding:0; transition:0.2s;" title="Eliminar"><i class="fa-solid fa-xmark"></i></button>`;

        if (item._source === 'aviso_vip') {
            const dataTxt = item._timestamp ? new Date(item._timestamp).toLocaleString('pt-PT', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '';
            html += `
            <div class="card" style="border-left: 4px solid #9333ea; margin-bottom: 10px; background: linear-gradient(135deg, rgba(147, 51, 234, 0.10), rgba(0, 0, 0, 0.2)); border-radius: 8px; padding: 15px;">
                <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 8px;">
                    <h4 style="margin: 0; color: #9333ea; font-size: 1rem; display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-bullhorn"></i> ${item.titulo}</h4>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="font-size: 0.75rem; color: var(--text-muted);">${dataTxt}</span>
                        ${btnApagarHTML}
                    </div>
                </div>
                <p style="margin: 0; font-size: 0.9rem; color: var(--text-light); line-height: 1.4;">${item.mensagem}</p>
            </div>`;
        } 
        else if (item._source === 'ocorrencia') {
            const isPos = item.tipo === 'positiva';
            const isNeg = item.tipo === 'negativa';
            
            let cor = '#a855f7'; 
            let icone = 'fa-bullhorn';
            
            if (isPos) { cor = 'var(--primary-green)'; icone = 'fa-bolt'; }
            if (isNeg) { cor = 'var(--danger-red)'; icone = 'fa-triangle-exclamation'; }

            const xpTexto = item.xp ? (item.xp > 0 ? `+${item.xp} XP` : `${item.xp} XP`) : '';
            const titulo = item.titulo || 'Registo';
            const dataStr = item.data ? new Date(item.data).toLocaleString('pt-PT', {day:'2-digit', month:'2-digit', year:'numeric', hour:'2-digit', minute:'2-digit'}) : '';

            html += `
            <div style="background: rgba(255,255,255,0.02); border: 1px solid rgba(255,255,255,0.05); border-left: 4px solid ${cor}; border-radius: 8px; padding: 15px; margin-bottom: 10px;">
                <div style="display:flex; justify-content:space-between; margin-bottom: 8px;">
                    <strong style="color:${cor}; font-size:1rem; display:flex; align-items:center; gap:8px;">
                        <i class="fa-solid ${icone}"></i> ${titulo}
                        ${xpTexto ? `<span style="background:${cor}; color:black; font-size:0.7rem; padding:2px 6px; border-radius:10px;">${xpTexto}</span>` : ''}
                    </strong>
                    <div style="display:flex; align-items:center; gap:12px;">
                        <span style="color:var(--text-muted); font-size:0.75rem;">${dataStr}</span>
                        ${btnApagarHTML}
                    </div>
                </div>
                <p style="color: white; margin: 0 0 10px 0; font-size: 0.9rem; line-height: 1.4;">${item.descricao || item.texto || ''}</p>
                
                ${(!item.lidaAluno) ? `
                <div style="text-align: right; border-top: 1px solid rgba(255,255,255,0.05); padding-top: 10px; margin-top: 10px;">
                    <button class="btn-marcar-lida-aluno" data-id="${item.id}" style="background:transparent; border:1px solid ${cor}; color:${cor}; border-radius:6px; padding:6px 12px; font-size:0.8rem; cursor:pointer;"><i class="fa-solid fa-check"></i> Marcar como Lido</button>
                </div>` : ''}
            </div>`;
        }
    });

    cont.innerHTML = html;

    cont.querySelectorAll('.btn-marcar-lida-aluno').forEach(b => {
        b.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            e.currentTarget.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
            try { await setDoc(doc(db, "utilizadores", window.myUserId, "ocorrencias", id), { lidaAluno: true }, { merge: true }); } catch (err) {}
        });
    });

    cont.querySelectorAll('.btn-apagar-item').forEach(b => {
        b.addEventListener('click', async (e) => {
            const id = e.currentTarget.getAttribute('data-id');
            const source = e.currentTarget.getAttribute('data-source');
            
            const cartao = e.currentTarget.closest('div[style*="border-left"]');
            if (cartao) cartao.style.display = 'none';

            if (source === 'ocorrencia') {
                await setDoc(doc(db, "utilizadores", window.myUserId, "ocorrencias", id), { apagadaAluno: true }, { merge: true });
            } else {
                let apagados = JSON.parse(localStorage.getItem('avisos_apagados_aluno') || '[]');
                if (!apagados.includes(id)) apagados.push(id);
                localStorage.setItem('avisos_apagados_aluno', JSON.stringify(apagados));
                globalAvisosVIP = globalAvisosVIP.filter(a => a.id !== id);
                atualizarSinoERenderizar();
            }
        });
    });

    const btnLimpar = document.getElementById('btn-limpar-pasta');
    if (btnLimpar) {
        btnLimpar.addEventListener('click', () => {
            mostrarModalApagarPasta(async () => {
                btnLimpar.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A limpar...';
                
                for (const item of todosItems) {
                    if (item._source === 'ocorrencia') {
                        await setDoc(doc(db, "utilizadores", window.myUserId, "ocorrencias", item.id), { apagadaAluno: true }, { merge: true });
                    } else if (item._source === 'aviso_vip') {
                        let apagados = JSON.parse(localStorage.getItem('avisos_apagados_aluno') || '[]');
                        if (!apagados.includes(item.id)) apagados.push(item.id);
                        localStorage.setItem('avisos_apagados_aluno', JSON.stringify(apagados));
                        globalAvisosVIP = globalAvisosVIP.filter(a => a.id !== item.id);
                    }
                }
                atualizarSinoERenderizar();
            });
        });
    }
}

// CAPTURAR OS CLIQUES DE FORMA BLINDADA
document.body.addEventListener('click', (e) => {
    const btn = e.target.closest('.filter-chip');
    
    // SÓ reage se for um botão dentro da secção das notificações (ignora a Caderneta!)
    if (btn && btn.closest('#notificacoes-filtros')) {
        const txt = btn.innerText.trim();
        
        if (['Todas', 'Importantes', 'Escola', 'Gamificação'].includes(txt)) {
            btn.parentElement.querySelectorAll('.filter-chip').forEach(b => {
                b.classList.remove('active');
                b.style.background = 'var(--bg-dark)';
                b.style.color = 'var(--text-muted)';
                b.style.borderColor = '#333';
            });
            
            btn.classList.add('active');
            btn.style.background = 'var(--primary-green)';
            btn.style.color = 'black';
            btn.style.borderColor = 'var(--primary-green)';
            
            filtroAtualAluno = txt;
            renderizarNotificacoesAluno();
        }
    }

    if (e.target.closest('#btn-open-notificacoes')) {
        setTimeout(renderizarNotificacoesAluno, 150); 
    }

    // ==========================================
    // CLIQUE BLINDADO DO FCT / PAP (COM RENDERIZAÇÃO)
    // ==========================================
    if (e.target.closest('#btn-abrir-passaporte')) {
        document.querySelectorAll('.app-content > div:not(.modal-overlay)').forEach(d => d.style.display = 'none');
        const view = document.getElementById('view-aluno-passaporte');
        if (view) view.style.display = 'block';
        
        // Dispara a função global ou cria o conteúdo diretamente se a função não estiver no escopo global
        if (window.recarregarViewPassaporte) {
            window.recarregarViewPassaporte();
        } else {
            // Plano B: Se a função não estiver exposta globalmente, disparamos a lógica diretamente
            import("./modules/aluno-passaporte.js").then(m => {
                // Força o carregamento do dashboard através do módulo importado
                if (window.db && window.myUserId) {
                    import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js").then(async ({ doc, getDoc }) => {
                        const mMatch = window.minhaTurma ? window.minhaTurma.match(/\d+/) : null;
                        const ano = mMatch ? parseInt(mMatch[0]) : 12;
                        const snap = await getDoc(doc(window.db, "utilizadores", window.myUserId));
                        const dados = snap.exists() ? snap.data() : {};
                        
                        // Executa a função interna do passaporte se existir no objeto global
                        if (window.recarregarViewPassaporte) window.recarregarViewPassaporte();
                    });
                }
            });
        }
    }
});