/**
 * pygame.js - Pygame API compatibility layer for browsers
 *
 * This module provides a subset of the pygame API using HTML5 Canvas/Web APIs.
 * It allows pygame-based code to run in browsers with minimal modifications.
 */

class PygameWrapper {
    constructor() {
        this.initialized = false;
        this.eventQueue = [];
        this.displayCanvas = null;
        this.displayContext = null;

        // Event type constants
        this.MOUSEMOTION = 'mousemotion';
        this.MOUSEBUTTONDOWN = 'mousebuttondown';
        this.MOUSEBUTTONUP = 'mousebuttonup';
        this.KEYDOWN = 'keydown';
        this.KEYUP = 'keyup';
        this.QUIT = 'quit';
        this.USEREVENT = 'userevent';

        // Key constants (A-Z, 0-9, common keys)
        this._setupKeyConstants();

        // Surface flags
        this.SRCALPHA = 'srcalpha';

        // Setup event listeners
        this._setupEventListeners();
    }

    _setupKeyConstants() {
        // Generate K_a through K_z
        for (let i = 0; i < 26; i++) {
            const char = String.fromCharCode(97 + i); // 'a' + i
            this[`K_${char}`] = char;
        }

        // Common special keys
        this.K_SPACE = ' ';
        this.K_RETURN = 'Enter';
        this.K_ESCAPE = 'Escape';
        this.K_LEFT = 'ArrowLeft';
        this.K_RIGHT = 'ArrowRight';
        this.K_UP = 'ArrowUp';
        this.K_DOWN = 'ArrowDown';
    }

    _setupEventListeners() {
        // These will be attached to canvases/document as needed
        this._mouseMove = (e) => {
            const rect = e.target.getBoundingClientRect();
            this.eventQueue.push({
                type: this.MOUSEMOTION,
                pos: [e.clientX - rect.left, e.clientY - rect.top],
                buttons: [e.buttons & 1, e.buttons & 2, e.buttons & 4]
            });
        };

        this._mouseDown = (e) => {
            const rect = e.target.getBoundingClientRect();
            this.eventQueue.push({
                type: this.MOUSEBUTTONDOWN,
                pos: [e.clientX - rect.left, e.clientY - rect.top],
                button: e.button + 1
            });
        };

        this._mouseUp = (e) => {
            const rect = e.target.getBoundingClientRect();
            this.eventQueue.push({
                type: this.MOUSEBUTTONUP,
                pos: [e.clientX - rect.left, e.clientY - rect.top],
                button: e.button + 1
            });
        };

        this._keyDown = (e) => {
            this.eventQueue.push({
                type: this.KEYDOWN,
                key: e.key,
                unicode: e.key.length === 1 ? e.key : ''
            });
        };

        this._keyUp = (e) => {
            this.eventQueue.push({
                type: this.KEYUP,
                key: e.key,
                unicode: e.key.length === 1 ? e.key : ''
            });
        };

        this._beforeUnload = (e) => {
            this.eventQueue.push({ type: this.QUIT });
        };
    }

    init() {
        if (this.initialized) return;

        // Attach global event listeners
        document.addEventListener('keydown', this._keyDown);
        document.addEventListener('keyup', this._keyUp);
        window.addEventListener('beforeunload', this._beforeUnload);

        this.initialized = true;
    }

    quit() {
        if (!this.initialized) return;

        document.removeEventListener('keydown', this._keyDown);
        document.removeEventListener('keyup', this._keyUp);
        window.removeEventListener('beforeunload', this._beforeUnload);

        this.initialized = false;
    }

    // Display module
    get display() {
        return {
            set_mode: (options) => {
                const { size, flags } = options;
                const [width, height] = size;

                // Create or get canvas
                let canvas = document.getElementById('pygame-display');
                if (!canvas) {
                    canvas = document.createElement('canvas');
                    canvas.id = 'pygame-display';
                    document.body.appendChild(canvas);
                }

                canvas.width = width;
                canvas.height = height;

                // Attach event listeners
                canvas.addEventListener('mousemove', this._mouseMove);
                canvas.addEventListener('mousedown', this._mouseDown);
                canvas.addEventListener('mouseup', this._mouseUp);

                this.displayCanvas = canvas;
                this.displayContext = canvas.getContext('2d');

                return new Surface(width, height, canvas, this.displayContext);
            },

            flip: () => {
                // No-op in canvas - drawing is immediate
                // But we can request animation frame
                return Promise.resolve();
            }
        };
    }

