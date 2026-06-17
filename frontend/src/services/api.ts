// DRP API client — the single seam between the UI and the backend.
//
// Components call these functions, never fetch() or fixtures directly. While the
// gateway is being built we run in MOCK mode (returns data from fixtures.ts).
// To hit the real gateway, set VITE_USE_MOCKS=false (and optionally VITE_API_URL)
// in frontend/.env.local. Swapping a function from mock to real is a one-liner —
// the component contract never changes.
//
// Endpoint map: see team/TEAM_PLAN.md.

import type {
  Assessment,
  AssessmentResponses,
  AssessmentDetail,
  AssessmentListItem,
  AssessmentStatus,
  AssessmentType,
  CommanderChatResponse,
  CreateAssessmentInput,
  PolicyChatResponse,
  ReadinessRollup,
  RedFlagSummaryItem,
  ReferInput,
  ServiceMember,
  TrendPoint,
  Unit,
} from '../types/drp';
import * as fx from './fixtures';

const env = import.meta.env as Record<string, string | undefined>;
export const USE_MOCKS = env.VITE_USE_MOCKS !== 'false'; // mocks ON by default
const API_URL = env.VITE_API_URL ?? 'http://localhost:3000';

// Simulate a little latency so loading states are exercised in mock mode.
function mock<T>(data: T, ms = 250): Promise<T> {
  return new Promise((resolve) => setTimeout(() => resolve(structuredClone(data)), ms));
}

async function http<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    throw new Error(`${init?.method ?? 'GET'} ${path} failed: ${res.status}`);
  }
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | boolean | number | undefined>): string {
  const entries = Object.entries(params).filter(([, v]) => v !== undefined && v !== '');
  if (entries.length === 0) return '';
  return '?' + entries.map(([k, v]) => `${k}=${encodeURIComponent(String(v))}`).join('&');
}

// ---- Units ------------------------------------------------------------------

export function getUnits(): Promise<Unit[]> {
  if (USE_MOCKS) return mock(fx.units);
  return http('/api/units');
}

export function getUnit(id: string): Promise<Unit> {
  if (USE_MOCKS) return mock(fx.units.find((u) => u.id === id)!);
  return http(`/api/units/${id}`);
}

// ---- Service members --------------------------------------------------------

export function getServiceMembers(opts: { unit_id?: string; deployable?: boolean } = {}): Promise<ServiceMember[]> {
  if (USE_MOCKS) {
    let list = fx.serviceMembers;
    if (opts.unit_id) list = list.filter((m) => m.unit_id === opts.unit_id);
    if (opts.deployable !== undefined) list = list.filter((m) => m.deployable === opts.deployable);
    return mock(list);
  }
  return http(`/api/service-members${qs(opts)}`);
}

export function getServiceMember(id: string): Promise<ServiceMember> {
  if (USE_MOCKS) return mock(fx.serviceMembers.find((m) => m.id === id)!);
  return http(`/api/service-members/${id}`);
}

// ---- Assessments ------------------------------------------------------------

export function getAssessments(
  opts: { status?: AssessmentStatus; unit_id?: string; type?: AssessmentType } = {},
): Promise<AssessmentListItem[]> {
  if (USE_MOCKS) {
    let list = fx.assessmentList;
    if (opts.status) list = list.filter((a) => a.status === opts.status);
    if (opts.unit_id) list = list.filter((a) => a.unit.id === opts.unit_id);
    if (opts.type) list = list.filter((a) => a.type === opts.type);
    return mock(list);
  }
  return http(`/api/assessments${qs(opts)}`);
}

export function getAssessment(id: string): Promise<AssessmentDetail> {
  if (USE_MOCKS) return mock(fx.assessmentDetails[id]);
  return http(`/api/assessments/${id}`);
}

// Current-cycle assessment for the logged-in member (drives the landing
// screen). Returns null when nothing is open -> NOT_STARTED. No gateway route
// exists yet; the real shape would be GET /api/service-members/:id/assessment.
export function getMyAssessment(memberId: string): Promise<Assessment | null> {
  if (USE_MOCKS) return mock(fx.myAssessments[memberId] ?? null);
  return http(`/api/service-members/${memberId}/assessment`);
}

// ---- Draft persistence ------------------------------------------------------
// In-progress questionnaire answers. Backed by localStorage today; when the
// backend gains a draft endpoint (create-draft -> PATCH responses -> submit),
// swap these three impls and the page is unchanged. `id` carries the server
// assessment row once that exists.
export interface AssessmentDraft {
  id?: string;
  step: number;
  responses: AssessmentResponses;
  photoName: string | null;
}

