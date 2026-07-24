// Inline Game Configuration
window.gameConfig = {
    "weapons": {
        "missile": {
            "speed": 5,
            "size": 6,
            "explosionRadius": 15.5,
            "shakeIntensity": 6.3,
            "particleCount": 14,
            "particleSpeedScale": 0.75,
            "particleLifeScale": 0.75
        },
        "nuke": {
            "speed": 3,
            "size": 10,
            "explosionRadius": 27,
            "shakeIntensity": 18,
            "particleCount": 27,
            "particleSpeedScale": 0.7,
            "particleLifeScale": 0.85
        },
        "asteroid": {
            "speed": 3,
            "size": 16,
            "explosionRadius": 50,
            "shakeIntensity": 36,
            "particleCount": 48,
            "particleSpeedScale": 1,
            "particleLifeScale": 1
        },
        "laser": {
            "speed": 0,
            "size": 2,
            "explosionRadius": 11,
            "shakeIntensity": 2,
            "particleCount": 5,
            "particleSpeedScale": 0.5,
            "particleLifeScale": 0.5
        },
        "gamma": {
            "speed": 0,
            "size": 0,
            "explosionRadius": 12,
            "shakeIntensity": 20,
            "particleCount": 1,
            "particleSpeedScale": 0.8,
            "particleLifeScale": 0.8
        },
        "sword": {
            "speed": 12,
            "size": 25,
            "explosionRadius": 18,
            "shakeIntensity": 24,
            "particleCount": 16,
            "particleSpeedScale": 0.8,
            "particleLifeScale": 0.8
        },
        "worm": {
            "radius": 55
        },
        "blackhole": {
            "radius": 35
        },
        "moon": {
            "speed": 1.3,
            "size": 40,
            "explosionRadius": 114,
            "shakeIntensity": 50,
            "particleCount": 85,
            "particleSpeedScale": 1.25,
            "particleLifeScale": 1.25
        },
        "drill": {
            "speed": 8,
            "drillDuration": 3.5,
            "explosionInterval": 0.165,
            "explosionSize": 9,
            "particleCount": 12
        }
    },
    "planet": {
        "size": 250,
        "rotationSpeed": 0.007225,
        "oceanColor": "#2b5f9e",
        "landColor": "#3a7d44"
    },
    "gameplay": {
        "spawnDistance": 300,
        "victoryThreshold": 1.5
    },
    "visual": {
        "backgroundColor": "#0a0a15",
        "starDensity": 100
    }
};

