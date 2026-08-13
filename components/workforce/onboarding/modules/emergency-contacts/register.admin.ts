/**
 * Module 4.7 - the staff registration barrel.
 *
 * The whole of this capsule's connection to the Phase 2 administrative workspace. The workspace
 * holds no list of modules and no switch over module keys; it learns Module 4.7 has a panel
 * because this file ran and said so. No workspace file changed to accommodate it.
 *
 * SEPARATE FROM `register.worker.ts` ON PURPOSE. This file pulls in the read-only review panel
 * and nothing else, and the worker barrel pulls in the editing screen and nothing else, so the
 * administrative bundle never contains the worker's Save path and the worker bundle never
 * contains the administrative read.
 *
 * The panel is registered as an ELEMENT factory: the workspace invokes a registered panel
 * conditionally, so a panel that called hooks in the registered function's own body would run
 * them as part of the workspace's render rather than its own.
 */

import { createElement } from "react";
import { registerOnboardingAdminPanel } from "@/components/workforce/admin/adminPanelRegistry";
import EmergencyContactsReviewPanel from "./EmergencyContactsReviewPanel";

/** The registry key the platform knows Module 4.7 by, stated by the module itself. */
export const EMERGENCY_CONTACT_MODULE_KEY = "EMERGENCY_CONTACT";

registerOnboardingAdminPanel(EMERGENCY_CONTACT_MODULE_KEY, (props) =>
  createElement(EmergencyContactsReviewPanel, props),
);
