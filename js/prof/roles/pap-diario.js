import { db } from "../../firebase.js";
import { collection, addDoc, getDocs, getDoc, doc, updateDoc, query, where, arrayUnion, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state, nomeCurto } from "../store.js";

// Estado local
let modalPresencaAtiva = true;
window.cofreAlunoAtual = [];
let sessoesDiarioMemoria = [];

// ==========================================
// FUNÇÕES UTILITÁRIAS
// ==========================================
function mostrarAlerta(msg, erro = true) {
    const cor = erro ? 'var(--danger-red)' : 'var(--success-green)';
    const div = document.createElement('div');
    div.style.cssText = `position:fixed; top:20px; left:50%; transform:translateX(-50%); background:${cor}; color:white; padding:12px 24px; border-radius:30px; font-size:0.9rem; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:10000; display:flex; align-items:center; gap:10px; opacity:0; transition: opacity 0.3s ease;`;
    div.innerHTML = `<i class="fa-solid ${erro ? 'fa-triangle-exclamation' : 'fa-check'}"></i> ${msg}`;
    document.body.appendChild(div);
    requestAnimationFrame(() => div.style.opacity = '1');
    setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 3000);
}

function base64ToBlobUrl(base64, mimeType) {
    try {
        const byteString = atob(base64.split(',')[1]);
        const ab = new ArrayBuffer(byteString.length);
        const ia = new Uint8Array(ab);
        for (let i = 0; i < byteString.length; i++) { ia[i] = byteString.charCodeAt(i); }
        const blob = new Blob([ab], { type: mimeType });
        return URL.createObjectURL(blob);
    } catch (e) { return base64; }
}

