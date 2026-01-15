const API_BASE = '/api/apostas';

// Estado da aplicação
let estado = {
    apostas: [],
    apostaAtual: null,
    modo: 'lista' // 'lista' ou 'detalhes'
};

// Inicialização
document.addEventListener('DOMContentLoaded', () => {
    carregarApostas();
    setupEventListeners();
});

function setupEventListeners() {
    // Modal nova aposta
    const btnNovaAposta = document.getElementById('btnNovaAposta');
    const modal = document.getElementById('modalNovaAposta');
    const close = document.querySelector('.close');
    const form = document.getElementById('formNovaAposta');

    btnNovaAposta.addEventListener('click', () => {
        modal.style.display = 'block';
    });

    close.addEventListener('click', () => {
        modal.style.display = 'none';
    });

    window.addEventListener('click', (e) => {
        if (e.target === modal) {
            modal.style.display = 'none';
        }
    });

    form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await criarAposta();
    });

    // Botão voltar
    document.getElementById('btnVoltar').addEventListener('click', () => {
        mostrarLista();
    });
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
        const dataInicial = new Date(aposta.dataInicial).toLocaleDateString('pt-BR');
        const dataFinal = new Date(aposta.dataFinal).toLocaleDateString('pt-BR');
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
    
    const dataInicial = new Date(aposta.dataInicial).toLocaleDateString('pt-BR');
    const dataFinal = new Date(aposta.dataFinal).toLocaleDateString('pt-BR');
    
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
            ${aposta.dias.map(dia => {
                const dataFormatada = new Date(dia.data).toLocaleDateString('pt-BR');
                return `
                    <div class="dia-registrado">
                        <div class="dia-registrado-header">${dataFormatada}</div>
                        <div class="dia-registrado-participantes">
                            ${aposta.participantes.map(p => {
                                const presente = dia.participantes[p];
                                return `
                                    <span class="status-badge ${presente ? 'status-presente' : 'status-falta'}">
                                        ${p}: ${presente ? '✓ Presente' : '✗ Falta'}
                                    </span>
                                `;
                            }).join('')}
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
    
    // Criar tabela HTML
    let tabelaHTML = `
        <table id="tabelaParaImagem">
            <thead>
                <tr>
                    <th>Participante</th>
                    ${aposta.dias.map(dia => {
                        const dataFormatada = new Date(dia.data).toLocaleDateString('pt-BR');
                        return `<th>${dataFormatada}</th>`;
                    }).join('')}
                    <th>Faltas</th>
                </tr>
            </thead>
            <tbody>
    `;

    aposta.participantes.forEach(participante => {
        let faltas = 0;
        tabelaHTML += '<tr>';
        tabelaHTML += `<td><strong>${participante}</strong></td>`;
        
        aposta.dias.forEach(dia => {
            const presente = dia.participantes[participante];
            if (!presente) faltas++;
            tabelaHTML += `<td class="check ${presente ? 'presente' : 'falta'}">${presente ? '✓' : '✗'}</td>`;
        });
        
        tabelaHTML += `<td class="faltas-count">${faltas}</td>`;
        tabelaHTML += '</tr>';
    });

    tabelaHTML += '</tbody></table>';

    const container = document.getElementById('tabelaImagem');
    container.innerHTML = tabelaHTML;
    container.style.display = 'block';

    // Usar html2canvas para gerar imagem
    if (typeof html2canvas !== 'undefined') {
        const tabela = document.getElementById('tabelaParaImagem');
        html2canvas(tabela, {
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

// Tornar funções globais para uso em onclick
window.mostrarDetalhes = mostrarDetalhes;
window.registrarDia = registrarDia;
window.gerarImagemTabela = gerarImagemTabela;
