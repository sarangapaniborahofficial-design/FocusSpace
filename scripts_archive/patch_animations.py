with open('src/index.css', 'r', encoding='utf-8') as f:
    css = f.read()

animation_css = """
/* Premium Transitions */
@keyframes fade-in {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slide-up {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes scale-in {
  from { opacity: 0; transform: scale(0.98); }
  to { opacity: 1; transform: scale(1); }
}

.animate-fade-in { animation: fade-in 0.2s ease-out forwards; }
.animate-slide-up { animation: slide-up 0.3s cubic-bezier(0.16, 1, 0.3, 1) forwards; }
.animate-scale-in { animation: scale-in 0.25s cubic-bezier(0.16, 1, 0.3, 1) forwards; }

/* Apply to main page transitions */
.page-transition {
  animation: fade-in 0.25s ease-out forwards;
}
"""

with open('src/index.css', 'w', encoding='utf-8') as f:
    f.write(css + '\n' + animation_css)
