import { collection, getDocs, getDoc, doc, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";
import { obterDisciplinasDoAno } from "./aluno-caderneta.js"; // IMPORTAÇÃO NOVA!

let ahModo = 'dia', ahDOff = 0, ahSOff = 0;

const BLOCOS_HORARIO = [
    { i: "08:30", f: "09:30", n: 1 }, 
    { i: "09:35", f: "10:35", n: 2 }, 
    { i: "10:50", f: "11:50", n: 3 }, 
    { i: "11:55", f: "12:55", n: 4 }, 
    { i: "13:00", f: "14:00", n: 5 }, 
    { i: "14:05", f: "15:05", n: 6 },
    { i: "15:15", f: "16:15", n: 7 },
    { i: "16:20", f: "17:20", n: 8 }
];

function getEmptyState(mensagem, icone = "fa-folder-open") {
    return `<div style="text-align:center; padding: 40px 20px; opacity: 0.5;">
                <i class="fa-solid ${icone}" style="font-size: 3.5rem; margin-bottom: 15px; color: var(--text-muted);"></i>
                <p style="font-size: 0.95rem; color: var(--text-muted);">${mensagem}</p>
            </div>`;
}

function getLocalIsoDate(dObj) {
    const y = dObj.getFullYear();
    const m = String(dObj.getMonth() + 1).padStart(2, '0');
    const day = String(dObj.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
}

export function setupHorario() {
    document.getElementById('tab-aluno-eventos')?.addEventListener('click', (e) => { 
        document.querySelectorAll('#view-aluno-agenda .falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); 
        document.getElementById('aluno-agenda-content').style.display = 'block'; 
        document.getElementById('aluno-horario-container').style.display = 'none'; 
        document.getElementById('aluno-agenda-filtros').style.display = 'flex'; 
        carregarAgendaAlunoLista();
    });
    
    document.getElementById('tab-aluno-horario')?.addEventListener('click', (e) => { 
        document.querySelectorAll('#view-aluno-agenda .falta-tab-btn').forEach(b => b.classList.remove('active')); e.target.classList.add('active'); 
        document.getElementById('aluno-agenda-content').style.display = 'none'; 
        document.getElementById('aluno-horario-container').style.display = 'block'; 
        document.getElementById('aluno-agenda-filtros').style.display = 'none'; 
        carregarHorarioAluno(); 
    });

    ['aluno-filtro-agenda-testes', 'aluno-filtro-agenda-trabalhos', 'aluno-filtro-agenda-outros'].forEach(id => { 
        document.getElementById(id)?.addEventListener('change', carregarAgendaAlunoLista); 
    });
    
    document.getElementById('aluno-filtro-materiais-disc')?.addEventListener('change', carregarMateriaisAluno);
    
    document.getElementById('btn-aluno-horario-dia')?.addEventListener('click', () => { 
        document.getElementById('btn-aluno-horario-dia').classList.add('active'); 
        document.getElementById('btn-aluno-horario-grelha').classList.remove('active'); 
        ahModo = 'dia'; carregarHorarioAluno(); 
    });
    
    document.getElementById('btn-aluno-horario-grelha')?.addEventListener('click', () => { 
        document.getElementById('btn-aluno-horario-grelha').classList.add('active'); 
        document.getElementById('btn-aluno-horario-dia').classList.remove('active'); 
        ahModo = 'semana'; carregarHorarioAluno(); 
    });
    
    document.getElementById('btn-aluno-prev-horario')?.addEventListener('click', () => { if(ahModo==='dia') ahDOff--; else ahSOff--; carregarHorarioAluno(); });
    document.getElementById('btn-aluno-next-horario')?.addEventListener('click', () => { if(ahModo==='dia') ahDOff++; else ahSOff++; carregarHorarioAluno(); });
}

async function carregarAgendaAlunoLista() {
    const sC = document.getElementById('aluno-agenda-content'); sC.innerHTML = '<p class="text-muted center">A sincronizar agenda...</p>'; 
    if(!window.minhaTurma) { sC.innerHTML = getEmptyState('Sem turma configurada.', 'fa-calendar-xmark'); return; }
    
    const mT = document.getElementById('aluno-filtro-agenda-testes')?.checked ?? true; 
    const mTr = document.getElementById('aluno-filtro-agenda-trabalhos')?.checked ?? true; 
    const mO = document.getElementById('aluno-filtro-agenda-outros')?.checked ?? true;
    
    try {
        const evDb = await getDocs(collection(window.db, "turmas", window.minhaTurma, "eventos")); 
        if(evDb.empty) { sC.innerHTML = getEmptyState('Sem eventos na escola.', 'fa-calendar-xmark'); return; }
        
        let evs = []; 
        evDb.forEach(d => { 
            const e = d.data(); let bgC = '#8b5cf6'; let txtT = 'Evento'; 
            if(e.tipo === 'teste' || e.tipo === 'avaliacao') { if(mT) { bgC = '#f59e0b'; txtT = 'Avaliação'; evs.push({...e, cor: bgC, txt: txtT}); } } 
            else if(e.tipo === 'trabalho' || e.tipo === 'entrega') { if(mTr) { bgC = '#00d2ff'; txtT = 'Entrega'; evs.push({...e, cor: bgC, txt: txtT}); } } 
            else { if(mO) evs.push({...e, cor: bgC, txt: txtT}); } 
        });
        
        if(evs.length === 0) { sC.innerHTML = getEmptyState('Nenhum evento com os filtros atuais.', 'fa-filter'); return; }
        
        const hj = getLocalIsoDate(new Date()); 
        const fut = evs.filter(e => (e.data || '') >= hj).sort((a,b) => (a.data || '').localeCompare(b.data || '')); 
        const pas = evs.filter(e => (e.data || '') < hj).sort((a,b) => (b.data || '').localeCompare(a.data || ''));
        const mA = ['Jan','Fev','Mar','Abr','Mai','Jun','Jul','Ago','Set','Out','Nov','Dez']; 
        
        let html = '';
        const rEv = (ev) => { 
            if (!ev.data) return ''; 
            const dp = ev.data.split('-'); const mes = mA[parseInt(dp[1])-1]; 
            const tInfo = ev.tempo ? ` • <i class="fa-regular fa-clock"></i> ${ev.tempo}` : '';
            return `<div class="calendar-event-card" style="border-left-color:${ev.cor}; margin-bottom:10px;">
                        <div class="calendar-date-box"><span class="day">${dp[2]}</span><span class="month" style="color:${ev.cor};">${mes}</span></div>
                        <div class="calendar-info"><h4 style="margin:0; color:var(--text-light);">${ev.titulo}</h4><span style="font-size:0.8rem; color:var(--text-muted);">${(ev.txt||'evento').toUpperCase()}${tInfo}</span></div>
                    </div>`; 
        };
        
        if(fut.length > 0) fut.forEach(e => html += rEv(e)); else html += '<p class="text-muted center">Sem eventos futuros.</p>';
        if(pas.length > 0) { html += '<div class="calendar-divider" style="margin-top:20px;"><span>Passados</span></div>'; pas.forEach(e => html += rEv(e)); } 
        sC.innerHTML = html;
    } catch(e) { sC.innerHTML = getEmptyState('Erro ao sincronizar.', 'fa-triangle-exclamation'); }
}

async function carregarHorarioAluno() {
    const c = document.getElementById('aluno-horario-content'); c.innerHTML = '<p class="text-muted center">A carregar horário...</p>'; 
    if(!window.minhaTurma) return;

    try {
        const snap = await getDoc(doc(window.db, "turmas", window.minhaTurma)); 
        const hor = (snap.exists() && snap.data().horario) ? snap.data().horario : {};
        const baseDate = new Date(); 
        
        if(ahModo === 'dia') {
            baseDate.setDate(baseDate.getDate() + ahDOff);
            while(baseDate.getDay()===0 || baseDate.getDay()===6) { ahDOff += (ahDOff>=0 ? 1 : -1); baseDate.setDate(new Date().getDate() + ahDOff); }
            
            const dIso = getLocalIsoDate(baseDate); 
            const dSem = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][baseDate.getDay()];
            document.getElementById('aluno-horario-display').innerText = `${dSem}, ${baseDate.toLocaleDateString('pt-PT')}`;
            
            let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
            BLOCOS_HORARIO.forEach(b => {
                const val = hor[`${dIso}_${b.n}`];
                if(val) {
                    html += `<div class="card" style="border-left:4px solid var(--primary-green); display:flex; align-items:center; gap:15px; padding:12px;"><div style="text-align:center; min-width:50px;"><strong style="color:var(--text-light); display:block; font-size:1.1rem;">${b.i}</strong><span style="color:var(--text-muted); font-size:0.75rem;">${b.f}</span></div><div style="flex:1; border-left:1px solid #333; padding-left:15px;"><strong style="color:var(--primary-green); font-size:1.1rem;">${val}</strong></div></div>`;
                } else {
                    html += `<div class="card" style="border-left:4px solid #333; display:flex; align-items:center; gap:15px; padding:12px; background:rgba(0,0,0,0.1);"><div style="text-align:center; min-width:50px;"><strong style="color:var(--text-muted); display:block; font-size:1.1rem;">${b.i}</strong><span style="color:#555; font-size:0.75rem;">${b.f}</span></div><div style="flex:1; border-left:1px solid #333; padding-left:15px;"><strong style="color:#555; font-size:1.1rem;">-</strong></div></div>`;
                }
            });
            c.innerHTML = html + '</div>';
        
        } else {
            const curr = new Date(baseDate.setDate(baseDate.getDate() - baseDate.getDay() + 1 + (ahSOff*7)));
            const pDia = getLocalIsoDate(curr);
            const diasSemanaISO = [];
            
            for(let i=0; i<5; i++) {
                const tempDate = new Date(curr); tempDate.setDate(curr.getDate() + i);
                diasSemanaISO.push(getLocalIsoDate(tempDate));
            }
            curr.setDate(curr.getDate() + 4); 
            const uDia = getLocalIsoDate(curr);
            
            document.getElementById('aluno-horario-display').innerText = `${pDia.split('-').reverse().slice(0,2).join('/')} a ${uDia.split('-').reverse().slice(0,2).join('/')}`;

            let html = `<div style="overflow-x: auto; padding-bottom:20px;">
                            <table style="width:100%; min-width: 500px; border-collapse: collapse; text-align:center; font-size:0.85rem; color:var(--text-light);">
                                <thead>
                                    <tr>
                                        <th style="padding:10px; border-bottom:2px solid var(--primary-green); color:var(--text-muted);">Hora</th>
                                        <th style="padding:10px; border-bottom:2px solid var(--primary-green);">Seg</th>
                                        <th style="padding:10px; border-bottom:2px solid var(--primary-green);">Ter</th>
                                        <th style="padding:10px; border-bottom:2px solid var(--primary-green);">Qua</th>
                                        <th style="padding:10px; border-bottom:2px solid var(--primary-green);">Qui</th>
                                        <th style="padding:10px; border-bottom:2px solid var(--primary-green);">Sex</th>
                                    </tr>
                                </thead>
                                <tbody>`;
            
            BLOCOS_HORARIO.forEach(b => {
                html += `<tr><td style="padding:10px; border-bottom:1px solid #333; color:var(--text-muted); font-weight:bold;">${b.i}<br><span style="font-size:0.7rem;">${b.f}</span></td>`;
                for(let i=0; i<5; i++) {
                    const val = hor[`${diasSemanaISO[i]}_${b.n}`];
                    if(val) {
                        html += `<td style="padding:10px; border-bottom:1px solid #333;"><div style="background:rgba(0,204,136,0.1); color:var(--primary-green); padding:5px; border-radius:6px; font-weight:bold; white-space:nowrap;">${val}</div></td>`;
                    } else {
                        html += `<td style="padding:10px; border-bottom:1px solid #333; color:#555;">-</td>`;
                    }
                }
                html += `</tr>`;
            });
            c.innerHTML = html + `</tbody></table></div>`;
        }
    } catch(e) { c.innerHTML = '<p class="text-danger center">Erro ao desenhar horário.</p>'; }
}

export async function carregarMateriaisAluno() {
    const c = document.getElementById('aluno-lista-materiais-container'); 
    c.innerHTML = '<p class="text-muted center"><i class="fa-solid fa-spinner fa-spin"></i> A ler o livro de ponto...</p>'; 
    if(!window.minhaTurma) return;
    
    try {
        let sum = []; 
        
        // 👉 AQUI ESTÁ A CHAVE: Ir ler à coleção "sumarios" onde o Professor acabou de gravar!
        const rSumarios = await getDocs(query(collection(window.db, "turmas", window.minhaTurma, "sumarios"))); 
        rSumarios.forEach(d => { 
            const data = d.data();
            sum.push({
                id: d.id, 
                _tipo: 'sumario', 
                disciplina: data.disciplina || "Geral",
                professor: data.professor || "Desconhecido",
                data: data.dataLancamento ? new Date(data.dataLancamento).toLocaleDateString('pt-PT') : '',
                timestamp: data.dataLancamento ? new Date(data.dataLancamento).getTime() : 0,
                titulo: data.titulo || "Aula",
                descricao: data.texto || "",
                // O ficheiro que guardámos em Base64
                ficheiroBase64: data.anexoBase64 || null, 
                anexoNome: data.anexoNome || null,
                temAnexo: data.temAnexo || false
            }); 
        });
        
        // Organizar Filtros de Disciplinas
        const fS = document.getElementById('aluno-filtro-materiais-disc'); 
        if (fS) { 
            const currVal = fS.value;
            let oH = '<option value="">Todas as Disciplinas</option>'; 
            obterDisciplinasDoAno().forEach(dc => oH += `<option value="${dc}">${dc}</option>`); 
            fS.innerHTML = oH; 
            fS.value = currVal; 
        }
        
        const fA = fS ? fS.value : ""; 
        if(fA) sum = sum.filter(s => s.disciplina === fA); 
        
        // Ordenar do mais recente para o mais antigo (pela data de lançamento)
        sum.sort((a,b) => b.timestamp - a.timestamp); 
        
        if(sum.length === 0) { c.innerHTML = getEmptyState('Ainda não há sumários registados.', 'fa-filter'); return; }
        
        let html = ''; 
        sum.forEach(s => { 
            let btnAcao = '';
            
            // Se tem anexo validado, desenha o botão de download
            if (s.temAnexo && s.ficheiroBase64) {
                btnAcao = `
                <div style="margin-top: 15px; border-top: 1px dashed #444; padding-top: 12px;">
                    <a href="${s.ficheiroBase64}" download="${s.anexoNome || 'Ficha_de_Trabalho'}" 
                       style="display: inline-flex; align-items: center; justify-content: center; width: 100%; gap: 8px; background: rgba(0, 153, 255, 0.1); border: 1px solid #0099ff; color: #0099ff; padding: 10px; border-radius: 6px; text-decoration: none; font-size: 0.85rem; font-weight: bold; transition: 0.3s;">
                        <i class="fa-solid fa-download"></i> Descarregar: ${s.anexoNome || 'Anexo'}
                    </a>
                </div>`;
            }
            
            html += `
            <div class="card" style="margin-bottom:15px; border-left: 4px solid #0099ff; background:rgba(255,255,255,0.02); padding: 15px;">
                <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom: 5px;">
                    <strong style="color:#0099ff; font-size:1rem;">${s.disciplina} - ${s.titulo}</strong>
                    <span style="color:var(--text-muted); font-size:0.75rem;">${s.data}</span>
                </div>
                <span style="font-size:0.75rem; color:var(--text-muted); display:block; margin-bottom:10px;">
                    <i class="fa-solid fa-user-tie"></i> Prof. ${s.professor}
                </span>
                ${s.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-bottom:0; line-height:1.4; white-space:pre-wrap;">${s.descricao}</p>` : ''}
                
                ${btnAcao}
            </div>`; 
        }); 
        c.innerHTML = html;
    } catch(e) { console.error(e); c.innerHTML = '<p class="text-danger center">Erro ao carregar sumários.</p>'; }
}