with open('src/components/Settings.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

goal_code = """
import { Target } from 'lucide-react';
function GoalsCard() {
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  const [creating, setCreating] = useState(false);
  const [title, setTitle] = useState('');
  const [metricLabel, setMetricLabel] = useState('');
  const [targetValue, setTargetValue] = useState('10');
  const [deadline, setDeadline] = useState('');

  const create = async () => {
    if (!title.trim() || !metricLabel.trim()) return toast('Please fill in title and metric.', 'error');
    const target = parseFloat(targetValue);
    if (isNaN(target) || target <= 0) return toast('Target must be a positive number.', 'error');
    
    await db.goals.add({
      id: uid(),
      title: title.trim(),
      metricLabel: metricLabel.trim(),
      currentValue: 0,
      targetValue: target,
      deadline: deadline || undefined,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    });
    setCreating(false); setTitle(''); setMetricLabel(''); setTargetValue('10'); setDeadline('');
    toast('Goal created.', 'success');
  };

  const deleteGoal = async (id: string) => {
    await db.goals.delete(id);
    toast('Goal deleted.');
  };

  return (
    <section className="rounded-2xl border border-zinc-100 bg-zinc-50/40 overflow-hidden">
      <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
        <div>
          <div className="flex items-center gap-2 font-medium"><Target size={16}/> Goals</div>
          <p className="text-xs text-zinc-300 mt-1">Track larger milestones and measurable targets.</p>
        </div>
        <button onClick={() => setCreating(true)} className="h-8 px-3 rounded-md bg-[var(--accent)] text-[#121214] text-sm font-medium flex items-center gap-1.5 hover:bg-[#d97706]"><Plus size={15} /> Add goal</button>
      </div>
      <div className="p-4 space-y-2">
        {goals.length === 0 && !creating && <p className="text-sm text-zinc-300 px-1 py-2">No goals yet. Add a big milestone to track.</p>}
        {goals.map(g => {
          const pct = Math.min(100, Math.max(0, (g.currentValue / g.targetValue) * 100));
          return (
            <div key={g.id} className="rounded-xl border border-zinc-100 bg-white/40 p-4">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1 min-w-0">
                  <div className="font-medium text-sm truncate text-zinc-800 dark:text-zinc-200">{g.title}</div>
                  <div className="text-xs text-zinc-400 mt-0.5">{g.currentValue} / {g.targetValue} {g.metricLabel}{g.deadline ? ` · Target: ${g.deadline}` : ''}</div>
                </div>
                <button onClick={() => deleteGoal(g.id)} className="text-zinc-300 hover:text-red-300 p-2 rounded-md hover:bg-zinc-50" title="Delete"><Trash2 size={15} /></button>
              </div>
              <div className="mt-3 h-1.5 rounded-full bg-[var(--ring-track)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
        {creating && (
          <div className="rounded-xl border border-zinc-200 bg-white p-4 shadow-sm space-y-3">
            <div>
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest block mb-1">Goal title</label>
              <input autoFocus value={title} onChange={e => setTitle(e.target.value)} placeholder="e.g. Run a marathon" className="w-full h-8 rounded-md bg-zinc-50 border border-zinc-200 px-2 text-sm outline-none" />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest block mb-1">Target value</label>
                <input type="number" min="1" value={targetValue} onChange={e => setTargetValue(e.target.value)} className="w-full h-8 rounded-md bg-zinc-50 border border-zinc-200 px-2 text-sm outline-none" />
              </div>
              <div>
                <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest block mb-1">Metric label</label>
                <input value={metricLabel} onChange={e => setMetricLabel(e.target.value)} placeholder="e.g. km, books, $" className="w-full h-8 rounded-md bg-zinc-50 border border-zinc-200 px-2 text-sm outline-none" />
              </div>
            </div>
            <div>
              <label className="text-[11px] font-medium text-zinc-500 uppercase tracking-widest block mb-1">Deadline (Optional)</label>
              <input type="date" value={deadline} onChange={e => setDeadline(e.target.value)} className="w-full h-8 rounded-md bg-zinc-50 border border-zinc-200 px-2 text-sm outline-none text-zinc-600 dark:text-zinc-300" />
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button onClick={() => setCreating(false)} className="h-8 px-3 rounded-md text-sm text-zinc-500 hover:bg-zinc-50">Cancel</button>
              <button onClick={create} disabled={!title.trim() || !metricLabel.trim()} className="h-8 px-3 rounded-md bg-[var(--accent)] text-[#121214] text-sm font-medium hover:bg-[#d97706] disabled:opacity-40">Save goal</button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
"""

text = text.replace("import { Calendar, Check, Download, Flame, Keyboard, Palette, Pencil, Plus, RefreshCw, Smartphone, Trash2, Upload, X } from 'lucide-react';", "import { Calendar, Check, Download, Flame, Keyboard, Palette, Pencil, Plus, RefreshCw, Smartphone, Target, Trash2, Upload, X } from 'lucide-react';")
text = text.replace("<HabitsCard />", "<HabitsCard />\n      <GoalsCard />")
text += "\n" + goal_code

with open('src/components/Settings.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
