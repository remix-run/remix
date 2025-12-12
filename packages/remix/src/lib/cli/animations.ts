/**
 * CLI animations for Remix - Music-themed loading indicators
 */

import * as readline from 'node:readline'

/**
 * Spinning vinyl/CD animation frames - simple emoji rotation
 */
const vinylFrames = ['💿', '📀', '💿', '💽']

/**
 * ASCII-only spinner frames for terminals without emoji support
 */
const vinylFramesAscii = ['⠋', '⠙', '⠹', '⠸', '⠼', '⠴', '⠦', '⠧', '⠇', '⠏']

/**
 * Equalizer bar heights for animation
 */
const equalizerFrames = [
  '▁▂▃▅▂▇▅▃',
  '▂▃▅▇▅▃▁▂',
  '▃▅▇▅▃▁▂▃',
  '▅▇▅▃▁▂▃▅',
  '▇▅▃▁▂▃▅▇',
  '▅▃▁▂▃▅▇▅',
  '▃▁▂▃▅▇▅▃',
  '▁▂▃▅▇▅▃▁',
]

/**
 * Bar characters from lowest to highest
 */
const barHeights = ['▁', '▂', '▃', '▄', '▅', '▆', '▇', '█']

/**
 * ANSI color codes for Remix brand
 */
const colors = {
  blue: '\x1b[34m',
  green: '\x1b[32m',
  yellow: '\x1b[33m',
  pink: '\x1b[95m',
  red: '\x1b[31m',
  brightBlue: '\x1b[94m',
  brightGreen: '\x1b[92m',
  brightYellow: '\x1b[93m',
  brightMagenta: '\x1b[95m',
  brightRed: '\x1b[91m',
  reset: '\x1b[0m',
  bold: '\x1b[1m',
}

/**
 * Remix logo ASCII art - stylized "R" in a disc
 */
const remixLogoLines = [
  '    ██████╗ ███████╗███╗   ███╗██╗██╗  ██╗',
  '    ██╔══██╗██╔════╝████╗ ████║██║╚██╗██╔╝',
  '    ██████╔╝█████╗  ██╔████╔██║██║ ╚███╔╝ ',
  '    ██╔══██╗██╔══╝  ██║╚██╔╝██║██║ ██╔██╗ ',
  '    ██║  ██║███████╗██║ ╚═╝ ██║██║██╔╝ ██╗',
  '    ╚═╝  ╚═╝╚══════╝╚═╝     ╚═╝╚═╝╚═╝  ╚═╝',
]

/**
 * Remix logo ASCII art - stylized "R" in a disc
 */
const remixLogoLinesNoShadow = [
  '    ██████  ███████ ███    ███ ██ ██   ██ ',
  '    ██   ██ ██      ████  ████ ██  ██ ██  ',
  '    ██████  █████   ██ ████ ██ ██   ███   ',
  '    ██   ██ ██      ██  ██  ██ ██  ██ ██  ',
  '    ██   ██ ███████ ██      ██ ██ ██   ██ ',
]

const remixLogoLinesNoShadowLowercase = [
  '▗▄▄▖            ▄       ',
  '▐▌ ▐▌▗▞▀▚▖▄▄▄▄  ▄ ▄   ▄ ',
  '▐▛▀▚▖▐▛▀▀▘█ █ █ █  ▀▄▀  ',
  '▐▌ ▐▌▝▚▄▄▖█   █ █ ▄▀ ▀▄ ',
]

// prettier-ignore
const remixOutlineLogoLines = [
  "  _____                _       ",
  " |  __ \\              (_)      ",
  " | |__) | ___ _ __ ___  ___  __ ",
  " |  _  // _ \\ '_ ` _ \\| \\ \\/ / ",
  " | | \\ \\  __/ | | | | | |>  <  ",
  " |_|  \\_\\___|_| |_| |_|_/_/\\_\\ ",
];

/**
 * Detects if the terminal supports Unicode and emojis
 */
