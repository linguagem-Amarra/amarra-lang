import assert from 'node:assert/strict';
import { criarQuadros, descrever } from '../web/movimentos.js';

const plano = { pontas:['direita','esquerda'], passos:[
  {acao:'cruzar',pontas:['direita','esquerda']},
  {acao:'passar_baixo',pontas:['direita']},
  {acao:'enrolar',pontas:['direita'],volta:1,quantidade:2},
  {acao:'enrolar',pontas:['direita'],volta:2,quantidade:2},
  {acao:'apertar',pontas:[]},
  {acao:'finalizar',pontas:[],mensagem:'pronto'}
]};
const {quadros}=criarQuadros(plano);
assert.equal(quadros.length,7);
assert.equal(quadros[0].fase,'livre');
assert.equal(quadros[1].fase,'cruzado');
assert.equal(quadros[2].fase,'enlacado');
assert.equal(quadros[4].voltas,2);
assert.equal(quadros[5].fase,'apertado');
assert.deepEqual(quadros[5],quadros[6]);
assert.equal(quadros[2].voltas,0); // Voltar nao reutiliza um estado mutado.
assert.match(descrever(plano.passos[3]).texto,/2 de 2/);
assert.equal(descrever(plano.passos[5]).texto,'pronto');
const semCruzamento=criarQuadros({pontas:[],passos:[{acao:'apertar',pontas:[]}]}).quadros[1];
assert.equal(semCruzamento.fase,'livre');
assert.ok(semCruzamento.aviso);
const cima=criarQuadros({pontas:['a','b'],passos:[{acao:'cruzar',pontas:['a','b']},{acao:'passar_cima',pontas:['b']}]}).quadros[2];
assert.equal(cima.ativa,1);assert.equal(cima.cima,1);
console.log('Estados visuais, retorno a etapas e descricoes: OK');
