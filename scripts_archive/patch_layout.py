import os
import glob

# Step 1: Sidebar modifications
sidebar_path = 'src/components/Sidebar.tsx'
with open(sidebar_path, 'r', encoding='utf-8') as f:
    sb = f.read()

# Sidebar Widths
sb = sb.replace('w-[260px]', 'w-[240px]')
sb = sb.replace('md:w-[250px]', 'md:w-[240px]')
sb = sb.replace('md:w-[76px]', 'md:w-[52px]')

# NavItem height and radius
sb = sb.replace('w-full h-10 rounded-lg flex', 'w-full h-8 rounded-md flex')

with open(sidebar_path, 'w', encoding='utf-8') as f:
    f.write(sb)

# Step 2: Global Button & Input Density
for filepath in glob.glob('src/components/**/*.tsx', recursive=True):
    with open(filepath, 'r', encoding='utf-8') as f:
        content = f.read()
    
    original = content
    # Replace h-10 with h-8 for dense rows/inputs/buttons
    content = content.replace('h-10 px-4', 'h-8 px-3')
    content = content.replace('h-10 px-3', 'h-8 px-2')
    content = content.replace('h-10 px-5', 'h-8 px-3')
    
    # Replace h-9 with h-8
    content = content.replace('h-9 px-3', 'h-8 px-3')
    content = content.replace('h-9 px-4', 'h-8 px-3')
    
    # Border Radii
    content = content.replace('h-8 px-3 rounded-lg', 'h-8 px-3 rounded-md')
    content = content.replace('h-8 px-2 rounded-lg', 'h-8 px-2 rounded-md')
    content = content.replace('h-8 pl-3 pr-2 rounded-lg', 'h-8 pl-3 pr-2 rounded-md')
    
    if original != content:
        with open(filepath, 'w', encoding='utf-8') as f:
            f.write(content)
