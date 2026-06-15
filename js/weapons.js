// Weapons Physics & Interaction Logic
let lastCooldownTextTime = 0;

function spawnWeapon(clickX, clickY, typeOverride = null) {
    if (victoryTriggered) return;

    const type = typeOverride || selectedWeapon;

    if (!isWeaponUnlocked(type)) {
        addFloatingText(clickX, clickY, (translations[currentLanguage] || translations['en']).locked || "LOCKED");
        return;
    }

    if (typeof weaponAmmo !== 'undefined' && weaponAmmo[type] !== undefined) {
        if (weaponAmmo[type] <= 0) {
            const now = Date.now();
            if (now - lastCooldownTextTime >= 1500) {
                const outOfAmmoText = (translations[currentLanguage] || translations['en']).outOfAmmo || "OUT OF AMMO";
                addFloatingText(clickX, clickY, outOfAmmoText, 'rgba(255, 30, 80,', 0.8, 45, 18);
                lastCooldownTextTime = now;
            }
            const btn = document.getElementById('btn-' + type);
            if (btn) {
                btn.classList.remove('cooldown-alert');
                void btn.offsetWidth; // Force reflow
                btn.classList.add('cooldown-alert');
                setTimeout(() => {
                    btn.classList.remove('cooldown-alert');
                }, 650);
            }
            // Clear queue for this weapon
            delete weaponQueues[type];
            return;
        }
    }

    if (!typeOverride) {
        let cd = 0;
        if (type === 'laser') cd = laserCooldown;
        else if (type === 'asteroid') cd = asteroidCooldown;
        else if (type === 'moon') cd = moonCooldown;
        else if (type === 'nuke') cd = nukeCooldown;
        else if (type === 'missile') cd = missileCooldown;
        else if (type === 'sword') cd = swordCooldown;
        else if (type === 'kraken') cd = krakenCooldown;
        else if (type === 'bowling') cd = bowlingCooldown;
        else if (type === 'fist') cd = fistCooldown;
        else if (type === 'star') cd = starCooldown;
        else if (type === 'comet') cd = cometCooldown;
        else if (type === 'worm') cd = wormCooldown;
        else if (type === 'blackhole') cd = blackholeCooldown;
        else if (type === 'gamma') cd = gammaBurstCooldown;
        else if (type === 'lightning') cd = lightningCooldown;

        if (type !== 'nuke' && type !== 'missile' && type !== 'lightning' && type !== 'bowling') {
            if (cd > 0.4) {
                const defaultCd = (MAX_COOLDOWNS && MAX_COOLDOWNS[type] !== undefined) ? MAX_COOLDOWNS[type] : 0;
                if (defaultCd > 2.5) {
                    const now = Date.now();
                    if (now - lastCooldownTextTime >= 1500) {
                        addFloatingText(clickX, clickY, (translations[currentLanguage] || translations['en']).cooldown || "COOLDOWN", 'rgba(255, 30, 80,', 0.8, 45, 18);
                        lastCooldownTextTime = now;
                    }
                }
                if (cd >= 1.5) {
                    const btn = document.getElementById('btn-' + type);
                    if (btn) {
                        btn.classList.remove('cooldown-alert');
                        void btn.offsetWidth; // Force reflow
                        btn.classList.add('cooldown-alert');
                        setTimeout(() => {
                            btn.classList.remove('cooldown-alert');
                        }, 650);
                    }
                }
                return;
            } else if (cd > 0) {
                weaponQueues[type] = { x: clickX, y: clickY };
                return;
            }
        }
    }

    if (type === 'lightning') return;

    totalShotsFired++;

    // Precalculate orbital angle and spawn coordinates once
    const angle = Math.atan2(clickY - CENTER_Y, clickX - CENTER_X);
    const spawnRadius = getConfigValue('gameplay.spawnDistance', 300) + 10;
    const spawnX = CENTER_X + Math.cos(angle) * spawnRadius;
    const spawnY = CENTER_Y + Math.sin(angle) * spawnRadius;

    if (type === 'laser') {
        if (laserCooldown > 0) {
            return;
        }
        // Laser hits immediately upon click/tap
        soundManager.play('sfx_laser_fire', true, 0.6);

        const impact = findLaserImpact(spawnX, spawnY);
        if (impact.local) {
            createExplosion(impact.local.x, impact.local.y, 7, 2, 'laser', false, true);
        }
        return;
    }

    if (type === 'asteroid') {
        if (asteroidCooldown > 0) {
            return;
        }
    }
    if (type === 'moon') {
        if (moonCooldown > 0) {
            return;
        }
    }
    if (type === 'nuke') {
        if (nukeCooldown > 0) {
            weaponQueues['nuke'] = { x: clickX, y: clickY };
            return;
        }
    }
    if (type === 'missile') {
        if (missileCooldown > 0) {
            weaponQueues['missile'] = { x: clickX, y: clickY };
            return;
        }
    }

    if (type === 'sword') {
        // Sword trigger: check cooldown first
        if (swordCooldown > 0) {
            return;
        }

        soundManager.play('sfx_sword_fly', true, 0.7);
        activeSwords.push({
            x: spawnX,
            y: spawnY,
            vx: Math.cos(angle + Math.PI) * -5.0,
            vy: Math.sin(angle + Math.PI) * -5.0,
            speed: -2.0,
            angle: angle + Math.PI,
            state: 'flying',
            contactX: 0,
            contactY: 0,
            targetX: 0,
            targetY: 0,
            penetrateTimer: 0,
            stuckTimer: 2.5,
            pullTimer: 0.35,
            opacity: 1.0
        });

        swordCooldown = MAX_COOLDOWNS.sword; // 10s cooldown
        return;
    }

    if (type === 'kraken') {
        if (!isWeaponUnlocked('kraken')) {
            addFloatingText(clickX, clickY, (translations[currentLanguage] || translations['en']).locked || "LOCKED");
            return;
        }
        if (krakenCooldown > 0) {
            return;
        }

        const spawnDistance = getPlanetSize() / 2 + 205;
        const krakenSpawnX = CENTER_X + Math.cos(angle) * spawnDistance;
        const krakenSpawnY = CENTER_Y + Math.sin(angle) * spawnDistance;

        soundManager.play('sfx_gamma_charge');
        activeKrakens.push({
            portalX: krakenSpawnX,
            portalY: krakenSpawnY,
            angle: angle,
            state: 'portal_opening',
            portalScale: 0.0,
            portalTimer: 0.5,
            tentacles: [],
            tentacleTimer: 0.0,
            shakeIntensity: 13,
            explosionRadius: 37
        });

        krakenCooldown = MAX_COOLDOWNS.kraken;
        return;
    }

    if (type === 'bowling') {
        if (!isWeaponUnlocked('bowling')) {
            addFloatingText(clickX, clickY, (translations[currentLanguage] || translations['en']).locked || "LOCKED");
            return;
        }
        if (bowlingCooldown > 0) {
            weaponQueues['bowling'] = { x: clickX, y: clickY };
            return;
        }

        soundManager.play('sfx_launch_heavy');
        activeBowlingBalls.push({
            x: spawnX,
            y: spawnY,
            vx: Math.cos(angle + Math.PI) * 5.0,
            vy: Math.sin(angle + Math.PI) * 5.0,
            speed: 5.0,
            angle: angle + Math.PI,
            size: 26,
            explosionRadius: 30,
            shakeIntensity: 28,
            state: 'flying',
            penetrateTimer: 0,
            stuckTimer: 2.0,
            localX: 0,
            localY: 0,
            stuckAngle: 0
        });

        if (typeof weaponAmmo !== 'undefined' && weaponAmmo[type] !== undefined) {
            weaponAmmo[type]--;
            if (typeof updateAmmoUI === 'function') {
                updateAmmoUI(type);
            }
        }

        bowlingCooldown = 0.35;
        return;
    }

    if (type === 'fist') {
        if (!isWeaponUnlocked('fist')) {
            addFloatingText(clickX, clickY, (translations[currentLanguage] || translations['en']).locked || "LOCKED");
            return;
        }
        if (fistCooldown > 0) {
            return;
        }

        const fistSpawnRadius = 550;
        const fistSpawnX = CENTER_X + Math.cos(angle) * fistSpawnRadius;
        const fistSpawnY = CENTER_Y + Math.sin(angle) * fistSpawnRadius;

        soundManager.play('sfx_launch_heavy');
        activeFists.push({
            x: fistSpawnX,
            y: fistSpawnY,
            angle: angle + Math.PI, // point towards center of planet
            vx: Math.cos(angle + Math.PI) * 1.5,
            vy: Math.sin(angle + Math.PI) * 1.5,
            width: 200, // giant fist fixed width
            state: 'flying',
            opacity: 1.0,
            timer: 0.0,
            sinkExplosions: [0.1, 0.22, 0.35, 0.5, 0.65, 0.78, 0.92], // exact trigger ratios
            ramExplosions: [0.12, 0.28, 0.45, 0.62, 0.78, 0.93],
            triggeredIdxs: new Set()
        });

        fistCooldown = MAX_COOLDOWNS.fist; // 20s cooldown
        return;
    }

    if (type === 'star') {
        if (!isWeaponUnlocked('star')) {
            addFloatingText(clickX, clickY, (translations[currentLanguage] || translations['en']).locked || "LOCKED");
            return;
        }
        if (starCooldown > 0) {
            return;
        }

        soundManager.play('sfx_magical_star_fade');

        const targetAngle = angle + Math.PI;

        activeStars.push({
            x: spawnX,
            y: spawnY,
            angle: targetAngle,
            spin: 0.0,
            timer: 0.0,
            duration: 4.0,
            projectileTimer: 0.0,
            size: 0.0,
            opacity: 1.0
        });

        starCooldown = MAX_COOLDOWNS.star;
        return;
    }

    if (type === 'comet') {
        if (!isWeaponUnlocked('comet')) {
            addFloatingText(clickX, clickY, (translations[currentLanguage] || translations['en']).locked || "LOCKED");
            return;
        }
        if (cometCooldown > 0) {
            return;
        }

        soundManager.play('sfx_launch_heavy', false, 0.65, 400);

        executeSpawn('comet', clickX, clickY);

        cometCooldown = MAX_COOLDOWNS.comet;
        return;
    }

    if (type === 'worm') {
        if (!isWeaponUnlocked('worm')) {
            addFloatingText(clickX, clickY, (translations[currentLanguage] || translations['en']).locked || "LOCKED");
            return;
        }
        if (wormCooldown > 0) {
            return;
        }

        const speed = 1.75;

        soundManager.play('sfx_black_hole_spawn');

        const segments = [];
        for (let s = 0; s < 6; s++) {
            segments.push({ x: spawnX, y: spawnY });
        }

        activeWorms.push({
            segments: segments,
            angle: angle + Math.PI,
            distanceTraveled: 0,
            damageTimer: 0,
            radius: getConfigValue('weapons.worm.radius', 55),
            size: 28,
            time: 0
        });

        wormCooldown = MAX_COOLDOWNS.worm;
        return;
    }

    if (type === 'blackhole') {
        if (blackholeCooldown > 0) {
            return;
        }

        const bhSpawnRadius = spawnRadius - 35;
        const bhSpawnX = CENTER_X + Math.cos(angle) * bhSpawnRadius;
        const bhSpawnY = CENTER_Y + Math.sin(angle) * bhSpawnRadius;

        soundManager.play('sfx_black_hole_spawn');
        soundManager.play('sfx_mystical_moon_explosion', false, 0.9);

        activeBlackHoles.push({
            x: bhSpawnX,
            y: bhSpawnY,
            angle: angle,
            time: 0,
            projectiles: [],
            chunks: [],
            size: 0,
            radius: getConfigValue('weapons.blackhole.radius', 35)
        });

        blackholeCooldown = MAX_COOLDOWNS.blackhole;
        return;
    }

    if (type === 'gamma') {
        // Gamma Burst trigger: check cooldown first
        if (gammaBurstCooldown > 0) {
            return;
        }

        soundManager.play('sfx_gamma_charge');
        soundManager.play('sfx_gamma_warning');

        activeGammaBursts.push({
            angle: angle,
            warningTime: 1.5,
            warningTimer: 0,
            beamTime: 2.0,
            strikeTimer: 0.0,
            hitsRemaining: 8,
            active: false,
            shrinking: false,
            shrinkTimer: 0.0,
            shrinkDuration: 0.35
        });

        // Set cooldown
        gammaBurstCooldown = MAX_COOLDOWNS.gamma;
        return;
    }

    if (type === 'nuke') {
        if (nukeCooldown > 0) {
            weaponQueues['nuke'] = { x: clickX, y: clickY };
            return;
        }
        executeSpawn('nuke', clickX, clickY);
        nukeCooldown = 0.36;
        return;
    }

    executeSpawn(type, clickX, clickY);
}