function supportsUnicode(): boolean {
  let { env } = process
  let { TERM, TERM_PROGRAM, LANG, LC_ALL, LC_CTYPE } = env

  // Windows Terminal and modern terminals
  if (TERM_PROGRAM === 'vscode' || TERM_PROGRAM === 'iTerm.app' || TERM_PROGRAM === 'Hyper') {
    return true
  }

  // Check locale for UTF-8
  let locale = LC_ALL || LC_CTYPE || LANG || ''
  if (locale.toLowerCase().includes('utf-8') || locale.toLowerCase().includes('utf8')) {
    return true
  }

  // Modern terminal types
  if (TERM && (TERM.includes('256color') || TERM === 'xterm-kitty')) {
    return true
  }

  return false
}

/**
 * Creates a spinning vinyl/CD animation
 */
export function createSpinner(message: string = 'Loading...'): SpinnerController {
  let frames = supportsUnicode() ? vinylFrames : vinylFramesAscii
  let currentFrame = 0
  let interval: NodeJS.Timeout | null = null
  let isSpinning = false

  function render() {
    if (!isSpinning) return

    // Move to beginning of line and clear it
    process.stdout.write('\r\x1B[K')

    // Write spinner frame and message
    process.stdout.write(`${frames[currentFrame]}  ${message}`)

    currentFrame = (currentFrame + 1) % frames.length
  }

  return {
    start() {
      if (isSpinning) return

      isSpinning = true
      render()
      interval = setInterval(render, 80) // ~12 fps - smooth micro-animation
    },

    stop() {
      if (!isSpinning) return

      isSpinning = false
      if (interval) {
        clearInterval(interval)
        interval = null
      }

      // Clear the spinner line
      process.stdout.write('\r\x1B[K')
    },

    updateMessage(newMessage: string) {
      message = newMessage
      if (isSpinning) {
        render()
      }
    },
  }
}

/**
 * Creates an animated equalizer bar
 */
export function createEqualizer(): EqualizerController {
  let currentFrame = 0
  let interval: NodeJS.Timeout | null = null
  let isAnimating = false
  let prefix = '♪ '
  let suffix = ''

  function render() {
    if (!isAnimating) return

    // Move to beginning of line and clear it
    process.stdout.write('\r\x1B[K')

    // Write current frame
    process.stdout.write(`${prefix}${equalizerFrames[currentFrame]} ${suffix}`)

    currentFrame = (currentFrame + 1) % equalizerFrames.length
  }

  return {
    start(options: { prefix?: string; suffix?: string } = {}) {
      if (isAnimating) return

      if (options.prefix !== undefined) prefix = options.prefix
      if (options.suffix !== undefined) suffix = options.suffix

      isAnimating = true
      render()
      interval = setInterval(render, 100) // 10 fps - smooth wave motion
    },

    stop() {
      if (!isAnimating) return

      isAnimating = false
      if (interval) {
        clearInterval(interval)
        interval = null
      }

      // Clear the line
      process.stdout.write('\r\x1B[K')
    },

    update(options: { prefix?: string; suffix?: string }) {
      if (options.prefix !== undefined) prefix = options.prefix
      if (options.suffix !== undefined) suffix = options.suffix

      if (isAnimating) {
        render()
      }
    },
  }
}

/**
 * Creates a progress bar with equalizer animation
 */
export function createProgressBar(total: number): ProgressBarController {
  let current = 0
  let equalizer = createEqualizer()
  let message = ''

  function render() {
    let percentage = Math.floor((current / total) * 100)
    let filled = Math.floor((current / total) * 20)
    let empty = 20 - filled
    let bar = '█'.repeat(filled) + '░'.repeat(empty)

    equalizer.update({
      suffix: `[${bar}] ${percentage}% ${message}`,
    })
  }

  return {
    start(initialMessage: string = '') {
      message = initialMessage
      equalizer.start({ prefix: '♪ ', suffix: '' })
      render()
    },

    update(value: number, newMessage?: string) {
      current = Math.min(value, total)
      if (newMessage !== undefined) message = newMessage
      render()
    },

    stop() {
      equalizer.stop()
      // Print final state
      let percentage = Math.floor((current / total) * 100)
      let filled = Math.floor((current / total) * 20)
      let empty = 20 - filled
      let bar = '█'.repeat(filled) + '░'.repeat(empty)
      console.log(`✓ [${bar}] ${percentage}% ${message}`)
    },
  }
}

/**
 * Creates a drum machine style animation where bars fire up and decay
 */
