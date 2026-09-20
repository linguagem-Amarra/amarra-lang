# Amarra

Amarra é uma linguagem para descrever, passo a passo, como amarrar nós (cadarços,
gravatas e nós náuticos simples). Um programa em Amarra é uma sequência de comandos
que, ao ser executada, produz o roteiro de montagem do nó.

Exemplo:

```amarra
no "cadarço simples" {
    cruzar ponta_direita ponta_esquerda;
    passar_baixo ponta_direita;
    apertar;
    finalizar "nó pronto";
}
```

## Como instalar

Requer apenas Python 3.

```bash
pip install antlr4-tools antlr4-python3-runtime
```

Na primeira execução de `antlr4` ou `antlr4-parse`, será perguntado se pode instalar
o Java automaticamente — responda que sim.

Versão do ANTLR usada: 4.13 (antlr4-tools instala a mais recente disponível; anote
aqui a versão exata assim que confirmada, pois o código gerado por uma versão pode
não rodar com o runtime de outra).

## Como rodar

Gerar o código a partir da gramática:

```bash
./gerar.sh
```

Rodar o analisador léxico sobre um exemplo:

```bash
python src/lexico.py exemplos/no_simples.amr
```

Testar a gramática direto, sem gerar código:

```bash
cd gramatica
antlr4-parse Amarra.g4 programa -tokens exemplos/no_simples.amr
```

## Fase atual do projeto

E2 — especificação da linguagem e analisador léxico.

## Como rodar os testes

Rode o `lexico.py` sobre cada arquivo em `exemplos/` e `exemplos/invalidos/` e
confira a saída:

```bash
for f in exemplos/*.amr; do python src/lexico.py "$f"; done
for f in exemplos/invalidos/*.amr; do python src/lexico.py "$f"; done
```

Os arquivos válidos devem imprimir a lista de tokens e terminar com a contagem.
Os arquivos inválidos devem apontar a linha e a coluna do erro.
