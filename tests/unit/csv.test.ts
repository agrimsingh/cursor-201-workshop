import { describe, expect, it } from "vitest";
import { escapeCsvField, formatCsvRow } from "@/lib/csv";

describe("csv", () => {
  it("leaves simple fields unquoted", () => {
    expect(escapeCsvField("Acme")).toBe("Acme");
    expect(escapeCsvField("123")).toBe("123");
  });

  it("quotes fields with commas, quotes, or newlines and doubles embedded quotes", () => {
    expect(escapeCsvField("hello, world")).toBe('"hello, world"');
    expect(escapeCsvField('say "hi"')).toBe('"say ""hi"""');
    expect(escapeCsvField("line1\nline2")).toBe('"line1\nline2"');
    expect(escapeCsvField("a\r\nb")).toBe('"a\r\nb"');
  });

  it("prefixes formula-like values with a single quote", () => {
    expect(escapeCsvField("=SUM(A1)")).toBe("'=SUM(A1)");
    expect(escapeCsvField("+1234")).toBe("'+1234");
    expect(escapeCsvField("-100")).toBe("'-100");
    expect(escapeCsvField("@evil")).toBe("'@evil");
  });

  it("applies formula prefix before quoting when both apply", () => {
    expect(escapeCsvField("=a,b")).toBe('"\'=a,b"');
  });

  it("joins escaped fields into a row", () => {
    expect(formatCsvRow(["a", "b,c", "=x"])).toBe('a,"b,c",\'=x');
  });
});
