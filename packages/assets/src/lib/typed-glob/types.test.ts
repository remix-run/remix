import type { Assert, IsEqual } from './type-test-utils.ts'
import type { GlobMatchOptions, MatchGlob, MatchedPatterns, ParseGlob } from './types.ts'

export type Tests = [
  // options contract
  Assert<
    IsEqual<
      keyof GlobMatchOptions,
      'dot' | 'nocase' | 'noglobstar' | 'noext' | 'nobrace' | 'matchBase'
    >
  >,

  // parser shape (AST exists)
  Assert<ParseGlob<'app/**/[a-z]/file.@(js|ts)'> extends { segments: unknown[] } ? true : false>,
  Assert<
    ParseGlob<'a/**/b'> extends {
      segments: [{ type: 'segment' }, { type: 'globstar' }, { type: 'segment' }]
    }
      ? true
      : false
  >,
  Assert<
    ParseGlob<'a/*/b'> extends {
      segments: [{ type: 'segment' }, { type: 'segment' }, { type: 'segment' }]
    }
      ? true
      : false
  >,
  Assert<ParseGlob<'a/@(b|c)'> extends { segments: unknown[] } ? true : false>,

  // core wildcard semantics
  Assert<IsEqual<MatchGlob<'abc', 'abc'>, true>>,
  Assert<IsEqual<MatchGlob<'abc', 'abd'>, false>>,
  Assert<IsEqual<MatchGlob<'abc', '*'>, true>>,
  Assert<IsEqual<MatchGlob<'abc/def', '*'>, false>>,
  Assert<IsEqual<MatchGlob<'abc', 'a*'>, true>>,
  Assert<IsEqual<MatchGlob<'ab/c', 'a*'>, false>>,
  Assert<IsEqual<MatchGlob<'ab', 'a?'>, true>>,
  Assert<IsEqual<MatchGlob<'a', 'a?'>, false>>,
  Assert<IsEqual<MatchGlob<'ab/c', 'a?'>, false>>,
  Assert<IsEqual<MatchGlob<'a/b/c', 'a/**/c'>, true>>,
  Assert<IsEqual<MatchGlob<'a/c', 'a/**/c'>, true>>,
  Assert<IsEqual<MatchGlob<'a/b/d', 'a/**/c'>, false>>,
  Assert<IsEqual<MatchGlob<'abc', 'a***c'>, true>>,
  Assert<IsEqual<MatchGlob<'abc', 'a*****?c'>, true>>,

  // escaping
  Assert<IsEqual<MatchGlob<'*', '\\*'>, true>>,
  Assert<IsEqual<MatchGlob<'?', '\\?'>, true>>,
  Assert<IsEqual<MatchGlob<'[', '[[]'>, true>>,
  Assert<IsEqual<MatchGlob<'\\', '[\\\\]'>, true>>,
  Assert<IsEqual<MatchGlob<'a*b', 'a\\*b'>, true>>,
  Assert<IsEqual<MatchGlob<'a?b', 'a\\?b'>, true>>,

  // brace expansion
  Assert<IsEqual<MatchGlob<'app/logo.png', '**/*.{png,jpg,jpeg}'>, true>>,
  Assert<IsEqual<MatchGlob<'app/logo.gif', '**/*.{png,jpg,jpeg}'>, false>>,
  Assert<IsEqual<MatchGlob<'x/c', '{a,b,**}/c'>, true>>,
  Assert<IsEqual<MatchGlob<'x/c', '{a,b}/c'>, false>>,
  Assert<IsEqual<MatchGlob<'b/file.ts', '{a,b}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'2/file.ts', '{1..3}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'2/file.ts', '{3..1}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'b/file.ts', '{a..c}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'b/file.ts', '{c..a}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'1/file.ts', '{1..3}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'3/file.ts', '{1..3}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'0/file.ts', '{1..3}/file.ts'>, false>>,
  Assert<IsEqual<MatchGlob<'9/file.ts', '{1..3}/file.ts'>, false>>,
  Assert<IsEqual<MatchGlob<'3/file.ts', '{3..1}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'1/file.ts', '{3..1}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'4/file.ts', '{3..1}/file.ts'>, false>>,
  Assert<IsEqual<MatchGlob<'5/file.ts', '{5..5}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'4/file.ts', '{5..5}/file.ts'>, false>>,
  Assert<IsEqual<MatchGlob<'a/file.ts', '{a..c}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'c/file.ts', '{a..c}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'d/file.ts', '{a..c}/file.ts'>, false>>,
  Assert<IsEqual<MatchGlob<'c/file.ts', '{c..a}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'a/file.ts', '{c..a}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'z/file.ts', '{z..z}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'y/file.ts', '{z..z}/file.ts'>, false>>,
  Assert<IsEqual<MatchGlob<'z/file.ts', '{a..c}/file.ts'>, false>>,
  Assert<IsEqual<MatchGlob<'v2.ts', 'v{1..3}.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'v4.ts', 'v{1..3}.ts'>, false>>,
  Assert<IsEqual<MatchGlob<'v8.ts', 'v{1..3,8}.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'v9.ts', 'v{1..3,8}.ts'>, false>>,
  Assert<IsEqual<MatchGlob<'v2.ts', 'v{1..3}.ts', { nobrace: true }>, false>>,
  Assert<IsEqual<MatchGlob<'v{1..3}.ts', 'v{1..3}.ts', { nobrace: true }>, true>>,
  Assert<IsEqual<MatchGlob<'10/file.ts', '{10..12}/file.ts'>, false>>,
  Assert<IsEqual<MatchGlob<'10..12/file.ts', '{10..12}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'B/file.ts', '{A..C}/file.ts'>, false>>,
  Assert<IsEqual<MatchGlob<'A..C/file.ts', '{A..C}/file.ts'>, true>>,
  Assert<IsEqual<MatchGlob<'x/a/c', 'x/{a,b}/c'>, true>>,
  Assert<IsEqual<MatchGlob<'x/d/c', 'x/{a,b}/c'>, false>>,
  Assert<IsEqual<MatchGlob<'x/{a,b}/c', 'x/{a,b}/c', { nobrace: true }>, true>>,
  Assert<IsEqual<MatchGlob<'x/a/c', 'x/{a,b}/c', { nobrace: true }>, false>>,
  Assert<IsEqual<MatchGlob<'ab', '*(a|{b,c})'>, true>>,
  Assert<IsEqual<MatchGlob<'ac', '*(a|{b,c})'>, true>>,
  Assert<IsEqual<MatchGlob<'x.{ts,js}', 'x.{ts,js}', { nobrace: true }>, true>>,
  Assert<IsEqual<MatchGlob<'x.ts', 'x.{ts,js}', { nobrace: true }>, false>>,

  // character classes
  Assert<IsEqual<MatchGlob<'app/logo5.png', 'app/logo[0-9].png'>, true>>,
  Assert<IsEqual<MatchGlob<'app/logoa.png', 'app/logo[0-9].png'>, false>>,
  Assert<IsEqual<MatchGlob<'app/logoa.png', 'app/logo[!0-9].png'>, true>>,
  Assert<IsEqual<MatchGlob<'app/logo5.png', 'app/logo[!0-9].png'>, false>>,
  Assert<IsEqual<MatchGlob<']', '[]]'>, true>>,
  Assert<IsEqual<MatchGlob<'p', '[a-z]'>, true>>,
  Assert<IsEqual<MatchGlob<'A', '[a-z]'>, false>>,
  Assert<IsEqual<MatchGlob<'m', '[m-z]'>, true>>,
  Assert<IsEqual<MatchGlob<'l', '[m-z]'>, false>>,
  Assert<IsEqual<MatchGlob<'a', '[!b-z]'>, true>>,
  Assert<IsEqual<MatchGlob<'m', '[!b-z]'>, false>>,
  Assert<IsEqual<MatchGlob<'5', '[0-9]'>, true>>,
  Assert<IsEqual<MatchGlob<'x', '[0-9]'>, false>>,
  Assert<IsEqual<MatchGlob<'5', '[[:digit:]]'>, true>>,
  Assert<IsEqual<MatchGlob<'x', '[[:digit:]]'>, false>>,
  Assert<IsEqual<MatchGlob<'a', '[[:alpha:]]'>, true>>,
  Assert<IsEqual<MatchGlob<'5', '[[:alpha:]]'>, false>>,
  Assert<IsEqual<MatchGlob<'f', '[[:xdigit:]]'>, true>>,
  Assert<IsEqual<MatchGlob<'G', '[[:xdigit:]]'>, false>>,
  Assert<IsEqual<MatchGlob<'A', '[[:upper:]]'>, true>>,
  Assert<IsEqual<MatchGlob<'a', '[[:upper:]]'>, false>>,
  Assert<IsEqual<MatchGlob<'a', '[[:lower:]]'>, true>>,
  Assert<IsEqual<MatchGlob<'A', '[[:lower:]]'>, false>>,
  Assert<IsEqual<MatchGlob<' ', '[[:space:]]'>, true>>,
  Assert<IsEqual<MatchGlob<'x', '[[:space:]]'>, false>>,
  Assert<IsEqual<MatchGlob<'_', '[[:word:]]'>, true>>,
  Assert<IsEqual<MatchGlob<'-', '[[:word:]]'>, false>>,
  Assert<IsEqual<MatchGlob<'é', '[[:alpha:]]'>, false>>,

  // extglobs
  Assert<IsEqual<MatchGlob<'app/main.ts', 'app/*.@(ts|tsx)'>, true>>,
  Assert<IsEqual<MatchGlob<'app/main.js', 'app/*.@(ts|tsx)'>, false>>,
  Assert<IsEqual<MatchGlob<'app/main.tsx', 'app/*.@(ts|tsx)'>, true>>,
  Assert<IsEqual<MatchGlob<'app/main.tsxx', 'app/*.@(ts|tsx)'>, false>>,
  Assert<IsEqual<MatchGlob<'foo.bar', '*.!(js)'>, true>>,
  Assert<IsEqual<MatchGlob<'foo.js', '*.!(js)'>, false>>,
  Assert<IsEqual<MatchGlob<'foo.ts', '*.!(js)'>, true>>,
  Assert<IsEqual<MatchGlob<'fool', '@(foo)*'>, true>>,
  Assert<IsEqual<MatchGlob<'foo', '@(foo)*'>, true>>,
  Assert<IsEqual<MatchGlob<'bar', '@(foo)*'>, false>>,
  Assert<IsEqual<MatchGlob<'app/main.css', 'app/*.?(map|ts)'>, false>>,
  Assert<IsEqual<MatchGlob<'app/main.map', 'app/*.?(map|ts)'>, true>>,
  Assert<IsEqual<MatchGlob<'app/main.ts', 'app/*.?(map|ts)'>, true>>,
  Assert<IsEqual<MatchGlob<'app/logoooo', 'app/log+(o)'>, true>>,
  Assert<IsEqual<MatchGlob<'app/log', 'app/log+(o)'>, false>>,
  Assert<IsEqual<MatchGlob<'app/log', 'app/log*(o)'>, true>>,
  Assert<IsEqual<MatchGlob<'app/logoooo', 'app/log*(o)'>, true>>,
  Assert<IsEqual<MatchGlob<'ac', '+(a)!(b)+(c)'>, true>>,
  Assert<IsEqual<MatchGlob<'acc', '+(a)!(b)+(c)'>, true>>,
  Assert<IsEqual<MatchGlob<'adc', '+(a)!(b)+(c)'>, true>>,
  Assert<IsEqual<MatchGlob<'abc', '+(a)!(b)+(c)'>, false>>,
  Assert<IsEqual<MatchGlob<'a(b', '@(a|a[(])b'>, true>>,
  Assert<IsEqual<MatchGlob<'a)b', '@(a|a[)])b'>, true>>,
  Assert<IsEqual<MatchGlob<'x.ts', '@(x.ts)', { noext: true }>, false>>,
  Assert<IsEqual<MatchGlob<'@(x.ts)', '@(x.ts)', { noext: true }>, true>>,

  // option semantics
  Assert<IsEqual<MatchGlob<'a/.d/b', 'a/*/b'>, false>>,
  Assert<IsEqual<MatchGlob<'a/.d/b', 'a/*/b', { dot: true }>, true>>,
  Assert<IsEqual<MatchGlob<'a/./b', 'a/*/b', { dot: true }>, false>>,
  Assert<IsEqual<MatchGlob<'a/../b', 'a/*/b', { dot: true }>, false>>,
  Assert<IsEqual<MatchGlob<'a/.d/b', 'a/.*/b'>, true>>,
  Assert<IsEqual<MatchGlob<'x/Y.ts', 'x/y.ts', { nocase: true }>, true>>,
  Assert<IsEqual<MatchGlob<'x/Y.ts', 'x/y.ts'>, false>>,
  Assert<IsEqual<MatchGlob<'X/Y.TS', 'x/y.ts', { nocase: true }>, true>>,
  Assert<IsEqual<MatchGlob<'X/Y.TS', 'x/y.ts'>, false>>,
  Assert<IsEqual<MatchGlob<'a/b/c', 'a/**/c', { noglobstar: true }>, true>>,
  Assert<IsEqual<MatchGlob<'a/b/d/c', 'a/**/c', { noglobstar: true }>, false>>,
  Assert<IsEqual<MatchGlob<'a/b/d/c', 'a/**/c'>, true>>,
  Assert<IsEqual<MatchGlob<'a/b/c', 'a/**', { noglobstar: true }>, false>>,
  Assert<IsEqual<MatchGlob<'a/**', 'a/**', { noglobstar: true }>, true>>,
  Assert<IsEqual<MatchGlob<'a.ts', '*.@(ts|js)', { noext: true }>, false>>,
  Assert<IsEqual<MatchGlob<'a.@(ts|js)', '*.@(ts|js)', { noext: true }>, true>>,
  Assert<IsEqual<MatchGlob<'x.ts', 'x.{ts,js}', { nobrace: true }>, false>>,
  Assert<IsEqual<MatchGlob<'x.ts', 'x.{ts,js}'>, true>>,
  Assert<IsEqual<MatchGlob<'x/y/acb', 'a?b', { matchBase: true }>, true>>,
  Assert<IsEqual<MatchGlob<'x/y/acb', 'a?b'>, false>>,
  Assert<IsEqual<MatchGlob<'x/y/acb/d', 'a?b', { matchBase: true }>, false>>,
  Assert<IsEqual<MatchGlob<'acb/', 'a?b', { matchBase: true }>, true>>,
  Assert<IsEqual<MatchGlob<'x/y/.env', '.env', { matchBase: true }>, true>>,
  Assert<IsEqual<MatchGlob<'x/y/.env', '*', { matchBase: true }>, false>>,
  Assert<IsEqual<MatchGlob<'x/y/.env', '*', { matchBase: true; dot: true }>, true>>,
  Assert<IsEqual<MatchGlob<'src/APP.TS', 'src/*.ts', { nocase: true }>, true>>,
  Assert<IsEqual<MatchGlob<'src/APP.TS', 'src/*.ts'>, false>>,

  // selected minimatch fixture-derived checks
  Assert<IsEqual<MatchGlob<'a/b', '**'>, true>>,
  Assert<IsEqual<MatchGlob<'a/.d', '**'>, false>>,
  Assert<IsEqual<MatchGlob<'a/.d', '**', { dot: true }>, true>>,
  Assert<IsEqual<MatchGlob<'x/y/acb', 'a?b', { matchBase: true }>, true>>,
  Assert<IsEqual<MatchGlob<'x/y/acb/d', 'a?b', { matchBase: true }>, false>>,
  Assert<IsEqual<MatchGlob<'abc', 'a***c'>, true>>,
  Assert<IsEqual<MatchGlob<'abc', 'a*****?c'>, true>>,
  Assert<IsEqual<MatchGlob<'\\', '[\\\\]'>, true>>,
  Assert<IsEqual<MatchGlob<'[', '[[]'>, true>>,
  Assert<IsEqual<MatchGlob<'*', '\\*'>, true>>,
  Assert<IsEqual<MatchGlob<'a/b', 'a/**/b'>, true>>,
  Assert<IsEqual<MatchGlob<'a/b/c/b', 'a/**/b'>, true>>,

  // path + pattern union filtering
  Assert<IsEqual<MatchGlob<'app/home/images/icon.svg', 'app/**/images/*.svg'>, true>>,
  Assert<IsEqual<MatchGlob<'app/home/icons/icon.svg', 'app/**/images/*.svg'>, false>>,
  Assert<IsEqual<MatchGlob<'app/photo.jpg', 'app/*.?pg'>, true>>,
  Assert<IsEqual<MatchGlob<'app/photo.jpeg', 'app/*.?pg'>, false>>,
  Assert<
    IsEqual<
      MatchedPatterns<
        'app/home/images/icon.svg',
        '**/*.{png,jpg,jpeg}' | 'app/**/images/*.svg' | 'docs/**/*'
      >,
      'app/**/images/*.svg'
    >
  >,
  Assert<
    IsEqual<
      MatchedPatterns<
        'SRC/.env',
        'src/*' | 'src/.env' | 'src/**/*.ts',
        { nocase: true; dot: true }
      >,
      'src/*' | 'src/.env'
    >
  >,
  Assert<IsEqual<MatchedPatterns<'src/file.ts', 'src/*.ts' | 'src/*.js' | 'docs/**'>, 'src/*.ts'>>,
  Assert<IsEqual<MatchedPatterns<'src/file.css', 'src/*.ts' | 'src/*.js' | 'docs/**'>, never>>,
  Assert<
    IsEqual<
      MatchedPatterns<'x/y/acb', 'a?b' | 'x/**/a?b' | 'z/**', { matchBase: true }>,
      'a?b' | 'x/**/a?b'
    >
  >,
]
