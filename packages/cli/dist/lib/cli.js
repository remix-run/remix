import * as process from 'node:process';
import { getCliHelpText, runHelpCommand } from "./commands/help.js";
import { resolveCliContext } from "./cli-context.js";
import { renderCliError, unknownCommand } from "./errors.js";
import { configureColors, restoreTerminalFormatting } from "./terminal.js";
export async function runRemix(argv = process.argv.slice(2), options = {}) {
    let context = await resolveCliContext(options);
    try {
        argv = stripLeadingSeparators(argv);
        let globalOptions = extractGlobalOptions(argv);
        argv = stripLeadingSeparators(globalOptions.argv);
        configureColors({ disabled: globalOptions.noColor });
        if (argv.length === 0) {
            process.stdout.write(getCliHelpText());
            return 0;
        }
        let [command, ...rest] = argv;
        if (command === '-h' || command === '--help') {
            process.stdout.write(getCliHelpText());
            return 0;
        }
        return await runCommand(command, rest, context);
    }
    finally {
        restoreTerminalFormatting();
    }
}
function stripLeadingSeparators(argv) {
    while (argv[0] === '--') {
        argv = argv.slice(1);
    }
    return argv;
}
async function runCommand(command, argv, context) {
    if (command === 'help') {
        return runHelpCommand(argv);
    }
    if (command === '-v' || command === '--version') {
        let { runVersionCommand } = await import("./commands/version.js");
        return runVersionCommand([], context);
    }
    if (command === 'new') {
        let { runNewCommand } = await import("./commands/new.js");
        return runNewCommand(argv, context);
    }
    if (command === 'completion') {
        let { runCompletionCommand } = await import("./commands/completion.js");
        return runCompletionCommand(argv);
    }
    if (command === 'doctor') {
        let { runDoctorCommand } = await import("./commands/doctor.js");
        return runDoctorCommand(argv, context);
    }
    if (command === 'routes') {
        let { runRoutesCommand } = await import("./commands/routes.js");
        return runRoutesCommand(argv, context);
    }
    if (command === 'test') {
        let { runTestCommand } = await import("./commands/test.js");
        return runTestCommand(argv, context);
    }
    if (command === 'version') {
        let { runVersionCommand } = await import("./commands/version.js");
        return runVersionCommand(argv, context);
    }
    process.stderr.write(renderCliError(unknownCommand(command), { helpText: getCliHelpText(process.stderr) }));
    return 1;
}
function extractGlobalOptions(argv) {
    let filteredArgv = [];
    let noColor = false;
    for (let index = 0; index < argv.length; index++) {
        let arg = argv[index];
        if (arg === '--') {
            filteredArgv.push(...argv.slice(index));
            break;
        }
        if (arg === '--no-color') {
            noColor = true;
            continue;
        }
        filteredArgv.push(arg);
    }
    return {
        argv: filteredArgv,
        noColor,
    };
}
