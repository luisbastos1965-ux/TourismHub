import { doc, getDoc, updateDoc, arrayUnion } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// Funcionalidades de FCT e PAP
export function setupPassaporte() {
    // Intercetar o clique no botão "Estágio / PAP" ou "FCT (Estágio)"
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

    // Funções globais para os botões do HTML
    window.mudarAbaPassaporte = mudarAbaPassaporte;
    window.gerarTextoDiario = gerarTextoDiario;
    window.guardarFichaEntidade = guardarFichaEntidade;
    window.enviarFicheiroCofre = enviarFicheiroCofre;
}

async function carregarPassaporteDashboard() {
    const cont = document.getElementById('passaporte-dynamic-content');
    if (!cont) return;
    
    cont.innerHTML = '<p class="text-muted center">A carregar o teu Passaporte Profissional...</p>';

    try {
        const mMatch = window.minhaTurma ? window.minhaTurma.match(/\d+/) : null;
        const ano = mMatch ? parseInt(mMatch[0]) : 12; // Assume 12 se não tiver turma
        
        const snap = await getDoc(doc(window.db, "utilizadores", window.myUserId));
        const dados = snap.exists() ? snap.data() : {};
        
        let html = '';

        // TABS DE NAVEGAÇÃO
        if (ano === 12) {
            html += `<div style="display:flex; gap:10px; margin-bottom:20px;">
                        <button class="primary-btn pass-tab-btn active" style="flex:1;" onclick="window.mudarAbaPassaporte('pap')">PAP</button>
                        <button class="secondary-btn pass-tab-btn" style="flex:1;" onclick="window.mudarAbaPassaporte('fct')">FCT (Estágio)</button>
                     </div>`;
            html += `<div id="pass-content-pap">${renderPAP(dados)}</div>`;
            html += `<div id="pass-content-fct" style="display:none;">${renderFCT(dados, false)}</div>`;
        } else if (ano === 11) {
            html += `<div id="pass-content-fct">${renderFCT(dados, true)}</div>`;
        } else {
            html += getEmptyState('O Passaporte Profissional só fica disponível no 11º Ano.', 'fa-lock');
        }

        cont.innerHTML = html;
        
        // Adicionar Listeners do Ficheiro (Cofre)
        document.getElementById('upload-cofre-pap')?.addEventListener('change', processarUploadCofre);
        
    } catch(e) {
        cont.innerHTML = '<p class="text-danger center">Erro ao carregar dados.</p>';
    }
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

function getEmptyState(mensagem, icone = "fa-folder-open") {
    return `<div style="text-align:center; padding: 40px 20px; opacity: 0.5;">
                <i class="fa-solid ${icone}" style="font-size: 3.5rem; margin-bottom: 15px; color: var(--text-muted);"></i>
                <p style="font-size: 0.95rem; color: var(--text-muted);">${mensagem}</p>
            </div>`;
}

// ==========================================
// MÓDULO 1: PAP (PROVA DE APTIDÃO PROFISSIONAL)
// ==========================================
function renderPAP(dados) {
    const pap = dados.pap || {};
    const fases = ['Escolha do Tema', 'Aprovação', 'Desenvolvimento', 'Relatório', 'Apresentação'];
    const faseAtual = pap.faseAtual || 0;
    
    // Progresso Visual (Kanban/Steps)
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
    const orientador = pap.orientadorNome || 'A definir pela escola';
    let perfilHtml = `<div class="card" style="border-left:4px solid var(--accent-purple); margin-bottom:20px; display:flex; align-items:center; gap:15px;">
                        <div style="width:50px; height:50px; border-radius:50%; background:#444; display:flex; align-items:center; justify-content:center; font-size:1.5rem;"><i class="fa-solid fa-user-tie"></i></div>
                        <div>
                            <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Prof. Orientador</span>
                            <h4 style="margin:0; color:var(--text-light); font-size:1.1rem;">${orientador}</h4>
                        </div>
                      </div>`;

    // Cofre de Ficheiros
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

    // Observatório (Histórico de Correções)
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
        if(confirm(`Queres enviar o ficheiro "${f.name}" para o Cofre do Projeto?`)) {
            window.enviarFicheiroCofre();
        }
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
        alert("Ficheiro guardado no cofre com sucesso!");
        carregarPassaporteDashboard(); // Atualiza a página
    } catch(e) { alert("Erro ao guardar ficheiro."); }
}

