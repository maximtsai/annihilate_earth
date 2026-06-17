// Mystery Box Update Loop Logic & Extensible Effects Registry

// Spawn 4-6 smoke/dust particles at the box screen position when it disappears
function spawnMysteryBoxDissipateSmoke(x, y) {
    const count = 6 + Math.floor(Math.random() * 3); // 6-8
    for (let s = 0; s < count; s++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 3.3 + 0.8);
        particles.push({
            x: x,
            y: y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            maxLife: Math.random() * 0.7 + 0.5,
            size: Math.random() * 8 + 5,
            color: '#aaaaaa',
            type: 'smoke'
        });
    }
}

// A registry of arbitrary effects that can be randomly triggered
const mysteryBoxEffects = [
    {
        name: "small_explosion",
        // Effect 1: flash red for 0.6s before creating a 50 unit explosion
        trigger: function (box) {
            box.state = 'flashing_red';
            box.flashTimer = 0.6;
            box.targetExplosionSize = 50;
            box.targetShakeIntensity = 10;
            box.targetWeaponType = 'asteroid';
        }
    },
    {
        name: "large_explosion",
        // Effect 2: flash red for 0.9s before creating a 100 unit explosion
        trigger: function (box) {
            box.state = 'flashing_red';
            box.flashTimer = 0.9;
            box.targetExplosionSize = 100;
            box.targetShakeIntensity = 25;
            box.targetWeaponType = 'moon';
        }
    },
    {
        name: "freeze_area",
        // Effect 4: flash red for 0.3s before freezing 110 unit area
        trigger: function (box) {
            box.state = 'flashing_red';
            box.flashTimer = 0.75;
            box.targetExplosionSize = 110;
            box.targetShakeIntensity = 8;
            box.targetWeaponType = 'freeze';
        }
    },
    {
        name: "missile_launch",
        // Effect 3: fly up 180 units into the air (away from the center) and shoot 18 missiles
        trigger: function (box) {
            box.state = 'flying_up';
            box.flyTargetRadius = Math.sqrt((box.x - CENTER_X) * (box.x - CENTER_X) + (box.y - CENTER_Y) * (box.y - CENTER_Y)) + 180;
            box.vx = 0;
            box.vy = 0;
            box.missileTimer = 0.0;
            box.missilesFiredCount = 0;
        }
    },
    {
        name: "nuke_drop",
        // Effect 5: fly up 180 units into the air and drop 6 nukes with 0.4s interval
        trigger: function (box) {
            box.state = 'flying_up_nukes';
            box.flyTargetRadius = Math.sqrt((box.x - CENTER_X) * (box.x - CENTER_X) + (box.y - CENTER_Y) * (box.y - CENTER_Y)) + 180;
            box.vx = 0;
            box.vy = 0;
            box.nukeTimer = 0.0;
            box.nukesDroppedCount = 0;
        }
    },
    {
        name: "worm_summon",
        // Effect 6: fly up 180 units into the air, disappear, and summon a worm
        trigger: function (box) {
            box.state = 'flying_up_worm';
            box.flyTargetRadius = Math.sqrt((box.x - CENTER_X) * (box.x - CENTER_X) + (box.y - CENTER_Y) * (box.y - CENTER_Y)) + 180;
            box.vx = 0;
            box.vy = 0;
        }
    },

    {
        name: "excalibur_effect",
        // Effect 8: fly up 180 units into the air, disappear, and summon excalibur
        trigger: function (box) {
            box.state = 'flying_up_excalibur';
            box.flyTargetRadius = Math.sqrt((box.x - CENTER_X) * (box.x - CENTER_X) + (box.y - CENTER_Y) * (box.y - CENTER_Y)) + 180;
            box.vx = 0;
            box.vy = 0;
        }
    },
    {
        name: "blackhole_summon",
        // Effect 9: fly up 180 units into the air, disappear, and summon a black hole
        trigger: function (box) {
            box.state = 'flying_up_blackhole';
            box.flyTargetRadius = Math.sqrt((box.x - CENTER_X) * (box.x - CENTER_X) + (box.y - CENTER_Y) * (box.y - CENTER_Y)) + 180;
            box.vx = 0;
            box.vy = 0;
        }
    },
    {
        name: "cthulhu_summon",
        // Effect 10: fly up 180 units into the air, disappear, and summon Cthulhu
        trigger: function (box) {
            box.state = 'flying_up_cthulhu';
            box.flyTargetRadius = Math.sqrt((box.x - CENTER_X) * (box.x - CENTER_X) + (box.y - CENTER_Y) * (box.y - CENTER_Y)) + 180;
            box.vx = 0;
            box.vy = 0;
        }
    },
    {
        name: "spinning_lasers_effect",
        // Effect 11: fly up 180 units into the air, then spin quickly and shoot 3 Tier 3 lasers for 3s
        trigger: function (box) {
            box.state = 'flying_up_lasers';
            box.flyTargetRadius = Math.sqrt((box.x - CENTER_X) * (box.x - CENTER_X) + (box.y - CENTER_Y) * (box.y - CENTER_Y)) + 180;
            box.vx = 0;
            box.vy = 0;
        }
    }
];

