/**
 * Tildagon Badge Simulator - Web PoC
 *
 * This is a proof-of-concept HTML5 Canvas version of the badge simulator.
 * It demonstrates running the ctx.wasm module directly in the browser.
 */

// Canvas references
const bgCanvas = document.getElementById('bg-canvas');
const ledCanvas = document.getElementById('led-canvas');
const oledCanvas = document.getElementById('oled-canvas');
const buttonCanvas = document.getElementById('button-canvas');

const bgCtx = bgCanvas.getContext('2d');
const ledCtx = ledCanvas.getContext('2d');
const oledCtx = oledCanvas.getContext('2d');
const buttonCtx = buttonCanvas.getContext('2d');

const statusEl = document.getElementById('status');

// Button positions (matching Python simulator)
const BUTTON_POSITIONS = [
    { x: 370, y: 33, label: 'Left Jog Left', key: 'A' },
    { x: 670, y: 190, label: 'Left Press', key: 'B' },
    { x: 670, y: 540, label: 'Left Jog Right', key: 'C' },
    { x: 370, y: 710, label: 'Right Jog Left', key: 'D' },
    { x: 75, y: 540, label: 'Right Press', key: 'E' },
    { x: 85, y: 190, label: 'Right Jog Right', key: 'F' }
];

const BUTTON_RADIUS = 25;

// LED positions (matching Python simulator)
const LED_POSITIONS = [
    // Internal
    { x: 370, y: 370, type: 'internal' },
    // Top ring
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
    // Under
    { x: 533, y: 93, type: 'bottom' },
    { x: 680, y: 366, type: 'bottom' },
    { x: 533, y: 626, type: 'bottom' },
    { x: 200, y: 626, type: 'bottom' },
    { x: 60, y: 366, type: 'bottom' },
    { x: 200, y: 93, type: 'bottom' }
];

// Simulation state
const state = {
    buttons: new Array(6).fill(false),
    buttonHover: null,
    leds: LED_POSITIONS.map(() => ({ r: 0, g: 0, b: 0 })),
    wasmInstance: null,
    wasmMemory: null,
    frameBuffer: null,
    ctxInstance: null
};

/**
 * Load and initialize the WASM module
 */
async function initWasm() {
    try {
        statusEl.textContent = '⏳ Fetching ctx.wasm...';

        const response = await fetch('../wasm/ctx.wasm');
        const wasmBytes = await response.arrayBuffer();

        statusEl.textContent = '⏳ Compiling WASM module...';

        // Create WASI imports stub (minimal implementation)
        const wasi = {
            fd_write: (fd, iovs, iovsLen, nwritten) => 0,
            fd_close: (fd) => 0,
            fd_seek: (fd, offset, whence, newOffset) => 0,
            fd_read: (fd, iovs, iovsLen, nread) => 0,
            proc_exit: (code) => {},
            environ_sizes_get: (environc, environBufSize) => 0,
            environ_get: (environ, environBuf) => 0,
            args_sizes_get: (argc, argvBufSize) => 0,
            args_get: (argv, argvBuf) => 0,
            clock_time_get: (id, precision, time) => 0,
            random_get: (buf, bufLen) => 0,
            poll_oneoff: () => 0,
            fd_prestat_get: () => 28,
            fd_prestat_dir_name: () => 28,
            path_open: () => 28,
            fd_fdstat_get: () => 28
        };

        const importObject = {
            wasi_snapshot_preview1: wasi
        };

        const { instance } = await WebAssembly.instantiate(wasmBytes, importObject);

        state.wasmInstance = instance;
        state.wasmMemory = instance.exports.memory;

        statusEl.textContent = '✅ WASM module loaded successfully!';

        // Initialize a test framebuffer
        initFramebuffer();

        return true;
    } catch (error) {
        statusEl.textContent = `❌ Error loading WASM: ${error.message}`;
        statusEl.classList.add('error');
        console.error('WASM init error:', error);
        return false;
    }
}

