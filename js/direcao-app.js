import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const stateDir = {
    nome: '',
    turmasDirecao: [],
    turmaSelecionada: null,
    alunosCache: [] 
};

onAuthStateChanged(auth, async (user) => {
    if (user) {
        const myUserId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", myUserId));
            
            if (docSnap.exists()) {
                const data = docSnap.data();
                const papeis = data.papeis || [];
                
                if (!papeis.includes('direcao')) {
                    window.location.href = "index.html";
                    return;
                }

                stateDir.nome = data.nome || data.nomeCompleto || myUserId;
                stateDir.turmasDirecao = data.turmas || ['10T', '11T', '12T'];

                document.getElementById('dir-user-name').innerText = stateDir.nome;
                document.getElementById('perfil-nome-dir-view').innerText = stateDir.nome;
                
                const fotoUrl = data.fotoPerfil || `https://ui-avatars.com/api/?name=${stateDir.nome.charAt(0)}&background=ff4d4d&color=fff&font-size=0.4`;
                document.getElementById('dir-avatar-circle').innerHTML = `<img src="${fotoUrl}" style="width:100%;height:100%;object-fit:cover;border-radius:50%;">`;
                document.getElementById('dir-avatar-img').src = fotoUrl;

                const selTurmas = document.getElementById('dir-seletor-turmas');
                if (selTurmas) {
                    selTurmas.innerHTML = '<option value="">-- Selecionar Turma --</option>' + 
                                          stateDir.turmasDirecao.map(t => `<option value="${t}">Turma ${t}</option>`).join('');
                }

                await carregarDadosReaisDirecao();
            } else { window.location.href = "index.html"; }
        } catch (e) { 
            console.error("Erro Firebase:", e);
        }
    } else { window.location.href = "index.html"; }
});