// ==========================================
// MÓDULO 2: FCT (ESTÁGIO) & DIÁRIO INTELIGENTE
// ==========================================
function renderFCT(dados, is11th) {
    const hj = new Date();
    const isLocked = is11th && hj.getMonth() < 4; // Bloqueado até Maio no 11º ano
    
    if (isLocked) {
        return `<div class="card" style="text-align:center; padding:40px 20px; border:2px dashed var(--primary-green); background:rgba(0,204,136,0.05);">
                    <i class="fa-solid fa-hourglass-half" style="font-size:3rem; color:var(--primary-green); margin-bottom:15px;"></i>
                    <h3 style="color:var(--text-light); margin-bottom:10px;">O Estágio aproxima-se!</h3>
                    <p style="color:var(--text-muted); font-size:0.9rem;">No 11º Ano, o teu estágio (FCT) arranca na reta final do ano letivo. Até lá, foca-te em garantir as melhores notas nas tuas disciplinas técnicas para teres vaga nas melhores empresas de Turismo!</p>
                </div>`;
    }

    const fct = dados.fct || {};
    const horasRealizadas = fct.horasRealizadas || 0;
    const horasTotais = fct.horasTotal || 400; // Padrão FCT
    const percHoras = Math.min((horasRealizadas / horasTotais) * 100, 100);

    // 1. Resumo de Horas (Progress Bar)
    let html = `<div class="card" style="margin-bottom:20px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
                        <div>
                            <h4 style="color:var(--text-light); font-size:1.1rem; margin:0 0 5px 0;">O teu Estágio</h4>
                            <span style="font-size:0.85rem; color:var(--text-muted);">Progresso de Horas Oficiais</span>
                        </div>
                        <strong style="color:var(--primary-green); font-size:1.3rem;">${horasRealizadas} / ${horasTotais}h</strong>
                    </div>
                    <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${percHoras}%; background:var(--primary-green);"></div></div>
                </div>`;

    // 2. Ficha da Entidade
    html += `<div class="card" style="margin-bottom:20px; border-left:4px solid #0ea5e9;">
                <h4 style="color:var(--text-light); font-size:1rem; margin:0 0 15px 0;"><i class="fa-solid fa-building"></i> Entidade de Acolhimento</h4>
                <input type="text" id="fct-empresa" class="auth-input" placeholder="Nome da Empresa / Hotel" value="${fct.empresa || ''}" style="margin-bottom:10px;">
                <input type="text" id="fct-tutor" class="auth-input" placeholder="Nome do Tutor na Empresa" value="${fct.tutor || ''}" style="margin-bottom:10px;">
                <button class="secondary-btn small-btn" style="width:100%;" onclick="window.guardarFichaEntidade()">Guardar Ficha</button>
             </div>`;

    // 3. DIÁRIO DE BORDO INTELIGENTE (O Pulo do Gato!)
    const TAREFAS_TURISMO = [
        "Atendimento ao cliente (Front-Office)", "Gestão de reservas (Check-in/Check-out)", 
        "Apoio a eventos/banquetes", "Limpeza e arrumação de espaços", 
        "Prestação de informação turística e cultural", "Gestão de reclamações", "Faturação e fecho de caixa"
    ];

    html += `<div class="card" style="margin-bottom:20px; border:1px solid #333;">
                <h4 style="color:var(--warning-yellow); font-size:1rem; margin:0 0 10px 0;"><i class="fa-solid fa-pen-nib"></i> Gerador de Diário de Bordo</h4>
                <p style="font-size:0.8rem; color:var(--text-muted); margin-bottom:15px;">Seleciona as tarefas que fizeste hoje para a App gerar o teu texto automaticamente para o relatório!</p>
                
                <div style="display:flex; flex-direction:column; gap:8px; margin-bottom:15px;">`;
    
    TAREFAS_TURISMO.forEach((t, i) => {
        html += `<label style="display:flex; align-items:center; gap:10px; font-size:0.85rem; color:var(--text-light); cursor:pointer;">
                    <input type="checkbox" class="tarefa-fct-chk" value="${t}" style="margin:0;"> ${t}
                 </label>`;
    });

    html += `   </div>
                <textarea id="fct-notas-extra" class="auth-input" placeholder="Alguma nota extra a acrescentar? (Ex: Hoje aprendi a usar o software PMS...)" style="height:60px; margin-bottom:10px;"></textarea>
                <button class="primary-btn small-btn" style="width:100%; background:var(--warning-yellow); color:#000; margin-bottom:15px;" onclick="window.gerarTextoDiario()">Gerar Texto Profissional <i class="fa-solid fa-wand-magic-sparkles"></i></button>
                
                <div id="resultado-gerador-fct" style="display:none; padding:15px; background:rgba(0,0,0,0.2); border-left:3px solid var(--warning-yellow); border-radius:6px; font-size:0.85rem; color:var(--text-light); line-height:1.5;"></div>
             </div>`;

    return html;
}

async function guardarFichaEntidade() {
    const emp = document.getElementById('fct-empresa').value.trim();
    const tut = document.getElementById('fct-tutor').value.trim();
    const btn = event.currentTarget; btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    try {
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), {
            "fct.empresa": emp, "fct.tutor": tut
        });
        setTimeout(() => { btn.innerHTML = '<i class="fa-solid fa-check"></i> Guardado'; }, 500);
    } catch(e) { alert("Erro ao guardar ficha."); btn.innerHTML = 'Guardar Ficha'; }
}

function gerarTextoDiario() {
    const chks = document.querySelectorAll('.tarefa-fct-chk:checked');
    const notas = document.getElementById('fct-notas-extra').value.trim();
    const caixaResultado = document.getElementById('resultado-gerador-fct');
    
    if(chks.length === 0 && notas === '') {
        alert("Seleciona tarefas ou escreve uma nota para gerar o texto!"); return;
    }

    let textoGerado = "Neste dia de estágio, o meu trabalho focou-se principalmente nas seguintes funções: ";
    let arrTarefas = [];
    chks.forEach(c => arrTarefas.push(c.value.toLowerCase()));
    
    if(arrTarefas.length > 0) {
        if(arrTarefas.length === 1) {
            textoGerado += arrTarefas[0] + ". ";
        } else {
            const ult = arrTarefas.pop();
            textoGerado += arrTarefas.join(", ") + " e " + ult + ". ";
        }
    } else {
        textoGerado = "Neste dia de estágio, foquei-me em atividades específicas. ";
    }

    if(notas !== '') {
        textoGerado += `Adicionalmente, destaco o seguinte: ${notas} `;
    }

    textoGerado += "O dia decorreu com normalidade, permitindo consolidar os meus conhecimentos práticos em ambiente real de trabalho.";

    caixaResultado.innerHTML = `<strong>Texto para o teu Relatório:</strong><br><br>${textoGerado}<br><br><span style="color:var(--text-muted); font-size:0.75rem;">(Copia este texto e cola no teu documento word do Diário de Bordo!)</span>`;
    caixaResultado.style.display = 'block';
}