export function createDrumMachine(): DrumMachineController {
  let interval: NodeJS.Timeout | null = null
  let isAnimating = false
  let prefix = '🥁 '
  let suffix = ''
  let barCount = 8
  let heights = new Array(barCount).fill(0) // Height 0-7 for each bar
  let decayRate = 3.0 // How fast bars decay per frame

  function render() {
    if (!isAnimating) return

    // Randomly fire 1-2 bars on each frame
    if (Math.random() > 0.5) {
      let fireIndex = Math.floor(Math.random() * barCount)
      heights[fireIndex] = 7 // Max height
    }

    // Build the visual
    let visual = heights.map((h) => barHeights[Math.floor(h)]).join('')

    // Move to beginning of line and clear it
    process.stdout.write('\r\x1B[K')
    process.stdout.write(`${prefix}${visual} ${suffix}`)

    // Decay all bars
    heights = heights.map((h) => Math.max(0, h - decayRate))
  }

  return {
    start(options: { prefix?: string; suffix?: string } = {}) {
      if (isAnimating) return

      if (options.prefix !== undefined) prefix = options.prefix
      if (options.suffix !== undefined) suffix = options.suffix

      isAnimating = true
      // Reset heights
      heights = new Array(barCount).fill(0)
      render()
      interval = setInterval(render, 100) // 10 fps
    },

    stop() {
      if (!isAnimating) return

      isAnimating = false
      if (interval) {
        clearInterval(interval)
        interval = null
      }

      // Clear the line
      process.stdout.write('\r\x1B[K')
    },

    update(options: { prefix?: string; suffix?: string }) {
      if (options.prefix !== undefined) prefix = options.prefix
      if (options.suffix !== undefined) suffix = options.suffix

      if (isAnimating) {
        render()
      }
    },

    trigger(intensity: number = 1) {
      // Manually trigger a random bar with given intensity (0-1)
      if (isAnimating) {
        let fireIndex = Math.floor(Math.random() * barCount)
        heights[fireIndex] = Math.min(7, intensity * 7)
      }
    },
  }
}
/**
 * Creates an animated Remix logo reveal
 */
export function createRemixLogo(): RemixLogoController {
  // Letter colors: R=blue, E=green, M=yellow, I=pink, X=red
  let letterColors = [
    colors.brightBlue, // R
    colors.brightGreen, // E
    colors.brightYellow, // M
    colors.brightMagenta, // I
    colors.brightRed, // X
  ]

  function animateIn(callback?: () => void) {
    let maxLength = Math.max(...remixLogoLines.map((line) => line.length))
    let currentCol = 0
    let firstFrame = true

    let animInterval = setInterval(() => {
      // After first frame, move cursor up to redraw
      if (!firstFrame) {
        readline.moveCursor(process.stdout, 0, -remixLogoLines.length + 1)
      }

      for (let lineIdx = 0; lineIdx < remixLogoLines.length; lineIdx++) {
        readline.cursorTo(process.stdout, 0)
        readline.clearLine(process.stdout, 0)
        let line = remixLogoLines[lineIdx]

        // Show characters up to currentCol
        for (let charIdx = 0; charIdx < Math.min(currentCol, line.length); charIdx++) {
          let char = line[charIdx]

          // Determine color based on position in the logo
          let color = colors.reset
          if (charIdx < 12) {
            color = letterColors[0] // R - blue
          } else if (charIdx < 20) {
            color = letterColors[1] // E - green
          } else if (charIdx < 31) {
            color = letterColors[2] // M - yellow
          } else if (charIdx < 34) {
            color = letterColors[3] // I - pink
          } else {
            color = letterColors[4] // X - red
          }

          process.stdout.write(colors.bold + color + char + colors.reset)
        }

        // Move to next line (except on last line)
        if (lineIdx < remixLogoLines.length - 1) {
          process.stdout.write('\n')
        }
      }

      firstFrame = false
      currentCol += 2 // Reveal 2 chars at a time

      if (currentCol > maxLength) {
        clearInterval(animInterval)
        process.stdout.write('\n')
        if (callback) callback()
      }
    }, 40) // Fast left-to-right reveal
  }

  function renderStatic() {
    for (let lineIdx = 0; lineIdx < remixLogoLines.length; lineIdx++) {
      let line = remixLogoLines[lineIdx]

      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        let char = line[charIdx]

        // Apply letter colors
        let color = colors.reset
        if (charIdx >= 4 && charIdx < 13) {
          color = letterColors[0] // R - blue
        } else if (charIdx >= 13 && charIdx < 24) {
          color = letterColors[1] // E - green
        } else if (charIdx >= 24 && charIdx < 37) {
          color = letterColors[2] // M - yellow
        } else if (charIdx >= 37 && charIdx < 42) {
          color = letterColors[3] // I - pink
        } else if (charIdx >= 42) {
          color = letterColors[4] // X - red
        }

        process.stdout.write(colors.bold + color + char + colors.reset)
      }
      process.stdout.write('\n')
    }
  }

  return {
    show(animated: boolean = true): Promise<void> {
      return new Promise((resolve) => {
        if (animated) {
          animateIn(() => resolve())
        } else {
          renderStatic()
          resolve()
        }
      })
    },

    showWithCallback(callback: () => void) {
      animateIn(callback)
    },
  }
}

