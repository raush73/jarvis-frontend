import { proxyGetWithId, proxyPatchWithId } from "../../_proxy";

export const GET = proxyGetWithId("/api/friday/email-drafts/[id]");
export const PATCH = proxyPatchWithId("/api/friday/email-drafts/[id]");
