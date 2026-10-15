with open('src/components/Settings.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("""<button onClick={() => deleteGoal(g.id)} className="text-zinc-300 hover:text-red-300 p-2 rounded-md hover:bg-zinc-50" title="Delete"><Trash2 size={15} /></button>""", """<div className="flex gap-1">
                  <button onClick={() => {
                    const nextStr = window.prompt(`Update progress for ${g.title} (current: ${g.currentValue}):`, String(g.currentValue));
                    if (nextStr === null) return;
                    const next = parseFloat(nextStr);
                    if (!isNaN(next)) {
                      db.goals.update(g.id, { currentValue: next, updatedAt: new Date().toISOString() });
                    }
                  }} className="text-xs text-zinc-400 hover:text-zinc-700 px-2 py-1.5 rounded-md hover:bg-zinc-100">Update</button>
                  <button onClick={() => deleteGoal(g.id)} className="text-zinc-300 hover:text-red-300 p-2 rounded-md hover:bg-zinc-50" title="Delete"><Trash2 size={15} /></button>
                </div>""")

with open('src/components/Settings.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
