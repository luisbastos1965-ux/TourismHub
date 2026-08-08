// js/prof/roles/coord-dashboard.js
import { db } from "../../firebase.js";
import { collection, getDocs, query, where } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state, nomeCurto } from "../store.js";
import { abrirPerfil360Aluno } from "../ui.js";

// Gere a tab ativa na vista de projetos
export let coordTabAtiva = 'fct';

export async function carregarEcraProjetosCoord() {
    const container = document.getElementById('lista-coord-projetos-dinamico');
    container.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A cruzar dados do curso...</p>';

    try {
        let alunosAvaliados = [];
        // Puxa todos os alunos do curso (baseado nas turmas associadas ao Coordenador)
        for (const t of state.turmasProfessor) {
            const ano = parseInt(t.match(/\d+/)?.[0]) || 10;
            // Só interessa 11º e 12º para FCT/PAP
            if (ano >= 11) {
                const snap = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", t), where("papel", "==", "aluno")));
                snap.forEach(d => alunosAvaliados.push({ id: d.id, ...d.data() }));
            }
        }

        let html = '';

        if (coordTabAtiva === 'fct') {
            // Ordena alunos com menos horas no topo (os mais problemáticos primeiro)
            alunosAvaliados.sort((a,b) => (a.fct?.horasRealizadas || 0) - (b.fct?.horasRealizadas || 0));
            
            alunosAvaliados.forEach(al => {
                const horas = al.fct?.horasRealizadas || 0;
                let statusColor = '#333';
                let barraWidth = (horas / 200) * 100; // Assumindo 200h como exemplo base de FCT
                if(barraWidth > 100) barraWidth = 100;

                if(horas === 0) statusColor = 'var(--danger-red)';
                else if(al.fct?.validadoDT) statusColor = 'var(--success-green)';
                else statusColor = 'var(--warning-yellow)';

                html += `
                <div class="card aluno-list-item" data-id="${al.id}" style="border-left: 4px solid ${statusColor}; cursor: pointer; padding: 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
                        <div>
                            <strong style="color:white; font-size:1rem;">${nomeCurto(al.nome)}</strong>
                            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:5px;">${al.turma}</span>
                        </div>
                        <strong style="color:${statusColor};">${horas}h</strong>
                    </div>
                    <div style="height: 6px; width: 100%; background: #222; border-radius: 3px; overflow:hidden;">
                        <div style="height: 100%; width: ${barraWidth}%; background: ${statusColor};"></div>
                    </div>
                    <div style="text-align:right; font-size:0.7rem; color:var(--text-muted); margin-top:5px;">${al.fct?.validadoDT ? 'Horas Validadas' : (horas>0 ? 'Por Validar' : 'Sem Registos')}</div>
                </div>`;
            });
        } else {
            // Tab PAP
            alunosAvaliados.forEach(al => {
                const ano = parseInt(al.turma.match(/\d+/)?.[0]) || 10;
                if(ano !== 12) return; // PAP só para 12º

                const temTema = al.pap?.temaAprovado;
                const temRelatorio = al.pap?.relatorioAprovado;
                const statusColor = temRelatorio ? 'var(--success-green)' : (temTema ? 'var(--warning-yellow)' : 'var(--danger-red)');
                const txtStatus = temRelatorio ? 'Apto para Defesa' : (temTema ? 'Em Desenvolvimento' : 'Atrasado / Sem Tema');

                html += `
                <div class="card aluno-list-item" data-id="${al.id}" style="border-left: 4px solid ${statusColor}; cursor: pointer; padding: 12px;">
                    <div style="display:flex; justify-content:space-between; align-items:flex-start;">
                        <div>
                            <strong style="color:white; font-size:1rem;">${nomeCurto(al.nome)}</strong>
                            <span style="font-size:0.75rem; color:var(--text-muted); margin-left:5px;">${al.turma}</span>
                            <div style="font-size:0.8rem; color:var(--text-light); margin-top:5px;">Orientador: ${al.pap?.orientador ? nomeCurto(al.pap.orientador) : '<span style="color:var(--danger-red);">Sem Orientador</span>'}</div>
                        </div>
                        <div style="text-align:right;">
                            <span style="font-size:0.75rem; color:${statusColor}; font-weight:bold;">${txtStatus}</span>
                        </div>
                    </div>
                </div>`;
            });
        }

        container.innerHTML = html === '' ? '<p class="text-muted center">Sem dados para mostrar.</p>' : html;

    } catch (err) {
        container.innerHTML = '<p class="text-danger center">Erro a carregar projetos.</p>';
    }
}
