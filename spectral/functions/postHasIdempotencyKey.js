// A POST must accept the Idempotency-Key request header (docs/STYLE_GUIDE.md, "Idempotency").
export default function postHasIdempotencyKey(operation) {
  const params = Array.isArray(operation?.parameters) ? operation.parameters : [];
  const ok = params.some((p) => p && p.in === "header" && String(p.name).toLowerCase() === "idempotency-key");
  return ok ? [] : [{ message: "POST operations must accept the Idempotency-Key header." }];
}
