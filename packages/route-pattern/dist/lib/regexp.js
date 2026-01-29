export function escape(text) {
    return text.replace(/[.*+?^${}()|[\]\\-]/g, '\\$&');
}
