/**
 * Trip 2026 - Bulletproof Google Apps Script Gateway
 * Target Sheet ID: 1877_oKGn_ySXxopRfzIP791MCrkZYWMC0eqKIT3EpZ0
 */

const SHEET_NAMES = {
  MEMBERS: 'Members',
  QUEUE: 'ApprovalQueue',
  RECEIPTS: 'Receipts',
  EXPENSES: 'Expenses'
};

// Ensures sheets and headers exist even if user manually clears the sheet
function setupSheets() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();

  // 1. Members Sheet
  let mSh = ss.getSheetByName(SHEET_NAMES.MEMBERS);
  if (!mSh) {
    mSh = ss.insertSheet(SHEET_NAMES.MEMBERS);
  }
  if (mSh.getLastRow() === 0) {
    mSh.appendRow(['ID', 'Name', 'Phone', 'Advance Required', 'Days Available', 'Status', 'UTR']);
    mSh.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#e2e8f0');
  }

  // 2. Queue Sheet
  let qSh = ss.getSheetByName(SHEET_NAMES.QUEUE);
  if (!qSh) {
    qSh = ss.insertSheet(SHEET_NAMES.QUEUE);
  }
  if (qSh.getLastRow() === 0) {
    qSh.appendRow(['Queue ID', 'Receipt No', 'Member ID', 'Member Name', 'Amount', 'Date', 'UTR', 'Status']);
    qSh.getRange(1, 1, 1, 8).setFontWeight('bold').setBackground('#fef3c7');
  }

  // 3. Receipts Sheet
  let rSh = ss.getSheetByName(SHEET_NAMES.RECEIPTS);
  if (!rSh) {
    rSh = ss.insertSheet(SHEET_NAMES.RECEIPTS);
  }
  if (rSh.getLastRow() === 0) {
    rSh.appendRow(['Receipt No', 'Member ID', 'Member Name', 'Amount Paid', 'UTR ID', 'Issued Date', 'Status']);
    rSh.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#d1fae5');
  }

  // 4. Expenses Sheet
  let eSh = ss.getSheetByName(SHEET_NAMES.EXPENSES);
  if (!eSh) {
    eSh = ss.insertSheet(SHEET_NAMES.EXPENSES);
  }
  if (eSh.getLastRow() === 0) {
    eSh.appendRow(['ID', 'Date', 'Title', 'Category', 'Amount', 'Paid By', 'Split Among']);
    eSh.getRange(1, 1, 1, 7).setFontWeight('bold').setBackground('#c7d2fe');
  }
}

// GET API Endpoint: Fetches live data from Google Sheet
function doGet(e) {
  setupSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  
  const members = readSheetData(ss.getSheetByName(SHEET_NAMES.MEMBERS));
  const queue = readSheetData(ss.getSheetByName(SHEET_NAMES.QUEUE));
  const receipts = readSheetData(ss.getSheetByName(SHEET_NAMES.RECEIPTS));
  const expenses = readSheetData(ss.getSheetByName(SHEET_NAMES.EXPENSES));
  
  const payload = {
    success: true,
    data: {
      members: members,
      queue: queue,
      receipts: receipts,
      expenses: expenses
    }
  };
  
  return ContentService.createTextOutput(JSON.stringify(payload))
    .setMimeType(ContentService.MimeType.JSON);
}

