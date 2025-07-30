import { request } from '@octokit/request';

import { getChanges } from './changes.ts';

const token = process.env.GITHUB_TOKEN;

export async function createRelease(packageName: string, version: string): Promise<string> {
  if (token === undefined) {
    console.error('GITHUB_TOKEN environment variable is required to create a GitHub release');
    process.exit(1);
  }

  let tagName = `${packageName}@${version}`;
  let changes = getChanges(packageName, version);

  let response = await request('POST /repos/{owner}/{repo}/releases', {
    headers: {
      authorization: `token ${token}`,
    },
    owner: 'remix-run',
    repo: 'remix',
    tag_name: tagName,
    name: `${packageName} v${version}`,
    body: changes?.body ?? 'No changes.',
  });

  if (response.status !== 201) {
    console.error('Failed to create release:', response);
    process.exit(1);
  }

  return response.data.html_url;
}
