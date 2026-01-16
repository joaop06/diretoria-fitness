const API_BASE = '/api/apostas';

// Função auxiliar para converter string de data (YYYY-MM-DD) para Date no timezone local
function parseLocalDate(dateString) {
    const [year, month, day] = dateString.split('-').map(Number);
    return new Date(year, month - 1, day); // month é 0-indexed no Date
}

// Estado da aplicação
let estado = {
    apostas: [],
    apostaAtual: null,
    modo: 'lista' // 'lista' ou 'detalhes'
};

// Função para renderizar o header componentizado
function renderizarHeader() {
    const headerContainer = document.getElementById('headerContainer');
    if (!headerContainer) return;
    
    headerContainer.innerHTML = `
        <header>
            <div class="logo-container">
                <a href="#" onclick="mostrarLista(); return false;" class="logo-link" title="Voltar para a tela inicial">
                    <svg class="logo-icon" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                        <!-- D externo -->
                        <path d="M 20 20 L 20 80 L 60 80 Q 80 80 80 50 Q 80 20 60 20 L 20 20" 
                              fill="none" 
                              stroke="#000000" 
                              stroke-width="8" 
                              stroke-linecap="round" 
                              stroke-linejoin="round"/>
                        <!-- D interno -->
                        <path d="M 30 30 L 30 70 L 55 70 Q 70 70 70 50 Q 70 30 55 30 L 30 30" 
                              fill="none" 
                              stroke="#000000" 
                              stroke-width="6" 
                              stroke-linecap="round" 
                              stroke-linejoin="round"/>
                    </svg>
                </a>
                <a href="#" onclick="mostrarLista(); return false;" class="logo-link" title="Voltar para a tela inicial">
                    <h1 class="logo-text">DIRETORIA FITNESS</h1>
                </a>
            </div>
            <button id="btnNovaAposta" class="btn btn-primary">+ Nova Aposta</button>
        </header>
    `;
    
    // Reconfigurar event listeners após renderizar o header
    setupEventListeners();
}

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    renderizarHeader();
    carregarApostas();
});

function setupEventListeners() {
    // Modal nova aposta
    const btnNovaAposta = document.getElementById('btnNovaAposta');
    if (!btnNovaAposta) return; // Se o botão não existir ainda, retorna
    
    const modal = document.getElementById('modalNovaAposta');
    const close = document.querySelector('.close');
    const form = document.getElementById('formNovaAposta');

    // Remover listeners anteriores se existirem (clonar e substituir remove todos os listeners)
    const novoBtnNovaAposta = btnNovaAposta.cloneNode(true);
    btnNovaAposta.parentNode.replaceChild(novoBtnNovaAposta, btnNovaAposta);
    
    document.getElementById('btnNovaAposta').addEventListener('click', () => {
        modal.style.display = 'block';
    });

    if (close) {
        close.addEventListener('click', () => {
            modal.style.display = 'none';
        });
    }

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    if (form) {
        form.addEventListener('submit', async (e) => {
            e.preventDefault();
            await criarAposta();
        });
    }

    // Botão voltar
    const btnVoltar = document.getElementById('btnVoltar');
    if (btnVoltar) {
        // Remover listener anterior se existir
        const novoBtnVoltar = btnVoltar.cloneNode(true);
        btnVoltar.parentNode.replaceChild(novoBtnVoltar, btnVoltar);
        
        document.getElementById('btnVoltar').addEventListener('click', () => {
            mostrarLista();
        });
    }
}

async function carregarApostas() {
    try {
        const response = await fetch(API_BASE);
        estado.apostas = await response.json();
        renderizarLista();
    } catch (error) {
        console.error('Erro ao carregar apostas:', error);
    }
}

function renderizarLista() {
    const container = document.getElementById('listaApostas');
    
    if (estado.apostas.length === 0) {
        container.innerHTML = '<div class="loading">Nenhuma aposta cadastrada ainda.</div>';
        return;
    }

    container.innerHTML = estado.apostas.map(aposta => {
        const dataInicial = parseLocalDate(aposta.dataInicial).toLocaleDateString('pt-BR');
        const dataFinal = parseLocalDate(aposta.dataFinal).toLocaleDateString('pt-BR');
        const totalDias = aposta.dias.length;
        const totalParticipantes = aposta.participantes.length;

        return `
            <div class="aposta-card" onclick="mostrarDetalhes(${aposta.id})">
                <h3>Aposta #${aposta.id}</h3>
                <div class="info"><strong>Período:</strong> ${dataInicial} a ${dataFinal}</div>
                <div class="info"><strong>Participantes:</strong> ${totalParticipantes}</div>
                <div class="info"><strong>Dias registrados:</strong> ${totalDias}</div>
                <div class="info"><strong>Limite de faltas:</strong> ${aposta.limiteFaltas}</div>
                <div class="info"><strong>Valor:</strong> R$ ${aposta.valorInscricao.toFixed(2)}</div>
            </div>
        `;
    }).join('');
}

