const fs = require('fs');
const path = require('path');

module.exports = async ({ github, context }, versionPostfix) => {
    console.log(versionPostfix);
    console.log(__dirname);

    const packageJSONPath = path.join(
        __dirname,
        '..',
        '..',
        'packages',
        'remix-dev',
        'package.json'
    );

    const packageJSON = JSON.parse(fs.readFileSync(packageJSONPath, 'utf-8'));

    packageJSON.name = '@vercel/remix-run-dev'

    if (versionPostfix) {
        packageJSON.version = `${packageJSON.version}-${versionPostfix}`
    }
};