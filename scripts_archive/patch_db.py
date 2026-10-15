with open('src/db/db.ts', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("import type { Category, FileBlob, FocusLog, Habit, JournalEntry, Page, PageFile, PageLink, Status, Task } from '../types';", "import type { Category, FileBlob, FocusLog, Goal, Habit, JournalEntry, Page, PageFile, PageLink, Status, Task } from '../types';")
text = text.replace('habits!: Table<Habit, string>;', 'habits!: Table<Habit, string>; goals!: Table<Goal, string>;')

v4_code = """
    // v4 adds Goals
    const v3_stores = { ...v2, pages: 'id, categoryId, updatedAt', journalEntries: 'id, pageId, date, [pageId+date]', pageLinks: 'id, pageId, targetId' };
    this.version(4).stores({ ...v3_stores, goals: 'id, categoryId, deadline' });
  }
"""

text = text.replace("this.on('populate', () => seedDatabase(this));\n  }", "this.on('populate', () => seedDatabase(this));\n" + v4_code)

with open('src/db/db.ts', 'w', encoding='utf-8') as f:
    f.write(text)
