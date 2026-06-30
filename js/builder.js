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
var planetToDelete = null;

// Converts screen coordinates to local planet canvas coordinates
function builderScreenToLocal(screenX, screenY) {
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
        const localPos = builderScreenToLocal(x, y);
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
        const localPos = builderScreenToLocal(x, y);
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
    gameMode = 'builder';
    CENTER_Y = 450 + PLANET_OFFSET_Y - 100; // Shift planet up by 100px

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
    const rotationSlider = document.getElementById('tool-rotation-slider');
    const coreCheckbox = document.getElementById('tool-core-checkbox');
    const sizeDisplay = document.getElementById('size-val-display');
    const rotationDisplay = document.getElementById('rotation-val-display');

    customPlanetSize = 240;
    customPlanetDurability = 0;
    customPlanetHasCore = true;
    customPlanetRotationSpeed = 1.0;
    customPlanetEnforceCircle = true;

    if (sizeSlider) sizeSlider.value = 240;
    if (rotationSlider) rotationSlider.value = 25;
    if (coreCheckbox) coreCheckbox.checked = true;
    const circleCheckbox = document.getElementById('tool-circle-checkbox');
    if (circleCheckbox) circleCheckbox.checked = true;
    if (sizeDisplay) sizeDisplay.textContent = '240km';
    if (rotationDisplay) rotationDisplay.textContent = '1.0x';

    // Reset color picker button background
    const colorWrapper = document.querySelector('.color-picker-wrapper');
    if (colorWrapper) colorWrapper.style.backgroundColor = '#00d9ff';

    resetGame(false);
}

// Exits Planet Builder Mode and returns to the Main Menu
function exitPlanetBuilderMode() {
    isDrawing = false;
    lastLocalPos = null;
    gameMode = 'menu';

    const toolsBar = document.getElementById('tools-bar-wrapper');
    if (toolsBar) toolsBar.style.display = 'none';
    
    CENTER_Y = 450 + PLANET_OFFSET_Y; // Restore planet position

    // Restore currentPlanet to the player's highest unlocked planet
    if (typeof unlockedPlanets !== 'undefined' && unlockedPlanets.length > 0) {
        currentPlanet = unlockedPlanets[unlockedPlanets.length - 1];
    } else {
        currentPlanet = 'earth';
    }

    resetGame(true);

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
            hiddenCtx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
            resetGame(false);
        });
    }

    // Brush sizes
    const sizeBtns = {
        '2': document.getElementById('brush-size-s'),
        '8': document.getElementById('brush-size-m'),
        '24': document.getElementById('brush-size-l')
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
    const colorWrapper = document.querySelector('.color-picker-wrapper');
    
    // Set initial background color
    if (colorWrapper) colorWrapper.style.backgroundColor = brushColor;

    if (colorPicker) {
        colorPicker.addEventListener('input', (e) => {
            brushColor = e.target.value;
            if (colorWrapper) {
                colorWrapper.style.backgroundColor = brushColor;
            }
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
            // Clear canvas so initializePlanet() knows to regenerate a clean circle at the new size
            hiddenCtx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
            resetGame(false);
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
            initializePlanet();
        });
    }

    // Circle Checkbox
    const circleCheckbox = document.getElementById('tool-circle-checkbox');
    if (circleCheckbox) {
        circleCheckbox.addEventListener('change', (e) => {
            customPlanetEnforceCircle = e.target.checked;
        });
    }

    // Upload Button
    const uploadBtn = document.getElementById('tool-upload-btn');
    const uploadInput = document.getElementById('tool-upload-input');
    if (uploadBtn && uploadInput) {
        uploadBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            uploadInput.click();
        });

        uploadInput.addEventListener('change', (e) => {
            const file = e.target.files[0];
            if (!file) return;

            const reader = new FileReader();
            reader.onload = (event) => {
                const img = new Image();
                img.onload = () => {
                    // 1. Clear the canvas
                    hiddenCtx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
                    
                    // 2. Scale image to a square matching the planet's size, centered
                    const size = getPlanetSize();
                    const w = size;
                    const h = size;
                    const x = planetCenterX - w / 2;
                    const y = planetCenterY - h / 2;

                    // 3. Draw the image (respecting transparency)
                    hiddenCtx.drawImage(img, x, y, w, h);

                    // 4. Update the game physics and sound
                    calculateCenterOfMass();
                    resetGame(false);
                    soundManager.play('sfx_ui_switch');
                };
                img.src = event.target.result;
            };
            reader.readAsDataURL(file);
        });
    }

    // Save Button and Naming Modal
    const saveBtn = document.getElementById('tool-save-btn');
    const nameOverlay = document.getElementById('name-popup-overlay');
    const nameInput = document.getElementById('planet-name-input');
    const nameSaveBtn = document.getElementById('name-popup-save');
    const nameCancelBtn = document.getElementById('name-popup-cancel');

    if (saveBtn && nameOverlay) {
        saveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            if (nameInput) nameInput.value = '';
            nameOverlay.style.display = 'flex';
        });
    }

    if (nameCancelBtn && nameOverlay) {
        nameCancelBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            nameOverlay.style.display = 'none';
        });
    }

    if (nameSaveBtn && nameOverlay && nameInput) {
        nameSaveBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            soundManager.play('sfx_ui_switch');
            
            let name = nameInput.value.trim();
            if (!name) {
                name = 'CUSTOM PLANET';
            }

            const planetData = {
                name: name,
                size: customPlanetSize,
                durability: customPlanetDurability,
                hasCore: customPlanetHasCore,
                rotationSpeed: customPlanetRotationSpeed,
                enforceCircle: customPlanetEnforceCircle,
                image: hiddenCanvas.toDataURL()
            };

            // Save via Tauri if available, otherwise fall back to localStorage
            if (window.__TAURI__) {
                window.__TAURI__.invoke('save_custom_planet', { name: name, data: JSON.stringify(planetData) })
                    .then(() => {
                        showUnlockNotification("PLANET SAVED!");
                    })
                    .catch(err => {
                        console.error("Tauri save failed, falling back to localStorage:", err);
                        localStorage.setItem('custom_planet_' + name, JSON.stringify(planetData));
                        showUnlockNotification("PLANET SAVED!");
                    });
            } else {
                localStorage.setItem('custom_planet_' + name, JSON.stringify(planetData));
                showUnlockNotification("PLANET SAVED!");
            }

            nameOverlay.style.display = 'none';
        });
    }
}

