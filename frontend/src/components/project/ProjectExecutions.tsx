import { useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import { useParams } from '@tanstack/react-router';
import { Play, Terminal, X, Zap } from 'lucide-react';
import { memoryApi } from '../../api/api';

type ExecutionStatus = 'queued' | 'running' | 'success' | 'failed';

interface Execution {
  id: string;
  serviceName: string;
  action: string;
  triggeredBy: string;
  duration: string;
  status: ExecutionStatus;
  timestamp: number;
  logs: string[];
}

const PIPELINES = [
  { serviceName: 'Morph Transformation Agent', action: 'Codebase Inspection Run' },
  { serviceName: 'Zer0 Privacy Pool', action: 'ZK Payroll Settlement' },
  { serviceName: 'A-2-A Trade Pipeline', action: 'Trade Negotiation Run' },
  { serviceName: 'Agent Auth Service', action: 'Classification Review' },
  { serviceName: 'NFT Studio', action: 'Collection Metadata Validation' },
  { serviceName: 'De-pin Node Monitor', action: 'Node Health Probe' },
];

function statusClass(status: ExecutionStatus) {
  if (status === 'success') return 'bg-green-500/10 text-green-600 dark:text-green-400';
  if (status === 'running') return 'bg-blue-500/10 text-blue-600 dark:text-blue-400';
  if (status === 'failed') return 'bg-red-500/10 text-red-600 dark:text-red-400';
  return 'bg-amber-500/10 text-amber-600 dark:text-amber-400';
}

function statusLabel(status: string) {
  return status.charAt(0).toUpperCase() + status.slice(1);
}

export default function ProjectExecutions() {
  const { projectId } = useParams({ strict: false });
  const [executions, setExecutions] = useState<Execution[]>([]);
  const [executionsLoaded, setExecutionsLoaded] = useState(false);
  const [selectedExecutionId, setSelectedExecutionId] = useState<string | null>(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [selectedPipeline, setSelectedPipeline] = useState(PIPELINES[0].action);
  const [executionInput, setExecutionInput] = useState('');
  const memoryKey = `projectExecutions:${projectId || 'unknown'}`;
  const saveTimerRef = useRef<number | null>(null);

  const selectedExecution = useMemo(
    () => executions.find(execution => execution.id === selectedExecutionId) || null,
    [executions, selectedExecutionId],
  );

  useEffect(() => {
    let cancelled = false;
    setExecutionsLoaded(false);
    memoryApi.get()
      .then(response => {
        if (cancelled) return;
        const savedExecutions = response.memory?.[memoryKey];
        setExecutions(Array.isArray(savedExecutions) ? savedExecutions as Execution[] : []);
        setExecutionsLoaded(true);
      })
      .catch(err => {
        if (cancelled) return;
        console.error('Failed to load executions from AWS:', err);
        setExecutions([]);
      });

    return () => {
      cancelled = true;
    };
  }, [memoryKey]);

  useEffect(() => {
    if (!executionsLoaded) return;
    if (saveTimerRef.current) {
      window.clearTimeout(saveTimerRef.current);
    }
    saveTimerRef.current = window.setTimeout(() => {
      memoryApi.update({ [memoryKey]: executions }).catch(err => {
        console.error('Failed to save executions to AWS:', err);
      });
    }, 500);

    return () => {
      if (saveTimerRef.current) {
        window.clearTimeout(saveTimerRef.current);
      }
    };
  }, [executions, executionsLoaded, memoryKey]);

  function launchExecution(event: FormEvent) {
    event.preventDefault();
    const pipeline = PIPELINES.find(item => item.action === selectedPipeline) || PIPELINES[0];
    const now = Date.now();
    const execution: Execution = {
      id: `exec_${now.toString(36)}`,
      serviceName: pipeline.serviceName,
      action: pipeline.action,
      triggeredBy: 'Current user',
      duration: 'Running',
      status: 'running',
      timestamp: now,
      logs: [
        `[${new Date(now).toLocaleTimeString()}] queued ${pipeline.action}`,
        executionInput.trim()
          ? `[input] ${executionInput.trim()}`
          : '[input] no additional execution parameters supplied',
        '[runner] waiting for backend execution runner attachment',
      ],
    };
    setExecutions(current => [execution, ...current]);
    setSelectedExecutionId(execution.id);
    setExecutionInput('');
    setModalOpen(false);
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-lg font-semibold text-zinc-900 dark:text-white">Executions & Runs</h1>
          <p className="mt-1 text-sm text-zinc-500 dark:text-zinc-400">
            Trigger and monitor Web3 service runs for project {projectId}.
          </p>
        </div>
        <button
          onClick={() => setModalOpen(true)}
          className="inline-flex h-9 items-center gap-2 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white transition hover:bg-zinc-800 dark:bg-white dark:text-zinc-900"
        >
          <Play className="h-3.5 w-3.5" />
          New Execution
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <Metric label="Total Runs" value={String(executions.length)} />
        <Metric label="Running" value={String(executions.filter(item => item.status === 'running').length)} />
        <Metric label="Succeeded" value={String(executions.filter(item => item.status === 'success').length)} />
        <Metric label="Failed" value={String(executions.filter(item => item.status === 'failed').length)} />
      </div>

      <div className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-[#080809]">
        {executions.length === 0 ? (
          <div className="flex flex-col items-center justify-center px-4 py-16 text-center">
            <Terminal className="h-10 w-10 text-zinc-300 dark:text-zinc-600" />
            <h2 className="mt-3 text-sm font-semibold text-zinc-900 dark:text-white">No executions yet</h2>
            <p className="mt-1 max-w-md text-xs text-zinc-500">
              Launch a service execution when a customer project is ready to run a Web3 pipeline or agent task.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-left">
              <thead className="border-b border-zinc-100 text-[10px] uppercase tracking-wide text-zinc-400 dark:border-zinc-800">
                <tr>
                  <th className="px-4 py-3 font-semibold">Execution ID</th>
                  <th className="px-4 py-3 font-semibold">Service</th>
                  <th className="px-4 py-3 font-semibold">Action</th>
                  <th className="px-4 py-3 font-semibold">Triggered By</th>
                  <th className="px-4 py-3 font-semibold">Duration</th>
                  <th className="px-4 py-3 font-semibold">Status</th>
                  <th className="px-4 py-3 font-semibold">Timestamp</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-100 dark:divide-zinc-800">
                {executions.map(execution => (
                  <tr
                    key={execution.id}
                    onClick={() => setSelectedExecutionId(execution.id)}
                    className="cursor-pointer text-xs text-zinc-650 transition hover:bg-zinc-50 dark:text-zinc-300 dark:hover:bg-zinc-900/60"
                  >
                    <td className="px-4 py-3 font-mono text-[11px] text-zinc-500">{execution.id}</td>
                    <td className="px-4 py-3 font-medium text-zinc-900 dark:text-white">{execution.serviceName}</td>
                    <td className="px-4 py-3">{execution.action}</td>
                    <td className="px-4 py-3">{execution.triggeredBy}</td>
                    <td className="px-4 py-3">{execution.duration}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex rounded-full px-2 py-0.5 text-[10px] font-semibold ${statusClass(execution.status)}`}>
                        {statusLabel(execution.status)}
                      </span>
                    </td>
                    <td className="px-4 py-3">{new Date(execution.timestamp).toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {selectedExecution && (
        <div className="fixed inset-y-0 right-0 z-40 w-full max-w-xl border-l border-zinc-200 bg-white shadow-2xl dark:border-zinc-800 dark:bg-[#080809]">
          <div className="flex items-center justify-between border-b border-zinc-100 px-5 py-4 dark:border-zinc-800">
            <div>
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">{selectedExecution.action}</h2>
              <p className="mt-0.5 text-xs text-zinc-500">{selectedExecution.id}</p>
            </div>
            <button onClick={() => setSelectedExecutionId(null)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-white">
              <X className="h-4 w-4" />
            </button>
          </div>
          <div className="m-5 rounded-lg border border-zinc-900 bg-zinc-950 p-4 font-mono text-[11px] leading-relaxed text-green-300">
            {selectedExecution.logs.map((line, index) => (
              <div key={`${line}_${index}`}>{line}</div>
            ))}
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <button className="absolute inset-0 bg-black/50 backdrop-blur-sm" onClick={() => setModalOpen(false)} aria-label="Close execution modal" />
          <form onSubmit={launchExecution} className="relative w-full max-w-lg rounded-lg border border-zinc-200 bg-white p-5 shadow-2xl dark:border-zinc-800 dark:bg-[#080809]">
            <div className="mb-4 flex items-center justify-between border-b border-zinc-100 pb-3 dark:border-zinc-800">
              <h2 className="text-sm font-semibold text-zinc-900 dark:text-white">Launch Execution</h2>
              <button type="button" onClick={() => setModalOpen(false)} className="rounded-md p-1 text-zinc-400 hover:bg-zinc-100 hover:text-zinc-900 dark:hover:bg-zinc-900 dark:hover:text-white">
                <X className="h-4 w-4" />
              </button>
            </div>
            <div className="space-y-4">
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Pipeline</span>
                <select value={selectedPipeline} onChange={event => setSelectedPipeline(event.target.value)} className="h-9 w-full rounded-md border border-zinc-200 bg-white px-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100">
                  {PIPELINES.map(pipeline => <option key={pipeline.action} value={pipeline.action}>{pipeline.serviceName} - {pipeline.action}</option>)}
                </select>
              </label>
              <label className="block">
                <span className="mb-1 block text-xs font-semibold text-zinc-600 dark:text-zinc-400">Execution Inputs</span>
                <textarea value={executionInput} onChange={event => setExecutionInput(event.target.value)} rows={5} className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-xs outline-none dark:border-zinc-800 dark:bg-zinc-950 dark:text-zinc-100" />
              </label>
              <button type="submit" className="inline-flex h-9 w-full items-center justify-center gap-2 rounded-md bg-zinc-900 px-3 text-xs font-medium text-white hover:bg-zinc-800 dark:bg-white dark:text-zinc-900">
                <Zap className="h-3.5 w-3.5" />
                Launch Run
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-lg border border-zinc-200 bg-white p-4 dark:border-zinc-800 dark:bg-[#080809]">
      <p className="text-xs font-medium text-zinc-500">{label}</p>
      <p className="mt-3 text-xl font-semibold text-zinc-900 dark:text-white">{value}</p>
    </div>
  );
}
