// Weapon Unlock Spinner Device Component
class WeaponSpinner {
    constructor(container, options = {}) {
        if (window.activeWeaponSpinner) {
            window.activeWeaponSpinner.destroy();
        }
        window.activeWeaponSpinner = this;

        this.container = container;
        this.onStop = options.onStop || (() => { });
        this.onStart = options.onStart || (() => { });
        this.isStar = options.isStar || false;

        // Locked weapons configuration
        this.weaponsConfig = {
            'lightning': { icon: '🌩️', name: 'Lightning', color: '#ffd700' }, // Gold
            'kraken': { icon: '🐙', name: 'Cthulhu', color: '#a855f7' }, // Purple
            'worm': { icon: '🪱', name: 'Worm', color: '#10b981' },     // Green
            'fist': { icon: '✊', name: 'Fist', color: '#f59e0b' },     // Amber
            'bowling': { icon: '🎳', name: 'Bowling', color: '#ef4444' }, // Red
            'star': { icon: '⭐', name: 'Star', color: '#3b82f6' },     // Blue
            'comet': { icon: '❄️', name: 'Comet', color: '#06b6d4' },    // Cyan
            'sword': { icon: '🗡️', name: 'Excalibur', color: '#60a5fa' }, // Light Blue
            'drill': { icon: '⚙️', name: 'Drill', color: '#64748b' } // Slate
        };

        // Determine currently locked weapons
        const allLockedWeapons = ALL_LOCKED_WEAPONS;
        const currentUnlocked = (typeof unlockedWeapons !== 'undefined') ? unlockedWeapons : (window.unlockedWeapons || []);
        this.lockedWeapons = allLockedWeapons.filter(wid => !currentUnlocked.includes(wid));

        // Build sectorWeapons mapping to avoid adjacent duplicates
        this.sectorWeapons = [];
        const numSectors = 16;
        if (this.lockedWeapons.length > 0) {
            if (this.lockedWeapons.length === 1) {
                for (let i = 0; i < numSectors; i++) {
                    this.sectorWeapons.push(this.lockedWeapons[0]);
                }
            } else {
                for (let i = 0; i < numSectors; i++) {
                    this.sectorWeapons.push(this.lockedWeapons[i % this.lockedWeapons.length]);
                }
                if (this.sectorWeapons[numSectors - 1] === this.sectorWeapons[0]) {
                    const first = this.sectorWeapons[0];
                    const secondToLast = this.sectorWeapons[numSectors - 2];
                    const replacement = this.lockedWeapons.find(w => w !== first && w !== secondToLast);
                    if (replacement) {
                        this.sectorWeapons[numSectors - 1] = replacement;
                    }
                }
            }
        }

        this.canvas = null;
        this.ctx = null;
        this.stopButton = null;
        this.isSpinning = false;
        this.isStopping = false;
        this.rotation = 0;
        this.spinSpeed = 0;
        this.lastTime = 0;
        this.lastTickIndex = -1;

        // Visual effects and physics states
        this.pointerWobble = 0;
        this.pointerWobbleVelocity = 0;
        this.winPulseTime = 0;
        this.winningSegmentScale = 1.0;
        this.winningSectorIdx = -1;
        this.flashAlpha = 0;
        this.stopSparks = [];
        this.isDestroyed = false;

        this.initDOM();
        this.startLoop();
    }

