import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { AnswerWidget } from '@/components/Play/AnswerWidget';

describe('AnswerWidget', () => {
  it('submits freeform response', async () => {
    const onSubmit = vi.fn();
    render(
      <AnswerWidget
        answerType="freeform"
        schemaJson={{ accepted: ['hello'], trim: true, caseSensitive: false }}
        onSubmit={onSubmit}
      />
    );

    await userEvent.type(screen.getByPlaceholderText('Type your answer'), 'hello');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledWith({ value: 'hello' });
  });

  it('renders mcq options', () => {
    render(
      <AnswerWidget
        answerType="mcq"
        schemaJson={{ choices: ['A', 'B'], correctIndex: 1, shuffle: false }}
        onSubmit={vi.fn()}
      />
    );

    expect(screen.getByLabelText('A')).toBeInTheDocument();
    expect(screen.getByLabelText('B')).toBeInTheDocument();
  });
});
