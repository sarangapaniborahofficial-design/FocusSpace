import React, { useState, useMemo } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { db } from '../db/db';
import { changeStatus, rescheduleTasks } from '../lib/tasks';
import { openTaskEditor } from '../lib/taskEditor';
import { focusOnTask } from '../lib/timer';
import { toast } from '../lib/toast';
import { isoToday, formatDuration, relativeDay, uid } from '../lib/utils';
import { useDictation } from '../voice/useDictation';
import { Mic, Play, Check, AlertCircle, Plus, Calendar } from 'lucide-react';
import type { Task, Subtask } from '../types';

interface PlanInspectorProps {
  onNavigate?: (view: string) => void;
}

export function PlanInspector({ onNavigate }: PlanInspectorProps) {
  const today = isoToday();
  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const catMap = useMemo(() => new Map(categories.map(c => [c.id, c])), [categories]);

  const [activeTab, setActiveTab] = useState<'tasks' | 'history'>('tasks');
  const [filterText, setFilterText] = useState('');
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);

  // Commit / Completion inputs
  const [summary, setSummary] = useState('');
  const [description, setDescription] = useState('');

  // Subtask quick-add input
  const [newSubtaskTitle, setNewSubtaskTitle] = useState('');

  const openTasks = useMemo(() => {
    return tasks
      .filter(t => t.status !== 'Submitted/Done')
      .sort((a, b) => (a.dueDate || '9999').localeCompare(b.dueDate || '9999'));
  }, [tasks]);

  const historyTasks = useMemo(() => {
    return tasks
      .filter(t => t.status === 'Submitted/Done')
      .sort((a, b) => (b.completedAt || b.updatedAt || '').localeCompare(a.completedAt || a.updatedAt || ''));
  }, [tasks]);

  const displayedList = activeTab === 'tasks' ? openTasks : historyTasks;

  const filteredTasks = useMemo(() => {
    if (!filterText.trim()) return displayedList;
    const q = filterText.toLowerCase();
    return displayedList.filter(t => {
      const cat = catMap.get(t.categoryId)?.name.toLowerCase() || '';
      return (
        t.title.toLowerCase().includes(q) ||
        (t.projectTag && t.projectTag.toLowerCase().includes(q)) ||
        cat.includes(q)
      );
    });
  }, [displayedList, filterText, catMap]);

  // Selected task fallback: if none selected, select the first from the open list
  const selectedTask = useMemo(() => {
    if (selectedTaskId) {
      const found = tasks.find(t => t.id === selectedTaskId);
      if (found) return found;
    }
    return filteredTasks[0] || openTasks[0] || null;
  }, [selectedTaskId, tasks, filteredTasks, openTasks]);

  const selectedCat = selectedTask ? catMap.get(selectedTask.categoryId) : null;

  // Total planned time for open tasks due today or overdue
  const totalPlannedMinutes = useMemo(() => {
    return openTasks
      .filter(t => !t.dueDate || t.dueDate <= today)
      .reduce((acc, t) => acc + (t.estimatedDuration || 30), 0);
  }, [openTasks, today]);

  // Check if selected task is overdue
  const isOverdue = selectedTask?.dueDate && selectedTask.dueDate < today && selectedTask.status !== 'Submitted/Done';
  const overdueDays = useMemo(() => {
    if (!isOverdue || !selectedTask?.dueDate) return 0;
    const dueTime = new Date(selectedTask.dueDate).getTime();
    const todayTime = new Date(today).getTime();
    const diff = Math.round((todayTime - dueTime) / (1000 * 60 * 60 * 24));
    return Math.max(1, diff);
  }, [isOverdue, selectedTask, today]);

  // Subtask progress
  const subtasks = selectedTask?.subtasks || [];
  const completedSubtasksCount = subtasks.filter(s => s.completed).length;

  const handleToggleSubtask = async (subtaskId: string) => {
    if (!selectedTask) return;
    const updatedSubtasks = subtasks.map(s =>
      s.id === subtaskId ? { ...s, completed: !s.completed } : s
    );
    await db.tasks.update(selectedTask.id, {
      subtasks: updatedSubtasks,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleAddSubtask = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedTask || !newSubtaskTitle.trim()) return;
    const newSubtask: Subtask = {
      id: uid(),
      title: newSubtaskTitle.trim(),
      completed: false,
    };
    await db.tasks.update(selectedTask.id, {
      subtasks: [...subtasks, newSubtask],
      updatedAt: new Date().toISOString(),
    });
    setNewSubtaskTitle('');
  };

  const handleNotesChange = async (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    if (!selectedTask) return;
    const val = e.target.value;
    await db.tasks.update(selectedTask.id, {
      notes: val,
      updatedAt: new Date().toISOString(),
    });
  };

  const handleCompleteTask = async () => {
    if (!selectedTask) return;
    const updatedNotes = description.trim()
      ? `${selectedTask.notes || ''}\n\n[Completion Summary]: ${summary.trim() ? summary.trim() + ' — ' : ''}${description.trim()}`
      : summary.trim()
      ? `${selectedTask.notes || ''}\n\n[Completion Summary]: ${summary.trim()}`
      : selectedTask.notes;

    if (updatedNotes !== selectedTask.notes) {
      await db.tasks.update(selectedTask.id, { notes: updatedNotes });
    }

    await changeStatus(selectedTask, 'Submitted/Done');
    toast(`Completed "${selectedTask.title}" and logged to Today`, 'success');
    setSummary('');
    setDescription('');
  };

  const handleRescheduleToday = async () => {
    if (!selectedTask) return;
    await rescheduleTasks([selectedTask], today);
    toast(`Rescheduled "${selectedTask.title}" to today`, 'info');
  };

  const handleStartFocus = () => {
    if (!selectedTask) return;
    focusOnTask(selectedTask);
    toast(`Focus session loaded for "${selectedTask.title}"`, 'success');
  };

  const { isListening, toggle: toggleDictation } = useDictation();

  return (
    <div className="w-full h-full bg-[#0a0c0a] text-[#f2f4ef] flex flex-col overflow-hidden select-none font-['Space_Grotesk',sans-serif]">
      {/* Top 60px GitHub Desktop-style Context Header */}
      <div className="h-[60px] shrink-0 grid grid-cols-[280px_300px_1fr] border-b border-[#2a302a] bg-[#111411]">
        <div className="px-4 py-2.5 border-r border-[#2a302a] flex flex-col justify-center min-w-0">
          <div className="text-[11px] text-[#7f877c] uppercase tracking-wider font-medium">Current space</div>
          <div className="font-bold text-sm text-[#f2f4ef] truncate flex items-center gap-2">
            {selectedCat && (
              <span className="size-2 rounded-full shrink-0" style={{ backgroundColor: selectedCat.color }} />
            )}
            <span className="truncate">{selectedCat ? selectedCat.name : 'All Workspaces'}</span>
          </div>
        </div>

        <div className="px-4 py-2.5 border-r border-[#2a302a] flex flex-col justify-center min-w-0">
          <div className="text-[11px] text-[#7f877c] uppercase tracking-wider font-medium">Current task</div>
          <div className="font-bold text-sm text-[#f2f4ef] truncate">
            {selectedTask ? selectedTask.title : 'No task selected'}
          </div>
        </div>

        <div className="px-4 py-2.5 flex items-center justify-between min-w-0">
          <div className="flex flex-col justify-center">
            <div className="text-[11px] text-[#7f877c] uppercase tracking-wider font-medium">Plan</div>
            <div className="font-bold text-sm text-[#f2f4ef]">
              Time-block today · <span className="font-mono text-[#c8ff29]">{formatDuration(totalPlannedMinutes)}</span>
            </div>
          </div>
          {selectedTask && selectedTask.status !== 'Submitted/Done' && (
            <button
              onClick={handleStartFocus}
              className="h-8 px-3 rounded-lg bg-[#c8ff29] text-[#0a0c0a] font-bold text-xs flex items-center gap-1.5 hover:bg-[#b8ef1d] cursor-pointer transition shadow-xs"
            >
              <Play size={13} fill="currentColor" />
              <span>Start focus</span>
            </button>
          )}
        </div>
      </div>

      {/* Main 2-Column Split: 340px Left Task Explorer / Commit Box & Right Inspector */}
      <div className="flex-1 min-h-0 grid grid-cols-[340px_1fr] overflow-hidden">
        {/* Left Column: Explorer & Commit Box */}
        <div className="border-r border-[#2a302a] flex flex-col bg-[#111411] min-h-0 overflow-hidden">
          {/* Tabs: Tasks / History */}
          <div className="flex border-b border-[#2a302a] text-sm shrink-0">
            <button
              onClick={() => setActiveTab('tasks')}
              className={`flex-1 py-3 text-center cursor-pointer transition font-medium flex items-center justify-center gap-2 ${
                activeTab === 'tasks'
                  ? 'border-b-2 border-[#c8ff29] text-[#f2f4ef] font-bold'
                  : 'text-[#a3aaa0] hover:text-[#f2f4ef]'
              }`}
            >
              <span>Tasks</span>
              <span className="font-mono text-[11px] bg-[#2a302a] text-[#f2f4ef] rounded-full px-2 py-0.5">
                {openTasks.length}
              </span>
            </button>
            <button
              onClick={() => setActiveTab('history')}
              className={`flex-1 py-3 text-center cursor-pointer transition font-medium flex items-center justify-center gap-2 ${
                activeTab === 'history'
                  ? 'border-b-2 border-[#c8ff29] text-[#f2f4ef] font-bold'
                  : 'text-[#a3aaa0] hover:text-[#f2f4ef]'
              }`}
            >
              <span>History</span>
              <span className="font-mono text-[11px] bg-[#2a302a] text-[#a3aaa0] rounded-full px-2 py-0.5">
                {historyTasks.length}
              </span>
            </button>
          </div>

          {/* Filter Input */}
          <div className="p-2.5 shrink-0">
            <input
              type="text"
              value={filterText}
              onChange={e => setFilterText(e.target.value)}
              placeholder="Filter tasks (@tag, title)..."
              className="w-full bg-[#1d221d] border border-[#2a302a] rounded-lg px-3 py-1.5 text-xs text-[#f2f4ef] placeholder-[#7f877c] outline-none focus:border-[#c8ff29]/60 transition"
            />
          </div>

          <div className="px-3.5 pb-1 text-xs text-[#a3aaa0] font-mono shrink-0">
            {filteredTasks.length} {activeTab === 'tasks' ? 'open' : 'completed'} tasks
          </div>

          {/* Task List */}
          <div className="flex-1 overflow-y-auto px-2 py-1 space-y-1">
            {filteredTasks.length === 0 ? (
              <div className="text-center py-8 text-xs text-[#7f877c]">
                {filterText ? 'No matching tasks' : 'No tasks in this view'}
              </div>
            ) : (
              filteredTasks.map(t => {
                const isSelected = selectedTask?.id === t.id;
                const cat = catMap.get(t.categoryId);
                const isDone = t.status === 'Submitted/Done';

                return (
                  <div
                    key={t.id}
                    onClick={() => setSelectedTaskId(t.id)}
                    className={`flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm cursor-pointer transition ${
                      isSelected
                        ? 'bg-[#1d221d] text-[#f2f4ef] font-medium shadow-xs'
                        : 'text-[#a3aaa0] hover:bg-[#161a16] hover:text-[#f2f4ef]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={async e => {
                        e.stopPropagation();
                        await changeStatus(t, isDone ? 'To Do' : 'Submitted/Done');
                      }}
                      className={`size-4 rounded border flex items-center justify-center shrink-0 transition ${
                        isDone
                          ? 'bg-[#c8ff29] border-[#c8ff29] text-[#0a0c0a]'
                          : 'border-[#7f877c] hover:border-[#f2f4ef]'
                      }`}
                    >
                      {isDone && <Check size={11} strokeWidth={3} />}
                    </button>

                    <span className={`flex-1 truncate ${isDone ? 'line-through text-[#7f877c]' : ''}`}>
                      {t.title}
                    </span>

                    {cat && (
                      <span
                        className="size-2 rounded-full shrink-0"
                        style={{ backgroundColor: cat.color }}
                        title={cat.name}
                      />
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* GitHub Desktop-Style Bottom Session Commit Box */}
          <div className="border-t border-[#2a302a] p-3 flex flex-col gap-2 bg-[#111411] shrink-0">
            <input
              type="text"
              value={summary}
              onChange={e => setSummary(e.target.value)}
              placeholder="Session summary (e.g. Completed initial layout)"
              className="w-full bg-[#0a0c0a] border border-[#2a302a] rounded-lg px-3 py-1.5 text-xs text-[#f2f4ef] placeholder-[#7f877c] outline-none focus:border-[#c8ff29]/60 transition"
            />
            <textarea
              value={description}
              onChange={e => setDescription(e.target.value)}
              placeholder="What got done? (Optional notes logged to journal)"
              rows={2}
              className="w-full bg-[#0a0c0a] border border-[#2a302a] rounded-lg px-3 py-1.5 text-xs text-[#f2f4ef] placeholder-[#7f877c] outline-none focus:border-[#c8ff29]/60 transition resize-none"
            />
            <button
              onClick={handleCompleteTask}
              disabled={!selectedTask || selectedTask.status === 'Submitted/Done'}
              className="w-full py-2 rounded-lg bg-[#c8ff29] hover:bg-[#b8ef1d] disabled:opacity-40 disabled:hover:bg-[#c8ff29] text-[#0a0c0a] font-bold text-xs cursor-pointer transition shadow-xs text-center"
            >
              Complete 1 task & log to Today
            </button>
          </div>
        </div>

        {/* Right Column: Inspector Details */}
        <div className="flex-1 min-h-0 flex flex-col overflow-y-auto bg-[#0a0c0a]">
          {selectedTask ? (
            <div>
              {/* Overdue Warning Banner */}
              {isOverdue && (
                <div className="bg-[#3a2f0b] text-[#f3d77a] text-xs px-6 py-2.5 flex items-center justify-between border-b border-[#5a4810]">
                  <div className="flex items-center gap-2">
                    <AlertCircle size={14} className="shrink-0" />
                    <span>
                      Overdue by {overdueDays} day{overdueDays > 1 ? 's' : ''} · was due{' '}
                      {relativeDay(selectedTask.dueDate)}
                    </span>
                  </div>
                  <button
                    onClick={handleRescheduleToday}
                    className="underline hover:text-white font-medium cursor-pointer transition"
                  >
                    Reschedule to Today
                  </button>
                </div>
              )}

              <div className="p-6 max-w-4xl space-y-6">
                {/* Breadcrumbs & Title */}
                <div>
                  <div className="font-mono text-xs text-[#7f877c] flex items-center gap-1.5">
                    <span>{selectedCat ? selectedCat.name : 'Workspace'}</span>
                    <span>/</span>
                    <span>#{selectedTask.projectTag || 'General'}</span>
                  </div>
                  <h1
                    onClick={() => openTaskEditor(selectedTask.id)}
                    title="Click to open full task editor"
                    className="text-2xl sm:text-3xl font-bold text-[#f2f4ef] mt-1.5 cursor-pointer hover:underline underline-offset-4"
                  >
                    {selectedTask.title}
                  </h1>
                </div>

                {/* Badges */}
                <div className="flex flex-wrap gap-2 text-xs">
                  <span
                    className={`px-3 py-1 rounded-full font-medium ${
                      selectedTask.priority === 'Urgent'
                        ? 'bg-rose-500/20 text-rose-300 border border-rose-500/30'
                        : selectedTask.priority === 'High'
                        ? 'bg-amber-500/20 text-amber-300 border border-amber-500/30'
                        : 'bg-[#1d221d] text-[#f2f4ef] border border-[#2a302a]'
                    }`}
                  >
                    {selectedTask.priority}
                  </span>

                  <span className="px-3 py-1 rounded-full bg-[#1d221d] text-[#f2f4ef] border border-[#2a302a] font-mono">
                    {selectedTask.estimatedDuration || 30}m
                  </span>

                  <span className="px-3 py-1 rounded-full bg-[#1d221d] text-[#f2f4ef] border border-[#2a302a]">
                    Subtasks {completedSubtasksCount}/{subtasks.length}
                  </span>

                  {selectedTask.dueDate && (
                    <span className="px-3 py-1 rounded-full bg-[#1d221d] text-[#a3aaa0] border border-[#2a302a] flex items-center gap-1">
                      <Calendar size={12} />
                      <span>{relativeDay(selectedTask.dueDate)}</span>
                    </span>
                  )}
                </div>

                {/* Subtasks Section with Diff-Style Green Background for Done */}
                <div>
                  <div className="text-[11px] font-mono uppercase tracking-wider text-[#7f877c] mb-2 font-medium">
                    Subtasks
                  </div>
                  <div className="border border-[#2a302a] rounded-lg overflow-hidden divide-y divide-[#2a302a] text-sm">
                    {subtasks.length === 0 ? (
                      <div className="p-3 text-xs text-[#7f877c] bg-[#111411]">No subtasks defined yet.</div>
                    ) : (
                      subtasks.map(s => (
                        <div
                          key={s.id}
                          onClick={() => handleToggleSubtask(s.id)}
                          className={`p-3 flex items-center gap-3 cursor-pointer transition ${
                            s.completed
                              ? 'bg-[#12301a] text-[#86efac] font-medium'
                              : 'bg-[#111411] text-[#a3aaa0] hover:text-[#f2f4ef]'
                          }`}
                        >
                          <span
                            className={`size-4 rounded border flex items-center justify-center shrink-0 ${
                              s.completed
                                ? 'bg-[#22c55e] border-[#22c55e] text-[#0a0c0a]'
                                : 'border-[#7f877c]'
                            }`}
                          >
                            {s.completed && <Check size={11} strokeWidth={3} />}
                          </span>
                          <span className={s.completed ? 'line-through opacity-90' : ''}>{s.title}</span>
                          {s.completed && (
                            <span className="text-[11px] font-mono text-[#4ade80] ml-auto">· done</span>
                          )}
                        </div>
                      ))
                    )}
                  </div>

                  {/* Add Subtask form */}
                  <form onSubmit={handleAddSubtask} className="mt-2 flex gap-2">
                    <input
                      type="text"
                      value={newSubtaskTitle}
                      onChange={e => setNewSubtaskTitle(e.target.value)}
                      placeholder="Add a subtask and press Enter..."
                      className="flex-1 bg-[#111411] border border-[#2a302a] rounded-lg px-3 py-1.5 text-xs text-[#f2f4ef] placeholder-[#7f877c] outline-none focus:border-[#c8ff29]/60 transition"
                    />
                    <button
                      type="submit"
                      disabled={!newSubtaskTitle.trim()}
                      className="px-3 py-1.5 rounded-lg bg-[#1d221d] hover:bg-[#2a302a] text-[#f2f4ef] text-xs font-medium cursor-pointer transition disabled:opacity-40"
                    >
                      <Plus size={14} />
                    </button>
                  </form>
                </div>

                {/* Notes Section with Live Auto-Save */}
                <div>
                  <div className="flex items-center justify-between mb-2">
                    <div className="text-[11px] font-mono uppercase tracking-wider text-[#7f877c] font-medium">
                      Notes
                    </div>
                    <button
                      onClick={toggleDictation}
                      className={`text-xs flex items-center gap-1 cursor-pointer transition ${
                        isListening ? 'text-rose-400 animate-pulse font-bold' : 'text-[#7f877c] hover:text-[#c8ff29]'
                      }`}
                    >
                      <Mic size={12} />
                      <span>{isListening ? 'Listening...' : 'Alt+V to dictate'}</span>
                    </button>
                  </div>
                  <textarea
                    value={selectedTask.notes || ''}
                    onChange={handleNotesChange}
                    placeholder="Start typing, or press Alt+V to dictate. Notes are auto-saved to this task."
                    rows={6}
                    className="w-full bg-[#111411] border border-[#2a302a] rounded-lg p-3.5 text-sm text-[#f2f4ef] placeholder-[#7f877c] outline-none focus:border-[#c8ff29]/60 transition resize-y font-sans leading-relaxed"
                  />
                </div>
              </div>
            </div>
          ) : (
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8 text-[#7f877c]">
              <div className="text-base font-semibold text-[#a3aaa0] mb-1">Select a task to inspect</div>
              <p className="text-xs max-w-sm">
                Choose a task from the list on the left to review its subtasks, notes, and session status.
              </p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
