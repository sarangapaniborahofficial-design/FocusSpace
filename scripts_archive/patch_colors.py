import re

with open('src/index.css', 'r', encoding='utf-8') as f:
    css = f.read()

# Replace accent colors
css = css.replace('#d9f95d', '#ff5e00')

# Update selection color to white text
css = css.replace('::selection { background: #ff5e00; color: #111111; }', '::selection { background: #ff5e00; color: #ffffff; }')

# Update light theme root variables
light_root = """:root {
  --app-bg: #f5f2eb;
  --main-bg: #ffffff;
  --sidebar-bg: #141211;
  --sidebar-active-bg: #292422;
  --sidebar-active-text: #ffffff;

  /* Warm neutral light palette */
  --color-zinc-50: #fcfbf9;
  --color-zinc-100: #f5f2eb;
  --color-zinc-200: #e8e3dc;
  --color-zinc-300: #d6cfc5;
  --color-zinc-400: #afa699;
  --color-zinc-500: #887d6e;
  --color-zinc-600: #61574a;
  --color-zinc-700: #4a4136;
  --color-zinc-800: #332d26;
  --color-zinc-900: #1a1714;
  --color-zinc-950: #0f0d0a;
}"""

# Update dark theme variables
dark_theme = """[data-theme="dark"], [data-theme="oled"] {
  --app-bg: #000000;
  --main-bg: #0a0908;
  --sidebar-bg: #000000;
  --sidebar-active-bg: #1c1917;
  --sidebar-active-text: #ffffff;

  /* Cream/Black dark palette */
  --color-zinc-50: #0a0908;
  --color-zinc-100: #141211;
  --color-zinc-200: #292422;
  --color-zinc-300: #4a4136;
  --color-zinc-400: #786a5a;
  --color-zinc-500: #a39686;
  --color-zinc-600: #c9bfb3;
  --color-zinc-700: #e3deda;
  --color-zinc-800: #f2eee9;
  --color-zinc-900: #fdfcfb;
  --color-zinc-950: #ffffff;
  
  --color-white: #0a0908;
  --color-black: #ffffff;
}"""

css = re.sub(r':root\s*\{\s*--app-bg: #e8ebe9;.*?\n\}', light_root, css, flags=re.DOTALL)
css = re.sub(r'\[data-theme="dark"\], \[data-theme="oled"\]\s*\{.*?\n\}', dark_theme, css, flags=re.DOTALL)

with open('src/index.css', 'w', encoding='utf-8') as f:
    f.write(css)
