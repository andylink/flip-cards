import { fireEvent, render, screen } from '@testing-library/react';
import React from 'react';
import { describe, expect, it, vi } from 'vitest';
import { CanvasStage } from '@/components/CanvasStage';

vi.mock('react-konva', () => ({
  Stage: ({ children, onMouseDown }: { children: React.ReactNode; onMouseDown?: (event: unknown) => void }) => (
    <div
      data-testid="stage"
      onMouseDown={() => {
        const stage = {
          getPointerPosition: () => ({ x: 40, y: 20 })
        };

        onMouseDown?.({
          target: {
            attrs: {},
            getStage: () => stage
          },
          evt: {
            offsetX: 40,
            offsetY: 20
          }
        });
      }}
    >
      {children}
    </div>
  ),
  Layer: React.forwardRef(function Layer(
    { children }: { children: React.ReactNode },
    ref: React.ForwardedRef<HTMLDivElement>
  ) {
    return <div ref={ref}>{children}</div>;
  }),
  Text: () => <div data-testid="text-node" />,
  Rect: () => <div data-testid="rect-node" />,
  Circle: () => <div data-testid="circle-node" />,
  Line: () => <div data-testid="line-node" />,
  Image: () => <div data-testid="image-node" />,
  Transformer: React.forwardRef(function Transformer(
    _: Record<string, never>,
    ref: React.ForwardedRef<HTMLDivElement>
  ) {
    return <div ref={ref} data-testid="transformer" />;
  })
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
        activeTool="select"
        textDefaults={{
          fontFamily: 'Arial',
          fontSize: 24,
          fontWeight: '400',
          fontStyle: 'normal',
          textAlign: 'left',
          color: '#0f172a'
        }}
        shapeDefaults={{
          fillEnabled: true,
          fillColor: '#dbeafe',
          fillOpacity: 1,
          strokeEnabled: false,
          strokeColor: '#334155',
          strokeWidth: 2,
          strokeOpacity: 1
        }}
        onSelectIds={vi.fn()}
        onCanvasChange={onCanvasChange}
      />
    );

    expect(screen.getByTestId('stage')).toBeInTheDocument();
    fireEvent.keyDown(window, { key: 'ArrowRight' });
    expect(onCanvasChange).toHaveBeenCalled();
  });

  it('adds a text node when clicking the canvas in text mode', () => {
    const onCanvasChange = vi.fn();
    const onSelectIds = vi.fn();

    render(
      <CanvasStage
        canvas={{
          width: 100,
          height: 100,
          nodes: []
        }}
        selectedIds={[]}
        activeTool="text"
        textDefaults={{
          fontFamily: 'Arial',
          fontSize: 24,
          fontWeight: '400',
          fontStyle: 'normal',
          textAlign: 'left',
          color: '#0f172a'
        }}
        shapeDefaults={{
          fillEnabled: true,
          fillColor: '#dbeafe',
          fillOpacity: 1,
          strokeEnabled: false,
          strokeColor: '#334155',
          strokeWidth: 2,
          strokeOpacity: 1
        }}
        onSelectIds={onSelectIds}
        onCanvasChange={onCanvasChange}
      />
    );

    fireEvent.mouseDown(screen.getByTestId('stage'));

    expect(onCanvasChange).toHaveBeenCalledWith(
      expect.objectContaining({
        nodes: [
          expect.objectContaining({
            type: 'text',
            x: 40,
            y: 24,
            text: ''
          })
        ]
      })
    );
    expect(onSelectIds).toHaveBeenCalledWith([expect.any(String)]);
  });

  it('deletes the selected node when pressing Delete in select mode', () => {
    const onCanvasChange = vi.fn();
    const onSelectIds = vi.fn();

    render(
      <CanvasStage
        canvas={{
          width: 100,
          height: 100,
          nodes: [
            { id: '1', type: 'rect', x: 8, y: 8, width: 20, height: 20 },
            { id: '2', type: 'text', x: 40, y: 30, text: 'Keep me' }
          ]
        }}
        selectedIds={['1']}
        activeTool="select"
        textDefaults={{
          fontFamily: 'Arial',
          fontSize: 24,
          fontWeight: '400',
          fontStyle: 'normal',
          textAlign: 'left',
          color: '#0f172a'
        }}
        shapeDefaults={{
          fillEnabled: true,
          fillColor: '#dbeafe',
          fillOpacity: 1,
          strokeEnabled: false,
          strokeColor: '#334155',
          strokeWidth: 2,
          strokeOpacity: 1
        }}
        onSelectIds={onSelectIds}
        onCanvasChange={onCanvasChange}
      />
    );

    fireEvent.keyDown(window, { key: 'Delete' });

    expect(onCanvasChange).toHaveBeenCalledWith({
      width: 100,
      height: 100,
      nodes: [{ id: '2', type: 'text', x: 40, y: 30, text: 'Keep me' }]
    });
    expect(onSelectIds).toHaveBeenCalledWith([]);
  });
});
