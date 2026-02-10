/**
 * Spring physics based on SwiftUI's spring math.
 *
 * Returns a decorated iterator that can be:
 * - Iterated to get position values (0→1)
 * - Spread for WAAPI: { ...spring() }
 * - Stringified for CSS: `transform ${spring()}`
 *
 * Spring Parameter Conversion (SwiftUI formulas, mass = 1):
 *   stiffness = (2π ÷ duration)²
 *   damping = 1 - 4π × bounce ÷ duration  (bounce ≥ 0)
 *   damping = 4π ÷ (duration + 4π × bounce)  (bounce < 0)
 */
let presets = {
    smooth: { duration: 400, bounce: -0.3 },
    snappy: { duration: 200, bounce: 0 },
    bouncy: { duration: 400, bounce: 0.3 },
};
// Rest thresholds for determining when spring has settled
let restSpeed = 0.01;
let restDelta = 0.005;
let maxSettlingTime = 20_000;
let frameMs = 1000 / 60; // ~16.67ms per frame
export function spring(presetOrOptions, overrides) {
    let options = resolveOptions(presetOrOptions, overrides);
    let { position, settlingTime, easing } = computeSpring(options);
    let duration = Math.round(settlingTime);
    function* generator() {
        let t = 0;
        while (t < settlingTime) {
            yield position(t);
            t += frameMs;
        }
        yield 1;
    }
    let iter = generator();
    // Decorate iterator with spring properties (enumerable for spread)
    Object.defineProperties(iter, {
        duration: { value: duration, enumerable: true },
        easing: { value: easing, enumerable: true },
        toString: {
            value() {
                return `${duration}ms ${easing}`;
            },
        },
    });
    return iter;
}
// Transition helper for CSS transition property
spring.transition = function transition(property, presetOrOptions, overrides) {
    let s = typeof presetOrOptions === 'string'
        ? spring(presetOrOptions, overrides)
        : spring(presetOrOptions);
    let properties = Array.isArray(property) ? property : [property];
    return properties.map((p) => `${p} ${s}`).join(', ');
};
// Access preset defaults
spring.presets = presets;
function resolveOptions(presetOrOptions, overrides) {
    if (typeof presetOrOptions === 'string') {
        let preset = presets[presetOrOptions];
        return {
            duration: overrides?.duration ?? preset.duration,
            bounce: preset.bounce,
            velocity: overrides?.velocity,
        };
    }
    if (presetOrOptions) {
        return presetOrOptions;
    }
    // Default to 'snappy' preset
    return presets.snappy;
}
// Core spring computation
function computeSpring(options) {
    let { duration: durationMs = 300, bounce = 0, velocity = 0 } = options;
    // Convert duration to seconds for physics calculations
    let durationSec = durationMs / 1000;
    // Natural frequency: ω₀ = √(stiffness) = 2π / duration
    let omega0 = (2 * Math.PI) / durationSec;
    // Clamp bounce to valid range
    bounce = Math.max(-1, Math.min(0.95, bounce));
    // Damping ratio (ζ):
    // bounce >= 0: ζ = 1 - bounce (linear, 0→1 maps to critical→underdamped)
    // bounce < 0: ζ = 1 / (1 + bounce) (stronger overdamping as bounce→-1)
    let zeta = bounce >= 0 ? 1 - bounce : 1 / (1 + bounce);
    // Convert to per-millisecond for time calculations
    let omega0Ms = omega0 / 1000;
    let velocityMs = -velocity / 1000; // negated for spring equation convention
    // Position function based on damping regime
    let position;
    if (zeta < 1) {
        // Underdamped (bouncy) - oscillates around target
        let omegaD = omega0Ms * Math.sqrt(1 - zeta * zeta);
        position = (t) => {
            let envelope = Math.exp(-zeta * omega0Ms * t);
            return (1 -
                envelope *
                    (((velocityMs + zeta * omega0Ms) / omegaD) * Math.sin(omegaD * t) + Math.cos(omegaD * t)));
        };
    }
    else if (zeta > 1) {
        // Overdamped (smooth) - no oscillation, two decay rates
        let sqrtTerm = Math.sqrt(zeta * zeta - 1);
        let s1 = omega0Ms * (-zeta + sqrtTerm); // slower decay
        let s2 = omega0Ms * (-zeta - sqrtTerm); // faster decay
        let A = (s2 + velocityMs) / (s2 - s1);
        let B = 1 - A;
        position = (t) => 1 - A * Math.exp(s1 * t) - B * Math.exp(s2 * t);
    }
    else {
        // Critically damped - fastest approach without oscillation
        position = (t) => 1 - Math.exp(-omega0Ms * t) * (1 + (velocityMs + omega0Ms) * t);
    }
    // Velocity via numerical differentiation (units per second)
    let velocitySampleMs = 0.5;
    function velocityAt(t) {
        if (t < velocitySampleMs) {
            return ((position(velocitySampleMs) - position(0)) / velocitySampleMs) * 1000;
        }
        return ((position(t) - position(t - velocitySampleMs)) / velocitySampleMs) * 1000;
    }
    // Find settling time
    let settlingTime = maxSettlingTime;
    let step = 50;
    for (let t = 0; t < maxSettlingTime; t += step) {
        let pos = position(t);
        let vel = Math.abs(velocityAt(t));
        let displacement = Math.abs(1 - pos);
        if (vel <= restSpeed && displacement <= restDelta) {
            settlingTime = t;
            break;
        }
    }
    // Generate CSS easing
    let easing = generateEasing(position, settlingTime);
    return { position, settlingTime, easing };
}
// Generate CSS linear() easing with adaptive sampling
function generateEasing(position, settlingTime) {
    let points = adaptiveSample(position, settlingTime);
    return `linear(${points
        .map((p, i) => {
        let isLast = i === points.length - 1;
        let value = isLast ? 1 : Math.round(p.value * 10000) / 10000;
        if (i === 0 || isLast) {
            return value === 1 ? '1' : value.toString();
        }
        let percent = Math.round((p.t / settlingTime) * 1000) / 10;
        return `${value} ${percent}%`;
    })
        .join(', ')})`;
}
// Adaptive sampling - more points where curvature is high, fewer where linear
function adaptiveSample(resolve, duration, tolerance = 0.002, minSegment = 8) {
    let points = [];
    function addPoint(t, value) {
        if (points.length === 0 || points[points.length - 1].t < t) {
            points.push({ t, value });
        }
    }
    function subdivide(t0, v0, t1, v1, depth = 0) {
        if (depth > 12) {
            addPoint(t0, v0);
            return;
        }
        let tMid = (t0 + t1) / 2;
        let vMid = resolve(tMid);
        let vLinear = (v0 + v1) / 2;
        let error = Math.abs(vMid - vLinear);
        if (error > tolerance && t1 - t0 > minSegment) {
            subdivide(t0, v0, tMid, vMid, depth + 1);
            subdivide(tMid, vMid, t1, v1, depth + 1);
        }
        else {
            addPoint(t0, v0);
        }
    }
    subdivide(0, resolve(0), duration, resolve(duration));
    addPoint(duration, resolve(duration));
    return points;
}
//# sourceMappingURL=spring.js.map