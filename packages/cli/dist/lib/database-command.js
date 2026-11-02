export function isDatabaseCommand(value) {
    return (value === 'migrate' ||
        value === 'reset' ||
        value === 'rollback' ||
        value === 'seed' ||
        value === 'status' ||
        value === 'wipe');
}
