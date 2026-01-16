const API_BASE = '/api/apostas';

// ============================================
// DETECÇÃO DE PERFORMANCE
// ============================================

class PerformanceDetector {
    static detect() {
        const isMobile = /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) || window.innerWidth < 768;
        const isLowEnd = navigator.hardwareConcurrency <= 2 || 
                        (navigator.deviceMemory && navigator.deviceMemory <= 2) ||
                        /Android.*Chrome/.test(navigator.userAgent);
        const isSlowConnection = navigator.connection && 
                                (navigator.connection.effectiveType === 'slow-2g' || 
                                 navigator.connection.effectiveType === '2g');
        
        return {
            isMobile,
            isLowEnd: isLowEnd || isMobile,
            isSlowConnection,
            shouldReduceEffects: isLowEnd || isMobile,
            shouldDisableWebGL: isLowEnd && isMobile,
            maxParticles: isLowEnd ? 200 : (isMobile ? 400 : 800),
            maxInteractiveParticles: isLowEnd ? 50 : (isMobile ? 80 : 120),
            enableGeometries: !isLowEnd,
            enableConnections: !isLowEnd,
            enableCardParticles: !isLowEnd,
            frameSkip: isLowEnd ? 2 : 1 // Renderizar a cada N frames
        };
    }
}

const perfConfig = PerformanceDetector.detect();

// ============================================
// WEBGL BACKGROUND ANIMATION
// ============================================

class WebGLBackground {
    constructor() {
        this.canvas = document.getElementById('webgl-canvas');
        if (!this.canvas) return;
        
        this.scene = null;
        this.camera = null;
        this.renderer = null;
        this.particles = null;
        this.geometries = [];
        this.lines = null;
        this.time = 0;
        this.mouse = { x: 0, y: 0 };
        this.animationId = null;
        
        this.init();
        this.setupMouseTracking();
    }
    
    init() {
        if (typeof THREE === 'undefined') {
            console.warn('Three.js não carregado');
            return;
        }
        
        // Desabilitar WebGL em dispositivos muito fracos
        if (perfConfig.shouldDisableWebGL) {
            this.canvas.style.display = 'none';
            return;
        }
        
        // Scene
        this.scene = new THREE.Scene();
        this.scene.background = new THREE.Color(0x000000);
        
        // Camera
        this.camera = new THREE.PerspectiveCamera(
            75,
            window.innerWidth / window.innerHeight,
            0.1,
            1000
        );
        this.camera.position.z = 8;
        
        // Renderer com configurações otimizadas
        this.renderer = new THREE.WebGLRenderer({
            canvas: this.canvas,
            alpha: true,
            antialias: !perfConfig.isLowEnd, // Desabilitar antialiasing em dispositivos fracos
            powerPreference: 'low-power'
        });
        this.renderer.setSize(window.innerWidth, window.innerHeight);
        this.renderer.setPixelRatio(Math.min(window.devicePixelRatio, perfConfig.isLowEnd ? 1 : 1.5));
        
        // Criar elementos 3D (condicionalmente)
        this.createParticles();
        if (perfConfig.enableGeometries) {
            this.createGeometries();
        }
        if (perfConfig.enableConnections) {
            this.createConnections();
        }
        
        // Event listeners com throttle
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => this.onWindowResize(), 250);
        });
        
        // Iniciar animação
        this.frameCount = 0;
        this.animate();
    }
    
    setupMouseTracking() {
        let lastUpdate = 0;
        const throttle = perfConfig.isLowEnd ? 100 : 16; // Throttle mais agressivo em dispositivos fracos
        
        document.addEventListener('mousemove', (e) => {
            const now = Date.now();
            if (now - lastUpdate < throttle) return;
            lastUpdate = now;
            
            this.mouse.x = (e.clientX / window.innerWidth) * 2 - 1;
            this.mouse.y = -(e.clientY / window.innerHeight) * 2 + 1;
        });
    }
    
    createParticles() {
        // Usar configuração de performance detectada
        const particleCount = perfConfig.maxParticles;
        const geometry = new THREE.BufferGeometry();
        const positions = new Float32Array(particleCount * 3);
        const colors = new Float32Array(particleCount * 3);
        const sizes = new Float32Array(particleCount);
        const velocities = new Float32Array(particleCount * 3);
        
        const color1 = new THREE.Color(0xFFE400); // Amarelo
        const color2 = new THREE.Color(0xFFD700); // Amarelo dourado
        
        for (let i = 0; i < particleCount; i++) {
            const i3 = i * 3;
            
            // Posições aleatórias em uma esfera maior
            const radius = 15 + Math.random() * 10;
            const theta = Math.random() * Math.PI * 2;
            const phi = Math.acos(Math.random() * 2 - 1);
            
            positions[i3] = radius * Math.sin(phi) * Math.cos(theta);
            positions[i3 + 1] = radius * Math.sin(phi) * Math.sin(theta);
            positions[i3 + 2] = radius * Math.cos(phi);
            
            // Velocidades para movimento
            velocities[i3] = (Math.random() - 0.5) * 0.02;
            velocities[i3 + 1] = (Math.random() - 0.5) * 0.02;
            velocities[i3 + 2] = (Math.random() - 0.5) * 0.02;
            
            // Cores interpoladas
            const t = Math.random();
            const color = new THREE.Color().lerpColors(color1, color2, t);
            colors[i3] = color.r;
            colors[i3 + 1] = color.g;
            colors[i3 + 2] = color.b;
            
            // Tamanhos variados
            sizes[i] = Math.random() * 3 + 1;
        }
        
        geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
        geometry.setAttribute('size', new THREE.BufferAttribute(sizes, 1));
        geometry.userData.velocities = velocities;
        
        const material = new THREE.ShaderMaterial({
            uniforms: {
                time: { value: 0 },
                mouse: { value: new THREE.Vector2(0, 0) }
            },
            vertexShader: `
                attribute float size;
                attribute vec3 color;
                varying vec3 vColor;
                varying float vDistance;
                uniform float time;
                uniform vec2 mouse;
                
                void main() {
                    vColor = color;
                    vec3 pos = position;
                    
                    // Movimento ondulatório complexo
                    pos.x += sin(time * 0.5 + position.y * 0.1 + position.z * 0.05) * 1.0;
                    pos.y += cos(time * 0.3 + position.x * 0.1 + position.z * 0.05) * 1.0;
                    pos.z += sin(time * 0.4 + position.x * 0.1 + position.y * 0.05) * 1.0;
                    
                    // Efeito de mouse
                    pos.xy += mouse * 2.0;
                    
                    vec4 mvPosition = modelViewMatrix * vec4(pos, 1.0);
                    vDistance = -mvPosition.z;
                    gl_PointSize = size * (400.0 / -mvPosition.z) * (1.0 + sin(time + position.x) * 0.3);
                    gl_Position = projectionMatrix * mvPosition;
                }
            `,
            fragmentShader: `
                varying vec3 vColor;
                varying float vDistance;
                
                void main() {
                    vec2 center = gl_PointCoord - vec2(0.5);
                    float dist = length(center);
                    
                    // Brilho mais intenso
                    float alpha = 1.0 - smoothstep(0.0, 0.6, dist);
                    alpha *= 0.8;
                    
                    // Efeito de brilho no centro
                    float glow = 1.0 - smoothstep(0.0, 0.3, dist);
                    vec3 finalColor = vColor + vec3(glow * 0.5);
                    
                    gl_FragColor = vec4(finalColor, alpha);
                }
            `,
            transparent: true,
            vertexColors: true,
            blending: THREE.AdditiveBlending
        });
        
        this.particles = new THREE.Points(geometry, material);
        this.scene.add(this.particles);
    }
    
    createGeometries() {
        // Torus (rosquinha) wireframe
        const torusGeometry = new THREE.TorusGeometry(2, 0.3, 8, 50);
        const torusMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFE400,
            wireframe: true,
            transparent: true,
            opacity: 0.3
        });
        const torus = new THREE.Mesh(torusGeometry, torusMaterial);
        torus.position.set(-4, 2, -5);
        this.scene.add(torus);
        this.geometries.push(torus);
        
        // Octaedro wireframe
        const octaGeometry = new THREE.OctahedronGeometry(1.5, 0);
        const octaMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFE400,
            wireframe: true,
            transparent: true,
            opacity: 0.25
        });
        const octa = new THREE.Mesh(octaGeometry, octaMaterial);
        octa.position.set(4, -2, -6);
        this.scene.add(octa);
        this.geometries.push(octa);
        
        // Icosaedro wireframe
        const icoGeometry = new THREE.IcosahedronGeometry(1.2, 0);
        const icoMaterial = new THREE.MeshBasicMaterial({
            color: 0xFFD700,
            wireframe: true,
            transparent: true,
            opacity: 0.2
        });
        const ico = new THREE.Mesh(icoGeometry, icoMaterial);
        ico.position.set(0, 3, -7);
        this.scene.add(ico);
        this.geometries.push(ico);
    }
    
    createConnections() {
        const lineGeometry = new THREE.BufferGeometry();
        // Reduzir linhas baseado na performance
        const lineCount = perfConfig.isLowEnd ? 50 : (perfConfig.isMobile ? 100 : 200);
        const positions = new Float32Array(lineCount * 6);
        
        for (let i = 0; i < lineCount; i++) {
            const i6 = i * 6;
            const radius = 12;
            const theta1 = Math.random() * Math.PI * 2;
            const phi1 = Math.acos(Math.random() * 2 - 1);
            const theta2 = Math.random() * Math.PI * 2;
            const phi2 = Math.acos(Math.random() * 2 - 1);
            
            positions[i6] = radius * Math.sin(phi1) * Math.cos(theta1);
            positions[i6 + 1] = radius * Math.sin(phi1) * Math.sin(theta1);
            positions[i6 + 2] = radius * Math.cos(phi1);
            positions[i6 + 3] = radius * Math.sin(phi2) * Math.cos(theta2);
            positions[i6 + 4] = radius * Math.sin(phi2) * Math.sin(theta2);
            positions[i6 + 5] = radius * Math.cos(phi2);
        }
        
        lineGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
        
        const lineMaterial = new THREE.LineBasicMaterial({
            color: 0xFFE400,
            transparent: true,
            opacity: 0.1
        });
        
        this.lines = new THREE.LineSegments(lineGeometry, lineMaterial);
        this.scene.add(this.lines);
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        this.frameCount++;
        
        // Frame skipping para dispositivos fracos
        if (this.frameCount % perfConfig.frameSkip !== 0) {
            return;
        }
        
        this.time += 0.01;
        
        // Animar partículas (simplificado em dispositivos fracos)
        if (this.particles) {
            this.particles.rotation.x += 0.0003;
            this.particles.rotation.y += 0.0005;
            this.particles.material.uniforms.time.value = this.time;
            this.particles.material.uniforms.mouse.value.set(this.mouse.x, this.mouse.y);
            
            // Atualizar posições das partículas (menos frequente em dispositivos fracos)
            if (this.frameCount % (perfConfig.isLowEnd ? 2 : 1) === 0) {
                const positions = this.particles.geometry.attributes.position;
                const velocities = this.particles.geometry.userData.velocities;
                
                for (let i = 0; i < positions.count; i++) {
                    const i3 = i * 3;
                    positions.array[i3] += velocities[i3] + Math.sin(this.time + i) * 0.01;
                    positions.array[i3 + 1] += velocities[i3 + 1] + Math.cos(this.time + i) * 0.01;
                    positions.array[i3 + 2] += velocities[i3 + 2] + Math.sin(this.time * 0.5 + i) * 0.01;
                }
                positions.needsUpdate = true;
            }
        }
        
        // Animar geometrias (apenas se habilitado)
        if (perfConfig.enableGeometries) {
            this.geometries.forEach((geo, index) => {
                geo.rotation.x += 0.002 * (index + 1);
                geo.rotation.y += 0.003 * (index + 1);
                geo.position.y += Math.sin(this.time + index) * 0.01;
            });
        }
        
        // Animar linhas (apenas se habilitado)
        if (this.lines && perfConfig.enableConnections) {
            this.lines.rotation.x += 0.0002;
            this.lines.rotation.z += 0.0003;
        }
        
        // Mover câmera suavemente (menos responsivo em dispositivos fracos)
        const cameraSpeed = perfConfig.isLowEnd ? 0.02 : 0.05;
        this.camera.position.x += (this.mouse.x * 2 - this.camera.position.x) * cameraSpeed;
        this.camera.position.y += (this.mouse.y * 2 - this.camera.position.y) * cameraSpeed;
        this.camera.lookAt(this.scene.position);
        
        this.renderer.render(this.scene, this.camera);
    }
    
    onWindowResize() {
        this.camera.aspect = window.innerWidth / window.innerHeight;
        this.camera.updateProjectionMatrix();
        this.renderer.setSize(window.innerWidth, window.innerHeight);
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.renderer) {
            this.renderer.dispose();
        }
    }
}

