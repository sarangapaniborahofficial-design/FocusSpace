import os
import re

def invert_zinc(match):
    color = match.group(0)
    # Mapping dark zinc to light zinc
    mapping = {
        'zinc-950': 'white', # the main background is white/f4f5f7 now
        'zinc-900': 'zinc-50',
        'zinc-800': 'zinc-100',
        'zinc-700': 'zinc-200',
        'zinc-600': 'zinc-300',
        'zinc-500': 'zinc-400',
        'zinc-400': 'zinc-500',
        'zinc-300': 'zinc-600',
        'zinc-200': 'zinc-700',
        'zinc-100': 'zinc-900',
        'zinc-50': 'zinc-950',
    }
    return mapping.get(color, color)

for root, _, files in os.walk('src/components'):
    for file in files:
        if file.endswith('.tsx') and file != 'Sidebar.tsx':
            filepath = os.path.join(root, file)
            with open(filepath, 'r', encoding='utf-8') as f:
                content = f.read()
            
            # Invert zinc colors
            new_content = re.sub(r'zinc-\d+', invert_zinc, content)
            
            with open(filepath, 'w', encoding='utf-8') as f:
                f.write(new_content)

print("Inverted zinc colors in components (except Sidebar).")
