import { proxyGetWithId, proxyPatchWithId } from "../../_proxy";

export const GET = proxyGetWithId("/friday/email-drafts/[id]");
export const PATCH = proxyPatchWithId("/friday/email-drafts/[id]");
