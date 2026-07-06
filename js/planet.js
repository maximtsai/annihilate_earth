// Planet Procedural Generation & Destruction Logic
let collapseRayCache = null;
let collapseRayCacheNumRays = 0;
// Generate space starfield background
function generateStars() {
    stars = [];
    const starCount = getConfigValue('visual.starDensity', 120);
    for (let i = 0; i < starCount; i++) {
        stars.push({
            x: Math.random() * 2000 - 200, // Wider range to cover zoom out
            y: Math.random() * 1300 - 200, // Wider range to cover zoom out
            size: Math.random() * 2 + 0.6,
            opacity: Math.random() * 0.6 + 0.4,
            twinkleSpeed: Math.random() * 0.02 + 0.005
        });
    }
}

// Generate realistic procedural Earth textures
function initializePlanet() {
    hiddenCtx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);

    const d = getPlanetSize();
    const radius = d / 2;
    const cx = hiddenCanvas.width / 2;
    const cy = hiddenCanvas.height / 2;

    const imgData = hiddenCtx.createImageData(hiddenCanvas.width, hiddenCanvas.height);
    const data = imgData.data;

    seedX = Math.random() * 1000;
    seedY = Math.random() * 1000;
    const cloudSeedX = Math.random() * 1000;
    const cloudSeedY = Math.random() * 1000;

    for (let y = 0; y < hiddenCanvas.height; y++) {
        for (let x = 0; x < hiddenCanvas.width; x++) {
            const dx = x - cx;
            const dy = y - cy;
            const dist = Math.sqrt(dx * dx + dy * dy);

            if (dist <= radius) {
                const idx = (y * hiddenCanvas.width + x) * 4;

                // 3D Spherical Coordinate Projection (maps flat circle to 3D sphere)
                const nx = dx / radius;
                const ny = dy / radius;

                const noiseX = nx * 3.6 + seedX;
                const noiseY = ny * 3.6 + seedY;
                const noiseVal = fbm(noiseX, noiseY, 5);

                let r = 0, g = 0, b = 0;

                if (currentPlanet === 'earth') {
                    if (noiseVal < 0.49) {
                        // Deep Ocean (lightened to a vibrant royal blue)
                        r = 30; g = 70; b = 145;
                    } else if (noiseVal < 0.53) {
                        // Shallow Waters / Coastlines (lightened to a gorgeous tropical cyan)
                        const t = (noiseVal - 0.49) / 0.04;
                        r = Math.floor(30 + t * 40);
                        g = Math.floor(70 + t * 112);
                        b = Math.floor(145 + t * 98);
                    } else if (noiseVal < 0.55) {
                        // Sandy Beach
                        r = 220; g = 195; b = 145;
                    } else if (noiseVal < 0.67) {
                        // Lush Land / Forest
                        const t = (noiseVal - 0.55) / 0.12;
                        r = Math.floor(35 + t * 23);
                        g = Math.floor(126 + t * -24);
                        b = Math.floor(51 + t * -12);
                    } else if (noiseVal < 0.77) {
                        // Mountain Ridges
                        const t = (noiseVal - 0.67) / 0.10;
                        r = Math.floor(97 - t * 16);
                        g = Math.floor(82 - t * 16);
                        b = Math.floor(71 - t * 16);
                    } else {
                        // Polar Ice / Snow Peaks
                        r = 250; g = 250; b = 252;
                    }

                    // Cloud Layer fBm overlay
                    const cloudX = nx * 6.0 + cloudSeedX;
                    const cloudY = ny * 6.0 + cloudSeedY;
                    const cloudVal = fbm(cloudX, cloudY, 4);
                    if (cloudVal > 0.55) {
                        const cloudOpacity = Math.min((cloudVal - 0.55) / 0.18, 0.85);
                        r = Math.floor(r * (1 - cloudOpacity) + 255 * cloudOpacity);
                        g = Math.floor(g * (1 - cloudOpacity) + 255 * cloudOpacity);
                        b = Math.floor(b * (1 - cloudOpacity) + 255 * cloudOpacity);
                    }
                } else if (currentPlanet === 'mars') {
                    // Mars target procedural generation
                    if (Math.abs(ny) > 0.8 + (noiseVal * 0.08)) {
                        // Carbon Dioxide Polar Ice Cap (cool off-white pinkish)
                        r = 245; g = 230; b = 235;
                    } else {
                        // Martian geological layers
                        if (noiseVal < 0.44) {
                            // Dark volcanic basalt plains
                            r = 85; g = 38; b = 27;
                        } else if (noiseVal < 0.52) {
                            // Medium iron oxide plains
                            const t = (noiseVal - 0.44) / 0.08;
                            r = Math.floor(85 + t * 45);
                            g = Math.floor(38 + t * 20);
                            b = Math.floor(27 + t * 8);
                        } else if (noiseVal < 0.72) {
                            // Classic iron oxide highlands
                            const t = (noiseVal - 0.52) / 0.20;
                            r = Math.floor(130 + t * 75);
                            g = Math.floor(58 + t * 32);
                            b = Math.floor(35 + t * 13);
                        } else {
                            // Bright light orange desert dunes
                            const t = (noiseVal - 0.72) / 0.28;
                            r = Math.floor(205 + t * 25);
                            g = Math.floor(90 + t * 30);
                            b = Math.floor(48 + t * 12);
                        }
                    }

                    // Secondary fBm dust storm haze overlay
                    const hazeX = nx * 3.5 + cloudSeedX;
                    const hazeY = ny * 3.5 + cloudSeedY;
                    const hazeVal = fbm(hazeX, hazeY, 4);
                    if (hazeVal > 0.55) {
                        const hazeOpacity = Math.min((hazeVal - 0.55) / 0.22, 0.4);
                        r = Math.floor(r * (1 - hazeOpacity) + 240 * hazeOpacity);
                        g = Math.floor(g * (1 - hazeOpacity) + 160 * hazeOpacity);
                        b = Math.floor(b * (1 - hazeOpacity) + 110 * hazeOpacity);
                    }
                } else if (currentPlanet === 'neptune') {
                    // Neptune (Ice Giant) - Deep cobalt, royal blue, ice white currents (brightened!)
                    if (noiseVal < 0.4) {
                        // Deep cobalt storm bands
                        r = 25; g = 55; b = 150;
                    } else if (noiseVal < 0.65) {
                        // Main royal blue winds
                        const t = (noiseVal - 0.4) / 0.25;
                        r = Math.floor(25 + t * 25);
                        g = Math.floor(55 + t * 65);
                        b = Math.floor(150 + t * 75);
                    } else if (noiseVal < 0.8) {
                        // High-velocity electric cyan currents
                        const t = (noiseVal - 0.65) / 0.15;
                        r = Math.floor(50 + t * 30);
                        g = Math.floor(120 + t * 90);
                        b = Math.floor(225 + t * 30);
                    } else {
                        // Frosty methane clouds
                        const t = (noiseVal - 0.8) / 0.2;
                        r = Math.floor(80 + t * 145);
                        g = Math.floor(210 + t * 45);
                        b = 255;
                    }

                    // Ice haze mist overlay
                    const cloudX = nx * 3.8 + cloudSeedX;
                    const cloudY = ny * 3.8 + cloudSeedY;
                    const cloudVal = fbm(cloudX, cloudY, 4);
                    if (cloudVal > 0.54) {
                        const cloudOpacity = Math.min((cloudVal - 0.54) / 0.2, 0.45);
                        r = Math.floor(r * (1 - cloudOpacity) + 180 * cloudOpacity);
                        g = Math.floor(g * (1 - cloudOpacity) + 225 * cloudOpacity);
                        b = Math.floor(b * (1 - cloudOpacity) + 255 * cloudOpacity);
                    }
                } else if (currentPlanet === 'jupiter') {
                    // Jupiter (Gas Giant) - Alternating creamy/rusty bands & Great Red Spot
                    const lat = Math.sin(ny * 12 + noiseVal * 1.5);
                    if (lat < -0.4) {
                        // Dark chocolate brown belts
                        r = 105; g = 65; b = 45;
                    } else if (lat < 0.1) {
                        // Warm copper rust belts
                        const t = (lat - (-0.4)) / 0.5;
                        r = Math.floor(105 + t * 70);
                        g = Math.floor(65 + t * 40);
                        b = Math.floor(45 + t * 20);
                    } else if (lat < 0.6) {
                        // Cream tan zones
                        const t = (lat - 0.1) / 0.5;
                        r = Math.floor(175 + t * 50);
                        g = Math.floor(105 + t * 90);
                        b = Math.floor(65 + t * 95);
                    } else {
                        // Polar grey/brown bands
                        const t = (lat - 0.6) / 0.4;
                        r = Math.floor(225 - t * 80);
                        g = Math.floor(195 - t * 75);
                        b = Math.floor(160 - t * 65);
                    }

                    // Blend Jupiter's Great Red Spot storm (Southern hemisphere)
                    const spotDistX = (nx - 0.2) / 0.18;
                    const spotDistY = (ny - 0.35) / 0.12;
                    const spotDist = Math.sqrt(spotDistX * spotDistX + spotDistY * spotDistY);
                    if (spotDist < 1.0) {
                        const blend = Math.max(0, 1.0 - spotDist);
                        r = Math.floor(r * (1 - blend) + 185 * blend);
                        g = Math.floor(g * (1 - blend) + 40 * blend);
                        b = Math.floor(b * (1 - blend) + 30 * blend);
                    }
                    // Secondary atmospheric wind storm swirls
                    const swirlX = nx * 4.5 + cloudSeedX;
                    const swirlY = ny * 4.5 + cloudSeedY;
                    const swirlVal = fbm(swirlX, swirlY, 4);
                    if (swirlVal > 0.55) {
                        const swirlOpacity = Math.min((swirlVal - 0.55) / 0.22, 0.35);
                        r = Math.floor(r * (1 - swirlOpacity) + 245 * swirlOpacity);
                        g = Math.floor(g * (1 - swirlOpacity) + 200 * swirlOpacity);
                        b = Math.floor(b * (1 - swirlOpacity) + 175 * swirlOpacity);
                    }
                } else if (currentPlanet === 'sun') {
                    // Boiling convective granules & sunspots
                    // Shrunk dark sunspots (threshold lowered from 0.38 to 0.26 and base brightness increased)
                    if (noiseVal < 0.26) {
                        // Cool solar spots (deep dark brown-red)
                        r = 90; g = 15; b = 0;
                    } else if (noiseVal < 0.38) {
                        // Cooler churning churning convection regions
                        const t = (noiseVal - 0.26) / 0.12;
                        r = Math.floor(90 + t * 130);
                        g = Math.floor(15 + t * 45);
                        b = 0;
                    } else if (noiseVal < 0.68) {
                        // Active solar plasma (bright fiery orange)
                        const t = (noiseVal - 0.38) / 0.30;
                        r = Math.floor(220 + t * 35);
                        g = Math.floor(60 + t * 90);
                        b = 0;
                    } else if (noiseVal < 0.86) {
                        // Hot convection cell crests (intense yellow-gold)
                        const t = (noiseVal - 0.68) / 0.18;
                        r = 255;
                        g = Math.floor(150 + t * 85);
                        b = Math.floor(t * 30);
                    } else {
                        // Superheated prominence points (blinding yellow-white)
                        const t = (noiseVal - 0.86) / 0.14;
                        r = 255;
                        g = 235 + Math.floor(t * 20);
                        b = Math.floor(30 + t * 170);
                    }

                    // Dynamic magnetic solar flares / cloud prominence overlay
                    const flareX = nx * 5.0 + cloudSeedX;
                    const flareY = ny * 5.0 + cloudSeedY;
                    const flareVal = fbm(flareX, flareY, 4);
                    if (flareVal > 0.62) {
                        const flareOpacity = Math.min((flareVal - 0.62) / 0.18, 0.75);
                        r = Math.floor(r * (1 - flareOpacity) + 255 * flareOpacity);
                        g = Math.floor(g * (1 - flareOpacity) + 245 * flareOpacity);
                        b = Math.floor(b * (1 - flareOpacity) + 180 * flareOpacity);
                    }
                } else if (currentPlanet === 'neutron_star') {
                    // White surface with blue-tinted structure
                    if (noiseVal < 0.38) {
                        r = 230; g = 240; b = 255; // Light blue-white
                    } else if (noiseVal < 0.65) {
                        const t = (noiseVal - 0.38) / 0.27;
                        r = Math.floor(230 + t * 25);
                        g = Math.floor(240 + t * 15);
                        b = 255;
                    } else {
                        r = 255; g = 255; b = 255; // Pure white
                    }

                    // Intense electromagnetic current swirl overlay (bright cyan/blue)
                    const stormX = nx * 5.5 + cloudSeedX;
                    const stormY = ny * 5.5 + cloudSeedY;
                    const stormVal = fbm(stormX, stormY, 4);
                    if (stormVal > 0.55) {
                        const stormOpacity = Math.min((stormVal - 0.55) / 0.20, 0.65);
                        r = Math.floor(r * (1 - stormOpacity) + 120 * stormOpacity);
                        g = Math.floor(g * (1 - stormOpacity) + 190 * stormOpacity);
                        b = 255;
                    }
                }

                data[idx] = r;
                data[idx + 1] = g;
                data[idx + 2] = b;
                data[idx + 3] = 255;
            }
        }
    }
    hiddenCtx.putImageData(imgData, 0, 0);

    // Count starting pixels
    initialPixelCount = 0;
    initialCorePixelCount = 0;
    const rawData = hiddenCtx.getImageData(0, 0, hiddenCanvas.width, hiddenCanvas.height);
    const planetCanvasCX = hiddenCanvas.width / 2;
    const planetCanvasCY = hiddenCanvas.height / 2;
    const planetSize = getPlanetSize();
    const coreRadius = getCoreRadius(planetSize);

    let x = 0, y = 0;
    for (let i = 3; i < rawData.data.length; i += 4) {
        if (rawData.data[i] > 0) {
            initialPixelCount++;
            const dx = x - planetCanvasCX;
            const dy = y - planetCanvasCY;
            const d = Math.sqrt(dx * dx + dy * dy);
            if (d <= coreRadius) {
                initialCorePixelCount++;
            }
        }
        x++;
        if (x >= hiddenCanvas.width) {
            x = 0;
            y++;
        }
    }
    currentPixelCount = initialPixelCount;
    currentCorePixelCount = initialCorePixelCount;

    // Reset dynamic center of mass
    planetCenterX = hiddenCanvas.width / 2;
    planetCenterY = hiddenCanvas.height / 2;
}

