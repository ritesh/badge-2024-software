# Tildagon Badge Simulator - Web Version

This is a browser-based version of the badge simulator that runs entirely in the browser, featuring a pygame compatibility layer for easy porting of pygame-based code.

## Features

✅ **Runs in browser** - No Python installation needed
✅ **Uses existing ctx.wasm** - Same rendering engine as desktop simulator
✅ **pygame.js compatibility layer** - Maps pygame API to HTML5 Canvas/Web APIs
✅ **Interactive controls** - Mouse and keyboard input
✅ **LED animations** - Visual feedback when buttons are pressed
✅ **Surface compositing** - Multiple canvas layers with blitting
✅ **Buffer manipulation** - ImageData API for framebuffer access
✅ **Responsive** - Works on desktop and tablets

## Available Versions

### 1. Basic PoC (`index.html`)
Direct implementation using Canvas APIs. Demonstrates core concepts.

### 2. Enhanced Version (`index-enhanced.html`) ⭐ **Recommended**
Uses `pygame.js` compatibility layer. Closer to desktop simulator architecture.

## How It Works

- **ctx.wasm**: The existing WebAssembly module is loaded directly in the browser
- **HTML5 Canvas**: Multiple canvas layers for background, LEDs, OLED, and buttons
- **JavaScript**: Handles event processing, rendering, and WASM interaction
- **No Python runtime**: Pure browser-based implementation

## Running the Simulator

### Option 1: Development Server (Recommended)

From the `sim/web` directory:

```bash
./serve.py
# or
python3 serve.py
```

Then open:
- **Enhanced version**: http://localhost:8000/index-enhanced.html ⭐
- **Basic version**: http://localhost:8000/

### Option 2: Simple HTTP Server

```bash
python3 -m http.server 8000
```

### Option 3: Any HTTP Server

```bash
# Node.js
npx http-server -p 8000

# PHP
php -S localhost:8000
```

