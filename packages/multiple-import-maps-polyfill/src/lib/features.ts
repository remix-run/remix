import { hasDocument, nonce, version } from './env.ts'
import { maybeTrustedInnerHTML, maybeTrustedScript, policy } from './trusted-types.ts'

const supports = hasDocument ? HTMLScriptElement.supports : undefined

export const supportsImportMaps = Boolean(
  supports && supports.name === 'supports' && supports('importmap'),
)
export let supportsMultipleImportMaps = false

export const featureDetectionPromise: Promise<void> = (async function () {
  if (!hasDocument || !supportsImportMaps) return

  let msgTag = `s${version}`
  return new Promise<void>((resolve) => {
    let iframe = document.createElement('iframe')
    iframe.style.display = 'none'
    iframe.setAttribute('nonce', nonce)
    let settled = false
    let timeout = setTimeout(done, 1000)
    function done() {
      if (settled) return
      settled = true
      clearTimeout(timeout)
      if (iframe.parentNode === document.head) document.head.removeChild(iframe)
      window.removeEventListener('message', cb, false)
      resolve()
    }

    function cb({ data }: MessageEvent<unknown>) {
      if (!Array.isArray(data) || data[0] !== msgTag) return
      supportsMultipleImportMaps = data[2] === true
      done()
    }
    window.addEventListener('message', cb, false)

    let importMapTest = `<script nonce=${nonce || ''}>${
      policy
        ? 't=(window.trustedTypes||window.TrustedTypes).createPolicy("remix/multiple-import-maps-polyfill",{createScript:s=>s});'
        : ''
    }b=s=>URL.createObjectURL(new Blob([s],{type:'text/javascript'}));c=u=>import(u).then(()=>true,()=>false);i=innerText=>document.head.appendChild(Object.assign(document.createElement('script'),{type:'importmap',nonce:"${nonce}",text:${
      policy ? 't.createScript(innerText)' : 'innerText'
    }}));i(\`{"imports":{"x":"\${b('')}"}}\`);i(\`{"imports":{"y":"\${b('')}"}}\`);Promise.all([true,c('y')]).then(a=>parent.postMessage(['${msgTag}'].concat(a),'*'))<${''}/script>`

    // Safari will call onload eagerly on head injection, but we don't want the Wechat
    // path to trigger before setting srcdoc, therefore we track the timing
    let readyForOnload = false,
      onloadCalledWhileNotReady = false
    function doOnload() {
      if (!readyForOnload) {
        onloadCalledWhileNotReady = true
        return
      }
      // WeChat browser doesn't support setting srcdoc scripts
      // But iframe sandboxes don't support contentDocument so we do this as a fallback
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
    // WeChat browser requires append before setting srcdoc
    document.head.appendChild(iframe)

    // setting srcdoc is not supported in React native webviews on iOS
    // setting src to a blob URL results in a navigation event in webviews
    // document.write gives usability warnings
    readyForOnload = true
    if ('srcdoc' in (iframe as object)) iframe.srcdoc = maybeTrustedInnerHTML(importMapTest)
    else iframe.contentDocument!.write(importMapTest)
    // retrigger onload for Safari only if necessary
    if (onloadCalledWhileNotReady) doOnload()
  })
})().catch(() => {})
