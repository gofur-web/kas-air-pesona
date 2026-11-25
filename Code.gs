function doGet(e) {
  var action = e && e.parameter ? e.parameter.action : '';
  if (action === 'dashboard') return jsonOutput_(getDashboardData());
  if (action === 'informasi') return jsonOutput_(getInformasiBersama());
  if (action === 'notifikasi') return jsonOutput_(getNotifikasi());
  return ContentService.createTextOutput('Kas Air Pesona API aktif. Gunakan action=dashboard atau action=informasi.')
    .setMimeType(ContentService.MimeType.TEXT);
}

function doPost(e) {
  try {
    var body = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    var result;
    if (body.action === 'tambahInformasi') {
      result = tambahInformasiBersama(body.data, body.pin);
    } else if (body.action === 'hapusInformasi') {
      result = hapusInformasiBersama(body.id, body.pin);
    } else {
      throw new Error('Aksi tidak dikenal.');
    }
    return jsonOutput_(result);
  } catch (err) {
    return jsonOutput_({ success: false, error: String(err && err.message ? err.message : err) });
  }
}

function jsonOutput_(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

function getDashboardData() {
  var ss = SpreadsheetApp.getActiveSpreadsheet();
  
  // 1. Ambil data Transaksi Kas
  var sheetTrx = ss.getSheetByName("Transaksi_Kas");
  var dataTrx = sheetTrx ? sheetTrx.getDataRange().getValues() : [];
  
  var transactions = [];
  var totalIncome = 0;
  var totalExpense = 0;
  var categoryMap = {};
  var monthlyMap = {};
  
  for (var i = 1; i < dataTrx.length; i++) {
    var row = dataTrx[i];
    if (row[0]) {
      var dateVal = new Date(row[0]);
      var dateStr = Utilities.formatDate(dateVal, Session.getScriptTimeZone(), "yyyy-MM-dd");
      var monthStr = dateStr.substring(0, 7);
      var type = String(row[2]).trim();
      var category = String(row[3]).trim();
      var description = String(row[4]).trim();
      var amount = Number(row[5]) || 0;
      var method = String(row[7] || row[6] || 'Transfer').trim();
      
      transactions.push({
        date: dateStr,
        no: row[1],
        type: type,
        category: category,
        description: description,
        amount: amount,
        method: method
      });
      
      if (type.toLowerCase() === 'pemasukan') {
        totalIncome += amount;
      } else if (type.toLowerCase() === 'pengeluaran') {
        totalExpense += amount;
        categoryMap[category] = (categoryMap[category] || 0) + amount;
      }
      
      if (!monthlyMap[monthStr]) {
        monthlyMap[monthStr] = { income: 0, expense: 0 };
      }
      if (type.toLowerCase() === 'pemasukan') {
        monthlyMap[monthStr].income += amount;
      } else if (type.toLowerCase() === 'pengeluaran') {
        monthlyMap[monthStr].expense += amount;
      }
    }
  }
  
  var categories = [];
  for (var cat in categoryMap) {
    categories.push({ name: cat, amount: categoryMap[cat] });
  }
  
  var monthly = [];
  for (var m in monthlyMap) {
    monthly.push({ month: m, income: monthlyMap[m].income, expense: monthlyMap[m].expense });
  }
  monthly.sort(function(a, b) { return a.month.localeCompare(b.month); });
  
  var balance = totalIncome - totalExpense;
  
  // 2. Ambil data Iuran Warga secara lengkap
  var sheetIuran = ss.getSheetByName("Iuran_Warga_2026");
  var iuranData = sheetIuran ? sheetIuran.getDataRange().getValues() : [];
  var iuranWarga = [];
  var totalIuranWarga = 0;
  
  for (var j = 1; j < iuranData.length; j++) {
    var r = iuranData[j];
    if (r[1]) { // Blok_Rumah
      var totalLunas = Number(r[16]) || 0;
      totalIuranWarga += totalLunas;
      
      iuranWarga.push({
        no: r[0],
        blok: r[1],
        nama: r[2],
        status: r[3],
        jan: Number(r[4]) || 0,
        feb: Number(r[5]) || 0,
        mar: Number(r[6]) || 0,
        apr: Number(r[7]) || 0,
        mei: Number(r[8]) || 0,
        jun: Number(r[9]) || 0,
        jul: Number(r[10]) || 0,
        ags: Number(r[11]) || 0,
        sep: Number(r[12]) || 0,
        okt: Number(r[13]) || 0,
        nov: Number(r[14]) || 0,
        des: Number(r[15]) || 0,
        total: totalLunas
      });
    }
  }

  var updatedDate = Utilities.formatDate(new Date(), Session.getScriptTimeZone(), "dd/MM/yyyy HH:mm");

  return {
    updated: updatedDate,
    balance: balance,
    opening: 0,
    income: totalIncome,
    expense: totalExpense,
    count: transactions.length,
    fee: 50000,
    monthly: monthly,
    categories: categories,
    transactions: transactions,
    iuranWarga: iuranWarga,
    totalIuranWarga: totalIuranWarga
  };
}

const INFO_SHEET_NAME = 'Informasi Warga';
const INFO_ADMIN_PIN_PROPERTY = 'INFO_ADMIN_PIN';

/** Membaca daftar informasi. Semua pengunjung aplikasi boleh membaca. */
function getInformasiBersama() {
  const sheet = getInfoSheet_();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) return [];

  const rows = sheet.getRange(2, 1, lastRow - 1, 7).getValues();
  return rows
    .filter(row => row[0] !== '' && row[0] != null)
    .map(row => ({
      id: String(row[0]),
      judul: String(row[1] || ''),
      isi: String(row[2] || ''),
      jenis: String(row[3] || 'Informasi'),
      tanggal: row[4] instanceof Date
        ? Utilities.formatDate(row[4], Session.getScriptTimeZone(), 'yyyy-MM-dd')
        : String(row[4] || ''),
      pembuat: String(row[5] || ''),
      createdAt: Number(row[6]) || 0
    }))
    .sort((a, b) => b.createdAt - a.createdAt);
}

