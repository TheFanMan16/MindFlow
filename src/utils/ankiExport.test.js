import { describe, it, expect } from 'vitest';
import { cardsToAnkiCsv, parseAnkiText } from './ankiExport';

describe('parseAnkiText', () => {
  it('parses tab-separated Anki exports', () => {
    const text = 'What is ATP?\tThe energy currency of the cell\nSecond front\tSecond back';
    expect(parseAnkiText(text)).toEqual([
      { front: 'What is ATP?', back: 'The energy currency of the cell' },
      { front: 'Second front', back: 'Second back' },
    ]);
  });

  it('skips Anki header lines and blanks', () => {
    const text = '#separator:tab\n#html:true\n\nFront\tBack\n';
    expect(parseAnkiText(text)).toEqual([{ front: 'Front', back: 'Back' }]);
  });

  it('parses our own semicolon CSV format with quotes', () => {
    const text = '"What is a cell?";"The basic unit of life"';
    expect(parseAnkiText(text)).toEqual([
      { front: 'What is a cell?', back: 'The basic unit of life' },
    ]);
  });

  it('keeps semicolons inside quoted fields', () => {
    const text = '"First; with semicolon";"Answer"';
    expect(parseAnkiText(text)).toEqual([
      { front: 'First; with semicolon', back: 'Answer' },
    ]);
  });

  it('converts <br> back to newlines and unescapes quotes', () => {
    const text = '"Line one<br>Line two";"He said ""hi"""';
    expect(parseAnkiText(text)).toEqual([
      { front: 'Line one\nLine two', back: 'He said "hi"' },
    ]);
  });

  it('ignores lines without both fields', () => {
    expect(parseAnkiText('just one field\n;\nok\tfine')).toEqual([
      { front: 'ok', back: 'fine' },
    ]);
  });

  it('handles empty and non-string input', () => {
    expect(parseAnkiText('')).toEqual([]);
    expect(parseAnkiText(null)).toEqual([]);
  });

  it('round-trips our own export format', () => {
    const cards = [
      { front: 'Multi\nline "question"', back: 'An answer; with punctuation' },
      { front: 'Plain', back: 'Card' },
    ];
    expect(parseAnkiText(cardsToAnkiCsv(cards))).toEqual(cards);
  });
});
