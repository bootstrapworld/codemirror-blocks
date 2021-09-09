module.exports = {
  parser: "@typescript-eslint/parser",
  rules: {
    "no-console": 0,
    semi: ["error", "always"],
    // TODO(pcardune): reenable the below config settings
    // "no-unused-vars": [
    //   "error",
    //   {
    //     argsIgnorePattern: "^_",
    //     varsIgnorePattern: "^_",
    //   },
    // ],
    "no-unused-vars": 0,
    "no-undef": 0,
    "react/display-name": 0,
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
    // TODO(pcardune): enable this...
    // "plugin:@typescript-eslint/recommended",
    "prettier",
  ],
  plugins: ["react", "@typescript-eslint"],
  settings: {
    react: {
      version: "17.0.2",
    },
  },
};
