import * as crypto from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as os from 'node:os';
import * as path from 'node:path';
import * as process from 'node:process';
const REMIX_SKILLS_CACHE_VERSION = 1;
const REMIX_SKILLS_CACHE_REPO = 'remix-run/remix';
const REMIX_SKILLS_CACHE_REF = 'main';
export function createSkillsCacheManifest(skillsDir, skills) {
    return {
        ref: REMIX_SKILLS_CACHE_REF,
        repo: REMIX_SKILLS_CACHE_REPO,
        skills,
        skillsDir: path.resolve(skillsDir),
        version: REMIX_SKILLS_CACHE_VERSION,
    };
}
export function getSkillsCacheFilePath(skillsDir) {
    let cacheKey = crypto.createHash('sha256').update(path.resolve(skillsDir)).digest('hex');
    return path.join(getSkillsCacheDir(), `${cacheKey}.json`);
}
export async function readSkillsCache(skillsDir) {
    try {
        let filePath = getSkillsCacheFilePath(skillsDir);
        let raw = JSON.parse(await fs.readFile(filePath, 'utf8'));
        return isSkillsCacheManifest(raw, skillsDir) ? raw : null;
    }
    catch (error) {
        if (error instanceof SyntaxError) {
            return null;
        }
        let nodeError = error;
        if (nodeError.code === 'ENOENT') {
            return null;
        }
        throw error;
    }
}
export async function writeSkillsCache(skillsDir, manifest) {
    let filePath = getSkillsCacheFilePath(skillsDir);
    let tempPath = `${filePath}.${process.pid}.${Date.now()}.tmp`;
    await fs.mkdir(path.dirname(filePath), { recursive: true });
    await fs.writeFile(tempPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
    await fs.rename(tempPath, filePath);
}
function getSkillsCacheDir() {
    if (process.platform === 'win32') {
        let localAppData = process.env.LOCALAPPDATA ?? path.join(os.homedir(), 'AppData', 'Local');
        return path.join(localAppData, 'remix', 'Cache', 'skills');
    }
    if (process.platform === 'darwin') {
        return path.join(process.env.HOME ?? os.homedir(), 'Library', 'Caches', 'remix', 'cli', 'skills');
    }
    let xdgCacheHome = process.env.XDG_CACHE_HOME ?? path.join(os.homedir(), '.cache');
    return path.join(xdgCacheHome, 'remix', 'cli', 'skills');
}
function isSkillsCacheManifest(value, skillsDir) {
    if (typeof value !== 'object' || value == null) {
        return false;
    }
    if (Reflect.get(value, 'version') !== REMIX_SKILLS_CACHE_VERSION ||
        Reflect.get(value, 'repo') !== REMIX_SKILLS_CACHE_REPO ||
        Reflect.get(value, 'ref') !== REMIX_SKILLS_CACHE_REF ||
        Reflect.get(value, 'skillsDir') !== path.resolve(skillsDir)) {
        return false;
    }
    let skills = Reflect.get(value, 'skills');
    if (typeof skills !== 'object' || skills == null) {
        return false;
    }
    for (let skillEntry of Object.values(skills)) {
        if (typeof skillEntry !== 'object' || skillEntry == null) {
            return false;
        }
        let files = Reflect.get(skillEntry, 'files');
        if (typeof files !== 'object' || files == null) {
            return false;
        }
        for (let fileEntry of Object.values(files)) {
            if (typeof fileEntry !== 'object' ||
                fileEntry == null ||
                typeof Reflect.get(fileEntry, 'localHash') !== 'string' ||
                typeof Reflect.get(fileEntry, 'remoteSha') !== 'string') {
                return false;
            }
        }
    }
    return true;
}