const draftKey = (memberId: string) => `drp.assessment-draft.${memberId}`;

export function loadDraft(memberId: string): Promise<AssessmentDraft | null> {
  if (USE_MOCKS) {
    const raw = localStorage.getItem(draftKey(memberId));
    if (!raw) return mock(null, 0);
    try {
      return mock(JSON.parse(raw) as AssessmentDraft, 0);
    } catch {
      return mock(null, 0);
    }
  }
  return http(`/api/service-members/${memberId}/assessment-draft`);
}

export function saveDraft(
  memberId: string,
  draft: AssessmentDraft,
): Promise<void> {
  if (USE_MOCKS) {
    localStorage.setItem(draftKey(memberId), JSON.stringify(draft));
    return mock(undefined, 0);
  }
  return http(`/api/service-members/${memberId}/assessment-draft`, {
    method: 'PUT',
    body: JSON.stringify(draft),
  });
}

export function clearDraft(memberId: string): Promise<void> {
  if (USE_MOCKS) {
    localStorage.removeItem(draftKey(memberId));
    return mock(undefined, 0);
  }
  return http(`/api/service-members/${memberId}/assessment-draft`, {
    method: 'DELETE',
  });
}

export function createAssessment(input: CreateAssessmentInput): Promise<Assessment> {
  if (USE_MOCKS) {
    return mock({
      id: `as-${Date.now()}`,
      service_member_id: input.service_member_id,
      type: input.type,
      status: 'SUBMITTED' as AssessmentStatus,
      responses: input.responses,
      phq9_score: null,
      pcl5_score: null,
      submitted_at: new Date().toISOString(),
      certified_at: null,
      certified_by: null,
      referral_type: null,
      referral_notes: null,
    });
  }
  return http('/api/assessments', { method: 'POST', body: JSON.stringify(input) });
}

export function certifyAssessment(id: string): Promise<Assessment> {
  if (USE_MOCKS) {
    const a = fx.assessmentList.find((x) => x.id === id)!;
    return mock({ ...a, status: 'CERTIFIED', certified_at: new Date().toISOString() });
  }
  return http(`/api/assessments/${id}/certify`, { method: 'PATCH', body: '{}' });
}

export function referAssessment(id: string, input: ReferInput): Promise<Assessment> {
  if (USE_MOCKS) {
    const a = fx.assessmentList.find((x) => x.id === id)!;
    return mock({ ...a, status: 'REFERRED', ...input });
  }
  return http(`/api/assessments/${id}/refer`, { method: 'PATCH', body: JSON.stringify(input) });
}

// ---- Readiness --------------------------------------------------------------

export function getReadiness(unitId?: string): Promise<ReadinessRollup> {
  if (USE_MOCKS) return mock(fx.battalionReadiness);
  return http(`/api/readiness${qs({ unit_id: unitId })}`);
}

export function getReadinessTrend(unitId?: string, days = 90): Promise<TrendPoint[]> {
  if (USE_MOCKS) return mock(fx.readinessTrend);
  return http(`/api/readiness/trend${qs({ unit_id: unitId, days })}`);
}

export function getRedFlagSummary(unitId?: string): Promise<RedFlagSummaryItem[]> {
  if (USE_MOCKS) return mock(fx.redFlagSummary);
  return http(`/api/red-flags/summary${qs({ unit_id: unitId })}`);
}

// ---- AI chat ----------------------------------------------------------------

// Commander data chat (SQL -> LLM, HIPAA-constrained). Non-streaming.
export function commanderChat(question: string, unitId?: string): Promise<CommanderChatResponse> {
  if (USE_MOCKS) return mock(fx.mockCommanderChat(question), 600);
  return http('/api/commander/chat', { method: 'POST', body: JSON.stringify({ question, unit_id: unitId }) });
}

// Provider policy chat (RAG over policy docs). The real endpoint streams tokens
// via SSE; this returns the full answer for now. When wiring streaming, add a
// separate policyChatStream(question, onToken) using EventSource and keep this
// for the non-streaming fallback.
export function policyChat(question: string): Promise<PolicyChatResponse> {
  if (USE_MOCKS) return mock(fx.mockPolicyChat(question), 600);
  return http('/api/policy-chat', { method: 'POST', body: JSON.stringify({ question }) });
}