/**
 * Creates an animated Remix logo reveal
 */
export function createRemixLogoNoShadow(): RemixLogoController {
  // Letter colors: R=blue, E=green, M=yellow, I=pink, X=red
  let letterColors = [
    colors.brightBlue, // R
    colors.brightGreen, // E
    colors.brightYellow, // M
    colors.brightMagenta, // I
    colors.brightRed, // X
  ]

  function animateIn(callback?: () => void) {
    let maxLength = Math.max(...remixLogoLinesNoShadow.map((line) => line.length))
    let currentCol = 0
    let firstFrame = true

    let animInterval = setInterval(() => {
      // After first frame, move cursor up to redraw
      if (!firstFrame) {
        readline.moveCursor(process.stdout, 0, -remixLogoLinesNoShadow.length + 1)
      }

      for (let lineIdx = 0; lineIdx < remixLogoLinesNoShadow.length; lineIdx++) {
        readline.cursorTo(process.stdout, 0)
        readline.clearLine(process.stdout, 0)
        let line = remixLogoLinesNoShadow[lineIdx]

        // Show characters up to currentCol
        for (let charIdx = 0; charIdx < Math.min(currentCol, line.length); charIdx++) {
          let char = line[charIdx]

          // Determine color based on position in the logo
          let color = colors.reset
          if (charIdx < 12) {
            color = letterColors[0] // R - blue
          } else if (charIdx < 20) {
            color = letterColors[1] // E - green
          } else if (charIdx < 30) {
            color = letterColors[2] // M - yellow
          } else if (charIdx < 34) {
            color = letterColors[3] // I - pink
          } else {
            color = letterColors[4] // X - red
          }

          process.stdout.write(colors.bold + color + char + colors.reset)
        }

        // Move to next line (except on last line)
        if (lineIdx < remixLogoLinesNoShadow.length - 1) {
          process.stdout.write('\n')
        }
      }

      firstFrame = false
      currentCol += 2 // Reveal 2 chars at a time

      if (currentCol > maxLength) {
        clearInterval(animInterval)
        process.stdout.write('\n')
        if (callback) callback()
      }
    }, 40) // Fast left-to-right reveal
  }

  function renderStatic() {
    for (let lineIdx = 0; lineIdx < remixLogoLinesNoShadow.length; lineIdx++) {
      let line = remixLogoLinesNoShadow[lineIdx]

      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        let char = line[charIdx]

        // Apply letter colors
        let color = colors.reset
        if (charIdx >= 4 && charIdx < 13) {
          color = letterColors[0] // R - blue
        } else if (charIdx >= 13 && charIdx < 24) {
          color = letterColors[1] // E - green
        } else if (charIdx >= 24 && charIdx < 37) {
          color = letterColors[2] // M - yellow
        } else if (charIdx >= 37 && charIdx < 42) {
          color = letterColors[3] // I - pink
        } else if (charIdx >= 42) {
          color = letterColors[4] // X - red
        }

        process.stdout.write(colors.bold + color + char + colors.reset)
      }
      process.stdout.write('\n')
    }
  }

  return {
    show(animated: boolean = true): Promise<void> {
      return new Promise((resolve) => {
        if (animated) {
          animateIn(() => resolve())
        } else {
          renderStatic()
          resolve()
        }
      })
    },

    showWithCallback(callback: () => void) {
      animateIn(callback)
    },
  }
}

