import assert from "node:assert/strict";
import { test } from "node:test";
import { add, sub, mul, lt, gte, toKobo, fromKobo, formatNaira, formatNairaCompact, MoneyError } from "../src/lib/money.ts";

test("float drift that motivates this module", () => {
  assert.equal(0.1 + 0.2 === 0.3, false);      // the bug we are avoiding
  assert.equal(add("0.10", "0.20"), "0.30");   // exact here
});

test("round trip", () => {
  for (const s of ["0", "0.01", "1", "1234.56", "-1234.56", "999999999.99"])
    assert.equal(fromKobo(toKobo(s)), Number(s).toFixed(2));
});

test("add / sub", () => {
  assert.equal(add("1000", "0.5"), "1000.50");
  assert.equal(sub("1000", "1000.01"), "-0.01");
  assert.equal(sub("50000.00", "42000.00"), "8000.00");
});

test("mul rounds half-up at the kobo", () => {
  assert.equal(mul("40", "1050"), "42000.00");     // 40 L at NGN1,050
  assert.equal(mul("0.05", "0.10"), "0.01");       // 0.005 -> half-up to 1 kobo
  assert.equal(mul("0.04", "0.10"), "0.00");       // 0.004 -> down
  assert.equal(mul("33.33", "1050"), "34996.50");
});

test("comparisons", () => {
  assert.equal(lt("9999.99", "10000.00"), true);
  assert.equal(lt("10000.00", "10000.00"), false);
  assert.equal(gte("10000.00", "10000.00"), true);
});

test("rejects junk rather than coercing", () => {
  for (const bad of ["", "abc", "1.234", "1e5", "NaN", "Infinity", "1,000", "--1"])
    assert.throws(() => toKobo(bad), MoneyError, `should reject ${JSON.stringify(bad)}`);
});

test("no precision loss on a long run of debits", () => {
  let bal = "100000.00";
  for (let i = 0; i < 10_000; i++) bal = sub(bal, "0.01");
  assert.equal(bal, "99900.00");                   // exactly NGN100 removed
});

test("formatting", () => {
  assert.match(formatNaira("1234.56"), /1,234\.56/);
  assert.equal(formatNairaCompact(340), "₦340");    // old code showed "NGN0k"
  assert.match(formatNairaCompact(340000), /340K/i);
});
