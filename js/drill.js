// Drill Update Loop & Drawing Logic

function updateDrills(deltaTime, dt60) {
    const sharedPlanetData = getSharedPlanetData();
    if (!sharedPlanetData) return;

    for (let i = activeDrills.length - 1; i >= 0; i--) {
        const drill = activeDrills[i];

        // 1. Timers tick down continuously from creation
        if (drill.state === 'drilling' || drill.state === 'falling') {
            drill.drillTimer -= deltaTime;

            // Only emit mini-explosions if the drill has already impacted
            if (drill.hasImpacted) {
                drill.explosionTimer -= deltaTime;
                if (drill.explosionTimer <= 0) {
                    const interval = getConfigValue('weapons.drill.explosionInterval', 0.15);
                    const size = getConfigValue('weapons.drill.explosionSize', 10);
                    drill.explosionTimer = interval;

                    // Create explosion at the tip of the drill
                    const tipX = drill.x + Math.cos(drill.angle) * 12;
                    const tipY = drill.y + Math.sin(drill.angle) * 12;
                    const localTip = screenToLocal(tipX, tipY, CENTER_X, CENTER_Y, planetRotation);

                    createExplosion(localTip.x, localTip.y, size, 3, 'drill', false, true);

                    // Drilling sound effect
                    soundManager.play('sfx_ui_switch', false, 0.3, 300 + Math.random() * 300);
                }
            }

            if (drill.drillTimer <= 0) {
                drill.state = 'anticipation';
                drill.anticipationTimer = 0.9;
            }
        } else if (drill.state === 'anticipation') {
            drill.anticipationTimer -= deltaTime;

            if (drill.anticipationTimer <= 0) {
                // Final detonation: 54px radius explosion (using asteroid type for big impact sound)
                const local = screenToLocal(drill.x, drill.y, CENTER_X, CENTER_Y, planetRotation);
                createExplosion(local.x, local.y, 54, 25, 'asteroid', false, true);

                // Remove the drill from play
                activeDrills.splice(i, 1);
                continue;
            }
        }

        // 2. Physics & State updates
        if (drill.state === 'falling') {
            // If the drill has already impacted, rotate its position and velocity with the planet
            if (drill.hasImpacted) {
                drill.lastPlanetRotation = drill.lastPlanetRotation || planetRotation;
                const dTheta = planetRotation - drill.lastPlanetRotation;
                if (dTheta !== 0) {
                    const dx = drill.x - CENTER_X;
                    const dy = drill.y - CENTER_Y;
                    const cos = Math.cos(dTheta);
                    const sin = Math.sin(dTheta);
                    drill.x = CENTER_X + (dx * cos - dy * sin);
                    drill.y = CENTER_Y + (dx * sin + dy * cos);

                    const vx = drill.vx;
                    const vy = drill.vy;
                    drill.vx = vx * cos - vy * sin;
                    drill.vy = vx * sin + vy * cos;
                }
            }
            drill.lastPlanetRotation = planetRotation;

            // Gravity (pulls towards the center of planet)
            const dx = CENTER_X - drill.x;
            const dy = CENTER_Y - drill.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > 0) {
                const gravityStrength = 0.35 * dt60;
                drill.vx += (dx / dist) * gravityStrength;
                drill.vy += (dy / dist) * gravityStrength;
            }

            // Apply velocities
            drill.x += drill.vx * dt60;
            drill.y += drill.vy * dt60;

            // Collision detection at the tip of the drill (12 units ahead of center)
            const tipAngle = Math.atan2(CENTER_Y - drill.y, CENTER_X - drill.x);
            const tipX = drill.x + Math.cos(tipAngle) * 12;
            const tipY = drill.y + Math.sin(tipAngle) * 12;
            const local = screenToLocal(tipX, tipY, CENTER_X, CENTER_Y, planetRotation);
            const px = Math.floor(local.x);
            const py = Math.floor(local.y);

            if (px >= 0 && px < PLANET_CANVAS_SIZE && py >= 0 && py < PLANET_CANVAS_SIZE) {
                if (isSolidPixel(px, py, sharedPlanetData)) {
                    // Transition to drilling or anticipation
                    drill.hasImpacted = true;
                    drill.state = drill.drillTimer > 0 ? 'drilling' : 'anticipation';
                    // if (drill.state === 'drilling') {
                    //     soundManager.play('sfx_laser_fire', false, 0.4);
                    // }

                    // Save stuck local coordinate
                    const localStuck = screenToLocal(drill.x, drill.y, CENTER_X, CENTER_Y, planetRotation);
                    drill.localX = localStuck.x;
                    drill.localY = localStuck.y;
                    drill.vx = 0;
                    drill.vy = 0;
                }
            }
        } else {
            // Keep tracking planet rotation for when it falls
            drill.lastPlanetRotation = planetRotation;

            // Stuck to the planet, follow planet rotation
            const cos = Math.cos(planetRotation);
            const sin = Math.sin(planetRotation);
            const dxLocal = drill.localX - planetCenterX;
            const dyLocal = drill.localY - planetCenterY;
            drill.x = CENTER_X + (dxLocal * cos - dyLocal * sin);
            drill.y = CENTER_Y + (dxLocal * sin + dyLocal * cos);

            // Check if terrain underneath the drill body is destroyed (meaning it should fall again)
            if (drill.state === 'drilling') {
                const localCheck = screenToLocal(drill.x, drill.y, CENTER_X, CENTER_Y, planetRotation);
                const pxCheck = Math.floor(localCheck.x);
                const pyCheck = Math.floor(localCheck.y);

                if (pxCheck < 0 || pxCheck >= PLANET_CANVAS_SIZE || pyCheck < 0 || pyCheck >= PLANET_CANVAS_SIZE || !isSolidPixel(pxCheck, pyCheck, sharedPlanetData)) {
                    // Ground destroyed! Fall back down
                    drill.state = 'falling';
                    drill.vx = 0;
                    drill.vy = 0;
                    continue;
                }
            }
        }

        // Centralized angle calculation: always point to the center of the planet
        drill.angle = Math.atan2(CENTER_Y - drill.y, CENTER_X - drill.x);
    }
}

