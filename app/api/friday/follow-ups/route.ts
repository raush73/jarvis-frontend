import { proxyPost, proxyGet } from "../_proxy";

export const POST = proxyPost("/api/friday/follow-ups");
export const GET = proxyGet("/api/friday/follow-ups/my-queue");
