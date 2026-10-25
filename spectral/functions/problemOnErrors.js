// Error responses (4xx, 5xx) are RFC 9457 problem details.
export default function problemOnErrors(responses, _opts, context) {
  const out = [];
  for (const [code, res] of Object.entries(responses ?? {})) {
    if (!/^[45]/.test(code) || !res?.content) continue;
    if (!res.content["application/problem+json"]) {
      out.push({ message: `Response ${code} must use application/problem+json.`, path: [...context.path, code] });
    }
  }
  return out;
}