// Recalculates dynamic center of mass centroid (Optimized flat loop)
function calculateCenterOfMass() {
    const imageData = getSharedPlanetData();
    const data = imageData.data;
    const len = data.length;
    let sumX = 0, sumY = 0, totalPixels = 0;
    let corePixels = 0;
    let x = 0, y = 0;
    const cx = PLANET_CANVAS_SIZE / 2;
    const cy = PLANET_CANVAS_SIZE / 2;
    const planetSize = getPlanetSize();
    const coreRadius = getCoreRadius(planetSize);

    for (let i = 3; i < len; i += 4) {
        if (data[i] > 0) {
            sumX += x;
            sumY += y;
            totalPixels++;
            const dx = x - cx;
            const dy = y - cy;
            const distSq = dx * dx + dy * dy;
            if (distSq <= coreRadius * coreRadius) {
                corePixels++;
            }
        }
        x++;
        if (x >= PLANET_CANVAS_SIZE) {
            x = 0;
            y++;
        }
    }

    currentPixelCount = totalPixels;
    currentCorePixelCount = corePixels;

    if (totalPixels > 0) {
        planetCenterX = sumX / totalPixels;
        planetCenterY = sumY / totalPixels;
    }
    return totalPixels;
}

// Polar-coordinate radial terrain collapse gravity simulation (Optimized DDA stepping)
function collapseTerrain(startAngle = 0, endAngle = Math.PI * 2) {
    const cx = PLANET_CANVAS_SIZE / 2;
    const cy = PLANET_CANVAS_SIZE / 2;
    const d = getPlanetSize();
    const maxRadius = d / 2 + 30;

    const srcData = getSharedPlanetData();
    const destData = hiddenCtx.createImageData(PLANET_CANVAS_SIZE, PLANET_CANVAS_SIZE);

    // Uint32Array views for 32-bit pixel manipulations (extremely fast, no object allocations)
    const srcData32 = new Uint32Array(srcData.data.buffer);
    const destData32 = new Uint32Array(destData.data.buffer);

    // If this is a partial/sliced collapse, copy the original terrain first
    const isFullCollapse = (startAngle === 0 && endAngle === Math.PI * 2);
    if (!isFullCollapse) {
        destData32.set(srcData32);
    }

    // Dynamically scale the number of rays based on planet size to prevent Moire/scanline spacing patterns on larger bodies
    const numRays = Math.max(720, Math.ceil(2 * Math.PI * (d / 2) * 1));
    const stepSize = 0.5;
    const maxSteps = maxRadius / stepSize;

    // Cache cos/sin steps for current numRays
    if (collapseRayCacheNumRays !== numRays) {
        collapseRayCache = [];
        collapseRayCacheNumRays = numRays;
        for (let i = 0; i < numRays; i++) {
            const theta = (i * Math.PI * 2) / numRays;
            collapseRayCache.push({
                angle: theta,
                stepX: stepSize * Math.cos(theta),
                stepY: stepSize * Math.sin(theta)
            });
        }
    }

    // Reuse a flat Uint32Array buffer for solid pixels to avoid GC churn
    const solidPixels = new Uint32Array(Math.ceil(maxSteps));

    // Helper to check if a ray's angle is within the target slice
    const isAngleInSlice = (angle) => {
        if (isFullCollapse) return true;
        if (startAngle <= endAngle) {
            return angle >= startAngle && angle <= endAngle;
        } else {
            return angle >= startAngle || angle <= endAngle;
        }
    };

    for (let i = 0; i < numRays; i++) {
        const ray = collapseRayCache[i];
        if (!isAngleInSlice(ray.angle)) continue;

        const stepX = ray.stepX;
        const stepY = ray.stepY;

        let solidCount = 0;
        let lastX = -1, lastY = -1;

        // Trace outwards using fast DDA
        let rx = cx, ry = cy;
        for (let s = 0; s < maxSteps; s++) {
            const px = (rx + 0.5) | 0;
            const py = (ry + 0.5) | 0;
            rx += stepX;
            ry += stepY;

            if (px < 0 || px >= PLANET_CANVAS_SIZE || py < 0 || py >= PLANET_CANVAS_SIZE) continue;
            if (px === lastX && py === lastY) continue;
            lastX = px; lastY = py;

            const idx32 = py * PLANET_CANVAS_SIZE + px;
            const color = srcData32[idx32];

            if (color !== 0) {
                solidPixels[solidCount++] = color;
            }
        }

        // If doing a partial collapse, clear the ray path in the destination buffer first
        if (!isFullCollapse) {
            lastX = -1; lastY = -1;
            rx = cx; ry = cy;
            for (let s = 0; s < maxSteps; s++) {
                const px = (rx + 0.5) | 0;
                const py = (ry + 0.5) | 0;
                rx += stepX;
                ry += stepY;

                if (px < 0 || px >= PLANET_CANVAS_SIZE || py < 0 || py >= PLANET_CANVAS_SIZE) continue;
                if (px === lastX && py === lastY) continue;
                lastX = px; lastY = py;

                const destIdx32 = py * PLANET_CANVAS_SIZE + px;
                destData32[destIdx32] = 0;
            }
        }

        // Repack solid pixels tightly from core outwards
        lastX = -1; lastY = -1;
        let writeIdx = 0;
        rx = cx; ry = cy;
        for (let s = 0; s < maxSteps; s++) {
            if (writeIdx >= solidCount) break;

            const px = (rx + 0.5) | 0;
            const py = (ry + 0.5) | 0;
            rx += stepX;
            ry += stepY;

            if (px < 0 || px >= PLANET_CANVAS_SIZE || py < 0 || py >= PLANET_CANVAS_SIZE) continue;
            if (px === lastX && py === lastY) continue;
            lastX = px; lastY = py;

            const destIdx32 = py * PLANET_CANVAS_SIZE + px;
            destData32[destIdx32] = solidPixels[writeIdx++];
        }
    }

    hiddenCtx.putImageData(destData, 0, 0);
}