async function criarAposta() {
    const dataInicial = document.getElementById('dataInicial').value;
    const dataFinal = document.getElementById('dataFinal').value;
    const limiteFaltas = document.getElementById('limiteFaltas').value;
    const valorInscricao = document.getElementById('valorInscricao').value;
    const participantesText = document.getElementById('participantes').value;
    
    const participantes = participantesText
        .split('\n')
        .map(p => p.trim())
        .filter(p => p.length > 0);

    try {
        const response = await fetch(API_BASE, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                dataInicial,
                dataFinal,
                limiteFaltas,
                valorInscricao,
                participantes
            })
        });

        if (response.ok) {
            const aposta = await response.json();
            document.getElementById('modalNovaAposta').style.display = 'none';
            document.getElementById('formNovaAposta').reset();
            await carregarApostas();
            mostrarDetalhes(aposta.id);
        } else {
            alert('Erro ao criar aposta');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao criar aposta');
    }
}

async function mostrarDetalhes(id) {
    try {
        const response = await fetch(`${API_BASE}/${id}`);
        estado.apostaAtual = await response.json();
        estado.modo = 'detalhes';
        
        document.getElementById('listaApostas').style.display = 'none';
        document.getElementById('detalhesAposta').style.display = 'block';
        
        renderizarDetalhes();
    } catch (error) {
        console.error('Erro ao carregar detalhes:', error);
        alert('Erro ao carregar aposta');
    }
}

function mostrarLista() {
    estado.modo = 'lista';
    estado.apostaAtual = null;
    
    document.getElementById('listaApostas').style.display = 'grid';
    document.getElementById('detalhesAposta').style.display = 'none';
    
    carregarApostas();
}

function renderizarDetalhes() {
    const aposta = estado.apostaAtual;
    const container = document.getElementById('conteudoDetalhes');
    
    const dataInicial = parseLocalDate(aposta.dataInicial).toLocaleDateString('pt-BR');
    const dataFinal = parseLocalDate(aposta.dataFinal).toLocaleDateString('pt-BR');
    
    // Calcular faltas por participante
    const faltasPorParticipante = {};
    aposta.participantes.forEach(p => {
        faltasPorParticipante[p] = 0;
    });
    
    aposta.dias.forEach(dia => {
        aposta.participantes.forEach(participante => {
            if (!dia.participantes[participante]) {
                faltasPorParticipante[participante]++;
            }
        });
    });

    container.innerHTML = `
        <div class="detalhes-header">
            <h2>Aposta #${aposta.id}</h2>
        </div>
        
        <div class="detalhes-info">
            <div class="detalhes-info-item">
                <strong>Data Inicial</strong>
                ${dataInicial}
            </div>
            <div class="detalhes-info-item">
                <strong>Data Final</strong>
                ${dataFinal}
            </div>
            <div class="detalhes-info-item">
                <strong>Limite de Faltas</strong>
                ${aposta.limiteFaltas}
            </div>
            <div class="detalhes-info-item">
                <strong>Valor da Inscrição</strong>
                R$ ${aposta.valorInscricao.toFixed(2)}
            </div>
        </div>

        <div class="participantes-section">
            <h3>Participantes (${aposta.participantes.length})</h3>
            <div class="participantes-list">
                ${aposta.participantes.map(p => `
                    <span class="participante-tag">
                        ${p} 
                        <span class="faltas-count">(${faltasPorParticipante[p]} faltas)</span>
                    </span>
                `).join('')}
            </div>
        </div>

        <div class="dias-section">
            <h3>Registrar Dia</h3>
            <div class="dia-form">
                <input type="date" id="dataDia" required>
                <div class="checkboxes-grid" id="checkboxesDia">
                    ${aposta.participantes.map(p => `
                        <div class="checkbox-item">
                            <input type="checkbox" id="check-${p}" checked>
                            <label for="check-${p}">${p}</label>
                        </div>
                    `).join('')}
                </div>
                <button class="btn btn-primary" onclick="registrarDia()">Registrar Dia</button>
            </div>
        </div>

        <div class="dias-registrados">
            <h3>Dias Registrados (${aposta.dias.length})</h3>
            ${aposta.dias.length === 0 ? '<p>Nenhum dia registrado ainda.</p>' : ''}
            ${aposta.dias.map((dia, diaIndex) => {
                const dataFormatada = parseLocalDate(dia.data).toLocaleDateString('pt-BR');
                const diaId = `dia-${diaIndex}-${dia.data}`;
                return `
                    <div class="dia-registrado" id="${diaId}">
                        <div class="dia-registrado-header">
                            ${dataFormatada}
                            <button class="btn btn-edit" onclick="toggleEdicaoDia('${dia.data}', ${diaIndex})" id="btn-edit-${diaIndex}">
                                ✏️ Editar
                            </button>
                        </div>
                        <div class="dia-registrado-participantes" id="participantes-${diaIndex}">
                            ${aposta.participantes.map(p => {
                                const presente = dia.participantes[p];
                                return `
                                    <span class="status-badge ${presente ? 'status-presente' : 'status-falta'}">
                                        ${p}: ${presente ? '✓ Presente' : '✗ Falta'}
                                    </span>
                                `;
                            }).join('')}
                        </div>
                        <div class="dia-edicao" id="edicao-${diaIndex}" style="display: none;">
                            <div class="checkboxes-grid">
                                ${aposta.participantes.map(p => {
                                    const presente = dia.participantes[p];
                                    return `
                                        <div class="checkbox-item">
                                            <input type="checkbox" id="edit-check-${diaIndex}-${p}" ${presente ? 'checked' : ''}>
                                            <label for="edit-check-${diaIndex}-${p}">${p}</label>
                                        </div>
                                    `;
                                }).join('')}
                            </div>
                            <div class="dia-edicao-botoes">
                                <button class="btn btn-primary" onclick="salvarEdicaoDia('${dia.data}', ${diaIndex})">💾 Salvar</button>
                                <button class="btn btn-secondary" onclick="cancelarEdicaoDia('${dia.data}', ${diaIndex})">❌ Cancelar</button>
                            </div>
                        </div>
                    </div>
                `;
            }).join('')}
        </div>

        <button class="btn btn-gerar-imagem" onclick="gerarImagemTabela()">📊 Gerar Imagem da Tabela</button>
        
        <div id="tabelaImagem" class="tabela-container"></div>
    `;
}

