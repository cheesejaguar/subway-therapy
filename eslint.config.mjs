import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Generated files
    "convex/_generated/**",
    // Coverage reports
    "coverage/**",
  ]),
  // Custom rules
  {
    rules: {
      // Allow img elements for base64/blob images that next/image doesn't handle well
      "@next/next/no-img-element": "warn",
    },
  },
]);

export default eslintConfig;