// Inverse Coordinate Space Transformation (Screen Space -> Local unrotated planet space)
function screenToLocal(screenX, screenY, centerX, centerY, rotation) {
    const dx = screenX - centerX;
    const dy = screenY - centerY;
    const cos = Math.cos(-rotation);
    const sin = Math.sin(-rotation);

    return {
        x: dx * cos - dy * sin + planetCenterX,
        y: dx * sin + dy * cos + planetCenterY
    };
}

// Centralized terrain erasing logic for both explosions and black holes
function eraseTerrain(localX, localY, radius, isCollision, weaponType) {
    const cx = PLANET_CANVAS_SIZE / 2;
    const cy = PLANET_CANVAS_SIZE / 2;
    const planetSize = getPlanetSize();
    const coreRadius = getCoreRadius(planetSize);

    // Check if the impact point itself is in the crust
    const dxImpact = localX - cx;
    const dyImpact = localY - cy;
    const distImpact = Math.sqrt(dxImpact * dxImpact + dyImpact * dyImpact);
    const isImpactInCrust = distImpact > coreRadius;

    // Bounding box of the erase area
    const startX = Math.max(0, Math.floor(localX - radius));
    const startY = Math.max(0, Math.floor(localY - radius));
    const endX = Math.min(hiddenCanvas.width - 1, Math.ceil(localX + radius));
    const endY = Math.min(hiddenCanvas.height - 1, Math.ceil(localY + radius));

    const width = endX - startX + 1;
    const height = endY - startY + 1;

    if (width > 0 && height > 0) {
        const imgData = hiddenCtx.getImageData(startX, startY, width, height);
        const data = imgData.data;
        const iceHits = [];

        for (let y = 0; y < height; y++) {
            const pixelY = startY + y;
            const dy = pixelY - localY;
            const dyCenter = pixelY - cy;

            for (let x = 0; x < width; x++) {
                const pixelX = startX + x;
                const dx = pixelX - localX;
                const dxCenter = pixelX - cx;

                const d_exp = Math.sqrt(dx * dx + dy * dy);
                if (d_exp > radius) continue; // outside the maximum explosion radius

                const idx = (y * width + x) * 4;
                const gridX = Math.floor(pixelX / 4);
                const gridY = Math.floor(pixelY / 4);
                const gridIdx = gridY * 115 + gridX;
                if (iceGrid[gridIdx] > 0) {
                    iceHits.push({ x: pixelX, y: pixelY });
                }
                if (data[idx + 3] === 0) continue; // skip already erased pixels

                const d_center = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
                const inCore = d_center <= coreRadius;

                if (inCore) {
                    if (weaponType === 'worm') {
                        // Worm does not damage the core! It only reveals it.
                        const rad = planetSize / 2;
                        const nx = dxCenter / rad;
                        const ny = dyCenter / rad;
                        const coreNoiseX = nx * 5.0 + seedX;
                        const coreNoiseY = ny * 5.0 + seedY;
                        const coreNoiseVal = fbm(coreNoiseX, coreNoiseY, 4);

                        let cr = 0, cg = 0, cb = 0;
                        if (currentPlanet === 'sun') {
                            if (coreNoiseVal < 0.45) {
                                cr = 255; cg = 245; cb = 130;
                            } else if (coreNoiseVal < 0.75) {
                                const t = (coreNoiseVal - 0.45) / 0.30;
                                cr = 255; cg = Math.floor(245 + t * 10); cb = Math.floor(130 + t * 90);
                            } else {
                                const t = (coreNoiseVal - 0.75) / 0.25;
                                cr = 255; cg = 255; cb = Math.floor(220 + t * 35);
                            }
                        } else {
                            if (coreNoiseVal < 0.45) {
                                cr = 225; cg = 25; cb = 0;
                            } else if (coreNoiseVal < 0.75) {
                                const t = (coreNoiseVal - 0.45) / 0.30;
                                cr = 255; cg = Math.floor(25 + t * 115); cb = 0;
                            } else {
                                const t = (coreNoiseVal - 0.75) / 0.25;
                                cr = 255; cg = Math.floor(140 + t * 115); cb = Math.floor(t * 120);
                            }
                        }
                        data[idx] = cr;
                        data[idx + 1] = cg;
                        data[idx + 2] = cb;
                        data[idx + 3] = 255; // reveal core
                        continue;
                    }

                    // Core segment damage logic
                    // Exceptions: black hole always damage both crust and core
                    const isException = (weaponType === 'blackhole');
                    if (isCollision && isImpactInCrust && !isException) {
                        // Collision triggered on crust: does not affect core, but reveals it
                        const rad = planetSize / 2;
                        const nx = dxCenter / rad;
                        const ny = dyCenter / rad;
                        const coreNoiseX = nx * 5.0 + seedX;
                        const coreNoiseY = ny * 5.0 + seedY;
                        const coreNoiseVal = fbm(coreNoiseX, coreNoiseY, 4);

                        let cr = 0, cg = 0, cb = 0;
                        if (currentPlanet === 'sun') {
                            if (coreNoiseVal < 0.45) {
                                cr = 255; cg = 245; cb = 130;
                            } else if (coreNoiseVal < 0.75) {
                                const t = (coreNoiseVal - 0.45) / 0.30;
                                cr = 255; cg = Math.floor(245 + t * 10); cb = Math.floor(130 + t * 90);
                            } else {
                                const t = (coreNoiseVal - 0.75) / 0.25;
                                cr = 255; cg = 255; cb = Math.floor(220 + t * 35);
                            }
                        } else {
                            if (coreNoiseVal < 0.45) {
                                cr = 225; cg = 25; cb = 0;
                            } else if (coreNoiseVal < 0.75) {
                                const t = (coreNoiseVal - 0.45) / 0.30;
                                cr = 255; cg = Math.floor(25 + t * 115); cb = 0;
                            } else {
                                const t = (coreNoiseVal - 0.75) / 0.25;
                                cr = 255; cg = Math.floor(140 + t * 115); cb = Math.floor(t * 120);
                            }
                        }
                        data[idx] = cr;
                        data[idx + 1] = cg;
                        data[idx + 2] = cb;
                        data[idx + 3] = 255; // reveal core
                        continue;
                    }
                    // Otherwise, erases with radius reduced by 4 and a percentage
                    if (d_exp <= Math.max(0, (radius - 4) * 0.78)) {
                        data[idx + 3] = 0; // erase
                    } else {
                        // Reveal core at the edge of core-damaging explosions
                        const rad = planetSize / 2;
                        const nx = dxCenter / rad;
                        const ny = dyCenter / rad;
                        const coreNoiseX = nx * 5.0 + seedX;
                        const coreNoiseY = ny * 5.0 + seedY;
                        const coreNoiseVal = fbm(coreNoiseX, coreNoiseY, 4);

                        let cr = 0, cg = 0, cb = 0;
                        if (currentPlanet === 'sun') {
                            if (coreNoiseVal < 0.45) {
                                cr = 255; cg = 245; cb = 130;
                            } else if (coreNoiseVal < 0.75) {
                                const t = (coreNoiseVal - 0.45) / 0.30;
                                cr = 255; cg = Math.floor(245 + t * 10); cb = Math.floor(130 + t * 90);
                            } else {
                                const t = (coreNoiseVal - 0.75) / 0.25;
                                cr = 255; cg = 255; cb = Math.floor(220 + t * 35);
                            }
                        } else {
                            if (coreNoiseVal < 0.45) {
                                cr = 225; cg = 25; cb = 0;
                            } else if (coreNoiseVal < 0.75) {
                                const t = (coreNoiseVal - 0.45) / 0.30;
                                cr = 255; cg = Math.floor(25 + t * 115); cb = 0;
                            } else {
                                const t = (coreNoiseVal - 0.75) / 0.25;
                                cr = 255; cg = Math.floor(140 + t * 115); cb = Math.floor(t * 120);
                            }
                        }
                        data[idx] = cr;
                        data[idx + 1] = cg;
                        data[idx + 2] = cb;
                        data[idx + 3] = 255; // reveal core
                    }
                } else {
                    // Crust segment: erases with full radius
                    data[idx + 3] = 0; // erase
                }
            }
        }
        hiddenCtx.putImageData(imgData, startX, startY);

        let icePopped = false;
        for (let h = 0; h < iceHits.length; h++) {
            if (popConnectedIce(iceHits[h].x, iceHits[h].y)) {
                icePopped = true;
            }
        }
        return icePopped;
    }
    return false;
}

