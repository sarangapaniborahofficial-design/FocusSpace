import re

with open('src/index.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Update Theme Fonts
css = css.replace('--font-sans: "Plus Jakarta Sans", system-ui, sans-serif;', '--font-sans: "Geist", system-ui, sans-serif;\n  --font-mono: "JetBrains Mono", monospace;')
css = css.replace('font-family: "Plus Jakarta Sans", system-ui, sans-serif;', 'font-family: "Geist", system-ui, sans-serif;')
css = css.replace('/* Clean Calendar overrides for native light theme */', '/* Fonts */\n.font-mono { font-family: "JetBrains Mono", monospace; font-feature-settings: "tnum" 1; }\n\n/* Clean Calendar overrides for native light theme */')

# Update Accents to Amber
css = css.replace('#ff5e00', '#f59e0b')
css = css.replace('color: #ffffff;', 'color: #121214;') # For selection text

# Replace Dark Theme
dark_theme = """[data-theme="dark"], [data-theme="oled"] {
  --app-bg: #121214;
  --main-bg: #18181b;
  --sidebar-bg: #121214;
  --sidebar-active-bg: #202024;
  --sidebar-active-text: #f4f4f5;

  /* Warm Zinc & Stone Minimalist (Dark) */
  --color-zinc-50: #121214;
  --color-zinc-100: #18181b;
  --color-zinc-200: #202024;
  --color-zinc-300: #27272a;
  --color-zinc-400: #2e2e33;
  --color-zinc-500: #3f3f46;
  --color-zinc-600: #71717a;
  --color-zinc-700: #a1a1aa;
  --color-zinc-800: #e4e4e7;
  --color-zinc-900: #f4f4f5;
  --color-zinc-950: #ffffff;
  
  --color-white: #121214;
  --color-black: #ffffff;
}"""

css = re.sub(r'\[data-theme="dark"\], \[data-theme="oled"\]\s*\{.*?\n\}', dark_theme, css, flags=re.DOTALL)

with open('src/index.css', 'w', encoding='utf-8') as f:
    f.write(css)
