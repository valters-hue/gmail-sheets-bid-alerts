# Gmail → Sheets Bid Alerts

A Google Apps Script for small businesses that live in their inbox. Every 10 minutes it:

1. **Sorts mail** into labels by the alias it was sent to (`billing@`, `contact@`), the sender's address or domain, or a subject pattern, and can keep routine mail out of the inbox.
2. **Spots bid requests** (bid, RFQ, RFP, tender, quote request, invitation to bid, ...).
3. **Logs each one to a Google Sheet** with the customer, project name, due date, keywords and a link back to the email, plus a status column (New → Quoting → Sent → Won/Lost).
4. **Sends an alert** by email and/or a Google Chat or Slack webhook.

| Received | Customer | Project | Due date | Keywords | Status |
|---|---|---|---|---|---|
| 2026-10-25 09:12 | Acme-builders | Lighting retrofit, Building C | 2026-11-03 | rfq | New |
| 2026-10-25 11:40 | Bob Lee | Oak St. School gym | 2026-10-30 | bid, invitation to bid | Quoting |

## What it understands

- **Due dates** in the forms people actually write: `November 3, 2026`, `3rd Nov`, `2026-11-14`, `11/05/2026`, EU `03.11.2026`, `Friday`, `next Friday`, `tomorrow`. A date without a year means its next occurrence; impossible dates (Feb 30) are ignored.
- **Customers**: the sender's company domain (`jane@acme-builders.com` → Acme-builders), or their name when they write from Gmail/Outlook.
- **Projects**: the subject without `RE:`/`FW:` and bid boilerplate (`RFQ - Lighting retrofit` → `Lighting retrofit`).
- **Whole words only**, so "morbidity" never triggers a "bid" alert.

## Setup (10 minutes)

1. Open [script.google.com](https://script.google.com) → **New project**.
2. Create three files and paste in `src/Config.js`, `src/Parse.js` and `src/Code.js` (or use `clasp push`).
3. Edit `Config.js`: your label rules, alert email or chat webhook, and date style.
4. Run `setup()` once and approve the permissions. It creates the "Bid log" sheet, a 10-minute trigger, and processes the last 3 days of mail.

Each thread is processed once (it gets a `bot/processed` label), and a script lock stops overlapping runs.

## Tests

The parsing logic is plain JavaScript with no Google calls, so it is tested in Node:

```bash
npm test
```

## Adapting it

Common extensions: file supplier invoice attachments to Drive and check prices against a price sheet, track permit emails through to completion, or post a daily digest instead of instant alerts.

## License

MIT
