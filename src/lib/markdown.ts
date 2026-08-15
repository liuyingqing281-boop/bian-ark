function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function renderInline(text: string): string {
  let out = escapeHtml(text);
  out = out.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" class="text-amber-500 hover:text-amber-400 underline">$1</a>');
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong class="text-stone-200">$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return out;
}

export function renderLimitedMarkdown(source: string): string {
  const blocks = source.split(/\n{2,}/);
  const html = blocks
    .map((block) => {
      const trimmed = block.trim();
      if (!trimmed) return "";
      if (trimmed.startsWith("### ")) {
        return `<h4 class="text-stone-200 mt-4 mb-1">${renderInline(trimmed.slice(4))}</h4>`;
      }
      if (trimmed.startsWith("## ")) {
        return `<h3 class="text-stone-100 text-base mt-5 mb-1">${renderInline(trimmed.slice(3))}</h3>`;
      }
      return `<p class="mb-3 last:mb-0">${renderInline(trimmed).replace(/\n/g, "<br/>")}</p>`;
    })
    .join("");
  return html;
}