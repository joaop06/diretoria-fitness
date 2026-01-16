const API_BASE = '/api/apostas';

// ============================================
// SISTEMA DE NOTIFICAÇÕES (TOAST)
// ============================================

class NotificationSystem {
    constructor() {
        this.container = null;
        this.init();
    }

    init() {
        // Criar container de notificações se não existir
        if (!document.getElementById('notification-container')) {
            const container = document.createElement('div');
            container.id = 'notification-container';
            container.className = 'notification-container';
            document.body.appendChild(container);
            this.container = container;
        } else {
            this.container = document.getElementById('notification-container');
        }
    }

    show(message, type = 'info', duration = 5000) {
        const notification = document.createElement('div');
        notification.className = `notification notification-${type}`;
        
        // Ícone baseado no tipo
        const icons = {
            success: '✓',
            error: '✗',
            warning: '⚠️',
            info: 'ℹ️'
        };
        
        notification.innerHTML = `
            <div class="notification-content">
                <span class="notification-icon">${icons[type] || icons.info}</span>
                <span class="notification-message">${message}</span>
                <button class="notification-close" onclick="this.parentElement.parentElement.remove()">×</button>
            </div>
        `;
        
        this.container.appendChild(notification);
        
        // Trigger animação de entrada
        setTimeout(() => {
            notification.classList.add('notification-show');
        }, 10);
        
        // Auto-remover após duração
        if (duration > 0) {
            setTimeout(() => {
                this.remove(notification);
            }, duration);
        }
        
        return notification;
    }

    remove(notification) {
        if (notification && notification.parentElement) {
            notification.classList.remove('notification-show');
            notification.classList.add('notification-hide');
            setTimeout(() => {
                if (notification.parentElement) {
                    notification.parentElement.removeChild(notification);
                }
            }, 300);
        }
    }

    success(message, duration = 5000) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 6000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 5000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = 5000) {
        return this.show(message, 'info', duration);
    }
}

// Instanciar sistema de notificações
const notifications = new NotificationSystem();

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

// ============================================
// SISTEMA DE ROTEAMENTO
// ============================================

class Router {
    constructor() {
        this.routes = new Map();
        this.currentRoute = null;
        this.isInitialized = false;
        
        // Registrar rotas
        this.routes.set('/', () => this.navegarParaLista());
        this.routes.set('/apostas', () => this.navegarParaLista());
        this.routes.set('/aposta/:id', (params) => this.navegarParaDetalhes(params.id));
        
        // Escutar mudanças no histórico do navegador
        window.addEventListener('popstate', (e) => {
            this.handleRouteChange();
        });
    }
    
    // Inicializar roteamento baseado na URL atual
    init() {
        if (this.isInitialized) return;
        this.isInitialized = true;
        this.handleRouteChange();
    }
    
    // Processar mudança de rota
    handleRouteChange() {
        const path = window.location.pathname;
        const route = this.matchRoute(path);
        
        if (route) {
            this.currentRoute = { path, handler: route.handler, params: route.params };
            route.handler(route.params);
        } else {
            // Rota não encontrada, redirecionar para lista
            this.navegarParaLista();
        }
    }
    
    // Fazer match da rota com a URL
    matchRoute(path) {
        // Tentar match exato primeiro
        if (this.routes.has(path)) {
            return {
                handler: this.routes.get(path),
                params: {}
            };
        }
        
        // Tentar match com parâmetros
        for (const [routePattern, handler] of this.routes.entries()) {
            if (routePattern.includes(':')) {
                const regex = this.routeToRegex(routePattern);
                const match = path.match(regex);
                if (match) {
                    const params = this.extractParams(routePattern, match);
                    return { handler, params };
                }
            }
        }
        
        return null;
    }
    
