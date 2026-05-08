// ../../../../../node_modules/.pnpm/solid-js@1.9.10/node_modules/solid-js/dist/solid.js
var sharedConfig = {
  context: void 0,
  registry: void 0,
  effects: void 0,
  done: false,
  getContextId() {
    return getContextId(this.context.count);
  },
  getNextContextId() {
    return getContextId(this.context.count++);
  }
};
function getContextId(count) {
  const num = String(count), len = num.length - 1;
  return sharedConfig.context.id + (len ? String.fromCharCode(96 + len) : "") + num;
}
function setHydrateContext(context) {
  sharedConfig.context = context;
}
function nextHydrateContext() {
  return {
    ...sharedConfig.context,
    id: sharedConfig.getNextContextId(),
    count: 0
  };
}
var IS_DEV = false;
var equalFn = (a, b) => a === b;
var $TRACK = /* @__PURE__ */ Symbol("solid-track");
var signalOptions = {
  equals: equalFn
};
var ERROR = null;
var runEffects = runQueue;
var STALE = 1;
var PENDING = 2;
var UNOWNED = {
  owned: null,
  cleanups: null,
  context: null,
  owner: null
};
var Owner = null;
var Transition = null;
var Scheduler = null;
var ExternalSourceConfig = null;
var Listener = null;
var Updates = null;
var Effects = null;
var ExecCount = 0;
function createRoot(fn, detachedOwner) {
  const listener = Listener, owner = Owner, unowned = fn.length === 0, current = detachedOwner === void 0 ? owner : detachedOwner, root = unowned ? UNOWNED : {
    owned: null,
    cleanups: null,
    context: current ? current.context : null,
    owner: current
  }, updateFn = unowned ? fn : () => fn(() => untrack(() => cleanNode(root)));
  Owner = root;
  Listener = null;
  try {
    return runUpdates(updateFn, true);
  } finally {
    Listener = listener;
    Owner = owner;
  }
}
function createSignal(value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const s = {
    value,
    observers: null,
    observerSlots: null,
    comparator: options.equals || void 0
  };
  const setter = (value2) => {
    if (typeof value2 === "function") {
      if (Transition && Transition.running && Transition.sources.has(s)) value2 = value2(s.tValue);
      else value2 = value2(s.value);
    }
    return writeSignal(s, value2);
  };
  return [readSignal.bind(s), setter];
}
function createRenderEffect(fn, value, options) {
  const c = createComputation(fn, value, false, STALE);
  if (Scheduler && Transition && Transition.running) Updates.push(c);
  else updateComputation(c);
}
function createMemo(fn, value, options) {
  options = options ? Object.assign({}, signalOptions, options) : signalOptions;
  const c = createComputation(fn, value, true, 0);
  c.observers = null;
  c.observerSlots = null;
  c.comparator = options.equals || void 0;
  if (Scheduler && Transition && Transition.running) {
    c.tState = STALE;
    Updates.push(c);
  } else updateComputation(c);
  return readSignal.bind(c);
}
function createSelector(source, fn = equalFn, options) {
  const subs = /* @__PURE__ */ new Map();
  const node = createComputation((p) => {
    const v = source();
    for (const [key, val] of subs.entries()) if (fn(key, v) !== fn(key, p)) {
      for (const c of val.values()) {
        c.state = STALE;
        if (c.pure) Updates.push(c);
        else Effects.push(c);
      }
    }
    return v;
  }, void 0, true, STALE);
  updateComputation(node);
  return (key) => {
    const listener = Listener;
    if (listener) {
      let l;
      if (l = subs.get(key)) l.add(listener);
      else subs.set(key, l = /* @__PURE__ */ new Set([listener]));
      onCleanup(() => {
        l.delete(listener);
        !l.size && subs.delete(key);
      });
    }
    return fn(key, Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value);
  };
}
function untrack(fn) {
  if (!ExternalSourceConfig && Listener === null) return fn();
  const listener = Listener;
  Listener = null;
  try {
    if (ExternalSourceConfig) return ExternalSourceConfig.untrack(fn);
    return fn();
  } finally {
    Listener = listener;
  }
}
function onCleanup(fn) {
  if (Owner === null) ;
  else if (Owner.cleanups === null) Owner.cleanups = [fn];
  else Owner.cleanups.push(fn);
  return fn;
}
function startTransition(fn) {
  if (Transition && Transition.running) {
    fn();
    return Transition.done;
  }
  const l = Listener;
  const o = Owner;
  return Promise.resolve().then(() => {
    Listener = l;
    Owner = o;
    let t;
    if (Scheduler || SuspenseContext) {
      t = Transition || (Transition = {
        sources: /* @__PURE__ */ new Set(),
        effects: [],
        promises: /* @__PURE__ */ new Set(),
        disposed: /* @__PURE__ */ new Set(),
        queue: /* @__PURE__ */ new Set(),
        running: true
      });
      t.done || (t.done = new Promise((res) => t.resolve = res));
      t.running = true;
    }
    runUpdates(fn, false);
    Listener = Owner = null;
    return t ? t.done : void 0;
  });
}
var [transPending, setTransPending] = /* @__PURE__ */ createSignal(false);
var SuspenseContext;
function readSignal() {
  const runningTransition = Transition && Transition.running;
  if (this.sources && (runningTransition ? this.tState : this.state)) {
    if ((runningTransition ? this.tState : this.state) === STALE) updateComputation(this);
    else {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(this), false);
      Updates = updates;
    }
  }
  if (Listener) {
    const sSlot = this.observers ? this.observers.length : 0;
    if (!Listener.sources) {
      Listener.sources = [this];
      Listener.sourceSlots = [sSlot];
    } else {
      Listener.sources.push(this);
      Listener.sourceSlots.push(sSlot);
    }
    if (!this.observers) {
      this.observers = [Listener];
      this.observerSlots = [Listener.sources.length - 1];
    } else {
      this.observers.push(Listener);
      this.observerSlots.push(Listener.sources.length - 1);
    }
  }
  if (runningTransition && Transition.sources.has(this)) return this.tValue;
  return this.value;
}
function writeSignal(node, value, isComp) {
  let current = Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value;
  if (!node.comparator || !node.comparator(current, value)) {
    if (Transition) {
      const TransitionRunning = Transition.running;
      if (TransitionRunning || !isComp && Transition.sources.has(node)) {
        Transition.sources.add(node);
        node.tValue = value;
      }
      if (!TransitionRunning) node.value = value;
    } else node.value = value;
    if (node.observers && node.observers.length) {
      runUpdates(() => {
        for (let i = 0; i < node.observers.length; i += 1) {
          const o = node.observers[i];
          const TransitionRunning = Transition && Transition.running;
          if (TransitionRunning && Transition.disposed.has(o)) continue;
          if (TransitionRunning ? !o.tState : !o.state) {
            if (o.pure) Updates.push(o);
            else Effects.push(o);
            if (o.observers) markDownstream(o);
          }
          if (!TransitionRunning) o.state = STALE;
          else o.tState = STALE;
        }
        if (Updates.length > 1e6) {
          Updates = [];
          if (IS_DEV) ;
          throw new Error();
        }
      }, false);
    }
  }
  return value;
}
function updateComputation(node) {
  if (!node.fn) return;
  cleanNode(node);
  const time = ExecCount;
  runComputation(node, Transition && Transition.running && Transition.sources.has(node) ? node.tValue : node.value, time);
  if (Transition && !Transition.running && Transition.sources.has(node)) {
    queueMicrotask(() => {
      runUpdates(() => {
        Transition && (Transition.running = true);
        Listener = Owner = node;
        runComputation(node, node.tValue, time);
        Listener = Owner = null;
      }, false);
    });
  }
}
function runComputation(node, value, time) {
  let nextValue;
  const owner = Owner, listener = Listener;
  Listener = Owner = node;
  try {
    nextValue = node.fn(value);
  } catch (err) {
    if (node.pure) {
      if (Transition && Transition.running) {
        node.tState = STALE;
        node.tOwned && node.tOwned.forEach(cleanNode);
        node.tOwned = void 0;
      } else {
        node.state = STALE;
        node.owned && node.owned.forEach(cleanNode);
        node.owned = null;
      }
    }
    node.updatedAt = time + 1;
    return handleError(err);
  } finally {
    Listener = listener;
    Owner = owner;
  }
  if (!node.updatedAt || node.updatedAt <= time) {
    if (node.updatedAt != null && "observers" in node) {
      writeSignal(node, nextValue, true);
    } else if (Transition && Transition.running && node.pure) {
      Transition.sources.add(node);
      node.tValue = nextValue;
    } else node.value = nextValue;
    node.updatedAt = time;
  }
}
function createComputation(fn, init, pure, state = STALE, options) {
  const c = {
    fn,
    state,
    updatedAt: null,
    owned: null,
    sources: null,
    sourceSlots: null,
    cleanups: null,
    value: init,
    owner: Owner,
    context: Owner ? Owner.context : null,
    pure
  };
  if (Transition && Transition.running) {
    c.state = 0;
    c.tState = state;
  }
  if (Owner === null) ;
  else if (Owner !== UNOWNED) {
    if (Transition && Transition.running && Owner.pure) {
      if (!Owner.tOwned) Owner.tOwned = [c];
      else Owner.tOwned.push(c);
    } else {
      if (!Owner.owned) Owner.owned = [c];
      else Owner.owned.push(c);
    }
  }
  if (ExternalSourceConfig && c.fn) {
    const [track, trigger] = createSignal(void 0, {
      equals: false
    });
    const ordinary = ExternalSourceConfig.factory(c.fn, trigger);
    onCleanup(() => ordinary.dispose());
    const triggerInTransition = () => startTransition(trigger).then(() => inTransition.dispose());
    const inTransition = ExternalSourceConfig.factory(c.fn, triggerInTransition);
    c.fn = (x) => {
      track();
      return Transition && Transition.running ? inTransition.track(x) : ordinary.track(x);
    };
  }
  return c;
}
function runTop(node) {
  const runningTransition = Transition && Transition.running;
  if ((runningTransition ? node.tState : node.state) === 0) return;
  if ((runningTransition ? node.tState : node.state) === PENDING) return lookUpstream(node);
  if (node.suspense && untrack(node.suspense.inFallback)) return node.suspense.effects.push(node);
  const ancestors = [node];
  while ((node = node.owner) && (!node.updatedAt || node.updatedAt < ExecCount)) {
    if (runningTransition && Transition.disposed.has(node)) return;
    if (runningTransition ? node.tState : node.state) ancestors.push(node);
  }
  for (let i = ancestors.length - 1; i >= 0; i--) {
    node = ancestors[i];
    if (runningTransition) {
      let top = node, prev = ancestors[i + 1];
      while ((top = top.owner) && top !== prev) {
        if (Transition.disposed.has(top)) return;
      }
    }
    if ((runningTransition ? node.tState : node.state) === STALE) {
      updateComputation(node);
    } else if ((runningTransition ? node.tState : node.state) === PENDING) {
      const updates = Updates;
      Updates = null;
      runUpdates(() => lookUpstream(node, ancestors[0]), false);
      Updates = updates;
    }
  }
}
function runUpdates(fn, init) {
  if (Updates) return fn();
  let wait = false;
  if (!init) Updates = [];
  if (Effects) wait = true;
  else Effects = [];
  ExecCount++;
  try {
    const res = fn();
    completeUpdates(wait);
    return res;
  } catch (err) {
    if (!wait) Effects = null;
    Updates = null;
    handleError(err);
  }
}
function completeUpdates(wait) {
  if (Updates) {
    if (Scheduler && Transition && Transition.running) scheduleQueue(Updates);
    else runQueue(Updates);
    Updates = null;
  }
  if (wait) return;
  let res;
  if (Transition) {
    if (!Transition.promises.size && !Transition.queue.size) {
      const sources = Transition.sources;
      const disposed = Transition.disposed;
      Effects.push.apply(Effects, Transition.effects);
      res = Transition.resolve;
      for (const e2 of Effects) {
        "tState" in e2 && (e2.state = e2.tState);
        delete e2.tState;
      }
      Transition = null;
      runUpdates(() => {
        for (const d of disposed) cleanNode(d);
        for (const v of sources) {
          v.value = v.tValue;
          if (v.owned) {
            for (let i = 0, len = v.owned.length; i < len; i++) cleanNode(v.owned[i]);
          }
          if (v.tOwned) v.owned = v.tOwned;
          delete v.tValue;
          delete v.tOwned;
          v.tState = 0;
        }
        setTransPending(false);
      }, false);
    } else if (Transition.running) {
      Transition.running = false;
      Transition.effects.push.apply(Transition.effects, Effects);
      Effects = null;
      setTransPending(true);
      return;
    }
  }
  const e = Effects;
  Effects = null;
  if (e.length) runUpdates(() => runEffects(e), false);
  if (res) res();
}
function runQueue(queue) {
  for (let i = 0; i < queue.length; i++) runTop(queue[i]);
}
function scheduleQueue(queue) {
  for (let i = 0; i < queue.length; i++) {
    const item = queue[i];
    const tasks = Transition.queue;
    if (!tasks.has(item)) {
      tasks.add(item);
      Scheduler(() => {
        tasks.delete(item);
        runUpdates(() => {
          Transition.running = true;
          runTop(item);
        }, false);
        Transition && (Transition.running = false);
      });
    }
  }
}
function lookUpstream(node, ignore) {
  const runningTransition = Transition && Transition.running;
  if (runningTransition) node.tState = 0;
  else node.state = 0;
  for (let i = 0; i < node.sources.length; i += 1) {
    const source = node.sources[i];
    if (source.sources) {
      const state = runningTransition ? source.tState : source.state;
      if (state === STALE) {
        if (source !== ignore && (!source.updatedAt || source.updatedAt < ExecCount)) runTop(source);
      } else if (state === PENDING) lookUpstream(source, ignore);
    }
  }
}
function markDownstream(node) {
  const runningTransition = Transition && Transition.running;
  for (let i = 0; i < node.observers.length; i += 1) {
    const o = node.observers[i];
    if (runningTransition ? !o.tState : !o.state) {
      if (runningTransition) o.tState = PENDING;
      else o.state = PENDING;
      if (o.pure) Updates.push(o);
      else Effects.push(o);
      o.observers && markDownstream(o);
    }
  }
}
function cleanNode(node) {
  let i;
  if (node.sources) {
    while (node.sources.length) {
      const source = node.sources.pop(), index = node.sourceSlots.pop(), obs = source.observers;
      if (obs && obs.length) {
        const n = obs.pop(), s = source.observerSlots.pop();
        if (index < obs.length) {
          n.sourceSlots[s] = index;
          obs[index] = n;
          source.observerSlots[index] = s;
        }
      }
    }
  }
  if (node.tOwned) {
    for (i = node.tOwned.length - 1; i >= 0; i--) cleanNode(node.tOwned[i]);
    delete node.tOwned;
  }
  if (Transition && Transition.running && node.pure) {
    reset(node, true);
  } else if (node.owned) {
    for (i = node.owned.length - 1; i >= 0; i--) cleanNode(node.owned[i]);
    node.owned = null;
  }
  if (node.cleanups) {
    for (i = node.cleanups.length - 1; i >= 0; i--) node.cleanups[i]();
    node.cleanups = null;
  }
  if (Transition && Transition.running) node.tState = 0;
  else node.state = 0;
}
function reset(node, top) {
  if (!top) {
    node.tState = 0;
    Transition.disposed.add(node);
  }
  if (node.owned) {
    for (let i = 0; i < node.owned.length; i++) reset(node.owned[i]);
  }
}
function castError(err) {
  if (err instanceof Error) return err;
  return new Error(typeof err === "string" ? err : "Unknown error", {
    cause: err
  });
}
function runErrors(err, fns, owner) {
  try {
    for (const f of fns) f(err);
  } catch (e) {
    handleError(e, owner && owner.owner || null);
  }
}
function handleError(err, owner = Owner) {
  const fns = ERROR && owner && owner.context && owner.context[ERROR];
  const error = castError(err);
  if (!fns) throw error;
  if (Effects) Effects.push({
    fn() {
      runErrors(error, fns, owner);
    },
    state: STALE
  });
  else runErrors(error, fns, owner);
}
var FALLBACK = /* @__PURE__ */ Symbol("fallback");
function dispose(d) {
  for (let i = 0; i < d.length; i++) d[i]();
}
function mapArray(list, mapFn, options = {}) {
  let items = [], mapped = [], disposers = [], len = 0, indexes = mapFn.length > 1 ? [] : null;
  onCleanup(() => dispose(disposers));
  return () => {
    let newItems = list() || [], newLen = newItems.length, i, j;
    newItems[$TRACK];
    return untrack(() => {
      let newIndices, newIndicesNext, temp, tempdisposers, tempIndexes, start, end, newEnd, item;
      if (newLen === 0) {
        if (len !== 0) {
          dispose(disposers);
          disposers = [];
          items = [];
          mapped = [];
          len = 0;
          indexes && (indexes = []);
        }
        if (options.fallback) {
          items = [FALLBACK];
          mapped[0] = createRoot((disposer) => {
            disposers[0] = disposer;
            return options.fallback();
          });
          len = 1;
        }
      } else if (len === 0) {
        mapped = new Array(newLen);
        for (j = 0; j < newLen; j++) {
          items[j] = newItems[j];
          mapped[j] = createRoot(mapper);
        }
        len = newLen;
      } else {
        temp = new Array(newLen);
        tempdisposers = new Array(newLen);
        indexes && (tempIndexes = new Array(newLen));
        for (start = 0, end = Math.min(len, newLen); start < end && items[start] === newItems[start]; start++) ;
        for (end = len - 1, newEnd = newLen - 1; end >= start && newEnd >= start && items[end] === newItems[newEnd]; end--, newEnd--) {
          temp[newEnd] = mapped[end];
          tempdisposers[newEnd] = disposers[end];
          indexes && (tempIndexes[newEnd] = indexes[end]);
        }
        newIndices = /* @__PURE__ */ new Map();
        newIndicesNext = new Array(newEnd + 1);
        for (j = newEnd; j >= start; j--) {
          item = newItems[j];
          i = newIndices.get(item);
          newIndicesNext[j] = i === void 0 ? -1 : i;
          newIndices.set(item, j);
        }
        for (i = start; i <= end; i++) {
          item = items[i];
          j = newIndices.get(item);
          if (j !== void 0 && j !== -1) {
            temp[j] = mapped[i];
            tempdisposers[j] = disposers[i];
            indexes && (tempIndexes[j] = indexes[i]);
            j = newIndicesNext[j];
            newIndices.set(item, j);
          } else disposers[i]();
        }
        for (j = start; j < newLen; j++) {
          if (j in temp) {
            mapped[j] = temp[j];
            disposers[j] = tempdisposers[j];
            if (indexes) {
              indexes[j] = tempIndexes[j];
              indexes[j](j);
            }
          } else mapped[j] = createRoot(mapper);
        }
        mapped = mapped.slice(0, len = newLen);
        items = newItems.slice(0);
      }
      return mapped;
    });
    function mapper(disposer) {
      disposers[j] = disposer;
      if (indexes) {
        const [s, set] = createSignal(j);
        indexes[j] = set;
        return mapFn(newItems[j], s);
      }
      return mapFn(newItems[j]);
    }
  };
}
var hydrationEnabled = false;
function createComponent(Comp, props) {
  if (hydrationEnabled) {
    if (sharedConfig.context) {
      const c = sharedConfig.context;
      setHydrateContext(nextHydrateContext());
      const r = untrack(() => Comp(props || {}));
      setHydrateContext(c);
      return r;
    }
  }
  return untrack(() => Comp(props || {}));
}
function For(props) {
  const fallback = "fallback" in props && {
    fallback: () => props.fallback
  };
  return createMemo(mapArray(() => props.each, props.children, fallback || void 0));
}

