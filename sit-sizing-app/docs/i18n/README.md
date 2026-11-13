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
