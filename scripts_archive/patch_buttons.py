import glob
import os

files = glob.glob('src/components/**/*.tsx', recursive=True) + glob.glob('src/*.tsx')

for file in files:
    with open(file, 'r', encoding='utf-8') as f:
        content = f.read()
    
    # Primary Buttons
    content = content.replace('bg-zinc-900 text-white hover:bg-white', 'bg-[var(--accent)] text-[#121214] hover:bg-[#d97706]')
    content = content.replace('bg-zinc-900 text-white hover:bg-zinc-800', 'bg-[var(--accent)] text-[#121214] hover:bg-[#d97706]')
    content = content.replace('bg-zinc-900 text-white', 'bg-[var(--accent)] text-[#121214]')
    
    with open(file, 'w', encoding='utf-8') as f:
        f.write(content)
