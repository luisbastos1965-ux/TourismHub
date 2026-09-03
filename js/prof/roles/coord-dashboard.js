import { db } from "../../firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state, nomeCurto } from "../store.js";
import "./coord.js"; // Importa as lógicas de validação

// Gere a tab ativa na vista de projetos (Estágios ou PAP)
export let coordTabAtiva = 'fct';

export async function carregarEcraProjetosCoord() {
    const container = document.getElementById('lista-coord-projetos-dinamico');
    container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A cruzar dados do curso...</p>';

    try {
        let alunosAvaliados = [];
        // Puxa todos os alunos de 11º e 12º ano das turmas do Coordenador
        for (const t of state.turmasProfessor) {
            const ano = parseInt(t.match(/\d+/)?.[0]) || 10;
            if (ano >= 11) {
                const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                snap.forEach(d => alunosAvaliados.push({ id: d.id, ...d.data() }));
            }
        }

        let html = '';

        if (coordTabAtiva === 'fct') {
            // 1. ZONA DE DESBLOQUEIO (Exclusivo 11º Ano)
            let turmas11 = state.turmasProfessor.filter(t => (parseInt(t.match(/\d+/)?.[0]) || 10) === 11);
            if(turmas11.length > 0) {
                html += `<h4 style="color:var(--text-light); margin-bottom:10px; font-size:0.9rem;"><i class="fa-solid fa-unlock-keyhole" style="color:#0ea5e9;"></i> Controlo de Acesso (11º Ano)</h4>`;
                turmas11.forEach(t => {
                    html += `<div style="display:flex; justify-content:space-between; align-items:center; background:rgba(0,0,0,0.2); padding:10px 15px; border-radius:8px; border:1px solid #333; margin-bottom:20px;">
                        <strong style="color:white; font-size:1rem;">Turma ${t}</strong>
                        <button onclick="window.desbloquearFCTTurma('${t}', this)" class="primary-btn small-btn" style="background:#0ea5e9; width:auto; padding:8px 15px;"><i class="fa-solid fa-unlock"></i> Libertar Estágio na App</button>
                    </div>`;
                });
            }

            html += `<h4 style="color:var(--text-light); margin-bottom:10px; margin-top:20px; font-size:0.9rem;"><i class="fa-solid fa-list-check" style="color:var(--primary-green);"></i> Acompanhamento Individual</h4>`;
            
            // Ordena alunos (os que têm menos horas aparecem primeiro, para ajudar na gestão)
            alunosAvaliados.sort((a,b) => (a.fct?.horasRealizadas || 0) - (b.fct?.horasRealizadas || 0));
            
            alunosAvaliados.forEach(al => {
                const horas = al.fct?.horasRealizadas || 0;
                let statusColor = '#333';
                let barraWidth = (horas / 400) * 100; // Assume 400h como um estágio padrão para visualização
                if(barraWidth > 100) barraWidth = 100;

                if(horas === 0) statusColor = 'var(--danger-red)';
                else if(al.fct?.validadoDT) statusColor = 'var(--success-green)';
                else statusColor = 'var(--warning-yellow)';

                // 2. CHECKLIST BUROCRÁTICA DINÂMICA
                const docsRef = [
                    { id: 'protocolo', nome: 'Protocolo de Estágio' },
                    { id: 'plano', nome: 'Plano de Estágio' },
                    { id: 'folhas', nome: 'Folhas de Registo' },
                    { id: 'registos', nome: 'Registos do Tutor' },
                    { id: 'avaliacao', nome: 'Avaliações Finais' }
                ];
                
                let burocHtml = '<div style="margin-top:15px; padding-top:10px; border-top:1px dashed #333; display:flex; flex-direction:column; gap:5px;">';
                docsRef.forEach(d => {
                    let st = al.fct?.burocracia?.[d.id] || 0;
                    let act = '';
                    
                    if(st === 0) act = '<span style="color:var(--text-muted); font-size:0.7rem;"><i class="fa-solid fa-xmark"></i> Pendente</span>';
                    else if(st === 1) act = `<button onclick="window.validarDocFCT('${al.id}', '${d.id}', this)" class="primary-btn small-btn" style="background:var(--success-green); padding:4px 10px; font-size:0.75rem; width:auto; border:none; box-shadow:0 0 10px rgba(0,204,136,0.3);"><i class="fa-solid fa-check"></i> Validar</button>`;
                    else act = '<span style="color:var(--success-green); font-size:0.75rem; font-weight:bold;"><i class="fa-solid fa-check-double"></i> Validado</span>';

                    burocHtml += `<div style="display:flex; justify-content:space-between; align-items:center; font-size:0.85rem; background:rgba(0,0,0,0.2); padding:8px 10px; border-radius:4px;"><span style="color:var(--text-light);">${d.nome}</span>${act}</div>`;
                });
                burocHtml += '</div>';

                // 3. CARTÃO DO ALUNO
                html += `
                <div class="card aluno-list-item" style="border-left: 4px solid ${statusColor}; padding: 15px; margin-bottom: 15px; cursor:default;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:15px;">
                        <div style="flex:1;">
                            <strong style="color:white; font-size:1.1rem;">${nomeCurto(al.nome)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span>
                            <div style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">Entidade: <strong style="color:#0ea5e9;">${al.fct?.empresa || 'Não definida'}</strong></div>
                        </div>
                        <div style="text-align:right;">
                            <strong style="color:${statusColor}; font-size:1.3rem; display:block;">${horas}h</strong>
                            <span style="font-size:0.75rem; color:var(--text-muted);">${al.fct?.validadoDT ? '<span style="color:var(--success-green);"><i class="fa-solid fa-check-double"></i> Fechado</span>' : (horas>0 ? `<button onclick="window.validarFCTHoras('${al.id}', this)" class="secondary-btn small-btn" style="padding:6px 10px; font-size:0.75rem; margin-top:5px; color:var(--success-green); border-color:var(--success-green);"><i class="fa-solid fa-lock"></i> Fechar Horas</button>` : 'Sem Registos')}</span>
                        </div>
                    </div>
                    <div style="height: 6px; width: 100%; background: #222; border-radius: 3px; overflow:hidden;">
                        <div style="height: 100%; width: ${barraWidth}%; background: ${statusColor}; transition:0.3s;"></div>
                    </div>
                    ${burocHtml}
                </div>`;
            });

        } else {
            // Tab PAP
            alunosAvaliados.forEach(al => {
                const ano = parseInt(al.turma.match(/\d+/)?.[0]) || 10;
                if(ano !== 12) return; // PAP é exclusiva de 12º Ano

                const temTema = al.pap?.temaAprovado;
                const temRelatorio = al.pap?.relatorioAprovado;
                const statusColor = temRelatorio ? 'var(--success-green)' : (temTema ? 'var(--warning-yellow)' : 'var(--danger-red)');
                const txtStatus = temRelatorio ? '<i class="fa-solid fa-flag-checkered"></i> Apto para Defesa' : (temTema ? '<i class="fa-solid fa-person-digging"></i> Em Desenvolvimento' : '<i class="fa-solid fa-triangle-exclamation"></i> Atrasado');

                html += `
                <div class="card aluno-list-item" data-id="${al.id}" style="border-left: 4px solid ${statusColor}; padding: 15px; margin-bottom: 12px; cursor:default;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div style="flex:1;">
                            <strong style="color:white; font-size:1.1rem;">${nomeCurto(al.nome)}</strong> <span style="font-size:0.75rem; color:var(--text-muted);">(${al.turma})</span>
                            <div style="font-size:0.85rem; color:var(--text-light); margin-top:8px;">Orientador: ${al.pap?.orientador ? `<strong style="color:var(--accent-purple);">${nomeCurto(al.pap.orientador)}</strong>` : '<strong style="color:var(--danger-red);">Sem Orientador</strong>'}</div>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:0.75rem; color:${statusColor}; font-weight:bold;">${txtStatus}</span>
                        </div>
                    </div>
                </div>`;
            });
        }

        container.innerHTML = html === '' ? '<p class="text-muted center">Sem dados de projetos para mostrar.</p>' : html;

    } catch (err) {
        container.innerHTML = '<p class="text-danger center">Erro a carregar projetos da coordenação.</p>';
    }
}
