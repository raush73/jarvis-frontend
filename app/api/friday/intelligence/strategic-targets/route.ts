import { proxyGet, proxyPost } from "../../_proxy";

export const GET = proxyGet("/friday/intelligence/strategic-targets");
export const POST = proxyPost("/friday/intelligence/strategic-targets");
