"use client";

/**
 * Module 4.7 - the authorized staff review panel.
 *
 * A PANEL inside the Phase 2 worker workspace, registered under this module's key, exactly as
 * the workspace was designed for: no second administrative shell, no route of its own, and no
 * change to the workspace to accommodate it.
 *
 * IT IS READ ONLY, and structurally so. There is no save, no edit, no reorder, no
 * deactivation, no designation change, and no action of any kind on this surface - because the
 * server offers none. Emergency contacts are worker-maintained; MW4H reviews them, and a
 * deficiency is RETURNED to the worker for him to correct rather than corrected on his behalf
 * (architecture 4.7.8, 4.7.10). Nothing here acts for a worker.
 *
 * IT RENDERS NOTHING WITHOUT THE GRANT, and asks for nothing either. An absent panel invites no
 * request the server will refuse, and a disabled one would still disclose that this worker has
 * recorded contacts.
 *
 * VALUES ARE SHOWN IN FULL (owner decision 6-3). An emergency contact nobody can call is not a
 * safeguard; protection here is authorization plus the server-side audit of the read, neither
 * of which is a panel's business.
 *
 * HISTORY IS KEPT ON SCREEN. A superseded contact is not a mistake to be hidden: who MW4H would
 * have called at an earlier time is the point of retaining it (architecture 4.7.12).
 *
 * ON THE DUPLICATED LABELS BELOW. The worker capsule says these governed terms in its own
 * words too. They are stated again here rather than imported from it, deliberately: the staff
 * panel must not pull the worker's editing screen into the administrative bundle, and one
 * import for four labels would do exactly that.
 */

import { getStaffEmergencyContacts } from "@/lib/workforce/emergencyContactsApi";
import type { EmergencyContact } from "@/lib/workforce/emergencyContactsApi";
import type { OnboardingAdminPanelProps } from "@/components/workforce/admin/adminPanelRegistry";
import { useSession } from "@/lib/auth/useSession";
import { useOnboardingAdminPermissions } from "@/components/workforce/admin/adminPermissions";
import { useOnboardingAdminResource } from "@/components/workforce/admin/useOnboardingAdminResource";
import {
  OnboardingAdminEmpty,
  OnboardingAdminErrorNotice,
  OnboardingAdminLoading,
} from "@/components/workforce/admin/OnboardingAdminNotice";
import {
  OnboardingAdminPanel,
  OnboardingAdminTimestamp,
} from "@/components/workforce/admin/panels/DetailPanel";

const PRIORITY_LABELS: Record<string, string> = {
  PRIMARY: "Called first",
  SECONDARY: "Called second",
  TERTIARY: "Called third",
};

const RELATIONSHIP_LABELS: Record<string, string> = {
  SPOUSE: "Spouse",
  DOMESTIC_PARTNER: "Domestic partner",
  PARENT: "Parent",
  CHILD: "Child",
  SIBLING: "Sibling",
  OTHER_FAMILY_MEMBER: "Other family member",
  FRIEND: "Friend",
  OTHER: "Other",
};

const DESIGNATION_LABELS: Record<string, string> = {
  AUTHORIZED_TO_RECEIVE: "May be given information",
  NOTIFICATION_ONLY: "Notification only",
};

function label(labels: Record<string, string>, value: string): string {
  return labels[value] ?? value;
}

/** The address as it was recorded, on one line, or nothing where none was given. */
function addressOf(contact: EmergencyContact): string | null {
  const parts = [
    contact.addressLine1,
    contact.addressLine2,
    contact.city,
    contact.state,
    contact.postalCode,
  ].filter((part): part is string => Boolean(part && part.trim().length > 0));
  return parts.length > 0 ? parts.join(", ") : null;
}