// ../../../../../node_modules/.pnpm/solid-js@1.9.10/node_modules/solid-js/web/dist/web.js
var booleans = [
  "allowfullscreen",
  "async",
  "alpha",
  "autofocus",
  "autoplay",
  "checked",
  "controls",
  "default",
  "disabled",
  "formnovalidate",
  "hidden",
  "indeterminate",
  "inert",
  "ismap",
  "loop",
  "multiple",
  "muted",
  "nomodule",
  "novalidate",
  "open",
  "playsinline",
  "readonly",
  "required",
  "reversed",
  "seamless",
  "selected",
  "adauctionheaders",
  "browsingtopics",
  "credentialless",
  "defaultchecked",
  "defaultmuted",
  "defaultselected",
  "defer",
  "disablepictureinpicture",
  "disableremoteplayback",
  "preservespitch",
  "shadowrootclonable",
  "shadowrootcustomelementregistry",
  "shadowrootdelegatesfocus",
  "shadowrootserializable",
  "sharedstoragewritable"
];
var Properties = /* @__PURE__ */ new Set([
  "className",
  "value",
  "readOnly",
  "noValidate",
  "formNoValidate",
  "isMap",
  "noModule",
  "playsInline",
  "adAuctionHeaders",
  "allowFullscreen",
  "browsingTopics",
  "defaultChecked",
  "defaultMuted",
  "defaultSelected",
  "disablePictureInPicture",
  "disableRemotePlayback",
  "preservesPitch",
  "shadowRootClonable",
  "shadowRootCustomElementRegistry",
  "shadowRootDelegatesFocus",
  "shadowRootSerializable",
  "sharedStorageWritable",
  ...booleans
]);
var memo = (fn) => createMemo(() => fn());
function reconcileArrays(parentNode, a, b) {
  let bLength = b.length, aEnd = a.length, bEnd = bLength, aStart = 0, bStart = 0, after = a[aEnd - 1].nextSibling, map = null;
  while (aStart < aEnd || bStart < bEnd) {
    if (a[aStart] === b[bStart]) {
      aStart++;
      bStart++;
      continue;
    }
    while (a[aEnd - 1] === b[bEnd - 1]) {
      aEnd--;
      bEnd--;
    }
    if (aEnd === aStart) {
      const node = bEnd < bLength ? bStart ? b[bStart - 1].nextSibling : b[bEnd - bStart] : after;
      while (bStart < bEnd) parentNode.insertBefore(b[bStart++], node);
    } else if (bEnd === bStart) {
      while (aStart < aEnd) {
        if (!map || !map.has(a[aStart])) a[aStart].remove();
        aStart++;
      }
    } else if (a[aStart] === b[bEnd - 1] && b[bStart] === a[aEnd - 1]) {
      const node = a[--aEnd].nextSibling;
      parentNode.insertBefore(b[bStart++], a[aStart++].nextSibling);
      parentNode.insertBefore(b[--bEnd], node);
      a[aEnd] = b[bEnd];
    } else {
      if (!map) {
        map = /* @__PURE__ */ new Map();
        let i = bStart;
        while (i < bEnd) map.set(b[i], i++);
      }
      const index = map.get(a[aStart]);
      if (index != null) {
        if (bStart < index && index < bEnd) {
          let i = aStart, sequence = 1, t;
          while (++i < aEnd && i < bEnd) {
            if ((t = map.get(a[i])) == null || t !== index + sequence) break;
            sequence++;
          }
          if (sequence > index - bStart) {
            const node = a[aStart];
            while (bStart < index) parentNode.insertBefore(b[bStart++], node);
          } else parentNode.replaceChild(b[bStart++], a[aStart++]);
        } else aStart++;
      } else a[aStart++].remove();
    }
  }
}
var $$EVENTS = "_$DX_DELEGATE";
function render(code, element, init, options = {}) {
  let disposer;
  createRoot((dispose2) => {
    disposer = dispose2;
    element === document ? code() : insert(element, code(), element.firstChild ? null : void 0, init);
  }, options.owner);
  return () => {
    disposer();
    element.textContent = "";
  };
}
function template(html, isImportNode, isSVG, isMathML) {
  let node;
  const create = () => {
    const t = isMathML ? document.createElementNS("http://www.w3.org/1998/Math/MathML", "template") : document.createElement("template");
    t.innerHTML = html;
    return isSVG ? t.content.firstChild.firstChild : isMathML ? t.firstChild : t.content.firstChild;
  };
  const fn = isImportNode ? () => untrack(() => document.importNode(node || (node = create()), true)) : () => (node || (node = create())).cloneNode(true);
  fn.cloneNode = fn;
  return fn;
}
function delegateEvents(eventNames, document2 = window.document) {
  const e = document2[$$EVENTS] || (document2[$$EVENTS] = /* @__PURE__ */ new Set());
  for (let i = 0, l = eventNames.length; i < l; i++) {
    const name2 = eventNames[i];
    if (!e.has(name2)) {
      e.add(name2);
      document2.addEventListener(name2, eventHandler);
    }
  }
}
function setAttribute(node, name2, value) {
  if (isHydrating(node)) return;
  if (value == null) node.removeAttribute(name2);
  else node.setAttribute(name2, value);
}
function className(node, value) {
  if (isHydrating(node)) return;
  if (value == null) node.removeAttribute("class");
  else node.className = value;
}
function addEventListener(node, name2, handler, delegate) {
  if (delegate) {
    if (Array.isArray(handler)) {
      node[`$$${name2}`] = handler[0];
      node[`$$${name2}Data`] = handler[1];
    } else node[`$$${name2}`] = handler;
  } else if (Array.isArray(handler)) {
    const handlerFn = handler[0];
    node.addEventListener(name2, handler[0] = (e) => handlerFn.call(node, handler[1], e));
  } else node.addEventListener(name2, handler, typeof handler !== "function" && handler);
}
function setStyleProperty(node, name2, value) {
  value != null ? node.style.setProperty(name2, value) : node.style.removeProperty(name2);
}
function insert(parent, accessor, marker, initial) {
  if (marker !== void 0 && !initial) initial = [];
  if (typeof accessor !== "function") return insertExpression(parent, accessor, initial, marker);
  createRenderEffect((current) => insertExpression(parent, accessor(), current, marker), initial);
}
function isHydrating(node) {
  return !!sharedConfig.context && !sharedConfig.done && (!node || node.isConnected);
}
function eventHandler(e) {
  if (sharedConfig.registry && sharedConfig.events) {
    if (sharedConfig.events.find(([el2, ev]) => ev === e)) return;
  }
  let node = e.target;
  const key = `$$${e.type}`;
  const oriTarget = e.target;
  const oriCurrentTarget = e.currentTarget;
  const retarget = (value) => Object.defineProperty(e, "target", {
    configurable: true,
    value
  });
  const handleNode = () => {
    const handler = node[key];
    if (handler && !node.disabled) {
      const data = node[`${key}Data`];
      data !== void 0 ? handler.call(node, data, e) : handler.call(node, e);
      if (e.cancelBubble) return;
    }
    node.host && typeof node.host !== "string" && !node.host._$host && node.contains(e.target) && retarget(node.host);
    return true;
  };
  const walkUpTree = () => {
    while (handleNode() && (node = node._$host || node.parentNode || node.host)) ;
  };
  Object.defineProperty(e, "currentTarget", {
    configurable: true,
    get() {
      return node || document;
    }
  });
  if (sharedConfig.registry && !sharedConfig.done) sharedConfig.done = _$HY.done = true;
  if (e.composedPath) {
    const path = e.composedPath();
    retarget(path[0]);
    for (let i = 0; i < path.length - 2; i++) {
      node = path[i];
      if (!handleNode()) break;
      if (node._$host) {
        node = node._$host;
        walkUpTree();
        break;
      }
      if (node.parentNode === oriCurrentTarget) {
        break;
      }
    }
  } else walkUpTree();
  retarget(oriTarget);
}
function insertExpression(parent, value, current, marker, unwrapArray) {
  const hydrating = isHydrating(parent);
  if (hydrating) {
    !current && (current = [...parent.childNodes]);
    let cleaned = [];
    for (let i = 0; i < current.length; i++) {
      const node = current[i];
      if (node.nodeType === 8 && node.data.slice(0, 2) === "!$") node.remove();
      else cleaned.push(node);
    }
    current = cleaned;
  }
  while (typeof current === "function") current = current();
  if (value === current) return current;
  const t = typeof value, multi = marker !== void 0;
  parent = multi && current[0] && current[0].parentNode || parent;
  if (t === "string" || t === "number") {
    if (hydrating) return current;
    if (t === "number") {
      value = value.toString();
      if (value === current) return current;
    }
    if (multi) {
      let node = current[0];
      if (node && node.nodeType === 3) {
        node.data !== value && (node.data = value);
      } else node = document.createTextNode(value);
      current = cleanChildren(parent, current, marker, node);
    } else {
      if (current !== "" && typeof current === "string") {
        current = parent.firstChild.data = value;
      } else current = parent.textContent = value;
    }
  } else if (value == null || t === "boolean") {
    if (hydrating) return current;
    current = cleanChildren(parent, current, marker);
  } else if (t === "function") {
    createRenderEffect(() => {
      let v = value();
      while (typeof v === "function") v = v();
      current = insertExpression(parent, v, current, marker);
    });
    return () => current;
  } else if (Array.isArray(value)) {
    const array = [];
    const currentArray = current && Array.isArray(current);
    if (normalizeIncomingArray(array, value, current, unwrapArray)) {
      createRenderEffect(() => current = insertExpression(parent, array, current, marker, true));
      return () => current;
    }
    if (hydrating) {
      if (!array.length) return current;
      if (marker === void 0) return current = [...parent.childNodes];
      let node = array[0];
      if (node.parentNode !== parent) return current;
      const nodes = [node];
      while ((node = node.nextSibling) !== marker) nodes.push(node);
      return current = nodes;
    }
    if (array.length === 0) {
      current = cleanChildren(parent, current, marker);
      if (multi) return current;
    } else if (currentArray) {
      if (current.length === 0) {
        appendNodes(parent, array, marker);
      } else reconcileArrays(parent, current, array);
    } else {
      current && cleanChildren(parent);
      appendNodes(parent, array);
    }
    current = array;
  } else if (value.nodeType) {
    if (hydrating && value.parentNode) return current = multi ? [value] : value;
    if (Array.isArray(current)) {
      if (multi) return current = cleanChildren(parent, current, marker, value);
      cleanChildren(parent, current, null, value);
    } else if (current == null || current === "" || !parent.firstChild) {
      parent.appendChild(value);
    } else parent.replaceChild(value, parent.firstChild);
    current = value;
  } else ;
  return current;
}
function normalizeIncomingArray(normalized, array, current, unwrap) {
  let dynamic = false;
  for (let i = 0, len = array.length; i < len; i++) {
    let item = array[i], prev = current && current[normalized.length], t;
    if (item == null || item === true || item === false) ;
    else if ((t = typeof item) === "object" && item.nodeType) {
      normalized.push(item);
    } else if (Array.isArray(item)) {
      dynamic = normalizeIncomingArray(normalized, item, prev) || dynamic;
    } else if (t === "function") {
      if (unwrap) {
        while (typeof item === "function") item = item();
        dynamic = normalizeIncomingArray(normalized, Array.isArray(item) ? item : [item], Array.isArray(prev) ? prev : [prev]) || dynamic;
      } else {
        normalized.push(item);
        dynamic = true;
      }
    } else {
      const value = String(item);
      if (prev && prev.nodeType === 3 && prev.data === value) normalized.push(prev);
      else normalized.push(document.createTextNode(value));
    }
  }
  return dynamic;
}
function appendNodes(parent, array, marker = null) {
  for (let i = 0, len = array.length; i < len; i++) parent.insertBefore(array[i], marker);
}
function cleanChildren(parent, current, marker, replacement) {
  if (marker === void 0) return parent.textContent = "";
  const node = replacement || document.createTextNode("");
  if (current.length) {
    let inserted = false;
    for (let i = current.length - 1; i >= 0; i--) {
      const el2 = current[i];
      if (node !== el2) {
        const isParent = el2.parentNode === parent;
        if (!inserted && !i) isParent ? parent.replaceChild(node, el2) : parent.insertBefore(node, marker);
        else isParent && el2.remove();
      } else inserted = true;
    }
  } else parent.insertBefore(node, marker);
  return [node];
}