/**
 * Initialize framebuffer for OLED display
 */
function initFramebuffer() {
    try {
        const width = 240;
        const height = 240;
        const stride = width * 4; // RGBA8
        const format = 4; // RGBA8

        const exports = state.wasmInstance.exports;

        // Allocate framebuffer
        const fbSize = stride * height;
        const fb = exports.malloc(fbSize);

        // Create ctx for framebuffer
        const ctx = exports.ctx_new_for_framebuffer(fb, width, height, stride, format);

        // Apply transform (center origin)
        exports.ctx_apply_transform(ctx, 1, 0, 120, 0, 1, 120, 0, 0, 1);

        state.frameBuffer = fb;
        state.ctxInstance = ctx;

        // Draw test pattern
        drawTestPattern();

        statusEl.textContent = '✅ Ready! Click buttons or press keys to interact.';
    } catch (error) {
        statusEl.textContent = `❌ Error initializing framebuffer: ${error.message}`;
        console.error('Framebuffer init error:', error);
    }
}

/**
 * Helper to write string to WASM memory
 */
function writeString(str) {
    const exports = state.wasmInstance.exports;
    const encoder = new TextEncoder();
    const bytes = encoder.encode(str);
    const ptr = exports.malloc(bytes.length + 1);
    const memory = new Uint8Array(state.wasmMemory.buffer);
    memory.set(bytes, ptr);
    memory[ptr + bytes.length] = 0; // null terminator
    return ptr;
}

/**
 * Draw a test pattern on the OLED
 */
function drawTestPattern() {
    if (!state.ctxInstance) return;

    const exports = state.wasmInstance.exports;
    const ctx = state.ctxInstance;

    try {
        // Draw background
        const bgCmd = writeString('rgb 0.1 0.1 0.2');
        exports.ctx_parse(ctx, bgCmd);
        exports.free(bgCmd);

        const rectCmd = writeString('rectangle -120 -120 240 240');
        exports.ctx_parse(ctx, rectCmd);
        exports.free(rectCmd);

        const fillCmd = writeString('fill');
        exports.ctx_parse(ctx, fillCmd);
        exports.free(fillCmd);

        // Draw centered circle
        const circleColor = writeString('rgb 0.2 0.8 0.4');
        exports.ctx_parse(ctx, circleColor);
        exports.free(circleColor);

        const beginPath = writeString('beginPath');
        exports.ctx_parse(ctx, beginPath);
        exports.free(beginPath);

        // Arc: x, y, radius, startAngle, endAngle, direction
        exports.ctx_parse(ctx, writeString('moveTo 80 0'));

        for (let i = 0; i <= 360; i += 10) {
            const angle = (i * Math.PI) / 180;
            const x = Math.cos(angle) * 80;
            const y = Math.sin(angle) * 80;
            const lineCmd = writeString(`lineTo ${x.toFixed(2)} ${y.toFixed(2)}`);
            exports.ctx_parse(ctx, lineCmd);
            exports.free(lineCmd);
        }

        const strokeCmd = writeString('stroke');
        exports.ctx_parse(ctx, strokeCmd);
        exports.free(strokeCmd);

        // Draw text
        const fontSize = writeString('fontSize 20');
        exports.ctx_parse(ctx, fontSize);
        exports.free(fontSize);

        const textAlign = writeString('textAlign center');
        exports.ctx_parse(ctx, textAlign);
        exports.free(textAlign);

        const textBaseline = writeString('textBaseline middle');
        exports.ctx_parse(ctx, textBaseline);
        exports.free(textBaseline);

        const textColor = writeString('rgb 1 1 1');
        exports.ctx_parse(ctx, textColor);
        exports.free(textColor);

        const textCmd = writeString('text "Tildagon"');
        exports.ctx_parse(ctx, textCmd);
        exports.free(textCmd);

        const moveText = writeString('moveTo 0 0');
        exports.ctx_parse(ctx, moveText);
        exports.free(moveText);

        const textCmd2 = writeString('text "Web PoC"');
        exports.ctx_parse(ctx, textCmd2);
        exports.free(textCmd2);

        const moveText2 = writeString('moveTo 0 30');
        exports.ctx_parse(ctx, moveText2);
        exports.free(moveText2);

        // Render to OLED canvas
        renderOLED();
    } catch (error) {
        console.error('Error drawing test pattern:', error);
    }
}

