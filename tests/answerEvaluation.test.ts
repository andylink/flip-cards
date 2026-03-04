import { describe, expect, it } from 'vitest';
import { evaluateAnswer } from '@/lib/utils/answerEvaluation';

describe('evaluateAnswer', () => {
  it('evaluates freeform case-insensitive exact matches', () => {
    const correct = evaluateAnswer(
      'freeform',
      { accepted: ['Mitochondria'], trim: true, caseSensitive: false },
      { value: ' mitochondria ' }
    );

    expect(correct).toBe(true);
  });

  it('evaluates mcq answers by selected index', () => {
    const correct = evaluateAnswer(
      'mcq',
      { choices: ['A', 'B', 'C'], correctIndex: 1, shuffle: false },
      { selectedIndex: 1 }
    );

    expect(correct).toBe(true);
  });

  it('evaluates dropdown answers with all blanks correct', () => {
    const correct = evaluateAnswer(
      'dropdown',
      {
        template: 'x {{blank}} y {{blank}}',
        blanks: [
          { options: ['a', 'b'], correctIndex: 0 },
          { options: ['c', 'd'], correctIndex: 1 }
        ]
      },
      { indices: [0, 1] }
    );

    expect(correct).toBe(true);
  });
});
