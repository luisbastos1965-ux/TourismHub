import { db } from "./firebase.js";
import { collection, query, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

export async function carregarDashboardAluno(alunoId, turmaId) {
    // 1. Lógica do Check-in Emocional
    const checkinBox = document.getElementById('student-checkin-box');
    const btnEmojis = checkinBox.querySelectorAll('.emoji-btn');
    
    // Resetar a caixa (caso o aluno saia e entre)
    checkinBox.innerHTML = `<h3>Como te sentes hoje?</h3><div class="emoji-row"><button class="emoji-btn sad" data-val="triste">😔</button><button class="emoji-btn neutral" data-val="neutro">😐</button><button class="emoji-btn happy" data-val="feliz">😊</button></div>`;
    
    checkinBox.querySelectorAll('.emoji-btn').forEach(btn => {
        btn.addEventListener('click', (e) => {
            const sentimento = e.currentTarget.getAttribute('data-val');
            // Animação de fecho e resposta
            checkinBox.style.transform = 'scale(0.95)';
            checkinBox.style.opacity = '0';
            
            setTimeout(() => {
                checkinBox.style.opacity = '1';
                checkinBox.style.transform = 'scale(1)';
                if (sentimento === 'triste') {
                    checkinBox.innerHTML = `<h3 style="color:var(--danger-red); margin-bottom:10px;">Lamentamos ouvir isso. 😔</h3><p style="font-size:0.85rem; color:var(--text-muted);">Lembra-te que o teu Diretor de Turma está sempre disponível para te ouvir na escola.</p>`;
                } else {
                    checkinBox.innerHTML = `<h3 style="color:var(--success-green); margin-bottom:10px;">Que bom! ✨</h3><p style="font-size:0.85rem; color:var(--text-muted);">Aproveita o dia e mantém o foco nos teus objetivos.</p>`;
                }
            }, 300);
            
            // Aqui futuramente guardamos o humor na Base de Dados do Passaporte
        });
    });

    // 2. Pesquisar o Próximo Evento (O Meu Dia)
    try {
        const hoje = new Date().toISOString().split('T')[0];
        const resEvts = await getDocs(query(collection(db, "turmas", turmaId, "eventos")));
        let futuros = [];
        resEvts.forEach(d => {
            const ev = d.data();
            if (ev.data >= hoje) futuros.push(ev);
        });
        futuros.sort((a,b) => a.data.localeCompare(b.data));

        const elEvento = document.getElementById('aluno-proximo-evento');
        if(futuros.length > 0) {
            const dp = futuros[0].data.split('-');
            elEvento.innerText = `${dp[2]}/${dp[1]} - ${futuros[0].disciplina || futuros[0].titulo}`;
            elEvento.style.color = "var(--warning-yellow)";
        } else {
            elEvento.innerText = "Livre de avaliações!";
            elEvento.style.color = "var(--success-green)";
        }
    } catch(e) { console.error("Erro eventos aluno", e); }

    // 3. Pesquisar PRHFs pendentes (O Meu Dia)
    try {
        const resPrhf = await getDocs(query(collection(db, "utilizadores", alunoId, "prhfs")));
        let ativos = 0;
        resPrhf.forEach(d => { if(d.data().status === 'ativa') ativos++; });
        
        const elPrhf = document.getElementById('aluno-prhf-count');
        elPrhf.innerText = `${ativos} Plano(s)`;
        elPrhf.style.color = ativos > 0 ? "var(--danger-red)" : "var(--success-green)";
    } catch(e) { console.error("Erro PRHF aluno", e); }
}
