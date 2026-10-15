with open('src/components/Today.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

target = '<div className="text-2xl font-semibold tabular-nums">{plan.done.length}<span className="text-zinc-200">/{openCount + plan.done.length}</span></div>'
repl = '{openCount + plan.done.length > 0 ? <div className="text-2xl font-semibold tabular-nums">{plan.done.length}<span className="text-zinc-400">/{openCount + plan.done.length}</span></div> : <div className="text-2xl font-semibold text-zinc-300">-</div>}'

text = text.replace(target, repl)

with open('src/components/Today.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
