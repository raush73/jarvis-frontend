import { proxyGet, proxyPost } from "../../_proxy";

export const GET = proxyGet("/api/friday/control-panel/holidays");
export const POST = proxyPost("/api/friday/control-panel/holidays");
