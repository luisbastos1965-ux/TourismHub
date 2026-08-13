import { doc, getDoc, updateDoc, arrayUnion, setDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

// ==========================================
// UTILITÁRIOS E MODAIS
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

function confirmarAcao(mensagem) {
    return new Promise((resolve) => {
        const bg = document.createElement('div');
        bg.className = 'modal-overlay';
        bg.style.display = 'flex'; bg.style.zIndex = '10000';
        bg.innerHTML = `
            <div class="action-sheet" style="max-width:350px; border-radius:12px; margin:20px; text-align: center; animation: fadeSlide 0.3s ease; padding: 25px 20px;">
                <i class="fa-solid fa-circle-question" style="font-size: 3rem; color: var(--primary-green); margin-bottom: 20px;"></i>
                <h3 style="margin-bottom: 25px; color: var(--text-light); font-size:1.1rem; line-height:1.4;">${mensagem}</h3>
                <div style="display:flex; gap:10px;">
                    <button id="btn-no" class="secondary-btn" style="flex:1; padding: 12px;">Cancelar</button>
                    <button id="btn-yes" class="primary-btn" style="flex:1; padding: 12px;">Confirmar</button>
                </div>
            </div>`;
        document.body.appendChild(bg);
        bg.querySelector('#btn-no').onclick = () => { bg.remove(); resolve(false); };
        bg.querySelector('#btn-yes').onclick = () => { bg.remove(); resolve(true); };
    });
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

window.papTextosGlobais = {};
window.cofreAtual = [];
window.historicoFCTAtual = [];

// Variáveis do Cronómetro da PAP
let papTimerInterval = null;
let papTimeLeft = 15 * 60; 

export function setupPassaporte() {
    document.getElementById('btn-abrir-passaporte')?.addEventListener('click', async (e) => {
        const mMatch = window.minhaTurma ? window.minhaTurma.match(/\d+/) : null;
        const ano = mMatch ? parseInt(mMatch[0]) : 12; 
        const snap = await getDoc(doc(window.db, "utilizadores", window.myUserId));
        const dados = snap.exists() ? snap.data() : {};
        const fctBloqueada = dados.fctBloqueada !== false;

        if (ano === 11 && fctBloqueada) {
            e.preventDefault();
            mostrarAlerta("O acesso à FCT aguarda desbloqueio pela Coordenação.", true);
            return;
        }

        document.querySelectorAll('.app-content > div:not(.modal-overlay)').forEach(d => d.style.display = 'none');
        document.getElementById('view-aluno-passaporte').style.display = 'block';
        carregarPassaporteDashboard(dados, ano, (ano === 12 ? 'pap' : 'fct'));
    });
    
    document.getElementById('btn-voltar-passaporte')?.addEventListener('click', () => {
        if(papTimerInterval) clearInterval(papTimerInterval);
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
    window.abrirModalHistoricoFCT = abrirModalHistoricoFCT;
    window.abrirChatOrientadorPAP = abrirChatOrientadorPAP;
    window.submeterDocBurocracia = submeterDocBurocracia;
    
    // PAP
    window.guardarTemaPAP = guardarTemaPAP;
    window.toggleEditTemaPAP = toggleEditTemaPAP;
    window.mudarTopicoPAP = mudarTopicoPAP;
    window.guardarTopicoPAP = guardarTopicoPAP;
    window.compilarRelatorioPAP = compilarRelatorioPAP;
    window.toggleTimer = toggleTimer;
    window.resetTimer = resetTimer;
}

async function carregarPassaporteDashboard(dados = null, ano = null, abaForcada = null) {
    const cont = document.getElementById('passaporte-dynamic-content');
    if (!cont) return;
    
    if (!dados) {
        cont.innerHTML = '<p class="text-muted center">A carregar os teus dados...</p>';
        try {
            const mMatch = window.minhaTurma ? window.minhaTurma.match(/\d+/) : null;
            ano = mMatch ? parseInt(mMatch[0]) : 12; 
            const snap = await getDoc(doc(window.db, "utilizadores", window.myUserId));
            dados = snap.exists() ? snap.data() : {};
        } catch(e) { cont.innerHTML = '<p class="text-danger center">Erro ao carregar dados.</p>'; return; }
    }
    
    window.papTextosGlobais = (dados.pap && dados.pap.textos) ? dados.pap.textos : {};
    window.cofreAtual = (dados.pap && dados.pap.cofre) ? dados.pap.cofre : [];
    window.historicoFCTAtual = (dados.fct && dados.fct.historicoHoras) ? dados.fct.historicoHoras : [];

    let html = '';
    const activePAP = (abaForcada === 'pap' || (!abaForcada && ano === 12)) ? 'active primary-btn' : 'secondary-btn';
    const activeFCT = (abaForcada === 'fct' || ano === 11) ? 'active primary-btn' : 'secondary-btn';

    if (ano === 12) {
        html += `<div style="display:flex; gap:10px; margin-bottom:20px;">
                    <button class="${activePAP} pass-tab-btn" style="flex:1;" onclick="window.mudarAbaPassaporte('pap')">PAP</button>
                    <button class="${activeFCT} pass-tab-btn" style="flex:1;" onclick="window.mudarAbaPassaporte('fct')">FCT (Estágio)</button>
                 </div>`;
        html += `<div id="pass-content-pap" style="display:${activePAP.includes('active') ? 'block' : 'none'};">${renderPAP(dados)}</div>`;
        html += `<div id="pass-content-fct" style="display:${activeFCT.includes('active') ? 'block' : 'none'};">${renderFCT(dados)}</div>`;
    } else if (ano === 11) {
        html += `<div id="pass-content-fct">${renderFCT(dados)}</div>`;
    }

    cont.innerHTML = html;
    document.getElementById('upload-cofre-pap')?.addEventListener('change', processarUploadCofre);
    if(ano === 12 && activePAP.includes('active')) window.mudarTopicoPAP();
    resetTimer(); 
}

window.recarregarViewPassaporte = async function(abaForcada) {
    await carregarPassaporteDashboard(null, null, abaForcada);
};

function mudarAbaPassaporte(aba) {
    if(papTimerInterval) clearInterval(papTimerInterval);
    document.querySelectorAll('.pass-tab-btn').forEach(b => {
        b.classList.remove('primary-btn'); b.classList.add('secondary-btn'); b.classList.remove('active');
    });
    event.currentTarget.classList.remove('secondary-btn');
    event.currentTarget.classList.add('primary-btn');
    event.currentTarget.classList.add('active');
    
    document.getElementById('pass-content-pap').style.display = aba === 'pap' ? 'block' : 'none';
    document.getElementById('pass-content-fct').style.display = aba === 'fct' ? 'block' : 'none';
    
    if (aba === 'pap') { window.mudarTopicoPAP(); resetTimer(); }
}

// ==========================================
// MÓDULO 1: PAP (PROJETO FINAL)
// ==========================================
function renderPAP(dados) {
    const pap = dados.pap || {};
    const fases = ['Tema', 'Aprovação', 'Desenv.', 'Relatório', 'Apresentação'];
    const faseAtual = pap.faseAtual || 0;
    const temaStr = pap.tema || '';
    const orientador = pap.orientadorNome || 'A definir';
    
    let html = '';

    // PROGRESSO
    html += `<div style="display:flex; justify-content:space-between; position:relative; margin-bottom:30px;">
                <div style="position:absolute; top:15px; left:0; right:0; height:3px; background:#333; z-index:1;"></div>
                <div style="position:absolute; top:15px; left:0; width:${(faseAtual/(fases.length-1))*100}%; height:3px; background:var(--primary-green); z-index:1; transition:0.5s;"></div>`;
    fases.forEach((f, i) => {
        const isDone = i <= faseAtual; const color = isDone ? 'var(--primary-green)' : '#333';
        html += `<div style="position:relative; z-index:2; text-align:center; width:20%;">
                    <div style="width:30px; height:30px; background:var(--bg-dark); border:3px solid ${color}; border-radius:50%; margin:0 auto 5px auto; display:flex; align-items:center; justify-content:center;">
                        ${isDone ? `<i class="fa-solid fa-check" style="color:${color}; font-size:0.7rem;"></i>` : ''}
                    </div><span style="font-size:0.65rem; color:var(--text-muted); text-transform:uppercase;">${f}</span>
                 </div>`;
    });
    html += `</div>`;

    // TEMA DA PAP COM BLOQUEIO E EDIÇÃO
    html += `<div class="card" style="margin-bottom:20px; border-left:4px solid var(--primary-green);">
                <h4 style="color:var(--text-light); font-size:1rem; margin:0 0 10px 0;"><i class="fa-solid fa-lightbulb"></i> Tema do Projeto</h4>
                <div style="display:flex; gap:10px; align-items:stretch;">
                    <input type="text" id="input-pap-tema" class="input-padrao" placeholder="Escreve aqui o teu tema..." value="${temaStr}" ${temaStr ? 'disabled' : ''} style="flex:1; margin:0; height:42px; ${temaStr ? 'opacity:0.7; cursor:not-allowed;' : ''}">
                    <button id="btn-edit-tema" onclick="window.toggleEditTemaPAP()" class="secondary-btn small-btn" style="width:50px; margin:0; height:42px; display:${temaStr ? 'flex' : 'none'}; align-items:center; justify-content:center; padding:0;"><i class="fa-solid fa-pen"></i></button>
                    <button id="btn-save-tema" onclick="window.guardarTemaPAP()" class="primary-btn small-btn" style="width:50px; margin:0; height:42px; display:${temaStr ? 'none' : 'flex'}; align-items:center; justify-content:center; padding:0;"><i class="fa-solid fa-save"></i></button>
                </div>
             </div>`;

    // PROF ORIENTADOR
    html += `<div class="card" style="border-left:4px solid var(--accent-purple); margin-bottom:20px; display:flex; align-items:center; justify-content:space-between; gap:15px;">
                <div style="display:flex; align-items:center; gap:15px;">
                    <div style="width:50px; height:50px; border-radius:50%; background:#444; display:flex; align-items:center; justify-content:center; font-size:1.5rem;"><i class="fa-solid fa-user-tie"></i></div>
                    <div>
                        <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">Prof. Orientador</span>
                        <h4 style="margin:0; color:var(--text-light); font-size:1.1rem;">${orientador}</h4>
                    </div>
                </div>
                <button class="primary-btn small-btn" style="width:45px; height:45px; border-radius:50%; background:var(--accent-purple); color:white; padding:0; display:flex; align-items:center; justify-content:center;" onclick="window.abrirChatOrientadorPAP('${orientador}')" title="Mensagem Direta"><i class="fa-solid fa-envelope" style="font-size:1.2rem;"></i></button>
             </div>`;

    // OBSERVATÓRIO
    html += `<div class="card" style="margin-bottom:20px;">
                <h4 style="color:var(--warning-yellow); font-size:1rem; margin:0 0 15px 0;"><i class="fa-solid fa-eye"></i> Observatório do Orientador</h4>`;
    if(pap.observatorio && pap.observatorio.length > 0) {
        pap.observatorio.forEach(o => {
            html += `<div style="border-left:3px solid var(--warning-yellow); padding:10px 15px; background:rgba(245, 158, 11, 0.05); margin-bottom:10px; border-radius:6px;">
                        <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-muted); margin-bottom:5px;"><span>Prof. ${o.autor}</span><span>${o.data}</span></div>
                        <p style="font-size:0.9rem; color:var(--text-light); margin:0;">${o.texto}</p>
                     </div>`;
        });
    } else { html += `<p style="font-size:0.85rem; color:var(--text-muted); margin:0;">Ainda não tens retificações do teu orientador.</p>`; }
    html += `</div>`;

    // COFRE
    html += `<div class="card" style="margin-bottom:20px; border:1px solid #333;">
                <h4 style="color:var(--text-light); font-size:1rem; margin:0 0 15px 0;"><i class="fa-solid fa-vault"></i> Cofre do Projeto</h4>
                <div style="display:flex; flex-direction:column; gap:10px;" id="lista-cofre-pap">`;
    if(window.cofreAtual.length > 0) {
        window.cofreAtual.forEach((f, idx) => {
            html += `<div style="display:flex; justify-content:space-between; align-items:center; padding:10px; background:rgba(0,0,0,0.2); border-radius:6px; border-left: 2px solid var(--primary-green);">
                        <div style="font-size:0.85rem; color:var(--text-light); flex:1; overflow:hidden; white-space:nowrap; text-overflow:ellipsis; cursor:pointer;" onclick="window.verFicheiroCofre(${idx})">
                            <i class="fa-solid fa-file-lines" style="color:var(--primary-green); margin-right:5px;"></i> <strong style="text-decoration:underline;">${f.nome}</strong>
                        </div>
                        <div style="display:flex; align-items:center; gap:8px;">
                            <button onclick="window.verFicheiroCofre(${idx})" class="secondary-btn small-btn" style="padding:8px 12px; color:var(--primary-green);" title="Visualizar / Transferir"><i class="fa-solid fa-eye"></i></button>
                            <button onclick="window.removerFicheiroCofre(${idx})" class="secondary-btn small-btn" style="padding:8px 12px; color:var(--danger-red);" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                        </div>
                     </div>`;
        });
    } else { html += `<p style="font-size:0.85rem; color:var(--text-muted); margin:0;">O teu cofre está vazio.</p>`; }
    html += `   </div>
                <div style="margin-top:15px;">
                    <label for="upload-cofre-pap" class="primary-btn small-btn" style="display:inline-block; cursor:pointer;"><i class="fa-solid fa-upload"></i> Submeter Documento</label>
                    <input type="file" id="upload-cofre-pap" style="display:none;" accept=".pdf,.doc,.docx,.ppt,.pptx,.png,.jpg,.jpeg">
                </div>
             </div>`;

    // RELATÓRIO MOBILE DESAGREGADO
    const TOPICOS_PAP = [
        'Introdução', 'Conceitos / Revisão Literária', 
        'Projeto - Motivação', 'Projeto - Caracterização', 'Projeto - Conceito e Descrição', 
        'Plano de Marketing - Público-Alvo', 'Plano de Marketing - Marketing-Mix', 'Plano de Marketing - Concorrência', 'Plano de Marketing - Análise SWOT', 
        'Micro-Projeto', 'Conclusão', 'Agradecimentos', 'Referências Bibliográficas'
    ];
    
    html += `<div class="card" style="margin-bottom:20px; border-left:4px solid #f97316;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h4 style="color:var(--text-light); font-size:1rem; margin:0;"><i class="fa-solid fa-mobile-screen"></i> Relatório Mobile</h4>
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
                <div id="pap-relatorio-compilado" style="display:none; margin-top:15px; padding:20px; background:rgba(0,0,0,0.3); border-radius:8px; font-size:0.9rem; color:var(--text-light); white-space:pre-wrap; border:1px solid #333; line-height: 1.6;"></div>
             </div>`;

    // GUIA IA PROMPTS (MUITO MAIS ROBUSTO E ADAPTADO AO TEMA)
    const pTema = temaStr ? temaStr : "[Insere aqui o Teu Tema]";
    html += `<div class="card" style="margin-bottom:20px; border-left:4px solid #3b82f6;">
                <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('i.fa-chevron-down').classList.toggle('fa-flip-vertical');">
                    <h4 style="color:var(--text-light); font-size:1rem; margin:0;"><i class="fa-solid fa-robot" style="color:#3b82f6;"></i> Guia PAP & Prompts IA</h4>
                    <i class="fa-solid fa-chevron-down" style="color:var(--text-muted); transition:0.3s;"></i>
                </div>
                <div style="display:none; margin-top:15px;">
                    <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:15px;">A Inteligência Artificial (ChatGPT/Gemini) ajuda-te a estruturar ideias perante a exigência do Júri, mas <strong>não escreve o projeto por ti!</strong> Copia e cola os textos azuis abaixo para obteres orientação técnica focada no teu tema:</p>
                    
                    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; margin-bottom:10px;">
                        <strong style="color:var(--text-light); font-size:0.85rem;">1. Introdução e Motivação</strong>
                        <p style="font-size:0.8rem; color:#3b82f6; margin:5px 0 0 0; font-family:monospace; line-height:1.4;">"Atua como um professor especialista em Turismo. O tema da minha PAP é '${pTema}'. Escreve-me uma fundamentação rigorosa que justifique a importância deste projeto para o desenvolvimento turístico regional e descreve uma motivação pessoal forte para a escolha deste tema."</p>
                    </div>

                    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; margin-bottom:10px;">
                        <strong style="color:var(--text-light); font-size:0.85rem;">2. Revisão Literária e Conceitos</strong>
                        <p style="font-size:0.8rem; color:#3b82f6; margin:5px 0 0 0; font-family:monospace; line-height:1.4;">"Indica-me os 4 principais conceitos teóricos sobre turismo e gestão que eu devo abordar na revisão literária de um projeto focado em '${pTema}'. Dá-me uma breve explicação académica de cada um para eu perceber a sua evolução."</p>
                    </div>

                    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; margin-bottom:10px;">
                        <strong style="color:var(--text-light); font-size:0.85rem;">3. Marketing-Mix (Os 4 P's)</strong>
                        <p style="font-size:0.8rem; color:#3b82f6; margin:5px 0 0 0; font-family:monospace; line-height:1.4;">"Cria uma proposta técnica de Marketing-Mix (Produto, Preço, Distribuição, Promoção) para o projeto '${pTema}'. Detalha os serviços turísticos, sugere uma estratégia de preços, canais de venda (reservas diretas vs OTAs) e uma campanha promocional digital."</p>
                    </div>

                    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; margin-bottom:10px;">
                        <strong style="color:var(--text-light); font-size:0.85rem;">4. Público-Alvo e Concorrência</strong>
                        <p style="font-size:0.8rem; color:#3b82f6; margin:5px 0 0 0; font-family:monospace; line-height:1.4;">"Define o perfil do turista ideal (idades, interesses, origens) para '${pTema}'. De seguida, ajuda-me a identificar 3 tipos de concorrentes diretos ou indiretos que eu possa ter na minha região e como me posso diferenciar deles."</p>
                    </div>

                    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; margin-bottom:10px;">
                        <strong style="color:var(--text-light); font-size:0.85rem;">5. Análise SWOT</strong>
                        <p style="font-size:0.8rem; color:#3b82f6; margin:5px 0 0 0; font-family:monospace; line-height:1.4;">"Elabora uma Análise SWOT (Forças, Fraquezas, Oportunidades, Ameaças) realista para '${pTema}'. Usa como 'Força' a inovação do serviço e como 'Fraqueza' a eventual sazonalidade ou os custos iniciais. Dá 3 exemplos para cada quadrante."</p>
                    </div>
                    
                    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; margin-bottom:10px;">
                        <strong style="color:var(--text-light); font-size:0.85rem;">6. Viabilidade, Orçamento e Sustentabilidade</strong>
                        <p style="font-size:0.8rem; color:#3b82f6; margin:5px 0 0 0; font-family:monospace; line-height:1.4;">"Que tipo de custos iniciais e despesas fixas devo considerar para avaliar a viabilidade económica de '${pTema}'? Para além da vertente financeira, dá-me 3 medidas práticas de sustentabilidade ambiental que eu possa implementar no meu modelo de negócio."</p>
                    </div>

                    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; margin-bottom:10px;">
                        <strong style="color:var(--text-light); font-size:0.85rem;">7. Micro-Projeto</strong>
                        <p style="font-size:0.8rem; color:#3b82f6; margin:5px 0 0 0; font-family:monospace; line-height:1.4;">"A minha PAP sobre '${pTema}' exige um 'Micro-Projeto' complementar (uma pequena ação prática, evento ou teste). Sugere-me 3 ideias criativas e exequíveis que eu possa realizar na escola ou na comunidade local para demonstrar o valor do meu projeto."</p>
                    </div>

                    <div style="background:rgba(0,0,0,0.2); padding:10px; border-radius:6px;">
                        <strong style="color:var(--text-light); font-size:0.85rem;">8. Conclusão e Impacto no Território</strong>
                        <p style="font-size:0.8rem; color:#3b82f6; margin:5px 0 0 0; font-family:monospace; line-height:1.4;">"Quais devem ser os 3 pontos finais a destacar na conclusão de um projeto sobre '${pTema}' para demonstrar o impacto social, económico e turístico positivo no território, deixando o júri com uma excelente impressão da viabilidade?"</p>
                    </div>
                </div>
             </div>`;

    // SIMULADOR DE DEFESA
    html += `<div class="card" style="margin-bottom:20px; border-left:4px solid #ef4444;">
                <div style="display:flex; justify-content:space-between; align-items:center; cursor:pointer;" onclick="this.nextElementSibling.style.display = this.nextElementSibling.style.display === 'none' ? 'block' : 'none'; this.querySelector('i.fa-chevron-down').classList.toggle('fa-flip-vertical');">
                    <h4 style="color:var(--text-light); font-size:1rem; margin:0;"><i class="fa-solid fa-stopwatch" style="color:#ef4444;"></i> Simulador de Defesa (Pitch)</h4>
                    <i class="fa-solid fa-chevron-down" style="color:var(--text-muted); transition:0.3s;"></i>
                </div>
                <div style="display:none; margin-top:15px;">
                    <div style="text-align:center; padding:20px; background:rgba(0,0,0,0.2); border-radius:8px; margin-bottom:15px; border:1px solid #333;">
                        <div id="pap-timer-display" style="font-size:3rem; font-family:monospace; color:var(--primary-green); font-weight:bold; margin-bottom:15px; line-height:1;">15:00</div>
                        <div style="display:flex; gap:10px; justify-content:center;">
                            <button class="primary-btn small-btn" id="btn-timer-start" style="width:auto; min-width:100px;" onclick="window.toggleTimer()"><i class="fa-solid fa-play"></i> Iniciar</button>
                            <button class="secondary-btn small-btn" style="width:auto; min-width:100px;" onclick="window.resetTimer()"><i class="fa-solid fa-rotate-left"></i> Reset</button>
                        </div>
                    </div>
                    
                    <h5 style="color:var(--text-light); margin-bottom:10px; font-size:0.9rem;">Dicas de Apresentação:</h5>
                    <ul style="font-size:0.8rem; color:var(--text-muted); padding-left:20px; margin-bottom:15px; line-height:1.5;">
                        <li><strong>Postura:</strong> Mantém o contacto visual com o júri, não leias os slides.</li>
                        <li><strong>Respiração:</strong> Faz pausas de 2 segundos ao mudar de slide para controlares os nervos.</li>
                        <li><strong>Foco:</strong> Dedica a maior parte do tempo à Viabilidade e Inovação do projeto.</li>
                    </ul>

                    <h5 style="color:var(--warning-yellow); margin-bottom:10px; font-size:0.9rem;">Grelha de Avaliação do Júri:</h5>
                    <div style="background:rgba(255, 204, 0, 0.05); border-left:3px solid var(--warning-yellow); padding:10px; border-radius:6px; font-size:0.8rem; color:var(--text-light);">
                        <p style="margin:0 0 5px 0;"><strong>Avaliação do Projeto:</strong></p>
                        <ul style="margin:0 0 10px 0; padding-left:15px; color:var(--text-muted);">
                            <li>Qualidade técnica e Grau de Inovação</li>
                            <li>Utilidade e Viabilidade de implementação</li>
                            <li>Impacto económico, ambiental e social</li>
                        </ul>
                        <p style="margin:0 0 5px 0;"><strong>Avaliação da Apresentação:</strong></p>
                        <ul style="margin:0; padding-left:15px; color:var(--text-muted);">
                            <li>Qualidade da apresentação e recursos utilizados</li>
                            <li>Utilização da linguagem técnica do Turismo</li>
                            <li>Argumentação e segurança nas respostas</li>
                        </ul>
                    </div>
                </div>
             </div>`;

    return html;
}

// Funções da PAP
window.toggleEditTemaPAP = function() {
    const inp = document.getElementById('input-pap-tema');
    inp.disabled = false;
    inp.style.opacity = '1';
    inp.style.cursor = 'text';
    inp.focus();
    document.getElementById('btn-edit-tema').style.display = 'none';
    document.getElementById('btn-save-tema').style.display = 'flex';
};

async function guardarTemaPAP() {
    const t = document.getElementById('input-pap-tema').value.trim();
    if(!t) { mostrarAlerta("Escreve um tema primeiro!"); return; }
    try {
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), { "pap.tema": t });
        mostrarAlerta("Tema guardado!", false); window.recarregarViewPassaporte('pap');
    } catch(e) { mostrarAlerta("Erro ao guardar tema."); }
}

let ficheiroParaCofre = null;
async function processarUploadCofre(e) {
    const f = e.target.files[0]; if(!f) return;
    if (f.size > 800 * 1024) {
        mostrarAlerta("O ficheiro é muito pesado! Por favor, reduz o tamanho para menos de 800KB.", true);
        e.target.value = ''; return;
    }
    const r = new FileReader();
    r.onload = async () => { 
        ficheiroParaCofre = { nome: f.name, base64: r.result };
        const confirmou = await confirmarAcao(`Queres enviar o documento "${f.name}" para o teu Cofre?`);
        if(confirmou) window.enviarFicheiroCofre();
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
        mostrarAlerta("Documento submetido no Cofre!", false); window.recarregarViewPassaporte('pap'); 
    } catch(e) { mostrarAlerta("Erro ao guardar ficheiro."); }
}

function verFicheiroCofre(index) {
    const f = window.cofreAtual[index]; if(!f) return;
    
    let isPdf = f.base64.startsWith("data:application/pdf");
    let isImage = f.base64.startsWith("data:image");
    
    if (isPdf || isImage) {
        const mime = isPdf ? 'application/pdf' : f.base64.split(';')[0].split(':')[1];
        let blobUrl = base64ToBlobUrl(f.base64, mime);
        
        const bg = document.createElement('div');
        bg.className = 'modal-overlay';
        bg.style.display = 'flex'; bg.style.zIndex = '10000';
        bg.innerHTML = `
            <div class="action-sheet" style="width:95%; height:90%; max-width:800px; border-radius:12px; margin:20px; display:flex; flex-direction:column; padding:15px; animation: fadeSlide 0.3s ease;">
                <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:15px;">
                    <h3 style="color:var(--text-light); font-size:1.1rem; margin:0; flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">${f.nome}</h3>
                    <button id="btn-close-view" style="background:none; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
                </div>
                ${isPdf 
                    ? `<object data="${blobUrl}" type="application/pdf" style="flex:1; width:100%; border:none; background:white; border-radius:8px;"><p style="text-align:center; padding:20px; color:#333;">O teu telemóvel não suporta visualização direta de PDFs aqui. <br><br><a href="${blobUrl}" download="${f.nome}" style="background:var(--primary-green); color:#fff; padding:10px 20px; border-radius:8px; display:inline-block; text-decoration:none;">Transferir PDF</a></p></object>` 
                    : `<img src="${blobUrl}" style="width:100%; max-height: 70vh; object-fit: contain; border-radius:8px;">`}
            </div>`;
        document.body.appendChild(bg);
        bg.querySelector('#btn-close-view').onclick = () => bg.remove();
    } else {
        mostrarAlerta("A preparar a transferência do documento (Word/PPT)...", false);
        window.baixarFicheiroCofre(index);
    }
}

async function baixarFicheiroCofre(index) {
    const f = window.cofreAtual[index]; if(!f) return;
    const a = document.createElement("a");
    a.href = f.base64; a.download = f.nome;
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
}

async function removerFicheiroCofre(index) {
    const confirmou = await confirmarAcao("Tens a certeza absoluta que queres eliminar este documento do Cofre?");
    if(!confirmou) return;
    window.cofreAtual.splice(index, 1);
    try {
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), { "pap.cofre": window.cofreAtual });
        mostrarAlerta("Documento eliminado.", false); window.recarregarViewPassaporte('pap'); 
    } catch(e) { mostrarAlerta("Erro ao eliminar documento."); }
}

