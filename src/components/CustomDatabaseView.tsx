import React, { useState, useMemo, useRef, useEffect } from 'react';
import {
  Table as TableIcon,
  Columns3,
  List as ListIcon,
  Plus,
  Trash2,
  MoreHorizontal,
  ChevronDown,
  ArrowUpDown,
  ArrowUp,
  ArrowDown,
  Check,
  Calendar,
  Hash,
  Type,
  Tag,
  CheckSquare,
  X,
} from 'lucide-react';
import { uid } from '../lib/utils';
import type {
  CustomDatabase,
  DatabaseColumn,
  DatabaseColumnType,
  DatabaseRow,
  DatabaseViewType,
} from '../types';

export function createProjectTrackerDatabase(): CustomDatabase {
  const now = new Date().toISOString();
  const colTask: DatabaseColumn = { id: 'col-task', name: 'Task', type: 'text' };
  const colStatus: DatabaseColumn = {
    id: 'col-status',
    name: 'Status',
    type: 'select',
    options: ['Backlog', 'In Progress', 'In Review', 'Done'],
  };
  const colPriority: DatabaseColumn = {
    id: 'col-priority',
    name: 'Priority',
    type: 'select',
    options: ['Low', 'Medium', 'High', 'Urgent'],
  };
  const colDue: DatabaseColumn = { id: 'col-due', name: 'Due Date', type: 'date' };
  const colDone: DatabaseColumn = { id: 'col-done', name: 'Done', type: 'checkbox' };

  return {
    id: uid(),
    title: 'Project & Sprint Tracker',
    viewType: 'table',
    groupByColumnId: 'col-status',
    columns: [colTask, colStatus, colPriority, colDue, colDone],
    rows: [
      {
        id: uid(),
        cells: {
          'col-task': 'Setup API routes and architecture',
          'col-status': 'Done',
          'col-priority': 'High',
          'col-due': '2026-10-20',
          'col-done': true,
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        cells: {
          'col-task': 'Implement offline database synchronization',
          'col-status': 'In Progress',
          'col-priority': 'Urgent',
          'col-due': '2026-10-22',
          'col-done': false,
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        cells: {
          'col-task': 'Design user onboarding and tactile HUD',
          'col-status': 'Backlog',
          'col-priority': 'Medium',
          'col-due': '2026-10-25',
          'col-done': false,
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function createStudyTrackerDatabase(): CustomDatabase {
  const now = new Date().toISOString();
  const colTopic: DatabaseColumn = { id: 'col-topic', name: 'Topic', type: 'text' };
  const colModule: DatabaseColumn = { id: 'col-module', name: 'Module', type: 'text' };
  const colConfidence: DatabaseColumn = {
    id: 'col-confidence',
    name: 'Confidence',
    type: 'select',
    options: ['Need Review', 'Practicing', 'Mastered'],
  };
  const colLastRev: DatabaseColumn = { id: 'col-lastrev', name: 'Last Reviewed', type: 'date' };
  const colMastered: DatabaseColumn = { id: 'col-mastered', name: 'Mastered', type: 'checkbox' };

  return {
    id: uid(),
    title: 'Course & Study Tracker',
    viewType: 'table',
    groupByColumnId: 'col-confidence',
    columns: [colTopic, colModule, colConfidence, colLastRev, colMastered],
    rows: [
      {
        id: uid(),
        cells: {
          'col-topic': 'Vector Embedding Search & Cosine Distance',
          'col-module': 'Module 1: ML Foundations',
          'col-confidence': 'Mastered',
          'col-lastrev': '2026-10-18',
          'col-mastered': true,
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        cells: {
          'col-topic': 'Quantized GGUF / ONNX Runtime Inference',
          'col-module': 'Module 2: Edge AI',
          'col-confidence': 'Practicing',
          'col-lastrev': '2026-10-19',
          'col-mastered': false,
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function createReadingLogDatabase(): CustomDatabase {
  const now = new Date().toISOString();
  const colTitle: DatabaseColumn = { id: 'col-title', name: 'Title', type: 'text' };
  const colCat: DatabaseColumn = {
    id: 'col-cat',
    name: 'Category',
    type: 'select',
    options: ['Book', 'Article', 'Video', 'Paper'],
  };
  const colRating: DatabaseColumn = {
    id: 'col-rating',
    name: 'Rating',
    type: 'select',
    options: ['⭐', '⭐⭐', '⭐⭐⭐', '⭐⭐⭐⭐', '⭐⭐⭐⭐⭐'],
  };
  const colNotes: DatabaseColumn = { id: 'col-notes', name: 'Notes', type: 'text' };
  const colCompleted: DatabaseColumn = { id: 'col-completed', name: 'Completed', type: 'checkbox' };

  return {
    id: uid(),
    title: 'Reading & Media Log',
    viewType: 'table',
    groupByColumnId: 'col-cat',
    columns: [colTitle, colCat, colRating, colNotes, colCompleted],
    rows: [
      {
        id: uid(),
        cells: {
          'col-title': 'Designing Data-Intensive Applications',
          'col-cat': 'Book',
          'col-rating': '⭐⭐⭐⭐⭐',
          'col-notes': 'Deep dive on replication & consensus',
          'col-completed': true,
        },
        createdAt: now,
        updatedAt: now,
      },
      {
        id: uid(),
        cells: {
          'col-title': 'Attention Is All You Need',
          'col-cat': 'Paper',
          'col-rating': '⭐⭐⭐⭐⭐',
          'col-notes': 'Foundational self-attention transformer architecture',
          'col-completed': true,
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

export function createBlankDatabase(): CustomDatabase {
  const now = new Date().toISOString();
  const colName: DatabaseColumn = { id: 'col-name', name: 'Name', type: 'text' };
  const colStatus: DatabaseColumn = {
    id: 'col-status',
    name: 'Status',
    type: 'select',
    options: ['To Do', 'Doing', 'Done'],
  };
  const colNotes: DatabaseColumn = { id: 'col-notes', name: 'Notes', type: 'text' };
  const colDone: DatabaseColumn = { id: 'col-done', name: 'Done', type: 'checkbox' };

  return {
    id: uid(),
    title: 'Untitled Database',
    viewType: 'table',
    groupByColumnId: 'col-status',
    columns: [colName, colStatus, colNotes, colDone],
    rows: [
      {
        id: uid(),
        cells: {
          'col-name': 'Item 1',
          'col-status': 'To Do',
          'col-notes': '',
          'col-done': false,
        },
        createdAt: now,
        updatedAt: now,
      },
    ],
    createdAt: now,
    updatedAt: now,
  };
}

function ColumnTypeIcon({ type }: { type: DatabaseColumnType }) {
  switch (type) {
    case 'number':
      return <Hash size={13} className="text-fg-muted" />;
    case 'select':
      return <Tag size={13} className="text-fg-muted" />;
    case 'date':
      return <Calendar size={13} className="text-fg-muted" />;
    case 'checkbox':
      return <CheckSquare size={13} className="text-fg-muted" />;
    case 'text':
    default:
      return <Type size={13} className="text-fg-muted" />;
  }
}

interface CustomDatabaseViewProps {
  database: CustomDatabase;
  onUpdate: (updated: CustomDatabase) => void;
  onDelete: () => void;
}

export function CustomDatabaseView({ database, onUpdate, onDelete }: CustomDatabaseViewProps) {
  const [dbTitle, setDbTitle] = useState(database.title);
  const [activeView, setActiveView] = useState<DatabaseViewType>(database.viewType || 'table');
  const [sortCol, setSortCol] = useState<string | null>(null);
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');
  const [addColumnModalOpen, setAddColumnModalOpen] = useState(false);
  const [newColName, setNewColName] = useState('');
  const [newColType, setNewColType] = useState<DatabaseColumnType>('text');
  const [activeSelectMenu, setActiveSelectMenu] = useState<{ rowId: string; colId: string } | null>(null);
  const [newOptionInput, setNewOptionInput] = useState('');

  useEffect(() => {
    setDbTitle(database.title);
    setActiveView(database.viewType || 'table');
  }, [database.title, database.viewType]);

  const handleTitleBlur = () => {
    if (dbTitle.trim() && dbTitle !== database.title) {
      onUpdate({ ...database, title: dbTitle.trim(), updatedAt: new Date().toISOString() });
    }
  };

  const handleSetView = (view: DatabaseViewType) => {
    setActiveView(view);
    onUpdate({ ...database, viewType: view, updatedAt: new Date().toISOString() });
  };

  const handleCellChange = (rowId: string, colId: string, value: any) => {
    const updatedRows = database.rows.map(row => {
      if (row.id === rowId) {
        return {
          ...row,
          cells: { ...row.cells, [colId]: value },
          updatedAt: new Date().toISOString(),
        };
      }
      return row;
    });
    onUpdate({ ...database, rows: updatedRows, updatedAt: new Date().toISOString() });
  };

  const handleAddRow = (initialCells: Record<string, any> = {}) => {
    const now = new Date().toISOString();
    const newRow: DatabaseRow = {
      id: uid(),
      cells: initialCells,
      createdAt: now,
      updatedAt: now,
    };
    onUpdate({
      ...database,
      rows: [...database.rows, newRow],
      updatedAt: now,
    });
  };

  const handleDeleteRow = (rowId: string) => {
    const updatedRows = database.rows.filter(r => r.id !== rowId);
    onUpdate({
      ...database,
      rows: updatedRows,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddColumn = () => {
    if (!newColName.trim()) return;
    const now = new Date().toISOString();
    const newCol: DatabaseColumn = {
      id: uid(),
      name: newColName.trim(),
      type: newColType,
      options: newColType === 'select' ? ['To Do', 'In Progress', 'Done'] : undefined,
    };
    onUpdate({
      ...database,
      columns: [...database.columns, newCol],
      updatedAt: now,
    });
    setNewColName('');
    setNewColType('text');
    setAddColumnModalOpen(false);
  };

  const handleDeleteColumn = (colId: string) => {
    if (database.columns.length <= 1) return;
    const updatedCols = database.columns.filter(c => c.id !== colId);
    const updatedRows = database.rows.map(row => {
      const copy = { ...row.cells };
      delete copy[colId];
      return { ...row, cells: copy };
    });
    onUpdate({
      ...database,
      columns: updatedCols,
      rows: updatedRows,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddOptionToColumn = (colId: string, option: string) => {
    if (!option.trim()) return;
    const cleanOpt = option.trim();
    const updatedCols = database.columns.map(c => {
      if (c.id === colId) {
        const existing = c.options || [];
        if (!existing.includes(cleanOpt)) {
          return { ...c, options: [...existing, cleanOpt] };
        }
      }
      return c;
    });
    onUpdate({ ...database, columns: updatedCols, updatedAt: new Date().toISOString() });
    setNewOptionInput('');
  };

  // Sorting
  const sortedRows = useMemo(() => {
    if (!sortCol) return database.rows;
    return [...database.rows].sort((a, b) => {
      const valA = a.cells[sortCol];
      const valB = b.cells[sortCol];
      if (valA === valB) return 0;
      if (valA === undefined || valA === null) return 1;
      if (valB === undefined || valB === null) return -1;
      const cmp = String(valA).localeCompare(String(valB), undefined, { numeric: true });
      return sortDir === 'asc' ? cmp : -cmp;
    });
  }, [database.rows, sortCol, sortDir]);

  const toggleSort = (colId: string) => {
    if (sortCol === colId) {
      if (sortDir === 'asc') setSortDir('desc');
      else {
        setSortCol(null);
        setSortDir('asc');
      }
    } else {
      setSortCol(colId);
      setSortDir('asc');
    }
  };

  // Board grouping column
  const boardColumn = useMemo(() => {
    if (database.groupByColumnId) {
      const match = database.columns.find(c => c.id === database.groupByColumnId);
      if (match && match.type === 'select') return match;
    }
    return database.columns.find(c => c.type === 'select') || null;
  }, [database.columns, database.groupByColumnId]);

  return (
    <div className="rounded-2xl border border-line bg-surface-2 overflow-hidden shadow-xs mb-6">
      {/* Database Top Bar */}
      <div className="p-3 sm:px-4 border-b border-line flex flex-wrap items-center justify-between gap-2 bg-surface/50">
        <div className="flex items-center gap-2 flex-1 min-w-[200px]">
          <input
            type="text"
            value={dbTitle}
            onChange={e => setDbTitle(e.target.value)}
            onBlur={handleTitleBlur}
            onKeyDown={e => e.key === 'Enter' && (e.target as HTMLElement).blur()}
            className="text-sm font-semibold bg-transparent border-b border-transparent hover:border-line focus:border-accent outline-none text-fg transition px-1 py-0.5 rounded-sm max-w-sm"
            placeholder="Database Title"
          />
          <span className="text-[11px] font-mono text-fg-muted bg-surface px-2 py-0.5 rounded-full border border-line">
            {database.rows.length} {database.rows.length === 1 ? 'row' : 'rows'}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {/* View Mode Switcher Pills */}
          <div className="flex items-center bg-surface border border-line rounded-lg p-0.5">
            <button
              type="button"
              onClick={() => handleSetView('table')}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition ${
                activeView === 'table' ? 'bg-surface-2 text-fg shadow-xs border border-line' : 'text-fg-muted hover:text-fg'
              }`}
              title="Table View (Spreadsheet Grid)"
            >
              <TableIcon size={13} />
              <span className="hidden sm:inline">Table</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetView('board')}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition ${
                activeView === 'board' ? 'bg-surface-2 text-fg shadow-xs border border-line' : 'text-fg-muted hover:text-fg'
              }`}
              title="Board View (Kanban Columns)"
            >
              <Columns3 size={13} />
              <span className="hidden sm:inline">Board</span>
            </button>
            <button
              type="button"
              onClick={() => handleSetView('list')}
              className={`p-1.5 rounded-md text-xs font-medium flex items-center gap-1 transition ${
                activeView === 'list' ? 'bg-surface-2 text-fg shadow-xs border border-line' : 'text-fg-muted hover:text-fg'
              }`}
              title="List View (Cards)"
            >
              <ListIcon size={13} />
              <span className="hidden sm:inline">List</span>
            </button>
          </div>

          {/* Add Row Button */}
          <button
            type="button"
            onClick={() => handleAddRow()}
            className="h-8 px-2.5 rounded-lg bg-surface border border-line hover:border-line-strong text-fg text-xs font-medium flex items-center gap-1 transition"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Row</span>
          </button>

          {/* Add Column Button */}
          <button
            type="button"
            onClick={() => setAddColumnModalOpen(true)}
            className="h-8 px-2.5 rounded-lg bg-surface border border-line hover:border-line-strong text-fg text-xs font-medium flex items-center gap-1 transition"
          >
            <Plus size={13} />
            <span className="hidden sm:inline">Column</span>
          </button>

          {/* Delete Database Button */}
          <button
            type="button"
            onClick={() => {
              if (window.confirm(`Delete database "${database.title}"?`)) {
                onDelete();
              }
            }}
            title="Delete database"
            className="size-8 rounded-lg border border-line text-fg-muted hover:text-red-500 hover:border-red-500/30 grid place-items-center transition"
          >
            <Trash2 size={13} />
          </button>
        </div>
      </div>

      {/* 1. TABLE VIEW */}
      {activeView === 'table' && (
        <div className="overflow-x-auto max-h-[500px]">
          <table className="w-full text-left border-collapse text-xs">
            <thead>
              <tr className="border-b border-line bg-surface/70 text-fg-muted">
                <th className="w-10 px-3 py-2 text-center font-normal">#</th>
                {database.columns.map(col => (
                  <th key={col.id} className="px-3 py-2 font-medium border-l border-line min-w-[140px] group">
                    <div className="flex items-center justify-between gap-1">
                      <button
                        type="button"
                        onClick={() => toggleSort(col.id)}
                        className="flex items-center gap-1.5 hover:text-fg transition truncate text-left"
                      >
                        <ColumnTypeIcon type={col.type} />
                        <span className="font-semibold text-fg-soft truncate">{col.name}</span>
                        {sortCol === col.id ? (
                          sortDir === 'asc' ? <ArrowUp size={11} className="text-accent" /> : <ArrowDown size={11} className="text-accent" />
                        ) : (
                          <ArrowUpDown size={10} className="opacity-0 group-hover:opacity-60 transition" />
                        )}
                      </button>
                      {database.columns.length > 1 && (
                        <button
                          type="button"
                          onClick={() => handleDeleteColumn(col.id)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 hover:text-red-500 transition rounded"
                          title="Delete column"
                        >
                          <X size={11} />
                        </button>
                      )}
                    </div>
                  </th>
                ))}
                <th className="w-10 px-2 py-2 border-l border-line"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {sortedRows.map((row, idx) => (
                <tr key={row.id} className="hover:bg-hover/50 group transition">
                  <td className="px-3 py-2 text-center text-fg-muted font-mono text-[10px] select-none">
                    {idx + 1}
                  </td>
                  {database.columns.map(col => {
                    const cellVal = row.cells[col.id];
                    return (
                      <td key={col.id} className="px-2 py-1.5 border-l border-line">
                        {col.type === 'checkbox' ? (
                          <div className="flex items-center justify-center">
                            <input
                              type="checkbox"
                              checked={Boolean(cellVal)}
                              onChange={e => handleCellChange(row.id, col.id, e.target.checked)}
                              className="size-4 rounded accent-accent cursor-pointer"
                            />
                          </div>
                        ) : col.type === 'select' ? (
                          <div className="relative">
                            <button
                              type="button"
                              onClick={() => {
                                if (activeSelectMenu?.rowId === row.id && activeSelectMenu?.colId === col.id) {
                                  setActiveSelectMenu(null);
                                } else {
                                  setActiveSelectMenu({ rowId: row.id, colId: col.id });
                                }
                              }}
                              className="h-7 w-full px-2 rounded-md bg-surface border border-line/60 hover:border-line flex items-center justify-between text-left gap-1"
                            >
                              <span className={`truncate text-xs ${cellVal ? 'text-fg font-medium' : 'text-fg-muted italic'}`}>
                                {cellVal || 'Select…'}
                              </span>
                              <ChevronDown size={10} className="text-fg-muted shrink-0" />
                            </button>
                            {activeSelectMenu?.rowId === row.id && activeSelectMenu?.colId === col.id && (
                              <div className="absolute top-8 left-0 z-50 w-44 rounded-xl bg-surface border border-line shadow-xl p-1.5 space-y-1">
                                {(col.options || []).map(opt => (
                                  <button
                                    key={opt}
                                    type="button"
                                    onClick={() => {
                                      handleCellChange(row.id, col.id, opt);
                                      setActiveSelectMenu(null);
                                    }}
                                    className={`w-full text-left px-2 py-1 rounded-md text-xs flex items-center justify-between hover:bg-hover transition ${
                                      cellVal === opt ? 'bg-accent/10 text-accent font-semibold' : 'text-fg'
                                    }`}
                                  >
                                    <span>{opt}</span>
                                    {cellVal === opt && <Check size={12} />}
                                  </button>
                                ))}
                                <div className="border-t border-line pt-1 mt-1 flex items-center gap-1">
                                  <input
                                    type="text"
                                    placeholder="+ New option"
                                    value={newOptionInput}
                                    onChange={e => setNewOptionInput(e.target.value)}
                                    onKeyDown={e => {
                                      if (e.key === 'Enter') {
                                        handleAddOptionToColumn(col.id, newOptionInput);
                                        handleCellChange(row.id, col.id, newOptionInput.trim());
                                        setActiveSelectMenu(null);
                                      }
                                    }}
                                    className="w-full h-6 px-1.5 rounded text-xs bg-surface-2 border border-line outline-none focus:border-accent"
                                  />
                                </div>
                              </div>
                            )}
                          </div>
                        ) : col.type === 'date' ? (
                          <input
                            type="date"
                            value={cellVal || ''}
                            onChange={e => handleCellChange(row.id, col.id, e.target.value)}
                            className="h-7 w-full px-2 rounded-md bg-transparent hover:bg-surface focus:bg-surface border border-transparent focus:border-accent outline-none text-xs text-fg"
                          />
                        ) : col.type === 'number' ? (
                          <input
                            type="number"
                            value={cellVal !== undefined ? cellVal : ''}
                            onChange={e => handleCellChange(row.id, col.id, e.target.value === '' ? '' : Number(e.target.value))}
                            className="h-7 w-full px-2 rounded-md bg-transparent hover:bg-surface focus:bg-surface border border-transparent focus:border-accent outline-none text-xs text-fg font-mono"
                            placeholder="0"
                          />
                        ) : (
                          <input
                            type="text"
                            value={cellVal || ''}
                            onChange={e => handleCellChange(row.id, col.id, e.target.value)}
                            className="h-7 w-full px-2 rounded-md bg-transparent hover:bg-surface focus:bg-surface border border-transparent focus:border-accent outline-none text-xs text-fg"
                            placeholder="Empty"
                          />
                        )}
                      </td>
                    );
                  })}
                  <td className="px-2 py-1.5 text-center border-l border-line">
                    <button
                      type="button"
                      onClick={() => handleDeleteRow(row.id)}
                      className="opacity-0 group-hover:opacity-100 p-1 hover:text-red-500 rounded transition"
                      title="Delete row"
                    >
                      <Trash2 size={12} />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <button
            type="button"
            onClick={() => handleAddRow()}
            className="w-full py-2 border-t border-line text-xs font-medium text-fg-muted hover:text-fg hover:bg-hover/50 flex items-center justify-center gap-1 transition"
          >
            <Plus size={13} /> Add Row
          </button>
        </div>
      )}

      {/* 2. BOARD VIEW (Kanban grouped by first select column) */}
      {activeView === 'board' && (
        <div className="p-3 overflow-x-auto">
          {boardColumn ? (
            <div className="flex gap-3 min-w-max">
              {[...(boardColumn.options || []), 'Unassigned'].map(groupName => {
                const groupRows = database.rows.filter(r => {
                  const val = r.cells[boardColumn.id];
                  if (groupName === 'Unassigned') return !val || !boardColumn.options?.includes(val);
                  return val === groupName;
                });

                return (
                  <div key={groupName} className="w-64 rounded-xl bg-surface border border-line p-2.5 flex flex-col gap-2">
                    <div className="flex items-center justify-between pb-1 border-b border-line">
                      <span className="font-semibold text-xs text-fg">{groupName}</span>
                      <span className="text-[11px] font-mono text-fg-muted bg-surface-2 px-1.5 py-0.2 rounded">
                        {groupRows.length}
                      </span>
                    </div>

                    <div className="flex flex-col gap-2 min-h-[100px]">
                      {groupRows.map(row => {
                        const titleCol = database.columns[0];
                        const titleVal = titleCol ? row.cells[titleCol.id] : 'Untitled';
                        const isDone = Object.entries(row.cells).some(
                          ([k, v]) => database.columns.find(c => c.id === k)?.type === 'checkbox' && v === true
                        );

                        return (
                          <div
                            key={row.id}
                            className="rounded-lg bg-surface-2 border border-line p-2.5 shadow-xs space-y-1.5 hover:border-line-strong transition"
                          >
                            <div className="flex items-start justify-between gap-1">
                              <span className={`text-xs font-medium ${isDone ? 'line-through text-fg-muted' : 'text-fg'}`}>
                                {titleVal || 'Untitled'}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleDeleteRow(row.id)}
                                className="text-fg-subtle hover:text-red-500 p-0.5"
                              >
                                <Trash2 size={11} />
                              </button>
                            </div>

                            {/* Sub-fields preview */}
                            <div className="flex flex-wrap gap-1 text-[10px]">
                              {database.columns.slice(1).map(c => {
                                const v = row.cells[c.id];
                                if (v === undefined || v === null || v === '') return null;
                                if (c.id === boardColumn.id) return null;
                                return (
                                  <span key={c.id} className="px-1.5 py-0.5 rounded bg-surface border border-line text-fg-muted font-mono">
                                    {c.name}: {String(v)}
                                  </span>
                                );
                              })}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {groupName !== 'Unassigned' && (
                      <button
                        type="button"
                        onClick={() => handleAddRow({ [boardColumn.id]: groupName })}
                        className="w-full py-1.5 text-xs text-fg-muted hover:text-fg hover:bg-hover rounded-md flex items-center justify-center gap-1 transition"
                      >
                        <Plus size={12} /> Add Card
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="p-6 text-center text-xs text-fg-muted">
              Board view requires at least one "Select" column (e.g. Status) to group items into columns.
              <button
                type="button"
                onClick={() => {
                  setNewColName('Status');
                  setNewColType('select');
                  setAddColumnModalOpen(true);
                }}
                className="mt-2 block mx-auto px-3 py-1.5 rounded-lg bg-accent text-accent-fg font-medium"
              >
                + Add Status Column
              </button>
            </div>
          )}
        </div>
      )}

      {/* 3. LIST VIEW */}
      {activeView === 'list' && (
        <div className="p-3 space-y-2">
          {sortedRows.map(row => {
            const firstCol = database.columns[0];
            const checkboxCol = database.columns.find(c => c.type === 'checkbox');
            const isChecked = checkboxCol ? Boolean(row.cells[checkboxCol.id]) : false;

            return (
              <div
                key={row.id}
                className="rounded-xl bg-surface border border-line p-3 flex items-center justify-between gap-3 hover:border-line-strong transition"
              >
                <div className="flex items-center gap-2.5 min-w-0 flex-1">
                  {checkboxCol && (
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={e => handleCellChange(row.id, checkboxCol.id, e.target.checked)}
                      className="size-4 rounded accent-accent cursor-pointer"
                    />
                  )}
                  <span className={`text-xs font-medium truncate ${isChecked ? 'line-through text-fg-muted' : 'text-fg'}`}>
                    {row.cells[firstCol.id] || 'Untitled'}
                  </span>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {database.columns.slice(1).map(c => {
                    const v = row.cells[c.id];
                    if (v === undefined || v === null || v === '' || c.type === 'checkbox') return null;
                    return (
                      <span key={c.id} className="text-[11px] px-2 py-0.5 rounded-md bg-surface-2 border border-line text-fg-muted">
                        {String(v)}
                      </span>
                    );
                  })}
                  <button
                    type="button"
                    onClick={() => handleDeleteRow(row.id)}
                    className="p-1 text-fg-subtle hover:text-red-500 rounded transition"
                  >
                    <Trash2 size={13} />
                  </button>
                </div>
              </div>
            );
          })}

          <button
            type="button"
            onClick={() => handleAddRow()}
            className="w-full py-2 rounded-xl border border-dashed border-line text-xs font-medium text-fg-muted hover:text-fg hover:border-line-strong flex items-center justify-center gap-1 transition"
          >
            <Plus size={13} /> Add item to list
          </button>
        </div>
      )}

      {/* Add Column Modal */}
      {addColumnModalOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs grid place-items-center p-4"
          onMouseDown={() => setAddColumnModalOpen(false)}
        >
          <div
            className="w-full max-w-sm rounded-2xl bg-surface border border-line shadow-2xl p-5 space-y-4"
            onMouseDown={e => e.stopPropagation()}
          >
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-fg">Add New Column</h3>
              <button
                type="button"
                onClick={() => setAddColumnModalOpen(false)}
                className="text-fg-muted hover:text-fg"
              >
                <X size={16} />
              </button>
            </div>

            <div className="space-y-3 text-xs">
              <div>
                <label className="block text-fg-muted mb-1">Column Name</label>
                <input
                  type="text"
                  autoFocus
                  value={newColName}
                  onChange={e => setNewColName(e.target.value)}
                  placeholder="e.g. Priority, Due Date, Owner"
                  className="w-full h-8 px-2.5 rounded-lg bg-surface-2 border border-line outline-none focus:border-accent text-fg"
                />
              </div>

              <div>
                <label className="block text-fg-muted mb-1">Column Type</label>
                <div className="grid grid-cols-2 gap-1.5">
                  {(['text', 'number', 'select', 'date', 'checkbox'] as DatabaseColumnType[]).map(t => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setNewColType(t)}
                      className={`h-8 px-2 rounded-lg border text-left flex items-center gap-1.5 transition ${
                        newColType === t
                          ? 'bg-accent/10 border-accent text-accent font-semibold'
                          : 'bg-surface-2 border-line text-fg hover:bg-hover'
                      }`}
                    >
                      <ColumnTypeIcon type={t} />
                      <span className="capitalize">{t}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex justify-end gap-2 pt-2 border-t border-line">
              <button
                type="button"
                onClick={() => setAddColumnModalOpen(false)}
                className="h-8 px-3 rounded-xl border border-line text-xs font-medium text-fg-muted hover:text-fg"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={!newColName.trim()}
                onClick={handleAddColumn}
                className="h-8 px-4 rounded-xl bg-accent text-accent-fg text-xs font-semibold hover:bg-accent-hover disabled:opacity-40 keycap"
              >
                Add Column
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
