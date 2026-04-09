import { proxyGet, proxyPost } from "../../_proxy";

export const GET = proxyGet("/api/friday/intelligence/strategic-targets");
export const POST = proxyPost("/api/friday/intelligence/strategic-targets");
