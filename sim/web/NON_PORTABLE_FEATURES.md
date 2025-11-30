# Non-Portable Features & Web Alternatives

This document identifies pygame features that cannot be directly ported to web browsers and provides recommended alternatives using Web APIs.

## Summary

| Feature Category | Portable? | Difficulty | Alternative |
|-----------------|-----------|------------|-------------|
| Graphics (2D) | ✅ Yes | Easy | HTML5 Canvas |
| Events (Mouse/Keyboard) | ✅ Yes | Easy | DOM Events |
| Surfaces/Buffers | ✅ Yes | Medium | Canvas + ImageData |
| Audio | ⚠️ Partial | Medium | Web Audio API |
| File I/O | ❌ Limited | Hard | IndexedDB/localStorage |
| Threading | ❌ Different | Hard | Web Workers |
| System Integration | ❌ No | N/A | Browser sandbox |

---

## 1. Audio (pygame.mixer) - ⚠️ PARTIAL

### Issue
`pygame.mixer` provides:
- Background music playback
- Sound effects with mixing
- Format conversion
- Volume control
- Positional audio

Web browsers have different audio APIs with different capabilities.

### Alternative: Web Audio API

**Recommended Solution:**
```javascript
class AudioManager {
    constructor() {
        this.context = new (window.AudioContext || window.webkitAudioContext)();
        this.sounds = new Map();
        this.musicSource = null;
        this.musicBuffer = null;
        this.musicGain = this.context.createGain();
        this.musicGain.connect(this.context.destination);
    }

    async loadSound(name, url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        const audioBuffer = await this.context.decodeAudioData(arrayBuffer);
        this.sounds.set(name, audioBuffer);
    }

    playSound(name, volume = 1.0) {
        const buffer = this.sounds.get(name);
        if (!buffer) return;

        const source = this.context.createBufferSource();
        const gainNode = this.context.createGain();

        source.buffer = buffer;
        gainNode.gain.value = volume;

        source.connect(gainNode);
        gainNode.connect(this.context.destination);
        source.start(0);
    }

    async loadMusic(url) {
        const response = await fetch(url);
        const arrayBuffer = await response.arrayBuffer();
        this.musicBuffer = await this.context.decodeAudioData(arrayBuffer);
    }

    playMusic(loop = true) {
        if (this.musicSource) {
            this.musicSource.stop();
        }

        this.musicSource = this.context.createBufferSource();
        this.musicSource.buffer = this.musicBuffer;
        this.musicSource.loop = loop;
        this.musicSource.connect(this.musicGain);
        this.musicSource.start(0);
    }

    stopMusic() {
        if (this.musicSource) {
            this.musicSource.stop();
            this.musicSource = null;
        }
    }

    setMusicVolume(volume) {
        this.musicGain.gain.value = volume;
    }
}

// Usage:
const audio = new AudioManager();
await audio.loadMusic('/path/to/music.mp3');
audio.playMusic(true);
```

**Limitations:**
- ❌ No built-in format conversion (browser handles)
- ❌ Limited codec support (depends on browser)
- ⚠️ User interaction required to start audio (browser security)
- ⚠️ Different timing model

**Workarounds:**
1. **User interaction requirement**: Show "Click to start" overlay
2. **Format compatibility**: Provide MP3 + OGG for compatibility
3. **Precise timing**: Use `currentTime` instead of `get_pos()`

---

## 2. File System Access - ❌ LIMITED

### Issue
`pygame` can freely read/write files using Python's file I/O:
```python
with open('/flash/data.json', 'r') as f:
    data = json.load(f)
```

Browsers run in a sandbox and cannot access arbitrary file system paths.

### Alternative: Multiple APIs depending on use case

#### A. Save/Load Files (User-initiated)

**File System Access API** (Modern browsers):
```javascript
async function saveFile(data, suggestedName) {
    const handle = await window.showSaveFilePicker({
        suggestedName: suggestedName,
        types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] }
        }]
    });

    const writable = await handle.createWritable();
    await writable.write(data);
    await writable.close();
}

async function loadFile() {
    const [handle] = await window.showOpenFilePicker({
        types: [{
            description: 'JSON Files',
            accept: { 'application/json': ['.json'] }
        }],
        multiple: false
    });

    const file = await handle.getFile();
    return await file.text();
}
```

#### B. Persistent Storage (Application data)

**IndexedDB** (Best for structured data):
```javascript
class Storage {
    constructor(dbName) {
        this.dbName = dbName;
        this.db = null;
    }

    async init() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName, 1);

            request.onerror = () => reject(request.error);
            request.onsuccess = () => {
                this.db = request.result;
                resolve();
            };

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                if (!db.objectStoreNames.contains('files')) {
                    db.createObjectStore('files', { keyPath: 'path' });
                }
            };
        });
    }

    async writeFile(path, data) {
        const transaction = this.db.transaction(['files'], 'readwrite');
        const store = transaction.objectStore('files');
        await store.put({ path, data, timestamp: Date.now() });
    }

    async readFile(path) {
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const request = store.get(path);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                resolve(request.result?.data || null);
            };
            request.onerror = () => reject(request.error);
        });
    }

    async listFiles() {
        const transaction = this.db.transaction(['files'], 'readonly');
        const store = transaction.objectStore('files');
        const request = store.getAllKeys();

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result);
            request.onerror = () => reject(request.error);
        });
    }
}

// Usage:
const storage = new Storage('badge-simulator');
await storage.init();
await storage.writeFile('/flash/config.json', JSON.stringify(config));
const data = await storage.readFile('/flash/config.json');
```

