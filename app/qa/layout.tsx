"use client";

/**
 * QA-L3 - the QA facility layout.
 *
 * MOUNTED AT `/qa`, AND DELIBERATELY NOT INSIDE `/onboarding`. The QA worker experience launcher is
 * a `workforce.qa.*` facility rather than a `workforce.onboarding.*` one - the backend spells its
 * grant that way on purpose, and no onboarding permission implies it. The onboarding administrative
 * workspace admits an operator on `workforce.onboarding.admin.access`, which the QA grant holder is
 * not required to hold, so mounting this screen there would put an unrelated onboarding grant in
 * front of a QA capability the server authorizes on its own. That would be a frontend-invented
 * authorization, and the one thing a QA surface must never add.
 *
 * IT IS ALSO NOT UNDER `/workforce`, which is the WORKER runtime's root. The staff launcher and the
 * worker experience it opens are two different identities holding two different tokens, and keeping
 * them at separate roots is what makes that separation visible in the URL rather than only in a
 * guard file.
 *
 * THERE IS NO ADMISSION GATE HERE, AND THAT IS THE POINT. Rendering is not authorization: the
 * launcher itself declines to advertise a launch the operator holds no effective grant for, and
 * QA-L2 refuses every request regardless - the environment flag, the sensitive grant and the TEST
 * classification are all enforced server-side, per request. A gate here would add nothing except a
 * second, weaker copy of a rule that already exists in the right place.
 *
 * THE STYLESHEET IS THE DELIVERED ADMINISTRATIVE ONE, imported rather than copied: this screen uses
 * the delivered panel and field primitives, and a second stylesheet for them would be two places
 * for one appearance to drift.
 */

import type { ReactNode } from "react";
import "@/app/onboarding/onboarding-admin.css";

export default function QaFacilityLayout({ children }: { children: ReactNode }) {
  return <div className="oba-page">{children}</div>;
}
