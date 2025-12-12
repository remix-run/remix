#!/usr/bin/env node

/**
 * Demo script to showcase all CLI animations
 * Run: node src/cli-demo.ts
 */

import {
  createRemixLogoNoShadow,
  createRemixLogoNoShadowLowercase,
  createRemixOutlineLogo,
  createSpinner,
  createEqualizer,
  createProgressBar,
  createDrumMachine,
  createRemixLogo,
  createVinylRecord,
} from '../src/lib/cli/animations.ts'

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}

async function main() {
  console.log('╔════════════════════════════════════════╗')
  console.log('║  🎵 REMIX CLI ANIMATIONS DEMO         ║')

  // Remix Logo Reveal
  console.log('Remix Logo Animated Reveal:\n')
  await createRemixLogo().show(true)
  await sleep(500)
  console.log('\n\n')

  await createRemixLogoNoShadow().show(true)
  await sleep(500)
  console.log('\n\n')

  await createRemixLogoNoShadowLowercase().show(true)
  await sleep(500)
  console.log('\n\n')

  await createRemixOutlineLogo().show(true)
  await sleep(500)
  console.log('\n\n')

  // Spinning Vinyl
  console.log('Spinning Vinyl/CD Animation:\n')
  let spinner = createSpinner('Loading your tunes...')
  spinner.start()
  await sleep(1000)
  spinner.updateMessage('Almost there...')
  await sleep(1000)
  spinner.stop()
  console.log('✓ Done!\n\n')

  await sleep(500)

  // Equalizer
  console.log('Equalizer Animation:\n')
  let equalizer = createEqualizer()
  equalizer.start({ prefix: '♪ ', suffix: ' Building...' })
  await sleep(2000)
  equalizer.update({ suffix: ' Compiling...' })
  await sleep(2000)
  equalizer.stop()
  console.log('✓ Done!\n\n')

  await sleep(500)

  // Progress Bar with Equalizer
  console.log('Progress Bar with Equalizer:\n')
  let progress = createProgressBar(100)
  progress.start('Starting')

  for (let i = 0; i <= 100; i += 5) {
    await sleep(80)
    let messages = [
      'Starting',
      'Loading modules',
      'Analyzing routes',
      'Compiling',
      'Bundling assets',
      'Optimizing',
      'Finalizing',
      'Complete!',
    ]
    let messageIndex = Math.floor((i / 100) * (messages.length - 1))
    progress.update(i, messages[messageIndex])
  }

  progress.stop()
  console.log('\n')

  await sleep(500)

  // Combined - Spinner then Equalizer
  console.log('Combined Flow (Spinner → Equalizer):\n')
  let spinner2 = createSpinner('Starting dev server...')
  spinner2.start()
  await sleep(2000)
  spinner2.stop()

  console.log('✓ Server ready!')
  let eq2 = createEqualizer()
  eq2.start({ prefix: '♪♪ ', suffix: ' ♪♪  http://localhost:44100' })
  await sleep(2000)
  eq2.stop()
  console.log('\n')

  await sleep(500)

  // Drum Machine
  console.log('Drum Machine (bars fire up and decay):\n')
  let drumMachine = createDrumMachine()
  drumMachine.start({ prefix: '🥁 ', suffix: ' Building...' })
  await sleep(2000)
  drumMachine.update({ suffix: ' Compiling...' })
  await sleep(2000)
  drumMachine.stop()
  console.log('✓ Done!\n\n')

  await sleep(500)

  // Vinyl Record Spinning
  console.log('Vinyl Record Spinning:\n\n')
  let vinyl = createVinylRecord()
  vinyl.start({ suffix: 'Now playing: Remix Greatest Hits' })
  await sleep(2000)
  vinyl.update({ suffix: 'Track 2: Build That App               ' })
  await sleep(2000)
  vinyl.stop()
  console.log('✓ Playback stopped!\n\n')

  await sleep(500)

  console.log('╔════════════════════════════════════════╗')
  console.log('║  💿 Demo complete!                    ║')
  console.log('╚════════════════════════════════════════╝')
}

main().catch(console.error)
