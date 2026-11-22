import { limaDateTime } from './statistics.js';

function xml(value) {
  return String(value ?? '').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f]/g, '').replace(/[&<>"']/g, (char) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;',
  })[char]);
}

function safeText(value) {
  const text = String(value ?? '');
  return /^[\s\u0000-\u001f]*[=+\-@]/.test(text) ? `'${text}` : text;
}

function excelDate(iso) {
  const local = iso && limaDateTime(iso);
  if (!local) return null;
  const ms = Date.parse(`${local.replace(' ', 'T')}Z`);
  return Number.isFinite(ms) ? ms / 86_400_000 + 25569 : null;
}

function column(index) {
  let name = '';
  for (let n = index + 1; n; n = Math.floor((n - 1) / 26)) {
    name = String.fromCharCode(65 + (n - 1) % 26) + name;
  }
  return name;
}

function cell(value, reference, header = false) {
  if (value && typeof value === 'object' && value.date) {
    const serial = excelDate(value.date);
    return serial === null ? '' : `<c r="${reference}" s="2"><v>${serial}</v></c>`;
  }
  if (typeof value === 'number' && Number.isFinite(value)) {
    return `<c r="${reference}"${header ? ' s="1"' : ''}><v>${value}</v></c>`;
  }
  return `<c r="${reference}" t="inlineStr"${header ? ' s="1"' : ''}><is><t xml:space="preserve">${xml(safeText(value))}</t></is></c>`;
}

function worksheet(rows, widths, headerRows = [1]) {
  const cols = widths.map((width, index) => `<col min="${index + 1}" max="${index + 1}" width="${width}" customWidth="1"/>`).join('');
  const body = rows.map((row, index) => {
    const number = index + 1;
    const cells = row.map((value, columnIndex) => cell(value, `${column(columnIndex)}${number}`, headerRows.includes(number))).join('');
    return `<row r="${number}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetViews><sheetView workbookViewId="0"/></sheetViews><cols>${cols}</cols><sheetData>${body}</sheetData></worksheet>`;
}

const CRC_TABLE = Array.from({ length: 256 }, (_, n) => {
  let value = n;
  for (let bit = 0; bit < 8; bit++) value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
  return value >>> 0;
});

function crc32(buffer) {
  let crc = 0xffffffff;
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8);
  return (crc ^ 0xffffffff) >>> 0;
}

function zip(files) {
  const local = [];
  const central = [];
  let offset = 0;
  for (const [name, content] of Object.entries(files)) {
    const filename = Buffer.from(name);
    const data = Buffer.from(content, 'utf8');
    const crc = crc32(data);
    const entry = Buffer.alloc(30);
    entry.writeUInt32LE(0x04034b50, 0);
    entry.writeUInt16LE(20, 4);
    entry.writeUInt32LE(crc, 14);
    entry.writeUInt32LE(data.length, 18);
    entry.writeUInt32LE(data.length, 22);
    entry.writeUInt16LE(filename.length, 26);
    local.push(entry, filename, data);
    const directory = Buffer.alloc(46);
    directory.writeUInt32LE(0x02014b50, 0);
    directory.writeUInt16LE(20, 4);
    directory.writeUInt16LE(20, 6);
    directory.writeUInt32LE(crc, 16);
    directory.writeUInt32LE(data.length, 20);
    directory.writeUInt32LE(data.length, 24);
    directory.writeUInt16LE(filename.length, 28);
    directory.writeUInt32LE(offset, 42);
    central.push(directory, filename);
    offset += entry.length + filename.length + data.length;
  }
  const directorySize = central.reduce((sum, part) => sum + part.length, 0);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(Object.keys(files).length, 8);
  end.writeUInt16LE(Object.keys(files).length, 10);
  end.writeUInt32LE(directorySize, 12);
  end.writeUInt32LE(offset, 16);
  return Buffer.concat([...local, ...central, end]);
}

export function statisticsXlsx(report, generatedAt = new Date()) {
  const types = Object.keys(report.byType).sort();
  const period = `${report.period.from} a ${report.period.to} (America/Lima)`;
  const summary = [
    ['Manguaré', 'Informe de emergencias'],
    ['Contenido', report.demo ? 'DEMO — información ficticia, sin emergencias reales' : 'Alertas registradas por el servidor'],
    ['Generado', { date: generatedAt.toISOString() }],
    ['Periodo', period],
    ['Total de emergencias', report.total],
    ['Enviadas', report.byStatus.sent],
    ['Recibidas', report.byStatus.received],
    ['Tiempo promedio de confirmación (min)', report.averageConfirmationMinutes === null ? 'Sin información suficiente' : Math.round(report.averageConfirmationMinutes * 100) / 100],
    ['Confirmaciones con tiempo válido', report.confirmationCount],
    ['Tipo', 'Cantidad'],
    ...types.map((type) => [type, report.byType[type]]),
  ];
  const detail = [
    ['ID', 'Fecha de registro (teléfono)', 'Tipo', 'Estado', 'Recepción servidor', 'Confirmación', 'Tiempo confirmación (min)'],
    ...report.detail.map((row) => [
      row.id, { date: row.clientCreatedAt }, row.type,
      row.status === 'received' ? 'Recibida' : 'Enviada',
      { date: row.serverReceivedAt }, { date: row.acknowledgedAt },
      row.confirmationMinutes === null ? '' : Math.round(row.confirmationMinutes * 100) / 100,
    ]),
  ];
  const monthly = [
    ['Mes', 'Año', 'Emergencias', ...types.map((type) => `Tipo: ${type}`), 'Enviadas', 'Recibidas'],
    ...report.monthly.map((row) => [
      Number(row.month.slice(5)), Number(row.month.slice(0, 4)), row.count,
      ...types.map((type) => row.byType[type] ?? 0), row.byStatus.sent, row.byStatus.received,
    ]),
  ];
  const sheets = [
    worksheet(summary, [43, 58], [1, 10]),
    worksheet(detail, [40, 28, 20, 17, 27, 27, 29]),
    worksheet(monthly, [12, 12, 18, ...types.map(() => 23), 17, 17]),
  ];
  const namespace = 'http://schemas.openxmlformats.org/spreadsheetml/2006/main';
  const files = {
    '[Content_Types].xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheets.map((_, i) => `<Override PartName="/xl/worksheets/sheet${i + 1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}</Types>`,
    '_rels/.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`,
    'xl/workbook.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><workbook xmlns="${namespace}" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships"><sheets><sheet name="Resumen general" sheetId="1" r:id="rId1"/><sheet name="Detalle de emergencias" sheetId="2" r:id="rId2"/><sheet name="Estadísticas mensuales" sheetId="3" r:id="rId3"/></sheets></workbook>`,
    'xl/_rels/workbook.xml.rels': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheets.map((_, i) => `<Relationship Id="rId${i + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i + 1}.xml"/>`).join('')}<Relationship Id="rId4" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`,
    'xl/styles.xml': `<?xml version="1.0" encoding="UTF-8" standalone="yes"?><styleSheet xmlns="${namespace}"><numFmts count="1"><numFmt numFmtId="164" formatCode="yyyy-mm-dd hh:mm"/></numFmts><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><color rgb="FFFFFFFF"/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FF1D5B43"/><bgColor indexed="64"/></patternFill></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="0" fontId="1" fillId="1" borderId="0" xfId="0" applyFont="1" applyFill="1"/><xf numFmtId="164" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs></styleSheet>`,
    ...Object.fromEntries(sheets.map((sheet, i) => [`xl/worksheets/sheet${i + 1}.xml`, sheet])),
  };
  return zip(files);
}