/**
 * Creates an animated Remix logo reveal
 */
export function createRemixLogoNoShadowLowercase(): RemixLogoController {
  // Letter colors: R=blue, E=green, M=yellow, I=pink, X=red
  let letterColors = [
    colors.brightBlue, // R
    colors.brightGreen, // E
    colors.brightYellow, // M
    colors.brightMagenta, // I
    colors.brightRed, // X
  ]

  function animateIn(callback?: () => void) {
    let maxLength = Math.max(...remixLogoLinesNoShadowLowercase.map((line) => line.length))
    let currentCol = 0
    let firstFrame = true

    let animInterval = setInterval(() => {
      // After first frame, move cursor up to redraw
      if (!firstFrame) {
        readline.moveCursor(process.stdout, 0, -remixLogoLinesNoShadowLowercase.length + 1)
      }

      for (let lineIdx = 0; lineIdx < remixLogoLinesNoShadowLowercase.length; lineIdx++) {
        readline.cursorTo(process.stdout, 0)
        readline.clearLine(process.stdout, 0)
        let line = remixLogoLinesNoShadowLowercase[lineIdx]

        // Show characters up to currentCol
        for (let charIdx = 0; charIdx < Math.min(currentCol, line.length); charIdx++) {
          let char = line[charIdx]

          // Determine color based on position in the logo
          let color = colors.reset
          if (charIdx < 5) {
            color = letterColors[0] // R - blue
          } else if (charIdx < 10) {
            color = letterColors[1] // E - green
          } else if (charIdx < 15) {
            color = letterColors[2] // M - yellow
          } else if (charIdx < 18) {
            color = letterColors[3] // I - pink
          } else {
            color = letterColors[4] // X - red
          }

          process.stdout.write(colors.bold + color + char + colors.reset)
        }

        // Move to next line (except on last line)
        if (lineIdx < remixLogoLinesNoShadowLowercase.length - 1) {
          process.stdout.write('\n')
        }
      }

      firstFrame = false
      currentCol += 2 // Reveal 2 chars at a time

      if (currentCol > maxLength) {
        clearInterval(animInterval)
        process.stdout.write('\n')
        if (callback) callback()
      }
    }, 40) // Fast left-to-right reveal
  }

  function renderStatic() {
    for (let lineIdx = 0; lineIdx < remixLogoLinesNoShadowLowercase.length; lineIdx++) {
      let line = remixLogoLinesNoShadowLowercase[lineIdx]

      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        let char = line[charIdx]

        // Apply letter colors
        let color = colors.reset
        if (charIdx >= 4 && charIdx < 13) {
          color = letterColors[0] // R - blue
        } else if (charIdx >= 13 && charIdx < 24) {
          color = letterColors[1] // E - green
        } else if (charIdx >= 24 && charIdx < 37) {
          color = letterColors[2] // M - yellow
        } else if (charIdx >= 37 && charIdx < 42) {
          color = letterColors[3] // I - pink
        } else if (charIdx >= 42) {
          color = letterColors[4] // X - red
        }

        process.stdout.write(colors.bold + color + char + colors.reset)
      }
      process.stdout.write('\n')
    }
  }

  return {
    show(animated: boolean = true): Promise<void> {
      return new Promise((resolve) => {
        if (animated) {
          animateIn(() => resolve())
        } else {
          renderStatic()
          resolve()
        }
      })
    },

    showWithCallback(callback: () => void) {
      animateIn(callback)
    },
  }
}

export interface SpinnerController {
  start(): void
  stop(): void
  updateMessage(message: string): void
}

export interface EqualizerController {
  start(options?: { prefix?: string; suffix?: string }): void
  stop(): void
  update(options: { prefix?: string; suffix?: string }): void
}

export interface ProgressBarController {
  start(message?: string): void
  update(value: number, message?: string): void
  stop(): void
}

export interface DrumMachineController {
  start(options?: { prefix?: string; suffix?: string }): void
  stop(): void
  update(options: { prefix?: string; suffix?: string }): void
  trigger(intensity?: number): void
}

