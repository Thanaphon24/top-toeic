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

/**
 * สร้างหน้า "สรุป": ตัวเลขภาพรวม + กราฟคะแนนดีที่สุดของแต่ละคน + ตารางสอบล่าสุด
 * กด Run ฟังก์ชันนี้ครั้งเดียว ข้อมูลจะอัปเดตเองทุกครั้งที่มีคนสอบเพิ่ม
 */
function setupDashboard() {
  var ss = SpreadsheetApp.openById(BOOK);
  if (!ss.getSheetByName(SHEET)) { var s0 = ss.insertSheet(SHEET); s0.appendRow(HEAD); s0.setFrozenRows(1); }
  var sh = ss.getSheetByName("สรุป") || ss.insertSheet("สรุป", 0);
  sh.getCharts().forEach(function (c) { sh.removeChart(c); });
  sh.clear(); sh.clearConditionalFormatRules();
  var R = "'" + SHEET + "'!";
  var PINK = "#fde7f0", BLUE = "#1f6fc4", ROSE = "#d6336f", INK = "#3d2c4f";

  sh.getRange("A1").setValue("สรุปผลสอบ TOEIC").setFontSize(18).setFontWeight("bold").setFontColor(INK);
  sh.getRange("A2").setValue("อัปเดตอัตโนมัติทุกครั้งที่มีคนส่งข้อสอบ").setFontColor("#86759a");

  var stats = [
    ["สอบไปแล้ว (ครั้ง)", "=COUNTA(" + R + "B2:B)"],
    ["จำนวนคน", "=COUNTUNIQUE(" + R + "B2:B)"],
    ["คะแนนรวมเฉลี่ย (สอบเต็ม)", "=IFERROR(ROUND(AVERAGE(" + R + "F2:F)),\"–\")"],
    ["คะแนนรวมสูงสุด", "=IF(COUNT(" + R + "F2:F),MAX(" + R + "F2:F),\"–\")"],
    ["สอบวันนี้ (ครั้ง)", "=COUNTIFS(" + R + "A2:A,\">=\"&TODAY())"]
  ];
  stats.forEach(function (r, i) {
    sh.getRange(4 + i, 1).setValue(r[0]).setFontColor(INK);
    sh.getRange(4 + i, 2).setFormula(r[1]).setFontSize(14).setFontWeight("bold").setHorizontalAlignment("center");
  });
  sh.getRange("A4:B8").setBackground(PINK).setBorder(true, true, true, true, true, true, "#f1dceb", SpreadsheetApp.BorderStyle.SOLID);

  sh.getRange("A17").setValue("คะแนนดีที่สุดของแต่ละคน").setFontSize(13).setFontWeight("bold").setFontColor(INK);
  sh.getRange("A18").setFormula('=IFERROR(QUERY(' + R + 'A2:F,"select B, count(A), max(D), max(E), max(F), max(A) where B is not null group by B order by max(F) desc, max(D) desc label B \'ชื่อ\', count(A) \'สอบ (ครั้ง)\', max(D) \'Listening ดีสุด\', max(E) \'Reading ดีสุด\', max(F) \'รวมดีสุด\', max(A) \'สอบล่าสุด\'",0),"ยังไม่มีผลสอบ")');
  sh.getRange("H17").setValue("สอบล่าสุด 30 ครั้ง").setFontSize(13).setFontWeight("bold").setFontColor(INK);
  sh.getRange("H18").setFormula('=IFERROR(QUERY(' + R + 'A2:H,"select A, B, C, D, E, F where B is not null order by A desc limit 30 label A \'วันเวลา\', B \'ชื่อ\', C \'ข้อสอบ\', D \'Listening\', E \'Reading\', F \'รวม\'",0),"ยังไม่มีผลสอบ")');

  sh.getRange("A18:F18").setFontWeight("bold").setBackground(PINK);
  sh.getRange("H18:M18").setFontWeight("bold").setBackground(PINK);
  sh.getRange("F19:F200").setNumberFormat("d/m/yyyy HH:mm");
  sh.getRange("H19:H200").setNumberFormat("d/m/yyyy HH:mm");
  sh.getRange("B19:E200").setHorizontalAlignment("center");
  sh.getRange("K19:M200").setHorizontalAlignment("center");
  sh.setColumnWidth(1, 190); sh.setColumnWidth(2, 90); sh.setColumnWidths(3, 3, 105); sh.setColumnWidth(6, 130);
  sh.setColumnWidth(7, 24); sh.setColumnWidth(8, 130); sh.setColumnWidth(9, 120); sh.setColumnWidth(10, 130); sh.setColumnWidths(11, 3, 80);
  sh.setFrozenRows(0);

  var rule = SpreadsheetApp.newConditionalFormatRule().setRanges([sh.getRange("E19:E200"), sh.getRange("M19:M200")])
    .setGradientMinpointWithValue("#fde7f0", SpreadsheetApp.InterpolationType.NUMBER, "10")
    .setGradientMaxpointWithValue("#7fd1ae", SpreadsheetApp.InterpolationType.NUMBER, "990").build();
  sh.setConditionalFormatRules([rule]);

  var chart = sh.newChart().setChartType(Charts.ChartType.COLUMN)
    .addRange(sh.getRange("A18:A60")).addRange(sh.getRange("C18:D60"))
    .setNumHeaders(1).setMergeStrategy(Charts.ChartMergeStrategy.MERGE_COLUMNS)
    .setOption("title", "คะแนนดีที่สุดของแต่ละคน (เต็มส่วนละ 495)")
    .setOption("colors", [BLUE, ROSE])
    .setOption("legend", {position: "top"})
    .setOption("vAxis", {viewWindow: {min: 0, max: 500}, ticks: [0, 100, 200, 300, 400, 500]})
    .setOption("width", 620).setOption("height", 300)
    .setPosition(1, 4, 10, 0).build();
  sh.insertChart(chart);
  ss.setActiveSheet(sh);
}