// Transform solid planet crust into ice
function freezeArea(localX, localY, radius) {
    const cx = PLANET_CANVAS_SIZE / 2;
    const cy = PLANET_CANVAS_SIZE / 2;
    const planetSize = getPlanetSize();
    const coreRadius = getCoreRadius(planetSize);

    const startX = Math.max(0, Math.floor(localX - radius));
    const startY = Math.max(0, Math.floor(localY - radius));
    const endX = Math.min(hiddenCanvas.width - 1, Math.ceil(localX + radius));
    const endY = Math.min(hiddenCanvas.height - 1, Math.ceil(localY + radius));

    const width = endX - startX + 1;
    const height = endY - startY + 1;

    if (width > 0 && height > 0) {
        const imgData = hiddenCtx.getImageData(startX, startY, width, height);
        const data = imgData.data;
        let modified = false;

        const gridScale = 4;
        const gridSize = 115;

        for (let y = 0; y < height; y++) {
            const pixelY = startY + y;
            const dy = pixelY - localY;
            const dyCenter = pixelY - cy;
            for (let x = 0; x < width; x++) {
                const pixelX = startX + x;
                const dx = pixelX - localX;
                const dxCenter = pixelX - cx;

                const d = Math.sqrt(dx * dx + dy * dy);
                if (d > radius) continue; // Outside circular area

                const idx = (y * width + x) * 4;
                if (data[idx + 3] === 0) continue; // Skip empty space
                if (data[idx + 3] === 224) continue; // Already frozen

                // Check core vs crust based on current pixel color
                const d_center = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);
                let iceType = 1; // 1 = Crust, 2 = Core

                if (d_center <= coreRadius) {
                    const rColor = data[idx];
                    const gColor = data[idx + 1];
                    const bColor = data[idx + 2];

                    // Generate core color at this coordinate
                    const rad = planetSize / 2;
                    const nx = dxCenter / rad;
                    const ny = dyCenter / rad;
                    const coreNoiseX = nx * 5.0 + seedX;
                    const coreNoiseY = ny * 5.0 + seedY;
                    const coreNoiseVal = fbm(coreNoiseX, coreNoiseY, 4);

                    let cr = 0, cg = 0, cb = 0;
                    if (currentPlanet === 'sun') {
                        if (coreNoiseVal < 0.45) {
                            cr = 255; cg = 245; cb = 130;
                        } else if (coreNoiseVal < 0.75) {
                            const t = (coreNoiseVal - 0.45) / 0.30;
                            cr = 255; cg = Math.floor(245 + t * 10); cb = Math.floor(130 + t * 90);
                        } else {
                            const t = (coreNoiseVal - 0.75) / 0.25;
                            cr = 255; cg = 255; cb = Math.floor(220 + t * 35);
                        }
                    } else {
                        if (coreNoiseVal < 0.45) {
                            cr = 225; cg = 25; cb = 0;
                        } else if (coreNoiseVal < 0.75) {
                            const t = (coreNoiseVal - 0.45) / 0.30;
                            cr = 255; cg = Math.floor(25 + t * 115); cb = 0;
                        } else {
                            const t = (coreNoiseVal - 0.75) / 0.25;
                            cr = 255; cg = Math.floor(140 + t * 115); cb = Math.floor(t * 120);
                        }
                    }

                    // If pixel color is core color, then core is exposed and frozen
                    const isCoreColor = Math.abs(rColor - cr) < 3 && Math.abs(gColor - cg) < 3 && Math.abs(bColor - cb) < 3;
                    if (isCoreColor) {
                        iceType = 2; // Core frozen
                    } else {
                        iceType = 1; // Crust frozen, core underneath untouched
                    }
                }

                const gridX = Math.floor(pixelX / gridScale);
                const gridY = Math.floor(pixelY / gridScale);
                const gridIdx = gridY * gridSize + gridX;

                const r = data[idx];
                const g = data[idx + 1];
                const b = data[idx + 2];

                // Boost blue, dim red/green, set alpha to 0.88 (224)
                data[idx] = Math.floor(r * 0.2);
                data[idx + 1] = Math.floor(g * 0.5 + 80);
                data[idx + 2] = Math.min(255, Math.floor(b * 0.3 + 190));
                data[idx + 3] = 211;

                iceGrid[gridIdx] = iceType;
                if (typeof detailedIceGrid !== 'undefined') {
                    detailedIceGrid[pixelY * PLANET_CANVAS_SIZE + pixelX] = iceType;
                }
                modified = true;
            }
        }

        if (modified) {
            hiddenCtx.putImageData(imgData, startX, startY);
        }
    }
}

// BFS flood fill to pop all contiguous ice pixels starting from a seed point
function popConnectedIce(seedX, seedY) {
    const gridSize = 115;
    const gridScale = 4;

    const startGridX = Math.floor(seedX / gridScale);
    const startGridY = Math.floor(seedY / gridScale);
    const seedIdx = startGridY * gridSize + startGridX;

    if (iceGrid[seedIdx] === 0) return false;

    // Use a visited array to track BFS nodes so iceGrid data is preserved for erasure checks
    const visited = new Uint8Array(115 * 115);
    const queue = [seedIdx];
    visited[seedIdx] = 1;

    let head = 0;
    const dirs = [-1, 1, -gridSize, gridSize]; // Left, Right, Up, Down

    while (head < queue.length) {
        const curr = queue[head++];
        const cx = curr % gridSize;
        const cy = Math.floor(curr / gridSize);

        for (let i = 0; i < 4; i++) {
            const nextIdx = curr + dirs[i];

            // Boundary checks
            if (i === 0 && cx === 0) continue; // Left boundary
            if (i === 1 && cx === gridSize - 1) continue; // Right boundary
            if (i === 2 && cy === 0) continue; // Top boundary
            if (i === 3 && cy === gridSize - 1) continue; // Bottom boundary

            if (iceGrid[nextIdx] > 0 && visited[nextIdx] === 0) {
                visited[nextIdx] = 1;
                queue.push(nextIdx);
            }
        }
    }

    if (queue.length > 0) {
        const cx = PLANET_CANVAS_SIZE / 2;
        const cy = PLANET_CANVAS_SIZE / 2;
        const planetSize = getPlanetSize();
        const coreRadius = getCoreRadius(planetSize);

        // Calculate the bounding box of popped ice in original pixel space
        let minGridX = gridSize, maxGridX = 0;
        let minGridY = gridSize, maxGridY = 0;

        for (let i = 0; i < queue.length; i++) {
            const gx = queue[i] % gridSize;
            const gy = Math.floor(queue[i] / gridSize);
            if (gx < minGridX) minGridX = gx;
            if (gx > maxGridX) maxGridX = gx;
            if (gy < minGridY) minGridY = gy;
            if (gy > maxGridY) maxGridY = gy;
        }

        const minX = minGridX * gridScale;
        const maxX = Math.min(PLANET_CANVAS_SIZE - 1, (maxGridX + 1) * gridScale - 1);
        const minY = minGridY * gridScale;
        const maxY = Math.min(PLANET_CANVAS_SIZE - 1, (maxGridY + 1) * gridScale - 1);

        const width = maxX - minX + 1;
        const height = maxY - minY + 1;

        if (width > 0 && height > 0) {
            const imgData = hiddenCtx.getImageData(minX, minY, width, height);
            const data = imgData.data;

            for (let y = 0; y < height; y++) {
                const pixelY = minY + y;
                const gy = Math.floor(pixelY / gridScale);
                const dyCenter = pixelY - cy;

                for (let x = 0; x < width; x++) {
                    const pixelX = minX + x;
                    const gx = Math.floor(pixelX / gridScale);
                    const gIdx = gy * gridSize + gx;

                    if (visited[gIdx] === 1) {
                        const idx = (y * width + x) * 4;
                        const detailedIdx = pixelY * PLANET_CANVAS_SIZE + pixelX;
                        let iceType = (typeof detailedIceGrid !== 'undefined') ? detailedIceGrid[detailedIdx] : 0;
                        if (iceType === 0) {
                            iceType = iceGrid[gIdx];
                        }
                        if (typeof detailedIceGrid !== 'undefined') {
                            detailedIceGrid[detailedIdx] = 0;
                        }

                        const dxCenter = pixelX - cx;
                        const d_center = Math.sqrt(dxCenter * dxCenter + dyCenter * dyCenter);

                        // If it was crust frozen over the core, reveal the untouched core
                        if (iceType === 1 && d_center <= coreRadius) {
                            const rad = planetSize / 2;
                            const nx = dxCenter / rad;
                            const ny = dyCenter / rad;
                            const coreNoiseX = nx * 5.0 + seedX;
                            const coreNoiseY = ny * 5.0 + seedY;
                            const coreNoiseVal = fbm(coreNoiseX, coreNoiseY, 4);

                            let cr = 0, cg = 0, cb = 0;
                            if (currentPlanet === 'sun') {
                                if (coreNoiseVal < 0.45) {
                                    cr = 255; cg = 245; cb = 130;
                                } else if (coreNoiseVal < 0.75) {
                                    const t = (coreNoiseVal - 0.45) / 0.30;
                                    cr = 255; cg = Math.floor(245 + t * 10); cb = Math.floor(130 + t * 90);
                                } else {
                                    const t = (coreNoiseVal - 0.75) / 0.25;
                                    cr = 255; cg = 255; cb = Math.floor(220 + t * 35);
                                }
                            } else {
                                if (coreNoiseVal < 0.45) {
                                    cr = 225; cg = 25; cb = 0;
                                } else if (coreNoiseVal < 0.75) {
                                    const t = (coreNoiseVal - 0.45) / 0.30;
                                    cr = 255; cg = Math.floor(25 + t * 115); cb = 0;
                                } else {
                                    const t = (coreNoiseVal - 0.75) / 0.25;
                                    cr = 255; cg = Math.floor(140 + t * 115); cb = Math.floor(t * 120);
                                }
                            }
                            data[idx] = cr;
                            data[idx + 1] = cg;
                            data[idx + 2] = cb;
                            data[idx + 3] = 255;
                        } else if (currentPlanet === 'neutron_star') {
                            const rad = planetSize / 2;
                            const nx = dxCenter / rad;
                            const ny = dyCenter / rad;
                            const nsNoiseX = nx * 3.6 + seedX;
                            const nsNoiseY = ny * 3.6 + seedY;
                            const nsNoiseVal = fbm(nsNoiseX, nsNoiseY, 4);
                            let nr = 230, ng = 240, nb = 255;
                            if (nsNoiseVal < 0.38) {
                                nr = 230; ng = 240; nb = 255;
                            } else if (nsNoiseVal < 0.65) {
                                const t = (nsNoiseVal - 0.38) / 0.27;
                                nr = Math.floor(230 + t * 25);
                                ng = Math.floor(240 + t * 15);
                                nb = 255;
                            } else {
                                nr = 255; ng = 255; nb = 255;
                            }
                            data[idx] = nr;
                            data[idx + 1] = ng;
                            data[idx + 2] = nb;
                            data[idx + 3] = 255;
                        } else {
                            // Pop normal crust or pop core itself
                            data[idx + 3] = 0;
                        }
                    }
                }
            }

            hiddenCtx.putImageData(imgData, minX, minY);
        }

        // Reset the popped indices in the grid
        for (let i = 0; i < queue.length; i++) {
            iceGrid[queue[i]] = 0;
        }

        // Play shattering sound (throttled to at most once per frame)
        if (typeof window.lastShatterPlayTime === 'undefined' || performance.now() - window.lastShatterPlayTime > 30) {
            soundManager.play('sfx_shatter', false, 1.0);
            window.lastShatterPlayTime = performance.now();
        }

        // Spawn ice shard particles
        const numParticles = Math.min(60, 4 + Math.floor(queue.length / 2));
        for (let i = 0; i < numParticles; i++) {
            const randomIdx = queue[Math.floor(Math.random() * queue.length)];
            const gx = randomIdx % gridSize;
            const gy = Math.floor(randomIdx / gridSize);
            const px = gx * gridScale + 2;
            const py = gy * gridScale + 2;

            // Convert local coordinate to screen space
            const cos = Math.cos(planetRotation);
            const sin = Math.sin(planetRotation);
            const dxLocal = px - planetCenterX;
            const dyLocal = py - planetCenterY;
            const rotX = dxLocal * cos - dyLocal * sin;
            const rotY = dxLocal * sin + dyLocal * cos;
            const screenX = CENTER_X + rotX;
            const screenY = CENTER_Y + rotY;

            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 5 + 3;

            particles.push({
                x: screenX,
                y: screenY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                maxLife: Math.random() * 0.7 + 0.4,
                size: Math.random() * 4 + 2,
                color: Math.random() < 0.5 ? '#b3e6ff' : '#e6f7ff',
                type: 'fire'
            });
        }
        return true;
    }
    return false;
}