    // Converter padrão de rota para regex
    routeToRegex(routePattern) {
        const pattern = routePattern
            .replace(/\//g, '\\/')
            .replace(/:(\w+)/g, '([^/]+)');
        return new RegExp(`^${pattern}$`);
    }
    
    // Extrair parâmetros da rota
    extractParams(routePattern, match) {
        const paramNames = [];
        const regex = /:(\w+)/g;
        let paramMatch;
        
        while ((paramMatch = regex.exec(routePattern)) !== null) {
            paramNames.push(paramMatch[1]);
        }
        
        const params = {};
        paramNames.forEach((name, index) => {
            params[name] = match[index + 1];
        });
        
        return params;
    }
    
    // Navegar para uma rota específica
    navegar(path, replace = false) {
        if (replace) {
            window.history.replaceState({}, '', path);
        } else {
            window.history.pushState({}, '', path);
        }
        this.handleRouteChange();
    }
    
    // Navegar para lista de apostas
    async navegarParaLista() {
        estado.modo = 'lista';
        estado.apostaAtual = null;
        
        // Garantir que os elementos existam antes de manipular
        const listaApostas = document.getElementById('listaApostas');
        const detalhesAposta = document.getElementById('detalhesAposta');
        
        if (listaApostas && detalhesAposta) {
            listaApostas.style.display = 'grid';
            detalhesAposta.style.display = 'none';
        }
        
        // Sempre carregar apostas para garantir dados atualizados
        await carregarApostas();
    }
    
    // Navegar para detalhes de uma aposta
    async navegarParaDetalhes(id) {
        const apostaId = parseInt(id);
        
        if (isNaN(apostaId)) {
            console.error('ID de aposta inválido:', id);
            this.navegarParaLista();
            return;
        }
        
        try {
            const response = await fetch(`${API_BASE}/${apostaId}`);
            if (!response.ok) {
                throw new Error('Aposta não encontrada');
            }
            
            estado.apostaAtual = await response.json();
            estado.modo = 'detalhes';
            
            const listaApostas = document.getElementById('listaApostas');
            const detalhesAposta = document.getElementById('detalhesAposta');
            
            if (listaApostas && detalhesAposta) {
                listaApostas.style.display = 'none';
                detalhesAposta.style.display = 'block';
                
                // Renderizar detalhes imediatamente
                renderizarDetalhes();
                setupEventListeners();
            } else {
                // Se os elementos não existirem ainda, aguardar um pouco
                setTimeout(() => {
                    this.navegarParaDetalhes(id);
                }, 100);
            }
            
        } catch (error) {
            console.error('Erro ao carregar detalhes:', error);
            notifications.error('Erro ao carregar aposta. Redirecionando para a lista...');
            this.navegarParaLista();
        }
    }
}

// Instanciar router
const router = new Router();

// Função para renderizar o header componentizado
function renderizarHeader() {
    const headerContainer = document.getElementById('headerContainer');
    if (!headerContainer) return;
    
    headerContainer.innerHTML = `
        <header>
            <div class="logo-container">
                <a href="/apostas" onclick="event.preventDefault(); mostrarLista(); return false;" class="logo-link" title="Voltar para a tela inicial">
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
                <a href="/apostas" onclick="event.preventDefault(); mostrarLista(); return false;" class="logo-link" title="Voltar para a tela inicial">
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
    // Garantir que os modais estão fechados
    const modalNovaAposta = document.getElementById('modalNovaAposta');
    const modalExclusaoAposta = document.getElementById('modalConfirmarExclusaoAposta');
    const modalExclusaoDia = document.getElementById('modalConfirmarExclusaoDia');
    
    if (modalNovaAposta) {
        modalNovaAposta.style.display = 'none';
    }
    if (modalExclusaoAposta) {
        modalExclusaoAposta.style.display = 'none';
    }
    if (modalExclusaoDia) {
        modalExclusaoDia.style.display = 'none';
    }
    
    // Garantir que os elementos estão no estado inicial correto
    const listaApostas = document.getElementById('listaApostas');
    const detalhesAposta = document.getElementById('detalhesAposta');
    
    if (listaApostas && detalhesAposta) {
        // Inicialmente, ambos podem estar visíveis ou ocultos, vamos garantir o estado correto
        // O router vai ajustar isso baseado na rota
        listaApostas.style.display = 'grid';
        detalhesAposta.style.display = 'none';
    }
    
    renderizarHeader();
    setupModalConfirmacaoListeners();
    // Aguardar um frame para garantir que o DOM está completamente renderizado
    requestAnimationFrame(() => {
        // Inicializar roteamento - ele decidirá qual tela mostrar baseado na URL
        router.init();
    });
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
        // Só renderizar lista se estivermos no modo lista
        if (estado.modo === 'lista') {
            renderizarLista();
        }
    } catch (error) {
        console.error('Erro ao carregar apostas:', error);
    }
}

function renderizarLista() {
    const container = document.getElementById('listaApostas');
    if (!container) return;
    
    if (estado.apostas.length === 0) {
        container.classList.add('empty-state');
        container.innerHTML = '<div class="loading">Nenhuma aposta cadastrada ainda.</div>';
        return;
    }
    
    container.classList.remove('empty-state');

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
            notifications.success('Aposta criada com sucesso!');
            // Usar router para navegar
            router.navegar(`/aposta/${aposta.id}`);
        } else {
            notifications.error('Erro ao criar aposta. Verifique os dados e tente novamente.');
        }
    } catch (error) {
        console.error('Erro:', error);
        notifications.error('Erro ao criar aposta. Verifique sua conexão e tente novamente.');
    }
}

async function mostrarDetalhes(id) {
    // Usar router para navegar - isso atualiza a URL e renderiza
    router.navegar(`/aposta/${id}`);
}

function mostrarLista() {
    // Usar router para navegar - isso atualiza a URL e renderiza
    router.navegar('/apostas');
}

function renderizarDetalhes() {
    const aposta = estado.apostaAtual;
    if (!aposta) {
        console.error('Nenhuma aposta atual para renderizar');
        return;
    }
    
    const container = document.getElementById('conteudoDetalhes');
    if (!container) {
        console.error('Container de detalhes não encontrado');
        return;
    }
    
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
            <button class="btn btn-danger" onclick="abrirModalExclusaoAposta()">🗑️ Excluir Aposta</button>
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
            <div class="dias-registrados-grid">
            ${(() => {
                // Ordenar dias em ordem decrescente (mais recente primeiro)
                const diasOrdenados = [...aposta.dias].sort((a, b) => {
                    const dataA = parseLocalDate(a.data);
                    const dataB = parseLocalDate(b.data);
                    return dataB - dataA; // Ordem decrescente
                });
                
                const LIMITE_DIAS_VISIVEIS = 2;
                
                return diasOrdenados.map((dia, diaIndex) => {
                    const dataFormatada = parseLocalDate(dia.data).toLocaleDateString('pt-BR');
                    // Usar o índice original do dia para manter referências corretas
                    const diaIndexOriginal = aposta.dias.findIndex(d => d.data === dia.data);
                    const diaId = `dia-${diaIndexOriginal}-${dia.data}`;
                    const deveOcultar = diaIndex >= LIMITE_DIAS_VISIVEIS;
                    const classeOculto = deveOcultar ? 'dia-registrado-oculto' : '';
                    return `
                        <div class="dia-registrado ${classeOculto}" id="${diaId}" data-dia-index="${diaIndexOriginal}">
                            <div class="dia-registrado-header">
                                ${dataFormatada}
                                <div class="dia-registrado-botoes">
                                    <button class="btn btn-edit" onclick="toggleEdicaoDia('${dia.data}', ${diaIndexOriginal})" id="btn-edit-${diaIndexOriginal}">
                                        ✏️ Editar
                                    </button>
                                    <button class="btn btn-danger btn-small" onclick="abrirModalExclusaoDia('${dia.data}', '${dataFormatada}')">
                                        🗑️ Excluir
                                    </button>
                                </div>
                            </div>
                            <div class="dia-registrado-participantes" id="participantes-${diaIndexOriginal}">
                                ${aposta.participantes.map(p => {
                                    const presente = dia.participantes[p];
                                    return `
                                        <span class="status-badge ${presente ? 'status-presente' : 'status-falta'}">
                                            ${p}: ${presente ? '✓ Presente' : '✗ Falta'}
                                        </span>
                                    `;
                                }).join('')}
                            </div>
                            <div class="dia-edicao" id="edicao-${diaIndexOriginal}" style="display: none;">
                                <div class="checkboxes-grid">
                                    ${aposta.participantes.map(p => {
                                        const presente = dia.participantes[p];
                                        return `
                                            <div class="checkbox-item">
                                                <input type="checkbox" id="edit-check-${diaIndexOriginal}-${p}" ${presente ? 'checked' : ''}>
                                                <label for="edit-check-${diaIndexOriginal}-${p}">${p}</label>
                                            </div>
                                        `;
                                    }).join('')}
                                </div>
                                <div class="dia-edicao-botoes">
                                    <button class="btn btn-primary" onclick="salvarEdicaoDia('${dia.data}', ${diaIndexOriginal})">💾 Salvar</button>
                                    <button class="btn btn-secondary" onclick="cancelarEdicaoDia('${dia.data}', ${diaIndexOriginal})">❌ Cancelar</button>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            })()}
            </div>
            ${aposta.dias.length > 2 ? `
                <div class="btn-ver-mais-dias">
                    <button class="btn btn-secondary" id="btn-ver-mais-dias" onclick="toggleVerMaisDias()">
                        Ver todos os dias (${aposta.dias.length - 2} ocultos)
                    </button>
                </div>
            ` : ''}
        </div>

        <button class="btn btn-gerar-imagem" onclick="gerarImagemTabela()">📊 Gerar Imagem da Tabela</button>
        
        <div id="tabelaImagem" class="tabela-container"></div>
    `;
}

async function registrarDia() {
    const data = document.getElementById('dataDia').value;
    if (!data) {
        notifications.warning('Selecione uma data');
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
            setupEventListeners(); // Reconfigurar listeners após renderizar
            const dataDiaInput = document.getElementById('dataDia');
            if (dataDiaInput) {
                dataDiaInput.value = '';
            }
            notifications.success('Dia registrado com sucesso!');
        } else {
            // Tentar obter mensagem de erro personalizada do servidor
            const errorData = await response.json().catch(() => ({}));
            
            if (errorData.error && errorData.message) {
                // Exibir mensagem personalizada do servidor
                notifications.warning(errorData.message);
            } else {
                // Mensagem genérica caso não haja mensagem específica
                notifications.error('Erro ao registrar dia. Verifique os dados e tente novamente.');
            }
        }
    } catch (error) {
        console.error('Erro:', error);
        notifications.error('Erro ao registrar dia. Verifique sua conexão e tente novamente.');
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
            notifications.error('Erro ao gerar imagem. Tente novamente.');
        });
    } else {
        notifications.error('Biblioteca de geração de imagem não carregada. Recarregue a página.');
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
            body: JSON.stringify({ data, participantes, isEdicao: true })
        });

        if (response.ok) {
            estado.apostaAtual = await response.json();
            renderizarDetalhes();
            setupEventListeners(); // Reconfigurar listeners após renderizar
            notifications.success('Alterações salvas com sucesso!');
        } else {
            // Tentar obter mensagem de erro personalizada do servidor
            const errorData = await response.json().catch(() => ({}));
            
            if (errorData.error && errorData.message) {
                // Exibir mensagem personalizada do servidor
                notifications.warning(errorData.message);
            } else {
                // Mensagem genérica caso não haja mensagem específica
                notifications.error('Erro ao salvar alterações. Verifique os dados e tente novamente.');
            }
        }
    } catch (error) {
        console.error('Erro:', error);
        notifications.error('Erro ao salvar alterações. Verifique sua conexão e tente novamente.');
    }
}

function cancelarEdicaoDia(data, diaIndex) {
    toggleEdicaoDia(data, diaIndex);
}

// Variáveis para armazenar dados temporários das exclusões
let apostaParaExcluir = null;
let diaParaExcluir = { data: null, dataFormatada: null };

// Função para abrir modal de confirmação de exclusão de aposta
function abrirModalExclusaoAposta() {
    apostaParaExcluir = estado.apostaAtual;
    const modal = document.getElementById('modalConfirmarExclusaoAposta');
    if (modal) {
        modal.style.display = 'block';
    }
}

// Função para abrir modal de confirmação de exclusão de dia
function abrirModalExclusaoDia(data, dataFormatada) {
    diaParaExcluir = { data, dataFormatada };
    const modal = document.getElementById('modalConfirmarExclusaoDia');
    const modalDiaInfo = document.getElementById('modalDiaInfo');
    if (modal) {
        if (modalDiaInfo) {
            modalDiaInfo.textContent = `Dia: ${dataFormatada}`;
        }
        modal.style.display = 'block';
    }
}

// Função para fechar modal de confirmação de exclusão de aposta
function fecharModalExclusaoAposta() {
    const modal = document.getElementById('modalConfirmarExclusaoAposta');
    if (modal) {
        modal.style.display = 'none';
    }
    apostaParaExcluir = null;
}

// Função para fechar modal de confirmação de exclusão de dia
function fecharModalExclusaoDia() {
    const modal = document.getElementById('modalConfirmarExclusaoDia');
    if (modal) {
        modal.style.display = 'none';
    }
    diaParaExcluir = { data: null, dataFormatada: null };
}

// Função para excluir aposta após confirmação
async function excluirAposta() {
    if (!apostaParaExcluir) return;
    
    try {
        const response = await fetch(`${API_BASE}/${apostaParaExcluir.id}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            fecharModalExclusaoAposta();
            notifications.success('Aposta excluída com sucesso!');
            // Navegar para a lista de apostas
            router.navegar('/apostas');
        } else {
            notifications.error('Erro ao excluir aposta');
        }
    } catch (error) {
        console.error('Erro:', error);
        notifications.error('Erro ao excluir aposta');
    }
}

