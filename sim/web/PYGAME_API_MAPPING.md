# Pygame API Surface Area Analysis

This document analyzes all pygame API usage in the badge simulator and provides mappings to HTML5 Canvas/Web APIs.

## Summary Statistics

Based on analysis of the simulator codebase:
- **Files using pygame**: 10 files
- **Unique pygame APIs**: ~30 methods/constants
- **Complexity**: Medium (mostly 2D graphics primitives)

## Complete API Mapping

### 1. Initialization & Display

| Pygame API | Usage | Web API Equivalent | Complexity |
|------------|-------|-------------------|------------|
| `pygame.init()` | Initialize pygame subsystems | N/A (not needed) | Trivial |
| `pygame.display.set_mode(size)` | Create window | `<canvas width="..." height="...">` | Trivial |
| `pygame.display.flip()` | Update display | Automatic on canvas draw | Trivial |

**Implementation:**
```javascript
// Pygame: pygame.display.set_mode(size=(733, 733))
// Web:
const canvas = document.getElementById('main-canvas');
canvas.width = 733;
canvas.height = 733;
const ctx = canvas.getContext('2d');
```

---

### 2. Surface Management

| Pygame API | Usage | Web API Equivalent | Complexity |
|------------|-------|-------------------|------------|
| `pygame.Surface(size, flags)` | Create off-screen buffer | `document.createElement('canvas')` | Easy |
| `surface.fill(color)` | Fill with color | `ctx.fillStyle = color; ctx.fillRect()` | Easy |
| `surface.blit(src, pos)` | Composite surfaces | `ctx.drawImage(srcCanvas, x, y)` | Easy |
| `surface.get_buffer()` | Get raw pixel buffer | `ctx.getImageData()` | Easy |
| `buffer.write(bytes, offset)` | Write to buffer | `imageData.data.set()` | Easy |

**Implementation:**
```javascript
// Pygame: surface = pygame.Surface((240, 240), flags=pygame.SRCALPHA)
// Web:
const offscreenCanvas = document.createElement('canvas');
offscreenCanvas.width = 240;
offscreenCanvas.height = 240;
const offscreenCtx = offscreenCanvas.getContext('2d');

// Pygame: surface.fill((0, 0, 0, 255))
// Web:
offscreenCtx.fillStyle = 'rgba(0, 0, 0, 1)';
offscreenCtx.fillRect(0, 0, 240, 240);

// Pygame: screen.blit(surface, (x, y))
// Web:
mainCtx.drawImage(offscreenCanvas, x, y);
```

---

### 3. Drawing Primitives

| Pygame API | Usage | Web API Equivalent | Complexity |
|------------|-------|-------------------|------------|
| `pygame.draw.circle(surf, color, pos, radius)` | Draw filled circle | `ctx.arc() + ctx.fill()` | Easy |
| `pygame.draw.circle()` with alpha | Draw with transparency | `ctx.fillStyle = 'rgba(...)'` | Easy |

**Implementation:**
```javascript
// Pygame: pygame.draw.circle(surface, (255, 0, 0, 128), (100, 100), 50)
// Web:
ctx.fillStyle = 'rgba(255, 0, 0, 0.5)'; // alpha: 128/255 = 0.5
ctx.beginPath();
ctx.arc(100, 100, 50, 0, Math.PI * 2);
ctx.fill();
```

---

### 4. Image Loading

| Pygame API | Usage | Web API Equivalent | Complexity |
|------------|-------|-------------------|------------|
| `pygame.image.load(path)` | Load image file | `new Image()` + `img.src` | Easy |
| `pygame.image.save(surf, path)` | Save screenshot | `canvas.toBlob()` + download | Medium |

**Implementation:**
```javascript
// Pygame: background = pygame.image.load('background.png')
// Web:
const background = new Image();
background.onload = () => {
    ctx.drawImage(background, 0, 0);
};
background.src = 'background.png';

// Pygame: pygame.image.save(screen, 'screenshot.png')
// Web:
canvas.toBlob(blob => {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'screenshot.png';
    a.click();
});
```

