const escapePdfText = (text) => text.replace(/\\/g, "\\\\").replace(/\(/g, "\\(").replace(/\)/g, "\\)");

const buildSimplePdf = ({ title, subtitle, lines, footer }) => {
  const pageWidth = 612;
  const pageHeight = 792;
  const marginLeft = 48;
  let cursorY = pageHeight - 72;

  const drawLines = [];
  const addText = (text, size = 12, gap = 18) => {
    const safeText = escapePdfText(text);
    drawLines.push(`BT /F1 ${size} Tf ${marginLeft} ${cursorY} Td (${safeText}) Tj ET`);
    cursorY -= gap;
  };

  addText(title, 18, 26);
  if (subtitle) {
    addText(subtitle, 12, 22);
  }
  lines.forEach((line) => addText(line, 12, 18));
  if (footer) {
    cursorY = 60;
    addText(footer, 9, 12);
  }

  const content = drawLines.join("\n");
  const contentLength = Buffer.byteLength(content, "utf8");

  const parts = [];
  const offsets = [];
  const pushPart = (chunk) => {
    offsets.push(parts.reduce((sum, item) => sum + item.length, 0));
    parts.push(Buffer.from(chunk, "utf8"));
  };

  pushPart("%PDF-1.4\n");
  pushPart("1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n");
  pushPart("2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n");
  pushPart(
    `3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${pageWidth} ${pageHeight}] ` +
      "/Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n"
  );
  pushPart("4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n");
  pushPart(`5 0 obj\n<< /Length ${contentLength} >>\nstream\n${content}\nendstream\nendobj\n`);

  const xrefOffset = parts.reduce((sum, item) => sum + item.length, 0);
  const xrefEntries = offsets
    .map((offset, index) => `${String(offset).padStart(10, "0")} 00000 n `)
    .join("\n");

  const trailer = `xref\n0 ${offsets.length + 1}\n0000000000 65535 f \n${xrefEntries}\n`;
  const trailerObj = `trailer\n<< /Size ${offsets.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;

  parts.push(Buffer.from(trailer, "utf8"));
  parts.push(Buffer.from(trailerObj, "utf8"));

  return Buffer.concat(parts);
};

export { buildSimplePdf };
