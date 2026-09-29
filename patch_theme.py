import re

with open('src/index.css', 'r') as f:
    css = f.read()

if '@theme' not in css:
    theme_block = """
@theme {
  --font-sans: "Quicksand", "Nunito", ui-rounded, system-ui, sans-serif;
  --radius-sm: 0.75rem;
  --radius-md: 1rem;
  --radius-lg: 1.5rem;
  --radius-xl: 2rem;
  --radius-2xl: 2.5rem;
  --radius-full: 9999px;
}
"""
    css = css.replace('@import "tailwindcss";', '@import "tailwindcss";\n' + theme_block)

css = css.replace('background: #09090b', 'background: #4c0519')
css = css.replace('color: #f4f4f5', 'color: #ffe4e6')
css = css.replace('background: #a1a1aa; color: #09090b', 'background: #fb7185; color: #fff1f2')
css = css.replace('background: #27272a', 'background: #9f1239')
css = css.replace('background: rgba(24,24,27,.72)', 'background: rgba(136, 19, 55, .72)')

css = css.replace('background:#f4f4f5; color:#18181b', 'background:#fffbf7; color:#4c0519')

css = css.replace('--fc-neutral-bg-color: #18181b', '--fc-neutral-bg-color: #881337')
css = css.replace('--fc-border-color: #27272a', '--fc-border-color: #9f1239')
css = css.replace('--fc-button-bg-color: #18181b', '--fc-button-bg-color: #881337')
css = css.replace('--fc-button-border-color: #27272a', '--fc-button-border-color: #9f1239')
css = css.replace('--fc-button-hover-bg-color: #27272a', '--fc-button-hover-bg-color: #9f1239')
css = css.replace('--fc-button-hover-border-color: #3f3f46', '--fc-button-hover-border-color: #be123c')
css = css.replace('--fc-button-active-bg-color: #3f3f46', '--fc-button-active-bg-color: #be123c')
css = css.replace('--fc-button-active-border-color: #52525b', '--fc-button-active-border-color: #e11d48')

css = re.sub(r'background-color: #ffffff !important', 'background-color: #fffbf7 !important', css)
css = re.sub(r'background-color: #fafafa !important', 'background-color: #fff1f2 !important', css)
css = re.sub(r'background-color: #f4f4f5 !important', 'background-color: #ffe4e6 !important', css)
css = re.sub(r'border-color: #e4e4e7 !important', 'border-color: #fecdd3 !important', css)
css = re.sub(r'color: #18181b !important', 'color: #4c0519 !important', css)
css = re.sub(r'color: #3f3f46 !important', 'color: #881337 !important', css)
css = re.sub(r'color: #71717a !important', 'color: #9f1239 !important', css)
css = re.sub(r'background-color: #ececee !important', 'background-color: #fecdd3 !important', css)
css = re.sub(r'border-color: #d4d4d8 !important', 'border-color: #fda4af !important', css)

css = css.replace('--fc-neutral-bg-color: #f4f4f5', '--fc-neutral-bg-color: #ffe4e6')
css = css.replace('--fc-button-bg-color: #ffffff', '--fc-button-bg-color: #fffbf7')
css = css.replace('--fc-button-border-color: #e4e4e7', '--fc-button-border-color: #fecdd3')
css = css.replace('--fc-button-hover-bg-color: #f4f4f5', '--fc-button-hover-bg-color: #ffe4e6')
css = css.replace('--fc-button-hover-border-color: #d4d4d8', '--fc-button-hover-border-color: #fda4af')
css = css.replace('--fc-button-active-bg-color: #e4e4e7', '--fc-button-active-bg-color: #fecdd3')
css = css.replace('--fc-button-active-border-color: #d4d4d8', '--fc-button-active-border-color: #fda4af')

with open('src/index.css', 'w') as f:
    f.write(css)

print("Done patching index.css")
