# Functional Specification: SME Online Term Deposit

> **Synthetic sample.** This document is fictional test material for the SIT Sizing assistant. "Example Bank", the product, the systems and every figure are invented. It contains no personal or customer data. Account and tax-code values never appear: only field names do.

| Item     | Value                                     |
| -------- | ----------------------------------------- |
| Document | FSD-SOTD-001                              |
| Version  | 1.0 (detailed, for detailed estimation)   |
| Based on | BRD-SOTD-001 v1.0                         |
| Owner    | Solution Analyst, SME Digital (role only) |
| Status   | Baselined for build and SIT               |

## 1. Decisions since the BRD

| BRD question | Decision                                     |
| ------------ | -------------------------------------------- |
| OQ-1         | USD is in phase 1, together with VND.        |
| OQ-2         | The product questions chatbot is in phase 1. |
| OQ-3         | Partial withdrawals are in phase 1.          |

## 2. Solution overview

A new **Deposit service** behind the SME digital banking API gateway serves the SME web portal (one web front end) and the SME mobile app (iOS and Android). It calls the core banking system to book, withdraw and close deposits, and reuses the existing one-time password (OTP), notification and document services. Nightly jobs accrue interest and process maturities. A daily data feed loads the data warehouse for management reporting. A product questions chatbot runs on the existing assistant platform.

Languages: Vietnamese and English. Accessibility: WCAG 2.1 AA for every new screen.

## 3. Screens

| ID     | Screen                      | Description                                                                                                                                                                                                                                 | Channels                |
| ------ | --------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------- |
| SCR-01 | Product list and rates      | Read-only list of term deposit products with the current rate table by tenor and currency.                                                                                                                                                  | Web, iOS, Android       |
| SCR-02 | Open deposit (wizard)       | Three steps: choose source account and currency; enter amount, tenor and promo code with a live rate and interest preview; choose interest payment method and maturity instruction. Sections change with currency and maturity instruction. | Web, iOS, Android       |
| SCR-03 | Review and confirm          | Summary of the request, terms check box and OTP entry. Confirm or go back.                                                                                                                                                                  | Web, iOS, Android       |
| SCR-04 | Pending approvals           | Checker's list of requests waiting for them, with filters, and approve or reject with a comment.                                                                                                                                            | Web, iOS, Android       |
| SCR-05 | Deposit detail              | Read-only view of one deposit: principal, rate, dates, accrued interest, maturity instruction.                                                                                                                                              | Web, iOS, Android       |
| SCR-06 | Withdraw deposit            | Choose full or partial withdrawal. Partial shows the amount field and the remaining-balance check. A penalty preview recalculates as the amount changes.                                                                                    | Web, iOS, Android       |
| SCR-07 | Change maturity instruction | Choose one of three instructions. The payout account field appears only for "pay out".                                                                                                                                                      | Web, iOS, Android       |
| SCR-08 | Deposit certificate         | Shows the certificate and a download button.                                                                                                                                                                                                | Web, iOS, Android       |
| SCR-09 | Company limits and users    | Company Administrator sets the per-transaction limit, daily limit and approval threshold, and gives users the Maker or Checker role.                                                                                                        | Web only                |
| SCR-10 | Operations exceptions queue | Bank Operations' list of requests that failed in core banking, with assign, resolve and escalate actions.                                                                                                                                   | Web (bank staff portal) |

## 4. APIs

All APIs are REST over HTTPS behind the API gateway, versioned under `/sme/v1`.

