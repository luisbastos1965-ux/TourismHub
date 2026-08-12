import { collection, getDocs, getDoc, doc, query } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let ahModo = 'dia', ahDOff = 0, ahSOff = 0;

// Configuração fácil dos tempos letivos da tua escola! (Ajusta os i e f à vontade)
const BLOCOS_HORARIO = [
    { i: "08:30", f: "10:00", n: 1 }, 
    { i: "10:15", f: "11:45", n: 2 }, 
    { i: "12:00", f: "13:30", n: 3 }, 
    { i: "13:30", f: "15:00", n: 4 }, 
    { i: "15:15", f: "16:45", n: 5 }, 
    { i: "17:00", f: "18:30", n: 6 }
];

function getEmptyState(mensagem, icone = "fa-folder-open") {
    return `<div style="text-align:center; padding: 40px 20px; opacity: 0.5;">
                <i class="fa-solid ${icone}" style="font-size: 3.5rem; margin-bottom: 15px; color: var(--text-muted);"></i>
                <p style="font-size: 0.95rem; color: var(--text-muted);">${mensagem}</p>
            </div>`;
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
        
        const hj = new Date().toISOString().split('T')[0]; 
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
            const dIso = baseDate.toISOString().split('T')[0]; const dSem = ['Dom','Seg','Ter','Qua','Qui','Sex','Sáb'][baseDate.getDay()];
            document.getElementById('aluno-horario-display').innerText = `${dSem}, ${baseDate.toLocaleDateString('pt-PT')}`;
            
            let html = '<div style="display:flex; flex-direction:column; gap:10px;">';
            let temAulas = false;
            BLOCOS_HORARIO.forEach(b => {
                const val = hor[`${dIso}_${b.n}`];
                if(val) { temAulas = true; html += `<div class="card" style="border-left:4px solid var(--primary-green); display:flex; align-items:center; gap:15px; padding:12px;"><div style="text-align:center; min-width:50px;"><strong style="color:var(--text-light); display:block; font-size:1.1rem;">${b.i}</strong><span style="color:var(--text-muted); font-size:0.75rem;">${b.f}</span></div><div style="flex:1; border-left:1px solid #333; padding-left:15px;"><strong style="color:var(--primary-green); font-size:1.1rem;">${val}</strong></div></div>`; }
            });
            c.innerHTML = temAulas ? html + '</div>' : getEmptyState('Sem aulas marcadas para este dia.', 'fa-mug-hot');
        } else {
            // NOVO VISUAL DA SEMANA (Estilo Feed Mobile Agrupado por Dia)
            const curr = new Date(baseDate.setDate(baseDate.getDate() - baseDate.getDay() + 1 + (ahSOff*7)));
            const pDia = curr.toISOString().split('T')[0];
            const nomesDias = ['Segunda-feira', 'Terça-feira', 'Quarta-feira', 'Quinta-feira', 'Sexta-feira'];
            const diasSemanaISO = [];
            
            for(let i=0; i<5; i++) {
                const tempDate = new Date(curr); tempDate.setDate(curr.getDate() + i);
                diasSemanaISO.push(tempDate.toISOString().split('T')[0]);
            }
            curr.setDate(curr.getDate() + 4); const uDia = curr.toISOString().split('T')[0];
            document.getElementById('aluno-horario-display').innerText = `${pDia.split('-').reverse().slice(0,2).join('/')} a ${uDia.split('-').reverse().slice(0,2).join('/')}`;

            let html = `<div style="display:flex; flex-direction:column; gap:20px; padding-bottom:20px;">`;
            let teveQualquerAula = false;

            for(let i=0; i<5; i++) {
                let htmlDia = ''; let temAulaNoDia = false;
                BLOCOS_HORARIO.forEach(b => {
                    const val = hor[`${diasSemanaISO[i]}_${b.n}`];
                    if(val) {
                        temAulaNoDia = true; teveQualquerAula = true;
                        htmlDia += `<div style="display:flex; align-items:center; justify-content:space-between; padding:8px 12px; background:rgba(0,0,0,0.2); border-radius:6px; margin-bottom:5px; border-left: 2px solid var(--primary-green);">
                                        <div style="display:flex; gap:10px; align-items:center;">
                                            <span style="font-weight:bold; color:var(--text-light); font-size:0.9rem; min-width:45px;">${b.i}</span>
                                            <span style="color:var(--primary-green); font-weight:bold;">${val}</span>
                                        </div>
                                    </div>`;
                    }
                });
                
                if(temAulaNoDia) {
                    html += `<div class="card" style="padding:15px; border:1px solid #333;">
                                <h4 style="color:var(--text-muted); font-size:0.9rem; text-transform:uppercase; margin:0 0 10px 0;"><i class="fa-regular fa-calendar-days"></i> ${nomesDias[i]}</h4>
                                ${htmlDia}
                             </div>`;
                }
            }

            if(!teveQualquerAula) html = getEmptyState('A tua semana está livre de aulas.', 'fa-bed');
            c.innerHTML = html + `</div>`;
        }
    } catch(e) { c.innerHTML = '<p class="text-danger center">Erro ao desenhar horário.</p>'; }
}

