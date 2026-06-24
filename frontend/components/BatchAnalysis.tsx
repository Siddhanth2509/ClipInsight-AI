'use client';
import { useState, useRef } from 'react';

interface BatchJob {
  url: string;
  jobId: string;
  status: 'idle' | 'loading' | 'done' | 'error';
  result: any;
  error: string;
}

const EMPTY_JOB = (): BatchJob => ({ url: '', jobId: '', status: 'idle', result: null, error: '' });

interface BatchAnalysisProps {
  onClose: () => void;
}

export default function BatchAnalysis({ onClose }: BatchAnalysisProps) {
  const [jobs, setJobs] = useState<BatchJob[]>([EMPTY_JOB(), EMPTY_JOB()]);
  const [running, setRunning] = useState(false);

  const API = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

  const updateJob = (i: number, patch: Partial<BatchJob>) =>
    setJobs(prev => prev.map((j, idx) => idx === i ? { ...j, ...patch } : j));

  const addRow = () => {
    if (jobs.length < 4) setJobs(prev => [...prev, EMPTY_JOB()]);
  };

  const removeRow = (i: number) => {
    if (jobs.length > 2) setJobs(prev => prev.filter((_, idx) => idx !== i));
  };

  const runBatch = async () => {
    const validJobs = jobs.filter(j => j.url.trim());
    if (validJobs.length < 2) return;

    setRunning(true);

    // Mark all as loading
    setJobs(prev => prev.map(j =>
      j.url.trim() ? { ...j, status: 'loading' as const, result: null, error: '' } : j
    ));

    // Run all analyses in parallel
    await Promise.all(
      jobs.map(async (job, i) => {
        if (!job.url.trim()) return;
        try {
          // Step 1: Submit URL
          const fd = new FormData();
          fd.append('url', job.url.trim());
          const urlRes = await fetch(`${API}/analyze-url`, { method: 'POST', body: fd });
          const { job_id } = await urlRes.json();
          updateJob(i, { jobId: job_id });

          // Step 2: Trigger pipeline
          await fetch(`${API}/analyze/${job_id}`, { method: 'POST' });

          // Step 3: Poll until done
          const result = await new Promise<any>((resolve, reject) => {
            const interval = setInterval(async () => {
              try {
                const statusRes = await fetch(`${API}/status/${job_id}`);
                const statusData = await statusRes.json();
                if (statusData.status === 'done') {
                  clearInterval(interval);
                  const resultRes = await fetch(`${API}/results/${job_id}`);
                  resolve(await resultRes.json());
                } else if (statusData.status === 'error') {
                  clearInterval(interval);
                  reject(new Error(statusData.error || 'Analysis failed'));
                }
              } catch (e) { clearInterval(interval); reject(e); }
            }, 2000);
            // Timeout after 5 minutes
            setTimeout(() => { clearInterval(interval); reject(new Error('Timeout')); }, 300000);
          });

          updateJob(i, { status: 'done', result });
        } catch (e: any) {
          updateJob(i, { status: 'error', error: e.message || 'Failed' });
        }
      })
    );

    setRunning(false);
  };

  const doneJobs = jobs.filter(j => j.status === 'done' && j.result);
  const winner   = doneJobs.length > 0
    ? doneJobs.reduce((best, j) => (j.result.hook_score > best.result.hook_score ? j : best))
    : null;

  const hookColor = (score: number) => {
    if (score >= 80) return '#86efac';
    if (score >= 60) return '#FFB7C5';
    return '#f87171';
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 1000,
      background: 'rgba(10,6,28,0.85)',
      backdropFilter: 'blur(20px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      padding: 24,
    }} onClick={e => { if (e.target === e.currentTarget) onClose(); }}>

      <div style={{
        width: '100%', maxWidth: 900,
        background: 'rgba(20,12,40,0.95)',
        border: '1px solid rgba(255,183,197,0.15)',
        borderRadius: 28, padding: '36px 40px',
        boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 60px rgba(255,133,162,0.08)',
        maxHeight: '90vh', overflowY: 'auto',
      }}>

        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 32 }}>
          <div>
            <div style={{
              fontSize: '0.7rem', letterSpacing: '0.2em', textTransform: 'uppercase',
              color: 'var(--sakura-pink, #FF85A2)', marginBottom: 6,
            }}>
              Phase 4 · 比較
            </div>
            <h2 style={{ fontFamily: 'Georgia, serif', fontStyle: 'italic', fontSize: '1.8rem', fontWeight: 600, margin: 0 }}>
              Batch <span style={{ color: 'var(--sakura-pink, #FF85A2)' }}>Comparison</span>
            </h2>
            <p style={{ color: '#998CAD', fontSize: '0.85rem', marginTop: 6 }}>
              Compare 2–4 videos side by side. The AI analyzes each and reveals the winner. 🌸
            </p>
          </div>
          <button onClick={onClose} style={{
            background: 'rgba(255,183,197,0.08)', border: '1px solid rgba(255,183,197,0.15)',
            borderRadius: 10, padding: '8px 14px', color: '#998CAD',
            cursor: 'pointer', fontSize: '1rem',
          }}>✕</button>
        </div>

        {/* URL Inputs */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 24 }}>
          {jobs.map((job, i) => (
            <div key={i} style={{ display: 'flex', gap: 10, alignItems: 'center' }}>
              <div style={{
                width: 28, height: 28, borderRadius: '50%', flexShrink: 0,
                background: 'linear-gradient(135deg, #E8557A, #FFB7C5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, color: '#0F0A22',
              }}>
                {i + 1}
              </div>
              <input
                type="url"
                placeholder={`Video ${i + 1} URL — YouTube, Instagram, TikTok…`}
                value={job.url}
                onChange={e => updateJob(i, { url: e.target.value })}
                disabled={running}
                style={{
                  flex: 1, padding: '12px 16px',
                  background: 'rgba(255,183,197,0.05)',
                  border: '1px solid rgba(255,183,197,0.15)',
                  borderRadius: 12, color: '#F2EBFA',
                  fontSize: '0.88rem', outline: 'none',
                  transition: 'border-color 0.2s',
                }}
                onFocus={e => e.target.style.borderColor = 'rgba(255,133,162,0.5)'}
                onBlur={e => e.target.style.borderColor = 'rgba(255,183,197,0.15)'}
              />
              {/* Status badge */}
              {job.status === 'loading' && (
                <div style={{ fontSize: '0.8rem', color: '#FFB7C5', whiteSpace: 'nowrap' }}>⏳ Analyzing…</div>
              )}
              {job.status === 'done' && (
                <div style={{ fontSize: '0.8rem', color: '#86efac', whiteSpace: 'nowrap' }}>✅ Done</div>
              )}
              {job.status === 'error' && (
                <div style={{ fontSize: '0.8rem', color: '#f87171', whiteSpace: 'nowrap' }}>⚠ Failed</div>
              )}
              {jobs.length > 2 && (
                <button onClick={() => removeRow(i)} disabled={running} style={{
                  background: 'transparent', border: 'none', color: '#998CAD',
                  cursor: 'pointer', fontSize: '1.1rem', padding: '4px 8px', flexShrink: 0,
                }}>✕</button>
              )}
            </div>
          ))}
        </div>

        {/* Controls */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 36 }}>
          <button
            onClick={runBatch}
            disabled={running || jobs.filter(j => j.url.trim()).length < 2}
            style={{
              padding: '12px 28px', borderRadius: 12,
              background: running ? 'rgba(255,133,162,0.2)' : 'linear-gradient(135deg, #E8557A, #FFB7C5)',
              color: running ? '#FFB7C5' : '#0F0A22',
              border: 'none', fontWeight: 700, fontSize: '0.95rem',
              cursor: running ? 'not-allowed' : 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            {running ? '🌸 Analyzing…' : '🚀 Run Comparison'}
          </button>
          {jobs.length < 4 && (
            <button onClick={addRow} disabled={running} style={{
              padding: '12px 20px', borderRadius: 12,
              background: 'rgba(255,183,197,0.08)',
              border: '1px solid rgba(255,183,197,0.2)',
              color: '#FFB7C5', cursor: 'pointer', fontSize: '0.9rem',
            }}>
              + Add Video
            </button>
          )}
        </div>

        {/* Comparison Results Table */}
        {doneJobs.length > 0 && (
          <div>
            <div style={{
              fontSize: '0.7rem', letterSpacing: '0.18em', textTransform: 'uppercase',
              color: '#998CAD', marginBottom: 16,
            }}>
              Comparison Results · {doneJobs.length} Videos Analyzed
            </div>

            {/* Winner Banner */}
            {winner && (
              <div style={{
                background: 'linear-gradient(135deg, rgba(255,133,162,0.1), rgba(255,183,197,0.05))',
                border: '1px solid rgba(255,133,162,0.25)',
                borderRadius: 16, padding: '16px 22px',
                marginBottom: 20, display: 'flex', alignItems: 'center', gap: 12,
              }}>
                <div style={{ fontSize: '1.8rem' }}>🌸</div>
                <div>
                  <div style={{ color: '#FF85A2', fontWeight: 700, fontSize: '0.9rem', marginBottom: 2 }}>
                    Top Performer
                  </div>
                  <div style={{ color: '#F2EBFA', fontSize: '0.85rem' }}>
                    Video {jobs.indexOf(winner) + 1} wins with Hook Score {winner.result.hook_score}/100
                  </div>
                </div>
              </div>
            )}

            {/* Results Grid */}
            <div style={{
              display: 'grid',
              gridTemplateColumns: `repeat(${doneJobs.length}, 1fr)`,
              gap: 16,
            }}>
              {jobs.map((job, i) => {
                if (job.status !== 'done' || !job.result) return null;
                const r = job.result;
                const isWinner = job === winner;

                return (
                  <div key={i} style={{
                    background: isWinner
                      ? 'linear-gradient(180deg, rgba(255,133,162,0.08), rgba(20,12,40,0.95))'
                      : 'rgba(255,183,197,0.03)',
                    border: `1px solid ${isWinner ? 'rgba(255,133,162,0.3)' : 'rgba(255,183,197,0.1)'}`,
                    borderRadius: 18, padding: '22px 20px',
                  }}>
                    {/* Video label */}
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 16 }}>
                      <div style={{
                        width: 24, height: 24, borderRadius: '50%',
                        background: isWinner
                          ? 'linear-gradient(135deg, #E8557A, #FFB7C5)'
                          : 'rgba(255,183,197,0.1)',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                        fontSize: '0.7rem', fontWeight: 700,
                        color: isWinner ? '#0F0A22' : '#998CAD',
                      }}>{i + 1}</div>
                      <span style={{ fontSize: '0.78rem', color: '#998CAD' }}>
                        {isWinner ? '🏆 Winner' : `Video ${i + 1}`}
                      </span>
                    </div>

                    {/* Hook Score (big) */}
                    <div style={{ textAlign: 'center', marginBottom: 18 }}>
                      <div style={{
                        fontSize: '3rem', fontWeight: 900, lineHeight: 1,
                        color: hookColor(r.hook_score),
                        fontFamily: 'Georgia, serif',
                      }}>{r.hook_score}</div>
                      <div style={{ fontSize: '0.7rem', color: '#998CAD', letterSpacing: '0.1em', marginTop: 4 }}>
                        HOOK SCORE / 100
                      </div>
                      {/* Hook bar */}
                      <div style={{
                        height: 4, borderRadius: 4, marginTop: 8,
                        background: 'rgba(255,183,197,0.1)', overflow: 'hidden',
                      }}>
                        <div style={{
                          height: '100%', width: `${r.hook_score}%`,
                          background: `linear-gradient(90deg, ${hookColor(r.hook_score)}, ${hookColor(r.hook_score)}88)`,
                          borderRadius: 4, transition: 'width 1s ease',
                        }} />
                      </div>
                    </div>

                    {/* Stats */}
                    {[
                      ['Sentiment',  r.sentiment],
                      ['Category',   r.content_category],
                      ['Duration',   `${r.duration_seconds}s`],
                      ['Words',      r.word_count],
                    ].map(([label, val]) => (
                      <div key={label as string} style={{
                        display: 'flex', justifyContent: 'space-between',
                        padding: '8px 0',
                        borderBottom: '1px solid rgba(255,183,197,0.07)',
                        fontSize: '0.82rem',
                      }}>
                        <span style={{ color: '#998CAD' }}>{label}</span>
                        <span style={{ color: '#F2EBFA', fontWeight: 600 }}>{val}</span>
                      </div>
                    ))}

                    {/* Music */}
                    {r.music?.detected && (
                      <div style={{ marginTop: 12, padding: '10px 12px', background: 'rgba(255,183,197,0.05)', borderRadius: 10 }}>
                        <div style={{ fontSize: '0.72rem', color: '#FF85A2', marginBottom: 3 }}>🎵 MUSIC</div>
                        <div style={{ fontSize: '0.8rem', color: '#F2EBFA', fontWeight: 600 }}>{r.music.song_title}</div>
                        <div style={{ fontSize: '0.75rem', color: '#998CAD' }}>{r.music.artist}</div>
                      </div>
                    )}

                    {/* Tags */}
                    {r.tags?.length > 0 && (
                      <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {r.tags.slice(0, 4).map((tag: string) => (
                          <span key={tag} style={{
                            padding: '3px 10px', borderRadius: 100,
                            background: 'rgba(255,133,162,0.1)',
                            border: '1px solid rgba(255,133,162,0.2)',
                            fontSize: '0.7rem', color: '#FF85A2',
                          }}>#{tag}</span>
                        ))}
                      </div>
                    )}

                    {/* Top suggestion */}
                    {r.suggestions?.[0] && (
                      <div style={{
                        marginTop: 14, padding: '10px 12px',
                        background: 'rgba(255,183,197,0.04)',
                        border: '1px solid rgba(255,183,197,0.1)',
                        borderRadius: 10, fontSize: '0.78rem',
                        color: '#998CAD', lineHeight: 1.5,
                      }}>
                        💡 {r.suggestions[0]}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
