import { describe, expect, it } from "vitest";

import { toCsv } from "@/lib/csv";

describe("toCsv", () => {
  it("joins headers and rows with commas and CRLF", () => {
    const csv = toCsv(["A", "B"], [["1", "2"], ["3", "4"]]);
    expect(csv).toBe("A,B\r\n1,2\r\n3,4");
  });

  it("quotes fields containing a comma", () => {
    const csv = toCsv(["Name"], [["Кубок, весняний"]]);
    expect(csv).toBe('Name\r\n"Кубок, весняний"');
  });

  it("quotes and escapes fields containing double quotes", () => {
    const csv = toCsv(["Name"], [['Турнір "Відкриття"']]);
    expect(csv).toBe('Name\r\n"Турнір ""Відкриття"""');
  });

  it("quotes fields containing newlines", () => {
    const csv = toCsv(["Note"], [["line one\nline two"]]);
    expect(csv).toBe('Note\r\n"line one\nline two"');
  });

  it("leaves plain fields unquoted", () => {
    const csv = toCsv(["Format"], [["SINGLES"]]);
    expect(csv).toBe("Format\r\nSINGLES");
  });
});