/** Menyimpan informasi baru setelah PIN pengurus diperiksa di server. */
function tambahInformasiBersama(data, pin) {
  cekInfoAdminPin_(pin);
  if (!data || typeof data !== 'object') throw new Error('Data informasi tidak valid.');

  const judul = String(data.judul || '').trim();
  const isi = String(data.isi || '').trim();
  const jenis = String(data.jenis || 'Informasi').trim();
  const tanggal = String(data.tanggal || '').trim();
  const pembuat = String(data.pembuat || '').trim();

  if (!judul || !isi) throw new Error('Judul dan isi informasi wajib diisi.');
  if (judul.length > 120) throw new Error('Judul maksimal 120 karakter.');
  if (isi.length > 5000) throw new Error('Isi informasi maksimal 5000 karakter.');
  if (pembuat.length > 80) throw new Error('Nama pengurus maksimal 80 karakter.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(tanggal)) throw new Error('Tanggal tidak valid.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getInfoSheet_();
    const id = Utilities.getUuid();
    const createdAt = Date.now();
    sheet.appendRow([
      id,
      safeInfoCell_(judul),
      safeInfoCell_(isi),
      safeInfoCell_(jenis),
      tanggal,
      safeInfoCell_(pembuat),
      createdAt
    ]);
    return { success: true, id: id };
  } finally {
    lock.releaseLock();
  }
}

/** Menghapus satu informasi setelah PIN pengurus diperiksa di server. */
function hapusInformasiBersama(id, pin) {
  cekInfoAdminPin_(pin);
  id = String(id || '').trim();
  if (!id) throw new Error('ID informasi tidak valid.');

  const lock = LockService.getScriptLock();
  lock.waitLock(10000);
  try {
    const sheet = getInfoSheet_();
    const lastRow = sheet.getLastRow();
    if (lastRow < 2) throw new Error('Informasi tidak ditemukan.');
    const ids = sheet.getRange(2, 1, lastRow - 1, 1).getDisplayValues();
    for (let i = 0; i < ids.length; i++) {
      if (String(ids[i][0]) === id) {
        sheet.deleteRow(i + 2);
        return { success: true };
      }
    }
    throw new Error('Informasi tidak ditemukan atau sudah dihapus.');
  } finally {
    lock.releaseLock();
  }
}

function getInfoSheet_() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  if (!ss) {
    throw new Error('Spreadsheet tidak terhubung. Buka Apps Script dari Google Sheets KAS AIR PESONA.');
  }
  let sheet = ss.getSheetByName(INFO_SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(INFO_SHEET_NAME);
    sheet.getRange(1, 1, 1, 7).setValues([[
      'ID', 'Judul', 'Isi', 'Jenis', 'Tanggal', 'Pembuat', 'CreatedAt'
    ]]);
    sheet.setFrozenRows(1);
    sheet.getRange(1, 1, 1, 7).setFontWeight('bold');
    sheet.setColumnWidth(1, 230);
    sheet.setColumnWidth(2, 240);
    sheet.setColumnWidth(3, 500);
    sheet.setColumnWidth(4, 150);
    sheet.setColumnWidth(5, 120);
    sheet.setColumnWidth(6, 180);
    sheet.setColumnWidth(7, 150);
  }
  return sheet;
}

function cekInfoAdminPin_(pin) {
  const expected = PropertiesService.getScriptProperties().getProperty(INFO_ADMIN_PIN_PROPERTY);
  if (!expected) {
    throw new Error('PIN admin belum disetel. Buka Apps Script > Project Settings > Script properties, lalu buat INFO_ADMIN_PIN dengan PIN pilihan pengurus.');
  }
  if (String(pin || '') !== expected) {
    throw new Error('PIN admin salah. Informasi tidak diubah.');
  }
}

/** Mencegah teks dari warga dianggap sebagai rumus Google Sheets. */
function safeInfoCell_(value) {
  const text = String(value == null ? '' : value);
  return /^[=+\-@]/.test(text) ? "'" + text : text;
}


function getNotifikasi() {
  var sh = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Notifikasi_Log');

  if (!sh || sh.getLastRow() < 2) {
    return {
      success: true,
      data: []
    };
  }

  var rows = sh.getRange(
    2, 1, sh.getLastRow() - 1, 4
  ).getValues();

  var data = rows.reverse().map(function(row) {
    return {
      waktu: row[0] instanceof Date
        ? Utilities.formatDate(
            row[0],
            Session.getScriptTimeZone(),
            'dd-MM-yyyy HH:mm'
          )
        : String(row[0]),
      jenis: String(row[1]),
      keterangan: String(row[2]),
      status: String(row[3])
    };
  });

  return {
    success: true,
    data: data
  };
}

function ubahStatusNotifikasi(id) {
  var sh = SpreadsheetApp.getActiveSpreadsheet()
    .getSheetByName('Notifikasi_Log');

  if (!sh) {
    throw new Error('Sheet Notifikasi_Log tidak ditemukan.');
  }

  var baris = Number(id);

  if (!Number.isInteger(baris) || baris < 2 || baris > sh.getLastRow()) {
    throw new Error('Data notifikasi tidak ditemukan.');
  }

  sh.getRange(baris, 4).setValue('Sudah dikirim');

  return {
    success: true,
    message: 'Status notifikasi berhasil diperbarui.'
  };
}
