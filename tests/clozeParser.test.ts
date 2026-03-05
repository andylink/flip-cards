import { describe, expect, it } from 'vitest';
import { clozePlaceholderIds, clozeTokens } from '@/lib/utils/answerEvaluation';

describe('clozeTokens', () => {
  it('extracts blank tokens', () => {
    expect(clozeTokens('A {{blank}} B {{ blank }} C')).toEqual(['{{blank}}', '{{ blank }}']);
  });

  it('extracts indexed tokens', () => {
    expect(clozeTokens('A {{1}} B {{ 2 }} C')).toEqual(['{{1}}', '{{ 2 }}']);
  });

  it('returns empty array when no tokens', () => {
    expect(clozeTokens('No blanks')).toEqual([]);
  });
});

describe('clozePlaceholderIds', () => {
  it('returns ordered unique ids for indexed placeholders', () => {
    expect(clozePlaceholderIds('A {{2}} B {{1}} C {{2}}')).toEqual([2, 1]);
  });

  it('maps legacy placeholders to sequential ids', () => {
    expect(clozePlaceholderIds('A {{blank}} B {{ blank }} C')).toEqual([1, 2]);
  });
});
