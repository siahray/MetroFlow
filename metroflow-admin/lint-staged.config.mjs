/**
 * Pre-commit checks, scoped to staged files only.
 *
 * The hook itself lives at the repository root (.husky/pre-commit) because git
 * hooks must live next to .git. It cd's into metroflow-admin/ and invokes this config,
 * so all frontend tooling stays with the frontend.
 *
 * Order matters: eslint may rewrite code, prettier gets the final say on
 * formatting.
 */
const config = {
  "*.{js,jsx,mjs,cjs,ts,tsx}": ["eslint --fix", "prettier --write"],
  "*.{css,json,jsonc,md,mdx}": ["prettier --write"],
};

export default config;
