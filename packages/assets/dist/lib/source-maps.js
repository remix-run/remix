import { SourceMapConsumer, SourceMapGenerator } from 'source-map-js';
import { normalizeFilePath } from './paths.js';
export function replaceSourceMapMappings(sourceMap, generatedSource, originalSource, replacements) {
    if (replacements.length === 0)
        return sourceMap;
    let consumer = new SourceMapConsumer(JSON.parse(sourceMap));
    let generatedLineStarts = getLineStarts(generatedSource);
    let originalLineStarts = getLineStarts(originalSource);
    let positions = replacements.map((replacement) => ({
        generated: getLineAndColumn(generatedLineStarts, replacement.generatedOffset),
        name: replacement.name,
        original: getLineAndColumn(originalLineStarts, replacement.originalOffset),
    }));
    let replacedGeneratedPositions = new Set(positions.map(({ generated }) => `${generated.line}:${generated.column}`));
    let generator = new SourceMapGenerator({
        file: consumer.file ?? undefined,
        sourceRoot: consumer.sourceRoot ?? undefined,
    });
    consumer.eachMapping((mapping) => {
        if (replacedGeneratedPositions.has(`${mapping.generatedLine}:${mapping.generatedColumn}`)) {
            return;
        }
        generator.addMapping({
            generated: { line: mapping.generatedLine, column: mapping.generatedColumn },
            original: mapping.originalLine === null || mapping.originalColumn === null
                ? undefined
                : { line: mapping.originalLine, column: mapping.originalColumn },
            source: mapping.source,
            name: mapping.name,
        });
    });
    let source = consumer.sources[0] ?? '';
    for (let position of positions) {
        generator.addMapping({ ...position, source });
    }
    for (let source of consumer.sources) {
        generator.setSourceContent(source, consumer.sourceContentFor(source, true));
    }
    return generator.toString();
}
export function composeSourceMaps(rewriteSourceMap, transformSourceMap) {
    let rewriteConsumer = new SourceMapConsumer(JSON.parse(rewriteSourceMap));
    let transformConsumer = new SourceMapConsumer(JSON.parse(transformSourceMap));
    let generator = new SourceMapGenerator();
    rewriteConsumer.eachMapping((mapping) => {
        if (mapping.originalLine == null ||
            mapping.originalColumn == null ||
            mapping.generatedLine == null ||
            mapping.generatedColumn == null) {
            return;
        }
        let original = transformConsumer.originalPositionFor({
            line: mapping.originalLine,
            column: mapping.originalColumn,
        });
        if (original.line == null || original.column == null || original.source == null)
            return;
        generator.addMapping({
            generated: {
                line: mapping.generatedLine,
                column: mapping.generatedColumn,
            },
            original: {
                line: original.line,
                column: original.column,
            },
            source: original.source,
            name: original.name ?? mapping.name ?? undefined,
        });
    });
    for (let source of transformConsumer.sources) {
        let sourceContent = transformConsumer.sourceContentFor(source, true);
        if (sourceContent !== null) {
            generator.setSourceContent(source, sourceContent);
        }
    }
    return JSON.stringify(generator.toJSON());
}
export function rewriteSourceMapSources(sourceMap, resolvedPath, stableUrlPathname, sourceMapSourcePaths, sourceContent) {
    let json = JSON.parse(sourceMap);
    json.sources = [
        sourceMapSourcePaths === 'absolute' ? normalizeFilePath(resolvedPath) : stableUrlPathname,
    ];
    if (sourceContent !== undefined) {
        json.sourcesContent = [sourceContent];
    }
    return JSON.stringify(json);
}
export function stringifySourceMap(map) {
    if (!map)
        return null;
    if (typeof map === 'string')
        return map;
    if (map instanceof Uint8Array) {
        return Buffer.from(map).toString('utf8');
    }
    if (typeof map === 'object' && map !== null)
        return JSON.stringify(map);
    return String(map);
}
function getLineStarts(source) {
    let starts = [0];
    for (let index = 0; index < source.length; index++) {
        if (source[index] === '\n')
            starts.push(index + 1);
    }
    return starts;
}
function getLineAndColumn(lineStarts, offset) {
    let low = 0;
    let high = lineStarts.length;
    while (low + 1 < high) {
        let middle = Math.floor((low + high) / 2);
        if (lineStarts[middle] <= offset)
            low = middle;
        else
            high = middle;
    }
    return { line: low + 1, column: offset - lineStarts[low] };
}
