import {
  createSpinner,
  createEqualizer,
  createProgressBar,
  createRemixLogoNoShadow,
} from './animations.ts'

// Display help
export async function showHelp() {
  let logo = createRemixLogoNoShadow()
  await logo.show(true) // Show animated outlined logo with brand colors
  console.log()
  console.log("🎤 TONIGHT'S SETLIST:\n")
  console.log('  remix dev .............. Start the show')
  console.log('  remix build ............ Cut the record')
  console.log('  remix routes ........... View the tracklist')
  console.log('  remix typecheck ........ Sound check')
  console.log('  remix --version ........ Check the pressing')
  console.log('  remix --help ........... Show liner notes')
  console.log('\n💿 REMIX v3 - Keep it spinning!')
}

// Display version
export function showVersion() {
  // TODO: Read from package.json
  console.log('💿 Remix v3.0.0-experimental')
}

// Demo: Dev server simulation
export async function dev() {
  let spinner = createSpinner('Starting dev server...')
  spinner.start()

  await sleep(1500)

  spinner.updateMessage('Loading routes...')
  await sleep(800)

  spinner.updateMessage('Compiling...')
  await sleep(1200)

  spinner.stop()

  // Show equalizer for "live" server
  let equalizer = createEqualizer()
  console.log('✓ Dev server ready!')
  console.log()
  equalizer.start({
    prefix: '♪♪ ',
    suffix: ' ♪♪  Listening on http://localhost:44100',
  })

  // Keep running for demo (in real impl, this would be the actual server)
  await sleep(3000)
  equalizer.stop()
  console.log('\n✓ Server stopped')
}

// Demo: Build command simulation
export async function build() {
  console.log('🎸 Building your Remix app...\n')

  let progress = createProgressBar(100)
  progress.start('Analyzing routes')

  // Simulate build steps
  await sleep(300)
  progress.update(20, 'Analyzing routes')

  await sleep(400)
  progress.update(45, 'Compiling modules')

  await sleep(500)
  progress.update(70, 'Bundling assets')

  await sleep(400)
  progress.update(90, 'Generating output')

  await sleep(300)
  progress.update(100, 'Complete!')

  progress.stop()

  console.log('\n✨ Build successful!')
  console.log('📀 Output: ./build')
}

// Demo: Routes command
export function routes() {
  console.log(`
📀 ROUTES (Tracklist)

├─ [HOME]  / ..................... index.tsx
├─ [PAGE]  /about ................ about.tsx
├─ [PAGE]  /blog ................. blog.tsx
│  └─ [POST] /blog/:slug ......... blog.$slug.tsx
├─ [PAGE]  /contact .............. contact.tsx
└─ [API]   /api/hello ............ api.hello.tsx

💿 6 routes found
`)
}

// Demo: Typecheck simulation
export async function typecheck() {
  let spinner = createSpinner('Running TypeScript compiler...')
  spinner.start()

  await sleep(2000)

  spinner.stop()
  console.log('✓ No type errors found!')
}

// Helper
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
