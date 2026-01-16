const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const fs = require('fs').promises;
const path = require('path');

const app = express();
const PORT = 3000;
const DATA_DIR = path.join(__dirname, 'data');

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(express.static('public'));

// Garantir que o diretório de dados existe
async function ensureDataDir() {
  try {
    await fs.access(DATA_DIR);
  } catch {
    await fs.mkdir(DATA_DIR, { recursive: true });
  }
}

// Função para listar todos os arquivos de apostas
async function listApostas() {
  try {
    const files = await fs.readdir(DATA_DIR);
    const apostaFiles = files.filter(f => f.startsWith('aposta-') && f.endsWith('.json'));
    
    const apostas = await Promise.all(
      apostaFiles.map(async (file) => {
        const content = await fs.readFile(path.join(DATA_DIR, file), 'utf-8');
        return JSON.parse(content);
      })
    );
    
    // Ordenar por ID em ordem decrescente
    return apostas.sort((a, b) => b.id - a.id);
  } catch (error) {
    console.error('Erro ao listar apostas:', error);
    return [];
  }
}

// Função para obter próximo ID
async function getNextId() {
  const apostas = await listApostas();
  if (apostas.length === 0) return 1;
  return Math.max(...apostas.map(a => a.id)) + 1;
}

// Rota: Listar todas as apostas
app.get('/api/apostas', async (req, res) => {
  try {
    const apostas = await listApostas();
    res.json(apostas);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota: Obter aposta por ID
app.get('/api/apostas/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const filePath = path.join(DATA_DIR, `aposta-${id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    res.json(JSON.parse(content));
  } catch (error) {
    res.status(404).json({ error: 'Aposta não encontrada' });
  }
});

// Rota: Criar nova aposta
app.post('/api/apostas', async (req, res) => {
  try {
    const { dataInicial, dataFinal, limiteFaltas, valorInscricao, participantes } = req.body;
    
    if (!dataInicial || !dataFinal || !limiteFaltas || !valorInscricao) {
      return res.status(400).json({ error: 'Campos obrigatórios faltando' });
    }
    
    const id = await getNextId();
    const aposta = {
      id,
      dataInicial,
      dataFinal,
      limiteFaltas: parseInt(limiteFaltas),
      valorInscricao: parseFloat(valorInscricao),
      participantes: participantes || [],
      dias: []
    };
    
    const filePath = path.join(DATA_DIR, `aposta-${id}.json`);
    await fs.writeFile(filePath, JSON.stringify(aposta, null, 2), 'utf-8');
    
    res.json(aposta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota: Atualizar aposta
app.put('/api/apostas/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const filePath = path.join(DATA_DIR, `aposta-${id}.json`);
    
    const content = await fs.readFile(filePath, 'utf-8');
    const aposta = JSON.parse(content);
    
    // Atualizar campos permitidos
    if (req.body.participantes !== undefined) aposta.participantes = req.body.participantes;
    if (req.body.dias !== undefined) aposta.dias = req.body.dias;
    
    await fs.writeFile(filePath, JSON.stringify(aposta, null, 2), 'utf-8');
    res.json(aposta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota: Adicionar dia à aposta
app.post('/api/apostas/:id/dias', async (req, res) => {
  try {
    const id = req.params.id;
    const { data, participantes } = req.body;
    
    if (!data || !participantes) {
      return res.status(400).json({ error: 'Data e participantes são obrigatórios' });
    }
    
    const filePath = path.join(DATA_DIR, `aposta-${id}.json`);
    const content = await fs.readFile(filePath, 'utf-8');
    const aposta = JSON.parse(content);
    
    // Verificar se o dia já existe
    const diaIndex = aposta.dias.findIndex(d => d.data === data);
    if (diaIndex >= 0) {
      aposta.dias[diaIndex].participantes = participantes;
    } else {
      aposta.dias.push({ data, participantes });
    }
    
    // Ordenar dias por data (usando comparação de strings para evitar problemas de timezone)
    aposta.dias.sort((a, b) => a.data.localeCompare(b.data));
    
    await fs.writeFile(filePath, JSON.stringify(aposta, null, 2), 'utf-8');
    res.json(aposta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota: Deletar aposta
app.delete('/api/apostas/:id', async (req, res) => {
  try {
    const id = req.params.id;
    const filePath = path.join(DATA_DIR, `aposta-${id}.json`);
    await fs.unlink(filePath);
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota: Deletar dia específico de uma aposta
app.delete('/api/apostas/:id/dias/:data', async (req, res) => {
  try {
    const id = req.params.id;
    const data = req.params.data;
    const filePath = path.join(DATA_DIR, `aposta-${id}.json`);
    
    const content = await fs.readFile(filePath, 'utf-8');
    const aposta = JSON.parse(content);
    
    // Remover o dia com a data especificada
    aposta.dias = aposta.dias.filter(d => d.data !== data);
    
    await fs.writeFile(filePath, JSON.stringify(aposta, null, 2), 'utf-8');
    res.json(aposta);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Rota catch-all para SPA: redirecionar todas as rotas não-API para index.html
// Isso permite que o roteamento do lado do cliente funcione corretamente
app.get('*', (req, res) => {
  // Ignorar requisições para arquivos estáticos (que já foram servidos pelo express.static)
  // e rotas da API
  if (req.path.startsWith('/api/') || req.path.includes('.')) {
    return res.status(404).send('Not found');
  }
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Inicializar servidor
ensureDataDir().then(() => {
  app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
  });
});
