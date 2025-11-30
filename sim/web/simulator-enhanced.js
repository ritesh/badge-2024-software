/**
 * Enhanced Badge Simulator using pygame.js compatibility layer
 *
 * This demonstrates how pygame-based simulator code can be ported
 * to run in browsers using the pygame.js wrapper.
 */

import './pygame.js';

// Initialize pygame
pygame.init();

// Configuration matching Python simulator
const SCREEN_W = 733;
const SCREEN_H = 733;

// Button positions (matching _sim.py)
const BUTTON_POSITIONS = [
    { x: 370, y: 33, name: 'left_jog_left', key: 'a' },
    { x: 670, y: 190, name: 'left_press', key: 'b' },
    { x: 670, y: 540, name: 'left_jog_right', key: 'c' },
    { x: 370, y: 710, name: 'right_jog_left', key: 'd' },
    { x: 75, y: 540, name: 'right_press', key: 'e' },
    { x: 85, y: 190, name: 'right_jog_right', key: 'f' }
];

const BUTTON_RADIUS = 25;

// LED positions (matching _sim.py)
const LED_POSITIONS = [
    { x: 370, y: 370, type: 'internal' },
    { x: 443, y: 90, type: 'top' },
    { x: 573, y: 163, type: 'top' },
    { x: 646, y: 293, type: 'top' },
    { x: 646, y: 440, type: 'top' },
    { x: 573, y: 566, type: 'top' },
    { x: 443, y: 640, type: 'top' },
    { x: 296, y: 640, type: 'top' },
    { x: 173, y: 566, type: 'top' },
    { x: 93, y: 440, type: 'top' },
    { x: 93, y: 293, type: 'top' },
    { x: 173, y: 163, type: 'top' },
    { x: 296, y: 90, type: 'top' },
    { x: 533, y: 93, type: 'bottom' },
    { x: 680, y: 366, type: 'bottom' },
    { x: 533, y: 626, type: 'bottom' },
    { x: 200, y: 626, type: 'bottom' },
    { x: 60, y: 366, type: 'bottom' },
    { x: 200, y: 93, type: 'bottom' }
];

/**
 * Input class - pygame-style input handling
 */
class Input {
    constructor(positions, keys, markerSize, colors) {
        this.positions = positions;
        this.keys = keys;
        this.markerSize = markerSize;
        this.colors = colors;
        this._state = new Array(positions.length).fill(false);
        this._mouseHover = null;
        this._mouseHeld = null;
    }

    state() {
        const s = [...this._state];
        if (this._mouseHeld !== null) {
            s[this._mouseHeld] = true;
        }
        return s;
    }

    _mouseCoordsToId(mouseX, mouseY) {
        for (let i = 0; i < this.positions.length; i++) {
            const pos = this.positions[i];
            const dx = mouseX - pos.x;
            const dy = mouseY - pos.y;
            if (Math.sqrt(dx * dx + dy * dy) < this.markerSize / 2) {
                return i;
            }
        }
        return null;
    }

    processEvent(ev) {
        const prevHover = this._mouseHover;
        const prevState = JSON.stringify(this.state());

        if (ev.type === pygame.MOUSEMOTION) {
            const [x, y] = ev.pos;
            this._mouseHover = this._mouseCoordsToId(x, y);
        }

        if (ev.type === pygame.MOUSEBUTTONDOWN) {
            this._mouseHeld = this._mouseHover;
        }

        if (ev.type === pygame.MOUSEBUTTONUP) {
            this._mouseHeld = null;
        }

        if (ev.type === pygame.KEYDOWN || ev.type === pygame.KEYUP) {
            const keyIndex = this.keys.indexOf(ev.key);
            if (keyIndex !== -1) {
                this._mouseHover = keyIndex;
                if (ev.type === pygame.KEYDOWN) {
                    this._mouseHeld = keyIndex;
                } else {
                    this._mouseHeld = null;
                }
            }
        }

        if (ev.type === pygame.QUIT) {
            pygame.quit();
            console.log('Quit event received');
        }

        return prevHover !== this._mouseHover || prevState !== JSON.stringify(this.state());
    }

