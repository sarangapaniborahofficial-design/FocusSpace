with open('src/components/Pomodoro.tsx', 'r', encoding='utf-8') as f:
    text = f.read()

text = text.replace("s.state === 'running' ? timer.pause() : timer.start()", "timer.toggle()")
text = text.replace("s.state === 'running'", "s.running")
text = text.replace("{s.sessionCount}", "{s.cycle}")

with open('src/components/Pomodoro.tsx', 'w', encoding='utf-8') as f:
    f.write(text)

with open('src/components/Today.tsx', 'r', encoding='utf-8') as f:
    today = f.read()

import_idx = today.find("import { buildTodayPlan } from '../lib/todayPlan';")
if import_idx != -1:
    today = today.replace("import { buildTodayPlan } from '../lib/todayPlan';", "import { buildTodayPlan } from '../lib/todayPlan';\nimport { focusOnTask } from '../lib/timer';")

today = today.replace("<TaskCard key={t.id} task={t} />", "<TaskCard key={t.id} task={t} onUpdate={u => db.tasks.put(u)} onDelete={() => db.tasks.delete(t.id)} onStart={() => focusOnTask(t)} />")

with open('src/components/Today.tsx', 'w', encoding='utf-8') as f:
    f.write(today)
