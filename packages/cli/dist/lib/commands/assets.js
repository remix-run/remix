import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { createAssetServer } from '@remix-run/assets';
import { assetsConfigRequired, invalidOptionValue, renderCliError, toCliError, unknownCommand, } from '../errors.js';
import { formatHelpText } from '../help-text.js';
import { parseArgs } from '../parse-args.js';
export async function runAssetsCommand(argv, context) {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(getAssetsCommandHelpText());
        return 0;
    }
    try {
        let invocation = parseAssetsCommandArgs(argv);
        let config = await context.loadConfig();
        if (config.assets === undefined)
            throw assetsConfigRequired();
        let assetServer = createAssetServer({ ...config.assets, watch: false });
        try {
            let rootDir = fs.realpathSync(config.assets.rootDir);
            if (invocation.command === 'list') {
                process.stdout.write(formatAssetList(await assetServer.getAssets(), rootDir));
            }
            else {
                process.stdout.write(formatAssetDetails(await assetServer.getAssetDetails(invocation.input), rootDir));
            }
        }
        finally {
            await assetServer.close();
        }
        return 0;
    }
    catch (error) {
        process.stderr.write(renderCliError(toCliError(error), { helpText: getAssetsCommandHelpText(process.stderr) }));
        return 1;
    }
}
export function getAssetsCommandHelpText(target = process.stdout) {
    return formatHelpText({
        description: 'List or inspect browser-reachable assets.',
        commands: [{ description: 'Inspect one asset URL or file', label: 'inspect <url-or-file>' }],
        examples: [
            'remix assets',
            'remix assets inspect /assets/app/actions/public/entry.ts',
            'remix assets inspect app/actions/public/entry.ts',
        ],
        usage: ['remix assets', 'remix assets inspect <url-or-file>'],
    }, target);
}
function parseAssetsCommandArgs(argv) {
    let parsed = parseArgs(argv, {}, { maxPositionals: 2 });
    let [command, input] = parsed.positionals;
    if (command === undefined)
        return { command: 'list' };
    if (command !== 'inspect')
        throw unknownCommand(`assets ${command}`);
    if (input === undefined) {
        throw invalidOptionValue('`remix assets inspect` requires a URL or file path.');
    }
    return { command, input };
}
function formatAssetList(assets, rootDir) {
    if (assets.length === 0)
        return 'No assets.\n';
    return `${assets
        .map((asset) => `${asset.url} -> ${formatFilePath(asset.filePath, rootDir)}`)
        .join('\n')}\n`;
}
function formatAssetDetails(details, rootDir) {
    let lines = [`Status: ${details.status}`];
    if (details.url !== undefined)
        lines.push(`URL: ${details.url}`);
    if (details.filePath !== undefined) {
        lines.push(`File: ${formatFilePath(details.filePath, rootDir)}`);
    }
    if (details.access?.deniedBy !== undefined) {
        lines.push(`Denied by: ${details.access.deniedBy}`);
    }
    return `${lines.join('\n')}\n`;
}
function formatFilePath(filePath, rootDir) {
    if (filePath === undefined)
        return '';
    let relativePath = path.relative(rootDir, filePath);
    return relativePath === '' ||
        relativePath.startsWith(`..${path.sep}`) ||
        path.isAbsolute(relativePath)
        ? filePath
        : relativePath.split(path.sep).join('/');
}
