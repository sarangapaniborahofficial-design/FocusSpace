import React, { useState } from 'react';
import { Activity, CheckCircle2, Clock, Cpu, Play, Upload, FileText, Check } from 'lucide-react';
import { getAsrClient } from '../engine/AsrClient';
import { calculateWer, type WerResult } from './wer';

interface BenchmarkResult {
  id: string;
  filename: string;
  durationSec: number;
  inferenceMs: number;
  realTimeFactor: number;
  transcript: string;
  referenceText: string;
  werResult?: WerResult;
}

export function BenchPage() {
  const [modelName] = useState('whisper-tiny.en');
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

  const updateReference = (id: string, ref: string) => {
    setResults(prev =>
      prev.map(item => {
        if (item.id !== id) return item;
        const werResult = ref.trim() ? calculateWer(ref, item.transcript) : undefined;
        return { ...item, referenceText: ref, werResult };
      })
    );
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
          id: `${file.name}-${Date.now()}-${i}`,
          filename: file.name,
          durationSec: parseFloat(durationSec.toFixed(2)),
          inferenceMs,
          realTimeFactor,
          transcript,
          referenceText: '',
        });
      } catch (err: any) {
        newResults.push({
          id: `${file.name}-${Date.now()}-${i}`,
          filename: file.name,
          durationSec: 0,
          inferenceMs: 0,
          realTimeFactor: 0,
          transcript: `[Error: ${err.message}]`,
          referenceText: '',
        });
      }
    }

    setResults(prev => [...prev, ...newResults]);
    setBenchmarking(false);
  };

  const totalDuration = results.reduce((acc, r) => acc + r.durationSec, 0);
  const totalInference = results.reduce((acc, r) => acc + r.inferenceMs, 0);
  const avgRtf = totalDuration > 0 ? (totalInference / 1000 / totalDuration).toFixed(3) : '—';

  const evaluatedWithWer = results.filter(r => r.werResult);
  const meanWer = evaluatedWithWer.length > 0
    ? (
        (evaluatedWithWer.reduce((acc, r) => acc + (r.werResult?.wer || 0), 0) /
          evaluatedWithWer.length) *
        100
      ).toFixed(1) + '%'
    : '—';

  return (
    <div className="max-w-5xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between border-b border-line pb-4">
        <div>
          <h1 className="text-xl font-bold text-fg flex items-center gap-2">
            <Activity className="text-accent" size={20} /> FocusSpace Voice Engine Benchmark & Gate 0
          </h1>
          <p className="text-xs text-fg-muted mt-1">
            Phase 0 validation suite for measuring on-device inference latency, RTF, and Word Error Rate (WER)
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

      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4">
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
          <div className="text-xs text-fg-muted">Summary Metrics</div>
          <div className="text-sm font-semibold text-fg">Mean RTF: {avgRtf}x</div>
          <div className="text-xs text-accent font-semibold">Mean WER: {meanWer}</div>
          <div className="text-[10px] text-fg-subtle">
            {evaluatedWithWer.length} / {results.length} clips with ground truth
          </div>
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
          <div className="px-4 py-3 border-b border-line text-xs font-semibold text-fg flex items-center justify-between">
            <span>Benchmark Results ({results.length} clips)</span>
            <span className="text-fg-muted font-normal text-[11px]">
              Type reference text to evaluate Word Error Rate
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs text-left">
              <thead className="bg-surface-2 text-fg-muted uppercase text-[10px]">
                <tr>
                  <th className="px-4 py-2">Clip File</th>
                  <th className="px-4 py-2">Duration</th>
                  <th className="px-4 py-2">Inference</th>
                  <th className="px-4 py-2">RTF</th>
                  <th className="px-4 py-2">WER</th>
                  <th className="px-4 py-2">Acoustic Output vs Reference</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {results.map(r => (
                  <tr key={r.id} className="hover:bg-hover/50">
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
                    <td className="px-4 py-2.5 font-mono">
                      {r.werResult ? (
                        <div className="space-y-0.5">
                          <span
                            className={`px-1.5 py-0.5 rounded text-[11px] font-bold ${
                              r.werResult.wer <= 0.1
                                ? 'bg-emerald-500/10 text-emerald-500'
                                : r.werResult.wer <= 0.25
                                ? 'bg-amber-500/10 text-amber-500'
                                : 'bg-rose-500/10 text-rose-500'
                            }`}
                          >
                            {r.werResult.werPercent}
                          </span>
                          <div className="text-[10px] text-fg-subtle">
                            S:{r.werResult.substitutions} D:{r.werResult.deletions} I:{r.werResult.insertions}
                          </div>
                        </div>
                      ) : (
                        <span className="text-fg-subtle">—</span>
                      )}
                    </td>
                    <td className="px-4 py-2.5 space-y-1.5 max-w-md">
                      <div>
                        <span className="text-[10px] text-fg-subtle uppercase block">Hypothesis:</span>
                        <div className="text-fg font-medium">{r.transcript || '—'}</div>
                      </div>
                      <div>
                        <span className="text-[10px] text-fg-subtle uppercase block">Ground Truth:</span>
                        <input
                          type="text"
                          placeholder="Type reference transcript to calculate WER..."
                          value={r.referenceText}
                          onChange={e => updateReference(r.id, e.target.value)}
                          className="w-full px-2 py-1 rounded bg-surface-2 border border-line text-xs text-fg focus:outline-none focus:border-accent"
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