| ID     | Method and path                           | Purpose                                                                                                                                                           |
| ------ | ----------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| API-01 | `GET /products`                           | List term deposit products. Read from the local product table.                                                                                                    |
| API-02 | `GET /rates?tenor&currency`               | Rate table for a tenor and currency. Read from the local rate cache.                                                                                              |
| API-03 | `GET /source-accounts`                    | Company current accounts that can fund a deposit, with available balance. Calls core banking.                                                                     |
| API-04 | `POST /deposits/quote`                    | Rate, value date, maturity date and expected interest for a proposed deposit (BR rules 01–06, 13).                                                                |
| API-05 | `POST /deposits`                          | Create a deposit request. Checks limits, routes to approval or books in core banking, debits the source account. Idempotent; reverses the debit if booking fails. |
| API-06 | `POST /deposit-requests/{id}/decision`    | Approve or reject a request. Changes the request state; the final approval hands the request to booking.                                                          |
| API-07 | `GET /deposits/{id}`                      | One deposit. Read from the local store.                                                                                                                           |
| API-08 | `GET /deposits`                           | List deposits with filters and paging. Read from the local store.                                                                                                 |
| API-09 | `POST /deposits/{id}/withdrawals/quote`   | Penalty and net payout for a proposed withdrawal. Reads accrued interest from core banking.                                                                       |
| API-10 | `POST /deposits/{id}/withdrawals`         | Withdraw in full or in part. Pays out through core banking; idempotent, with reversal on failure.                                                                 |
| API-11 | `PUT /deposits/{id}/maturity-instruction` | Change the maturity instruction. Updates core banking.                                                                                                            |
| API-12 | `GET /deposits/{id}/certificate`          | Deposit certificate as PDF. Calls the document service.                                                                                                           |

### 4.1 Payload summary (unique fields)

Shared DTOs are counted once.

**Request fields (24 unique).**

| DTO                        | Used by        | New fields                                                                                  |
| -------------------------- | -------------- | ------------------------------------------------------------------------------------------- |
| QuoteRequest               | API-02, 04, 05 | sourceAccountId, currency, amount, tenorMonths, promoCode, valueDate                        |
| CreateDepositRequest       | API-05         | interestPaymentMethod, maturityInstruction, payoutAccountId, makerNote, otp, idempotencyKey |
| DecisionRequest            | API-06         | decision, comment                                                                           |
| WithdrawalQuoteRequest     | API-09, 10     | withdrawalType, withdrawalAmount, requestedDate                                             |
| MaturityInstructionRequest | API-11         | autoRenew                                                                                   |
| DepositListQuery           | API-08         | status, fromDate, toDate, page, pageSize                                                    |
| CertificateQuery           | API-12         | language                                                                                    |

**Response and event payload fields (38 unique).**

| DTO             | New fields                                                                                                      |
| --------------- | --------------------------------------------------------------------------------------------------------------- |
| Product         | productCode, productName, currencies, tenors, minAmount                                                         |
| Rate            | rate, amountBandFrom, amountBandTo, promoRate, effectiveFrom                                                    |
| SourceAccount   | accountId, accountNumberMasked, availableBalance, accountStatus                                                 |
| Quote           | interestRate, estimatedInterest, maturityDate, valueDate, approvalRequired, approvalLevels                      |
| Deposit         | depositId, tdNumber, status, principal, accruedInterest, openedAt, partialWithdrawalsUsed, certificateAvailable |
| DepositRequest  | requestId, requestStatus, submittedAt, expiresAt                                                                |
| WithdrawalQuote | penaltyRate, penaltyAmount, netPayout                                                                           |
| Event envelope  | eventId, eventType, occurredAt                                                                                  |

## 5. Integrations

| ID     | System              | Pattern                                                                                                                                                                                                     |
| ------ | ------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| INT-01 | Core banking system | Two-way. Book, withdraw, close and pay out deposits; read balances and accrued interest. Asynchronous confirmation, retries and daily reconciliation. Available for testing only in scheduled test windows. |
| INT-02 | OTP service         | Request and response: send and verify an OTP, with mapped error codes (expired, wrong code, locked).                                                                                                        |
| INT-03 | Notification hub    | One-way: send email, SMS and push messages. Has a sandbox.                                                                                                                                                  |
| INT-04 | Document service    | Request and response: generate the certificate PDF from a template and archive it, with mapped error codes.                                                                                                 |

## 6. Business rules

"Critical" marks regulatory or money-moving rules.

