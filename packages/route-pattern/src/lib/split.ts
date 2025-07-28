type Span = [number, number];

export function split(source: string): {
  protocol?: Span;
  hostname?: Span;
  pathname?: Span;
  search?: Span;
} {
  const result: {
    protocol?: Span;
    hostname?: Span;
    pathname?: Span;
    search?: Span;
  } = {};

  // search
  const searchStart = source.indexOf('?');
  if (searchStart !== -1) {
    result.search = [searchStart + 1, source.length];
    source = source.slice(0, searchStart);
  }

  let index = 0;
  const solidus = source.indexOf('://');
  if (solidus !== -1) {
    // protocol
    if (solidus !== 0) {
      result.protocol = [0, solidus];
    }
    index = solidus + 3;

    // hostname
    const hostnameEnd = source.indexOf('/', index);
    if (hostnameEnd === -1) {
      result.hostname = [index, source.length];
      return result;
    }
    result.hostname = [index, hostnameEnd];
    index = hostnameEnd + 1;
  }

  // pathname
  if (index !== source.length) {
    result.pathname = [index, source.length];
  }

  return result;
}
