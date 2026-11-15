# Vietnamese review (step 1.6)

The app is in English and Vietnamese (design 8.5). Most Vietnamese text is reused from the HTML prototype's dictionary (`sit-sizing-reference/vi-translations.json`), which was machine-translated. The rest was written for the app: autosave, edit lock, versions, language and page texts. **Before release 1, a Vietnamese-speaking QE lead reviews all of it** (design 8.5, step 1.6 exit criterion).

## How the review works

1. Export the review sheet:

   ```bash
   pnpm i18n:review        # writes docs/i18n/vi-review.csv
   ```

   It has one row per message: `key`, `area`, `english`, `vietnamese` (current), `source` (`prototype` = from the prototype dictionary, `app` = written for this app), `reviewed_vi`, `comment`. It opens in Excel (UTF-8).

2. The reviewer fills `reviewed_vi` only where the Vietnamese should change, and adds a `comment` where useful.
   - Keep placeholders such as `{n}` and tags such as `<b>…</b>` exactly as in English.
   - Start with the rows whose `source` is `app`: they were not in the prototype.

3. Apply the reviewed file and run the checks:

   ```bash
   pnpm i18n:apply                         # reads docs/i18n/vi-review.csv
   pnpm i18n:apply path/to/reviewed.csv    # or a sheet saved elsewhere
   pnpm test
   ```

   - Apply refuses a row whose placeholders or tags differ from English, and lists it.
   - The message tests check that both languages have the same keys, placeholders and tags, that every message compiles, and that Vietnamese is not a copy of English outside a short allow-list (names, codes, references).

4. **Parity test.** It compares the app's live texts with the prototype's Vietnamese (`tests/unit/prototype-ui-parity.test.tsx`). If the review changes a live text, the parity test shows the difference. Record the change as an agreed exception in that test (ADR-0006), rather than editing the prototype.

## Sign-off

The reviewer's name and date go into the pull request that applies the review, and the step 1.6 row in the README is marked done.

## Releasing assumption explanations

The MCP server's `describe_assumptions` tool only serves an explanation once the QE practice lead has approved it (design spec 6.4). Until then a row shows its label only.

1. The approver opens `docs/i18n/assumption-help-approved.json`, fills `approvedBy` and `approvedOn` (`YYYY-MM-DD`), and lists the approved rows. Each row is the full message key, for example `assumptionsTab.help.minutes_1` (the draft sheet `assumption-help-draft.md` has the keys).
2. The approved English texts go into `apps/web/messages/en.json` under `assumptionsTab.help`.
3. The Vietnamese texts go into `vi.json` under the same keys, through `pnpm i18n:review` and `pnpm i18n:apply` (above). Every approved row needs both languages, or the next step fails.
4. Run `pnpm --filter @sit/mcp glossary` and commit the files it writes in `apps/mcp/src/generated/`.

A help key that is in the web messages but not in the record is left out of the generated files, so unapproved text never reaches the assistant.
