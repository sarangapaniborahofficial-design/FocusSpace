import re

with open('../scratch_index.css', 'r') as f:
    css = f.read()

theme_block = """
@theme {
  --font-sans: "Plus Jakarta Sans", system-ui, sans-serif;
  --radius-sm: 1rem;
  --radius-md: 9999px; /* Pill buttons */
  --radius-lg: 1.5rem; /* Cards */
  --radius-xl: 2rem;
  --radius-2xl: 2.5rem;
}
"""
css = css.replace('@import "tailwindcss";', '@import "tailwindcss";\n' + theme_block)

# Remove all existing [data-theme="light"] overrides because we will rewrite them
css = re.sub(r'\[data-theme="light"\].*?\n', '', css)

new_light_theme = """
/* The Sage/Off-white App Background */
[data-theme="light"] body { background: #b1b8b2; color: #18181b; }
[data-theme="light"] #root > div.h-screen {
  background: #b1b8b2;
  padding: 1rem;
  gap: 1rem;
}

/* Sidebar */
[data-theme="light"] aside {
  background: #111111 !important;
  border-radius: 2rem;
  border: none !important;
  color: #ffffff;
  padding: 0.5rem;
}
/* Force sidebar text/icons to be light */
[data-theme="light"] aside .text-zinc-400 { color: #a1a1aa !important; }
[data-theme="light"] aside .text-zinc-500 { color: #71717a !important; }
[data-theme="light"] aside .text-zinc-600 { color: #52525b !important; }
[data-theme="light"] aside .hover\:text-zinc-200:hover { color: #f4f4f5 !important; }
[data-theme="light"] aside .hover\:bg-zinc-900:hover { background-color: #27272a !important; }
[data-theme="light"] aside .bg-zinc-100 { background-color: #333333 !important; color: #ffffff !important; } /* Active item */

/* Main Content Area */
[data-theme="light"] main {
  background: #f8f9fa; /* Very light gray/white */
  border-radius: 2.5rem;
  box-shadow: 0 10px 40px -10px rgba(0,0,0,0.15);
  margin: 0 !important;
  border: none;
}
[data-theme="light"] main .grid-fade { background-image: none; } /* Clean background */

/* Colors in Main Content */
[data-theme="light"] main .bg-zinc-900, 
[data-theme="light"] main .bg-zinc-950,
[data-theme="light"] main .bg-zinc-800 { background-color: #ffffff !important; box-shadow: 0 2px 10px rgba(0,0,0,0.03); }

[data-theme="light"] main .bg-zinc-900\/50,
[data-theme="light"] main .bg-zinc-900\/30 { background-color: rgba(255,255,255,0.8) !important; }

/* Primary Buttons (were white, now black like "+ Create a New Scenario") */
[data-theme="light"] main .bg-zinc-100 { background-color: #111111 !important; color: #ffffff !important; }
[data-theme="light"] main .hover\:bg-zinc-200:hover { background-color: #000000 !important; }

/* Text Colors */
[data-theme="light"] main .text-zinc-100 { color: #111111 !important; font-weight: 600; letter-spacing: -0.02em; }
[data-theme="light"] main .text-zinc-200 { color: #27272a !important; font-weight: 500;}
[data-theme="light"] main .text-zinc-300 { color: #3f3f46 !important; }
[data-theme="light"] main .text-zinc-400 { color: #52525b !important; }
[data-theme="light"] main .text-zinc-500 { color: #71717a !important; }

/* Borders */
[data-theme="light"] main .border-zinc-800,
[data-theme="light"] main .border-zinc-700,
[data-theme="light"] main .border-zinc-800\/80 { border-color: #e4e4e7 !important; }

/* Accent Color overrides (Lime Green #d9f95d) */
[data-theme="light"] .dot-on { background: #d9f95d !important; }
[data-theme="light"] .ring-zinc-100 { --tw-ring-color: #d9f95d !important; }
[data-theme="light"] input[type="checkbox"]:checked { background-color: #111111 !important; border-color: #111111 !important; }
[data-theme="light"] .bg-zinc-700 { background-color: #d9f95d !important; color: #111111 !important; } /* Used for some active badges */

/* Charts tokens */
[data-theme="light"] {
  --ring-fill: #111111;
  --ring-track: #d9f95d;
  --accent: #d9f95d;
  --grid: #e4e4e7;
  --ink-3: #a1a1aa;
  --focus-ring: #111111;
}

/* TipTap Editor adjustments for light mode */
[data-theme="light"] .rt-prose { color: #3f3f46; }
[data-theme="light"] .rt-prose strong { color: #111111; }
[data-theme="light"] .rt-prose pre { background: #f4f4f5 !important; border: 1px solid #e4e4e7; color: #111111; }
"""

css += "\n" + new_light_theme

with open('src/index.css', 'w') as f:
    f.write(css)

print("Done generating new index.css")
