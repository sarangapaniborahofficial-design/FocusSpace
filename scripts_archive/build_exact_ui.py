import os

def update_file(path, replacements):
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    for old, new in replacements:
        text = text.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)

# 1. index.css
css_replacements = [
    ('--app-bg: #f2f4f2;', '--app-bg: #f7f8f9;\n  --card-bg: #ffffff;\n  --body-bg: linear-gradient(135deg, #d3e4d9 0%, #d3e4d9 50%, #f7dfce 50%, #f7dfce 100%);'),
    ('--sidebar-bg: #f2f4f2;', '--sidebar-bg: #f7f8f9;'),
    ('--sidebar-active-bg: #e2e8e4;', '--sidebar-active-bg: #cde0d2;'),
    ('--sidebar-active-text: #1a1c1b;', '--sidebar-active-text: #0f172a;'),
    ('--accent: #799e85;', '--accent: #b6d2be;\n  --accent-peach: #facdba;\n  --text-primary: #1e293b;\n  --text-muted: #64748b;'),
    ('--ring-track: #799e85;', '--ring-track: #facdba;'),
    
    ('--app-bg: #121413;', '--app-bg: #121214;\n  --card-bg: #1e1e20;\n  --body-bg: #000000;'),
    ('--sidebar-bg: #121413;', '--sidebar-bg: #121214;'),
    ('--sidebar-active-bg: #202024;', '--sidebar-active-bg: rgba(182, 210, 190, 0.15);'),
    ('--sidebar-active-text: #f4f4f5;', '--sidebar-active-text: #b6d2be;'),
    
    ('body { margin: 0; min-width: 320px; background: var(--app-bg); color: var(--color-zinc-950); }', 'body { margin: 0; min-width: 320px; background: var(--body-bg); color: var(--color-zinc-900); }'),
    ('background: #799e85 !important;', 'background: #b6d2be !important;'),
    ('background-color: #799e85 !important;', 'background-color: #b6d2be !important;'),
    
    ('[data-theme="dark"], [data-theme="oled"] {', '[data-theme="dark"], [data-theme="oled"] {\n  color: #f4f4f5;')
]
update_file('src/index.css', css_replacements)

# 2. App.tsx
app_replacements = [
    ('<div className="h-screen overflow-hidden bg-[var(--app-bg)] text-zinc-900 flex p-4 gap-4">', '<div className="h-screen overflow-hidden flex items-center justify-center p-2 sm:p-6">\n      <div className="w-full h-full max-w-[1440px] mx-auto bg-[var(--app-bg)] text-zinc-900 dark:text-zinc-100 rounded-[32px] shadow-2xl flex overflow-hidden border border-black/5 dark:border-white/5 relative">'),
    ('<main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-transparent">', '<main className="flex-1 min-w-0 flex flex-col overflow-hidden bg-transparent p-2 sm:p-6">'),
    ('</ErrorBoundary>\n            </div>\n          </div>\n        </main>\n      </div>', '</ErrorBoundary>\n            </div>\n          </div>\n        </main>\n      </div>\n    </div>')
]
update_file('src/App.tsx', app_replacements)

# 3. Sidebar.tsx
sidebar_replacements = [
    ('className={`bg-white dark:bg-zinc-900 shadow-sm border border-black/5 dark:border-white/5 md:rounded-3xl text-zinc-600 dark:text-zinc-300 flex flex-col h-full transition-all duration-300 relative overflow-hidden py-3', 'className={`bg-[var(--sidebar-bg)] border-r border-zinc-200/60 dark:border-zinc-800/60 text-zinc-600 dark:text-zinc-300 flex flex-col h-full transition-all duration-300 relative overflow-hidden py-4'),
    ('w-[250px]', 'w-[260px]'),
    ('px-4 border-b border-zinc-200 dark:border-zinc-800/80', 'px-6 pb-6 mb-2'),
    ('size-9 rounded-xl bg-zinc-100 text-zinc-950 grid place-items-center shadow-lg shadow-white/5', 'size-8 rounded-lg bg-[var(--accent)] text-zinc-900 grid place-items-center'),
    ('text-[10px] uppercase tracking-[.18em] text-zinc-600 px-2 mb-2', 'text-xs font-medium text-zinc-400 dark:text-zinc-500 px-4 mb-2 mt-4'),
    ('w-full h-8 rounded-xl flex items-center gap-3 px-3 mb-1 text-sm transition', 'w-full h-9 rounded-xl flex items-center gap-3 px-4 mb-1 text-[14px] font-medium transition'),
    ('text-zinc-500 hover:bg-black/5 dark:hover:bg-white/5 hover:text-zinc-800 dark:hover:text-zinc-200', 'text-zinc-500 dark:text-zinc-400 hover:bg-black/5 dark:hover:bg-white/5 hover:text-zinc-800 dark:hover:text-zinc-200'),
    ('p-3 border-t border-zinc-200 dark:border-zinc-800/80', 'p-4 border-t border-zinc-200/60 dark:border-zinc-800/60 mt-auto'),
    ('my-5 border-t border-zinc-200 dark:border-zinc-800', '')
]
update_file('src/components/Sidebar.tsx', sidebar_replacements)

# 4. Header.tsx
header_replacements = [
    ('bg-transparent mb-2', 'bg-transparent mb-4'),
    ('h-14', 'h-12'),
    ('text-xl font-semibold', 'text-lg font-semibold'),
]
update_file('src/components/Header.tsx', header_replacements)

# 5. Cards & General Components
card_classes_old = 'rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-zinc-900 shadow-sm'
card_classes_new = 'rounded-2xl border border-zinc-200/60 dark:border-zinc-800/60 bg-[var(--card-bg)] shadow-sm'

files = [
    'src/components/Today.tsx',
    'src/components/Analytics.tsx',
    'src/components/Settings.tsx',
    'src/components/PageView.tsx',
    'src/components/Calendar.tsx',
    'src/components/TaskManager.tsx'
]

for filepath in files:
    if os.path.exists(filepath):
        with open(filepath, 'r', encoding='utf-8') as f:
            text = f.read()
        
        text = text.replace(card_classes_old, card_classes_new)
        text = text.replace('text-zinc-800', 'text-zinc-800 dark:text-zinc-200')
        text = text.replace('text-zinc-900', 'text-zinc-900 dark:text-zinc-100')
        text = text.replace('text-zinc-600', 'text-zinc-600 dark:text-zinc-400')
        text = text.replace('text-zinc-500', 'text-zinc-500 dark:text-zinc-400')
        text = text.replace('bg-zinc-50 dark:bg-zinc-800', 'bg-zinc-50 dark:bg-zinc-900/50')
        text = text.replace('border-zinc-100', 'border-zinc-200/60 dark:border-zinc-800/60')
        text = text.replace('bg-zinc-50/40', 'bg-[var(--card-bg)]')
        
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(text)

