import { db } from "./firebase.js";
import { collection, addDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { state } from "../store.js";
import { renderizarPautaTurma, renderizarFaltasTurma, abrirPerfil360Aluno } from "../ui.js";

export async function gerirCliquesTurmas(e) {
    try {
        if (e.target.closest('.aluno-list-item')) { 
            abrirPerfil360Aluno(e.target.closest('.aluno-list-item').getAttribute('data-id')); 
            return true; 
        }

        if (e.target.closest('#btn-ver-pauta')) { renderizarPautaTurma(); return true; }
        if (e.target.closest('#btn-ver-faltas-turma')) { renderizarFaltasTurma(); return true; }

        // PLANTA DA SALA
        if (e.target.closest('#btn-ver-planta')) { 
            if (!state.selectedTurma) { alert("Seleciona uma turma primeiro."); return true; } 
            document.getElementById('planta-sala-select').value = ''; 
            document.getElementById('planta-gerada-container').style.display = 'none'; 
            document.getElementById('planta-instrucoes-ia').value = ''; 
            const btnGerar = document.getElementById('btn-gerar-planta'); 
            btnGerar.disabled = true; btnGerar.style.opacity = '0.5'; 
            document.getElementById('modal-planta-sala').style.display = 'flex'; 
            return true; 
        }

        if (e.target.closest('#btn-gerar-planta')) {
            const salaId = document.getElementById('planta-sala-select').value; 
            const instrucoes = document.getElementById('planta-instrucoes-ia').value.toLowerCase();
            if(!salaId) return true; 
            const btn = document.getElementById('btn-gerar-planta'); 
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A calcular otimização...'; 
            btn.disabled = true;

            setTimeout(() => {
                let alunos = state.alunosTurmaRAM.map(al => ({ id: al.id, nome: al.nome, primeiroNome: al.nome.split(' ')[0], risco: Math.floor(Math.random() * 10) }));
                let naFrente = []; let noFundo = []; let separar = []; 
                const frases = instrucoes.split(/[.,\n]/);
                frases.forEach(frase => { 
                    let nomesNaFrase = alunos.filter(a => frase.includes(a.primeiroNome.toLowerCase())); 
                    if(frase.includes('frente') || frase.includes('primeira')) { nomesNaFrase.forEach(n => naFrente.push(n.id)); }
                    if(frase.includes('fundo') || frase.includes('trás') || frase.includes('ultima') || frase.includes('última')) { nomesNaFrase.forEach(n => noFundo.push(n.id)); }
                    if(frase.includes('separar') || frase.includes('afastar') || frase.includes('longe')) { if(nomesNaFrase.length >= 2) separar.push([nomesNaFrase[0].id, nomesNaFrase[1].id]); }
                });
                
                let modoAleatorio = instrucoes.includes('aleat'); let modoAlfabetico = instrucoes.includes('alfab');
                if (modoAlfabetico) { alunos.sort((a,b) => a.nome.localeCompare(b.nome)); } else if (modoAleatorio) { alunos.sort(() => 0.5 - Math.random()); } else { alunos.sort((a,b) => b.risco - a.risco); }
                
                const mesasDOM = Array.from(document.querySelectorAll('.mesa-planta')); 
                let slots = mesasDOM.map(m => { const dataMesa = m.getAttribute('data-mesa'); const parts = dataMesa.split('-'); return { el: m, id: dataMesa, linha: parseInt(parts[0]), coluna: parseInt(parts[1]), parId: parts.length === 3 ? `${parts[0]}-${parts[1]}` : dataMesa, aluno: null }; });
                let unassigned = [...alunos];
                
                const assign = (alunoId, slotCondition) => { const alIndex = unassigned.findIndex(a => a.id === alunoId); if(alIndex === -1) return; const al = unassigned[alIndex]; const slot = slots.find(s => s.aluno === null && slotCondition(s)); if(slot) { slot.aluno = al; unassigned.splice(alIndex, 1); } };
                naFrente.forEach(id => assign(id, s => s.linha === 0)); 
                let maxLinha = Math.max(...slots.map(s => s.linha)); noFundo.forEach(id => assign(id, s => s.linha === maxLinha));
                unassigned.forEach(al => { const slot = slots.find(s => s.aluno === null); if(slot) slot.aluno = al; });
                
                separar.forEach(par => { const s1 = slots.find(s => s.aluno?.id === par[0]); const s2 = slots.find(s => s.aluno?.id === par[1]); if(s1 && s2 && s1.parId === s2.parId) { const s3 = slots.find(s => s.aluno !== null && s.parId !== s1.parId && s.aluno.id !== par[0] && s.aluno.id !== par[1]); if(s3) { const temp = s2.aluno; s2.aluno = s3.aluno; s3.aluno = temp; } } });
                slots.forEach(s => { if(s.aluno) { s.el.innerText = s.aluno.primeiroNome; s.el.style.color = 'white'; s.el.style.borderColor = 'var(--primary-green)'; s.el.style.background = 'rgba(0, 204, 136, 0.15)'; } else { s.el.innerText = 'Vazio'; s.el.style.color = 'var(--text-muted)'; s.el.style.borderColor = '#555'; s.el.style.background = '#1c1f26'; } });
                
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Refazer Disposição'; btn.disabled = false; document.getElementById('btn-exportar-planta').style.display = 'block';
            }, 800);
            return true;
        }

        // AVISOS GLOBAIS
        if (e.target.closest('#btn-abrir-aviso-global') || e.target.closest('#btn-abrir-aviso-global-coord')) { 
            let options = ''; 
            if (state.activeRole === 'coordenador') { options = '<option value="todas">Todas as minhas turmas</option>' + state.turmasProfessor.map(t => `<option value="${t}">Turma ${t}</option>`).join(''); } 
            else { options = `<option value="${state.selectedTurma}">Turma ${state.selectedTurma}</option>`; } 
            document.getElementById('aviso-destino-turma').innerHTML = options; 
            document.getElementById('aviso-titulo').value = ''; document.getElementById('aviso-mensagem').value = ''; 
            document.getElementById('modal-aviso-global').style.display = 'flex'; 
            return true; 
        }

        if (e.target.closest('#btn-enviar-aviso-global')) { 
            const destino = document.getElementById('aviso-destino-turma').value; 
            const titulo = document.getElementById('aviso-titulo').value.trim(); 
            const mensagem = document.getElementById('aviso-mensagem').value.trim(); 
            if (!titulo || !mensagem) { alert("Preenche o título e a mensagem do aviso."); return true; }
            const btn = e.target.closest('#btn-enviar-aviso-global'); 
            const originalText = btn.innerHTML; 
            btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; btn.disabled = true; 
            try { 
                let turmasAlvo = destino === 'todas' ? state.turmasProfessor : [destino]; 
                for (const t of turmasAlvo) { await addDoc(collection(db, "turmas", t, "avisos"), { titulo: titulo, mensagem: mensagem, autor: state.myUserName, papel: state.activeRole, timestamp: Date.now() }); } 
                btn.innerHTML = '<i class="fa-solid fa-check"></i> Enviado'; 
                setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; document.getElementById('modal-aviso-global').style.display = 'none'; }, 1500); 
            } catch (err) { btn.innerHTML = 'Erro!'; setTimeout(() => { btn.innerHTML = originalText; btn.disabled = false; }, 2000); } 
            return true; 
        }

        return false;
    } catch (err) { return false; }
}