    render(surface) {
        const s = this.state();
        for (let i = 0; i < this.positions.length; i++) {
            const pos = this.positions[i];
            let color;

            if (s[i]) {
                color = this.colors.held;
            } else if (i === this._mouseHover) {
                color = this.colors.hover;
            } else {
                color = this.colors.idle;
            }

            pygame.draw.circle(surface, color, [pos.x, pos.y], this.markerSize / 2);
        }
    }
}

/**
 * ButtonsInput - pygame-style button input
 */
class ButtonsInput extends Input {
    constructor() {
        const positions = BUTTON_POSITIONS;
        const keys = BUTTON_POSITIONS.map(b => b.key);
        const markerSize = 50;
        const colors = {
            held: [0xF0, 0x00, 0x00, 0xFF],
            hover: [0xF0, 0x00, 0x00, 0x5F],
            idle: [0xC0, 0xC0, 0xC0, 0x5F]
        };
        super(positions, keys, markerSize, colors);
    }
}

/**
 * Simulation - Main simulator class (pygame-style)
 */
class Simulation {
    constructor() {
        // LED state
        this.ledStateBuf = LED_POSITIONS.map(() => [0, 0, 0]);
        this.ledState = LED_POSITIONS.map(() => [0, 0, 0]);

        // Input handlers
        this.buttons = new ButtonsInput();

        // Surfaces (using pygame.Surface)
        this.ledSurface = new Surface(SCREEN_W, SCREEN_H);
        this.ledSurfaceDirty = true;
        this.buttonSurface = new Surface(SCREEN_W, SCREEN_H);
        this.buttonSurfaceDirty = true;
        this.fullSurface = new Surface(SCREEN_W, SCREEN_H);
        this.oledSurface = new Surface(240, 240);

        // Background image
        this.background = null;

        // Calculate OLED per-row offset (circular mask)
        this.oledOffset = [];
        for (let y = 0; y < 240; y++) {
            let offset = 0;
            for (let x = 0; x < 240; x++) {
                const dx = x - 120;
                const dy = y - 120;
                if (Math.sqrt(dx * dx + dy * dy) <= 120) {
                    offset = x;
                    break;
                }
            }
            this.oledOffset.push(offset);
        }

        this.lastGuiRender = null;
    }

    async loadBackground(path) {
        try {
            this.background = await pygame.image.load(path);
        } catch (error) {
            console.warn('Could not load background, using fallback');
            // Draw fallback background
            this.background = new Surface(SCREEN_W, SCREEN_H);
            this.background.fill([10, 10, 10, 255]);

            // Draw badge outline
            pygame.draw.circle(this.background, [50, 50, 50, 255], [366.5, 366.5], 300, 2);
        }
    }

    processEvents() {
        const evs = pygame.event.get();
        for (const ev of evs) {
            if (this.buttons.processEvent(ev)) {
                this.buttonSurfaceDirty = true;
            }
        }
    }

    _renderButtonMarkers(surface) {
        this.buttons.render(surface);
    }

    _renderLEDs(surface, top = true, bottom = true) {
        for (let i = 0; i < LED_POSITIONS.length; i++) {
            const pos = LED_POSITIONS[i];
            const state = this.ledState[i];
            const x = pos.x + 3.0;
            const y = pos.y + 3.0;
            const [r, g, b] = state;

            if (i >= 13 && bottom) {
                // Bottom LEDs - big diffuse circle
                for (let j = 0; j < 20; j++) {
                    const radius = 100 - j;
                    const r2 = r / (100 - j * 5);
                    const g2 = g / (100 - j * 5);
                    const b2 = b / (100 - j * 5);
                    pygame.draw.circle(surface, [r2, g2, b2], [x, y], radius);
                }
            }

            if (i >= 1 && i < 13 && top) {
                // Top LEDs - smaller circles with alpha
                for (let j = 0; j < 20; j++) {
                    const radius = 26 - j;
                    const alpha = 250 - ((20 - j) * 10);
                    pygame.draw.circle(surface, [r, g, b, alpha], [x, y], radius);
                }
            }
        }
    }

