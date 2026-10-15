import os
import glob

# 1. Update App.tsx
with open('src/App.tsx', 'r', encoding='utf-8') as f:
    app_ts = f.read()

app_ts = app_ts.replace('bg-[var(--app-bg)] text-zinc-900 flex p-3 gap-3', 'bg-[var(--app-bg)] text-zinc-900 flex p-4 gap-4')
app_ts = app_ts.replace('bg-[var(--main-bg)] rounded-3xl shadow-sm border border-zinc-200/50', 'bg-transparent')
with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(app_ts)

# 2. Update Sidebar.tsx
with open('src/components/Sidebar.tsx', 'r', encoding='utf-8') as f:
    sidebar = f.read()

sidebar = sidebar.replace('w-[240px]', 'w-[250px]')
sidebar = sidebar.replace('w-[52px]', 'w-[60px]')
# Add a white background to sidebar if it doesn't have one? No, keeping it transparent on the app-bg looks great, or make it a card itself!
# "flex flex-col h-full transition-all duration-300 relative"
sidebar = sidebar.replace('className={`flex flex-col h-full transition-all duration-300 relative', 'className={`bg-white dark:bg-zinc-900 rounded-3xl shadow-sm border border-black/5 dark:border-white/5 flex flex-col h-full transition-all duration-300 relative overflow-hidden py-3')
# Also need to make sure NavItems have nice rounded styles.
sidebar = sidebar.replace('rounded-md', 'rounded-xl')
with open('src/components/Sidebar.tsx', 'w', encoding='utf-8') as f:
    f.write(sidebar)

# 3. Update all cards across components to use Bento styles
card_classes = "rounded-3xl border border-black/5 dark:border-white/5 bg-white dark:bg-zinc-900 shadow-sm"

def replace_cards(filepath):
    with open(filepath, 'r', encoding='utf-8') as f:
        text = f.read()
    
    # Replace common section classes
    text = text.replace('rounded-2xl border border-zinc-100 bg-zinc-50/40', card_classes)
    text = text.replace('rounded-2xl border border-zinc-200 bg-zinc-50/60', card_classes)
    text = text.replace('rounded-xl border border-zinc-100 bg-white/40', 'rounded-2xl border border-black/5 dark:border-white/5 bg-zinc-50 dark:bg-zinc-800')
    text = text.replace('rounded-lg bg-zinc-900 text-white', 'rounded-xl bg-zinc-900 text-white')
    text = text.replace('rounded-md', 'rounded-xl')
    
    with open(filepath, 'w', encoding='utf-8') as f:
        f.write(text)

files_to_patch = [
    'src/components/Today.tsx',
    'src/components/Analytics.tsx',
    'src/components/Settings.tsx',
    'src/components/Pomodoro.tsx',
    'src/components/TaskManager.tsx',
    'src/components/Calendar.tsx',
    'src/components/PagesList.tsx',
    'src/components/PageView.tsx',
    'src/components/TaskCard.tsx',
    'src/components/TaskEditor.tsx',
    'src/components/CommandPalette.tsx',
    'src/components/Header.tsx',
]

for fp in files_to_patch:
    if os.path.exists(fp):
        replace_cards(fp)

# 4. Update index.css
with open('src/index.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Change Accent to Sage Green
css = css.replace('--accent: #f59e0b;', '--accent: #799e85;')
css = css.replace('--ring-track: #f59e0b;', '--ring-track: #799e85;')
css = css.replace('background: #f59e0b !important;', 'background: #799e85 !important;')
css = css.replace('background-color: #f59e0b !important;', 'background-color: #799e85 !important;')

# Change backgrounds
css = css.replace('--app-bg: #f5f2eb;', '--app-bg: #f2f4f2;')
css = css.replace('--sidebar-bg: #141211;', '--sidebar-bg: #f2f4f2;')

# Dark mode backgrounds
css = css.replace('--app-bg: #121214;', '--app-bg: #121413;')
css = css.replace('--sidebar-bg: #121214;', '--sidebar-bg: #121413;')

# Let's adjust header borders
# In Header.tsx, we can just let it sit on top without border.
with open('src/index.css', 'w', encoding='utf-8') as f:
    f.write(css)

# Fix Header.tsx specifically
with open('src/components/Header.tsx', 'r', encoding='utf-8') as f:
    hdr = f.read()
hdr = hdr.replace('border-b border-zinc-200/50 bg-white/50 backdrop-blur-md dark:bg-[#18181b]/50', 'bg-transparent mb-2')
with open('src/components/Header.tsx', 'w', encoding='utf-8') as f:
    f.write(hdr)
