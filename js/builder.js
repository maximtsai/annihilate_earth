// Planet Builder Mode Logic & Event Handlers

// Planet Builder Tool state variables
var activeTool = 'brush';
var brushSize = 8;
var brushColor = '#00d9ff';
var isDrawing = false;
var lastLocalPos = null;
var previewPlanetSize = null;
var isDraggingSizeSlider = false;
var coreFlashUntil = 0;

// Converts screen coordinates to local planet canvas coordinates
function screenToLocal(screenX, screenY) {
    let dx = screenX - CENTER_X;
    let dy = screenY - CENTER_Y;
    dx /= planetScale;
    dy /= planetScale;
    const cos = Math.cos(-planetRotation);
    const sin = Math.sin(-planetRotation);
    const rotX = dx * cos - dy * sin;
    const rotY = dx * sin + dy * cos;
    const localX = rotX + planetCenterX;
    const localY = rotY + planetCenterY;
    return { x: localX, y: localY };
}

// Draws a single circle point on the hidden canvas
function drawBrush(x, y) {
    hiddenCtx.save();
    if (customPlanetEnforceCircle) {
        hiddenCtx.beginPath();
        hiddenCtx.arc(planetCenterX, planetCenterY, getPlanetSize() / 2, 0, Math.PI * 2);
        hiddenCtx.clip();
    }
    hiddenCtx.beginPath();
    hiddenCtx.fillStyle = brushColor;
    hiddenCtx.arc(x, y, brushSize, 0, Math.PI * 2);
    hiddenCtx.fill();
    hiddenCtx.restore();
}

// Draws a continuous smooth line between two points on the hidden canvas
function drawBrushLine(x1, y1, x2, y2) {
    hiddenCtx.save();
    if (customPlanetEnforceCircle) {
        hiddenCtx.beginPath();
        hiddenCtx.arc(planetCenterX, planetCenterY, getPlanetSize() / 2, 0, Math.PI * 2);
        hiddenCtx.clip();
    }
    hiddenCtx.beginPath();
    hiddenCtx.strokeStyle = brushColor;
    hiddenCtx.lineWidth = brushSize * 2;
    hiddenCtx.lineCap = 'round';
    hiddenCtx.lineJoin = 'round';
    hiddenCtx.moveTo(x1, y1);
    hiddenCtx.lineTo(x2, y2);
    hiddenCtx.stroke();
    hiddenCtx.restore();
}

// Highly optimized queue-based flood fill algorithm
function floodFill(startX, startY, fillColorHex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(fillColorHex);
    const fillRgb = result ? {
        r: parseInt(result[1], 16),
        g: parseInt(result[2], 16),
        b: parseInt(result[3], 16)
    } : null;
    if (!fillRgb) return;

    const width = hiddenCanvas.width;
    const height = hiddenCanvas.height;
    const imgData = hiddenCtx.getImageData(0, 0, width, height);
    const data = imgData.data;

    const x0 = Math.round(startX);
    const y0 = Math.round(startY);

    if (x0 < 0 || x0 >= width || y0 < 0 || y0 >= height) return;

    const startIdx = (y0 * width + x0) * 4;
    const startR = data[startIdx];
    const startG = data[startIdx + 1];
    const startB = data[startIdx + 2];
    const startA = data[startIdx + 3];

    // Do not fill empty space (alpha === 0)
    if (startA === 0) return;
    // Do not fill if target color is already the replacement color
    if (startR === fillRgb.r && startG === fillRgb.g && startB === fillRgb.b) return;

    const queue = [];
    data[startIdx] = fillRgb.r;
    data[startIdx + 1] = fillRgb.g;
    data[startIdx + 2] = fillRgb.b;
    data[startIdx + 3] = 255;
    queue.push(x0, y0);

    while (queue.length > 0) {
        const currY = queue.pop();
        const currX = queue.pop();

        const neighbors = [
            { x: currX - 1, y: currY },
            { x: currX + 1, y: currY },
            { x: currX, y: currY - 1 },
            { x: currX, y: currY + 1 }
        ];

        for (const n of neighbors) {
            if (n.x >= 0 && n.x < width && n.y >= 0 && n.y < height) {
                const nIdx = (n.y * width + n.x) * 4;
                if (data[nIdx + 3] > 0 && data[nIdx] === startR && data[nIdx + 1] === startG && data[nIdx + 2] === startB) {
                    data[nIdx] = fillRgb.r;
                    data[nIdx + 1] = fillRgb.g;
                    data[nIdx + 2] = fillRgb.b;
                    data[nIdx + 3] = 255;
                    queue.push(n.x, n.y);
                }
            }
        }
    }

    hiddenCtx.putImageData(imgData, 0, 0);
}