/**
 * Render the OLED display from framebuffer
 */
function renderOLED() {
    if (!state.frameBuffer) return;

    const width = 240;
    const height = 240;
    const memory = new Uint8Array(state.wasmMemory.buffer);

    // Create ImageData from framebuffer
    const imageData = oledCtx.createImageData(width, height);

    // Calculate circular mask offsets
    const offsets = [];
    for (let y = 0; y < height; y++) {
        let offset = 0;
        for (let x = 0; x < width; x++) {
            const dx = x - 120;
            const dy = y - 120;
            if (Math.sqrt(dx * dx + dy * dy) <= 120) {
                offset = x;
                break;
            }
        }
        offsets.push(offset);
    }

    // Copy framebuffer data with circular mask
    for (let y = 0; y < height; y++) {
        const offset = offsets[y];
        const rowStart = y * width * 4;
        const rowStartBytes = state.frameBuffer + rowStart + offset * 4;
        const rowEndBytes = state.frameBuffer + (y + 1) * width * 4 - offset * 4;

        const srcStart = rowStartBytes;
        const srcEnd = rowEndBytes;
        const destStart = rowStart + offset * 4;

        for (let i = 0; i < srcEnd - srcStart; i++) {
            imageData.data[destStart + i] = memory[srcStart + i];
        }
    }

    oledCtx.putImageData(imageData, 0, 0);
}

/**
 * Load and draw background image
 */
async function loadBackground() {
    try {
        const img = new Image();
        img.onload = () => {
            bgCtx.drawImage(img, 0, 0);
        };
        img.src = '../background.png';
    } catch (error) {
        // Draw a simple background if image fails
        bgCtx.fillStyle = '#0a0a0a';
        bgCtx.fillRect(0, 0, 733, 733);

        // Draw badge outline
        bgCtx.strokeStyle = '#333';
        bgCtx.lineWidth = 2;
        bgCtx.beginPath();
        bgCtx.arc(366.5, 366.5, 300, 0, Math.PI * 2);
        bgCtx.stroke();
    }
}

/**
 * Render LEDs
 */
function renderLEDs() {
    ledCtx.clearRect(0, 0, 733, 733);

    state.leds.forEach((led, i) => {
        const pos = LED_POSITIONS[i];
        const x = pos.x + 3;
        const y = pos.y + 3;

        if (pos.type === 'bottom') {
            // Large diffuse circles for bottom LEDs
            for (let j = 0; j < 20; j++) {
                const radius = 100 - j;
                const r = led.r / (100 - j * 5);
                const g = led.g / (100 - j * 5);
                const b = led.b / (100 - j * 5);

                ledCtx.fillStyle = `rgb(${r}, ${g}, ${b})`;
                ledCtx.beginPath();
                ledCtx.arc(x, y, radius, 0, Math.PI * 2);
                ledCtx.fill();
            }
        } else if (pos.type === 'top') {
            // Smaller circles with alpha for top LEDs
            for (let j = 0; j < 20; j++) {
                const radius = 26 - j;
                const alpha = (250 - (20 - j) * 10) / 255;

                ledCtx.fillStyle = `rgba(${led.r}, ${led.g}, ${led.b}, ${alpha})`;
                ledCtx.beginPath();
                ledCtx.arc(x, y, radius, 0, Math.PI * 2);
                ledCtx.fill();
            }
        }
    });
}

/**
 * Render button overlay
 */
