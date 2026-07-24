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

            toggleMute() {
                this.muted = !this.muted;
                this.masterGain.gain.setTargetAtTime(this.muted ? 0 : 1, this.context.currentTime, 0.05);
                return this.muted;
            }

            async init() {
                if (this.isInitialized) return;
                if (this.context.state === 'suspended') {
                    await this.context.resume();
                }
                this.isInitialized = true;
            }

            async load(id) {
                if (this.buffers[id] || this.loadingPromises[id]) return this.loadingPromises[id];
                const asset = getAsset(id);
                if (!asset) return;
                const promise = (async () => {
                    try {
                        const response = await fetch(asset.url);
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
                    } catch (e) {
                        console.error(`Failed to load sound: ${id}`, e);
                    }
                })();
                this.loadingPromises[id] = promise;
                return promise;
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