// Routes pointer events inside the custom planet builder mode
function handlePlanetBuilderInput(x, y, eventType) {
    if (eventType === 'down') {
        const localPos = screenToLocal(x, y);
        if (customPlanetEnforceCircle) {
            const dx = localPos.x - planetCenterX;
            const dy = localPos.y - planetCenterY;
            const dist = Math.sqrt(dx * dx + dy * dy);
            if (dist > getPlanetSize() / 2) return;
        }

        if (activeTool === 'brush') {
            isDrawing = true;
            lastLocalPos = localPos;
            drawBrush(localPos.x, localPos.y);
        } else if (activeTool === 'bucket') {
            floodFill(localPos.x, localPos.y, brushColor);
            calculateCenterOfMass();
        }
    } else if (eventType === 'move') {
        if (!isDrawing || !lastLocalPos) return;
        const localPos = screenToLocal(x, y);
        drawBrushLine(lastLocalPos.x, lastLocalPos.y, localPos.x, localPos.y);
        lastLocalPos = localPos;
    } else if (eventType === 'up') {
        if (isDrawing) {
            isDrawing = false;
            lastLocalPos = null;
            calculateCenterOfMass();
        }
    }
}

// Transitions the game into Planet Builder Mode
function startPlanetBuilderMode() {
    currentPlanet = 'custom';
    CENTER_Y = 450 + PLANET_OFFSET_Y - 100; // Shift planet up by 100px
    isMainMenuActive = false;
    gameplayStarted = true;

    const mainMenu = document.getElementById('main-menu');
    if (mainMenu) mainMenu.classList.add('hidden');

    const weaponBar = document.querySelector('.weapon-bar-wrapper');
    if (weaponBar) weaponBar.style.display = 'none';

    const lvlBtnWrapper = document.getElementById('level-select-btn-wrapper');
    if (lvlBtnWrapper) lvlBtnWrapper.style.display = 'none';

    const optBtnWrapper = document.getElementById('options-btn-wrapper');
    if (optBtnWrapper) optBtnWrapper.style.display = 'block';

    const toolsBar = document.getElementById('tools-bar-wrapper');
    if (toolsBar) toolsBar.style.display = 'block';

    // Reset sliders/checkboxes in the UI to match defaults
    const sizeSlider = document.getElementById('tool-size-slider');
    const durabilitySlider = document.getElementById('tool-durability-slider');
    const rotationSlider = document.getElementById('tool-rotation-slider');
    const coreCheckbox = document.getElementById('tool-core-checkbox');
    const sizeDisplay = document.getElementById('size-val-display');
    const durabilityDisplay = document.getElementById('durability-val-display');
    const rotationDisplay = document.getElementById('rotation-val-display');

    customPlanetSize = 240;
    customPlanetDurability = 0;
    customPlanetHasCore = true;
    customPlanetRotationSpeed = 1.0;
    customPlanetEnforceCircle = true;

    if (sizeSlider) sizeSlider.value = 240;
    if (durabilitySlider) durabilitySlider.value = 0;
    if (rotationSlider) rotationSlider.value = 25;
    if (coreCheckbox) coreCheckbox.checked = true;
    const circleCheckbox = document.getElementById('tool-circle-checkbox');
    if (circleCheckbox) circleCheckbox.checked = true;
    if (sizeDisplay) sizeDisplay.textContent = '240km';
    if (durabilityDisplay) durabilityDisplay.textContent = '0%';
    if (rotationDisplay) rotationDisplay.textContent = '1.0x';

    resetGame(false);
}