// Função para excluir dia após confirmação
async function excluirDia() {
    if (!diaParaExcluir.data || !estado.apostaAtual) return;
    
    try {
        const response = await fetch(`${API_BASE}/${estado.apostaAtual.id}/dias/${diaParaExcluir.data}`, {
            method: 'DELETE'
        });

        if (response.ok) {
            estado.apostaAtual = await response.json();
            fecharModalExclusaoDia();
            renderizarDetalhes();
            setupEventListeners();
            notifications.success('Dia excluído com sucesso!');
        } else {
            notifications.error('Erro ao excluir dia');
        }
    } catch (error) {
        console.error('Erro:', error);
        notifications.error('Erro ao excluir dia');
    }
}

// Variável para rastrear se os listeners já foram configurados
let modalListenersConfigurados = false;

// Configurar event listeners dos modais de confirmação
function setupModalConfirmacaoListeners() {
    // Evitar configurar múltiplas vezes
    if (modalListenersConfigurados) return;
    
    // Modal de exclusão de aposta
    const btnConfirmarExclusaoAposta = document.getElementById('btnConfirmarExclusaoAposta');
    const btnCancelarExclusaoAposta = document.getElementById('btnCancelarExclusaoAposta');
    const modalExclusaoAposta = document.getElementById('modalConfirmarExclusaoAposta');
    
    if (btnConfirmarExclusaoAposta) {
        btnConfirmarExclusaoAposta.addEventListener('click', excluirAposta);
    }
    
    if (btnCancelarExclusaoAposta) {
        btnCancelarExclusaoAposta.addEventListener('click', fecharModalExclusaoAposta);
    }
    
    // Fechar modal ao clicar fora
    if (modalExclusaoAposta) {
        modalExclusaoAposta.addEventListener('click', (e) => {
            if (e.target === modalExclusaoAposta) {
                fecharModalExclusaoAposta();
            }
        });
    }
    
    // Modal de exclusão de dia
    const btnConfirmarExclusaoDia = document.getElementById('btnConfirmarExclusaoDia');
    const btnCancelarExclusaoDia = document.getElementById('btnCancelarExclusaoDia');
    const modalExclusaoDia = document.getElementById('modalConfirmarExclusaoDia');
    
    if (btnConfirmarExclusaoDia) {
        btnConfirmarExclusaoDia.addEventListener('click', excluirDia);
    }
    
    if (btnCancelarExclusaoDia) {
        btnCancelarExclusaoDia.addEventListener('click', fecharModalExclusaoDia);
    }
    
    // Fechar modal ao clicar fora
    if (modalExclusaoDia) {
        modalExclusaoDia.addEventListener('click', (e) => {
            if (e.target === modalExclusaoDia) {
                fecharModalExclusaoDia();
            }
        });
    }
    
    modalListenersConfigurados = true;
}