async function registrarDia() {
    const data = document.getElementById('dataDia').value;
    if (!data) {
        alert('Selecione uma data');
        return;
    }

    const participantes = {};
    estado.apostaAtual.participantes.forEach(p => {
        const checkbox = document.getElementById(`check-${p}`);
        participantes[p] = checkbox.checked;
    });

    try {
        const response = await fetch(`${API_BASE}/${estado.apostaAtual.id}/dias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data, participantes })
        });

        if (response.ok) {
            estado.apostaAtual = await response.json();
            renderizarDetalhes();
            document.getElementById('dataDia').value = '';
        } else {
            alert('Erro ao registrar dia');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao registrar dia');
    }
}

function gerarImagemTabela() {
    const aposta = estado.apostaAtual;
    
    // Calcular faltas por participante
    const faltasPorParticipante = {};
    aposta.participantes.forEach(p => {
        faltasPorParticipante[p] = 0;
    });
    
    aposta.dias.forEach(dia => {
        aposta.participantes.forEach(participante => {
            if (!dia.participantes[participante]) {
                faltasPorParticipante[participante]++;
            }
        });
    });

    // Verificar se algum participante já perdeu
    const participantesPerdidos = aposta.participantes.filter(p => faltasPorParticipante[p] > aposta.limiteFaltas);
    
    // Calcular número de dias
    const totalDias = aposta.dias.length;
    
    // Formatar datas
    const dataInicialFormatada = parseLocalDate(aposta.dataInicial).toLocaleDateString('pt-BR');
    const dataFinalFormatada = parseLocalDate(aposta.dataFinal).toLocaleDateString('pt-BR');
    
    // Criar HTML completo com cabeçalho, tabela invertida e resumo
    let htmlCompleto = `
        <div id="tabelaParaImagem">
            <div class="tabela-cabecalho">
                <h1 class="tabela-titulo">Aposta #${aposta.id}: ${totalDias} dias</h1>
                <p class="tabela-subtitulo">De ${dataInicialFormatada} até ${dataFinalFormatada}</p>
                <p class="tabela-subtitulo">Limite de ${aposta.limiteFaltas} faltas</p>
            </div>
            
            <table class="tabela-invertida">
                <thead>
                    <tr>
                        <th></th>
                        ${aposta.participantes.map(p => `<th>${p}</th>`).join('')}
                    </tr>
                </thead>
                <tbody>
    `;

    // Linhas: cada dia é uma linha, primeira coluna é a data, depois os checks por participante
    aposta.dias.forEach(dia => {
        const dataFormatada = parseLocalDate(dia.data).toLocaleDateString('pt-BR');
        htmlCompleto += '<tr>';
        htmlCompleto += `<td><strong>${dataFormatada}</strong></td>`;
        
        aposta.participantes.forEach(participante => {
            const presente = dia.participantes[participante];
            htmlCompleto += `<td class="check ${presente ? 'presente' : 'falta'}">${presente ? '✓' : '✗'}</td>`;
        });
        
        htmlCompleto += '</tr>';
    });

    htmlCompleto += `
                </tbody>
            </table>
            
            <div class="tabela-resumo">
                <h3>Resumo de Faltas</h3>
                <div class="resumo-lista">
    `;

    aposta.participantes.forEach(participante => {
        const faltas = faltasPorParticipante[participante];
        const status = faltas > aposta.limiteFaltas ? 'perdido' : faltas === aposta.limiteFaltas ? 'limite' : 'ok';
        htmlCompleto += `<div class="resumo-item ${status}">
            <strong>${participante}:</strong> ${faltas} falta${faltas !== 1 ? 's' : ''}
            ${faltas > aposta.limiteFaltas ? ' ❌ PERDEU' : faltas === aposta.limiteFaltas ? ' ⚠️ NO LIMITE' : ''}
        </div>`;
    });

    htmlCompleto += `
                </div>
    `;

    if (participantesPerdidos.length > 0) {
        htmlCompleto += `
                <div class="resumo-alerta">
                    <strong>⚠️ Atenção:</strong> ${participantesPerdidos.length} participante${participantesPerdidos.length > 1 ? 's' : ''} já ${participantesPerdidos.length > 1 ? 'perderam' : 'perdeu'}: ${participantesPerdidos.join(', ')}
                </div>
        `;
    }

    htmlCompleto += `
            </div>
        </div>
    `;

    const container = document.getElementById('tabelaImagem');
    container.innerHTML = htmlCompleto;
    container.style.display = 'block';

    // Usar html2canvas para gerar imagem
    if (typeof html2canvas !== 'undefined') {
        const elemento = document.getElementById('tabelaParaImagem');
        html2canvas(elemento, {
            backgroundColor: '#ffffff',
            scale: 2
        }).then(canvas => {
            const link = document.createElement('a');
            link.download = `aposta-${aposta.id}-tabela.png`;
            link.href = canvas.toDataURL('image/png');
            link.click();
        }).catch(error => {
            console.error('Erro ao gerar imagem:', error);
            alert('Erro ao gerar imagem. Tente novamente.');
        });
    } else {
        alert('Biblioteca de geração de imagem não carregada. Recarregue a página.');
    }
}

async function toggleEdicaoDia(data, diaIndex) {
    const edicaoDiv = document.getElementById(`edicao-${diaIndex}`);
    const participantesDiv = document.getElementById(`participantes-${diaIndex}`);
    const btnEdit = document.getElementById(`btn-edit-${diaIndex}`);
    
    if (edicaoDiv.style.display === 'none') {
        edicaoDiv.style.display = 'block';
        participantesDiv.style.display = 'none';
        btnEdit.textContent = '❌ Cancelar';
    } else {
        edicaoDiv.style.display = 'none';
        participantesDiv.style.display = 'flex';
        btnEdit.textContent = '✏️ Editar';
    }
}

async function salvarEdicaoDia(data, diaIndex) {
    const participantes = {};
    estado.apostaAtual.participantes.forEach(p => {
        const checkbox = document.getElementById(`edit-check-${diaIndex}-${p}`);
        participantes[p] = checkbox.checked;
    });

    try {
        const response = await fetch(`${API_BASE}/${estado.apostaAtual.id}/dias`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ data, participantes })
        });

        if (response.ok) {
            estado.apostaAtual = await response.json();
            renderizarDetalhes();
        } else {
            alert('Erro ao salvar alterações');
        }
    } catch (error) {
        console.error('Erro:', error);
        alert('Erro ao salvar alterações');
    }
}

function cancelarEdicaoDia(data, diaIndex) {
    toggleEdicaoDia(data, diaIndex);
}

// Tornar funções globais para uso em onclick
window.mostrarDetalhes = mostrarDetalhes;
window.mostrarLista = mostrarLista;
window.registrarDia = registrarDia;
window.gerarImagemTabela = gerarImagemTabela;
window.toggleEdicaoDia = toggleEdicaoDia;
window.salvarEdicaoDia = salvarEdicaoDia;
window.cancelarEdicaoDia = cancelarEdicaoDia;