// ../shared.ts
var idCounter = 1;
var A = [
  "pretty",
  "large",
  "big",
  "small",
  "tall",
  "short",
  "long",
  "handsome",
  "plain",
  "quaint",
  "clean",
  "elegant",
  "easy",
  "angry",
  "crazy",
  "helpful",
  "mushy",
  "odd",
  "unsightly",
  "adorable",
  "important",
  "inexpensive",
  "cheap",
  "expensive",
  "fancy"
];
var C = [
  "red",
  "yellow",
  "blue",
  "green",
  "pink",
  "brown",
  "purple",
  "brown",
  "white",
  "black",
  "orange"
];
var N = [
  "table",
  "chair",
  "house",
  "bbq",
  "desk",
  "car",
  "pony",
  "cookie",
  "sandwich",
  "burger",
  "pizza",
  "mouse",
  "keyboard"
];
function buildData(count) {
  let data = new Array(count);
  for (let i = 0; i < count; i++) {
    data[i] = {
      id: idCounter++,
      label: `${A[i % A.length]} ${C[i % C.length]} ${N[i % N.length]}`
    };
  }
  return data;
}
function get1000Rows() {
  return buildData(1e3);
}
function get10000Rows() {
  return buildData(1e4);
}
function updatedEvery10thRow(data) {
  let newData = data.slice(0);
  for (let i = 0, d = data, len = d.length; i < len; i += 10) {
    newData[i] = { id: data[i].id, label: data[i].label + " !!!" };
  }
  return newData;
}
function swapRows(data) {
  let d = data.slice();
  if (d.length > 998) {
    let tmp = d[1];
    d[1] = d[998];
    d[998] = tmp;
  }
  return d;
}
function remove(data, id) {
  return data.filter((d) => d.id !== id);
}
function sortRows(data, ascending = true) {
  let sorted = data.slice().sort((a, b) => {
    if (ascending) {
      return a.label.localeCompare(b.label);
    } else {
      return b.label.localeCompare(a.label);
    }
  });
  return sorted;
}

