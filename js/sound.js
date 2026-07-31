class SoundManager {
            constructor() {
                this.context = new (window.AudioContext || window.webkitAudioContext)();
                this.buffers = {};
                this.loadingPromises = {};
                this.activeLoops = {};
                this.masterGain = this.context.createGain();
                this.masterGain.connect(this.context.destination);
                this.sfxGain = this.context.createGain();
                this.sfxGain.connect(this.masterGain);
                this.bgmGain = this.context.createGain();
                this.bgmGain.connect(this.masterGain);
                this.isInitialized = false;
                this.muted = false;
                this.crazyGamesMuted = false;

                const resumeAudio = () => {
                    if (this.context && this.context.state === 'suspended') {
                        this.context.resume().then(() => {
                            document.removeEventListener('click', resumeAudio);
                            document.removeEventListener('touchstart', resumeAudio);
                        });
                    }
                };
                document.addEventListener('click', resumeAudio);
                document.addEventListener('touchstart', resumeAudio);
            }

            setSfxVolume(v) {
                this.sfxGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.context.currentTime, 0.05);
            }

            setBgmVolume(v) {
                this.bgmGain.gain.setTargetAtTime(Math.max(0, Math.min(1, v)), this.context.currentTime, 0.05);
            }

            updateMasterVolume() {
                const isSilent = this.muted || this.crazyGamesMuted;
                this.masterGain.gain.setTargetAtTime(isSilent ? 0 : 1, this.context.currentTime, 0.05);
            }

            toggleMute() {
                this.muted = !this.muted;
                this.updateMasterVolume();
                return this.muted;
            }

            setCrazyGamesMuted(muted) {
                this.crazyGamesMuted = !!muted;
                this.updateMasterVolume();
            }

            async init() {
                if (this.isInitialized) return;
                if (this.context.state === 'suspended') {
                    await this.context.resume();
                }
                this.isInitialized = true;
            }

            load(id) {
                if (this.buffers[id]) return Promise.resolve();
                if (this.loadingPromises[id]) return this.loadingPromises[id];
                const asset = getAsset(id);
                if (!asset) return Promise.resolve();
                const promise = this._loadWithRetry(id, asset.url);
                this.loadingPromises[id] = promise;
                return promise;
            }

            // #29 — flaky connections drop individual requests. Retry with a
            // capped backoff, and on permanent failure clear the in-flight latch
            // so a later call (e.g. re-selecting the weapon) can try again
            // instead of being blocked forever by a dead promise.
            async _loadWithRetry(id, url) {
                const MAX_ATTEMPTS = 3;
                for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
                    try {
                        // Cache-bust retries so a cached error response isn't replayed.
                        const response = attempt === 1
                            ? await fetch(url)
                            : await fetch(url + (url.indexOf('?') === -1 ? '?' : '&') + 'retry=' + attempt, { cache: 'reload' });
                        if (!response.ok) throw new Error('HTTP ' + response.status);
                        const arrayBuffer = await response.arrayBuffer();
                        const audioBuffer = await new Promise((resolve, reject) => {
                            try {
                                const res = this.context.decodeAudioData(arrayBuffer, resolve, reject);
                                if (res && typeof res.then === 'function') {
                                    res.then(resolve, reject);
                                }
                            } catch (e) {
                                reject(e);
                            }
                        });
                        this.buffers[id] = audioBuffer;
                        return;
                    } catch (e) {
                        if (attempt < MAX_ATTEMPTS) {
                            console.warn(`Sound load failed (attempt ${attempt}/${MAX_ATTEMPTS}): ${id}`, e);
                            await new Promise(r => setTimeout(r, Math.min(1000 * attempt, 3000)));
                        } else {
                            console.error(`Failed to load sound after ${MAX_ATTEMPTS} attempts: ${id}`, e);
                            delete this.loadingPromises[id];
                        }
                    }
                }
            }

            loadMany(ids) {
                if (Array.isArray(ids)) {
                    ids.forEach(id => this.load(id));
                }
            }

            play(id, loop = false, volume = 1.0, detune = 0) {
                if (!this.buffers[id]) return null;
                if (loop && this.activeLoops[id]) return this.activeLoops[id];

                const source = this.context.createBufferSource();
                source.buffer = this.buffers[id];
                source.loop = loop;
                if (source.detune) {
                    source.detune.value = detune;
                }

                const gainNode = this.context.createGain();
                gainNode.gain.value = window.gamePausedForAd ? volume * 0.001 : volume;
                source.connect(gainNode);
                const targetGain = id.startsWith('bgm_') ? this.bgmGain : this.sfxGain;
                gainNode.connect(targetGain);

                source.start(0);

                if (loop) {
                    this.activeLoops[id] = { source, gainNode };
                }

                source.onended = () => {
                    if (loop && this.activeLoops[id] && this.activeLoops[id].source === source) {
                        delete this.activeLoops[id];
                    }
                };

                return source;
            }

            stopLoop(id) {
                if (this.activeLoops[id]) {
                    try { this.activeLoops[id].source.stop(); } catch (e) { }
                    delete this.activeLoops[id];
                }
            }

            setLoopVolume(id, volume) {
                if (this.activeLoops[id]) {
                    this.activeLoops[id].gainNode.gain.setTargetAtTime(volume, this.context.currentTime, 0.05);
                }
            }
        }