function executeSpawn(type, clickX, clickY) {
    if (typeof weaponAmmo !== 'undefined' && weaponAmmo[type] !== undefined) {
        weaponAmmo[type]--;
        if (typeof updateAmmoUI === 'function') {
            updateAmmoUI(type);
        }
    }
    const screenCenterX = CENTER_X;
    const screenCenterY = CENTER_Y;

    // Angle from planet center to pointer
    const angle = Math.atan2(clickY - screenCenterY, clickX - screenCenterX);

    // Spawn at fixed orbital distance
    let spawnRadius = getConfigValue('gameplay.spawnDistance', 300) + 10;
    if (type === 'moon') {
        spawnRadius += 100;
    }
    const spawnX = screenCenterX + Math.cos(angle) * spawnRadius;
    const spawnY = screenCenterY + Math.sin(angle) * spawnRadius;

    // Locked Trajectory pointing toward the center of mass in screen space at spawn instant
    const dirX = screenCenterX - spawnX;
    const dirY = screenCenterY - spawnY;
    const dist = Math.sqrt(dirX * dirX + dirY * dirY);

    const speed = getConfigValue(`weapons.${type}.speed`, type === 'missile' ? 7 : (type === 'nuke' || type === 'asteroid' || type === 'comet') ? 4 : type === 'moon' ? 1.8 : 2);
    const size = getConfigValue(`weapons.${type}.size`, type === 'missile' ? 5 : type === 'nuke' ? 9 : type === 'moon' ? 25 : type === 'comet' ? 20 : 15);
    const explosionRadius = getConfigValue(`weapons.${type}.explosionRadius`, type === 'missile' ? 12.0 : type === 'nuke' ? 20 : type === 'sword' ? 24 : type === 'moon' ? 102 : type === 'comet' ? 92 : 41);
    const shakeIntensity = getConfigValue(`weapons.${type}.shakeIntensity`, type === 'missile' ? 4.5 : type === 'nuke' ? 12 : type === 'moon' ? 32 : type === 'comet' ? 8 : 22);

    let vx = (dirX / dist) * speed;
    let vy = (dirY / dist) * speed;
    let launchAngle = angle + Math.PI;

    if (type === 'missile') {
        // Continuous random offset between -0.35 and +0.35 radians (the two extremes)
        const offsetAngle = (Math.random() * 2 - 1) * 0.35;
        launchAngle = (angle + Math.PI) + offsetAngle;
        vx = Math.cos(launchAngle) * speed;
        vy = Math.sin(launchAngle) * speed;
    }

    if (type === 'asteroid' || type === 'moon') {
        soundManager.play('sfx_launch_heavy', false, 0.55);
    } else if (type === 'nuke') {
        soundManager.play('sfx_launch_heavy', false, 0.1, 580 + 200 * Math.random());
    }

    weapons.push({
        type: type,
        x: spawnX,
        y: spawnY,
        vx: vx,
        vy: vy,
        size: size,
        explosionRadius: explosionRadius,
        shakeIntensity: shakeIntensity,
        angle: launchAngle
    });

    if (type === 'asteroid') {
        asteroidCooldown = 1.5;
    }
    if (type === 'moon') {
        moonCooldown = 15.0;
    }
    if (type === 'missile') {
        missileCooldown = 0.07;
    }
}

