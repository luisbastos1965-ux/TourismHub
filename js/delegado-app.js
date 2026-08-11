import { auth, db } from "./firebase.js";
import { onAuthStateChanged } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, addDoc, deleteDoc, onSnapshot, query, orderBy } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let minhaTurma = "";
let pendingDeleteId = null;

// ==========================================
// 1. VERIFICAÇÃO DE PERMISSÕES
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", userId));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                
                // Expulsa se não for aluno ou se não for delegado/subdelegado
                if (dados.papel !== 'aluno' || (dados.cargo !== 'delegado' && dados.cargo !== 'subdelegado')) {
                    window.location.href = "aluno.html"; 
                    return;
                }

                minhaTurma = dados.turma || "";
                document.getElementById('delegado-turma-label').innerText = `Gestão: Turma ${minhaTurma}`;

                // Inicia escuta da agenda em tempo real
                iniciarAgendaRealTime();
            } else {
                window.location.href = "index.html";
            }
        } catch (e) {
            console.error("Erro na verificação de delegado:", e);
        }
    } else {
        window.location.href = "index.html";
    }
});

// ==========================================
// 2. CRIAR NOVO EVENTO
// ==========================================
document.getElementById('btn-salvar-evento').addEventListener('click', async (e) => {
    const tituloInput = document.getElementById('input-evento-titulo');
    const dataInput = document.getElementById('input-evento-data');
    const tipoInput = document.getElementById('input-evento-tipo');

    const titulo = tituloInput.value.trim();
    const dataVal = dataInput.value;
    const tipo = tipoInput.value;

    if (!titulo || !dataVal) {
        alert("Por favor, preenche o título e a data do evento.");
        return;
    }

    const btn = e.currentTarget;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> A guardar...';
    btn.disabled = true;

    try {
        await addDoc(collection(db, "turmas", minhaTurma, "eventos"), {
            titulo: titulo,
            data: dataVal,
            tipo: tipo,
            criadoEm: Date.now()
        });

        // Sucesso visual e limpeza
        btn.innerHTML = '<i class="fa-solid fa-check"></i> Evento Publicado!';
        btn.style.backgroundColor = "var(--success-green)";
        btn.style.color = "white";
        
        tituloInput.value = "";
        dataInput.value = "";

        setTimeout(() => {
            btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publicar para a Turma';
            btn.style.backgroundColor = "#ffd700";
            btn.style.color = "#000";
            btn.disabled = false;
        }, 2000);

    } catch (error) {
        alert("Erro ao guardar o evento. Tenta novamente.");
        btn.innerHTML = '<i class="fa-solid fa-paper-plane"></i> Publicar para a Turma';
        btn.disabled = false;
    }
});

// ==========================================
// 3. LER EVENTOS EM TEMPO REAL
// ==========================================
function iniciarAgendaRealTime() {
    if(!minhaTurma) return;

    const q = query(collection(db, "turmas", minhaTurma, "eventos"), orderBy("data", "asc"));
    
    onSnapshot(q, (snapshot) => {
        const container = document.getElementById('lista-eventos-delegado');
        let html = "";

        const hoje = new Date().toISOString().split('T')[0];
        let temEventosFuturos = false;

        snapshot.forEach(docSnap => {
            const ev = docSnap.data();
            const evId = docSnap.id;
            
            // Mostrar apenas eventos de hoje para a frente
            if(ev.data >= hoje) {
                temEventosFuturos = true;
                
                // Formatar Data (YYYY-MM-DD para DD/MM/YYYY)
                const dataFormatada = ev.data.split('-').reverse().join('/');
                
                // Cores e Labels consoante o tipo
                let cor = "#b82bf2"; let label = "Outro";
                if(ev.tipo === 'teste' || ev.tipo === 'avaliacao') { cor = "#f59e0b"; label = "Avaliação"; }
                if(ev.tipo === 'entrega' || ev.tipo === 'trabalho') { cor = "#00d2ff"; label = "Entrega"; }

                html += `
                <div class="card" style="border-left: 4px solid ${cor}; margin-bottom: 10px; display:flex; justify-content:space-between; align-items:center; padding: 15px;">
                    <div>
                        <span class="event-type-badge" style="color: ${cor}; border-color: ${cor};">${label}</span>
                        <h4 style="margin: 8px 0 5px 0; color: var(--text-light); font-size: 1.1rem;">${ev.titulo}</h4>
                        <span style="color: var(--text-muted); font-size: 0.85rem;"><i class="fa-regular fa-calendar"></i> ${dataFormatada}</span>
                    </div>
                    <button class="btn-delete-ev" data-id="${evId}" style="background:none; border:none; color:var(--danger-red); font-size:1.2rem; cursor:pointer; padding:10px;">
                        <i class="fa-solid fa-trash"></i>
                    </button>
                </div>`;
            }
        });

        if(!temEventosFuturos) {
            html = `<div style="text-align:center; padding: 30px; opacity: 0.5;">
                        <i class="fa-regular fa-calendar-check" style="font-size: 3rem; margin-bottom: 15px; color: var(--text-muted);"></i>
                        <p style="font-size: 0.9rem; color: var(--text-muted);">A agenda da turma está livre.</p>
                    </div>`;
        }

        container.innerHTML = html;

        // Adicionar eventos aos botões de apagar
        document.querySelectorAll('.btn-delete-ev').forEach(btn => {
            btn.addEventListener('click', (e) => {
                pendingDeleteId = e.currentTarget.getAttribute('data-id');
                document.getElementById('modal-delete-evento').style.display = 'flex';
            });
        });
    });
}

// ==========================================
// 4. ELIMINAR EVENTO (MODAL)
// ==========================================
document.getElementById('btn-cancel-delete').addEventListener('click', () => {
    document.getElementById('modal-delete-evento').style.display = 'none';
    pendingDeleteId = null;
});

document.getElementById('btn-confirm-delete').addEventListener('click', async (e) => {
    if(!pendingDeleteId || !minhaTurma) return;
    
    const btn = e.currentTarget;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i>';
    btn.disabled = true;

    try {
        await deleteDoc(doc(db, "turmas", minhaTurma, "eventos", pendingDeleteId));
        document.getElementById('modal-delete-evento').style.display = 'none';
    } catch(err) {
        alert("Erro ao apagar o evento.");
    } finally {
        btn.innerHTML = 'Apagar';
        btn.disabled = false;
        pendingDeleteId = null;
    }
});