// index.tsx
var _tmpl$ = /* @__PURE__ */ template(`<div tabindex=0 style="transition:all 0.2s;padding:20px;border:1px solid #ddd;border-radius:8px;cursor:pointer"><div style=font-size:14px;color:#666;margin-bottom:8px></div><div style=font-size:24px;font-weight:bold;margin-bottom:4px></div><div style=font-size:12px>`);
var _tmpl$2 = /* @__PURE__ */ template(`<div class=chart-bar tabindex=0 style="width:30px;margin:0 2px;cursor:pointer;transition:all 0.2s">`);
var _tmpl$3 = /* @__PURE__ */ template(`<li style="padding:12px;border-bottom:1px solid #eee;cursor:pointer;display:flex;align-items:center;gap:12px"><span style=width:32px;height:32px;border-radius:50%;background-color:#337ab7;color:#fff;display:flex;align-items:center;justify-content:center;font-weight:bold></span><div style=flex:1><div></div><div style=font-size:12px;color:#666>`);
var _tmpl$4 = /* @__PURE__ */ template(`<div style=position:relative;display:inline-block><button class="btn btn-primary"style="padding:4px 8px;font-size:12px">\u22EE`);
var _tmpl$5 = /* @__PURE__ */ template(`<div style="position:absolute;top:100%;right:0;background-color:#fff;border:1px solid #ddd;border-radius:4px;box-shadow:0 4px 8px rgba(0,0,0,0.1);z-index:1000;min-width:150px;margin-top:4px">`);
var _tmpl$6 = /* @__PURE__ */ template(`<div style="padding:8px 12px;cursor:pointer">`);
var _tmpl$7 = /* @__PURE__ */ template(`<tr style=cursor:pointer><td style="padding:12px;border-top:1px solid #ddd"></td><td style="padding:12px;border-top:1px solid #ddd"></td><td style="padding:12px;border-top:1px solid #ddd"><span style=color:#28a745>Active</span></td><td style="padding:12px;border-top:1px solid #ddd">$</td><td style="padding:12px;border-top:1px solid #ddd">`);
var _tmpl$8 = /* @__PURE__ */ template(`<input type=text placeholder=Search... style="padding:8px 12px;border-radius:4px;font-size:14px;width:300px;outline-offset:2px">`);
var _tmpl$9 = /* @__PURE__ */ template(`<div style=padding:20px;background-color:#f9f9f9;border-radius:8px><h3 style=margin-top:0;margin-bottom:16px>Settings</h3><div style=margin-bottom:16px><label style=display:block;margin-bottom:4px;font-size:14px>Select Option</label><select style="padding:6px 12px;border:1px solid #ddd;border-radius:4px;font-size:14px;width:100%"><option value=option1>Option 1</option><option value=option2>Option 2</option><option value=option3>Option 3</option><option value=option4>Option 4</option></select></div><div style=margin-bottom:16px></div><div style=margin-bottom:16px><label style=display:block;margin-bottom:4px;font-size:14px>Toggle Switch</label><label style=display:inline-block;position:relative;width:50px;height:24px;cursor:pointer><input type=checkbox style=opacity:0;width:0;height:0><span style="position:absolute;top:0;left:0;right:0;bottom:0;border-radius:24px;transition:background-color 0.3s"><span style="position:absolute;content:&quot;&quot;;height:18px;width:18px;left:3px;bottom:3px;background-color:#fff;border-radius:50%;transition:transform 0.3s"></span></span></label></div><div><label style=display:block;margin-bottom:4px;font-size:14px>Progress Bar</label><div style=width:100%;height:24px;background-color:#eee;border-radius:4px;overflow:hidden;position:relative><div style="height:100%;background-color:#337ab7;transition:width 0.3s;display:flex;align-items:center;justify-content:center;color:#fff;font-size:12px">%`);
var _tmpl$0 = /* @__PURE__ */ template(`<div style=margin-bottom:12px;display:flex;align-items:center;gap:8px><input type=checkbox><label style=font-size:14px;cursor:pointer>`);
var _tmpl$1 = /* @__PURE__ */ template(`<label style=display:block;margin-bottom:8px;cursor:pointer><input type=radio name=radio-group style=margin-right:8px>`);
var _tmpl$10 = /* @__PURE__ */ template(`<div class=container style=max-width:1400px><div style=display:flex;margin-bottom:20px;align-items:center;justify-content:space-between><h1 style=margin:0>Dashboard</h1><button id=switchToTable class="btn btn-primary"type=button>Switch to Table</button></div><div style=display:flex;gap:20px;margin-bottom:20px><div style=flex:1;display:flex;gap:16px></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:20px;margin-bottom:20px"><div style="padding:20px;background-color:#fff;border:1px solid #ddd;border-radius:8px"><h3 style=margin-top:0;margin-bottom:16px>Sales Performance</h3><div style="display:flex;align-items:flex-end;justify-content:space-around;height:200px;padding:20px 0"></div></div><div style="padding:20px;background-color:#fff;border:1px solid #ddd;border-radius:8px"><h3 style=margin-top:0;margin-bottom:16px>Recent Activity</h3><ul style=list-style:none;padding:0;margin:0;max-height:200px;overflow-y:auto></ul></div></div><div style=margin-bottom:20px><div style=display:flex;justify-content:space-between;align-items:center;margin-bottom:12px><div style=display:flex;align-items:center;gap:12px><h3 style=margin:0>Dashboard Items</h3><button id=sortDashboardAsc class="btn btn-primary"type=button style="padding:4px 8px;font-size:12px">Sort \u2191</button><button id=sortDashboardDesc class="btn btn-primary"type=button style="padding:4px 8px;font-size:12px">Sort \u2193</button></div></div><div style="background-color:#fff;border:1px solid #ddd;border-radius:8px;overflow:hidden"><table style=width:100%;border-collapse:collapse><thead><tr style=background-color:#f5f5f5><th style="padding:12px;text-align:left;border-bottom:2px solid #ddd">ID</th><th style="padding:12px;text-align:left;border-bottom:2px solid #ddd">Label</th><th style="padding:12px;text-align:left;border-bottom:2px solid #ddd">Status</th><th style="padding:12px;text-align:left;border-bottom:2px solid #ddd">Value</th><th style="padding:12px;text-align:left;border-bottom:2px solid #ddd">Actions</th></tr></thead><tbody>`);
var _tmpl$11 = /* @__PURE__ */ template(`<div class=container><div class=jumbotron><div class=row><div class=col-md-6><h1>SolidJS</h1></div><div class=col-md-6><div class=row><div class="col-sm-6 smallpad"><button id=run class="btn btn-primary btn-block"type=button>Create 1,000 rows</button></div><div class="col-sm-6 smallpad"><button id=runlots class="btn btn-primary btn-block"type=button>Create 10,000 rows</button></div><div class="col-sm-6 smallpad"><button id=add class="btn btn-primary btn-block"type=button>Append 1,000 rows</button></div><div class="col-sm-6 smallpad"><button id=update class="btn btn-primary btn-block"type=button>Update every 10th row</button></div><div class="col-sm-6 smallpad"><button id=clear class="btn btn-primary btn-block"type=button>Clear</button></div><div class="col-sm-6 smallpad"><button id=swaprows class="btn btn-primary btn-block"type=button>Swap Rows</button></div><div class="col-sm-6 smallpad"><button id=sortasc class="btn btn-primary btn-block"type=button>Sort Ascending</button></div><div class="col-sm-6 smallpad"><button id=sortdesc class="btn btn-primary btn-block"type=button>Sort Descending</button></div><div class="col-sm-6 smallpad"><button id=switchToDashboard class="btn btn-primary btn-block"type=button>Switch to Dashboard</button></div></div></div></div></div><table class="table table-hover table-striped test-data"><tbody></tbody></table><span class="preloadicon glyphicon glyphicon-remove"aria-hidden=true>`);
var _tmpl$12 = /* @__PURE__ */ template(`<tr><td class=col-md-1></td><td class=col-md-4><a href=#></a></td><td class=col-md-1><a href=#><span class="glyphicon glyphicon-remove"aria-hidden=true></span></a></td><td class=col-md-6>`);
var name = "solid";
function MetricCard(props) {
  let [selected, setSelected] = createSignal(false);
  let [hovered, setHovered] = createSignal(false);
  return (() => {
    var _el$ = _tmpl$(), _el$2 = _el$.firstChild, _el$3 = _el$2.nextSibling, _el$4 = _el$3.nextSibling;
    _el$.addEventListener("blur", (e) => {
      e.currentTarget.style.outline = "";
    });
    _el$.addEventListener("focus", (e) => {
      e.currentTarget.style.outline = "2px solid #222";
      e.currentTarget.style.outlineOffset = "2px";
    });
    _el$.addEventListener("mouseleave", () => setHovered(false));
    _el$.addEventListener("mouseenter", () => setHovered(true));
    _el$.$$click = () => setSelected(!selected());
    insert(_el$2, () => props.label);
    insert(_el$3, () => props.value);
    insert(_el$4, () => props.change);
    createRenderEffect((_p$) => {
      var _v$ = `metric-card ${selected() ? "selected" : ""}`, _v$2 = hovered() ? "#f5f5f5" : "#fff", _v$3 = hovered() && !selected() ? "translateY(-2px)" : "translateY(0)", _v$4 = selected() ? "0 4px 8px rgba(0,0,0,0.1)" : "0 2px 4px rgba(0,0,0,0.05)", _v$5 = props.change.startsWith("+") ? "#28a745" : "#dc3545";
      _v$ !== _p$.e && className(_el$, _p$.e = _v$);
      _v$2 !== _p$.t && setStyleProperty(_el$, "background-color", _p$.t = _v$2);
      _v$3 !== _p$.a && setStyleProperty(_el$, "transform", _p$.a = _v$3);
      _v$4 !== _p$.o && setStyleProperty(_el$, "box-shadow", _p$.o = _v$4);
      _v$5 !== _p$.i && setStyleProperty(_el$4, "color", _p$.i = _v$5);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0,
      i: void 0
    });
    return _el$;
  })();
}
function ChartBar(props) {
  let [hovered, setHovered] = createSignal(false);
  return (() => {
    var _el$5 = _tmpl$2();
    _el$5.addEventListener("blur", (e) => {
      e.currentTarget.style.outline = "";
    });
    _el$5.addEventListener("focus", (e) => {
      e.currentTarget.style.outline = "2px solid #222";
      e.currentTarget.style.outlineOffset = "2px";
    });
    _el$5.addEventListener("mouseleave", () => setHovered(false));
    _el$5.addEventListener("mouseenter", () => setHovered(true));
    _el$5.$$click = () => {
    };
    createRenderEffect((_p$) => {
      var _v$6 = `${props.value}%`, _v$7 = hovered() ? "#286090" : "#337ab7", _v$8 = hovered() ? 0.9 : 1, _v$9 = hovered() ? "scaleY(1.1)" : "scaleY(1)";
      _v$6 !== _p$.e && setStyleProperty(_el$5, "height", _p$.e = _v$6);
      _v$7 !== _p$.t && setStyleProperty(_el$5, "background-color", _p$.t = _v$7);
      _v$8 !== _p$.a && setStyleProperty(_el$5, "opacity", _p$.a = _v$8);
      _v$9 !== _p$.o && setStyleProperty(_el$5, "transform", _p$.o = _v$9);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0,
      o: void 0
    });
    return _el$5;
  })();
}
function ActivityItem(props) {
  let [read, setRead] = createSignal(false);
  let [hovered, setHovered] = createSignal(false);
  return (() => {
    var _el$6 = _tmpl$3(), _el$7 = _el$6.firstChild, _el$8 = _el$7.nextSibling, _el$9 = _el$8.firstChild, _el$0 = _el$9.nextSibling;
    _el$6.addEventListener("mouseleave", () => setHovered(false));
    _el$6.addEventListener("mouseenter", () => setHovered(true));
    _el$6.$$click = () => setRead(!read());
    insert(_el$7, () => props.icon);
    insert(_el$9, () => props.title);
    insert(_el$0, () => props.time);
    createRenderEffect((_p$) => {
      var _v$0 = `activity-item ${read() ? "read" : ""}`, _v$1 = hovered() ? "#f5f5f5" : read() ? "rgba(245, 245, 245, 0.6)" : "#fff", _v$10 = read() ? "normal" : "bold";
      _v$0 !== _p$.e && className(_el$6, _p$.e = _v$0);
      _v$1 !== _p$.t && setStyleProperty(_el$6, "background-color", _p$.t = _v$1);
      _v$10 !== _p$.a && setStyleProperty(_el$9, "font-weight", _p$.a = _v$10);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    return _el$6;
  })();
}
function DropdownMenu(props) {
  let [open, setOpen] = createSignal(false);
  let [hovered, setHovered] = createSignal(false);
  let actions = ["View Details", "Edit", "Duplicate", "Archive", "Delete"];
  return (() => {
    var _el$1 = _tmpl$4(), _el$10 = _el$1.firstChild;
    _el$10.addEventListener("blur", (e) => {
      e.currentTarget.style.outline = "";
    });
    _el$10.addEventListener("focus", (e) => {
      e.currentTarget.style.outline = "2px solid #222";
      e.currentTarget.style.outlineOffset = "2px";
    });
    _el$10.addEventListener("mouseleave", () => setHovered(false));
    _el$10.addEventListener("mouseenter", () => setHovered(true));
    _el$10.$$click = (e) => {
      e.stopPropagation();
      setOpen(!open());
    };
    insert(_el$1, (() => {
      var _c$ = memo(() => !!open());
      return () => _c$() && (() => {
        var _el$11 = _tmpl$5();
        _el$11.addEventListener("mouseleave", () => setOpen(false));
        insert(_el$11, createComponent(For, {
          each: actions,
          children: (action, idx) => (() => {
            var _el$12 = _tmpl$6();
            _el$12.addEventListener("mouseleave", (e) => {
              e.currentTarget.style.backgroundColor = "#fff";
            });
            _el$12.addEventListener("mouseenter", (e) => {
              e.currentTarget.style.backgroundColor = "#f5f5f5";
            });
            _el$12.$$click = (e) => {
              e.stopPropagation();
              setOpen(false);
            };
            insert(_el$12, action);
            createRenderEffect((_$p) => setStyleProperty(_el$12, "border-bottom", idx() < actions.length - 1 ? "1px solid #eee" : "none"));
            return _el$12;
          })()
        }));
        return _el$11;
      })();
    })(), null);
    createRenderEffect((_$p) => setStyleProperty(_el$10, "background-color", hovered() ? "#286090" : "#337ab7"));
    return _el$1;
  })();
}
function DashboardTableRow(props) {
  let [hovered, setHovered] = createSignal(false);
  let [selected, setSelected] = createSignal(false);
  return (() => {
    var _el$13 = _tmpl$7(), _el$14 = _el$13.firstChild, _el$15 = _el$14.nextSibling, _el$16 = _el$15.nextSibling, _el$17 = _el$16.firstChild, _el$18 = _el$16.nextSibling, _el$19 = _el$18.firstChild, _el$20 = _el$18.nextSibling;
    _el$13.addEventListener("mouseleave", () => setHovered(false));
    _el$13.addEventListener("mouseenter", () => setHovered(true));
    _el$13.$$click = () => setSelected(!selected());
    insert(_el$14, () => props.row.id);
    insert(_el$15, () => props.row.label);
    insert(_el$18, () => (props.row.id * 10.5).toFixed(2), null);
    insert(_el$20, createComponent(DropdownMenu, {
      get rowId() {
        return props.row.id;
      }
    }));
    createRenderEffect((_p$) => {
      var _v$11 = selected() ? "danger" : "", _v$12 = hovered() ? "#f5f5f5" : "#fff";
      _v$11 !== _p$.e && className(_el$13, _p$.e = _v$11);
      _v$12 !== _p$.t && setStyleProperty(_el$13, "background-color", _p$.t = _v$12);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    return _el$13;
  })();
}
function SearchInput() {
  let [value, setValue] = createSignal("");
  let [focused, setFocused] = createSignal(false);
  return (() => {
    var _el$21 = _tmpl$8();
    _el$21.addEventListener("blur", () => setFocused(false));
    _el$21.addEventListener("focus", () => setFocused(true));
    _el$21.$$input = (e) => setValue(e.currentTarget.value);
    createRenderEffect((_p$) => {
      var _v$13 = `1px solid ${focused() ? "#337ab7" : "#ddd"}`, _v$14 = focused() ? "2px solid #337ab7" : "none";
      _v$13 !== _p$.e && setStyleProperty(_el$21, "border", _p$.e = _v$13);
      _v$14 !== _p$.t && setStyleProperty(_el$21, "outline", _p$.t = _v$14);
      return _p$;
    }, {
      e: void 0,
      t: void 0
    });
    createRenderEffect(() => _el$21.value = value());
    return _el$21;
  })();
}
function FormWidgets() {
  let [selectValue, setSelectValue] = createSignal("option1");
  let [checkboxValues, setCheckboxValues] = createSignal(/* @__PURE__ */ new Set());
  let [radioValue, setRadioValue] = createSignal("radio1");
  let [toggleValue, setToggleValue] = createSignal(false);
  let [progressValue, setProgressValue] = createSignal(45);
  let checkboxLabels = ["Checkbox 1", "Checkbox 2", "Checkbox 3"];
  let radioLabels = ["Radio 1", "Radio 2", "Radio 3"];
  return (() => {
    var _el$22 = _tmpl$9(), _el$23 = _el$22.firstChild, _el$24 = _el$23.nextSibling, _el$25 = _el$24.firstChild, _el$26 = _el$25.nextSibling, _el$27 = _el$24.nextSibling, _el$28 = _el$27.nextSibling, _el$29 = _el$28.firstChild, _el$30 = _el$29.nextSibling, _el$31 = _el$30.firstChild, _el$32 = _el$31.nextSibling, _el$33 = _el$32.firstChild, _el$34 = _el$28.nextSibling, _el$35 = _el$34.firstChild, _el$36 = _el$35.nextSibling, _el$37 = _el$36.firstChild, _el$38 = _el$37.firstChild;
    _el$26.addEventListener("blur", (e) => {
      e.currentTarget.style.borderColor = "#ddd";
      e.currentTarget.style.outline = "none";
    });
    _el$26.addEventListener("focus", (e) => {
      e.currentTarget.style.borderColor = "#337ab7";
      e.currentTarget.style.outline = "2px solid #337ab7";
      e.currentTarget.style.outlineOffset = "2px";
    });
    _el$26.addEventListener("change", (e) => setSelectValue(e.currentTarget.value));
    insert(_el$22, createComponent(For, {
      each: checkboxLabels,
      children: (label, idx) => (() => {
        var _el$39 = _tmpl$0(), _el$40 = _el$39.firstChild, _el$41 = _el$40.nextSibling;
        _el$40.addEventListener("blur", (e) => {
          e.currentTarget.style.outline = "";
        });
        _el$40.addEventListener("focus", (e) => {
          e.currentTarget.style.outline = "2px solid #337ab7";
          e.currentTarget.style.outlineOffset = "2px";
        });
        _el$40.addEventListener("change", (e) => {
          let next = new Set(checkboxValues());
          if (e.target.checked) {
            next.add(`checkbox-${idx()}`);
          } else {
            next.delete(`checkbox-${idx()}`);
          }
          setCheckboxValues(next);
        });
        insert(_el$41, label);
        createRenderEffect((_p$) => {
          var _v$18 = `checkbox-${idx()}`, _v$19 = `checkbox-${idx()}`;
          _v$18 !== _p$.e && setAttribute(_el$40, "id", _p$.e = _v$18);
          _v$19 !== _p$.t && setAttribute(_el$41, "for", _p$.t = _v$19);
          return _p$;
        }, {
          e: void 0,
          t: void 0
        });
        createRenderEffect(() => _el$40.checked = checkboxValues().has(`checkbox-${idx()}`));
        return _el$39;
      })()
    }), _el$27);
    insert(_el$27, createComponent(For, {
      each: radioLabels,
      children: (label, idx) => (() => {
        var _el$42 = _tmpl$1(), _el$43 = _el$42.firstChild;
        _el$43.addEventListener("blur", (e) => {
          e.currentTarget.style.outline = "";
        });
        _el$43.addEventListener("focus", (e) => {
          e.currentTarget.style.outline = "2px solid #337ab7";
          e.currentTarget.style.outlineOffset = "2px";
        });
        _el$43.addEventListener("change", (e) => setRadioValue(e.target.value));
        insert(_el$42, label, null);
        createRenderEffect(() => _el$43.value = `radio${idx() + 1}`);
        createRenderEffect(() => _el$43.checked = radioValue() === `radio${idx() + 1}`);
        return _el$42;
      })()
    }));
    _el$31.addEventListener("blur", (e) => {
      e.currentTarget.style.outline = "";
    });
    _el$31.addEventListener("focus", (e) => {
      e.currentTarget.style.outline = "2px solid #222";
      e.currentTarget.style.outlineOffset = "2px";
    });
    _el$31.addEventListener("change", (e) => setToggleValue(e.target.checked));
    insert(_el$37, progressValue, _el$38);
    createRenderEffect((_p$) => {
      var _v$15 = toggleValue() ? "#337ab7" : "#ccc", _v$16 = toggleValue() ? "translateX(26px)" : "translateX(0)", _v$17 = `${progressValue()}%`;
      _v$15 !== _p$.e && setStyleProperty(_el$32, "background-color", _p$.e = _v$15);
      _v$16 !== _p$.t && setStyleProperty(_el$33, "transform", _p$.t = _v$16);
      _v$17 !== _p$.a && setStyleProperty(_el$37, "width", _p$.a = _v$17);
      return _p$;
    }, {
      e: void 0,
      t: void 0,
      a: void 0
    });
    createRenderEffect(() => _el$26.value = selectValue());
    createRenderEffect(() => _el$31.checked = toggleValue());
    return _el$22;
  })();
}
function Dashboard(props) {
  let [dashboardRows, setDashboardRows] = createSignal(buildData(300));
  let sortDashboardAsc = () => {
    setDashboardRows((current) => sortRows(current, true));
  };
  let sortDashboardDesc = () => {
    setDashboardRows((current) => sortRows(current, false));
  };
  let chartData = [65, 45, 78, 52, 89, 34, 67, 91, 43, 56, 72, 38, 55, 82, 47, 63, 71, 39, 58, 84];
  let activities = Array.from({
    length: 50
  }, (_, i) => ({
    id: i + 1,
    title: `Activity ${i + 1}: ${["Order placed", "Payment received", "Shipment created", "Customer registered", "Product updated"][i % 5]}`,
    time: `${i + 1} ${i === 0 ? "minute" : "minutes"} ago`,
    icon: ["O", "P", "S", "C", "U"][i % 5]
  }));
  return (() => {
    var _el$44 = _tmpl$10(), _el$45 = _el$44.firstChild, _el$46 = _el$45.firstChild, _el$47 = _el$46.nextSibling, _el$48 = _el$45.nextSibling, _el$49 = _el$48.firstChild, _el$50 = _el$48.nextSibling, _el$51 = _el$50.firstChild, _el$52 = _el$51.firstChild, _el$53 = _el$52.nextSibling, _el$54 = _el$51.nextSibling, _el$55 = _el$54.firstChild, _el$56 = _el$55.nextSibling, _el$57 = _el$50.nextSibling, _el$58 = _el$57.firstChild, _el$59 = _el$58.firstChild, _el$60 = _el$59.firstChild, _el$61 = _el$60.nextSibling, _el$62 = _el$61.nextSibling, _el$63 = _el$58.nextSibling, _el$64 = _el$63.firstChild, _el$65 = _el$64.firstChild, _el$66 = _el$65.firstChild, _el$67 = _el$66.firstChild, _el$68 = _el$67.nextSibling, _el$69 = _el$68.nextSibling, _el$70 = _el$69.nextSibling, _el$71 = _el$70.nextSibling, _el$72 = _el$65.nextSibling;
    _el$47.addEventListener("blur", (e) => {
      e.currentTarget.style.outline = "";
    });
    _el$47.addEventListener("focus", (e) => {
      e.currentTarget.style.outline = "2px solid #222";
      e.currentTarget.style.outlineOffset = "2px";
    });
    addEventListener(_el$47, "click", props.onSwitchToTable, true);
    insert(_el$49, createComponent(MetricCard, {
      id: 1,
      label: "Total Sales",
      value: "$125,430",
      change: "+12.5%"
    }), null);
    insert(_el$49, createComponent(MetricCard, {
      id: 2,
      label: "Orders",
      value: "1,234",
      change: "+8.2%"
    }), null);
    insert(_el$49, createComponent(MetricCard, {
      id: 3,
      label: "Customers",
      value: "5,678",
      change: "+15.3%"
    }), null);
    insert(_el$49, createComponent(MetricCard, {
      id: 4,
      label: "Revenue",
      value: "$89,123",
      change: "+9.7%"
    }), null);
    insert(_el$53, createComponent(For, {
      each: chartData,
      children: (value, index) => createComponent(ChartBar, {
        value,
        get index() {
          return index();
        }
      })
    }));
    insert(_el$56, createComponent(For, {
      each: activities,
      children: (activity) => createComponent(ActivityItem, activity)
    }));
    _el$61.$$click = sortDashboardAsc;
    _el$62.$$click = sortDashboardDesc;
    insert(_el$58, createComponent(SearchInput, {}), null);
    insert(_el$72, createComponent(For, {
      get each() {
        return dashboardRows();
      },
      children: (row) => createComponent(DashboardTableRow, {
        row
      })
    }));
    insert(_el$44, createComponent(FormWidgets, {}), null);
    return _el$44;
  })();
}
function App() {
  let [rows, setRows] = createSignal([]);
  let [selected, setSelected] = createSignal(null);
  let [view, setView] = createSignal("table");
  let run = () => {
    setRows(get1000Rows());
    setSelected(null);
  };
  let runLots = () => {
    setRows(get10000Rows());
    setSelected(null);
  };
  let add = () => {
    setRows((current) => [...current, ...get1000Rows()]);
  };
  let update = () => {
    setRows((current) => updatedEvery10thRow(current));
  };
  let clear = () => {
    setRows([]);
    setSelected(null);
  };
  let swap = () => {
    setRows((current) => swapRows(current));
  };
  let removeRow = (id) => {
    setRows((current) => remove(current, id));
  };
  let sortAsc = () => {
    setRows((current) => sortRows(current, true));
  };
  let sortDesc = () => {
    setRows((current) => sortRows(current, false));
  };
  let switchToDashboard = () => {
    setView("dashboard");
  };
  let switchToTable = () => {
    setView("table");
  };
  let isSelected = createSelector(selected);
  return memo(() => memo(() => view() === "dashboard")() ? createComponent(Dashboard, {
    onSwitchToTable: switchToTable
  }) : (() => {
    var _el$73 = _tmpl$11(), _el$74 = _el$73.firstChild, _el$75 = _el$74.firstChild, _el$76 = _el$75.firstChild, _el$77 = _el$76.nextSibling, _el$78 = _el$77.firstChild, _el$79 = _el$78.firstChild, _el$80 = _el$79.firstChild, _el$81 = _el$79.nextSibling, _el$82 = _el$81.firstChild, _el$83 = _el$81.nextSibling, _el$84 = _el$83.firstChild, _el$85 = _el$83.nextSibling, _el$86 = _el$85.firstChild, _el$87 = _el$85.nextSibling, _el$88 = _el$87.firstChild, _el$89 = _el$87.nextSibling, _el$90 = _el$89.firstChild, _el$91 = _el$89.nextSibling, _el$92 = _el$91.firstChild, _el$93 = _el$91.nextSibling, _el$94 = _el$93.firstChild, _el$95 = _el$93.nextSibling, _el$96 = _el$95.firstChild, _el$97 = _el$74.nextSibling, _el$98 = _el$97.firstChild;
    _el$80.$$click = run;
    _el$82.$$click = runLots;
    _el$84.$$click = add;
    _el$86.$$click = update;
    _el$88.$$click = clear;
    _el$90.$$click = swap;
    _el$92.$$click = sortAsc;
    _el$94.$$click = sortDesc;
    _el$96.$$click = switchToDashboard;
    insert(_el$98, createComponent(For, {
      get each() {
        return rows();
      },
      children: (row) => {
        let rowId = row.id;
        return (() => {
          var _el$99 = _tmpl$12(), _el$100 = _el$99.firstChild, _el$101 = _el$100.nextSibling, _el$102 = _el$101.firstChild, _el$103 = _el$101.nextSibling, _el$104 = _el$103.firstChild;
          insert(_el$100, rowId);
          _el$102.$$click = (event) => {
            event.preventDefault();
            setSelected(rowId);
          };
          insert(_el$102, () => row.label);
          _el$104.$$click = (event) => {
            event.preventDefault();
            removeRow(rowId);
          };
          createRenderEffect(() => className(_el$99, isSelected(rowId) ? "danger" : ""));
          return _el$99;
        })();
      }
    }));
    return _el$73;
  })());
}
var el = document.getElementById("app");
render(() => createComponent(App, {}), el);
delegateEvents(["click", "input"]);
export {
  name
};
