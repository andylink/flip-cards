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

  it('renders dropdown questions and submits selected indices', async () => {
    const onSubmit = vi.fn();
    render(
      <AnswerWidget
        answerType="dropdown"
        schemaJson={{
          questions: [
            { prompt: 'Type of vessel', options: ['Power driven vessel', 'Sailing vessel'], correctIndex: 0 },
            { prompt: 'Vessel length', options: ['Below 50m', 'Over 50m'], correctIndex: 1 }
          ]
        }}
        onSubmit={onSubmit}
      />
    );

    expect(screen.getByText('Type of vessel')).toBeInTheDocument();
    expect(screen.getByText('Vessel length')).toBeInTheDocument();

    const selects = screen.getAllByRole('combobox');
    await userEvent.selectOptions(selects[1], '1');
    await userEvent.click(screen.getByRole('button', { name: 'Submit' }));

    expect(onSubmit).toHaveBeenCalledWith({ indices: [0, 1] });
  });
});
