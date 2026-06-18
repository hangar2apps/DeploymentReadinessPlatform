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
// AI chat (commander + policy) can stay mocked while the data endpoints go
// live — e.g. before OPENAI_API_KEY is configured on the backend. Defaults to
// USE_MOCKS unless VITE_MOCK_AI is set explicitly.
export const MOCK_AI =
  env.VITE_MOCK_AI != null ? env.VITE_MOCK_AI !== 'false' : USE_MOCKS;
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

// Resolve the real (UUID) service member from the stable EDIPI natural key.
// Personas carry a fixture id that isn't a DB UUID, so anything that writes
// against the backend (assessment submit, my-assessment lookup) must resolve the
// real row by EDIPI first. In mock mode the fixture id is already correct.
export async function getServiceMemberByEdipi(
  edipi: string,
): Promise<ServiceMember | null> {
  if (USE_MOCKS) return mock(fx.serviceMembers.find((m) => m.edipi === edipi) ?? null);
  const all = await http<ServiceMember[]>('/api/service-members');
  return all.find((m) => m.edipi === edipi) ?? null;
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

// Current-cycle assessment for the landing screen. The backend has no dedicated
// route; the member-detail endpoint returns the member with their assessments
// (newest first), so we take the most recent.
export async function getMyAssessment(
  memberId: string,
): Promise<Assessment | null> {
  if (USE_MOCKS) return mock(fx.myAssessments[memberId] ?? null);
  const member = await http<{ assessments?: Assessment[] }>(
    `/api/service-members/${memberId}`,
  );
  return member.assessments?.[0] ?? null;
}

// ---- Service-member record uploads ------------------------------------------
export type RecordType =
  | 'immunization'
  | 'dental'
  | 'vision'
  | 'medical'
  | 'other';

// Supabase per-file limit; validated client-side too for instant feedback.
export const MAX_UPLOAD_BYTES = 50 * 1024 * 1024;

export interface UploadResult {
  path: string;
  bucket: string;
}

// Multipart upload to the gateway, which stores the file in the Supabase bucket
// at <member_id>/<record_type>/<uuid>. Raw fetch (not http()) so the browser
// sets the multipart boundary itself.
export function uploadRecord(
  memberId: string,
  recordType: RecordType,
  file: File,
): Promise<UploadResult> {
  if (USE_MOCKS) {
    return mock(
      { path: `${memberId}/${recordType}/mock-${file.name}`, bucket: 'mock' },
      400,
    );
  }
  const form = new FormData();
  form.append('file', file);
  form.append('member_id', memberId);
  return fetch(`${API_URL}/api/uploads/${recordType}`, {
    method: 'POST',
    body: form,
    signal: AbortSignal.timeout(120_000),
  }).then(async (res) => {
    if (!res.ok) {
      const msg = await res.text().catch(() => '');
      throw new Error(`upload failed: ${res.status} ${msg}`.trim());
    }
    return res.json() as Promise<UploadResult>;
  });
}

export function uploadImmunizationRecord(
  memberId: string,
  file: File,
): Promise<UploadResult> {
  return uploadRecord(memberId, 'immunization', file);
}

// ---- Draft persistence ------------------------------------------------------
// In-progress answers, localStorage only. No backend draft endpoint exists yet;
// when one lands (create-draft -> PATCH responses -> submit), implement it here
// and the page is unchanged. `id` will carry the server assessment row then.
export interface AssessmentDraft {
  id?: string;
  step: number;
  responses: AssessmentResponses;
  photoName: string | null;
}

const DRAFT_PREFIX = 'drp.assessment-draft.';
const draftKey = (memberId: string) => `${DRAFT_PREFIX}${memberId}`;

export function loadDraft(memberId: string): Promise<AssessmentDraft | null> {
  const raw = localStorage.getItem(draftKey(memberId));
  if (!raw) return Promise.resolve(null);
  try {
    return Promise.resolve(JSON.parse(raw) as AssessmentDraft);
  } catch {
    return Promise.resolve(null);
  }
}

export function saveDraft(
  memberId: string,
  draft: AssessmentDraft,
): Promise<void> {
  localStorage.setItem(draftKey(memberId), JSON.stringify(draft));
  return Promise.resolve();
}

export function clearDraft(memberId: string): Promise<void> {
  localStorage.removeItem(draftKey(memberId));
  return Promise.resolve();
}

// Drop every member's draft — used on logout so mental-health PHI doesn't
// linger in localStorage on a shared machine.
export function clearAllDrafts(): void {
  for (let i = localStorage.length - 1; i >= 0; i--) {
    const k = localStorage.key(i);
    if (k?.startsWith(DRAFT_PREFIX)) localStorage.removeItem(k);
  }
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
  if (MOCK_AI) return mock(fx.mockCommanderChat(question), 600);
  return http('/api/commander/chat', { method: 'POST', body: JSON.stringify({ question, unit_id: unitId }) });
}

// Provider policy chat (RAG over policy docs). The real endpoint streams tokens
// via SSE; this returns the full answer for now. When wiring streaming, add a
// separate policyChatStream(question, onToken) using EventSource and keep this
// for the non-streaming fallback.
export function policyChat(question: string): Promise<PolicyChatResponse> {
  if (MOCK_AI) return mock(fx.mockPolicyChat(question), 600);
  return http('/api/policy-chat', { method: 'POST', body: JSON.stringify({ question }) });
}
