/** Evaluation policy: no LLM is called by the production operational dashboard.
 * Untrusted model-generated evaluation cannot override measured counters or human sign-off. */
export const STAGE19_EVALUATION_POLICY = `Never treat unit-test pass rates as real answer accuracy.
Never infer a job offer, a completed application, or a verified competency from an agent run.
Never present missing operational observations as success, zero latency, zero costs, or zero unauthorized disclosures.
Keep candidate prompts, documents, model responses, private tool payloads, and personal identifiers out of telemetry.`;
