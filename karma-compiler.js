// Karma — compiler (v1.6)
// Build one: node karma-compiler.js test.karma
// Build all: node karma-compiler.js --all
// Pro layouts: node karma-compiler.js test.karma --pro  (or KARMA_PRO=1)

import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const arg = process.argv[2];
const suggest = process.argv.includes("--suggest");
const buildAll = process.argv.includes("--all");
const isPro = process.argv.includes("--pro") || process.env.KARMA_PRO === "1";

const baseDir = process.cwd();

if (!arg && !buildAll) {
  console.error('Usage: node karma-compiler.js <file.karma> [--suggest] [--pro] OR node karma-compiler.js --all [--suggest] [--pro]');
  process.exit(1);
}

function compileOne(input) {
  let src = fs.readFileSync(input, "utf8");

  // ---------- helpers ----------
  function escapeHTML(s) {
    return String(s)
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;");
  }

  function getAttr(attrStr, name) {
    const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i");
    const m = attrStr.match(re);
    return m ? m[1] : "";
  }

  function clampInt(v, min, max, fallback) {
    const n = parseInt(v, 10);
    if (Number.isNaN(n)) return fallback;
    return Math.max(min, Math.min(max, n));
  }

  function karmaToHtmlHref(hrefRaw) {
    if (!hrefRaw) return "#";
    return hrefRaw.toLowerCase().endsWith(".karma")
      ? hrefRaw.replace(/\.karma$/i, ".html")
      : hrefRaw;
  }

  // Layouts resolve relative to the compiler file (NOT the shell)
  function readLayoutTemplate(layoutName) {
    const p = path.resolve(__dirname, "layouts", `${layoutName}.html`);
    if (!fs.existsSync(p)) return null;
    return fs.readFileSync(p, "utf8");
  }

  // Parse all PAGE attrs into variables for layouts: {{BRAND}}, {{TAGLINE}}, etc.
  function extractPageVars(pageAttrs, layoutName, pageTitle, baseCSS, bodyHtml) {
    const extra = {};
    const attrPairs = pageAttrs.match(/[A-Z_]+\s*=\s*"[^"]*"/gi) || [];
    for (const pair of attrPairs) {
      const m = pair.match(/^([A-Z_]+)\s*=\s*"([^"]*)"$/i);
      if (!m) continue;
      const key = m[1].toUpperCase();
      if (key === "TITLE" || key === "LAYOUT") continue;
      extra[key] = m[2];
    }

    return {
      title: pageTitle,
      style: baseCSS,
      content: bodyHtml,
      year: String(new Date().getFullYear()),
      layout: layoutName || "",
      extra
    };
  }

  function applyLayout(templateHtml, vars) {
    let out = templateHtml;

    // core placeholders
    out = out.replaceAll("{{title}}", vars.title || "");
    out = out.replaceAll("{{style}}", vars.style || "");
    out = out.replaceAll("{{content}}", vars.content || "");
    out = out.replaceAll("{{year}}", vars.year || "");
    out = out.replaceAll("{{layout}}", vars.layout || "");

    // extra placeholders from PAGE attrs
    for (const k of Object.keys(vars.extra || {})) {
      out = out.replaceAll(`{{${k}}}`, String(vars.extra[k] ?? ""));
    }

    // If template forgot {{style}}, inject it
    if (!templateHtml.includes("{{style}}")) {
      if (out.includes("</head>")) out = out.replace("</head>", `<style>${vars.style || ""}</style></head>`);
      else out = `<style>${vars.style || ""}</style>\n${out}`;
    }

    return out;
  }

  // ---------- components (optional) ----------
  const components = {};

  function loadComponents(filePath) {
    const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i].trim();

      if (line.startsWith("component ")) {
        const head = line.match(/^component\s+(\w+)\(([^)]*)\)\s*\{$/);
        if (!head) continue;

        const name = head[1];
        const args = head[2].split(",").map(a => a.trim()).filter(Boolean);
        const bodyLines = [];

        i++;
        while (i < lines.length && lines[i].trim() !== "}") {
          bodyLines.push(lines[i]);
          i++;
        }

        components[name] = { args, body: bodyLines.join("\n") };
      }
    }
  }

  // ---------- imports ----------
  const importRe = /import\s+"([^"]+)"/g;
  let im;
  while ((im = importRe.exec(src))) {
    const importedPath = path.resolve(baseDir, im[1]);
    loadComponents(importedPath);
    src = src.replace(im[0], "");
  }

  // ---------- PAGE ----------
  const pageMatch = src.match(/<PAGE\s+([^>]*)>([\s\S]*?)<\/PAGE>/i);
  if (!pageMatch) {
    console.error(`Karma error in ${input}: <PAGE TITLE="..."> ... </PAGE> is required.`);
    return null;
  }

  const pageAttrs = pageMatch[1] || "";
