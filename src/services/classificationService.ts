import type { ReportCategory } from '../types/report';

export interface ClassificationResult {
  passedSafetyFilter: boolean;
  predictedCategory: ReportCategory;
  confidence: number; // 0-1
  needsManualReview: boolean;
  /** BLIP-generated free-text caption of the photo ("a pothole in the
   * middle of a paved road"), separate from the category label —
   * null when safety-rejected, classified not_an_issue, or the
   * captioning model itself failed (main.py degrades gracefully
   * rather than failing the whole request over a caption). */
  description: string | null;
}

export interface ClassificationService {
  classify(photo: File): Promise<ClassificationResult>;
  /** CLIP image embedding for the visual half of duplicate detection
   * (paired with GPS proximity server-side — see reports.ts
   * /nearby-similar). Returns null when no real AI endpoint is
   * configured, so callers fall back to GPS-only duplicate checks
   * instead of breaking. */
  embed(photo: File): Promise<number[] | null>;
}

/**
 * Same honest seam as the Flutter version: the real two-stage pipeline
 * (opennsfw2 safety gate + OpenCLIP zero-shot category scoring, per the
 * Tech Stack slide) is a separate backend service, not something that
 * runs in the browser. This stub always requests manual review, so the
 * app's real behavior — a human always confirms the category before
 * anything publishes — is correct even before the inference service
 * exists. Swap in HttpClassificationService once it's deployed.
 */
export class StubClassificationService implements ClassificationService {
  async classify(_photo: File): Promise<ClassificationResult> {
    await new Promise((r) => setTimeout(r, 400));
    return {
      passedSafetyFilter: true,
      predictedCategory: 'other',
      confidence: 0,
      needsManualReview: true,
      description: null,
    };
  }

  async embed(_photo: File): Promise<number[] | null> {
    return null;
  }
}

/**
 * The real implementation, to be pointed at the inference service from
 * the architecture slide: Node/Python API → OpenCLIP + opennsfw2,
 * deployed free on Render/Railway. Left as a documented contract rather
 * than guessed at, since the exact request/response shape depends on
 * how that service ends up being built.
 */
export class HttpClassificationService implements ClassificationService {
  constructor(private endpointUrl: string) {}

  async classify(photo: File): Promise<ClassificationResult> {
    const form = new FormData();
    form.append('photo', photo);
    const res = await fetch(`${this.endpointUrl.replace(/\/$/, '')}/classify`, { method: 'POST', body: form });
    if (!res.ok) throw new Error(`Classification request failed: ${res.status}`);
    return (await res.json()) as ClassificationResult;
  }

  async embed(photo: File): Promise<number[] | null> {
    const form = new FormData();
    form.append('photo', photo);
    try {
      const res = await fetch(`${this.endpointUrl.replace(/\/$/, '')}/embed`, { method: 'POST', body: form });
      if (!res.ok) return null;
      const data = (await res.json()) as { embedding: number[] };
      return data.embedding;
    } catch {
      // Duplicate detection degrading to GPS-only is an acceptable
      // fallback — it should never block report submission.
      return null;
    }
  }
}

/* ---------------- Runtime configuration (the "access point to the AI") ---------------- */

const AI_ENDPOINT_KEY = 'nagrik.aiEndpoint.v1';

export function getConfiguredAiEndpoint(): string | null {
  return localStorage.getItem(AI_ENDPOINT_KEY);
}

export function setConfiguredAiEndpoint(url: string | null) {
  if (url) localStorage.setItem(AI_ENDPOINT_KEY, url);
  else localStorage.removeItem(AI_ENDPOINT_KEY);
  window.dispatchEvent(new CustomEvent('nagrik:ai-endpoint-changed'));
}

/** Health-checks a candidate ai-service URL by hitting its /health route
 * (see ai-service/main.py) — used by the Settings screen's "Test
 * Connection" button so configuring the endpoint gives real feedback
 * instead of silently accepting any string. */
export async function testAiEndpoint(url: string): Promise<{ ok: boolean; detail: string }> {
  try {
    const res = await fetch(`${url.replace(/\/$/, '')}/health`, { signal: AbortSignal.timeout(6000) });
    if (!res.ok) return { ok: false, detail: `Responded with HTTP ${res.status}` };
    const data = await res.json();
    return { ok: true, detail: data.device ? `Connected — running on ${data.device}` : 'Connected' };
  } catch (e) {
    return { ok: false, detail: e instanceof Error ? e.message : 'Could not reach endpoint' };
  }
}

/** Picks Http vs Stub automatically based on whether the endpoint has
 * been configured from the Settings screen — this is what makes the
 * Settings UI actually take effect app-wide without any other code
 * needing to change. */
export function createClassificationService(): ClassificationService {
  const endpoint = getConfiguredAiEndpoint();
  return endpoint ? new HttpClassificationService(endpoint) : new StubClassificationService();
}
