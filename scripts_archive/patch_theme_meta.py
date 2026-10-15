with open('src/App.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("document.documentElement.dataset.theme = theme;", "document.documentElement.dataset.theme = theme;\n    const meta = document.querySelector('meta[name=\"theme-color\"]');\n    if (meta) meta.setAttribute('content', theme === 'light' ? '#f5f2eb' : '#121214');")

with open('src/App.tsx', 'w', encoding='utf-8') as f:
    f.write(text)