// Inline Asset Map
const assets = {
    "sfx_launch_heavy": {
        "url": "./assets/sfx_launch_heavy.mp3",
        "type": "audio"
    },
    "sfx_explosion_small": {
        "url": "./assets/sfx_explosion_small.mp3",
        "type": "audio"
    },
    "sfx_explosion_medium": {
        "url": "./assets/sfx_explosion_medium.mp3",
        "type": "audio"
    },
    "sfx_explosion_large": {
        "url": "./assets/sfx_explosion_large.mp3",
        "type": "audio"
    },
    "sfx_laser_fire": {
        "url": "./assets/sfx_laser_fire.mp3",
        "type": "audio"
    },
    "sfx_gamma_charge": {
        "url": "./assets/sfx_gamma_charge.mp3",
        "type": "audio"
    },
    "sfx_gamma_beam": {
        "url": "./assets/sfx_gamma_beam.mp3",
        "type": "audio"
    },
    "sfx_sword_fly": {
        "url": "./assets/sfx_sword_fly.mp3",
        "type": "audio"
    },
    "sfx_sword_stab": {
        "url": "./assets/sfx_sword_stab.mp3",
        "type": "audio"
    },
    "sfx_victory": {
        "url": "./assets/sfx_victory.mp3",
        "type": "audio"
    },
    "sfx_ui_switch": {
        "url": "./assets/sfx_ui_switch.mp3",
        "type": "audio"
    },
    "sfx_ui_scroll": {
        "url": "./assets/sfx_ui_scroll.mp3",
        "type": "audio"
    },
    "sfx_sword_rumble_loop": {
        "url": "./assets/sfx_sword_rumble_loop.mp3",
        "type": "audio"
    },
    "sfx_sword_pullout": {
        "url": "./assets/sfx_sword_pullout.mp3",
        "type": "audio"
    },
    "sfx_gamma_warning": {
        "url": "./assets/sfx_gamma_warning.mp3",
        "type": "audio"
    },
    "sfx_laser_crack": {
        "url": "./assets/sfx_laser_crack.mp3",
        "type": "audio"
    },
    "sfx_bowling_pins": {
        "url": "./assets/sfx_bowling_pins.mp3",
        "type": "audio"
    },
    "sfx_black_hole_disappear": {
        "url": "./assets/sfx_black_hole_disappear.mp3",
        "type": "audio"
    },
    "sfx_black_hole_spawn": {
        "url": "./assets/sfx_black_hole_spawn.mp3",
        "type": "audio"
    },
    "fist_punch_up": {
        "url": "./assets/fist_punch_up.webp",
        "type": "image",
        "aspect_ratio": [
            601,
            994
        ]
    },
    "sfx_fist_impact": {
        "url": "./assets/sfx_fist_impact.mp3",
        "type": "audio"
    },
    "sfx_nom_short": {
        "url": "./assets/sfx_nom_short.mp3",
        "type": "audio"
    },
    "bgm_gentle_space": {
        "url": "./assets/bgm_gentle_space.mp3",
        "type": "audio"
    },
    "sfx_holy_shine": {
        "url": "./assets/sfx_holy_shine.mp3",
        "type": "audio"
    },
    "sfx_mystical_moon_explosion": {
        "url": "./assets/sfx_mystical_moon_explosion.mp3",
        "type": "audio"
    },
    "sfx_laser_hum": {
        "url": "./assets/sfx_laser_hum.mp3",
        "type": "audio"
    },
    "sfx_magical_star_fade": {
        "url": "./assets/sfx_magical_star_fade.mp3",
        "type": "audio"
    },
    "sfx_magical_star_shot": {
        "url": "./assets/sfx_magical_star_shot.mp3",
        "type": "audio"
    },
    "sfx_magical_star_shot2": {
        "url": "./assets/sfx_magical_star_shot2.mp3",
        "type": "audio"
    },
    "sfx_lightning": {
        "url": "./assets/sfx_lightning.mp3",
        "type": "audio"
    },
    "sfx_freeze": {
        "url": "./assets/freeze.mp3",
        "type": "audio"
    },
    "sfx_shatter": {
        "url": "./assets/shatter.mp3",
        "type": "audio"
    },
    "sprite_orange": {
        "url": "./assets/orange.webp",
        "type": "image"
    },
    "sprite_vermillion_red": {
        "url": "./assets/vermillion_red.webp",
        "type": "image"
    },
    "sprite_light_orange": {
        "url": "./assets/light_orange.webp",
        "type": "image"
    },
    "sprite_white_gold": {
        "url": "./assets/white_gold.webp",
        "type": "image"
    },
    "sprite_bright_yellow": {
        "url": "./assets/bright_yellow.webp",
        "type": "image"
    },
    "sprite_smoke_standard": {
        "url": "./assets/smoke_standard.webp",
        "type": "image"
    },
    "sprite_smoke_missile": {
        "url": "./assets/smoke_missile.webp",
        "type": "image"
    },
    "sfx_error": {
        "url": "./assets/error_bleep.mp3",
        "type": "audio"
    },
    "sfx_void_body": {
        "url": "./assets/void_body.mp3",
        "type": "audio"
    },
    "sfx_quack": {
        "url": "./assets/quack.mp3",
        "type": "audio"
    },
    "sfx_out_of_ammo": {
        "url": "./assets/sfx_out_of_ammo.mp3",
        "type": "audio"
    }
};

// Asset lookup helper (fallback when lib is not present)
const getAsset = (id) => (typeof assets !== 'undefined' ? assets[id] : null);