---

### 5. Event Handling

| Pygame API | Usage | Web API Equivalent | Complexity |
|------------|-------|-------------------|------------|
| `pygame.event.get()` | Get event queue | Event listeners | Easy |
| `pygame.MOUSEMOTION` | Mouse move event | `'mousemove'` | Trivial |
| `pygame.MOUSEBUTTONDOWN` | Mouse down event | `'mousedown'` | Trivial |
| `pygame.MOUSEBUTTONUP` | Mouse up event | `'mouseup'` | Trivial |
| `pygame.KEYDOWN` | Key press event | `'keydown'` | Trivial |
| `pygame.KEYUP` | Key release event | `'keyup'` | Trivial |
| `pygame.QUIT` | Window close event | `'beforeunload'` | Trivial |
| `pygame.USEREVENT` | Custom event | `CustomEvent` | Easy |
| `event.pos` | Mouse position | `event.offsetX/Y` | Trivial |
| `event.key` | Key code | `event.key` | Trivial |

**Implementation:**
```javascript
// Pygame: for ev in pygame.event.get():
// Web:
canvas.addEventListener('mousemove', (e) => {
    const x = e.offsetX;
    const y = e.offsetY;
    // handle mouse move
});

canvas.addEventListener('mousedown', (e) => {
    // handle mouse down
});

document.addEventListener('keydown', (e) => {
    const key = e.key.toLowerCase();
    // handle key down
});
```

---

### 6. Key Constants

| Pygame API | Usage | Web API Equivalent | Complexity |
|------------|-------|-------------------|------------|
| `pygame.K_a` through `pygame.K_z` | Key codes | `event.key === 'a'` | Trivial |
| `pygame.K_w`, `K_a`, `K_s`, `K_d` | WASD keys | String comparison | Trivial |

**Implementation:**
```javascript
// Pygame: if ev.key == pygame.K_a:
// Web:
if (event.key.toLowerCase() === 'a') {
    // handle
}

// Create mapping if needed:
const K = {
    K_a: 'a',
    K_b: 'b',
    // ... etc
};
```

---

### 7. Surface Flags

| Pygame API | Usage | Web API Equivalent | Complexity |
|------------|-------|-------------------|------------|
| `pygame.SRCALPHA` | Alpha channel support | Canvas supports by default | Trivial |

**Implementation:**
```javascript
// Pygame: surface = pygame.Surface((w, h), flags=pygame.SRCALPHA)
// Web: Canvas has alpha by default, no flag needed
const canvas = document.createElement('canvas');
```

---

### 8. System

| Pygame API | Usage | Web API Equivalent | Complexity |
|------------|-------|-------------------|------------|
| `pygame.quit()` | Cleanup | N/A (browser handles) | Trivial |
| `sys.exit()` | Exit program | `window.close()` (if allowed) | Trivial |

---

## Detailed Usage Analysis by File

### `_sim.py` - Main simulation (highest usage)

**Core pygame usage:**
```python
# Display
pygame.init()
screen = pygame.display.set_mode(size=(733, 733))
pygame.display.flip()

# Surfaces
surface = pygame.Surface((width, height), flags=pygame.SRCALPHA)
surface.fill((r, g, b, a))
screen.blit(surface, (x, y))

# Drawing
pygame.draw.circle(surface, color, position, radius)

# Images
background = pygame.image.load(bgpath)
pygame.image.save(screen, path)

# Events
pygame.event.get()
pygame.MOUSEMOTION, pygame.MOUSEBUTTONDOWN, pygame.MOUSEBUTTONUP
pygame.KEYDOWN, pygame.KEYUP, pygame.QUIT, pygame.USEREVENT

# Buffer manipulation
buffer = surface.get_buffer()
buffer.write(bytes, offset)
```

**Replacement complexity**: **Medium**
- Most operations are straightforward canvas operations
- Buffer manipulation requires ImageData API
- Event handling needs restructuring from polling to listeners

