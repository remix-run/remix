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
    return {
        advance(ms) {
            let targetTime = currentTime + ms;
            while (true) {
                let next = pending.filter((t) => t.time <= targetTime).sort((a, b) => a.time - b.time)[0];
                if (!next)
                    break;
                currentTime = next.time;
                pending = pending.filter((t) => t.id !== next.id);
                // Requeue intervals before running the callback so that calling
                // clearInterval(id) from inside the callback can cancel the next firing.
                if (next.repeatMs !== undefined) {
                    pending.push({ ...next, time: next.time + Math.max(1, next.repeatMs) });
                }
                next.fn();
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
