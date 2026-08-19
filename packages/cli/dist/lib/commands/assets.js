import * as fs from 'node:fs';
import * as path from 'node:path';
import * as process from 'node:process';
import { createAssetServer } from '@remix-run/assets';
import { assetsConfigRequired, renderCliError, toCliError } from '../errors.js';
import { formatHelpText } from '../help-text.js';
import { parseArgs } from '../parse-args.js';
export async function runAssetsCommand(argv, context) {
    if (argv.includes('-h') || argv.includes('--help')) {
        process.stdout.write(getAssetsCommandHelpText());
        return 0;
    }
    try {
        let parsed = parseArgs(argv, {}, { maxPositionals: 1 });
        let config = await context.loadConfig();
        if (config.assets === undefined)
            throw assetsConfigRequired();
        let assetServer = createAssetServer({ ...config.assets, watch: false });
        try {
            let input = parsed.positionals[0];
            let rootDir = fs.realpathSync(config.assets.rootDir);
            if (input === undefined) {
                process.stdout.write(formatAssetList(await assetServer.getAssets(), rootDir));
            }
            else {
                process.stdout.write(formatAssetDetails(await assetServer.getAssetDetails(input), rootDir));
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
        description: 'List browser-reachable assets or inspect one asset URL or file.',
        examples: [
            'remix assets',
            'remix assets /assets/app/actions/public/entry.ts',
            'remix assets app/actions/public/entry.ts',
        ],
        usage: ['remix assets [url-or-file]'],
    }, target);
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
