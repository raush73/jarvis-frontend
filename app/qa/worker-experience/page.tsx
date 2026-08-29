"use client";

/**
 * QA-L3 - the staff entry point for the QA worker experience launcher.
 *
 * A thin route, as every staff page here is: the surface is the component, and this file's only job
 * is to say where it lives. Reached by URL rather than from a navigation menu, deliberately - the
 * global staff navigation is filtered by MODULE, not by grant, so a menu entry would advertise a QA
 * facility to every signed-in staff member the server then refuses.
 */

import QaWorkerExperienceLauncher from "@/components/workforce/qa/QaWorkerExperienceLauncher";

export default function QaWorkerExperiencePage() {
  return <QaWorkerExperienceLauncher />;
}
