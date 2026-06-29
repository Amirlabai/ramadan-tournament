import { describe, expect, it } from 'vitest';
import { parseAdigaFormCsvRecords } from './parseAdigaFormCsv';

describe('parseAdigaFormCsvRecords', () => {
  it('parses captain combined ID+year cell when birth column empty', () => {
    const { full, partial } = parseAdigaFormCsvRecords([
      {
        'שם קבוצה': 'מקסיקו',
        'מייל קבוצה': 'cap@example.com',
        'ראש קבוצה שם מלא': 'אסעד',
        'מס ת"ז ראש קבוצה': '043382753 - 01/01/1981',
        'שנת לידה ראש קבוצה': '',
      },
    ]);

    expect(partial).toHaveLength(0);
    expect(full).toHaveLength(1);
    expect(full[0]).toMatchObject({
      name: 'אסעד',
      personalId: '043382753',
      birthYear: 1981,
      role: 'captain',
      email: 'cap@example.com',
    });
  });
});