// ==========================================
// BUSCAR DADOS REAIS + LER A SUBCOLEÇÃO DE NOTAS
// ==========================================
async function carregarDadosReaisDirecao() {
    const kpiCont = document.getElementById('dir-kpi-container');
    const alertasCont = document.getElementById('dir-alertas-turmas');
    
    if(kpiCont) kpiCont.innerHTML = `<p class="text-muted center" style="grid-column: span 2;"><i class="fa-solid fa-spinner fa-spin"></i> A ler base de dados (Alunos e Notas)...</p>`;

    try {
        let todosAlunos = [];

        if (stateDir.turmasDirecao.length > 0) {
            const q = query(collection(db, "utilizadores"), where("papel", "==", "aluno"), where("turma", "in", stateDir.turmasDirecao));
            const querySnapshot = await getDocs(q);
            
            for (const alunoDoc of querySnapshot.docs) {
                let d = alunoDoc.data();
                
                // LEITURA DA SUBCOLEÇÃO 'notas'
                const notasSnap = await getDocs(collection(db, "utilizadores", alunoDoc.id, "notas"));
                let totalAtrasos = 0;
                let listaAtrasosAluno = [];

                notasSnap.forEach(nDoc => {
                    const moduloNome = nDoc.id;
                    const dadosNota = nDoc.data();
                    const notaReal = dadosNota.nota; 

                    if (notaReal !== undefined && notaReal !== null && notaReal !== "") {
                        if (notaReal === "REP" || (!isNaN(notaReal) && Number(notaReal) < 10)) {
                            totalAtrasos++;
                            listaAtrasosAluno.push({ modulo: moduloNome, nota: notaReal });
                        }
                    }
                });

                todosAlunos.push({
                    id: alunoDoc.id,
                    nome: d.nome || d.nomeCompleto || "Sem Nome",
                    turma: d.turma,
                    faltas: d.faltas_injustificadas || 0,
                    prhfs: d.prhfs ? d.prhfs.length : 0,
                    prhfUrgente: 0,
                    ocorrencias: d.ocorrencias || 0,
                    atrasos: totalAtrasos,
                    detalhesAtrasos: listaAtrasosAluno 
                });
            }
        }
        
        stateDir.alunosCache = todosAlunos;

        // Calcular KPIs Globais
        const totalAlunos = todosAlunos.length;
        let totalPrhfs = 0;
        let somaFaltas = 0;
        let totalAtrasos = 0;

        todosAlunos.forEach(a => { 
            totalPrhfs += a.prhfs; 
            somaFaltas += a.faltas;
            totalAtrasos += a.atrasos;
        });

        const mediaFaltas = totalAlunos > 0 ? Math.round(somaFaltas / totalAlunos) : 0;

        if(kpiCont) {
            kpiCont.innerHTML = `
                <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 15px; text-align: center; border: 1px solid rgba(0, 153, 255, 0.3);">
                    <h2 id="kpi-alunos" style="color: #0099ff; font-size: 1.8rem; margin: 0; font-variant-numeric: tabular-nums;">0</h2>
                    <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: bold; display:block; margin-top:5px;">Alunos Totais</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 15px; text-align: center; border: 1px solid rgba(245, 158, 11, 0.3);">
                    <h2 id="kpi-prhfs" style="color: var(--warning-yellow); font-size: 1.8rem; margin: 0; font-variant-numeric: tabular-nums;">0</h2>
                    <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: bold; display:block; margin-top:5px;">PRHFs Ativos</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 15px; text-align: center; border: 1px solid rgba(239, 68, 68, 0.3);">
                    <h2 id="kpi-faltas" style="color: var(--danger-red); font-size: 1.8rem; margin: 0; font-variant-numeric: tabular-nums;">0%</h2>
                    <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: bold; display:block; margin-top:5px;">Taxa Faltas (Média)</span>
                </div>
                <div style="background: rgba(0,0,0,0.3); border-radius: 12px; padding: 15px; text-align: center; border: 1px solid rgba(184, 43, 242, 0.3);">
                    <h2 id="kpi-atrasos" style="color: #b82bf2; font-size: 1.8rem; margin: 0; font-variant-numeric: tabular-nums;">0</h2>
                    <span style="font-size: 0.65rem; color: var(--text-muted); text-transform: uppercase; font-weight: bold; display:block; margin-top:5px;">Módulos em Atraso</span>
                </div>
            `;

            setTimeout(() => {
                animarNumero('kpi-alunos', totalAlunos, 1500);
                animarNumero('kpi-prhfs', totalPrhfs, 1500);
                animarNumero('kpi-faltas', mediaFaltas, 1500, '%');
                animarNumero('kpi-atrasos', totalAtrasos, 1500); 
            }, 100);
        }

        if (alertasCont) {
            alertasCont.innerHTML = '';
            
            if (stateDir.turmasDirecao.length === 0) {
                alertasCont.innerHTML = '<p class="text-muted center">Sem turmas atribuídas.</p>';
            }

            stateDir.turmasDirecao.forEach(turma => {
                const alunosTurma = todosAlunos.filter(a => a.turma === turma);
                
                let statsTurma = { somaFaltas: 0, prhfsTurma: 0, ocorrenciasTurma: 0, atrasosTurma: 0 };
                
                alunosTurma.forEach(a => {
                    statsTurma.somaFaltas += a.faltas;
                    statsTurma.prhfsTurma += a.prhfs;
                    statsTurma.ocorrenciasTurma += a.ocorrencias;
                    statsTurma.atrasosTurma += a.atrasos;
                });

                let taxaFaltasTurma = alunosTurma.length > 0 ? Math.round(statsTurma.somaFaltas / alunosTurma.length) : 0;
                
                // NOVA LÓGICA DE RISCO GLOBAL DA TURMA
                let turmaRisco = 'verde';
                
                if (taxaFaltasTurma > 5 || statsTurma.prhfsTurma > 10 || statsTurma.ocorrenciasTurma >= 5 || statsTurma.atrasosTurma > 10) {
                    turmaRisco = 'amarelo';
                }
                if (taxaFaltasTurma > 10 || statsTurma.prhfsTurma > 20 || statsTurma.ocorrenciasTurma > 10 || statsTurma.atrasosTurma > 20) {
                    turmaRisco = 'vermelho';
                }

                let cor = turmaRisco === 'vermelho' ? 'var(--danger-red)' : (turmaRisco === 'amarelo' ? 'var(--warning-yellow)' : 'var(--success-green)');
                let bg = turmaRisco === 'vermelho' ? 'rgba(239, 68, 68, 0.08)' : (turmaRisco === 'amarelo' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(0, 204, 136, 0.08)');
                let icone = turmaRisco === 'vermelho' ? '<i class="fa-solid fa-triangle-exclamation"></i>' : (turmaRisco === 'amarelo' ? '<i class="fa-solid fa-circle-exclamation"></i>' : '<i class="fa-solid fa-check-circle"></i>');
                let tituloRisco = turmaRisco === 'vermelho' ? 'Risco Elevado' : (turmaRisco === 'amarelo' ? 'Atenção' : 'Estável');

                alertasCont.innerHTML += `
                    <div style="background: rgba(0,0,0,0.2); border: 1px solid ${cor}; border-radius: 12px; padding: 15px; display: flex; flex-direction: column; gap: 15px; margin-bottom: 12px;">
                        <div style="display: flex; justify-content: space-between; align-items: center;">
                            <div>
                                <h4 style="color: white; font-size: 1.2rem; margin: 0;">${turma}</h4>
                                <span style="font-size: 0.8rem; color: ${cor};">${tituloRisco}</span>
                            </div>
                            <div style="background: ${bg}; color: ${cor}; width: 35px; height: 35px; border-radius: 50%; display: flex; justify-content: center; align-items: center; font-size: 1.1rem;">
                                ${icone}
                            </div>
                        </div>
                        <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px;">
                            <div style="text-align: center; border-right: 1px solid #333;"><span style="color: ${cor}; font-weight: bold; font-size: 1.1rem;">${taxaFaltasTurma}%</span><br><span style="font-size: 0.55rem; color: var(--text-muted); text-transform: uppercase;">Taxa de Faltas</span></div>
                            <div style="text-align: center; border-right: 1px solid #333;"><span style="color: white; font-weight: bold; font-size: 1.1rem;">${statsTurma.prhfsTurma}</span><br><span style="font-size: 0.55rem; color: var(--text-muted); text-transform: uppercase;">PRHFs</span></div>
                            <div style="text-align: center; border-right: 1px solid #333;"><span style="color: white; font-weight: bold; font-size: 1.1rem;">${statsTurma.ocorrenciasTurma}</span><br><span style="font-size: 0.55rem; color: var(--text-muted); text-transform: uppercase;">Ocorr.</span></div>
                            <div style="text-align: center;"><span style="color: #b82bf2; font-weight: bold; font-size: 1.1rem;">${statsTurma.atrasosTurma}</span><br><span style="font-size: 0.55rem; color: var(--text-muted); text-transform: uppercase;">Módulos em Atraso</span></div>
                        </div>
                        <button class="secondary-btn small-btn btn-ver-raio-x" data-turma="${turma}" style="width: 100%; border-color: ${cor}; color: ${cor}; background: transparent;">Abrir Raio-X</button>
                    </div>
                `;
            });
        }
    } catch(err) {
        console.error("Erro ao cruzar dados reais:", err);
    }
}

// ==========================================
// MOTOR DE RISCO (ALUNO INDIVIDUAL)
// ==========================================
function avaliarRiscoAluno(aluno) {
    let motivosVermelho = [];
    let motivosAmarelo = [];

    if (aluno.faltas > 10) motivosVermelho.push("Faltas > 10%");
    if (aluno.prhfUrgente >= 1) motivosVermelho.push("PRHF Mód. Terminado");
    if (aluno.ocorrencias >= 3) motivosVermelho.push("3+ Ocorrências");
    if (aluno.atrasos >= 3) motivosVermelho.push("3+ Módulos em Atraso");

    if (motivosVermelho.length > 0) return { risco: 'vermelho', motivo: "Risco Crítico: " + motivosVermelho.join(" | ") };

    if (aluno.faltas > 5) motivosAmarelo.push("Faltas > 5%");
    if (aluno.prhfs >= 1) motivosAmarelo.push("1+ PRHF");
    if (aluno.ocorrencias >= 1) motivosAmarelo.push("Ocorrência");
    if (aluno.atrasos >= 1) motivosAmarelo.push("Módulo em Atraso");

    if (motivosAmarelo.length > 0) return { risco: 'amarelo', motivo: "Atenção: " + motivosAmarelo.join(" | ") };

    return { risco: 'verde', motivo: "Sem alertas. Desempenho regular." };
}

// ==========================================
// RENDERIZAR RAIO-X DAS TURMAS (ALUNOS)
// ==========================================
function renderizarRaioX(turma, container) {
    const alunosCrus = stateDir.alunosCache.filter(a => a.turma === turma);
    
    let alunos = alunosCrus.map(aluno => {
        const avaliacao = avaliarRiscoAluno(aluno);
        return { ...aluno, risco: avaliacao.risco, motivo: avaliacao.motivo };
    });

    const pesoRisco = { 'vermelho': 1, 'amarelo': 2, 'verde': 3 };
    alunos.sort((a, b) => pesoRisco[a.risco] - pesoRisco[b.risco]);
    
    const totalCriticos = alunos.filter(a => a.risco === 'vermelho').length;
    const totalAviso = alunos.filter(a => a.risco === 'amarelo').length;
    const corResumo = totalCriticos > 0 ? 'var(--danger-red)' : (totalAviso > 0 ? 'var(--warning-yellow)' : 'var(--success-green)');

    let html = `
        <div class="card" style="background: rgba(0,0,0,0.3); border: 1px solid ${corResumo}; margin-bottom: 20px;">
            <div style="display: flex; justify-content: space-between; align-items: center; border-bottom: 1px solid #333; padding-bottom: 10px; margin-bottom: 10px;">
                <h3 style="font-size: 1.1rem; color: white; margin: 0;">Raio-X: <span style="color: ${corResumo};">${turma}</span></h3>
                <span style="background: #222; padding: 4px 10px; border-radius: 12px; font-size: 0.8rem; color: var(--text-muted); border: 1px solid #444;"><i class="fa-solid fa-user-group"></i> ${alunos.length} Alunos</span>
            </div>
            <div style="display: flex; gap: 10px; text-align: center;">
                <div style="flex: 1;">
                    <span style="color: var(--danger-red); font-size: 1.4rem; font-weight: bold;">${totalCriticos}</span>
                    <span style="display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Críticos</span>
                </div>
                <div style="flex: 1; border-left: 1px dashed #333; border-right: 1px dashed #333;">
                    <span style="color: var(--warning-yellow); font-size: 1.4rem; font-weight: bold;">${totalAviso}</span>
                    <span style="display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Atenção</span>
                </div>
                <div style="flex: 1;">
                    <span style="color: var(--success-green); font-size: 1.4rem; font-weight: bold;">${alunos.filter(a=>a.risco==='verde').length}</span>
                    <span style="display: block; font-size: 0.7rem; color: var(--text-muted); text-transform: uppercase;">Estáveis</span>
                </div>
            </div>
        </div>

        <h3 style="font-size: 1rem; color: white; margin-bottom: 15px;">Listagem de Alunos</h3>
        <div style="display: flex; flex-direction: column; gap: 12px;">
    `;

    if (alunos.length === 0) {
        html += `<p class="text-muted center">Não existem alunos registados nesta turma.</p>`;
    } else {
        alunos.forEach(aluno => {
            let corRisco = aluno.risco === 'vermelho' ? 'var(--danger-red)' : (aluno.risco === 'amarelo' ? 'var(--warning-yellow)' : 'var(--success-green)');
            let iconeRisco = aluno.risco === 'vermelho' ? '<i class="fa-solid fa-triangle-exclamation"></i>' : (aluno.risco === 'amarelo' ? '<i class="fa-solid fa-circle-exclamation"></i>' : '<i class="fa-solid fa-check"></i>');
            let bgRisco = aluno.risco === 'vermelho' ? 'rgba(239, 68, 68, 0.08)' : (aluno.risco === 'amarelo' ? 'rgba(245, 158, 11, 0.08)' : 'rgba(0, 0, 0, 0.2)');
            let numCor = aluno.risco === 'verde' ? 'white' : corRisco;

            html += `
                <div style="background: ${bgRisco}; border: 1px solid ${corRisco}; border-radius: 12px; padding: 15px;">
                    <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 12px;">
                        <div>
                            <h4 style="color: white; font-size: 1.05rem; margin: 0 0 4px 0;">${aluno.nome}</h4>
                            <span style="font-size: 0.75rem; color: var(--text-light);"><span style="color:${corRisco}">${iconeRisco}</span> ${aluno.motivo}</span>
                        </div>
                        <button class="btn-perfil-aluno-dir icon-btn" data-id="${aluno.id}" style="background: rgba(255,255,255,0.05); color: white; border: 1px solid #444; border-radius: 8px; padding: 8px 12px;">
                            <i class="fa-solid fa-chevron-right"></i>
                        </button>
                    </div>
                    <div style="display: grid; grid-template-columns: repeat(4, 1fr); gap: 5px; background: rgba(255,255,255,0.03); border-radius: 8px; padding: 10px;">
                        <div style="text-align: center; border-right: 1px solid #333;"><span style="color: ${numCor}; font-weight: bold; font-size: 1.1rem;">${aluno.faltas}%</span><br><span style="font-size: 0.55rem; color: var(--text-muted); text-transform: uppercase;">Taxa de Faltas</span></div>
                        <div style="text-align: center; border-right: 1px solid #333;"><span style="color: white; font-weight: bold; font-size: 1.1rem;">${aluno.prhfs}</span><br><span style="font-size: 0.55rem; color: var(--text-muted); text-transform: uppercase;">PRHFs</span></div>
                        <div style="text-align: center; border-right: 1px solid #333;"><span style="color: white; font-weight: bold; font-size: 1.1rem;">${aluno.ocorrencias}</span><br><span style="font-size: 0.55rem; color: var(--text-muted); text-transform: uppercase;">Ocorr.</span></div>
                        <div style="text-align: center;"><span style="color: #b82bf2; font-weight: bold; font-size: 1.1rem;">${aluno.atrasos}</span><br><span style="font-size: 0.55rem; color: var(--text-muted); text-transform: uppercase;">Módulos em Atraso</span></div>
                    </div>
                </div>
            `;
        });
    }

    html += `</div>`;
    container.innerHTML = html;
}

// ==========================================
// PREENCHER MODAL PERFIL 360º
// ==========================================
function abrirPerfil360(idAluno) {
    const aluno = stateDir.alunosCache.find(a => a.id === idAluno);
    if (!aluno) return;

    const avaliacao = avaliarRiscoAluno(aluno);
    aluno.risco = avaliacao.risco;
    
    let corRisco = aluno.risco === 'vermelho' ? 'var(--danger-red)' : (aluno.risco === 'amarelo' ? 'var(--warning-yellow)' : 'var(--success-green)');
    let textoRisco = aluno.risco === 'vermelho' ? 'Risco Crítico' : (aluno.risco === 'amarelo' ? 'Atenção' : 'Estável');
    
    let avatarBg = aluno.risco === 'vermelho' ? 'ef4444' : (aluno.risco === 'amarelo' ? 'f59e0b' : '00cc88');

    document.getElementById('p360-nome').innerText = aluno.nome;
    document.getElementById('p360-turma').innerText = "Turma " + aluno.turma;
    
    const badge = document.getElementById('p360-badge');
    badge.innerText = textoRisco;
    badge.style.backgroundColor = 'rgba(0,0,0,0.5)';
    badge.style.color = corRisco;
    badge.style.border = `1px solid ${corRisco}`;

    document.getElementById('p360-foto').src = `https://ui-avatars.com/api/?name=${aluno.nome.charAt(0)}&background=${avatarBg}&color=fff&font-size=0.4`;
    document.getElementById('p360-foto').style.borderColor = corRisco;

    document.getElementById('p360-faltas').innerText = aluno.faltas + "%";
    document.getElementById('p360-prhfs').innerText = aluno.prhfs;
    document.getElementById('p360-ocorr').innerText = aluno.ocorrencias;
    document.getElementById('p360-atrasos').innerText = aluno.atrasos;

    const listaAtrasosCont = document.getElementById('p360-lista-atrasos');
    if (aluno.detalhesAtrasos && aluno.detalhesAtrasos.length > 0) {
        listaAtrasosCont.innerHTML = aluno.detalhesAtrasos.map(atr => `
            <div style="background: rgba(255,255,255,0.05); border: 1px solid #333; padding: 10px; border-radius: 8px; display: flex; justify-content: space-between; align-items: center;">
                <span style="color: white; font-size: 0.9rem;">${atr.modulo.replace('_', ' ')}</span>
                <span style="background: rgba(239, 68, 68, 0.2); color: var(--danger-red); padding: 2px 8px; border-radius: 6px; font-weight: bold; font-size: 0.8rem;">${atr.nota}</span>
            </div>
        `).join('');
    } else {
        listaAtrasosCont.innerHTML = `<p class="text-muted" style="font-size: 0.85rem; margin: 0;">Nenhum módulo em atraso.</p>`;
    }

    document.getElementById('modal-perfil-360').style.display = 'flex';
}

function animarNumero(idTarget, endValue, duration, suffix = '') {
    const obj = document.getElementById(idTarget);
    if (!obj) return;
    
    let startTimestamp = null;
    const step = (timestamp) => {
        if (!startTimestamp) startTimestamp = timestamp;
        const progress = Math.min((timestamp - startTimestamp) / duration, 1);
        const easeOut = 1 - Math.pow(1 - progress, 3);
        let currentVal = Math.floor(easeOut * endValue);
        
        obj.innerText = currentVal + suffix;
        if (progress < 1) window.requestAnimationFrame(step);
        else obj.innerText = endValue + suffix;
    };
    window.requestAnimationFrame(step);
}

// ==========================================
// CLIQUES E MENUS
// ==========================================
document.body.addEventListener('click', (e) => {
    const nav = e.target.closest('.nav-item');
    if (nav) {
        e.preventDefault(); 
        document.querySelectorAll('.nav-item').forEach(n => n.classList.remove('active'));
        nav.classList.add('active');
        
        document.querySelectorAll('main > div').forEach(v => v.style.display = 'none');
        
        const tId = nav.getAttribute('data-target');
        const targetView = document.getElementById(tId);
        if (targetView) targetView.style.display = 'block';
        
        if (tId === 'view-direcao-turmas' && stateDir.turmaSelecionada) {
            document.getElementById('dir-seletor-turmas').value = stateDir.turmaSelecionada;
            document.getElementById('dir-turma-container').style.display = 'block';
        }
    }
    
    if (e.target.closest('#btn-logout-dir')) {
        signOut(auth).then(() => window.location.href = "index.html");
    }

    if (e.target.classList.contains('btn-ver-raio-x')) {
        const turmaTarget = e.target.getAttribute('data-turma');
        stateDir.turmaSelecionada = turmaTarget;
        
        document.getElementById('dir-seletor-turmas').value = turmaTarget;
        document.getElementById('dir-seletor-turmas').dispatchEvent(new Event('change'));
        
        document.querySelector('.nav-item[data-target="view-direcao-turmas"]').click();
    }

    if (e.target.closest('.btn-perfil-aluno-dir')) {
        const idAluno = e.target.closest('.btn-perfil-aluno-dir').getAttribute('data-id');
        abrirPerfil360(idAluno);
    }
    
    if (e.target.closest('.fechar-modal')) {
        const targetId = e.target.closest('.fechar-modal').getAttribute('data-target');
        const modal = document.getElementById(targetId);
        if (modal) modal.style.display = 'none';
    }
});

document.getElementById('dir-seletor-turmas')?.addEventListener('change', (e) => {
    const turma = e.target.value;
    const container = document.getElementById('dir-turma-container');
    if (turma) {
        stateDir.turmaSelecionada = turma;
        container.style.display = 'block';
        renderizarRaioX(turma, container);
    } else {
        stateDir.turmaSelecionada = null;
        container.style.display = 'none';
    }
});