**localStorage** (Simple key-value, < 5MB):
```javascript
// Simple but limited
localStorage.setItem('config', JSON.stringify(config));
const config = JSON.parse(localStorage.getItem('config'));
```

**Limitations:**
- ❌ No real file paths (use virtual path mapping)
- ❌ Limited storage quota (varies by browser)
- ❌ No direct binary file access
- ⚠️ Async APIs (everything is promise-based)

---

## 3. Threading (pygame.threads) - ❌ DIFFERENT MODEL

### Issue
Python can use threads for concurrent operations:
```python
import threading

def background_task():
    # Heavy computation
    pass

thread = threading.Thread(target=background_task)
thread.start()
```

JavaScript has a different concurrency model.

### Alternative: Web Workers

**Web Workers** (For CPU-intensive tasks):
```javascript
// main.js
const worker = new Worker('worker.js');

worker.onmessage = (event) => {
    console.log('Result:', event.data);
};

worker.postMessage({ command: 'process', data: largeDataset });

// worker.js
self.onmessage = (event) => {
    const { command, data } = event.data;

    if (command === 'process') {
        // Heavy computation here
        const result = processData(data);
        self.postMessage(result);
    }
};
```

**Async/Await** (For I/O operations):
```javascript
async function loadMultipleResources() {
    // Load multiple files concurrently
    const [image1, image2, audio] = await Promise.all([
        loadImage('badge.png'),
        loadImage('background.png'),
        loadAudio('music.mp3')
    ]);

    return { image1, image2, audio };
}
```

**Limitations:**
- ❌ Workers cannot access DOM
- ❌ Data must be serialized (structured clone)
- ⚠️ Different mental model than threads
- ⚠️ SharedArrayBuffer requires special headers (CORS)

---

## 4. System Integration - ❌ NOT AVAILABLE

### Issue
pygame can access system features:
```python
import sys
import os

sys.exit(0)  # Exit program
os.system('command')  # Run shell command
```

Browsers are sandboxed for security.

### Alternative: Browser APIs (Limited)

**What's NOT possible:**
- ❌ Execute arbitrary commands
- ❌ Access file system freely
- ❌ Open network sockets directly
- ❌ Access hardware (except limited APIs)

**What IS possible:**
```javascript
// Close window (if opened by script)
window.close();

// Navigate away
window.location.href = 'https://example.com';

// Network requests (HTTP only, CORS applies)
const response = await fetch('https://api.example.com/data');

// Limited hardware access
const devices = await navigator.mediaDevices.enumerateDevices();
const camera = await navigator.mediaDevices.getUserMedia({ video: true });

// Clipboard access
await navigator.clipboard.writeText('text');
const text = await navigator.clipboard.readText();

// Notifications
new Notification('Title', { body: 'Message' });

// Fullscreen
await document.documentElement.requestFullscreen();
```

---

## 5. Timing & Animation - ⚠️ DIFFERENT

### Issue
pygame uses fixed-rate game loops:
```python
clock = pygame.time.Clock()
while running:
    dt = clock.tick(60)  # 60 FPS
    update(dt)
    render()
```

Browsers prefer `requestAnimationFrame`.

### Alternative: requestAnimationFrame

**Recommended pattern:**
```javascript
class GameLoop {
    constructor(targetFPS = 60) {
        this.targetFPS = targetFPS;
        this.targetFrameTime = 1000 / targetFPS;
        this.lastTime = performance.now();
        this.accumulator = 0;
        this.running = false;
    }

    start(updateFn, renderFn) {
        this.running = true;

        const loop = (currentTime) => {
            if (!this.running) return;

            const deltaTime = currentTime - this.lastTime;
            this.lastTime = currentTime;
            this.accumulator += deltaTime;

            // Fixed timestep updates
            while (this.accumulator >= this.targetFrameTime) {
                updateFn(this.targetFrameTime);
                this.accumulator -= this.targetFrameTime;
            }

            // Render
            const interpolation = this.accumulator / this.targetFrameTime;
            renderFn(interpolation);

            requestAnimationFrame(loop);
        };

        requestAnimationFrame(loop);
    }

    stop() {
        this.running = false;
    }
}

// Usage:
const loop = new GameLoop(60);
loop.start(
    (dt) => { /* update game state */ },
    (alpha) => { /* render with interpolation */ }
);
```

**Benefits:**
- ✅ Automatically syncs with display refresh
- ✅ Pauses when tab is not visible (saves CPU)
- ✅ Better battery life on mobile