// Explosion logic
function createExplosion(localX, localY, radius, shakeIntensity, weaponType, silent = false, isCollision = false) {
    totalCratersMade++;
    // Durable core logic: if impact is in the inner 40% of the planet's radius, reduce explosion size by 40% (to 60%)
    const cx = PLANET_CANVAS_SIZE / 2;
    const cy = PLANET_CANVAS_SIZE / 2;
    const dx = localX - cx;
    const dy = localY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const planetSize = getPlanetSize();
    const coreThreshold = planetSize * 0.13;

    let finalRadius = radius;
    if (dist <= coreThreshold) {
        finalRadius = Math.max(0, radius - 3) * 0.95;
    }
    if (weaponType === 'laser') {
        const coreRadius = getCoreRadius(planetSize);
        if (dist <= coreRadius) {
            finalRadius *= 0.85;
        }
    }
    if (currentPlanet === 'neutron_star') {
        finalRadius -= 3;
        finalRadius *= 0.23;
    } else {
        finalRadius *= 0.94;
    }

    // Erase using centralized core-aware terrain logic
    const icePopped = eraseTerrain(localX, localY, finalRadius, isCollision, weaponType);

    // Play explosion sound
    if (!silent) {
        if (weaponType === 'laser') {
            laserSoundCounter++;
            if (laserSoundCounter % 2 === 0) {
                let detune = (Math.random() - 0.5) * 400;
                let playVol = 1.0;
                const coreRadius = getCoreRadius(planetSize);
                if (dist <= coreRadius) {
                    detune -= 200; // lower the pitch by 1000 cents
                    playVol = 0.75;
                }
                const tier = laserTier3 ? 3 : (laserEnhanced ? 2 : 1);
                const volMultiplier = tier === 1 ? 0.50 : (tier === 2 ? 0.70 : 0.85);
                playVol *= volMultiplier;
                soundManager.play('sfx_laser_crack', false, playVol, detune);
            }
        } else if (weaponType === 'missile') {
            const detune = (Math.random() - 0.5) * 400; // +/- 200 cents
            soundManager.play('sfx_explosion_small', false, 0.6 + Math.random() * 0.35, detune);
        } else if (weaponType === 'nuke') {
            const detune = (Math.random() - 0.5) * 1200; // +/- 600 cents
            soundManager.play('sfx_explosion_medium', false, 1.0, detune);
        } else if (weaponType === 'sword') {
            const detune = (Math.random() - 0.5) * 400; // +/- 200 cents
            soundManager.play('sfx_explosion_medium', false, 1.0, detune);
        } else if (weaponType === 'asteroid') {
            soundManager.play('sfx_explosion_large');
        } else if (weaponType === 'moon') {
            soundManager.play('sfx_mystical_moon_explosion');
        }
    }

    if (dist < radius || icePopped) {
        // Overlaps the core or ice was popped: do a full 360-degree collapse
        collapseTerrain();
    } else {
        // Calculate the angle to the center
        const angle = Math.atan2(dy, dx);

        // Calculate the angular width of the explosion slice
        // We add a safety margin of 0.15 radians (~8.5 degrees) to cover the edges cleanly
        const angleWidth = (radius / dist) + 0.15;

        let startAngle = angle - angleWidth;
        let endAngle = angle + angleWidth;

        // Normalize angles to [0, 2*PI]
        const TWO_PI = Math.PI * 2;
        startAngle = (startAngle % TWO_PI + TWO_PI) % TWO_PI;
        endAngle = (endAngle % TWO_PI + TWO_PI) % TWO_PI;

        collapseTerrain(startAngle, endAngle);
    }

    // Recalculate dynamic center of mass
    const remainingPixels = calculateCenterOfMass();

    // Screen shake trigger
    screenShake = {
        x: 0,
        y: 0,
        intensity: shakeIntensity,
        duration: weaponType === 'missile' ? 250 : 350
    };

    // Haptic vibration feedback
    if (vibrationEnabled && radius >= 20 && typeof navigator !== 'undefined' && navigator.vibrate) {
        let vibrationDuration = Math.min(100, Math.floor(shakeIntensity * 8));
        if (vibrationDuration > 10) {
            try {
                navigator.vibrate(vibrationDuration);
            } catch (e) { }
        }
    }

    // Screen flash on big impacts
    if (shakeIntensity >= 15 && weaponType !== 'bowling') {
        let flashStrength = Math.min(0.32, shakeIntensity / 95);
        if (weaponType === 'asteroid') flashStrength = Math.min(flashStrength, 0.07);

        if (weaponType === 'moon') {
            screenFlash.alpha = 0.6;
            screenFlash.r = 255; screenFlash.g = 255; screenFlash.b = 255;
        } else {
            screenFlash.alpha = Math.max(screenFlash.alpha, flashStrength);
            if (weaponType === 'asteroid') { screenFlash.r = 255; screenFlash.g = 130; screenFlash.b = 40; }
            else { screenFlash.r = 255; screenFlash.g = 200; screenFlash.b = 120; }
        }
    }

    // Convert local hit coordinate back to rotated screen space
    const cos = Math.cos(planetRotation);
    const sin = Math.sin(planetRotation);

    const dxLocal = localX - planetCenterX;
    const dyLocal = localY - planetCenterY;

    const rotX = dxLocal * cos - dyLocal * sin;
    const rotY = dxLocal * sin + dyLocal * cos;

    const impactScreenX = CENTER_X + rotX;
    const impactScreenY = CENTER_Y + rotY;

    // Add shockwave ring (User feature 7)
    if (weaponType !== 'missile' && weaponType !== 'laser') {
        shockwaves.push({
            x: impactScreenX,
            y: impactScreenY,
            radius: 0,
            maxRadius: finalRadius * 3.6,
            life: 1.0,
            maxLife: 0.6
        });
    }

    // Create two circles representing the explosion (orange slightly larger, yellow slightly smaller)
    if (weaponType !== 'mysterybox') {
        particles.push({
            x: impactScreenX,
            y: impactScreenY,
            vx: 0, vy: 0,
            life: 1.0,
            maxLife: 0.41,
            size: finalRadius * 1.3,
            color: 'rgba(255, 120, 0, 0.85)',
            type: 'explosion_ring'
        });
        particles.push({
            x: impactScreenX,
            y: impactScreenY,
            vx: 0, vy: 0,
            life: 1.0,
            maxLife: 0.185,
            size: finalRadius * 0.95,
            color: 'rgba(255, 255, 120, 0.98)',
            type: 'explosion_ring'
        });
    }
    if (weaponType === 'nuke' || weaponType === 'asteroid' || weaponType === 'bowling') {
        particles.push({
            x: impactScreenX,
            y: impactScreenY,
            vx: 0, vy: 0,
            life: 1.0,
            maxLife: 0.16,
            size: finalRadius * 2.25,
            color: 'rgba(0, 0, 0, 0.95)',
            type: 'circular_flash'
        });
    }

    // Blast glowing particles radiating from hit zone in screen space
    let particleCount = getConfigValue(`weapons.${weaponType}.particleCount`, 20 + Math.floor(radius / 2.5));

    if (weaponType === 'lightning' || weaponType === 'star_nuke') {
        particleCount = Math.floor(particleCount * 0.4);
    }
    const speedScale = getConfigValue(`weapons.${weaponType}.particleSpeedScale`, 1.0);
    const lifeScale = getConfigValue(`weapons.${weaponType}.particleLifeScale`, 1.0);

    if (weaponType === 'mysterybox') {
        const dustCount = particleCount + 2;
        for (let i = 0; i < dustCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (Math.random() * 5 + 3) * speedScale;
            particles.push({
                x: impactScreenX,
                y: impactScreenY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                maxLife: (Math.random() * 0.8 + 0.6) * lifeScale,
                size: Math.random() * 5 + 3,
                color: `rgba(${Math.random() * 40 + 120}, ${Math.random() * 30 + 110}, ${Math.random() * 30 + 100}, ${0.5 + Math.random() * 0.4})`,
                type: 'smoke'
            });
        }
    } else {
        for (let i = 0; i < particleCount; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = (Math.random() * 5 + 3) * speedScale;
            particles.push({
                x: impactScreenX,
                y: impactScreenY,
                vx: Math.cos(angle) * speed,
                vy: Math.sin(angle) * speed,
                life: 1.0,
                maxLife: (Math.random() * 0.8 + 0.6) * lifeScale,
                size: Math.random() * 5 + 3,
                color: `hsl(${Math.random() * 45 + 10}, 100%, ${Math.random() * 30 + 55}%)`,
                type: Math.random() > 0.45 ? 'fire' : 'smoke'
            });
        }
    }

    // Check victory condition
    if (!victoryTriggered) {
        const massPct = (remainingPixels / initialPixelCount) * 100;
        if (massPct < getConfigValue('gameplay.victoryThreshold', 1.75)) {
            triggerVictory();
        }
    }
}

