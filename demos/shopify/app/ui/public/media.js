const videos = [...document.querySelectorAll('video[data-video]')]
const visible = new Set()
const motion = matchMedia('(prefers-reduced-motion: reduce)')
let paused = motion.matches
const buttons = [...document.querySelectorAll('[data-pause-videos]')]

function update(video) {
  if (paused || document.hidden || !visible.has(video)) {
    video.pause()
    return
  }
  let sources = video.querySelectorAll('source[data-src]')
  if (sources.length) {
    for (let source of sources) {
      source.src = source.dataset.src
      source.removeAttribute('data-src')
    }
    video.load()
  }
  video.muted = true
  video.play().catch((error) => {
    if (error.name === 'NotAllowedError') video.controls = true
  })
}

function updateAll() {
  for (let video of videos) update(video)
  for (let button of buttons) {
    button.hidden = false
    button.textContent = paused ? 'Play animations' : 'Pause animations'
  }
}

const observer = new IntersectionObserver((entries) => {
  for (let entry of entries) {
    if (entry.isIntersecting) visible.add(entry.target)
    else visible.delete(entry.target)
    update(entry.target)
  }
})
for (let video of videos) {
  video.addEventListener('loadeddata', () => {
    video.classList.add('video-ready')
  })
}

// Wait for the page to load so video downloads don't compete with the posters for bandwidth.
function observeVideos() {
  for (let video of videos) observer.observe(video)
}
if (document.readyState === 'complete') observeVideos()
else addEventListener('load', observeVideos, { once: true })

const hero = document.querySelector('video.hero-video')
if (hero) {
  matchMedia('(max-width: 767px)').addEventListener('change', () => {
    if (!hero.querySelector('source[src]')) return
    hero.classList.remove('video-ready')
    hero.load()
    update(hero)
  })
}
for (let button of buttons) {
  button.addEventListener('click', () => {
    paused = !paused
    updateAll()
  })
}
motion.addEventListener('change', () => {
  paused = motion.matches
  updateAll()
})
document.addEventListener('visibilitychange', updateAll)
updateAll()
