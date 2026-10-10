/* eslint-disable */
// 商业计划书系列文档的公共组件（字体：宋体；配色：GO-1 Graphite Orange）
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Footer, Header, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableOfContents, TableLayoutType, SectionType,
} = require("docx");
const fs = require("fs");
const path = require("path");

const CN = "SimSun";
const EN = "Times New Roman";
const FONT = { ascii: EN, eastAsia: CN, hAnsi: EN };

const C = {
  accent: "D4875A", accentD: "B5703F", graph: "1A2330", sub: "2A3340",
  body: "000000", surf: "F8F0EB", line: "DDD0C8", mut: "6B7280", white: "FFFFFF",
};

const NB = { style: BorderStyle.NONE, size: 0, color: "FFFFFF" };
const noBorders = { top: NB, bottom: NB, left: NB, right: NB };
const allNoBorders = { top: NB, bottom: NB, left: NB, right: NB, insideHorizontal: NB, insideVertical: NB };
const tableBorders = {
  top: { style: BorderStyle.SINGLE, size: 2, color: C.accent },
  bottom: { style: BorderStyle.SINGLE, size: 2, color: C.accent },
  left: NB, right: NB,
  insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: C.line },
  insideVertical: NB,
};

const PG = { width: 11906, height: 16838, orientation: PageOrientation.PORTRAIT };
const MG = { top: 1440, bottom: 1440, left: 1701, right: 1417 };

// ── 封面标题布局算法 ──
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([..."，。、；：！？", ..."的与和及之在于为", ..."-_—–·/", ..." \t"]);
  const lines = [];
  let remaining = title;
  while (remaining.length > charsPerLine) {
    let breakAt = -1;
    for (let i = charsPerLine; i >= Math.floor(charsPerLine * 0.6); i--) {
      if (i < remaining.length && breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
    }
    if (breakAt === -1) {
      const limit = Math.min(remaining.length, Math.ceil(charsPerLine * 1.3));
      for (let i = charsPerLine + 1; i < limit; i++) {
        if (breakAfter.has(remaining[i - 1])) { breakAt = i; break; }
      }
    }
    if (breakAt === -1) {
      breakAt = charsPerLine;
      const p = remaining[breakAt - 1], n = remaining[breakAt];
      if (p && n && !breakAfter.has(p) && !breakAfter.has(n) &&
          /[\u4e00-\u9fff]/.test(p) && /[\u4e00-\u9fff]/.test(n)) breakAt -= 1;
    }
    lines.push(remaining.slice(0, breakAt).trim());
    remaining = remaining.slice(breakAt).trim();
  }
  if (remaining) lines.push(remaining);
  if (lines.length > 1 && lines[lines.length - 1].length <= 2) {
    const last = lines.pop();
    lines[lines.length - 1] += last;
  }
  return lines;
}

function calcTitleLayout(title, maxWidthTwips, preferredPt = 40, minPt = 24) {
  const cpl = (pt) => Math.floor(maxWidthTwips / (pt * 20));
  let titlePt = preferredPt, lines;
  while (titlePt >= minPt) {
    const c = cpl(titlePt);
    if (c < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, c);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) { lines = splitTitleLines(title, cpl(minPt)); titlePt = minPt; }
  return { titlePt, titleLines: lines };
}

// ── 基础组件 ──
const emptyPara = () => new Paragraph({ spacing: { line: 20, lineRule: "exact", before: 0, after: 0 }, children: [] });

function richRuns(text, base = {}) {
  const runs = [];
  const re = /【[^】]*】/g;
  let last = 0, m;
  while ((m = re.exec(text))) {
    if (m.index > last) runs.push(new TextRun({ text: text.slice(last, m.index), ...base }));
    runs.push(new TextRun({ text: m[0], ...base, color: C.accentD, bold: true }));
    last = m.index + m[0].length;
  }
  if (last < text.length) runs.push(new TextRun({ text: text.slice(last), ...base }));
  return runs.length ? runs : [new TextRun({ text: String(text), ...base })];
}

function h1(text, newPage = false) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_1, pageBreakBefore: newPage,
    spacing: { before: 400, after: 200, line: 340 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.accent, space: 6 } },
    children: [new TextRun({ text, bold: true, size: 32, color: C.graph, font: FONT })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2, keepNext: true,
    spacing: { before: 300, after: 130, line: 320 },
    children: [new TextRun({ text, bold: true, size: 28, color: C.graph, font: FONT })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3, keepNext: true,
    spacing: { before: 220, after: 110, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: C.sub, font: FONT })],
  });
}
function p(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED, indent: { firstLine: 480 },
    spacing: { line: 312, after: 80 },
    children: richRuns(text, { size: 24, color: C.body, font: FONT }),
  });
}
function pn(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: 80 },
    children: richRuns(text, { size: 24, color: C.body, font: FONT }),
  });
}
function step(label, text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { left: 480, hanging: 480 }, spacing: { line: 312, after: 70 },
    children: [
      new TextRun({ text: label, bold: true, size: 24, color: C.accentD, font: FONT }),
      ...richRuns(text, { size: 24, color: C.body, font: FONT }),
    ],
  });
}
function tcap(text) {
  return new Paragraph({
    keepNext: true, spacing: { before: 200, after: 80, line: 300 },
    children: [new TextRun({ text, bold: true, size: 21, color: C.graph, font: FONT })],
  });
}
function figcap(text) {
  return new Paragraph({
    spacing: { before: 80, after: 200, line: 300 }, alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, size: 21, color: C.mut, font: FONT })],
  });
}
function srcnote(text) {
  return new Paragraph({
    spacing: { after: 160, line: 280 },
    children: [new TextRun({ text, size: 18, color: C.mut, font: FONT })],
  });
}