// Função para alternar exibição de todos os dias
function toggleVerMaisDias() {
    const btnVerMais = document.getElementById('btn-ver-mais-dias');
    const aposta = estado.apostaAtual;
    
    if (!btnVerMais || !aposta) return;
    
    const LIMITE_DIAS_VISIVEIS = 2;
    const estaExpandido = btnVerMais.dataset.expandido === 'true';
    
    // Selecionar todos os dias registrados
    const todosDias = document.querySelectorAll('.dia-registrado');
    
    if (estaExpandido) {
        // Colapsar: ocultar dias além do limite
        todosDias.forEach((dia, index) => {
            if (index >= LIMITE_DIAS_VISIVEIS) {
                dia.classList.add('dia-registrado-oculto');
            }
        });
        btnVerMais.textContent = `Ver todos os dias (${aposta.dias.length - LIMITE_DIAS_VISIVEIS} ocultos)`;
        btnVerMais.dataset.expandido = 'false';
    } else {
        // Expandir: mostrar todos os dias
        todosDias.forEach(dia => {
            dia.classList.remove('dia-registrado-oculto');
        });
        btnVerMais.textContent = 'Ocultar dias extras';
        btnVerMais.dataset.expandido = 'true';
    }
}

// Tornar funções globais para uso em onclick
window.mostrarDetalhes = mostrarDetalhes;
window.mostrarLista = mostrarLista;
window.registrarDia = registrarDia;
window.gerarImagemTabela = gerarImagemTabela;
window.toggleEdicaoDia = toggleEdicaoDia;
window.salvarEdicaoDia = salvarEdicaoDia;
window.cancelarEdicaoDia = cancelarEdicaoDia;
window.abrirModalExclusaoAposta = abrirModalExclusaoAposta;
window.abrirModalExclusaoDia = abrirModalExclusaoDia;
window.toggleVerMaisDias = toggleVerMaisDias;
