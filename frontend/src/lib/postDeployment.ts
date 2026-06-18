// Post-deployment (DD2796) deployment-experience options. Question text lives
// with the screens in components/assessment/deployment.tsx.

export const ENV_HAZARD_OPTIONS = [
  { value: 'burn_pits', label: 'Burn pits' },
  { value: 'contaminated_water', label: 'Contaminated water' },
  { value: 'industrial_chemicals', label: 'Industrial chemicals' },
  { value: 'sand_dust', label: 'Sand or dust' },
  { value: 'fuel_solvents', label: 'Fuels or solvents' },
];

export const TBI_SYMPTOM_OPTIONS = [
  { value: 'headaches', label: 'Headaches' },
  { value: 'memory_problems', label: 'Memory problems' },
  { value: 'difficulty_concentrating', label: 'Difficulty concentrating' },
  { value: 'ringing_ears', label: 'Ringing in the ears' },
  { value: 'dizziness', label: 'Dizziness' },
  { value: 'irritability', label: 'Irritability' },
];
