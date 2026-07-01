'use client';
import { useState } from 'react';

interface BatchJob {
  url:    string;
  jobId:  string;
  status: 'idle' | 'loading' | 'done' | 'error';
  result: any;
  error:  string;
}

const EMPTY_JOB = (): BatchJob => ({ url: '', jobId: '', status: 'idle', result: null, error: '' });

interface BatchAnalysisProps {
  onClose: () => void;
}

const BACKEND = process.env.NEXT_PUBLIC_BACKEND_URL || 'http://localhost:8000';

/* ── Score bar ── */
function ScoreBar({ value, color }: { value: number; color: string }) {
  return (
    <div style={{ position: 'relative', height: 6, borderRadius: 3, background: 'rgba(255,255,255,0.07)', overflow: 'hidden' }}>
      <div style={{
        position: 'absolute', left: 0, top: 0, bottom: 0,
        width: `${Math.min(100, value)}%`,
        background: color, borderRadius: 3,
        transition: 'width 0.8s cubic-bezier(0.22,1,0.36,1)',
      }} />
    </div>
  );
}

/* ── Metric row ── */
function MetricRow({ label, a, b, color }: { label: string; a: number; b: number; color: string }) {
  const winner = a >= b ? 0 : 1;
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 5, fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
        <span style={{ fontWeight: winner === 0 ? 700 : 400, color: winner === 0 ? color : undefined }}>
          {a} {winner === 0 && '▲'}
        </span>
        <span>{label}</span>
        <span style={{ fontWeight: winner === 1 ? 700 : 400, color: winner === 1 ? color : undefined }}>
          {winner === 1 && '▲'} {b}
        </span>
      </div>
      <div style={{ display: 'flex', gap: 4, alignItems: 'center' }}>
        <div style={{ flex: 1 }}>
          <ScoreBar value={a} color={winner === 0 ? color : 'rgba(255,255,255,0.12)'} />
        </div>
        <div style={{ width: 2, height: 12, background: 'rgba(255,255,255,0.08)', borderRadius: 1 }} />
        <div style={{ flex: 1 }}>
          <ScoreBar value={b} color={winner === 1 ? color : 'rgba(255,255,255,0.12)'} />
        </div>
      </div>
    </div>
  );
}