---

## 6. Keyboard Input - ⚠️ MOSTLY PORTABLE

### Issue
Some key detection differences:
```python
if event.key == pygame.K_ESCAPE:
    # ESC key pressed
```

### Alternative: DOM KeyboardEvent

**Key mapping:**
```javascript
const KEY_MAP = {
    // pygame.K_* -> browser key
    'Escape': 'Escape',
    'Enter': 'Enter',
    ' ': 'Space',
    'a': 'a',
    'w': 'w',
    // ... etc
};

document.addEventListener('keydown', (event) => {
    const key = event.key.toLowerCase();

    // Check if it matches
    if (key === 'escape') {
        // Handle ESC
    }
});
```

**Limitations:**
- ⚠️ Some keys may be reserved by browser
- ⚠️ `event.preventDefault()` may not work for all keys
- ⚠️ Key repeat behavior differs

---

## 7. Clipboard Access - ⚠️ LIMITED

### Issue
pygame can access clipboard via platform APIs.

### Alternative: Clipboard API

```javascript
// Write to clipboard
await navigator.clipboard.writeText('Hello!');

// Read from clipboard (requires user permission)
const text = await navigator.clipboard.readText();

// Image support (modern browsers)
const blob = await fetch('image.png').then(r => r.blob());
await navigator.clipboard.write([
    new ClipboardItem({ 'image/png': blob })
]);
```

**Limitations:**
- ⚠️ Requires user permission
- ⚠️ Only works in secure contexts (HTTPS)
- ❌ Limited format support

---

## 8. Mouse Cursor - ⚠️ LIMITED

### Issue
pygame can hide cursor or set custom cursor.

### Alternative: CSS

```javascript
// Hide cursor
canvas.style.cursor = 'none';

// Custom cursor
canvas.style.cursor = 'url(cursor.png), auto';

// Standard cursors
canvas.style.cursor = 'pointer';
canvas.style.cursor = 'crosshair';
canvas.style.cursor = 'move';
```

**Limitations:**
- ❌ Cannot lock cursor (except in fullscreen with Pointer Lock API)
- ⚠️ Custom cursor size limits

---

## Complete Feature Matrix

| pygame Feature | Web API | Compatibility | Notes |
|---------------|---------|---------------|-------|
| `pygame.display` | Canvas | ✅ 100% | Direct mapping |
| `pygame.Surface` | Canvas | ✅ 100% | Offscreen canvases |
| `pygame.draw.*` | Canvas 2D | ✅ 95% | Missing some shapes |
| `pygame.image` | Image API | ✅ 90% | Format support varies |
| `pygame.event` | DOM Events | ✅ 90% | Different architecture |
| `pygame.time` | Performance API | ✅ 85% | Different timing model |
| `pygame.mixer.music` | Web Audio | ⚠️ 70% | Different API, requires user gesture |
| `pygame.mixer.Sound` | Web Audio | ⚠️ 70% | Different API |
| `pygame.font` | Canvas text | ⚠️ 60% | Limited font control |
| File I/O | IndexedDB | ⚠️ 50% | Virtual filesystem needed |
| Threading | Web Workers | ⚠️ 40% | Different model |
| System calls | N/A | ❌ 0% | Browser sandbox |

---

## Recommended Migration Strategy

### Phase 1: Core Graphics ✅
- Use `pygame.js` wrapper (already implemented)
- Map pygame APIs to Canvas
- Handle events with DOM listeners

### Phase 2: Audio 🔄
```javascript
// Create audio manager
const audio = new AudioManager();

// Replace pygame.mixer calls
// pygame.mixer.music.load('song.mp3')
await audio.loadMusic('song.mp3');

// pygame.mixer.music.play()
audio.playMusic(true);
```

### Phase 3: Persistence 🔄
```javascript
// Create storage manager
const storage = new Storage('badge-simulator');
await storage.init();

// Replace file operations
// with open('/flash/data.json', 'r') as f:
const data = await storage.readFile('/flash/data.json');
```

### Phase 4: Python Runtime (Optional) 🔄
Use **Pyodide** to run actual Python code in browser:
```javascript
// Load Pyodide
const pyodide = await loadPyodide();

// Install packages
await pyodide.loadPackage(['numpy', 'micropip']);

// Run Python code
pyodide.runPython(`
    import json
    data = json.loads('{"key": "value"}')
    print(data)
`);
```

This allows running badge apps directly without porting!

---

## Conclusion

**Highly Portable (>90%):**
- ✅ Graphics (Canvas)
- ✅ Input events
- ✅ Basic animations
- ✅ Image loading

**Moderately Portable (60-90%):**
- ⚠️ Audio (different API)
- ⚠️ Timing (different model)
- ⚠️ Fonts (limited control)

**Poorly Portable (<60%):**
- ❌ File system (virtual only)
- ❌ Threading (different model)
- ❌ System integration (sandbox)

**Recommendation:** The pygame.js compatibility layer handles ~85% of common use cases. For complete compatibility, consider running Python via Pyodide.
