import { useState } from 'react';
import { getConfiguredAiEndpoint, setConfiguredAiEndpoint, testAiEndpoint } from '../../services/classificationService';
import { Button } from '../ui/Button';
import { useToast } from '../ui/Dialog';

/**
 * The "access point to the AI" the request asked for: a real UI to
 * configure, test, and swap the classification endpoint at runtime,
 * with no code changes needed elsewhere — see
 * classificationService.createClassificationService(), which reads
 * whatever's saved here. Ships with no endpoint configured, which
 * means the app runs on StubClassificationService (always requests
 * manual review) until you deploy ai-service and point this at it.
 */
export function SettingsScreen() {
  const [endpoint, setEndpoint] = useState(getConfiguredAiEndpoint() ?? '');
  const [testing, setTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; detail: string } | null>(null);
  const toast = useToast();
  const isConfigured = !!getConfiguredAiEndpoint();

  async function handleTest() {
    if (!endpoint.trim()) return;
    setTesting(true);
    setTestResult(null);
    const result = await testAiEndpoint(endpoint.trim());
    setTestResult(result);
    setTesting(false);
  }

  function save() {
    setConfiguredAiEndpoint(endpoint.trim() || null);
    toast.success(endpoint.trim() ? 'AI endpoint saved — now used for new reports.' : 'AI endpoint cleared — back to manual review for every report.');
  }

  return (
    <div className="h-full overflow-y-auto px-4 pb-24 pt-5 sm:px-6">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-2xl font-extrabold text-white">Settings</h1>
        <p className="mt-1 text-[13px] text-muted">Configure the classification service and see how the app is currently behaving.</p>

        {/* Current status banner */}
        <div
          className="mt-5 flex items-center gap-3 rounded-xl border px-4 py-3"
          style={{
            borderColor: isConfigured ? '#4DD9E866' : '#D9AF5266',
            backgroundColor: isConfigured ? '#4DD9E814' : '#D9AF5214',
          }}
        >
          <span className="h-2 w-2 shrink-0 rounded-full" style={{ backgroundColor: isConfigured ? '#4DD9E8' : '#D9AF52' }} />
          <p className="text-[12.5px]" style={{ color: isConfigured ? '#4DD9E8' : '#D9AF52' }}>
            {isConfigured
              ? 'AI classification is active — new reports get a suggested category.'
              : 'No AI endpoint configured — every report currently requires manual category selection. This is a safe default, not an error state.'}
          </p>
        </div>

        {/* Endpoint config card */}
        <div className="mt-4 rounded-2xl border border-cyanDark/30 bg-panel p-4">
          <label className="text-[11px] font-bold uppercase tracking-wide text-muted">AI service URL</label>
          <div className="mt-2 flex gap-2">
            <input
              value={endpoint}
              onChange={(e) => setEndpoint(e.target.value)}
              placeholder="https://your-nagrik-ai.onrender.com"
              className="flex-1 rounded-lg border border-cyanDark/40 bg-panelAlt px-3 py-2.5 text-[13px] text-white placeholder:text-mutedDark outline-none focus:border-cyan"
            />
          </div>
          <p className="mt-2 text-[11.5px] leading-relaxed text-muted">
            Points at the FastAPI service in <code className="rounded bg-panelAlt px-1 py-0.5 text-cyan">/ai-service</code> — the
            two-stage safety-filter + zero-shot classification pipeline from the pitch.
          </p>

          {testResult && (
            <div
              className="mt-3 rounded-lg border px-3 py-2 text-[12px]"
              style={{
                borderColor: testResult.ok ? '#6FCF9766' : '#E85D5D66',
                backgroundColor: testResult.ok ? '#6FCF9714' : '#E85D5D14',
                color: testResult.ok ? '#6FCF97' : '#E85D5D',
              }}
            >
              {testResult.detail}
            </div>
          )}

          <div className="mt-3 flex gap-2.5">
            <Button label="Test Connection" outlined loading={testing} onClick={handleTest} />
            <Button label="Save" onClick={save} />
          </div>
        </div>

        {/* Setup guidance */}
        <div className="mt-6 rounded-2xl border border-cyanDark/30 bg-panel p-4">
          <h2 className="text-[14px] font-bold text-white">Setting this up</h2>
          <ol className="mt-3 flex flex-col gap-3">
            <SetupStep n={1} title="Deploy the AI service">
              Push <code className="rounded bg-panelAlt px-1 py-0.5 text-cyan">/ai-service</code> to Render or Railway's free
              tier (CPU instance is fine — the model choices in the pitch were picked to run without a GPU).
            </SetupStep>
            <SetupStep n={2} title="Paste its URL above and test it">
              "Test Connection" hits the service's <code className="rounded bg-panelAlt px-1 py-0.5 text-cyan">/health</code> route
              — a green result means it's really reachable, not just a plausible-looking URL.
            </SetupStep>
            <SetupStep n={3} title="Define what 'working well' means before you trust it">
              Track these from day one, using the Activity feed as your raw data: (a) what fraction of predictions get
              corrected by users on the confirm step — a high correction rate means the categories or prompts need
              tuning; (b) how often <span className="text-gold">needsManualReview</span> fires — too often and the
              confidence-gap threshold may be too strict; (c) false "not a civic issue" rejections — real reports the
              model wrongly waved off. None of these need fancy tooling to start: the Activity log already gives you
              the raw counts to eyeball weekly.
            </SetupStep>
            <SetupStep n={4} title="Only then, consider loosening the human-confirms-everything default">
              The app is designed to work correctly with zero trust in the model — confirmed categories are always a
              human's final say. Automating that further is a deliberate, later decision, not a default.
            </SetupStep>
          </ol>
        </div>
      </div>
    </div>
  );
}

function SetupStep({ n, title, children }: { n: number; title: string; children: React.ReactNode }) {
  return (
    <li className="flex gap-3">
      <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-cyan/15 text-[11px] font-bold text-cyan">
        {n}
      </span>
      <div>
        <p className="text-[13px] font-semibold text-white">{title}</p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-muted">{children}</p>
      </div>
    </li>
  );
}
