import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, query, where, getDocs, setDoc, addDoc, updateDoc } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

const matrizCurso = { 
    "Sociocultural": { "PORT": {"M1": 27, "M2": 24, "M3": 27}, "ING": {"M1": 24, "M2": 24, "M3": 24}, "AI": {"M1": 30, "M2": 30}, "EF": {"M1": 20, "M2": 20, "M3": 20, "M4": 20, "M5": 20}, "TIC": {"M1": 24, "M2": 24, "M3": 27, "M4": 24} }, 
    "Científica": { "GEO": {"M1": 27, "M2": 24}, "HCA": {"M1": 24, "M2": 24, "M3": 27}, "MAT": {"M1": 30, "M2": 30, "M3": 30} }, 
    "Técnica": { "CF": {"M1": 30, "M2": 30, "M3": 30}, "TIAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "TCAT": {"M1": 25, "M2": 25, "M3": 25, "M4": 25}, "OTET": {"M1": 25, "M2": 25, "M3": 25, "M4": 25} } 
};

// Referências UI
const profDashboard = document.getElementById('prof-dashboard'); 
const classHubView = document.getElementById('class-hub-view'); 
const classView = document.getElementById('class-view'); 
const studentDetailView = document.getElementById('student-detail-view'); 
const viewAvaliacoes = document.getElementById('view-avaliacoes'); 
const viewDisciplinaModulos = document.getElementById('view-disciplina-modulos'); 
const viewFaltas = document.getElementById('view-faltas'); 
const viewPrhf = document.getElementById('view-prhf'); 
const viewClassCalendario = document.getElementById('view-class-calendario'); 
const viewSumarios = document.getElementById('view-sumarios'); 
const viewComportamento = document.getElementById('view-comportamento');
const viewMusai = document.getElementById('view-musai');
const viewObservacoes = document.getElementById('view-observacoes');

let turmaAtual = ""; 
let alunoAtualId = ""; 
let myUserName = "";

// Função Global de Navegação
function esconderTudoMenos(ecraAtivo) { 
    [profDashboard, classHubView, classView, studentDetailView, viewAvaliacoes, viewDisciplinaModulos, viewFaltas, viewPrhf, viewClassCalendario, viewSumarios, viewComportamento, viewMusai, viewObservacoes].forEach(el => { 
        if(el) el.style.display = 'none'; 
    }); 
    if(ecraAtivo) ecraAtivo.style.display = 'block'; 
}

// ==========================================
// 1. AUTENTICAÇÃO E NAVEGAÇÃO BÁSICA
// ==========================================
onAuthStateChanged(auth, async (user) => { 
    if (user) { 
        const userId = user.email.split('@')[0]; 
        try { 
            const docSnap = await getDoc(doc(db, "utilizadores", userId)); 
            if (docSnap.exists() && docSnap.data().papel === 'professor') { 
                myUserName = docSnap.data().nome.split(' ')[0]; 
                document.getElementById('header-user-name-staff').innerText = `Olá, ${myUserName}`; 
                esconderTudoMenos(profDashboard); 
            } else { 
                window.location.href = "index.html"; 
            } 
        } catch (e) { console.error("Erro na leitura de perfil:", e); } 
    } else { 
        window.location.href = "index.html"; 
    } 
});

document.getElementById('btn-logout-staff')?.addEventListener('click', () => { 
    signOut(auth).then(() => window.location.href = "index.html"); 
});

document.querySelectorAll('.btn-fechar-modal').forEach(b => b.addEventListener('click', () => { 
    document.querySelectorAll('.modal-overlay').forEach(m => m.style.display='none'); 
}));

// Eventos de Navegação
document.querySelectorAll('.turma-card-large').forEach(b => { 
    b.addEventListener('click', () => { 
        turmaAtual = b.getAttribute('data-turma'); 
        document.getElementById('class-hub-title').innerHTML = `Turma ${turmaAtual}`; 
        esconderTudoMenos(classHubView); 
    }); 
});

document.getElementById('btn-voltar-turmas-hub')?.addEventListener('click', () => esconderTudoMenos(profDashboard)); 
document.getElementById('btn-voltar-class-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView)); 
document.getElementById('btn-voltar-lista')?.addEventListener('click', () => esconderTudoMenos(classView)); 
document.getElementById('btn-voltar-hub-avaliacoes')?.addEventListener('click', () => esconderTudoMenos(studentDetailView)); 
document.getElementById('btn-voltar-disciplinas')?.addEventListener('click', () => esconderTudoMenos(viewAvaliacoes)); 
document.getElementById('btn-voltar-hub-faltas')?.addEventListener('click', () => esconderTudoMenos(studentDetailView)); 
document.getElementById('btn-voltar-hub-prhf')?.addEventListener('click', () => esconderTudoMenos(studentDetailView)); 
document.getElementById('btn-voltar-cal-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView)); 
document.getElementById('btn-voltar-sumarios-hub')?.addEventListener('click', () => esconderTudoMenos(classHubView)); 
document.getElementById('btn-voltar-hub-comportamento')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-hub-musai')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));
document.getElementById('btn-voltar-hub-observacoes')?.addEventListener('click', () => esconderTudoMenos(studentDetailView));

// ==========================================
// 2. CARREGAR ALUNOS DA TURMA
// ==========================================
document.getElementById('btn-hub-alunos')?.addEventListener('click', () => { 
    esconderTudoMenos(classView); 
    carregarAlunos(turmaAtual); 
}); 

async function carregarAlunos(turma) { 
    const container = document.querySelector('.students-list-container'); 
    container.innerHTML = '<p class="text-muted">A carregar...</p>'; 
    try { 
        const res = await getDocs(query(collection(db, "utilizadores"), where("turma", "==", turma), where("papel", "==", "aluno"))); 
        if (res.empty) { container.innerHTML = '<p class="text-muted">Sem alunos.</p>'; return; } 
        
        let html = '<ul class="students-list">'; 
        res.forEach((doc) => { 
            const a = doc.data(); 
            const avatar = a.fotoPerfil ? `<img src="${a.fotoPerfil}" class="list-avatar">` : `<div class="list-avatar"><i class="fa-solid fa-user"></i></div>`; 
            html += `
            <li class="student-item">
                <div style="display:flex; align-items:center; gap:12px;">${avatar}
                    <div class="student-info"><strong>${a.nome}</strong><span>${doc.id.toUpperCase()}</span></div>
                </div>
                <button class="secondary-btn small-btn btn-ver-aluno" data-nome="${a.nome}" data-numero="${doc.id}"><i class="fa-solid fa-eye"></i> Ver</button>
            </li>`; 
        }); 
        container.innerHTML = html + '</ul>'; 
        
        container.querySelectorAll('.btn-ver-aluno').forEach(btn => { 
            btn.addEventListener('click', async (e) => { 
                document.getElementById('detail-student-name').innerText = e.currentTarget.getAttribute('data-nome'); 
                alunoAtualId = e.currentTarget.getAttribute('data-numero'); 
                document.getElementById('detail-student-number').innerText = alunoAtualId.toUpperCase(); 
                esconderTudoMenos(studentDetailView); 
            }); 
        }); 
    } catch (e) { console.error(e); } 
}

// ==========================================
// 3. AVALIAÇÕES (NOTAS)
// ==========================================
document.getElementById('btn-hub-avaliacoes')?.addEventListener('click', () => { 
    esconderTudoMenos(viewAvaliacoes); 
    construirMatrizVisual(document.getElementById('matriz-disciplinas-container'), abrirModulos); 
});

function construirMatrizVisual(container, fn) { 
    let html = ""; 
    for (const [comp, discs] of Object.entries(matrizCurso)) { 
        html += `<div class="component-section"><div class="component-header">${comp}</div><div class="subject-grid">`; 
        for (const d of Object.keys(discs)) { 
            html += `<button class="subject-btn" data-disc="${d}">${d}</button>`; 
        } 
        html += `</div></div>`; 
    } 
    container.innerHTML = html; 
    container.querySelectorAll('.subject-btn').forEach(b => b.addEventListener('click', (e) => fn(e.currentTarget.getAttribute('data-disc')))); 
}

async function abrirModulos(disc) { 
    esconderTudoMenos(viewDisciplinaModulos); 
    document.getElementById('titulo-disciplina').innerText = disc; 
    
    const container = document.getElementById('lista-modulos-disciplina'); 
    container.innerHTML = '<p class="text-muted">A preparar pauta...</p>'; 
    
    const notas = {}; 
    try { 
        const q = await getDocs(collection(db, "utilizadores", alunoAtualId, "notas")); 
        q.forEach(d => { 
            if (d.data().disciplina === disc) { 
                notas[d.data().modulo] = d.data().nota; 
                notas[d.data().modulo + "_motivo"] = d.data().motivoRep; 
            } 
        }); 
    } catch(e) {} 
    
    let mods = []; 
    for (const comp of Object.values(matrizCurso)) { 
        if (comp[disc]) mods = Object.keys(comp[disc]); 
    } 
    
    let gradeBtns = ""; 
    for(let i=10; i<=20; i++) gradeBtns += `<button class="grade-btn" data-val="${i}">${i}</button>`; 
    gradeBtns += `<button class="grade-btn rep" data-val="REP">REP</button>`; 
    
    let html = ""; 
    mods.forEach(m => { 
        const n = notas[m] !== undefined ? notas[m] : "SN"; 
        let badgeClass = n==="SN" ? "sn" : n==="REP" ? "rep" : ""; 
        const mTxt = (n==="REP" && notas[m+"_motivo"]) ? `<div style="font-size:0.8rem; color:var(--text-muted); margin-top:5px;"><i>Motivo: ${notas[m+"_motivo"]}</i></div>` : ""; 
        
        html += `
        <div class="modulo-avaliar-item" style="display:flex; flex-direction:column;">
            <div class="mod-view" id="view-${disc}-${m}" style="display:flex; justify-content:space-between; width:100%; align-items:center;">
                <div><strong>${m}</strong>${mTxt}</div>
                <div style="display:flex; align-items:center; gap:15px;">
                    <span class="nota-badge ${badgeClass}">${n}</span>
                    <button class="secondary-btn small-btn btn-abrir-edicao-nota" data-mod="${m}"><i class="fa-solid fa-pen"></i></button>
                </div>
            </div>
            <div class="mod-edit" id="edit-${disc}-${m}" style="display:none; flex-direction:column; width:100%;">
                <div class="grade-grid" id="grid-${disc}-${m}">${gradeBtns}</div>
                <div id="rep-reason-box-${disc}-${m}" style="display:none; width:100%; margin-bottom:10px;">
                    <input type="text" id="input-reason-${disc}-${m}" placeholder="Motivo do REP" style="margin:0; padding:8px; font-size:0.9rem;">
                </div>
                <div style="display:flex; gap:10px;">
                    <button class="primary-btn small-btn btn-gravar-nota" data-disc="${disc}" data-mod="${m}" style="flex:1;">OK</button>
                    <button class="secondary-btn small-btn btn-fechar-edicao-nota" data-mod="${m}" style="flex:1;">Cancelar</button>
                </div>
            </div>
        </div>`; 
    }); 
    
    container.innerHTML = html; 
    
    container.querySelectorAll('.btn-abrir-edicao-nota').forEach(b => b.addEventListener('click', (e) => { 
        const m=e.currentTarget.getAttribute('data-mod'); 
        document.getElementById(`view-${disc}-${m}`).style.display='none'; 
        document.getElementById(`edit-${disc}-${m}`).style.display='flex'; 
    })); 
    
    container.querySelectorAll('.btn-fechar-edicao-nota').forEach(b => b.addEventListener('click', (e) => { 
        const m=e.currentTarget.getAttribute('data-mod'); 
        document.getElementById(`view-${disc}-${m}`).style.display='flex'; 
        document.getElementById(`edit-${disc}-${m}`).style.display='none'; 
    })); 
    
    let nTemp = {}; 
    container.querySelectorAll('.grade-btn').forEach(btn => { 
        btn.addEventListener('click', (e) => { 
            const gp = e.currentTarget.parentElement; 
            gp.querySelectorAll('.grade-btn').forEach(b => b.classList.remove('selected')); 
            e.currentTarget.classList.add('selected'); 
            const m = gp.id.split('-')[2]; 
            const d = gp.id.split('-')[1]; 
            const v = e.currentTarget.getAttribute('data-val'); 
            nTemp[m] = v; 
            document.getElementById(`rep-reason-box-${d}-${m}`).style.display = v === "REP" ? "block" : "none"; 
        }); 
    }); 
    
    container.querySelectorAll('.btn-gravar-nota').forEach(b => b.addEventListener('click', async (e) => { 
        const d = e.currentTarget.getAttribute('data-disc'); 
        const m = e.currentTarget.getAttribute('data-mod'); 
        const v = nTemp[m]; 
        if(!v) return; 
        
        const br = e.currentTarget; 
        br.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
        
        try { 
            await setDoc(doc(db, "utilizadores", alunoAtualId, "notas", `${d}_${m}`), { 
                disciplina: d, 
                modulo: m, 
                nota: v==="REP" ? "REP" : Number(v), 
                motivoRep: v==="REP" ? document.getElementById(`input-reason-${d}-${m}`).value : "", 
                data: new Date().toISOString() 
            }); 
            br.innerText = "Gravado!"; 
            setTimeout(() => { abrirModulos(d); }, 800); 
        } catch(err){ 
            br.innerText = "Erro!"; 
        } 
    })); 
}

// ==========================================
// 4. FALTAS E PRHF
// ==========================================
document.getElementById('btn-hub-faltas')?.addEventListener('click', () => { 
    esconderTudoMenos(viewFaltas); 
    carregarFaltas(); 
}); 

document.getElementById('btn-nova-falta')?.addEventListener('click', () => { 
    let opt = '<option value="">Disciplina</option>'; 
    for(const comp of Object.values(matrizCurso)) { 
        for(const d of Object.keys(comp)) opt += `<option value="${d}">${d}</option>`; 
    } 
    document.getElementById('nf-disc').innerHTML = opt; 
    document.getElementById('modal-nova-falta').style.display = 'flex'; 
}); 

document.getElementById('nf-disc')?.addEventListener('change', (e) => { 
    const d = e.target.value; 
    let mObj = {}; 
    for(const comp of Object.values(matrizCurso)) { 
        if(comp[d]) mObj = comp[d]; 
    } 
    let opt = '<option value="">Módulo</option>'; 
    Object.keys(mObj).forEach(m => opt += `<option value="${m}">${m}</option>`); 
    document.getElementById('nf-mod').innerHTML = opt; 
}); 

document.getElementById('btn-menos-hora')?.addEventListener('click', () => { 
    const i = document.getElementById('nf-horas'); 
    let v = parseInt(i.value) || 1; 
    if(v > 1) i.value = v - 1; 
}); 

document.getElementById('btn-mais-hora')?.addEventListener('click', () => { 
    const i = document.getElementById('nf-horas'); 
    let v = parseInt(i.value) || 1; 
    if(v < 8) i.value = v + 1; 
}); 

document.getElementById('btn-gravar-nova-falta')?.addEventListener('click', async (e) => { 
    const dI = document.getElementById('nf-data').value; 
    const disc = document.getElementById('nf-disc').value; 
    const mod = document.getElementById('nf-mod').value; 
    const h = parseInt(document.getElementById('nf-horas').value) || 1; 
    
    if(!dI || !disc || !mod) return alert("Preenche todos os campos!"); 
    
    const br = e.currentTarget; 
    br.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
    
    try { 
        await addDoc(collection(db, "utilizadores", alunoAtualId, "faltas"), { 
            dataInicio: dI, 
            disciplina: disc, 
            modulo: mod, 
            horas: h, 
            justificada: false, 
            criadoEm: new Date().toISOString() 
        }); 
        document.getElementById('modal-nova-falta').style.display = 'none'; 
        br.innerText = "Registar"; 
        carregarFaltas(); 
    } catch(err) { 
        br.innerText = "Erro!"; 
    } 
}); 

async function carregarFaltas() { 
    const container = document.getElementById('lista-historico-faltas-container'); 
    container.innerHTML = '<p class="text-muted">A carregar...</p>'; 
    try { 
        const res = await getDocs(query(collection(db, "utilizadores", alunoAtualId, "faltas"))); 
        if(res.empty) { 
            container.innerHTML = '<p class="text-muted center">Sem faltas registadas.</p>'; 
            return; 
        } 
        let fArr = []; 
        res.forEach(d => fArr.push(d.data())); 
        fArr.sort((a,b) => b.dataInicio.localeCompare(a.dataInicio)); 
        let html = ''; 
        fArr.forEach(f => { 
            html += `
            <div class="card" style="margin-bottom:10px; display:flex; justify-content:space-between; align-items:center;">
                <div><strong>${f.disciplina}</strong> (${f.horas}h)<br><span style="font-size:0.8rem; color:var(--text-muted);">${f.dataInicio}</span></div>
            </div>`; 
        }); 
        container.innerHTML = html; 
    } catch(e) {} 
}

const selDisc = document.getElementById('prhf-disciplina'); 
const selMod = document.getElementById('prhf-modulo'); 

document.getElementById('btn-hub-prhf')?.addEventListener('click', () => { 
    esconderTudoMenos(viewPrhf); 
    let opt = '<option value="">Disc.</option>'; 
    for(const comp of Object.values(matrizCurso)) { 
        for(const d of Object.keys(comp)) opt += `<option value="${d}">${d}</option>`; 
    } 
    selDisc.innerHTML = opt; 
    carregarPrhfs(); 
}); 

selDisc.addEventListener('change', (e) => { 
    const d = e.target.value; 
    let mObj = {}; 
    for(const comp of Object.values(matrizCurso)) { 
        if(comp[d]) mObj = comp[d]; 
    } 
    let opt = '<option value="">Mod.</option>'; 
    Object.keys(mObj).forEach(m => opt += `<option value="${m}">${m}</option>`); 
    selMod.innerHTML = opt; 
}); 

document.getElementById('btn-guardar-prhf')?.addEventListener('click', async (e) => { 
    const disc = selDisc.value; 
    const mod = selMod.value; 
    const prazo = document.getElementById('prhf-prazo').value; 
    const desc = document.getElementById('prhf-descricao').value.trim(); 
    const ht = document.getElementById('prhf-horas').value; 
    
    if(!disc || !mod || !prazo || !desc || !ht) return alert("Preenche todos os campos!"); 
    
    const br = e.currentTarget; 
    br.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
    
    try { 
        await addDoc(collection(db, "utilizadores", alunoAtualId, "prhfs"), { 
            disciplina: disc, 
            modulo: mod, 
            prazo: prazo, 
            descricao: desc, 
            horasPresenciais: parseInt(ht), 
            moduloTerminado: document.getElementById('prhf-modulo-terminado').checked, 
            status: 'ativa', 
            dataRegisto: new Date().toISOString() 
        }); 
        document.getElementById('prhf-prazo').value = ""; 
        document.getElementById('prhf-descricao').value = ""; 
        document.getElementById('prhf-horas').value = ""; 
        br.innerText = "Gravar Plano"; 
        carregarPrhfs(); 
    } catch (err) { 
        br.innerText = "Erro!"; 
    } 
}); 

async function carregarPrhfs() { 
    const container = document.getElementById('lista-prhf-container'); 
    container.innerHTML = '<p class="text-muted">A carregar...</p>'; 
    try { 
        const res = await getDocs(query(collection(db, "utilizadores", alunoAtualId, "prhfs"))); 
        let html = ''; 
        res.forEach(doc => { 
            const d = doc.data(); 
            const cor = d.status==='ativa' ? (d.moduloTerminado ? 'var(--warning-yellow)' : 'var(--primary-green)') : '#555'; 
            html += `
            <div class="card" style="border-left:4px solid ${cor}; margin-bottom:10px;">
                <strong>${d.disciplina} (M${d.modulo})</strong><br>
                <span style="font-size:0.8rem;">Prazo: ${d.prazo} | Status: ${d.status.toUpperCase()}</span>
            </div>`; 
        }); 
        container.innerHTML = html || '<p class="text-muted">Sem PRHFs.</p>'; 
    } catch (err) {} 
}

// ==========================================
// 5. CALENDÁRIO (VISUAL)
// ==========================================
document.getElementById('btn-hub-calendario')?.addEventListener('click', () => { 
    esconderTudoMenos(viewClassCalendario); 
    carregarEventosCalendario(); 
});

async function carregarEventosCalendario() { 
    const containerEL = document.getElementById('calendario-prof'); 
    containerEL.innerHTML = '<p class="text-muted">A desenhar calendário...</p>'; 
    
    try { 
        // Vamos buscar à coleção global de eventos
        const res = await getDocs(query(collection(db, "eventos"))); 
        
        let eventosFormatados = []; 
        res.forEach(d => { 
            const e = d.data(); 
            eventosFormatados.push({
                title: e.titulo,
                start: e.data, // Formato YYYY-MM-DD
                backgroundColor: '#11998e', // Cor principal do professor
                borderColor: '#11998e'
            });
        }); 
        
        containerEL.innerHTML = ""; // Limpar o texto de carregamento
        
        // Renderizar o FullCalendar
        let calendar = new FullCalendar.Calendar(containerEL, {
            initialView: 'dayGridMonth',
            locale: 'pt',
            events: eventosFormatados,
            headerToolbar: {
                left: 'prev,next',
                center: 'title',
                right: 'today'
            },
            height: 'auto'
        });
        
        calendar.render();

    } catch(err) {
        console.error("Erro no calendário:", err);
        containerEL.innerHTML = '<p>Erro ao carregar calendário.</p>';
    } 
}

// ==========================================
// 6. SUMÁRIOS E MATERIAIS DE AULA
// ==========================================
let matBase64 = ""; 
let matNome = ""; 

document.getElementById('btn-hub-sumarios')?.addEventListener('click', () => { 
    esconderTudoMenos(viewSumarios); 
    let opt = '<option value="">Todas</option>'; 
    for(const comp of Object.values(matrizCurso)) { 
        for(const d of Object.keys(comp)) opt += `<option value="${d}">${d}</option>`; 
    } 
    document.getElementById('filtro-sumarios-disc').innerHTML = opt; 
    carregarSumarios(); 
}); 

document.getElementById('filtro-sumarios-disc')?.addEventListener('change', carregarSumarios); 

document.getElementById('btn-novo-sumario')?.addEventListener('click', () => { 
    let opt = '<option value="">Disciplina</option>'; 
    for(const comp of Object.values(matrizCurso)) { 
        for(const d of Object.keys(comp)) opt += `<option value="${d}">${d}</option>`; 
    } 
    document.getElementById('ns-disc').innerHTML = opt; 
    document.getElementById('ns-data').value = new Date().toISOString().split('T')[0]; 
    document.getElementById('ns-titulo').value = ""; 
    document.getElementById('ns-descricao').value = ""; 
    document.getElementById('ns-file-name').innerText = ""; 
    document.getElementById('ns-upload-material').value = ""; 
    matBase64 = ""; 
    matNome = ""; 
    document.getElementById('modal-novo-sumario').style.display = 'flex'; 
}); 

document.getElementById('ns-upload-material')?.addEventListener('change', (e) => { 
    const f = e.target.files[0]; 
    if(!f) return; 
    if(f.size > 716800) return alert("Limite é 700KB."); 
    matNome = f.name; 
    document.getElementById('ns-file-name').innerText = matNome; 
    const r = new FileReader(); 
    r.onload = (ev) => matBase64 = ev.target.result; 
    r.readAsDataURL(f); 
}); 

document.getElementById('btn-gravar-sumario')?.addEventListener('click', async (e) => { 
    const d = document.getElementById('ns-data').value; 
    const disc = document.getElementById('ns-disc').value; 
    const t = document.getElementById('ns-titulo').value.trim(); 
    const desc = document.getElementById('ns-descricao').value.trim(); 
    
    if(!d || !disc || !t) return alert("Preenche Data, Disc. e Título!"); 
    
    const br = e.currentTarget; 
    br.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
    br.disabled = true; 
    
    try { 
        await addDoc(collection(db, "turmas", turmaAtual, "sumarios"), { 
            data: d, 
            disciplina: disc, 
            titulo: t, 
            descricao: desc, 
            anexoNome: matNome, 
            anexoBase64: matBase64, 
            professor: myUserName, 
            criadoEm: new Date().toISOString() 
        }); 
        br.innerHTML = '<i class="fa-solid fa-check"></i>'; 
        setTimeout(() => { 
            document.getElementById('modal-novo-sumario').style.display = 'none'; 
            br.innerHTML = 'Publicar'; 
            br.disabled = false; 
            carregarSumarios(); 
        }, 1000); 
    } catch(err) { 
        br.innerHTML = "Erro!"; 
        setTimeout(() => { br.innerHTML = 'Publicar'; br.disabled = false; }, 2000); 
    } 
}); 

async function carregarSumarios() { 
    const container = document.getElementById('lista-sumarios-container'); 
    container.innerHTML = '<p class="text-muted">A carregar...</p>'; 
    const fd = document.getElementById('filtro-sumarios-disc').value; 
    
    try { 
        const res = await getDocs(query(collection(db, "turmas", turmaAtual, "sumarios"))); 
        if(res.empty) { 
            container.innerHTML = '<p class="text-muted center">Sem sumários.</p>'; 
            return; 
        } 
        
        let sArr = []; 
        res.forEach(d => sArr.push({id: d.id, ...d.data()})); 
        
        if(fd) sArr = sArr.filter(s => s.disciplina === fd); 
        sArr.sort((a,b) => b.data.localeCompare(a.data)); 
        
        if(sArr.length === 0) { 
            container.innerHTML = '<p class="text-muted center">Sem sumários nesta disc.</p>'; 
            return; 
        } 
        
        let html = ''; 
        sArr.forEach(s => { 
            const aBtn = s.anexoBase64 ? `<a href="${s.anexoBase64}" download="${s.anexoNome}" class="secondary-btn small-btn" style="display:inline-block; margin-top:10px; width:auto; padding:5px 10px;"><i class="fa-solid fa-download"></i> ${s.anexoNome}</a>` : ''; 
            html += `
            <div class="card" style="margin-bottom:15px; border-left:4px solid var(--primary-green);">
                <div>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${s.data} | ${s.disciplina} | ${s.professor}</span>
                    <h4 style="margin:5px 0;">${s.titulo}</h4>
                    ${s.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px;">${s.descricao}</p>` : ''}
                </div>
                ${aBtn}
            </div>`; 
        }); 
        container.innerHTML = html; 
    } catch(e) {} 
}

// ==========================================
// 7. COMPORTAMENTO / OCORRÊNCIAS
// ==========================================
let tipoOc = "negativa"; 

document.getElementById('btn-hub-comportamento')?.addEventListener('click', () => { 
    if(!alunoAtualId) return; 
    esconderTudoMenos(viewComportamento); 
    carregarComportamento(); 
}); 

document.getElementById('btn-tipo-negativo')?.addEventListener('click', (e) => { 
    tipoOc = "negativa"; 
    e.currentTarget.classList.add('active'); 
    document.getElementById('btn-tipo-positivo').classList.remove('active'); 
}); 

document.getElementById('btn-tipo-positivo')?.addEventListener('click', (e) => { 
    tipoOc = "positiva"; 
    e.currentTarget.classList.add('active'); 
    document.getElementById('btn-tipo-negativo').classList.remove('active'); 
}); 

document.getElementById('btn-nova-ocorrencia')?.addEventListener('click', () => { 
    document.getElementById('no-data').value = new Date().toISOString().split('T')[0]; 
    document.getElementById('no-titulo').value = ""; 
    document.getElementById('no-descricao').value = ""; 
    document.getElementById('modal-nova-ocorrencia').style.display = 'flex'; 
}); 

document.getElementById('btn-gravar-ocorrencia')?.addEventListener('click', async (e) => { 
    const d = document.getElementById('no-data').value; 
    const t = document.getElementById('no-titulo').value.trim(); 
    const desc = document.getElementById('no-descricao').value.trim(); 
    
    if(!d || !t) return alert("Preenche Data e Motivo!"); 
    
    const br = e.currentTarget; 
    const txtO = br.innerText; 
    br.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
    br.disabled = true; 
    
    try { 
        await addDoc(collection(db, "utilizadores", alunoAtualId, "ocorrencias"), { 
            data: d, 
            tipo: tipoOc, 
            titulo: t, 
            descricao: desc, 
            autor: myUserName, 
            timestamp: Date.now() 
        }); 

        // 🌟 LÓGICA DE GAMIFICAÇÃO: Dar +50 XP se a ocorrência for positiva!
        if (tipoOc === "positiva") {
            const alunoRef = doc(db, "utilizadores", alunoAtualId);
            const alunoSnap = await getDoc(alunoRef);
            let currentXp = 0;
            if(alunoSnap.exists() && alunoSnap.data().xp) {
                currentXp = alunoSnap.data().xp;
            }
            await updateDoc(alunoRef, { xp: currentXp + 50 });
        }

        br.innerHTML = '<i class="fa-solid fa-check"></i>'; 
        setTimeout(() => { 
            document.getElementById('modal-nova-ocorrencia').style.display = 'none'; 
            br.innerText = txtO; 
            br.disabled = false; 
            carregarComportamento(); 
        }, 1000); 
    } catch(err) { 
        br.innerText = "Erro!"; 
        setTimeout(() => { br.innerText = txtO; br.disabled = false; }, 2000); 
    } 
}); 

async function carregarComportamento() { 
    const container = document.getElementById('lista-comportamento-container'); 
    container.innerHTML = '<p class="text-muted center">A carregar...</p>'; 
    
    try { 
        const res = await getDocs(query(collection(db, "utilizadores", alunoAtualId, "ocorrencias"))); 
        if(res.empty) { 
            container.innerHTML = '<p class="text-muted center">Nenhum registo.</p>'; 
            return; 
        } 
        
        let rArr = []; 
        res.forEach(d => rArr.push(d.data())); 
        rArr.sort((a,b) => b.data.localeCompare(a.data)); 
        
        let html = ''; 
        rArr.forEach(r => { 
            const cor = r.tipo === 'positiva' ? 'var(--success-green)' : 'var(--danger-red)'; 
            const ic = r.tipo === 'positiva' ? '<i class="fa-solid fa-medal"></i>' : '<i class="fa-solid fa-triangle-exclamation"></i>'; 
            html += `
            <div class="card" style="margin-bottom:15px; border-left:4px solid ${cor};">
                <div>
                    <div style="display:flex; align-items:center; gap:8px; color:${cor}; margin-bottom:5px;">
                        ${ic} <strong>${r.titulo}</strong>
                    </div>
                    <span style="font-size:0.75rem; color:var(--text-muted);">Data: ${r.data} | Prof. ${r.autor}</span>
                    ${r.descricao ? `<p style="font-size:0.85rem; color:var(--text-light); margin-top:5px; background:var(--bg-dark); padding:8px; border-radius:6px;">${r.descricao}</p>` : ''}
                </div>
            </div>`; 
        }); 
        container.innerHTML = html; 
    } catch(e) {} 
}

// ==========================================
// 8. CRIAR EVENTOS / TESTES (PROFESSOR)
// ==========================================
const btnCriarEvento = document.getElementById("btn-criar-evento");

if (btnCriarEvento) {
    btnCriarEvento.addEventListener("click", async () => {
        const nome = document.getElementById("nome-evento").value;
        const data = document.getElementById("data-evento").value;

        if (nome === "" || data === "") {
            alert("Por favor, preenche o nome e a data do teste!");
            return;
        }

        try {
            console.log("A guardar evento na base de dados...");
            await addDoc(collection(db, "eventos"), {
                titulo: nome,
                data: data,
                criadoEm: new Date(),
                tipo: "teste"
            });
            alert("✅ Teste marcado com sucesso!");
            document.getElementById("nome-evento").value = "";
            document.getElementById("data-evento").value = "";
        } catch (error) {
            console.error("Erro ao marcar teste: ", error);
            alert("Erro ao marcar o teste. Vê a consola.");
        }
    });
}

// ==========================================
// 9. MUSAI (MEDIDAS DE APOIO)
// ==========================================
document.getElementById('btn-hub-musai')?.addEventListener('click', () => { 
    if(!alunoAtualId) return; 
    esconderTudoMenos(viewMusai); 
    carregarMusai(); 
}); 

document.getElementById('btn-gravar-musai')?.addEventListener('click', async (e) => { 
    const texto = document.getElementById('novo-musai-texto').value.trim(); 
    if(!texto) return alert("Preenche a descrição da medida!"); 
    
    const br = e.currentTarget; 
    br.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
    br.disabled = true; 
    
    try { 
        await addDoc(collection(db, "utilizadores", alunoAtualId, "musai"), { 
            descricao: texto, 
            autor: myUserName, 
            data: new Date().toISOString().split('T')[0],
            timestamp: Date.now() 
        }); 
        document.getElementById('novo-musai-texto').value = "";
        br.innerText = "Gravar Medida"; 
        br.disabled = false; 
        carregarMusai(); 
    } catch(err) { 
        br.innerText = "Erro!"; 
        setTimeout(() => { br.innerText = "Gravar Medida"; br.disabled = false; }, 2000); 
    } 
}); 

async function carregarMusai() { 
    const container = document.getElementById('lista-musai-container'); 
    container.innerHTML = '<p class="text-muted center">A carregar medidas...</p>'; 
    try { 
        const res = await getDocs(query(collection(db, "utilizadores", alunoAtualId, "musai"))); 
        if(res.empty) { 
            container.innerHTML = '<p class="text-muted center">Sem medidas MUSAI registadas.</p>'; 
            return; 
        } 
        let arr = []; 
        res.forEach(d => arr.push(d.data())); 
        arr.sort((a,b) => b.timestamp - a.timestamp); 
        let html = ''; 
        arr.forEach(m => { 
            html += `
            <div class="card" style="margin-bottom:10px; border-left:4px solid var(--primary-color); background:var(--bg-dark);">
                <span style="font-size:0.75rem; color:var(--text-muted);">Por ${m.autor} a ${m.data}</span>
                <p style="margin-top:5px; font-size:0.9rem;">${m.descricao}</p>
            </div>`; 
        }); 
        container.innerHTML = html; 
    } catch(e) {} 
}

// ==========================================
// 10. OBSERVAÇÕES DE REUNIÃO
// ==========================================
document.getElementById('btn-hub-observacoes')?.addEventListener('click', () => { 
    if(!alunoAtualId) return; 
    esconderTudoMenos(viewObservacoes); 
    carregarObservacoesProf(); 
}); 

document.getElementById('btn-gravar-obs')?.addEventListener('click', async (e) => { 
    const momento = document.getElementById('novo-obs-momento').value;
    const texto = document.getElementById('novo-obs-texto').value.trim(); 
    if(!texto) return alert("Preenche o texto da observação!"); 
    
    const br = e.currentTarget; 
    br.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>'; 
    br.disabled = true; 
    
    try { 
        await addDoc(collection(db, "utilizadores", alunoAtualId, "observacoes"), { 
            momento: momento,
            descricao: texto, 
            autor: myUserName, 
            data: new Date().toISOString().split('T')[0],
            timestamp: Date.now() 
        }); 
        document.getElementById('novo-obs-texto').value = "";
        br.innerText = "Publicar Observação"; 
        br.disabled = false; 
        carregarObservacoesProf(); 
    } catch(err) { 
        br.innerText = "Erro!"; 
        setTimeout(() => { br.innerText = "Publicar Observação"; br.disabled = false; }, 2000); 
    } 
}); 

async function carregarObservacoesProf() { 
    const container = document.getElementById('lista-observacoes-container'); 
    container.innerHTML = '<p class="text-muted center">A carregar...</p>'; 
    try { 
        const res = await getDocs(query(collection(db, "utilizadores", alunoAtualId, "observacoes"))); 
        if(res.empty) { 
            container.innerHTML = '<p class="text-muted center">Sem avaliações registadas.</p>'; 
            return; 
        } 
        let arr = []; 
        res.forEach(d => arr.push(d.data())); 
        arr.sort((a,b) => b.timestamp - a.timestamp); 
        let html = ''; 
        arr.forEach(o => { 
            html += `
            <div class="card" style="margin-bottom:10px; border-left:4px solid var(--primary-green);">
                <div style="display:flex; justify-content:space-between;">
                    <strong>${o.momento}</strong>
                    <span style="font-size:0.75rem; color:var(--text-muted);">${o.data}</span>
                </div>
                <p style="margin-top:8px; font-size:0.9rem;">${o.descricao}</p>
                <div style="font-size:0.75rem; color:var(--text-muted); margin-top:8px; text-align:right;">Prof. ${o.autor}</div>
            </div>`; 
        }); 
        container.innerHTML = html; 
    } catch(e) {} 
}
