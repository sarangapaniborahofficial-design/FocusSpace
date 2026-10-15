import os

def update_file(path, old, new):
    if not os.path.exists(path):
        return
    with open(path, 'r', encoding='utf-8') as f:
        text = f.read()
    text = text.replace(old, new)
    with open(path, 'w', encoding='utf-8') as f:
        f.write(text)

# 1. index.css (Darker Green + Remove OLED)
# Light Mode Accent
update_file('src/index.css', '--c-accent: #a8c9b0;', '--c-accent: #7ea38b;')
update_file('src/index.css', '--c-accent-hover: #98bea2;', '--c-accent-hover: #70937c;')

# Dark Mode Accent
update_file('src/index.css', '--c-accent: #b6d2be;', '--c-accent: #86b497;')
update_file('src/index.css', '--c-accent-hover: #c7e0ce;', '--c-accent-hover: #79a68a;')

# Remove OLED
update_file('src/index.css', '[data-theme=oled]', '[data-theme=dark]') # Just duplicate dark logic
update_file('src/index.css', ':root[data-theme="dark"], :root[data-theme="oled"]', ':root[data-theme="dark"]')
update_file('src/index.css', '/* OLED: same roles, true-black base */\n:root[data-theme="oled"] {\n  --c-canvas: #000000;\n  --c-surface: #0a0a0a;\n  --c-surface-2: #141414;\n  --c-surface-3: #1f1f1f;\n  --c-hover: #141414;\n  --c-line: #1f1f1f;\n  --c-line-strong: #292929;\n}', '')
# Ensure dark mode is pitch black body but slightly elevated cards
update_file('src/index.css', '--c-canvas: #111318;', '--c-canvas: #000000;')
update_file('src/index.css', '--c-surface: #181a20;', '--c-surface: #0e1013;')


# 2. App.tsx
update_file('src/App.tsx', "const THEMES = ['dark', 'oled', 'light'];", "const THEMES = ['light', 'dark'];")
update_file('src/App.tsx', "theme === 'light' ? '#f2f4f6' : theme === 'oled' ? '#000000' : '#0e1013'", "theme === 'light' ? '#f2f4f6' : '#000000'")

# 3. types.ts
update_file('src/types.ts', "export type Theme = 'dark' | 'light' | 'oled';", "export type Theme = 'light' | 'dark';")

# 4. Sidebar.tsx
update_file('src/components/Sidebar.tsx', 'h-16 flex items-center px-6 pb-6 mb-2', 'h-24 flex items-center pl-8 pr-6 pt-8 pb-4 mb-2')

# 5. Header.tsx
update_file('src/components/Header.tsx', "const THEME_LABEL: Record<string, string> = { dark: 'Dark', oled: 'OLED black', light: 'Light' };", "const THEME_LABEL: Record<string, string> = { dark: 'Dark', light: 'Light' };")
update_file('src/components/Header.tsx', "const next = theme === 'dark' ? 'oled' : theme === 'oled' ? 'light' : 'dark';", "const next = theme === 'dark' ? 'light' : 'dark';")
update_file('src/components/Header.tsx', "<Moon size={16} fill={theme === 'oled' ? 'currentColor' : 'none'} />", "<Moon size={16} fill={theme === 'dark' ? 'currentColor' : 'none'} />")

# 6. Settings.tsx
with open('src/components/Settings.tsx', 'r', encoding='utf-8') as f:
    settings = f.read()
import re
# Remove the object `{ id: 'oled', name: 'OLED Black', description: 'Pure black for low-light setups' },`
settings = re.sub(r"\{\s*id:\s*'oled'[^}]+\},?\s*", "", settings)
with open('src/components/Settings.tsx', 'w', encoding='utf-8') as f:
    f.write(settings)
