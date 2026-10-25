/**
 * FocusSpace — Windows 11 Native Snap Layouts Engine
 *
 * Implements high-precision multi-zone layout calculations matching the Windows 11
 * DWM snap assist matrix:
 *   1. Two Columns (50 / 50)
 *   2. Two Columns (70 / 30 - Priority Left / Sidebar Right)
 *   3. Three Columns (25 / 50 / 25 - Left / Center Focus / Right)
 *   4. Four Quadrants (2 x 2)
 */

export type SnapLayoutId =
  | 'two-col-left'
  | 'two-col-right'
  | 'split-70'
  | 'split-30'
  | 'three-col-left'
  | 'three-col-center'
  | 'three-col-right'
  | 'quad-top-left'
  | 'quad-top-right'
  | 'quad-bottom-left'
  | 'quad-bottom-right';

export interface Rectangle {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SnapLayoutOption {
  id: SnapLayoutId;
  label: string;
  category: 'two-col' | 'split-70-30' | 'three-col' | 'quadrants';
}

export const SNAP_LAYOUT_OPTIONS: Record<SnapLayoutId, { label: string; description: string }> = {
  'two-col-left': { label: 'Left Half', description: 'Snap FocusSpace to the left 50% of the screen' },
  'two-col-right': { label: 'Right Half', description: 'Snap FocusSpace to the right 50% of the screen' },
  'split-70': { label: 'Priority Left (70%)', description: 'Snap FocusSpace to a wide 70% primary focus column' },
  'split-30': { label: 'Sidebar Right (30%)', description: 'Snap FocusSpace to a 30% companion column' },
  'three-col-left': { label: 'Left Column (25%)', description: 'Snap FocusSpace to the left companion column' },
  'three-col-center': { label: 'Center Focus (50%)', description: 'Snap FocusSpace to the center 50% focus area' },
  'three-col-right': { label: 'Right Column (25%)', description: 'Snap FocusSpace to the right companion column' },
  'quad-top-left': { label: 'Top-Left Quadrant', description: 'Snap FocusSpace to the upper-left quadrant' },
  'quad-top-right': { label: 'Top-Right Quadrant', description: 'Snap FocusSpace to the upper-right quadrant' },
  'quad-bottom-left': { label: 'Bottom-Left Quadrant', description: 'Snap FocusSpace to the lower-left quadrant' },
  'quad-bottom-right': { label: 'Bottom-Right Quadrant', description: 'Snap FocusSpace to the lower-right quadrant' },
};

/**
 * Calculates pixel-perfect integer bounds for the window within the display's usable workArea.
 * Guarantees zero 1px gaps or overflow rounding errors even with odd display resolutions.
 */
export function calculateSnapBounds(layout: SnapLayoutId, workArea: Rectangle): Rectangle {
  const x = Math.round(workArea.x);
  const y = Math.round(workArea.y);
  const width = Math.max(320, Math.round(workArea.width));
  const height = Math.max(240, Math.round(workArea.height));

  const halfW = Math.floor(width / 2);
  const remW = width - halfW;
  const halfH = Math.floor(height / 2);
  const remH = height - halfH;

  switch (layout) {
    case 'two-col-left':
      return { x, y, width: halfW, height };
    case 'two-col-right':
      return { x: x + halfW, y, width: remW, height };

    case 'split-70': {
      const w70 = Math.floor(width * 0.7);
      return { x, y, width: w70, height };
    }
    case 'split-30': {
      const w70 = Math.floor(width * 0.7);
      return { x: x + w70, y, width: width - w70, height };
    }

    case 'three-col-left': {
      const w25 = Math.floor(width * 0.25);
      return { x, y, width: w25, height };
    }
    case 'three-col-center': {
      const w25 = Math.floor(width * 0.25);
      const w50 = Math.floor(width * 0.5);
      return { x: x + w25, y, width: w50, height };
    }
    case 'three-col-right': {
      const w25 = Math.floor(width * 0.25);
      const w50 = Math.floor(width * 0.5);
      return { x: x + w25 + w50, y, width: width - (w25 + w50), height };
    }

    case 'quad-top-left':
      return { x, y, width: halfW, height: halfH };
    case 'quad-top-right':
      return { x: x + halfW, y, width: remW, height: halfH };
    case 'quad-bottom-left':
      return { x, y: y + halfH, width: halfW, height: remH };
    case 'quad-bottom-right':
      return { x: x + halfW, y: y + halfH, width: remW, height: remH };

    default:
      return { x, y, width, height };
  }
}
