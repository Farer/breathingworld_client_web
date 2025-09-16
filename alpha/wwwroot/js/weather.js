class WeatherEffect {
    constructor(canvasId) {
        this.canvas = document.getElementById(canvasId);

        if (!this.canvas || this.canvas.tagName !== 'CANVAS') {
            console.error(`WeatherEffect: ID '${canvasId}' is not a valid canvas element.`);
            this.isValid = false;
            return;
        }
        this.isValid = true;
        this.ctx = this.canvas.getContext('2d');
        
        this.particles = [];
        this.animationId = null;
        this.isActive = false;
        this.isStopping = false;
        this.settings = {};
        this.width = 0;
        this.height = 0;
        
        this._resizeCanvas();
    }

    show(mode = 'rain', options = {}) {
        if (!this.isValid) return;
        
        const prevSettings = { ...this.settings };
        
        this.settings = {
            intensity: options.intensity || 200,
            speed: options.speed || 5,
            wind: options.wind || 0,
            mixRatio: options.mixRatio || 50,
            maxParticles: 500,
            weatherMode: mode,
            minRainSpeed: options.minRainSpeed || 3,
        };
        
        if (this.isActive && !this.isStopping) {
            this._transitionParticles(prevSettings);
        } else {
            this.isActive = true;
            this.isStopping = false;
            this._resizeCanvas();
            
            if (this.particles.length === 0) {
                this._initParticles();
            }
            
            if (!this.animationId) {
                this._animate();
            }
        }
    }

    stop() {
        if (!this.isActive || this.isStopping) return;
        this.isStopping = true;
    }
    
    _resizeCanvas() {
        this.width = this.canvas.clientWidth;
        this.height = this.canvas.clientHeight;
        const dpr = Math.min(window.devicePixelRatio || 1, 2);
        this.canvas.width = this.width * dpr;
        this.canvas.height = this.height * dpr;
        this.ctx.scale(dpr, dpr);
    }

    _initParticles() {
        this.particles = [];
        const particleCount = Math.min(this.settings.intensity, this.settings.maxParticles);
        
        // 초기 생성 시 화면 전체에 분포시키되, 바람이 있으면 점진적으로 이동
        const windStrength = Math.abs(this.settings.wind || 0);
        
        for (let i = 0; i < particleCount; i++) {
            let type = this._determineParticleType();
            const particle = new this.WeatherParticle(this, type);
            
            // 바람이 강할 때는 처음부터 화면 밖에서 시작
            if (windStrength >= 0.5) {
                // reset()이 이미 올바른 위치를 설정함
            } else {
                // 바람이 약하거나 없을 때만 화면 내 분포 (초기 로딩 시각 효과)
                particle.y = Math.random() * this.height;
            }
            
            this.particles.push(particle);
        }
    }
    
    _transitionParticles(prevSettings) {
        const targetCount = Math.min(this.settings.intensity, this.settings.maxParticles);
        
        if (this.particles.length > targetCount) {
            this.particles = this.particles.filter((p, idx) => {
                if (idx >= targetCount) {
                    return p.y <= this.height + 100 && p.x >= -500 && p.x <= this.width + 500;
                }
                return true;
            });
        }
    }
    
    _determineParticleType() {
        if (this.settings.weatherMode === 'mixed') {
            return Math.random() * 100 < this.settings.mixRatio ? 'rain' : 'snow';
        }
        return this.settings.weatherMode;
    }

    _drawWeather() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        
        for (const particle of this.particles) {
            // 값 검증: NaN이나 Infinity 체크
            if (!isFinite(particle.x) || !isFinite(particle.y) || 
                !isFinite(particle.windEffect) || !isFinite(particle.length) ||
                !isFinite(particle.size) || !isFinite(particle.opacity)) {
                continue;
            }
            
            if (particle.type === 'rain') {
                const gradient = this.ctx.createLinearGradient(
                    particle.x, particle.y, 
                    particle.x + particle.windEffect * 2, particle.y + particle.length
                );
                gradient.addColorStop(0, `rgba(200, 220, 255, ${particle.opacity * 0.3})`);
                gradient.addColorStop(0.5, `rgba(174, 194, 224, ${particle.opacity})`);
                gradient.addColorStop(1, `rgba(120, 150, 200, ${particle.opacity * 0.7})`);
                
                this.ctx.strokeStyle = gradient;
                this.ctx.lineWidth = particle.size;
                this.ctx.lineCap = 'round';
                this.ctx.beginPath();
                this.ctx.moveTo(particle.x, particle.y);
                this.ctx.lineTo(particle.x + particle.windEffect * 2, particle.y + particle.length);
                this.ctx.stroke();

                if (particle.opacity > 0.4) {
                    this.ctx.strokeStyle = `rgba(255, 255, 255, ${particle.opacity * 0.3})`;
                    this.ctx.lineWidth = particle.size + 0.5;
                    this.ctx.beginPath();
                    this.ctx.moveTo(particle.x, particle.y);
                    this.ctx.lineTo(particle.x + particle.windEffect * 2, particle.y + particle.length);
                    this.ctx.stroke();
                    
                    this.ctx.strokeStyle = gradient;
                    this.ctx.lineWidth = particle.size;
                    this.ctx.beginPath();
                    this.ctx.moveTo(particle.x, particle.y);
                    this.ctx.lineTo(particle.x + particle.windEffect * 2, particle.y + particle.length);
                    this.ctx.stroke();
                }
            } else {
                this.ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`;
                this.ctx.beginPath();
                this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2);
                this.ctx.fill();
            }
        }
    }

    _animate() {
        if (!this.isActive) return;
        
        for (let i = this.particles.length - 1; i >= 0; i--) {
            const particle = this.particles[i];
            particle.update();
            
            if (particle.isOutOfBounds()) {
                if (this.isStopping) {
                    this.particles.splice(i, 1);
                } else {
                    particle.type = this._determineParticleType();
                    particle.reset();
                }
            }
        }
        
        if (!this.isStopping) {
            const targetCount = Math.min(this.settings.intensity, this.settings.maxParticles);
            while (this.particles.length < targetCount) {
                const type = this._determineParticleType();
                this.particles.push(new this.WeatherParticle(this, type));
            }
        }
        
        if (this.isStopping && this.particles.length === 0) {
            this.isActive = false;
            this.isStopping = false;
            cancelAnimationFrame(this.animationId);
            this.animationId = null;
            this.ctx.clearRect(0, 0, this.width, this.height);
            return;
        }
        
        this._drawWeather();
        this.animationId = requestAnimationFrame(this._animate.bind(this));
    }

    WeatherParticle = class {
        constructor(weather, type) { 
            this.weather = weather; 
            this.type = type;
            this.windEffect = 0;
            this.speedMultiplier = 1;
            this.x = 0;
            this.y = 0;
            this.speed = 0;
            this.size = 1;
            this.opacity = 1;
            this.length = 10;
            this.reset(); 
        }
        
        reset() {
            const { wind, minRainSpeed } = this.weather.settings;
            const { width, height } = this.weather;
            
            // 바람 효과를 안전하게 설정
            this.windEffect = isFinite(wind) ? wind : 0;
            
            // 현재 설정된 바람값을 기준으로 생성 위치 결정
            const currentWind = isFinite(wind) ? wind : 0;
            const windStrength = Math.abs(currentWind);
            
            if (windStrength < 0.5) { 
                // 바람이 거의 없을 때: 위쪽에서만 생성
                this.x = Math.random() * (width + 200) - 100; 
                this.y = -(Math.random() * 200 + 50); // 항상 음수 보장
            } else { 
                // 바람이 있을 때: 반드시 화면 바깥쪽에서만 생성
                if (currentWind > 0) {
                    // 오른쪽으로 바람이 불 때: 반드시 왼쪽 바깥에서만 생성
                    // X는 반드시 음수여야 함
                    this.x = -(Math.random() * 300 + 200); // -200 ~ -500 사이의 음수값
                    // Y는 화면 위부터 아래까지
                    this.y = Math.random() * (height + 400) - 200;
                } else if (currentWind < 0) {
                    // 왼쪽으로 바람이 불 때: 반드시 오른쪽 바깥에서만 생성
                    // X는 반드시 화면 너비보다 커야 함
                    this.x = width + (Math.random() * 300 + 200); // width + 200 ~ width + 500
                    // Y는 화면 위부터 아래까지
                    this.y = Math.random() * (height + 400) - 200;
                }
                
                // 디버깅: 화면 안쪽에서 생성되는 경우 경고
                if (currentWind > 0 && this.x >= 0) {
                    console.warn(`Wrong X position for right wind: x=${this.x}, should be negative`);
                    this.x = -(Math.random() * 300 + 200); // 강제로 음수로 재설정
                }
                if (currentWind < 0 && this.x <= width) {
                    console.warn(`Wrong X position for left wind: x=${this.x}, should be > ${width}`);
                    this.x = width + (Math.random() * 300 + 200); // 강제로 화면 오른쪽 밖으로 재설정
                }
            }
            
            if (this.type === 'rain') { 
                // 비의 속도 계산 시 최소 속도 보장
                const baseSpeed = Math.random() * 2 + this.weather.settings.speed;
                this.speed = Math.max(baseSpeed, minRainSpeed || 3);
                this.length = Math.random() * 15 + 10; 
                this.opacity = Math.random() * 0.5 + 0.3;
                this.size = Math.random() * 0.5 + 1;
            } else { 
                this.speed = Math.random() * 1 + this.weather.settings.speed * 0.3; 
                this.size = Math.random() * 4 + 2; 
                this.opacity = Math.random() * 0.6 + 0.2; 
                this.swaySpeed = Math.random() * 0.02 + 0.01; 
                this.swayAmount = Math.random() * 0.5 + 0.2; 
                this.angle = 0; 
            }
            
            // 모든 값이 유효한지 확인
            this.x = isFinite(this.x) ? this.x : 0;
            this.y = isFinite(this.y) ? this.y : 0;
            this.speed = isFinite(this.speed) ? this.speed : 1;
            this.size = isFinite(this.size) ? this.size : 1;
            this.opacity = isFinite(this.opacity) ? this.opacity : 0.5;
            if (this.type === 'rain') {
                this.length = isFinite(this.length) ? this.length : 10;
            }
        }
        
        update() {
            const { width, height } = this.weather;
            
            // 바람 효과를 실시간으로 업데이트 (안전하게)
            const targetWind = this.weather.settings.wind;
            if (isFinite(targetWind)) {
                this.windEffect += (targetWind - this.windEffect) * 0.1;
            }
            
            if (this.type === 'rain') { 
                this.y += this.speed * this.speedMultiplier; 
                this.x += this.windEffect; 
            } else { 
                this.y += this.speed * this.speedMultiplier; 
                this.x += this.windEffect * 0.3; 
                this.angle += this.swaySpeed; 
                this.x += Math.sin(this.angle) * this.swayAmount; 
            }
            
            // 값이 비정상이 되면 안전한 값으로 되돌림
            if (!isFinite(this.x)) this.x = Math.random() * width;
            if (!isFinite(this.y)) this.y = -100;
            if (!isFinite(this.windEffect)) this.windEffect = 0;
        }
        
        isOutOfBounds() {
            const { width, height } = this.weather;
            // 바람 방향에 따라 경계 조건 조정
            const windDir = this.weather.settings.wind || 0;
            const leftBound = windDir > 0 ? -600 : -200; // 오른쪽 바람일 때 왼쪽 경계를 더 넓게
            const rightBound = windDir < 0 ? width + 600 : width + 200; // 왼쪽 바람일 때 오른쪽 경계를 더 넓게
            
            return this.y > height + 100 || this.x < leftBound || this.x > rightBound;
        }
    }
}