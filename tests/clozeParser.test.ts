import { describe, expect, it } from 'vitest';
import {
  clozePlaceholders,
  clozeTokens,
  hydrateClozeAcceptedByBlank,
  remapClozeAcceptedByPlaceholder
} from '@/lib/utils/answerEvaluation';

describe('clozeTokens', () => {
  it('extracts named tokens', () => {
    expect(clozeTokens('A {{mitochondria}} B {{ ATP synthase }} C')).toEqual([
      '{{mitochondria}}',
      '{{ ATP synthase }}'
    ]);
  });

  it('extracts legacy indexed tokens', () => {
    expect(clozeTokens('A {{1}} B {{ 2 }} C')).toEqual(['{{1}}', '{{ 2 }}']);
  });

  it('returns empty array when no tokens', () => {
    expect(clozeTokens('No blanks')).toEqual([]);
  });
});

describe('clozePlaceholders', () => {
  it('returns ordered placeholders with normalized values', () => {
    expect(clozePlaceholders('A {{ ATP }} B {{NADH}}')).toEqual([
      {
        token: '{{ ATP }}',
        value: 'ATP',
        start: 2,
        end: 11
      },
      {
        token: '{{NADH}}',
        value: 'NADH',
        start: 14,
        end: 22
      }
    ]);
  });
});

describe('hydrateClozeAcceptedByBlank', () => {
  it('defaults accepted values from named placeholders', () => {
    expect(hydrateClozeAcceptedByBlank('DNA is {{double helix}}', [])).toEqual(['double helix']);
  });

  it('keeps legacy blank placeholders empty by default', () => {
    expect(hydrateClozeAcceptedByBlank('A {{blank}} B {{1}}', [])).toEqual(['', '']);
  });
});

describe('remapClozeAcceptedByPlaceholder', () => {
  it('preserves accepted values by placeholder token when order changes', () => {
    expect(
      remapClozeAcceptedByPlaceholder('A {{cat}} B {{dog}}', 'A {{dog}} B {{cat}}', ['feline', 'canine'])
    ).toEqual(['canine', 'feline']);
  });

  it('uses placeholder text as fallback for newly added blanks', () => {
    expect(remapClozeAcceptedByPlaceholder('A {{cat}}', 'A {{cat}} and {{mouse}}', ['feline'])).toEqual([
      'feline',
      'mouse'
    ]);
  });
});