async function abrirChatOrientadorPAP(orientadorNome) {
    if(!orientadorNome || orientadorNome === 'A definir') { mostrarAlerta("Ainda não tens orientador atribuído."); return; }
    const chatId = `chat_pap_${window.myUserId}`; const chatNome = `Orientador: ${orientadorNome}`;
    try {
        const chatRef = doc(window.db, "forums", chatId); const chatSnap = await getDoc(chatRef);
        if(!chatSnap.exists()) { await setDoc(chatRef, { nome: chatNome, isGlobal: false, criador: window.myUserId, participantes: [window.myUserId], dataCriacao: Date.now(), lastMessage: null, unread: {}, type: 'fixo' }); }
        document.querySelector('.nav-item[data-target="view-aluno-forum"]').click();
        setTimeout(() => { window.abrirChatForumAluno(chatId, chatNome); }, 300);
    } catch(e) { mostrarAlerta("Erro ao iniciar conversa."); }
}

function mudarTopicoPAP() {
    const sel = document.getElementById('pap-topico-select').value;
    const customInput = document.getElementById('pap-topico-custom');
    const txtArea = document.getElementById('pap-topico-texto');
    if(sel === 'novo') { customInput.style.display = 'block'; txtArea.value = ''; } 
    else { customInput.style.display = 'none'; txtArea.value = window.papTextosGlobais[sel] || ''; }
}

