const test = require('node:test');
const assert = require('node:assert/strict');
const P = require('../src/Parse.js');

const NOW = new Date(2026, 9, 25, 9, 0); // Sun 25 Oct 2026

test('finds bid keywords as whole words only', () => {
  assert.deepEqual(P.findBidKeywords('RFQ: lighting retrofit, Building C'), ['rfq']);
  assert.deepEqual(P.findBidKeywords('Invitation to bid - school gym'), ['bid', 'invitation to bid']);
  assert.deepEqual(P.findBidKeywords('Morbidity report attached'), []); // "bid" inside a word
  assert.equal(P.isBidEmail('Hello', 'Please send us a quote request form'), true);
});

test('extracts due dates in many formats', () => {
  const cases = [
    ['Bids due by November 3, 2026 at 2pm', '2026-11-03'],
    ['Deadline: 2026-11-14', '2026-11-14'],
    ['Closing date 3rd Nov', '2026-11-03'],
    ['Please submit by 11/05/2026', '2026-11-05'],
    ['Quotes due Friday', '2026-10-30'],
    ['due next Friday please', '2026-11-06'],
    ['Need pricing no later than tomorrow', '2026-10-26'],
    ['Deadline Jan 15', '2027-01-15'], // next occurrence rolls into next year
    ['No date here', ''],
  ];
  for (const [text, want] of cases) assert.equal(P.extractDueDate(text, NOW, false), want, text);
});

test('day-first dates for EU senders', () => {
  assert.equal(P.extractDueDate('Termiņš / deadline: 03.11.2026', NOW, true), '2026-11-03');
  assert.equal(P.extractDueDate('due 03/11/2026', NOW, false), '2026-03-11');
});

test('rejects impossible dates', () => {
  assert.equal(P.extractDueDate('due 2026-02-30', NOW, false), '');
});

test('customer and project guesses', () => {
  assert.equal(P.guessCustomer('"Jane Smith" <jane@acme-builders.com>'), 'Acme-builders');
  assert.equal(P.guessCustomer('Bob Lee <bob.lee@gmail.com>'), 'Bob Lee');
  assert.equal(P.guessProject('RE: FW: RFQ - Lighting retrofit, Building C'), 'Lighting retrofit, Building C');
  assert.equal(P.guessProject('Invitation to Bid: Oak St. School gym'), 'Oak St. School gym');
});

test('label rules: alias, sender domain, subject; first match wins', () => {
  const rules = [
    { to: 'billing@', label: 'Billing' },
    { from: 'supplier.example', label: 'Suppliers' },
    { subject: '\\bpermit\\b', label: 'Permits' },
  ];
  assert.equal(P.pickLabel({ to: 'billing@myco.com', from: 'x@y.com', subject: '' }, rules), 'Billing');
  assert.equal(P.pickLabel({ to: 'me@myco.com', from: 'Orders <orders@eu.supplier.example>', subject: '' }, rules), 'Suppliers');
  assert.equal(P.pickLabel({ to: 'me@myco.com', from: 'a@b.com', subject: 'ESA Permit #4411 issued' }, rules), 'Permits');
  assert.equal(P.pickLabel({ to: 'me@myco.com', from: 'a@b.com', subject: 'Lunch?' }, rules), '');
});