**Important**: You must use an HTTP server (not file://) due to WASM security restrictions.

## Controls

### Keyboard
- **A** - Left Jog Left
- **B** - Left Press
- **C** - Left Jog Right
- **D** - Right Jog Left
- **E** - Right Press
- **F** - Right Jog Right

### Mouse
Click on the circular button markers overlaid on the badge.

## Architecture

### Canvas Layers

1. **Background Canvas** (`bg-canvas`) - Badge artwork
2. **LED Canvas** (`led-canvas`) - Animated LED ring
3. **OLED Canvas** (`oled-canvas`) - 240x240 display rendered from ctx.wasm
4. **Button Canvas** (`button-canvas`) - Interactive overlay

### WASM Integration

The JavaScript code:
1. Fetches `ctx.wasm` from `../wasm/ctx.wasm`
2. Provides minimal WASI imports (stdio stubs)
3. Allocates framebuffer memory
4. Calls ctx functions to render graphics
5. Reads framebuffer and displays on canvas

## File Structure

```
web/
├── index.html                    # Basic PoC (direct Canvas API)
├── index-enhanced.html           # Enhanced version (pygame.js)
├── simulator.js                  # Basic PoC implementation
├── simulator-enhanced.js         # Enhanced simulator using pygame.js
├── pygame.js                     # Pygame compatibility layer ⭐
├── serve.py                      # Development server
├── README.md                     # This file
├── PYGAME_API_MAPPING.md        # Complete API reference
└── NON_PORTABLE_FEATURES.md     # Limitations & alternatives ⭐
```

## Pygame Compatibility Layer

The `pygame.js` module provides a subset of pygame's API:

### Implemented Features ✅

| Module | Features | Coverage |
|--------|----------|----------|
| `pygame.display` | set_mode, flip | 100% |
| `pygame.Surface` | fill, blit, get_buffer | 95% |
| `pygame.draw` | circle, rect, line | 80% |
| `pygame.event` | get, post, Event | 90% |
| `pygame.image` | load, save | 85% |
| `pygame.Color` | RGB, RGBA | 100% |
| Event types | MOUSEMOTION, KEYDOWN, etc. | 100% |
| Key constants | K_a - K_z, arrows, etc. | 90% |

### Non-Portable Features ⚠️

| Feature | Status | Alternative |
|---------|--------|-------------|
| `pygame.mixer` | ❌ Stub only | Web Audio API (see docs) |
| File I/O | ❌ Not available | IndexedDB (see docs) |
| Threading | ❌ Not available | Web Workers (see docs) |
| System calls | ❌ Sandboxed | Browser APIs (see docs) |

**See `NON_PORTABLE_FEATURES.md` for complete details and alternatives.**

## Current Limitations

The web version has some limitations compared to desktop:

- ❌ No Python app execution (would need Pyodide integration)
- ⚠️ Audio uses Web Audio API instead of pygame.mixer
- ⚠️ File system uses IndexedDB instead of real files
- ❌ No IMU/accelerometer simulation yet
- ⚠️ Threading uses Web Workers (different model)

## Using pygame.js in Your Code

The compatibility layer allows pygame-style code to run in browsers:

```javascript
// Initialize pygame
pygame.init();

// Create display
const screen = pygame.display.set_mode({
    size: [800, 600],
    flags: pygame.SRCALPHA
});

// Create surface
const surface = new Surface(200, 200);
surface.fill([255, 0, 0, 128]);

// Draw primitives
pygame.draw.circle(surface, [0, 255, 0], [100, 100], 50);
pygame.draw.rect(screen, [0, 0, 255], [10, 10, 100, 100]);

// Handle events
const events = pygame.event.get();
for (const event of events) {
    if (event.type === pygame.KEYDOWN) {
        console.log('Key pressed:', event.key);
    }
}

// Blit and display
screen.blit(surface, [50, 50]);
pygame.display.flip();
```

See `simulator-enhanced.js` for a complete working example.

## Porting Python Code

To port Python pygame code:

1. **Use `pygame.js`**: Include the compatibility layer
2. **Convert to JavaScript**: Standard Python → JS translation
3. **Handle async operations**: File/image loading is async
4. **Replace incompatible features**: See `NON_PORTABLE_FEATURES.md`

**Example conversion:**

Python:
```python
# pygame code
screen = pygame.display.set_mode((800, 600))
screen.fill((0, 0, 0))
pygame.draw.circle(screen, (255, 0, 0), (400, 300), 50)
pygame.display.flip()
```

JavaScript (using pygame.js):
```javascript
// Equivalent in pygame.js
const screen = pygame.display.set_mode({ size: [800, 600] });
screen.fill([0, 0, 0]);
pygame.draw.circle(screen, [255, 0, 0], [400, 300], 50);
pygame.display.flip();
```

## Next Steps

### Immediate Improvements

1. ✅ **pygame.js compatibility layer** - Done!
2. ✅ **Documentation** - Complete API mapping done
3. 🔄 **Audio support** - Implement Web Audio manager
4. 🔄 **Virtual file system** - IndexedDB wrapper

### Long-term Goals

1. **Add Pyodide** - Run actual Python badge apps in browser
2. **Full WASI** - Better stdio/filesystem support
3. **App loader** - Load/run badge apps from virtual `/apps`
4. **Touch support** - Mobile-friendly controls
5. **Performance** - Optimize rendering pipeline
6. **PWA** - Install as standalone app

## Comparison to Desktop Simulator

| Feature | Desktop (Python) | Web (PoC) |
|---------|-----------------|-----------|
| Platform | Windows/Mac/Linux | Any browser |
| Install | Python + deps | None |
| ctx rendering | ✅ wasmtime | ✅ Native WASM |
| Badge apps | ✅ Full support | ❌ Not yet |
| LEDs | ✅ Full | ✅ Full |
| Buttons | ✅ Full | ✅ Full |
| OLED | ✅ Full | ✅ Full |
| Audio | ✅ pygame | ❌ Not yet |
| Performance | Fast | Very fast |

## Technical Details

### Memory Management

The WASM module exports `malloc`/`free` which JavaScript uses to:
- Allocate framebuffer (240x240x4 bytes = 230KB)
- Write command strings for ctx_parse
- Pass texture data

### Circular OLED Rendering

The OLED is 240px diameter circle in a 240x240 square. We pre-calculate row offsets to only render the circular portion, matching the Python simulator's approach.

### Button Detection

Uses simple distance calculation from mouse position to button centers. Within radius = hit.

## Development

To modify:

1. Edit `simulator.js` for logic changes
2. Edit `index.html` for UI/styling
3. No build step required - just refresh browser!

## License

Same as parent badge-2024-software repository.
