import { describe, it } from 'node:test';
import * as assert from 'node:assert/strict';

import { parseTarHeader } from './tar.js';

describe('parseTarHeader', () => {
  it('parses a tarball header', () => {
    const header = new TextEncoder().encode(
      `0000644 0001750 0001750 00000000000 13175443722 015754 0ustar  000000 00000000 `,
    );
  });
});
