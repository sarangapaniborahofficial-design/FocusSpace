with open('src/index.css', 'r', encoding='utf-8') as f:
    css = f.read()

dark_mode_css = """
:root {
  --app-bg: #e8ebe9;
  --main-bg: #ffffff;
  --sidebar-bg: #111111;
  --sidebar-active-bg: #333333;
  --sidebar-active-text: #ffffff;
}

[data-theme="dark"], [data-theme="oled"] {
  --app-bg: #09090b; /* Deep black root background */
  --main-bg: #18181b; /* zinc-900 equivalent main floating card */
  --sidebar-bg: #09090b; /* Keep sidebar black */
  --sidebar-active-bg: #27272a; /* zinc-800 equivalent */
  --sidebar-active-text: #ffffff;

  /* Invert the Zinc palette dynamically */
  --color-zinc-50: #18181b;  /* mapped to 900 */
  --color-zinc-100: #27272a; /* mapped to 800 */
  --color-zinc-200: #3f3f46; /* mapped to 700 */
  --color-zinc-300: #52525b; /* mapped to 600 */
  --color-zinc-400: #71717a; /* mapped to 500 */
  --color-zinc-500: #a1a1aa; /* mapped to 400 */
  --color-zinc-600: #d4d4d8; /* mapped to 300 */
  --color-zinc-700: #e4e4e7; /* mapped to 200 */
  --color-zinc-800: #f4f4f5; /* mapped to 100 */
  --color-zinc-900: #fafafa; /* mapped to 50 */
  --color-zinc-950: #ffffff; /* used for very bright text in dark mode */
  
  --color-white: #09090b; /* bg-white becomes dark surface */
  --color-black: #ffffff;
}

/* Calendar & Rich Text overrides for dark mode */
[data-theme="dark"] .calendar-shell .fc, [data-theme="oled"] .calendar-shell .fc {
  --fc-neutral-bg-color: #18181b;
  --fc-neutral-text-color: #71717a;
  --fc-border-color: #27272a;
  --fc-button-text-color: #d4d4d8;
  --fc-button-bg-color: #18181b;
  --fc-button-border-color: #27272a;
  --fc-button-hover-bg-color: #27272a;
  --fc-button-hover-border-color: #3f3f46;
  --fc-button-active-bg-color: #3f3f46;
  --fc-button-active-border-color: #52525b;
  --fc-event-bg-color: #d4d4d8;
  --fc-event-border-color: #d4d4d8;
  --fc-event-text-color: #09090b;
  --fc-today-bg-color: rgba(161, 161, 170, .06);
  --fc-now-indicator-color: #f4f4f5;
  color: #d4d4d8;
}

[data-theme="dark"] .rt-prose, [data-theme="oled"] .rt-prose { color: #d4d4d8; }
[data-theme="dark"] .rt-prose h2, [data-theme="dark"] .rt-prose h3, [data-theme="oled"] .rt-prose h2, [data-theme="oled"] .rt-prose h3 { color: #ffffff; }
[data-theme="dark"] .rt-prose strong, [data-theme="oled"] .rt-prose strong { color: #ffffff; }
[data-theme="dark"] .rt-prose pre, [data-theme="oled"] .rt-prose pre { background: #18181b !important; color: #d4d4d8; border-color: #27272a; }
[data-theme="dark"] .rt-prose p code, [data-theme="oled"] .rt-prose p code { background: #18181b; }
"""

with open('src/index.css', 'w', encoding='utf-8') as f:
    f.write(css + '\n' + dark_mode_css)

print("Appended dark mode CSS to index.css")
