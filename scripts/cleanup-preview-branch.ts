import { spawnSync } from 'node:child_process'

import {
  getRetainedPreviewBuilds,
  loadPreviousPreview,
  restorePreviewTarballs,
  writePreviewManifest,
} from './utils/preview-retention.ts'
import { logAndExec } from './utils/process.ts'

const branch = 'preview/main'
if (logAndExec('git', ['status', '--porcelain'], true)) {
  throw new Error('Git working directory is not clean')
}
const previous = loadPreviousPreview(branch)
if (!previous) {
  console.log('No tarball preview to clean up.')
} else {
  let { manifest } = previous
  let builds = getRetainedPreviewBuilds(branch, manifest.builds, manifest.sha)
  if (builds.length === manifest.builds.length) {
    console.log('No expired preview builds.')
  } else {
    // Parent the replacement snapshot to source so expired artifacts leave history.
    let source = spawnSync('git', ['cat-file', '-e', `${manifest.sha}^{commit}`], { stdio: 'pipe' })
    if (source.status !== 0) {
      logAndExec('git', ['fetch', '--no-tags', '--depth=1', 'origin', manifest.sha])
    }
    logAndExec('git', ['checkout', '-B', branch, manifest.sha])
    logAndExec('git', [
      'restore',
      '--source',
      previous.commit,
      '--worktree',
      '--',
      ':(glob)packages/*/package.json',
    ])
    restorePreviewTarballs(previous, builds)
    await writePreviewManifest({ ...manifest, builds })
    logAndExec('git', ['add', 'tarballs', ':(glob)packages/*/package.json'])
    logAndExec('git', ['commit', '-m', `prune expired preview tarballs from ${manifest.sha}`])
    logAndExec('git', [
      'push',
      `--force-with-lease=refs/heads/${branch}:${previous.commit}`,
      'origin',
      `HEAD:refs/heads/${branch}`,
    ])
  }
}
