import React, { useState, useEffect, useRef } from 'react';
import { LayoutGrid, Check, Sparkles } from 'lucide-react';
import {
  type SnapLayoutId,
  SNAP_LAYOUT_OPTIONS,
} from '../lib/snapLayouts';

interface SnapLayoutsFlyoutProps {
  onSelectLayout: (layoutId: SnapLayoutId) => void;
  onClose: () => void;
}

export function SnapLayoutsFlyout({ onSelectLayout, onClose }: SnapLayoutsFlyoutProps) {
  const [hoveredLayout, setHoveredLayout] = useState<SnapLayoutId | null>(null);
  const flyoutRef = useRef<HTMLDivElement>(null);

  // Close on Escape or click outside
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };

    const handleClickOutside = (e: MouseEvent) => {
      if (flyoutRef.current && !flyoutRef.current.contains(e.target as Node)) {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [onClose]);

  const handleZoneClick = (layoutId: SnapLayoutId, e: React.MouseEvent) => {
    e.stopPropagation();
    onSelectLayout(layoutId);
    onClose();
  };

  const getZoneClass = (id: SnapLayoutId) => {
    const isHovered = hoveredLayout === id;
    return `h-full rounded-[3px] border transition-all duration-150 cursor-pointer ${
      isHovered
        ? 'bg-accent/40 border-accent shadow-xs'
        : 'bg-surface-3/80 border-line/60 hover:bg-accent/25 hover:border-accent'
    }`;
  };

  return (
    <div
      ref={flyoutRef}
      role="dialog"
      aria-label="Windows 11 Snap Layouts"
      className="absolute right-0 top-full mt-2.5 z-50 w-72 rounded-2xl bg-surface border border-line-strong p-3.5 shadow-2xl select-none"
      onClick={(e) => e.stopPropagation()}
    >
      {/* Header */}
      <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-line">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-fg">
          <LayoutGrid size={13} className="text-accent" />
          <span>Snap Layouts</span>
        </div>
        <span className="text-[10px] text-fg-muted font-mono tracking-wider uppercase">
          Win 11 DWM
        </span>
      </div>

      {/* 2x2 Matrix of Miniature Desktop Layout Cards */}
      <div className="grid grid-cols-2 gap-2.5">
        {/* Card 1: Two Equal Columns (50 / 50) */}
        <div className="flex flex-col gap-1">
          <div className="h-14 rounded-lg border border-line bg-surface-2/60 p-1 flex gap-1">
            <button
              type="button"
              aria-label="Snap Left Half"
              onMouseEnter={() => setHoveredLayout('two-col-left')}
              onMouseLeave={() => setHoveredLayout(null)}
              onClick={(e) => handleZoneClick('two-col-left', e)}
              className={`w-1/2 ${getZoneClass('two-col-left')}`}
            />
            <button
              type="button"
              aria-label="Snap Right Half"
              onMouseEnter={() => setHoveredLayout('two-col-right')}
              onMouseLeave={() => setHoveredLayout(null)}
              onClick={(e) => handleZoneClick('two-col-right', e)}
              className={`w-1/2 ${getZoneClass('two-col-right')}`}
            />
          </div>
          <span className="text-[10px] text-center text-fg-muted font-medium">1/2 · 1/2</span>
        </div>

        {/* Card 2: 70 / 30 Priority Split */}
        <div className="flex flex-col gap-1">
          <div className="h-14 rounded-lg border border-line bg-surface-2/60 p-1 flex gap-1">
            <button
              type="button"
              aria-label="Snap Priority Left 70%"
              onMouseEnter={() => setHoveredLayout('split-70')}
              onMouseLeave={() => setHoveredLayout(null)}
              onClick={(e) => handleZoneClick('split-70', e)}
              className={`w-[70%] ${getZoneClass('split-70')}`}
            />
            <button
              type="button"
              aria-label="Snap Sidebar Right 30%"
              onMouseEnter={() => setHoveredLayout('split-30')}
              onMouseLeave={() => setHoveredLayout(null)}
              onClick={(e) => handleZoneClick('split-30', e)}
              className={`w-[30%] ${getZoneClass('split-30')}`}
            />
          </div>
          <span className="text-[10px] text-center text-fg-muted font-medium">70% · 30%</span>
        </div>

        {/* Card 3: Three Columns (25 / 50 / 25) */}
        <div className="flex flex-col gap-1">
          <div className="h-14 rounded-lg border border-line bg-surface-2/60 p-1 flex gap-1">
            <button
              type="button"
              aria-label="Snap Left Column 25%"
              onMouseEnter={() => setHoveredLayout('three-col-left')}
              onMouseLeave={() => setHoveredLayout(null)}
              onClick={(e) => handleZoneClick('three-col-left', e)}
              className={`w-1/4 ${getZoneClass('three-col-left')}`}
            />
            <button
              type="button"
              aria-label="Snap Center Focus 50%"
              onMouseEnter={() => setHoveredLayout('three-col-center')}
              onMouseLeave={() => setHoveredLayout(null)}
              onClick={(e) => handleZoneClick('three-col-center', e)}
              className={`w-1/2 ${getZoneClass('three-col-center')}`}
            />
            <button
              type="button"
              aria-label="Snap Right Column 25%"
              onMouseEnter={() => setHoveredLayout('three-col-right')}
              onMouseLeave={() => setHoveredLayout(null)}
              onClick={(e) => handleZoneClick('three-col-right', e)}
              className={`w-1/4 ${getZoneClass('three-col-right')}`}
            />
          </div>
          <span className="text-[10px] text-center text-fg-muted font-medium">25 · 50 · 25</span>
        </div>

        {/* Card 4: Four Quadrants (2 x 2) */}
        <div className="flex flex-col gap-1">
          <div className="h-14 rounded-lg border border-line bg-surface-2/60 p-1 grid grid-cols-2 grid-rows-2 gap-1">
            <button
              type="button"
              aria-label="Snap Top-Left Quadrant"
              onMouseEnter={() => setHoveredLayout('quad-top-left')}
              onMouseLeave={() => setHoveredLayout(null)}
              onClick={(e) => handleZoneClick('quad-top-left', e)}
              className={getZoneClass('quad-top-left')}
            />
            <button
              type="button"
              aria-label="Snap Top-Right Quadrant"
              onMouseEnter={() => setHoveredLayout('quad-top-right')}
              onMouseLeave={() => setHoveredLayout(null)}
              onClick={(e) => handleZoneClick('quad-top-right', e)}
              className={getZoneClass('quad-top-right')}
            />
            <button
              type="button"
              aria-label="Snap Bottom-Left Quadrant"
              onMouseEnter={() => setHoveredLayout('quad-bottom-left')}
              onMouseLeave={() => setHoveredLayout(null)}
              onClick={(e) => handleZoneClick('quad-bottom-left', e)}
              className={getZoneClass('quad-bottom-left')}
            />
            <button
              type="button"
              aria-label="Snap Bottom-Right Quadrant"
              onMouseEnter={() => setHoveredLayout('quad-bottom-right')}
              onMouseLeave={() => setHoveredLayout(null)}
              onClick={(e) => handleZoneClick('quad-bottom-right', e)}
              className={getZoneClass('quad-bottom-right')}
            />
          </div>
          <span className="text-[10px] text-center text-fg-muted font-medium">2 × 2 Grid</span>
        </div>
      </div>

      {/* Dynamic Status / Tooltip Footer */}
      <div className="mt-3 pt-2 border-t border-line/70 flex items-center justify-between text-[11px]">
        {hoveredLayout ? (
          <span className="text-accent font-medium truncate">
            {SNAP_LAYOUT_OPTIONS[hoveredLayout].label}
          </span>
        ) : (
          <span className="text-fg-muted truncate">Hover any zone to preview snap</span>
        )}
        <span className="text-[10px] text-fg-muted shrink-0 font-mono">Win + Z</span>
      </div>
    </div>
  );
}
