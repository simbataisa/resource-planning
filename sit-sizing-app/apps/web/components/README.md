# Component layers (design section 8)

| Folder      | Layer                        | May import                      | Must not import                               |
| ----------- | ---------------------------- | ------------------------------- | --------------------------------------------- |
| `ui/`       | 2 · themed shadcn primitives | tokens, Radix                   | patterns, features, Prisma, Axios, `@/server` |
| `patterns/` | 3 · composed, domain-free    | `ui/`                           | features, Prisma, Axios, `@/server`           |
| `features/` | 4 · domain components        | `ui/`, `patterns/`, query hooks | Prisma, Axios, `@/server`                     |

The rules are enforced by ESLint (`eslint.config.mjs`). Components arrive in step 1.4.