export function EmergencyContactsReviewPanel({ worker }: OnboardingAdminPanelProps) {
  const session = useSession();
  const { canReadWorkers } = useOnboardingAdminPermissions(session);

  const { data, loading, error, reload } = useOnboardingAdminResource(
    () => getStaffEmergencyContacts(worker.candidateId),
    [worker.candidateId],
    { enabled: canReadWorkers },
  );

  if (!canReadWorkers) return null;

  const current = data?.current ?? null;
  // What is on the record now, and what it replaced. The split is by supersession, which the
  // server states on each contact; nothing here decides which is which.
  const superseded = (data?.history ?? []).filter(
    (contact) => contact.supersededAt !== null,
  );

  return (
    <OnboardingAdminPanel
      title="Emergency contacts"
      description="Who this worker asked us to call, in the order he set. Recorded by the worker and reviewed here; nothing on this panel changes his record."
    >
      {loading ? <OnboardingAdminLoading label="Loading emergency contacts" /> : null}
      {error ? <OnboardingAdminErrorNotice error={error} onRetry={reload} /> : null}

      {current && current.contacts.length === 0 ? (
        <OnboardingAdminEmpty
          title="This worker has recorded no emergency contacts."
          detail="There is nobody to call on his record."
        />
      ) : null}

      {current && current.contacts.length > 0 ? (
        <>
          <p className="oba-cell-detail" data-ec-set-version={current.setVersion}>
            Set version {current.setVersion} · effective{" "}
            <OnboardingAdminTimestamp value={current.effectiveFrom} /> ·{" "}
            {current.activeContactCount} active
          </p>
          <table className="oba-table" data-ec-current="true">
            <caption className="oba-cell-detail">Currently effective</caption>
            <thead>
              <tr>
                <th scope="col">Order</th>
                <th scope="col">Contact</th>
                <th scope="col">Reach them on</th>
                <th scope="col">May be told</th>
                <th scope="col">Standing</th>
              </tr>
            </thead>
            <tbody>
              {current.contacts.map((contact) => (
                <EmergencyContactRow key={contact.id} contact={contact} />
              ))}
            </tbody>
          </table>
        </>
      ) : null}

      {superseded.length > 0 ? (
        <table className="oba-table" data-ec-history="true">
          <caption className="oba-cell-detail">
            Superseded. Kept because who we would have called then is part of the record.
          </caption>
          <thead>
            <tr>
              <th scope="col">Order</th>
              <th scope="col">Contact</th>
              <th scope="col">Reach them on</th>
              <th scope="col">May be told</th>
              <th scope="col">Standing</th>
            </tr>
          </thead>
          <tbody>
            {superseded.map((contact) => (
              <EmergencyContactRow key={contact.id} contact={contact} />
            ))}
          </tbody>
        </table>
      ) : null}
    </OnboardingAdminPanel>
  );
}

function EmergencyContactRow({ contact }: { contact: EmergencyContact }) {
  const address = addressOf(contact);

  return (
    <tr
      data-emergency-contact-id={contact.id}
      data-contact-priority={contact.priority}
      data-contact-current={contact.supersededAt === null ? "true" : "false"}
    >
      <td>
        <span className="oba-module-title">
          {label(PRIORITY_LABELS, contact.priority)}
        </span>
        <span className="oba-cell-detail">version {contact.setVersion}</span>
      </td>
      <td>
        <span className="oba-module-title">{contact.fullName}</span>
        <span className="oba-cell-detail">
          {label(RELATIONSHIP_LABELS, contact.relationship)}
          {contact.relationshipDetail ? ` · ${contact.relationshipDetail}` : ""}
        </span>
        {address ? <span className="oba-cell-detail">{address}</span> : null}
      </td>
      <td>
        <span>{contact.primaryPhone}</span>
        {contact.secondaryPhone ? (
          <span className="oba-cell-detail">{contact.secondaryPhone}</span>
        ) : null}
        {contact.email ? (
          <span className="oba-cell-detail">{contact.email}</span>
        ) : null}
        {contact.preferredLanguage ? (
          <span className="oba-cell-detail">
            Prefers {contact.preferredLanguage}
          </span>
        ) : null}
      </td>
      <td>{label(DESIGNATION_LABELS, contact.designation)}</td>
      <td>
        {contact.supersededAt === null ? (
          <span className="oba-badge oba-badge-executed">
            {contact.status === "ACTIVE" ? "In effect" : "Not called"}
          </span>
        ) : (
          <>
            <span className="oba-badge oba-badge-superseded">Superseded</span>
            <span className="oba-cell-detail">
              <OnboardingAdminTimestamp value={contact.supersededAt} />
            </span>
          </>
        )}
      </td>
    </tr>
  );
}

export default EmergencyContactsReviewPanel;
