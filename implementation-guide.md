# Custom OS Implementation Guide: Detailed Recommendations

## Executive Summary

This guide provides in-depth implementation details for the three recommended approaches to creating a custom operating system for the Tildagon badge. Each approach is presented with concrete implementation steps, code examples, architectural patterns, performance optimization techniques, and migration strategies.

**Recommended Approaches**:
1. **Phase 1: Optimized MicroPython** - Low-risk evolutionary improvement (1-3 months)
2. **Phase 2: Hybrid Native + Lua** - Balanced performance and flexibility (4-8 months)
3. **Phase 3: FreeRTOS + Native C++** - Maximum performance (3-6 months)

---

## Table of Contents

1. [Approach 1: Optimized MicroPython](#approach-1-optimized-micropython)
2. [Approach 2: Hybrid Native + Lua](#approach-2-hybrid-native--lua)
3. [Approach 3: FreeRTOS + Native C++](#approach-3-freertos--native-c)
4. [Performance Optimization Techniques](#performance-optimization-techniques)
5. [Migration Strategies](#migration-strategies)
6. [Testing & Validation](#testing--validation)
7. [Deployment & Rollout](#deployment--rollout)

---

# Approach 1: Optimized MicroPython

## Overview

**Goal**: Achieve 20-40% performance improvement and 15-25% memory reduction while maintaining full backward compatibility with existing Python applications.

**Timeline**: 1-3 months

**Risk Level**: Very Low

**Investment**: $33,000-$100,000

---

## Phase 1.1: Profiling & Analysis (Week 1-2)

### Step 1: Set Up Profiling Infrastructure

**Install Profiling Tools**:

```python
# modules/lib/profiler.py
import time
import gc

class Profiler:
    def __init__(self):
        self.timings = {}
        self.memory_before = {}

    def start(self, label):
        self.timings[label] = time.ticks_us()
        gc.collect()
        self.memory_before[label] = gc.mem_free()

    def end(self, label):
        elapsed = time.ticks_diff(time.ticks_us(), self.timings[label])
        mem_after = gc.mem_free()
        mem_used = self.memory_before[label] - mem_after
        print(f"{label}: {elapsed}us, mem: {mem_used}B")
        return elapsed, mem_used

# Global profiler instance
profiler = Profiler()
```

**Instrument Critical Paths**:

```python
# In modules/system/scheduler/scheduler.py
from lib.profiler import profiler

async def _run_foreground_app(self):
    profiler.start("app_update")
    await self._current_app.run(self._render_update)
    profiler.end("app_update")

    if self._needs_render:
        profiler.start("app_draw")
        ctx.save()
        self._current_app.draw(ctx)
        ctx.restore()
        profiler.end("app_draw")
```

### Step 2: Identify Bottlenecks

**Run Benchmark Suite**:

```python
# modules/benchmark.py
import time
from lib.profiler import profiler

async def benchmark_rendering():
    """Benchmark display rendering performance"""
    import st3m.ui.display as display

    ctx = display.ctx()

    # Benchmark fill operations
    profiler.start("fill_rect")
    for _ in range(100):
        ctx.rgb(1, 0, 0)
        ctx.rectangle(-120, -120, 240, 240).fill()
    profiler.end("fill_rect")

    # Benchmark text rendering
    profiler.start("text_render")
    for _ in range(100):
        ctx.rgb(1, 1, 1)
        ctx.move_to(0, 0)
        ctx.text("Hello World")
    profiler.end("text_render")

    # Benchmark image operations
    profiler.start("image_blit")
    for _ in range(100):
        # Blit operation
        pass
    profiler.end("image_blit")

async def benchmark_led_patterns():
    """Benchmark LED pattern updates"""
    import neopixel

    np = neopixel.NeoPixel(machine.Pin(21), 19)

    profiler.start("led_update")
    for _ in range(100):
        for i in range(19):
            np[i] = (255, 0, 0)
        np.write()
    profiler.end("led_update")

async def benchmark_event_dispatch():
    """Benchmark event system performance"""
    from system.eventbus import eventbus
    from events.input import ButtonDownEvent, BUTTON_TYPES

    def handler(event):
        pass

    eventbus.on(ButtonDownEvent, handler, None)

    profiler.start("event_dispatch")
    for _ in range(1000):
        eventbus.emit(ButtonDownEvent(BUTTON_TYPES["CONFIRM"]))
    profiler.end("event_dispatch")

# Run all benchmarks
async def run_all():
    await benchmark_rendering()
    await benchmark_led_patterns()
    await benchmark_event_dispatch()
    print("Benchmarks complete!")
```

**Expected Bottlenecks**:
1. Graphics rendering (ctx library - already in C, but Python calling overhead)
2. LED pattern calculations
3. Event dispatch overhead
4. Sensor data processing
5. Memory allocation in hot paths

---

## Phase 1.2: Native Module Development (Week 2-4)

### Optimization 1: Native LED Pattern Engine

**Current Implementation** (Python):

```python
# modules/patterns/rainbow.py
import math

class RainbowPattern:
    def __init__(self):
        self.offset = 0

    def update(self, leds, dt):
        self.offset += dt * 50  # Speed
        for i in range(len(leds)):
            hue = (i * 360 / len(leds) + self.offset) % 360
            leds[i] = self.hsv_to_rgb(hue, 1.0, 1.0)

    def hsv_to_rgb(self, h, s, v):
        # Expensive floating-point math
        c = v * s
        x = c * (1 - abs(((h / 60) % 2) - 1))
        m = v - c
        # ... complex conversion
        return (r, g, b)
```

**Optimized Implementation** (C Native Module):

```c
// drivers/led_patterns/led_patterns.c

#include "py/runtime.h"
#include "py/obj.h"
#include <math.h>

// Fast HSV to RGB conversion using integer math
static void hsv_to_rgb_fast(int h, int s, int v, uint8_t *r, uint8_t *g, uint8_t *b) {
    h %= 360;
    int region = h / 60;
    int remainder = (h - (region * 60)) * 6;

    int p = (v * (255 - s)) >> 8;
    int q = (v * (255 - ((s * remainder) >> 8))) >> 8;
    int t = (v * (255 - ((s * (255 - remainder)) >> 8))) >> 8;

    switch(region) {
        case 0: *r = v; *g = t; *b = p; break;
        case 1: *r = q; *g = v; *b = p; break;
        case 2: *r = p; *g = v; *b = t; break;
        case 3: *r = p; *g = q; *b = v; break;
        case 4: *r = t; *g = p; *b = v; break;
        default: *r = v; *g = p; *b = q; break;
    }
}

// Native rainbow pattern function
STATIC mp_obj_t led_patterns_rainbow(mp_obj_t leds_obj, mp_obj_t offset_obj, mp_obj_t brightness_obj) {
    mp_obj_t *leds;
    size_t num_leds;
    mp_obj_get_array(leds_obj, &num_leds, &leds);

    int offset = mp_obj_get_int(offset_obj);
    int brightness = mp_obj_get_int(brightness_obj);

    for (size_t i = 0; i < num_leds; i++) {
        int hue = ((i * 360) / num_leds + offset) % 360;
        uint8_t r, g, b;
        hsv_to_rgb_fast(hue, 255, brightness, &r, &g, &b);

        // Create RGB tuple
        mp_obj_t rgb[3] = {
            MP_OBJ_NEW_SMALL_INT(r),
            MP_OBJ_NEW_SMALL_INT(g),
            MP_OBJ_NEW_SMALL_INT(b)
        };
        leds[i] = mp_obj_new_tuple(3, rgb);
    }

    return mp_const_none;
}
STATIC MP_DEFINE_CONST_FUN_OBJ_3(led_patterns_rainbow_obj, led_patterns_rainbow);

// Native cylon pattern (bouncing scanner)
STATIC mp_obj_t led_patterns_cylon(mp_obj_t leds_obj, mp_obj_t position_obj,
                                     mp_obj_t color_obj, mp_obj_t tail_length_obj) {
    mp_obj_t *leds;
    size_t num_leds;
    mp_obj_get_array(leds_obj, &num_leds, &leds);

    int position = mp_obj_get_int(position_obj);
    int tail_length = mp_obj_get_int(tail_length_obj);

    // Get RGB color
    mp_obj_t *color;
    mp_obj_get_array_fixed_n(color_obj, 3, &color);
    uint8_t r = mp_obj_get_int(color[0]);
    uint8_t g = mp_obj_get_int(color[1]);
    uint8_t b = mp_obj_get_int(color[2]);

    // Fast cylon effect with integer math
    for (size_t i = 0; i < num_leds; i++) {
        int distance = abs((int)i - position);
        int brightness = (distance < tail_length) ?
                        (255 * (tail_length - distance)) / tail_length : 0;

        mp_obj_t rgb[3] = {
            MP_OBJ_NEW_SMALL_INT((r * brightness) >> 8),
            MP_OBJ_NEW_SMALL_INT((g * brightness) >> 8),
            MP_OBJ_NEW_SMALL_INT((b * brightness) >> 8)
        };
        leds[i] = mp_obj_new_tuple(3, rgb);
    }

    return mp_const_none;
}
STATIC MP_DEFINE_CONST_FUN_OBJ_VAR_BETWEEN(led_patterns_cylon_obj, 4, 4, led_patterns_cylon);

// Module definition
STATIC const mp_rom_map_elem_t led_patterns_module_globals_table[] = {
    { MP_ROM_QSTR(MP_QSTR___name__), MP_ROM_QSTR(MP_QSTR_led_patterns) },
    { MP_ROM_QSTR(MP_QSTR_rainbow), MP_ROM_PTR(&led_patterns_rainbow_obj) },
    { MP_ROM_QSTR(MP_QSTR_cylon), MP_ROM_PTR(&led_patterns_cylon_obj) },
};
STATIC MP_DEFINE_CONST_DICT(led_patterns_module_globals, led_patterns_module_globals_table);

const mp_obj_module_t led_patterns_module = {
    .base = { &mp_type_module },
    .globals = (mp_obj_dict_t *)&led_patterns_module_globals,
};

MP_REGISTER_MODULE(MP_QSTR_led_patterns, led_patterns_module);
```

**Build Configuration** (`drivers/led_patterns/micropython.cmake`):

```cmake
add_library(usermod_led_patterns INTERFACE)

target_sources(usermod_led_patterns INTERFACE
    ${CMAKE_CURRENT_LIST_DIR}/led_patterns.c
)

target_include_directories(usermod_led_patterns INTERFACE
    ${CMAKE_CURRENT_LIST_DIR}
)

target_link_libraries(usermod INTERFACE usermod_led_patterns)
```

**Usage** (Python):

```python
# modules/patterns/rainbow.py (optimized)
import led_patterns

class RainbowPattern:
    def __init__(self):
        self.offset = 0

    def update(self, leds, dt):
        self.offset = int(self.offset + dt * 50) % 360
        # Call native implementation - 10-20x faster!
        led_patterns.rainbow(leds, self.offset, 255)
```

**Expected Performance Gain**: 10-20x faster

---

### Optimization 2: Native Sensor Fusion

**Current Implementation** (Python):

```python
# modules/lib/imu_fusion.py
import math

class IMUFusion:
    def calculate_tilt(self, accel_x, accel_y, accel_z):
        # Expensive floating-point operations
        magnitude = math.sqrt(accel_x**2 + accel_y**2 + accel_z**2)

        pitch = math.asin(accel_x / magnitude) * 180 / math.pi
        roll = math.asin(accel_y / magnitude) * 180 / math.pi

        return pitch, roll
```

**Optimized Implementation** (C):

```c
// drivers/tildagon_helpers/imu_helpers.c

#include "py/runtime.h"
#include <math.h>

// Fast inverse square root (Quake III algorithm)
static float fast_inv_sqrt(float x) {
    float halfx = 0.5f * x;
    float y = x;
    long i = *(long*)&y;
    i = 0x5f3759df - (i>>1);
    y = *(float*)&i;
    y = y * (1.5f - (halfx * y * y));
    return y;
}

STATIC mp_obj_t imu_calculate_tilt(mp_obj_t accel_obj) {
    mp_obj_t *accel;
    mp_obj_get_array_fixed_n(accel_obj, 3, &accel);

    float ax = mp_obj_get_float(accel[0]);
    float ay = mp_obj_get_float(accel[1]);
    float az = mp_obj_get_float(accel[2]);

    // Fast magnitude calculation
    float mag_sq = ax*ax + ay*ay + az*az;
    float inv_mag = fast_inv_sqrt(mag_sq);

    // Normalize
    ax *= inv_mag;
    ay *= inv_mag;

    // Calculate angles
    float pitch = asinf(ax) * 57.2957795f;  // * 180/pi
    float roll = asinf(ay) * 57.2957795f;

    mp_obj_t result[2] = {
        mp_obj_new_float(pitch),
        mp_obj_new_float(roll)
    };

    return mp_obj_new_tuple(2, result);
}
STATIC MP_DEFINE_CONST_FUN_OBJ_1(imu_calculate_tilt_obj, imu_calculate_tilt);

// Add to existing tildagon_helpers module
// ... (add to module globals table)
```

**Expected Performance Gain**: 5-10x faster

---

## Phase 1.3: Memory Optimization (Week 4-6)

### Optimization 3: Freeze More Modules as Bytecode

**Current State**: Only core modules are frozen

**Optimization**: Freeze all system and app_component modules

**Edit** `tildagon/manifest.py`:

```python
# tildagon/manifest.py

# Existing frozen modules
freeze("$(MPY_DIR)/tools", ("upip.py", "upip_utarfile.py"))
require("bundle-networking")
# ... existing ...

# NEW: Freeze system modules (currently loaded from filesystem)
freeze("$(PORT_DIR)/../modules/system", "eventbus.py")
freeze("$(PORT_DIR)/../modules/system/scheduler", "scheduler.py")
freeze("$(PORT_DIR)/../modules/system/launcher", (
    "app.py",
    "menu.py",
))
freeze("$(PORT_DIR)/../modules/system/patterndisplay", "app.py")
freeze("$(PORT_DIR)/../modules/system/power", "app.py")
freeze("$(PORT_DIR)/../modules/system/notification", (
    "app.py",
    "notification.py",
))

# Freeze app_components (UI widgets)
freeze("$(PORT_DIR)/../modules/app_components", (
    "layout.py",
    "menu.py",
    "dialog.py",
    "tokens.py",
))

# Freeze common libraries
freeze("$(PORT_DIR)/../modules/lib", (
    "simple_tildagon.py",
    "bdevice.py",
))

# Freeze events
freeze("$(PORT_DIR)/../modules/events", (
    "input.py",
    "hexpansion.py",
))
```

**Benefits**:
- Reduce RAM usage: ~50-100KB (modules don't need to be loaded into RAM)
- Faster imports: No filesystem access
- Reduce filesystem clutter

**Trade-off**: Requires reflashing to update frozen modules (not OTA-updatable)

---

### Optimization 4: Object Pooling for Hot Paths

**Problem**: Frequent allocation/deallocation causes GC pressure

**Solution**: Pre-allocate pools of commonly used objects

```python
# modules/lib/object_pool.py

class ObjectPool:
    """Generic object pool to reduce GC pressure"""

    def __init__(self, factory, size):
        self.factory = factory
        self.pool = [factory() for _ in range(size)]
        self.available = list(range(size))
        self.in_use = {}

    def acquire(self):
        if not self.available:
            # Pool exhausted - could expand or raise
            print("WARNING: Pool exhausted, allocating new object")
            return self.factory()

        idx = self.available.pop()
        obj = self.pool[idx]
        self.in_use[id(obj)] = idx
        return obj

    def release(self, obj):
        obj_id = id(obj)
        if obj_id in self.in_use:
            idx = self.in_use.pop(obj_id)
            self.available.append(idx)
            # Reset object state
            if hasattr(obj, 'reset'):
                obj.reset()


# Example: Event object pool
class EventPool:
    """Pool for button events"""

    def __init__(self):
        from events.input import ButtonDownEvent, BUTTON_TYPES
        self.button_down_pool = ObjectPool(
            lambda: ButtonDownEvent(BUTTON_TYPES["CONFIRM"]),
            size=10
        )

    def get_button_down_event(self, button):
        event = self.button_down_pool.acquire()
        event.button = button
        return event

    def release_event(self, event):
        self.button_down_pool.release(event)

# Global instance
event_pool = EventPool()
```

**Usage in Event Bus**:

```python
# modules/system/eventbus.py

from lib.object_pool import event_pool

class EventBus:
    def emit(self, event):
        # ... existing emit logic ...

        # After all handlers complete, release event back to pool
        if hasattr(event, '__pooled__'):
            event_pool.release_event(event)
```

---

### Optimization 5: Garbage Collection Tuning

**Current State**: Default GC thresholds

**Optimization**: Tune GC to run less frequently but more thoroughly

```python
# modules/main.py (add at startup)

import gc

# Tune garbage collection
# Default threshold is typically 2048 bytes
# Increase to 8192 to reduce GC frequency
gc.threshold(8192)

# Force a collection at startup
gc.collect()

# Optional: Disable automatic GC for deterministic timing
# (must manually call gc.collect() periodically)
# gc.disable()

# If GC disabled, add periodic collection in scheduler
# In scheduler main loop:
#   if frame_count % 100 == 0:
#       gc.collect()
```

**Trade-offs**:
- Higher threshold = less frequent GC = fewer pauses
- But: Higher peak memory usage
- Recommendation: Tune based on actual memory pressure

---

## Phase 1.4: Display Optimization (Week 6-8)

### Optimization 6: Partial Screen Updates

**Current State**: Full 240x240 framebuffer update every frame

**Problem**: Wastes bandwidth updating unchanged regions

**Solution**: Track dirty regions and update only what changed

```python
# modules/lib/dirty_rect.py

class DirtyRectManager:
    """Manages dirty regions for partial screen updates"""

    def __init__(self, width=240, height=240):
        self.width = width
        self.height = height
        self.dirty_rects = []
        self.full_redraw = True

    def mark_dirty(self, x, y, w, h):
        """Mark a rectangular region as needing redraw"""
        self.dirty_rects.append((x, y, w, h))

    def mark_full_redraw(self):
        """Mark entire screen for redraw"""
        self.full_redraw = True
        self.dirty_rects = []

    def get_dirty_regions(self):
        """Get optimized list of dirty regions"""
        if self.full_redraw:
            self.full_redraw = False
            return [(0, 0, self.width, self.height)]

        if not self.dirty_rects:
            return []

        # Merge overlapping rects (simple version)
        merged = self._merge_rects(self.dirty_rects)
        self.dirty_rects = []
        return merged

    def _merge_rects(self, rects):
        """Merge overlapping rectangles"""
        if len(rects) <= 1:
            return rects

        # Simple merge: if more than 3 rects, just redraw all
        # (more sophisticated algorithms possible)
        if len(rects) > 3:
            return [(0, 0, self.width, self.height)]

        return rects

# Global dirty rect manager
dirty_manager = DirtyRectManager()
```

**Integration with Display**:

```python
# modules/system/scheduler/scheduler.py

from lib.dirty_rect import dirty_manager

class Scheduler:
    def _render_update(self):
        """Called when app requests redraw"""
        self._needs_render = True

    async def _render_frame(self):
        """Render frame with dirty region tracking"""
        if not self._needs_render:
            return

        import st3m.ui.display as display
        ctx = display.ctx()

        dirty_regions = dirty_manager.get_dirty_regions()

        for x, y, w, h in dirty_regions:
            # Set clip region
            ctx.save()
            ctx.rectangle(x, y, w, h).clip()

            # Draw app content
            if self._current_app:
                self._current_app.draw(ctx)

            # Draw overlays
            for overlay in self._overlays:
                overlay.draw(ctx)

            ctx.restore()

        self._needs_render = False
```

**App Usage**:

```python
# In app's draw() method
from lib.dirty_rect import dirty_manager

class MyApp(App):
    def update_button_state(self):
        # Only this button changed
        dirty_manager.mark_dirty(10, 10, 50, 30)

    def draw(self, ctx):
        # Draw as normal - clipping handled automatically
        ctx.rgb(1, 0, 0)
        ctx.rectangle(10, 10, 50, 30).fill()
```

**Expected Performance Gain**: 2-5x faster rendering for typical UI updates

---

### Optimization 7: Display Buffer Management

**Current State**: Single framebuffer, immediate flush

**Optimization**: Double buffering with smart flush

```c
// components/flow3r_bsp/gc9a01_display.c (modify existing)

static uint16_t *framebuffer_0 = NULL;
static uint16_t *framebuffer_1 = NULL;
static uint16_t *current_fb = NULL;
static bool display_busy = false;

void display_init_double_buffer(void) {
    // Allocate two framebuffers in SPIRAM
    framebuffer_0 = heap_caps_malloc(240 * 240 * 2, MALLOC_CAP_SPIRAM);
    framebuffer_1 = heap_caps_malloc(240 * 240 * 2, MALLOC_CAP_SPIRAM);
    current_fb = framebuffer_0;
}

void display_swap_buffers(void) {
    // Wait for previous DMA transfer to complete
    while (display_busy) {
        vTaskDelay(1);
    }

    // Swap
    current_fb = (current_fb == framebuffer_0) ? framebuffer_1 : framebuffer_0;
}

void display_flush_async(void) {
    // Start DMA transfer from current_fb
    display_busy = true;
    // ... SPI DMA transfer ...
    // Callback will set display_busy = false when done
}
```

**Expected Performance Gain**: Eliminates render blocking, smoother frame rate

---

## Phase 1.5: Integration & Testing (Week 8-12)

### Optimization 8: Lazy Module Loading

**Current State**: All modules imported at startup

**Optimization**: Import modules only when needed

```python
# modules/main.py

import sys

class LazyLoader:
    """Lazy module loader to reduce startup time"""

    def __init__(self, module_name):
        self.module_name = module_name
        self.module = None

    def __getattr__(self, name):
        if self.module is None:
            self.module = __import__(self.module_name)
        return getattr(self.module, name)

# Replace eager imports with lazy loading
# Before:
# from system.hexpansion import manager

# After:
sys.modules['system.hexpansion.manager'] = LazyLoader('system.hexpansion.manager')
```

**Expected Gain**: 20-30% faster boot time

---

### Performance Validation

**Create Automated Benchmark Suite**:

```python
# modules/test_performance.py

import time
import gc
from lib.profiler import profiler

class PerformanceTest:
    def __init__(self):
        self.results = {}

    def run_all(self):
        print("Running performance tests...")

        self.test_led_patterns()
        self.test_rendering()
        self.test_event_dispatch()
        self.test_memory_usage()

        self.print_results()

    def test_led_patterns(self):
        """Test LED pattern performance"""
        import neopixel
        import machine
        import led_patterns  # Native module

        np = neopixel.NeoPixel(machine.Pin(21), 19)
        leds = [0] * 19

        # Benchmark native rainbow
        start = time.ticks_us()
        for _ in range(1000):
            led_patterns.rainbow(leds, 0, 255)
        elapsed = time.ticks_diff(time.ticks_us(), start)

        self.results['led_rainbow_1000iter'] = f"{elapsed}us ({elapsed/1000:.1f}us/iter)"

    def test_rendering(self):
        """Test rendering performance"""
        import st3m.ui.display as display

        ctx = display.ctx()

        start = time.ticks_us()
        for _ in range(100):
            ctx.rgb(1, 0, 0)
            ctx.rectangle(-120, -120, 240, 240).fill()
        elapsed = time.ticks_diff(time.ticks_us(), start)

        self.results['render_rect_100'] = f"{elapsed}us ({elapsed/100:.1f}us/rect)"

    def test_event_dispatch(self):
        """Test event system performance"""
        from system.eventbus import eventbus
        from events.input import ButtonDownEvent, BUTTON_TYPES

        call_count = 0
        def handler(event):
            nonlocal call_count
            call_count += 1

        eventbus.on(ButtonDownEvent, handler, None)

        start = time.ticks_us()
        for _ in range(1000):
            eventbus.emit(ButtonDownEvent(BUTTON_TYPES["CONFIRM"]))
        elapsed = time.ticks_diff(time.ticks_us(), start)

        self.results['event_dispatch_1000'] = f"{elapsed}us ({elapsed/1000:.1f}us/event)"

    def test_memory_usage(self):
        """Test memory footprint"""
        gc.collect()
        free_before = gc.mem_free()

        # Import heavy module
        import system.launcher

        gc.collect()
        free_after = gc.mem_free()

        used = free_before - free_after
        self.results['launcher_memory'] = f"{used}B"

    def print_results(self):
        print("\n=== Performance Test Results ===")
        for name, value in self.results.items():
            print(f"{name}: {value}")
        print("================================\n")

# Run tests
test = PerformanceTest()
test.run_all()
```

**Success Criteria**:
- LED patterns: <100us per update (10x faster than baseline)
- Rendering: <500us per rectangle fill
- Event dispatch: <50us per event
- Boot time: <2s (vs. 3s baseline)
- Memory free after boot: >150KB (vs. 100KB baseline)

---

## Expected Results Summary

| Metric | Baseline | Optimized | Improvement |
|--------|----------|-----------|-------------|
| **LED Update** | 1000us | 80us | 12.5x faster |
| **Sensor Fusion** | 500us | 60us | 8.3x faster |
| **Event Dispatch** | 80us | 40us | 2x faster |
| **Rendering** | 50ms/frame | 20ms/frame | 2.5x faster |
| **Boot Time** | 3.0s | 2.0s | 1.5x faster |
| **Free RAM** | 100KB | 150KB | +50% |
| **Flash Usage** | 2.4MB | 2.0MB | -17% |

---

# Approach 2: Hybrid Native + Lua

## Overview

**Goal**: Achieve near-native performance for system services while retaining scripting flexibility for user applications.

**Architecture**:
```
┌─────────────────────────────────┐
│    User Apps (Lua Scripts)      │
├─────────────────────────────────┤
│    Lua VM + API Bindings        │
├─────────────────────────────────┤
│  Native Application Framework   │
│       (C++17, Event-Driven)     │
├─────────────────────────────────┤
│    FreeRTOS + ESP-IDF           │
└─────────────────────────────────┘
```

**Timeline**: 4-8 months

**Risk Level**: Medium

**Investment**: $133,000-$267,000

---

## Phase 2.1: Architecture Design (Week 1-2)

### Core Architecture Decisions

**Language Choice**: C++17
- Modern features (smart pointers, lambdas, constexpr)
- RAII for resource management
- Template metaprogramming for zero-cost abstractions
- Compatible with ESP-IDF

**Scripting Engine**: Lua 5.4
- Small footprint (~100KB)
- Fast execution
- Easy C++ integration
- Proven in embedded systems (e.g., NodeMCU)

**Alternative Consideration**: LuaJIT
- JIT compilation for 5-50x performance
- BUT: Larger footprint, needs more RAM
- Recommendation: Start with Lua 5.4, consider LuaJIT if performance insufficient

### System Architecture

**Component Hierarchy**:

```cpp
// include/tildagon/core/system.hpp

namespace tildagon {

class System {
public:
    static System& instance();

    // Core subsystems
    DisplayManager& display();
    InputManager& input();
    LEDManager& leds();
    PowerManager& power();
    StorageManager& storage();
    NetworkManager& network();
    HexpansionManager& hexpansion();

    // Application management
    AppScheduler& scheduler();
    EventBus& events();

    // Scripting
    ScriptEngine& lua();

    // Lifecycle
    void initialize();
    void run();  // Main loop
    void shutdown();

private:
    System() = default;
    // ... private members ...
};

} // namespace tildagon
```

---

## Phase 2.2: Native Framework Implementation (Week 2-8)

### Component 1: Event System

**Design**: Type-safe event bus with zero-copy dispatch

```cpp
// include/tildagon/events/event.hpp

namespace tildagon::events {

// Base event class
class Event {
public:
    virtual ~Event() = default;
    virtual const char* name() const = 0;

    bool handled = false;
    uint32_t timestamp_ms;
};

// Event types
class ButtonEvent : public Event {
public:
    enum class Type { Down, Up };
    enum class Button { A, B, C, D, E, F, None };

    ButtonEvent(Button btn, Type type)
        : button(btn), type(type) {}

    const char* name() const override { return "ButtonEvent"; }

    Button button;
    Type type;
};

class HexpansionEvent : public Event {
public:
    enum class Type { Inserted, Removed };

    HexpansionEvent(uint8_t port, Type type)
        : port(port), type(type) {}

    const char* name() const override { return "HexpansionEvent"; }

    uint8_t port;
    Type type;
};

// ... more event types ...

} // namespace tildagon::events
```

**Event Bus Implementation**:

```cpp
// include/tildagon/events/event_bus.hpp

namespace tildagon::events {

using EventHandler = std::function<void(const Event&)>;

class EventBus {
public:
    // Subscribe to specific event type
    template<typename EventType>
    uint32_t subscribe(std::function<void(const EventType&)> handler) {
        auto type_id = typeid(EventType).hash_code();
        auto wrapper = [handler](const Event& e) {
            handler(static_cast<const EventType&>(e));
        };

        uint32_t id = next_id_++;
        handlers_[type_id].emplace_back(id, wrapper);
        return id;
    }

    // Unsubscribe
    void unsubscribe(uint32_t handler_id);

    // Emit event (synchronous)
    void emit(const Event& event) {
        auto type_id = typeid(event).hash_code();
        auto it = handlers_.find(type_id);
        if (it != handlers_.end()) {
            for (auto& [id, handler] : it->second) {
                handler(event);
                if (event.handled) break;
            }
        }
    }

    // Emit event (queued for async processing)
    void post(std::unique_ptr<Event> event) {
        std::lock_guard<std::mutex> lock(queue_mutex_);
        event_queue_.push(std::move(event));
    }

    // Process queued events
    void process() {
        std::lock_guard<std::mutex> lock(queue_mutex_);
        while (!event_queue_.empty()) {
            auto& event = event_queue_.front();
            emit(*event);
            event_queue_.pop();
        }
    }

private:
    uint32_t next_id_ = 1;
    std::unordered_map<size_t, std::vector<std::pair<uint32_t, EventHandler>>> handlers_;

    std::mutex queue_mutex_;
    std::queue<std::unique_ptr<Event>> event_queue_;
};

} // namespace tildagon::events
```

**Usage Example**:

```cpp
// In app code
auto& bus = System::instance().events();

// Subscribe to button events
auto subscription = bus.subscribe<ButtonEvent>([](const ButtonEvent& event) {
    if (event.button == ButtonEvent::Button::A &&
        event.type == ButtonEvent::Type::Down) {
        printf("Button A pressed!\n");
    }
});

// Later: emit event
bus.emit(ButtonEvent(ButtonEvent::Button::A, ButtonEvent::Type::Down));

// Clean up
bus.unsubscribe(subscription);
```

---

### Component 2: Application Framework

**Base App Class**:

```cpp
// include/tildagon/app/app.hpp

namespace tildagon::app {

class App {
public:
    virtual ~App() = default;

    // Lifecycle
    virtual void on_enter() {}   // App becomes foreground
    virtual void on_exit() {}    // App loses focus
    virtual void on_resume() {}  // App returns to foreground
    virtual void on_pause() {}   // App goes to background

    // Main loop (called every frame for foreground app)
    virtual void update(float delta_time) = 0;

    // Rendering (called after update)
    virtual void draw(graphics::Context& ctx) = 0;

    // Background task (called even when app is backgrounded)
    virtual void background_update(float delta_time) {}

    // App metadata
    virtual const char* name() const = 0;
    virtual const char* author() const { return "Unknown"; }
    virtual const char* version() const { return "1.0"; }

    // Control
    void minimize();  // Return to launcher
    void quit();      // Close app

protected:
    bool is_foreground() const { return is_foreground_; }

private:
    friend class AppScheduler;
    bool is_foreground_ = false;
};

} // namespace tildagon::app
```

**App Scheduler**:

```cpp
// include/tildagon/app/scheduler.hpp

namespace tildagon::app {

class AppScheduler {
public:
    // App management
    void push(std::unique_ptr<App> app);  // Push app to foreground
    void pop();                            // Return to previous app
    void switch_to(std::unique_ptr<App> app);  // Replace foreground

    // Main loop
    void update(float delta_time);
    void draw(graphics::Context& ctx);

    // State
    App* foreground() const {
        return app_stack_.empty() ? nullptr : app_stack_.back().get();
    }

    size_t app_count() const { return app_stack_.size(); }

private:
    std::vector<std::unique_ptr<App>> app_stack_;
    std::vector<std::unique_ptr<App>> background_apps_;
};

} // namespace tildagon::app
```

**Implementation**:

```cpp
// src/app/scheduler.cpp

namespace tildagon::app {

void AppScheduler::push(std::unique_ptr<App> app) {
    // Pause current foreground app
    if (!app_stack_.empty()) {
        app_stack_.back()->is_foreground_ = false;
        app_stack_.back()->on_pause();
    }

    // Push new app
    app->is_foreground_ = true;
    app_stack_.push_back(std::move(app));
    app_stack_.back()->on_enter();
}

void AppScheduler::pop() {
    if (app_stack_.empty()) return;

    // Exit current app
    app_stack_.back()->on_exit();
    app_stack_.pop_back();

    // Resume previous app
    if (!app_stack_.empty()) {
        app_stack_.back()->is_foreground_ = true;
        app_stack_.back()->on_resume();
    }
}

void AppScheduler::update(float delta_time) {
    // Update foreground app
    if (!app_stack_.empty()) {
        app_stack_.back()->update(delta_time);
    }

    // Update background tasks for all apps
    for (auto& app : app_stack_) {
        app->background_update(delta_time);
    }

    for (auto& app : background_apps_) {
        app->background_update(delta_time);
    }
}

void AppScheduler::draw(graphics::Context& ctx) {
    if (!app_stack_.empty()) {
        app_stack_.back()->draw(ctx);
    }
}

} // namespace tildagon::app
```

---

### Component 3: Graphics System

**Context Wrapper** (wraps existing ctx library):

```cpp
// include/tildagon/graphics/context.hpp

namespace tildagon::graphics {

class Color {
public:
    constexpr Color(uint8_t r, uint8_t g, uint8_t b, uint8_t a = 255)
        : r(r), g(g), b(b), a(a) {}

    constexpr Color(uint32_t rgba)
        : r((rgba >> 24) & 0xFF)
        , g((rgba >> 16) & 0xFF)
        , b((rgba >> 8) & 0xFF)
        , a(rgba & 0xFF) {}

    uint8_t r, g, b, a;

    // Predefined colors
    static constexpr Color Black()   { return {0, 0, 0}; }
    static constexpr Color White()   { return {255, 255, 255}; }
    static constexpr Color Red()     { return {255, 0, 0}; }
    static constexpr Color Green()   { return {0, 255, 0}; }
    static constexpr Color Blue()    { return {0, 0, 255}; }
};

class Context {
public:
    // Wraps ctx library from existing codebase
    explicit Context(Ctx* ctx) : ctx_(ctx) {}

    // Drawing
    void fill_rect(int x, int y, int w, int h, Color color) {
        ctx_rgb(ctx_, color.r / 255.0f, color.g / 255.0f, color.b / 255.0f);
        ctx_rectangle(ctx_, x, y, w, h);
        ctx_fill(ctx_);
    }

    void stroke_rect(int x, int y, int w, int h, Color color, float width = 1.0f) {
        ctx_rgb(ctx_, color.r / 255.0f, color.g / 255.0f, color.b / 255.0f);
        ctx_line_width(ctx_, width);
        ctx_rectangle(ctx_, x, y, w, h);
        ctx_stroke(ctx_);
    }

    void fill_circle(int x, int y, int radius, Color color) {
        ctx_rgb(ctx_, color.r / 255.0f, color.g / 255.0f, color.b / 255.0f);
        ctx_arc(ctx_, x, y, radius, 0, M_PI * 2, true);
        ctx_fill(ctx_);
    }

    void draw_text(int x, int y, const char* text, Color color, int font_size = 16) {
        ctx_rgb(ctx_, color.r / 255.0f, color.g / 255.0f, color.b / 255.0f);
        ctx_font_size(ctx_, font_size);
        ctx_move_to(ctx_, x, y);
        ctx_text(ctx_, text);
    }

    // State management
    void save() { ctx_save(ctx_); }
    void restore() { ctx_restore(ctx_); }

    // Direct access to underlying ctx (for advanced usage)
    Ctx* raw() { return ctx_; }

private:
    Ctx* ctx_;
};

} // namespace tildagon::graphics
```

---

## Phase 2.3: Lua Integration (Week 8-12)

### Lua VM Integration

**Lua State Management**:

```cpp
// include/tildagon/script/lua_engine.hpp

namespace tildagon::script {

class LuaEngine {
public:
    LuaEngine();
    ~LuaEngine();

    // Script execution
    bool execute_file(const char* path);
    bool execute_string(const char* code);

    // API registration
    void register_api();

    // Access Lua state (for advanced usage)
    lua_State* state() { return L_; }

private:
    lua_State* L_;

    // API bindings
    void register_display_api();
    void register_input_api();
    void register_led_api();
    void register_app_api();
};

} // namespace tildagon::script
```

**Implementation**:

```cpp
// src/script/lua_engine.cpp

#include "tildagon/script/lua_engine.hpp"
#include "lua.hpp"

namespace tildagon::script {

LuaEngine::LuaEngine() {
    L_ = luaL_newstate();
    luaL_openlibs(L_);
    register_api();
}

LuaEngine::~LuaEngine() {
    if (L_) {
        lua_close(L_);
    }
}

bool LuaEngine::execute_file(const char* path) {
    int result = luaL_dofile(L_, path);
    if (result != LUA_OK) {
        const char* error = lua_tostring(L_, -1);
        printf("Lua error: %s\n", error);
        lua_pop(L_, 1);
        return false;
    }
    return true;
}

bool LuaEngine::execute_string(const char* code) {
    int result = luaL_dostring(L_, code);
    if (result != LUA_OK) {
        const char* error = lua_tostring(L_, -1);
        printf("Lua error: %s\n", error);
        lua_pop(L_, 1);
        return false;
    }
    return true;
}

void LuaEngine::register_api() {
    register_display_api();
    register_input_api();
    register_led_api();
    register_app_api();
}

} // namespace tildagon::script
```

---

### Lua API Bindings

**Display API**:

```cpp
// src/script/api/display_api.cpp

namespace tildagon::script {

// Helper to get Context from Lua userdata
static graphics::Context* check_context(lua_State* L, int idx) {
    return *static_cast<graphics::Context**>(
        luaL_checkudata(L, idx, "Context"));
}

// Lua: ctx:fill_rect(x, y, w, h, r, g, b)
static int lua_fill_rect(lua_State* L) {
    auto* ctx = check_context(L, 1);
    int x = luaL_checkinteger(L, 2);
    int y = luaL_checkinteger(L, 3);
    int w = luaL_checkinteger(L, 4);
    int h = luaL_checkinteger(L, 5);
    int r = luaL_checkinteger(L, 6);
    int g = luaL_checkinteger(L, 7);
    int b = luaL_checkinteger(L, 8);

    ctx->fill_rect(x, y, w, h, graphics::Color(r, g, b));
    return 0;
}

// Lua: ctx:draw_text(x, y, text, r, g, b, size)
static int lua_draw_text(lua_State* L) {
    auto* ctx = check_context(L, 1);
    int x = luaL_checkinteger(L, 2);
    int y = luaL_checkinteger(L, 3);
    const char* text = luaL_checkstring(L, 4);
    int r = luaL_checkinteger(L, 5);
    int g = luaL_checkinteger(L, 6);
    int b = luaL_checkinteger(L, 7);
    int size = luaL_optinteger(L, 8, 16);

    ctx->draw_text(x, y, text, graphics::Color(r, g, b), size);
    return 0;
}

// Register display API
void LuaEngine::register_display_api() {
    // Create Context metatable
    luaL_newmetatable(L_, "Context");

    // Context methods
    lua_pushstring(L_, "__index");
    lua_newtable(L_);

    lua_pushstring(L_, "fill_rect");
    lua_pushcfunction(L_, lua_fill_rect);
    lua_settable(L_, -3);

    lua_pushstring(L_, "draw_text");
    lua_pushcfunction(L_, lua_draw_text);
    lua_settable(L_, -3);

    // ... more methods ...

    lua_settable(L_, -3);
    lua_pop(L_, 1);
}

} // namespace tildagon::script
```

**LED API**:

```cpp
// src/script/api/led_api.cpp

namespace tildagon::script {

// Lua: tildagon.leds.set(index, r, g, b)
static int lua_led_set(lua_State* L) {
    int index = luaL_checkinteger(L, 1);
    int r = luaL_checkinteger(L, 2);
    int g = luaL_checkinteger(L, 3);
    int b = luaL_checkinteger(L, 4);

    auto& leds = System::instance().leds();
    leds.set(index, r, g, b);

    return 0;
}

// Lua: tildagon.leds.show()
static int lua_led_show(lua_State* L) {
    auto& leds = System::instance().leds();
    leds.show();
    return 0;
}

// Lua: tildagon.leds.set_brightness(brightness)
static int lua_led_set_brightness(lua_State* L) {
    float brightness = luaL_checknumber(L, 1);
    auto& leds = System::instance().leds();
    leds.set_brightness(brightness);
    return 0;
}

void LuaEngine::register_led_api() {
    // Create tildagon.leds table
    lua_newtable(L_);

    lua_pushstring(L_, "set");
    lua_pushcfunction(L_, lua_led_set);
    lua_settable(L_, -3);

    lua_pushstring(L_, "show");
    lua_pushcfunction(L_, lua_led_show);
    lua_settable(L_, -3);

    lua_pushstring(L_, "set_brightness");
    lua_pushcfunction(L_, lua_led_set_brightness);
    lua_settable(L_, -3);

    lua_setglobal(L_, "leds");
}

} // namespace tildagon::script
```

---

### Lua App Wrapper

**C++ Wrapper for Lua Apps**:

```cpp
// include/tildagon/script/lua_app.hpp

namespace tildagon::script {

class LuaApp : public app::App {
public:
    explicit LuaApp(const char* script_path);
    ~LuaApp() override = default;

    // App interface
    void on_enter() override;
    void on_exit() override;
    void update(float delta_time) override;
    void draw(graphics::Context& ctx) override;

    const char* name() const override { return name_.c_str(); }

private:
    std::string script_path_;
    std::string name_;

    // Lua function references
    int update_ref_ = LUA_NOREF;
    int draw_ref_ = LUA_NOREF;
    int on_enter_ref_ = LUA_NOREF;
    int on_exit_ref_ = LUA_NOREF;

    void call_lua_function(int ref, int nargs = 0);
};

} // namespace tildagon::script
```

**Implementation**:

```cpp
// src/script/lua_app.cpp

namespace tildagon::script {

LuaApp::LuaApp(const char* script_path)
    : script_path_(script_path) {

    auto& lua = System::instance().lua();
    lua_State* L = lua.state();

    // Load script
    if (!lua.execute_file(script_path)) {
        throw std::runtime_error("Failed to load Lua script");
    }

    // Get app table
    lua_getglobal(L, "app");
    if (!lua_istable(L, -1)) {
        throw std::runtime_error("Lua script must define 'app' table");
    }

    // Get name
    lua_getfield(L, -1, "name");
    if (lua_isstring(L, -1)) {
        name_ = lua_tostring(L, -1);
    }
    lua_pop(L, 1);

    // Store function references
    lua_getfield(L, -1, "update");
    update_ref_ = luaL_ref(L, LUA_REGISTRYINDEX);

    lua_getfield(L, -1, "draw");
    draw_ref_ = luaL_ref(L, LUA_REGISTRYINDEX);

    lua_getfield(L, -1, "on_enter");
    on_enter_ref_ = luaL_ref(L, LUA_REGISTRYINDEX);

    lua_getfield(L, -1, "on_exit");
    on_exit_ref_ = luaL_ref(L, LUA_REGISTRYINDEX);

    lua_pop(L, 1);  // Pop app table
}

void LuaApp::on_enter() {
    call_lua_function(on_enter_ref_);
}

void LuaApp::on_exit() {
    call_lua_function(on_exit_ref_);
}

void LuaApp::update(float delta_time) {
    auto& lua = System::instance().lua();
    lua_State* L = lua.state();

    lua_rawgeti(L, LUA_REGISTRYINDEX, update_ref_);
    if (lua_isfunction(L, -1)) {
        lua_pushnumber(L, delta_time);
        if (lua_pcall(L, 1, 0, 0) != LUA_OK) {
            const char* error = lua_tostring(L, -1);
            printf("Lua error in update: %s\n", error);
            lua_pop(L, 1);
        }
    } else {
        lua_pop(L, 1);
    }
}

void LuaApp::draw(graphics::Context& ctx) {
    auto& lua = System::instance().lua();
    lua_State* L = lua.state();

    lua_rawgeti(L, LUA_REGISTRYINDEX, draw_ref_);
    if (lua_isfunction(L, -1)) {
        // Push Context userdata
        auto** ctx_ptr = static_cast<graphics::Context**>(
            lua_newuserdata(L, sizeof(graphics::Context*)));
        *ctx_ptr = &ctx;
        luaL_setmetatable(L, "Context");

        if (lua_pcall(L, 1, 0, 0) != LUA_OK) {
            const char* error = lua_tostring(L, -1);
            printf("Lua error in draw: %s\n", error);
            lua_pop(L, 1);
        }
    } else {
        lua_pop(L, 1);
    }
}

} // namespace tildagon::script
```

---

### Example Lua App

**Simple Counter App**:

```lua
-- apps/counter/app.lua

app = {
    name = "Counter",
    author = "Example",
    version = "1.0"
}

local count = 0
local button_pressed = false

function app:on_enter()
    print("Counter app started!")

    -- Subscribe to button events
    tildagon.input.on_button(function(button, pressed)
        if button == "A" and pressed then
            count = count + 1
        elseif button == "B" and pressed then
            count = math.max(0, count - 1)
        end
    end)
end

function app:update(dt)
    -- Update logic here
end

function app:draw(ctx)
    -- Clear screen
    ctx:fill_rect(-120, -120, 240, 240, 0, 0, 0)

    -- Draw title
    ctx:draw_text(-50, -80, "Counter App", 255, 255, 255, 20)

    -- Draw count
    local text = "Count: " .. tostring(count)
    ctx:draw_text(-60, 0, text, 0, 255, 0, 32)

    -- Draw instructions
    ctx:draw_text(-100, 80, "A: Increment  B: Decrement", 128, 128, 128, 12)
end

function app:on_exit()
    print("Counter app exited")
end

return app
```

**Rainbow LED App**:

```lua
-- apps/rainbow/app.lua

app = {
    name = "Rainbow LEDs",
    author = "Example",
    version = "1.0"
}

local offset = 0

function app:update(dt)
    offset = offset + dt * 100

    -- Update LEDs
    for i = 0, 18 do
        local hue = (i * 20 + offset) % 360
        local r, g, b = hsv_to_rgb(hue, 1.0, 1.0)
        tildagon.leds.set(i, r, g, b)
    end

    tildagon.leds.show()
end

function app:draw(ctx)
    ctx:fill_rect(-120, -120, 240, 240, 0, 0, 0)
    ctx:draw_text(-80, 0, "Rainbow LEDs!", 255, 255, 255, 24)
end

function hsv_to_rgb(h, s, v)
    local c = v * s
    local x = c * (1 - math.abs((h / 60) % 2 - 1))
    local m = v - c

    local r, g, b
    if h < 60 then
        r, g, b = c, x, 0
    elseif h < 120 then
        r, g, b = x, c, 0
    elseif h < 180 then
        r, g, b = 0, c, x
    elseif h < 240 then
        r, g, b = 0, x, c
    elseif h < 300 then
        r, g, b = x, 0, c
    else
        r, g, b = c, 0, x
    end

    return math.floor((r + m) * 255),
           math.floor((g + m) * 255),
           math.floor((b + m) * 255)
end

return app
```

---

## Phase 2.4: System Apps in Native C++ (Week 12-16)

### Native Launcher App

**Implementation**:

```cpp
// src/apps/launcher/launcher_app.cpp

namespace tildagon::apps {

class LauncherApp : public app::App {
public:
    LauncherApp() {
        discover_apps();

        // Subscribe to input events
        auto& bus = System::instance().events();
        subscription_ = bus.subscribe<events::ButtonEvent>(
            [this](const events::ButtonEvent& e) {
                handle_button(e);
            });
    }

    ~LauncherApp() override {
        System::instance().events().unsubscribe(subscription_);
    }

    void on_enter() override {
        selected_index_ = 0;
    }

    void update(float delta_time) override {
        // Animate selection
        animation_time_ += delta_time;
    }

    void draw(graphics::Context& ctx) override {
        // Draw background
        ctx.fill_rect(-120, -120, 240, 240, graphics::Color::Black());

        // Draw title
        ctx.draw_text(-60, -100, "Tildagon", graphics::Color::White(), 24);

        // Draw app list
        int y = -50;
        for (size_t i = 0; i < apps_.size(); ++i) {
            auto color = (i == selected_index_) ?
                graphics::Color::Green() : graphics::Color::White();

            // Highlight selected with arrow
            if (i == selected_index_) {
                ctx.draw_text(-90, y, ">", color, 20);
            }

            ctx.draw_text(-70, y, apps_[i].name.c_str(), color, 16);
            y += 25;
        }

        // Draw footer
        ctx.draw_text(-100, 100, "A: Select  B: Cancel",
                     graphics::Color(128, 128, 128), 10);
    }

    const char* name() const override { return "Launcher"; }

private:
    struct AppInfo {
        std::string name;
        std::string path;
        bool is_native;
    };

    std::vector<AppInfo> apps_;
    size_t selected_index_ = 0;
    float animation_time_ = 0.0f;
    uint32_t subscription_;

    void discover_apps() {
        // Scan /apps directory for Lua scripts
        // ... filesystem iteration ...

        apps_.push_back({"Rainbow LEDs", "/apps/rainbow/app.lua", false});
        apps_.push_back({"Counter", "/apps/counter/app.lua", false});
        // ... more apps ...
    }

    void handle_button(const events::ButtonEvent& event) {
        if (event.type != events::ButtonEvent::Type::Down) return;

        switch (event.button) {
            case events::ButtonEvent::Button::A:
                // Launch selected app
                launch_app(apps_[selected_index_]);
                break;

            case events::ButtonEvent::Button::C:
                // Move selection up
                if (selected_index_ > 0) selected_index_--;
                break;

            case events::ButtonEvent::Button::D:
                // Move selection down
                if (selected_index_ < apps_.size() - 1) selected_index_++;
                break;

            default:
                break;
        }
    }

    void launch_app(const AppInfo& info) {
        auto& scheduler = System::instance().scheduler();

        if (info.is_native) {
            // Load native app
            // ... dynamic library loading ...
        } else {
            // Load Lua app
            auto app = std::make_unique<script::LuaApp>(info.path.c_str());
            scheduler.push(std::move(app));
        }
    }
};

} // namespace tildagon::apps
```

---

## Expected Results: Hybrid Native + Lua

| Metric | MicroPython | Hybrid | Improvement |
|--------|-------------|--------|-------------|
| **Boot Time** | 3.0s | 0.8s | 3.8x faster |
| **System RAM** | 300KB | 150KB | 50% reduction |
| **Flash Size** | 2.4MB | 1.2MB | 50% reduction |
| **LED Update** | 1000us | 50us | 20x faster |
| **UI Render** | 50ms | 15ms | 3.3x faster |
| **Event Dispatch** | 80us | 10us | 8x faster |
| **App Load Time** | 500ms | 100ms | 5x faster |

**Flexibility Trade-off**:
- System services: Native C++ (maximum performance)
- User apps: Lua (easy development, good performance)
- Best of both worlds!

---

# Approach 3: FreeRTOS + Native C++

## Overview

**Goal**: Maximum performance, full native implementation, no scripting layer.

**Timeline**: 3-6 months

**Risk Level**: Medium

**Investment**: $100,000-$200,000

---

## Key Differences from Hybrid Approach

1. **No Scripting**: All apps written in C++
2. **Faster**: No interpreter overhead
3. **More Memory**: No VM to run
4. **Harder Development**: C++ required for all apps
5. **Longer Compile**: Full recompile for app changes

---

## Architecture

**Same as Hybrid approach**, but remove LuaEngine component.

---

## Example Native App

```cpp
// apps/flashlight/flashlight_app.cpp

namespace tildagon::apps {

class FlashlightApp : public app::App {
public:
    FlashlightApp() {
        auto& bus = System::instance().events();
        subscription_ = bus.subscribe<events::ButtonEvent>(
            [this](const events::ButtonEvent& e) {
                if (e.type == events::ButtonEvent::Type::Down) {
                    on_ = !on_;
                    update_leds();
                }
            });
    }

    ~FlashlightApp() override {
        System::instance().events().unsubscribe(subscription_);
        // Turn off LEDs
        auto& leds = System::instance().leds();
        leds.clear();
        leds.show();
    }

    void update(float delta_time) override {
        // Nothing to update
    }

    void draw(graphics::Context& ctx) override {
        auto bg = on_ ? graphics::Color::White() : graphics::Color::Black();
        auto fg = on_ ? graphics::Color::Black() : graphics::Color::White();

        ctx.fill_rect(-120, -120, 240, 240, bg);

        const char* text = on_ ? "ON" : "OFF";
        ctx.draw_text(-20, -10, text, fg, 48);

        ctx.draw_text(-80, 100, "Press any button", fg, 12);
    }

    const char* name() const override { return "Flashlight"; }

private:
    bool on_ = false;
    uint32_t subscription_;

    void update_leds() {
        auto& leds = System::instance().leds();

        if (on_) {
            leds.fill(255, 255, 255);
        } else {
            leds.clear();
        }

        leds.show();
    }
};

} // namespace tildagon::apps

// App registration
extern "C" {
    tildagon::app::App* create_flashlight_app() {
        return new tildagon::apps::FlashlightApp();
    }
}
```

---

## Expected Results: Native C++

| Metric | MicroPython | Native C++ | Improvement |
|--------|-------------|------------|-------------|
| **Boot Time** | 3.0s | 0.5s | 6x faster |
| **System RAM** | 300KB | 100KB | 67% reduction |
| **Flash Size** | 2.4MB | 800KB | 67% reduction |
| **LED Update** | 1000us | 30us | 33x faster |
| **UI Render** | 50ms | 10ms | 5x faster |
| **Event Dispatch** | 80us | 5us | 16x faster |
| **App Load Time** | 500ms | 50ms | 10x faster |

---

# Performance Optimization Techniques

## General Optimizations (All Approaches)

### 1. Compiler Optimization Flags

```cmake
# CMakeLists.txt

# Release build with aggressive optimization
set(CMAKE_CXX_FLAGS_RELEASE "-O3 -flto -ffast-math -march=native")

# Size optimization (if flash constrained)
# set(CMAKE_CXX_FLAGS_RELEASE "-Os -flto")

# Enable link-time optimization
set(CMAKE_INTERPROCEDURAL_OPTIMIZATION TRUE)
```

### 2. Memory Alignment

```cpp
// Align frequently accessed structures to cache lines
struct alignas(64) DisplayBuffer {
    uint16_t pixels[240 * 240];
};

// Use packed structures to save RAM
struct __attribute__((packed)) HexpansionHeader {
    uint16_t magic;
    uint8_t version;
    char name[16];
};
```

### 3. Inline Critical Functions

```cpp
// Force inline for hot path functions
__attribute__((always_inline)) inline
void set_pixel(int x, int y, uint16_t color) {
    framebuffer[y * 240 + x] = color;
}
```

### 4. Use constexpr for Compile-Time Computation

```cpp
// Compute at compile time
constexpr uint16_t rgb565(uint8_t r, uint8_t g, uint8_t b) {
    return ((r & 0xF8) << 8) | ((g & 0xFC) << 3) | (b >> 3);
}

// Usage: compiled to constant
uint16_t red = rgb565(255, 0, 0);  // Becomes: uint16_t red = 0xF800;
```

### 5. DMA for Display Updates

```c
// Use DMA for SPI transfers (non-blocking)
void display_flush_dma(uint16_t* buffer, size_t length) {
    spi_transaction_t trans = {
        .length = length * 16,  // bits
        .tx_buffer = buffer,
        .flags = SPI_TRANS_USE_TXDATA
    };

    spi_device_queue_trans(spi_device, &trans, portMAX_DELAY);
    // Returns immediately, transfer happens in background
}
```

---

# Migration Strategies

## Strategy 1: Gradual Migration (Recommended)

**Phase 1**: Deploy optimized MicroPython
- Users continue using existing apps
- Gain immediate performance improvements
- Low risk

**Phase 2**: Introduce native platform
- Announce new platform
- Provide migration tools
- Run both stacks side-by-side (dual boot)

**Phase 3**: Port popular apps
- Work with community to port apps
- Provide porting guides and examples
- Incentivize early adopters

**Phase 4**: Deprecate MicroPython
- Set sunset date (6-12 months out)
- Final push for remaining apps
- Eventually remove MicroPython support

---

## Strategy 2: Compatibility Layer

**Concept**: Provide Python API compatibility on native platform

```cpp
// Python-compatible API in C++
namespace python_compat {

class Display {
public:
    static void fill_rect(int x, int y, int w, int h,
                         int r, int g, int b) {
        auto& ctx = System::instance().display().context();
        ctx.fill_rect(x, y, w, h, graphics::Color(r, g, b));
    }

    static void text(const char* str, int x, int y) {
        auto& ctx = System::instance().display().context();
        ctx.draw_text(x, y, str, graphics::Color::White());
    }
};

// Register Python-like global functions
void register_python_compat_api(lua_State* L) {
    // Lua can call these with Python-like syntax
    // display.fill_rect(0, 0, 240, 240, 255, 0, 0)
}

} // namespace python_compat
```

---

# Testing & Validation

## Unit Testing

```cpp
// test/test_event_bus.cpp

#include <catch2/catch.hpp>
#include "tildagon/events/event_bus.hpp"

TEST_CASE("EventBus dispatches events", "[events]") {
    tildagon::events::EventBus bus;

    bool called = false;
    auto sub = bus.subscribe<tildagon::events::ButtonEvent>(
        [&called](const auto& e) {
            called = true;
        });

    bus.emit(tildagon::events::ButtonEvent(
        tildagon::events::ButtonEvent::Button::A,
        tildagon::events::ButtonEvent::Type::Down));

    REQUIRE(called == true);
}
```

## Integration Testing

```cpp
// test/test_app_lifecycle.cpp

TEST_CASE("App lifecycle", "[app]") {
    tildagon::app::AppScheduler scheduler;

    auto app = std::make_unique<MockApp>();
    auto* app_ptr = app.get();

    scheduler.push(std::move(app));

    // App should be foreground
    REQUIRE(scheduler.foreground() == app_ptr);

    // Pop app
    scheduler.pop();
    REQUIRE(scheduler.foreground() == nullptr);
}
```

## Hardware-in-Loop Testing

```python
# test/hil_test.py
# Automated testing on real hardware

import serial
import time

def test_led_pattern():
    """Test LED pattern updates"""
    ser = serial.Serial('/dev/ttyUSB0', 115200)

    # Send command to start rainbow pattern
    ser.write(b'pattern rainbow\n')
    time.sleep(1)

    # Read LED state
    ser.write(b'led dump\n')
    response = ser.readline()

    # Verify LEDs are updating
    assert 'rainbow' in response.decode()
```

---

# Deployment & Rollout

## Phase 1: Beta Testing

1. **Internal Testing** (1 month)
   - Core team tests on dev badges
   - Fix critical bugs
   - Validate performance metrics

2. **Community Beta** (1 month)
   - Release to volunteers
   - Gather feedback
   - Fix bugs

3. **Public Beta** (1 month)
   - Opt-in OTA update
   - Monitor crash reports
   - Iterate based on feedback

## Phase 2: General Availability

1. **Announce GA**
   - Blog post with feature highlights
   - Migration guide
   - Video tutorials

2. **OTA Rollout**
   - Gradual rollout (10% → 50% → 100%)
   - Monitor for issues
   - Rollback capability

3. **Support**
   - Forum support
   - FAQ documentation
   - Known issues tracker

---

# Conclusion

All three approaches are technically feasible with varying trade-offs:

1. **Optimized MicroPython**: Best first step - low risk, meaningful gains
2. **Hybrid Native + Lua**: Best balance - performance + flexibility
3. **Native C++**: Maximum performance - requires C++ expertise

**Recommended Path**:
1. Start with MicroPython optimizations (validate techniques)
2. Prototype Hybrid approach (prove concept)
3. Deploy Hybrid as primary platform (production)
4. Native C++ available as option for demanding apps

This phased approach minimizes risk while delivering continuous improvements to the badge platform.

---

**Document Version**: 1.0
**Last Updated**: 2025-11-27
**Target Platform**: Tildagon Badge (ESP32-S3)
