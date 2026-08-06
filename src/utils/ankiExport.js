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
