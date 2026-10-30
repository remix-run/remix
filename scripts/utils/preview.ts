export interface PreviewPackageManifest {
  name: string
  dependencies?: Record<string, string>
  optionalDependencies?: Record<string, string>
  scripts?: Record<string, string>
  publishConfig?: Record<string, unknown>
  [key: string]: unknown
}

export function getPreviewTarballUrl(
  branch: string,
  sha: string,
  packageDirName: string,
  repository = 'remix-run/remix',
): string {
  let ref = branch.split('/').map(encodeURIComponent).join('/')
  return `https://raw.githubusercontent.com/${repository}/${ref}/t/${sha.slice(0, 8)}/${packageDirName}.tgz`
}

export function preparePreviewPackage(
  manifest: PreviewPackageManifest,
  tarballUrls: Map<string, string>,
): PreviewPackageManifest {
  let pkg = { ...manifest, ...manifest.publishConfig }
  delete pkg.publishConfig

  for (let field of ['dependencies', 'optionalDependencies'] as const) {
    if (!pkg[field]) continue
    pkg[field] = { ...pkg[field] }
    for (let [name, version] of Object.entries(pkg[field])) {
      let url = tarballUrls.get(name)
      if (url) {
        pkg[field][name] = url
      } else if (name.startsWith('@remix-run/') || version.startsWith('workspace:')) {
        throw new Error(`Missing preview tarball for ${name} in ${pkg.name}`)
      }
    }
  }

  if (pkg.scripts) {
    pkg.scripts = { ...pkg.scripts }
    delete pkg.scripts.prepack
    delete pkg.scripts.postpack
  }

  return pkg
}
