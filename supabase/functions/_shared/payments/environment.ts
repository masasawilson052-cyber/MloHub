// Shared by Deno Edge Functions and the Node-based verification suite.
export function readPaymentEnvironment(name: string): string {
  const host = globalThis as any;
  return (host.Deno?.env?.get(name) ?? host.process?.env?.[name] ?? '').trim();
}
