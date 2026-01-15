# Sistema de Aposta de Treino

Sistema simples para gerenciar apostas de treino, onde é possível registrar os dias em que cada participante treinou ou faltou.

## Funcionalidades

- ✅ Criar apostas com período, limite de faltas e valor de inscrição
- ✅ Gerenciar participantes de cada aposta
- ✅ Registrar dias da aposta com presença/falta de cada participante
- ✅ Visualizar listagem de todas as apostas (ordem decrescente)
- ✅ Visualizar detalhes individuais de cada aposta
- ✅ Gerar tabela visual com os registros de treino

## Instalação

1. Instale as dependências:
```bash
npm install
```

2. Inicie o servidor:
```bash
npm start
```

3. Acesse no navegador:
```
http://localhost:3000
```

## Estrutura de Dados

Cada aposta é armazenada em um arquivo JSON no diretório `data/` com o formato:
- `aposta-{id}.json`

Estrutura do arquivo:
```json
{
  "id": 1,
  "dataInicial": "2024-01-01",
  "dataFinal": "2024-01-31",
  "limiteFaltas": 3,
  "valorInscricao": 50.00,
  "participantes": ["João", "Maria", "Pedro"],
  "dias": [
    {
      "data": "2024-01-01",
      "participantes": {
        "João": true,
        "Maria": true,
        "Pedro": false
      }
    }
  ]
}
```

## Tecnologias

- Node.js + Express (backend)
- HTML/CSS/JavaScript (frontend)
- Armazenamento em arquivos JSON
