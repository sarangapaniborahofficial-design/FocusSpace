with open('src/components/Today.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

goals_component = """
function GoalsSection() {
  const goals = useLiveQuery(() => db.goals.toArray(), []) ?? [];
  if (goals.length === 0) return null;
  return (
    <section className="rounded-2xl border border-zinc-100 bg-zinc-50/40 p-5">
      <div className="flex items-center gap-2 font-medium mb-4"><Target size={16} /> Active Goals</div>
      <div className="space-y-4">
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

text = text.replace("</section>\n          </div>\n          <Pomodoro />", "</section>\n            <GoalsSection />\n          </div>\n          <Pomodoro />")
text += "\n" + goals_component

with open('src/components/Today.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
