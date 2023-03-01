module.exports = async ({ github, context }, version) => {
    await github.rest.actions.createWorkflowDispatch({
        owner: context.repo.owner,
        repo: 'vercel',
        workflow_id: 'update-remix-run-dev.yml',
        ref: 'main',
        inputs: {
            'new-version': version
        }
    });
}