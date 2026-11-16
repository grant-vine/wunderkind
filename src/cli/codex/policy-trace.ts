export function policyTrace(event: string, fields: Readonly<Record<string, string | number | null>> = {}): void {
  if (process.env["WUNDERKIND_POLICY_TRACE"] !== "1") return
  process.stderr.write(`${JSON.stringify({ policyTrace: event, ...fields })}\n`)
}
