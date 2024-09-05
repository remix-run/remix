// @ts-check
const { default: defaultChangelogRenderer } = require('nx/release/changelog-renderer');

const changelogRenderer = async ({
  projectGraph,
  commits,
  releaseVersion,
  project,
  entryWhenNoChanges,
  changelogRenderOptions,
  repoSlug,
  conventionalCommitsConfig,
  changes,
}) => {
  const defaultChangelog = await defaultChangelogRenderer({
    projectGraph,
    commits,
    releaseVersion,
    project,
    entryWhenNoChanges,
    changelogRenderOptions,
    repoSlug,
    conventionalCommitsConfig,
    changes,
  });
  // Rename the authors section title
  return defaultChangelog.replace('❤️  Thank You', 'Contributors');
};

module.exports = changelogRenderer;
