import { mock } from "./mock.js";
export function createFakeTimers() {
    let currentTime = 0;
    let nextId = 1;
    let pending = [];
    function schedule(fn, delay, repeatMs) {
        let id = nextId++;
        pending.push({ id, fn, time: currentTime + Math.max(0, delay), repeatMs });
        return id;
    }
    function cancel(id) {
        pending = pending.filter((t) => t.id !== id);
    }
    let setTimeoutMock = mock.method(globalThis, 'setTimeout', ((fn, delay = 0) => schedule(fn, delay)));
    let clearTimeoutMock = mock.method(globalThis, 'clearTimeout', cancel);
    let setIntervalMock = mock.method(globalThis, 'setInterval', ((fn, delay = 0) => schedule(fn, delay, Math.max(0, delay))));
    let clearIntervalMock = mock.method(globalThis, 'clearInterval', cancel);
    function takeNext(targetTime) {
        let next = pending.filter((t) => t.time <= targetTime).sort((a, b) => a.time - b.time)[0];
        if (!next)
            return null;
        currentTime = next.time;
        pending = pending.filter((t) => t.id !== next.id);
        // Requeue intervals before running the callback so that calling
        // clearInterval(id) from inside the callback can cancel the next firing.
        if (next.repeatMs !== undefined) {
            pending.push({ ...next, time: next.time + Math.max(1, next.repeatMs) });
        }
        return next;
    }
    return {
        advance(ms) {
            let targetTime = currentTime + ms;
            while (true) {
                let next = takeNext(targetTime);
                if (!next)
                    break;
                next.fn();
            }
            currentTime = targetTime;
        },
        async advanceAsync(ms) {
            let targetTime = currentTime + ms;
            while (true) {
                let next = takeNext(targetTime);
                if (!next)
                    break;
                next.fn();
                // Drain microtasks so Promise continuations (and any timers they
                // schedule) can settle before we look for the next firing.
                await Promise.resolve();
            }
            currentTime = targetTime;
        },
        restore() {
            setTimeoutMock.mock.restore?.();
            clearTimeoutMock.mock.restore?.();
            setIntervalMock.mock.restore?.();
            clearIntervalMock.mock.restore?.();
            pending = [];
            currentTime = 0;
        },
    };
}
