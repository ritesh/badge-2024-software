# Tildagon Badge Firmware - Comprehensive Technical Documentation

## Table of Contents
1. [Project Overview](#project-overview)
2. [Hardware Platform](#hardware-platform)
3. [Build System](#build-system)
4. [Core Architecture](#core-architecture)
5. [Key Features & Functionality](#key-features--functionality)
6. [Code Organization](#code-organization)
7. [Dependencies & Libraries](#dependencies--libraries)
8. [Configuration & Customization](#configuration--customization)
9. [Flashing & OTA Updates](#flashing--ota-updates)
10. [Development Workflow](#development-workflow)
11. [System Initialization](#system-initialization-sequence)
12. [Performance Characteristics](#performance-characteristics)
13. [Design Patterns](#notable-design-patterns)

---

## Project Overview

**Project Name**: Tildagon Firmware
**Organization**: Electromagnetic Field (EMF Camp 2024)
**Purpose**: Interactive conference badge firmware with display, sensors, networking, and expansion capabilities
**Repository**: emfcamp/badge-2024-software
**Build Status**: [![Build Micropython](https://github.com/emfcamp/badge-2024-software/actions/workflows/build.yml)](https://github.com/emfcamp/badge-2024-software/actions/workflows/build.yml)

### Main Directory Structure

```
badge-2024-software/
├── components/         # ESP-IDF components (graphics, sensors, board support)
├── drivers/           # Custom C drivers for badge hardware
├── modules/           # Python firmware code (apps, system services, libraries)
├── micropython/       # MicroPython submodule (Git submodule)
├── tildagon/          # Board definition and configuration
├── scripts/           # Build and utility scripts
├── flasher/           # Web-based firmware flasher
├── sim/               # Python simulator for development
└── patches/           # Git patches for vendored dependencies
```

---

## Hardware Platform

### Microcontroller Specifications

**Processor**: ESP32-S3 (Espressif Systems)
- **RAM**: 384KB internal + SPIRAM support (external PSRAM)
- **Flash**: 8MB (QIO mode at 80MHz)
- **Connectivity**: WiFi 802.11b/g/n, Bluetooth 5.3 BLE
- **Manufacturing**: Compatible with generic WROOM/MINI modules

### Hardware Components

| Component | Model/Type | Interface | GPIO/Details |
|-----------|-----------|-----------|--------------|
| **Display** | GC9A01 | SPI | 240x240 circular LCD |
| **IMU** | BMI270 | I2C | 6-axis (accelerometer + gyroscope) |
| **LEDs** | WS2812B | GPIO21 | 19 addressable NeoPixels |
| **Buttons** | 6 buttons (A-F) | GPIO expander | Custom mapping via AW9523B |
| **Power Management** | BQ25895 | I2C | PMIC with battery charging |
| **USB-C Controller** | FUSB302B | I2C | USB Power Delivery negotiation |
| **I2C Mux** | TCA9548A | I2C | 8-channel multiplexer |
| **GPIO Expanders** | AW9523B (3x) | I2C | Extended GPIO pins |
| **Hexpansion Ports** | 6 ports | I2C + GPIO | Custom expansion headers with EEPROM |

### LED Configuration

- **12 LEDs**: Main ring around display
- **1 LED**: Center LED
- **6 LEDs**: One per hexpansion port

### USB Identifiers

- **Vendor ID**: 0x16D0 (Electromagnetic Field)
- **Product ID**: 0x120E
- **Device String**: "TiLDAGON badge"

### Storage & Expansion

- On-board flash storage (8MB)
- SD/TF card support via hexpansion
- Per-port EEPROM for hexpansion identification
- FAT filesystem support for hexpansion data

---

## Build System

### Build Tools & Environment

**Primary Tools**:
- **ESP-IDF**: v5.2.1 (Espressif IoT Development Framework)
- **Docker**: `ghcr.io/emfcamp/esp_idf:v5.2.1` (recommended build environment)
- **MicroPython**: Custom build with ESP32-S3 support
- **CMake**: Component compilation and configuration
- **mpy-cross**: MicroPython bytecode compiler

### Key Configuration Files

| File | Purpose |
|------|---------|
| `tildagon/mpconfigboard.cmake` | Board-specific MicroPython configuration |
| `tildagon/sdkconfig.board` | ESP32-S3 SDK settings and optimizations |
| `tildagon/manifest.py` | Frozen Python modules specification |
| `tildagon/partitions-tildagon.csv` | Flash partition layout |

### Build Commands

```bash
# Build MicroPython cross-compiler (required first)
make -C mpy-cross

# Build firmware
make BOARD=tildagon USER_C_MODULES=/firmware/drivers/micropython.cmake

# Docker build (recommended)
docker run -it --rm -e TARGET=esp32s3 \
  -v $(pwd):/firmware \
  ghcr.io/emfcamp/esp_idf:v5.2.1

# Docker build and flash
docker run -it --rm --device /dev/ttyACM0:/dev/ttyUSB0 \
  -e TARGET=esp32s3 -v $(pwd):/firmware \
  ghcr.io/emfcamp/esp_idf:v5.2.1 deploy
```

### Compiled Components

**C/C++ Components** (compiled into firmware):

- **ctx**: Graphics rendering library (~2.5MB with embedded fonts)
- **st3m**: System graphics and utilities (from flow3r project)
- **flow3r_bsp**: Board support package (GC9A01 display driver)
- **flow3r_bmi270**: BMI270 IMU sensor driver
- **tildagon**: Badge-specific drivers (power, USB, I2C, GPIO, OTA)

### Build Optimizations

- Size optimization enabled
- Instruction cache: 32KB
- Data cache: 64KB
- Debug assertions: Silent mode
- Bootloader app rollback: Enabled
- Partition rollback: Supported

### Flash Partition Layout

```
Type      | Offset    | Size    | Label      | Purpose
----------|-----------|---------|------------|---------------------------
nvs       | 0x9000    | 16KB    | nvs        | Non-volatile storage
otadata   | 0xd000    | 8KB     | otadata    | OTA metadata
phy_init  | 0xf000    | 4KB     | phy_init   | PHY calibration data
app       | 0x10000   | 2.4MB   | ota_0      | OTA partition A (primary)
app       | 0x280000  | 2.4MB   | ota_1      | OTA partition B (rollback)
fat       | 0x4f0000  | 3.1MB   | vfs        | FAT filesystem (user data)
```

---

## Core Architecture

### Firmware Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│         Python Applications & Firmware Apps             │
│  (Launcher, Patterns, OTA, Power, Custom User Apps)     │
├─────────────────────────────────────────────────────────┤
│          Async App Scheduler & Event Bus                │
│      (AsyncIO-based task coordination & dispatch)       │
├─────────────────────────────────────────────────────────┤
│      System Modules (Hexpansion, Power, OTA, LEDs)      │
│          Notifications, Settings, Patterns              │
├─────────────────────────────────────────────────────────┤
│    MicroPython Core (AsyncIO, Networking, Bluetooth)    │
├─────────────────────────────────────────────────────────┤
│   C Drivers (Display, IMU, Power, GPIO, USB, I2C Mux)   │
├─────────────────────────────────────────────────────────┤
│      ESP-IDF & FreeRTOS Hardware Abstraction Layer      │
└─────────────────────────────────────────────────────────┘
```

### RTOS Foundation

**Operating System**: FreeRTOS (provided by ESP-IDF)
- Pre-emptive multitasking
- Hardware abstraction
- Peripheral drivers
- Network stack

### Application Model

**Paradigm**: Asynchronous event-driven architecture
- All apps run as async coroutines
- Event bus for inter-app communication
- Cooperative multitasking via AsyncIO
- Focus-based rendering (only foreground app draws)

### Main Loop Flow

1. **Hardware Initialization** (C layer):
   - Initialize I2C multiplexer (TCA9548A)
   - Initialize GPIO expanders (AW9523B)
   - Initialize power management (BQ25895 + FUSB302B)
   - Initialize USB device
   - Initialize IMU (BMI270)
   - Mount filesystems

2. **Python Startup** (`main.py`):
   - Initialize WiFi (non-blocking, retry on failure)
   - Start scheduler
   - Load system apps in order:
     - **TwentyTwentyFour**: Button and hexpansion input handler
     - **HexpansionManagerApp**: Expansion port detection and mounting
     - **PatternDisplay**: LED pattern animation engine
     - **Launcher**: Main menu/app selector (FOREGROUND)
     - **NotificationService**: Popup notifications (ALWAYS ON TOP)
     - **PowerManager**: Battery and power monitoring

3. **Scheduler Event Loop**:
   - Maintains foreground app stack
   - Runs always-on-top overlays
   - Executes background tasks for all apps
   - Coordinates render updates
   - Handles app lifecycle events
   - Dispatches input events

### Event System

**Global Event Bus**:
- Central event dispatcher
- Async and sync handler support
- Per-app event subscriptions
- Focus-aware event filtering
- Built-in event types:
  - `ButtonDownEvent`, `ButtonUpEvent`
  - `HexpansionInsertionEvent`, `HexpansionRemovalEvent`
  - Power events (battery low, USB connected, etc.)
  - Notification events

---

## Key Features & Functionality

### Display & Graphics

**Display Controller**: GC9A01 (SPI interface)
- Resolution: 240x240 pixels
- Shape: Circular
- Color depth: Configurable (1/2/4/8/16/24/32-bit)
- Hardware acceleration: Via ctx graphics library

**Graphics Capabilities**:
- Hardware-accelerated 2D rendering
- Text rendering with bitmap fonts (CampFont1, CampFont2)
- Multi-pixel modes (double/triple/quad pixel)
- On-screen display (OSD) compositing
- Smart redraw tracking to minimize updates
- Alpha blending and compositing

### User Interface System

**Components**:
- Menu system with animated transitions
- Layout components:
  - `LinearLayout`: Vertical/horizontal stacking
  - `TextDisplay`: Scrollable text rendering
  - `Dialogs`: Modal confirmations and alerts
- Settings management (JSON-based persistence)
- Notification system (6 concurrent notification slots)

### Input System

**Button Handling**:
- 6 physical buttons (A, B, C, D, E, F)
- Event dispatching via event bus
- Long-press detection (4-second threshold for hexpansion eject)
- Button state tracking
- Event bubbling to focused app

**Hexpansion Detection**:
- Mechanical "boop" detection on insertion
- EEPROM reading for identification
- Auto-mounting of filesystems
- Hot-plug support with auto-launch capability

### LED System

**LED Hardware**:
- 19 addressable WS2812B LEDs (GPIO21)
- 12 main ring LEDs
- 1 center LED
- 6 hexpansion LEDs (one per port)

**LED Features**:
- Pattern support:
  - Rainbow (animated color wheel)
  - Cylon (bouncing scanner effect)
  - Flash (pulsing brightness)
  - Off (disabled)
  - Custom patterns via pattern engine
- Brightness control (0.0 - 1.0)
- Pattern mirror mode for hexpansions
- 20fps update rate (pattern-dependent)

### Sensor Integration

**IMU (BMI270)**:
- 6-axis motion sensing
- Accelerometer: ±16g range
- Gyroscope: Angular velocity
- Tilt detection (forward, back, left, right)
- Magnitude calculations
- I2C interface
- Interrupt-driven updates

### Hexpansion System

**Expansion Ports**: 6 ports (labeled A-F)

**Per-Port Features**:
- Dedicated I2C bus (via TCA9548A mux)
- GPIO pins (high-speed and low-speed)
- EEPROM header reading (identification)
- Filesystem mounting (FAT blocks)
- Auto-detection on insertion
- Hot-plug support
- Auto-launch of associated apps

**Hexpansion Lifecycle**:
1. User inserts hexpansion
2. Mechanical detection ("boop")
3. Read EEPROM header
4. Mount filesystem if present
5. Dispatch insertion event
6. Auto-launch app if configured
7. On removal: Unmount, dispatch removal event

### Networking

**WiFi**:
- 802.11 b/g/n support
- Auto-retry on connection failure
- Background connection (non-blocking startup)

**Network Services**:
- NTP time synchronization
- MQTT client (simple + robust variants)
- HTTP/HTTPS requests library
- OTA firmware updates via HTTPS
- ESP-NOW protocol support

**Bluetooth**:
- Bluetooth 5.3 BLE
- AsyncIO-based BLE library (aioble)

### Power Management

**Battery Monitoring**:
- Real-time voltage monitoring via BQ25895 PMIC
- USB input voltage monitoring
- Automatic shutdown at low battery (<3.5V)
- 10-second polling interval
- Battery percentage estimation

**Power Control**:
- USB-C Power Delivery negotiation (FUSB302B)
- 5V supply control
- Power event system:
  - Battery low warning
  - USB connected/disconnected
  - Charging status

### OTA (Over-The-Air) Updates

**Update Process**:
1. User initiates update check
2. HTTPS connection to GitHub releases
3. Version comparison (current vs. available)
4. Power check (adequate battery/USB)
5. Download firmware to inactive partition
6. Signature verification (certificate bundle)
7. Set boot partition
8. Reboot to new firmware
9. Bootloader fallback on CRC failure

**Update Channels**:
- `latest`: Stable releases
- Custom branches available

**Security**:
- HTTPS with certificate validation
- Firmware signature verification
- Bootloader rollback on boot failure
- CRC integrity checking

### Application Store

**App Management**:
- User apps in `/apps` directory
- Dynamic discovery and loading
- Per-app metadata (version, description, icon)
- App lifecycle management
- Installation/removal support

---

## Code Organization

### Python Firmware (`modules/`)

```
modules/
├── main.py                    # Entry point, system initialization
├── app.py                     # Base App class (async event-driven)
│
├── system/                    # Core system services
│   ├── scheduler/             # App task scheduler
│   ├── eventbus.py            # Global event dispatcher
│   ├── launcher/              # Main app menu UI
│   ├── hexpansion/            # Expansion port manager
│   ├── patterndisplay/        # LED pattern animation
│   ├── power/                 # Power management
│   ├── notification/          # Notification overlay
│   ├── ota/                   # OTA update UI/logic
│   └── backgrounds/           # Background patterns
│
├── app_components/            # Reusable UI components
│   ├── menu.py                # Menu widget
│   ├── dialog.py              # Dialog boxes
│   ├── layout.py              # Layout containers
│   └── tokens.py              # Design tokens
│
├── events/                    # Event class definitions
│   ├── input.py               # Button events
│   └── hexpansion.py          # Hexpansion events
│
├── frontboards/               # Hardware interface layer
│   └── twentytwentyfour.py    # TwentyTwentyFour badge
│
├── firmware_apps/             # Built-in applications
│
├── lib/                       # Utility libraries
│   ├── simple_tildagon.py     # Easy-to-use API
│   ├── bdevice.py             # Block device abstraction
│   ├── eeprom_i2c.py          # EEPROM drivers
│   └── shutil.py              # File utilities
│
├── patterns/                  # LED animation patterns
│   ├── rainbow.py
│   ├── cylon.py
│   ├── flash.py
│   └── off.py
│
└── tildagon/                  # Hardware pin mapping
    └── pin_config.py
```

### C Drivers (`drivers/`)

```
drivers/
├── tildagon/                  # Main badge driver module
│   ├── tildagon.c             # Module initialization
│   └── micropython.cmake      # Build configuration
│
├── tildagon_power/            # Power management
│   ├── tildagon_power.c       # BQ25895 PMIC driver
│   └── fusb302b.c             # USB-C PD controller
│
├── tildagon_i2c/              # I2C subsystem
│   └── tildagon_i2c.c         # TCA9548A mux driver
│
├── tildagon_pin/              # GPIO management
│   └── tildagon_pin.c         # AW9523B expander driver
│
├── tildagon_usb/              # USB device
│   └── tildagon_usb.c         # TinyUSB initialization
│
├── tildagon_helpers/          # Utility functions
│   └── tildagon_helpers.c     # IMU and helpers
│
├── tildagon_hmac/             # Cryptography
│   └── tildagon_hmac.c        # HMAC operations
│
├── gc9a01/                    # Display driver
│   └── gc9a01.c               # GC9A01 controller
│
└── ota/                       # OTA update
    └── ota.c                  # HTTPS OTA mechanism
```

### ESP-IDF Components (`components/`)

```
components/
├── ctx/                       # Graphics rendering library
│   └── ctx.h                  # 2D graphics API (~2.5MB with fonts)
│
├── st3m/                      # System utilities
│   ├── st3m_gfx.c             # Graphics helpers
│   ├── st3m_imu.c             # IMU interface
│   └── st3m_counter.c         # Performance counters
│
├── flow3r_bsp/                # Board support package
│   ├── gc9a01_display.c       # Display initialization
│   └── imu_bmi270.c           # IMU board integration
│
├── flow3r_bmi270/             # BMI270 sensor driver
│   └── bmi270.c               # Bosch BMI270 driver
│
└── tildagon/                  # Minimal wrapper
    └── board_init.c           # Board initialization
```

---

## Dependencies & Libraries

### MicroPython Frozen Modules

**Core Async Libraries**:
- `asyncio`: Async/await support and event loop
- `aioble`: Bluetooth BLE for asyncio
- `aiorepl`: Async REPL
- `aioespnow`: ESP-NOW protocol

**Hardware & Peripherals**:
- `neopixel`: WS2812B LED control
- `machine`: Hardware access
- `esp32`: ESP32-specific features

**Networking**:
- `requests`: HTTP client library
- `ntptime`: NTP time synchronization
- `umqtt.simple`: Simple MQTT client
- `umqtt.robust`: Robust MQTT with auto-reconnect

**Utilities**:
- `mip`: MicroPython package manager
- `gzip`: Compression support
- `tarfile`: Archive extraction

### Custom Python Libraries

| Library | Purpose |
|---------|---------|
| `simple_tildagon.py` | High-level API (LED, buttons, IMU, display) |
| `bdevice.py` | Block device abstraction for storage |
| `eeprom_i2c.py` | I2C EEPROM driver |
| `eep_i2c.py` | Alternative EEPROM implementation |
| `flash_spi.py` | SPI flash support |
| `shutil.py` | File utilities (copy, move, etc.) |
| `typing.py` | Type hints for development |

### ESP-IDF Dependencies

- **espressif/nghttp**: HTTP/2 client library
- **ESP32-S3 HAL**: Peripheral drivers (SPI, I2C, GPIO, etc.)
- **TinyUSB**: USB device stack
- **Partition API**: Flash partition management
- **NVS**: Non-volatile storage
- **WiFi/BLE**: Network protocol stacks

---

## Configuration & Customization

### Settings System

**Implementation**: `modules/settings.py`
- JSON-based persistent configuration
- Runtime key-value get/set with defaults
- Auto-save on modification
- Storage location: `/settings.json` on FAT filesystem

**API**:
```python
from settings import SettingsConfig

# Get setting with default
pattern = SettingsConfig.get("pattern", "rainbow")

# Set setting (auto-saves)
SettingsConfig.set("pattern_brightness", 0.5)
```

### Configurable Settings

```python
{
  "pattern": "rainbow",                    # LED pattern name
  "pattern_brightness": 0.1,               # LED brightness (0.0-1.0)
  "pattern_generator_enabled": true,       # Enable pattern generation
  "pattern_mirror_hexpansions": false,     # Mirror pattern to hexpansion LEDs
  "update_channel": "latest"               # OTA update channel
}
```

### Hardware Configuration

**Hexpansion Pin Mapping** (`modules/tildagon/pin_config.py`):

Each of 6 hexpansion ports has:
- High-speed pins (direct ESP32 GPIO)
- Low-speed GPIO (via AW9523B expanders)
- Dedicated I2C bus (via TCA9548A channel)

**Example Port Configuration**:
```python
HEXPANSION_CONFIG = {
    1: {
        "ls_gpio": [0, 1, 2, 3],           # Low-speed GPIO pins
        "hs_gpio": [4, 5],                 # High-speed GPIO pins
        "i2c_channel": 0,                  # TCA9548A channel
    },
    # ... ports 2-6
}
```

### Board Build Configuration

**File**: `tildagon/mpconfigboard.cmake`

Key settings:
- IDF_TARGET: esp32s3
- Components: ctx, st3m, flow3r_bmi270, flow3r_bsp, tildagon
- SDK config: `sdkconfig.board`
- Git version generation

**SDK Configuration** (`tildagon/sdkconfig.board`):
- Flash size: 8MB
- Flash mode: QIO
- Flash frequency: 80MHz
- PSRAM: Enabled
- Optimization: Size (-Os)
- Instruction cache: 32KB
- Data cache: 64KB

---

## Flashing & OTA Updates

### Method 1: Web Flasher (Recommended)

**URL**: https://emfcamp.github.io/badge-2024-software/

**Requirements**:
- Modern browser with WebUSB support (Chrome, Edge, Opera)
- USB connection to badge

**Process**:
1. Visit web flasher URL
2. Connect badge via USB-C
3. Click "Connect"
4. Select firmware version
5. Click "Flash"
6. Wait for completion

**Advantages**:
- Cross-platform (macOS, Linux, Windows)
- No local toolchain required
- Automatic firmware merging
- User-friendly interface

### Method 2: Docker Build & Flash

**Build Only**:
```bash
docker run -it --rm \
  -e TARGET=esp32s3 \
  -v $(pwd):/firmware \
  ghcr.io/emfcamp/esp_idf:v5.2.1
```

**Build and Flash**:
```bash
docker run -it --rm \
  --device /dev/ttyACM0:/dev/ttyUSB0 \
  -e TARGET=esp32s3 \
  -v $(pwd):/firmware \
  ghcr.io/emfcamp/esp_idf:v5.2.1 deploy
```

**Note**: Adjust `/dev/ttyACM0` to match your badge's serial port.

### Method 3: mpremote (Python REPL)

**For development iteration**:
```bash
# Reset badge
./micropython/tools/mpremote/mpremote.py reset
sleep 3

# Mount local modules/ directory and run
./micropython/tools/mpremote/mpremote.py mount modules
import main
```

**Advantages**:
- Fast iteration on Python code
- No flashing required
- Direct REPL access

### OTA Update Process

**User Flow**:
1. Navigate to Settings → OTA Update
2. Badge checks for updates via HTTPS
3. Display available version
4. User confirms update
5. Download to inactive partition
6. Verify and reboot

**Technical Flow**:
```
User initiates update
↓
Check battery/USB power (BQ25895)
↓
HTTPS GET to GitHub releases API
↓
Compare versions (current vs. available)
↓
Download firmware to inactive OTA partition
↓
Verify signature with certificate bundle
↓
CRC check
↓
Set boot partition (otadata)
↓
Reboot
↓
Bootloader selects new partition
↓
On failure: Rollback to previous partition
```

**Update Channels**:
- `latest`: Stable production releases
- Custom branches: Developer/beta builds

**Security Measures**:
- HTTPS with certificate validation
- Firmware signature verification
- CRC integrity checking
- Automatic rollback on boot failure
- Dual partition safety (ota_0, ota_1)

### Build Artifacts

After build, the following files are generated:

```
build-tildagon/
├── micropython.bin                      # Main application firmware
├── bootloader/bootloader.bin            # Second-stage bootloader
├── partition_table/partition-table.bin  # Partition layout
├── ota_data_initial.bin                 # OTA metadata
└── tildagon.txt                         # Build metadata (git version)
```

**Merged Firmware** (for web flasher):
- All partitions combined into single binary
- Includes bootloader, partition table, and app
- Generated by `scripts/merge-firmwares.sh`

---

## Development Workflow

### Initial Setup

```bash
# Clone repository with submodules
git clone --recursive https://github.com/emfcamp/badge-2024-software.git
cd badge-2024-software

# Install pre-commit hooks
python3 -m pip install pre-commit
pre-commit install

# First-time setup (apply patches to submodules)
./scripts/firstTime.sh

# Pull Docker build environment
docker pull ghcr.io/emfcamp/esp_idf:v5.2.1

# OR build Docker image locally
docker build . -t ghcr.io/emfcamp/esp_idf:v5.2.1
```

### Development Options

#### Option 1: Simulator (Fast Iteration)

**Purpose**: Rapid Python development without hardware

```bash
cd sim
pipenv install
pipenv run python run.py
```

**Advantages**:
- Instant feedback
- No flashing required
- Visual debugging
- Python-only (no C driver support)

#### Option 2: mpremote (Hardware Testing)

**Purpose**: Test on real hardware without flashing

```bash
# Connect via USB and mount local code
./micropython/tools/mpremote/mpremote.py mount modules

# Run REPL with access to local files
./micropython/tools/mpremote/mpremote.py repl
>>> import main
```

**Advantages**:
- Real hardware testing
- Fast iteration
- Direct REPL access
- No flash wear

#### Option 3: Full Build & Flash

**Purpose**: Production builds and C driver changes

```bash
# Build firmware
docker run -it --rm -e TARGET=esp32s3 \
  -v $(pwd):/firmware \
  ghcr.io/emfcamp/esp_idf:v5.2.1

# Flash to badge
docker run -it --rm --device /dev/ttyACM0:/dev/ttyUSB0 \
  -e TARGET=esp32s3 -v $(pwd):/firmware \
  ghcr.io/emfcamp/esp_idf:v5.2.1 deploy
```

### Development Scripts

| Script | Purpose |
|--------|---------|
| `scripts/build.sh` | Docker entrypoint for builds |
| `scripts/firstTime.sh` | Apply patches to submodules |
| `scripts/merge-firmwares.sh` | Create merged binary for web flasher |
| `flasher/` | Web-based firmware flasher (HTML/JS) |
| `sim/` | Python-based badge simulator |

### Code Quality & CI

**Pre-commit Hooks** (`.pre-commit-config.yaml`):
- Runs `ruff` formatter/linter on Python code
- Enforces code style consistency
- Automatic on commit

**Continuous Integration** (`.github/workflows/build.yml`):

**Triggers**:
- Pull requests to main
- Tags matching `v*`
- Manual workflow dispatch

**Build Process**:
1. Checkout repository with submodules
2. Install dependencies (build-essential, python3-pip, cmake, libusb)
3. Apply patches to submodules
4. Build MicroPython cross-compiler
5. Build firmware for tildagon board
6. Create merged firmware binary
7. Upload artifacts
8. Create GitHub release (for version tags)

**Artifacts**:
- Firmware binaries
- Build metadata
- Merged flasher binary

### Git Workflow

**Branch Strategy**:
- `main`: Stable production code
- Feature branches: `feature/description`
- Current development branch: `claude/document-and-analyze-01EF8Khf1ZEArEPXkpuXWQ29`

**Submodules**:
- `micropython`: Main MicroPython repository
- Components: flow3r-specific components

**Patches**:
- `patches/micropython.diff`: MicroPython customizations
- `patches/micropython-lib.diff`: Library modifications
- Applied via `scripts/firstTime.sh`

### Application Development

#### Creating a New App

1. **Create app directory**:
```bash
mkdir modules/apps/my_app
```

2. **Create app.py**:
```python
from app import App
from system.eventbus import eventbus
from events.input import ButtonDownEvent, BUTTON_TYPES

class MyApp(App):
    def __init__(self):
        super().__init__()
        # Subscribe to events
        eventbus.on(ButtonDownEvent, self.handle_button, self)

    def handle_button(self, event: ButtonDownEvent):
        if event.button == BUTTON_TYPES["CANCEL"]:
            # Return to launcher
            self.minimise()

    async def run(self, render_update):
        # Main app loop
        while True:
            # Trigger redraw
            await render_update()

    def draw(self, ctx):
        # Render to display
        ctx.rgb(1, 0, 0)  # Red
        ctx.rectangle(-120, -120, 240, 240).fill()

        ctx.rgb(1, 1, 1)  # White text
        ctx.move_to(-50, 0)
        ctx.text("Hello World")

# Export app class
__app_export__ = MyApp
```

3. **Optional metadata.json**:
```json
{
    "name": "My App",
    "version": "1.0.0",
    "description": "An example app",
    "author": "Your Name"
}
```

#### App Lifecycle

**Methods**:
- `__init__()`: Constructor, set up event handlers
- `run(render_update)`: Async main loop, call `await render_update()` to trigger draw
- `draw(ctx)`: Render to display (called when render_update triggered)
- `background_task()`: Optional async task that runs even when app is backgrounded
- `on_enter()`: Called when app becomes foreground
- `on_exit()`: Called when app loses focus

**Common Patterns**:
```python
# Minimize to background (return to launcher)
self.minimise()

# Draw graphics
def draw(self, ctx):
    ctx.rgb(r, g, b)  # Set color (0.0-1.0)
    ctx.rectangle(x, y, w, h).fill()
    ctx.move_to(x, y)
    ctx.text("Hello")

# Handle button press
from events.input import ButtonDownEvent, BUTTON_TYPES
eventbus.on(ButtonDownEvent, self.handle_button, self)

def handle_button(self, event):
    if event.button == BUTTON_TYPES["CONFIRM"]:
        # Handle confirm button
        pass
```

#### Using simple_tildagon Library

**Simplified API for common tasks**:

```python
from lib.simple_tildagon import tildagon

# LEDs
tildagon.leds[0] = (255, 0, 0)  # Red
tildagon.leds.write()

# Buttons
if tildagon.buttons.read(tildagon.BUTTON_A):
    print("Button A pressed")

# IMU
accel = tildagon.imu.read_accel()  # (x, y, z)
gyro = tildagon.imu.read_gyro()    # (x, y, z)

# Display (basic)
tildagon.display.fill_rect(0, 0, 240, 240, 0xFF0000)
```

---

## System Initialization Sequence

### Hardware Startup (C Layer)

```
ESP32 Boot ROM
↓
Bootloader (first stage)
↓
Bootloader (second stage) - partition selection
↓
Application boot
↓
board_init.c: tildagon_startup()
├── boardctrl_startup()
│   ├── Mount VFS
│   └── Initialize FAT filesystem
├── tildagon_i2c_init()
│   └── Initialize TCA9548A I2C multiplexer
├── tildagon_pins_init()
│   ├── Initialize AW9523B GPIO expanders (3x)
│   └── Configure button mappings
├── tildagon_power_init()
│   ├── Initialize BQ25895 PMIC
│   └── Initialize FUSB302B USB-C controller
├── tildagon_usb_init()
│   └── Initialize TinyUSB device stack
└── st3m_imu_init()
    └── Initialize BMI270 IMU sensor
↓
MicroPython runtime initialization
↓
Execute boot.py (if present)
↓
Execute main.py
```

### Python Startup Sequence

**File**: `modules/main.py`

```
main.py execution
↓
Import system modules
↓
Initialize WiFi (async, non-blocking)
│ ├── Try to connect
│ └── Retry on failure (background)
↓
Create scheduler instance
↓
Load system apps (in order):
│
├── 1. TwentyTwentyFour
│   ├── Initialize button handlers
│   ├── Initialize hexpansion detection
│   └── Start background task
│
├── 2. HexpansionManagerApp
│   ├── Scan all hexpansion ports
│   ├── Read EEPROM headers
│   ├── Mount filesystems
│   └── Auto-launch apps
│
├── 3. PatternDisplay
│   ├── Load pattern settings
│   ├── Initialize NeoPixel controller
│   └── Start animation loop (20fps)
│
├── 4. Launcher (FOREGROUND)
│   ├── Build app menu
│   ├── Load app icons
│   └── Enter foreground mode
│
├── 5. NotificationService (ALWAYS ON TOP)
│   ├── Create notification pool (6 slots)
│   ├── Register event handlers
│   └── Start notification queue processor
│
└── 6. PowerManager
    ├── Read initial battery voltage
    ├── Register power event handlers
    └── Start monitoring loop (10s interval)
↓
Register shutdown handlers
│ └── Clean shutdown on low battery
↓
Mark app valid (OTA rollback support)
│ └── Confirm boot successful to bootloader
↓
scheduler.run_forever()
└── Infinite async event loop
    ├── Run foreground app
    ├── Run background tasks
    ├── Run always-on-top apps
    ├── Process events
    └── Coordinate rendering
```

### Scheduler Event Loop

```
while True:
    ├── Execute foreground app.run() iteration
    ├── Execute all app.background_task() iterations
    ├── Execute always-on-top overlays
    ├── Process event queue
    ├── Check for render updates
    ├── If render needed:
    │   ├── Clear display buffer
    │   ├── Call foreground app.draw(ctx)
    │   ├── Composite always-on-top overlays
    │   └── Flush buffer to display
    └── await asyncio.sleep(min_delay)
```

---

## Performance Characteristics

### System Performance

| Metric | Value | Notes |
|--------|-------|-------|
| **Display Refresh** | Variable | App-dependent, typically 20-60fps |
| **LED Update Rate** | 20fps | Configurable, pattern-dependent |
| **Button Response** | <10ms | Interrupt-driven via GPIO expanders |
| **IMU Sampling** | 100Hz | Configurable via BMI270 |
| **Power Monitoring** | 0.1Hz | 10-second polling interval |
| **Event Dispatch** | <1ms | Async handler invocation |
| **Boot Time** | ~3s | From power-on to Launcher |

### Memory Usage

| Resource | Size | Purpose |
|----------|------|---------|
| **Internal RAM** | 384KB | Code, stack, small allocations |
| **SPIRAM** | Variable | Heap for large allocations (display buffer, etc.) |
| **Flash** | 8MB total | 2.4MB per OTA slot, 3.1MB user data |
| **Display Buffer** | ~115KB | 240x240x16bit (in SPIRAM) |

### Power Consumption

**Typical Current Draw**:
- **Active (display on)**: ~150-200mA @ 3.7V
- **Idle (display dimmed)**: ~80-100mA @ 3.7V
- **Sleep** (not implemented): N/A

**Battery Life** (typical 500mAh LiPo):
- Active use: 2-3 hours
- Idle: 4-5 hours

### Task Scheduling

- **Minimum sleep**: 50ms (prevents CPU starvation)
- **Async context switches**: <100μs
- **Event propagation**: <1ms
- **Render pipeline**: 10-50ms (scene complexity dependent)

---

## Notable Design Patterns

### 1. App-as-Async-Coroutine

**Pattern**: All apps are async functions that yield control
```python
async def run(self, render_update):
    while True:
        # Do work
        await asyncio.sleep(0.1)
        await render_update()  # Signal redraw needed
```

**Benefits**:
- Cooperative multitasking
- No threading complexity
- Deterministic execution
- Easy event coordination

### 2. Event-Driven Architecture

**Pattern**: Global event bus with typed events
```python
eventbus.on(ButtonDownEvent, self.handler, self)
eventbus.emit(ButtonDownEvent(button=BUTTON_TYPES["CONFIRM"]))
```

**Benefits**:
- Loose coupling between components
- Easy to add new event types
- Focus-aware event filtering
- Supports both sync and async handlers

### 3. Focus-Aware Rendering

**Pattern**: Only foreground app renders, overlays composite on top
```python
# Scheduler decides which app to render
if app.is_foreground:
    app.draw(ctx)
if app.is_always_on_top:
    app.draw_overlay(ctx)
```

**Benefits**:
- Prevents rendering conflicts
- Reduces CPU usage
- Clear visual hierarchy
- Supports modal overlays

### 4. Scheduler Stack

**Pattern**: Apps managed in LIFO stack for foreground, separate overlay layer
```python
scheduler.foreground_stack = [launcher, settings_app]
scheduler.overlays = [notification_service]
```

**Benefits**:
- Natural back-button behavior
- Multiple apps can be "open" (backgrounded)
- System overlays always visible
- Clear app lifecycle

### 5. Resource Pooling

**Pattern**: Pre-allocate expensive objects, reuse
```python
notification_pool = [Notification() for _ in range(6)]
# Reuse from pool instead of creating new
```

**Benefits**:
- Predictable memory usage
- No allocation during critical paths
- Prevents heap fragmentation

### 6. Lazy Module Loading

**Pattern**: Import apps only when needed
```python
apps = discover_apps("/apps")
# Only import when user selects app
app_module = __import__(app_path)
```

**Benefits**:
- Faster boot time
- Lower memory usage
- Only load what's needed

### 7. Hardware Abstraction

**Pattern**: I2C bus multiplexing hides port complexity
```python
# User code doesn't know about mux
i2c = hexpansion.get_i2c(port=3)
i2c.writeto(address, data)
# Scheduler handles mux channel selection
```

**Benefits**:
- Simple API for complex hardware
- Centralized resource management
- Prevents bus conflicts

### 8. Double-Buffered Rendering

**Pattern**: Render to off-screen buffer, flip on completion
```python
# Render to buffer
ctx.begin_frame()
app.draw(ctx)
ctx.end_frame()
# Atomic flip to display
display.flush(buffer)
```

**Benefits**:
- No screen tearing
- Atomic updates
- Clean visual transitions

### 9. State Machine Apps

**Pattern**: Apps manage internal state explicitly
```python
class App:
    def __init__(self):
        self.state = "menu"

    def draw(self, ctx):
        if self.state == "menu":
            self.draw_menu(ctx)
        elif self.state == "game":
            self.draw_game(ctx)
```

**Benefits**:
- Clear state transitions
- Easy to reason about
- Supports complex UIs

### 10. Async Event Handlers

**Pattern**: Events can be handled asynchronously
```python
async def handle_button(self, event):
    await self.animate_transition()
    self.change_state()
```

**Benefits**:
- Non-blocking event processing
- Can perform async I/O in handlers
- Smooth animations and transitions

---

## Appendix: Key File Reference

### Critical Files

| File | Purpose |
|------|---------|
| `modules/main.py` | System entry point |
| `modules/app.py` | Base App class |
| `modules/system/scheduler/scheduler.py` | App scheduler |
| `modules/system/eventbus.py` | Global event bus |
| `tildagon/mpconfigboard.cmake` | Board build configuration |
| `tildagon/sdkconfig.board` | ESP32-S3 SDK settings |
| `tildagon/partitions-tildagon.csv` | Flash partition table |
| `drivers/tildagon/tildagon.c` | Main C driver module |
| `components/tildagon/board_init.c` | Hardware initialization |

### Hardware Interface Files

| File | Hardware |
|------|----------|
| `drivers/tildagon_power/tildagon_power.c` | BQ25895 PMIC, FUSB302B USB-C |
| `drivers/tildagon_i2c/tildagon_i2c.c` | TCA9548A I2C mux |
| `drivers/tildagon_pin/tildagon_pin.c` | AW9523B GPIO expanders |
| `drivers/gc9a01/gc9a01.c` | GC9A01 display controller |
| `components/flow3r_bmi270/bmi270.c` | BMI270 IMU sensor |

---

## Additional Resources

- **Repository**: https://github.com/emfcamp/badge-2024-software
- **Web Flasher**: https://emfcamp.github.io/badge-2024-software/
- **EMF Camp**: https://www.emfcamp.org/
- **MicroPython**: https://micropython.org/
- **ESP-IDF**: https://docs.espressif.com/projects/esp-idf/en/v5.2.1/

---

**Document Version**: 1.0
**Last Updated**: 2025-11-27
**Badge Firmware Version**: Based on latest commit 81983d5
