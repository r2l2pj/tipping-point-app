// @ts-expect-error -- bun:test resolves under `bun test`
import { describe, expect, test } from "bun:test";
import { renderToStaticMarkup } from "react-dom/server";
import MethodsDrawer, { METHODS_LINKS } from "./MethodsDrawer";

describe("Methods drawer (judges)", () => {
  const html = renderToStaticMarkup(<MethodsDrawer />);
  test("closed by default; four README topics + the project document", () => {
    expect(html).toContain("<details data-methods");
    expect(html).not.toMatch(/<details[^>]* open/);
    expect(METHODS_LINKS.map((l) => l.label)).toEqual(["TPI formula", "Data used", "Validation", "Limitations", "Project document"]);
  });
  test("public GitHub links open in a new tab; TPI = geometric mean; no landslide confirmation claim", () => {
    for (const l of METHODS_LINKS) expect(l.href).toStartWith("https://github.com/r2l2pj/");
    expect(html).toContain('rel="noopener noreferrer"');
    expect(html).toContain("geometric mean");
    expect(html).not.toMatch(/confirm/i);
  });
});
