// Mock auth: three seeded personas, one per role. No real auth (DRP_SPEC §5
// WON'T). The active role is persisted to localStorage by RoleContext and
// drives which surface + which seeded person/unit the app operates as.

export type Role = 'service_member' | 'provider' | 'commander';

export interface Persona {
  role: Role;
  label: string; // role label
  blurb: string; // one-line surface description (login card)
  name: string; // display name
  rank: string;
  member_id: string; // service_members.id (seed)
  unit_id: string; // unit the surface scopes to
  unit_label: string;
  route: string; // landing route for this role
}

export const PERSONAS: Record<Role, Persona> = {
  service_member: {
    role: 'service_member',
    label: 'Service Member',
    blurb: 'Complete your deployment health assessment',
    name: 'Rodriguez, Luis M.',
    rank: 'SPC',
    member_id: 'sm-rodriguez',
    unit_id: 'unit-a',
    unit_label: 'A CO',
    route: '/assessment',
  },
  provider: {
    role: 'provider',
    label: 'Provider',
    blurb: 'Review red flags, certify and refer assessments',
    name: 'Chen, Michael A.',
    rank: 'CPT',
    member_id: 'sm-chen',
    unit_id: 'unit-bn',
    unit_label: '1-327 IN',
    route: '/provider',
  },
  commander: {
    role: 'commander',
    label: 'Commander',
    blurb: 'Battalion readiness dashboard and CUB brief',
    name: 'Harris, Robert J.',
    rank: 'LTC',
    member_id: 'sm-harris',
    // The commander scopes to the battalion = top of the hierarchy, which is the
    // backend's default when unit_id is omitted. Empty so the API client drops
    // the param (real UUIDs are generated server-side; no hardcoded id to send).
    unit_id: '',
    unit_label: '1-327 IN',
    route: '/commander',
  },
};

export const ROLE_ORDER: Role[] = ['service_member', 'provider', 'commander'];