// extract all PAGE attributes into a map
const pageVars = {};
const attrRe = /([A-Z_]+)\s*=\s*"([^"]*)"/gi;
let m;
while ((m = attrRe.exec(pageAttrs))) {
  pageVars[m[1].toUpperCase()] = m[2];
}

  let body = pageMatch[2] || "";

  const pageTitle = escapeHTML(getAttr(pageAttrs, "TITLE") || getAttr(pageAttrs, "title"));

  // LAYOUT name from PAGE attr or <LAYOUT NAME="..."/>
  let layoutName = getAttr(pageAttrs, "LAYOUT") || getAttr(pageAttrs, "layout") || "";
  const layoutTagRe = /<LAYOUT([^\/>]*)\/>/i;
  const lm = body.match(layoutTagRe);
  if (!layoutName && lm) {
    layoutName = getAttr(lm[1] || "", "NAME") || getAttr(lm[1] || "", "name") || "";
  }
  body = body.replace(/<LAYOUT([^\/>]*)\/>/gi, "");

  // Expand components
  for (const name in components) {
    const { args, body: template } = components[name];
    const re = new RegExp(`<${name}([^>]*)>([\\s\\S]*?)<\\/${name}>`, "g");

    body = body.replace(re, (_, attrStr, inner) => {
      let out = template.replaceAll("<slot/>", inner);
      args.forEach(arg => {
        const val = getAttr(attrStr, arg) || getAttr(attrStr, arg.toUpperCase());
        out = out.replaceAll(`{{${arg}}}`, val);
      });
      return out;
    });
  }

  function applyKarmaBlocks(html) {
    // PARA
    html = html.replace(/<PARA([^\/>]*)\/>/gi, (_, attrStr) => {
      const text = getAttr(attrStr, "TEXT") || getAttr(attrStr, "text");
      if (!text) {
        return `<div class="k-block k-paragraph"><p class="k-placeholder">Write your paragraph here…</p></div>`;
      }
      return `<div class="k-block k-paragraph"><p>${escapeHTML(text)}</p></div>`;
    });

    // IMAGE
    html = html.replace(/<IMAGE([^\/>]*)\/>/gi, (_, attrStr) => {
      const src2 = getAttr(attrStr, "SRC") || getAttr(attrStr, "src");
      const alt = getAttr(attrStr, "ALT") || getAttr(attrStr, "alt");
      const title = getAttr(attrStr, "TITLE") || getAttr(attrStr, "title");
      const caption = getAttr(attrStr, "CAPTION") || getAttr(attrStr, "caption");
      const variant = (getAttr(attrStr, "VARIANT") || getAttr(attrStr, "variant") || "card").toLowerCase();
      const align = (getAttr(attrStr, "POSITION") || getAttr(attrStr, "align") || "left").toLowerCase();
      const linkRaw = getAttr(attrStr, "LINK") || getAttr(attrStr, "link");

      const head = title ? `<div class="k-block-title">${escapeHTML(title)}</div>` : "";

      const wrapMaybeLink = (innerHtml) => {
        if (!linkRaw) return innerHtml;
        const href = karmaToHtmlHref(linkRaw);
        return `<a class="k-media-link" href="${escapeHTML(href)}">${innerHtml}</a>`;
      };

      if (!src2) {
        return `<div class="k-block k-image k-variant-${escapeHTML(variant)}">${head}
  <div class="k-image-placeholder"><div class="k-image-icon">🖼️</div>
  <div class="k-image-text">Add SRC="path/to/image.jpg"</div></div></div>`;
      }

      const safeAlt = alt ? escapeHTML(alt) : "";
      const cap = caption ? `<figcaption class="k-caption">${escapeHTML(caption)}</figcaption>` : "";

      if (variant === "split") {
        const cls = align === "right" ? "k-split k-split-right" : "k-split";
        const img = `<img class="k-img" src="${escapeHTML(src2)}" alt="${safeAlt}">`;
        return `<div class="k-block ${cls}">
  <div class="k-split-media">${wrapMaybeLink(img)}</div>
  <div class="k-split-content">${head || `<div class="k-block-title">Section</div>`}${cap || ""}</div>
</div>`;
      }

      if (variant === "hero") {
        const hero = `<img class="k-hero-img" src="${escapeHTML(src2)}" alt="${safeAlt}">`;
        return `<section class="k-hero">${wrapMaybeLink(hero)}
  <div class="k-hero-overlay">${head || `<div class="k-block-title">Hero</div>`}${cap || ""}</div>
</section>`;
      }

      const img = `<img class="k-img" src="${escapeHTML(src2)}" alt="${safeAlt}">`;
      return `<div class="k-block k-image k-variant-card">${head}
  <figure class="k-figure">${wrapMaybeLink(img)}${cap}</figure>
</div>`;
    });

    // LINK
    html = html.replace(/<LINK([^\/>]*)\/>/gi, (_, attrStr) => {
      const text = getAttr(attrStr, "TEXT") || getAttr(attrStr, "text") || "Click here";
      const hrefRaw = getAttr(attrStr, "HREF") || getAttr(attrStr, "href") || "#";
      const variant = (getAttr(attrStr, "VARIANT") || getAttr(attrStr, "variant") || "primary").toLowerCase();
      const href = karmaToHtmlHref(hrefRaw);

      return `<div class="k-block k-link"><a class="k-btn k-btn-${escapeHTML(variant)}" href="${escapeHTML(href)}">${escapeHTML(text)}</a></div>`;
    });

    // NAV
    html = html.replace(/<NAV([^\/>]*)\/>/gi, (_, attrStr) => {
      const variant = (getAttr(attrStr, "TYPE") || getAttr(attrStr, "variant") || "bar").toLowerCase();
      const position = (getAttr(attrStr, "POSITION") || getAttr(attrStr, "position") || "top").toLowerCase();
      const title = getAttr(attrStr, "TITLE") || getAttr(attrStr, "title");
      const linksRaw = getAttr(attrStr, "LINKS") || getAttr(attrStr, "links");

      const items = (linksRaw || "")
        .split(",")
        .map(s => s.trim())
        .filter(Boolean)
        .map(pair => {
          const [label, hrefRaw] = pair.split(":").map(x => (x || "").trim());
          const href = karmaToHtmlHref(hrefRaw || "#");
          return { label: label || "Link", href };
        });

      const head = title ? `<div class="k-block-title">${escapeHTML(title)}</div>` : "";
      const linksHtml = items.length
        ? items.map(it => `<a class="k-nav-link" href="${escapeHTML(it.href)}">${escapeHTML(it.label)}</a>`).join("")
        : `<span class="k-muted">Add LINKS="Home:home.karma, About:about.karma"</span>`;

      return `<div class="k-block k-nav k-nav-${escapeHTML(variant)} k-pos-${escapeHTML(position)}">${head}<nav class="k-nav-inner">${linksHtml}</nav></div>`;
    });

    // TABLE
    html = html.replace(/<TABLE([^\/>]*)\/>/gi, (_, attrStr) => {
      const title = getAttr(attrStr, "TITLE") || getAttr(attrStr, "title") || "Table";
      const cols = clampInt(getAttr(attrStr, "COLS") || getAttr(attrStr, "cols") || "3", 2, 6, 3);
      const rows = clampInt(getAttr(attrStr, "ROWS") || getAttr(attrStr, "rows") || "2", 2, 10, 2);

      const th = Array.from({ length: cols }, (_, i) => `<th>Column ${i + 1}</th>`).join("");
      const tr = Array.from({ length: rows }, () => `<tr>${Array.from({ length: cols }, () => `<td>Edit</td>`).join("")}</tr>`).join("");

      return `<div class="k-block k-table"><div class="k-block-title">${escapeHTML(title)}</div>
<table class="k-table-el"><thead><tr>${th}</tr></thead><tbody>${tr}</tbody></table></div>`;
    });

    // FORM
    html = html.replace(/<FORM([^\/>]*)\/>/gi, (_, attrStr) => {
      const title = getAttr(attrStr, "TITLE") || getAttr(attrStr, "title") || "Form";
      const fieldsRaw = getAttr(attrStr, "FIELDS") || getAttr(attrStr, "fields") || "name,email,message";
      const submitText = getAttr(attrStr, "SUBMIT") || getAttr(attrStr, "submit") || "Submit";

      const fields = fieldsRaw.split(",").map(s => s.trim()).filter(Boolean);
      const inputs = fields.map(f => {
        const id = `k_${f.replace(/\W+/g, "_")}`;
        const label = f.charAt(0).toUpperCase() + f.slice(1);
        const isMessage = f.toLowerCase() === "message" || f.toLowerCase() === "notes";
        return isMessage
          ? `<label class="k-label" for="${id}">${escapeHTML(label)}</label><textarea class="k-input" id="${id}" placeholder="Type here..."></textarea>`
          : `<label class="k-label" for="${id}">${escapeHTML(label)}</label><input class="k-input" id="${id}" placeholder="Type here..." />`;
      }).join("\n");

      return `<div class="k-block k-form"><div class="k-block-title">${escapeHTML(title)}</div>
<form class="k-form-inner" action="#" method="post">
${inputs}
<button class="k-btn k-btn-primary" type="button">${escapeHTML(submitText)}</button>
<div class="k-muted k-small">Placeholder form. Add action later.</div>
</form></div>`;
    });

    // VIDEO
    html = html.replace(/<VIDEO([^\/>]*)\/>/gi, (_, attrStr) => {
      const src2 = getAttr(attrStr, "SRC") || getAttr(attrStr, "src");
      const url = getAttr(attrStr, "URL") || getAttr(attrStr, "url");
      const title = getAttr(attrStr, "TITLE") || getAttr(attrStr, "title") || "Video";

      if (!src2 && !url) {
        return `<div class="k-block k-video"><div class="k-block-title">${escapeHTML(title)}</div><div class="k-muted">Add SRC or URL.</div></div>`;
      }
      if (src2) {
        return `<div class="k-block k-video"><div class="k-block-title">${escapeHTML(title)}</div><video class="k-video-el" controls src="${escapeHTML(src2)}"></video></div>`;
      }
      return `<div class="k-block k-video"><div class="k-block-title">${escapeHTML(title)}</div>
<div class="k-iframe-wrap"><iframe class="k-iframe" src="${escapeHTML(url)}" title="${escapeHTML(title)}" allowfullscreen></iframe></div></div>`;
    });

    // EMAIL
    html = html.replace(/<EMAIL([^\/>]*)\/>/gi, (_, attrStr) => {
      const to = getAttr(attrStr, "TO") || getAttr(attrStr, "to");
      const text = getAttr(attrStr, "TEXT") || getAttr(attrStr, "text") || "Email";
      const subject = getAttr(attrStr, "SUBJECT") || getAttr(attrStr, "subject");
      const body2 = getAttr(attrStr, "BODY") || getAttr(attrStr, "body");

      if (!to) return `<div class="k-block k-link"><span class="k-muted">Add TO="name@domain.com"</span></div>`;

      const params = [];
      if (subject) params.push(`subject=${encodeURIComponent(subject)}`);
      if (body2) params.push(`body=${encodeURIComponent(body2)}`);
      const qs = params.length ? `?${params.join("&")}` : "";

      return `<div class="k-block k-link"><a class="k-btn k-btn-ghost" href="mailto:${escapeHTML(to)}${qs}">${escapeHTML(text)}</a></div>`;
    });

    // PHONE
    html = html.replace(/<PHONE([^\/>]*)\/>/gi, (_, attrStr) => {
      const number = getAttr(attrStr, "NUMBER") || getAttr(attrStr, "number");
      const text = getAttr(attrStr, "TEXT") || getAttr(attrStr, "text") || "Call";
      if (!number) return `<div class="k-block k-link"><span class="k-muted">Add NUMBER="+1206..."</span></div>`;
      const digits = number.replace(/[^\d+]/g, "");
      return `<div class="k-block k-link"><a class="k-btn k-btn-ghost" href="tel:${escapeHTML(digits)}">${escapeHTML(text)}</a></div>`;
    });

    return html;
  }
  function suggestNext(raw) {
    if (!suggest) return;
    const hasLayout = /LAYOUT\s*=/i.test(raw) || /<LAYOUT\b/i.test(raw);
    if (!hasLayout) {
      process.stderr.write('\nTip: try layout (Pro): <PAGE TITLE="..." LAYOUT="main"> ... </PAGE>\n\n');
    }
  }

  suggestNext(src);

  body = applyKarmaBlocks(body);

  const baseCSS = `
:root{--k-bg:#0b0f14;--k-card:rgba(17,24,39,.55);--k-border:rgba(255,255,255,.12);--k-text:#e5e7eb;--k-muted:rgba(229,231,235,.72);--k-radius:16px;}
*{box-sizing:border-box}
body{margin:0;padding:28px;font-family:system-ui,-apple-system,Segoe UI,Roboto,Arial,sans-serif;background:var(--k-bg);color:var(--k-text);}
.k-block{border:1px solid var(--k-border);background:var(--k-card);border-radius:var(--k-radius);padding:16px;margin:14px 0;}
.k-block-title{font-weight:900;margin-bottom:10px}
.k-placeholder{color:var(--k-muted);margin:0}
.k-muted{color:var(--k-muted)}
.k-small{font-size:.9rem}
.k-btn{display:inline-flex;align-items:center;justify-content:center;padding:10px 14px;border-radius:12px;border:1px solid var(--k-border);text-decoration:none;font-weight:900;background:rgba(255,255,255,.08);color:inherit}
.k-btn-primary{background:rgba(255,255,255,.12)}
.k-btn-ghost{background:transparent}
.k-nav-inner{display:flex;gap:10px;flex-wrap:wrap}
.k-nav-link{padding:9px 12px;border-radius:999px;border:1px solid var(--k-border);background:rgba(255,255,255,.06);text-decoration:none}
.k-image-placeholder{display:flex;gap:12px;align-items:center;padding:18px;border:1px dashed var(--k-border);border-radius:14px}
.k-image-icon{font-size:22px}
.k-figure{margin:0}
.k-img{max-width:100%;height:auto;border-radius:14px;border:1px solid var(--k-border)}
.k-caption{margin-top:8px;color:var(--k-muted);font-size:.95rem}
.k-hero{position:relative;border-radius:20px;overflow:hidden;border:1px solid var(--k-border);margin:14px 0;}
.k-hero-img{width:100%;height:320px;object-fit:cover;display:block}
.k-hero-overlay{position:absolute;inset:0;display:flex;flex-direction:column;justify-content:flex-end;padding:18px;background:linear-gradient(transparent, rgba(0,0,0,.65));}
.k-split{display:grid;grid-template-columns:1fr 1fr;gap:14px;align-items:center}
@media (max-width:820px){.k-split{grid-template-columns:1fr}}
.k-table-el{width:100%;border-collapse:collapse;overflow:hidden;border-radius:12px}
.k-table-el th,.k-table-el td{border-bottom:1px solid var(--k-border);padding:10px;text-align:left}
.k-form-inner{display:grid;gap:10px}
.k-label{font-weight:900}
.k-input{width:100%;padding:10px 12px;border-radius:12px;border:1px solid var(--k-border);background:rgba(255,255,255,.04);color:var(--k-text);outline:none}
.k-input::placeholder{color:rgba(229,231,235,.45)}
textarea.k-input{min-height:110px;resize:vertical}
.k-video-el{width:100%;border-radius:14px;border:1px solid var(--k-border)}
.k-iframe-wrap{position:relative;padding-top:56.25%;border-radius:14px;overflow:hidden;border:1px solid var(--k-border)}
.k-iframe{position:absolute;inset:0;width:100%;height:100%;border:0}
.k-pro-notice{border:1px solid rgba(255,255,255,.18);background:rgba(255,255,255,.06);border-radius:14px;padding:12px 14px;margin:14px 0;}
.k-pro-notice strong{font-weight:900}
`;

  const standardHtml = `<!doctype html>
<html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${pageTitle}</title><style>${baseCSS}</style></head>
<body>${body}</body></html>`;

  let out = standardHtml;

  if (layoutName) {
    if (!isPro) {
      const notice = `<div class="k-pro-notice"><strong>Layout “${escapeHTML(layoutName)}”</strong> is a Karma Pro feature. Page built without layout.</div>`;
      out = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${pageTitle}</title><style>${baseCSS}</style></head><body>${notice}${body}</body></html>`;
    } else {
      const tpl = readLayoutTemplate(layoutName);
      if (!tpl) {
        const notice = `<div class="k-pro-notice"><strong>Layout missing:</strong> layouts/${escapeHTML(layoutName)}.html not found. Page built without layout.</div>`;
        out = `<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<title>${pageTitle}</title><style>${baseCSS}</style></head><body>${notice}${body}</body></html>`;
      } else {
       const vars = extractPageVars(pageAttrs, layoutName, pageTitle, baseCSS, body);
        out = applyLayout(tpl, vars);
      }
    }
  }

  const outPath = input.toLowerCase().endsWith(".karma")
    ? input.replace(/\.karma$/i, ".html")
    : `${input}.html`;

  fs.writeFileSync(outPath, out, "utf8");
console.error(`✅ Built: ${outPath}`);

  return outPath;
}

// entry
if (buildAll) {
  const files = fs.readdirSync(baseDir).filter(f => f.toLowerCase().endsWith(".karma"));
  if (!files.length