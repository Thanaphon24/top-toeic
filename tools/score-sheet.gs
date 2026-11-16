/**
 * รับผลสอบจากเว็บ ติว TOEIC ฟรี แล้วบันทึกลง Google Sheet นี้
 * ติดตั้ง: script.google.com > New project > วางโค้ดนี้ > Deploy > New deployment > Web app
 *   Execute as: Me   |   Who has access: Anyone
 * แล้วคัดลอก Web app URL ไปใส่ช่อง "report" ใน config.json
 */
var BOOK = "1LC9_RIKACPgza_uIi_EY3Go5g13f-Ss9Gc1Ikq31a-M"; /* ไอดีของ Google Sheet "ผลสอบ TOEIC" */
var SHEET = "ผลสอบ";
var HEAD = ["วันเวลา", "ชื่อ", "ข้อสอบ", "Listening", "Reading", "รวม", "จับเวลา", "ข้อที่ไม่ได้ตอบ",
            "Part 1", "Part 2", "Part 3", "Part 4", "Part 5", "Part 6", "Part 7"];

function doPost(e) {
  var lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    var d = JSON.parse(e.postData.contents);
    var sh = SpreadsheetApp.openById(BOOK).getSheetByName(SHEET);
    if (!sh) {
      sh = SpreadsheetApp.openById(BOOK).insertSheet(SHEET);
      sh.appendRow(HEAD);
      sh.setFrozenRows(1);
      sh.getRange(1, 1, 1, HEAD.length).setFontWeight("bold");
    }
    var num = function (v) { return typeof v === "number" && v >= 0 && v <= 990 ? v : ""; };
    var txt = function (v, n) { return String(v == null ? "" : v).replace(/^[=+\-@]/, "'$&").slice(0, n); };
    var p = d.parts || {};
    var row = [new Date(), txt(d.name, 40), txt(d.exam, 40), num(d.L), num(d.R), num(d.total),
               d.timed ? "ใช่" : "ไม่", num(d.blank)];
    for (var i = 1; i <= 7; i++) row.push(txt(p["Part " + i], 10));
    sh.appendRow(row);
    return ContentService.createTextOutput("ok");
  } catch (err) {
    return ContentService.createTextOutput("error");
  } finally {
    lock.releaseLock();
  }
}
