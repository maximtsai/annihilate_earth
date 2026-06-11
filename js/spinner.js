// Weapon Unlock Spinner Device Component
class WeaponSpinner {
    constructor(container, options = {}) {
        this.container = container;
        this.onStop = options.onStop || (() => { });
        this.onStart = options.onStart || (() => { });

        // Locked weapons configuration
        this.weaponsConfig = {
            'kraken': { icon: '🐙', name: 'Cthulhu', color: '#a855f7' }, // Purple
            'worm': { icon: '🪱', name: 'Worm', color: '#10b981' },     // Green
            'fist': { icon: '✊', name: 'Fist', color: '#f59e0b' },     // Amber
            'bowling': { icon: '🎳', name: 'Bowling', color: '#ef4444' }, // Red
            'star': { icon: '⭐', name: 'Star', color: '#3b82f6' },     // Blue
            'comet': { icon: '❄️', name: 'Comet', color: '#06b6d4' }     // Cyan
        };

        // Determine currently locked weapons
        const allLockedWeapons = ['kraken', 'worm', 'fist', 'bowling', 'star', 'comet'];
        const currentUnlocked = window.unlockedWeapons || [];
        this.lockedWeapons = allLockedWeapons.filter(wid => !currentUnlocked.includes(wid));

        this.canvas = null;
        this.ctx = null;
        this.stopButton = null;
        this.isSpinning = false;
        this.isStopping = false;
        this.rotation = 0;
        this.spinSpeed = 0;
        this.lastTime = 0;
        this.lastTickIndex = -1;

        this.initDOM();
        this.startLoop();
    }

