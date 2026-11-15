# Business Requirements Document: SME Online Term Deposit

> **Synthetic sample.** This document is fictional test material for the SIT Sizing assistant. "Example Bank", the product and every figure are invented. It contains no personal or customer data.

| Item          | Value                                  |
| ------------- | -------------------------------------- |
| Document      | BRD-SOTD-001                           |
| Version       | 1.0 (high level, for rough estimation) |
| Business unit | SME Banking, Example Bank              |
| Owner         | Product Owner, SME Digital (role only) |
| Status        | Approved for solution design           |
| Related       | FSD-SOTD-001 (detailed, to follow)     |

## 1. Purpose

Small and medium-sized companies can open a term deposit today only at a branch or through their relationship manager. Doing this on paper takes about two working days and needs a signed form for every deposit. The bank wants SME customers to open, manage and withdraw term deposits themselves, online, through the existing SME digital banking channels.

## 2. Business objectives

| ID   | Objective                                            | Measure                                                                  |
| ---- | ---------------------------------------------------- | ------------------------------------------------------------------------ |
| OB-1 | Move SME term deposit opening from branch to digital | 60% of new SME term deposits opened online within 12 months              |
| OB-2 | Cut the time to open a deposit                       | From about 2 working days to under 10 minutes                            |
| OB-3 | Keep company controls over money movement            | Every deposit above the company's threshold is approved by a second user |
| OB-4 | Reduce branch and operations workload                | 30% fewer manual deposit requests to operations                          |

## 3. Scope

### 3.1 In scope

- Opening a term deposit online from a company current account.
- Maker-checker approval inside the customer company, using the company's own limits.
- Early full withdrawal and partial withdrawal before maturity.
- Choosing and changing the maturity instruction, and processing deposits at maturity.
- A deposit certificate the company can download, and notifications at key steps.
- Company administration of limits and user roles for this product.
- Daily interest accrual and posting to the general ledger.
- Management reporting for the SME product team.
- **Optional for phase 1:** a product questions assistant (chatbot) that answers questions about term deposit products and rates. Phase 1 or phase 2 is still to be decided (see section 9).

### 3.2 Out of scope

- Individual (retail) customers.
- Deposits pledged as collateral for loans.
- Changes to branch systems or the relationship manager tools.
- New interest rate products. Existing SME term deposit products and rate tables are reused.

## 4. Stakeholders and users

| Role                  | Who they are                                                            |
| --------------------- | ----------------------------------------------------------------------- |
| Company Maker         | Company employee who creates deposit and withdrawal requests            |
| Company Checker       | Company employee who approves or rejects requests above the threshold   |
| Company Administrator | Sets the company's limits and gives users their roles                   |
| Bank Operations       | Bank staff who handle exceptions that cannot be processed automatically |
| SME Product team      | Owns the product and uses the management reports                        |

## 5. Channels, languages and accessibility

- **Channels:** the existing SME web portal (one web front end), and the SME mobile app on iOS and Android.
- **Languages:** Vietnamese and English.
- **Accessibility:** new screens must meet WCAG 2.1 level AA.

## 6. Business requirements

| ID    | Requirement                                                                                                                                                                                              | Priority |
| ----- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------- |
| BR-01 | A Maker can open a term deposit by choosing a source account, currency, amount and tenor, and sees the rate and expected interest before confirming.                                                     | Must     |
| BR-02 | Deposits can be in VND or USD. Rates depend on tenor, amount band and currency, and a promotion code can raise the rate.                                                                                 | Must     |
| BR-03 | Rates and limits differ for Standard and Priority company tiers.                                                                                                                                         | Must     |
| BR-04 | Requests submitted after the daily cut-off, or on a non-working day, take effect on the next working day.                                                                                                | Must     |
| BR-05 | A request above the company's approval threshold needs a Checker's approval. Above a second, higher threshold it needs two Checkers. A Maker can never approve their own request.                        | Must     |
| BR-06 | Each company has a per-transaction limit and a daily limit, set by the Company Administrator within the bank's limits for its tier.                                                                      | Must     |
| BR-07 | A company can withdraw a deposit in full before maturity. A penalty rate applies to the amount withdrawn early.                                                                                          | Must     |
| BR-08 | A company can make up to two partial withdrawals per deposit, as long as a minimum balance remains.                                                                                                      | Should   |
| BR-09 | At opening the company chooses what happens at maturity: roll over the principal, roll over principal and interest, or pay out to an account. It can change this until two working days before maturity. | Must     |
| BR-10 | The system processes matured deposits automatically every night, following each deposit's maturity instruction.                                                                                          | Must     |
| BR-11 | The company can download a deposit certificate (PDF) for every open deposit.                                                                                                                             | Must     |
| BR-12 | The company's users receive notifications by email, SMS or push when a deposit is opened, withdrawn, matured, or waiting for their approval.                                                             | Must     |
| BR-13 | Interest is accrued daily and posted to the general ledger.                                                                                                                                              | Must     |
| BR-14 | Requests not approved within three days expire automatically.                                                                                                                                            | Should   |
| BR-15 | Bank Operations can see and resolve requests that failed in the core banking system.                                                                                                                     | Must     |
| BR-16 | The SME Product team gets daily reports on deposits opened, withdrawn and matured, by tier and currency.                                                                                                 | Should   |
| BR-17 | (Optional, phase to be decided) A chatbot answers product and rate questions in both languages and hands over to a relationship manager when it cannot answer. It never sees account data.               | Could    |

## 7. Non-functional requirements

- **Volumes:** about 120,000 active SME deposits after year one. About 4,000 new deposits per working day at peak.
- **Peak load:** month-end and promotion launches. The bank expects about five times the normal load on the open-deposit journey during a promotion launch.
- **Batch window:** nightly interest accrual and maturity processing must finish before 05:00.
- **Availability:** in line with the SME digital banking channels.
- **Security:** customers sign in and confirm money movement with the existing one-time password service.
- **Audit:** every request, approval and change of maturity instruction is audited.

## 8. Assumptions and dependencies

- The core banking system books, closes and pays out deposits. It is available for testing only in scheduled test windows.
- The existing one-time password, notification and document services are reused.
- Rate tables are maintained by Treasury in the existing rate system.

## 9. Open questions

| ID   | Question                                                        | Owner         |
| ---- | --------------------------------------------------------------- | ------------- |
| OQ-1 | Is USD in phase 1, or VND only first?                           | Product Owner |
| OQ-2 | Is the product questions chatbot (BR-17) in phase 1?            | Product Owner |
| OQ-3 | Do partial withdrawals (BR-08) need to be in the first release? | Product Owner |