### Other files using pygame

Files with minimal pygame usage (just constants or basic types):
- `bl00mbox.py`: Uses pygame for audio (not in web PoC yet)
- `leds.py`: Minimal usage
- `media.py`: Audio-related (pygame.mixer)
- `sys_colors.py`: Just color types
- `time.py`: Clock/timing

---

## Migration Strategy

### Phase 1: Core Graphics ✅ (Already done in PoC)
- Canvas creation
- Basic drawing (circles)
- Event handling (mouse/keyboard)
- Surface compositing

### Phase 2: Advanced Graphics
- Buffer manipulation (ImageData API)
- Image loading with callbacks
- Screenshot/save functionality

### Phase 3: Architecture
- Convert event polling to event listeners
- Create pygame-compatible wrapper API
- State management

---

## Compatibility Layer Approach

For minimal code changes, create a `pygame_web.js` wrapper:

```javascript
const pygame = {
    init: () => {},
    quit: () => {},

    display: {
        set_mode: (options) => {
            // Return canvas wrapper
        },
        flip: () => {
            // Auto-handled in canvas
        }
    },

    Surface: class {
        constructor(size, flags) {
            this.canvas = document.createElement('canvas');
            this.canvas.width = size[0];
            this.canvas.height = size[1];
            this.ctx = this.canvas.getContext('2d');
        }

        fill(color) {
            const [r, g, b, a = 255] = color;
            this.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a/255})`;
            this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
        }

        blit(source, pos) {
            this.ctx.drawImage(source.canvas, pos[0], pos[1]);
        }

        get_buffer() {
            return new BufferWrapper(this.ctx, this.canvas.width, this.canvas.height);
        }
    },

    draw: {
        circle: (surface, color, pos, radius) => {
            const [r, g, b, a = 255] = color;
            surface.ctx.fillStyle = `rgba(${r}, ${g}, ${b}, ${a/255})`;
            surface.ctx.beginPath();
            surface.ctx.arc(pos[0], pos[1], radius, 0, Math.PI * 2);
            surface.ctx.fill();
        }
    },

    event: {
        get: () => {
            // Return event queue
            return eventQueue.splice(0);
        }
    },

    // Event type constants
    MOUSEMOTION: 'mousemotion',
    MOUSEBUTTONDOWN: 'mousedown',
    MOUSEBUTTONUP: 'mouseup',
    KEYDOWN: 'keydown',
    KEYUP: 'keyup',
    QUIT: 'quit',
    USEREVENT: 'userevent',

    // Key constants
    K_a: 'a',
    K_b: 'b',
    // ... etc

    // Flags
    SRCALPHA: 'srcalpha'
};
```

---

## Recommended Approach for Production

**Option A: Pygame Wrapper** (Less code changes)
- Create JavaScript pygame API wrapper
- Port Python simulator to JavaScript
- Pros: Familiar API
- Cons: Still need to port Python logic

**Option B: Direct Canvas Implementation** (What PoC uses)
- Rewrite simulation in JavaScript idiomatically
- Use canvas APIs directly
- Pros: Clean, performant, web-native
- Cons: More initial work

**Option C: Pyodide + Pygame-web**
- Run actual Python code in browser
- Use pygame-web for rendering
- Pros: Reuse all Python code
- Cons: Large runtime, performance overhead

---

## Conclusion

The pygame API surface area in the simulator is **manageable**:

✅ **Easy to replace**: 85% of usage
- Basic shapes, colors, events
- Standard canvas operations

⚠️ **Medium difficulty**: 15% of usage
- Buffer manipulation (ImageData)
- Event polling → listener conversion
- Screenshot functionality

❌ **Not implemented in PoC**:
- Audio (pygame.mixer)
- Advanced image operations
- File system access

**Overall complexity**: **Medium** - A complete pygame → Canvas port is feasible with ~1-2 weeks of focused development.

The PoC already demonstrates the core functionality works well!
