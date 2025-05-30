#!/bin/bash

set -x
set -e

# In this repo
SOURCE_GIT="git@github.com:mjackson/remix-the-web.git"
# Cloned locally to this folder
SOURCE_REPO_DIR="temp-rtw"
# Copy files as of this ref
SOURCE_REF="main"
# Using a temp branch named
SOURCE_WORKING_BRANCH="migration-src"

# And re-play it in this repo
DEST_GIT="git@github.com:remix-run/remix.git"
# Cloned locally to this folder
DEST_REPO_DIR="temp-remix"
# Onto this branch
DEST_BRANCH="v3"
# Using a temp branch named
DEST_WORKING_BRANCH="migration-dest"
# Using the source rpo as this remote
TEMP_SOURCE_REMOTE_NAME="rtw"

rm -rf $SOURCE_REPO_DIR
rm -rf $DEST_REPO_DIR

# Clone fresh copies of the repos
git clone $SOURCE_GIT $SOURCE_REPO_DIR
git clone $DEST_GIT $DEST_REPO_DIR

# Remove origins so we can't accidentally mess them up
cd $SOURCE_REPO_DIR
git remote rm origin
cd ..
cd $DEST_REPO_DIR
git checkout $DEST_BRANCH
git remote rm origin
cd ..

cd $SOURCE_REPO_DIR

git checkout -b $SOURCE_WORKING_BRANCH $SOURCE_REF
git-filter-repo --force \
  --path .env.example \
  --path .github \
  --path .gitignore \
  --path .prettierrc \
  --path .vscode \
  --path CONTRIBUTING.md \
  --path LICENSE \
  --path package.json \
  --path packages \
  --path pnpm-lock.yaml \
  --path pnpm-workspace.yaml \
  --path scripts

git reset --hard
git gc --aggressive
git prune
cd ..

cd $DEST_REPO_DIR
git checkout -b $DEST_WORKING_BRANCH
git remote add $TEMP_SOURCE_REMOTE_NAME ../$SOURCE_REPO_DIR
# Only fetch the migration branch, don't include tags
git fetch $TEMP_SOURCE_REMOTE_NAME $SOURCE_WORKING_BRANCH
git merge $TEMP_SOURCE_REMOTE_NAME/$SOURCE_WORKING_BRANCH --allow-unrelated-histories --no-edit
cd ..

set +x
set +e

echo "✅ Migration complete!"
echo ""
echo "To finish:"
echo "  cd ${DEST_REPO_DIR}"
echo "  git remote add origin ${DEST_GIT}"
echo "  git push --set-upstream origin $DEST_WORKING_BRANCH"
echo ""
echo "Then open a PR to the ${DEST_BRANCH} branch and perform a **NORMAL MERGE**"
echo "  https://github.com/remix-run/remix/compare/${DEST_BRANCH}...${DEST_WORKING_BRANCH}?expand=1"
echo ""
