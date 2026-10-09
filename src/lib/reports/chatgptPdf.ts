import { PDFDocument, StandardFonts, rgb, type PDFFont } from "pdf-lib";
import type { ExportBlock } from "./chatgptExport";

/** Characters Helvetica (WinAnsi) can encode beyond Latin-1. */
const CP1252_EXTRA = "€‚ƒ„…†‡ˆ‰Š‹ŒŽ‘’“”•–—˜™š›œžŸ";
const REPLACE: Record<string, string> = { "−": "-", "\u00a0": " ", "\t": " " };

export function toWinAnsi(text: string): string {
  let out = "";
  for (const ch of text) {
    const mapped = REPLACE[ch] ?? ch;
    const code = mapped.codePointAt(0) ?? 63;
    if ((code >= 0x20 && code <= 0x7e) || (code >= 0xa1 && code <= 0xff) || CP1252_EXTRA.includes(mapped)) {
      out += mapped;
    } else if (code === 0x0a) {
      out += "\n";
    } else {
      out += "?";
    }
  }
  return out;
}

function wrap(text: string, font: PDFFont, size: number, width: number): string[] {
  const lines: string[] = [];
  for (const paragraph of text.split("\n")) {
    let line = "";
    for (const word of paragraph.split(/ +/)) {
      const candidate = line ? `${line} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= width) {
        line = candidate;
        continue;
      }
      if (line) lines.push(line);
      // hard-break very long tokens
      let rest = word;
      while (font.widthOfTextAtSize(rest, size) > width && rest.length > 1) {
        let cut = rest.length - 1;
        while (cut > 1 && font.widthOfTextAtSize(rest.slice(0, cut), size) > width) cut--;
        lines.push(rest.slice(0, cut));
        rest = rest.slice(cut);
      }
      line = rest;
    }
    lines.push(line);
  }
  return lines;
}

export async function renderExportPdf(blocks: ExportBlock[], title: string): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  pdf.setTitle(toWinAnsi(title));
  pdf.setCreator("Moeller BASIL Protein Platform");
  const regular = await pdf.embedFont(StandardFonts.Helvetica);
  const bold = await pdf.embedFont(StandardFonts.HelveticaBold);
  const pageSize: [number, number] = [612, 792];
  const margin = 48;
  const width = pageSize[0] - margin * 2;
  let page = pdf.addPage(pageSize);
  let y = pageSize[1] - margin;

  const ensure = (height: number) => {
    if (y - height < margin) {
      page = pdf.addPage(pageSize);
      y = pageSize[1] - margin;
    }
  };

  for (const block of blocks) {
    if (block.kind === "rule") {
      ensure(12);
      y -= 6;
      page.drawLine({ start: { x: margin, y }, end: { x: margin + width, y }, thickness: 0.5, color: rgb(0.6, 0.6, 0.6) });
      y -= 6;
      continue;
    }
    const style = {
      title: { font: bold, size: 15, before: 0, after: 6 },
      h1: { font: bold, size: 11, before: 8, after: 4 },
      h2: { font: bold, size: 10.5, before: 8, after: 2 },
      p: { font: regular, size: 9, before: 0, after: 4 },
      small: { font: regular, size: 8, before: 0, after: 1 },
      row: { font: regular, size: 7.5, before: 0, after: 1.5 },
    }[block.kind];
    const lineHeight = style.size * 1.3;
    const indent = block.kind === "row" ? 6 : 0;
    const lines = wrap(toWinAnsi(block.text), style.font, style.size, width - indent);
    y -= style.before;
    for (const line of lines) {
      ensure(lineHeight);
      y -= lineHeight;
      page.drawText(line, { x: margin + indent, y: y + 2, size: style.size, font: style.font, color: rgb(0.1, 0.1, 0.1) });
    }
    y -= style.after;
  }
  return pdf.save();
}
