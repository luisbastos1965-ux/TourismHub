import { doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export function setupPassaporte() {
    document.getElementById('btn-abrir-passaporte')?.addEventListener('click', () => {
        document.querySelectorAll('.app-content > div:not(.modal-overlay)').forEach(d => d.style.display = 'none');
        document.getElementById('view-aluno-passaporte').style.display = 'block';
        carregarPassaporteDashboard();
    });
    
    document.getElementById('btn-voltar-passaporte')?.addEventListener('click', () => {
        const activeTab = document.querySelector('.bottom-nav .nav-item.active');
        if(activeTab) {
            activeTab.click();
        } else {
            document.getElementById('student-dashboard').style.display = 'block';
            document.getElementById('view-aluno-passaporte').style.display = 'none';
        }
    });

    // Funções globais para os botões do HTML injetado
    window.mudarAbaPassaporte = mudarAbaPassaporte;
    window.gerarTextoDiario = gerarTextoDiario;
    window.guardarFichaEntidade = guardarFichaEntidade;
    window.enviarFicheiroCofre = enviarFicheiroCofre;
    window.guardarHorasFCT = guardarHorasFCT;
}

async function carregarPassaporteDashboard() {
    const cont = document.getElementById('passaporte-dynamic-content');
    if (!cont) return;
    
    cont.innerHTML = '<p class="text-muted center">A carregar os teus dados...</p>';

    try {
        const mMatch = window.minhaTurma ? window.minhaTurma.match(/\d+/) : null;
        const ano = mMatch ? parseInt(mMatch[0]) : 12; 
        
        const snap = await getDoc(doc(window.db, "utilizadores", window.myUserId));
        const dados = snap.exists() ? snap.data() : {};
        
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
        
    } catch(e) { cont.innerHTML = '<p class="text-danger center">Erro ao carregar dados.</p>'; }
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
// MÓDULO 1: PAP
// ==========================================
function renderPAP(dados) {
    const pap = dados.pap || {};
    const fases = ['Tema', 'Aprovação', 'Desenvolvimento', 'Relatório', 'Apresentação']; // Alterado: "Escolha do Tema" -> "Tema"
    const faseAtual = pap.faseAtual || 0;
    
    // Progresso Visual
    let stepsHtml = `<div style="display:flex; justify-content:space-between; position:relative; margin-bottom:30px;">
                        <div style="position:absolute; top:15px; left:0; right:0; height:3px; background:#333; z-index:1;"></div>
                        <div style="position:absolute; top:15px; left:0; width:${(faseAtual/(fases.length-1))*100}%; height:3px; background:var(--primary-green); z-index:1; transition:0.5s;"></div>`;
    
    fases.forEach((f, i) => {
        const isDone = i <= faseAtual;
        const color = isDone ? 'var(--primary-green)' : '#333';
        stepsHtml += `<div style="position:relative; z-index:2; text-align:center; width:20%;">
                        <div style="width:30px; height:30px; background:var(--bg-dark); border:3px solid ${color}; border-radius:50%; margin:0 auto 5px auto; display:flex; align-items:center; justify-content:center;">
                            ${isDone ? `<i class="fa-solid fa-check" style="color:${color}; font-size:0.7rem;"></i>` : ''}
                        </div>
                        <span style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">${f}</span>
                      </div>`;
    });
    stepsHtml += `</div>`;

    // Orientador e Tema
    const orientador = pap.orientadorNome || 'A definir'; // Alterado: Removido "pela escola"
    let perfilHtml = `<div class="card" style="border-left:4px solid var(--accent-purple); margin-bottom:20px; display:flex; align-items:center; gap:15px;">
                        <div style="width:50px; height:50px; border-radius:50%; background:#444; display:flex; align-items:center; justify-content:center; font-size:1.5rem;"><i class="fa-solid fa-user-tie"></i></div>
                        <div>
                            <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Prof. Orientador</span>
                            <h4 style="margin:0; color:var(--text-light); font-size:1.1rem;">${orientador}</h4>
                        </div>
                      </div>`;

    // Cofre
    let cofreHtml = `<div class="card" style="margin-bottom:20px; border:1px solid #333;">
                        <h4 style="color:var(--text-light); font-size:1rem; margin:0 0 15px 0;"><i class="fa-solid fa-vault"></i> Cofre do Projeto</h4>
                        <div style="display:flex; flex-direction:column; gap:10px;" id="lista-cofre-pap">`;
    if(pap.cofre && pap.cofre.length > 0) {
        pap.cofre.forEach(f => {
            cofreHtml += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:6px;">
                            <span style="font-size:0.85rem; color:var(--text-light);"><i class="fa-solid fa-file-lines" style="color:var(--primary-green);"></i> ${f.nome}</span>
                            <span style="font-size:0.7rem; color:var(--text-muted);">${f.data}</span>
                          </div>`;
        });
    } else {
        cofreHtml += `<p style="font-size:0.85rem; color:var(--text-muted); margin:0;">O teu cofre está vazio.</p>`;
    }
    cofreHtml += `  </div>
                    <div style="margin-top:15px;">
                        <label for="upload-cofre-pap" class="primary-btn small-btn" style="display:inline-block; cursor:pointer;"><i class="fa-solid fa-upload"></i> Submeter Versão</label>
                        <input type="file" id="upload-cofre-pap" style="display:none;" accept=".pdf,.doc,.docx,.ppt,.pptx">
                    </div>
                  </div>`;

    // Observatório
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

    return stepsHtml + perfilHtml + cofreHtml + obsHtml;
}

let ficheiroParaCofre = null;
function processarUploadCofre(e) {
    const f = e.target.files[0]; if(!f) return;
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
        alert("Ficheiro guardado no cofre com sucesso!"); carregarPassaporteDashboard();
    } catch(e) { alert("Erro ao guardar ficheiro."); }
}

// ==========================================
// MÓDULO 2: FCT (ESTÁGIO)
// ==========================================
function renderFCT(dados) {
    const fct = dados.fct || {};
    let html = '';

    // 1. Entidade de Acolhimento (Vem primeiro! S/ icon e mais apelativa)
    let formDisplay = fct.empresa ? 'none' : 'block';
    let viewDisplay = fct.empresa ? 'block' : 'none';

    html += `<div class="card" style="margin-bottom:20px; border-left:4px solid #0ea5e9;">
                <h4 style="color:var(--text-light); font-size:1rem; margin:0 0 15px 0;">Entidade de Acolhimento</h4>
                
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
                    <input type="text" id="fct-empresa" class="input-padrao" placeholder="Nome da Empresa / Hotel" value="${fct.empresa || ''}" style="width:100%; margin-bottom:10px;">
                    <input type="text" id="fct-tutor" class="input-padrao" placeholder="Nome do Tutor na Empresa" value="${fct.tutor || ''}" style="width:100%; margin-bottom:10px;">
                    <div style="display:flex; gap:10px; margin-bottom:10px;">
                        <input type="tel" id="fct-telefone" class="input-padrao" placeholder="Telefone (Opcional)" value="${fct.telefone || ''}" style="flex:1;">
                        <input type="email" id="fct-email" class="input-padrao" placeholder="Email (Opcional)" value="${fct.email || ''}" style="flex:1;">
                    </div>
                    <button class="primary-btn small-btn" style="width:100%;" onclick="window.guardarFichaEntidade()">Guardar Ficha</button>
                </div>
             </div>`;

    // 2. Registo de Horas (O Aluno pode validar)
    const horasRealizadas = fct.horasRealizadas || 0;
    const horasTotais = fct.horasTotal || 400; 
    const percHoras = Math.min((horasRealizadas / horasTotais) * 100, 100);

    html += `<div class="card" style="margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
                    <div>
                        <h4 style="color:var(--text-light); font-size:1.1rem; margin:0 0 5px 0;">Registo de Horas</h4>
                        <span style="font-size:0.85rem; color:var(--text-muted);">Progresso do teu Estágio</span>
                    </div>
                    <strong style="color:var(--primary-green); font-size:1.3rem;">${horasRealizadas} / ${horasTotais}h</strong>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${percHoras}%; background:var(--primary-green);"></div></div>
                
                <div style="margin-top:15px; padding-top:15px; border-top:1px dashed #333;">
                    <label style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 8px; display: block;">Atualizar total de horas feitas:</label>
                    <div style="display: flex; gap: 10px;">
                        <input type="number" id="input-fct-horas" value="${horasRealizadas}" placeholder="Ex: 120" style="margin: 0; flex: 1;" class="input-padrao">
                        <button class="primary-btn" style="width: auto; padding: 0 20px;" onclick="window.guardarHorasFCT()"><i class="fa-solid fa-save"></i> Guardar</button>
                    </div>
                </div>
             </div>`;

    // 3. Diário de Bordo (Limpo e organizado)
    const TAREFAS_TURISMO = [
        "Atendimento (Front-Office)", "Gestão de reservas (Check-in/out)", 
        "Apoio a eventos/banquetes", "Limpeza de espaços", 
        "Informação turística", "Gestão de reclamações", "Faturação"
    ];

    html += `<div class="card" style="margin-bottom:20px; border:1px solid #333;">
                <h4 style="color:var(--warning-yellow); font-size:1rem; margin:0 0 10px 0;">Diário de Bordo</h4>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:15px;">Seleciona as tarefas do teu dia para gerar o texto de relatório.</p>
                
                <div style="display:grid; grid-template-columns: 1fr 1fr; gap:10px; margin-bottom:15px; background:rgba(0,0,0,0.15); padding:15px; border-radius:8px;">`;
    
    TAREFAS_TURISMO.forEach((t) => {
        html += `<label style="display:flex; align-items:flex-start; gap:8px; font-size:0.8rem; color:var(--text-light); cursor:pointer;">
                    <input type="checkbox" class="tarefa-fct-chk" value="${t}" style="margin-top:2px;"> <span style="line-height:1.2;">${t}</span>
                 </label>`;
    });

    html += `   </div>
                <textarea id="fct-notas-extra" class="input-padrao" placeholder="Notas adicionais do teu dia... (Opcional)" style="width:100%; height:60px; margin-bottom:10px;"></textarea>
                <button class="primary-btn small-btn" style="width:100%; background:var(--warning-yellow); color:#000; margin-bottom:10px;" onclick="window.gerarTextoDiario()">Gerar Texto Profissional</button>
                
                <div id="resultado-gerador-fct" style="display:none; padding:15px; background:rgba(0,0,0,0.2); border-left:3px solid var(--warning-yellow); border-radius:6px; font-size:0.85rem; color:var(--text-light); line-height:1.5;"></div>
             </div>`;

    return html;
}

// Funções de Gravação
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
        carregarPassaporteDashboard();
    } catch(e) { alert("Erro ao guardar ficha."); btn.innerHTML = 'Guardar Ficha'; }
}

async function guardarHorasFCT() {
    const h = document.getElementById('input-fct-horas').value;
    const btn = event.currentTarget; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), {
            "fct.horasRealizadas": Number(h)
        });
        carregarPassaporteDashboard();
    } catch(e) { alert("Erro ao guardar horas."); btn.innerHTML = '<i class="fa-solid fa-save"></i> Guardar'; }
}

function gerarTextoDiario() {
    const chks = document.querySelectorAll('.tarefa-fct-chk:checked');
    const notas = document.getElementById('fct-notas-extra').value.trim();
    const caixaResultado = document.getElementById('resultado-gerador-fct');
    
    if(chks.length === 0 && notas === '') { alert("Seleciona tarefas ou escreve uma nota!"); return; }

    let textoGerado = "Neste dia de estágio, o meu trabalho focou-se principalmente nas seguintes funções: ";
    let arrTarefas = [];
    chks.forEach(c => arrTarefas.push(c.value.toLowerCase()));
    
    if(arrTarefas.length > 0) {
        if(arrTarefas.length === 1) { textoGerado += arrTarefas[0] + ". "; } 
        else { const ult = arrTarefas.pop(); textoGerado += arrTarefas.join(", ") + " e " + ult + ". "; }
    } else { textoGerado = "Neste dia de estágio, foquei-me em atividades específicas. "; }

    if(notas !== '') { textoGerado += `Adicionalmente, destaco o seguinte: ${notas} `; }
    textoGerado += "O dia decorreu com normalidade, permitindo consolidar os meus conhecimentos práticos em ambiente real de trabalho.";

    caixaResultado.innerHTML = `<strong>Texto para o teu Relatório:</strong><br><br>${textoGerado}<br><br><span style="color:var(--text-muted); font-size:0.75rem;">(Copia este texto e cola no teu documento!)</span>`;
    caixaResultado.style.display = 'block';
}