// POST API Endpoint: Upserts & saves data
function doPost(e) {
  setupSheets();
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let response = { success: false, message: 'Invalid payload or unknown action' };
  
  try {
    if (!e || !e.postData || !e.postData.contents) {
      return ContentService.createTextOutput(JSON.stringify({ success: false, message: 'No post data received' }))
        .setMimeType(ContentService.MimeType.JSON);
    }

    const raw = e.postData.contents;
    const data = JSON.parse(raw);
    const action = String(data.action || '').toUpperCase().trim();

    // ACTION: ADD OR UPDATE MEMBER
    if (action === 'ADD_MEMBER' || action === 'SAVE_MEMBER') {
      const sh = ss.getSheetByName(SHEET_NAMES.MEMBERS);
      const m = data.member;
      
      const rows = sh.getDataRange().getValues();
      let foundIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(m.id)) {
          foundIndex = i + 1;
          break;
        }
      }

      if (foundIndex !== -1) {
        // Update Row
        sh.getRange(foundIndex, 2).setValue(m.name);
        sh.getRange(foundIndex, 3).setValue(m.phone || '');
        sh.getRange(foundIndex, 4).setValue(m.advance);
        sh.getRange(foundIndex, 5).setValue(m.days);
        sh.getRange(foundIndex, 6).setValue(m.status || 'Not Paid');
        sh.getRange(foundIndex, 7).setValue(m.utr || '');
      } else {
        // Append New Row
        sh.appendRow([m.id, m.name, m.phone || '', m.advance, m.days, m.status || 'Not Paid', m.utr || '']);
      }
      response = { success: true, message: 'Member saved to sheet' };
    }

    // ACTION: SUBMIT PAYMENT QUEUE
    else if (action === 'SUBMIT_PAYMENT_QUEUE' || action === 'QUEUE_PAYMENT') {
      const qSh = ss.getSheetByName(SHEET_NAMES.QUEUE);
      const q = data.queueItem;
      qSh.appendRow([q.id, q.receiptNo, q.memberId, q.memberName, q.amount, q.date, q.utr || '', 'Pending Approval']);
      response = { success: true, message: 'Payment submitted to queue sheet' };
    }

    // ACTION: APPROVE PAYMENT
    else if (action === 'VERIFY_ADVANCE' || action === 'APPROVE_PAYMENT' || action === 'APPROVE_RECEIPT') {
      const mSh = ss.getSheetByName(SHEET_NAMES.MEMBERS);
      const rows = mSh.getDataRange().getValues();
      const memberId = data.memberId;
      let foundIndex = -1;

      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(memberId)) {
          foundIndex = i + 1;
          break;
        }
      }

      if (foundIndex !== -1) {
        mSh.getRange(foundIndex, 6).setValue('Paid');
        mSh.getRange(foundIndex, 7).setValue(data.utr || '');
      } else {
        // Auto create member row if missing
        const rName = (data.receipt && data.receipt.memberName) ? data.receipt.memberName : 'Member';
        const rAmt = (data.receipt && data.receipt.amount) ? data.receipt.amount : 5000;
        mSh.appendRow([memberId, rName, '', rAmt, 4, 'Paid', data.utr || '']);
      }

      // Add to Receipts Sheet
      const rSh = ss.getSheetByName(SHEET_NAMES.RECEIPTS);
      const r = data.receipt;
      if (r) {
        rSh.appendRow([r.receiptNo, r.memberId, r.memberName, r.amount, r.utr || '', r.date || new Date().toLocaleDateString(), 'Approved']);
      }

      // Update Queue status if item exists
      const qSh = ss.getSheetByName(SHEET_NAMES.QUEUE);
      const qRows = qSh.getDataRange().getValues();
      for (let i = 1; i < qRows.length; i++) {
        if (String(qRows[i][0]) === String(data.queueId) || String(qRows[i][1]) === String(data.receipt ? data.receipt.receiptNo : '')) {
          qSh.getRange(i + 1, 8).setValue('Approved');
          break;
        }
      }
      
      response = { success: true, message: 'Payment approved & saved' };
    }

    // ACTION: ADD EXPENSE
    else if (action === 'ADD_EXPENSE' || action === 'SAVE_EXPENSE' || action === 'EXPENSE') {
      const sh = ss.getSheetByName(SHEET_NAMES.EXPENSES);
      const ex = data.expense;
      
      const rows = sh.getDataRange().getValues();
      let foundIndex = -1;
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(ex.id)) {
          foundIndex = i + 1;
          break;
        }
      }

      const paidByLabel = ex.paidByName || ex.paidBy || '';
      const splitList = (ex.splitAmongNames && ex.splitAmongNames.length > 0) ? ex.splitAmongNames : (ex.splitAmong || []);
      const splitJson = Array.isArray(splitList) ? JSON.stringify(splitList) : String(splitList || '');

      if (foundIndex !== -1) {
        sh.getRange(foundIndex, 2).setValue(ex.date || '');
        sh.getRange(foundIndex, 3).setValue(ex.title || '');
        sh.getRange(foundIndex, 4).setValue(ex.category || '');
        sh.getRange(foundIndex, 5).setValue(ex.amount || 0);
        sh.getRange(foundIndex, 6).setValue(paidByLabel);
        sh.getRange(foundIndex, 7).setValue(splitJson);
      } else {
        sh.appendRow([ex.id, ex.date || '', ex.title || '', ex.category || '', ex.amount || 0, paidByLabel, splitJson]);
      }
      response = { success: true, message: 'Expense saved to sheet' };
    }

    // ACTION: UPDATE MEMBER STATUS
    else if (action === 'UPDATE_MEMBER_STATUS') {
      const sh = ss.getSheetByName(SHEET_NAMES.MEMBERS);
      const rows = sh.getDataRange().getValues();
      for (let i = 1; i < rows.length; i++) {
        if (String(rows[i][0]) === String(data.memberId)) {
          sh.getRange(i + 1, 6).setValue(data.status);
          break;
        }
      }
      response = { success: true, message: 'Status updated' };
    }
  } catch (err) {
    response = { success: false, error: err.toString() };
  }
  
  return ContentService.createTextOutput(JSON.stringify(response))
    .setMimeType(ContentService.MimeType.JSON);
}

// Read sheet rows helper
function readSheetData(sheet) {
  if (!sheet) return [];
  const rows = sheet.getDataRange().getValues();
  if (rows.length <= 1) return [];
  
  const headers = rows[0];
  const items = [];
  
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row[0] && !row[1]) continue; // Skip empty rows
    const obj = {};
    for (let j = 0; j < headers.length; j++) {
      let val = row[j];
      if (val instanceof Date) {
        val = Utilities.formatDate(val, Session.getScriptTimeZone(), "yyyy-MM-dd");
      }
      obj[headers[j]] = val;
    }
    items.push(obj);
  }
  return items;
}
