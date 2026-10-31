import type { Handle } from 'remix/component'

import { routes } from '../../../routes.ts'

export type CartBook = {
  bookId: number
  slug: string
  title: string
  price: number
}

/**
 * A quantity the visitor chose for a book that the server's pages may not show yet. `saving` and
 * `retrying` are on their way, `saved` stays until the frames showing it render the server's
 * answer, and `failed` keeps its message until the visitor tries again or changes the book again.
 */
export type CartChange = CartBook & {
  quantity: number
  status: 'saving' | 'retrying' | 'saved' | 'failed'
  createdAt: number
}

// Changes outlive the components that make them, so leaving a page doesn't drop a change or its
// retries. Cart islands render the server's cart with these applied on top.
const changes = new Map<number, CartChange>()

/** Dispatches `change` whenever a book's change or its status changes. */
export const cartChanges = new EventTarget()

const STORAGE_KEY = 'bookstore:cart-changes'
// A stored change is resumed only this soon after the visitor made it, so an old intent doesn't
// come back after they've stopped expecting it.
const MAX_RESUME_AGE = 2 * 60 * 1000
const RETRY_DELAYS = [300, 1000]
const RETRY_STATUSES = new Set([408, 429, 502, 503, 504])

let sending = false
let pause: { bookId: number; wake(): void } | undefined

resumeStoredChanges()

export function getCartChange(bookId: number): CartChange | undefined {
  return changes.get(bookId)
}

export function getCartChanges(): CartChange[] {
  return [...changes.values()]
}

/** The quantity to show for a book: the visitor's latest choice, or else the server's. */
export function getShownQuantity(bookId: number, serverQuantity: number): number {
  let change = changes.get(bookId)
  return change && change.status !== 'failed' ? change.quantity : serverQuantity
}

/** Whether a change is still on its way, so the server's pages may not show it yet. */
export function isCartSaving(): boolean {
  return getCartChanges().some(isUnsent)
}

/**
 * Sets the quantity the visitor wants, 0 to remove the book. Requests carry the end state, so a
 * newer choice for the same book replaces an unsent one, and resending one is harmless.
 */
export function setCartQuantity(book: CartBook, quantity: number): void {
  changes.set(book.bookId, {
    bookId: book.bookId,
    slug: book.slug,
    title: book.title,
    price: book.price,
    quantity,
    status: 'saving',
    createdAt: Date.now(),
  })
  if (pause?.bookId === book.bookId) pause.wake()
  update()
  void sendChanges()
}

export function retryCartChange(bookId: number): void {
  let change = changes.get(bookId)
  if (change?.status === 'failed') setCartQuantity(change, change.quantity)
}

/** Forgets settled changes once a frame shows the server's cart after them. */
export function clearSettledCartChanges(settled: CartChange[]): void {
  let cleared = false
  for (let change of settled) {
    if (changes.get(change.bookId) === change) {
      changes.delete(change.bookId)
      cleared = true
    }
  }
  if (cleared) update()
}

/**
 * Has an island show cart changes for the books it shows. It renders the server's props until it's
 * in the document, so hydration matches the server's HTML, and then applies the changes on top.
 * Once the changes it shows have settled, it reloads its frame and renders the server's answer.
 *
 * @returns Whether the island should apply changes yet.
 */
export function followCartChanges(
  handle: Pick<Handle, 'frame' | 'queueTask' | 'signal' | 'update'>,
  shows: (bookId: number) => boolean,
): () => boolean {
  let following = false
  let reloaded = new WeakSet<CartChange>()

  handle.queueTask(() => {
    if (handle.signal.aborted) return
    following = true
    cartChanges.addEventListener('change', onChange, { signal: handle.signal })
    onChange()
  })

  function onChange() {
    void handle.update()
    void reloadSettled()
  }

  async function reloadSettled() {
    if (isCartSaving()) return
    let settled = getCartChanges().filter(
      (change) =>
        (change.status === 'saved' || change.status === 'failed') &&
        shows(change.bookId) &&
        !reloaded.has(change),
    )
    if (settled.length === 0) return
    for (let change of settled) reloaded.add(change)
    try {
      await handle.frame.reload()
    } catch {
      // The island keeps showing saved changes, and failed ones fall back to the server's last
      // answer, which is all it knows.
      return
    }
    clearSettledCartChanges(settled.filter((change) => change.status === 'saved'))
  }

  return () => following
}

