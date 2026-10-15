import os
import glob
import re

mapping = {
    'text-zinc-950': 'text-zinc-950 dark:text-zinc-50',
    'text-zinc-900': 'text-zinc-900 dark:text-zinc-100',
    'text-zinc-800': 'text-zinc-800 dark:text-zinc-200',
    'text-zinc-700': 'text-zinc-700 dark:text-zinc-200',
    'text-zinc-600': 'text-zinc-600 dark:text-zinc-300',
    'text-zinc-500': 'text-zinc-500 dark:text-zinc-400',
    'text-zinc-400': 'text-zinc-400 dark:text-zinc-500',
    'text-zinc-300': 'text-zinc-300 dark:text-zinc-500',
    'text-zinc-200': 'text-zinc-200 dark:text-zinc-600',
    'bg-zinc-100': 'bg-zinc-100 dark:bg-zinc-800',
    'bg-zinc-50': 'bg-zinc-50 dark:bg-zinc-900/50',
    'hover:bg-zinc-100': 'hover:bg-zinc-100 dark:hover:bg-zinc-800',
    'hover:bg-zinc-50': 'hover:bg-zinc-50 dark:hover:bg-zinc-800/50',
    'border-zinc-100': 'border-zinc-200/60 dark:border-zinc-800/60',
    'border-zinc-200': 'border-zinc-200/60 dark:border-zinc-800/60',
}

def replace_classes(text):
    for old, new in mapping.items():
        # Only replace if not already followed by dark:
        pattern = r'\b' + re.escape(old) + r'(?!\s+dark:)'
        text = re.sub(pattern, new, text)
    return text

for fp in glob.glob('src/components/*.tsx'):
    with open(fp, 'r', encoding='utf-8') as f:
        content = f.read()
    content = replace_classes(content)
    with open(fp, 'w', encoding='utf-8') as f:
        f.write(content)