function mktable(header, rows, widths) {
  const CELL_M = { top: 70, bottom: 70, left: 100, right: 100 };
  const headRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: header.map((t, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: C.accent }, margins: CELL_M,
      verticalAlign: "top",
      children: [new Paragraph({
        alignment: AlignmentType.CENTER, spacing: { line: 290 },
        children: [new TextRun({ text: t, bold: true, size: 19, color: C.white, font: FONT })],
      })],
    })),
  });
  const bodyRows = rows.map((r, ri) => new TableRow({
    cantSplit: true,
    children: r.map((t, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: ri % 2 ? C.surf : "FFFFFF" },
      margins: CELL_M, verticalAlign: "top",
      children: [new Paragraph({
        alignment: AlignmentType.LEFT, spacing: { line: 280 },
        children: richRuns(String(t), { size: 18, color: C.body, font: FONT }),
      })],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders, rows: [headRow, ...bodyRows],
  });
}

function callout(title, lines) {
  const kids = [];
  if (title) {
    kids.push(new Paragraph({
      spacing: { after: 90, line: 300 },
      children: [new TextRun({ text: title, bold: true, size: 22, color: C.accentD, font: FONT })],
    }));
  }
  for (const ln of lines) {
    kids.push(new Paragraph({
      alignment: AlignmentType.JUSTIFIED, spacing: { line: 312, after: 60 },
      children: richRuns(ln, { size: 22, color: C.body, font: FONT }),
    }));
  }
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: { ...allNoBorders, left: { style: BorderStyle.SINGLE, size: 18, color: C.accent } },
    rows: [new TableRow({
      cantSplit: true,
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: C.surf },
        margins: { top: 140, bottom: 140, left: 220, right: 200 },
        borders: { ...noBorders, left: { style: BorderStyle.SINGLE, size: 18, color: C.accent } },
        children: kids,
      })],
    })],
  });
}

function figureBytes(buf, widthPx, ratio) {
  return new Paragraph({
    alignment: AlignmentType.CENTER, spacing: { before: 120, after: 0 },
    children: [new ImageRun({
      data: buf,
      transformation: { width: widthPx, height: Math.round(widthPx * ratio) },
      type: "png",
    })],
  });
}
function figure(dir, file, widthPx, ratio) {
  return figureBytes(fs.readFileSync(path.join(dir, file)), widthPx, ratio);
}

