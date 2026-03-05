import { describe, expect, it } from 'vitest';
import { clampCanvasSize, clampPortraitCanvasSize, snapToGrid, serializeCanvas, deserializeCanvas } from '@/lib/utils/canvas';
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
    expect(deserializeCanvas(serializeCanvas(canvas))).toEqual({
      width: 200,
      height: 100,
      nodes: [
        {
          id: '1',
          type: 'text',
          x: 0,
          y: 0,
          fill: {
            enabled: true,
            color: '#0f172a',
            opacity: 1
          }
        }
      ]
    });
  });

  it('clamps canvas size to provided bounds', () => {
    expect(
      clampCanvasSize(
        { width: 2000, height: 100 },
        { minWidth: 320, minHeight: 240, maxWidth: 1400, maxHeight: 900 }
      )
    ).toEqual({ width: 1400, height: 240 });
  });

  it('rounds canvas dimensions to integers', () => {
    expect(clampCanvasSize({ width: 800.6, height: 600.2 })).toEqual({ width: 801, height: 600 });
  });

  it('enforces portrait dimensions when clamping portrait canvas size', () => {
    expect(
      clampPortraitCanvasSize(
        { width: 900, height: 600 },
        { minWidth: 320, minHeight: 320, maxWidth: 720, maxHeight: 1200 }
      )
    ).toEqual({ width: 720, height: 720 });
  });

  it('applies provided bounds while preserving portrait orientation', () => {
    expect(
      clampPortraitCanvasSize(
        { width: 300.2, height: 500.9 },
        { minWidth: 320, minHeight: 320, maxWidth: 720, maxHeight: 1200 }
      )
    ).toEqual({ width: 320, height: 501 });
  });
});
