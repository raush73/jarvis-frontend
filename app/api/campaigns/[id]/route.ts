import { proxyGetWithId, proxyPatchWithId } from "../../friday/_proxy";

export const GET = proxyGetWithId("/campaigns/[id]");
export const PATCH = proxyPatchWithId("/campaigns/[id]");
