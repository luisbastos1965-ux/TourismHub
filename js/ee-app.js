// IMPORTAÇÃO MODULAR DA BASE DE DADOS
import { auth, db } from "./firebase.js";
import { onAuthStateChanged, signOut } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-auth.js";
import { doc, getDoc, collection, getDocs } from "https://www.gstatic.com/firebasejs/10.8.1/firebase-firestore.js";

let myUserName = "";
let educandoId = ""; // O ID do aluno associado a este EE
let educandoNome = "";

// ==========================================
// 1. SEGURANÇA E INICIALIZAÇÃO
// ==========================================
onAuthStateChanged(auth, async (user) => {
    if (user) {
        const userId = user.email.split('@')[0];
        try {
            const docSnap = await getDoc(doc(db, "utilizadores", userId));
            if (docSnap.exists()) {
                const dados = docSnap.data();
                
                // Expulsar se não for Encarregado de Educação
                if(dados.papel !== 'ee') {
                    window.location.href = "index.html"; 
                    return;
                }
                
                myUserName = dados.nome.split(' ')[0];
                educandoId = dados.educando; // O campo na BD que liga o EE ao Aluno
                
                document.getElementById('ee-welcome-name').innerText = `Bem-vindo(a), ${myUserName}!`;
                
                // Se tiver um educando associado, carrega os dados
                if (educandoId) {
                    await carregarDadosEducando(educandoId);
                } else {
                    document.getElementById('ee-nome-aluno').innerText = "Nenhum educando associado. Contacte a secretaria.";
                }
            }
        } catch (e) { console.error("Erro ao ler perfil do EE", e); }
    } else {
        window.location.href = "index.html"; // Redireciona para o login se não tiver sessão
    }
});

// Botão de Sair
document.getElementById('btn-logout-ee')?.addEventListener('click', () => {
    signOut(auth).then(() => window.location.href = "index.html");
});


// ==========================================
// 2. O CÉREBRO: LER DADOS DO EDUCANDO
// ==========================================
async function carregarDadosEducando(idAluno) {
    try {
        // A. Obter o nome completo do aluno
        const alunoSnap = await getDoc(doc(db, "utilizadores", idAluno));
        if (alunoSnap.exists()) {
            educandoNome = alunoSnap.data().nome;
            document.getElementById('ee-nome-aluno').innerText = educandoNome;
        } else {
            document.getElementById('ee-nome-aluno').innerText = "Aluno não encontrado.";
            return; // Abortar se o aluno não existir
        }

        // B. Compilar e Calcular a Média Global
        const notasDb = await getDocs(collection(db, "utilizadores", idAluno, "notas"));
        let sumNotas = 0; 
        let countNotas = 0;
        
        notasDb.forEach(n => {
            const val = n.data().nota;
            // Somar apenas notas quantitativas positivas ou negativas (ignorar "SN" ou módulos por lançar)
            if (val !== 'REP' && !isNaN(val)) {
                sumNotas += Number(val);
                countNotas++;
            }
        });
        
        const media = countNotas > 0 ? (sumNotas / countNotas).toFixed(1) : '--';
        const elMedia = document.getElementById('ee-media-aluno');
        elMedia.innerText = media;
        // Mudar de cor se a média for negativa
        if(media !== '--' && Number(media) < 10) elMedia.style.color = "var(--danger-red)";

        // C. Compilar Faltas Injustificadas
        const faltasDb = await getDocs(collection(db, "utilizadores", idAluno, "faltas"));
        let totalFaltasInjustificadas = 0;
        
        faltasDb.forEach(f => {
            if (!f.data().justificada) {
                totalFaltasInjustificadas += f.data().horas;
            }
        });
        
        document.getElementById('ee-faltas-aluno').innerText = totalFaltasInjustificadas;

    } catch (e) {
        console.error("Erro ao carregar estatísticas do educando:", e);
    }
}


// ==========================================
// 3. NAVEGAÇÃO DOS SERVIÇOS (A desenvolver)
// ==========================================
// Estes botões preparam o terreno para as próximas funcionalidades fantásticas!

document.getElementById('btn-ee-justificacoes')?.addEventListener('click', () => {
    alert("Funcionalidade em construção: Aqui poderá enviar atestados médicos em PDF/Foto diretamente para o Diretor de Turma validar!");
});

document.getElementById('btn-ee-caderneta')?.addEventListener('click', () => {
    alert("Funcionalidade em construção: Acesso à grelha detalhada com as notas por módulo e planos de recuperação (PRHF).");
});

document.getElementById('btn-ee-mensagens')?.addEventListener('click', () => {
    alert("Funcionalidade em construção: Chat direto, rápido e confidencial com o Diretor de Turma.");
});
