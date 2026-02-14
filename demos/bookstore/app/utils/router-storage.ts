import { createStorageKey } from 'remix/fetch-router'
import type { Router } from 'remix/fetch-router'

export let routerStorageKey = createStorageKey<Router>()
