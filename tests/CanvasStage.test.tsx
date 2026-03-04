import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasStage } from '@/components/CanvasStage';

vi.mock('react-konva', () => ({
  Stage: ({ children }: { children: React.ReactNode }) => <div data-testid="stage">{children}</div>,
  Layer: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  Text: () => <div data-testid="text-node" />,
  Rect: () => <div data-testid="rect-node" />,
  Circle: () => <div data-testid="circle-node" />,
  Line: () => <div data-testid="line-node" />,
  Image: () => <div data-testid="image-node" />
}));

describe('CanvasStage', () => {
  it('renders stage and calls onCanvasChange on keyboard nudge', () => {
    const onCanvasChange = vi.fn();

    render(
      <CanvasStage
        canvas={{
          width: 100,
          height: 100,
          nodes: [{ id: '1', type: 'text', x: 10, y: 10, text: 'Hello' }]
        }}
        selectedIds={['1']}
        onSelectIds={vi.fn()}
        onCanvasChange={onCanvasChange}
      />
    );

    expect(screen.getByTestId('stage')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onCanvasChange).toHaveBeenCalled();
  });
});
