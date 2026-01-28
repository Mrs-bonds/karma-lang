// karma-runtime.js
// Minimal Karma runtime renderer (v0.1)

export function renderKarma(ast) {
  if (!ast || !ast.children) return "";

  return ast.children.map(renderNode).join("");
}

function renderNode(node) {
  if (node.type === "TEXT") {
    return escapeHtml(node.value);
  }

  switch (node.type) {
    case "PAGE":
      return `<main>${node.children.map(renderNode).join("")}</main>`;

    case "NAV":
      return `<nav>Karma Nav</nav>`;

    case "PARA":
      return `<p>${node.children.map(renderNode).join("")}</p>`;

    case "IMAGE":
      return `<img src="${node.attrs?.SRC || ""}" />`;

    case "BTN":
      return `<button>${node.children.map(renderNode).join("")}</button>`;

    default:
      // unknown tags still render children
      return node.children
        ? node.children.map(renderNode).join("")
        : "";
  }
}

function escapeHtml(str = "") {
  return str
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;");
}
