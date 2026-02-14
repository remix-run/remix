import { Frame, type Handle, type RemixNode } from 'remix/component'
import { press } from 'remix/interaction/press'

import { routes } from '../routes.ts'
import { clientEntry } from '../utils/client.ts'

import assets from './delayed-frame.tsx?assets=client'

export let DelayedFrame = clientEntry(assets, 'DelayedFrame', (handle: Handle) => {
  let frames: RemixNode[] = []

  let handlePress = () => {
    frames.push(
      <Frame
        key={++frames.length}
        src={routes.marketing.frame.href()}
        fallback={<p>Loading frame...</p>}
      />,
    )
    handle.update()
  }

  return () => (
    <>
      <button on={{ [press]: handlePress }}>Render delayed frame</button>
      {frames}
    </>
  )
})
