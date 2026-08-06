/**
 * Anki-compatible CSV export.
 *
 * Anki imports semicolon-separated text files (File > Import, "Basic" note
 * type). Newlines become <br> so multi-line answers render, and quotes are
 * CSV-escaped.
 */

export function cardsToAnkiCsv(cards) {
  return (cards || [])
    .map((card) => {
      let front = card.front || card.question || '';
      let back = card.back || card.answer || '';
      if (!front || !back) return null;
      front = front.replace(/\n/g, '<br>').replace(/"/g, '""');
      back = back.replace(/\n/g, '<br>').replace(/"/g, '""');
      return `"${front}";"${back}"`;
    })
    .filter(Boolean)
    .join('\n');
}

/**
 * Parse Anki text exports (and our own CSV exports) into cards.
 *
 * Handles: tab-separated (Anki's "Notes in Plain Text" default),
 * semicolon-separated (our export format), quoted fields with "" escapes,
 * <br> back to newlines, and Anki's leading "#key:value" header lines.
 *
 * @returns {Array<{front: string, back: string}>}
 */
export function parseAnkiText(text) {
  if (!text || typeof text !== 'string') return [];

  const cards = [];
  for (const rawLine of text.split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.includes('\t') ? '\t' : ';';
    const fields = splitDelimitedLine(line, separator);
    if (fields.length < 2) continue;

    const clean = (field) =>
      field
        .replace(/<br\s*\/?>/gi, '\n')
        .replace(/""/g, '"')
        .trim();

    const front = clean(fields[0]);
    const back = clean(fields[1]);
    if (front && back) cards.push({ front, back });
  }
  return cards;
}

/** Split one line on a separator, respecting double-quoted fields. */
function splitDelimitedLine(line, separator) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      // A doubled quote inside a quoted field is an escaped quote.
      if (inQuotes && line[i + 1] === '"') {
        current += '""';
        i += 1;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (ch === separator && !inQuotes) {
      fields.push(current);
      current = '';
    } else {
      current += ch;
    }
  }
  fields.push(current);
  return fields;
}

/** Build the CSV and trigger a browser download. Returns the row count. */
export function downloadAnkiCsv(cards, deckTitle) {
  const csvContent = cardsToAnkiCsv(cards);
  if (!csvContent) return 0;

  const safeName = (deckTitle || 'flashcards')
    .replace(/[^a-z0-9 _-]/gi, '')
    .trim()
    .replace(/\s+/g, '-')
    .toLowerCase() || 'flashcards';

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${safeName}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  return csvContent.split('\n').length;
}
