const {
  defaultAdapterExports,
  defaultRuntimeExports,
  architectSpecificExports,
  cloudflareSpecificExports,
  cloudflarePagesSpecificExports,
  cloudflareWorkersSpecificExports,
  nodeSpecificExports,
  reactSpecificExports,
} = require("./packageExports");

// const OFF = 0;
const WARN = 1;
const ERROR = 2;

const getReplaceRemixImportsMessage = (packageName) =>
  `All \`remix\` exports are considered deprecated as of v1.3.3. Please use \`@remix-run/${packageName}\` instead. Run \`npx @remix-run/dev@latest codemod replace-remix-magic-imports\` to automatically migrate your code.`;

const replaceRemixImportsOptions = [
  {
    packageExports: defaultAdapterExports,
    packageName:
      "{architect|cloudflare-pages|cloudflare-workers|express|netlify|vercel}",
  },
  { packageExports: defaultRuntimeExports, packageName: "{cloudflare|node}" },
  { packageExports: architectSpecificExports, packageName: "architect" },
  { packageExports: cloudflareSpecificExports, packageName: "cloudflare" },
  {
    packageExports: cloudflarePagesSpecificExports,
    packageName: "cloudflare-pages",
  },
  {
    packageExports: cloudflareWorkersSpecificExports,
    packageName: "cloudflare-workers",
  },
  { packageExports: nodeSpecificExports, packageName: "node" },
  { packageExports: reactSpecificExports, packageName: "react" },
].map(({ packageExports, packageName }) => ({
  importNames: [...packageExports.value, ...packageExports.type],
  message: getReplaceRemixImportsMessage(packageName),
  name: "remix",
}));

module.exports = {
  "array-callback-return": WARN,
  "getter-return": WARN,
  "new-parens": WARN,
  "no-array-constructor": WARN,
  "no-caller": ERROR,
  "no-cond-assign": [WARN, "except-parens"],
  "no-const-assign": ERROR,
  "no-control-regex": WARN,
  "no-dupe-args": WARN,
  "no-dupe-class-members": WARN,
  "no-dupe-keys": WARN,
  "no-duplicate-case": WARN,
  "no-empty-character-class": WARN,
  "no-empty-pattern": WARN,
  "no-duplicate-imports": WARN,
  "no-empty": [WARN, { allowEmptyCatch: true }],
  "no-eval": ERROR,
  "no-ex-assign": WARN,
  "no-extend-native": WARN,
  "no-extra-bind": WARN,
  "no-extra-label": WARN,
  "no-extra-boolean-cast": WARN,
  "no-func-assign": ERROR,
  "no-global-assign": ERROR,
  "no-implied-eval": WARN,
  "no-invalid-regexp": WARN,
  "no-label-var": WARN,
  "no-labels": [WARN, { allowLoop: true, allowSwitch: false }],
  "no-lone-blocks": WARN,
  "no-loop-func": WARN,
  "no-mixed-operators": [
    WARN,
    {
      groups: [
        ["&", "|", "^", "~", "<<", ">>", ">>>"],
        ["==", "!=", "===", "!==", ">", ">=", "<", "<="],
        ["&&", "||"],
        ["in", "instanceof"],
      ],
      allowSamePrecedence: false,
    },
  ],
  "no-unsafe-negation": WARN,
  "no-new-func": WARN,
  "no-new-object": WARN,
  "no-octal": WARN,
  "no-redeclare": ERROR,
  "no-restricted-imports": [WARN, ...replaceRemixImportsOptions],
  "no-script-url": WARN,
  "no-self-assign": WARN,
  "no-self-compare": WARN,
  "no-sequences": WARN,
  "no-shadow-restricted-names": WARN,
  "no-sparse-arrays": WARN,
  "no-template-curly-in-string": WARN,
  "no-this-before-super": WARN,
  "no-undef": ERROR,
  "no-unreachable": WARN,
  "no-unused-expressions": [
    WARN,
    {
      allowShortCircuit: true,
      allowTernary: true,
      allowTaggedTemplates: true,
    },
  ],
  "no-unused-labels": WARN,
  "no-unused-vars": [
    WARN,
    {
      args: "none",
      ignoreRestSiblings: true,
    },
  ],
  "no-use-before-define": [
    WARN,
    { classes: false, functions: false, variables: false },
  ],
  "no-useless-computed-key": WARN,
  "no-useless-concat": WARN,
  "no-useless-constructor": WARN,
  "no-useless-escape": WARN,
  "no-useless-rename": [
    WARN,
    {
      ignoreDestructuring: false,
      ignoreImport: false,
      ignoreExport: false,
    },
  ],
  "require-yield": WARN,
  "use-isnan": WARN,
  "valid-typeof": WARN,
};
