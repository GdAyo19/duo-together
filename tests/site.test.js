import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const root = new URL("../", import.meta.url);
const canonicalPages = [
  {
    file: "index.html",
    title: "Tandem — Language learning for two",
    url: "https://gdayo19.github.io/duo-together/"
  },
  {
    file: "about.html",
    title: "About Tandem — Language learning for two",
    url: "https://gdayo19.github.io/duo-together/about.html"
  },
  {
    file: "privacy.html",
    title: "Privacy — Tandem",
    url: "https://gdayo19.github.io/duo-together/privacy.html"
  }
];

describe("public site metadata", () => {
  it.each(canonicalPages)("gives $file a distinct title and canonical URL", ({ file, title, url }) => {
    const html = readFileSync(new URL(file, root), "utf8");

    expect(html).toContain(`<title>${title}</title>`);
    expect(html).toContain(`<link rel="canonical" href="${url}">`);
    expect(html).toMatch(/<meta name="description" content="[^"]+">/);
    expect(html).toContain('property="og:image" content="https://gdayo19.github.io/duo-together/social-card.png"');
    expect(html).toContain('property="og:image:alt"');
  });

  it("ships a noindex not-found page and discoverability assets", () => {
    const notFound = readFileSync(new URL("404.html", root), "utf8");
    const sitemap = readFileSync(new URL("public/sitemap.xml", root), "utf8");

    expect(notFound).toContain('<meta name="robots" content="noindex">');
    expect(notFound).toContain("<h1>");
    expect(sitemap).toContain("https://gdayo19.github.io/duo-together/about.html");
    expect(sitemap).toContain("https://gdayo19.github.io/duo-together/privacy.html");
    for (const asset of ["public/favicon.svg", "public/social-card.png", "public/robots.txt", "public/llms.txt"]) {
      expect(() => readFileSync(new URL(asset, root))).not.toThrow();
    }
  });
});