| ID    | Rule                                                                                                                                                                                                | Critical |
| ----- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| BR-01 | Minimum amount: VND 10,000,000 or USD 1,000.                                                                                                                                                        | No       |
| BR-02 | Per-transaction limit depends on the company tier (Standard or Priority) and the company's own setting, which cannot exceed the tier's limit.                                                       | Yes      |
| BR-03 | Daily cumulative limit depends on the company tier and the company's own setting, which cannot exceed the tier's limit.                                                                             | Yes      |
| BR-04 | Allowed tenors: VND 1, 3, 6, 9 and 12 months; USD 1, 3 and 6 months.                                                                                                                                | No       |
| BR-05 | Rate is looked up by currency, tenor, amount band and company tier. A valid promo code adds a margin, capped by the tier's maximum rate, and only for new deposits.                                 | Yes      |
| BR-06 | Cut-off 16:30. After the cut-off, or on a weekend or bank holiday, the value date is the next working day. Maturity falling on a non-working day moves to the next working day.                     | Yes      |
| BR-07 | A Maker cannot approve their own request.                                                                                                                                                           | No       |
| BR-08 | Above the company's approval threshold one Checker approves; above twice the threshold two different Checkers approve.                                                                              | No       |
| BR-09 | Early withdrawal: the withdrawn amount earns the non-term rate for the days held instead of the deposit rate; the difference is the penalty. Withdrawals within 7 days of opening earn no interest. | Yes      |
| BR-10 | Partial withdrawal: at most two per deposit, at least the minimum amount (BR-01) each time, and the remaining balance must stay at or above the minimum amount.                                     | Yes      |
| BR-11 | Maturity instruction is one of: roll over principal, roll over principal and interest, or pay out to a chosen account of the same currency.                                                         | No       |
| BR-12 | The source account must be active, in the deposit's currency, and have enough available balance.                                                                                                    | No       |
| BR-13 | Interest = principal × rate × days / 365 (actual/365), rounded down to the currency's minor unit.                                                                                                   | Yes      |
| BR-14 | A request not decided within 3 calendar days expires.                                                                                                                                               | No       |

**Variants that change rule outcomes:** currency (VND, USD) and company tier (Standard, Priority).

## 7. Roles and permissions

Roles: **Company Maker**, **Company Checker**, **Company Administrator**, **Bank Operations**.

Protected actions outside the workflows below:

| Action                      | Maker | Checker | Administrator | Operations |
| --------------------------- | ----- | ------- | ------------- | ---------- |
| View deposits               | Yes   | Yes     | Yes           | Yes        |
| Download certificate        | Yes   | Yes     | Yes           | No         |
| Export deposit list (CSV)   | No    | Yes     | Yes           | Yes        |
| Change maturity instruction | Yes   | No      | No            | No         |
| Manage company limits       | No    | No      | Yes           | No         |
| Manage company users        | No    | No      | Yes           | No         |

## 8. Workflows

**WF-01 Deposit and withdrawal request approval (maker-checker).**
Draft → Submitted; Submitted → Approved (one level) → Booking; Submitted → Approved level 1 → Approved level 2 → Booking; Submitted → Rejected; Rejected → Draft (Maker reworks); Submitted → Expired (after 3 days, BR-14); Booking → Booked; Booking → Failed (raises an operations exception). Below the threshold the request goes straight from Submitted to Booking.

**WF-02 Operations exception handling.**
Open → In progress; In progress → Resolved; In progress → Escalated; Escalated → Resolved; In progress → Open (reassigned).

## 9. End-to-end journeys

| ID   | Journey                                       | Systems involved                                      |
| ---- | --------------------------------------------- | ----------------------------------------------------- |
| J-01 | Open a deposit below the approval threshold   | App, Deposit service, OTP, core banking, notification |
| J-02 | Open a deposit with two-level approval        | App, Deposit service, OTP, core banking, notification |
| J-03 | Early full withdrawal                         | App, Deposit service, OTP, core banking, notification |
| J-04 | Partial withdrawal                            | App, Deposit service, OTP, core banking, notification |
| J-05 | Maturity with principal and interest rollover | Batch, core banking, notification                     |
| J-06 | View a deposit and download its certificate   | App, Deposit service, document service                |
| J-07 | Change the maturity instruction               | App, Deposit service, core banking                    |

