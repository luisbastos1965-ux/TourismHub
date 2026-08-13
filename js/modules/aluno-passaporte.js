import { doc, getDoc, updateDoc, arrayUnion, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

function mostrarAlerta(msg, erro = true) {
    const cor = erro ? 'var(--danger-red)' : 'var(--success-green)';
    const div = document.createElement('div');
    div.style.cssText = `position:fixed; top:20px; left:50%; transform:translateX(-50%); background:${cor}; color:white; padding:12px 24px; border-radius:30px; font-size:0.9rem; font-weight:bold; box-shadow:0 4px 12px rgba(0,0,0,0.3); z-index:10000; display:flex; align-items:center; gap:10px; opacity:0; transition: opacity 0.3s ease;`;
    div.innerHTML = `<i class="fa-solid ${erro ? 'fa-triangle-exclamation' : 'fa-check'}"></i> ${msg}`;
    document.body.appendChild(div);
    requestAnimationFrame(() => div.style.opacity = '1');
    setTimeout(() => { div.style.opacity = '0'; setTimeout(() => div.remove(), 300); }, 3000);
}

window.papTextosGlobais = {};
window.cofreAtual = [];
window.historicoFCTAtual = [];

export function setupPassaporte() {
    document.getElementById('btn-abrir-passaporte')?.addEventListener('click', async (e) => {
        const mMatch = window.minhaTurma ? window.minhaTurma.match(/\d+/) : null;
        const ano = mMatch ? parseInt(mMatch[0]) : 12; 
        const snap = await getDoc(doc(window.db, "utilizadores", window.myUserId));
        const dados = snap.exists() ? snap.data() : {};
        const fctBloqueada = dados.fctBloqueada !== false;

        if (ano === 11 && fctBloqueada) {
            e.preventDefault();
            mostrarAlerta("O acesso à FCT aguarda desbloqueio pelo Coordenador.", true);
            return;
        }

        document.querySelectorAll('.app-content > div:not(.modal-overlay)').forEach(d => d.style.display = 'none');
        document.getElementById('view-aluno-passaporte').style.display = 'block';
        carregarPassaporteDashboard(dados, ano);
    });
    
    document.getElementById('btn-voltar-passaporte')?.addEventListener('click', () => {
        const activeTab = document.querySelector('.bottom-nav .nav-item.active');
        if(activeTab) { activeTab.click(); } else {
            document.getElementById('student-dashboard').style.display = 'block';
            document.getElementById('view-aluno-passaporte').style.display = 'none';
        }
    });

    window.mudarAbaPassaporte = mudarAbaPassaporte;
    window.gerarTextoDiario = gerarTextoDiario;
    window.guardarFichaEntidade = guardarFichaEntidade;
    window.enviarFicheiroCofre = enviarFicheiroCofre;
    window.registarHorasDia = registarHorasDia;
    window.baixarFicheiroCofre = baixarFicheiroCofre;
    window.verFicheiroCofre = verFicheiroCofre;
    window.removerFicheiroCofre = removerFicheiroCofre;
    window.eliminarHorasFCT = eliminarHorasFCT;
    window.editarHorasFCT = editarHorasFCT;
    window.abrirChatOrientadorPAP = abrirChatOrientadorPAP;
    
    // Funções PAP Mobile
    window.mudarTopicoPAP = mudarTopicoPAP;
    window.guardarTopicoPAP = guardarTopicoPAP;
    window.compilarRelatorioPAP = compilarRelatorioPAP;
}

function carregarPassaporteDashboard(dados, ano) {
    const cont = document.getElementById('passaporte-dynamic-content');
    if (!cont) return;
    
    window.papTextosGlobais = (dados.pap && dados.pap.textos) ? dados.pap.textos : {};
    window.cofreAtual = (dados.pap && dados.pap.cofre) ? dados.pap.cofre : [];
    window.historicoFCTAtual = (dados.fct && dados.fct.historicoHoras) ? dados.fct.historicoHoras : [];

    let html = '';
    if (ano === 12) {
        html += `<div style="display:flex; gap:10px; margin-bottom:20px;">
                    <button class="primary-btn pass-tab-btn active" style="flex:1;" onclick="window.mudarAbaPassaporte('pap')">PAP</button>
                    <button class="secondary-btn pass-tab-btn" style="flex:1;" onclick="window.mudarAbaPassaporte('fct')">FCT (Estágio)</button>
                 </div>`;
        html += `<div id="pass-content-pap">${renderPAP(dados)}</div>`;
        html += `<div id="pass-content-fct" style="display:none;">${renderFCT(dados)}</div>`;
    } else if (ano === 11) {
        html += `<div id="pass-content-fct">${renderFCT(dados)}</div>`;
    }

    cont.innerHTML = html;
    document.getElementById('upload-cofre-pap')?.addEventListener('change', processarUploadCofre);
    
    if(ano === 12) window.mudarTopicoPAP();
}

function mudarAbaPassaporte(aba) {
    document.querySelectorAll('.pass-tab-btn').forEach(b => {
        b.classList.remove('primary-btn'); b.classList.add('secondary-btn'); b.classList.remove('active');
    });
    event.currentTarget.classList.remove('secondary-btn');
    event.currentTarget.classList.add('primary-btn');
    event.currentTarget.classList.add('active');
    
    document.getElementById('pass-content-pap').style.display = aba === 'pap' ? 'block' : 'none';
    document.getElementById('pass-content-fct').style.display = aba === 'fct' ? 'block' : 'none';
}

// ==========================================
// MÓDULO 1: PAP (PROJETO FINAL)
// ==========================================
function renderPAP(dados) {
    const pap = dados.pap || {};
    const orientador = pap.orientadorNome || 'A definir';
    
    // 1. PROF ORIENTADOR
    let perfilHtml = `<div class="card" style="border-left:4px solid var(--accent-purple); margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; gap:15px;">
                        <div style="display:flex; align-items:center; gap:15px;">
                            <div style="width:50px; height:50px; border-radius:50%; background:#444; display:flex; align-items:center; justify-content:center; font-size:1.5rem;"><i class="fa-solid fa-user-tie"></i></div>
                            <div>
                                <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Prof. Orientador</span>
                                <h4 style="margin:0; color:var(--text-light); font-size:1.1rem;">${orientador}</h4>
                            </div>
                        </div>
                        <button class="primary-btn small-btn" style="width:40px; height:40px; border-radius:50%; background:var(--accent-purple); color:white; padding:0;" onclick="window.abrirChatOrientadorPAP('${orientador}')" title="Mensagem Direta"><i class="fa-solid fa-envelope"></i></button>
                      </div>`;

    // 2. OBSERVATÓRIO
    let obsHtml = `<div class="card" style="margin-bottom:20px;">
                        <h4 style="color:var(--warning-yellow); font-size:1rem; margin:0 0 15px 0;"><i class="fa-solid fa-eye"></i> Observatório do Orientador</h4>`;
    if(pap.observatorio && pap.observatorio.length > 0) {
        pap.observatorio.forEach(o => {
            obsHtml += `<div style="border-left:3px solid var(--warning-yellow); padding:10px 15px; background:rgba(245, 158, 11, 0.05); margin-bottom:10px; border-radius:6px;">
                            <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-bottom:5px;"><span>Prof. ${o.autor}</span><span>${o.data}</span></div>
                            <p style="font-size:0.9rem; color:var(--text-light); margin:0;">${o.texto}</p>
                        </div>`;
        });
    } else {
        obsHtml += `<p style="font-size:0.85rem; color:var(--text-muted); margin:0;">Ainda não tens retificações do teu orientador.</p>`;
    }
    obsHtml += `</div>`;

    // 3. COFRE
    let cofreHtml = `<div class="card" style="margin-bottom:20px; border:1px solid #333;">
                        <h4 style="color:var(--text-light); font-size:1rem; margin:0 0 15px 0;"><i class="fa-solid fa-vault"></i> Cofre do Projeto</h4>
                        <div style="display:flex; flex-direction:column; gap:10px;" id="lista-cofre-pap">`;
    if(window.cofreAtual.length > 0) {
        window.cofreAtual.forEach((f, idx) => {
            cofreHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:6px;">
                            <div style="font-size:0.85rem; color:var(--text-light); flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; cursor:pointer;" onclick="window.verFicheiroCofre(${idx})">
                                <i class="fa-solid fa-file-lines" style="color:var(--primary-green); margin-right:5px;"></i> ${f.nome}
                            </div>
                            <div style="display:flex; align-items:center; gap:8px;">
                                <button onclick="window.verFicheiroCofre(${idx})" class="secondary-btn small-btn" style="padding:6px; border:none; background:rgba(0,204,136,0.1); color:var(--primary-green);" title="Visualizar"><i class="fa-solid fa-eye"></i></button>
                                <button onclick="window.baixarFicheiroCofre(${idx})" class="secondary-btn small-btn" style="padding:6px; border:none; background:rgba(0,153,255,0.1); color:#0099ff;" title="Transferir"><i class="fa-solid fa-download"></i></button>
                                <button onclick="window.removerFicheiroCofre(${idx})" class="secondary-btn small-btn" style="padding:6px; border:none; background:rgba(239,68,68,0.1); color:var(--danger-red);" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                            </div>
                          </div>`;
        });
    } else {
        cofreHtml += `<p style="font-size:0.85rem; color:var(--text-muted); margin:0;">O teu cofre está vazio.</p>`;
    }
    cofreHtml += `  </div>
                    <div style="margin-top:15px;">
                        <label for="upload-cofre-pap" class="primary-btn small-btn" style="display:inline-block; cursor:pointer;"><i class="fa-solid fa-upload"></i> Submeter Versão</label>
                        <input type="file" id="upload-cofre-pap" style="display:none;" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg">
                    </div>
                  </div>`;

    // 4. CONSTRUTOR MOBILE
    const TOPICOS_PAP = ['Introdução', 'Conceitos/Revisão Literária', 'Projeto: Motivação, Caracterização, Conceito e Descrição', 'Plano de Marketing: Público-Alvo, Marketing-Mix, Concorrência, Análise SWOT', 'Micro-Projeto', 'Conclusão'];
    
    let construtorHtml = `<div class="card" style="margin-bottom:20px; border-left:4px solid #f97316;">
                            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
                                <h4 style="color:var(--text-light); font-size:1rem; margin:0;"><i class="fa-solid fa-mobile-screen"></i> Construtor Mobile</h4>
                            </div>
                            
                            <select id="pap-topico-select" class="input-padrao" style="width:100%; margin-bottom:10px;" onchange="window.mudarTopicoPAP()">
                                ${TOPICOS_PAP.map(t => `<option value="${t}">${t}</option>`).join('')}
                                <option value="novo">+ Adicionar Tópico Personalizado</option>
                            </select>
                            
                            <input type="text" id="pap-topico-custom" class="input-padrao" style="display:none; width:100%; margin-bottom:10px;" placeholder="Nome do novo tópico">
                            <textarea id="pap-topico-texto" class="input-padrao" style="width:100%; height:150px; margin-bottom:10px;" placeholder="Escreve aqui o texto para este tópico..."></textarea>
                            
                            <div style="display:flex; gap:10px;">
                                <button class="secondary-btn small-btn" style="flex:1;" onclick="window.guardarTopicoPAP()"><i class="fa-solid fa-save"></i> Guardar Tópico</button>
                                <button class="primary-btn small-btn" style="flex:1; background:#f97316; color:#fff;" onclick="window.compilarRelatorioPAP()"><i class="fa-solid fa-file-lines"></i> Compilar Tudo</button>
                            </div>
                            <div id="pap-relatorio-compilado" style="display:none; margin-top:15px; padding:15px; background:rgba(0,0,0,0.2); border-radius:6px; font-size:0.85rem; color:var(--text-light); white-space:pre-wrap; border:1px solid #333;"></div>
                          </div>`;

    return perfilHtml + obsHtml + cofreHtml + construtorHtml;
}

// Interação com o Cofre
let ficheiroParaCofre = null;
function processarUploadCofre(e) {
    const f = e.target.files[0]; if(!f) return;
    
    // Limite de segurança de 800KB para proteger a base de dados
    if (f.size > 800 * 1024) {
        mostrarAlerta("O ficheiro é muito pesado! Por favor, reduz o tamanho para menos de 800KB.", true);
        e.target.value = '';
        return;
    }

    const r = new FileReader();
    r.onload = () => { 
        ficheiroParaCofre = { nome: f.name, base64: r.result };
        if(confirm(`Queres enviar o ficheiro "${f.name}" para o Cofre?`)) { window.enviarFicheiroCofre(); }
    };
    r.readAsDataURL(f);
}

async function enviarFicheiroCofre() {
    if(!ficheiroParaCofre) return;
    const dStr = new Date().toLocaleDateString('pt-PT');
    try {
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), {
            "pap.cofre": arrayUnion({ nome: ficheiroParaCofre.nome, base64: ficheiroParaCofre.base64, data: dStr })
        });
        mostrarAlerta("Ficheiro guardado no cofre com sucesso!", false);
        document.getElementById('btn-abrir-passaporte').click(); 
    } catch(e) { mostrarAlerta("Erro ao guardar ficheiro."); }
}

function verFicheiroCofre(index) {
    const f = window.cofreAtual[index];
    if(!f) return;
    
    if (f.base64.includes("application/pdf") || f.base64.startsWith("data:image")) {
        const win = window.open();
        win.document.write(`<iframe src="${f.base64}" frameborder="0" style="border:0; top:0px; left:0px; bottom:0px; right:0px; width:100%; height:100%;" allowfullscreen></iframe>`);
    } else {
        mostrarAlerta("Este formato não permite visualização direta. O download vai iniciar.", true);
        window.baixarFicheiroCofre(index);
    }
}

async function baixarFicheiroCofre(index) {
    const f = window.cofreAtual[index];
    if(!f) return;
    const a = document.createElement("a");
    a.href = f.base64;
    a.download = f.nome;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

async function removerFicheiroCofre(index) {
    if(!confirm("Tens a certeza que queres eliminar este ficheiro?")) return;
    window.cofreAtual.splice(index, 1);
    try {
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), { "pap.cofre": window.cofreAtual });
        mostrarAlerta("Ficheiro eliminado.", false);
        document.getElementById('btn-abrir-passaporte').click(); 
    } catch(e) { mostrarAlerta("Erro ao eliminar ficheiro."); }
}

async function abrirChatOrientadorPAP(orientadorNome) {
    if(!orientadorNome || orientadorNome === 'A definir') {
        mostrarAlerta("Ainda não tens orientador atribuído."); return;
    }
    const chatId = `chat_pap_${window.myUserId}`;
    const chatNome = `Orientador: ${orientadorNome}`;
    
    try {
        const chatRef = doc(window.db, "forums", chatId);
        const chatSnap = await getDoc(chatRef);
        if(!chatSnap.exists()) {
            await setDoc(chatRef, { nome: chatNome, isGlobal: false, criador: window.myUserId, participantes: [window.myUserId], dataCriacao: Date.now(), lastMessage: null, unread: {}, type: 'fixo' });
        }
        document.querySelector('.nav-item[data-target="view-aluno-forum"]').click();
        setTimeout(() => { window.abrirChatForumAluno(chatId, chatNome); }, 300);
    } catch(e) { mostrarAlerta("Erro ao iniciar conversa."); }
}

// Construtor Mobile PAP
function mudarTopicoPAP() {
    const sel = document.getElementById('pap-topico-select').value;
    const customInput = document.getElementById('pap-topico-custom');
    const txtArea = document.getElementById('pap-topico-texto');
    
    if(sel === 'novo') {
        customInput.style.display = 'block'; txtArea.value = '';
    } else {
        customInput.style.display = 'none'; txtArea.value = window.papTextosGlobais[sel] || '';
    }
}

async function guardarTopicoPAP() {
    let sel = document.getElementById('pap-topico-select').value;
    if(sel === 'novo') {
        sel = document.getElementById('pap-topico-custom').value.trim();
        if(!sel) { mostrarAlerta("Dá um nome ao teu novo tópico."); return; }
    }
    const texto = document.getElementById('pap-topico-texto').value;
    window.papTextosGlobais[sel] = texto;
    
    try {
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), { "pap.textos": window.papTextosGlobais });
        mostrarAlerta(`Tópico "${sel}" guardado!`, false);
    } catch(e) { mostrarAlerta("Erro ao guardar o texto."); }
}

function compilarRelatorioPAP() {
    const caixa = document.getElementById('pap-relatorio-compilado');
    let relatorioFinal = "";
    for (const [topico, texto] of Object.entries(window.papTextosGlobais)) {
        if(texto.trim() !== '') { relatorioFinal += `--- ${topico.toUpperCase()} ---\n${texto}\n\n`; }
    }
    if(relatorioFinal === "") { mostrarAlerta("Ainda não tens texto guardado."); return; }
    caixa.innerHTML = `<strong>O Teu Relatório:</strong><br><br>${relatorioFinal}<span style="color:var(--text-muted); font-size:0.75rem;">(Copia este texto para o Word no teu PC quando puderes!)</span>`;
    caixa.style.display = 'block';
}

// ==========================================
// MÓDULO 2: FCT (ESTÁGIO)
// ==========================================
function renderFCT(dados) {
    const fct = dados.fct || {};
    let html = '';

    let formDisplay = fct.empresa ? 'none' : 'block';
    let viewDisplay = fct.empresa ? 'block' : 'none';

    // 1. Entidade de Estágio
    html += `<div class="card" style="margin-bottom:20px; border-left:4px solid #0ea5e9;">
                <h4 style="color:var(--text-light); font-size:1rem; margin:0 0 15px 0;">Entidade de Estágio</h4>
                
                <div id="fct-entidade-view" style="display:${viewDisplay};">
                    <div style="background:rgba(0,0,0,0.2); padding:15px; border-radius:8px; margin-bottom:15px;">
                        <strong style="color:var(--text-light); font-size:1.1rem; display:block; margin-bottom:10px;">${fct.empresa}</strong>
                        <div style="font-size:0.85rem; color:var(--text-muted); line-height:1.8;">
                            <i class="fa-solid fa-user-tie" style="width:20px; color:#0ea5e9;"></i> Tutor: <span style="color:var(--text-light);">${fct.tutor || 'N/A'}</span><br>
                            <i class="fa-solid fa-phone" style="width:20px; color:#0ea5e9;"></i> Contacto: <span style="color:var(--text-light);">${fct.telefone || 'N/A'}</span><br>
                            <i class="fa-solid fa-envelope" style="width:20px; color:#0ea5e9;"></i> Email: <span style="color:var(--text-light);">${fct.email || 'N/A'}</span>
                        </div>
                    </div>
                    <button class="secondary-btn small-btn" style="width:100%;" onclick="document.getElementById('fct-entidade-view').style.display='none'; document.getElementById('fct-entidade-form').style.display='block';">Editar Dados</button>
                </div>

                <div id="fct-entidade-form" style="display:${formDisplay};">
                    <input type="text" id="fct-empresa" class="input-padrao" placeholder="Nome da Entidade / Hotel" value="${fct.empresa || ''}" style="width:100%; margin-bottom:10px;">
                    <input type="text" id="fct-tutor" class="input-padrao" placeholder="Nome do Tutor na Entidade" value="${fct.tutor || ''}" style="width:100%; margin-bottom:10px;">
                    <div style="display:flex; gap:10px; margin-bottom:10px;">
                        <input type="tel" id="fct-telefone" class="input-padrao" placeholder="Telefone (Opcional)" value="${fct.telefone || ''}" style="flex:1;">
                        <input type="email" id="fct-email" class="input-padrao" placeholder="Email (Opcional)" value="${fct.email || ''}" style="flex:1;">
                    </div>
                    <button class="primary-btn small-btn" style="width:100%;" onclick="window.guardarFichaEntidade()">Guardar Ficha</button>
                </div>
             </div>`;

    const horasRealizadas = fct.horasRealizadas || 0;
    const horasTotais = fct.horasTotal || 400; 
    const percHoras = Math.min((horasRealizadas / horasTotais) * 100, 100);
    
    // Cálculo Estimativa
    const horasFalta = Math.max(0, horasTotais - horasRealizadas);
    const diasFalta = Math.ceil(horasFalta / 7);
    let estimativaHtml = '';
    if (horasFalta > 0) {
        estimativaHtml = `<div style="margin-top:10px; font-size:0.85rem; color:var(--text-muted); display:flex; align-items:center; gap:8px;">
                            <i class="fa-solid fa-calendar-check" style="color:var(--primary-green);"></i>
                            Estimativa: Faltam ~${diasFalta} dias úteis (a 7h/dia)
                          </div>`;
    } else {
        estimativaHtml = `<div style="margin-top:10px; font-size:0.85rem; color:var(--success-green); display:flex; align-items:center; gap:8px;">
                            <i class="fa-solid fa-flag-checkered"></i> Estágio Concluído!
                          </div>`;
    }

    // 2. Registo de Horas
    html += `<div class="card" style="margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
                    <div>
                        <h4 style="color:var(--text-light); font-size:1.1rem; margin:0 0 5px 0;">Registo de Horas</h4>
                        <span style="font-size:0.85rem; color:var(--text-muted);">Progresso Oficial</span>
                    </div>
                    <strong style="color:var(--primary-green); font-size:1.3rem;">${horasRealizadas} / ${horasTotais}h</strong>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${percHoras}%; background:var(--primary-green);"></div></div>
                ${estimativaHtml}
                
                <div style="margin-top:20px; padding-top:15px; border-top:1px dashed #333;">
                    <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 10px;"><i class="fa-solid fa-circle-info" style="color:#0ea5e9;"></i> <strong>Regra:</strong> Aulas + Estágio não podem ultrapassar as 7h diárias.</p>
                    <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                        <input type="date" id="fct-hora-data" class="input-padrao" style="flex:1; padding:10px 8px; font-size:0.85rem;">
                        <input type="time" id="fct-hora-in" class="input-padrao" style="width:80px; padding:10px 5px; font-size:0.85rem;">
                        <input type="time" id="fct-hora-out" class="input-padrao" style="width:80px; padding:10px 5px; font-size:0.85rem;">
                    </div>
                    <button class="primary-btn small-btn" style="width: 100%; background:var(--primary-green);" onclick="window.registarHorasDia()"><i class="fa-solid fa-clock"></i> Registar Horas</button>
                </div>`;
                
    if (window.historicoFCTAtual.length > 0) {
        html += `<div style="margin-top:15px; display:flex; flex-direction:column; gap:5px;">`;
        const historicoMap = window.historicoFCTAtual.map((r, i) => ({...r, originalIndex: i})).slice(-5).reverse();
        
        historicoMap.forEach(r => {
            html += `<div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; background:rgba(0,0,0,0.2); padding:8px 12px; border-radius:4px; border-left:2px solid var(--primary-green);">
                        <div style="flex:1;">
                            <span style="color:var(--text-light);">${r.data}</span><br>
                            <span style="color:var(--text-muted); font-size:0.75rem;">${r.inicio} às ${r.fim}</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <strong style="color:var(--primary-green); font-size:0.9rem; margin-right:5px;">+${r.horas}h</strong>
                            <button onclick="window.editarHorasFCT(${r.originalIndex})" style="background:none; border:none; color:var(--text-muted); cursor:pointer;"><i class="fa-solid fa-pen"></i></button>
                            <button onclick="window.eliminarHorasFCT(${r.originalIndex})" style="background:none; border:none; color:var(--danger-red); cursor:pointer;"><i class="fa-solid fa-trash"></i></button>
                        </div>
                     </div>`;
        });
        html += `</div>`;
    }
    html += `</div>`;

    const TAREFAS_TURISMO = [
        "Atendimento de Front-Office", "Gestão de Reservas (Check-in/out)", 
        "Apoio a Eventos e Banquetes", "Serviço de F&B (Restaurante/Bar)", 
        "Prestação de Informação Turística", "Apoio em Agência / Operador", 
        "Criação de Roteiros e Circuitos", "Tratamento de Reclamações", 
        "Back-office e Faturação", "Animação Turística"
    ];

    html += `<div class="card" style="margin-bottom:20px; border:1px solid #333;">
                <h4 style="color:var(--warning-yellow); font-size:1rem; margin:0 0 10px 0;">Resumo Semanal (Relatório)</h4>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:15px;">Seleciona as tarefas em que estiveste envolvido esta semana para gerar a base do teu relatório.</p>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-bottom:15px; background:rgba(0,0,0,0.15); padding:15px; border-radius:8px;">`;
    
    TAREFAS_TURISMO.forEach((t) => {
        html += `<label style="display:flex; align-items:center; justify-content:flex-start; gap:10px; font-size:0.8rem; color:var(--text-light); cursor:pointer; margin:0;">
                    <input type="checkbox" class="tarefa-fct-chk" value="${t}" style="margin:0; width:16px; height:16px; flex-shrink:0;"> 
                    <span style="line-height:1.2; text-align:left;">${t}</span>
                 </label>`;
    });

    html += `   </div>
                <textarea id="fct-notas-extra" class="input-padrao" placeholder="Gostarias de acrescentar algo? (Ex: Fui elogiado na resolução de um problema...)" style="width:100%; height:60px; margin-bottom:10px;"></textarea>
                <button class="primary-btn small-btn" style="width:100%; background:var(--warning-yellow); color:#000; margin-bottom:10px;" onclick="window.gerarTextoDiario()">Escrever Relatório</button>
                
                <div id="resultado-gerador-fct" style="display:none; padding:15px; background:rgba(0,0,0,0.2); border-left:3px solid var(--warning-yellow); border-radius:6px; font-size:0.85rem; color:var(--text-light); line-height:1.6;"></div>
             </div>`;

    return html;
}

async function guardarFichaEntidade() {
    const emp = document.getElementById('fct-empresa').value.trim();
    const tut = document.getElementById('fct-tutor').value.trim();
    const tel = document.getElementById('fct-telefone').value.trim();
    const em = document.getElementById('fct-email').value.trim();
    const btn = event.currentTarget; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), {
            "fct.empresa": emp, "fct.tutor": tut, "fct.telefone": tel, "fct.email": em
        });
        document.getElementById('btn-abrir-passaporte').click(); 
    } catch(e) { mostrarAlerta("Erro ao guardar ficha."); btn.innerHTML = 'Guardar Ficha'; }
}

async function registarHorasDia() {
    const dt = document.getElementById('fct-hora-data').value;
    const hIn = document.getElementById('fct-hora-in').value;
    const hOut = document.getElementById('fct-hora-out').value;

    if(!dt || !hIn || !hOut) { mostrarAlerta("Preenche a data e as horas de entrada e saída!"); return; }

    const [hInStr, mInStr] = hIn.split(':').map(Number);
    const [hOutStr, mOutStr] = hOut.split(':').map(Number);
    
    let minDiff = (hOutStr * 60 + mOutStr) - (hInStr * 60 + mInStr);
    if(minDiff <= 0) { mostrarAlerta("A hora de saída tem de ser posterior à hora de entrada!"); return; }

    let totalHoras = Math.floor(minDiff / 60);
    if (totalHoras < 1) { mostrarAlerta("Tens de estagiar pelo menos 1 hora para registar o dia."); return; }
    if (totalHoras > 7) { mostrarAlerta("O registo será ajustado para o limite máximo de 7h diárias."); totalHoras = 7; }

    const btn = event.currentTarget; const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;

    try {
        const snap = await getDoc(doc(window.db, "utilizadores", window.myUserId));
        const currentHoras = snap.data().fct?.horasRealizadas || 0;
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), {
            "fct.horasRealizadas": currentHoras + totalHoras,
            "fct.historicoHoras": arrayUnion({ data: dt.split('-').reverse().join('/'), dataIso: dt, inicio: hIn, fim: hOut, horas: totalHoras })
        });
        document.getElementById('btn-abrir-passaporte').click(); 
        mostrarAlerta("Horas registadas com sucesso!", false);
    } catch(e) { mostrarAlerta("Erro ao registar horas."); btn.innerHTML = textoOriginal; btn.disabled = false; }
}

async function eliminarHorasFCT(index) {
    if(!confirm("Tens a certeza que queres eliminar este registo de horas?")) return;
    
    const registo = window.historicoFCTAtual[index];
    window.historicoFCTAtual.splice(index, 1);
    
    try {
        const snap = await getDoc(doc(window.db, "utilizadores", window.myUserId));
        let currentHoras = snap.data().fct?.horasRealizadas || 0;
        currentHoras = Math.max(0, currentHoras - registo.horas);
        
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), {
            "fct.horasRealizadas": currentHoras,
            "fct.historicoHoras": window.historicoFCTAtual
        });
        document.getElementById('btn-abrir-passaporte').click();
        mostrarAlerta("Registo eliminado.", false);
    } catch(e) { mostrarAlerta("Erro ao eliminar registo."); }
}

async function editarHorasFCT(index) {
    const r = window.historicoFCTAtual[index];
    if(r.dataIso) document.getElementById('fct-hora-data').value = r.dataIso;
    document.getElementById('fct-hora-in').value = r.inicio;
    document.getElementById('fct-hora-out').value = r.fim;
    
    // Elimina silenciosamente o antigo para o aluno guardar a nova versão limpa
    window.historicoFCTAtual.splice(index, 1);
    try {
        const snap = await getDoc(doc(window.db, "utilizadores", window.myUserId));
        let currentHoras = snap.data().fct?.horasRealizadas || 0;
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), {
            "fct.horasRealizadas": Math.max(0, currentHoras - r.horas),
            "fct.historicoHoras": window.historicoFCTAtual
        });
        mostrarAlerta("Altera os dados nos campos e volta a clicar em Registar.", false);
        // Oculta a linha antiga visualmente para não confundir
        document.getElementById('btn-abrir-passaporte').click();
        
        // Repõe os valores após o reload visual
        setTimeout(() => {
            if(r.dataIso) document.getElementById('fct-hora-data').value = r.dataIso;
            document.getElementById('fct-hora-in').value = r.inicio;
            document.getElementById('fct-hora-out').value = r.fim;
        }, 500);

    } catch(e) { mostrarAlerta("Erro a preparar edição."); }
}

function gerarTextoDiario() {
    const chks = document.querySelectorAll('.tarefa-fct-chk:checked');
    const notas = document.getElementById('fct-notas-extra').value.trim();
    const caixaResultado = document.getElementById('resultado-gerador-fct');
    
    if(chks.length === 0 && notas === '') { mostrarAlerta("Seleciona tarefas ou escreve uma nota!"); return; }

    let textoGerado = "Durante esta semana de estágio na Entidade de Estágio, o meu plano de trabalhos incidiu nas seguintes áreas de intervenção técnica: ";
    let arrTarefas = [];
    chks.forEach(c => arrTarefas.push(c.value.toLowerCase()));
    
    if(arrTarefas.length > 0) {
        if(arrTarefas.length === 1) { textoGerado += arrTarefas[0] + ". "; } 
        else { const ult = arrTarefas.pop(); textoGerado += arrTarefas.join(", ") + " e " + ult + ". "; }
    } else { textoGerado = "Ao longo da semana, foquei-me no acompanhamento e execução de atividades operacionais da empresa. "; }

    textoGerado += "A execução destas tarefas exigiu responsabilidade, adaptação constante ao ritmo da operação turística e permitiu-me colocar em prática os conhecimentos teóricos adquiridos em sala de aula. ";

    if(notas !== '') { textoGerado += `Adicionalmente, destaco o seguinte: ${notas}. `; }
    
    textoGerado += "Em suma, foi um período muito produtivo onde desenvolvi novas competências técnicas e reforcei a minha postura profissional.";

    caixaResultado.innerHTML = `<strong>Texto Base para o teu Relatório:</strong><br><br>${textoGerado}`;
    caixaResultado.style.display = 'block';
}
