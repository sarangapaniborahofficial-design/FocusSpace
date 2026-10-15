with open('src/components/PageView.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# 1. Imports
text = text.replace("import { ArrowLeft, Check, Circle, Flame, ListChecks, Pencil, Plus, Sparkles, Trash2, X, CalendarDays } from 'lucide-react';", "import { ArrowLeft, Check, Circle, Flame, ListChecks, Pencil, Plus, Sparkles, Target, Trash2, X, CalendarDays } from 'lucide-react';")

# 2. Add `Target` to lucide-react if needed (already done)

# 3. Update RelatedSection state
text = text.replace("const [picking, setPicking] = useState<'task' | 'habit' | null>(null);", "const [picking, setPicking] = useState<'task' | 'habit' | 'goal' | null>(null);\n  const goalLinks = links.filter(l => l.kind === 'goal');")

# 4. Update picking buttons
text = text.replace("""<button onClick={() => setPicking(picking === 'habit' ? null : 'habit')} className="text-xs h-7 px-2.5 rounded-md text-zinc-500 hover:text-[var(--sidebar-active-text)] hover:bg-[var(--sidebar-active-bg)]">+ Habit</button>
          </div>""", """<button onClick={() => setPicking(picking === 'habit' ? null : 'habit')} className="text-xs h-7 px-2.5 rounded-md text-zinc-500 hover:text-[var(--sidebar-active-text)] hover:bg-[var(--sidebar-active-bg)]">+ Habit</button>
            <button onClick={() => setPicking(picking === 'goal' ? null : 'goal')} className="text-xs h-7 px-2.5 rounded-md text-zinc-500 hover:text-[var(--sidebar-active-text)] hover:bg-[var(--sidebar-active-bg)]">+ Goal</button>
          </div>""")

# 5. Update Goals slot
text = text.replace("""{/* Goals slot stays hidden until Goals exist (e.g. goalLinks.length > 0) */}
        {links.some(l => l.kind === 'goal') && <div className="space-y-1.5 text-sm text-zinc-400 italic">Goals will appear here once implemented</div>}""", """{goalLinks.length > 0 && <div className="space-y-1.5">{goalLinks.map(l => <LinkedGoalRow key={l.id} link={l} />)}</div>}""")

# 6. Update LinkPicker signature
text = text.replace("kind: 'task' | 'habit';", "kind: 'task' | 'habit' | 'goal';")

# 7. Update LinkPicker logic
text = text.replace("const habits = useLiveQuery(() => db.habits.toArray(), []) ?? [];", "const habits = useLiveQuery(() => db.habits.toArray(), []) ?? [];\n  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];")
text = text.replace("const label = (item: Task | Habit) => ('title' in item ? item.title : item.name);", "const label = (item: any) => item.title || item.name;")
text = text.replace("const items = (kind === 'task' ? (tasks as (Task | Habit)[]) : habits).filter(item => !existing.includes(item.id) && (!needle || label(item).toLowerCase().includes(needle)));", "const items = (kind === 'task' ? tasks : kind === 'habit' ? habits : goals).filter(item => !existing.includes(item.id) && (!needle || label(item).toLowerCase().includes(needle)));")

# 8. Add LinkedGoalRow
goal_row = """
function LinkedGoalRow({ link }: { link: PageLink }) {
  const goal = useLiveQuery(() => db.goals.get(link.targetId), [link.targetId]);
  if (goal === undefined) return null;
  if (!goal) return null;
  const pct = Math.min(100, Math.max(0, (goal.currentValue / goal.targetValue) * 100));
  return (
    <div className="group flex items-center gap-2 text-sm">
      <Target size={14} className="text-zinc-300 shrink-0" />
      <span className="min-w-0 truncate text-zinc-600 dark:text-zinc-300">{goal.title}</span>
      <span className="flex items-center gap-1 text-xs text-zinc-400 shrink-0 tabular-nums ml-1">
        {Math.round(pct)}%
      </span>
      <button onClick={() => void removeLink(link.id)} aria-label={`Unlink ${goal.title}`} className="ml-auto shrink-0 text-zinc-200 hover:text-zinc-500 opacity-0 group-hover:opacity-100"><X size={13} /></button>
    </div>
  );
}
"""
text += "\n" + goal_row

with open('src/components/PageView.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