function generateLightningSegments(x1, y1, x2, y2) {
    const segments = [];
    segments.push({ x: x1, y: y1 });
    const dx = x2 - x1;
    const dy = y2 - y1;
    const distance = Math.sqrt(dx * dx + dy * dy);
    if (distance === 0) return [{ x: x1, y: y1 }, { x: x2, y: y2 }];

    const numSegments = Math.max(8, Math.floor(distance / 12));
    for (let i = 1; i < numSegments; i++) {
        const t = i / numSegments;
        const targetX = x1 + dx * t;
        const targetY = y1 + dy * t;

        const perpX = -dy / distance;
        const perpY = dx / distance;
        const offset = (Math.random() - 0.5) * 45 * Math.sin(t * Math.PI); // snaking arc, tapered at ends

        segments.push({
            x: targetX + perpX * offset,
            y: targetY + perpY * offset
        });
    }
    segments.push({ x: x2, y: y2 });
    return segments;
}

function fireLightning(clickX, clickY, count = 0) {
    if (victoryTriggered) return;

    totalShotsFired++; // increment shots fired when a lightning bolt is successfully shot!

    const screenCenterX = CENTER_X;
    const screenCenterY = CENTER_Y;

    const baseAngle = Math.atan2(clickY - screenCenterY, clickX - screenCenterX);

    const spawnRadius = 310;
    const spawnX = screenCenterX + Math.cos(baseAngle) * spawnRadius;
    const spawnY = screenCenterY + Math.sin(baseAngle) * spawnRadius;

    // Add erratic direction jitter so consecutive strikes branch out but target different spots nearby
    const targetAngle = baseAngle + Math.PI + (Math.random() - 0.5) * 0.6;
    const dirX = Math.cos(targetAngle);
    const dirY = Math.sin(targetAngle);

    const imgData = hiddenCtx.getImageData(0, 0, PLANET_CANVAS_SIZE, PLANET_CANVAS_SIZE);
    let impact = findLaserImpactWithData(spawnX, spawnY, imgData, dirX, dirY);
    if (!impact.local) {
        // Try a straight targetAngle pointing directly at center (0 randomness)
        const straightAngle = baseAngle + Math.PI;
        const sDirX = Math.cos(straightAngle);
        const sDirY = Math.sin(straightAngle);
        impact = findLaserImpactWithData(spawnX, spawnY, imgData, sDirX, sDirY);

        if (!impact.local) {
            impact.local = {
                x: planetCenterX,
                y: planetCenterY
            };
            impact.x = screenCenterX;
            impact.y = screenCenterY;
        }
    }

    const segments = generateLightningSegments(spawnX, spawnY, impact.x, impact.y);
    activeLightnings.push({
        segments: segments,
        life: 0.15,
        maxLife: 0.15
    });

    soundManager.play('sfx_laser_crack', false, 0.75, (Math.random() - 0.5) * 400 + 200);

    const explosionRadius = 18 + count * 3;
    const shakeIntensity = 3 + count * 3;
    createExplosion(impact.local.x, impact.local.y, explosionRadius, shakeIntensity, 'lightning', false, true);
}

// Game Update Logic
