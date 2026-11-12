# @sit/config

Shared TypeScript presets.

| Preset                  | Use for                                                                                                            |
| ----------------------- | ------------------------------------------------------------------------------------------------------------------ |
| `tsconfig/base.json`    | Strict defaults for every package (`strict`, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`)                   |
| `tsconfig/library.json` | Pure packages (`engine`, `schemas`, `tokens`). No DOM, no Node types: the code must run in both browser and server |
| `tsconfig/nextjs.json`  | `apps/web`                                                                                                         |

ESLint (`eslint.config.mjs`) and Vitest (`vitest.config.ts`) are configured once at the repository root, so there is nothing to share from here.
