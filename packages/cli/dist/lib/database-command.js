export function isDatabaseCommand(value) {
    return (value === 'migrate' ||
        value === 'reset' ||
        value === 'seed' ||
        value === 'status' ||
        value === 'wipe');
}
