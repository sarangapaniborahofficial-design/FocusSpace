import re

with open('src/App.tsx', 'r') as f:
    app_tsx = f.read()

app_tsx = app_tsx.replace(
    'className="h-screen overflow-hidden bg-zinc-950 text-zinc-100 flex"',
    'className="h-screen overflow-hidden bg-[#e8ebe9] text-zinc-900 flex p-3 gap-3"'
)
app_tsx = app_tsx.replace(
    'className="flex-1 min-w-0 flex flex-col overflow-hidden"',
    'className="flex-1 min-w-0 flex flex-col overflow-hidden bg-[#f4f5f7] rounded-3xl shadow-sm border border-zinc-200/50"'
)
app_tsx = app_tsx.replace(
    'className="flex-1 overflow-y-auto grid-fade pb-20"',
    'className="flex-1 overflow-y-auto pb-20"'
)

with open('src/App.tsx', 'w') as f:
    f.write(app_tsx)


with open('src/components/Sidebar.tsx', 'r') as f:
    sidebar_tsx = f.read()

sidebar_tsx = sidebar_tsx.replace(
    'shrink-0 border-r border-zinc-800/80 bg-zinc-950 md:bg-zinc-950/95',
    'shrink-0 bg-[#111111] md:rounded-3xl border border-zinc-800 text-zinc-300'
)
sidebar_tsx = sidebar_tsx.replace(
    "active ? 'bg-zinc-100 text-zinc-950'",
    "active ? 'bg-[#333333] text-white'" # The image has dark pills for active nav
)

with open('src/components/Sidebar.tsx', 'w') as f:
    f.write(sidebar_tsx)

print("Updated React components.")
