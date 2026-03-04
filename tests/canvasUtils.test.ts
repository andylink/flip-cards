import { describe, expect, it } from 'vitest';
import { snapToGrid, serializeCanvas, deserializeCanvas } from '@/lib/utils/canvas';
import { CanvasState } from '@/lib/types/domain';

describe('canvas utils', () => {
  it('snaps values to grid', () => {
    expect(snapToGrid(17, 8)).toBe(16);
    expect(snapToGrid(19, 8)).toBe(16);
  });

  it('serializes and deserializes canvas', () => {
    const canvas: CanvasState = {
      width: 200,
      height: 100,
      nodes: [{ id: '1', type: 'text', x: 0, y: 0 }]
    };
    expect(deserializeCanvas(serializeCanvas(canvas))).toEqual(canvas);
  });
});