## 10. Batch jobs

| ID   | Job                             | Schedule     | Notes                                                                                                                                                                      |
| ---- | ------------------------------- | ------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| B-01 | Interest accrual and GL posting | Daily, 23:00 | Accrues interest for every active deposit and posts to the general ledger through core banking. Restartable; reconciled with core banking totals. Must finish before B-02. |
| B-02 | Maturity processing             | Daily, 01:00 | Runs after B-01. Applies each maturing deposit's instruction; rejected items go to the operations exceptions queue.                                                        |
| B-03 | Request expiry                  | Hourly       | Expires undecided requests (BR-14). No dependencies.                                                                                                                       |

## 11. Events

| ID    | Topic                | Consumer behaviour                                                    |
| ----- | -------------------- | --------------------------------------------------------------------- |
| EV-01 | `deposit.opened`     | Notification hub sends a message. Fire-and-forget.                    |
| EV-02 | `deposit.withdrawn`  | Notification hub sends a message. Fire-and-forget.                    |
| EV-03 | `deposit.matured`    | Notification hub sends a message. Fire-and-forget.                    |
| EV-04 | `approval.requested` | Creates a task in each Checker's inbox; must ignore duplicate events. |

## 12. Field dictionary

Input and display fields on the screens above (42 in total).

| #   | Field                             | Type       | Screens        |
| --- | --------------------------------- | ---------- | -------------- |
| 1   | Company name                      | text       | SCR-02, 05     |
| 2   | Company tax code                  | taxCode    | SCR-09         |
| 3   | Source account                    | account    | SCR-02         |
| 4   | Available balance                 | currency   | SCR-02         |
| 5   | Currency                          | enum       | SCR-01, 02     |
| 6   | Deposit amount                    | currency   | SCR-02, 03     |
| 7   | Tenor                             | enum       | SCR-01, 02     |
| 8   | Interest rate                     | percentage | SCR-01, 02, 05 |
| 9   | Interest payment method           | radio      | SCR-02         |
| 10  | Maturity instruction              | radio      | SCR-02, 07     |
| 11  | Value date                        | date       | SCR-03, 05     |
| 12  | Maturity date                     | date       | SCR-03, 05     |
| 13  | Estimated interest                | currency   | SCR-02, 03     |
| 14  | Promo code                        | text       | SCR-02         |
| 15  | Agree to terms                    | checkbox   | SCR-03         |
| 16  | One-time password                 | password   | SCR-03, 04, 06 |
| 17  | Request reference                 | text       | SCR-04, 10     |
| 18  | Request status                    | enum       | SCR-04, 10     |
| 19  | Submitted at                      | datetime   | SCR-04         |
| 20  | Maker note                        | text       | SCR-02, 04     |
| 21  | Checker comment                   | text       | SCR-04         |
| 22  | Decision (approve or reject)      | radio      | SCR-04         |
| 23  | Deposit number                    | account    | SCR-05, 06, 08 |
| 24  | Principal                         | currency   | SCR-05, 06     |
| 25  | Accrued interest                  | currency   | SCR-05, 06     |
| 26  | Withdrawal type (full or partial) | radio      | SCR-06         |
| 27  | Withdrawal amount                 | currency   | SCR-06         |
| 28  | Penalty rate                      | percentage | SCR-06         |
| 29  | Penalty amount                    | currency   | SCR-06         |
| 30  | Net payout                        | currency   | SCR-06         |
| 31  | Payout account                    | account    | SCR-06, 07     |
| 32  | Partial withdrawals used          | integer    | SCR-05, 06     |
| 33  | Certificate file                  | file       | SCR-08         |
| 34  | Notification email                | email      | SCR-09         |
| 35  | Notification phone                | phone      | SCR-09         |
| 36  | Auto-renew enabled                | boolean    | SCR-07         |
| 37  | Per-transaction limit             | currency   | SCR-09         |
| 38  | Daily limit                       | currency   | SCR-09         |
| 39  | Approval threshold                | currency   | SCR-09         |
| 40  | User role                         | enum       | SCR-09         |
| 41  | Exception reason                  | text       | SCR-10         |
| 42  | Exception resolved                | boolean    | SCR-10         |

