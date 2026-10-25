/**
 * Gmail → Sheets bid alerts.
 *
 * Every 10 minutes: label new mail by alias/sender rules, spot bid/RFQ/tender
 * emails, log them to a Google Sheet (date, customer, project, due date,
 * keywords, link) and send an alert. Run `setup()` once.
 */

var HEADER = ['Received', 'Customer', 'Project', 'Due date', 'Keywords', 'From', 'Subject', 'Link', 'Status'];

/** Run once: creates the sheet (if needed) and a 10-minute trigger. */
function setup() {
  getSheet_();
  ScriptApp.getProjectTriggers().forEach(function (t) {
    if (t.getHandlerFunction() === 'processInbox') ScriptApp.deleteTrigger(t);
  });
  ScriptApp.newTrigger('processInbox').timeBased().everyMinutes(10).create();
  processInbox();
}

function processInbox() {
  var lock = LockService.getScriptLock();
  if (!lock.tryLock(30 * 1000)) return; // a previous run is still going
  try {
    var processed = getOrCreateLabel_(CONFIG.PROCESSED_LABEL);
    var threads = GmailApp.search(CONFIG.SEARCH_QUERY + ' -label:' + CONFIG.PROCESSED_LABEL.replace(/\//g, '-'), 0, 100);
    var sheet = getSheet_();
    var newRows = [];

    threads.forEach(function (thread) {
      var msg = thread.getMessages()[0];
      var meta = { to: msg.getTo() + ',' + msg.getCc(), from: msg.getFrom(), subject: msg.getSubject() };

      var rule = matchRule_(meta);
      if (rule) {
        thread.addLabel(getOrCreateLabel_(rule.label));
        if (rule.skipInbox) thread.moveToArchive();
      }

      var body = msg.getPlainBody();
      var keywords = findBidKeywords(meta.subject + '\n' + body.slice(0, 3000), CONFIG.BID_KEYWORDS);
      if (keywords.length) {
        thread.addLabel(getOrCreateLabel_(CONFIG.BID_LABEL));
        var row = [
          msg.getDate(),
          guessCustomer(meta.from),
          guessProject(meta.subject),
          extractDueDate(meta.subject + '\n' + body, msg.getDate(), CONFIG.DAY_FIRST_DATES),
          keywords.join(', '),
          meta.from,
          meta.subject,
          'https://mail.google.com/mail/u/0/#all/' + thread.getId(),
          'New',
        ];
        newRows.push(row);
        sendAlert_(row);
      }
      thread.addLabel(processed);
    });

    if (newRows.length) {
      sheet.getRange(sheet.getLastRow() + 1, 1, newRows.length, HEADER.length).setValues(newRows);
    }
    console.log('Checked %s threads, logged %s bids', threads.length, newRows.length);
  } finally {
    lock.releaseLock();
  }
}

function matchRule_(meta) {
  var label = pickLabel(meta, CONFIG.LABEL_RULES);
  if (!label) return null;
  for (var i = 0; i < CONFIG.LABEL_RULES.length; i++) {
    if (CONFIG.LABEL_RULES[i].label === label) return CONFIG.LABEL_RULES[i];
  }
  return null;
}

function sendAlert_(row) {
  var due = row[3] ? ' (due ' + row[3] + ')' : '';
  var text = 'New bid request from ' + row[1] + ': ' + row[2] + due + '\n' + row[7];
  if (CONFIG.ALERT_EMAIL) {
    MailApp.sendEmail(CONFIG.ALERT_EMAIL, 'Bid request: ' + row[2] + due, text);
  }
  if (CONFIG.CHAT_WEBHOOK_URL) {
    UrlFetchApp.fetch(CONFIG.CHAT_WEBHOOK_URL, {
      method: 'post',
      contentType: 'application/json',
      payload: JSON.stringify({ text: text }),
      muteHttpExceptions: true,
    });
  }
}

function getSheet_() {
  var props = PropertiesService.getScriptProperties();
  var id = CONFIG.SHEET_ID || props.getProperty('SHEET_ID');
  var ss = id ? SpreadsheetApp.openById(id) : SpreadsheetApp.create('Bid log');
  if (!id) props.setProperty('SHEET_ID', ss.getId());
  var sheet = ss.getSheetByName(CONFIG.SHEET_NAME) || ss.insertSheet(CONFIG.SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADER);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, HEADER.length).setFontWeight('bold');
    sheet.getRange('A:A').setNumberFormat('yyyy-mm-dd hh:mm');
    var status = SpreadsheetApp.newDataValidation().requireValueInList(['New', 'Quoting', 'Sent', 'Won', 'Lost'], true).build();
    sheet.getRange('I2:I').setDataValidation(status);
  }
  return sheet;
}

function getOrCreateLabel_(name) {
  return GmailApp.getUserLabelByName(name) || GmailApp.createLabel(name);
}
