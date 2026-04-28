import * as fs from 'node:fs/promises'

export async function readDevRemixVersion(): Promise<string | undefined> {
  return await readPackageVersion(new URL('../../../remix/package.json', import.meta.url), 'remix')
}

async function readPackageVersion(
  packageJsonUrl: URL,
  packageName: string,
): Promise<string | undefined> {
  try {
    let packageJson = JSON.parse(await fs.readFile(packageJsonUrl, 'utf8')) as {
      name?: string
      version?: string
    }

    if (packageJson.name !== packageName) {
      return undefined
    }

    let version = packageJson.version?.trim()
    return version != null && version.length > 0 ? version : undefined
  } catch {
    return undefined
  }
}
