export function parseCsv(text) {
  const rows = [];
  let row = [];
  let cell = '';
  let quoted = false;
  for (let index = 0; index < text.length; index += 1) {
    const character = text[index];
    if (character === '"') {
      if (quoted && text[index + 1] === '"') { cell += '"'; index += 1; }
      else quoted = !quoted;
    } else if (character === ',' && !quoted) {
      row.push(cell.trim()); cell = '';
    } else if ((character === '\n' || character === '\r') && !quoted) {
      if (character === '\r' && text[index + 1] === '\n') index += 1;
      row.push(cell.trim());
      if (row.some(Boolean)) rows.push(row);
      row = []; cell = '';
    } else cell += character;
  }
  if (quoted) throw new Error('CSV contains an unclosed quoted value.');
  row.push(cell.trim());
  if (row.some(Boolean)) rows.push(row);
  if (rows.length < 2) throw new Error('CSV must contain a header row and at least one data row.');
  return rows;
}

export function validateCsv(text, existingCount = 0) {
  const rows = parseCsv(text);
  const headers = rows[0].map((header, index) => (index === 0 ? header.replace(/^\uFEFF/, '') : header).toLowerCase().replace(/[\s-]+/g, '_'));
  const required = ['date', 'attendance', 'menu', 'food_item', 'planned_quantity', 'actual_consumption', 'leftover', 'weather', 'holiday', 'event'];
  const missing = required.filter((header) => !headers.includes(header));
  if (missing.length) throw new Error(`Missing required columns: ${missing.join(', ')}.`);
  const index = Object.fromEntries(headers.map((header, position) => [header, position]));
  return rows.slice(1).map((row, rowIndex) => {
    const line = rowIndex + 2;
    const get = (key) => (row[index[key]] ?? '').trim();
    const date = get('date');
    if (!isValidIsoDate(date)) throw new Error(`Row ${line}: date must be a valid date in YYYY-MM-DD format.`);
    for (const field of ['attendance', 'planned_quantity', 'actual_consumption', 'leftover']) {
      if (!get(field) || !Number.isFinite(Number(get(field))) || Number(get(field)) < 0) throw new Error(`Row ${line}: ${field} must be a non-negative number.`);
    }
    const planned = Number(get('planned_quantity'));
    const consumed = Number(get('actual_consumption'));
    const leftover = Number(get('leftover'));
    if (consumed > planned || Math.abs(planned - consumed - leftover) > 1) throw new Error(`Row ${line}: leftover must equal planned quantity minus actual consumption.`);
    if (!get('menu') || !get('food_item') || !get('weather')) throw new Error(`Row ${line}: menu, food_item, and weather cannot be empty.`);
    return {
      id: `upload-${Date.now()}-${existingCount + rowIndex}`,
      date,
      attendance: Number(get('attendance')),
      menu: get('menu'),
      foodItem: get('food_item'),
      category: get('category') || 'Other',
      plannedQuantity: planned,
      actualConsumption: consumed,
      leftover: planned - consumed,
      weather: get('weather'),
      holiday: ['true', 'yes', '1'].includes(get('holiday').toLowerCase()),
      event: get('event'),
    };
  });
}

function isValidIsoDate(value) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(String(value))) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(date.getTime()) && date.toISOString().slice(0, 10) === value;
}