// Loads a saved custom planet into gameplay
function loadCustomPlanet(savedData) {
    currentPlanet = 'custom';
    gameMode = 'gameplay';
    
    // Set custom planet metadata
    customPlanetSize = savedData.size;
    customPlanetDurability = savedData.durability;
    customPlanetHasCore = savedData.hasCore;
    customPlanetRotationSpeed = savedData.rotationSpeed;
    customPlanetEnforceCircle = savedData.enforceCircle;

    const img = new Image();
    img.onload = () => {
        hiddenCtx.clearRect(0, 0, hiddenCanvas.width, hiddenCanvas.height);
        hiddenCtx.drawImage(img, 0, 0);
        
        // Reset the game to rebuild the physics grid and start gameplay
        resetGame(true);
        
        // Hide level select popup
        const levelSelectOverlay = document.getElementById('level-select-popup-overlay');
        if (levelSelectOverlay) levelSelectOverlay.classList.remove('show');
        
        // Close main menu
        isMainMenuActive = false;
        const mainMenu = document.getElementById('main-menu');
        if (mainMenu) mainMenu.classList.add('hidden');
        
        // Show gameplay UI
        const optBtnWrapper = document.getElementById('options-btn-wrapper');
        if (optBtnWrapper) optBtnWrapper.style.display = 'block';
        const lvlBtnWrapper = document.getElementById('level-select-btn-wrapper');
        if (lvlBtnWrapper) lvlBtnWrapper.style.display = 'block';
        
        const weaponBar = document.querySelector('.weapon-bar-wrapper');
        if (weaponBar) {
            weaponBar.style.display = 'block';
            weaponBar.style.opacity = '1';
            weaponBar.style.pointerEvents = 'auto';
        }
        const hudHeader = document.querySelector('.hud-header-wrapper');
        if (hudHeader) {
            hudHeader.style.opacity = '1';
            hudHeader.style.pointerEvents = 'auto';
        }
        const selector = document.querySelector('.planet-selector');
        if (selector) {
            selector.style.opacity = '1';
            selector.style.pointerEvents = 'auto';
        }
        
        if (window.beginGameplay) {
            window.beginGameplay();
        }
    };
    img.src = savedData.image;
}

// Triggers the delete confirmation popup
function deleteCustomPlanet(name) {
    planetToDelete = name;
    const overlay = document.getElementById('delete-confirm-popup-overlay');
    const message = document.getElementById('delete-confirm-message');
    if (overlay && message) {
        message.textContent = `ARE YOU SURE YOU WANT TO DELETE "${name.toUpperCase()}"?`;
        overlay.style.display = 'flex';
        
        // Lazy-bind confirmation buttons if not already done
        if (!window.hasBoundDeleteConfirmEvents) {
            window.hasBoundDeleteConfirmEvents = true;
            const yesBtn = document.getElementById('delete-confirm-yes');
            const noBtn = document.getElementById('delete-confirm-no');
            
            if (yesBtn) {
                yesBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    soundManager.play('sfx_ui_switch');
                    if (planetToDelete) {
                        performDeleteCustomPlanet(planetToDelete);
                        planetToDelete = null;
                    }
                    overlay.style.display = 'none';
                });
            }
            if (noBtn) {
                noBtn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    soundManager.play('sfx_ui_switch');
                    planetToDelete = null;
                    overlay.style.display = 'none';
                });
            }
        }
    }
}

