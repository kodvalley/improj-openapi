// Validates openapi/openapi.json against the official OpenAPI 3.1 JSON Schema.
import { Validator } from "@seriousme/openapi-schema-validator";

const file = process.argv[2] ?? "openapi/openapi.json";
const validator = new Validator();
const result = await validator.validate(file);
if (validator.version !== "3.1") {
  console.error(`${file}: expected OpenAPI 3.1, found ${validator.version ?? "unknown"}`);
  process.exit(1);
}
if (!result.valid) {
  console.error(`${file}: not a valid OpenAPI 3.1 document`);
  console.error(JSON.stringify(result.errors, null, 2));
  process.exit(1);
}
console.log(`${file}: valid OpenAPI ${validator.version}`);