function renderButtons() {
    buttonCtx.clearRect(0, 0, 733, 733);

    BUTTON_POSITIONS.forEach((btn, i) => {
        let color;
        if (state.buttons[i]) {
            color = 'rgba(240, 0, 0, 1)';
        } else if (state.buttonHover === i) {
            color = 'rgba(240, 0, 0, 0.37)';
        } else {
            color = 'rgba(192, 192, 192, 0.37)';
        }

        buttonCtx.fillStyle = color;
        buttonCtx.beginPath();
        buttonCtx.arc(btn.x, btn.y, BUTTON_RADIUS, 0, Math.PI * 2);
        buttonCtx.fill();

        // Draw key label
        buttonCtx.fillStyle = '#fff';
        buttonCtx.font = '12px monospace';
        buttonCtx.textAlign = 'center';
        buttonCtx.textBaseline = 'middle';
        buttonCtx.fillText(btn.key, btn.x, btn.y);
    });
}

/**
 * Handle mouse move
 */
buttonCanvas.addEventListener('mousemove', (e) => {
    const rect = buttonCanvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    let hover = null;
    BUTTON_POSITIONS.forEach((btn, i) => {
        const dx = x - btn.x;
        const dy = y - btn.y;
        if (Math.sqrt(dx * dx + dy * dy) < BUTTON_RADIUS) {
            hover = i;
        }
    });

    if (hover !== state.buttonHover) {
        state.buttonHover = hover;
        renderButtons();
    }
});

/**
 * Handle mouse click
 */
buttonCanvas.addEventListener('mousedown', (e) => {
    if (state.buttonHover !== null) {
        state.buttons[state.buttonHover] = true;
        renderButtons();

        // Trigger LED animation on button press
        animateLEDOnButton(state.buttonHover);
    }
});

buttonCanvas.addEventListener('mouseup', () => {
    state.buttons.fill(false);
    renderButtons();
});

/**
 * Handle keyboard
 */
const keyMap = { 'a': 0, 'b': 1, 'c': 2, 'd': 3, 'e': 4, 'f': 5 };

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    if (key in keyMap) {
        const idx = keyMap[key];
        if (!state.buttons[idx]) {
            state.buttons[idx] = true;
            renderButtons();
            animateLEDOnButton(idx);
        }
    }
});

document.addEventListener('keyup', (e) => {
    const key = e.key.toLowerCase();
    if (key in keyMap) {
        state.buttons[keyMap[key]] = false;
        renderButtons();
    }
});

/**
 * Animate LEDs when button is pressed
 */
function animateLEDOnButton(buttonIdx) {
    // Light up LEDs in a pattern based on button
    const hue = (buttonIdx * 60) % 360;
    const [r, g, b] = hslToRgb(hue / 360, 1, 0.5);

    // Light up corresponding LED
    const ledIdx = (buttonIdx * 2 + 1) % LED_POSITIONS.length;
    state.leds[ledIdx] = { r: r * 255, g: g * 255, b: b * 255 };

    // Also light up neighbors
    const prevIdx = (ledIdx - 1 + LED_POSITIONS.length) % LED_POSITIONS.length;
    const nextIdx = (ledIdx + 1) % LED_POSITIONS.length;
    state.leds[prevIdx] = { r: r * 128, g: g * 128, b: b * 128 };
    state.leds[nextIdx] = { r: r * 128, g: g * 128, b: b * 128 };

    renderLEDs();

    // Fade out after delay
    setTimeout(() => {
        state.leds.forEach((led, i) => {
            led.r *= 0.8;
            led.g *= 0.8;
            led.b *= 0.8;
        });
        renderLEDs();
    }, 100);
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

/**
 * Animation loop
 */
function animate() {
    // Could add continuous animations here
    requestAnimationFrame(animate);
}

/**
 * Initialize the simulator
 */
async function init() {
    await loadBackground();
    renderButtons();
    renderLEDs();

    const wasmLoaded = await initWasm();
    if (wasmLoaded) {
        animate();
    }
}

// Start the simulator
init();
