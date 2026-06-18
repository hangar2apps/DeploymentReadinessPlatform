import type { AssessmentResponses } from '../../types/drp';
import type { ScreenDef, SetResponse } from './types';
import { QuestionScreen as Q } from './QuestionScreen';
import { Field } from './fields/Field';
import { YesNo } from './fields/YesNo';
import { NumberField } from './fields/NumberField';
import { CheckboxGroup } from './fields/CheckboxGroup';
import { controlClass } from './fields/fieldStyles';
import { ENV_HAZARD_OPTIONS, TBI_SYMPTOM_OPTIONS } from '../../lib/postDeployment';

// One screen per deployment-experience item (POST only), with conditional
// follow-ups gated on the yes/no answer — same one-question-per-screen pattern
// as the rest of the flow.
export function deploymentScreens(
  r: AssessmentResponses,
  set: SetResponse,
): ScreenDef[] {
  const bool = (k: string) => r[k] as boolean | undefined;
  const text = (k: string) => (r[k] as string) ?? '';
  const list = (k: string) => (r[k] as string[]) ?? [];
  const num = (k: string) => r[k] as number | undefined;
  const filled = (s: string) => s.trim().length > 0;

  return [
    {
      key: 'dep_blast',
      done:
        bool('blast_exposure') !== undefined &&
        (bool('blast_exposure') !== true || num('blast_count') != null),
      node: (
        <Q title="During this deployment, were you exposed to any blast or explosion?">
          <YesNo
            value={bool('blast_exposure')}
            onChange={(v) => set('blast_exposure', v)}
          />
          {bool('blast_exposure') === true && (
            <Field label="How many blast exposures?">
              <NumberField
                value={num('blast_count')}
                onChange={(v) => set('blast_count', v)}
                placeholder="0"
              />
            </Field>
          )}
        </Q>
      ),
    },
    {
      key: 'dep_wounded',
      done:
        bool('wounded') !== undefined &&
        (bool('wounded') !== true || filled(text('wounded_details'))),
      node: (
        <Q title="Were you wounded, injured, or hospitalized during this deployment?">
          <YesNo value={bool('wounded')} onChange={(v) => set('wounded', v)} />
          {bool('wounded') === true && (
            <Field label="Describe what happened">
              <textarea
                className={controlClass}
                rows={3}
                value={text('wounded_details')}
                onChange={(e) => set('wounded_details', e.target.value)}
              />
            </Field>
          )}
        </Q>
      ),
    },
    {
      key: 'dep_witnessed',
      done: bool('witnessed_casualty') !== undefined,
      node: (
        <Q title="Did you witness anyone being killed or seriously injured?">
          <YesNo
            value={bool('witnessed_casualty')}
            onChange={(v) => set('witnessed_casualty', v)}
          />
        </Q>
      ),
    },
    {
      key: 'dep_cbrn',
      done: bool('cbrn_exposure') !== undefined,
      node: (
        <Q title="Were you exposed to chemical, biological, or radiological agents?">
          <YesNo
            value={bool('cbrn_exposure')}
            onChange={(v) => set('cbrn_exposure', v)}
          />
        </Q>
      ),
    },
    {
      key: 'dep_env',
      done:
        bool('env_hazards') !== undefined &&
        (bool('env_hazards') !== true || list('env_hazard_types').length > 0),
      node: (
        <Q title="Were you exposed to environmental hazards such as burn pits, contaminated water, or industrial chemicals?">
          <YesNo
            value={bool('env_hazards')}
            onChange={(v) => set('env_hazards', v)}
          />
          {bool('env_hazards') === true && (
            <Field label="Select all that apply">
              <CheckboxGroup
                options={ENV_HAZARD_OPTIONS}
                value={list('env_hazard_types')}
                onChange={(v) => set('env_hazard_types', v)}
              />
            </Field>
          )}
        </Q>
      ),
    },
    {
      key: 'dep_tbi',
      done: true,
      node: (
        <Q title="Are you currently experiencing any of the following? Select all that apply.">
          <CheckboxGroup
            options={TBI_SYMPTOM_OPTIONS}
            value={list('tbi_symptoms')}
            onChange={(v) => set('tbi_symptoms', v)}
          />
        </Q>
      ),
    },
    {
      key: 'dep_concern',
      done:
        bool('deployment_health_concern') !== undefined &&
        (bool('deployment_health_concern') !== true ||
          filled(text('deployment_health_concern_details'))),
      node: (
        <Q title="Do you have any health concerns related to your deployment that you would like to discuss with a provider?">
          <YesNo
            value={bool('deployment_health_concern')}
            onChange={(v) => set('deployment_health_concern', v)}
          />
          {bool('deployment_health_concern') === true && (
            <Field label="Describe your concern">
              <textarea
                className={controlClass}
                rows={3}
                value={text('deployment_health_concern_details')}
                onChange={(e) =>
                  set('deployment_health_concern_details', e.target.value)
                }
              />
            </Field>
          )}
        </Q>
      ),
    },
  ];
}
