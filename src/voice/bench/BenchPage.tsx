import React, { useState } from 'react';
import { Activity, CheckCircle2, Clock, Cpu, Play, Upload } from 'lucide-react';
import { getAsrClient } from '../engine/AsrClient';

interface BenchmarkResult {
  filename: string;
  durationSec: number;
  inferenceMs: number;
  realTimeFactor: number;
  transcript: string;
}

export function BenchPage() {
  const [modelName, setModelName] = useState('whisper-tiny.en');
  const [loading, setLoading] = useState(false);
  const [loadTimeMs, setLoadTimeMs] = useState<number | null>(null);
  const [results, setResults] = useState<BenchmarkResult[]>([]);
  const [benchmarking, setBenchmarking] = useState(false);
  const isIsolated = typeof window !== 'undefined' && window.crossOriginIsolated;

  const handleWarmupLoad = async () => {
    setLoading(true);
    const start = performance.now();
    try {
      const client = getAsrClient();
      await client.load();
      setLoadTimeMs(Math.round(performance.now() - start));
    } catch (err: any) {
      alert(`Model load error: ${err.message}`);
    } finally {
      setLoading(false);
    }
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0) return;

    setBenchmarking(true);
    const client = getAsrClient();
    await client.load();

    const audioCtx = new AudioContext({ sampleRate: 16000 });
    const newResults: BenchmarkResult[] = [];

    for (let i = 0; i < files.length; i++) {
      const file = files[i];
      try {
        const arrayBuf = await file.arrayBuffer();
        const audioBuf = await audioCtx.decodeAudioData(arrayBuf);
        const float32 = audioBuf.getChannelData(0);
        const durationSec = float32.length / 16000;

        const start = performance.now();
        const transcript = await client.transcribe(float32);
        const inferenceMs = Math.round(performance.now() - start);
        const realTimeFactor = parseFloat((inferenceMs / 1000 / durationSec).toFixed(3));

        newResults.push({
          filename: file.name,
          durationSec: parseFloat(durationSec.toFixed(2)),
          inferenceMs,
          realTimeFactor,
          transcript,
        });
      } catch (err: any) {
        newResults.push({
          filename: file.name,
          durationSec: 0,
          inferenceMs: 0,
          realTimeFactor: 0,
          transcript: `[Error: ${err.message}]`,
        });
      }
    }

    setResults(prev => [...prev, ...newResults]);
    setBenchmarking(false);
  };

  return (
    <div className="max-w-4xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold text-fg flex items-center gap-2">
            <Activity className="text-accent" size={20} /> FocusSpace Voice Engine Benchmark
          </h1>
          <p className="text-xs text-fg-muted mt-1">
            Phase 0 validation suite for measuring on-device inference latency & RTF
          </p>
        </div>

        <div className="flex items-center gap-2">
          <span
            className={`px-2.5 py-1 rounded-full text-xs font-semibold ${
              isIsolated ? 'bg-emerald-500/10 text-emerald-500' : 'bg-amber-500/10 text-amber-500'
            }`}
          >
            {isIsolated ? 'Cross-Origin Isolated (Multi-Threaded)' : 'Standard Threading'}
          </span>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="p-4 rounded-2xl bg-surface-2 border border-line space-y-2">
          <div className="text-xs text-fg-muted">Current Model</div>
          <div className="text-sm font-semibold text-fg">{modelName}</div>
          <button
            onClick={handleWarmupLoad}
            disabled={loading}
            className="px-3 py-1.5 rounded-lg bg-surface border border-line text-xs font-semibold hover:bg-hover transition cursor-pointer"
          >
            {loading ? 'Initializing...' : 'Test Warmup Load'}
          </button>
        </div>

        <div className="p-4 rounded-2xl bg-surface-2 border border-line space-y-2">
          <div className="text-xs text-fg-muted">Load Time (Cold/Warm)</div>
          <div className="text-lg font-bold text-fg">
            {loadTimeMs !== null ? `${loadTimeMs} ms` : '—'}
          </div>
          <div className="text-[10px] text-fg-subtle">Target: &lt; 2500ms on desktop</div>
        </div>

        <div className="p-4 rounded-2xl bg-surface-2 border border-line space-y-2">
          <div className="text-xs text-fg-muted">Run Audio Test</div>
          <label className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-accent text-accent-text text-xs font-semibold hover:opacity-90 transition cursor-pointer">
            <Upload size={13} /> {benchmarking ? 'Benchmarking...' : 'Upload WAV Clips'}
            <input
              type="file"
              multiple
              accept="audio/*"
              className="hidden"
              onChange={handleFileUpload}
              disabled={benchmarking}
            />
          </label>
        </div>
      </div>

      {results.length > 0 && (
        <div className="rounded-2xl border border-line bg-surface overflow-hidden">
          <div className="px-4 py-3 border-b border-line text-xs font-semibold text-fg">
            Benchmark Results
          </div>
          <table className="w-full text-xs text-left">
            <thead className="bg-surface-2 text-fg-muted uppercase text-[10px]">
              <tr>
                <th className="px-4 py-2">Clip File</th>
                <th className="px-4 py-2">Duration</th>
                <th className="px-4 py-2">Inference</th>
                <th className="px-4 py-2">RTF (Inf/Dur)</th>
                <th className="px-4 py-2">Transcript</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {results.map((r, idx) => (
                <tr key={idx} className="hover:bg-hover/50">
                  <td className="px-4 py-2.5 font-mono">{r.filename}</td>
                  <td className="px-4 py-2.5">{r.durationSec}s</td>
                  <td className="px-4 py-2.5 font-semibold text-accent">{r.inferenceMs} ms</td>
                  <td className="px-4 py-2.5 font-mono">
                    <span
                      className={`px-1.5 py-0.5 rounded text-[11px] ${
                        r.realTimeFactor <= 0.35
                          ? 'bg-emerald-500/10 text-emerald-500'
                          : 'bg-amber-500/10 text-amber-500'
                      }`}
                    >
                      {r.realTimeFactor}x
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-fg-muted">{r.transcript}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
