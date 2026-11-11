type Block =
  | { kind: 'html'; html: string }
  | { kind: 'heading'; level: number; title: string };

interface Section {
  kind: 'section';
  level: number;
  title: string;
  children: TreeNode[];
}

type TreeNode = { kind: 'html'; html: string } | Section;

const TABLE_SEP = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)*\|?\s*$/;

const esc = (s: string): string =>
  s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

const inline = (s: string): string => {
  const codes: string[] = [];
  const masked = s.replace(/`([^`]+)`/g, (_, code: string) => {
    codes.push(code);
    return `\u0000${codes.length - 1}\u0000`;
  });
  const formatted = esc(masked)
    .replace(/!\[([^\]]*)\]\(([^)\s]+)\)/g, '<img alt="$1" src="$2">')
    .replace(/\[([^\]]+)\]\(([^)\s]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>')
    .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
    .replace(/__([^_]+)__/g, '<strong>$1</strong>')
    .replace(/\*([^*]+)\*/g, '<em>$1</em>')
    .replace(/(^|\W)_([^_]+)_(?=\W|$)/g, '$1<em>$2</em>');
  return formatted.replace(/\u0000(\d+)\u0000/g, (_, i: string) => `<code>${esc(codes[Number(i)])}</code>`);
};

const splitRow = (line: string): string[] =>
  line.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map(c => c.trim());

const alignOf = (cell: string): string => {
  const left = cell.startsWith(':');
  const right = cell.endsWith(':');
  if (left && right) return 'center';
  if (right) return 'right';
  if (left) return 'left';
  return '';
};

const toBlocks = (text: string): Block[] => {
  const lines = text.replace(/\r\n?/g, '\n').split('\n');
  const out: Block[] = [];
  const para: string[] = [];
  let i = 0;

  const flush = (): void => {
    if (para.length > 0) {
      out.push({ kind: 'html', html: `<p>${inline(para.join(' '))}</p>` });
      para.length = 0;
    }
  };

  while (i < lines.length) {
    const line = lines[i];

    const fence = line.match(/^\s*```(.*)$/);
    if (fence) {
      flush();
      const lang = fence[1].trim();
      const code: string[] = [];
      i++;
      while (i < lines.length && !/^\s*```\s*$/.test(lines[i])) code.push(lines[i++]);
      i++;
      const cls = lang ? ` class="language-${esc(lang)}"` : '';
      out.push({ kind: 'html', html: `<pre><code${cls}>${esc(code.join('\n'))}</code></pre>` });
      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.*?)(?:\s+#+)?\s*$/);
    if (heading) {
      flush();
      out.push({ kind: 'heading', level: heading[1].length, title: inline(heading[2]) });
      i++;
      continue;
    }

    if (/^\s*([-*_])(\s*\1){2,}\s*$/.test(line)) {
      flush();
      out.push({ kind: 'html', html: '<hr>' });
      i++;
      continue;
    }

    if (/^\s*>/.test(line)) {
      flush();
      const quoted: string[] = [];
      while (i < lines.length && /^\s*>/.test(lines[i])) quoted.push(lines[i++].replace(/^\s*>\s?/, ''));
      out.push({ kind: 'html', html: `<blockquote>${inline(quoted.join(' '))}</blockquote>` });
      continue;
    }

    if (line.includes('|') && i + 1 < lines.length && TABLE_SEP.test(lines[i + 1])) {
      flush();
      const header = splitRow(line);
      const aligns = splitRow(lines[i + 1]).map(alignOf);
      i += 2;
      const rows: string[][] = [];
      while (i < lines.length && lines[i].trim() && lines[i].includes('|')) rows.push(splitRow(lines[i++]));
      const cell = (tag: 'th' | 'td', text: string, idx: number): string => {
        const align = aligns[idx];
        return `<${tag}${align ? ` style="text-align:${align}"` : ''}>${inline(text)}</${tag}>`;
      };
      const thead = `<thead><tr>${header.map((c, idx) => cell('th', c, idx)).join('')}</tr></thead>`;
      const tbody = `<tbody>${rows
        .map(r => `<tr>${header.map((_, idx) => cell('td', r[idx] ?? '', idx)).join('')}</tr>`)
        .join('')}</tbody>`;
      out.push({ kind: 'html', html: `<div class="table-wrap"><table>${thead}${tbody}</table></div>` });
      continue;
    }

    if (/^\s*([-*+]|\d+\.)\s+/.test(line)) {
      flush();
      const tag = /^\s*\d+\./.test(line) ? 'ol' : 'ul';
      const items: string[] = [];
      while (i < lines.length) {
        const item = lines[i].match(/^\s*([-*+]|\d+\.)\s+(.*)$/);
        if (item) {
          items.push(inline(item[2]));
          i++;
        } else if (items.length > 0 && /^\s+\S/.test(lines[i])) {
          items[items.length - 1] += ' ' + inline(lines[i].trim());
          i++;
        } else {
          break;
        }
      }
      out.push({ kind: 'html', html: `<${tag}>${items.map(x => `<li>${x}</li>`).join('')}</${tag}>` });
      continue;
    }

    if (!line.trim()) {
      flush();
      i++;
      continue;
    }

    para.push(line.trim());
    i++;
  }

  flush();
  return out;
};

const buildTree = (blocks: Block[]): TreeNode[] => {
  const root: TreeNode[] = [];
  const stack: Array<{ level: number; children: TreeNode[] }> = [{ level: 0, children: root }];

  for (const block of blocks) {
    if (block.kind === 'html') {
      stack[stack.length - 1].children.push(block);
      continue;
    }
    while (stack[stack.length - 1].level >= block.level) stack.pop();
    const children: TreeNode[] = [];
    const section: Section = { kind: 'section', level: block.level, title: block.title, children };
    stack[stack.length - 1].children.push(section);
    stack.push({ level: block.level, children });
  }

  return root;
};

const renderTree = (nodes: TreeNode[]): string =>
  nodes
    .map(node =>
      node.kind === 'section'
        ? `<details open class="sec"><summary><h${node.level}>${node.title}</h${node.level}></summary><div class="sec-body">${renderTree(node.children)}</div></details>`
        : node.html
    )
    .join('');

export const markdownToHtml = (text: string): string => renderTree(buildTree(toBlocks(text)));
