import { proxyGet, proxyPost } from "../friday/_proxy";

export const GET = proxyGet("/campaigns");
export const POST = proxyPost("/campaigns");
