import React, { useEffect, useRef, useState } from 'react';
import { Mic, Volume2, Check, X, Sparkles, RefreshCw } from 'lucide-react';
import {
  type AudioDevice,
  getAudioInputDevices,
  getAudioOutputDevices,
  getSelectedAudioInput,
  getSelectedAudioOutput,
  requestMicrophonePermission,
  setAudioConfigured,
  setSelectedAudioInput,
  setSelectedAudioOutput,
  testAudioOutput,
  createAudioLevelMeter,
} from '../voice/audioDevices';

export function AudioDeviceSetupModal({
  open,
  isOpen,
  onClose,
  onComplete,
  onConfigured,
}: {
  open?: boolean;
  isOpen?: boolean;
  onClose: () => void;
  onComplete?: () => void;
  onConfigured?: () => void;
}) {
  const isModalOpen = open ?? isOpen ?? false;
  const [inputs, setInputs] = useState<AudioDevice[]>([]);
  const [outputs, setOutputs] = useState<AudioDevice[]>([]);
  const [selectedInput, setSelectedInput] = useState<string>(() => getSelectedAudioInput());
  const [selectedOutput, setSelectedOutput] = useState<string>(() => getSelectedAudioOutput());
  const [audioLevel, setAudioLevel] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [testPlaying, setTestPlaying] = useState(false);

  const streamRef = useRef<MediaStream | null>(null);
  const stopMeterRef = useRef<(() => void) | null>(null);

  // Load devices and start audio level preview
  const refreshDevices = async () => {
    setLoading(true);
    await requestMicrophonePermission();
    const inDevices = await getAudioInputDevices();
    const outDevices = await getAudioOutputDevices();

    setInputs(inDevices);
    setOutputs(outDevices);

    if (!selectedInput && inDevices.length > 0) {
      setSelectedInput(inDevices[0].deviceId);
    }
    if (!selectedOutput && outDevices.length > 0) {
      setSelectedOutput(outDevices[0].deviceId);
    }
    setLoading(false);
  };

  useEffect(() => {
    if (isModalOpen) {
      void refreshDevices();
    } else {
      // Cleanup preview stream on close
      stopMeterRef.current?.();
      streamRef.current?.getTracks().forEach(t => t.stop());
      streamRef.current = null;
    }
  }, [isModalOpen]);

  // Start live VU meter whenever selectedInput changes while modal is open
  useEffect(() => {
    if (!isModalOpen) return;

    let active = true;
    stopMeterRef.current?.();
    streamRef.current?.getTracks().forEach(t => t.stop());

    const initMeter = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: selectedInput ? { deviceId: { exact: selectedInput } } : true,
          video: false,
        });
        if (!active) {
          stream.getTracks().forEach(t => t.stop());
          return;
        }
        streamRef.current = stream;
        stopMeterRef.current = createAudioLevelMeter(stream, level => {
          if (active) setAudioLevel(level);
        });
      } catch (err) {
        console.warn('Could not initialize audio test stream:', err);
      }
    };

    void initMeter();

    return () => {
      active = false;
      stopMeterRef.current?.();
      streamRef.current?.getTracks().forEach(t => t.stop());
    };
  }, [isModalOpen, selectedInput]);

  const handleTestChime = async () => {
    setTestPlaying(true);
    await testAudioOutput(selectedOutput);
    setTimeout(() => setTestPlaying(false), 700);
  };

  const handleSave = () => {
    if (selectedInput) setSelectedAudioInput(selectedInput);
    if (selectedOutput) setSelectedAudioOutput(selectedOutput);
    setAudioConfigured(true);

    stopMeterRef.current?.();
    streamRef.current?.getTracks().forEach(t => t.stop());

    onClose();
    onComplete?.();
    onConfigured?.();
  };

  if (!isModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm grid place-items-center p-4 fade-in"
      onMouseDown={onClose}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="audio-setup-title"
        onMouseDown={e => e.stopPropagation()}
        className="w-full max-w-md atelier-card rounded-2xl bg-surface border border-line shadow-2xl p-6 pop-in text-fg font-sans"
      >
        {/* Header */}
        <div className="flex items-start justify-between gap-3 mb-4">
          <div className="flex items-center gap-3">
            <div className="size-10 rounded-xl bg-accent text-accent-fg grid place-items-center keycap shrink-0">
              <Mic size={20} />
            </div>
            <div>
              <div className="index-chip text-accent-text flex items-center gap-1">
                <Sparkles size={11} /> Audio Configuration
              </div>
              <h2 id="audio-setup-title" className="text-base font-bold mt-0.5">
                Set Up Voice & Audio Hardware
              </h2>
            </div>
          </div>
          <button
            onClick={onClose}
            className="size-8 rounded-lg text-fg-subtle hover:text-fg hover:bg-hover flex items-center justify-center transition cursor-pointer"
            title="Close"
          >
            <X size={16} />
          </button>
        </div>

        <p className="text-xs text-fg-muted mb-5 leading-relaxed">
          FocusSpace processes voice typing 100% locally on your machine with zero cloud requests. Choose your preferred microphone and audio output.
        </p>

        {loading ? (
          <div className="py-8 text-center text-xs text-fg-muted flex items-center justify-center gap-2">
            <RefreshCw size={14} className="animate-spin" /> Detecting audio devices…
          </div>
        ) : (
          <div className="space-y-4">
            {/* Microphone Input */}
            <div>
              <label className="block text-xs font-semibold text-fg mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Mic size={13} className="text-accent" /> Microphone Input
                </span>
                <span className="text-[10px] text-fg-subtle font-mono">
                  {inputs.length} found
                </span>
              </label>

              <select
                value={selectedInput}
                onChange={e => setSelectedInput(e.target.value)}
                className="w-full h-9 px-3 rounded-xl bg-surface-2 border border-line text-xs text-fg outline-none focus:border-accent cursor-pointer"
              >
                {inputs.map(d => (
                  <option key={d.deviceId} value={d.deviceId}>
                    {d.label}
                  </option>
                ))}
              </select>

              {/* Live VU Meter */}
              <div className="mt-2 p-2 rounded-xl bg-surface-2/60 border border-line flex items-center gap-3">
                <span className="text-[10px] font-mono text-fg-subtle uppercase tracking-wider shrink-0">
                  Mic Level
                </span>
                <div className="flex-1 h-2 rounded-full bg-surface-3 overflow-hidden">
                  <div
                    className="h-full bg-accent transition-all duration-75 rounded-full"
                    style={{ width: `${Math.round(audioLevel * 100)}%` }}
                  />
                </div>
                <span className="text-[10px] font-mono text-fg-muted tabular-nums shrink-0 w-8 text-right">
                  {Math.round(audioLevel * 100)}%
                </span>
              </div>
              <p className="text-[10px] text-fg-subtle mt-1">
                Speak normally to verify your microphone responds.
              </p>
            </div>

            {/* Audio Output (Speakers / Headphones) */}
            <div>
              <label className="block text-xs font-semibold text-fg mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <Volume2 size={13} className="text-accent" /> Sound Output (Speakers/Headphones)
                </span>
                <span className="text-[10px] text-fg-subtle font-mono">
                  {outputs.length > 0 ? `${outputs.length} found` : 'System default'}
                </span>
              </label>

              <div className="flex items-center gap-2">
                <select
                  value={selectedOutput}
                  onChange={e => setSelectedOutput(e.target.value)}
                  className="flex-1 h-9 px-3 rounded-xl bg-surface-2 border border-line text-xs text-fg outline-none focus:border-accent cursor-pointer"
                >
                  {outputs.length > 0 ? (
                    outputs.map(d => (
                      <option key={d.deviceId} value={d.deviceId}>
                        {d.label}
                      </option>
                    ))
                  ) : (
                    <option value="">System Default Audio Output</option>
                  )}
                </select>

                <button
                  type="button"
                  onClick={handleTestChime}
                  disabled={testPlaying}
                  className="h-9 px-3 rounded-xl border border-line bg-surface-2 text-xs font-semibold hover:bg-hover flex items-center gap-1.5 shrink-0 transition keycap disabled:opacity-50 cursor-pointer"
                  title="Play test chime"
                >
                  <Volume2 size={13} className={testPlaying ? 'text-accent animate-pulse' : ''} />
                  <span>{testPlaying ? 'Playing…' : 'Test Sound'}</span>
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-2.5 mt-6 pt-4 border-t border-line">
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl text-xs font-semibold text-fg-muted hover:text-fg hover:bg-hover transition cursor-pointer"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={loading}
            className="h-9 px-4 rounded-xl bg-accent text-accent-fg text-xs font-bold flex items-center gap-1.5 hover:bg-accent-hover transition keycap cursor-pointer disabled:opacity-40"
          >
            <Check size={14} /> Save & Continue
          </button>
        </div>
      </div>
    </div>
  );
}
