const HOVER_AIM_PADDING = 8;
const HOVER_AIM_MAX_DURATION = 300;
const HOVER_AIM_STALL_DURATION = 120;
const HOVER_AIM_MIN_PROGRESS = 0.5;
const HOVER_AIM_MAX_STALLED_UPDATES = 2;
export function createHoverAim() {
    let lastPointer = null;
    let session = null;
    let pointerTrackingActive = false;
    let processedEvents = new WeakMap();
    function handleDocumentPointerMove(event) {
        accepts(event);
    }
    function startPointerTracking() {
        if (pointerTrackingActive) {
            return;
        }
        document.addEventListener('pointermove', handleDocumentPointerMove, { capture: true });
        pointerTrackingActive = true;
    }
    function stopPointerTracking() {
        if (!pointerTrackingActive) {
            return;
        }
        document.removeEventListener('pointermove', handleDocumentPointerMove, { capture: true });
        pointerTrackingActive = false;
    }
    function clearSession(reason, currentSession = session) {
        if (!currentSession) {
            return;
        }
        clearTimeout(currentSession.durationTimeoutId);
        clearTimeout(currentSession.stallTimeoutId);
        if (session === currentSession) {
            session = null;
        }
        stopPointerTracking();
        if (reason === 'duration-timeout' || reason === 'stall-timeout') {
            currentSession.onExpire?.();
        }
    }
    function scheduleDurationTimeout(currentSession) {
        currentSession.durationTimeoutId = window.setTimeout(() => {
            clearSession('duration-timeout', currentSession);
        }, HOVER_AIM_MAX_DURATION);
    }
    function scheduleStallTimeout(currentSession) {
        clearTimeout(currentSession.stallTimeoutId);
        currentSession.stallTimeoutId = window.setTimeout(() => {
            clearSession('stall-timeout', currentSession);
        }, HOVER_AIM_STALL_DURATION);
    }
    function rememberPointer(event) {
        if (!isMousePointer(event)) {
            return;
        }
        lastPointer = getPoint(event);
    }
    function start(source, target, event, onExpire) {
        clearSession('restart');
        if (event && !isMousePointer(event)) {
            return false;
        }
        if (!source.isConnected || !target.isConnected) {
            return false;
        }
        let startPoint = event ? getPoint(event) : lastPointer;
        if (!startPoint) {
            return false;
        }
        if (event?.relatedTarget instanceof Node && target.contains(event.relatedTarget)) {
            lastPointer = startPoint;
            return true;
        }
        let sourceRect = toRect(source.getBoundingClientRect());
        let actualRect = toRect(target.getBoundingClientRect());
        if (isEmptyRect(sourceRect) ||
            isEmptyRect(actualRect) ||
            containsPoint(actualRect, startPoint) ||
            !isHeadingTowardTarget(sourceRect, actualRect, startPoint)) {
            return false;
        }
        lastPointer = startPoint;
        let paddedRect = inflateRect(actualRect, HOVER_AIM_PADDING);
        let currentSession = {
            target,
            actualRect,
            polygon: createCorridor(startPoint, paddedRect),
            startedAt: Date.now(),
            lastDistance: distanceToRect(startPoint, actualRect),
            lastPoint: startPoint,
            durationTimeoutId: 0,
            stalledUpdates: 0,
            stallTimeoutId: 0,
            onExpire,
        };
        session = currentSession;
        startPointerTracking();
        scheduleDurationTimeout(currentSession);
        scheduleStallTimeout(currentSession);
        return true;
    }
    function accepts(event) {
        if (processedEvents.has(event)) {
            return processedEvents.get(event);
        }
        rememberPointer(event);
        let currentSession = session;
        if (!currentSession) {
            processedEvents.set(event, true);
            return true;
        }
        if (!isMousePointer(event) || event.type !== 'pointermove') {
            clearSession('non-pointermove', currentSession);
            processedEvents.set(event, true);
            return true;
        }
        if (!currentSession.target.isConnected) {
            clearSession('target-disconnected', currentSession);
            processedEvents.set(event, true);
            return true;
        }
        let point = getPoint(event);
        if (enteredTarget(currentSession, point, event.target)) {
            clearSession('entered-target', currentSession);
            processedEvents.set(event, true);
            return true;
        }
        if (!pointInPolygon(point, currentSession.polygon)) {
            clearSession('outside-corridor', currentSession);
            processedEvents.set(event, true);
            return true;
        }
        if (distanceBetweenPoints(currentSession.lastPoint, point) > 0) {
            scheduleStallTimeout(currentSession);
        }
        let nextDistance = distanceToRect(point, currentSession.actualRect);
        if (currentSession.lastDistance - nextDistance >= HOVER_AIM_MIN_PROGRESS) {
            currentSession.stalledUpdates = 0;
        }
        else {
            currentSession.stalledUpdates++;
        }
        currentSession.lastPoint = point;
        currentSession.lastDistance = nextDistance;
        if (currentSession.stalledUpdates >= HOVER_AIM_MAX_STALLED_UPDATES) {
            clearSession('stalled-updates', currentSession);
            processedEvents.set(event, true);
            return true;
        }
        if (Date.now() - currentSession.startedAt >= HOVER_AIM_MAX_DURATION) {
            clearSession('max-duration', currentSession);
            processedEvents.set(event, true);
            return true;
        }
        processedEvents.set(event, false);
        return false;
    }
    return { start, accepts };
}
function isMousePointer(event) {
    return (event.pointerType === undefined || event.pointerType === '' || event.pointerType === 'mouse');
}
function getPoint(event) {
    return {
        x: event.clientX,
        y: event.clientY,
    };
}
function toRect(rect) {
    return {
        left: rect.left,
        top: rect.top,
        right: rect.right,
        bottom: rect.bottom,
    };
}
function isEmptyRect(rect) {
    return rect.left === rect.right || rect.top === rect.bottom;
}
function inflateRect(rect, padding) {
    return {
        left: rect.left - padding,
        top: rect.top - padding,
        right: rect.right + padding,
        bottom: rect.bottom + padding,
    };
}
function containsPoint(rect, point) {
    return (point.x >= rect.left && point.x <= rect.right && point.y >= rect.top && point.y <= rect.bottom);
}
function isHeadingTowardTarget(sourceRect, targetRect, point) {
    let sourceCenterX = sourceRect.left + (sourceRect.right - sourceRect.left) / 2;
    let sourceCenterY = sourceRect.top + (sourceRect.bottom - sourceRect.top) / 2;
    let targetCenterX = targetRect.left + (targetRect.right - targetRect.left) / 2;
    let targetCenterY = targetRect.top + (targetRect.bottom - targetRect.top) / 2;
    let deltaX = targetCenterX - sourceCenterX;
    let deltaY = targetCenterY - sourceCenterY;
    if (Math.abs(deltaX) >= Math.abs(deltaY)) {
        return deltaX >= 0 ? point.x >= sourceCenterX : point.x <= sourceCenterX;
    }
    return deltaY >= 0 ? point.y >= sourceCenterY : point.y <= sourceCenterY;
}
function enteredTarget(session, point, eventTarget) {
    if (containsPoint(session.actualRect, point)) {
        return true;
    }
    return eventTarget instanceof Node && session.target.contains(eventTarget);
}
function distanceBetweenPoints(from, to) {
    return Math.hypot(to.x - from.x, to.y - from.y);
}
function distanceToRect(point, rect) {
    let dx = 0;
    let dy = 0;
    if (point.x < rect.left) {
        dx = rect.left - point.x;
    }
    else if (point.x > rect.right) {
        dx = point.x - rect.right;
    }
    if (point.y < rect.top) {
        dy = rect.top - point.y;
    }
    else if (point.y > rect.bottom) {
        dy = point.y - rect.bottom;
    }
    return Math.hypot(dx, dy);
}
function createCorridor(startPoint, rect) {
    let points = dedupePoints([
        startPoint,
        { x: rect.left, y: rect.top },
        { x: rect.right, y: rect.top },
        { x: rect.right, y: rect.bottom },
        { x: rect.left, y: rect.bottom },
    ]);
    if (points.length <= 2) {
        return points;
    }
    points.sort((left, right) => {
        if (left.x === right.x) {
            return left.y - right.y;
        }
        return left.x - right.x;
    });
    let lower = [];
    for (let point of points) {
        while (lower.length >= 2 &&
            crossProduct(lower[lower.length - 2], lower[lower.length - 1], point) <= 0) {
            lower.pop();
        }
        lower.push(point);
    }
    let upper = [];
    for (let index = points.length - 1; index >= 0; index--) {
        let point = points[index];
        while (upper.length >= 2 &&
            crossProduct(upper[upper.length - 2], upper[upper.length - 1], point) <= 0) {
            upper.pop();
        }
        upper.push(point);
    }
    return lower.slice(0, -1).concat(upper.slice(0, -1));
}
function crossProduct(origin, a, b) {
    return (a.x - origin.x) * (b.y - origin.y) - (a.y - origin.y) * (b.x - origin.x);
}
function dedupePoints(points) {
    let seen = new Set();
    return points.filter((point) => {
        let key = `${point.x}:${point.y}`;
        if (seen.has(key)) {
            return false;
        }
        seen.add(key);
        return true;
    });
}
function pointInPolygon(point, polygon) {
    if (polygon.length < 3) {
        return false;
    }
    let inside = false;
    for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
        if (pointOnSegment(point, polygon[j], polygon[i])) {
            return true;
        }
        if (polygon[i].y > point.y !== polygon[j].y > point.y &&
            point.x <
                ((polygon[j].x - polygon[i].x) * (point.y - polygon[i].y)) / (polygon[j].y - polygon[i].y) +
                    polygon[i].x) {
            inside = !inside;
        }
    }
    return inside;
}
function pointOnSegment(point, start, end) {
    let cross = crossProduct(start, end, point);
    if (Math.abs(cross) > 0.001) {
        return false;
    }
    return (point.x >= Math.min(start.x, end.x) &&
        point.x <= Math.max(start.x, end.x) &&
        point.y >= Math.min(start.y, end.y) &&
        point.y <= Math.max(start.y, end.y));
}
//# sourceMappingURL=hover-aim.js.map