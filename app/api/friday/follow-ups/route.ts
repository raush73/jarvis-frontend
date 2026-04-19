import { proxyPost, proxyGet } from "../_proxy";

export const POST = proxyPost("/friday/follow-ups");
export const GET = proxyGet("/friday/follow-ups/my-queue");
