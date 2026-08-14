/**
 * Module 4.1 - the worker registration barrel.
 *
 * The whole of this capsule's connection to the delivered runtime. The runtime holds no list of
 * modules and no branch over module names; it learns this module exists because this file ran and
 * said so, exactly as the registry was designed for. Nothing in the runtime changed to accommodate
 * this module, and the only edit outside this directory is the side-effect import of this file.
 *
 * The renderer returns an ELEMENT rather than calling the component as a function. That is
 * load-bearing: the host invokes a renderer conditionally, so hooks called inside a renderer's own
 * body would belong to the host and would run in a different order between renders. As an element,
 * the module is a component with its own honest lifecycle.
 *
 * WORKER ONLY. There is no staff registration beside this one, because the MW4H examination and
 * certification experience is not this gate's to build and no part of it exists in this capsule.
 */

import { createElement } from "react";
import { registerOnboardingModuleRenderer } from "@/components/workforce/onboarding/runtime/moduleRegistry";
import { EMPLOYMENT_ELIGIBILITY_MODULE_KEY } from "@/lib/workforce/employmentEligibilityApi";
import EmploymentEligibilityModule from "./EmploymentEligibilityModule";

registerOnboardingModuleRenderer(EMPLOYMENT_ELIGIBILITY_MODULE_KEY, (props) =>
  createElement(EmploymentEligibilityModule, props),
);
