/**
 * Role-restricted administration APIs (partially implemented).
 *
 * Implemented: the audited cross-tenant profile read in `./router.ts`.
 *
 * Planned: university/building topology, meter assignments, occupancy sync,
 * anomaly review, and audited corrections (spec REQ-ADM-001, task T019).
 */
export { createAdministrationRouter } from "./router.js";
export type { AdministrationRuntime } from "./router.js";