// Instanciar WebGL Background
let webglBackground = null;

// ============================================
// SISTEMA DE PARTÍCULAS INTERATIVAS
// ============================================

class InteractiveParticleSystem {
    constructor() {
        this.canvas = null;
        this.ctx = null;
        this.particles = [];
        this.mouse = { x: 0, y: 0, vx: 0, vy: 0 };
        this.targetText = 'DF';
        this.mode = 'free'; // 'free', 'text', 'explosion'
        this.animationId = null;
        this.lastMouseMove = Date.now();
        
        this.init();
    }
    
    init() {
        // Criar canvas para partículas interativas
        this.canvas = document.createElement('canvas');
        this.canvas.id = 'interactive-particles';
        this.canvas.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            z-index: 0;
            pointer-events: none;
            opacity: 0;
            transition: opacity 1s ease-in;
        `;
        document.body.appendChild(this.canvas);
        
        this.ctx = this.canvas.getContext('2d');
        this.resize();
        
        // Criar partículas
        this.createParticles();
        
        // Animação de entrada
        this.createEntranceAnimation();
        
        // Event listeners
        window.addEventListener('resize', () => this.resize());
        document.addEventListener('mousemove', (e) => this.onMouseMove(e));
        document.addEventListener('click', (e) => this.onClick(e));
        document.addEventListener('mousedown', (e) => this.onMouseDown(e));
        
        // Fade in após animação de entrada
        setTimeout(() => {
            this.canvas.style.opacity = '0.7';
        }, 1500);
        
        // Iniciar animação
        this.animate();
        
        // Alternar modo texto quando mouse parar (desabilitado em dispositivos fracos)
        if (!perfConfig.isLowEnd) {
            setInterval(() => {
                if (Date.now() - this.lastMouseMove > 2000 && this.mode === 'free') {
                    this.mode = 'text';
                    this.formText();
                }
            }, 100);
        }
    }
    
    createEntranceAnimation() {
        // Desabilitar animação de entrada em dispositivos fracos
        if (perfConfig.isLowEnd) {
            return;
        }
        
        // Criar explosão inicial no centro da tela
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        const entranceCount = perfConfig.isMobile ? 30 : 50;
        
        for (let i = 0; i < entranceCount; i++) {
            const angle = (Math.PI * 2 * i) / entranceCount;
            const speed = Math.random() * 8 + 4;
            const distance = Math.random() * 200 + 100;
            
            this.particles.push({
                x: centerX + Math.cos(angle) * distance,
                y: centerY + Math.sin(angle) * distance,
                vx: -Math.cos(angle) * speed * 0.1,
                vy: -Math.sin(angle) * speed * 0.1,
                size: Math.random() * 4 + 2,
                color: '#FFE400',
                opacity: 1,
                targetX: centerX + (Math.random() - 0.5) * this.canvas.width,
                targetY: centerY + (Math.random() - 0.5) * this.canvas.height,
                originalX: centerX + (Math.random() - 0.5) * this.canvas.width,
                originalY: centerY + (Math.random() - 0.5) * this.canvas.height,
                trail: [],
                isEntrance: true,
                entranceTime: Math.random() * 30
            });
        }
    }
    
    resize() {
        this.canvas.width = window.innerWidth;
        this.canvas.height = window.innerHeight;
    }
    
    createParticles() {
        const count = perfConfig.maxInteractiveParticles;
        this.particles = [];
        
        for (let i = 0; i < count; i++) {
            this.particles.push({
                x: Math.random() * this.canvas.width,
                y: Math.random() * this.canvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 3 + 1,
                color: Math.random() > 0.5 ? '#FFE400' : '#FFD700',
                opacity: Math.random() * 0.5 + 0.3,
                targetX: null,
                targetY: null,
                originalX: Math.random() * this.canvas.width,
                originalY: Math.random() * this.canvas.height,
                trail: []
            });
        }
    }
    
    onMouseMove(e) {
        this.lastMouseMove = Date.now();
        
        // Atualizar posição do mouse com suavização mais rápida
        const dx = e.clientX - this.mouse.x;
        const dy = e.clientY - this.mouse.y;
        this.mouse.x += dx * 0.2;
        this.mouse.y += dy * 0.2;
        
        // Criar pequenas partículas no rastro do mouse (desabilitado em dispositivos fracos)
        if (!perfConfig.isLowEnd && Math.random() > 0.9) {
            this.createTrailParticle(e.clientX, e.clientY);
        }
        
        if (this.mode === 'text') {
            this.mode = 'free';
            // Resetar targets quando sair do modo texto
            this.particles.forEach(p => {
                p.targetX = null;
                p.targetY = null;
            });
        }
    }
    
    createTrailParticle(x, y) {
        this.particles.push({
            x: x + (Math.random() - 0.5) * 10,
            y: y + (Math.random() - 0.5) * 10,
            vx: (Math.random() - 0.5) * 1,
            vy: (Math.random() - 0.5) * 1,
            size: Math.random() * 2 + 1,
            color: '#FFE400',
            opacity: 0.8,
            targetX: null,
            targetY: null,
            originalX: x,
            originalY: y,
            trail: [],
            life: 40,
            maxLife: 40
        });
    }
    
    onClick(e) {
        // Criar explosão de partículas
        this.createExplosion(e.clientX, e.clientY);
    }
    
    onMouseDown(e) {
        // Criar pequena explosão ao pressionar
        this.createMiniExplosion(e.clientX, e.clientY);
    }
    
    createExplosion(x, y) {
        this.mode = 'explosion';
        const explosionCount = perfConfig.isLowEnd ? 15 : (perfConfig.isMobile ? 20 : 25);
        
        for (let i = 0; i < explosionCount; i++) {
            const angle = (Math.PI * 2 * i) / explosionCount;
            const speed = Math.random() * 5 + 2;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 4 + 2,
                color: '#FFE400',
                opacity: 1,
                targetX: null,
                targetY: null,
                originalX: x,
                originalY: y,
                trail: [],
                life: 60
            });
        }
        
        setTimeout(() => {
            this.mode = 'free';
        }, 1000);
    }
    
    createMiniExplosion(x, y) {
        // Desabilitar mini explosões em dispositivos fracos
        if (perfConfig.isLowEnd) return;
        const miniCount = perfConfig.isMobile ? 8 : 10;
        
        for (let i = 0; i < miniCount; i++) {
            const angle = (Math.PI * 2 * i) / miniCount;
            const speed = Math.random() * 2 + 1;
            
            this.particles.push({
                x: x,
                y: y,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                size: Math.random() * 2 + 1,
                color: '#FFD700',
                opacity: 0.8,
                targetX: null,
                targetY: null,
                originalX: x,
                originalY: y,
                trail: [],
                life: 30
            });
        }
    }
    
    formText() {
        // Criar pontos que formam o texto "DF"
        const fontSize = Math.min(this.canvas.width, this.canvas.height) * 0.2;
        const centerX = this.canvas.width / 2;
        const centerY = this.canvas.height / 2;
        
        // Desenhar texto em canvas temporário para obter pontos
        const tempCanvas = document.createElement('canvas');
        tempCanvas.width = this.canvas.width;
        tempCanvas.height = this.canvas.height;
        const tempCtx = tempCanvas.getContext('2d');
        
        // Criar gradiente para o texto
        const gradient = tempCtx.createLinearGradient(0, 0, tempCanvas.width, tempCanvas.height);
        gradient.addColorStop(0, '#FFE400');
        gradient.addColorStop(1, '#FFD700');
        
        tempCtx.fillStyle = gradient;
        tempCtx.font = `bold ${fontSize}px 'Bebas Neue', sans-serif`;
        tempCtx.textAlign = 'center';
        tempCtx.textBaseline = 'middle';
        tempCtx.shadowBlur = 20;
        tempCtx.shadowColor = '#FFE400';
        tempCtx.fillText(this.targetText, centerX, centerY);
        
        // Obter pontos do texto
        const imageData = tempCtx.getImageData(0, 0, tempCanvas.width, tempCanvas.height);
        const textPoints = [];
        
        // Amostragem mais densa para melhor formação do texto
        const step = window.innerWidth < 768 ? 6 : 3;
        
        for (let y = 0; y < imageData.height; y += step) {
            for (let x = 0; x < imageData.width; x += step) {
                const index = (y * imageData.width + x) * 4;
                if (imageData.data[index + 3] > 128) {
                    textPoints.push({ x, y });
                }
            }
        }
        
        // Atribuir partículas aos pontos do texto
        if (textPoints.length > 0) {
            this.particles.forEach((particle, i) => {
                if (i < textPoints.length) {
                    const point = textPoints[i];
                    particle.targetX = point.x;
                    particle.targetY = point.y;
                } else {
                    // Partículas extras vão para posições aleatórias próximas
                    const randomPoint = textPoints[Math.floor(Math.random() * textPoints.length)];
                    particle.targetX = randomPoint.x + (Math.random() - 0.5) * 50;
                    particle.targetY = randomPoint.y + (Math.random() - 0.5) * 50;
                }
            });
        }
    }
    
    updateParticles() {
        this.particles.forEach((particle, index) => {
            // Animação de entrada
            if (particle.isEntrance && particle.entranceTime > 0) {
                particle.entranceTime--;
                const progress = 1 - (particle.entranceTime / 30);
                particle.opacity = progress;
                return;
            }
            
            // Atualizar trail
            particle.trail.push({ x: particle.x, y: particle.y });
            if (particle.trail.length > 5) {
                particle.trail.shift();
            }
            
            if (this.mode === 'text' && particle.targetX !== null && particle.targetY !== null) {
                // Mover partícula em direção ao ponto do texto
                const dx = particle.targetX - particle.x;
                const dy = particle.targetY - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance > 1) {
                    particle.vx += dx * 0.02;
                    particle.vy += dy * 0.02;
                }
            } else if (this.mode === 'explosion' && particle.life) {
                // Partículas de explosão
                particle.life--;
                particle.opacity = particle.life / 60;
                particle.vx *= 0.95;
                particle.vy *= 0.95;
            } else {
                // Modo livre - interação com mouse
                const dx = this.mouse.x - particle.x;
                const dy = this.mouse.y - particle.y;
                const distance = Math.sqrt(dx * dx + dy * dy);
                
                if (distance < 150) {
                    // Repulsão do mouse com força variável
                    const force = Math.pow((150 - distance) / 150, 2);
                    const angle = Math.atan2(dy, dx);
                    particle.vx -= Math.cos(angle) * force * 0.15;
                    particle.vy -= Math.sin(angle) * force * 0.15;
                    
                    // Efeito de brilho quando próximo do mouse
                    particle.opacity = Math.min(1, 0.5 + force * 0.5);
                } else {
                    // Fade out gradual quando longe
                    particle.opacity = Math.max(0.3, particle.opacity * 0.98);
                }
                
                // Atração suave de volta à posição original
                const origDx = particle.originalX - particle.x;
                const origDy = particle.originalY - particle.y;
                const origDist = Math.sqrt(origDx * origDx + origDy * origDy);
                
                if (origDist > 50) {
                    particle.vx += (origDx / origDist) * 0.002;
                    particle.vy += (origDy / origDist) * 0.002;
                }
            }
            
            // Aplicar velocidade
            particle.x += particle.vx;
            particle.y += particle.vy;
            
            // Fricção
            particle.vx *= 0.98;
            particle.vy *= 0.98;
            
            // Limites da tela com bounce
            if (particle.x < 0 || particle.x > this.canvas.width) {
                particle.vx *= -0.8;
                particle.x = Math.max(0, Math.min(this.canvas.width, particle.x));
            }
            if (particle.y < 0 || particle.y > this.canvas.height) {
                particle.vy *= -0.8;
                particle.y = Math.max(0, Math.min(this.canvas.height, particle.y));
            }
            
            // Remover partículas de explosão e trail mortas
            if (particle.life !== undefined) {
                particle.life--;
                particle.opacity = particle.life / particle.maxLife;
                if (particle.life <= 0) {
                    this.particles.splice(index, 1);
                }
            }
        });
    }
    
    drawParticles() {
        this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        
        // Desabilitar sombras em dispositivos fracos para melhor performance
        const useShadows = !perfConfig.isLowEnd;
        
        this.particles.forEach(particle => {
            // Desenhar trail (apenas se não for dispositivo fraco)
            if (!perfConfig.isLowEnd && particle.trail.length > 0) {
                particle.trail.forEach((point, i) => {
                    const trailOpacity = (i / particle.trail.length) * particle.opacity * 0.3;
                    this.ctx.fillStyle = particle.color;
                    this.ctx.globalAlpha = trailOpacity;
                    this.ctx.beginPath();
                    this.ctx.arc(point.x, point.y, particle.size * 0.5, 0, Math.PI * 2);
                    this.ctx.fill();
                });
            }
            
            // Desenhar partícula
            this.ctx.globalAlpha = particle.opacity;
            this.ctx.fillStyle = particle.color;
            if (useShadows) {
                this.ctx.shadowBlur = 10;
                this.ctx.shadowColor = particle.color;
            }
            this.ctx.beginPath();
            this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
            this.ctx.fill();
            if (useShadows) {
                this.ctx.shadowBlur = 0;
            }
        });
        
        // Desenhar conexões (apenas se habilitado e não for dispositivo fraco)
        if (!perfConfig.isLowEnd && this.particles.length > 0) {
            this.ctx.strokeStyle = '#FFE400';
            this.ctx.globalAlpha = 0.2;
            this.ctx.lineWidth = 1;
            
            // Reduzir verificações de conexão para melhor performance
            const maxConnections = Math.min(this.particles.length, perfConfig.isMobile ? 50 : 80);
            const maxNeighbors = perfConfig.isMobile ? 5 : 8;
            
            for (let i = 0; i < maxConnections; i++) {
                for (let j = i + 1; j < Math.min(i + maxNeighbors, this.particles.length); j++) {
                    const dx = this.particles[i].x - this.particles[j].x;
                    const dy = this.particles[i].y - this.particles[j].y;
                    const distance = Math.sqrt(dx * dx + dy * dy);
                    
                    if (distance < 80) {
                        this.ctx.globalAlpha = (1 - distance / 80) * 0.2;
                        this.ctx.beginPath();
                        this.ctx.moveTo(this.particles[i].x, this.particles[i].y);
                        this.ctx.lineTo(this.particles[j].x, this.particles[j].y);
                        this.ctx.stroke();
                    }
                }
            }
        }
    }
    
    animate() {
        this.animationId = requestAnimationFrame(() => this.animate());
        this.frameCount = (this.frameCount || 0) + 1;
        
        // Frame skipping para dispositivos fracos
        if (this.frameCount % perfConfig.frameSkip !== 0) {
            return;
        }
        
        this.updateParticles();
        this.drawParticles();
    }
    
    destroy() {
        if (this.animationId) {
            cancelAnimationFrame(this.animationId);
        }
        if (this.canvas && this.canvas.parentNode) {
            this.canvas.parentNode.removeChild(this.canvas);
        }
    }
}

// Instanciar sistema de partículas interativas
let interactiveParticles = null;

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
    
    // Navegar para detalhes com dados opcionais (evita fetch desnecessário)
    navegarParaDetalhesComDados(id, apostaData) {
        // Atualizar URL
        window.history.pushState({}, '', `/aposta/${id}`);
        // Navegar diretamente com os dados já disponíveis
        this.navegarParaDetalhes(id, apostaData);
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
    async navegarParaDetalhes(id, apostaData = null) {
        const apostaId = parseInt(id);
        
        if (isNaN(apostaId)) {
            console.error('ID de aposta inválido:', id);
            this.navegarParaLista();
            return;
        }
        
        // Se os dados da aposta já foram fornecidos (ex: após criação), usar diretamente
        if (apostaData) {
            estado.apostaAtual = apostaData;
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
                    this.navegarParaDetalhes(id, apostaData);
                }, 100);
            }
            return;
        }
        
        // Caso contrário, buscar do servidor com retry
        let tentativas = 3;
        let delay = 100;
        
        while (tentativas > 0) {
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
                return; // Sucesso, sair do loop
                
            } catch (error) {
                tentativas--;
                if (tentativas === 0) {
                    console.error('Erro ao carregar detalhes após múltiplas tentativas:', error);
                    notifications.error('Erro ao carregar aposta. Redirecionando para a lista...');
                    this.navegarParaLista();
                } else {
                    // Aguardar antes de tentar novamente
                    await new Promise(resolve => setTimeout(resolve, delay));
                    delay *= 2; // Backoff exponencial
                }
            }
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
    // Inicializar WebGL Background (apenas se não for dispositivo muito fraco)
    if (typeof THREE !== 'undefined' && !perfConfig.shouldDisableWebGL) {
        webglBackground = new WebGLBackground();
    }
    
    // Inicializar sistema de partículas interativas (lazy loading em dispositivos fracos)
    if (perfConfig.isLowEnd) {
        // Carregar apenas após interação do usuário
        let loaded = false;
        const loadOnInteraction = () => {
            if (!loaded) {
                interactiveParticles = new InteractiveParticleSystem();
                loaded = true;
                document.removeEventListener('mousemove', loadOnInteraction);
                document.removeEventListener('touchstart', loadOnInteraction);
            }
        };
        document.addEventListener('mousemove', loadOnInteraction, { once: true });
        document.addEventListener('touchstart', loadOnInteraction, { once: true });
    } else {
        // Carregar imediatamente em dispositivos mais potentes
        interactiveParticles = new InteractiveParticleSystem();
    }
    
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
        // Definir data mínima como hoje (formato YYYY-MM-DD)
        const hoje = new Date();
        const ano = hoje.getFullYear();
        const mes = String(hoje.getMonth() + 1).padStart(2, '0');
        const dia = String(hoje.getDate()).padStart(2, '0');
        const dataMinima = `${ano}-${mes}-${dia}`;
        
        const dataInicialInput = document.getElementById('dataInicial');
        if (dataInicialInput) {
            dataInicialInput.setAttribute('min', dataMinima);
        }
        
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
        
        // Validações em tempo real
        const dataInicialInput = document.getElementById('dataInicial');
        const dataFinalInput = document.getElementById('dataFinal');
        const limiteFaltasInput = document.getElementById('limiteFaltas');
        
        // Função para validar e mostrar feedback
        const validarFormulario = () => {
            const dataInicial = dataInicialInput.value;
            const dataFinal = dataFinalInput.value;
            const limiteFaltas = parseInt(limiteFaltasInput.value);
            
            // Limpar mensagens de erro/info anteriores
            const mensagens = form.querySelectorAll('.erro-validacao, .info-validacao');
            mensagens.forEach(msg => msg.remove());
            
            let temErro = false;
            
            // Validar data inicial não pode ser anterior à data atual
            if (dataInicial) {
                const hoje = new Date();
                hoje.setHours(0, 0, 0, 0);
                const dataInicialDate = new Date(dataInicial + 'T00:00:00');
                dataInicialDate.setHours(0, 0, 0, 0);
                
                if (dataInicialDate < hoje) {
                    const hojeFormatado = hoje.toLocaleDateString('pt-BR');
                    const erroMsg = document.createElement('div');
                    erroMsg.className = 'erro-validacao';
                    erroMsg.style.cssText = 'color: #ff4444; font-size: 0.9em; margin-top: 5px;';
                    erroMsg.textContent = `A data inicial não pode ser anterior à data atual (${hojeFormatado}).`;
                    dataInicialInput.parentElement.appendChild(erroMsg);
                    temErro = true;
                    // Remover max do limite de faltas se data inicial inválida
                    limiteFaltasInput.removeAttribute('max');
                }
            }
            
            // Validar datas
            if (dataInicial && dataFinal) {
                if (dataInicial >= dataFinal) {
                    const erroMsg = document.createElement('div');
                    erroMsg.className = 'erro-validacao';
                    erroMsg.style.cssText = 'color: #ff4444; font-size: 0.9em; margin-top: 5px;';
                    erroMsg.textContent = 'A data inicial deve ser anterior à data final.';
                    dataFinalInput.parentElement.appendChild(erroMsg);
                    temErro = true;
                    // Remover max do limite de faltas se datas inválidas
                    limiteFaltasInput.removeAttribute('max');
                } else if (!temErro) {
                    // Calcular dias corridos e atualizar max do limite de faltas
                    const diasCorridos = calcularDiasCorridos(dataInicial, dataFinal);
                    limiteFaltasInput.setAttribute('max', diasCorridos);
                    
                    // Mostrar informação sobre o período
                    const infoMsg = document.createElement('div');
                    infoMsg.className = 'info-validacao';
                    infoMsg.style.cssText = 'color: #4CAF50; font-size: 0.85em; margin-top: 5px;';
                    infoMsg.textContent = `Período: ${diasCorridos} dias corridos. Limite máximo de faltas: ${diasCorridos}.`;
                    limiteFaltasInput.parentElement.appendChild(infoMsg);
                    
                    // Validar limite de faltas se as datas estiverem corretas
                    if (!isNaN(limiteFaltas) && limiteFaltas > 0) {
                        if (limiteFaltas > diasCorridos) {
                            const erroMsg = document.createElement('div');
                            erroMsg.className = 'erro-validacao';
                            erroMsg.style.cssText = 'color: #ff4444; font-size: 0.9em; margin-top: 5px;';
                            erroMsg.textContent = `O limite de faltas não pode ser maior que ${diasCorridos} dias (período da aposta).`;
                            limiteFaltasInput.parentElement.appendChild(erroMsg);
                            temErro = true;
                        }
                    }
                }
            } else {
                // Se as datas não estiverem preenchidas, remover max
                limiteFaltasInput.removeAttribute('max');
            }
            
            // Desabilitar/habilitar botão de submit baseado na validação
            const btnSubmit = form.querySelector('button[type="submit"]');
            if (btnSubmit) {
                btnSubmit.disabled = temErro;
                btnSubmit.style.opacity = temErro ? '0.6' : '1';
                btnSubmit.style.cursor = temErro ? 'not-allowed' : 'pointer';
            }
        };
        
        // Adicionar listeners para validação em tempo real
        if (dataInicialInput) {
            dataInicialInput.addEventListener('change', validarFormulario);
            dataInicialInput.addEventListener('input', validarFormulario);
        }
        
        if (dataFinalInput) {
            dataFinalInput.addEventListener('change', validarFormulario);
            dataFinalInput.addEventListener('input', validarFormulario);
        }
        
        if (limiteFaltasInput) {
            limiteFaltasInput.addEventListener('change', validarFormulario);
            limiteFaltasInput.addEventListener('input', validarFormulario);
        }
        
        // Limpar validações ao fechar o modal
        if (close) {
            const closeOriginal = close.onclick;
            close.addEventListener('click', () => {
                const mensagens = form.querySelectorAll('.erro-validacao, .info-validacao');
                mensagens.forEach(msg => msg.remove());
                const btnSubmit = form.querySelector('button[type="submit"]');
                if (btnSubmit) {
                    btnSubmit.disabled = false;
                    btnSubmit.style.opacity = '1';
                    btnSubmit.style.cursor = 'pointer';
                }
            });
        }
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

// Função para animar contador de números
function animateCounter(element, target, duration = 2000) {
    const start = 0;
    const increment = target / (duration / 16);
    let current = start;
    
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            element.textContent = target;
            clearInterval(timer);
        } else {
            element.textContent = Math.floor(current);
        }
    }, 16);
}

function renderizarLista() {
    const container = document.getElementById('listaApostas');
    if (!container) return;
    
    // Calcular estatísticas
    const totalApostas = estado.apostas.length;
    const totalParticipantes = new Set(estado.apostas.flatMap(a => a.participantes)).size;
    const totalDiasRegistrados = estado.apostas.reduce((sum, a) => sum + a.dias.length, 0);
    
    if (estado.apostas.length === 0) {
        container.classList.add('empty-state');
        container.innerHTML = `
            <div class="empty-state-message">
                <h2>Bem-vindo!</h2>
                <p>Nenhuma aposta cadastrada ainda.</p>
                <p>Crie sua primeira aposta para começar!</p>
            </div>
        `;
        return;
    }
    
    container.classList.remove('empty-state');

    // Hero Section
    const heroSection = `
        <div class="hero-section">
            <div class="hero-content">
                <h1 class="hero-title">DIRETORIA FITNESS</h1>
                <p class="hero-subtitle">Gerencie suas apostas de forma inteligente</p>
                <div class="hero-stats">
                    <div class="hero-stat">
                        <span class="hero-stat-number" data-count="${totalApostas}">0</span>
                        <span class="hero-stat-label">Apostas Ativas</span>
                    </div>
                    <div class="hero-stat">
                        <span class="hero-stat-number" data-count="${totalParticipantes}">0</span>
                        <span class="hero-stat-label">Participantes</span>
                    </div>
                    <div class="hero-stat">
                        <span class="hero-stat-number" data-count="${totalDiasRegistrados}">0</span>
                        <span class="hero-stat-label">Dias Registrados</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    // Cards de apostas
    const cardsHTML = estado.apostas.map((aposta, index) => {
        const dataInicial = parseLocalDate(aposta.dataInicial).toLocaleDateString('pt-BR');
        const dataFinal = parseLocalDate(aposta.dataFinal).toLocaleDateString('pt-BR');
        const totalDias = aposta.dias.length;
        const totalParticipantes = aposta.participantes.length;

        return `
            <div class="aposta-card" onclick="mostrarDetalhes(${aposta.id})" data-index="${index}" style="animation-delay: ${0.1 + index * 0.1}s">
                <div class="card-glow"></div>
                <div class="card-content">
                    <h3>Aposta #${aposta.id}</h3>
                    <div class="info"><strong>Período:</strong> ${dataInicial} a ${dataFinal}</div>
                    <div class="info"><strong>Participantes:</strong> ${totalParticipantes}</div>
                    <div class="info"><strong>Dias registrados:</strong> ${totalDias}</div>
                    <div class="info"><strong>Limite de faltas:</strong> ${aposta.limiteFaltas}</div>
                    <div class="info"><strong>Valor:</strong> R$ ${aposta.valorInscricao.toFixed(2)}</div>
                </div>
            </div>
        `;
    }).join('');

    container.innerHTML = heroSection + cardsHTML;
    
    // Animar contadores após renderizar
    setTimeout(() => {
        const counters = container.querySelectorAll('.hero-stat-number[data-count]');
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-count'));
            animateCounter(counter, target);
        });
    }, 500);
    
    // Adicionar efeitos de parallax nos cards
    setupCardParallax();
}

