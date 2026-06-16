// Mystery Box Update Loop Logic & Extensible Effects Registry

// A registry of arbitrary effects that can be randomly triggered
const mysteryBoxEffects = [
    {
        name: "small_explosion",
        // Effect 1: flash red for 0.15s before creating a 30 unit explosion
        trigger: function(box) {
            box.state = 'flashing_red';
            box.flashTimer = 0.15;
            box.targetExplosionSize = 30;
            box.targetShakeIntensity = 10;
            box.targetWeaponType = 'asteroid';
        }
    },
    {
        name: "large_explosion",
        // Effect 2: flash red for 0.5s before creating a 100 unit explosion
        trigger: function(box) {
            box.state = 'flashing_red';
            box.flashTimer = 0.5;
            box.targetExplosionSize = 100;
            box.targetShakeIntensity = 25;
            box.targetWeaponType = 'moon';
        }
    },
    {
        name: "freeze_area",
        // Effect 4: flash red for 0.3s before freezing 110 unit area
        trigger: function(box) {
            box.state = 'flashing_red';
            box.flashTimer = 0.3;
            box.targetExplosionSize = 110;
            box.targetShakeIntensity = 8;
            box.targetWeaponType = 'freeze';
        }
    },
    {
        name: "missile_launch",
        // Effect 3: fly up 180 units into the air (away from the center) and shoot 18 missiles
        trigger: function(box) {
            box.state = 'flying_up';
            box.flyTargetRadius = Math.sqrt((box.x - CENTER_X) * (box.x - CENTER_X) + (box.y - CENTER_Y) * (box.y - CENTER_Y)) + 180;
            box.vx = 0;
            box.vy = 0;
            box.missileTimer = 0.0;
            box.missilesFiredCount = 0;
        }
    }
];

// Extensible function to register new effects externally
function registerMysteryBoxEffect(name, triggerFn) {
    mysteryBoxEffects.push({ name: name, trigger: triggerFn });
}

function updateMysteryBoxes(deltaTime, dt60) {
    const sharedPlanetData = getSharedPlanetData();
    for (let i = activeMysteryBoxes.length - 1; i >= 0; i--) {
        const box = activeMysteryBoxes[i];

        if (box.state === 'stuck') {
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
                const effectIndex = Math.floor(Math.random() * mysteryBoxEffects.length);
                const selectedEffect = mysteryBoxEffects[effectIndex];
                if (selectedEffect && typeof selectedEffect.trigger === 'function') {
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
                } else {
                    createExplosion(localBox.x, localBox.y, radius, shake, wType, false, true);
                }
                activeMysteryBoxes.splice(i, 1);
            }
            continue;
        }

        if (box.state === 'flying_up') {
            // Fly up (away from center)
            const dxCenter = box.x - CENTER_X;
            const dyCenter = box.y - CENTER_Y;
            const distCenter = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
            let reachedTarget = false;
            if (distCenter < box.flyTargetRadius) {
                const moveSpeed = 4.0 * dt60;
                box.x += (dxCenter / distCenter) * moveSpeed;
                box.y += (dyCenter / distCenter) * moveSpeed;
            } else {
                reachedTarget = true;
            }
            box.angle += 0.2 * dt60;

            // Only fire missiles after reaching full height
            if (reachedTarget) {
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
                        explosionRadius: 12.0,
                        shakeIntensity: 4.5,
                        angle: launchAngle
                    });
                    box.missilesFiredCount++;
                }

                if (box.missilesFiredCount >= 18 && box.missileTimer >= 0.1) {
                    // Done firing!
                    activeMysteryBoxes.splice(i, 1);
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
                    createExplosion(local.x, local.y, 18, 6, 'mysterybox', false, true);
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
