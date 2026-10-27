/**
 * Learning evidence endpoint for the "Night Visit to Red Cliff" game.
 *
 * Spreadsheet tabs created by setupSheets():
 *   Sessions  - one row per game session
 *   Responses - one row per meaningful learning action / answer
 *
 * Configure SPREADSHEET_ID in Apps Script > Project Settings > Script properties
 * when this is a standalone Apps Script project. A spreadsheet-bound script can
 * use its active spreadsheet without that property.
 */

const CONFIG = Object.freeze({
  sessionsSheet: 'Sessions',
  responsesSheet: 'Responses',
  maxEventsPerRequest: 100,
  maxTextLength: 2000,
  schemaVersion: '1',
  allowedActions: Object.freeze([
    'clue_opened',
    'stamp_added',
    'emotion_answer',
    'evidence_answer',
    'emotion_order_submitted',
    'reflection_submitted',
    'session_completed'
  ])
});

const SESSION_HEADERS = Object.freeze([
  'session_id',
  'classroom_code',
  'game_id',
  'content_version',
  'mode',
  'session_length',
  'started_at',
  'completed_at',
  'completed',
  'received_at'
]);

const RESPONSE_HEADERS = Object.freeze([
  'session_id',
  'event_id',
  'event_index',
  'occurred_at',
  'stage_id',
  'action',
  'clue_id',
  'choice_id',
  'is_correct',
  'attempt_no',
  'hint_level',
  'elapsed_ms',
  'response_text',
  'received_at'
]);

/** Optional health check. It does not read or return spreadsheet contents. */
function doGet() {
  return jsonOutput_({ ok: true, service: 'red-cliff-learning-evidence', schemaVersion: CONFIG.schemaVersion });
}

/**
 * Accepts JSON POST bodies in either of these forms:
 * {"type":"session","session":{...}}
 * {"type":"responses","sessionId":"...","events":[...]}
 */
function doPost(e) {
  let lock;
  try {
    const rawBody = e && e.postData && e.postData.contents;
    if (!rawBody) throw new Error('Request body is empty.');

    const payload = JSON.parse(rawBody);
    const spreadsheet = getSpreadsheet_();
    lock = LockService.getScriptLock();
    lock.waitLock(10000);

    let result;
    if (payload.type === 'session') {
      result = saveSession_(spreadsheet, payload.session);
    } else if (payload.type === 'responses') {
      result = saveResponses_(spreadsheet, payload.sessionId, payload.events);
    } else {
      throw new Error('Unsupported request type.');
    }

    return jsonOutput_(Object.assign({ ok: true }, result));
  } catch (error) {
    console.error('Learning evidence request failed: ' + (error && error.message ? error.message : error));
    return jsonOutput_({ ok: false, error: safeText_(error && error.message ? error.message : 'Request failed.') });
  } finally {
    if (lock && lock.hasLock()) lock.releaseLock();
  }
}

/** Run this manually once to create or verify the two worksheet headers. */
function setupSheets() {
  const spreadsheet = getSpreadsheet_();
  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    ensureSheet_(spreadsheet, CONFIG.sessionsSheet, SESSION_HEADERS);
    ensureSheet_(spreadsheet, CONFIG.responsesSheet, RESPONSE_HEADERS);
    return 'Ready: Sessions and Responses sheets are configured.';
  } finally {
    if (lock.hasLock()) lock.releaseLock();
  }
}

function getSpreadsheet_() {
  const active = SpreadsheetApp.getActiveSpreadsheet();
  if (active) return active;

  const id = PropertiesService.getScriptProperties().getProperty('SPREADSHEET_ID');
  if (!id) {
    throw new Error('Set Script Property SPREADSHEET_ID to the target Google spreadsheet ID.');
  }
  return SpreadsheetApp.openById(id);
}

function saveSession_(spreadsheet, input) {
  if (!input || typeof input !== 'object') throw new Error('Session data is missing.');
  const sessionId = requiredId_(input.sessionId, 'sessionId');
  const sheet = ensureSheet_(spreadsheet, CONFIG.sessionsSheet, SESSION_HEADERS);
  const receivedAt = new Date().toISOString();
  const row = [
    sessionId,
    safeText_(input.classroomCode),
    safeText_(input.gameId || 'qianchibi-fu'),
    safeText_(input.contentVersion || 'mvp-1'),
    safeText_(input.mode),
    safeText_(input.sessionLength),
    safeText_(input.startedAt),
    safeText_(input.completedAt),
    typeof input.completed === 'boolean' ? input.completed : false,
    receivedAt
  ];

  const existingRow = findRowByValue_(sheet, 1, sessionId);
  if (existingRow) {
    sheet.getRange(existingRow, 1, 1, row.length).setValues([row]);
    return { saved: 1, updated: true, sessionId: sessionId };
  }

  sheet.getRange(sheet.getLastRow() + 1, 1, 1, row.length).setValues([row]);
  return { saved: 1, updated: false, sessionId: sessionId };
}

