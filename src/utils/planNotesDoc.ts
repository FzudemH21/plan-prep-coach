/**
 * The plan strategy's text ↔ the editor's document (TipTap / ProseMirror JSON).
 *
 * The strategy is stored as light, line-based Markdown — what the AI reads and writes
 * (set_plan_notes) and what PlanNotesView shows: "#".."####" headings, "- " bullets and "1." points
 * (indented two spaces per level), **bold**, plain lines and blank lines. These two functions turn
 * it into the editor's document and back without changing its shape: one line stays one line, no
 * blank lines or escape characters are added (a general Markdown converter would add both).
 */
import type { JSONContent } from '@tiptap/core';

const HEADING = /^\s*(#{1,4})\s+(.*)$/;
const BULLET = /^(\s*)[-*•]\s+(.*)$/;
const NUMBERED = /^(\s*)(\d+)[.)]\s+(.*)$/;

/** "a **b** c" → text nodes, bold where marked */
function inline(text: string): JSONContent[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part) => (
    /^\*\*[^*]+\*\*$/.test(part)
      ? { type: 'text', text: part.slice(2, -2), marks: [{ type: 'bold' }] }
      : { type: 'text', text: part }
  ));
}

const paragraph = (text: string): JSONContent => (text ? { type: 'paragraph', content: inline(text) } : { type: 'paragraph' });

interface OpenList { indent: number; list: JSONContent; kind: 'bulletList' | 'orderedList' }

export function notesToDoc(text: string): JSONContent {
  const doc: JSONContent = { type: 'doc', content: [] };
  const stack: OpenList[] = [];
  const lines = text.replace(/\r\n/g, '\n').replace(/\t/g, '  ').split('\n');

  for (const line of lines) {
    const bullet = line.match(BULLET);
    const numbered = bullet ? null : line.match(NUMBERED);
    if (bullet || numbered) {
      const indent = (bullet ?? numbered)![1].length;
      const kind = bullet ? 'bulletList' : 'orderedList';
      const content = bullet ? bullet[2] : numbered![3];
      while (stack.length && stack[stack.length - 1].indent > indent) stack.pop();
      let top = stack[stack.length - 1];
      if (top && top.indent === indent && top.kind !== kind) { stack.pop(); top = stack[stack.length - 1]; }
      if (!top || top.indent < indent) {
        // A new list: at the top, or inside the last point of the list above
        const list: JSONContent = { type: kind, content: [], ...(kind === 'orderedList' ? { attrs: { start: Number(numbered![2]) || 1 } } : {}) };
        if (top) {
          const items = top.list.content!;
          items[items.length - 1].content!.push(list);
        } else {
          doc.content!.push(list);
        }
        top = { indent, list, kind };
        stack.push(top);
      }
      top.list.content!.push({ type: 'listItem', content: [paragraph(content)] });
      continue;
    }
    // An indented plain line right below a point: more text of that point
    const lead = line.match(/^(\s*)/)![1].length;
    if (line.trim() && lead > 0 && stack.length) {
      while (stack.length > 1 && stack[stack.length - 1].indent >= lead) stack.pop();
      const items = stack[stack.length - 1].list.content!;
      items[items.length - 1].content!.push(paragraph(line.trim()));
      continue;
    }
    stack.length = 0;
    const heading = line.match(HEADING);
    if (heading) {
      doc.content!.push({ type: 'heading', attrs: { level: heading[1].length }, ...(heading[2] ? { content: inline(heading[2]) } : {}) });
    } else {
      doc.content!.push(paragraph(line.trim() ? line.replace(/\s+$/, '') : ''));
    }
  }
  if (doc.content!.length === 0) doc.content!.push({ type: 'paragraph' });
  return doc;
}

/** Text nodes → "a **b** c" (neighbouring bold parts joined) */
function inlineText(node: JSONContent): string {
  let out = '';
  let bold = '';
  for (const child of node.content ?? []) {
    if (child.type !== 'text') { if (child.type === 'hardBreak') { out += (bold ? `**${bold}**` : ''); bold = ''; out += ' '; } continue; }
    const isBold = (child.marks ?? []).some((m) => m.type === 'bold');
    if (isBold) { bold += child.text ?? ''; continue; }
    if (bold) { out += `**${bold}**`; bold = ''; }
    out += child.text ?? '';
  }
  if (bold) out += `**${bold}**`;
  return out;
}

export function docToNotes(doc: JSONContent): string {
  const lines: string[] = [];
  const block = (node: JSONContent, indent: number) => {
    const pad = ' '.repeat(indent);
    switch (node.type) {
      case 'heading':
        lines.push(`${'#'.repeat(Math.min(4, Math.max(1, Number(node.attrs?.level) || 2)))} ${inlineText(node)}`);
        break;
      case 'bulletList':
      case 'orderedList': {
        const start = Number(node.attrs?.start) || 1;
        (node.content ?? []).forEach((item, i) => {
          const marker = node.type === 'bulletList' ? '- ' : `${start + i}. `;
          const [first, ...rest] = item.content ?? [];
          lines.push(`${pad}${marker}${first && first.type === 'paragraph' ? inlineText(first) : ''}`);
          if (first && first.type !== 'paragraph') block(first, indent + 2);
          rest.forEach((child) => block(child, indent + 2));
        });
        break;
      }
      case 'paragraph': {
        const text = inlineText(node);
        lines.push(text ? `${pad}${text}` : '');
        break;
      }
      default:
        if (node.content) node.content.forEach((child) => block(child, indent));
    }
  };
  (doc.content ?? []).forEach((node) => block(node, 0));
  // An empty document is an empty text (not one blank line)
  return lines.length === 1 && lines[0] === '' ? '' : lines.join('\n');
}
