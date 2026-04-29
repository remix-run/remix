export interface SkillsCacheFileEntry {
    localHash: string;
    remoteSha: string;
}
export interface SkillsCacheSkillEntry {
    files: Record<string, SkillsCacheFileEntry>;
}
export interface SkillsCacheManifest {
    ref: string;
    repo: string;
    skills: Record<string, SkillsCacheSkillEntry>;
    skillsDir: string;
    version: number;
}
export declare function createSkillsCacheManifest(skillsDir: string, skills: Record<string, SkillsCacheSkillEntry>): SkillsCacheManifest;
export declare function getSkillsCacheFilePath(skillsDir: string): string;
export declare function readSkillsCache(skillsDir: string): Promise<SkillsCacheManifest | null>;
export declare function writeSkillsCache(skillsDir: string, manifest: SkillsCacheManifest): Promise<void>;
//# sourceMappingURL=skills-cache.d.ts.map