    initDOM() {
        this.container.innerHTML = '';
        this.container.className = 'weapon-spinner-wrapper';

        // Create a horizontal row for side previews and the canvas
        const row = document.createElement('div');
        row.className = 'weapon-spinner-row';
        row.style.cursor = 'pointer';
        this.row = row;
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
        this.stopButton.textContent = (translations[currentLanguage] || translations['en']).stop || 'STOP';
        this.actionArea.appendChild(this.stopButton);

        this.announcement = document.createElement('div');
        this.announcement.className = 'weapon-spinner-announcement';
        this.announcement.style.display = 'none';
        this.actionArea.appendChild(this.announcement);

        this.stopButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stop();
        });

        row.addEventListener('click', (e) => {
            e.stopPropagation();
            this.stop();
        });

        if (this.lockedWeapons.length === 0) {
            this.setDisabledState();
        } else {
            const numSectors = 16;
            const anglePerSector = (Math.PI * 2) / numSectors;
            const norm = ((-Math.PI / 2 - this.rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            const sectorIndex = Math.floor(norm / anglePerSector) % numSectors;
            this.updatePreviews(sectorIndex);
        }
    }

    setDisabledState() {
        this.stopButton.disabled = true;
        this.stopButton.classList.add('disabled');
        this.stopButton.style.display = 'none';
        if (this.leftPreview) this.leftPreview.style.display = 'none';
        if (this.rightPreview) this.rightPreview.style.display = 'none';
        if (this.announcement) this.announcement.style.display = 'none';
        this.setClickable(false);
    }

    setClickable(clickable) {
        if (this.canvas) {
            this.canvas.classList.toggle('clickable', clickable);
        }
    }

    updatePreviews(sectorIndex) {
        if (this.lockedWeapons.length === 0) return;
        const currentWeaponId = this.sectorWeapons[sectorIndex];
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

    start() {
        if (this.lockedWeapons.length === 0) return;

        // Site lock check: allow local dev, otherwise check if hosted on valid CrazyGames domains
        const isLocal = window.location.hostname === 'localhost' || 
                        window.location.hostname === '127.0.0.1' || 
                        window.location.hostname === '';
        
        const isCrazyGamesDomain = () => {
            const hostname = window.location.hostname;
            const parts = hostname.split(".");
            const idx = parts.indexOf("crazygames");
            return idx !== -1 && idx >= parts.length - 3;
        };

        if (!isLocal && !isCrazyGamesDomain()) {
            return;
        }

        this.isSpinning = true;
        this.isStopping = false;
        this.setClickable(false);

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

        // Reset visual effect states
        this.pointerWobble = 0;
        this.pointerWobbleVelocity = 0;
        this.winPulseTime = 0;
        this.winningSegmentScale = 1.0;
        this.winningSectorIdx = -1;
        this.flashAlpha = 0;
        this.stopSparks = [];
        this.container.classList.remove('stop-shake');

        // Windup state parameters
        this.spinPhase = 'windup';
        this.spinTime = 0;
        this.spinSpeed = 0;
        this.targetSpeed = 5 + Math.random() * 1.2;

        // Disable stop button during windup
        this.stopButton.disabled = true;
        this.stopButton.classList.add('disabled');

        this.rotation = Math.random() * Math.PI * 2;
        const numSectors = 16;
        const anglePerSector = (Math.PI * 2) / numSectors;
        const norm = ((-Math.PI / 2 - this.rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const sectorIndex = Math.floor(norm / anglePerSector) % numSectors;
        this.updatePreviews(sectorIndex);
        this.lastTickIndex = sectorIndex;
        this.onStart();
    }

    stop() {
        if (!this.isSpinning || this.isStopping || this.spinPhase !== 'running') return;
        this.isStopping = true;
        if (this.row) {
            this.row.style.cursor = '';
        }
        this.stopButton.disabled = true;
        this.stopButton.classList.add('disabled');
        this.setClickable(false);

        // 1. Trigger CSS shake on container wrapper
        this.container.classList.remove('stop-shake');
        void this.container.offsetWidth; // force reflow
        this.container.classList.add('stop-shake');

        // 2. Trigger subtle canvas flash
        this.flashAlpha = 0.25;

        // 3. Spawn mechanical brake sparks from pointer tip (w/2, 30)
        const w = this.canvas.width;
        const numSectors = 16;
        const anglePerSector = (Math.PI * 2) / numSectors;
        const norm = ((-Math.PI / 2 - this.rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const sectorIndex = Math.floor(norm / anglePerSector) % numSectors;
        const winningWeapon = this.sectorWeapons[sectorIndex];
        const meta = this.weaponsConfig[winningWeapon];
        const sparkColor = meta ? meta.color : '#ffe600';

        for (let i = 0; i < 24; i++) {
            const angle = Math.random() * Math.PI + Math.PI * 0.5;
            const speed = 100 + Math.random() * 140;
            // Mix in bright yellow sparks with the thematic segment color
            const finalColor = Math.random() < 0.4 ? '#ffe600' : sparkColor;
            this.stopSparks.push({
                x: w / 2,
                y: 30,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                color: finalColor,
                size: 3.0 + Math.random() * 3.5,
                life: 0.55 + Math.random() * 0.35,
                maxLife: 0.9,
                rotation: Math.random() * Math.PI * 2,
                rotSpeed: (Math.random() - 0.5) * 5
            });
        }

        if (typeof soundManager !== 'undefined') {
            soundManager.play('sfx_ui_switch', false, 0.8, -400);
        }
    }

    update(dt) {
        // Update pointer wobble spring
        if (Math.abs(this.pointerWobble) > 0.001 || Math.abs(this.pointerWobbleVelocity) > 0.001) {
            const springConstant = 250;
            const damping = 12;
            const acceleration = -springConstant * this.pointerWobble - damping * this.pointerWobbleVelocity;
            this.pointerWobbleVelocity += acceleration * dt;
            this.pointerWobble += this.pointerWobbleVelocity * dt;
        } else {
            this.pointerWobble = 0;
            this.pointerWobbleVelocity = 0;
        }

        // Decay subtle flash alpha
        if (this.flashAlpha > 0) {
            this.flashAlpha = Math.max(0, this.flashAlpha - 1.8 * dt);
        }

        // Update mechanical brake sparks
        if (this.stopSparks) {
            for (let i = this.stopSparks.length - 1; i >= 0; i--) {
                const s = this.stopSparks[i];
                s.x += s.vx * dt;
                s.y += s.vy * dt;
                s.rotation += s.rotSpeed * dt;
                s.life -= dt;
                if (s.life <= 0) {
                    this.stopSparks.splice(i, 1);
                }
            }
        }

        if (!this.isSpinning) {
            // If stopped and showing winning segment, update bounce scale animation (livelier bounce!)
            if (this.winningSectorIdx !== -1) {
                this.winPulseTime += dt;
                this.winningSegmentScale = 1.0 + 0.55 * Math.sin(this.winPulseTime * 14) * Math.exp(-this.winPulseTime * 1.8);
            }
            return;
        }

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
                this.setClickable(true);
            }
        } else if (this.isStopping) {
            // Decelerate if stopping
            this.spinSpeed = this.spinSpeed * Math.pow(0.42, dt) - 0.3 * dt;
            if (this.spinSpeed <= 0.15) {
                this.spinSpeed = 0;
                this.settleVelocity = 0;

                const numSectors = 16;
                const anglePerSector = (Math.PI * 2) / numSectors;
                const norm = ((-Math.PI / 2 - this.rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
                const sectorIndex = Math.floor(norm / anglePerSector) % numSectors;

                // Target: align this sector's center exactly with -Math.PI / 2 (top pointer)
                const sectorCenterOffset = sectorIndex * anglePerSector + anglePerSector / 2;
                const targetRotation = -Math.PI / 2 - sectorCenterOffset;

                // Find shortest angular distance to target
                const diff = ((targetRotation - this.rotation) % (Math.PI * 2) + Math.PI * 3) % (Math.PI * 2) - Math.PI;
                this.settleTarget = this.rotation + diff;
                this.winningSectorIdx = sectorIndex;

                this.spinPhase = 'snapping';
                this.isStopping = false;
            }
        } else if (this.spinPhase === 'snapping') {
            // Snaps very quickly with a spring bounce
            const springConstant = 480;
            const damping = 16;
            const displacement = this.rotation - this.settleTarget;
            const acceleration = -springConstant * displacement - damping * this.settleVelocity;
            this.settleVelocity += acceleration * dt;
            this.rotation += this.settleVelocity * dt;

            // Settle complete when very close to target and velocity is low
            if (Math.abs(displacement) < 0.002 && Math.abs(this.settleVelocity) < 0.05) {
                this.rotation = this.settleTarget;
                this.isSpinning = false;
                this.spinPhase = 'idle';
                this.winPulseTime = 0;
                this.winningSegmentScale = 1.0;
                this.onSpinnerEnd();
            }
        }

        // Ticking sound & wobble when divider pins pass the top pointer
        if (this.isSpinning && this.lockedWeapons.length > 0) {
            const numSectors = 16;
            const anglePerSector = (Math.PI * 2) / numSectors;
            const norm = ((-Math.PI / 2 - this.rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
            const currentIdx = Math.floor(norm / anglePerSector) % numSectors;

            if (currentIdx !== this.lastTickIndex) {
                this.lastTickIndex = currentIdx;
                this.updatePreviews(currentIdx);

                // Elastic wobble only if not in windup
                if (this.spinPhase !== 'windup') {
                    // Tilt only counterclockwise (negative offset)
                    this.pointerWobble = -0.32;
                    this.pointerWobbleVelocity = 0;

                    if (typeof soundManager !== 'undefined') {
                        // Dynamically detune tick pitch based on spin speed
                        const speedRatio = Math.max(0, Math.min(1, this.spinSpeed / 5));
                        const detune = -800 + speedRatio * 1800; // Pitch detunes from 1000 down to -800
                        soundManager.play('sfx_ui_switch', false, 0.3, detune);
                    }
                }
            }
        }
    }

    onSpinnerEnd() {
        const numSectors = 16;
        const anglePerSector = (Math.PI * 2) / numSectors;

        // Normalize rotation to find which sector landed straight up (angle -Math.PI / 2)
        const norm = ((-Math.PI / 2 - this.rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const sectorIndex = Math.floor(norm / anglePerSector) % numSectors;
        const winningWeapon = this.sectorWeapons[sectorIndex];
        const meta = this.weaponsConfig[winningWeapon];

        this.winningSectorIdx = sectorIndex;

        if (typeof soundManager !== 'undefined') {
            soundManager.play('sfx_magical_star_fade', false, 0.9);
        }

        // Hide stop button, show announcement text
        if (this.stopButton) this.stopButton.style.display = 'none';
        if (this.announcement && meta) {
            const t = translations[currentLanguage] || translations['en'];
            const suffix = this.isStar ? (' ' + (t.available || 'AVAILABLE!')) : (' ' + (t.unlocked || 'UNLOCKED!'));
            const announceName = (t.weaponNames && t.weaponNames[winningWeapon])
                ? t.weaponNames[winningWeapon].replace(/<br>/gi, ' ')
                : meta.name;
            this.announcement.textContent = `${announceName.toUpperCase()}${suffix}`;
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
        if (!element || !element.offsetParent) return;
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

            if (element.offsetParent) {
                element.offsetParent.appendChild(p);
            }

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

            const t_all = translations[currentLanguage] || translations['en'];
            const allWepLines = (t_all.allWeaponsUnlocked || 'ALL WEAPONS\nUNLOCKED!').split('\n');
            ctx.font = 'bold 26px Orbitron, sans-serif';
            ctx.fillStyle = '#00ffff';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'middle';
            ctx.fillText(allWepLines[0], w / 2, h / 2 - 16);
            ctx.fillText(allWepLines[1], w / 2, h / 2 + 16);
            ctx.restore();
            return;
        }

        // Draw active spinner wheel (keep radius = 360, but adjust centerY)
        const radius = 360;
        const centerX = w / 2;
        const centerY = h + radius - 150; // Wheel center shifted up to fit larger display area

        const numSectors = 16;
        const anglePerSector = (Math.PI * 2) / numSectors;

        // Find which sector is currently active (top center pointer lane)
        const norm = ((-Math.PI / 2 - this.rotation) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2);
        const activeIdx = Math.floor(norm / anglePerSector) % numSectors;

        // Draw sectors
        for (let i = 0; i < numSectors; i++) {
            const startAng = this.rotation + i * anglePerSector;
            const endAng = this.rotation + (i + 1) * anglePerSector;

            const weaponId = this.sectorWeapons[i];
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

            // Calculate segment scales (grow active segment slightly, bounce winning segment when stopped)
            let segmentScale = 1.0;
            if (i === this.winningSectorIdx) {
                segmentScale = this.winningSegmentScale;
            } else if (i === activeIdx) {
                segmentScale = 1.12;
            }

            // Draw Label and Icon oriented outwards
            const midAng = startAng + anglePerSector / 2;
            ctx.save();
            ctx.translate(centerX, centerY);
            ctx.rotate(midAng + Math.PI / 2); // Rotate to orient label vertically
            ctx.translate(0, -radius + 45);
            ctx.scale(segmentScale, segmentScale);

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
            const t_dn = translations[currentLanguage] || translations['en'];
            const displayName = (t_dn.weaponNames && t_dn.weaponNames[weaponId])
                ? t_dn.weaponNames[weaponId].replace(/<br>/gi, ' ')
                : meta.name;
            ctx.fillText(displayName.toUpperCase(), 0, 27);

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

        // Draw Top Center Red Pointer/Arrow pointing down (scaled up by 50% with elastic wobble)
        ctx.save();
        ctx.translate(w / 2, 0);
        ctx.rotate(this.pointerWobble);
        ctx.shadowBlur = 12;
        ctx.shadowColor = 'rgba(255, 0, 0, 0.7)';
        ctx.fillStyle = '#ff1e50'; // Vibrant red
        ctx.strokeStyle = '#111116';
        ctx.lineWidth = 3;
        ctx.beginPath();
        ctx.moveTo(-12, 0);
        ctx.lineTo(12, 0);
        ctx.lineTo(12, 12);
        ctx.lineTo(0, 30);
        ctx.lineTo(-12, 12);
        ctx.closePath();
        ctx.fill();
        ctx.stroke();
        ctx.restore();



        // Draw mechanical brake sparks
        if (this.stopSparks && this.stopSparks.length > 0) {
            this.stopSparks.forEach(s => {
                ctx.save();
                ctx.translate(s.x, s.y);
                ctx.rotate(s.rotation);
                ctx.fillStyle = s.color;
                ctx.shadowBlur = 8;
                ctx.shadowColor = s.color;
                ctx.globalAlpha = s.life / s.maxLife;
                ctx.fillRect(-s.size, -s.size, s.size * 2, s.size * 2);
                ctx.restore();
            });
        }

        // Draw subtle impact flash overlay
        if (this.flashAlpha > 0) {
            ctx.save();
            ctx.fillStyle = `rgba(255, 255, 255, ${this.flashAlpha})`;
            ctx.fillRect(0, 0, w, h);
            ctx.restore();
        }
    }

    destroy() {
        this.isDestroyed = true;
        this.isSpinning = false;
        this.isStopping = false;
        if (this.row) {
            this.row.style.cursor = '';
        }
        if (window.activeWeaponSpinner === this) {
            window.activeWeaponSpinner = null;
        }
    }

    startLoop() {
        const loop = (timestamp) => {
            if (this.isDestroyed) return;
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
