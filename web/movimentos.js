export const exemplos = {
  simples: '// O primeiro nó, antes do laço.\nno "cadarco simples" {\n    cruzar ponta_direita ponta_esquerda;\n    passar_baixo ponta_direita;\n    apertar;\n    finalizar "Base do cadarco pronta!";\n}',
  reforco: '// Mude voltas para 1, 2 ou 3.\nno "cadarco reforcado" {\n    inteiro voltas = 2;\n    cruzar ponta_direita ponta_esquerda;\n    passar_baixo ponta_direita;\n    repetir voltas {\n        enrolar ponta_direita 1;\n    }\n    apertar;\n    finalizar "Reforco pronto!";\n}',
  condicao: '// Experimente trocar para falso.\nno "escolha o reforco" {\n    booleano reforcar = verdadeiro;\n    cruzar ponta_direita ponta_esquerda;\n    passar_baixo ponta_direita;\n    se reforcar {\n        enrolar ponta_direita 1;\n    } senao {\n        passar_cima ponta_esquerda;\n    }\n    apertar;\n    finalizar "Sequencia concluida!";\n}',
  erro: '// O tipo de voltas precisa combinar\n// com o valor recebido. Tente corrigir.\nno "encontre o erro" {\n    inteiro voltas = "duas";\n    cruzar ponta_direita ponta_esquerda;\n    repetir voltas {\n        enrolar ponta_direita 1;\n    }\n    apertar;\n}'
};

export const nomePonta = (nome = '') => nome.replaceAll('_', ' ');

export function descrever(passo) {
  if (!passo) return { titulo: 'Tudo começa com duas pontas.', texto: 'Avance uma etapa ou reproduza a sequência para acompanhar o nó.' };
  const a = nomePonta(passo.pontas[0]), b = nomePonta(passo.pontas[1]);
  const descricoes = {
    cruzar: ['Cruze as duas pontas.', `Leve ${a} por cima de ${b}, formando um X.`],
    passar_baixo: ['Passe por baixo.', `Leve ${a} por trás da outra ponta e através da abertura do cruzamento.`],
    passar_cima: ['Passe por cima.', `Leve ${a} sobre o cruzamento. A sobreposição mostra o movimento.`],
    enrolar: ['Dê uma volta.', `Enrole ${a} ao redor da outra ponta. Volta ${passo.volta} de ${passo.quantidade} deste comando.`],
    apertar: ['Puxe e aproxime.', 'Puxe as pontas em sentidos opostos para aproximar o entrelaçamento.'],
    finalizar: ['Sequência concluída.', passo.mensagem || 'O roteiro chegou ao fim.']
  };
  const [titulo, texto] = descricoes[passo.acao];
  return { titulo, texto };
}

export function criarQuadros(plano) {
  const pontas = [...plano.pontas];
  if (!pontas.length) pontas.push('ponta_direita', 'ponta_esquerda');
  if (pontas.length === 1) pontas.push('outra_ponta');
  let estado = { fase: 'livre', ativa: 0, cima: 0, voltas: 0, cruzado: false, enlacado: false, aviso: '' };
  const quadros = [{ ...estado }];
  for (const passo of plano.passos) {
    estado = { ...estado, aviso: '' };
    const indice = pontas.indexOf(passo.pontas[0]);
    if (indice >= 0) estado.ativa = indice;
    if (passo.acao === 'cruzar') {
      Object.assign(estado, { fase: 'cruzado', cima: indice, cruzado: true, enlacado: false, voltas: 0 });
    } else if (['passar_baixo', 'passar_cima', 'enrolar'].includes(passo.acao)) {
      if (!estado.cruzado) estado.aviso = 'Primeiro cruze duas pontas para visualizar este movimento.';
      else {
        estado.fase = 'enlacado';
        estado.enlacado = true;
        estado.cima = passo.acao === 'passar_cima' ? indice : 1 - indice;
        if (passo.acao === 'enrolar') estado.voltas += 1;
      }
    } else if (passo.acao === 'apertar') {
      if (estado.enlacado) estado.fase = 'apertado';
      else estado.aviso = 'Ainda não há um entrelaçamento para apertar. Cruze e passe uma ponta pela abertura.';
    }
    quadros.push(estado);
  }
  return { quadros, pontas };
}
