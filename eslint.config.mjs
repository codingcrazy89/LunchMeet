import js from "@eslint/js";
import tseslint from "typescript-eslint";

/**
 * Root lint config for the API and shared packages.
 *
 * apps/mobile keeps its own Expo config and is excluded here.
 */
export default tseslint.config(
  {
    ignores: [
      "**/node_modules/**",
      "**/dist/**",
      "**/.expo/**",
      "apps/mobile/**",
      "archive/**",
      "server/**",
      "scripts/**",
      "packages/db/v1-reference/**",
    ],
  },

  js.configs.recommended,
  ...tseslint.configs.recommended,

  {
    files: ["**/*.ts"],
    languageOptions: {
      parserOptions: {
        projectService: false,
      },
    },
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", fixStyle: "inline-type-imports" },
      ],

      /**
       * Configuration must flow through @lunchmeet/config, which validates it
       * and fails fast. v1 read process.env directly in at least seven places
       * with no validation, which is how production silently inherited
       * development configuration.
       */
      "no-restricted-properties": [
        "error",
        {
          object: "process",
          property: "env",
          message:
            "Read configuration through @lunchmeet/config instead of process.env. If a new variable is needed, declare it in packages/config/src/catalog.ts.",
        },
      ],
    },
  },

  {
    // The config package is the one place allowed to touch process.env: it is
    // what turns the raw environment into validated, typed configuration.
    //
    // Test setup is the other: its entire job is to point the process at the
    // test database before any module reads configuration. Without it, tests
    // would truncate the development database.
    files: ["packages/config/src/**/*.ts", "apps/api/src/test/setup.ts"],
    rules: {
      "no-restricted-properties": "off",
    },
  }
);
