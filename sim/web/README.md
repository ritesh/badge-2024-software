# Tildagon Badge Simulator - Web PoC

This is a proof-of-concept HTML5 Canvas version of the badge simulator that runs entirely in the browser.

## Features

✅ **Runs in browser** - No Python installation needed
✅ **Uses existing ctx.wasm** - Same rendering engine as desktop simulator
✅ **Interactive controls** - Mouse and keyboard input
✅ **LED animations** - Visual feedback when buttons are pressed
✅ **Responsive** - Works on desktop and tablets

## How It Works

- **ctx.wasm**: The existing WebAssembly module is loaded directly in the browser
- **HTML5 Canvas**: Multiple canvas layers for background, LEDs, OLED, and buttons
- **JavaScript**: Handles event processing, rendering, and WASM interaction
- **No Python runtime**: Pure browser-based implementation

## Running the Simulator

### Option 1: Simple HTTP Server (Python)

From the `sim/web` directory:

```bash
python3 -m http.server 8000
```

Then open: http://localhost:8000

### Option 2: Any HTTP Server

You can use any HTTP server. Examples:

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

## Current Limitations

This PoC demonstrates the concept but has limitations:

- ❌ No Python app execution yet (would need Pyodide)
- ❌ No audio support
- ❌ No file system emulation
- ❌ Simplified button mapping
- ❌ No IMU/accelerometer simulation
- ⚠️ Basic WASI implementation (minimal stdio)

## Next Steps

To make this production-ready:

1. **Add Pyodide** - Run actual badge Python apps
2. **Implement full WASI** - Better stdio/filesystem support
3. **Add app loader** - Load/run badge apps from `/apps`
4. **Touch support** - Better mobile experience
5. **Performance tuning** - Optimize rendering loops
6. **Audio** - Web Audio API integration
7. **State persistence** - localStorage for settings

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
