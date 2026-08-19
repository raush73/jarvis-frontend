"use client";

/**
 * Module 4.2 Federal Tax - the canonical record the worker is asked to confirm.
 *
 * WHAT IT SHOWS IS WHAT THE SERVER MASKED, AND IT CANNOT SHOW MORE. The identifier arrives already
 * masked by the identity authority - a tail, never a value - and there is nothing in this component
 * that unmasks, reassembles, expands, reveals on hover, or copies it. There is no full identifier
 * anywhere in this capsule to render, which is the reason this file can exist without a reveal path.
 *
 * IT IS A CONFIRMATION AND NOT A CORRECTION, which is why there is no input on it. A worker whose
 * record is wrong is told who fixes it and is not offered a field to fix it in: canonical identity is
 * one record with one authority, and a module that let a worker restate his name here would be a
 * second place his identity could be written from.
 *
 * A MISSING RECORD IS SAID PLAINLY. If there is nothing to show him there is nothing for him to
 * confirm, so he is told that rather than shown an empty card he might tick anyway.
 */

import type { FederalTaxIdentity } from "@/lib/workforce/federalTaxApi";

export default function IdentityCard({
  identity,
}: {
  identity: FederalTaxIdentity | null;
}) {
  if (!identity) {
    return (
      <div className="wf-error" role="alert" data-ft-identity="MISSING">
        <p className="wf-error-title">We cannot show you your details right now.</p>
        <p>
          Because we cannot show them to you, there is nothing here for you to confirm. Tell your
          MW4H contact, and come back to this once it is sorted out.
        </p>
      </div>
    );
  }

  const place = [identity.city, identity.state].filter(Boolean).join(", ");

  return (
    <div className="wf-card ft-identity" data-ft-identity="SHOWN">
      <dl className="ft-identity-list">
        <div className="ft-identity-row">
          <dt className="wf-label">Name</dt>
          <dd data-ft-identity-name>{identity.displayName}</dd>
        </div>

        <div className="ft-identity-row">
          <dt className="wf-label">Identification number on file</dt>
          <dd data-ft-identity-identifier>
            {identity.identifierOnFile && identity.maskedIdentifier
              ? identity.maskedIdentifier
              : "We do not have one on file yet"}
          </dd>
        </div>

        {place ? (
          <div className="ft-identity-row">
            <dt className="wf-label">Where you live</dt>
            <dd data-ft-identity-place>{place}</dd>
          </div>
        ) : null}
      </dl>

      <p className="ft-note" data-ft-identity-note>
        We only ever show you part of your identification number, and we cannot show you the rest of
        it. If anything here is wrong, stop and tell your MW4H contact - it is not something you can
        change on this screen.
      </p>
    </div>
  );
}
