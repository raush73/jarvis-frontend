import { proxyGetWithId, proxyPatchWithId } from "../../friday/_proxy";

export const GET = proxyGetWithId("/api/campaigns/[id]");
export const PATCH = proxyPatchWithId("/api/campaigns/[id]");
