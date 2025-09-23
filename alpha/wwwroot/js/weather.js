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
            wind: parseFloat(options.wind) || 0,
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
        
        for (let i = 0; i < particleCount; i++) {
            let type = this._determineParticleType();
            const particle = new this.WeatherParticle(this, type);
            
            if (Math.abs(this.settings.wind || 0) < 0.5) {
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
                    return p.y <= this.height + 100 && p.x >= -1000 && p.x <= this.width + 1000;
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
            if (!isFinite(particle.x) || !isFinite(particle.y) || 
                (particle.type === 'rain' && !isFinite(particle.length)) ||
                !isFinite(particle.size) || !isFinite(particle.opacity)) {
                continue;
            }
            
            const windEffect = this.settings.wind || 0;

            if (particle.type === 'rain') {
                const gradient = this.ctx.createLinearGradient(
                    particle.x, particle.y, 
                    particle.x + windEffect * 2, particle.y + particle.length
                );
                gradient.addColorStop(0, `rgba(180, 200, 255, ${particle.opacity})`);
                gradient.addColorStop(1, `rgba(100, 130, 200, ${particle.opacity * 0.9})`);
                
                this.ctx.strokeStyle = gradient;
                this.ctx.lineWidth = particle.size;
                this.ctx.lineCap = 'round';
                this.ctx.beginPath();
                this.ctx.moveTo(particle.x, particle.y);
                this.ctx.lineTo(particle.x + windEffect * 2, particle.y + particle.length);
                this.ctx.stroke();
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
            
            const totalLength = width + height;
            const topCreationRatio = width / totalLength;
            const offscreenBuffer = 200;

            if (wind > 0) {
                if (Math.random() < topCreationRatio) {
                    this.y = -(Math.random() * offscreenBuffer + 50);
                    this.x = Math.random() * width;
                } else {
                    this.x = -(Math.random() * offscreenBuffer + 50);
                    this.y = Math.random() * height;
                }
            } else if (wind < 0) {
                if (Math.random() < topCreationRatio) {
                    this.y = -(Math.random() * offscreenBuffer + 50);
                    this.x = Math.random() * width;
                } else {
                    this.x = width + (Math.random() * offscreenBuffer + 50);
                    this.y = Math.random() * height;
                }
            } else {
                this.y = -(Math.random() * offscreenBuffer + 50);
                this.x = Math.random() * (width + 200) - 100;
            }
            
            if (this.type === 'rain') { 
                const baseSpeed = Math.random() * 2 + this.weather.settings.speed;
                this.speed = Math.max(baseSpeed, minRainSpeed || 3);
                this.length = Math.random() * 20 + 15;
                this.opacity = Math.random() * 0.3 + 0.7;
                this.size = Math.random() * 0.7 + 1.3;
            } else { 
                this.speed = Math.random() * 1 + this.weather.settings.speed * 0.3; 
                this.size = Math.random() * 4 + 2; 
                this.opacity = Math.random() * 0.6 + 0.2; 
                this.swaySpeed = Math.random() * 0.02 + 0.01; 
                this.swayAmount = Math.random() * 0.5 + 0.2; 
                this.angle = 0; 
            }
            
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
            const { width } = this.weather;
            
            const currentWind = this.weather.settings.wind || 0;
            
            if (this.type === 'rain') { 
                this.y += this.speed * this.speedMultiplier; 
                this.x += currentWind; 
            } else { 
                this.y += this.speed * this.speedMultiplier; 
                this.x += currentWind * 0.3; 
                this.angle += this.swaySpeed; 
                this.x += Math.sin(this.angle) * this.swayAmount; 
            }
            
            if (!isFinite(this.x)) this.x = Math.random() * width;
            if (!isFinite(this.y)) this.y = -100;
        }
        
        isOutOfBounds() {
            const { width, height } = this.weather;
            const buffer = 300;
            
            return this.y > height + buffer || this.x < -buffer || this.x > width + buffer;
        }
    }
}