// Ray march using a pre-fetched ImageData buffer (avoids repeated getImageData GPU->CPU readbacks)
function findLaserImpactWithData(spawnX, spawnY, imgData, dirX, dirY) {
    const screenCenterX = CENTER_X;
    const screenCenterY = CENTER_Y;
    const data = imgData.data;

    // If an explicit direction vector is provided, use it (keeps parallel sub-beams straight).
    // Otherwise aim toward the planet center (original behaviour for all other callers).
    let dx, dy, dist;
    if (dirX !== undefined && dirY !== undefined) {
        dx = dirX;
        dy = dirY;
        dist = Math.sqrt(dx * dx + dy * dy);
    } else {
        dx = screenCenterX - spawnX;
        dy = screenCenterY - spawnY;
        dist = Math.sqrt(dx * dx + dy * dy);
    }

    let impactX = screenCenterX;
    let impactY = screenCenterY;
    let localHit = null;

    if (dist > 0) {
        const stepSize = 2;
        const toCenterDist = Math.sqrt((screenCenterX - spawnX) ** 2 + (screenCenterY - spawnY) ** 2);
        const totalDist = toCenterDist + getPlanetSize() / 2 + 200;
        const numSteps = totalDist / stepSize;
        const stepX = (dx / dist) * stepSize;
        const stepY = (dy / dist) * stepSize;

        let rx = spawnX;
        let ry = spawnY;

        const cos = Math.cos(-planetRotation);
        const sin = Math.sin(-planetRotation);

        for (let s = 0; s < numSteps; s++) {
            const rx_dx = rx - screenCenterX;
            const ry_dy = ry - screenCenterY;
            const px = Math.floor(rx_dx * cos - ry_dy * sin + planetCenterX);
            const py = Math.floor(rx_dx * sin + ry_dy * cos + planetCenterY);

            if (px >= 0 && px < PLANET_CANVAS_SIZE && py >= 0 && py < PLANET_CANVAS_SIZE) {
                const idx = (py * PLANET_CANVAS_SIZE + px) * 4;
                if (data[idx + 3] > 0) {
                    impactX = rx;
                    impactY = ry;
                    localHit = {
                        x: rx_dx * cos - ry_dy * sin + planetCenterX,
                        y: rx_dx * sin + ry_dy * cos + planetCenterY
                    };
                    break;
                }
            }
            rx += stepX;
            ry += stepY;
        }
    }
    return { x: impactX, y: impactY, local: localHit };
}

// Apply explosion erase + particles WITHOUT calling collapseTerrain / calculateCenterOfMass.
// Use this for batched hits; the caller is responsible for running those heavy passes once after all hits.
function createExplosionRaw(localX, localY, radius, weaponType) {
    totalCratersMade++;
    const cx = PLANET_CANVAS_SIZE / 2;
    const cy = PLANET_CANVAS_SIZE / 2;
    const dx = localX - cx;
    const dy = localY - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);
    const planetSize = getPlanetSize();
    const coreThreshold = planetSize * 0.13;

    let finalRadius = radius;
    if (dist <= coreThreshold) {
        finalRadius = Math.max(0, radius - 3) * 0.95;
    }
    if (weaponType === 'laser') {
        const coreRadius = getCoreRadius(planetSize);
        if (dist <= coreRadius) {
            finalRadius *= 0.8;
        }
    }
    if (currentPlanet === 'neutron_star') {
        finalRadius -= 3;
        finalRadius *= 0.23;
    } else {
        finalRadius *= 0.94;
    }

    // Erase using centralized core-aware terrain logic
    eraseTerrain(localX, localY, finalRadius, false, weaponType);

    // Convert local hit back to screen space for particles
    const cos = Math.cos(planetRotation);
    const sin = Math.sin(planetRotation);
    const dxLocal = localX - planetCenterX;
    const dyLocal = localY - planetCenterY;
    const rotX = dxLocal * cos - dyLocal * sin;
    const rotY = dxLocal * sin + dyLocal * cos;
    const impactScreenX = CENTER_X + rotX;
    const impactScreenY = CENTER_Y + rotY;

    // Explosion rings
    particles.push({
        x: impactScreenX, y: impactScreenY,
        vx: 0, vy: 0, life: 1.0, maxLife: 0.418,
        size: finalRadius * 1.3,
        color: 'rgba(255, 120, 0, 0.85)',
        type: 'explosion_ring'
    });
    particles.push({
        x: impactScreenX, y: impactScreenY,
        vx: 0, vy: 0, life: 1.0, maxLife: 0.22,
        size: finalRadius * 1,
        color: 'rgba(255, 255, 120, 0.94)',
        type: 'explosion_ring'
    });
    if (weaponType === 'nuke' || weaponType === 'asteroid' || weaponType === 'bowling') {
        particles.push({
            x: impactScreenX,
            y: impactScreenY,
            vx: 0, vy: 0,
            life: 1.0,
            maxLife: 0.15,
            size: finalRadius * 2.25,
            color: 'rgba(0, 0, 0, 0.95)',
            type: 'circular_flash'
        });
    }

    // Blast particles
    const particleCount = getConfigValue(`weapons.${weaponType}.particleCount`, 1);
    const speedScale = getConfigValue(`weapons.${weaponType}.particleSpeedScale`, 0.8);
    const lifeScale = getConfigValue(`weapons.${weaponType}.particleLifeScale`, 0.8);
    for (let i = 0; i < particleCount; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = (Math.random() * 5 + 3) * speedScale;
        particles.push({
            x: impactScreenX, y: impactScreenY,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            maxLife: (Math.random() * 0.8 + 0.6) * lifeScale,
            size: Math.random() * 5 + 3,
            color: `hsl(${Math.random() * 45 + 10}, 100%, ${Math.random() * 30 + 55}%)`,
            type: Math.random() > 0.45 ? 'fire' : 'smoke'
        });
    }
}