async function guardarTopicoPAP() {
    let sel = document.getElementById('pap-topico-select').value;
    if(sel === 'novo') {
        sel = document.getElementById('pap-topico-custom').value.trim();
        if(!sel) { mostrarAlerta("Dá um nome ao teu novo tópico."); return; }
    }
    window.papTextosGlobais[sel] = document.getElementById('pap-topico-texto').value;
    try {
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), { "pap.textos": window.papTextosGlobais });
        mostrarAlerta(`Tópico guardado com sucesso!`, false);
    } catch(e) { mostrarAlerta("Erro ao guardar o texto."); }
}

function compilarRelatorioPAP() {
    const caixa = document.getElementById('pap-relatorio-compilado');
    let relatorioFinal = "";
    for (const [topico, texto] of Object.entries(window.papTextosGlobais)) {
        if(texto.trim() !== '') { relatorioFinal += `======= [ ${topico.toUpperCase()} ] =======\n\n${texto}\n\n\n`; }
    }
    if(relatorioFinal === "") { mostrarAlerta("Ainda não escreveste texto em nenhum tópico."); return; }
    caixa.innerHTML = `<div style="text-align:center; margin-bottom:15px;"><strong style="font-size:1.1rem; color:var(--primary-green);">O Teu Relatório Completo</strong><br><span style="color:var(--text-muted); font-size:0.75rem;">(Copia tudo e cola no teu Word!)</span></div>${relatorioFinal}`;
    caixa.style.display = 'block';
}

