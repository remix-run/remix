import { defineLexiconConfig } from '@atcute/lex-cli'

export default defineLexiconConfig({
  files: ['lexicons/**/*.json'],
  outdir: 'app/lexicons/',
  modules: {
    importSuffix: '.ts',
  },
})
