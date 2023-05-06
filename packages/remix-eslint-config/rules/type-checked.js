const OFF = 0;
const WARN = 1;
const ERROR = 2;

module.exports = {
  // Additional recommended rules that require type information, to prepare for when end applications enable
  // "plugin:@typescript-eslint/recommended-requiring-type-checking".
  // Include individual rules from https://github.com/typescript-eslint/typescript-eslint/blob/main/packages/eslint-plugin/src/configs/recommended-requiring-type-checking.ts
  // Requires more memory: NODE_OPTIONS="--max-old-space-size=6144"

  "@typescript-eslint/await-thenable": OFF,
  "@typescript-eslint/no-floating-promises": OFF,
  "@typescript-eslint/no-for-in-array": ERROR,
  "@typescript-eslint/no-implied-eval": ERROR,
  "@typescript-eslint/no-misused-promises": [
    ERROR,
    { checksVoidReturn: { arguments: false, properties: false } },
  ],
  "@typescript-eslint/no-unnecessary-type-assertion": OFF,
  "@typescript-eslint/no-unsafe-argument": OFF,
  "@typescript-eslint/no-unsafe-assignment": OFF,
  "@typescript-eslint/no-unsafe-call": OFF,
  "@typescript-eslint/no-unsafe-member-access": OFF,
  "@typescript-eslint/no-unsafe-return": OFF,
  "@typescript-eslint/require-await": OFF,
  "@typescript-eslint/restrict-plus-operands": OFF,
  "@typescript-eslint/restrict-template-expressions": OFF,
  "@typescript-eslint/unbound-method": WARN,
};