// Simulador de Defesa Funções
function updateTimerDisplay() {
    const m = Math.floor(papTimeLeft / 60).toString().padStart(2, '0');
    const s = (papTimeLeft % 60).toString().padStart(2, '0');
    const display = document.getElementById('pap-timer-display');
    if(display) {
        display.innerText = `${m}:${s}`;
        if(papTimeLeft <= 60) display.style.color = 'var(--danger-red)';
        else display.style.color = 'var(--primary-green)';
    }
}

function toggleTimer() {
    const btn = document.getElementById('btn-timer-start');
    if (papTimerInterval) {
        clearInterval(papTimerInterval); papTimerInterval = null;
        if(btn) btn.innerHTML = '<i class="fa-solid fa-play"></i> Continuar';
    } else {
        if(btn) btn.innerHTML = '<i class="fa-solid fa-pause"></i> Pausa';
        papTimerInterval = setInterval(() => {
            papTimeLeft--;
            if(papTimeLeft <= 0) { clearInterval(papTimerInterval); papTimerInterval = null; papTimeLeft = 0; }
            updateTimerDisplay();
        }, 1000);
    }
}

function resetTimer() {
    if(papTimerInterval) clearInterval(papTimerInterval);
    papTimerInterval = null;
    papTimeLeft = 15 * 60;
    const btn = document.getElementById('btn-timer-start');
    if(btn) btn.innerHTML = '<i class="fa-solid fa-play"></i> Iniciar';
    updateTimerDisplay();
}

