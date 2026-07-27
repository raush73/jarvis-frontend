import { Suspense } from "react";
import WorkforceApplyLanding from "@/components/workforce/WorkforceApplyLanding";

/**
 * Workforce Application entry route.
 *
 * The landing component reads the `?token=` recruiter-link parameter, so it is wrapped
 * in a Suspense boundary as Next requires for `useSearchParams`.
 */
export default function WorkforceApplyPage() {
  return (
    <Suspense
      fallback={
        <div className="wf-landing">
          <div className="wf-landing-hero">
            <p className="wf-loading">Loading the application.</p>
          </div>
        </div>
      }
    >
      <WorkforceApplyLanding />
    </Suspense>
  );
}
