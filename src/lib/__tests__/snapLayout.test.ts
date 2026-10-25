import { describe, it, expect } from 'vitest';
import { calculateSnapBounds, SNAP_LAYOUT_OPTIONS, type Rectangle, type SnapLayoutId } from '../snapLayouts';

describe('Snap Layouts Engine', () => {
  const standard1080p: Rectangle = { x: 0, y: 0, width: 1920, height: 1040 }; // 1080p with 40px taskbar
  const offsetMonitor: Rectangle = { x: 1920, y: 40, width: 2560, height: 1400 };
  const oddDisplay: Rectangle = { x: 0, y: 0, width: 1365, height: 745 };

  it('calculates 50/50 two-column split cleanly with zero gap', () => {
    const left = calculateSnapBounds('two-col-left', standard1080p);
    const right = calculateSnapBounds('two-col-right', standard1080p);

    expect(left).toEqual({ x: 0, y: 0, width: 960, height: 1040 });
    expect(right).toEqual({ x: 960, y: 0, width: 960, height: 1040 });
    expect(left.width + right.width).toBe(standard1080p.width);
  });

  it('calculates 70/30 priority split cleanly with zero gap', () => {
    const left = calculateSnapBounds('split-70', standard1080p);
    const right = calculateSnapBounds('split-30', standard1080p);

    expect(left.width + right.width).toBe(standard1080p.width);
    expect(right.x).toBe(left.x + left.width);
    expect(left.height).toBe(standard1080p.height);
    expect(right.height).toBe(standard1080p.height);
  });

  it('calculates 3-column split (25 / 50 / 25) seamlessly spanning the full display width', () => {
    const col1 = calculateSnapBounds('three-col-left', standard1080p);
    const col2 = calculateSnapBounds('three-col-center', standard1080p);
    const col3 = calculateSnapBounds('three-col-right', standard1080p);

    expect(col1.x).toBe(0);
    expect(col1.width).toBe(480);
    expect(col2.x).toBe(480);
    expect(col2.width).toBe(960);
    expect(col3.x).toBe(1440);
    expect(col3.width).toBe(480);
    expect(col1.width + col2.width + col3.width).toBe(1920);
  });

  it('calculates 4 quadrants (2x2) tiling the entire workArea without gaps', () => {
    const tl = calculateSnapBounds('quad-top-left', standard1080p);
    const tr = calculateSnapBounds('quad-top-right', standard1080p);
    const bl = calculateSnapBounds('quad-bottom-left', standard1080p);
    const br = calculateSnapBounds('quad-bottom-right', standard1080p);

    expect(tl.width + tr.width).toBe(standard1080p.width);
    expect(bl.width + br.width).toBe(standard1080p.width);
    expect(tl.height + bl.height).toBe(standard1080p.height);
    expect(tr.height + br.height).toBe(standard1080p.height);

    expect(tl.x).toBe(0);
    expect(tl.y).toBe(0);
    expect(tr.x).toBe(960);
    expect(tr.y).toBe(0);
    expect(bl.x).toBe(0);
    expect(bl.y).toBe(520);
    expect(br.x).toBe(960);
    expect(br.y).toBe(520);
  });

  it('preserves multi-monitor x and y offsets correctly', () => {
    const left = calculateSnapBounds('two-col-left', offsetMonitor);
    const right = calculateSnapBounds('two-col-right', offsetMonitor);

    expect(left.x).toBe(1920);
    expect(left.y).toBe(40);
    expect(right.x).toBe(1920 + 1280);
    expect(right.y).toBe(40);
  });

  it('handles odd dimensions without fractional pixel bleeding or rounding gaps', () => {
    const left = calculateSnapBounds('two-col-left', oddDisplay);
    const right = calculateSnapBounds('two-col-right', oddDisplay);

    expect(Number.isInteger(left.width)).toBe(true);
    expect(Number.isInteger(right.width)).toBe(true);
    expect(left.width + right.width).toBe(oddDisplay.width);

    const tl = calculateSnapBounds('quad-top-left', oddDisplay);
    const bl = calculateSnapBounds('quad-bottom-left', oddDisplay);
    expect(tl.height + bl.height).toBe(oddDisplay.height);
  });

  it('defines labels and descriptions for all 11 snap layout options', () => {
    const allIds: SnapLayoutId[] = [
      'two-col-left',
      'two-col-right',
      'split-70',
      'split-30',
      'three-col-left',
      'three-col-center',
      'three-col-right',
      'quad-top-left',
      'quad-top-right',
      'quad-bottom-left',
      'quad-bottom-right',
    ];

    for (const id of allIds) {
      expect(SNAP_LAYOUT_OPTIONS[id]).toBeDefined();
      expect(SNAP_LAYOUT_OPTIONS[id].label.length).toBeGreaterThan(0);
      expect(SNAP_LAYOUT_OPTIONS[id].description.length).toBeGreaterThan(0);
    }
  });
});
