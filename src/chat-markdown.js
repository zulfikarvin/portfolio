// Escape all model output before adding our small, dependency-free Markdown subset.
export function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
}

function inline(text) {
  const tokens = [];
  // Tokenize links and code first so emphasis never rewrites their attributes/content.
  const tokenized = text.replace(/`([^`]+)`|\[([^\]\n]+)\]\(([^\s)]+)\)|(https?:\/\/[^\s<>]+)/g, (match, code, label, href, bare) => {
    let html;
    if (code !== undefined) html = `<code>${escapeHtml(code)}</code>`;
    else {
      const url = href || bare;
      if (!/^(https?:\/\/|mailto:)/i.test(url)) return match;
      html = `<a href="${escapeHtml(url)}" target="_blank" rel="noopener noreferrer">${escapeHtml(label || url)}</a>`;
    }
    tokens.push(html);
    return `\u0000${tokens.length - 1}\u0000`;
  });
  return escapeHtml(tokenized)
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/\*([^*\n]+)\*/g, '<em>$1</em>')
    .replace(/\u0000(\d+)\u0000/g, (_, index) => tokens[Number(index)] || '');
}

export function renderMarkdown(text) {
  const lines = String(text).replace(/\u0000/g, '').replace(/\r\n?/g, '\n').split('\n');
  const result = [];
  let paragraph = [];
  let list = null;
  let code = null;
  const flush = () => {
    if (paragraph.length) result.push(`<p>${paragraph.map(inline).join('<br>')}</p>`);
    paragraph = [];
    if (list) result.push(`</${list}>`);
    list = null;
  };
  for (const line of lines) {
    if (/^\s*```/.test(line)) {
      if (code) { result.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`); code = null; }
      else { flush(); code = []; }
      continue;
    }
    if (code) { code.push(line); continue; }
    if (!line.trim()) { flush(); continue; }
    const heading = line.match(/^#{1,6}\s+(.+)/);
    const item = line.match(/^\s*(?:([-*])|\d+\.)\s+(.+)/);
    if (heading) { flush(); result.push(`<h3>${inline(heading[1])}</h3>`); }
    else if (item) {
      const type = item[1] ? 'ul' : 'ol';
      if (list !== type) { flush(); result.push(`<${type}>`); list = type; }
      result.push(`<li>${inline(item[2])}</li>`);
    } else if (/^>\s?/.test(line)) { flush(); result.push(`<blockquote>${inline(line.replace(/^>\s?/, ''))}</blockquote>`); }
    else { if (list) flush(); paragraph.push(line); }
  }
  flush();
  if (code) result.push(`<pre><code>${escapeHtml(code.join('\n'))}</code></pre>`);
  return result.join('');
}
