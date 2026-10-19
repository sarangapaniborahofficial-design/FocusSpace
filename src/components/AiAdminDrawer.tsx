import React, { useState, useEffect, useRef } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Sparkles,
  X,
  Send,
  Zap,
  Trash2,
  Calendar,
  FileText,
  Clock,
  RotateCcw,
  CheckCircle2,
  AlertCircle,
  Cpu,
} from 'lucide-react';
import { db } from '../db/db';
import { checkLocalAiStatus } from '../lib/runtime';
import {
  processAiAdminQuery,
  executeAiAction,
  undoAiAction,
  type AiAdminAction,
  type AgentContext,
} from '../lib/localAiAgent';
import { toast } from '../lib/toast';
import { useDictation } from '../voice/useDictation';
import { createInputTarget } from '../voice/target/inputTarget';
import type { DictationTarget } from '../voice/target/DictationTarget';
import { MicButton } from '../voice/ui/MicButton';
import { DictationHud } from '../voice/ui/DictationHud';

interface ChatMessage {
  id: string;
  sender: 'user' | 'assistant';
  text: string;
  action?: AiAdminAction;
  timestamp: string;
}

export function AiAdminDrawer({
  isOpen,
  onClose,
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: 'welcome',
      sender: 'assistant',
      text: 'Hello! I am your FocusSpace Local AI Admin. I run 100% offline on your device with zero cloud telemetry. How can I assist with your workspace today?',
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    },
  ]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [aiStatus, setAiStatus] = useState<{ available: boolean; models: string[] }>({
    available: false,
    models: [],
  });

  const tasks = useLiveQuery(() => db.tasks.toArray(), []) ?? [];
  const categories = useLiveQuery(() => db.categories.toArray(), []) ?? [];
  const habits = useLiveQuery(() => db.habits.toArray(), []) ?? [];
  const pages = useLiveQuery(() => db.pages.toArray(), []) ?? [];

  const chatBottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const [dictationTarget, setDictationTarget] = useState<DictationTarget | null>(null);

  const dictation = useDictation({
    target: dictationTarget,
  });

  // Check Ollama status on mount
  useEffect(() => {
    let mounted = true;
    void checkLocalAiStatus().then(st => {
      if (mounted) setAiStatus(st);
    });
    return () => {
      mounted = false;
    };
  }, []);

  // Scroll to bottom on new message
  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // Focus input when opened
  useEffect(() => {
    if (isOpen) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [isOpen]);

  const toggleVoice = () => {
    if (inputRef.current) {
      setDictationTarget(createInputTarget(inputRef.current));
      dictation.toggle();
    }
  };

  const handleSendMessage = async (textToSend?: string) => {
    const raw = (textToSend || input).trim();
    if (!raw || loading) return;

    const userMsg: ChatMessage = {
      id: String(Date.now()),
      sender: 'user',
      text: raw,
      timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    };

    setMessages(prev => [...prev, userMsg]);
    setInput('');
    setLoading(true);

    const context: AgentContext = { tasks, categories, habits, pages };

    try {
      const response = await processAiAdminQuery(raw, context, aiStatus.models[0]);
      const assistantMsg: ChatMessage = {
        id: String(Date.now() + 1),
        sender: 'assistant',
        text: response.message,
        action: response.action,
        timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err: any) {
      setMessages(prev => [
        ...prev,
        {
          id: String(Date.now() + 1),
          sender: 'assistant',
          text: `Error processing command: ${err.message || 'Unknown error'}`,
          timestamp: new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleExecuteAction = async (msgId: string, action: AiAdminAction) => {
    try {
      const res = await executeAiAction(action);
      if (res.success) {
        toast(res.message, 'success');
        setMessages(prev =>
          prev.map(m => {
            if (m.id === msgId && m.action) {
              return {
                ...m,
                action: { ...m.action, executed: true, undoPayload: res.undoPayload },
              };
            }
            return m;
          })
        );
      } else {
        toast(res.message, 'error');
      }
    } catch (err: any) {
      toast(`Execution failed: ${err.message}`, 'error');
    }
  };

  const handleUndoAction = async (msgId: string, action: AiAdminAction) => {
    try {
      const res = await undoAiAction(action);
      if (res.success) {
        toast(res.message, 'info');
        setMessages(prev =>
          prev.map(m => {
            if (m.id === msgId && m.action) {
              return {
                ...m,
                action: { ...m.action, executed: false },
              };
            }
            return m;
          })
        );
      } else {
        toast(res.message, 'error');
      }
    } catch (err: any) {
      toast(`Undo failed: ${err.message}`, 'error');
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex justify-end animate-fade-in"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-label="AI Admin Assistant"
        className="w-full max-w-lg h-full bg-surface border-l border-line shadow-2xl flex flex-col justify-between overflow-hidden relative"
        onMouseDown={e => e.stopPropagation()}
      >
        {/* Header */}
        <div className="p-4 border-b border-line flex items-center justify-between gap-3 bg-surface-2/60 shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="size-8 rounded-xl bg-accent text-accent-fg grid place-items-center shadow-xs">
              <Sparkles size={16} />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-sm font-semibold text-fg">AI Admin Assistant</h2>
                {aiStatus.available ? (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 border border-emerald-500/30 flex items-center gap-1">
                    <span className="size-1.5 rounded-full bg-emerald-500 animate-pulse" />
                    Ollama ({aiStatus.models[0] || 'local'})
                  </span>
                ) : (
                  <span className="text-[10px] font-mono px-2 py-0.5 rounded-full bg-purple-500/15 text-purple-600 dark:text-purple-400 border border-purple-500/30 flex items-center gap-1">
                    <Cpu size={10} />
                    Zero-Cloud NLP
                  </span>
                )}
              </div>
              <p className="text-[11px] text-fg-muted mt-0.5">
                Local-first administrative automations & daily briefings
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="size-8 rounded-lg border border-line text-fg-muted hover:text-fg hover:bg-hover grid place-items-center transition"
          >
            <X size={15} />
          </button>
        </div>

        {/* Quick Action Chips Bar */}
        <div className="p-2.5 border-b border-line bg-surface/50 flex items-center gap-1.5 overflow-x-auto scrollbar-none shrink-0">
          <button
            type="button"
            onClick={() => void handleSendMessage('auto-schedule today')}
            className="px-2.5 py-1 rounded-lg bg-surface border border-line hover:border-line-strong text-[11px] font-medium text-fg flex items-center gap-1 shrink-0 transition"
          >
            <Zap size={11} className="text-accent" />
            <span>Auto-Schedule</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSendMessage('summarize today')}
            className="px-2.5 py-1 rounded-lg bg-surface border border-line hover:border-line-strong text-[11px] font-medium text-fg flex items-center gap-1 shrink-0 transition"
          >
            <Clock size={11} className="text-accent" />
            <span>Daily Briefing</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSendMessage('clean up completed tasks')}
            className="px-2.5 py-1 rounded-lg bg-surface border border-line hover:border-line-strong text-[11px] font-medium text-fg flex items-center gap-1 shrink-0 transition"
          >
            <Trash2 size={11} className="text-accent" />
            <span>Clean Done</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSendMessage('reschedule overdue tasks')}
            className="px-2.5 py-1 rounded-lg bg-surface border border-line hover:border-line-strong text-[11px] font-medium text-fg flex items-center gap-1 shrink-0 transition"
          >
            <Calendar size={11} className="text-accent" />
            <span>Move Overdue</span>
          </button>
          <button
            type="button"
            onClick={() => void handleSendMessage('create page Sprint Backlog')}
            className="px-2.5 py-1 rounded-lg bg-surface border border-line hover:border-line-strong text-[11px] font-medium text-fg flex items-center gap-1 shrink-0 transition"
          >
            <FileText size={11} className="text-accent" />
            <span>New Page</span>
          </button>
        </div>

        {/* Chat Stream Body */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3.5">
          {messages.map(msg => (
            <div
              key={msg.id}
              className={`flex flex-col ${msg.sender === 'user' ? 'items-end' : 'items-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl p-3.5 text-xs leading-relaxed space-y-2 ${
                  msg.sender === 'user'
                    ? 'bg-accent text-accent-fg font-medium rounded-tr-xs'
                    : 'bg-surface-2 border border-line text-fg rounded-tl-xs shadow-xs'
                }`}
              >
                <div className="whitespace-pre-wrap">{msg.text}</div>

                {/* Proposed Action Card */}
                {msg.action && (
                  <div className="mt-2.5 p-2.5 rounded-xl bg-surface border border-line space-y-2 text-fg">
                    <div className="flex items-start justify-between gap-2">
                      <div className="font-semibold text-xs flex items-center gap-1.5">
                        <Sparkles size={12} className="text-accent" />
                        <span>{msg.action.title}</span>
                      </div>
                      {msg.action.executed ? (
                        <span className="text-[10px] font-mono text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                          <CheckCircle2 size={10} /> Executed
                        </span>
                      ) : (
                        <span className="text-[10px] font-mono text-amber-600 dark:text-amber-400 bg-amber-500/10 px-1.5 py-0.5 rounded flex items-center gap-1 shrink-0">
                          <AlertCircle size={10} /> Ready
                        </span>
                      )}
                    </div>

                    <p className="text-[11px] text-fg-muted">{msg.action.description}</p>

                    <div className="pt-1 flex items-center gap-2">
                      {!msg.action.executed ? (
                        <button
                          type="button"
                          onClick={() => void handleExecuteAction(msg.id, msg.action!)}
                          className="h-7 px-3 rounded-lg bg-accent text-accent-fg font-semibold text-xs flex items-center gap-1 keycap hover:bg-accent-hover transition"
                        >
                          <Zap size={11} /> Execute
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => void handleUndoAction(msg.id, msg.action!)}
                          className="h-7 px-3 rounded-lg border border-line bg-surface-2 text-fg text-xs font-medium flex items-center gap-1 hover:bg-hover transition"
                        >
                          <RotateCcw size={11} /> Undo
                        </button>
                      )}
                    </div>
                  </div>
                )}
              </div>
              <span className="text-[10px] text-fg-subtle mt-1 px-1">{msg.timestamp}</span>
            </div>
          ))}

          {loading && (
            <div className="flex items-center gap-2 text-xs text-fg-muted italic p-2">
              <span className="size-2 rounded-full bg-accent animate-ping" />
              <span>Analyzing workspace and intent…</span>
            </div>
          )}

          <div ref={chatBottomRef} />
        </div>

        {/* Dictation HUD if listening */}
        {dictation.state !== 'idle' && (
          <div className="p-3 border-t border-line bg-surface-2/70">
            <DictationHud
              state={dictation.state}
              audioLevel={dictation.audioLevel}
              errorMessage={dictation.errorMessage}
              modelProgress={dictation.modelProgress}
              onStop={dictation.stop}
            />
          </div>
        )}

        {/* Input Bar */}
        <div className="p-3 border-t border-line bg-surface-2/60 shrink-0">
          <form
            onSubmit={e => {
              e.preventDefault();
              void handleSendMessage();
            }}
            className="flex items-center gap-2"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder='e.g. "create task Review specs priority high due tomorrow"'
              className="flex-1 h-10 px-3 rounded-xl bg-surface border border-line text-xs outline-none focus:border-accent text-fg"
            />
            <MicButton
              state={dictation.state}
              onClick={toggleVoice}
              title="Dictate administrative command offline"
            />
            <button
              type="submit"
              disabled={!input.trim() || loading}
              className="size-10 rounded-xl bg-accent text-accent-fg grid place-items-center hover:bg-accent-hover disabled:opacity-40 transition keycap shrink-0"
              title="Send Command"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