export async function carregarMateriaisAluno() {
    const c = document.getElementById('aluno-lista-materiais-container'); 
    c.innerHTML = '<p class="text-muted center">A carregar materiais...</p>'; 
    if(!window.minhaTurma) return;
    
    try {
        const r = await getDocs(query(collection(window.db, "turmas", window.minhaTurma, "materiais"))); 
        if(r.empty) { c.innerHTML = getEmptyState('Nenhum material publicado.', 'fa-book-open'); return; }
        
        let sum = []; let dU = new Set(); 
        r.forEach(d => { const dt = d.data(); sum.push({id: d.id, ...dt}); dU.add(dt.disciplina); });
        
        const fS = document.getElementById('aluno-filtro-materiais-disc'); 
        if (fS && fS.options.length <= 1) { 
            let oH = '<option value="">Todas as Disciplinas</option>'; 
            Array.from(dU).sort().forEach(dc => oH += `<option value="${dc}">${dc}</option>`); 
            fS.innerHTML = oH; 
        }
        
        const fA = fS ? fS.value : ""; 
        if(fA) sum = sum.filter(s => s.disciplina === fA); 
        sum.sort((a,b) => b.timestamp - a.timestamp || (b.data || "").localeCompare(a.data || "")); 
        
        if(sum.length === 0) { c.innerHTML = getEmptyState('Sem materiais para esta disciplina.', 'fa-filter'); return; }
        
        let html = ''; 
        sum.forEach(s => { 
            const ficheiro = s.ficheiroBase64 || s.anexoBase64; 
            const nomeFicheiro = s.anexoNome || 'Material_Anexo';
            const aB = ficheiro ? `<a href="${ficheiro}" download="${nomeFicheiro}" class="primary-btn small-btn" style="display:block; margin-top:15px; width:100%; text-align:center; padding:10px 12px; background-color:#0099ff; color:white;"><i class="fa-solid fa-download"></i> Baixar Anexo</a>` : ''; 
            
            html += `<div class="card" style="margin-bottom:15px; border-left: 4px solid #0099ff;">
                        <span style="font-size:0.75rem; color:var(--text-muted); text-transform:uppercase;">${s.data} | ${s.disciplina} | Prof. ${s.professor || ''}</span>
                        <h4 style="margin:5px 0; color:var(--text-light);">${s.titulo}</h4>
                        ${s.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">${s.descricao}</p>` : ''}
                        ${aB}
                     </div>`; 
        }); 
        c.innerHTML = html;
    } catch(e) { c.innerHTML = '<p class="text-danger center">Erro ao carregar os dados.</p>'; }
}
