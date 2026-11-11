import { describe, it, expect } from 'vitest';
import { markdownToHtml } from '../src/markdown';

describe('markdownToHtml sections', () => {
  it('wraps a heading and its content in an expanded section', () => {
    expect(markdownToHtml('# Title\n\nBody')).toBe(
      '<details open class="sec"><summary><h1>Title</h1></summary><div class="sec-body"><p>Body</p></div></details>'
    );
  });

  it('nests deeper headings inside their parent section', () => {
    expect(markdownToHtml('# A\n## B\n# C')).toBe(
      '<details open class="sec"><summary><h1>A</h1></summary><div class="sec-body">' +
        '<details open class="sec"><summary><h2>B</h2></summary><div class="sec-body"></div></details>' +
        '</div></details>' +
        '<details open class="sec"><summary><h1>C</h1></summary><div class="sec-body"></div></details>'
    );
  });

  it('leaves content before the first heading outside any section', () => {
    expect(markdownToHtml('intro\n\n# A').startsWith('<p>intro</p><details open class="sec">')).toBe(true);
  });

  it('strips closing hashes from headings', () => {
    expect(markdownToHtml('## Title ##')).toContain('<h2>Title</h2>');
  });

  it('returns an empty string for empty input', () => {
    expect(markdownToHtml('')).toBe('');
  });
});

describe('markdownToHtml inline formatting', () => {
  it('renders bold, italic, code, and links', () => {
    expect(markdownToHtml('This is **bold**, *em*, `code`, and [link](https://x.y).')).toBe(
      '<p>This is <strong>bold</strong>, <em>em</em>, <code>code</code>, and ' +
        '<a href="https://x.y" target="_blank" rel="noopener">link</a>.</p>'
    );
  });

  it('does not apply emphasis inside code spans', () => {
    expect(markdownToHtml('`**x**`')).toBe('<p><code>**x**</code></p>');
  });

  it('escapes HTML in paragraphs', () => {
    expect(markdownToHtml('a <script>alert(1)</script> & b')).toBe(
      '<p>a &lt;script&gt;alert(1)&lt;/script&gt; &amp; b</p>'
    );
  });

  it('joins consecutive lines into one paragraph', () => {
    expect(markdownToHtml('line one\nline two')).toBe('<p>line one line two</p>');
  });
});

describe('markdownToHtml blocks', () => {
  it('renders fenced code with an escaped body and language class', () => {
    expect(markdownToHtml('```ts\nconst a = "<b>";\n```')).toBe(
      '<pre><code class="language-ts">const a = &quot;&lt;b&gt;&quot;;</code></pre>'
    );
  });

  it('renders mermaid blocks as diagram placeholders with escaped source', () => {
    expect(markdownToHtml('```mermaid\nerDiagram\n    a ||--o{ b : "x"\n```')).toBe(
      '<div class="mermaid-block" data-source="erDiagram\n    a ||--o{ b : &quot;x&quot;"></div>'
    );
  });

  it('keeps other mermaid diagram types as code', () => {
    expect(markdownToHtml('```mermaid\nflowchart TD\n  A-->B\n```')).toBe(
      '<pre><code class="language-mermaid">flowchart TD\n  A--&gt;B</code></pre>'
    );
  });

  it('renders unordered lists', () => {
    expect(markdownToHtml('- one\n- two')).toBe('<ul><li>one</li><li>two</li></ul>');
  });

  it('renders ordered lists', () => {
    expect(markdownToHtml('1. a\n2. b')).toBe('<ol><li>a</li><li>b</li></ol>');
  });

  it('renders blockquotes', () => {
    expect(markdownToHtml('> quoted\n> more')).toBe('<blockquote>quoted more</blockquote>');
  });

  it('renders horizontal rules', () => {
    expect(markdownToHtml('---')).toBe('<hr>');
  });
});

describe('markdownToHtml tables', () => {
  it('renders header and body cells with column alignment', () => {
    const html = markdownToHtml('| Name | Qty |\n|:--|--:|\n| apple | 3 |');
    expect(html).toContain(
      '<thead><tr><th style="text-align:left">Name</th><th style="text-align:right">Qty</th></tr></thead>'
    );
    expect(html).toContain(
      '<tbody><tr><td style="text-align:left">apple</td><td style="text-align:right">3</td></tr></tbody>'
    );
  });

  it('wraps tables in a scrollable container', () => {
    expect(markdownToHtml('| a |\n|---|\n| 1 |')).toContain('<div class="table-wrap"><table>');
  });

  it('fills missing trailing cells with empty cells', () => {
    expect(markdownToHtml('| a | b |\n|---|---|\n| only |')).toContain('<tr><td>only</td><td></td></tr>');
  });

  it('does not treat a single pipe-free line as a table', () => {
    expect(markdownToHtml('just text')).not.toContain('<table>');
  });
});
