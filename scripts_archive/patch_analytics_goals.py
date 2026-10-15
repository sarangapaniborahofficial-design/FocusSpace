with open('src/components/Analytics.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

goals_component = """
function GoalsSection() {
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  if (goals.length === 0) return null;
  return (
    <section className="rounded-2xl border border-zinc-100 bg-zinc-50/40 overflow-hidden" aria-labelledby="active-goals-title">
      <div className="p-5 border-b border-zinc-100 flex items-center justify-between">
        <div>
          <h2 id="active-goals-title" className="font-medium flex items-center gap-2"><Target size={15} /> Long-Term Goals</h2>
          <p className="text-xs text-zinc-600 mt-1">Track larger milestones</p>
        </div>
      </div>
      <div className="p-5 space-y-4">
        {goals.map(g => {
          const pct = Math.min(100, Math.max(0, (g.currentValue / g.targetValue) * 100));
          return (
            <div key={g.id}>
              <div className="flex justify-between items-end mb-1.5">
                <span className="text-sm font-medium text-zinc-800 dark:text-zinc-200">{g.title}</span>
                <span className="text-xs text-zinc-500 tabular-nums">{g.currentValue} / {g.targetValue} {g.metricLabel}</span>
              </div>
              <div className="h-1.5 rounded-full bg-[var(--ring-track)] overflow-hidden">
                <div className="h-full rounded-full bg-[var(--accent)]" style={{ width: `${pct}%` }} />
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
"""

text = text.replace("{/* Weekly goals */}", "<GoalsSection />\n\n            {/* Weekly goals */}")
text += "\n" + goals_component

with open('src/components/Analytics.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