// Trigger Victory splash
function triggerVictory() {
    // Site lock: only grant victory on an authorized CrazyGames domain (or local dev)
    const hostname = window.location.hostname;
    const isLocal = hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '';
    const hostParts = hostname.split('.');
    const crazyGamesIdx = hostParts.indexOf('crazygames');
    const isCrazyGamesDomain = crazyGamesIdx !== -1 && crazyGamesIdx >= hostParts.length - 3;
    if (!isLocal && !isCrazyGamesDomain) {
        const sitelockEl = document.getElementById('sitelock-message');
        if (sitelockEl) {
            const t = translations[currentLanguage] || translations['en'];
            sitelockEl.textContent = t.siteLockMessage || translations['en'].siteLockMessage;
            sitelockEl.classList.add('show');
            sitelockEl.setAttribute('aria-hidden', 'false');
        }
        return;
    }

    const previousBest = bestTimes[currentPlanet];
    victoryTriggered = true;
    soundManager.play('sfx_victory');
    if (window.PlatformBridge) {
        window.PlatformBridge.gameplayStop();
        if (currentPlanet === 'sun' || currentPlanet === 'neutron_star') {
            if (typeof window.PlatformBridge.happytime === 'function') {
                window.PlatformBridge.happytime();
            }
        }
    }

    screenShake = {
        x: 0,
        y: 0,
        intensity: 35,
        duration: 2500
    };

    // Massive firework particle explosion ring from center
    for (let i = 0; i < 180; i++) {
        const angle = Math.random() * Math.PI * 2;
        const speed = Math.random() * 10 + 4;
        particles.push({
            x: CENTER_X,
            y: CENTER_Y,
            vx: Math.cos(angle) * speed,
            vy: Math.sin(angle) * speed,
            life: 1.0,
            maxLife: Math.random() * 1.5 + 1.2,
            size: Math.random() * 9 + 4,
            color: `hsl(${Math.random() * 50 + 5}, 100%, ${Math.random() * 40 + 50}%)`,
            type: 'fire'
        });
    }

    // Dynamically update the victory screen elements based on currentPlanet
    const vicScreen = document.getElementById('victory-screen');
    if (vicScreen) {
        const vicTitle = vicScreen.querySelector('.victory-title');
        const vicSubtitle = vicScreen.querySelector('.victory-subtitle');

        // Update stats (User feature 4)
        const shotsVal = document.getElementById('stat-shots-value');
        const timeVal = document.getElementById('stat-time-value');
        if (shotsVal) shotsVal.textContent = totalShotsFired;
        if (timeVal) {
            const seconds = Math.floor(planetTimeSpent);
            if (seconds < 60) {
                timeVal.textContent = `${seconds}s`;
            } else {
                const m = Math.floor(seconds / 60);
                const s = seconds % 60;
                timeVal.textContent = `${m}m ${s}s`;
            }
        }

        // previousBest is defined at function scope
        const bestRow = document.getElementById('stat-best-time-row');
        const bestVal = document.getElementById('stat-best-time-value');
        const bestBadge = document.getElementById('new-best-badge');
        if (bestBadge) bestBadge.style.display = 'none';

        if (bestRow && bestVal) {
            if (previousBest !== undefined) {
                bestRow.style.display = 'flex';
                // If this run is a new best time, display the current run time in the Best Time slot
                const isNewBest = (planetTimeSpent < previousBest);
                const displayTime = isNewBest ? planetTimeSpent : previousBest;
                const seconds = Math.floor(displayTime);
                if (seconds < 60) {
                    bestVal.textContent = `${seconds}s`;
                } else {
                    const m = Math.floor(seconds / 60);
                    const s = seconds % 60;
                    bestVal.textContent = `${m}m ${s}s`;
                }

                if (isNewBest && bestBadge) {
                    bestBadge.style.display = 'inline-block';
                }
            } else {
                bestRow.style.display = 'none';
            }
        }

        if (previousBest === undefined || planetTimeSpent < previousBest) {
            bestTimes[currentPlanet] = planetTimeSpent;
            saveBestTimes();
        }

        if (vicTitle && vicSubtitle) {
            const t = translations[currentLanguage] || translations['en'];
            if (currentPlanet === 'mars') {
                vicTitle.textContent = t.marsAnnihilated;
                vicSubtitle.textContent = t.marsSubtitle;
            } else if (currentPlanet === 'neptune') {
                vicTitle.textContent = t.neptuneAnnihilated;
                vicSubtitle.textContent = t.neptuneSubtitle;
            } else if (currentPlanet === 'jupiter') {
                vicTitle.textContent = t.jupiterAnnihilated;
                vicSubtitle.textContent = t.jupiterSubtitle;
            } else if (currentPlanet === 'sun') {
                vicTitle.textContent = t.sunAnnihilated;
                vicSubtitle.textContent = t.sunSubtitle;
            } else if (currentPlanet === 'neutron_star') {
                vicTitle.textContent = t.neutron_starAnnihilated || 'NEUTRON STAR ANNIHILATED';
                vicSubtitle.textContent = t.neutron_starSubtitle;
            } else {
                vicTitle.textContent = t.earthAnnihilated;
                vicSubtitle.textContent = t.earthSubtitle;
            }
        }
    }

    // Completely clear planet
    hiddenCtx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
    currentPixelCount = 0;

    // Unlock the next planet in progression!
    const nextPlanetToUnlock = getNextPlanet(currentPlanet);
    if (!unlockedPlanets.includes(nextPlanetToUnlock)) {
        unlockedPlanets.push(nextPlanetToUnlock);
        saveUnlockedPlanets();
        updatePlanetButtons();
    }

    setTimeout(() => {
        document.getElementById('victory-screen').classList.add('show');
        const t = translations[currentLanguage] || translations['en'];

        // Update the button to show the next planet
        const restartBtn = document.getElementById('restart-button');
        const next = getNextPlanet(currentPlanet);
        const nextPlanetLabel = next === 'earth' ? t.restartSim : `${t.next}: ${(t.planets[next] || next).toUpperCase()}`;
        if (restartBtn) {
            restartBtn.textContent = nextPlanetLabel;
            restartBtn.disabled = false;
            restartBtn.style.opacity = '1';
            restartBtn.style.pointerEvents = 'auto';
            restartBtn.style.cursor = 'pointer';
            restartBtn.isSpinnerStopButton = false;
        }

        // Setup the Victory Spinner
        const container = document.getElementById('victory-spinner-container');
        if (container) {
            const allLockedWeapons = ALL_LOCKED_WEAPONS;
            const hasLocked = allLockedWeapons.some(wid => !unlockedWeapons.includes(wid));

            if (restartBtn) {
                restartBtn.style.display = 'block';
            }

            if (hasLocked) {
                const isClaimed = claimedPlanetSpinners.includes(currentPlanet);
                if (isClaimed) {
                    const spinner = new WeaponSpinner(container, {
                        onStop: (weaponToUnlock) => {
                            unlockSpecificWeapon(weaponToUnlock);
                            if (!claimedPlanetSpinners.includes(currentPlanet)) {
                                claimedPlanetSpinners.push(currentPlanet);
                                saveClaimedPlanetSpinners();
                            }
                            if (restartBtn) {
                                restartBtn.textContent = nextPlanetLabel;
                                restartBtn.disabled = false;
                                restartBtn.style.opacity = '1';
                                restartBtn.style.pointerEvents = 'auto';
                                restartBtn.style.cursor = 'pointer';
                                restartBtn.isSpinnerStopButton = false;
                            }
                        }
                    });

                    // Add CLAIMED overlay over the spinner
                    container.style.position = 'relative';
                    const overlay = document.createElement('div');
                    overlay.className = 'spinner-claimed-overlay';
                    overlay.innerHTML = `
                        <div class="claimed-text">${t.claimed || 'CLAIMED'}</div>
                        <button class="restart-button ad-spin-btn" style="width: auto; height: 50px; font-size: 16px; margin-top: 15px; padding: 0 20px; letter-spacing: 2px;">🎬 ${t.watchAdToSpin || 'WATCH AD TO SPIN'}</button>
                    `;
                    container.appendChild(overlay);

                    const adBtn = overlay.querySelector('.ad-spin-btn');
                    adBtn.addEventListener('mouseenter', () => {
                        container.classList.add('primed-pulse');
                    });
                    adBtn.addEventListener('mouseleave', () => {
                        container.classList.remove('primed-pulse');
                    });

                    adBtn.addEventListener('click', (e) => {
                        e.stopPropagation();
                        container.classList.remove('primed-pulse');
                        soundManager.play('sfx_ui_switch');
                        if (restartBtn) {
                            restartBtn.textContent = (translations[currentLanguage] || translations['en']).stopSpinner || 'STOP SPINNER';
                            restartBtn.isSpinnerStopButton = true;
                            restartBtn.disabled = true;
                            restartBtn.style.opacity = '0.5';
                            restartBtn.style.pointerEvents = 'none';
                            restartBtn.style.cursor = 'default';
                        }
                        if (window.PlatformBridge && typeof window.PlatformBridge.showRewardedAd === 'function') {
                            window.PlatformBridge.showRewardedAd(() => {
                                startReplaySpinner();
                            });
                        } else {
                            startReplaySpinner();
                        }
                    });

                    const startReplaySpinner = () => {
                        overlay.remove();
                        spinner.start();
                    };
                } else {
                    if (restartBtn) {
                        restartBtn.textContent = (translations[currentLanguage] || translations['en']).stopSpinner || 'STOP SPINNER';
                        restartBtn.isSpinnerStopButton = true;
                        restartBtn.disabled = true;
                        restartBtn.style.opacity = '0.5';
                        restartBtn.style.pointerEvents = 'none';
                        restartBtn.style.cursor = 'default';
                    }

                    const spinner = new WeaponSpinner(container, {
                        onStart: () => {
                            const checkInterval = setInterval(() => {
                                if (spinner.isDestroyed || !spinner.isSpinning) {
                                    clearInterval(checkInterval);
                                    return;
                                }
                                if (spinner.spinPhase === 'running') {
                                    clearInterval(checkInterval);
                                    if (restartBtn && restartBtn.isSpinnerStopButton) {
                                        restartBtn.disabled = false;
                                        restartBtn.style.opacity = '1';
                                        restartBtn.style.pointerEvents = 'auto';
                                        restartBtn.style.cursor = 'pointer';
                                    }
                                }
                            }, 50);
                        },
                        onStop: (weaponToUnlock) => {
                            unlockSpecificWeapon(weaponToUnlock);
                            if (!claimedPlanetSpinners.includes(currentPlanet)) {
                                claimedPlanetSpinners.push(currentPlanet);
                                saveClaimedPlanetSpinners();
                            }
                            if (restartBtn) {
                                restartBtn.textContent = nextPlanetLabel;
                                restartBtn.disabled = false;
                                restartBtn.style.opacity = '1';
                                restartBtn.style.pointerEvents = 'auto';
                                restartBtn.style.cursor = 'pointer';
                                restartBtn.isSpinnerStopButton = false;
                            }
                        }
                    });
                    spinner.start();
                }
            } else {
                new WeaponSpinner(container); // Shows "ALL WEAPONS UNLOCKED!"
            }
        }
    }, 1200);
}

function getNextPlanet(planet) {
    const idx = PLANET_ORDER.indexOf(planet);
    return PLANET_ORDER[(idx + 1) % PLANET_ORDER.length];
}

function updatePlanetButtons() {
    PLANET_ORDER.forEach((planet, index) => {
        const btn = document.getElementById(`btn-planet-${planet}`);
        if (!btn) return;

        const isUnlocked = unlockedPlanets.includes(planet);
        if (isUnlocked) {
            btn.classList.remove('locked');
            btn.removeAttribute('data-tooltip');
            const iconSpan = btn.querySelector('.planet-btn-icon');
            if (iconSpan) {
                if (planet === 'earth') iconSpan.textContent = '🌍';
                else if (planet === 'mars') iconSpan.textContent = '🔴';
                else if (planet === 'neptune') iconSpan.textContent = '🔵';
                else if (planet === 'jupiter') iconSpan.textContent = '🪐';
                else if (planet === 'sun') iconSpan.textContent = '☀️';
            }
        } else {
            btn.classList.add('locked');
            const prevPlanet = PLANET_ORDER[index - 1];
            const tLock = translations[currentLanguage] || translations['en'];
            const prevName = (tLock.planets[prevPlanet] || prevPlanet).toUpperCase();
            const destroyVerb = (tLock.annihilate || 'DESTROY').toUpperCase();
            const toUnlockText = (tLock.toUnlock || 'TO UNLOCK!').toUpperCase();
            btn.setAttribute('data-tooltip', `${destroyVerb} ${prevName}\n${toUnlockText}`);

            const iconSpan = btn.querySelector('.planet-btn-icon');
            if (iconSpan) {
                iconSpan.textContent = '🔒';
            }
        }
    });
}