// Actually performs the deletion from disk or localStorage
function performDeleteCustomPlanet(name) {
    if (window.__TAURI__) {
        window.__TAURI__.invoke('delete_custom_planet', { name: name })
            .then(() => {
                refreshCustomPlanetsList();
                showUnlockNotification("PLANET DELETED");
            })
            .catch(err => {
                console.error("Tauri delete failed, falling back to localStorage:", err);
                localStorage.removeItem('custom_planet_' + name);
                refreshCustomPlanetsList();
                showUnlockNotification("PLANET DELETED");
            });
    } else {
        localStorage.removeItem('custom_planet_' + name);
        refreshCustomPlanetsList();
        showUnlockNotification("PLANET DELETED");
    }
}

// Refreshes the custom planets list inside the Level Select popup
function refreshCustomPlanetsList() {
    const listContainer = document.getElementById('custom-planets-list');
    if (!listContainer) return;
    listContainer.innerHTML = '';

    const addPlanetButton = (planetData) => {
        const btn = document.createElement('button');
        btn.className = 'level-select-btn custom-planet-btn';
        btn.style.width = '100%';
        btn.style.display = 'flex';
        btn.style.alignItems = 'center';
        btn.style.justifyContent = 'space-between';
        btn.style.padding = '10px 15px';
        btn.style.background = 'rgba(0, 217, 255, 0.05)';
        btn.style.border = '1px solid rgba(0, 217, 255, 0.2)';
        btn.style.borderRadius = '4px';
        btn.style.color = '#ffffff';
        btn.style.fontFamily = "'Orbitron', sans-serif";
        btn.style.fontSize = '12px';
        btn.style.cursor = 'pointer';
        btn.style.transition = 'all 0.2s';
        btn.style.marginBottom = '6px';
        btn.style.boxSizing = 'border-box';

        btn.innerHTML = `
            <div style="display: flex; align-items: center; gap: 10px; pointer-events: none;">
                <img src="${planetData.image}" style="width: 24px; height: 24px; border-radius: 50%; border: 1px solid rgba(0,217,255,0.4); background: #000;">
                <span style="font-weight: 700; letter-spacing: 0.5px;">${planetData.name.toUpperCase()}</span>
            </div>
            <div style="display: flex; gap: 8px; align-items: center;">
                <span style="color: #a0c8d8; font-size: 10px; pointer-events: none;">${planetData.size}km</span>
                <span class="delete-custom-planet" data-name="${planetData.name}">✕</span>
            </div>
        `;

        // Click to load planet
        btn.addEventListener('click', (e) => {
            if (e.target.classList.contains('delete-custom-planet')) {
                e.stopPropagation();
                const pName = e.target.dataset.name;
                deleteCustomPlanet(pName);
                return;
            }
            loadCustomPlanet(planetData);
        });

        // Hover effects
        btn.addEventListener('mouseenter', () => {
            btn.style.background = 'rgba(0, 217, 255, 0.15)';
            btn.style.borderColor = '#00d9ff';
            btn.style.boxShadow = '0 0 8px rgba(0, 217, 255, 0.3)';
        });
        btn.addEventListener('mouseleave', () => {
            btn.style.background = 'rgba(0, 217, 255, 0.05)';
            btn.style.borderColor = 'rgba(0, 217, 255, 0.2)';
            btn.style.boxShadow = 'none';
        });

        listContainer.appendChild(btn);
    };

    // If Tauri is available, we try to fetch from Tauri first
    if (window.__TAURI__) {
        window.__TAURI__.invoke('get_custom_planets')
            .then(planetsJsonList => {
                const planets = planetsJsonList.map(p => typeof p === 'string' ? JSON.parse(p) : p);
                if (planets.length === 0) {
                    showNoCustomPlanetsPlaceholder(listContainer);
                } else {
                    planets.forEach(addPlanetButton);
                }
            })
            .catch(err => {
                console.error("Tauri get failed, falling back to localStorage:", err);
                loadFromLocalStorage();
            });
    } else {
        loadFromLocalStorage();
    }

    function loadFromLocalStorage() {
        const customPlanets = [];
        for (let i = 0; i < localStorage.length; i++) {
            const key = localStorage.key(i);
            if (key.startsWith('custom_planet_')) {
                try {
                    customPlanets.push(JSON.parse(localStorage.getItem(key)));
                } catch (e) {
                    console.error("Error parsing saved planet:", e);
                }
            }
        }

        if (customPlanets.length === 0) {
            showNoCustomPlanetsPlaceholder(listContainer);
        } else {
            customPlanets.forEach(addPlanetButton);
        }
    }
}

function showNoCustomPlanetsPlaceholder(container) {
    const placeholder = document.createElement('div');
    placeholder.style.color = 'rgba(255,255,255,0.3)';
    placeholder.style.fontSize = '11px';
    placeholder.style.textAlign = 'center';
    placeholder.style.padding = '15px';
    placeholder.style.fontFamily = "'Orbitron', sans-serif";
    placeholder.style.border = '1px dashed rgba(255,255,255,0.1)';
    placeholder.style.borderRadius = '4px';
    placeholder.textContent = 'NO CUSTOM PLANETS YET';
    container.appendChild(placeholder);
}

// Expose globally
window.refreshCustomPlanetsList = refreshCustomPlanetsList;
