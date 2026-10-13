import { describe, expect, it } from "vitest";
import { add, formatMoney, money, MoneyError, parseMoney, subtract, sumMinor, toDecimalString } from "@/lib/money";

describe("money", () => {
  it("parses decimal strings into minor units without floating point drift", () => {
    expect(parseMoney("0.1", "AUD") + parseMoney("0.2", "AUD")).toBe(30);
    expect(parseMoney("1,234.5", "USD")).toBe(123_450);
    expect(parseMoney("19.99", "GBP")).toBe(1_999);
    expect(parseMoney("-5.01", "EUR")).toBe(-501);
  });

  it("respects currencies without minor units", () => {
    expect(parseMoney("1500", "JPY")).toBe(1_500);
    expect(() => parseMoney("15.5", "JPY")).toThrow(MoneyError);
    expect(formatMoney(1_500, "JPY")).toContain("1,500");
  });

  it("rejects too many decimal places and garbage", () => {
    expect(() => parseMoney("1.234", "AUD")).toThrow(MoneyError);
    expect(() => parseMoney("12abc", "AUD")).toThrow(MoneyError);
    expect(() => parseMoney("", "AUD")).toThrow(MoneyError);
  });

  it("round-trips through toDecimalString", () => {
    for (const minor of [0, 5, 99, 100, 123_456, -42]) {
      expect(parseMoney(toDecimalString(minor, "AUD"), "AUD")).toBe(minor);
    }
    expect(toDecimalString(5, "AUD")).toBe("0.05");
  });

  it("refuses to mix currencies or use fractional minor units", () => {
    expect(() => add(money(100, "AUD"), money(100, "USD"))).toThrow(MoneyError);
    expect(() => money(10.5, "AUD")).toThrow(MoneyError);
    expect(() => sumMinor([1, 2.5])).toThrow(MoneyError);
    expect(subtract(money(500, "NZD"), money(125, "NZD"))).toEqual({ amountMinor: 375, currency: "NZD" });
  });

  it("formats with the currency's exponent", () => {
    expect(formatMoney(123_450, "AUD")).toMatch(/1,234\.50/);
  });
});