function saveResponses_(spreadsheet, rawSessionId, rawEvents) {
  const sessionId = requiredId_(rawSessionId, 'sessionId');
  if (!Array.isArray(rawEvents) || rawEvents.length === 0) throw new Error('events must be a non-empty array.');
  if (rawEvents.length > CONFIG.maxEventsPerRequest) throw new Error('Too many events in one request.');

  const sheet = ensureSheet_(spreadsheet, CONFIG.responsesSheet, RESPONSE_HEADERS);
  const existingIds = existingEventIds_(sheet);
  const requestIds = new Set();
  const rows = [];

  rawEvents.forEach(function (event, index) {
    if (!event || typeof event !== 'object') throw new Error('Each event must be an object.');
    const eventId = requiredId_(event.eventId, 'eventId');
    if (requestIds.has(eventId)) return;
    requestIds.add(eventId);
    if (existingIds.has(eventId)) return;

    const action = safeText_(event.action);
    if (CONFIG.allowedActions.indexOf(action) === -1) throw new Error('Unsupported event action.');

    rows.push([
      sessionId,
      eventId,
      finiteNumberOrBlank_(event.eventIndex, index),
      safeText_(event.occurredAt || new Date().toISOString()),
      safeText_(event.stageId),
      action,
      safeText_(event.clueId),
      safeText_(event.choiceId),
      typeof event.isCorrect === 'boolean' ? event.isCorrect : '',
      finiteNumberOrBlank_(event.attemptNo, ''),
      safeText_(event.hintLevel),
      finiteNumberOrBlank_(event.elapsedMs, ''),
      safeText_(event.responseText),
      new Date().toISOString()
    ]);
  });

  if (rows.length) {
    sheet.getRange(sheet.getLastRow() + 1, 1, rows.length, RESPONSE_HEADERS.length).setValues(rows);
  }
  return { saved: rows.length, skippedDuplicates: rawEvents.length - rows.length, sessionId: sessionId };
}

function ensureSheet_(spreadsheet, name, headers) {
  let sheet = spreadsheet.getSheetByName(name);
  if (!sheet) sheet = spreadsheet.insertSheet(name);

  if (sheet.getLastRow() === 0) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold');
    return sheet;
  }

  const current = sheet.getRange(1, 1, 1, headers.length).getDisplayValues()[0];
  if (headers.some(function (header, index) { return current[index] !== header; })) {
    throw new Error('Header mismatch in sheet "' + name + '". Do not overwrite existing data; review the header row first.');
  }
  return sheet;
}

function findRowByValue_(sheet, column, value) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return 0;
  const match = sheet.getRange(2, column, lastRow - 1, 1)
    .createTextFinder(String(value))
    .matchEntireCell(true)
    .findNext();
  return match ? match.getRow() : 0;
}

function existingEventIds_(sheet) {
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return new Set();
  const values = sheet.getRange(2, 2, lastRow - 1, 1).getDisplayValues();
  return new Set(values.map(function (row) { return row[0]; }).filter(Boolean));
}

function requiredId_(value, label) {
  const id = safeText_(value);
  if (!id || id.length > 100 || !/^[A-Za-z0-9_-]+$/.test(id)) {
    throw new Error(label + ' must be 1-100 letters, numbers, underscores, or hyphens.');
  }
  return id;
}

function finiteNumberOrBlank_(value, fallback) {
  if (value === undefined || value === null || value === '') return fallback;
  const number = Number(value);
  return Number.isFinite(number) ? number : fallback;
}

function safeText_(value) {
  if (value === undefined || value === null) return '';
  let text = String(value)
    .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]/g, '')
    .slice(0, CONFIG.maxTextLength);
  // Keep learner text as plain text instead of letting Sheets evaluate formulas.
  if (/^[=+\-@]/.test(text)) text = "'" + text;
  return text;
}

function jsonOutput_(value) {
  return ContentService.createTextOutput(JSON.stringify(value))
    .setMimeType(ContentService.MimeType.JSON);
}
