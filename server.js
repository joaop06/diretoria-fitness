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

// Função auxiliar para gerar array de datas entre duas datas (formato YYYY-MM-DD)
function gerarDatasEntre(dataInicial, dataFinal) {
  const datas = [];
  // Parse das datas no formato YYYY-MM-DD para evitar problemas de timezone
  const [anoInicio, mesInicio, diaInicio] = dataInicial.split('-').map(Number);
  const [anoFim, mesFim, diaFim] = dataFinal.split('-').map(Number);
  
  const inicio = new Date(anoInicio, mesInicio - 1, diaInicio);
  const fim = new Date(anoFim, mesFim - 1, diaFim);
  
  for (let d = new Date(inicio); d <= fim; d.setDate(d.getDate() + 1)) {
    const ano = d.getFullYear();
    const mes = String(d.getMonth() + 1).padStart(2, '0');
    const dia = String(d.getDate()).padStart(2, '0');
    datas.push(`${ano}-${mes}-${dia}`);
  }
  
  return datas;
}

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
    
    // VALIDAÇÃO 1: Verificar se a data não é futura
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0); // Zerar horas para comparar apenas a data
    
    const dataSelecionada = new Date(data + 'T00:00:00');
    dataSelecionada.setHours(0, 0, 0, 0);
    
    if (dataSelecionada > hoje) {
      const dataFormatada = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
      const hojeFormatado = hoje.toLocaleDateString('pt-BR');
      return res.status(400).json({ 
        error: 'DATA_FUTURA',
        message: `Não é possível registrar um dia futuro. A data selecionada (${dataFormatada}) é posterior à data de hoje (${hojeFormatado}).`
      });
    }
    
    // VALIDAÇÃO 2: Verificar se a data está dentro do período da aposta
    if (data < aposta.dataInicial || data > aposta.dataFinal) {
      const dataInicialFormatada = new Date(aposta.dataInicial + 'T00:00:00').toLocaleDateString('pt-BR');
      const dataFinalFormatada = new Date(aposta.dataFinal + 'T00:00:00').toLocaleDateString('pt-BR');
      return res.status(400).json({ 
        error: 'DATA_FORA_PERIODO',
        message: `A data selecionada está fora do período da aposta. O período válido é de ${dataInicialFormatada} a ${dataFinalFormatada}.`
      });
    }
    
    // Verificar se o dia já existe
    const diaIndex = aposta.dias.findIndex(d => d.data === data);
    const diaJaExiste = diaIndex >= 0;
    
    // Verificar se é uma edição explícita (quando vem do botão "Editar")
    // Se não for edição explícita e o dia já existe, dar erro
    const isEdicao = req.body.isEdicao === true;
    
    if (diaJaExiste && !isEdicao) {
      // VALIDAÇÃO 2: Dia já cadastrado (tentativa de cadastrar novamente)
      const dataFormatada = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
      return res.status(400).json({ 
        error: 'DIA_JA_CADASTRADO',
        message: `O dia ${dataFormatada} já foi cadastrado. Use a opção "Editar" para modificar um dia existente.`
      });
    }
    
    // Se for edição explícita, permitir atualização sem validações adicionais
    if (isEdicao && diaJaExiste) {
      aposta.dias[diaIndex].participantes = participantes;
      aposta.dias.sort((a, b) => a.data.localeCompare(b.data));
      await fs.writeFile(filePath, JSON.stringify(aposta, null, 2), 'utf-8');
      return res.json(aposta);
    }
    
    // Se chegou aqui, é um dia novo. Aplicar validações para novos dias.
    
    // VALIDAÇÃO 3: Verificar se não está pulando dias
    // Obter todas as datas do período da aposta
    const todasDatasPeriodo = gerarDatasEntre(aposta.dataInicial, aposta.dataFinal);
    
    // Obter datas já cadastradas (apenas as que estão dentro do período)
    const datasCadastradas = aposta.dias
      .map(d => d.data)
      .filter(d => d >= aposta.dataInicial && d <= aposta.dataFinal)
      .sort();
    
    // Encontrar a posição da data atual no período
    const indiceDataAtual = todasDatasPeriodo.indexOf(data);
    
    if (indiceDataAtual === -1) {
      // Isso não deveria acontecer devido à validação 1, mas vamos manter
      return res.status(400).json({ 
        error: 'DATA_INVALIDA',
        message: 'Data inválida.'
      });
    }
    
    // Se for o primeiro dia do período, não precisa verificar dias anteriores
    if (indiceDataAtual === 0) {
      // É o primeiro dia, pode cadastrar normalmente
    } else if (indiceDataAtual > 0) {
      // Verificar apenas os dias anteriores DENTRO DO PERÍODO
      const diasAnterioresNoPeriodo = todasDatasPeriodo.slice(0, indiceDataAtual);
      const diasFaltantes = diasAnterioresNoPeriodo.filter(d => !datasCadastradas.includes(d));
      
      if (diasFaltantes.length > 0) {
        // Encontrar o primeiro dia faltante
        const primeiroDiaFaltante = diasFaltantes[0];
        const primeiroDiaFaltanteFormatado = new Date(primeiroDiaFaltante + 'T00:00:00').toLocaleDateString('pt-BR');
        const dataAtualFormatada = new Date(data + 'T00:00:00').toLocaleDateString('pt-BR');
        
        return res.status(400).json({ 
          error: 'DIA_PULADO',
          message: `Não é possível cadastrar o dia ${dataAtualFormatada} porque ainda existem dias anteriores não cadastrados. O primeiro dia faltante é ${primeiroDiaFaltanteFormatado}.`
        });
      }
    }
    
    // Se passou todas as validações, adicionar o novo dia
    aposta.dias.push({ data, participantes });
    
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
