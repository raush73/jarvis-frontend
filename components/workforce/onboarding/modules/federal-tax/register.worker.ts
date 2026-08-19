/**
 * Module 4.2 - the worker registration barrel.
 *
 * The whole of this capsule's connection to the delivered runtime. The runtime holds no list of
 * modules and no branch over module names; it learns this module exists because this file ran and
 * said so, exactly as the registry was designed for. Nothing in the runtime, the navigation or the
 * status layer was changed to accommodate this module, and the only edit outside this directory is
 * the side-effect import of this file.
 *
 * The renderer returns an ELEMENT rather than calling the component as a function. That is
 * load-bearing: the host invokes a renderer conditionally, so hooks called inside a renderer's own
 * body would belong to the host and would run in a different order between renders. As an element,
 * the module is a component with its own honest lifecycle.
 *
 * WORKER ONLY. There is no staff registration beside this one, because this module has no staff
 * surface at all: no queue, no panel, no administrative action and no reviewer experience exists in
 * this capsule for a registration to point at.
 */

import { createElement } from "react";
import { registerOnboardingModuleRenderer } from "@/components/workforce/onboarding/runtime/moduleRegistry";
import { FEDERAL_TAX_MODULE_KEY } from "@/lib/workforce/federalTaxApi";
import FederalTaxModule from "./FederalTaxModule";

registerOnboardingModuleRenderer(FEDERAL_TAX_MODULE_KEY, (props) =>
  createElement(FederalTaxModule, props),
);