// ==========================================
// MÓDULO 2: FCT (ESTÁGIO) E BANCO DE HORAS
// ==========================================
function renderFCT(dados) {
    const fct = dados.fct || {};
    let html = '';

    // 1. Checklist Burocrática (Visual Simétrico)
    const burocracia = fct.burocracia || {};
    const docsBurocracia = [
        { id: 'protocolo', nome: 'Protocolo de Estágio' },
        { id: 'plano', nome: 'Plano de Estágio' },
        { id: 'folhas', nome: 'Folhas de Registo de Horas' },
        { id: 'registos', nome: 'Registos de Visita do Tutor' },
        { id: 'avaliacao', nome: 'Avaliação e Autoavaliação' }
    ];

    html += `<div class="card" style="margin-bottom:20px; border-left:4px solid #8b5cf6;">
                <h4 style="color:var(--text-light); font-size:1rem; margin:0 0 15px 0;"><i class="fa-solid fa-folder-open" style="color:#8b5cf6;"></i> Documentação Oficial</h4>
                <div style="display:flex; flex-direction:column; gap:10px;">`;
    
    docsBurocracia.forEach(doc => {
        const estado = burocracia[doc.id] || 0;
        let actionHtml = ''; let iconHtml = '';
        
        if (estado === 0) {
            actionHtml = `<button onclick="window.submeterDocBurocracia('${doc.id}')" class="primary-btn small-btn" style="padding:6px 12px; font-size:0.75rem; width:100px; text-align:center;">Entreguei</button>`;
            iconHtml = `<i class="fa-solid fa-circle-xmark" style="color:#555;"></i>`;
        } else if (estado === 1) {
            actionHtml = `<div style="background:var(--warning-yellow); color:#000; padding:6px 12px; border-radius:6px; font-size:0.75rem; font-weight:bold; width:100px; text-align:center; display:flex; align-items:center; justify-content:center;">Em Análise</div>`;
            iconHtml = `<i class="fa-solid fa-clock" style="color:var(--warning-yellow);"></i>`;
        } else if (estado === 2) {
            actionHtml = `<div style="background:rgba(0,204,136,0.1); color:var(--primary-green); border:1px solid var(--primary-green); padding:6px 12px; border-radius:6px; font-size:0.75rem; font-weight:bold; width:100px; text-align:center; display:flex; align-items:center; justify-content:center;">Validado</div>`;
            iconHtml = `<i class="fa-solid fa-circle-check" style="color:var(--primary-green);"></i>`;
        }

        html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px; border-radius:6px; border:1px solid #333;">
                    <div style="font-size:0.85rem; color:var(--text-light); display:flex; align-items:center; gap:10px;">
                        ${iconHtml} ${doc.nome}
                    </div>
                    <div>${actionHtml}</div>
                 </div>`;
    });
    html += `</div></div>`;

    // 2. Entidade de Estágio
    let formDisplay = fct.empresa ? 'none' : 'block';
    let viewDisplay = fct.empresa ? 'block' : 'none';

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
    const bancoHoras = fct.bancoHoras || 0;
    const horasTotais = fct.horasTotal || 400; 
    const percHoras = Math.min((horasRealizadas / horasTotais) * 100, 100);
    const horasFalta = Math.max(0, horasTotais - horasRealizadas);
    const diasFalta = Math.ceil(horasFalta / 7);
    
    let estimativaHtml = horasFalta > 0 
        ? `<div style="margin-top:10px; font-size:0.85rem; color:var(--text-muted); display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-calendar-check" style="color:var(--primary-green);"></i> Estimativa: Faltam ~${diasFalta} dias úteis (a 7h/dia)</div>`
        : `<div style="margin-top:10px; font-size:0.85rem; color:var(--success-green); display:flex; align-items:center; gap:8px;"><i class="fa-solid fa-flag-checkered"></i> Estágio Concluído!</div>`;

    html += `<div class="card" style="margin-bottom:20px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-end; margin-bottom:10px;">
                    <div>
                        <h4 style="color:var(--text-light); font-size:1.1rem; margin:0 0 5px 0;">Registo de Horas</h4>
                        <span style="font-size:0.85rem; color:var(--text-muted);">Progresso Oficial</span>
                    </div>
                    <div style="text-align:right;">
                        <strong style="color:var(--primary-green); font-size:1.3rem; display:block;">${horasRealizadas} / ${horasTotais}h</strong>
                        <span style="color:#0ea5e9; font-size:0.85rem; font-weight:bold;"><i class="fa-solid fa-piggy-bank"></i> Banco: ${bancoHoras}h</span>
                    </div>
                </div>
                <div class="progress-bar-bg"><div class="progress-bar-fill" style="width:${percHoras}%; background:var(--primary-green);"></div></div>
                ${estimativaHtml}
                
                <div style="margin-top:20px; padding-top:15px; border-top:1px dashed #333;">
                    <div style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 15px; background: rgba(0,0,0,0.15); padding: 10px; border-radius: 6px;">
                        <div style="margin-bottom: 5px;"><i class="fa-solid fa-circle-info" style="color:#0ea5e9;"></i> <strong>Regra:</strong> Aulas + Estágio não podem ultrapassar as 7h diárias.</div>
                        <div><i class="fa-solid fa-piggy-bank" style="color:#0ea5e9;"></i> <strong>Info:</strong> As horas que trabalhares a mais num dia ficam guardadas no teu Banco de Horas!</div>
                    </div>
                    
                    <div style="display: flex; gap: 8px; margin-bottom: 10px;">
                        <div style="flex:1;"><label style="font-size:0.75rem; color:var(--text-muted);">Data</label><input type="date" id="fct-hora-data" class="input-padrao" style="width:100%; padding:10px 8px; font-size:0.85rem;"></div>
                        <div style="width:80px;"><label style="font-size:0.75rem; color:var(--text-muted);">Entrada</label><input type="time" id="fct-hora-in" class="input-padrao" style="width:100%; padding:10px 5px; font-size:0.85rem;"></div>
                        <div style="width:80px;"><label style="font-size:0.75rem; color:var(--text-muted);">Saída</label><input type="time" id="fct-hora-out" class="input-padrao" style="width:100%; padding:10px 5px; font-size:0.85rem;"></div>
                    </div>
                    <div style="display: flex; gap: 8px; align-items:center; margin-bottom: 15px; justify-content: space-between;">
                        <label style="font-size:0.85rem; color:var(--text-light); margin:0;">Horas a validar na FCT hoje (Máx 7):</label>
                        <input type="number" id="fct-hora-validar" class="input-padrao" placeholder="Ex: 4" style="width:80px; padding:8px; margin:0; text-align:center;" min="1" max="7">
                    </div>
                    <button class="primary-btn small-btn" style="width: 100%; background:var(--primary-green);" onclick="window.registarHorasDia()"><i class="fa-solid fa-clock"></i> Registar Horas</button>
                </div>`;
                
    if (window.historicoFCTAtual.length > 0) {
        html += `<div style="margin-top:20px; display:flex; flex-direction:column; gap:8px;">`;
        const historicoMap = window.historicoFCTAtual.map((r, i) => ({...r, originalIndex: i})).reverse();
        
        historicoMap.slice(0, 4).forEach(r => {
            const hValid = r.horasValidadas || r.horas || 0; 
            const hBanco = r.horasBanco || 0;
            const hTot = r.horasTotal || hValid;

            html += `<div id="linha-fct-${r.originalIndex}" style="display:flex; justify-content:space-between; align-items:center; font-size:1rem; background:rgba(0,0,0,0.2); padding:12px 15px; border-radius:6px; border-left:3px solid var(--primary-green);">
                        <div style="flex:1;">
                            <span style="color:var(--text-light); font-weight:bold;">${r.data}</span><br>
                            <span style="color:var(--text-muted); font-size:0.85rem;">${r.inicio} às ${r.fim} (Fez ${hTot}h)</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="text-align:right; margin-right:10px;">
                                <strong style="color:var(--primary-green); font-size:1.1rem; display:block;">+${hValid}h <span style="font-size:0.7rem; font-weight:normal; color:var(--text-muted);">FCT</span></strong>
                                ${hBanco > 0 ? `<strong style="color:#0ea5e9; font-size:0.85rem; display:block;">+${hBanco}h <span style="font-size:0.7rem; font-weight:normal; color:var(--text-muted);">Banco</span></strong>` : ''}
                            </div>
                            <button onclick="window.editarHorasFCT(${r.originalIndex})" class="secondary-btn" style="padding:10px 12px; color:var(--text-light);" title="Editar"><i class="fa-solid fa-pen"></i></button>
                            <button onclick="window.eliminarHorasFCT(${r.originalIndex})" class="secondary-btn" style="padding:10px 12px; color:var(--danger-red);" title="Eliminar"><i class="fa-solid fa-trash"></i></button>
                        </div>
                     </div>`;
        });
        
        if (historicoMap.length > 4) {
            html += `<button onclick="window.abrirModalHistoricoFCT()" class="secondary-btn" style="width:100%; border:1px solid #333; margin-top:5px; color:var(--text-muted);">Ver Histórico Completo (${historicoMap.length})</button>`;
        }
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
    try {
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), {
            "fct.empresa": emp, "fct.tutor": tut, "fct.telefone": tel, "fct.email": em
        });
        window.recarregarViewPassaporte('fct');
    } catch(e) { mostrarAlerta("Erro ao guardar ficha."); }
}

async function registarHorasDia() {
    const dt = document.getElementById('fct-hora-data').value;
    const hIn = document.getElementById('fct-hora-in').value;
    const hOut = document.getElementById('fct-hora-out').value;
    const validarIn = Number(document.getElementById('fct-hora-validar').value);

    if(!dt || !hIn || !hOut) { mostrarAlerta("Preenche a data e as horas de entrada e saída!"); return; }
    if(!validarIn || validarIn < 1 || validarIn > 7) { mostrarAlerta("As horas a validar devem ser um número entre 1 e 7!"); return; }

    const [hInStr, mInStr] = hIn.split(':').map(Number);
    const [hOutStr, mOutStr] = hOut.split(':').map(Number);
    
    let minDiff = (hOutStr * 60 + mOutStr) - (hInStr * 60 + mInStr);
    if(minDiff <= 0) { mostrarAlerta("A hora de saída tem de ser posterior à hora de entrada!"); return; }

    let totalHorasFeitas = Math.floor(minDiff / 60);
    if (totalHorasFeitas < 1) { mostrarAlerta("Tens de estagiar pelo menos 1 hora para registar o dia."); return; }
    if (validarIn > totalHorasFeitas) { mostrarAlerta(`As horas a validar (${validarIn}h) não podem ser superiores às horas efetuadas (${totalHorasFeitas}h)!`); return; }

    let bancoFinal = totalHorasFeitas - validarIn;
    const btn = event.currentTarget; const textoOriginal = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true;

    try {
        const snap = await getDoc(doc(window.db, "utilizadores", window.myUserId));
        const currentHoras = snap.data().fct?.horasRealizadas || 0;
        const currentBanco = snap.data().fct?.bancoHoras || 0;
        
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), {
            "fct.horasRealizadas": currentHoras + validarIn,
            "fct.bancoHoras": currentBanco + bancoFinal,
            "fct.historicoHoras": arrayUnion({ data: dt.split('-').reverse().join('/'), dataIso: dt, inicio: hIn, fim: hOut, horasTotal: totalHorasFeitas, horasValidadas: validarIn, horasBanco: bancoFinal })
        });
        mostrarAlerta("Horas registadas com sucesso!", false); window.recarregarViewPassaporte('fct');
    } catch(e) { mostrarAlerta("Erro ao registar horas."); btn.innerHTML = textoOriginal; btn.disabled = false; }
}

async function eliminarHorasFCT(index) {
    const confirmou = await confirmarAcao("Tens a certeza que queres eliminar este registo de horas permanentemente?");
    if(!confirmou) return;
    
    const registo = window.historicoFCTAtual[index];
    window.historicoFCTAtual.splice(index, 1);
    
    try {
        const snap = await getDoc(doc(window.db, "utilizadores", window.myUserId));
        let currentHoras = snap.data().fct?.horasRealizadas || 0;
        let currentBanco = snap.data().fct?.bancoHoras || 0;
        const hValid = registo.horasValidadas || registo.horas || 0;
        const hBanco = registo.horasBanco || 0;

        await updateDoc(doc(window.db, "utilizadores", window.myUserId), {
            "fct.horasRealizadas": Math.max(0, currentHoras - hValid),
            "fct.bancoHoras": Math.max(0, currentBanco - hBanco),
            "fct.historicoHoras": window.historicoFCTAtual
        });
        mostrarAlerta("Registo eliminado.", false); window.recarregarViewPassaporte('fct');
    } catch(e) { mostrarAlerta("Erro ao eliminar registo."); }
}

async function editarHorasFCT(index) {
    const r = window.historicoFCTAtual[index];
    const confirmou = await confirmarAcao("Vais editar este registo. O registo antigo será apagado. Deves alterar os campos e voltar a clicar em 'Registar Horas'. Continuar?");
    if(!confirmou) return;

    window.historicoFCTAtual.splice(index, 1);
    try {
        const snap = await getDoc(doc(window.db, "utilizadores", window.myUserId));
        let currentHoras = snap.data().fct?.horasRealizadas || 0;
        let currentBanco = snap.data().fct?.bancoHoras || 0;
        const hValid = r.horasValidadas || r.horas || 0;
        const hBanco = r.horasBanco || 0;

        await updateDoc(doc(window.db, "utilizadores", window.myUserId), {
            "fct.horasRealizadas": Math.max(0, currentHoras - hValid),
            "fct.bancoHoras": Math.max(0, currentBanco - hBanco),
            "fct.historicoHoras": window.historicoFCTAtual
        });
        
        await window.recarregarViewPassaporte('fct');
        
        setTimeout(() => {
            if(r.dataIso) document.getElementById('fct-hora-data').value = r.dataIso;
            document.getElementById('fct-hora-in').value = r.inicio;
            document.getElementById('fct-hora-out').value = r.fim;
            document.getElementById('fct-hora-validar').value = hValid;
        }, 500);

    } catch(e) { mostrarAlerta("Erro a preparar edição."); }
}

function abrirModalHistoricoFCT() {
    const historicoMap = window.historicoFCTAtual.map((r, i) => ({...r, originalIndex: i})).reverse();
    let modalHtml = `<div style="display:flex; flex-direction:column; gap:8px;">`;
    
    historicoMap.forEach(r => {
        const hValid = r.horasValidadas || r.horas || 0; 
        const hBanco = r.horasBanco || 0;
        const hTot = r.horasTotal || hValid;
        modalHtml += `<div style="display:flex; justify-content:space-between; align-items:center; font-size:1rem; background:rgba(0,0,0,0.2); padding:12px 15px; border-radius:6px; border-left:3px solid var(--primary-green);">
                        <div style="flex:1;">
                            <span style="color:var(--text-light); font-weight:bold;">${r.data}</span><br>
                            <span style="color:var(--text-muted); font-size:0.85rem;">${r.inicio} às ${r.fim} (Fez ${hTot}h)</span>
                        </div>
                        <div style="display:flex; align-items:center; gap:10px;">
                            <div style="text-align:right; margin-right:10px;">
                                <strong style="color:var(--primary-green); font-size:1.1rem; display:block;">+${hValid}h <span style="font-size:0.7rem; font-weight:normal; color:var(--text-muted);">FCT</span></strong>
                                ${hBanco > 0 ? `<strong style="color:#0ea5e9; font-size:0.85rem; display:block;">+${hBanco}h <span style="font-size:0.7rem; font-weight:normal; color:var(--text-muted);">Banco</span></strong>` : ''}
                            </div>
                            <button onclick="window.editarHorasFCT(${r.originalIndex}); document.getElementById('modal-view-hist').remove();" class="secondary-btn" style="padding:10px 12px; color:var(--text-light);"><i class="fa-solid fa-pen"></i></button>
                            <button onclick="window.eliminarHorasFCT(${r.originalIndex}); document.getElementById('modal-view-hist').remove();" class="secondary-btn" style="padding:10px 12px; color:var(--danger-red);"><i class="fa-solid fa-trash"></i></button>
                        </div>
                     </div>`;
    });
    modalHtml += `</div>`;

    const bg = document.createElement('div');
    bg.id = 'modal-view-hist'; bg.className = 'modal-overlay';
    bg.style.display = 'flex'; bg.style.zIndex = '9999';
    bg.innerHTML = `
        <div class="action-sheet" style="width:95%; max-width:600px; max-height:85vh; border-radius:12px; margin:20px; display:flex; flex-direction:column; padding:20px; animation: fadeSlide 0.3s ease;">
            <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:20px;">
                <h3 style="color:var(--text-light); font-size:1.2rem; margin:0;"><i class="fa-solid fa-clock-rotate-left" style="color:var(--primary-green);"></i> Histórico Completo FCT</h3>
                <button id="btn-close-hist" style="background:none; border:none; color:var(--text-muted); font-size:1.5rem; cursor:pointer;"><i class="fa-solid fa-xmark"></i></button>
            </div>
            <div style="flex:1; overflow-y:auto; padding-right:5px;">${modalHtml}</div>
        </div>`;
    document.body.appendChild(bg);
    bg.querySelector('#btn-close-hist').onclick = () => bg.remove();
}

async function submeterDocBurocracia(docId) {
    const confirmou = await confirmarAcao("Tens a certeza que queres indicar este documento como entregue à escola?");
    if(!confirmou) return;
    try {
        await updateDoc(doc(window.db, "utilizadores", window.myUserId), { [`fct.burocracia.${docId}`]: 1 });
        mostrarAlerta("Documento submetido para validação!", false); window.recarregarViewPassaporte('fct');
    } catch(e) { mostrarAlerta("Erro ao submeter documento."); }
}

function gerarTextoDiario() {
    const chks = document.querySelectorAll('.tarefa-fct-chk:checked');
    const notas = document.getElementById('fct-notas-extra').value.trim();
    const caixaResultado = document.getElementById('resultado-gerador-fct');
    
    if(chks.length === 0 && notas === '') { mostrarAlerta("Seleciona tarefas ou escreve uma nota!"); return; }

    let textoGerado = "Nesta semana de estágio na Entidade de Estágio, as minhas tarefas focaram-se em: ";
    let arrTarefas = [];
    chks.forEach(c => arrTarefas.push(c.value.toLowerCase()));
    
    if(arrTarefas.length > 0) {
        if(arrTarefas.length === 1) { textoGerado += arrTarefas[0] + ". "; } 
        else { const ult = arrTarefas.pop(); textoGerado += arrTarefas.join(", ") + " e " + ult + ". "; }
    } else { textoGerado = "Nesta semana, foquei-me no acompanhamento de atividades operacionais da empresa. "; }

    textoGerado += "As atividades permitiram consolidar conhecimentos técnicos e reforçar a minha adaptação ao contexto real de trabalho, resultando numa semana muito produtiva.";
    if(notas !== '') { textoGerado += ` Destaco ainda que: ${notas}.`; }

    caixaResultado.innerHTML = `<strong>Texto Base para o teu Relatório:</strong><br><br>${textoGerado}`;
    caixaResultado.style.display = 'block';
}