    initDOM() {
        this.container.innerHTML = '';
        this.container.className = 'weapon-spinner-wrapper';

        // Create a horizontal row for side previews and the canvas
        const row = document.createElement('div');
        row.className = 'weapon-spinner-row';
        this.container.appendChild(row);

        // Left preview element
        this.leftPreview = document.createElement('div');
        this.leftPreview.className = 'weapon-spinner-preview left-preview';
        row.appendChild(this.leftPreview);

        // 1. Create Canvas (420x180, which is 50% larger than 280x120)
        this.canvas = document.createElement('canvas');
        this.canvas.width = 420;
        this.canvas.height = 180;
        this.canvas.className = 'weapon-spinner-canvas';
        this.ctx = this.canvas.getContext('2d');
        row.appendChild(this.canvas);

        // Right preview element
        this.rightPreview = document.createElement('div');
        this.rightPreview.className = 'weapon-spinner-preview right-preview';
        row.appendChild(this.rightPreview);

        // 2. Action Area holding Stop Button / Announcement
        this.actionArea = document.createElement('div');
        this.actionArea.className = 'weapon-spinner-action-area';
        this.container.appendChild(this.actionArea);

        this.stopButton = document.createElement('button');
        this.stopButton.className = 'weapon-spinner-stop-btn';
        this.stopButton.textContent = 'STOP';
        this.actionArea.appendChild(this.stopButton);

        this.announcement = document.createElement('div');
        this.announcement.className = 'weapon-spinner-announcement';
        this.announcement.style.display = 'none';
        this.actionArea.appendChild(this.announcement);

        this.stopButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stop();
        });

        if (this.lockedWeapons.length === 0) {
            this.setDisabledState();
        }
    }

    setDisabledState() {
        this.stopButton.disabled = true;
        this.stopButton.classList.add('disabled');
        this.stopButton.style.display = 'none';
        if (this.leftPreview) this.leftPreview.style.display = 'none';
        if (this.rightPreview) this.rightPreview.style.display = 'none';
        if (this.announcement) this.announcement.style.display = 'none';
    }

    start() {
        if (this.lockedWeapons.length === 0) return;
        this.isSpinning = true;
        this.isStopping = false;
        
        // Reset celebration/announcement state
        if (this.stopButton) {
            this.stopButton.style.display = 'block';
        }
        if (this.announcement) {
            this.announcement.style.display = 'none';
            this.announcement.textContent = '';
        }
        if (this.leftPreview) {
            this.leftPreview.classList.remove('celebrate');
        }
        if (this.rightPreview) {
            this.rightPreview.classList.remove('celebrate');
        }

        // Windup state parameters
        this.spinPhase = 'windup';
        this.spinTime = 0;
        this.spinSpeed = 0;
        this.targetSpeed = 5 + Math.random() * 1.2;
        
        // Disable stop button during windup
        this.stopButton.disabled = true;
        this.stopButton.classList.add('disabled');

        this.rotation = Math.random() * Math.PI * 2;
        this.lastTickIndex = -1;
        this.onStart();
    }

    stop() {
        if (!this.isSpinning || this.isStopping || this.spinPhase !== 'running') return;
        this.isStopping = true;
        this.stopButton.disabled = true;
        this.stopButton.classList.add('disabled');
        if (typeof soundManager !== 'undefined') {
            soundManager.play('sfx_ui_switch', false, 0.8, -400);
        }
    }

    update(dt) {
        if (!this.isSpinning) return;

        // Apply rotation
        this.rotation += this.spinSpeed * dt;

        // Manage windup phase
        if (this.spinPhase === 'windup') {
            this.spinTime += dt;
            if (this.spinTime < 0.3) {
                // Back up a little (negative velocity hump)
                const progress = this.spinTime / 0.3;
                this.spinSpeed = -1.2 * Math.sin(progress * Math.PI);
            } else if (this.spinTime < 0.7) {
                // Accelerate very quickly up to main speed
                const progress = (this.spinTime - 0.3) / 0.4;
                this.spinSpeed = this.targetSpeed * (progress * progress);
            } else {
                // Windup complete, transition to running
                this.spinSpeed = this.targetSpeed;
                this.spinPhase = 'running';
                this.stopButton.disabled = false;
                this.stopButton.classList.remove('disabled');
            }
        } else if (this.isStopping) {
            // Decelerate if stopping
            // FPS-agnostic decay: slow down by a percentage of the current speed, plus a linear component to guarantee stopping
            this.spinSpeed = this.spinSpeed * Math.pow(0.42, dt) - 0.3 * dt;
            if (this.spinSpeed <= 0.15) {
                this.spinSpeed = 0;
                this.isSpinning = false;
                this.isStopping = false;
                this.onSpinnerEnd();
            }
        }

        // Ticking sound when divider pins pass the top pointer (only while decelerating)
        if (this.isSpinning && this.isStopping && this.lockedWeapons.length > 0) {
            const numSectors = 14;
            const anglePerSector = (Math.PI * 2) / numSectors;
            const norm = ((-Math.PI / 2 - this.rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            const currentIdx = Math.floor(norm / anglePerSector) % numSectors;

            if (currentIdx !== this.lastTickIndex) {
                this.lastTickIndex = currentIdx;
                if (typeof soundManager !== 'undefined') {
                    // Quick high-pitched tick sound
                    soundManager.play('sfx_ui_switch', false, 0.3, 1000);
                }
            }
        }
    }

    onSpinnerEnd() {
        const numSectors = 14;
        const anglePerSector = (Math.PI * 2) / numSectors;

        // Normalize rotation to find which sector landed straight up (angle -Math.PI / 2)
        const norm = ((-Math.PI / 2 - this.rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const sectorIndex = Math.floor(norm / anglePerSector) % numSectors;
        const winningWeapon = this.lockedWeapons[sectorIndex % this.lockedWeapons.length];
        const meta = this.weaponsConfig[winningWeapon];

        if (typeof soundManager !== 'undefined') {
            soundManager.play('sfx_magical_star_fade', false, 0.9);
        }

        // Hide stop button, show announcement text
        if (this.stopButton) this.stopButton.style.display = 'none';
        if (this.announcement && meta) {
            this.announcement.textContent = `${meta.name.toUpperCase()} UNLOCKED!`;
            this.announcement.style.color = meta.color;
            this.announcement.style.textShadow = `0 0 12px ${meta.color}`;
            this.announcement.style.display = 'block';
        }

        // Celebrate side previews (add class and particles)
        if (this.leftPreview && meta) {
            this.leftPreview.classList.add('celebrate');
            this.spawnCelebrationParticles(this.leftPreview, meta.color);
        }
        if (this.rightPreview && meta) {
            this.rightPreview.classList.add('celebrate');
            this.spawnCelebrationParticles(this.rightPreview, meta.color);
        }

        this.onStop(winningWeapon);
    }

    spawnCelebrationParticles(element, color) {
        const rect = element.getBoundingClientRect();
        const parentRect = element.offsetParent.getBoundingClientRect();
        const centerX = rect.left - parentRect.left + rect.width / 2;
        const centerY = rect.top - parentRect.top + rect.height / 2;

        for (let i = 0; i < 20; i++) {
            const p = document.createElement('div');
            p.className = 'spinner-particle';
            p.style.background = color;
            p.style.boxShadow = `0 0 8px ${color}`;
            p.style.left = `${centerX}px`;
            p.style.top = `${centerY}px`;
            
            const angle = Math.random() * Math.PI * 2;
            const speed = 40 + Math.random() * 80;
            const tx = Math.cos(angle) * speed;
            const ty = Math.sin(angle) * speed;
            
            element.offsetParent.appendChild(p);
            
            requestAnimationFrame(() => {
                p.style.transform = `translate(${tx}px, ${ty}px) scale(0)`;
                p.style.opacity = '0';
            });
            
            setTimeout(() => p.remove(), 1000);
        }
    }

    draw() {
        const w = this.canvas.width;
        const h = this.canvas.height;
        const ctx = this.ctx;

        ctx.clearRect(0, 0, w, h);

        if (this.lockedWeapons.length === 0) {
            // Greyed out state: ALL WEAPONS UNLOCKED!
            ctx.fillStyle = 'rgba(20, 20, 25, 0.9)';
            ctx.fillRect(0, 0, w, h);

            ctx.save();
            ctx.shadowBlur = 15;
            ctx.shadowColor = '#00ffff';
            ctx.strokeStyle = '#00ffff';
            ctx.lineWidth = 2;
            ctx.strokeRect(5, 5, w - 10, h - 10);

            ctx.font = 'bold 30px Orbitron, sans-serif';
            ctx.fillStyle = '#00ffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText('ALL WEAPONS UNLOCKED!', w / 2, h / 2);
            ctx.restore();
            return;
        }

        // Draw active spinner wheel (keep radius = 360, but adjust centerY)
        const radius = 360;
        const centerX = w / 2;
        const centerY = h + radius - 150; // Wheel center shifted up to fit larger display area

        const numSectors = 14;
        const anglePerSector = (Math.PI * 2) / numSectors;

        // Draw sectors
        for (let i = 0; i < numSectors; i++) {
            const startAng = this.rotation + i * anglePerSector;
            const endAng = this.rotation + (i + 1) * anglePerSector;

            const weaponId = this.lockedWeapons[i % this.lockedWeapons.length];
            const meta = this.weaponsConfig[weaponId] || { icon: '⚡', name: '?', color: '#888' };

            // Draw pie segment
            ctx.beginPath();
            ctx.moveTo(centerX, centerY);
            ctx.arc(centerX, centerY, radius, startAng, endAng);
            ctx.closePath();
            ctx.fillStyle = meta.color;
            ctx.fill();

            // Draw Divider Lines
            ctx.strokeStyle = '#111116';
            ctx.lineWidth = 3;
            ctx.stroke();

            // Draw Label and Icon oriented outwards
            const midAng = startAng + anglePerSector / 2;
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(midAng + Math.PI / 2); // Rotate to orient label vertically
            ctx.translate(0, -radius + 45);

            // Icon (42px, 50% larger than 28px)
            ctx.font = '42px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(meta.icon, 0, 0);

            // Name Label (14px, 50% larger than 9px)
            ctx.font = 'bold 14px Orbitron, sans-serif';
            ctx.fillStyle = '#ffffff';
            ctx.shadowBlur = 6;
            ctx.shadowColor = '#000000';
            ctx.fillText(meta.name.toUpperCase(), 0, 27);

            ctx.restore();
        }

        // Draw Outer Black Rim
        ctx.beginPath();
        ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        ctx.strokeStyle = '#111116';
        ctx.lineWidth = 14;
        ctx.stroke();

        // Draw Divider Pins (black circular dots on outer rim)
        ctx.fillStyle = '#000000';
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 1;
        for (let i = 0; i < numSectors; i++) {
            const pinAng = this.rotation + i * anglePerSector;
            const px = centerX + Math.cos(pinAng) * (radius - 4);
            const py = centerY + Math.sin(pinAng) * (radius - 4);

            ctx.beginPath();
            ctx.arc(px, py, 4, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        }

        // Draw Top Center Red Pointer/Arrow pointing down (scaled up by 50%)
        ctx.save();
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(255, 0, 0, 0.7)';
        ctx.fillStyle = '#ff1e50'; // Vibrant red
        ctx.strokeStyle = '#111116';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(w / 2 - 12, 0);
        ctx.lineTo(w / 2 + 12, 0);
        ctx.lineTo(w / 2 + 12, 12);
        ctx.lineTo(w / 2, 30);
        ctx.lineTo(w / 2 - 12, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();

        // Update left and right active weapon preview DOM elements
        if (this.lockedWeapons.length > 0) {
            const norm = ((-Math.PI / 2 - this.rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            const sectorIndex = Math.floor(norm / anglePerSector) % numSectors;
            const currentWeaponId = this.lockedWeapons[sectorIndex % this.lockedWeapons.length];
            const currentMeta = this.weaponsConfig[currentWeaponId];
            if (currentMeta) {
                if (this.leftPreview) {
                    this.leftPreview.textContent = currentMeta.icon;
                    this.leftPreview.style.borderColor = currentMeta.color;
                    this.leftPreview.style.boxShadow = `0 0 15px ${currentMeta.color}`;
                }
                if (this.rightPreview) {
                    this.rightPreview.textContent = currentMeta.icon;
                    this.rightPreview.style.borderColor = currentMeta.color;
                    this.rightPreview.style.boxShadow = `0 0 15px ${currentMeta.color}`;
                }
            }
        }
    }

    startLoop() {
        const loop = (timestamp) => {
            if (!this.lastTime) this.lastTime = timestamp;
            const dt = Math.min(0.033, (timestamp - this.lastTime) / 1000); // Clamp dt to max 30fps equivalence
            this.lastTime = timestamp;

            this.update(dt);
            this.draw();

            requestAnimationFrame(loop);
        };
        requestAnimationFrame(loop);
    }
}

// Attach globally
window.WeaponSpinner = WeaponSpinner;
