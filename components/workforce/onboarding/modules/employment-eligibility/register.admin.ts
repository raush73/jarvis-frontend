/**
 * Module 4.1 - the staff registration barrel.
 *
 * The whole of this capsule's connection to the delivered Phase 2 administrative workspace. The
 * workspace holds no list of modules and no switch over module keys; it learns Module 4.1 has a
 * panel because this file ran and said so. No workspace file changed to accommodate it.
 *
 * SEPARATE FROM `register.worker.ts` ON PURPOSE, following the delivered first-module precedent.
 * This file pulls in the review panel and nothing else, and the worker barrel pulls in the interview
 * and nothing else - so the administrative bundle never contains the worker's Save path, and the
 * worker bundle never contains the administrative read, the examination form, or the disclosure.
 *
 * The panel is registered as an ELEMENT factory: the workspace invokes a registered panel
 * conditionally, so a panel that called hooks in the registered function's own body would run them
 * as part of the workspace's render rather than its own.
 */

import { createElement } from "react";
import { registerOnboardingAdminPanel } from "@/components/workforce/admin/adminPanelRegistry";
import { EMPLOYMENT_ELIGIBILITY_MODULE_KEY } from "@/lib/workforce/employmentEligibilityApi";
import EmploymentEligibilityReviewPanel from "./EmploymentEligibilityReviewPanel";

registerOnboardingAdminPanel(EMPLOYMENT_ELIGIBILITY_MODULE_KEY, (props) =>
  createElement(EmploymentEligibilityReviewPanel, props),
);