export interface RemixLogoController {
  show(animated?: boolean): Promise<void>
  showWithCallback(callback: () => void): void
}

export interface VinylRecordController {
  start(options?: { prefix?: string; suffix?: string }): void
  stop(): void
  update(options: { prefix?: string; suffix?: string }): void
}

/**
 * Creates an animated spinning vinyl record with tonearm
 */
export function createVinylRecord(): VinylRecordController {
  let interval: NodeJS.Timeout | null = null
  let isAnimating = false
  let hasStarted = false
  let prefix = ''
  let suffix = ''
  let currentFrame = 0

  // Vinyl record frames showing rotation with tonearm
  let vinylFrames = [
    [
      '⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⣶⣶⣾⣿⣿⣿⣿⣷⣶⣶⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀',
      '⠀⠀⠀⠀⠀⣠⢔⣫⢷⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⣄⠀⠀⠀⠀⠀',
      '⠀⠀⠀⣠⢊⡴⡫⢚⡽⣟⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣄⠀⠀⠀',
      '⠀⠀⡴⣱⢫⢎⡔⡩⣚⠵⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⠀⠀',
      '⠀⣼⣽⣳⣣⢯⣞⡜⡱⣫⢷⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀',
      '⢸⣿⣿⣿⣿⣿⣿⣾⡽⣱⣫⠞⠉⠀⠀⠀⠀⠉⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇',
      '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⠃⠀⠀⠀⠀⠀⠀⠀⠀⢹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷',
      '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠘⠃⠀⠀⠀⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿',
      '⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿',
      '⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣤⣀⣀⣀⣠⣴⢟⡵⣳⢯⢿⣿⡟⣿⣿⣿⣿⡇',
      '⠀⢻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣞⡵⣫⢏⢞⡽⡽⣻⢯⡟⠀',
      '⠀⠀⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣚⢕⡡⢊⠜⡵⣣⠟⠀⠀',
      '⠀⠀⠀⠙⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣯⢷⣫⢖⡥⢊⡴⠋⠀⠀⠀',
      '⠀⠀⠀⠀⠀⠙⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣞⣭⠞⠋⠀⠀⠀⠀⠀',
      '⠀⠀⠀⠀⠀⠀⠀⠀⠉⠛⠿⠿⢿⣿⣿⣿⣿⡿⠿⠟⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀',
    ],
    [
      '⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⣶⣶⣾⣿⣏⣇⢻⣷⠒⣶⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀',
      '⠀⠀⠀⠀⠀⣠⣴⣿⣿⣿⣿⣿⣿⣿⣇⢿⢸⢣⣇⣿⣿⠛⣿⡆⣀⠀⠀⠀⠀⠀',
      '⠀⠀⠀⣠⣾⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⡸⡎⣼⢱⢯⠥⣣⢏⣼⣿⣷⣄⠀⠀⠀',
      '⠀⠀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇⡇⢃⢀⣶⢟⣱⣿⣿⣿⣿⣿⣦⠀⠀',
      '⠀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣷⣿⣿⣿⣿⡇⡷⣐⣭⣶⣿⣿⣿⣿⣿⣿⣿⣿⣧⠀',
      '⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠞⠉⠀⠀⠀⠀⠉⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡇',
      '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⢹⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷',
      '⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠀⠀⠀⠀⠘⠃⠀⠀⠀⢀⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿',
      '⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣆⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿',
      '⢸⣿⣿⣿⣿⣿⣿⣿⡿⠟⡫⡕⣤⣀⣀⣀⣠⣴⣿⣿⣿⣿⣿⣿⡟⣿⣿⣿⣿⡇',
      '⠀⢻⣿⡿⢟⣛⣩⣶⡾⠟⢀⢏⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡟⠀',
      '⠀⠀⠰⣾⢛⠋⢑⠴⠒⠁⡸⢺⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠀⠀',
      '⠀⠀⠀⠙⢶⣞⠑⡰⣨⠂⠂⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⠋⠀⠀⠀',
      '⠀⠀⠀⠀⠀⠙⠻⣇⣛⣸⡇⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠋⠀⠀⠀⠀⠀',
      '⠀⠀⠀⠀⠀⠀⠀⠀⠉⠛⠥⠿⢿⣿⣿⣿⣿⡿⠿⠟⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀',
    ],
    [
      '⠀⠀⠀⠀⠀⠀⠀⠀⣀⣤⣶⣶⣾⣿⣿⣿⣿⣷⣶⣶⣤⣀⠀⠀⠀⠀⠀⠀⠀⠀',
      '⠀⠀⠀⠀⠀⣠⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣦⣄⠀⠀⠀⠀⠀',
      '⠀⠀⠀⣠⣾⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣷⣄⠀⠀⠀',
      '⠀⠀⣴⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⢟⣡⣦⠀⠀',
      '⠀⣼⣿⣿⣿⣿⣿⣿⣿⣿⣷⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⣣⠞⣋⣭⣦⠀',
      '⢸⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠞⠉⠀⠀⠀⠀⠉⠻⡿⢟⢯⠷⡡⢰⣳⠴⠾⢿⡇',
      '⣟⡻⠿⢿⣿⣿⣿⣿⣿⣿⠃⠀⠀⠀⠀⠀⠀⠀⠀⢠⣨⢹⣠⢒⢄⣘⠺⣛⠿⠷',
      '⣿⣷⢶⡂⣦⡢⡉⣭⣙⣻⠀⠀⠀⠀⠘⠃⠀⠀⠀⢀⣿⣿⣾⣽⣓⣜⡚⢬⢻⣿',
      '⢿⣃⣬⡎⠰⠄⡢⢅⣯⣾⣆⠀⠀⠀⠀⠀⠀⠀⢀⣼⣿⣿⣿⣿⣿⣿⣿⣶⣶⡮',
      '⢸⣿⠋⠬⣹⢾⣼⣿⣿⣿⣿⣷⣤⣀⣀⣀⣠⣴⣿⡿⣻⣿⣿⣿⣿⣿⣿⣿⣿⡇',
      '⠀⢻⣿⡗⣱⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡿⣿⣿⣯⣿⣿⣿⣿⣿⣿⡟⠀',
      '⠀⠀⠡⣾⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣟⣿⣿⣿⣿⣿⠟⠀⠀',
      '⠀⠀⠀⠙⢿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⡽⠋⠀⠀⠀',
      '⠀⠀⠀⠀⠀⠙⠻⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⣿⠟⠋⠀⠀⠀⠀⠀',
      '⠀⠀⠀⠀⠀⠀⠀⠀⠉⠛⠿⠿⢿⣿⣿⣿⣿⡿⠿⠟⠛⠉⠀⠀⠀⠀⠀⠀⠀⠀',
    ],
  ]

  function render() {
    if (!isAnimating) return
    debugger

    let frame = vinylFrames[currentFrame]

    // Move cursor up to redraw
    if (hasStarted) {
      readline.moveCursor(process.stdout, 0, -frame.length)
    }
    hasStarted = true

    // Clear and render the frame
    readline.cursorTo(process.stdout, 0)
    process.stdout.write(prefix)

    for (let lineIdx = 0; lineIdx < frame.length; lineIdx++) {
      if (lineIdx > 0) {
        process.stdout.write('\n')
        readline.cursorTo(process.stdout, 0)
      }
      process.stdout.write(frame[lineIdx])
    }

    process.stdout.write(` ${suffix}`)
    process.stdout.write('\n')

    currentFrame = (currentFrame + 1) % vinylFrames.length
  }

  return {
    start(options: { prefix?: string; suffix?: string } = {}) {
      if (isAnimating) return

      if (options.prefix !== undefined) prefix = options.prefix
      if (options.suffix !== undefined) suffix = options.suffix

      isAnimating = true
      render()
      interval = setInterval(render, 200) // 5 fps - visible spinning
    },

    stop() {
      if (!isAnimating) return

      isAnimating = false
      if (interval) {
        clearInterval(interval)
        interval = null
      }

      // Clear the vinyl display
      // let frameHeight = vinylFrames[0].length + 1
      // readline.moveCursor(process.stdout, 0, -frameHeight)
      // for (let i = 0; i < frameHeight; i++) {
      //   readline.cursorTo(process.stdout, 0)
      //   readline.clearLine(process.stdout, 0)
      //   if (i < frameHeight - 1) {
      //     process.stdout.write('\n')
      //   }
      // }
      // readline.cursorTo(process.stdout, 0)
    },

    update(options: { prefix?: string; suffix?: string }) {
      if (options.prefix !== undefined) prefix = options.prefix
      if (options.suffix !== undefined) suffix = options.suffix

      if (isAnimating) {
        render()
      }
    },
  }
}

