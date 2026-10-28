/**
 * PlanStrategyPDF — the plan's strategy document as a PDF (e.g. for a physio or a colleague):
 * plan name, athlete, date and the document's own Markdown (headings, bullets, numbered points,
 * **bold**). Headings stay with their first point; one bullet is never split; footer with page numbers.
 */
import React from 'react';
import { Document, Font, Image, Page, Text, View, StyleSheet } from '@react-pdf/renderer';

Font.register({
  family: 'Geist',
  fonts: [
    { src: '/fonts/Geist-Regular.ttf', fontWeight: 400 },
    { src: '/fonts/Geist-Medium.ttf', fontWeight: 500 },
    { src: '/fonts/Geist-SemiBold.ttf', fontWeight: 600 },
    { src: '/fonts/Geist-Bold.ttf', fontWeight: 700 },
  ],
});
Font.registerHyphenationCallback((word) => [word]);

const C = { fg1: '#18181b', fg2: '#44403c', fg3: '#78716c', border: '#e7e5e4' };
const DEFAULT_ACCENT = '#e2522b';

const s = StyleSheet.create({
  // paddingBottom leaves room for the fixed footer
  page: { fontFamily: 'Geist', fontSize: 10, color: C.fg1, paddingTop: 44, paddingBottom: 64, paddingHorizontal: 48 },
  text: { fontSize: 10, lineHeight: 1.45, color: C.fg1 },
});

export interface PlanStrategyPdfProps {
  text: string;
  planName: string;
  athleteName?: string;
  branding?: { logoBase64?: string; primaryColor?: string; businessName?: string };
  coachName?: string;
}

/** **bold** inside a line, as nested Text */
function inline(text: string): React.ReactNode[] {
  return text.split(/(\*\*[^*]+\*\*)/g).filter(Boolean).map((part, i) => (
    /^\*\*[^*]+\*\*$/.test(part) ? <Text key={i} style={{ fontWeight: 600 }}>{part.slice(2, -2)}</Text> : <Text key={i}>{part}</Text>
  ));
}

/** An UPPERCASE "LABEL:" at the start of a line in bold (older notes) */
function lineText(text: string): React.ReactNode[] {
  const label = text.match(/^([A-ZÄÖÜ0-9][A-ZÄÖÜ0-9 &/()+\-.]{1,40}):\s*(.*)$/);
  if (label && /[A-ZÄÖÜ]{2}/.test(label[1])) return [<Text key="l" style={{ fontWeight: 600 }}>{label[1]}: </Text>, ...inline(label[2])];
  return inline(text);
}

type Block =
  | { kind: 'heading'; text: string; level: number }
  | { kind: 'item'; text: string; marker: string; indent: number }
  | { kind: 'para'; text: string }
  | { kind: 'gap' };

function parse(text: string): Block[] {
  return text.replace(/\r\n/g, '\n').split('\n').map((line): Block => {
    if (!line.trim()) return { kind: 'gap' };
    const h = line.match(/^\s*(#{1,4})\s+(.*)$/);
    if (h) return { kind: 'heading', text: h[2], level: h[1].length };
    const b = line.match(/^(\s*)[-*•]\s+(.*)$/);
    if (b) return { kind: 'item', text: b[2], marker: '•', indent: Math.floor(b[1].replace(/\t/g, '  ').length / 2) };
    const n = line.match(/^(\s*)(\d+)[.)]\s+(.*)$/);
    if (n) return { kind: 'item', text: n[3], marker: `${n[2]}.`, indent: Math.floor(n[1].replace(/\t/g, '  ').length / 2) };
    return { kind: 'para', text: line };
  });
}

function BlockView({ block, accent }: { block: Block; accent: string }) {
  switch (block.kind) {
    case 'gap': return <View style={{ height: 5 }} />;
    case 'heading':
      return block.level <= 2 ? (
        <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 10, marginBottom: 5 }}>
          <View style={{ width: 3, height: 12, backgroundColor: accent, marginRight: 7, borderRadius: 1 }} />
          <Text style={{ fontSize: 12, fontWeight: 700 }}>{inline(block.text)}</Text>
        </View>
      ) : <Text style={{ fontSize: 10.5, fontWeight: 600, marginTop: 6, marginBottom: 2 }}>{inline(block.text)}</Text>;
    case 'item':
      return (
        <View wrap={false} style={{ flexDirection: 'row', marginLeft: 4 + block.indent * 14, marginBottom: 1.5 }}>
          <Text style={[s.text, { width: block.marker.length > 1 ? 16 : 10, color: C.fg3 }]}>{block.marker}</Text>
          <Text style={[s.text, { flex: 1 }]}>{lineText(block.text)}</Text>
        </View>
      );
    default:
      return <Text style={[s.text, { marginBottom: 2 }]}>{lineText(block.text)}</Text>;
  }
}

