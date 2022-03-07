module.exports = {
  extends: ["@remix-run/eslint-config"],
  globals: {
    Deno: "readonly",
  },
  rules: {
    "react/jsx-uses-react": "warn",
    "react/react-in-jsx-scope": "error",
  },
};
