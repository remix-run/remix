import { hasDocument, nonce } from './env.ts'
import { maybeTrustedInnerHTML, maybeTrustedScript, policy } from './trusted-types.ts'

const supports = hasDocument ? HTMLScriptElement.supports : undefined

export const supportsImportMaps = Boolean(
  supports && supports.name === 'supports' && supports('importmap'),
)
export let supportsMultipleImportMaps = false

export const featureDetectionPromise: Promise<void> = (async function () {
  if (!hasDocument || !supportsImportMaps) return

  let msgTag = `remix-import-map-test-${Date.now()}-${Math.random()}`
  return new Promise<void>((resolve) => {
    let iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.setAttribute('nonce', nonce)
    let timeout: ReturnType<typeof setTimeout> | undefined
    let settled = false

    function finish(supported: boolean) {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      supportsMultipleImportMaps = supported
      iframe.remove()
      window.removeEventListener('message', cb, false)
      resolve()
    }

    function cb({ data, source }: MessageEvent<unknown>) {
      if (source !== iframe.contentWindow || !Array.isArray(data) || data[0] !== msgTag) return
      finish(data[1] === true && data[2] === true)
    }
    window.addEventListener('message', cb, false)
    timeout = setTimeout(() => finish(false), 1000)

    let importMapTest = `<script nonce=${nonce || ''}>${
      policy
        ? 't=(window.trustedTypes||window.TrustedTypes).createPolicy("remix/multiple-import-maps-polyfill",{createScript:s=>s});'
        : ''
    }b=s=>URL.createObjectURL(new Blob([s],{type:'text/javascript'}));c=u=>import(u).then(()=>true,()=>false);i=innerText=>document.head.appendChild(Object.assign(document.createElement('script'),{type:'importmap',nonce:"${nonce}",text:${
      policy ? 't.createScript(innerText)' : 'innerText'
    }}));i(\`{"imports":{"x":"\${b('')}"}}\`);i(\`{"imports":{"y":"\${b('')}"}}\`);Promise.all([c('x'),c('y')]).then(a=>parent.postMessage(['${msgTag}'].concat(a),'*'))<${''}/script>`

    // Safari can call onload eagerly on head injection, before srcdoc is assigned.
    let readyForOnload = false,
      onloadCalledWhileNotReady = false
    function doOnload() {
      if (!readyForOnload) {
        onloadCalledWhileNotReady = true
        return
      }
      let doc = iframe.contentDocument
      if (doc && doc.head.childNodes.length === 0) {
        let script = doc.createElement('script')
        if (nonce) script.setAttribute('nonce', nonce)
        script.innerText = maybeTrustedScript(
          importMapTest.slice(15 + (nonce ? nonce.length : 0), -9),
        )
        doc.head.appendChild(script)
      }
    }

    iframe.onload = doOnload
    document.head.appendChild(iframe)

    readyForOnload = true
    if (typeof iframe.srcdoc === 'string') iframe.srcdoc = maybeTrustedInnerHTML(importMapTest)
    else iframe.contentDocument?.write(importMapTest)
    if (onloadCalledWhileNotReady) doOnload()
  })
})().catch(() => {})
