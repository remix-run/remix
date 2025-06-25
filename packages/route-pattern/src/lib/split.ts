export function split(source: string) {
  const result: {
    protocol?: string;
    hostname?: string;
    pathname?: string;
    search?: string;
  } = {};

  // search
  const searchStart = source.indexOf('?');
  if (searchStart !== -1) {
    result.search = source.slice(searchStart + 1);
    source = source.slice(0, searchStart);
  }

  let index = 0;
  const solidus = source.indexOf('://');
  if (solidus !== -1) {
    // protocol
    if (solidus !== 0) {
      result.protocol = source.slice(0, solidus);
    }
    index = solidus + 3;

    // hostname
    const hostnameEnd = source.indexOf('/', index);
    if (hostnameEnd === -1) {
      result.hostname = source.slice(index, source.length);
      return result;
    }
    result.hostname = source.slice(index, hostnameEnd);
    index = hostnameEnd + 1;
  }

  // pathname
  if (index !== source.length) {
    result.pathname = source.slice(index);
  }

  return result;
}
