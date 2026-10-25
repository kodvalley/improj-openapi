// A list response ({ data: [...], next_cursor }) must accept limit and cursor.
export default function listHasPagination(operation) {
  const schema = operation?.responses?.["200"]?.content?.["application/json"]?.schema;
  const isList = schema?.properties?.next_cursor !== undefined && schema?.properties?.data?.type === "array";
  if (!isList) return [];
  const names = new Set((operation.parameters ?? []).filter((p) => p?.in === "query").map((p) => p.name));
  const missing = ["limit", "cursor"].filter((n) => !names.has(n));
  return missing.length ? [{ message: `List operation is missing query parameter(s): ${missing.join(", ")}.` }] : [];
}