    // Event module
    get event() {
        return {
            get: () => {
                const events = [...this.eventQueue];
                this.eventQueue = [];
                return events;
            },

            post: (event) => {
                this.eventQueue.push(event);
            },

            Event: (type, data = {}) => {
                return { type, ...data };
            }
        };
    }

    // Draw module
    get draw() {
        return {
            circle: (surface, color, pos, radius, width = 0) => {
                const ctx = surface.context;
                const [r, g, b, a = 255] = Array.isArray(color) ? color : [color.r, color.g, color.b, color.a || 255];

                ctx.save();

                if (width === 0) {
                    // Filled circle
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a/255})`;
                    ctx.beginPath();
                    ctx.arc(pos[0], pos[1], radius, 0, Math.PI * 2);
                    ctx.fill();
                } else {
                    // Outline circle
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a/255})`;
                    ctx.lineWidth = width;
                    ctx.beginPath();
                    ctx.arc(pos[0], pos[1], radius, 0, Math.PI * 2);
                    ctx.stroke();
                }

                ctx.restore();
            },

            rect: (surface, color, rect, width = 0) => {
                const ctx = surface.context;
                const [r, g, b, a = 255] = Array.isArray(color) ? color : [color.r, color.g, color.b, color.a || 255];
                const [x, y, w, h] = rect;

                ctx.save();

                if (width === 0) {
                    ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a/255})`;
                    ctx.fillRect(x, y, w, h);
                } else {
                    ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a/255})`;
                    ctx.lineWidth = width;
                    ctx.strokeRect(x, y, w, h);
                }

                ctx.restore();
            },

            line: (surface, color, start, end, width = 1) => {
                const ctx = surface.context;
                const [r, g, b, a = 255] = Array.isArray(color) ? color : [color.r, color.g, color.b, color.a || 255];

                ctx.save();
                ctx.strokeStyle = `rgba(${r}, ${g}, ${b}, ${a/255})`;
                ctx.lineWidth = width;
                ctx.beginPath();
                ctx.moveTo(start[0], start[1]);
                ctx.lineTo(end[0], end[1]);
                ctx.stroke();
                ctx.restore();
            }
        };
    }

    // Image module
    get image() {
        return {
            load: async (path) => {
                return new Promise((resolve, reject) => {
                    const img = new Image();
                    img.onload = () => {
                        // Create surface from image
                        const surface = new Surface(img.width, img.height);
                        surface.context.drawImage(img, 0, 0);
                        surface._image = img; // Store original
                        resolve(surface);
                    };
                    img.onerror = reject;
                    img.src = path;
                });
            },

            save: (surface, filename) => {
                surface.canvas.toBlob(blob => {
                    const url = URL.createObjectURL(blob);
                    const a = document.createElement('a');
                    a.href = url;
                    a.download = filename;
                    document.body.appendChild(a);
                    a.click();
                    document.body.removeChild(a);
                    URL.revokeObjectURL(url);
                });
            }
        };
    }

    // Color class
    Color(r, g = null, b = null, a = 255) {
        if (g === null) {
            // Single value - grayscale
            return { r, g: r, b: r, a: 255 };
        }
        return { r, g, b, a };
    }

    // Mixer module (stub - non-portable)
    get mixer() {
        console.warn('pygame.mixer: Audio not fully supported in web PoC. Use Web Audio API.');
        return {
            music: {
                load: (path) => console.warn(`mixer.music.load('${path}') - Use Web Audio API`),
                play: (loops = 0) => console.warn('mixer.music.play() - Use Web Audio API'),
                stop: () => console.warn('mixer.music.stop() - Use Web Audio API'),
                pause: () => console.warn('mixer.music.pause() - Use Web Audio API'),
                unpause: () => console.warn('mixer.music.unpause() - Use Web Audio API'),
                rewind: () => console.warn('mixer.music.rewind() - Use Web Audio API'),
                set_volume: (vol) => console.warn(`mixer.music.set_volume(${vol}) - Use Web Audio API`),
                get_volume: () => { console.warn('mixer.music.get_volume() - Use Web Audio API'); return 0; },
                get_busy: () => { console.warn('mixer.music.get_busy() - Use Web Audio API'); return false; },
                get_pos: () => { console.warn('mixer.music.get_pos() - Use Web Audio API'); return 0; },
                set_pos: (pos) => console.warn(`mixer.music.set_pos(${pos}) - Use Web Audio API`),
                unload: () => console.warn('mixer.music.unload() - Use Web Audio API')
            },
            Sound: class {
                constructor(path) {
                    console.warn(`pygame.mixer.Sound('${path}') - Use Web Audio API`);
                }
                play() { console.warn('Sound.play() - Use Web Audio API'); }
                stop() { console.warn('Sound.stop() - Use Web Audio API'); }
                set_volume(vol) { console.warn(`Sound.set_volume(${vol}) - Use Web Audio API`); }
            }
        };
    }
}