/**
 * Creates an animated outlined Remix logo reveal with brand colors
 * R = Bright Blue (#3992FF), E = Green (#10B981), M = Yellow (#FBBF24), I = Pink (#EC4899), X = Red (#EF4444)
 */
export function createRemixOutlineLogo(): RemixLogoController {
  // Remix brand colors for each letter (outline style)
  let letterColors = [
    colors.brightBlue, // R - bright blue
    colors.brightGreen, // E - green
    colors.brightYellow, // M - yellow
    colors.brightMagenta, // I - pink/magenta
    colors.brightRed, // X - red
  ]

  function animateIn(callback?: () => void) {
    let maxLength = Math.max(...remixOutlineLogoLines.map((line) => line.length))
    let totalFrames = Math.ceil(maxLength / 2)
    let currentFrame = 0

    let animInterval = setInterval(() => {
      // Move cursor to start position
      if (currentFrame > 0) {
        readline.moveCursor(process.stdout, 0, -remixOutlineLogoLines.length + 1)
      }

      let revealCol = currentFrame * 2 // Reveal 2 columns per frame

      for (let lineIdx = 0; lineIdx < remixOutlineLogoLines.length; lineIdx++) {
        readline.cursorTo(process.stdout, 0)
        readline.clearLine(process.stdout, 0)
        let line = remixOutlineLogoLines[lineIdx]

        // Render each character with appropriate color
        for (let charIdx = 0; charIdx < Math.min(revealCol, line.length); charIdx++) {
          let char = line[charIdx]

          // Determine which letter this character belongs to
          let color = colors.reset

          // R starts around column 4
          if (charIdx < 8) {
            color = letterColors[0] // R - blue
          }
          // E starts around column 11
          else if (charIdx < 13) {
            color = letterColors[1] // E - green
          }
          // M starts around column 18
          else if (charIdx < 22) {
            color = letterColors[2] // M - yellow
          }
          // I starts around column 29
          else if (charIdx < 25) {
            color = letterColors[3] // I - pink
          }
          // X starts around column 33
          else if (charIdx < 30) {
            color = letterColors[4] // X - red
          }

          process.stdout.write(colors.bold + color + char + colors.reset)
        }

        // Move to next line (except on last line)
        if (lineIdx < remixOutlineLogoLines.length - 1) {
          process.stdout.write('\n')
        }
      }

      currentFrame++

      if (currentFrame > totalFrames) {
        clearInterval(animInterval)
        process.stdout.write('\n')
        if (callback) callback()
      }
    }, 35) // Smooth reveal animation
  }

  function renderStatic() {
    for (let lineIdx = 0; lineIdx < remixOutlineLogoLines.length; lineIdx++) {
      let line = remixOutlineLogoLines[lineIdx]

      for (let charIdx = 0; charIdx < line.length; charIdx++) {
        let char = line[charIdx]

        // Apply letter colors
        let color = colors.reset
        if (charIdx >= 4 && charIdx < 11) {
          color = letterColors[0] // R - blue
        } else if (charIdx >= 11 && charIdx < 18) {
          color = letterColors[1] // E - green
        } else if (charIdx >= 18 && charIdx < 29) {
          color = letterColors[2] // M - yellow
        } else if (charIdx >= 29 && charIdx < 33) {
          color = letterColors[3] // I - pink
        } else if (charIdx >= 33) {
          color = letterColors[4] // X - red
        }

        process.stdout.write(colors.bold + color + char + colors.reset)
      }
      process.stdout.write('\n')
    }
  }

  return {
    show(animated: boolean = true): Promise<void> {
      return new Promise((resolve) => {
        if (animated) {
          animateIn(() => resolve())
        } else {
          renderStatic()
          resolve()
        }
      })
    },

    showWithCallback(callback: () => void) {
      animateIn(callback)
    },
  }
}