export function PlanStrategyPDF({ text, planName, athleteName, branding, coachName }: PlanStrategyPdfProps) {
  const accent = branding?.primaryColor && /^#[0-9a-f]{6}$/i.test(branding.primaryColor) ? branding.primaryColor : DEFAULT_ACCENT;
  const studio = branding?.businessName || coachName || '';
  const blocks = parse(text);
  const today = new Date().toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit', year: 'numeric' });

  // A heading is kept with the block after it (one unbreakable piece, directly on the page)
  const pieces: React.ReactNode[] = [];
  for (let i = 0; i < blocks.length; i++) {
    const b = blocks[i];
    if (b.kind === 'heading') {
      let j = i + 1;
      while (j < blocks.length && blocks[j].kind === 'gap') j++;
      pieces.push(
        <View key={i} wrap={false}>
          <BlockView block={b} accent={accent} />
          {j < blocks.length && blocks[j].kind !== 'heading' ? <BlockView block={blocks[j]} accent={accent} /> : null}
        </View>,
      );
      if (j < blocks.length && blocks[j].kind !== 'heading') i = j;
    } else {
      pieces.push(<BlockView key={i} block={b} accent={accent} />);
    }
  }

  return (
    <Document title={`${planName}${athleteName ? ` – ${athleteName}` : ''}`} author={studio || undefined}>
      <Page size="A4" style={s.page}>
        <Text fixed style={{ position: 'absolute', top: 20, left: 48, right: 48, fontSize: 8, color: C.fg3 }}
          render={({ pageNumber }) => (pageNumber > 1 ? `${planName}${athleteName ? ` · ${athleteName}` : ''}` : '')} />

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 12 }}>
          <View style={{ maxWidth: 240 }}>
            {branding?.logoBase64
              ? <Image src={branding.logoBase64} style={{ height: 30, objectFit: 'contain', objectPosition: 'left' }} />
              : studio ? <Text style={{ fontSize: 10, fontWeight: 700, letterSpacing: 1.2, textTransform: 'uppercase' }}>{studio}</Text> : null}
          </View>
          <View style={{ alignItems: 'flex-end', maxWidth: 300 }}>
            <Text style={{ fontSize: 18, fontWeight: 700, textAlign: 'right' }}>{planName || 'Training plan'}</Text>
            <Text style={{ fontSize: 9, color: C.fg3, marginTop: 2 }}>
              {[athleteName, `Strategy · ${today}`].filter(Boolean).join(' · ')}
            </Text>
          </View>
        </View>
        <View style={{ height: 2, backgroundColor: accent, marginBottom: 10 }} />

        {pieces}

        <View fixed style={{
          position: 'absolute', bottom: 24, left: 48, right: 48, flexDirection: 'row', justifyContent: 'space-between',
          borderTopWidth: 0.5, borderTopColor: C.border, paddingTop: 6,
        }}>
          <Text style={{ fontSize: 7.5, color: C.fg3 }}>{[studio, 'Confidential'].filter(Boolean).join(' · ')}</Text>
          <Text style={{ fontSize: 7.5, color: C.fg3 }} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} />
        </View>
      </Page>
    </Document>
  );
}
