import { describe, expect, it } from 'vitest';
import { clozeTokens } from '@/lib/utils/answerEvaluation';

describe('clozeTokens', () => {
  it('extracts blank tokens', () => {
    expect(clozeTokens('A {{blank}} B {{ blank }} C')).toEqual(['{{blank}}', '{{ blank }}']);
  });

  it('returns empty array when no tokens', () => {
    expect(clozeTokens('No blanks')).toEqual([]);
  });
});
