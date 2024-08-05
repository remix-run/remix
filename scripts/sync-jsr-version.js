import * as fs from 'node:fs/promises';
import * as path from 'node:path';

const __dirname = path.dirname(new URL(import.meta.url).pathname);

let packageJsonPath = path.resolve(__dirname, '../package.json');
let jsrJsonPath = path.resolve(__dirname, '../jsr.json');

let packageVersion = JSON.parse(await fs.readFile(packageJsonPath)).version;

let jsrJson = JSON.parse(await fs.readFile(jsrJsonPath));
jsrJson.version = packageVersion;

await fs.writeFile(jsrJsonPath, JSON.stringify(jsrJson, null, 2) + '\n');
