import { css } from 'remix/ui'

import type { AppContext } from '../../../../middleware/render.ts'
import { LuckyNumberToy } from './client.tsx'
import type { LuckyNumberTone } from './client.tsx'

type DemoMood = {
  name: string
  tone: LuckyNumberTone
}

const timeFormatter = new Intl.DateTimeFormat('en-US', {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
})

const demoMoods = [
  { name: 'confetti mode', tone: 'brand' },
  { name: 'runtime sparkle', tone: 'purple' },
  { name: 'web standard green', tone: 'green' },
  { name: 'frame refresh blue', tone: 'blue' },
  { name: 'zero-dependency gold', tone: 'gold' },
] satisfies DemoMood[]

const frameResponseInit = {
  headers: {
    'Cache-Control': 'no-store',
  },
} satisfies ResponseInit

export async function handler({ render }: AppContext) {
  let now = new Date()
  let mood = pickMood()

  return render(
    <div mix={exampleCardStyles}>
      <LuckyNumberToy
        generatedLabel={timeFormatter.format(now)}
        luckyNumber={randomInt(1, 99)}
        mood={mood.name}
        tone={mood.tone}
      />
    </div>,
    frameResponseInit,
  )
}

function pickMood() {
  let mood = demoMoods[Math.floor(Math.random() * demoMoods.length)]
  if (!mood) {
    throw new Error('Expected at least one demo mood')
  }
  return mood
}

function randomInt(min: number, max: number) {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

const exampleCardStyles = css({
  display: 'flex',
  flexDirection: 'column',
  gap: '1rem',
  margin: '1.5rem 0',
  padding: '1rem',
  border: '1px solid var(--border)',
  borderRadius: '10px',
  background: 'var(--bg-subtle)',
  '& p': {
    margin: '0',
  },
})
