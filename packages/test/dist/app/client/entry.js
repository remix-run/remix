import { normalizeLine } from "../../lib/normalize.js";
const STYLES = `
.rt-container {
  font-family: monospace;
  padding: 16px;
  max-width: 900px;
}
.rt-summary {
  margin-bottom: 16px;
  line-height: 1.6;
}
.rt-summary-row {
  display: block;
}
.rt-info {
  color: #0ea5e9;
}
.rt-indent {
  margin-left: 16px;
  margin-top: 4px;
}
.rt-suite-details {
  margin-bottom: 8px;
}
.rt-suite-summary {
  cursor: pointer;
  padding: 2px 0;
  user-select: none;
}
.rt-suite-icon {
  margin-left: 6px;
}
.rt-test-item {
  padding: 3px 18px;
}
.rt-test-duration {
  color: #999;
  font-size: 0.85em;
}
.rt-error-pre {
  margin: 4px 0 4px 16px;
  padding: 8px 12px;
  font-size: 12px;
  color: #dc2626;
  background: #fff5f5;
  border-left: 3px solid #dc2626;
  white-space: pre-wrap;
  word-break: break-word;
}
.rt-error-stack {
  color: #999;
  margin-top: 6px;
}
.rt-button {
  margin-top: 8px;
  padding: 6px 12px;
  cursor: pointer;
}
.rt-stack-link {
  color: inherit;
  text-decoration: underline;
  text-decoration-color: #aaa;
}
.rt-passed {
  color: #16a34a;
}
.rt-failed {
  color: #dc2626;
}
.rt-muted {
  color: #666;
}
.rt-todo {
  color: #a16207;
}
`;
const styleEl = document.createElement('style');
styleEl.textContent = STYLES;
document.head.appendChild(styleEl);
const setupEl = document.getElementById('test-setup');
if (!setupEl?.textContent) {
    throw new Error('Test runner: missing #test-setup payload');
}
const setup = JSON.parse(setupEl.textContent);
const root = document.getElementById('test-root');
if (!root) {
    throw new Error('Test runner: missing #test-root mount point');
}
mountTests(root, setup);
function mountTests(host, setup) {
    let startTime = performance.now();
    let totals = { passed: 0, failed: 0, skipped: 0, todo: 0 };
    let container = el('div', { id: 'test-status', className: 'rt-container' });
    host.appendChild(container);
    let summary = el('div', { className: 'rt-summary' });
    container.appendChild(summary);
    let testsRow = summaryRow();
    let passRow = summaryRow();
    let failRow = summaryRow();
    let skippedRow = summaryRow();
    let todoRow = summaryRow();
    let durationRow = summaryRow();
    summary.append(testsRow.el, passRow.el, failRow.el);
    let suitesContainer = el('div');
    container.appendChild(suitesContainer);
    function renderSummary(done) {
        let total = totals.passed + totals.failed + totals.skipped + totals.todo;
        testsRow.text(`tests ${total}`);
        passRow.text(`pass ${totals.passed}`);
        failRow.text(`fail ${totals.failed}`);
        if (totals.skipped > 0) {
            if (!skippedRow.el.parentNode)
                summary.appendChild(skippedRow.el);
            skippedRow.text(`skipped ${totals.skipped}`);
        }
        if (totals.todo > 0) {
            if (!todoRow.el.parentNode)
                summary.appendChild(todoRow.el);
            todoRow.text(`todo ${totals.todo}`);
        }
        if (done) {
            if (!durationRow.el.parentNode)
                summary.appendChild(durationRow.el);
            durationRow.text(`duration_ms ${(performance.now() - startTime).toFixed(5)}`);
        }
    }
    function appendFileSuites(fileResults) {
        let suiteMap = new Map();
        for (let test of fileResults.tests) {
            let suite = test.suiteName || 'Tests';
            if (!suiteMap.has(suite))
                suiteMap.set(suite, []);
            suiteMap.get(suite).push(test);
        }
        for (let [suiteName, tests] of suiteMap) {
            suitesContainer.appendChild(buildSuite(suiteName, tests, setup.baseDir));
        }
    }
    function appendRerunButton() {
        let button = el('button', { className: 'rt-button', textContent: 'Re-run' });
        button.type = 'button';
        button.addEventListener('click', () => window.location.reload());
        container.appendChild(button);
    }
    renderSummary(false);
    void (async () => {
        for (let testFile of setup.testPaths) {
            let fileResults = await runInIframe(testFile);
            await fetch('/file-results', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(fileResults),
            });
            totals.passed += fileResults.passed;
            totals.failed += fileResults.failed;
            totals.skipped += fileResults.skipped;
            totals.todo += fileResults.todo;
            appendFileSuites(fileResults);
            renderSummary(false);
        }
        renderSummary(true);
        appendRerunButton();
        window.__testsDone = true;
    })();
}
function runInIframe(testFile) {
    return new Promise((resolve) => {
        let iframe = document.createElement('iframe');
        iframe.src = `/iframe?file=${encodeURIComponent(testFile)}`;
        document.body.appendChild(iframe);
        function onMessage(event) {
            if (event.source !== iframe.contentWindow)
                return;
            window.removeEventListener('message', onMessage);
            // Hide instead of remove so when coverage is enabled the iframe remains attached
            // so V8 retains its scripts and Playwright can collect coverage at run end.
            iframe.style.display = 'none';
            if (event.data.type === 'test-results') {
                let { passed, failed, skipped, todo, tests } = event.data.results;
                resolve({
                    passed,
                    failed,
                    skipped,
                    todo,
                    tests: tests.map((t) => ({ ...t, filePath: testFile })),
                });
            }
            else {
                let { message, stack } = event.data.error;
                resolve({
                    passed: 0,
                    failed: 1,
                    skipped: 0,
                    todo: 0,
                    tests: [
                        {
                            name: '',
                            suiteName: testFile,
                            filePath: testFile,
                            status: 'failed',
                            error: { message, stack },
                            duration: 0,
                        },
                    ],
                });
            }
        }
        window.addEventListener('message', onMessage);
    });
}
function buildSuite(suiteName, tests, baseDir) {
    let suiteFailed = tests.some((t) => t.status === 'failed');
    let suiteAllSkipped = tests.every((t) => t.status === 'skipped');
    let suiteAllTodo = tests.every((t) => t.status === 'todo');
    let stateClass = suiteFailed
        ? 'rt-failed'
        : suiteAllSkipped
            ? 'rt-muted'
            : suiteAllTodo
                ? 'rt-todo'
                : 'rt-passed';
    let icon = suiteFailed ? '✗' : suiteAllSkipped ? '↓' : suiteAllTodo ? '…' : '✓';
    let suffix = suiteAllSkipped ? ' # skipped' : suiteAllTodo ? ' # todo' : '';
    let details = el('details', { className: 'rt-suite-details' });
    if (suiteFailed)
        details.open = true;
    let summary = el('summary', { className: `rt-suite-summary ${stateClass}` });
    summary.appendChild(el('span', { className: 'rt-suite-icon', textContent: `${icon} ${suiteName}${suffix}` }));
    details.appendChild(summary);
    let body = el('div', { className: 'rt-indent' });
    for (let test of tests) {
        let item = buildTestItem(test, baseDir);
        if (item)
            body.appendChild(el('div', { className: 'rt-test-item' }, item));
    }
    details.appendChild(body);
    return details;
}
function buildTestItem(test, baseDir) {
    if (test.status === 'passed') {
        let row = el('div', { className: 'rt-passed' });
        row.append(`✓ ${test.name} `);
        row.appendChild(el('span', {
            className: 'rt-test-duration',
            textContent: `(${test.duration.toFixed(2)}ms)`,
        }));
        return row;
    }
    if (test.status === 'failed') {
        let row = el('div', { className: 'rt-failed' });
        row.append(`✗ ${test.name} `);
        row.appendChild(el('span', {
            className: 'rt-test-duration',
            textContent: `(${test.duration.toFixed(2)}ms)`,
        }));
        if (test.error) {
            let pre = el('pre', { className: 'rt-error-pre' });
            pre.append(test.error.message);
            if (test.error.stack) {
                let stackDiv = el('div', { className: 'rt-error-stack' });
                stackDiv.appendChild(buildStack(test.error.stack, baseDir));
                pre.appendChild(stackDiv);
            }
            row.appendChild(pre);
        }
        return row;
    }
    if (test.status === 'skipped' && test.name) {
        return el('div', { className: 'rt-muted', textContent: `↓ ${test.name} # skipped` });
    }
    if (test.status === 'todo' && test.name) {
        return el('div', { className: 'rt-todo', textContent: `… ${test.name} # todo` });
    }
    return null;
}
function buildStack(stack, baseDir) {
    let frameLocRe = /([^():\s][^():]*\.[jt]sx?):(\d+):(\d+)/;
    let frag = document.createDocumentFragment();
    for (let raw of stack.split('\n')) {
        let isTestModule = raw.includes('/@test/');
        let line = normalizeLine(raw);
        let match = isTestModule ? frameLocRe.exec(line) : null;
        let div = document.createElement('div');
        if (match) {
            let [full, file, row, col] = match;
            let abs = `${baseDir}/${file}`;
            let href = `vscode://file/${abs}:${row}:${col}`;
            div.append(line.slice(0, match.index));
            let a = el('a', { className: 'rt-stack-link', textContent: full });
            a.href = href;
            div.appendChild(a);
            div.append(line.slice(match.index + full.length));
        }
        else {
            div.textContent = line;
        }
        frag.appendChild(div);
    }
    return frag;
}
function summaryRow() {
    let row = el('span', { className: 'rt-summary-row' });
    let icon = el('span', { className: 'rt-info', textContent: 'ℹ' });
    let textNode = document.createTextNode('');
    row.append(icon, ' ', textNode);
    return {
        el: row,
        text(s) {
            textNode.data = ' ' + s;
        },
    };
}
function el(tag, props, ...children) {
    let node = document.createElement(tag);
    if (props?.id)
        node.id = props.id;
    if (props?.className)
        node.className = props.className;
    if (props?.textContent != null)
        node.textContent = props.textContent;
    if (children.length)
        node.append(...children);
    return node;
}
