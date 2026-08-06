import { missingOptionValue, unexpectedExtraArgument, unknownArgument } from "./errors.js";
export function parseArgs(argv, definitions, options = {}) {
    let values = {};
    let specsByFlag = new Map();
    let positionals = [];
    for (let [key, spec] of Object.entries(definitions)) {
        values[key] = (spec.type === 'boolean' ? false : undefined);
        specsByFlag.set(spec.flag, { key, spec });
    }
    for (let index = 0; index < argv.length; index++) {
        let arg = argv[index];
        let equalsIndex = arg.indexOf('=');
        let flag = equalsIndex === -1 ? arg : arg.slice(0, equalsIndex);
        let inlineValue = equalsIndex === -1 ? undefined : arg.slice(equalsIndex + 1);
        let resolved = specsByFlag.get(flag);
        if (resolved != null) {
            if (resolved.spec.type === 'boolean') {
                if (inlineValue !== undefined) {
                    throw unknownArgument(arg);
                }
                values[resolved.key] = true;
                continue;
            }
            if (inlineValue !== undefined) {
                if (inlineValue.length === 0) {
                    throw missingOptionValue(flag);
                }
                values[resolved.key] = inlineValue;
                continue;
            }
            let next = argv[index + 1];
            if (next == null || next.startsWith('-')) {
                throw missingOptionValue(flag);
            }
            values[resolved.key] = next;
            index += 1;
            continue;
        }
        if (arg.startsWith('-')) {
            throw unknownArgument(arg);
        }
        if (options.maxPositionals != null && positionals.length >= options.maxPositionals) {
            throw unexpectedExtraArgument(arg);
        }
        positionals.push(arg);
    }
    return { options: values, positionals };
}