// One request at a time: overlapping requests would each save the session they read, and the last
// to finish would drop the others' changes.
async function sendChanges(): Promise<void> {
  if (sending) return
  sending = true
  try {
    let change: CartChange | undefined
    while ((change = getCartChanges().find(isUnsent))) {
      await sendChange(change)
    }
  } finally {
    sending = false
  }
}

async function sendChange(change: CartChange): Promise<void> {
  for (let attempt = 0; ; attempt++) {
    let response: Response | undefined
    try {
      response = await fetch(routes.cart.api.update.href(), {
        method: 'PUT',
        body: new URLSearchParams({
          bookId: String(change.bookId),
          quantity: String(change.quantity),
          redirect: 'none',
        }),
        // Lets the request finish if the visitor leaves the document while it's on its way.
        keepalive: true,
        signal: AbortSignal.timeout(10_000),
      })
    } catch {
      // A network error or timeout: the request may not have reached the server.
    }

    if (changes.get(change.bookId) !== change) return
    if (response?.ok) return setStatus(change, 'saved')
    if ((response && !RETRY_STATUSES.has(response.status)) || attempt === RETRY_DELAYS.length) {
      return setStatus(change, 'failed')
    }

    setStatus(change, 'retrying')
    await waitToRetry(change.bookId, getRetryDelay(response, RETRY_DELAYS[attempt]))
    if (changes.get(change.bookId) !== change) return
  }
}

// A change keeps its identity while its status changes; a newer choice for the book is a new one.
function setStatus(change: CartChange, status: CartChange['status']): void {
  change.status = status
  update()
}

function getRetryDelay(response: Response | undefined, delay: number): number {
  let retryAfter = Number(response?.headers.get('Retry-After'))
  if (Number.isFinite(retryAfter) && retryAfter >= 0) return retryAfter * 1000
  // Spread retries so visitors who failed together don't retry together.
  return delay * (0.75 + Math.random() * 0.5)
}

function waitToRetry(bookId: number, delay: number): Promise<void> {
  return new Promise((resolve) => {
    let timeout = setTimeout(wake, delay)
    function wake() {
      clearTimeout(timeout)
      if (pause?.wake === wake) pause = undefined
      resolve()
    }
    pause = { bookId, wake }
  })
}

function isUnsent(change: CartChange): boolean {
  return change.status === 'saving' || change.status === 'retrying'
}

function update(): void {
  storeChanges()
  cartChanges.dispatchEvent(new Event('change'))
}

// Changes are kept for the tab until a frame shows the server's answer, so a reload or a full page
// load doesn't drop what the visitor already saw happen. A saved one is kept too: the next document
// may have been rendered before the save, and its frames reload to catch up. A failed one isn't,
// since the server's page is then the truth.
function storeChanges(): void {
  try {
    let kept = getCartChanges().filter((change) => change.status !== 'failed')
    if (kept.length === 0) sessionStorage.removeItem(STORAGE_KEY)
    else sessionStorage.setItem(STORAGE_KEY, JSON.stringify(kept))
  } catch {
    // Storage can be full or blocked, as in some private windows. Changes then last as long as the
    // document.
  }
}

function resumeStoredChanges(): void {
  if (typeof sessionStorage === 'undefined') return
  let stored: unknown
  try {
    stored = JSON.parse(sessionStorage.getItem(STORAGE_KEY) ?? '[]')
  } catch {
    return
  }
  if (!Array.isArray(stored)) return

  for (let change of stored) {
    if (!isStoredChange(change) || Date.now() - change.createdAt > MAX_RESUME_AGE) continue
    // Anything not known to be saved is sent again; sending the end state twice is harmless.
    changes.set(change.bookId, {
      ...change,
      status: change.status === 'saved' ? 'saved' : 'saving',
    })
  }
  update()
  void sendChanges()
}

function isStoredChange(value: unknown): value is CartChange {
  if (typeof value !== 'object' || value === null) return false
  let change = value as Record<string, unknown>
  return (
    Number.isInteger(change.bookId) &&
    Number.isInteger(change.quantity) &&
    typeof change.slug === 'string' &&
    typeof change.title === 'string' &&
    typeof change.price === 'number' &&
    typeof change.createdAt === 'number'
  )
}
