class EarthWorm {
    constructor(id, canvas, options = {}) {
        this.id = id;
        this.canvas = canvas;
        this.x = options.x ?? Math.random() * this.canvas.width;
        this.y = options.y ?? Math.random() * this.canvas.height;
        this.scale = options.scale ?? 0.3;
        this.segments = options.segments ?? 18;
        this.visibleSegments = (options.startVisible ?? true) ? this.segments : 0;
        this.segmentLength = options.segmentLength ?? 1;
        this.amplitude = (4 + Math.random() * 4) * this.scale;
        this.moveSpeed = (1.0 + Math.random() * 0.8) * this.scale;
        this.baseLineWidth = 4;
        this.angle = Math.random() * Math.PI * 2;
        this.animSpeed = 0.05 + Math.random() * 0.05;
        this.turnSpeed = 0.02;
        this.target = { x: null, y: null };
        this.time = Math.random() * 100;
        this.frequency = 0.3 + Math.random() * 0.3;
        this.targetFrequency = this.frequency;
        this.targetAmplitude = this.amplitude;
        this.frequencyChangeTimer = 2000 + Math.random() * 3000;
        this.state = 'IDLE';
        this.ROTATION_THRESHOLD = 0.05;
        this.digSpeed = 0.15;
        this.onComplete = null;
        if (this.visibleSegments === 0) { this.state = 'EMERGING'; }
    }
    kill() { this.state = 'DEAD'; this.target.x = null; this.target.y = null; }
    startEmerging(onComplete) { this.state = 'EMERGING'; this.visibleSegments = 0; if (onComplete) this.onComplete = onComplete; }
    startBurrowing(onComplete) { this.state = 'BURROWING'; if (onComplete) this.onComplete = onComplete; }
    setTarget(x, y) { if (this.state === 'BURROWING' || this.state === 'EMERGING' || this.state === 'DEAD') return; this.target.x = x; this.target.y = y; this.state = 'ROTATING'; }
    update(deltaTime) { if (this.state === 'DEAD') return; this.time += this.animSpeed; this.frequencyChangeTimer -= deltaTime; if (this.frequencyChangeTimer <= 0) { this.targetFrequency = (0.2 + Math.random() * 0.4); this.targetAmplitude = (3 + Math.random() * 5) * this.scale; this.frequencyChangeTimer = 2000 + Math.random() * 3000; } this.frequency += (this.targetFrequency - this.frequency) * 0.05; this.amplitude += (this.targetAmplitude - this.amplitude) * 0.05; if (this.state === 'EMERGING') { this.visibleSegments += this.digSpeed; if (this.visibleSegments >= this.segments) { this.visibleSegments = this.segments; this.state = 'IDLE'; if (this.onComplete) { this.onComplete(this.id); this.onComplete = null; } } return; } if (this.state === 'BURROWING') { this.visibleSegments -= this.digSpeed; if (this.visibleSegments <= 0) { this.visibleSegments = 0; if (this.onComplete) { this.onComplete(this.id); this.onComplete = null; } } return; } if (this.target.x !== null) { const dx = this.target.x - this.x; const dy = this.target.y - this.y; const targetAngle = Math.atan2(dy, dx); switch (this.state) { case 'ROTATING': let angleDiff = targetAngle - this.angle; while (angleDiff > Math.PI) angleDiff -= Math.PI * 2; while (angleDiff < -Math.PI) angleDiff += Math.PI * 2; if (Math.abs(angleDiff) < this.ROTATION_THRESHOLD) { this.angle = targetAngle; this.state = 'MOVING'; } else { this.angle += angleDiff * this.turnSpeed; } break; case 'MOVING': let movingAngleDiff = targetAngle - this.angle; while (movingAngleDiff > Math.PI) movingAngleDiff -= Math.PI * 2; while (movingAngleDiff < -Math.PI) movingAngleDiff += Math.PI * 2; this.angle += movingAngleDiff * this.turnSpeed; const distance = Math.sqrt(dx * dx + dy * dy); if (distance < this.moveSpeed * 5) { this.target.x = null; this.state = 'IDLE'; } else { this.x += Math.cos(this.angle) * this.moveSpeed; this.y += Math.sin(this.angle) * this.moveSpeed; } break; } } }
    draw(ctx) { if (this.visibleSegments <= 0) return; ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle); const halfLength = (this.segments * this.segmentLength) / 2; const startSegment = Math.floor(this.segments - this.visibleSegments); ctx.beginPath(); for (let i = startSegment; i < this.segments; i++) { const xOffset = (i * this.segmentLength) - halfLength; const yOffset = Math.sin(i * this.frequency + this.time) * this.amplitude; if (i === startSegment) { ctx.moveTo(xOffset, yOffset); } else { ctx.lineTo(xOffset, yOffset); } } ctx.strokeStyle = '#C37E69'; ctx.lineWidth = this.baseLineWidth * this.scale; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
}

class EarthWormController {
    constructor(canvas) { this.canvas = canvas; this.ctx = this.canvas.getContext('2d'); this.worms = new Map(); this.animationFrameId = null; this.lastTime = 0; this.loop = this.loop.bind(this); }
    _startLoop() { if (this.animationFrameId) return; this.lastTime = performance.now(); this.animationFrameId = requestAnimationFrame(this.loop); }
    _stopLoop() { if (!this.animationFrameId) return; cancelAnimationFrame(this.animationFrameId); this.animationFrameId = null; }
    loop(timestamp) { if (!document.body.contains(this.canvas)) { this.destroy(); return; } const deltaTime = timestamp - this.lastTime; this.lastTime = timestamp; this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); for (const worm of this.worms.values()) { worm.update(deltaTime); worm.draw(this.ctx); } this.animationFrameId = requestAnimationFrame(this.loop); }
    hasWorm(id) { return this.worms.has(id); }
    emergeWorm(id, options = {}) { if (this.worms.has(id)) return; const worm = new EarthWorm(id, this.canvas, { ...options, startVisible: false }); this.worms.set(id, worm); worm.startEmerging(() => { }); this._startLoop(); }
    addWorm(id, options = {}) { if (this.worms.has(id)) return; const worm = new EarthWorm(id, this.canvas, options); this.worms.set(id, worm); this._startLoop(); }
    moveWorm(id, x, y) { const worm = this.worms.get(id); if (worm) worm.setTarget(x, y); }
    killWorm(id) { const worm = this.worms.get(id); if (worm) worm.kill(); }
    burrowWorm(id) { const worm = this.worms.get(id); if (worm) { worm.startBurrowing(() => { this.worms.delete(id); if (this.worms.size === 0) { this._stopLoop(); } }); } }
    removeWorm(id) { if (!this.worms.has(id)) return false; this.worms.delete(id); if (this.worms.size === 0) { this._stopLoop(); } return true; }
    destroy() { this._stopLoop(); this.worms.clear(); }
    clearAllWorms() { this._stopLoop(); this.worms.clear(); this.ctx.clearRect(0, 0, this.canvas.width, this.canvas.height); }
    burrowAllWorms() { this.worms.forEach(worm => this.burrowWorm(worm.id)); }
}