/**
 * Surface class - Represents a drawable canvas
 */
class Surface {
    constructor(width, height, canvas = null, context = null) {
        this.width = width;
        this.height = height;

        if (canvas) {
            this.canvas = canvas;
            this.context = context;
        } else {
            this.canvas = document.createElement('canvas');
            this.canvas.width = width;
            this.canvas.height = height;
            this.context = this.canvas.getContext('2d');
        }
    }

    fill(color) {
        const [r, g, b, a = 255] = Array.isArray(color) ? color : [color.r, color.g, color.b, color.a || 255];
        this.context.fillStyle = `rgba(${r}, ${g}, ${b}, ${a/255})`;
        this.context.fillRect(0, 0, this.width, this.height);
    }

    blit(source, dest, area = null) {
        const [x, y] = dest;

        if (area) {
            const [sx, sy, sw, sh] = area;
            this.context.drawImage(source.canvas, sx, sy, sw, sh, x, y, sw, sh);
        } else {
            this.context.drawImage(source.canvas, x, y);
        }
    }

    get_buffer() {
        return new BufferWrapper(this);
    }

    get_rect() {
        return {
            x: 0,
            y: 0,
            width: this.width,
            height: this.height,
            left: 0,
            top: 0,
            right: this.width,
            bottom: this.height,
            centerx: this.width / 2,
            centery: this.height / 2
        };
    }

    convert() {
        // No-op in canvas - already in correct format
        return this;
    }

    convert_alpha() {
        // No-op in canvas - alpha always supported
        return this;
    }
}

/**
 * BufferWrapper - Wraps ImageData for buffer access
 */
class BufferWrapper {
    constructor(surface) {
        this.surface = surface;
        this.imageData = surface.context.getImageData(0, 0, surface.width, surface.height);
    }

    write(bytes, offset = 0) {
        if (bytes instanceof Uint8Array || bytes instanceof Array) {
            // Direct byte array
            for (let i = 0; i < bytes.length; i++) {
                this.imageData.data[offset + i] = bytes[i];
            }
        } else if (ArrayBuffer.isView(bytes)) {
            // TypedArray view
            const uint8 = new Uint8Array(bytes.buffer, bytes.byteOffset, bytes.byteLength);
            this.imageData.data.set(uint8, offset);
        }

        // Write back to canvas
        this.surface.context.putImageData(this.imageData, 0, 0);
    }

    read(length, offset = 0) {
        return this.imageData.data.slice(offset, offset + length);
    }
}

// Create global pygame instance
const pygame = new PygameWrapper();

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = pygame;
}

// Also export Surface for direct use
if (typeof window !== 'undefined') {
    window.pygame = pygame;
    window.PygameSurface = Surface;
}
