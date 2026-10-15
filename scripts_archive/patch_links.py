with open('src/index.css', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace('.rt-prose p code { background: #18181b; }', '.rt-prose p code { background: #18181b; }\n[data-theme="dark"] .rt-prose a, [data-theme="oled"] .rt-prose a { color: #38bdf8; }')

with open('src/index.css', 'w', encoding='utf-8') as f:
    f.write(text)
