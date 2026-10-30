import js from "@eslint/js";
import tseslint from "typescript-eslint";
import eslintReact from "@eslint-react/eslint-plugin";
import reactHooks from "eslint-plugin-react-hooks";
import prettier from "eslint-config-prettier";
import globals from "globals";

export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/lib/**",
      "**/dist/**",
      "**/build/**",
      ".coverage/**",
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  eslintReact.configs["recommended-typescript"],
  // the hooks rules come from eslint-plugin-react-hooks below
  eslintReact.configs["disable-conflict-eslint-plugin-react-hooks"],
  prettier,
  {
    plugins: { "react-hooks": reactHooks },
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    rules: {
      "no-console": ["warn", { allow: ["warn", "error"] }],
      semi: ["error", "always"],
      "@typescript-eslint/no-unused-vars": [
        "error",
        {
          argsIgnorePattern: "^_",
          varsIgnorePattern: "^_",
          caughtErrors: "none",
        },
      ],
      "@typescript-eslint/no-unused-expressions": [
        "error",
        { allowShortCircuit: true, allowTernary: true },
      ],
      // webpack configs are CommonJS, and `require("./style.less")` is how
      // stylesheets get pulled in (TypeScript doesn't know about .less files)
      "@typescript-eslint/no-require-imports": 0,
      "no-undef": 0,
      // the hooks rules come from react-hooks, which the code already has
      // deliberate disables for: eslint-react would report them twice
      "@eslint-react/exhaustive-deps": 0,
      "react-hooks/rules-of-hooks": "error",
      "react-hooks/exhaustive-deps": "warn",
    },
  },
  {
    files: ["**/spec/**"],
    languageOptions: { globals: { ...globals.jest } },
    rules: {
      "@typescript-eslint/no-non-null-assertion": 0,
      "@typescript-eslint/no-empty-function": 0,
      "@typescript-eslint/no-explicit-any": 0,
    },
  }
);
