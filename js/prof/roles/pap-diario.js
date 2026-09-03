import { db } from "../../firebase.js";
import { collection, addDoc, getDocs, getDoc, doc, updateDoc, query, where, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state, nomeCurto } from "../store.js";

// Estado local
let modalPresencaAtiva = true; 
window.cofreAlunoAtual = []; // Guarda os ficheiros do aluno que estamos a inspecionar

// ==========================================
// FUNÇÕES UTILITÁRIAS (Modais dinâmicos)
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
    } catch(e) { return base64; }
}

// ==========================================
// ECRÃ DE ORIENTANDOS
// ==========================================
export async function carregarEcraOrientandos() {
    const listaMeus = document.getElementById('lista-meus-orientandos');
    const listaRestantes = document.getElementById('lista-restantes-alunos-pap');
    
    listaMeus.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar os teus orientandos...</p>';
    listaRestantes.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A ler dados dos colegas...</p>';

    try {
        let todosAlunos12 = [];
        for (const t of state.turmasProfessor) {
            const ano = parseInt(t.match(/\d+/)?.[0]) || 10;
            if (ano === 12) {
                const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                snap.forEach(d => todosAlunos12.push({ id: d.id, ...d.data() }));
            }
        }

        let htmlMeus = '';
        let htmlRestantes = '';

        todosAlunos12.forEach(al => {
            const tema = (al.pap && al.pap.tema) ? al.pap.tema : 'Tema não definido';
            const orientador = (al.pap && al.pap.orientador) ? al.pap.orientador : 'Sem orientador';
            const faseAtual = (al.pap && al.pap.faseAtual) ? al.pap.faseAtual : 0;
            
            const isMeuOrientando = (orientador === state.myUserName || orientador === state.myUserId);

            if (isMeuOrientando) {
                const percProgresso = (faseAtual / 4) * 100;
                
                htmlMeus += `
                <div class="card" style="border-left: 4px solid var(--success-green); padding: 15px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 10px;">
                        <div style="flex:1; padding-right:10px;">
                            <strong style="color:white; font-size:1.1rem;">${nomeCurto(al.nome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span></strong>
                            <div style="color:var(--text-light); font-size:0.85rem; margin-top:5px; line-height:1.4;"><strong>Tema:</strong> ${tema}</div>
                        </div>
                        <img src="${al.fotoPerfil || `https://ui-avatars.com/api/?name=${al.nome.split(' ')[0]}&background=333&color=fff`}" style="width:40px; height:40px; border-radius:50%; object-fit:cover;">
                    </div>
                    
                    <div style="margin-top: 15px; margin-bottom: 15px;">
                        <div style="display:flex; justify-content:space-between; margin-bottom:5px;">
                            <span style="font-size: 0.75rem; color: var(--text-muted);">Progresso da PAP:</span>
                            <span style="font-size: 0.75rem; color: var(--success-green); font-weight:bold;">${percProgresso}%</span>
                        </div>
                        <div style="height: 6px; width:100%; background: #333; border-radius: 3px; overflow:hidden;">
                            <div style="height: 100%; width: ${percProgresso}%; background: var(--success-green); transition:0.3s;"></div>
                        </div>
                    </div>
                    
                    <div style="display:flex; gap:8px; margin-top:10px; flex-wrap:wrap;">
                        <button class="secondary-btn small-btn" onclick="window.abrirModalFasesPAP('${al.id}', ${faseAtual})" style="flex:1; min-width:80px; border-color:#0099ff; color:#0099ff;"><i class="fa-solid fa-bars-progress"></i> Fases</button>
                        <button class="secondary-btn small-btn" onclick="window.abrirModalCofrePAP('${al.id}', '${nomeCurto(al.nome)}')" style="flex:1; min-width:80px; border-color:var(--primary-green); color:var(--primary-green);"><i class="fa-solid fa-vault"></i> Cofre</button>
                        <button class="secondary-btn small-btn" onclick="window.abrirModalObservatorioPAP('${al.id}', '${nomeCurto(al.nome)}')" style="flex:1; min-width:90px; border-color:var(--warning-yellow); color:var(--warning-yellow);"><i class="fa-solid fa-eye"></i> Observar</button>
                    </div>
                </div>`;
            } else {
                htmlRestantes += `
                <div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px; border-radius:8px; border:1px solid #333; opacity:0.8;">
                    <div>
                        <strong style="color:white; font-size:0.9rem;">${nomeCurto(al.nome)} <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span></strong><br>
                        <span style="font-size:0.75rem; color:var(--text-light);">Tema: ${tema}</span>
                    </div>
                    <div style="text-align:right;">
                        <span style="font-size:0.7rem; color:var(--text-muted);">Orientador</span><br>
                        <strong style="font-size:0.8rem; color:white;">${nomeCurto(orientador)}</strong>
                    </div>
                </div>`;
            }
        });

        listaMeus.innerHTML = htmlMeus === '' ? '<p class="text-muted center">Não tens alunos sob a tua orientação direta.</p>' : htmlMeus;
        listaRestantes.innerHTML = htmlRestantes === '' ? '<p class="text-muted center">Não há outros alunos de 12º ano.</p>' : htmlRestantes;

    } catch (err) {
        listaMeus.innerHTML = '<p class="text-danger center">Erro ao carregar orientandos.</p>';
    }
}

// ==========================================
// FUNÇÕES DE GESTÃO DA PAP (Modais Dinâmicos)
// ==========================================

// 1. GESTÃO DE FASES
window.abrirModalFasesPAP = function(alunoId, faseAtual) {
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
                <option value="0" ${faseAtual===0?'selected':''}>0% - Definição do Tema</option>
                <option value="1" ${faseAtual===1?'selected':''}>25% - Aprovação do Anteprojeto</option>
                <option value="2" ${faseAtual===2?'selected':''}>50% - Desenvolvimento Prático</option>
                <option value="3" ${faseAtual===3?'selected':''}>75% - Escrita do Relatório Final</option>
                <option value="4" ${faseAtual===4?'selected':''}>100% - Preparação para a Apresentação</option>
            </select>
            <button class="primary-btn" style="width:100%; background:#0099ff;" onclick="window.guardarFasePAP('${alunoId}', this)">Atualizar Progresso</button>
        </div>`;
    document.body.appendChild(bg);
    bg.querySelector('.close-dyn-modal').onclick = () => bg.remove();
};

window.guardarFasePAP = async function(alunoId, btn) {
    const novaFase = Number(document.getElementById('sel-fase-pap').value);
    const originalHTML = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
    try {
        await updateDoc(doc(db, "utilizadores", alunoId), { "pap.faseAtual": novaFase });
        mostrarAlerta("Progresso atualizado com sucesso!", false);
        document.querySelector('.modal-overlay:last-child').remove();
        carregarEcraOrientandos();
    } catch(e) { mostrarAlerta("Erro ao atualizar a fase."); btn.innerHTML = originalHTML; btn.disabled = false; }
};

// 2. VISUALIZADOR DO COFRE
window.abrirModalCofrePAP = async function(alunoId, alunoNome) {
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
    } catch(e) { document.getElementById('lista-cofre-dinamica').innerHTML = '<p class="text-danger center">Erro ao ler o cofre.</p>'; }
};

window.verDocCofreProf = function(index) {
    const f = window.cofreAlunoAtual[index]; if(!f) return;
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
window.abrirModalObservatorioPAP = function(alunoId, alunoNome) {
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

window.guardarObservacaoPAP = async function(alunoId, btn) {
    const texto = document.getElementById('txt-observacao-pap').value.trim();
    if(!texto) { mostrarAlerta("Escreve algo antes de gravar!"); return; }
    
    const originalHTML = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;
    try {
        const novaObs = { autor: state.myUserName, data: new Date().toLocaleDateString('pt-PT'), texto: texto };
        await updateDoc(doc(db, "utilizadores", alunoId), { "pap.observatorio": arrayUnion(novaObs) });
        mostrarAlerta("Observação afixada com sucesso!", false);
        document.querySelector('.modal-overlay:last-child').remove();
    } catch(e) { mostrarAlerta("Erro ao afixar observação."); btn.innerHTML = originalHTML; btn.disabled = false; }
};

// ==========================================
// ECRÃ DO DIÁRIO DE BORDO
// ==========================================
export async function carregarEcraDiario() {
    const container = document.getElementById('lista-sessoes-diario');
    container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A carregar diário...</p>';

    try {
        let todasSessoes = [];
        const qAlunos = await getDocs(query(collection(db, "utilizadores"), where("papel", "==", "aluno")));
        
        for (const docAl of qAlunos.docs) {
            const alData = docAl.data();
            const isMeuOrientando = (alData.pap && (alData.pap.orientador === state.myUserName || alData.pap.orientador === state.myUserId));
            
            if (isMeuOrientando) {
                const sS = await getDocs(collection(db, "utilizadores", docAl.id, "sessoes_pap"));
                sS.forEach(s => todasSessoes.push({ id: s.id, alunoId: docAl.id, alunoNome: alData.nome, ...s.data() }));
            }
        }

        todasSessoes.sort((a, b) => new Date(b.data || 0) - new Date(a.data || 0));

        let html = '';
        if (todasSessoes.length === 0) {
            html = '<p class="text-muted center">Ainda não registaste nenhuma sessão de orientação.</p>';
        } else {
            todasSessoes.forEach(s => {
                const corPresenca = s.compareceu ? 'var(--success-green)' : 'var(--danger-red)';
                const iconPresenca = s.compareceu ? 'fa-check' : 'fa-xmark';
                const txtPresenca = s.compareceu ? 'Compareceu' : 'Faltou';
                const dataFormatada = s.data ? s.data.split('-').reverse().join('/') : 'S/ Data';

                html += `
                <div style="background:rgba(0,0,0,0.2); border-left:4px solid ${corPresenca}; padding:15px; border-radius:8px; border-top:1px solid #333; border-right:1px solid #333; border-bottom:1px solid #333;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                        <strong style="color:white; font-size:1rem;">${nomeCurto(s.alunoNome)}</strong>
                        <span style="font-size:0.8rem; color:var(--text-muted);"><i class="fa-regular fa-calendar"></i> ${dataFormatada}</span>
                    </div>
                    <div style="font-size:0.75rem; color:${corPresenca}; margin-bottom:8px; font-weight:bold;">
                        <i class="fa-solid ${iconPresenca}"></i> ${txtPresenca}
                    </div>
                    <p style="font-size:0.85rem; color:var(--text-light); line-height:1.4; margin:0;">
                        ${s.notas || 'Sem observações.'}
                    </p>
                </div>`;
            });
        }
        container.innerHTML = html;

    } catch (err) {
        container.innerHTML = '<p class="text-danger center">Erro ao carregar o diário de bordo.</p>';
    }
}

export async function prepararModalNovaSessao() {
    const selAluno = document.getElementById('sessao-pap-aluno');
    selAluno.innerHTML = '<option value="">A carregar alunos...</option>';
    
    const hoje = new Date().toISOString().split('T')[0];
    document.getElementById('sessao-pap-data').value = hoje;
    document.getElementById('sessao-pap-notas').value = '';
    
    modalPresencaAtiva = true;
    atualizarBotoesPresenca();

    document.getElementById('modal-nova-sessao-pap').style.display = 'flex';

    try {
        let optionsHtml = '<option value="">-- Seleciona o Orientando --</option>';
        for (const t of state.turmasProfessor) {
            const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
            snap.forEach(d => {
                const data = d.data();
                if (data.pap && (data.pap.orientador === state.myUserName || data.pap.orientador === state.myUserId)) {
                    optionsHtml += `<option value="${d.id}">${nomeCurto(data.nome)} (${data.turma})</option>`;
                }
            });
        }
        selAluno.innerHTML = optionsHtml;
    } catch (err) {
        selAluno.innerHTML = '<option value="">Erro ao carregar</option>';
    }
}

export function atualizarBotoesPresenca() {
    const btnSim = document.getElementById('btn-presenca-sim');
    const btnNao = document.getElementById('btn-presenca-nao');
    
    if (modalPresencaAtiva) {
        btnSim.classList.add('active'); btnSim.style.borderColor = 'var(--success-green)'; btnSim.style.color = 'var(--success-green)'; btnSim.style.background = 'rgba(16,185,129,0.1)';
        btnNao.classList.remove('active'); btnNao.style.borderColor = '#333'; btnNao.style.color = 'var(--text-muted)'; btnNao.style.background = 'transparent';
    } else {
        btnNao.classList.add('active'); btnNao.style.borderColor = 'var(--danger-red)'; btnNao.style.color = 'var(--danger-red)'; btnNao.style.background = 'rgba(239,68,68,0.1)';
        btnSim.classList.remove('active'); btnSim.style.borderColor = '#333'; btnSim.style.color = 'var(--text-muted)'; btnSim.style.background = 'transparent';
    }
}

export async function gravarSessaoPAP(e) {
    const alunoId = document.getElementById('sessao-pap-aluno').value;
    const data = document.getElementById('sessao-pap-data').value;
    const notas = document.getElementById('sessao-pap-notas').value.trim();

    if (!alunoId || !data) { return alert("Por favor, seleciona o aluno e a data da sessão."); }

    const btn = e.target.closest('#btn-gravar-sessao-pap');
    const originalHtml = btn.innerHTML; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;

    try {
        await addDoc(collection(db, "utilizadores", alunoId, "sessoes_pap"), { data: data, compareceu: modalPresencaAtiva, notas: notas, registadoEm: Date.now(), orientador: state.myUserName });

        if (!modalPresencaAtiva) {
            await addDoc(collection(db, "utilizadores", alunoId, "ocorrencias"), { titulo: "Falta a Sessão de Orientação (PAP)", descricao: "O aluno não compareceu à sessão agendada. " + notas, tipo: "negativa", autor: state.myUserName, timestamp: Date.now(), data: data.split('-').reverse().join('/') });
        }

        btn.innerHTML = '<i class="fa-solid fa-check"></i> Gravado';
        setTimeout(() => { btn.innerHTML = originalHtml; btn.disabled = false; document.getElementById('modal-nova-sessao-pap').style.display = 'none'; carregarEcraDiario(); }, 1500);

    } catch (err) {
        btn.innerHTML = 'Erro!'; setTimeout(() => { btn.innerHTML = originalHtml; btn.disabled = false; }, 2000);
    }
}

document.addEventListener('click', (e) => {
    if (e.target.closest('#btn-presenca-sim')) { modalPresencaAtiva = true; atualizarBotoesPresenca(); }
    if (e.target.closest('#btn-presenca-nao')) { modalPresencaAtiva = false; atualizarBotoesPresenca(); }
    if (e.target.closest('#btn-gravar-sessao-pap')) { gravarSessaoPAP(e); }
});
