const fs = require('fs');
const path = require('path');

module.exports = async ({ github, context }) => {
    const { owner, repo } = context.repo;

    try {
        await github.rest.repos.mergeUpstream({
            owner,
            repo,
            branch: 'main',
        })
    } catch (err) {
        // Conflict detected
        if (err.code === 409) {

        }

        throw err
    }
};