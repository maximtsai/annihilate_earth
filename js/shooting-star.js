// Shooting Star world object logic
(function () {
    let star = null;
    let spawnTime = 0;
    let spawned = false;
    let firstAttemptFired = false;
    let lastRetryTime = 0;
    let starClaimedThisLevel = false;
    let clickStars = [];
    let lastSpawnTimestamp = 0;
    let lastUnlockedCount = -1;
    let hasLockedWeapons = true;
    let adBlockCount = 0;

    window.ShootingStarManager = {
        init: function () {
            // Pick a random spawn time based on the planet
            if (typeof currentPlanet !== 'undefined' && currentPlanet === 'earth') {
                spawnTime = 31 + Math.random() * 4; // 31 to 35 seconds
            } else {
                spawnTime = 14 + Math.random() * 6; // 14 to 20 seconds
            }
            spawned = false;
            firstAttemptFired = false;
            lastRetryTime = 0;
            starClaimedThisLevel = false;
            star = null;
            clickStars = [];
            lastUnlockedCount = -1;
            adBlockCount = 0;
            console.log("[ShootingStar] Initialized. Spawn scheduled at " + spawnTime.toFixed(2) + "s");
        },

        update: function (deltaTime) {
            // Only update/spawn if planetTimeSpent is defined and gameplay has started
            if (typeof planetTimeSpent === 'undefined' || typeof victoryTriggered === 'undefined' || victoryTriggered) {
                return;
            }

            // If all weapons are unlocked, don't make shooting stars appear (optimized with caching)
            const currentUnlocked = (typeof unlockedWeapons !== 'undefined') ? unlockedWeapons : (window.unlockedWeapons || []);
            if (currentUnlocked.length !== lastUnlockedCount) {
                lastUnlockedCount = currentUnlocked.length;
                const allLockedWeapons = ['lightning', 'kraken', 'worm', 'fist', 'bowling', 'star', 'comet', 'sword'];
                hasLockedWeapons = allLockedWeapons.some(wid => !currentUnlocked.includes(wid));
            }
            if (!hasLockedWeapons) {
                if (star) star = null;
                return;
            }

            const isEarth = (typeof currentPlanet !== 'undefined' && currentPlanet === 'earth');
            const now = Date.now();
            const adCooldownActive = (now - (window.lastAdPlayTime || 0) < 30000);

            let shouldAttemptSpawn = false;
            if (!starClaimedThisLevel) {
                if (!firstAttemptFired && planetTimeSpent >= spawnTime) {
                    firstAttemptFired = true;
                    if (now - lastSpawnTimestamp >= 20000) {
                        shouldAttemptSpawn = true;
                    }
                } else if (!star && planetTimeSpent >= lastRetryTime + 65) {
                    lastRetryTime += 65;
                    if (now - lastSpawnTimestamp >= 24000) {
                        shouldAttemptSpawn = true;
                    }
                }
            }

            if (shouldAttemptSpawn) {
                if (adCooldownActive) {
                    adBlockCount++;
                    console.log("[ShootingStar] Spawn blocked by ad cooldown. Block count: " + adBlockCount);
                    if (adBlockCount % 2 === 0) {
                        console.log("[ShootingStar] Ignoring ad cooldown block (every second time). Spawning anyway.");
                        this.spawn();
                    }
                } else {
                    this.spawn();
                }
            }

            if (star) {
                star.x += star.vx * deltaTime;
                star.y += star.vy * deltaTime;
                star.angle += star.spinSpeed * deltaTime;
                star.age += deltaTime;

                // Check distance from planet center (CENTER_X, CENTER_Y)
                const dist = Math.sqrt((star.x - CENTER_X) ** 2 + (star.y - CENTER_Y) ** 2);
                if (dist > 1000) {
                    console.log("[ShootingStar] Left screen, deactivating.");
                    star = null;
                    spawned = false;
                } else {
                    // Spawn particle trail (reduced spawn rate by 20% more)
                    if (typeof particles !== 'undefined' && Math.random() < 0.3) {
                        const angleOff = Math.random() * Math.PI * 2;
                        // Spawn in a wider area around the star
                        const distOff = Math.random() * star.size * 1.6;
                        const px = star.x + Math.cos(angleOff) * distOff;
                        const py = star.y + Math.sin(angleOff) * distOff;

                        // Particles do not move (vx and vy are 0)
                        const pColor = Math.random() < 0.5 ? 'hsl(55, 100%, 85%)' : 'hsl(48, 100%, 90%)';
                        particles.push({
                            x: px,
                            y: py,
                            vx: 0,
                            vy: 0,
                            life: 1.0,
                            maxLife: 0.7 + Math.random() * 0.9,
                            size: 3 + Math.random() * 5,
                            color: pColor,
                            type: 'fire'
                        });
                    }
                }
            }

            // Update click explosion stars
            for (let i = clickStars.length - 1; i >= 0; i--) {
                const cs = clickStars[i];
                cs.x += cs.vx * deltaTime;
                cs.y += cs.vy * deltaTime;
                cs.angle += cs.spinSpeed * deltaTime;
                cs.life -= deltaTime / cs.maxLife;
                cs.opacity = Math.max(0, cs.life);
                if (cs.life <= 0) {
                    clickStars.splice(i, 1);
                }
            }
        },

        spawn: function () {
            const theta = Math.random() * Math.PI * 2;
            const spawnX = CENTER_X + Math.cos(theta) * 980;
            const spawnY = CENTER_Y + Math.sin(theta) * 980;

            const directionSign = Math.random() < 0.5 ? -1 : 1;
            const alpha = Math.acos(275 / 980);
            const phi = theta + directionSign * alpha;

            const targetX = CENTER_X + Math.cos(phi) * 275;
            const targetY = CENTER_Y + Math.sin(phi) * 275;

            const dx = targetX - spawnX;
            const dy = targetY - spawnY;
            const len = Math.sqrt(dx * dx + dy * dy);

            // Speed: 72px/s (10% slower than 80px/s)
            const vx = (dx / len) * 72;
            const vy = (dy / len) * 72;

            star = {
                x: spawnX,
                y: spawnY,
                vx: vx,
                vy: vy,
                angle: Math.random() * Math.PI * 2,
                spinSpeed: (0.8 + Math.random() * 1.2) * 1.25,
                size: 28,
                age: 0
            };
            spawned = true;
            lastSpawnTimestamp = Date.now();
            console.log("[ShootingStar] Spawned at (" + spawnX.toFixed(0) + ", " + spawnY.toFixed(0) + ") closest approach: 275px");

            // Play spawn sound 1 second after spawn
            setTimeout(() => {
                // Only play if the star is still active and has not been clicked/destroyed in the meantime
                if (star && typeof soundManager !== 'undefined') {
                    soundManager.play('sfx_magical_star_shot2', false, 0.85);
                }
            }, 3000);
        },

        draw: function (ctx) {
            // Draw main star if active
            if (star) {
                ctx.save();
                ctx.translate(star.x, star.y);

                // Draw glowing aura behind the star
                const auraRad = ctx.createRadialGradient(0, 0, star.size * 0.1, 0, 0, star.size * 1.8);
                auraRad.addColorStop(0, 'rgba(255, 215, 0, 0.55)');
                auraRad.addColorStop(0.4, 'rgba(255, 140, 0, 0.25)');
                auraRad.addColorStop(1, 'rgba(0, 0, 0, 0)');
                ctx.fillStyle = auraRad;
                ctx.beginPath();
                ctx.arc(0, 0, star.size * 1.8, 0, Math.PI * 2);
                ctx.fill();

                // Draw star shape
                ctx.rotate(star.angle);
                ctx.shadowBlur = 15;
                ctx.shadowColor = 'rgba(255, 200, 0, 0.9)';

                this.drawStarShape(ctx, 5, star.size, star.size * 0.4, '#ffe600', '#ffa500');

                ctx.restore();

                // Draw indicator if age is between 12 and 16 seconds
                if (star.age >= 12 && star.age < 16) {
                    ctx.save();
                    ctx.translate(star.x, star.y);

                    // Setup yellow text saying "NEW WEAPON"
                    ctx.font = "bold 16px 'Orbitron', sans-serif";
                    ctx.fillStyle = "#ffe600";
                    ctx.strokeStyle = "#000000";
                    ctx.lineWidth = 1;
                    ctx.shadowBlur = 0;
                    ctx.shadowColor = 'transparent';
                    ctx.textAlign = "center";
                    ctx.textBaseline = "middle";

                    // Bobbing/floating animation
                    const bobY = Math.sin(star.age * 8) * 4;
                    const indicatorY = -star.size - 18 + bobY;

                    const newWeaponText = (translations[currentLanguage] || translations['en']).newWeapon || 'NEW WEAPON';
                    ctx.strokeText(newWeaponText, 0, indicatorY - 14);
                    ctx.fillText(newWeaponText, 0, indicatorY - 14);

                    // Draw downward pointer indicator (triangle)
                    ctx.beginPath();
                    ctx.moveTo(-6, indicatorY - 4);
                    ctx.lineTo(6, indicatorY - 4);
                    ctx.lineTo(0, indicatorY + 4);
                    ctx.closePath();
                    ctx.fillStyle = "#ffe600";
                    ctx.fill();

                    ctx.restore();
                }
            }

            // Draw click explosion stars
            clickStars.forEach(cs => {
                ctx.save();
                ctx.translate(cs.x, cs.y);
                ctx.globalAlpha = cs.opacity;
                ctx.rotate(cs.angle);

                // Tiny glowing aura
                const auraRad = ctx.createRadialGradient(0, 0, cs.size * 0.1, 0, 0, cs.size * 1.5);
                auraRad.addColorStop(0, 'rgba(255, 200, 0, 0.4)');
                auraRad.addColorStop(1, 'rgba(255, 200, 0, 0)');
                ctx.fillStyle = auraRad;
                ctx.beginPath();
                ctx.arc(0, 0, cs.size * 1.5, 0, Math.PI * 2);
                ctx.fill();

                this.drawStarShape(ctx, 5, cs.size, cs.size * 0.4, '#ffe600', '#ffa500');
                ctx.restore();
            });
        },

        drawStarShape: function (ctx, spikes, outerRadius, innerRadius, fillStyle, strokeStyle = null) {
            let rot = (Math.PI / 2) * 3;
            let x = 0;
            let y = 0;
            const step = Math.PI / spikes;

            ctx.beginPath();
            ctx.moveTo(Math.cos(rot) * outerRadius, Math.sin(rot) * outerRadius);
            for (let i = 0; i < spikes; i++) {
                x = Math.cos(rot) * outerRadius;
                y = Math.sin(rot) * outerRadius;
                ctx.lineTo(x, y);
                rot += step;

                x = Math.cos(rot) * innerRadius;
                y = Math.sin(rot) * innerRadius;
                ctx.lineTo(x, y);
                rot += step;
            }
            ctx.closePath();
            ctx.fillStyle = fillStyle;
            ctx.fill();
            if (strokeStyle) {
                ctx.strokeStyle = strokeStyle;
                ctx.lineWidth = 1.5;
                ctx.stroke();
            }
        },

        checkClick: function (clickX, clickY) {
            if (!star) return false;

            const dist = Math.sqrt((star.x - clickX) ** 2 + (star.y - clickY) ** 2);
            const clickRadius = isMobile ? 52 : 40;
            if (dist <= clickRadius) {
                console.log("[ShootingStar] Clicked!");

                // Spawn several smaller click stars that fly out and fade
                clickStars = [];
                const count = 5 + Math.floor(Math.random() * 4); // 5 to 8 stars
                for (let i = 0; i < count; i++) {
                    const angle = Math.random() * Math.PI * 2;
                    const speed = 70 + Math.random() * 90; // flight velocity (px/sec)
                    clickStars.push({
                        x: star.x,
                        y: star.y,
                        vx: Math.cos(angle) * speed,
                        vy: Math.sin(angle) * speed,
                        angle: Math.random() * Math.PI * 2,
                        spinSpeed: 2.0 + Math.random() * 3.5,
                        size: 9 + Math.random() * 5,
                        life: 1.0,
                        maxLife: 0.5 + Math.random() * 0.4, // fade duration
                        opacity: 1.0
                    });
                }

                star = null; // Disappear main star

                // Play sound
                if (typeof soundManager !== 'undefined') {
                    soundManager.play('sfx_holy_shine', false, 0.68);
                }

                // Open the ad spin popup
                const popup = document.getElementById('ad-spin-popup-overlay');
                if (popup) {
                    popup.style.display = 'flex';

                    // Reset and initialize the spinner inside the ad popup
                    const container = document.getElementById('star-spinner-container');
                    if (container) {
                        const allLockedWeapons = ['lightning', 'kraken', 'worm', 'fist', 'bowling', 'star', 'comet', 'sword'];
                        const hasLocked = allLockedWeapons.some(wid => !unlockedWeapons.includes(wid));

                        const btnContainer = document.getElementById('ad-spin-buttons-container');
                        const msg = document.getElementById('ad-spin-message');
                        const adSpinYes = document.getElementById('ad-spin-yes');
                        const adSpinNo = document.getElementById('ad-spin-no');

                        if (hasLocked) {
                            if (adSpinYes) {
                                adSpinYes.disabled = true;
                                adSpinYes.classList.remove('glow-shine');
                            }
                            if (adSpinNo) adSpinNo.disabled = true;
                            if (msg) msg.textContent = (translations[currentLanguage] || translations['en']).shootingStarMessage || 'SPIN THE WHEEL TO DISCOVER A WEAPON!';
                            window.starSelectedWeapon = null;

                             const spinner = new WeaponSpinner(container, {
                                 isStar: true,
                                 onStop: (weaponToUnlock) => {
                                     window.starSelectedWeapon = weaponToUnlock;
                                     if (adSpinYes) {
                                         adSpinYes.disabled = false;
                                         adSpinYes.classList.add('glow-shine');
                                     }
                                     if (adSpinNo) adSpinNo.disabled = false;

                                     const btn = document.getElementById(`btn-${weaponToUnlock}`);
                                     const name = btn ? btn.querySelector('.weapon-name').innerText.replace('\n', ' ') : weaponToUnlock.toUpperCase();
                                     const icon = btn ? btn.querySelector('.weapon-icon').innerText : '⚡';
                                     if (msg) msg.textContent = (translations[currentLanguage] || translations['en']).watchAdToUnlock.replace('{name}', `${icon} ${name}`);
                                 }
                             });
                             spinner.start();
                        } else {
                            // Show disabled greyed out spinner, disable watch/cancel buttons
                            if (adSpinYes) adSpinYes.disabled = true;
                            if (adSpinNo) adSpinNo.disabled = true;
                            if (msg) msg.innerHTML = ((translations[currentLanguage] || translations['en']).allWeaponsUnlocked || 'ALL WEAPONS\nUNLOCKED!').replace('\n', '<br>');
                            new WeaponSpinner(container);
                        }
                    }
                }
                return true;
            }
            return false;
        },

        onWeaponClaimed: function () {
            starClaimedThisLevel = true;
            spawned = true;
        }
    };
})();
