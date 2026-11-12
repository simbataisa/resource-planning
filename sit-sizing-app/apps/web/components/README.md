# Component layers (design section 8)

| Folder      | Layer                        | May import                      | Must not import                               |
| ----------- | ---------------------------- | ------------------------------- | --------------------------------------------- |
| `ui/`       | 2 · themed shadcn primitives | tokens, Radix                   | patterns, features, Prisma, Axios, `@/server` |
| `patterns/` | 3 · composed, domain-free    | `ui/`                           | features, Prisma, Axios, `@/server`           |
| `features/` | 4 · domain components        | `ui/`, `patterns/`, query hooks | Prisma, Axios, `@/server`                     |

The rules are enforced by ESLint (`eslint.config.mjs`). Layers 2 and 3 arrived in step 1.4; layer 4 (`features/app-shell`, `projects`, `estimates`, `estimate-editor`, `results`) in step 1.5 (ADR-0006).
