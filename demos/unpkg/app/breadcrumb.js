import { html } from './utils/render.js';
export function renderBreadcrumb(packageName, version, dirPath) {
    let parts = [
        { name: 'Home', href: '/' },
        { name: `${packageName}@${version}`, href: `/${packageName}@${version}` },
    ];
    if (dirPath) {
        let pathParts = dirPath.split('/');
        let currentPath = '';
        for (let part of pathParts) {
            currentPath += (currentPath ? '/' : '') + part;
            parts.push({
                name: part,
                href: `/${packageName}@${version}/${currentPath}`,
            });
        }
    }
    let links = parts.map((part, i) => {
        if (i === parts.length - 1) {
            return html `<span>${part.name}</span>`;
        }
        return html `<a href="${part.href}">${part.name}</a>`;
    });
    return html `<nav class="breadcrumb">
    ${links.map((link, i) => (i === 0 ? link : html ` / ${link}`))}
  </nav>`;
}
