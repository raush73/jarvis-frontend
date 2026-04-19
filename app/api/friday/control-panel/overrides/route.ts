import { proxyGet, proxyPost } from "../../_proxy";

export const GET = proxyGet("/friday/control-panel/overrides");
export const POST = proxyPost("/friday/control-panel/overrides");
