// js/prof/store.js

export const state = {
    myUserId: "", myUserName: "", profData: {}, myRoles: [], minhaTurmaDT: "",
    turmasProfessor: [], disciplinasProfessor: [], selectedTurma: "",
    alunosTurmaRAM: [], eventosTurmaRAM: [], notasAlunoRAM: [],
    alunoSelecionadoId: null, materialBase64: null, prhfBase64: null,
    chatUnsubscribe: null, activeChatTurma: "", activeChatDisc: "",
    chartEvolucao: null, carouselInterval: null, prhfViewMode: 'minha'
};

export const ACADEMIAS_INFO = { 'atlas': { nome: 'Atlas' }, 'sentinela': { nome: 'Sentinela' }, 'nexus': { nome: 'Nexus' }, 'aurora': { nome: 'Aurora' } };
export const ordemDisciplinasGlobal = ['PORT', 'ING', 'AI', 'EF', 'TIC', 'GEO', 'HCA', 'MAT', 'CF', 'TIAT', 'TCAT', 'OTET'];

export const nomeCurto = (nomeStr) => {
    if(!nomeStr) return 'Desconhecido';
    const p = nomeStr.split(' ');
    return p.length > 1 ? `${p[0]} ${p[p.length-1]}` : p[0];
};

export const getDisciplinasPermitidas = () => {
    if (state.myRoles.includes('diretor_turma') && state.selectedTurma === state.minhaTurmaDT) return ordemDisciplinasGlobal;
    return state.disciplinasProfessor;
};
