import { proxyGet } from "../../../_proxy";

// Stale Review Resolution Workflow: configured suppression bounds (default + max).
export const GET = proxyGet("/friday/intelligence/stale-review/config");