// Reset Game values
function resetGame(keepCooldowns = false, isPlanetSwitch = false) {
    if (typeof weaponAmmo !== 'undefined') {
        weaponAmmo.nuke = 18;
        weaponAmmo.bowling = 15;
        weaponAmmo.mysterybox = 4;
        weaponAmmo.drill = 5;
        if (typeof updateAmmoUI === 'function') {
            updateAmmoUI();
        }
    }
    if (window.activeWeaponSpinner) {
        window.activeWeaponSpinner.destroy();
    }
    soundManager.stopLoop('sfx_laser_fire');
    soundManager.stopLoop('sfx_laser_hum');
    soundManager.stopLoop('sfx_gamma_beam');
    soundManager.stopLoop('sfx_sword_rumble_loop');
    weapons = [];
    particles.clear();
    shockwaves = [];
    holyRays = [];
    activeDrills = [];
    if (!keepCooldowns) {
        totalShotsFired = 0;
        totalCratersMade = 0;
        planetTimeSpent = 0;
    }
    planetRotation = 0;
    victoryTriggered = false;
    screenShake = { x: 0, y: 0, intensity: 0, duration: 0 };
    isHolding = false;
    missileLaunchTimer = 0;
    laserLaunchTimer = 0;
    activeGammaBursts = [];
    activeSwords = [];
    activeBowlingBalls = [];
    activeKrakens = [];
    activeWorms = [];
    activeBlackHoles = [];
    activeFists = [];
    activeFistVisualExplosions = [];
    activeStars = [];
    activeStarProjectiles = [];
    activeMysteryBoxes = [];
    activeFallingDucks = [];
    if (typeof hasSpawnedBlackHoleFromMysteryBox !== 'undefined') {
        hasSpawnedBlackHoleFromMysteryBox = false;
    }
    if (iceGrid) iceGrid.fill(0);
    fistStuckCount = 0;

    for (const key in weaponQueues) delete weaponQueues[key];

    if (!keepCooldowns) {
        gammaBurstCooldown = STARTING_COOLDOWNS.gammaBurst;
        laserCooldown = STARTING_COOLDOWNS.laser;
        asteroidCooldown = STARTING_COOLDOWNS.asteroid;
        swordCooldown = 0;
        mysteryboxCooldown = STARTING_COOLDOWNS.mysterybox;
        moonCooldown = STARTING_COOLDOWNS.moon;
        isInitialAsteroidCooldown = true;
        isInitialLaserCooldown = true;
        isInitialGammaCooldown = true;
        isInitialSwordCooldown = false;
        isInitialMysteryBoxCooldown = true;
        isInitialMoonCooldown = true;
        nukeCooldown = 0;
        missileCooldown = 0;
        bowlingCooldown = 0;
        krakenCooldown = 0;
        wormCooldown = 0.0;
        isInitialWormCooldown = false;
        blackholeCooldown = STARTING_COOLDOWNS.blackhole;
        isInitialBlackholeCooldown = true;
        fistCooldown = 0;
        starCooldown = 0;
        isInitialStarCooldown = false;
        cometCooldown = 0;
        isInitialCometCooldown = false;
        lightningCooldown = 0;
        isInitialLightningCooldown = false;

        const gammaUi = document.getElementById('gamma-cooldown-ui');
        if (gammaUi) {
            const text = gammaUi.querySelector('.cooldown-text');
            const bar = gammaUi.querySelector('.cooldown-bar');
            if (text) text.textContent = '';
            if (bar) bar.style.height = '0%';
        }
        const gammaBtn = document.getElementById('btn-gamma');
        if (gammaBtn) {
            gammaBtn.classList.remove('cooldown-active');
        }
        const laserUi = document.getElementById('laser-cooldown-ui');
        if (laserUi) {
            const text = laserUi.querySelector('.cooldown-text');
            const bar = laserUi.querySelector('.cooldown-bar');
            if (text) text.textContent = '';
            if (bar) bar.style.height = '0%';
        }
        const laserBtn = document.getElementById('btn-laser');
        if (laserBtn) {
            laserBtn.classList.remove('cooldown-active');
        }
        const asteroidUi = document.getElementById('asteroid-cooldown-ui');
        if (asteroidUi) {
            const text = asteroidUi.querySelector('.cooldown-text');
            const bar = asteroidUi.querySelector('.cooldown-bar');
            if (text) text.textContent = '';
            if (bar) bar.style.height = '0%';
        }
        const asteroidBtn = document.getElementById('btn-asteroid');
        if (asteroidBtn) {
            asteroidBtn.classList.remove('cooldown-active');
        }
        const moonUi = document.getElementById('moon-cooldown-ui');
        if (moonUi) {
            const text = moonUi.querySelector('.cooldown-text');
            const bar = moonUi.querySelector('.cooldown-bar');
            if (text) text.textContent = '';
            if (bar) bar.style.height = '0%';
        }
        const moonBtn = document.getElementById('btn-moon');
        if (moonBtn) {
            moonBtn.classList.remove('cooldown-active');
        }
        const swordUi = document.getElementById('sword-cooldown-ui');
        if (swordUi) {
            const text = swordUi.querySelector('.cooldown-text');
            const bar = swordUi.querySelector('.cooldown-bar');
            if (text) text.textContent = '';
            if (bar) bar.style.height = '0%';
        }
        const swordBtn = document.getElementById('btn-sword');
        if (swordBtn) {
            swordBtn.classList.remove('cooldown-active');
        }
        const mysteryboxUi = document.getElementById('mysterybox-cooldown-ui');
        if (mysteryboxUi) {
            const text = mysteryboxUi.querySelector('.cooldown-text');
            const bar = mysteryboxUi.querySelector('.cooldown-bar');
            if (text) text.textContent = '';
            if (bar) bar.style.height = '0%';
        }
        const mysteryboxBtn = document.getElementById('btn-mysterybox');
        if (mysteryboxBtn) {
            mysteryboxBtn.classList.remove('cooldown-active');
        }
        const bowlingUi = document.getElementById('bowling-cooldown-ui');
        if (bowlingUi) {
            const text = bowlingUi.querySelector('.cooldown-text');
            const bar = bowlingUi.querySelector('.cooldown-bar');
            if (text) text.textContent = '';
            if (bar) bar.style.height = '0%';
        }
        const bowlingBtn = document.getElementById('btn-bowling');
        if (bowlingBtn) {
            bowlingBtn.classList.remove('cooldown-active');
            bowlingBtn.classList.remove('locked-active');
        }
        const krakenUi = document.getElementById('kraken-cooldown-ui');
        if (krakenUi) {
            const text = krakenUi.querySelector('.cooldown-text');
            const bar = krakenUi.querySelector('.cooldown-bar');
            if (text) text.textContent = '';
            if (bar) bar.style.height = '0%';
        }
        const krakenBtn = document.getElementById('btn-kraken');
        if (krakenBtn) {
            krakenBtn.classList.remove('cooldown-active');
        }
        const wormUi = document.getElementById('worm-cooldown-ui');
        if (wormUi) {
            const text = wormUi.querySelector('.cooldown-text');
            const bar = wormUi.querySelector('.cooldown-bar');
            if (text) text.textContent = '';
            if (bar) bar.style.height = '0%';
        }
        const wormBtn = document.getElementById('btn-worm');
        if (wormBtn) wormBtn.classList.remove('cooldown-active');

        const blackholeUi = document.getElementById('blackhole-cooldown-ui');
        if (blackholeUi) {
            const text = blackholeUi.querySelector('.cooldown-text');
            const bar = blackholeUi.querySelector('.cooldown-bar');
            if (text) text.textContent = '';
            if (bar) bar.style.height = '0%';
        }
        const blackholeBtn = document.getElementById('btn-blackhole');
        if (blackholeBtn) blackholeBtn.classList.remove('cooldown-active');

        const fistUi = document.getElementById('fist-cooldown-ui');
        if (fistUi) {
            const text = fistUi.querySelector('.cooldown-text');
            const bar = fistUi.querySelector('.cooldown-bar');
            if (text) text.textContent = '';
            if (bar) bar.style.height = '0%';
        }
        const fistBtn = document.getElementById('btn-fist');
        if (fistBtn) fistBtn.classList.remove('cooldown-active');
    }

    // Apply progression locks and dynamic cooldown updates
    refreshWeaponLocks();

    document.getElementById('victory-screen').classList.remove('show');
    initializePlanet();
    generateStars();
    if (window.PlatformBridge && gameplayStarted && !isPlanetSwitch) {
        window.PlatformBridge.gameplayStart();
    }
    if (window.ShootingStarManager) {
        window.ShootingStarManager.init();
    }
}

// Find impact point of laser on rotating planet surface
function findLaserImpact(spawnX, spawnY) {
    const screenCenterX = CENTER_X;
    const screenCenterY = CENTER_Y;
    const dx = screenCenterX - spawnX;
    const dy = screenCenterY - spawnY;
    const dist = Math.sqrt(dx * dx + dy * dy);

    let impactX = screenCenterX;
    let impactY = screenCenterY;
    let localHit = null;

    if (dist > 0) {
        const imgData = hiddenCtx.getImageData(0, 0, PLANET_CANVAS_SIZE, PLANET_CANVAS_SIZE);
        const data = imgData.data;

        const stepSize = 2; // high precision step size in pixels
        // Extend ray past center: planet radius + 200px extra to reach far side
        const totalDist = dist + getPlanetSize() / 2 + 200;
        const numSteps = totalDist / stepSize;
        const stepX = (dx / dist) * stepSize;
        const stepY = (dy / dist) * stepSize;

        let rx = spawnX;
        let ry = spawnY;

        const cos = Math.cos(-planetRotation);
        const sin = Math.sin(-planetRotation);

        for (let s = 0; s < numSteps; s++) {
            const rx_dx = rx - screenCenterX;
            const ry_dy = ry - screenCenterY;
            const px = Math.floor(rx_dx * cos - ry_dy * sin + planetCenterX);
            const py = Math.floor(rx_dx * sin + ry_dy * cos + planetCenterY);

            if (px >= 0 && px < PLANET_CANVAS_SIZE && py >= 0 && py < PLANET_CANVAS_SIZE) {
                const idx = (py * PLANET_CANVAS_SIZE + px) * 4;
                if (data[idx + 3] > 0) {
                    impactX = rx;
                    impactY = ry;
                    localHit = {
                        x: rx_dx * cos - ry_dy * sin + planetCenterX,
                        y: rx_dx * sin + ry_dy * cos + planetCenterY
                    };
                    break;
                }
            }
            rx += stepX;
            ry += stepY;
        }
    }
    return { x: impactX, y: impactY, local: localHit };
}

// Spawn weapon at clicked location
