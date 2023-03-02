const { execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

module.exports = async ({ github, context }) => {
    const { owner, repo } = context.repo;

    try {
        const packageJSONPath = path.join(
            __dirname,
            '..',
            '..',
            'packages',
            'remix-dev',
            'package.json'
        );

        let packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, 'utf-8'));

        const existingVersion = packageJSON.version;
    
        await github.rest.repos.mergeUpstream({
            owner,
            repo,
            branch: 'main',
        });

        execSync('git pull origin main');

        packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, 'utf-8'));

        const newVersion = packageJSON.version;

        if (existingVersion !== newVersion) {
            await github.rest.actions.createWorkflowDispatch({
                owner,
                repo,
                workflow_id: 'publish.yml',
                ref: 'main'
            });
        }

    } catch (err) {
        // Conflict detected
        if (err.status === 409) {
            const commit = await github.rest.repos.getCommit({
                owner: 'remix-run',
                repo: 'remix',
                ref: 'main'
            });
            const title = `Merge Conflict ❌`;
            const body = `Latest commit: ${commit.data.html_url}`;
            const issues = await github.rest.issues.listForRepo({
                owner,
                repo,
            });
            const existingIssue = issues.data.find((issue) => issue.title === title);
            if (existingIssue) {
                if (existingIssue.body !== body) {
                    await github.rest.issues.update({
                        owner,
                        repo,
                        issue_number: existingIssue.number,
                        body
                    });
                } else {
                    console.log(`Latest merge conflict commit did not change.`)
                }
            } else {
                await github.rest.issues.create({
                    owner,
                    repo,
                    title,
                    body
                });
            }
        }

        throw err
    }
};