// Extensible function to register new effects externally
function registerMysteryBoxEffect(name, triggerFn) {
    mysteryBoxEffects.push({ name: name, trigger: triggerFn });
}

let hasSpawnedBlackHoleFromMysteryBox = false;

function updateMysteryBoxes(deltaTime, dt60) {
    const sharedPlanetData = getSharedPlanetData();
    if (!sharedPlanetData) return;
    for (let i = activeMysteryBoxes.length - 1; i >= 0; i--) {
        const box = activeMysteryBoxes[i];

        if (box.state === 'spinning_lasers') {
            box.laserDuration -= deltaTime;
            box.angle += 0.18 * dt60; // spins quickly

            box.laserLaunchTimer = box.laserLaunchTimer || 0;
            box.laserLaunchTimer += deltaTime;

            while (box.laserLaunchTimer >= 0.05) {
                const beamAngle = Math.atan2(CENTER_Y - box.y, CENTER_X - box.x);
                const impact = findLaserImpactWithData(box.x, box.y, sharedPlanetData, Math.cos(beamAngle), Math.sin(beamAngle));
                if (impact.local) {
                    createExplosion(impact.local.x, impact.local.y, 13.5, 2, 'laser', false, true);
                    if (Math.random() < 0.15) {
                        soundManager.play('sfx_laser_crack', false, 0.4, (Math.random() - 0.5) * 400 + 200);
                    }
                }
                box.laserLaunchTimer -= 0.05;
            }

            if (box.laserDuration <= 0) {
                // Check if any other box is still shooting lasers
                const othersShooting = activeMysteryBoxes.some(other => other !== box && other.state === 'spinning_lasers');
                if (!othersShooting) {
                    soundManager.stopLoop('sfx_laser_fire');
                }
                spawnMysteryBoxDissipateSmoke(box);
                activeMysteryBoxes.splice(i, 1);
            }
            continue;
        }

        if (box.state === 'stuck') {
            // Check if terrain underneath is still solid
            const px = Math.floor(box.localX);
            const py = Math.floor(box.localY);
            if (px < 0 || px >= PLANET_CANVAS_SIZE || py < 0 || py >= PLANET_CANVAS_SIZE || !isSolidPixel(px, py, sharedPlanetData)) {
                // Terrain is destroyed, fall back down under gravity!
                box.state = undefined;
                box.vx = 0;
                box.vy = 0;
                continue;
            }

            // Follow planet rotation exactly
            const cos = Math.cos(planetRotation);
            const sin = Math.sin(planetRotation);
            const dxLocal = box.localX - planetCenterX;
            const dyLocal = box.localY - planetCenterY;
            box.x = CENTER_X + (dxLocal * cos - dyLocal * sin);
            box.y = CENTER_Y + (dxLocal * sin + dyLocal * cos);
            box.angle = box.stuckAngle + planetRotation;

            // Check if an active explosion overlaps this box to trigger it
            let triggered = false;
            for (let pIdx = 0; pIdx < particles.pool.length; pIdx++) {
                const p = particles.pool[pIdx];
                if (p.active && (p.type === 'explosion_ring' || p.type === 'circular_flash')) {
                    const pDx = p.x - box.x;
                    const pDy = p.y - box.y;
                    const pDist = Math.sqrt(pDx * pDx + pDy * pDy);
                    if (pDist < p.size + 15) { // within explosion radius + offset
                        triggered = true;
                        break;
                    }
                }
            }

            if (triggered) {
                // Trigger one of the registered effects at random!
                let effectIndex = Math.floor(Math.random() * mysteryBoxEffects.length);
                let selectedEffect = mysteryBoxEffects[effectIndex];

                if (selectedEffect && selectedEffect.name === 'blackhole_summon' && !hasSpawnedBlackHoleFromMysteryBox) {
                    const otherEffects = mysteryBoxEffects.filter(e => e.name !== 'blackhole_summon');
                    if (otherEffects.length > 0) {
                        const altIndex = Math.floor(Math.random() * otherEffects.length);
                        selectedEffect = otherEffects[altIndex];
                    }
                }

                if (selectedEffect && typeof selectedEffect.trigger === 'function') {
                    console.log(`[MysteryBox] Triggered effect: ${selectedEffect.name}`);
                    if (selectedEffect.name === 'blackhole_summon') {
                        hasSpawnedBlackHoleFromMysteryBox = true;
                    }
                    selectedEffect.trigger(box);
                }
            }
            continue;
        }

        if (box.state === 'flashing_red') {
            box.flashTimer -= deltaTime;
            // Keep sticking while flashing
            const cos = Math.cos(planetRotation);
            const sin = Math.sin(planetRotation);
            const dxLocal = box.localX - planetCenterX;
            const dyLocal = box.localY - planetCenterY;
            box.x = CENTER_X + (dxLocal * cos - dyLocal * sin);
            box.y = CENTER_Y + (dxLocal * sin + dyLocal * cos);
            box.angle = box.stuckAngle + planetRotation;

            if (box.flashTimer <= 0) {
                const localBox = screenToLocal(box.x, box.y, CENTER_X, CENTER_Y, planetRotation);
                const radius = box.targetExplosionSize || 100;
                const shake = box.targetShakeIntensity || 25;
                const wType = box.targetWeaponType || 'moon';

                if (wType === 'freeze') {
                    freezeArea(localBox.x, localBox.y, radius);
                    soundManager.play('sfx_freeze', false, 1.0);

                    // Visual effects for freeze: ice circular ring and glowing blue particles
                    const cosRot = Math.cos(planetRotation);
                    const sinRot = Math.sin(planetRotation);
                    const rX = localBox.x - planetCenterX;
                    const rY = localBox.y - planetCenterY;
                    const impactScreenX = CENTER_X + (rX * cosRot - rY * sinRot);
                    const impactScreenY = CENTER_Y + (rX * sinRot + rY * cosRot);

                    shockwaves.push({
                        x: impactScreenX,
                        y: impactScreenY,
                        radius: 0,
                        maxRadius: radius * 3.6,
                        life: 1.0,
                        maxLife: 0.6
                    });
                    particles.push({
                        x: impactScreenX, y: impactScreenY,
                        vx: 0, vy: 0, life: 1.0, maxLife: 0.41,
                        size: radius * 1.3,
                        color: 'rgba(0, 217, 255, 0.85)',
                        type: 'explosion_ring',
                        isComet: true
                    });
                    particles.push({
                        x: impactScreenX, y: impactScreenY,
                        vx: 0, vy: 0, life: 1.0, maxLife: 0.16,
                        size: radius * 2.25,
                        color: '0, 217, 255',
                        type: 'circular_flash'
                    });

                    for (let pIdx = 0; pIdx < 35; pIdx++) {
                        const angle = Math.random() * Math.PI * 2;
                        const speed = Math.random() * 5 + 3;
                        particles.push({
                            x: impactScreenX,
                            y: impactScreenY,
                            vx: Math.cos(angle) * speed,
                            vy: Math.sin(angle) * speed,
                            life: 1.0,
                            maxLife: Math.random() * 0.8 + 0.6,
                            size: Math.random() * 5 + 3,
                            color: Math.random() < 0.6 ? '#66b2ff' : '#00f0ff',
                            type: Math.random() > 0.6 ? 'fire' : 'smoke'
                        });
                    }
                } else if (wType === 'gamma_burst_trigger') {
                    // Explode with 20 unit explosion
                    createExplosion(localBox.x, localBox.y, radius, shake, 'asteroid', false, true);

                    // Summon gamma burst
                    const angle = Math.atan2(box.y - CENTER_Y, box.x - CENTER_X);
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
                } else {
                    createExplosion(localBox.x, localBox.y, radius, shake, wType, false, true);
                }
                activeMysteryBoxes.splice(i, 1);
            }
            continue;
        }

        if (box.state === 'flying_up' || box.state === 'flying_up_nukes' || box.state === 'flying_up_worm' || box.state === 'flying_up_blackhole' || box.state === 'flying_up_excalibur' || box.state === 'flying_up_cthulhu' || box.state === 'flying_up_lasers') {
            // Fly up (away from center)
            const dxCenter = box.x - CENTER_X;
            const dyCenter = box.y - CENTER_Y;
            const distCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
            let reachedTarget = false;
            if (distCenter < box.flyTargetRadius) {
                const moveSpeed = 3.5 * dt60;
                box.x += (dxCenter / distCenter) * moveSpeed;
                box.y += (dyCenter / distCenter) * moveSpeed;
            } else {
                reachedTarget = true;
            }
            box.angle += 0.2 * dt60;

            // Only fire / summon after reaching full height
            if (reachedTarget) {
                if (box.state === 'flying_up') {
                    box.missileTimer += deltaTime;
                    const interval = 1.5 / 18;
                    if (box.missileTimer >= interval && box.missilesFiredCount < 18) {
                        box.missileTimer -= interval;
                        // Fire a missile in a specific direction (circle sequence)
                        const angleStep = (Math.PI * 2) / 18;
                        const launchAngle = box.missilesFiredCount * angleStep;

                        soundManager.play('sfx_launch_heavy', false, 0.2, 800 + Math.random() * 400);
                        weapons.push({
                            type: 'missile',
                            x: box.x,
                            y: box.y,
                            vx: Math.cos(launchAngle) * 7.0,
                            vy: Math.sin(launchAngle) * 7.0,
                            size: 5,
                            explosionRadius: 11.0,
                            shakeIntensity: 4.5,
                            angle: launchAngle
                        });
                        box.missilesFiredCount++;
                    }

                    if (box.missilesFiredCount >= 18 && box.missileTimer >= 0.1) {
                        // Done firing!
                        spawnMysteryBoxDissipateSmoke(box.x, box.y);
                        activeMysteryBoxes.splice(i, 1);
                    }
                } else if (box.state === 'flying_up_nukes') {
                    box.nukeTimer += deltaTime;
                    const interval = 0.4;
                    if (box.nukeTimer >= interval && box.nukesDroppedCount < 6) {
                        box.nukeTimer -= interval;

                        const angle = Math.atan2(box.y - CENTER_Y, box.x - CENTER_X);
                        const dirX = CENTER_X - box.x;
                        const dirY = CENTER_Y - box.y;
                        const dist = Math.sqrt(dirX * dirX + dirY * dirY);
                        const speed = getConfigValue('weapons.nuke.speed', 4);
                        const size = getConfigValue('weapons.nuke.size', 9);
                        const explosionRadius = getConfigValue('weapons.nuke.explosionRadius', 20);
                        const shakeIntensity = getConfigValue('weapons.nuke.shakeIntensity', 12);
                        const vx = (dirX / dist) * speed;
                        const vy = (dirY / dist) * speed;
                        const launchAngle = angle + Math.PI;

                        soundManager.play('sfx_launch_heavy', false, 0.1, 580 + 200 * Math.random());
                        weapons.push({
                            type: 'nuke',
                            x: box.x,
                            y: box.y,
                            vx: vx,
                            vy: vy,
                            size: size,
                            explosionRadius: explosionRadius,
                            shakeIntensity: shakeIntensity,
                            angle: launchAngle
                        });
                        box.nukesDroppedCount++;
                    }

                    if (box.nukesDroppedCount >= 6 && box.nukeTimer >= 0.1) {
                        // Done dropping nukes!
                        spawnMysteryBoxDissipateSmoke(box.x, box.y);
                        activeMysteryBoxes.splice(i, 1);
                    }
                } else if (box.state === 'flying_up_worm') {
                    // Summon a worm (identical behavior to worm weapon spawn)
                    const angle = Math.atan2(box.y - CENTER_Y, box.x - CENTER_X);
                    const segments = [];
                    for (let s = 0; s < 6; s++) {
                        segments.push({ x: box.x, y: box.y });
                    }

                    soundManager.play('sfx_black_hole_spawn');
                    activeWorms.push({
                        segments: segments,
                        angle: angle + Math.PI,
                        distanceTraveled: 0,
                        damageTimer: 0,
                        radius: getConfigValue('weapons.worm.radius', 55),
                        size: 28,
                        time: 0
                    });

                    // Disappear immediately
                    spawnMysteryBoxDissipateSmoke(box.x, box.y);
                    activeMysteryBoxes.splice(i, 1);
                } else if (box.state === 'flying_up_blackhole') {
                    // Summon a black hole
                    const angle = Math.atan2(box.y - CENTER_Y, box.x - CENTER_X);
                    soundManager.play('sfx_black_hole_spawn');
                    soundManager.play('sfx_mystical_moon_explosion', false, 0.8);
                    soundManager.play('sfx_lightning', false, 0.5);

                    // Create a large circle in effect (imploding shockwave)
                    shockwaves.push({
                        x: box.x,
                        y: box.y,
                        radius: 250,
                        maxRadius: 0,
                        life: 1.0,
                        maxLife: 0.6
                    });

                    activeBlackHoles.push({
                        x: box.x,
                        y: box.y,
                        angle: angle,
                        time: 0,
                        projectiles: [],
                        chunks: [],
                        size: 0,
                        radius: getConfigValue('weapons.blackhole.radius', 35)
                    });

                    // Disappear immediately
                    spawnMysteryBoxDissipateSmoke(box.x, box.y);
                    activeMysteryBoxes.splice(i, 1);
                } else if (box.state === 'flying_up_excalibur') {
                    // Summon Excalibur in orbit, pointing towards center of planet
                    const angle = Math.atan2(box.y - CENTER_Y, box.x - CENTER_X);
                    const spawnRadius = getConfigValue('gameplay.spawnDistance', 300) + 10;
                    const spawnX = CENTER_X + Math.cos(angle) * spawnRadius;
                    const spawnY = CENTER_Y + Math.sin(angle) * spawnRadius;

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
                        opacity: 1.0,
                        lastDistanceSq: null
                    });

                    // Disappear immediately
                    spawnMysteryBoxDissipateSmoke(box.x, box.y);
                    activeMysteryBoxes.splice(i, 1);
                } else if (box.state === 'flying_up_cthulhu') {
                    // Summon Cthulhu (identical behavior to Cthulhu / Kraken weapon spawn)
                    const angle = Math.atan2(box.y - CENTER_Y, box.x - CENTER_X);
                    soundManager.play('sfx_gamma_charge');
                    soundManager.play('sfx_void_body');
                    activeKrakens.push({
                        portalX: box.x,
                        portalY: box.y,
                        angle: angle,
                        state: 'portal_opening',
                        portalScale: 0.0,
                        portalTimer: 0.5,
                        tentacles: [],
                        tentacleTimer: 0.0,
                        shakeIntensity: 13,
                        explosionRadius: 37
                    });

                    // Disappear immediately
                    spawnMysteryBoxDissipateSmoke(box.x, box.y);
                    activeMysteryBoxes.splice(i, 1);
                } else if (box.state === 'flying_up_lasers') {
                    box.state = 'spinning_lasers';
                    box.laserDuration = 3.0; // 3 seconds
                    box.laserLaunchTimer = 0.0;
                    soundManager.play('sfx_laser_fire', true, 0.6);
                }
            }
            continue;
        }

        // 1. Gravity (pulls towards the center of planet)
        const dx = CENTER_X - box.x;
        const dy = CENTER_Y - box.y;
        const dist = Math.sqrt(dx * dx + dy * dy);
        if (dist > 0) {
            const gravityStrength = 0.15 * dt60;
            box.vx += (dx / dist) * gravityStrength;
            box.vy += (dy / dist) * gravityStrength;
        }

        // Apply velocities
        box.x += box.vx * dt60;
        box.y += box.vy * dt60;
        box.angle += box.angularVelocity * dt60;

        // Apply light drag to angular velocity
        box.angularVelocity *= Math.pow(0.98, dt60);

        // 2. Collision detection using screenToLocal & isSolidPixel
        const local = screenToLocal(box.x, box.y, CENTER_X, CENTER_Y, planetRotation);
        const px = Math.floor(local.x);
        const py = Math.floor(local.y);

        if (px >= 0 && px < PLANET_CANVAS_SIZE && py >= 0 && py < PLANET_CANVAS_SIZE) {
            if (isSolidPixel(px, py, sharedPlanetData)) {
                // Terrain collision!
                if (!box.hasExploded) {
                    box.hasExploded = true;
                    box.firstLandTime = performance.now();
                    createExplosion(local.x, local.y, 14, 6, 'mysterybox', false, true);
                } else if (performance.now() - box.firstLandTime >= 200) {
                    // 0.2s after landing once, the next time it comes in contact, it becomes stuck!
                    box.state = 'stuck';
                    const localStuck = screenToLocal(box.x, box.y, CENTER_X, CENTER_Y, planetRotation);
                    box.localX = localStuck.x;
                    box.localY = localStuck.y;
                    box.stuckAngle = box.angle - planetRotation;
                    box.vx = 0;
                    box.vy = 0;
                    box.angularVelocity = 0;
                    continue;
                }

                // Bounce logic
                const nx = (box.x - CENTER_X) / dist;
                const ny = (box.y - CENTER_Y) / dist;

                // Dot product of velocity and normal
                const dot = box.vx * nx + box.vy * ny;

                if (dot < 0) {
                    // Moving inwards: bounce!
                    const restitution = 0.5; // bounce energy loss
                    box.vx = (box.vx - 2 * dot * nx) * restitution;
                    box.vy = (box.vy - 2 * dot * ny) * restitution;

                    // Add some friction-induced spin
                    const tangX = -ny;
                    const tangY = nx;
                    const tangVelocity = box.vx * tangX + box.vy * tangY;
                    box.angularVelocity += tangVelocity * 0.01;

                    // Push box slightly out of the terrain along the normal to prevent sticking
                    box.x = CENTER_X + nx * (dist + 3);
                    box.y = CENTER_Y + ny * (dist + 3);

                    soundManager.play('sfx_ui_switch', false, 0.4, 600 + Math.random() * 400);
                }
            }
        }

        // Remove if out of bounds (too far)
        if (dist > 1000) {
            activeMysteryBoxes.splice(i, 1);
        }
    }
}