// Função para configurar efeitos de partículas na tela de detalhes
function setupDetalhesParticleEffects() {
    if (!perfConfig.enableCardParticles) return;
    
    const diasRegistrados = document.querySelectorAll('.dia-registrado');
    
    diasRegistrados.forEach(dia => {
        let particleCanvas = null;
        let particleCtx = null;
        let cardParticles = [];
        
        const createDiaParticleCanvas = () => {
            particleCanvas = document.createElement('canvas');
            particleCanvas.className = 'dia-particles';
            particleCanvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 0;
                opacity: 0;
                transition: opacity 0.3s;
            `;
            // Inserir canvas como primeiro filho para garantir que fique atrás do conteúdo
            if (dia.firstChild) {
                dia.insertBefore(particleCanvas, dia.firstChild);
            } else {
                dia.appendChild(particleCanvas);
            }
            particleCtx = particleCanvas.getContext('2d');
            particleCanvas.width = dia.offsetWidth;
            particleCanvas.height = dia.offsetHeight;
            
            const particleCount = perfConfig.isMobile ? 4 : 6;
            for (let i = 0; i < particleCount; i++) {
                cardParticles.push({
                    x: Math.random() * particleCanvas.width,
                    y: Math.random() * particleCanvas.height,
                    vx: (Math.random() - 0.5) * 1.5,
                    vy: (Math.random() - 0.5) * 1.5,
                    size: Math.random() * 1.5 + 0.5,
                    life: Math.random() * 80 + 40,
                    maxLife: Math.random() * 80 + 40
                });
            }
        };
        
        createDiaParticleCanvas();
        
        const animateDiaParticles = () => {
            if (!particleCtx || !particleCanvas) return;
            
            particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
            
            cardParticles.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                p.life--;
                
                if (p.life <= 0 || p.x < 0 || p.x > particleCanvas.width || p.y < 0 || p.y > particleCanvas.height) {
                    p.x = Math.random() * particleCanvas.width;
                    p.y = Math.random() * particleCanvas.height;
                    p.life = p.maxLife;
                }
                
                const alpha = p.life / p.maxLife;
                particleCtx.fillStyle = `rgba(255, 228, 0, ${alpha * 0.5})`;
                if (!perfConfig.isLowEnd) {
                    particleCtx.shadowBlur = 3;
                    particleCtx.shadowColor = '#FFE400';
                }
                particleCtx.beginPath();
                particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                particleCtx.fill();
                particleCtx.shadowBlur = 0;
            });
            
            if (particleCanvas.style.opacity === '1') {
                requestAnimationFrame(animateDiaParticles);
            }
        };
        
        dia.addEventListener('mouseenter', () => {
            if (particleCanvas) {
                particleCanvas.style.opacity = '1';
                animateDiaParticles();
            }
        });
        
        dia.addEventListener('mouseleave', () => {
            if (particleCanvas) {
                particleCanvas.style.opacity = '0';
            }
        });
        
        const resizeObserver = new ResizeObserver(() => {
            if (particleCanvas && dia.offsetWidth && dia.offsetHeight) {
                particleCanvas.width = dia.offsetWidth;
                particleCanvas.height = dia.offsetHeight;
            }
        });
        resizeObserver.observe(dia);
    });
}

// Função para configurar efeito parallax nos cards
function setupCardParallax() {
    const cards = document.querySelectorAll('.aposta-card');
    
    cards.forEach(card => {
        let particleCanvas = null;
        let particleCtx = null;
        let cardParticles = [];
        
        // Criar canvas de partículas para o card
        const createCardParticleCanvas = () => {
            particleCanvas = document.createElement('canvas');
            particleCanvas.className = 'card-particles';
            particleCanvas.style.cssText = `
                position: absolute;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                pointer-events: none;
                z-index: 1;
                opacity: 0;
                transition: opacity 0.3s;
            `;
            card.appendChild(particleCanvas);
            particleCtx = particleCanvas.getContext('2d');
            particleCanvas.width = card.offsetWidth;
            particleCanvas.height = card.offsetHeight;
            
            // Criar partículas do card (desabilitado em dispositivos fracos)
            if (!perfConfig.enableCardParticles) return;
            
            const cardParticleCount = perfConfig.isMobile ? 6 : 10;
            for (let i = 0; i < cardParticleCount; i++) {
                cardParticles.push({
                    x: Math.random() * particleCanvas.width,
                    y: Math.random() * particleCanvas.height,
                    vx: (Math.random() - 0.5) * 2,
                    vy: (Math.random() - 0.5) * 2,
                    size: Math.random() * 2 + 1,
                    life: Math.random() * 100 + 50,
                    maxLife: Math.random() * 100 + 50
                });
            }
        };
        
        createCardParticleCanvas();
        
        const animateCardParticles = () => {
            if (!particleCtx || !particleCanvas) return;
            
            particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
            
            cardParticles.forEach((p, i) => {
                p.x += p.vx;
                p.y += p.vy;
                p.life--;
                
                if (p.life <= 0 || p.x < 0 || p.x > particleCanvas.width || p.y < 0 || p.y > particleCanvas.height) {
                    p.x = Math.random() * particleCanvas.width;
                    p.y = Math.random() * particleCanvas.height;
                    p.life = p.maxLife;
                }
                
                const alpha = p.life / p.maxLife;
                particleCtx.fillStyle = `rgba(255, 228, 0, ${alpha * 0.6})`;
                particleCtx.shadowBlur = 5;
                particleCtx.shadowColor = '#FFE400';
                particleCtx.beginPath();
                particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
                particleCtx.fill();
                particleCtx.shadowBlur = 0;
            });
            
            if (particleCanvas.style.opacity === '1') {
                requestAnimationFrame(animateCardParticles);
            }
        };
        
        card.addEventListener('mousemove', (e) => {
            const rect = card.getBoundingClientRect();
            const x = e.clientX - rect.left;
            const y = e.clientY - rect.top;
            
            const centerX = rect.width / 2;
            const centerY = rect.height / 2;
            
            const rotateX = (y - centerY) / 10;
            const rotateY = (centerX - x) / 10;
            
            card.style.transform = `perspective(1000px) rotateX(${rotateX}deg) rotateY(${rotateY}deg) translateZ(10px)`;
            
            // Criar partículas no ponto do mouse (apenas se não for dispositivo fraco)
            if (interactiveParticles && !perfConfig.isLowEnd) {
                interactiveParticles.createMiniExplosion(e.clientX, e.clientY);
            }
        });
        
        card.addEventListener('mouseenter', () => {
            if (particleCanvas) {
                particleCanvas.style.opacity = '1';
                animateCardParticles();
            }
        });
        
        card.addEventListener('mouseleave', () => {
            card.style.transform = 'perspective(1000px) rotateX(0) rotateY(0) translateZ(0)';
            if (particleCanvas) {
                particleCanvas.style.opacity = '0';
            }
        });
        
        // Redimensionar canvas quando card redimensionar
        const resizeObserver = new ResizeObserver(() => {
            if (particleCanvas && card.offsetWidth && card.offsetHeight) {
                particleCanvas.width = card.offsetWidth;
                particleCanvas.height = card.offsetHeight;
            }
        });
        resizeObserver.observe(card);
    });
}

// Função auxiliar para calcular dias corridos entre duas datas
function calcularDiasCorridos(dataInicial, dataFinal) {
    const [anoInicio, mesInicio, diaInicio] = dataInicial.split('-').map(Number);
    const [anoFim, mesFim, diaFim] = dataFinal.split('-').map(Number);
    
    const inicio = new Date(anoInicio, mesInicio - 1, diaInicio);
    const fim = new Date(anoFim, mesFim - 1, diaFim);
    
    // Calcular diferença em milissegundos e converter para dias
    const diffTime = fim - inicio;
    const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));
    
    // Adicionar 1 para incluir ambos os dias (inicial e final)
    return diffDays + 1;
}

async function criarAposta() {
    const dataInicial = document.getElementById('dataInicial').value;
    const dataFinal = document.getElementById('dataFinal').value;
    const limiteFaltas = parseInt(document.getElementById('limiteFaltas').value);
    const valorInscricao = document.getElementById('valorInscricao').value;
    const participantesText = document.getElementById('participantes').value;
    
    // Validação 1: Data inicial não pode ser anterior à data atual (pode ser o mesmo dia)
    const hoje = new Date();
    hoje.setHours(0, 0, 0, 0);
    const dataInicialDate = new Date(dataInicial + 'T00:00:00');
    dataInicialDate.setHours(0, 0, 0, 0);
    
    if (dataInicialDate < hoje) {
        const hojeFormatado = hoje.toLocaleDateString('pt-BR');
        notifications.error(`A data inicial não pode ser anterior à data atual (${hojeFormatado}).`);
        return;
    }

    // Validação 2: Data inicial deve ser anterior à data final
    if (dataInicial >= dataFinal) {
        notifications.error('A data inicial deve ser anterior à data final. As datas não podem ser iguais.');
        return;
    }

    // Validação 3: Calcular dias corridos e validar limite de faltas
    const diasCorridos = calcularDiasCorridos(dataInicial, dataFinal);
    if (limiteFaltas > diasCorridos) {
        notifications.error(`O limite de faltas (${limiteFaltas}) não pode ser maior que a quantidade de dias corridos da aposta (${diasCorridos} dias).`);
        return;
    }
    
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
            // Usar router para navegar com os dados da aposta já carregados
            // Isso evita race condition ao buscar a aposta recém-criada
            router.navegarParaDetalhesComDados(aposta.id, aposta);
        } else {
            // Tentar obter mensagem de erro personalizada do servidor
            const errorData = await response.json().catch(() => ({}));
            
            if (errorData.error && errorData.message) {
                notifications.error(errorData.message);
            } else {
                notifications.error('Erro ao criar aposta. Verifique os dados e tente novamente.');
            }
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

    // Hero Section para detalhes
    const heroSection = `
        <div class="detalhes-hero-section">
            <div class="detalhes-hero-content">
                <div class="detalhes-hero-left">
                    <h1 class="detalhes-hero-title">Aposta #${aposta.id}</h1>
                    <p class="detalhes-hero-subtitle">${dataInicial} até ${dataFinal}</p>
                </div>
                <div class="detalhes-hero-stats">
                    <div class="detalhes-hero-stat">
                        <span class="detalhes-hero-stat-number" data-count="${aposta.participantes.length}">0</span>
                        <span class="detalhes-hero-stat-label">Participantes</span>
                    </div>
                    <div class="detalhes-hero-stat">
                        <span class="detalhes-hero-stat-number" data-count="${aposta.dias.length}">0</span>
                        <span class="detalhes-hero-stat-label">Dias Registrados</span>
                    </div>
                    <div class="detalhes-hero-stat">
                        <span class="detalhes-hero-stat-number">R$ ${aposta.valorInscricao.toFixed(2)}</span>
                        <span class="detalhes-hero-stat-label">Valor da Aposta</span>
                    </div>
                </div>
            </div>
        </div>
    `;

    container.innerHTML = heroSection + `
        <div class="detalhes-info">
            <div class="detalhes-info-item detalhes-info-animated" style="animation-delay: 0.1s">
                <strong>Data Inicial</strong>
                ${dataInicial}
            </div>
            <div class="detalhes-info-item detalhes-info-animated" style="animation-delay: 0.2s">
                <strong>Data Final</strong>
                ${dataFinal}
            </div>
            <div class="detalhes-info-item detalhes-info-animated" style="animation-delay: 0.3s">
                <strong>Limite de Faltas</strong>
                ${aposta.limiteFaltas}
            </div>
            <div class="detalhes-info-item detalhes-info-animated" style="animation-delay: 0.4s">
                <strong>Valor da Inscrição</strong>
                R$ ${aposta.valorInscricao.toFixed(2)}
            </div>
        </div>

        <div class="participantes-section">
            <h3>Participantes (${aposta.participantes.length})</h3>
            <div class="participantes-list">
                ${aposta.participantes.map((p, index) => `
                    <span class="participante-tag participante-tag-animated" style="animation-delay: ${0.1 + index * 0.05}s">
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
            <div class="dias-registrados-header">
                <h3>Dias Registrados (${aposta.dias.length})</h3>
                ${aposta.dias.length > 2 ? `
                    <button class="btn btn-toggle-dias" id="btn-ver-mais-dias" onclick="toggleVerMaisDias()">
                        Ver todos os dias (${aposta.dias.length - 2} ocultos)
                    </button>
                ` : ''}
            </div>
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
                        <div class="dia-registrado ${classeOculto} dia-registrado-animated" id="${diaId}" data-dia-index="${diaIndexOriginal}" style="animation-delay: ${0.1 + diaIndex * 0.1}s">
                            <div class="dia-registrado-glow"></div>
                            <div class="dia-registrado-content">
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
                                            <span class="status-badge ${presente ? 'status-presente' : 'status-falta'} status-badge-animated">
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
                        </div>
                    `;
                }).join('');
            })()}
            </div>
        </div>

        <button class="btn btn-gerar-imagem" onclick="gerarImagemTabela()">📊 Gerar Imagem da Tabela</button>
        
        <div id="tabelaImagem" class="tabela-container"></div>
    `;
    
    // Animar contadores após renderizar
    setTimeout(() => {
        const counters = container.querySelectorAll('.detalhes-hero-stat-number[data-count]');
        counters.forEach(counter => {
            const target = parseInt(counter.getAttribute('data-count'));
            animateCounter(counter, target);
        });
    }, 500);
    
    // Adicionar efeitos de partículas nos cards de dias
    setupDetalhesParticleEffects();
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

// Função auxiliar para gerar todas as datas entre duas datas
function gerarTodasDatasPeriodo(dataInicial, dataFinal) {
    const datas = [];
    const [anoInicio, mesInicio, diaInicio] = dataInicial.split('-').map(Number);
    const [anoFim, mesFim, diaFim] = dataFinal.split('-').map(Number);
    
    const inicio = new Date(anoInicio, mesInicio - 1, diaInicio);
    const fim = new Date(anoFim, mesFim - 1, diaFim);
    
    const dataAtual = new Date(inicio);
    while (dataAtual <= fim) {
        const ano = dataAtual.getFullYear();
        const mes = String(dataAtual.getMonth() + 1).padStart(2, '0');
        const dia = String(dataAtual.getDate()).padStart(2, '0');
        datas.push(`${ano}-${mes}-${dia}`);
        dataAtual.setDate(dataAtual.getDate() + 1);
    }
    
    return datas;
}

function gerarImagemTabela() {
    const aposta = estado.apostaAtual;
    
    // Gerar todas as datas do período
    const todasDatas = gerarTodasDatasPeriodo(aposta.dataInicial, aposta.dataFinal);
    
    // Criar um mapa de dias registrados para acesso rápido
    const diasRegistradosMap = {};
    aposta.dias.forEach(dia => {
        diasRegistradosMap[dia.data] = dia;
    });
    
    // Calcular faltas por participante (apenas nos dias registrados)
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
    
    // Calcular número total de dias do período (não apenas os registrados)
    const totalDias = todasDatas.length;
    
    // Formatar datas
    const dataInicialFormatada = parseLocalDate(aposta.dataInicial).toLocaleDateString('pt-BR');
    const dataFinalFormatada = parseLocalDate(aposta.dataFinal).toLocaleDateString('pt-BR');
    
    // Criar HTML completo com cabeçalho, tabela invertida e resumo
    // Remover classes de animação para garantir renderização correta no html2canvas
    let htmlCompleto = `
        <div id="tabelaParaImagem" class="tabela-visualizacao" style="opacity: 1; visibility: visible;">
            <div class="tabela-cabecalho">
                <h1 class="tabela-titulo">Aposta #${aposta.id}: ${totalDias} dias</h1>
                <p class="tabela-subtitulo">De ${dataInicialFormatada} até ${dataFinalFormatada}</p>
                <p class="tabela-subtitulo">Limite de ${aposta.limiteFaltas} faltas</p>
            </div>
            
            <div class="tabela-wrapper">
                <table class="tabela-invertida">
                    <thead>
                        <tr>
                            <th>Data</th>
                            ${aposta.participantes.map(p => `<th>${p}</th>`).join('')}
                        </tr>
                    </thead>
                    <tbody>
    `;

    // Linhas: cada dia do período é uma linha
    todasDatas.forEach((dataStr, diaIndex) => {
        const dataFormatada = parseLocalDate(dataStr).toLocaleDateString('pt-BR');
        const diaRegistrado = diasRegistradosMap[dataStr];
        
        htmlCompleto += '<tr>';
        htmlCompleto += `<td class="tabela-data-cell"><strong>${dataFormatada}</strong></td>`;
        
        aposta.participantes.forEach(participante => {
            // Se o dia foi registrado, verificar se o participante estava presente
            // Se não foi registrado, mostrar como não registrado (dash)
            if (diaRegistrado) {
                const presente = diaRegistrado.participantes[participante];
                htmlCompleto += `<td class="check ${presente ? 'presente' : 'falta'}">${presente ? '✓' : '✗'}</td>`;
            } else {
                htmlCompleto += `<td class="check nao-registrado">—</td>`;
            }
        });
        
        htmlCompleto += '</tr>';
    });

    htmlCompleto += `
                    </tbody>
                </table>
            </div>
            
            <div class="tabela-resumo">
                <h3 class="tabela-resumo-titulo">Resumo de Faltas</h3>
                <div class="resumo-lista">
    `;

    aposta.participantes.forEach((participante) => {
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

    // Forçar renderização completa antes de capturar
    const elemento = document.getElementById('tabelaParaImagem');
    if (elemento) {
        // Forçar layout recalculation
        void elemento.offsetHeight;
    }

    // Usar html2canvas para gerar imagem
    if (typeof html2canvas !== 'undefined') {
        // Aguardar renderização completa
        setTimeout(() => {
            // Mostrar loading com efeito visual
            const btnGerar = document.querySelector('.btn-gerar-imagem');
            if (btnGerar) {
                btnGerar.disabled = true;
                btnGerar.textContent = '⏳ Gerando imagem...';
                btnGerar.classList.add('btn-gerando');
            }
            
            // Adicionar overlay de loading na tabela
            const loadingOverlay = document.createElement('div');
            loadingOverlay.className = 'tabela-loading-overlay';
            loadingOverlay.innerHTML = `
                <div class="tabela-loading-content">
                    <div class="tabela-loading-spinner"></div>
                    <p>Gerando imagem...</p>
                </div>
            `;
            container.appendChild(loadingOverlay);
            
            // Aguardar um frame para garantir que o overlay foi renderizado
            requestAnimationFrame(() => {
                html2canvas(elemento, {
                    backgroundColor: '#ffffff',
                    scale: 2,
                    useCORS: true,
                    logging: false,
                    allowTaint: false,
                    removeContainer: false,
                    windowWidth: elemento.scrollWidth,
                    windowHeight: elemento.scrollHeight
                }).then(canvas => {
                    const link = document.createElement('a');
                    link.download = `aposta-${aposta.id}-tabela.png`;
                    link.href = canvas.toDataURL('image/png');
                    link.click();
                    
                    // Remover overlay
                    if (loadingOverlay.parentNode) {
                        loadingOverlay.parentNode.removeChild(loadingOverlay);
                    }
                    
                    // Restaurar botão
                    if (btnGerar) {
                        btnGerar.disabled = false;
                        btnGerar.textContent = '📊 Gerar Imagem da Tabela';
                        btnGerar.classList.remove('btn-gerando');
                    }
                    
                    notifications.success('Imagem gerada com sucesso!');
                }).catch(error => {
                    console.error('Erro ao gerar imagem:', error);
                    notifications.error('Erro ao gerar imagem. Tente novamente.');
                    
                    // Remover overlay
                    if (loadingOverlay.parentNode) {
                        loadingOverlay.parentNode.removeChild(loadingOverlay);
                    }
                    
                    // Restaurar botão
                    if (btnGerar) {
                        btnGerar.disabled = false;
                        btnGerar.textContent = '📊 Gerar Imagem da Tabela';
                        btnGerar.classList.remove('btn-gerando');
                    }
                });
            });
        }, 500); // Reduzir tempo de espera
    } else {
        notifications.error('Biblioteca de geração de imagem não carregada. Recarregue a página.');
    }
}

// Função para configurar efeitos de partículas na tabela
function setupTabelaParticleEffects() {
    if (!perfConfig.enableCardParticles) return;
    
    const tabelaContainer = document.getElementById('tabelaImagem');
    if (!tabelaContainer) return;
    
    const tabelaWrapper = tabelaContainer.querySelector('.tabela-wrapper');
    if (!tabelaWrapper) return;
    
    let particleCanvas = null;
    let particleCtx = null;
    let particles = [];
    
    const createTabelaParticleCanvas = () => {
        particleCanvas = document.createElement('canvas');
        particleCanvas.className = 'tabela-particles';
        particleCanvas.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            pointer-events: none;
            z-index: 1;
            opacity: 0.3;
        `;
        tabelaWrapper.style.position = 'relative';
        tabelaWrapper.appendChild(particleCanvas);
        particleCtx = particleCanvas.getContext('2d');
        particleCanvas.width = tabelaWrapper.offsetWidth;
        particleCanvas.height = tabelaWrapper.offsetHeight;
        
        const particleCount = perfConfig.isMobile ? 8 : 15;
        for (let i = 0; i < particleCount; i++) {
            particles.push({
                x: Math.random() * particleCanvas.width,
                y: Math.random() * particleCanvas.height,
                vx: (Math.random() - 0.5) * 0.5,
                vy: (Math.random() - 0.5) * 0.5,
                size: Math.random() * 1.5 + 0.5,
                life: Math.random() * 200 + 100,
                maxLife: Math.random() * 200 + 100
            });
        }
    };
    
    createTabelaParticleCanvas();
    
    const animateTabelaParticles = () => {
        if (!particleCtx || !particleCanvas) return;
        
        particleCtx.clearRect(0, 0, particleCanvas.width, particleCanvas.height);
        
        particles.forEach((p, i) => {
            p.x += p.vx;
            p.y += p.vy;
            p.life--;
            
            if (p.life <= 0 || p.x < 0 || p.x > particleCanvas.width || p.y < 0 || p.y > particleCanvas.height) {
                p.x = Math.random() * particleCanvas.width;
                p.y = Math.random() * particleCanvas.height;
                p.life = p.maxLife;
            }
            
            const alpha = p.life / p.maxLife;
            particleCtx.fillStyle = `rgba(255, 228, 0, ${alpha * 0.4})`;
            particleCtx.beginPath();
            particleCtx.arc(p.x, p.y, p.size, 0, Math.PI * 2);
            particleCtx.fill();
        });
        
        requestAnimationFrame(animateTabelaParticles);
    };
    
    animateTabelaParticles();
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