    _renderOLED(surface, fb) {
        // Clear surface
        surface.fill([0, 0, 0, 0]);

        const buf = surface.get_buffer();

        // Copy framebuffer data with circular mask
        const fbData = fb.slice(0, 240 * 240 * 4);
        for (let y = 0; y < 240; y++) {
            const offset = this.oledOffset[y];
            const startOffsBytes = y * 240 * 4 + offset * 4;
            const endOffsBytes = (y + 1) * 240 * 4 - offset * 4;

            const rowData = fbData.slice(startOffsBytes, endOffsBytes);
            buf.write(rowData, startOffsBytes);
        }
    }

    renderGuiNow(screen) {
        this.lastGuiRender = Date.now();

        const full = this.fullSurface;

        if (this.ledSurfaceDirty || this.buttonSurfaceDirty) {
            full.fill([0, 0, 0, 255]);
            this._renderLEDs(full, false, true);

            if (this.background) {
                full.blit(this.background, [0, 0]);
            }

            this.ledSurface.fill([255, 255, 255, 0]);
            this._renderLEDs(this.ledSurface, true, false);
            this.ledSurfaceDirty = false;
            full.blit(this.ledSurface, [0, 0]);

            this.buttonSurface.fill([0, 0, 0, 0]);
            this._renderButtonMarkers(this.buttonSurface);
            this.buttonSurfaceDirty = false;
            full.blit(this.buttonSurface, [0, 0]);
        }

        // Blit OLED
        const centerX = 370;
        const centerY = 366;
        const offX = centerX - 120;
        const offY = centerY - 120;
        full.blit(this.oledSurface, [offX, offY]);

        // Blit to screen
        screen.blit(full, [0, 0]);
        pygame.display.flip();
    }

    renderGuiLazy(screen) {
        const targetFPS = 60.0;
        const delay = 1000 / targetFPS;

        if (!this.lastGuiRender || Date.now() - this.lastGuiRender > delay) {
            this.renderGuiNow(screen);
        }
    }

    renderDisplay(fb) {
        this._renderOLED(this.oledSurface, fb);
    }

    setLedRGB(ix, r, g, b) {
        this.ledStateBuf[ix] = [r * 255, g * 255, b * 255];
    }

    ledsUpdate() {
        for (let i = 0; i < this.ledStateBuf.length; i++) {
            const newState = this.ledStateBuf[i];
            const oldState = this.ledState[i];
            if (newState[0] !== oldState[0] || newState[1] !== oldState[1] || newState[2] !== oldState[2]) {
                this.ledState[i] = newState;
                this.ledSurfaceDirty = true;
            }
        }
    }
}

/**
 * Main application
 */
async function main() {
    console.log('Starting enhanced pygame simulator...');

    // Create display
    const screen = pygame.display.set_mode({ size: [SCREEN_W, SCREEN_H], flags: pygame.SRCALPHA });

    // Create simulation
    const sim = new Simulation();
    await sim.loadBackground('../background.png');

    // Demo LED animation
    let ledAnimTime = 0;
    function animateLEDs() {
        ledAnimTime += 0.02;
        for (let i = 1; i < 13; i++) {
            const hue = (ledAnimTime + i / 12) % 1.0;
            const [r, g, b] = hslToRgb(hue, 1, 0.3);
            sim.setLedRGB(i, r, g, b);
        }
        sim.ledsUpdate();
    }

    // Main loop
    function gameLoop() {
        sim.processEvents();
        animateLEDs();
        sim.renderGuiNow(screen);
        requestAnimationFrame(gameLoop);
    }

    console.log('✅ Enhanced simulator running!');
    gameLoop();
}

/**
 * HSL to RGB conversion
 */
function hslToRgb(h, s, l) {
    let r, g, b;

    if (s === 0) {
        r = g = b = l;
    } else {
        const hue2rgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1/6) return p + (q - p) * 6 * t;
            if (t < 1/2) return q;
            if (t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        };

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [r, g, b];
}

// Start the application
main().catch(console.error);
