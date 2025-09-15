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
        this.settings = {};
        this.width = 0;
        this.height = 0;
        
        this._resizeCanvas();
    }

    show(mode = 'rain', options = {}) {
        if (!this.isValid) return;
        this.stop();

        this.settings = {
            intensity: options.intensity || 200,
            speed: options.speed || 5,
            wind: options.wind || 0,
            mixRatio: options.mixRatio || 50,
            maxParticles: 500,
            weatherMode: mode,
        };

        this.isActive = true;
        this._resizeCanvas();
        this._initParticles();
        this._animate();
    }

    stop() {
        if (!this.isActive) return;
        this.isActive = false;
        cancelAnimationFrame(this.animationId);
        this.animationId = null;
        this.particles = [];
        if (this.ctx) {
            this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height);
        }
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
            let type = this.settings.weatherMode === 'mixed' ? (Math.random() * 100 < this.settings.mixRatio ? 'rain' : 'snow') : this.settings.weatherMode;
            this.particles.push(new this.WeatherParticle(this, type));
        }
    }
    _drawWeather() {
        this.ctx.clearRect(0, 0, this.width, this.height);
        for (const particle of this.particles) {
            if (particle.type === 'rain') {
                this.ctx.strokeStyle = `rgba(174, 194, 224, ${particle.opacity})`; this.ctx.lineWidth = particle.size; this.ctx.lineCap = 'round';
                this.ctx.beginPath(); this.ctx.moveTo(particle.x, particle.y); this.ctx.lineTo(particle.x + this.settings.wind * 2, particle.y + particle.length); this.ctx.stroke();
            } else {
                this.ctx.fillStyle = `rgba(255, 255, 255, ${particle.opacity})`; this.ctx.beginPath(); this.ctx.arc(particle.x, particle.y, particle.size, 0, Math.PI * 2); this.ctx.fill();
            }
        }
    }
    _animate() {
        if (!this.isActive) return;
        for (const particle of this.particles) particle.update();
        const targetCount = Math.min(this.settings.intensity, this.settings.maxParticles);
        while (this.particles.length < targetCount) {
            let type = this.settings.weatherMode === 'mixed' ? (Math.random() * 100 < this.settings.mixRatio ? 'rain' : 'snow') : this.settings.weatherMode;
            this.particles.push(new this.WeatherParticle(this, type));
        }
        if (this.particles.length > targetCount) this.particles.splice(targetCount);
        this._drawWeather();
        this.animationId = requestAnimationFrame(this._animate.bind(this));
    }
    WeatherParticle = class {
        constructor(weather, type) { this.weather = weather; this.type = type; this.reset(); }
        reset() {
            const { wind } = this.weather.settings, { width, height } = this.weather;
            if (Math.abs(wind) < 2) { this.x = Math.random()*(width+200)-100; this.y = -Math.random()*200-50; }
            else { if(Math.random()<.5){ this.x = wind>0?-Math.random()*300-100:width+Math.random()*300+100; this.y = Math.random()*height; } else { this.x = Math.random()*(width+400)-200; this.y = -Math.random()*300-50; } }
            if(this.type==='rain'){ this.speed = Math.random()*2+this.weather.settings.speed; this.length=Math.random()*15+10; this.opacity=Math.random()*.3+.1; this.size=1; }
            else { this.speed = Math.random()*1+this.weather.settings.speed*.3; this.size=Math.random()*4+2; this.opacity=Math.random()*.6+.2; this.swaySpeed=Math.random()*.02+.01; this.swayAmount=Math.random()*.5+.2; this.angle=0; }
        }
        update() {
            const { wind } = this.weather.settings, { width, height } = this.weather;
            if(this.type==='rain'){ this.y+=this.speed; this.x+=wind; }
            else{ this.y+=this.speed; this.x+=wind*.3; this.angle+=this.swaySpeed; this.x+=Math.sin(this.angle)*this.swayAmount; }
            if(this.y>height+100||this.x<-500||this.x>width+500) this.reset();
        }
    }
}