## 13. Data requirements (management reporting)

| Item         | Detail                                                                                                                                                                                                                                                 |
| ------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Feeds        | FD-1 daily deposit snapshot file from core banking (full file, with rejects to handle). FD-2 daily accrual file from the Deposit service (one file, no dependencies).                                                                                  |
| Pipelines    | PL-1 load both files to staging (no dependencies). PL-2 build the fact table and the company dimension; depends on PL-1.                                                                                                                               |
| Tables       | `stg_deposit` (18 columns), `stg_accrual` (10), `dim_company` (14, SCD type 2 on tier), `fact_deposit_daily` (22). 64 mapped columns in total.                                                                                                         |
| Data quality | 12 rules: not-null keys (4), currency in (VND, USD), amount above zero, tenor in the allowed list, value date before maturity date, accrual reconciles to GL total, one row per deposit per day, tier in (Standard, Priority), no orphan company keys. |
| Secured data | `dim_company`: the tax code column is masked for everyone except the data steward.                                                                                                                                                                     |
| Access roles | SME Product analyst (read reports), Data steward (read unmasked).                                                                                                                                                                                      |
| Reports      | RP-1 daily movements list (opened, withdrawn, matured). RP-2 dashboard by tier and currency with drill-down and trend.                                                                                                                                 |

## 14. Product questions chatbot

Runs on the existing assistant platform, in Vietnamese and English. It never receives account or customer data.

| Item              | Detail                                                                                                                                                                                                               |
| ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Intents           | Product overview, tenor options, how to open, cut-off times, maturity options (simple FAQ answers); rate enquiry (calls a tool), early withdrawal explanation (worked example), hand over to a relationship manager. |
| Knowledge sources | Product sheet; frequently asked questions.                                                                                                                                                                           |
| Tools             | Rate lookup (API-02).                                                                                                                                                                                                |
| Guardrails        | No financial advice; never asks for or reveals account data; prompt-injection defence; stays on topic.                                                                                                               |
| Human in the loop | Hand-over to a relationship manager when the assistant cannot answer.                                                                                                                                                |
| OCR               | None.                                                                                                                                                                                                                |

## 15. Performance requirements

| ID   | Scenario                                                                  | Target                                      |
| ---- | ------------------------------------------------------------------------- | ------------------------------------------- |
| PT-1 | `GET /rates` (API-02) under load                                          | p95 under 300 ms at 200 requests per second |
| PT-2 | `GET /deposits` (API-08) under load                                       | p95 under 500 ms at 100 requests per second |
| PT-3 | B-01 interest accrual with 120,000 active deposits (production-size data) | Finishes in under 60 minutes                |
| PT-4 | J-01 open-deposit journey with sign-in, OTP and core booking              | p95 under 3 s at 5 times normal load        |
| PT-5 | Chatbot rate enquiry under load                                           | p95 under 4 s at 50 concurrent sessions     |

Test types in scope: load, stress and spike (promotion launch). Soak and failover tests are out of scope for this release.

## 16. Delivery and quality context

- **SIT window:** 6 weeks.
- **Environment:** shared SIT environment. Core banking is available only in scheduled test windows.
- **Test automation target:** 40% of SIT regression.
- **Shift-left evidence so far:** Deposit service unit test line coverage (JaCoCo) is 72%. Consumer-driven contract tests cover 60% of the APIs. Other evidence is not yet available.
- **End-to-end (L4) journeys** are included in SIT.