// ==========================================
// ECRÃ DE ORIENTANDOS
// ==========================================
export async function carregarEcraOrientandos() {
    const listaMeus = document.getElementById('lista-meus-orientandos');
    const listaRestantes = document.getElementById('lista-restantes-alunos-pap');

    if (!listaMeus || !listaRestantes) return;

    listaMeus.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar os teus orientandos...</p>';
    listaRestantes.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A ler dados dos colegas...</p>';

    try {
        let todosAlunos12 = [];
        if (state.turmasProfessor) {
            for (const t of state.turmasProfessor) {
                const ano = parseInt(t.match(/\d+/)?.[0]) || 10;
                if (ano === 12) {
                    const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                    snap.forEach(d => todosAlunos12.push({ id: d.id, ...d.data() }));
                }
            }
        }

        let htmlMeus = '';
        let htmlRestantes = '';

        todosAlunos12.forEach(al => {
            const tema = (al.pap && al.pap.tema) ? al.pap.tema : 'Tema não definido';
            const orientador = (al.pap && al.pap.orientador) ? al.pap.orientador : 'Sem orientador';
            const isMeuOrientando = (orientador === state.myUserName || orientador === state.myUserId);

            if (isMeuOrientando) {
                // Sincronização Lógica Coordenador <-> Orientador (Adeus NaN%)
                const fasesTotais = 5;
                let fasesConcluidas = 0;

                if (al.pap?.fases) {
                    fasesConcluidas = Object.values(al.pap.fases).filter(Boolean).length;
                } else {
                    if (al.pap?.faseTema) fasesConcluidas++;
                    if (al.pap?.faseAprovacao) fasesConcluidas++;
                    if (al.pap?.faseDesenvolvimento) fasesConcluidas++;
                    if (al.pap?.faseRelatorio) fasesConcluidas++;
                    if (al.pap?.faseApresentacao) fasesConcluidas++;
                }

                const percProgresso = Math.min(Math.round((fasesConcluidas / fasesTotais) * 100), 100) || 0;
                const faseAtualLegada = (al.pap && al.pap.faseAtual) ? parseInt(al.pap.faseAtual) || 0 : 0;

                // Layout Corrigido à prova de temas longos
                htmlMeus += `
                <div class="card" style="border-left: 4px solid var(--success-green); padding: 15px; margin-bottom: 12px; display:flex; flex-direction:column; gap:12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="flex:1; padding-right:10px; min-width:0;">
                            <strong style="color:white; font-size:1.1rem;">${nomeCurto(al.nome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span></strong>
                            <div style="color:var(--text-light); font-size:0.85rem; margin-top:5px; line-height:1.4; word-wrap:break-word;"><strong>Tema:</strong> <span style="color:white;">${tema}</span></div>
                        </div>
                        <img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:40px; height:40px; border-radius:50%; object-fit:cover; flex-shrink:0;">
                    </div>
                    
                    <div>
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Progresso da PAP:</span>
                            <span style="font-size: 0.75rem; color: var(--success-green); font-weight:bold;">${percProgresso}%</span>
                        </div>
                        <div style="height: 6px; width:100%; background: #333; border-radius: 3px; overflow:hidden;">
                            <div style="height: 100%; width: ${percProgresso}%; background: var(--success-green); transition:0.3s;"></div>
                        </div>
                    </div>
                    
                    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:8px;">
                        <button class="secondary-btn small-btn" onclick="window.abrirModalFasesPAP('${al.id}', ${faseAtualLegada})" style="border-color:#0099ff; color:#0099ff; padding: 12px 4px; font-size: 0.8rem;"><i class="fa-solid fa-bars-progress"></i> Fases</button>
                        <button class="secondary-btn small-btn" onclick="window.abrirModalCofrePAP('${al.id}', '${nomeCurto(al.nome)}')" style="border-color:var(--primary-green); color:var(--primary-green); padding: 12px 4px; font-size: 0.8rem;"><i class="fa-solid fa-vault"></i> Cofre</button>
                        <button class="secondary-btn small-btn" onclick="window.abrirModalObservatorioPAP('${al.id}', '${nomeCurto(al.nome)}')" style="border-color:var(--warning-yellow); color:var(--warning-yellow); padding: 12px 4px; font-size: 0.8rem;"><i class="fa-solid fa-eye"></i> Observar</button>
                        <button class="secondary-btn small-btn" style="border-color: #3b82f6; color: #3b82f6; padding: 12px 4px; font-size: 0.8rem;" onclick="window.abrirChatDiretoAluno('${al.id}', '${nomeCurto(al.nome)}')">
                            <i class="fa-regular fa-comments"></i> Mensagem
                        </button>
                    </div>
                </div>`;
            } else {
                htmlRestantes += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border:1px solid #333; opacity:0.8; margin-bottom:8px;">
                    <div style="flex:1; min-width:0; padding-right:10px;">
                        <strong style="color:white; font-size:0.9rem;">${nomeCurto(al.nome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span></strong>
                        <div style="font-size:0.75rem; color:var(--text-light); word-wrap:break-word; margin-top:2px;">Tema: ${tema}</div>
                    </div>
                    <div style="text-align:right; flex-shrink:0;">
                        <span style="font-size:0.7rem; color:var(--text-muted);">Orientador</span><br>
                        <strong style="font-size:0.8rem; color:white;">${nomeCurto(orientador)}</strong>
                    </div>
                </div>`;
            }
        });

        listaMeus.innerHTML = htmlMeus === '' ? '<p class="text-muted center">Não tens alunos sob a tua orientação direta.</p>' : htmlMeus;
        listaRestantes.innerHTML = htmlRestantes === '' ? '<p class="text-muted center">Não há outros alunos de 12º ano.</p>' : htmlRestantes;

    } catch (err) {
        console.error(err);
        listaMeus.innerHTML = '<p class="text-danger center">Erro ao carregar orientandos.</p>';
    }
}

// ==========================================
// FUNÇÕES DE GESTÃO DA PAP (Modais Dinâmicos)
// ==========================================

// 1. GESTÃO DE FASES
window.abrirModalFasesPAP = function (alunoId, faseAtual) {
    const bg = document.createElement('div');
    bg.className = 'modal-overlay'; bg.style.display = 'flex'; bg.style.zIndex = '10000';
    bg.innerHTML = `
        <div class="action-sheet" style="max-width:400px; padding:20px; animation: fadeSlide 0.3s ease;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="color:#0099ff; margin:0;"><i class="fa-solid fa-bars-progress"></i> Atualizar Fase</h3>
                <button class="close-dyn-modal" style="background:none; border:none; color:white; font-size:1.3rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">A barra de progresso no telemóvel do aluno será atualizada imediatamente.</p>
            <select id="sel-fase-pap" class="input-padrao" style="width:100%; margin-bottom:15px;">
                <option value="0" ${faseAtual === 0 ? 'selected' : ''}>0% - Definição do Tema</option>
                <option value="1" ${faseAtual === 1 ? 'selected' : ''}>25% - Aprovação do Anteprojeto</option>
                <option value="2" ${faseAtual === 2 ? 'selected' : ''}>50% - Desenvolvimento Prático</option>
                <option value="3" ${faseAtual === 3 ? 'selected' : ''}>75% - Escrita do Relatório Final</option>
                <option value="4" ${faseAtual === 4 ? 'selected' : ''}>100% - Preparação para a Apresentação</option>
            </select>
            <button class="primary-btn" style="width:100%; background:#0099ff;" onclick="window.guardarFasePAP('${alunoId}', this)">Atualizar Progresso</button>
        </div>`;
    document.body.appendChild(bg);
    bg.querySelector('.close-dyn-modal').onclick = () => bg.remove();
};

window.guardarFasePAP = async function (alunoId, btn) {
    const novaFase = Number(document.getElementById('sel-fase-pap').value);
    const originalHTML = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
    try {
        // Sincroniza a barra do Orientador (0-4) com as caixas do Coordenador (Booleans)
        const updateData = {
            "pap.faseAtual": novaFase,
            "pap.faseTema": novaFase >= 1,
            "pap.faseAprovacao": novaFase >= 1,
            "pap.faseDesenvolvimento": novaFase >= 2,
            "pap.faseRelatorio": novaFase >= 3,
            "pap.faseApresentacao": novaFase >= 4,
            "pap.temaAprovado": novaFase >= 1,
            "pap.relatorioAprovado": novaFase >= 3
        };

        await updateDoc(doc(db, "utilizadores", alunoId), updateData);
        mostrarAlerta("Progresso atualizado com sucesso!", false);
        document.querySelector('.modal-overlay:last-child').remove();
        carregarEcraOrientandos();
    } catch (e) {
        mostrarAlerta("Erro ao atualizar a fase.");
        btn.innerHTML = originalHTML;
        btn.disabled = false;
    }
};

// 2. VISUALIZADOR DO COFRE
window.abrirModalCofrePAP = async function (alunoId, alunoNome) {
    const bg = document.createElement('div');
    bg.className = 'modal-overlay'; bg.style.display = 'flex'; bg.style.zIndex = '10000';
    bg.innerHTML = `
        <div class="action-sheet" style="max-width:500px; padding:20px; animation: fadeSlide 0.3s ease; max-height:85vh; display:flex; flex-direction:column;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="color:var(--primary-green); margin:0;"><i class="fa-solid fa-vault"></i> Cofre de ${alunoNome}</h3>
                <button class="close-dyn-modal" style="background:none; border:none; color:white; font-size:1.3rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div id="lista-cofre-dinamica" style="flex:1; overflow-y:auto; padding-right:5px;">
                <p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A abrir o cofre...</p>
            </div>
        </div>`;
    document.body.appendChild(bg);
    bg.querySelector('.close-dyn-modal').onclick = () => bg.remove();

    try {
        const snap = await getDoc(doc(db, "utilizadores", alunoId));
        window.cofreAlunoAtual = snap.exists() ? (snap.data().pap?.cofre || []) : [];
        let html = '';
        if (window.cofreAlunoAtual.length === 0) { html = '<p class="text-muted center">O aluno ainda não submeteu nenhum documento.</p>'; }
        else {
            window.cofreAlunoAtual.forEach((f, idx) => {
                html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); border-left:3px solid var(--primary-green); padding:10px; border-radius:6px; margin-bottom:10px;">
                            <div style="flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; margin-right:10px;">
                                <strong style="color:white; font-size:0.9rem;">${f.nome}</strong><br>
                                <span style="font-size:0.75rem; color:var(--text-muted);">${f.data}</span>
                            </div>
                            <button onclick="window.verDocCofreProf(${idx})" class="secondary-btn small-btn" style="padding:6px 12px; color:var(--primary-green); border-color:var(--primary-green);"><i class="fa-solid fa-download"></i></button>
                         </div>`;
            });
        }
        document.getElementById('lista-cofre-dinamica').innerHTML = html;
    } catch (e) { document.getElementById('lista-cofre-dinamica').innerHTML = '<p class="text-danger center">Erro ao ler o cofre.</p>'; }
};

window.verDocCofreProf = function (index) {
    const f = window.cofreAlunoAtual[index]; if (!f) return;
    if (f.base64.startsWith("data:image")) {
        const bg = document.createElement('div');
        bg.className = 'modal-overlay'; bg.style.display = 'flex'; bg.style.zIndex = '10001';
        bg.innerHTML = `<div class="action-sheet" style="width:95%; max-width:800px; padding:15px;"><div style="display:flex; justify-content:flex-end; margin-bottom:10px;"><button class="close-img-modal" style="background:none; border:none; color:white; font-size:1.5rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button></div><img src="${f.base64}" style="width:100%; max-height:70vh; object-fit:contain; border-radius:8px;"></div>`;
        document.body.appendChild(bg); bg.querySelector('.close-img-modal').onclick = () => bg.remove();
    } else {
        mostrarAlerta("A preparar a transferência do documento...", false);
        const a = document.createElement("a"); a.href = f.base64; a.download = f.nome;
        document.body.appendChild(a); a.click(); document.body.removeChild(a);
    }
};

// 3. OBSERVATÓRIO DO ORIENTADOR
window.abrirModalObservatorioPAP = function (alunoId, alunoNome) {
    const bg = document.createElement('div');
    bg.className = 'modal-overlay'; bg.style.display = 'flex'; bg.style.zIndex = '10000';
    bg.innerHTML = `
        <div class="action-sheet" style="max-width:400px; padding:20px; animation: fadeSlide 0.3s ease;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                <h3 style="color:var(--warning-yellow); margin:0;"><i class="fa-solid fa-eye"></i> Observatório</h3>
                <button class="close-dyn-modal" style="background:none; border:none; color:white; font-size:1.3rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">Escreve uma nota, retificação ou aviso. Esta mensagem aparecerá diretamente na área de projeto do ${alunoNome}.</p>
            <textarea id="txt-observacao-pap" class="input-padrao" placeholder="Escreve aqui a tua observação..." style="width:100%; min-height:100px; margin-bottom:15px;"></textarea>
            <button class="primary-btn" style="width:100%; background:var(--warning-yellow); color:black;" onclick="window.guardarObservacaoPAP('${alunoId}', this)">Afixar Observação</button>
        </div>`;
    document.body.appendChild(bg);
    bg.querySelector('.close-dyn-modal').onclick = () => bg.remove();
};

window.guardarObservacaoPAP = async function (alunoId, btn) {
    const texto = document.getElementById('txt-observacao-pap').value.trim();
    if (!texto) { mostrarAlerta("Escreve algo antes de gravar!"); return; }

    const originalHTML = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
    try {
        const novaObs = { autor: state.myUserName, data: new Date().toLocaleDateString('pt-PT'), texto: texto };
        await updateDoc(doc(db, "utilizadores", alunoId), { "pap.observatorio": arrayUnion(novaObs) });
        mostrarAlerta("Observação afixada com sucesso!", false);
        document.querySelector('.modal-overlay:last-child').remove();
    } catch (e) { mostrarAlerta("Erro ao afixar observação."); btn.innerHTML = originalHTML; btn.disabled = false; }
};

// ========================================================
// 1. CARREGAR E RENDERIZAR O DIÁRIO COM FILTROS
// ========================================================
export async function carregarEcraDiario() {
    const container = document.getElementById('lista-sessoes-diario');
    if (!container) return;

    container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A ler diários de sessões...</p>';

    try {
        sessoesDiarioMemoria = [];
        let orientadoresUnicos = new Set();
        let alunosUnicos = new Map();

        // LER TODAS AS TURMAS DO PROFESSOR (Elimina a necessidade de escolher no topo)
        if (state.turmasProfessor && state.turmasProfessor.length > 0) {
            for (const t of state.turmasProfessor) {
                const q = query(collection(db, "turmas", t, "pap_sessoes"), orderBy("timestamp", "desc"));
                const snap = await getDocs(q);
                
                snap.forEach(doc => {
                    const sessao = doc.data();
                    sessoesDiarioMemoria.push({ id: doc.id, turma: t, ...sessao });
                    orientadoresUnicos.add(sessao.orientador);
                    
                    if (sessao.alunos) {
                        sessao.alunos.forEach(al => alunosUnicos.set(al.id, al.nome));
                    }
                });
            }
        }

        // Ordenar tudo globalmente por data
        sessoesDiarioMemoria.sort((a, b) => b.timestamp - a.timestamp);

        // Preencher as Caixas de Filtros
        const selOrientador = document.getElementById('filtro-diario-orientador');
        const selAluno = document.getElementById('filtro-diario-aluno');
        
        // Mantém as seleções atuais se o utilizador já tiver escolhido algo
        const currOrientador = selOrientador ? selOrientador.value : 'todos';
        const currAluno = selAluno ? selAluno.value : 'todos';

        if (selOrientador) {
            selOrientador.innerHTML = '<option value="todos">Todos os Orientadores</option>' + 
                Array.from(orientadoresUnicos).sort().map(o => `<option value="${o}">${o}</option>`).join('');
            selOrientador.value = Array.from(selOrientador.options).some(o => o.value === currOrientador) ? currOrientador : 'todos';
        }
            
        if (selAluno) {
            selAluno.innerHTML = '<option value="todos">Todos os Alunos</option>' + 
                Array.from(alunosUnicos).sort((a,b) => a[1].localeCompare(b[1])).map(a => `<option value="${a[0]}">${nomeCurto(a[1])}</option>`).join('');
            selAluno.value = Array.from(selAluno.options).some(o => o.value === currAluno) ? currAluno : 'todos';
        }

        // Renderiza a lista consoante os filtros aplicados
        window.renderizarListaSessoes();

    } catch (err) {
        console.error("Erro ao carregar diário: ", err);
        container.innerHTML = '<p class="text-danger center">Erro a carregar registos.</p>';
    }
}

// O Motor que filtra e desenha os cartões
window.renderizarListaSessoes = function() {
    const container = document.getElementById('lista-sessoes-diario');
    const fOrientador = document.getElementById('filtro-diario-orientador') ? document.getElementById('filtro-diario-orientador').value : 'todos';
    const fAluno = document.getElementById('filtro-diario-aluno') ? document.getElementById('filtro-diario-aluno').value : 'todos';

    let filtradas = sessoesDiarioMemoria.filter(s => {
        let orientadorOk = (fOrientador === 'todos' || s.orientador === fOrientador);
        let alunoOk = (fAluno === 'todos' || (s.alunos && s.alunos.some(a => a.id === fAluno)));
        return orientadorOk && alunoOk;
    });

    if (filtradas.length === 0) {
        container.innerHTML = '<div class="empty-state" style="text-align:center; padding: 20px;"><i class="fa-solid fa-folder-open empty-state-icon" style="font-size:3rem; margin-bottom:10px; color:var(--text-muted);"></i><div class="empty-state-title" style="color:white; font-size:1.1rem;">Nenhum Registo</div><div class="empty-state-desc" style="color:var(--text-muted); font-size:0.85rem;">Ainda não existem sessões registadas para estes filtros.</div></div>';
        return;
    }

    let html = '';
    filtradas.forEach(s => {
        const dataFormatada = s.data.split('-').reverse().join('/');
        
        let tagsAlunos = '';
        if (s.alunos && s.alunos.length > 0) {
            tagsAlunos = s.alunos.map(a => `
                <span style="display:inline-block; font-size:0.75rem; color:var(--text-light); background:rgba(255,255,255,0.05); padding:4px 8px; border-radius:12px; margin-right:5px; margin-bottom:5px; border:1px solid #444;">
                    <i class="fa-solid fa-user" style="color:var(--text-muted); margin-right:4px;"></i>${nomeCurto(a.nome)} 
                    <strong style="color:var(--success-green); margin-left:4px;">${a.horas}h</strong>
                </span>
            `).join('');
        }

        // NOVO: Renderiza os botões apenas se a sessão for tua
        const isOwner = (s.orientador === state.myUserName);
        const acoesHtml = isOwner ? `
            <div style="display:flex; gap:8px;">
                <button class="secondary-btn small-btn" onclick="window.editarSessaoPAP('${s.id}')" style="padding:4px 8px; border-color:#0099ff; color:#0099ff;"><i class="fa-solid fa-pen"></i></button>
                <button class="secondary-btn small-btn" onclick="window.apagarSessaoPAP('${s.id}', '${s.turma}')" style="padding:4px 8px; border-color:var(--danger-red); color:var(--danger-red);"><i class="fa-solid fa-trash"></i></button>
            </div>
        ` : '';

        html += `
        <div class="card" style="border-left: 4px solid var(--success-green); margin-bottom: 12px; padding: 15px;">
            <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                <div>
                    <strong style="color:white; font-size:1.05rem;"><i class="fa-regular fa-calendar-check" style="color:var(--success-green); margin-right:6px;"></i> Sessão a ${dataFormatada}</strong>
                    <div style="font-size:0.8rem; color:var(--text-muted); margin-top:4px;">Orientador: <strong style="color:var(--primary-green);">${s.orientador}</strong></div>
                </div>
                ${acoesHtml}
            </div>
            <div style="border-top:1px dashed #444; padding-top:10px;">
                <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:8px; text-transform:uppercase; font-weight:bold;">Alunos Presentes</span>
                <div>${tagsAlunos || '<span style="font-size:0.8rem; color:#888;">Sem alunos marcados.</span>'}</div>
            </div>
        </div>`;
    });

    container.innerHTML = html;
};

// ========================================================
// 2. PREPARAR O MODAL DE NOVA SESSÃO E FUNÇÕES DE EDIÇÃO
// ========================================================
export async function prepararModalNovaSessao() {
    // Reset para modo "Nova Sessão"
    document.getElementById('pap-sessao-edit-id').value = '';
    document.getElementById('pap-sessao-edit-turma').value = '';
    const tituloModal = document.getElementById('pap-sessao-modal-title');
    if(tituloModal) tituloModal.innerHTML = '<i class="fa-solid fa-calendar-plus"></i> Registar Sessão PAP';

    document.getElementById('pap-sessao-data').value = new Date().toISOString().split('T')[0];
    const listaAlunos = document.getElementById('pap-sessao-alunos-lista');
    
    listaAlunos.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A procurar alunos...</p>';
    document.getElementById('modal-nova-sessao-pap').style.display = 'flex';

    try {
        let arr = [];
        if (state.turmasProfessor && state.turmasProfessor.length > 0) {
            for (const t of state.turmasProfessor) {
                const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                snap.forEach(d => { arr.push({ id: d.id, ...d.data() }); });
            }
        }
        arr.sort((a, b) => a.nome.localeCompare(b.nome));

        let html = '';
        arr.forEach(d => {
            const isMeuOrientando = (d.pap && (d.pap.orientador === state.myUserName || d.pap.orientador === state.myUserId));
            const fontColor = isMeuOrientando ? 'var(--success-green)' : 'white';
            const fontWeight = isMeuOrientando ? 'bold' : 'normal';
            const estrela = isMeuOrientando ? '<i class="fa-solid fa-star" style="color:var(--warning-yellow); font-size:0.7rem; margin-left:5px;" title="Teu Orientando"></i>' : '';

            html += `
            <div class="row-aluno-sessao" style="display:flex; justify-content:space-between; align-items:center; background:rgba(255,255,255,0.03); border:1px solid #444; padding:8px 12px; border-radius:6px; transition:0.2s; margin-bottom:8px;">
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer; flex:1;">
                    <input type="checkbox" class="check-aluno-sessao" value="${d.id}" data-nome="${d.nome}" data-turma="${d.turma}" style="width:18px; height:18px; accent-color:var(--success-green); margin:0;">
                    <span style="color:${fontColor}; font-weight:${fontWeight}; font-size:0.9rem;">${nomeCurto(d.nome)} ${estrela} <span style="font-size:0.7rem; color:var(--text-muted); font-weight:normal;">(${d.turma})</span></span>
                </label>
                <select class="select-horas-sessao input-padrao" disabled style="width: auto; padding: 4px 8px; font-size: 0.85rem; margin: 0; background-color: rgba(0,0,0,0.5); border-color: #444;">
                    <option value="1">1 Hora</option>
                    <option value="2">2 Horas</option>
                    <option value="3">3 Horas</option>
                    <option value="4" selected>4 Horas</option>
                </select>
            </div>`;
        });
        
        listaAlunos.innerHTML = html === '' ? '<p class="text-muted center" style="margin-top:10px;">Não há alunos registados nas tuas turmas.</p>' : html;
    } catch (e) {
        listaAlunos.innerHTML = '<p class="text-danger center">Erro a carregar alunos.</p>';
    }
}

window.editarSessaoPAP = async function(sessaoId) {
    const sessao = sessoesDiarioMemoria.find(s => s.id === sessaoId);
    if (!sessao) return;

    // Configura o modal para modo de "Edição"
    document.getElementById('pap-sessao-edit-id').value = sessao.id;
    document.getElementById('pap-sessao-edit-turma').value = sessao.turma;
    document.getElementById('pap-sessao-data').value = sessao.data;
    
    const tituloModal = document.getElementById('pap-sessao-modal-title');
    if(tituloModal) tituloModal.innerHTML = '<i class="fa-solid fa-pen"></i> Editar Sessão PAP';

    const listaAlunos = document.getElementById('pap-sessao-alunos-lista');
    listaAlunos.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar dados...</p>';
    document.getElementById('modal-nova-sessao-pap').style.display = 'flex';

    try {
        let arr = [];
        if (state.turmasProfessor && state.turmasProfessor.length > 0) {
            for (const t of state.turmasProfessor) {
                const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                snap.forEach(d => { arr.push({ id: d.id, ...d.data() }); });
            }
        }
        arr.sort((a, b) => a.nome.localeCompare(b.nome));

        let html = '';
        arr.forEach(d => {
            const isMeuOrientando = (d.pap && (d.pap.orientador === state.myUserName || d.pap.orientador === state.myUserId));
            const fontColor = isMeuOrientando ? 'var(--success-green)' : 'white';
            const fontWeight = isMeuOrientando ? 'bold' : 'normal';
            const estrela = isMeuOrientando ? '<i class="fa-solid fa-star" style="color:var(--warning-yellow); font-size:0.7rem; margin-left:5px;"></i>' : '';

            // Verifica se o aluno estava presente nesta sessão
            const alunoSessao = sessao.alunos ? sessao.alunos.find(a => a.id === d.id) : null;
            const isChecked = alunoSessao ? 'checked' : '';
            const horasValue = alunoSessao ? alunoSessao.horas : 4;
            const selectDisabled = alunoSessao ? '' : 'disabled';
            const rowStyle = alunoSessao ? 'border-color: var(--success-green); background: rgba(16, 185, 129, 0.1);' : 'border-color: #444; background: rgba(255,255,255,0.03);';
            const selectStyle = alunoSessao ? 'background-color: #222; color: white;' : 'background-color: rgba(0,0,0,0.5); color: var(--text-muted); border-color: #444;';

            html += `
            <div class="row-aluno-sessao" style="display:flex; justify-content:space-between; align-items:center; padding:8px 12px; border-radius:6px; transition:0.2s; margin-bottom:8px; border: 1px solid; ${rowStyle}">
                <label style="display:flex; align-items:center; gap:10px; cursor:pointer; flex:1;">
                    <input type="checkbox" class="check-aluno-sessao" value="${d.id}" data-nome="${d.nome}" data-turma="${d.turma}" ${isChecked} style="width:18px; height:18px; accent-color:var(--success-green); margin:0;">
                    <span style="color:${fontColor}; font-weight:${fontWeight}; font-size:0.9rem;">${nomeCurto(d.nome)} ${estrela} <span style="font-size:0.7rem; color:var(--text-muted); font-weight:normal;">(${d.turma})</span></span>
                </label>
                <select class="select-horas-sessao input-padrao" ${selectDisabled} style="width: auto; padding: 4px 8px; font-size: 0.85rem; margin: 0; ${selectStyle}">
                    <option value="1" ${horasValue == 1 ? 'selected' : ''}>1 Hora</option>
                    <option value="2" ${horasValue == 2 ? 'selected' : ''}>2 Horas</option>
                    <option value="3" ${horasValue == 3 ? 'selected' : ''}>3 Horas</option>
                    <option value="4" ${horasValue == 4 ? 'selected' : ''}>4 Horas</option>
                </select>
            </div>`;
        });
        
        listaAlunos.innerHTML = html === '' ? '<p class="text-muted center">Não há alunos registados.</p>' : html;
    } catch (e) {
        listaAlunos.innerHTML = '<p class="text-danger center">Erro a carregar alunos.</p>';
    }
};

window.apagarSessaoPAP = async function(sessaoId, turma) {
    if(!confirm("Tens a certeza que queres eliminar esta sessão do diário? A ação é irreversível.")) return;
    
    try {
        const { deleteDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
        await deleteDoc(doc(db, "turmas", turma, "pap_sessoes", sessaoId));
        carregarEcraDiario(); // Recarrega o diário no ecrã
    } catch(e) {
        console.error(e);
        alert("Erro ao eliminar a sessão da base de dados.");
    }
};

// ========================================================
// 3. EVENT LISTENERS GLOBAIS DESTE MÓDULO
// ========================================================

// Ativar/Desativar as horas conforme se clica no aluno
document.body.addEventListener('change', (e) => {
    // Filtros do Diário
    if (e.target.id === 'filtro-diario-orientador' || e.target.id === 'filtro-diario-aluno') {
        if(typeof window.renderizarListaSessoes === 'function') window.renderizarListaSessoes();
    }

    // Checkbox dos Alunos na Nova Sessão
    if (e.target.classList.contains('check-aluno-sessao')) {
        const row = e.target.closest('.row-aluno-sessao');
        const selectBox = row.querySelector('.select-horas-sessao');
        
        if (e.target.checked) {
            selectBox.disabled = false;
            row.style.borderColor = 'var(--success-green)';
            row.style.background = 'rgba(16, 185, 129, 0.1)';
            selectBox.style.background = '#222';
            selectBox.style.color = 'white';
        } else {
            selectBox.disabled = true;
            row.style.borderColor = '#444';
            row.style.background = 'rgba(255,255,255,0.03)';
            selectBox.style.background = 'rgba(0,0,0,0.5)';
            selectBox.style.color = 'var(--text-muted)';
        }
    }
});

// Botão de Gravar a Sessão
document.body.addEventListener('click', async (e) => {
    if (e.target.closest('#btn-gravar-sessao-pap')) {
        const btn = e.target.closest('#btn-gravar-sessao-pap');
        const dataSessao = document.getElementById('pap-sessao-data').value;
        const editId = document.getElementById('pap-sessao-edit-id').value;
        const editTurma = document.getElementById('pap-sessao-edit-turma').value;
        
        let alunosPresentes = [];
        let turmaDaSessao = editTurma || null;

        document.querySelectorAll('.check-aluno-sessao:checked').forEach(chk => {
            const row = chk.closest('.row-aluno-sessao');
            const selectHoras = row.querySelector('.select-horas-sessao');
            
            // Vamos guardar na turma do 1º aluno selecionado se não estivermos a editar
            if (!turmaDaSessao) turmaDaSessao = chk.getAttribute('data-turma'); 

            alunosPresentes.push({
                id: chk.value,
                nome: chk.getAttribute('data-nome'),
                horas: parseInt(selectHoras.value) || 4
            });
        });

        if (!dataSessao) return alert("Preenche a data da sessão.");
        if (alunosPresentes.length === 0) return alert("Tens de selecionar pelo menos um aluno que esteve presente na sessão.");

        const txtOriginal = btn.innerHTML;
        btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A gravar...';
        btn.disabled = true;

        try {
            if (editId) {
                // MODO EDIÇÃO
                const { updateDoc, doc } = await import("https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js");
                await updateDoc(doc(db, "turmas", turmaDaSessao, "pap_sessoes", editId), {
                    data: dataSessao,
                    alunos: alunosPresentes
                });
            } else {
                // MODO NOVA SESSÃO
                await addDoc(collection(db, "turmas", turmaDaSessao, "pap_sessoes"), {
                    data: dataSessao,
                    orientador: state.myUserName,
                    alunos: alunosPresentes,
                    timestamp: Date.now()
                });
            }

            btn.innerHTML = '<i class="fa-solid fa-check"></i> Sessão Guardada!';
            carregarEcraDiario(); // Atualiza o ecrã no fundo

            setTimeout(() => {
                btn.innerHTML = txtOriginal;
                btn.disabled = false;
                document.getElementById('modal-nova-sessao-pap').style.display = 'none';
            }, 1500);

        } catch (err) {
            console.error("Erro a gravar sessão:", err);
            btn.innerHTML = 'Erro ao gravar!';
            setTimeout(() => { btn.innerHTML = txtOriginal; btn.disabled = false; }, 2000);
        }
    }
});