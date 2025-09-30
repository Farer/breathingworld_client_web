class EarthWorm {
    constructor(id, options = {}) {
        this.id = id;
        this.x = options.x ?? Math.random() * canvas.width;
        this.y = options.y ?? Math.random() * canvas.height;
        this.scale = options.scale ?? 1.0;
        this.segments = options.segments ?? 15 + Math.floor(Math.random() * 10);
        this.segmentLength = (options.segmentLength ?? 4 + Math.random() * 2) * this.scale;
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
    }
    setTarget(x, y) { this.target.x = x; this.target.y = y; this.state = 'ROTATING'; }
    update(deltaTime) { this.time += this.animSpeed; this.frequencyChangeTimer -= deltaTime; if (this.frequencyChangeTimer <= 0) { this.targetFrequency = (0.2 + Math.random() * 0.4); this.targetAmplitude = (3 + Math.random() * 5) * this.scale; this.frequencyChangeTimer = 2000 + Math.random() * 3000; } this.frequency += (this.targetFrequency - this.frequency) * 0.05; this.amplitude += (this.targetAmplitude - this.amplitude) * 0.05; if (this.target.x !== null) { const dx = this.target.x - this.x; const dy = this.target.y - this.y; const targetAngle = Math.atan2(dy, dx); switch (this.state) { case 'ROTATING': let angleDiff = targetAngle - this.angle; while (angleDiff > Math.PI) angleDiff -= Math.PI * 2; while (angleDiff < -Math.PI) angleDiff += Math.PI * 2; if (Math.abs(angleDiff) < this.ROTATION_THRESHOLD) { this.angle = targetAngle; this.state = 'MOVING'; } else { this.angle += angleDiff * this.turnSpeed; } break; case 'MOVING': let movingAngleDiff = targetAngle - this.angle; while (movingAngleDiff > Math.PI) movingAngleDiff -= Math.PI * 2; while (movingAngleDiff < -Math.PI) movingAngleDiff += Math.PI * 2; this.angle += movingAngleDiff * this.turnSpeed; const distance = Math.sqrt(dx * dx + dy * dy); if (distance < this.moveSpeed) { this.target.x = null; this.state = 'IDLE'; } else { this.x += Math.cos(this.angle) * this.moveSpeed; this.y += Math.sin(this.angle) * this.moveSpeed; } break; } } }
    draw(ctx) { ctx.save(); ctx.translate(this.x, this.y); ctx.rotate(this.angle); const halfLength = (this.segments * this.segmentLength) / 2; ctx.beginPath(); for (let i = 0; i < this.segments; i++) { const xOffset = (i * this.segmentLength) - halfLength; const yOffset = Math.sin(i * this.frequency + this.time) * this.amplitude; if (i === 0) { ctx.moveTo(xOffset, yOffset); } else { ctx.lineTo(xOffset, yOffset); } } ctx.strokeStyle = '#C37E69'; ctx.lineWidth = this.baseLineWidth * this.scale; ctx.lineCap = 'round'; ctx.lineJoin = 'round'; ctx.stroke(); ctx.restore(); }
}