// ── 封面（R4 Top Color Block / GO-1） ──
function buildCover(config) {
  const P = { bg: "1A2330", accent: C.accent, titleColor: C.white, subtitleColor: "B0B8C0",
              metaColor: "6E7783", footerColor: "8A929C" };
  const padL = 1200, padR = 800;
  const availableWidth = 11906 - padL - padR;
  const { titlePt, titleLines } = calcTitleLayout(config.title, availableWidth, 40, 26);
  const titleSize = titlePt * 2;

  const titleBlockHeight = titleLines.length * (titlePt * 23 + 200);
  const englishLabelH = config.englishLabel ? (9 * 23 + 500) : 0;
  const subtitleH = config.subtitle ? (12 * 23 + 200) : 0;
  const upperContentH = englishLabelH + titleBlockHeight + subtitleH;
  const UPPER_H = Math.max(7500, upperContentH + 1500 + 800);
  const topSpacing = Math.max(UPPER_H - upperContentH - 280 - 800, 400);

  const upperBlock = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: UPPER_H, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg }, borders: noBorders,
        verticalAlign: "top", margins: { left: padL, right: padR },
        children: [
          new Paragraph({ spacing: { before: topSpacing } }),
          config.englishLabel ? new Paragraph({
            spacing: { after: 500 },
            children: [new TextRun({
              text: config.englishLabel.split("").join(" "), size: 18, color: P.accent,
              font: FONT, characterSpacing: 60,
            })],
          }) : null,
          ...titleLines.map((line, i) => new Paragraph({
            spacing: { after: i < titleLines.length - 1 ? 100 : 200, line: Math.ceil(titlePt * 23), lineRule: "atLeast" },
            children: [new TextRun({ text: line, size: titleSize, bold: true, color: P.titleColor, font: FONT })],
          })),
          config.subtitle ? new Paragraph({
            spacing: { after: 100, line: Math.ceil(12 * 23), lineRule: "atLeast" },
            children: [new TextRun({ text: config.subtitle, size: 24, color: P.subtitleColor, font: FONT })],
          }) : null,
        ].filter(Boolean),
      })],
    })],
  });

  const divider = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 60, rule: "exact" },
      children: [new TableCell({ borders: noBorders, shading: { type: ShadingType.CLEAR, fill: P.accent }, children: [emptyPara()] })],
    })],
  });

  const lowerContent = [
    new Paragraph({ spacing: { before: 700 } }),
    ...(config.metaLines || []).map(line => new Paragraph({
      indent: { left: padL }, spacing: { after: 110, line: 380 },
      children: [new TextRun({ text: line, size: 26, color: P.metaColor, font: FONT })],
    })),
    new Paragraph({ spacing: { before: 1500 } }),
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
      borders: allNoBorders,
      rows: [new TableRow({
        cantSplit: true,
        children: [new TableCell({
          borders: noBorders, margins: { top: 140, bottom: 0, left: padL, right: padR },
          children: [new Table({
            width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
            borders: { ...allNoBorders, top: { style: BorderStyle.SINGLE, size: 2, color: C.line } },
            rows: [new TableRow({
              cantSplit: true,
              children: [
                new TableCell({
                  width: { size: 52, type: WidthType.PERCENTAGE }, borders: noBorders,
                  children: [new Paragraph({
                    alignment: AlignmentType.LEFT,
                    children: [new TextRun({ text: config.footerLeft || "", size: 20, color: P.footerColor, font: FONT })],
                  })],
                }),
                new TableCell({
                  width: { size: 48, type: WidthType.PERCENTAGE }, borders: noBorders,
                  children: [new Paragraph({
                    alignment: AlignmentType.RIGHT,
                    children: [new TextRun({ text: config.footerRight || "", size: 20, color: P.footerColor, font: FONT })],
                  })],
                }),
              ],
            })],
          })],
        })],
      })],
    }),
  ];

  return [new Table({
    width: { size: 100, type: WidthType.PERCENTAGE }, layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: "FFFFFF" }, borders: noBorders,
        verticalAlign: "top",
        children: [upperBlock, divider, ...lowerContent],
      })],
    })],
  })];
}

function pageNumFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 100 },
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: C.mut, font: FONT })],
    })],
  });
}
function headerBar(text) {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.line, space: 4 } },
      children: [new TextRun({ text, size: 16, color: C.mut, font: FONT })],
    })],
  });
}

function tocPage() {
  return [
    new Paragraph({
      alignment: AlignmentType.CENTER, spacing: { before: 240, after: 320 },
      children: [new TextRun({ text: "目　　录", bold: true, size: 32, color: C.graph, font: FONT })],
    }),
    new TableOfContents("Table of Contents", { hyperlink: true, headingStyleRange: "1-3" }),
    new Paragraph({
      spacing: { before: 200 },
      children: [new TextRun({
        text: "说明：本目录由域代码生成。编辑文档后，请右键点击目录并选择“更新域”，即可刷新页码。",
        italics: true, size: 18, color: C.mut, font: FONT,
      })],
    }),
    new Paragraph({ children: [new PageBreak()] }),
  ];
}

function makeDoc({ title, description, cover, body, headerText }) {
  return new Document({
    creator: "项目团队",
    title,
    description,
    styles: {
      default: {
        document: {
          run: { font: FONT, size: 24, color: C.body },
          paragraph: { spacing: { line: 312 } },
        },
        heading1: { run: { font: FONT, size: 32, bold: true, color: C.graph }, paragraph: { spacing: { before: 400, after: 200, line: 340 } } },
        heading2: { run: { font: FONT, size: 28, bold: true, color: C.graph }, paragraph: { spacing: { before: 300, after: 130, line: 320 } } },
        heading3: { run: { font: FONT, size: 24, bold: true, color: C.sub }, paragraph: { spacing: { before: 220, after: 110, line: 312 } } },
      },
    },
    sections: [
      {
        properties: { page: { size: PG, margin: { top: 0, bottom: 0, left: 0, right: 0 } } },
        children: buildCover(cover),
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { size: PG, margin: MG, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
        },
        footers: { default: pageNumFooter() },
        children: tocPage(),
      },
      {
        properties: {
          type: SectionType.NEXT_PAGE,
          page: { size: PG, margin: MG, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
        },
        headers: { default: headerBar(headerText) },
        footers: { default: pageNumFooter() },
        children: body,
      },
    ],
  });
}

module.exports = {
  C, FONT, PG, MG, allNoBorders, noBorders,
  emptyPara, richRuns, h1, h2, h3, p, pn, step, tcap, figcap, srcnote,
  mktable, callout, figure, figureBytes, makeDoc,
};
