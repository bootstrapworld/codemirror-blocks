module.exports = {
  parser: "@typescript-eslint/parser",
  rules: {
    "no-console": 0,
    semi: ["error", "always"],
    "@typescript-eslint/no-unused-vars": [
      "error",
      {
        argsIgnorePattern: "^_",
        varsIgnorePattern: "^_",
      },
    ],
    "no-undef": 0,
    "react/display-name": 0,
    "react-hooks/rules-of-hooks": "error",
    "react-hooks/exhaustive-deps": "warn",
    "@typescript-eslint/explicit-module-boundary-types": 0,
  },
  env: {
    es6: true,
    browser: true,
    node: true,
    jasmine: true,
  },
  extends: [
    "eslint:recommended",
    "plugin:react/recommended",
    "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  plugins: ["react", "react-hooks", "@typescript-eslint"],
  settings: {
    react: {
      version: "17.0.2",
    },
  },
};
