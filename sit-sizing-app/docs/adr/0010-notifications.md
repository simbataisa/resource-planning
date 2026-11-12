# ADR-0010: Notifications (outbox, worker, email and in-app)

|                 |                                                                   |
| --------------- | ----------------------------------------------------------------- |
| **Status**      | Proposed for release 2 (needs security review, rule 13; Q12 open) |
| **Date**        | 2026-11-12                                                        |
| **Deciders**    | Tech lead, product owner, platform team (mail service)            |
| **Design refs** | Sections 5.2, 7, 9.2, 12.1 (`worker`, `mail`), 12.6; backlog N-01 |

## Context

Release 2 tells people when work needs them: a version was submitted, approved or returned, or a profile was published. The design asks for email and in-app notices, written as an outbox in the same transaction as the business change and sent by a background worker with retries.

## Decision

1. **Outbox in the same transaction.** `server/notifications/outbox.ts` adds rows inside the transaction that submits, approves, returns or publishes. A rolled-back change sends nothing, and a committed one is never lost. Each recipient gets an `IN_APP` row, visible at once, and an `EMAIL` row, `PENDING`.
2. **Who is told** (`server/domain/notifications.ts`, pure and unit-tested):
   - Submitted: the project's QE Leads (Admins when there is no other lead).
   - Approved or returned: the version's author and submitter.
   - Project profile published: the project's Estimators and QE Leads.
   - Global profile published: every QE Lead and Admin.
   - Never the person who acted, never inactive users.
3. **What a notice holds.** Names, version number and the review note, copied at the time of the event (`NotificationPayload`). No customer data. Emails link back to the app; nothing else is exposed.
4. **Worker.** `worker/main.ts` runs as the compose `worker` service (tools image, `PROCESS_ROLE=worker`, no OIDC secrets).
   - It claims due emails with `UPDATE … WHERE id IN (SELECT … FOR UPDATE SKIP LOCKED)`, leasing each for 5 minutes, so several workers never send the same email and a crashed worker's emails come back.
   - On failure it retries after 1, 2, 4, 8, 16, then 30 minutes. After `NOTIFY_MAX_ATTEMPTS` (6) the email is `FAILED`, with a short error that has addresses removed.
   - An inactive recipient fails at once.
5. **Email.** nodemailer over SMTP (`SMTP_URL`), with a pooled connection and timeouts. Locally this goes to Mailpit (`smtp://mail:1025`, UI on port 8025). Templates are plain text plus simple HTML in the recipient's language (EN/VI), with names and notes escaped. There is no tracking and there are no remote images. Without `SMTP_URL`, emails stay queued and in-app notices still work.
6. **In-app.** `GET /notifications` (newest 30, unread count), `POST /notifications/{id}/read` and `POST /notifications/read-all`, for the caller's own notices only (another user's notice is a 404). A bell in the header refreshes every minute.

## Consequences

- Q12, which mail service to use outside local, is still open. Until it is answered, set `SMTP_URL` only where a relay is approved.
- Queue depth (`PENDING` and `FAILED` emails) should become a metric in the observability step (design 12.6).
- Old notices are kept. A retention rule (for example 180 days) goes with the audit retention decision.
