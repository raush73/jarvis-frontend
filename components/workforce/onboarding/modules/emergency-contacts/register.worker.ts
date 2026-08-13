/**
 * Module 4.7 - the worker registration barrel.
 *
 * The whole of this capsule's connection to the Phase 1 runtime. The runtime holds no list of
 * modules and no switch over module names; it learns this module exists because this file ran
 * and said so, exactly as the registry was designed for. Nothing in the runtime changed to
 * accommodate Module 4.7.
 *
 * The renderer returns an ELEMENT rather than calling the component as a function. That is
 * load-bearing: the host invokes a renderer conditionally, so hooks called inside a renderer's
 * own body would belong to the host and would run in a different order between renders. As an
 * element, the module is a component with its own honest lifecycle.
 *
 * Imported for its side effect by the worker onboarding layout, and by nothing on the staff
 * side: this file pulls in the worker screen, and the staff panel is registered separately, so
 * neither bundle contains the other.
 */

import { createElement } from "react";
import { registerOnboardingModuleRenderer } from "@/components/workforce/onboarding/runtime/moduleRegistry";
import EmergencyContactsModule from "./EmergencyContactsModule";

/** The registry key the platform knows Module 4.7 by, stated by the module itself. */
export const EMERGENCY_CONTACT_MODULE_KEY = "EMERGENCY_CONTACT";

registerOnboardingModuleRenderer(EMERGENCY_CONTACT_MODULE_KEY, (props) =>
  createElement(EmergencyContactsModule, props),
);