function drawDrill(ctx, drill) {
    ctx.save();
    ctx.translate(drill.x, drill.y);
    ctx.rotate(drill.angle);

    // Vibration effect while actively drilling or in anticipation
    if (drill.state === 'drilling' || drill.state === 'anticipation') {
        const jitterX = (Math.random() - 0.5) * (drill.state === 'anticipation' ? 2.5 : 1.5);
        const jitterY = (Math.random() - 0.5) * (drill.state === 'anticipation' ? 2.5 : 1.5);
        ctx.translate(jitterX, jitterY);
    }

    // Determine if flashing red during anticipation
    let isRed = false;
    if (drill.state === 'anticipation') {
        isRed = Math.floor(drill.anticipationTimer / 0.08) % 2 === 0;
    }

    // 1. Draw Drill Body (Rear part, rectangle with 3D gradient)
    const bodyGrad = ctx.createLinearGradient(0, -10, 0, 10);
    if (isRed) {
        bodyGrad.addColorStop(0, '#d32f2f');
        bodyGrad.addColorStop(0.4, '#ff5252');
        bodyGrad.addColorStop(0.6, '#f44336');
        bodyGrad.addColorStop(1, '#b71c1c');
    } else {
        bodyGrad.addColorStop(0, '#fbc02d');
        bodyGrad.addColorStop(0.4, '#ffeb3b');
        bodyGrad.addColorStop(0.6, '#fdd835');
        bodyGrad.addColorStop(1, '#f57f17');
    }
    ctx.fillStyle = bodyGrad;
    ctx.fillRect(-16, -10, 16, 20);

    // 2. Draw Screw Threads (Diagonal scrolling lines)
    ctx.strokeStyle = isRed ? '#ffffff' : '#37474f';
    ctx.lineWidth = 1.8;
    const threadOffset = drill.state === 'drilling' ? (performance.now() * 0.05) % 8 : 0;
    ctx.save();
    ctx.beginPath();
    ctx.rect(-16, -10, 16, 20);
    ctx.clip(); // Restrict thread drawing to body bounds

    ctx.beginPath();
    for (let x = -32; x < 16; x += 6) {
        ctx.moveTo(x + threadOffset, -11);
        ctx.lineTo(x + threadOffset + 4, 11);
    }
    ctx.stroke();
    ctx.restore();

    // 3. Draw Drill Tip (Cone pointing forward)
    const tipGrad = ctx.createLinearGradient(0, -12, 0, 12);
    if (isRed) {
        tipGrad.addColorStop(0, '#ff1744');
        tipGrad.addColorStop(0.5, '#ff8a80');
        tipGrad.addColorStop(1, '#b71c1c');
    } else {
        tipGrad.addColorStop(0, '#b0bec5');
        tipGrad.addColorStop(0.5, '#eceff1');
        tipGrad.addColorStop(1, '#37474f');
    }
    ctx.fillStyle = tipGrad;

    ctx.beginPath();
    ctx.moveTo(0, -12);
    ctx.lineTo(12, 0); // Pointy tip
    ctx.lineTo(0, 12);
    ctx.closePath();
    ctx.fill();

    // 4. Draw Friction Heat Glow or Anticipation Ring
    if (drill.state === 'drilling') {
        ctx.fillStyle = 'rgba(255, 150, 0, ' + (0.4 + Math.random() * 0.4) + ')';
        ctx.beginPath();
        ctx.arc(12, 0, 6 + Math.random() * 4, 0, Math.PI * 2);
        ctx.fill();
    }

    // Draw the 54px dotted anticipation circle
    if (drill.state === 'anticipation') {
        const progress = (0.9 - drill.anticipationTimer) / 0.9;
        const opacity = 0.2 + 0.8 * Math.min(1, Math.max(0, progress));

        ctx.save();
        ctx.strokeStyle = `rgba(255, 0, 0, ${opacity})`;
        ctx.lineWidth = 3.0;
        ctx.setLineDash([4, 4]); // Dotted circle
        ctx.beginPath();
        ctx.arc(0, 0, 54, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();
    }

    ctx.restore();
}