/* ── Result card ── */
function JobCard({ job, index }: { job: BatchJob; index: number }) {
  const r = job.result;
  return (
    <div style={{
      background: 'rgba(255,255,255,0.03)',
      border: `1px solid ${job.status === 'done' ? 'rgba(124,92,252,0.2)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 16, padding: '20px', flex: 1, minWidth: 0,
    }}>
      {/* Status */}
      {job.status === 'loading' && (
        <div style={{ textAlign: 'center', paddingTop: 40, paddingBottom: 40 }}>
          <div style={{
            width: 36, height: 36, borderRadius: '50%', margin: '0 auto 12px',
            border: '3px solid rgba(124,92,252,0.2)', borderTopColor: 'var(--purple, #7C5CFC)',
            animation: 'spin 0.9s linear infinite',
          }} />
          <p style={{ color: 'rgba(255,255,255,0.4)', fontSize: '0.82rem' }}>Analyzing…</p>
        </div>
      )}
      {job.status === 'error' && (
        <div style={{ textAlign: 'center', paddingTop: 32, color: '#f87171', fontSize: '0.82rem' }}>
          ⚠ {job.error || 'Analysis failed'}
        </div>
      )}
      {job.status === 'done' && r && (
        <>
          <div style={{ marginBottom: 16 }}>
            <div style={{ fontSize: '0.65rem', color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em', marginBottom: 6, textTransform: 'uppercase' }}>
              Video {index + 1}
            </div>
            <div style={{ fontSize: '2.2rem', fontWeight: 800, lineHeight: 1, color: 'var(--purple, #7C5CFC)' }}>
              {r.hook_score}<span style={{ fontSize: '0.85rem', fontWeight: 400, color: 'rgba(255,255,255,0.3)' }}>/100</span>
            </div>
            <div style={{ fontSize: '0.72rem', color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>Hook Score</div>
          </div>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: 14 }}>
            {[
              { label: r.sentiment, color: r.sentiment === 'Positive' ? '#57D98D' : r.sentiment === 'Negative' ? '#f87171' : '#F5C96A' },
              { label: r.content_category, color: 'var(--purple, #7C5CFC)' },
            ].map(tag => (
              <span key={tag.label} style={{
                padding: '2px 9px', borderRadius: 100,
                background: 'rgba(255,255,255,0.06)',
                fontSize: '0.68rem', color: tag.color, fontWeight: 600,
              }}>{tag.label}</span>
            ))}
          </div>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.45)', lineHeight: 1.55, marginBottom: 14, display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {r.summary}
          </p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {(r.tags || []).slice(0, 4).map((t: string) => (
              <span key={t} style={{
                padding: '2px 8px', borderRadius: 100,
                background: 'rgba(124,92,252,0.1)', fontSize: '0.65rem', color: '#B49EFF',
              }}>#{t}</span>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

export default function BatchAnalysis({ onClose }: BatchAnalysisProps) {
  const [jobs,    setJobs]    = useState<BatchJob[]>([EMPTY_JOB(), EMPTY_JOB()]);
  const [running, setRunning] = useState(false);

  const updateJob = (i: number, patch: Partial<BatchJob>) =>
    setJobs(prev => prev.map((j, idx) => idx === i ? { ...j, ...patch } : j));

  const addRow    = () => { if (jobs.length < 4) setJobs(prev => [...prev, EMPTY_JOB()]); };
  const removeRow = (i: number) => { if (jobs.length > 2) setJobs(prev => prev.filter((_, idx) => idx !== i)); };

  const runBatch = async () => {
    const valid = jobs.filter(j => j.url.trim());
    if (valid.length < 2) return;
    setRunning(true);
    setJobs(prev => prev.map(j =>
      j.url.trim() ? { ...j, status: 'loading' as const, result: null, error: '' } : j
    ));

    await Promise.all(
      jobs.map(async (job, i) => {
        if (!job.url.trim()) return;
        try {
          const fd = new FormData();
          fd.append('url', job.url.trim());
          const urlRes = await fetch(`${BACKEND}/analyze-url`, { method: 'POST', body: fd });
          const { job_id } = await urlRes.json();
          updateJob(i, { jobId: job_id });
          await fetch(`${BACKEND}/analyze/${job_id}`, { method: 'POST' });

          const result = await new Promise<any>((resolve, reject) => {
            const iv = setInterval(async () => {
              try {
                const st = await (await fetch(`${BACKEND}/status/${job_id}`)).json();
                if (st.status === 'done') {
                  clearInterval(iv);
                  resolve(await (await fetch(`${BACKEND}/results/${job_id}`)).json());
                } else if (st.status === 'error') {
                  clearInterval(iv);
                  reject(new Error(st.error || 'Analysis failed'));
                }
              } catch (e) { clearInterval(iv); reject(e); }
            }, 2000);
            setTimeout(() => { clearInterval(iv); reject(new Error('Timeout')); }, 300000);
          });

          updateJob(i, { status: 'done', result });
        } catch (e: any) {
          updateJob(i, { status: 'error', error: e.message });
        }
      })
    );
    setRunning(false);
  };

  const doneJobs = jobs.filter(j => j.status === 'done' && j.result);
  const canCompare = doneJobs.length >= 2;
  const [a, b]     = doneJobs;

  // Determine overall winner
  let winner = -1;
  if (canCompare) {
    const aScore = (a.result.hook_score || 0) + (a.result.word_count || 0) / 10;
    const bScore = (b.result.hook_score || 0) + (b.result.word_count || 0) / 10;
    winner = aScore >= bScore ? 0 : 1;
  }

  return (
    <div style={{
      position: 'fixed', inset: 0, zIndex: 900,
      background: 'rgba(2,11,24,0.88)', backdropFilter: 'blur(20px)',
      display: 'flex', flexDirection: 'column',
      fontFamily: 'Inter, sans-serif',
    }}>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>

      {/* Header */}
      <div style={{
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '18px 28px',
        borderBottom: '1px solid rgba(124,92,252,0.15)',
        background: 'rgba(12,20,38,0.9)',
        flexShrink: 0,
      }}>
        <div>
          <div style={{ fontSize: '0.62rem', color: 'var(--purple, #7C5CFC)', letterSpacing: '0.2em', textTransform: 'uppercase', marginBottom: 3 }}>
            Phase 4 — Batch Intelligence
          </div>
          <h2 style={{ fontSize: '1.2rem', fontWeight: 700, margin: 0 }}>
            Video <span style={{ color: 'var(--purple, #7C5CFC)' }}>Comparison</span>
          </h2>
        </div>
        <button onClick={onClose} style={{
          background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.1)',
          borderRadius: 10, padding: '8px 14px', color: 'rgba(255,255,255,0.5)',
          cursor: 'pointer', fontSize: '0.82rem',
        }}>✕ Close</button>
      </div>

      <div style={{ flex: 1, overflowY: 'auto', padding: '24px 28px' }}>
        {/* URL inputs */}
        <div style={{ marginBottom: 24 }}>
          <p style={{ fontSize: '0.78rem', color: 'rgba(255,255,255,0.35)', marginBottom: 16 }}>
            Paste 2–4 video URLs to compare them side by side.
          </p>
          {jobs.map((job, i) => (
            <div key={i} style={{ display: 'flex', gap: 8, marginBottom: 10, alignItems: 'center' }}>
              <div style={{
                width: 24, height: 24, borderRadius: 6,
                background: job.status === 'done' ? 'rgba(124,92,252,0.2)' :
                             job.status === 'loading' ? 'rgba(245,201,106,0.15)' :
                             job.status === 'error' ? 'rgba(248,113,113,0.15)' : 'rgba(255,255,255,0.06)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '0.75rem', fontWeight: 700, color: 'rgba(255,255,255,0.6)',
                flexShrink: 0,
              }}>
                {job.status === 'done' ? '✓' : job.status === 'loading' ? '…' : job.status === 'error' ? '!' : i + 1}
              </div>
              <input
                value={job.url}
                onChange={e => updateJob(i, { url: e.target.value })}
                placeholder={`Video ${i + 1} URL (Instagram / YouTube / TikTok)`}
                disabled={running}
                style={{
                  flex: 1, padding: '10px 14px', borderRadius: 10,
                  background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.09)',
                  color: '#F8FAFC', fontSize: '0.84rem', outline: 'none',
                  cursor: running ? 'not-allowed' : 'text',
                }}
              />
              {jobs.length > 2 && (
                <button onClick={() => removeRow(i)} disabled={running} style={{
                  background: 'rgba(248,113,113,0.08)', border: '1px solid rgba(248,113,113,0.15)',
                  borderRadius: 8, padding: '8px 10px', color: '#f87171', cursor: 'pointer',
                  fontSize: '0.8rem', flexShrink: 0,
                }}>✕</button>
              )}
            </div>
          ))}
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            {jobs.length < 4 && (
              <button onClick={addRow} disabled={running} style={{
                padding: '8px 16px', borderRadius: 8,
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(255,255,255,0.1)',
                color: 'rgba(255,255,255,0.5)', fontSize: '0.8rem', cursor: 'pointer',
              }}>+ Add Video</button>
            )}
            <button
              onClick={runBatch}
              disabled={running || jobs.filter(j => j.url.trim()).length < 2}
              style={{
                padding: '8px 22px', borderRadius: 8,
                background: running ? 'rgba(124,92,252,0.2)' : 'var(--purple, #7C5CFC)',
                border: 'none', color: '#fff', fontSize: '0.84rem', fontWeight: 600,
                cursor: running ? 'not-allowed' : 'pointer',
                opacity: jobs.filter(j => j.url.trim()).length < 2 ? 0.4 : 1,
              }}>
              {running ? 'Analyzing…' : '⚡ Run Comparison'}
            </button>
          </div>
        </div>

        {/* Side by side cards */}
        {jobs.some(j => j.status !== 'idle') && (
          <>
            <div style={{
              display: 'flex', gap: 14, marginBottom: 24,
              flexWrap: 'wrap',
            }}>
              {jobs.map((job, i) => (
                <div key={i} style={{ flex: '1 1 280px', position: 'relative' }}>
                  {canCompare && i < 2 && winner === i && (
                    <div style={{
                      position: 'absolute', top: -10, left: '50%', transform: 'translateX(-50%)',
                      background: 'linear-gradient(135deg, #F5C96A, #57D98D)',
                      borderRadius: 100, padding: '2px 12px',
                      fontSize: '0.65rem', fontWeight: 700, color: '#0a0a0a',
                      letterSpacing: '0.08em', zIndex: 1, whiteSpace: 'nowrap',
                    }}>🏆 WINNER</div>
                  )}
                  <JobCard job={job} index={i} />
                </div>
              ))}
            </div>

            {/* Metrics comparison (only when 2+ done) */}
            {canCompare && (
              <div style={{
                background: 'rgba(12,20,38,0.8)',
                border: '1px solid rgba(124,92,252,0.15)',
                borderRadius: 16, padding: '24px',
              }}>
                <h3 style={{ fontSize: '0.8rem', letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)', textTransform: 'uppercase', marginBottom: 20 }}>
                  Head-to-Head Metrics
                </h3>
                <MetricRow label="Hook Score"   a={a.result.hook_score  || 0} b={b.result.hook_score  || 0} color="#7C5CFC" />
                <MetricRow label="Word Count"   a={a.result.word_count  || 0} b={b.result.word_count  || 0} color="#3DD9FF" />
                <MetricRow label="Frame Count"  a={a.result.frame_count || 0} b={b.result.frame_count || 0} color="#57D98D" />
                <MetricRow label="Duration (s)" a={a.result.duration_seconds || 0} b={b.result.duration_seconds || 0} color="#F5C96A" />

                {/* AI summary */}
                <div style={{
                  marginTop: 20, padding: '16px', borderRadius: 10,
                  background: 'rgba(124,92,252,0.07)',
                  border: '1px solid rgba(124,92,252,0.15)',
                }}>
                  <div style={{ fontSize: '0.68rem', color: 'var(--purple, #7C5CFC)', letterSpacing: '0.12em', textTransform: 'uppercase', marginBottom: 8 }}>
                    AI Verdict
                  </div>
                  <p style={{ fontSize: '0.82rem', color: 'rgba(255,255,255,0.55)', lineHeight: 1.6, margin: 0 }}>
                    {winner === 0
                      ? `Video 1 leads with a higher hook score (${a.result.hook_score}/100 vs ${b.result.hook_score}/100). `
                      : `Video 2 outperforms with a hook score of ${b.result.hook_score}/100 vs ${a.result.hook_score}/100. `}
                    {a.result.hook_score === b.result.hook_score
                      ? 'Both videos are evenly matched.'
                      : `Difference: ${Math.abs((a.result.hook_score || 0) - (b.result.hook_score || 0))} points.`}
                  </p>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