// Exits Planet Builder Mode and returns to the Main Menu
function exitPlanetBuilderMode() {
    const toolsBar = document.getElementById('tools-bar-wrapper');
    if (toolsBar) toolsBar.style.display = 'none';
    
    CENTER_Y = 450 + PLANET_OFFSET_Y; // Restore planet position

    if (window.showMainMenu) {
        window.showMainMenu();
    }
}

// Sets up all event listeners for the Planet Builder tools panel UI
function setupPlanetBuilderEvents() {
    // Tool selection
    const brushBtn = document.getElementById('tool-brush');
    const bucketBtn = document.getElementById('tool-bucket');
    const clearBtn = document.getElementById('tool-clear');

    if (brushBtn) {
        brushBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            activeTool = 'brush';
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('selected'));
            brushBtn.classList.add('selected');
        });
    }
    if (bucketBtn) {
        bucketBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            activeTool = 'bucket';
            document.querySelectorAll('.tool-button').forEach(btn => btn.classList.remove('selected'));
            bucketBtn.classList.add('selected');
        });
    }
    if (clearBtn) {
        clearBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            resetGame(false);
        });
    }

    // Brush sizes
    const sizeBtns = {
        '4': document.getElementById('brush-size-s'),
        '8': document.getElementById('brush-size-m'),
        '16': document.getElementById('brush-size-l')
    };
    Object.entries(sizeBtns).forEach(([size, btn]) => {
        if (btn) {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                soundManager.play('sfx_ui_switch');
                brushSize = parseInt(size);
                document.querySelectorAll('.size-button').forEach(b => b.classList.remove('selected'));
                btn.classList.add('selected');
            });
        }
    });

    // Color Picker
    const colorPicker = document.getElementById('tool-color-picker');
    if (colorPicker) {
        colorPicker.addEventListener('input', (e) => {
            brushColor = e.target.value;
        });
    }

    // Planet Size Slider
    const sizeSlider = document.getElementById('tool-size-slider');
    const sizeDisplay = document.getElementById('size-val-display');
    if (sizeSlider) {
        sizeSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (sizeDisplay) sizeDisplay.textContent = val + 'km';
            isDraggingSizeSlider = true;
            previewPlanetSize = val;
        });
        sizeSlider.addEventListener('change', (e) => {
            const val = parseInt(e.target.value);
            isDraggingSizeSlider = false;
            customPlanetSize = val;
            resetGame(false);
        });
    }

    // Durability Slider
    const durabilitySlider = document.getElementById('tool-durability-slider');
    const durabilityDisplay = document.getElementById('durability-val-display');
    if (durabilitySlider) {
        durabilitySlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            if (durabilityDisplay) durabilityDisplay.textContent = val + '%';
            customPlanetDurability = val;
        });
    }

    // Rotation Speed Slider
    const rotationSlider = document.getElementById('tool-rotation-slider');
    const rotationDisplay = document.getElementById('rotation-val-display');
    if (rotationSlider) {
        rotationSlider.addEventListener('input', (e) => {
            const val = parseInt(e.target.value);
            const multiplier = val / 25.0;
            if (rotationDisplay) {
                rotationDisplay.textContent = multiplier.toFixed(1) + 'x';
            }
            customPlanetRotationSpeed = multiplier;
        });
    }

    // Core Checkbox
    const coreCheckbox = document.getElementById('tool-core-checkbox');
    if (coreCheckbox) {
        coreCheckbox.addEventListener('change', (e) => {
            customPlanetHasCore = e.target.checked;
            if (customPlanetHasCore) {
                coreFlashUntil = Date.now() + 1500;
            }
            resetGame(false);
        });
    }

    // Circle Checkbox
    const circleCheckbox = document.getElementById('tool-circle-checkbox');
    if (circleCheckbox) {
        circleCheckbox.addEventListener('change', (e) => {
            customPlanetEnforceCircle = e.target.checked;
        });
    }

    // Exit Button
    const exitBtn = document.getElementById('tool-exit-btn');
    if (exitBtn) {
        exitBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            exitPlanetBuilderMode();
        });
    }
}
