import { proxyGet, proxyPost } from "../friday/_proxy";

export const GET = proxyGet("/api/campaigns");
export const POST = proxyPost("/api/campaigns");
