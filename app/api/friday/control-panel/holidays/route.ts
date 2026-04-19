import { proxyGet, proxyPost } from "../../_proxy";

export const GET = proxyGet("/friday/control-panel/holidays");
export const POST = proxyPost("/friday/control-panel/holidays");
