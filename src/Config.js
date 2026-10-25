/**
 * Edit this file to fit your inbox. Everything else reads from CONFIG.
 */
var CONFIG = {
  // Google Sheet that receives the bid log. Leave '' to create one on first run.
  SHEET_ID: '',
  SHEET_NAME: 'Bids',

  // Only look at recent mail; the "processed" label stops double counting.
  SEARCH_QUERY: 'in:inbox newer_than:3d',
  PROCESSED_LABEL: 'bot/processed',

  // Where alerts go. Leave '' to skip that channel.
  ALERT_EMAIL: '',            // e.g. 'you@yourcompany.com'
  CHAT_WEBHOOK_URL: '',       // Google Chat or Slack incoming webhook

  // Read 03/11/2026 as 3 November (true) or March 11 (false)
  DAY_FIRST_DATES: false,

  BID_LABEL: 'Leads/Bids',
  BID_KEYWORDS: null,         // null = built-in list (bid, RFQ, tender, quote request, ...)

  // First matching rule wins. Use `to` for aliases, `from` for a sender
  // address or domain, `subject` for a regex on the subject line.
  // `skipInbox: true` archives the thread after labelling.
  LABEL_RULES: [
    { to: 'billing@', label: 'Billing', skipInbox: true },
    { from: 'esasafe.com', label: 'Permits/ESA' },
    { subject: '\\b(permit|certificate of acceptance)\\b', label: 'Permits/ESA' },
    { from: 'insurer.example', label: 'Insurance', skipInbox: true },
    { from: 'supplier.example', label: 'Suppliers', skipInbox: true },
    { to: 'contact@', label: 'Leads' },
  ],
};
