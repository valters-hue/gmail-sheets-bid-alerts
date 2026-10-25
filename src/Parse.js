/**
 * Pure helpers: no Gmail or Sheets calls, so they run in Apps Script (V8)
 * and in Node for tests.
 */

var BID_KEYWORDS = [
  'bid', 'bids', 'rfq', 'rfp', 'rfi', 'tender', 'quote request', 'request for quote',
  'request for quotation', 'request for proposal', 'quotation', 'pricing request', 'invitation to bid',
];

var MONTHS = {
  jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4,
  jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8,
  oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11,
};
var WEEKDAYS = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 };

function escapeRegex_(s) {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** Returns the bid keywords found in the text (whole words, case-insensitive). */
function findBidKeywords(text, keywords) {
  var list = keywords || BID_KEYWORDS;
  var hay = String(text || '').toLowerCase();
  return list.filter(function (k) {
    return new RegExp('(^|[^a-z])' + escapeRegex_(k.toLowerCase()) + '([^a-z]|$)').test(hay);
  });
}

function isBidEmail(subject, body, keywords) {
  return findBidKeywords(subject + '\n' + String(body || '').slice(0, 3000), keywords).length > 0;
}

function pad2_(n) { return (n < 10 ? '0' : '') + n; }
function iso_(y, m, d) { return y + '-' + pad2_(m + 1) + '-' + pad2_(d); }

function validDate_(y, m, d) {
  var dt = new Date(Date.UTC(y, m, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m && dt.getUTCDate() === d;
}

/**
 * Finds a due date near words like "due", "deadline", "closing", "by",
 * "no later than". Returns an ISO date string (YYYY-MM-DD) or ''.
 * `now` is a Date used to fill in a missing year and resolve weekdays.
 * `dayFirst` reads 03/11/2026 as 3 November (EU) instead of March 11 (US).
 */
function extractDueDate(text, now, dayFirst) {
  var src = String(text || '');
  var today = now || new Date();
  // Look a short way past each cue word; a dot only continues the window
  // when a digit follows it (03.11.2026), not at the end of a sentence.
  var cue = /(due|deadline|closing|closes|close of|submit(?:ted)? by|no later than|by)\b(?:[^.\n]|\.(?=\d)){0,40}/gi;
  var m;
  while ((m = cue.exec(src)) !== null) {
    var found = parseDate_(m[0], today, dayFirst);
    if (found) return found;
  }
  return '';
}

function parseDate_(s, today, dayFirst) {
  var y0 = today.getFullYear();
  var r;
  // 2026-11-03
  if ((r = /(\d{4})-(\d{1,2})-(\d{1,2})/.exec(s))) {
    var y = +r[1], mo = +r[2] - 1, d = +r[3];
    return validDate_(y, mo, d) ? iso_(y, mo, d) : '';
  }
  // 3 November 2026 / 3rd Nov
  if ((r = /(\d{1,2})(?:st|nd|rd|th)?\s+(?:of\s+)?([a-z]{3,9})\.?,?\s*(\d{4})?/i.exec(s)) && MONTHS[r[2].toLowerCase()] !== undefined) {
    return withYear_(r[3] ? +r[3] : null, MONTHS[r[2].toLowerCase()], +r[1], today);
  }
  // November 3, 2026 / Nov 3rd
  if ((r = /([a-z]{3,9})\.?\s+(\d{1,2})(?:st|nd|rd|th)?,?\s*(\d{4})?/i.exec(s)) && MONTHS[r[1].toLowerCase()] !== undefined) {
    return withYear_(r[3] ? +r[3] : null, MONTHS[r[1].toLowerCase()], +r[2], today);
  }
  // 11/03/2026, 11/03/26, 11/03, 3.11.2026
  if ((r = /(\d{1,2})[\/.](\d{1,2})(?:[\/.](\d{2,4}))?/.exec(s))) {
    var a = +r[1], b = +r[2];
    var month = dayFirst ? b - 1 : a - 1, day = dayFirst ? a : b;
    var yy = r[3] ? (+r[3] < 100 ? 2000 + +r[3] : +r[3]) : null;
    return withYear_(yy, month, day, today);
  }
  // Friday / next Friday
  if ((r = /(next\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i.exec(s))) {
    var target = WEEKDAYS[r[2].toLowerCase()];
    var diff = (target - today.getDay() + 7) % 7 || 7;
    if (r[1]) diff += diff < 7 ? 7 : 0;
    var t = new Date(today.getFullYear(), today.getMonth(), today.getDate() + diff);
    return iso_(t.getFullYear(), t.getMonth(), t.getDate());
  }
  // today / tomorrow
  if ((r = /\b(today|tomorrow)\b/i.exec(s))) {
    var add = r[1].toLowerCase() === 'tomorrow' ? 1 : 0;
    var t2 = new Date(today.getFullYear(), today.getMonth(), today.getDate() + add);
    return iso_(t2.getFullYear(), t2.getMonth(), t2.getDate());
  }
  return '';
}

function withYear_(year, month, day, today) {
  var y = year;
  if (y === null) {
    // No year given: assume the next occurrence of that date
    y = today.getFullYear();
    var candidate = new Date(y, month, day);
    var startOfToday = new Date(today.getFullYear(), today.getMonth(), today.getDate());
    if (candidate < startOfToday) y += 1;
  }
  return validDate_(y, month, day) ? iso_(y, month, day) : '';
}

/** "Jane Smith <jane@acme.com>" → {name: "Jane Smith", email: "jane@acme.com", domain: "acme.com"} */
function parseSender(from) {
  var s = String(from || '').trim();
  var m = /^\s*"?([^"<]*?)"?\s*<([^>]+)>\s*$/.exec(s);
  var email = (m ? m[2] : s).trim().toLowerCase();
  var name = m ? m[1].trim() : '';
  var domain = email.indexOf('@') > -1 ? email.split('@')[1] : '';
  return { name: name || email, email: email, domain: domain };
}

/** Best guess at the customer: sender's company domain, else their name. */
function guessCustomer(from) {
  var p = parseSender(from);
  var freeMail = /^(gmail|googlemail|outlook|hotmail|live|yahoo|icloud|me|aol|proton|protonmail)\./;
  if (p.domain && !freeMail.test(p.domain)) {
    var base = p.domain.split('.').slice(-2, -1)[0] || p.domain;
    return base.charAt(0).toUpperCase() + base.slice(1);
  }
  return p.name;
}

/** Project name: subject without RE:/FW: prefixes and bid boilerplate. */
function guessProject(subject) {
  var s = String(subject || '')
    .replace(/^\s*((re|fw|fwd|aw|wg)\s*:\s*)+/i, '')
    .replace(/\b(request for (quote|quotation|proposal)|invitation to bid|rfq|rfp|rfi|tender|bid|quote request)\b\s*[:\-–#]*\s*/gi, '')
    .replace(/\s{2,}/g, ' ')
    .trim();
  return s.replace(/^[\-–:#\s]+|[\-–:#\s]+$/g, '') || String(subject || '').trim();
}

/**
 * Picks a Gmail label for a message. Rules are checked in order; the first
 * match wins. A rule matches on the alias it was sent to (`to`), the sender
 * address or domain (`from`), or a subject regex (`subject`).
 */
function pickLabel(meta, rules) {
  var to = String(meta.to || '').toLowerCase();
  var from = parseSender(meta.from);
  for (var i = 0; i < rules.length; i++) {
    var r = rules[i];
    if (r.to && to.indexOf(r.to.toLowerCase()) > -1) return r.label;
    if (r.from) {
      var f = r.from.toLowerCase();
      if (from.email === f || from.domain === f || from.domain.endsWith('.' + f)) return r.label;
    }
    if (r.subject && new RegExp(r.subject, 'i').test(meta.subject || '')) return r.label;
  }
  return '';
}

if (typeof module !== 'undefined') {
  module.exports = {
    BID_KEYWORDS: BID_KEYWORDS, findBidKeywords: findBidKeywords, isBidEmail: isBidEmail,
    extractDueDate: extractDueDate, parseSender: parseSender, guessCustomer: guessCustomer,
    guessProject: guessProject, pickLabel: pickLabel,
  };
}
