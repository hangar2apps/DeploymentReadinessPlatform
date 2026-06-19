// Mock auth: seeded login personas. No real auth (DRP_SPEC §5 WON'T). The active
// persona id is persisted to localStorage by RoleContext and drives which surface
// + which seeded person/unit the app operates as. A role can have more than one
// persona (e.g. two service members in different assessment states), so PERSONAS
// is keyed by a unique persona id rather than by role.

export type Role = 'service_member' | 'provider' | 'commander';

export interface Persona {
  id: string; // unique login id (localStorage key + login-card key)
  role: Role;
  label: string; // role label
  blurb: string; // one-line surface description (login card)
  name: string; // display name
  rank: string;
  edipi: string; // stable natural key — resolves to the real service_members.id
  member_id: string; // fixture service_members.id (mock mode + local draft key)
  unit_id: string; // unit the surface scopes to
  unit_label: string;
  route: string; // landing route for this role
}

export const PERSONAS: Record<string, Persona> = {
  rodriguez: {
    id: 'rodriguez',
    role: 'service_member',
    label: 'Service Member',
    blurb: 'New pre-deployment health assessment',
    name: 'Rodriguez, Luis M.',
    rank: 'SPC',
    edipi: '2000000001',
    member_id: 'sm-rodriguez',
    unit_id: 'unit-a',
    unit_label: 'A CO',
    route: '/assessment',
  },
  dalton: {
    id: 'dalton',
    role: 'service_member',
    label: 'Service Member',
    blurb: 'Returning — post-deployment health assessment',
    name: 'Dalton, Wayne E.',
    rank: 'SGM',
    edipi: '1000000004',
    member_id: 'sm-dalton',
    unit_id: 'unit-hhc',
    unit_label: 'HHC',
    route: '/assessment',
  },
  chen: {
    id: 'chen',
    role: 'provider',
    label: 'Provider',
    blurb: 'Review red flags, certify and refer assessments',
    name: 'Chen, Michael A.',
    rank: 'CPT',
    edipi: '1000000002',
    member_id: 'sm-chen',
    unit_id: 'unit-bn',
    unit_label: '1-327 IN',
    route: '/provider',
  },
  harris: {
    id: 'harris',
    role: 'commander',
    label: 'Commander',
    blurb: 'Battalion readiness dashboard and CUB brief',
    name: 'Harris, Robert J.',
    rank: 'LTC',
    edipi: '1000000001',
    member_id: 'sm-harris',
    // The commander scopes to the battalion = top of the hierarchy, which is the
    // backend's default when unit_id is omitted. Empty so the API client drops
    // the param (real UUIDs are generated server-side; no hardcoded id to send).
    unit_id: '',
    unit_label: '1-327 IN',
    route: '/commander',
  },
};

// Display order of the login cards / dev role-switcher (mock mode).
export const LOGIN_ORDER: string[] = ['rodriguez', 'dalton', 'chen', 'harris'];

// Surface display order — used to list the surfaces a multi-role user can reach.
export const ROLE_ORDER: Role[] = ['service_member', 'provider', 'commander'];

// Highest-privilege first — used to pick a multi-role user's default surface.
const ROLE_PRIORITY: Role[] = ['commander', 'provider', 'service_member'];

export function primaryRole(roles: Role[]): Role | null {
  for (const r of ROLE_PRIORITY) if (roles.includes(r)) return r;
  return null;
}

// The seeded persona that supplies a role's cosmetic surface details (label,
// blurb, route). With PERSONAS keyed by persona id, this is the first persona
// declared for the role — used for real-mode identity and the sidebar surface list.
export function personaForRole(role: Role): Persona {
  const p = Object.values(PERSONAS).find((x) => x.role === role);
  if (!p) throw new Error(`no persona seeded for role ${role}`);
  return p;
}
