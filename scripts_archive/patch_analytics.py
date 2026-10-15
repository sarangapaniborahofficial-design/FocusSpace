with open('src/components/Analytics.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

# Fix the card constant
text = text.replace("const card = 'rounded-2xl border border-zinc-900 bg-zinc-950/40';", "const card = 'rounded-2xl border border-zinc-100 bg-zinc-50/40';")

# Fix the range toggle border
text = text.replace('className="flex h-9 rounded-lg border border-zinc-900 overflow-hidden"', 'className="flex h-9 rounded-lg border border-zinc-100 overflow-hidden"')

# Fix the range toggle buttons
text = text.replace("range === o.id ? 'bg-zinc-900 text-white' : 'text-zinc-500 hover:text-zinc-200'", "range === o.id ? 'bg-[var(--sidebar-active-bg)] text-[var(--sidebar-active-text)]' : 'text-zinc-500 hover:bg-white/5 hover:text-zinc-900 dark:hover:text-zinc-200'")

# Fix the select dropdown
text = text.replace('className="h-9 rounded-lg bg-zinc-950 border border-zinc-900 px-3 text-sm text-zinc-400 outline-none"', 'className="h-9 rounded-lg bg-zinc-50 border border-zinc-100 px-3 text-sm text-zinc-500 outline-none"')

# Fix the edit goals button hover
text = text.replace("hover:bg-zinc-900", "hover:bg-zinc-100")

# Fix the goals popup container
text = text.replace('className="pop-in grid grid-cols-2 gap-2 mb-4 rounded-xl border border-zinc-900 bg-white/60 p-3"', 'className="pop-in grid grid-cols-2 gap-2 mb-4 rounded-xl border border-zinc-100 bg-zinc-50/60 p-3"')

# Fix the inputs inside the popup
text = text.replace('className="mt-1 w-full h-9 rounded-lg bg-zinc-950 border border-zinc-900 px-2 text-sm text-zinc-200 outline-none"', 'className="mt-1 w-full h-9 rounded-lg bg-zinc-50 border border-zinc-100 px-2 text-sm outline-none"')

# Fix the StatBlock border
text = text.replace('className={`p-5 border-zinc-900 min-w-0 ${className}`}', 'className={`p-5 border-zinc-100 min-w-0 ${className}`}')

with open('src/components/Analytics.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
