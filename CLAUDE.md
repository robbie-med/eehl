# Working on eehl

- **Finished work goes to `main`.** When a task is done and verified, push it to `main` (fast-forward or merge), not only to a working branch. The live site (eehl.robbiemed.org) deploys from `main` via `.github/workflows/web.yml`; work left on a side branch is not shipped.
- Before pushing: `npm run typecheck`, `npm test`, `npm run build`, `node tests/e2e.mjs`.
- The counting engine (`src/core`) is pinned by `spec/golden.json`. If a change alters it on purpose, regenerate with `UPDATE_GOLDEN=1 npx vitest run golden` and review the diff.
- Every UI string exists in all five languages (`src/i18n/{en,ko,ja,zh-Hans,zh-Hant}.ts`); the type system and `format.test.ts` enforce it.
