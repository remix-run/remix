export function springStep(position, velocity, target, dt, settings) {
    let stiffness = settings.stiffness ?? 158;
    let damping = 2 * (settings.dampingRatio ?? 1) * Math.sqrt(stiffness);
    velocity += (-stiffness * (position - target) - damping * velocity) * dt;
    return { position: position + velocity * dt, velocity };
}
// Integrate in small steps so a dropped frame does not destabilize the spring.
export function frames(update) {
    let previous = performance.now();
    let frame = requestAnimationFrame(tick);
    function tick(now) {
        let remaining = Math.min((now - previous) / 1000, 0.064);
        previous = now;
        let active = true;
        while (remaining > 0 && active) {
            let dt = Math.min(remaining, 1 / 240);
            active = update(dt);
            remaining -= dt;
        }
        if (active)
            frame = requestAnimationFrame(tick);
    }
    return {
        stop() {
            cancelAnimationFrame(frame);
        },
        pause() {
            cancelAnimationFrame(frame);
        },
        resume() {
            previous = performance.now();
            frame = requestAnimationFrame(tick);
        },
    };
}
//# sourceMappingURL=drag-physics.js.map