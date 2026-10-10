/* eslint-disable */
// 挑战杯项目简介文档生成脚本 —— 全文字体：宋体
const {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell,
  ImageRun, PageBreak, Footer, Header, PageNumber, NumberFormat,
  AlignmentType, HeadingLevel, WidthType, BorderStyle, ShadingType,
  PageOrientation, TableOfContents, TableLayoutType, SectionType,
} = require("docx");
const fs = require("fs");
const path = require("path");

const DIR = __dirname;

// ─────────────────────────── 字体与配色 ───────────────────────────
// 用户指定：全文字体为宋体（SimSun）。标题以加粗+字号区分层级。
const CN = "SimSun";              // 宋体
const EN = "Times New Roman";
const FONT = { ascii: EN, eastAsia: CN, hAnsi: EN };

const C = {
  accent: "D4875A",   // GO-1 Graphite Orange 强调色
  accentD: "B5703F",  // 深一档强调色（占位符、次级强调）
  graph: "1A2330",    // 主标题色（石墨黑）
  sub: "2A3340",      // 次级标题色
  body: "000000",     // 正文纯黑
  surf: "F8F0EB",     // 浅底
  line: "DDD0C8",     // 内线
  mut: "6B7280",      // 辅助文字
  white: "FFFFFF",
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

// ───────────────────── 封面配方辅助函数（取自 design-system.md） ─────────────────────
function splitTitleLines(title, charsPerLine) {
  if (title.length <= charsPerLine) return [title];
  const breakAfter = new Set([
    ..."，。、；：！？", ..."的与和及之在于为", ..."-_—–·/", ..." \t",
  ]);
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
      const prevChar = remaining[breakAt - 1];
      const nextChar = remaining[breakAt];
      if (prevChar && nextChar && !breakAfter.has(prevChar) && !breakAfter.has(nextChar) &&
          /[\u4e00-\u9fff]/.test(prevChar) && /[\u4e00-\u9fff]/.test(nextChar)) {
        breakAt = breakAt - 1;
      }
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
  const charWidth = (pt) => pt * 20;
  const charsPerLine = (pt) => Math.floor(maxWidthTwips / charWidth(pt));
  let titlePt = preferredPt;
  let lines;
  while (titlePt >= minPt) {
    const cpl = charsPerLine(titlePt);
    if (cpl < 2) { titlePt -= 2; continue; }
    lines = splitTitleLines(title, cpl);
    if (lines.length <= 3) break;
    titlePt -= 2;
  }
  if (!lines || lines.length > 3) {
    const cpl = charsPerLine(minPt);
    lines = splitTitleLines(title, cpl);
    titlePt = minPt;
  }
  return { titlePt, titleLines: lines };
}

function calcCoverSpacing(params) {
  const {
    titleLineCount = 1, titlePt = 36, hasSubtitle = false,
    hasEnglishLabel = false, metaLineCount = 0,
    fixedHeight = 800, pageHeight = 16838, marginTop = 0, marginBottom = 0,
  } = params;
  const SAFETY = 1200;
  const usableHeight = pageHeight - marginTop - marginBottom - SAFETY;
  const titleHeight = titleLineCount * (titlePt * 23 + 200);
  const subtitleHeight = hasSubtitle ? (12 * 23 + 600) : 0;
  const englishLabelHeight = hasEnglishLabel ? (9 * 23 + 600) : 0;
  const metaHeight = metaLineCount * (10 * 23 + 100);
  const implicitParaHeight = 3 * 300;
  const contentHeight = titleHeight + subtitleHeight + englishLabelHeight + metaHeight + fixedHeight + implicitParaHeight;
  const remainingSpace = usableHeight - contentHeight;
  const safeRemaining = Math.max(remainingSpace, 400);
  const FOOTER_MIN = 800;
  const rawTop = Math.floor(safeRemaining * 0.45);
  const rawBottom = Math.floor(safeRemaining * 0.45);
  const bottomSpacing = Math.max(rawBottom, FOOTER_MIN);
  const topSpacing = Math.max(rawTop - Math.max(0, FOOTER_MIN - rawBottom), 400);
  const midSpacing = Math.max(safeRemaining - topSpacing - bottomSpacing, 0);
  return { topSpacing, midSpacing, bottomSpacing };
}

// ─────────────────────────── 组件构造器 ───────────────────────────
const emptyPara = () => new Paragraph({ spacing: { line: 20, lineRule: "exact", before: 0, after: 0 }, children: [] });

// 占位符 【…】 高亮为强调色，便于团队查找替换
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
    heading: HeadingLevel.HEADING_1,
    pageBreakBefore: newPage,
    spacing: { before: 400, after: 200, line: 340 },
    border: { bottom: { style: BorderStyle.SINGLE, size: 6, color: C.accent, space: 6 } },
    children: [new TextRun({ text, bold: true, size: 32, color: C.graph, font: FONT })],
  });
}
function h2(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_2,
    keepNext: true,
    spacing: { before: 300, after: 130, line: 320 },
    children: [new TextRun({ text, bold: true, size: 28, color: C.graph, font: FONT })],
  });
}
function h3(text) {
  return new Paragraph({
    heading: HeadingLevel.HEADING_3,
    keepNext: true,
    spacing: { before: 220, after: 110, line: 312 },
    children: [new TextRun({ text, bold: true, size: 24, color: C.sub, font: FONT })],
  });
}
function p(text) {
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { firstLine: 480 },
    spacing: { line: 312, after: 80 },
    children: richRuns(text, { size: 24, color: C.body, font: FONT }),
  });
}
function pn(text) { // 无首行缩进段落
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    spacing: { line: 312, after: 80 },
    children: richRuns(text, { size: 24, color: C.body, font: FONT }),
  });
}
function step(label, text) { // 编号条目段（避免无序列表堆砌）
  return new Paragraph({
    alignment: AlignmentType.JUSTIFIED,
    indent: { left: 480, hanging: 480 },
    spacing: { line: 312, after: 70 },
    children: [
      new TextRun({ text: label, bold: true, size: 24, color: C.accentD, font: FONT }),
      ...richRuns(text, { size: 24, color: C.body, font: FONT }),
    ],
  });
}
function tcap(text) { // 表题
  return new Paragraph({
    keepNext: true,
    spacing: { before: 200, after: 80, line: 300 },
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text, bold: true, size: 21, color: C.graph, font: FONT })],
  });
}
function figcap(text) { // 图题
  return new Paragraph({
    spacing: { before: 80, after: 200, line: 300 },
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text, size: 21, color: C.mut, font: FONT })],
  });
}
function srcnote(text) {
  return new Paragraph({
    spacing: { after: 160, line: 280 },
    alignment: AlignmentType.LEFT,
    children: [new TextRun({ text, size: 18, color: C.mut, font: FONT })],
  });
}

function mktable(header, rows, widths) {
  const CELL_M = { top: 70, bottom: 70, left: 100, right: 100 };
  const headRow = new TableRow({
    tableHeader: true, cantSplit: true,
    children: header.map((t, i) => new TableCell({
      width: { size: widths[i], type: WidthType.PERCENTAGE },
      shading: { type: ShadingType.CLEAR, fill: C.accent },
      margins: CELL_M,
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
      margins: CELL_M,
      verticalAlign: "top",
      children: [new Paragraph({
        alignment: AlignmentType.LEFT, spacing: { line: 280 },
        children: richRuns(String(t), { size: 18, color: C.body, font: FONT }),
      })],
    })),
  }));
  return new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: tableBorders,
    rows: [headRow, ...bodyRows],
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

function figure(file, widthPx, ratio) {
  const buf = fs.readFileSync(path.join(DIR, file));
  return new Paragraph({
    alignment: AlignmentType.CENTER,
    spacing: { before: 120, after: 0 },
    children: [new ImageRun({
      data: buf,
      transformation: { width: widthPx, height: Math.round(widthPx * ratio) },
      type: "png",
    })],
  });
}

// ─────────────────────────── 封面（R4 Top Color Block / GO-1） ───────────────────────────
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
  const UPPER_MIN = 7500;
  const UPPER_H = Math.max(UPPER_MIN, upperContentH + 1500 + 800);
  const DIVIDER_H = 60;

  const contentEstimate = englishLabelH + titleBlockHeight + subtitleH;
  const spacerIntrinsic = 280;
  const topSpacing = Math.max(UPPER_H - contentEstimate - spacerIntrinsic - 800, 400);

  const upperBlock = new Table({
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: UPPER_H, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: P.bg },
        borders: noBorders,
        verticalAlign: "top",
        margins: { left: padL, right: padR },
        children: [
          new Paragraph({ spacing: { before: topSpacing } }),
          config.englishLabel ? new Paragraph({
            spacing: { after: 500 },
            children: [new TextRun({
              text: config.englishLabel.split("").join(" "),
              size: 18, color: P.accent, font: { ascii: EN, eastAsia: CN, hAnsi: EN },
              characterSpacing: 60,
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
    width: { size: 100, type: WidthType.PERCENTAGE },
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: DIVIDER_H, rule: "exact" },
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
    // 页脚：用无框表格实现左右对齐（避免制表位在 WPS 下的宽度差异）
    new Table({
      width: { size: 100, type: WidthType.PERCENTAGE },
      layout: TableLayoutType.FIXED,
      borders: allNoBorders,
      rows: [new TableRow({
        cantSplit: true,
        children: [new TableCell({
          borders: noBorders,
          margins: { top: 140, bottom: 0, left: padL, right: padR },
          children: [new Table({
            width: { size: 100, type: WidthType.PERCENTAGE },
            layout: TableLayoutType.FIXED,
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
    width: { size: 100, type: WidthType.PERCENTAGE },
    layout: TableLayoutType.FIXED,
    borders: allNoBorders,
    rows: [new TableRow({
      height: { value: 16838, rule: "exact" },
      children: [new TableCell({
        shading: { type: ShadingType.CLEAR, fill: "FFFFFF" },
        borders: noBorders,
        verticalAlign: "top",
        children: [upperBlock, divider, ...lowerContent],
      })],
    })],
  })];
}

// ─────────────────────────── 页脚 ───────────────────────────
function pageNumFooter() {
  return new Footer({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 100 },
      children: [new TextRun({ children: [PageNumber.CURRENT], size: 18, color: C.mut, font: FONT })],
    })],
  });
}
function headerBar() {
  return new Header({
    children: [new Paragraph({
      alignment: AlignmentType.CENTER,
      border: { bottom: { style: BorderStyle.SINGLE, size: 2, color: C.line, space: 4 } },
      children: [new TextRun({
        text: "除草机器人幼苗—杂草辨识与作业规划系统 · 项目简介",
        size: 16, color: C.mut, font: FONT,
      })],
    })],
  });
}

// ═══════════════════════════════ 正文内容 ═══════════════════════════════
const body = [];
const B = (...els) => els.forEach(e => body.push(e));

// ───────────── 第一章 ─────────────
B(h1("第一章  项目概述"));

B(h2("1.1  项目定位与一句话介绍"));
B(p("本项目面向大田与设施农业的除草环节，以瑞芯微 RK3576 边缘计算平台为算力载体、以 USB 摄像头为唯一感知入口，在设备本地实时运行 YOLO 视觉检测模型，把田间的作物幼苗与杂草逐株区分开来，并据此自动生成定点除草作业规划，实现“只除杂草、不伤幼苗”的精准除草。"));
B(callout("一句话介绍（可直接用于商业计划书摘要与 PPT 首页）", [
  "“我们做的是给除草机装上一双会认苗的眼睛：在 RK3576 边缘计算主板上跑 YOLO 视觉识别，实时分辨作物幼苗与杂草，只对杂草下刀、对幼苗绕行，让除草从‘一刀切’变成‘认准了再动手’。”",
]));
B(p("项目的三层定位可以概括为："));
B(step("技术定位：", "把目标检测模型部署到低成本边缘计算平台，实现端侧实时推理，不依赖云端算力与网络，降低延迟、功耗与使用成本。"));
B(step("产品定位：", "一个可加装、可集成的“幼苗—杂草辨识与作业规划”功能模块，既可独立成机，也可作为前装模块出售给农机厂商。"));
B(step("市场定位：", "面向规模化种植主体与农机服务组织，用设备替代除草环节的人工与化学投入，用“减药、减工、保苗”三个可量化收益说服客户。"));
B(p("需要特别说明的是：本项目的技术路线选择 RK3576 而不是云端 GPU，是基于农业场景的四个现实约束——田间往往没有稳定网络、设备需要电池或车载供电、农机对成本极其敏感、作业必须实时（识别延时要小于机具走过的距离）。这四条约束共同决定了“端侧推理”不是权宜之计，而是这个场景下的必然选择。"));

B(h2("1.2  项目背景与需求痛点"));
B(p("除草是种植环节中最费工、最难机械化的工序之一。从播种到封行，作物与杂草在同一个生态位里竞争光、水、肥，杂草若不及时清除，减产可达两位数百分比。而现有的四条除草路径，各自都存在难以回避的缺陷。"));
B(p("人工除草的困境在于成本与人力。随着农村劳动力老龄化和外出务工，除草用工价格持续上涨，农时窗口又极短，往往出现“苗期草荒没人除、等到有空草已大”的局面。"));
B(p("化学除草的核心问题是残留与抗性。长期依赖除草剂带来土壤与水体面源污染、农产品农药残留超标风险，杂草抗药性问题也日益突出；在有机农业、绿色认证基地以及出口农产品基地，化学除草被严格限制甚至禁止。"));
B(p("机械除草则是“一刀切”的暴力逻辑。旋耕、中耕等机具无法识别眼前的植株是苗还是草，只能按行距统一作业，行间与株间的杂草除不净，靠近幼苗的杂草又容易连带伤苗，伤苗率直接影响保苗密度与最终产量。"));
B(p("现有的智能除草设备虽然引入了视觉识别，但普遍存在三个门槛：算力依赖云端或高价 GPU 平台导致设备成本居高不下；对网络与功耗要求高，难以适应田间实际条件；系统封闭，难以与农户已有的机具结合。"));
B(p("这些痛点指向同一个技术缺口：在低成本、低功耗的边缘平台上，把“幼苗与杂草的区分”做准做快。本项目正是针对这一缺口设计的。"));

B(tcap("表 1-1  除草作业主要痛点与本项目对策"));
B(mktable(
  ["痛点类别", "具体表现", "本项目对策"],
  [
    ["人工除草成本高", "用工价格上涨、农时窗口紧张、劳动力老龄化", "以设备替代重复性识别劳动，作业效率不受人力供给制约"],
    ["化学除草有残留", "农药残留风险、杂草抗药性、面源污染，有机农业禁用", "物理方式精准除草，减少甚至免除除草剂投入"],
    ["机械除草会伤苗", "无法区分幼苗与杂草，按行距统一作业", "逐株视觉辨识，仅对杂草目标作业，为幼苗设置保护缓冲"],
    ["智能设备太贵", "依赖云端算力或高价 GPU 平台，整机成本高", "选用 RK3576 边缘计算平台，端侧推理，显著压低硬件成本"],
    ["田间环境不友好", "无稳定网络、供电受限、光照多变", "全离线运行；加入主动补光与光照自适应策略"],
    ["难以融入现有农艺", "系统封闭，无法与农户已有农具配合", "提供标准接口的加装模块形态，兼容常见行走机构"],
  ],
  [20, 40, 40]
));
B(srcnote("说明：表中“对策”为本项目设计目标与实现路径，具体技术手段见第三章。"));

B(h2("1.3  产品形态与系统组成"));
B(p("从交付形态看，本项目的产品由四个部分构成，共同完成一次完整的除草作业闭环。"));
B(step("一、硬件载体：", "以 RK3576 边缘计算主板为核心，外接 USB 摄像头作为感知入口，辅以补光模块、测速传感器与供电管理单元，构成一个可安装在各类行走机构上的独立计算与感知单元。"));
B(step("二、识别内核：", "训练好的 YOLO 目标检测模型经量化转换后部署到 RK3576 的 NPU 上运行，输入摄像头图像，输出“幼苗”“杂草”两类目标的位置与置信度。"));
B(step("三、作业规划：", "把识别结果从图像坐标映射到地面坐标，对相邻目标去重聚类，结合机具行进速度生成按时序排列的作业点位与动作指令，并对低置信度目标执行保护性策略。"));
B(step("四、执行与交互：", "将作业指令下发至执行机构（机械除草部件、变量喷头或激光模组），同时把作业过程记录为可视化报告，供用户查看除草覆盖率、识别数量与作业轨迹。"));
B(p("这四部分的关系是：摄像头负责“看见”，RK3576 与 YOLO 模型负责“认出”，规划模块负责“决定”，执行机构负责“动手”。本项目把前三个环节作为核心技术自主掌握，执行机构则保持开放接口，以便适配不同客户的机具。"));

B(h2("1.4  项目当前进展"));
B(p("项目已完成技术路线的可行性验证，正从“实验室可用”走向“田间可用”。"));
B(h3("1.4.1  已完成工作"));
B(step("硬件环境搭建：", "完成 RK3576 边缘计算平台的系统烧录与运行环境配置，USB 摄像头图像采集链路已打通，可稳定获取田间图像流。"));
B(step("模型选型与训练：", "选定 YOLO 系列轻量级检测框架作为基础模型，完成幼苗—杂草二分类数据集的初步构建与模型训练，在自建验证集上可输出检测结果。"));
B(step("端侧部署验证：", "完成模型向 RKNN 格式的转换与 NPU 推理验证，确认模型可在 RK3576 上以端侧方式运行，不依赖云端。"));
B(step("演示系统：", "实现从摄像头取像到屏幕标注输出的完整演示链路，可实时框选并区分幼苗与杂草。"));
B(h3("1.4.2  正在进行与待开展的工作"));
B(step("数据扩充：", "【补充真实田间多作物、多光照、多生育期的图像数据，目标规模 ____ 张】"));
B(step("指标实测：", "【在真实田间条件下测试识别准确率、误伤率与推理时延，形成测试报告】"));
B(step("执行机构联调：", "【完成识别模块与机械除草执行机构的通信协议定义与联调】"));
B(step("田间试验：", "【在 ____ 基地开展小规模田间试验，记录作业效率与除草效果】"));
B(srcnote("提示：本节是评审与投资人最关注的部分，凡是能拿出实物、照片、视频、测试数据的，务必替换掉上面的占位符并附上佐证材料。"));

B(h2("1.5  项目要素速览"));
B(tcap("表 1-2  项目要素速览"));
B(mktable(
  ["项目要素", "内容"],
  [
    ["项目名称", "除草机器人幼苗—杂草辨识与作业规划系统"],
    ["技术领域", "农业智能装备 / 边缘计算 / 计算机视觉"],
    ["硬件平台", "瑞芯微 RK3576 边缘计算主板 + USB 摄像头"],
    ["核心算法", "YOLO 目标检测（幼苗 / 杂草辨识）+ RKNN 端侧推理"],
    ["核心功能", "实时辨识幼苗与杂草；生成定点除草作业规划；输出作业记录"],
    ["应用场景", "大田作物行间除草、设施农业除草、果园与茶园行间除草"],
    ["目标客户", "种植大户与家庭农场、农业合作社、农机服务组织、农机厂商"],
    ["商业模式", "［整机销售 / 模块加装 / 按亩服务］组合，详见第五章"],
    ["团队构成", "【团队人数 ____ 人，专业构成 ____，指导教师 ____】"],
    ["当前阶段", "【原型样机 / 小试 / 中试，请据实填写】"],
    ["知识产权", "【已申请专利 ____ 项、软著 ____ 项；拟申请清单见 3.8 节】"],
    ["项目来源", "【学校 / 学院名称，参赛组别】"],
  ],
  [22, 78]
));

// ───────────── 第二章 ─────────────
B(h1("第二章  行业与市场分析"));

B(h2("2.1  行业现状与发展趋势"));
B(p("从除草方式的技术演进看，行业正在经历一条清晰的路径：人工除草 → 化学除草 → 机械化除草 → 精准智能除草。每一次跃迁都是由“劳动力成本上升”与“环境约束收紧”这两股力量共同推动的。当前正处在从机械化向精准智能转型的起点，特征是视觉识别、边缘计算与农机装备开始结合，但尚未形成规模化的成熟产品。"));
B(p("从需求侧看，三个变化正在放大精准除草的价值：一是土地流转推动适度规模经营，单个经营主体的作业面积扩大，对设备替代人力的需求更迫切；二是绿色农业与有机农业的认证标准提高，化学除草的使用边界被持续压缩；三是农业从业者结构变化，会操作智能设备的“新农人”比例上升，对智能装备的接受度提高。"));
B(p("从供给侧看，边缘计算芯片的国产化与性价比提升是本项目成立的时代前提。以 RK3576 为代表的国产 SoC 在算力、功耗与成本之间取得了新的平衡，使得“在几百元级主板上跑实时视觉模型”从不可能变为可行，这正是本项目能够把智能除草设备成本降下来的产业基础。"));
B(callout("趋势判断（可用于商业计划书与路演）", [
  "精准除草的市场拐点由三个条件同时成熟触发：① 边缘算力芯片性价比跨过临界点；② 劳动力成本高到设备回本周期可接受；③ 绿色认证与农药减量政策形成刚性约束。本项目判断这三者在当前时点已同时具备，并在技术上做好了准备。",
]));

B(h2("2.2  政策环境"));
B(p("项目所处的政策环境总体有利，主要体现在农药减量、智能农机推广、高标准农田建设与乡村振兴四个方向。政策的价值不仅在于方向指引，更在于可能带来的购置补贴与示范项目机会，这会直接影响客户的采购意愿与项目的推广节奏。"));
B(tcap("表 2-1  政策环境要点与对本项目的影响"));
B(mktable(
  ["政策方向", "要点", "对本项目的影响"],
  [
    ["农药化肥减量增效", "持续推进化肥农药使用量负增长，鼓励绿色防控与物理除草", "替代化学除草需求，是核心政策红利"],
    ["智能农机装备推广", "支持农业机器人、智能农机研发示范", "可能进入农机购置补贴目录，降低用户实际支出"],
    ["高标准农田建设", "田块平整、宜机化改造推进", "改善设备作业条件，扩大可应用面积"],
    ["乡村振兴与产业升级", "支持县域特色产业与农业科技创业", "为项目落地、示范与融资提供政策与资金渠道"],
    ["农机装备补短板", "鼓励丘陵山区与特色作物薄弱环节机械化", "打开果园、茶园等常规机具难以进入的细分场景"],
  ],
  [22, 40, 38]
));
B(srcnote("说明：上述政策方向需团队在撰写商业计划书前核对最新文件名称、发文机关与具体条款，并引用具体文件名，避免在答辩中被追问出处。建议在〖政策依据清单〗中逐条落到文件名与年份。"));

B(h2("2.3  目标客户与客户画像"));
B(p("项目不面向分散的小农户自用，而是聚焦四类有明确采购动机与付费能力的客户。这一取舍的理由是：小农户单块地面积小、设备利用率低、价格敏感度高，不适合作为早期客户；而规模化主体与农机厂商有明确的成本核算逻辑，只要设备的经济账成立，采购决策链条更短。"));
B(tcap("表 2-2  目标客户画像与核心诉求"));
B(mktable(
  ["客户类型", "典型特征", "核心诉求", "付费意愿"],
  [
    ["大户与家庭农场", "经营面积百亩至千亩级，自有农机，注重投入产出比", "降低除草人工投入，保住幼苗密度", "中高，按回本周期决策"],
    ["农业合作社", "统一经营、统一采购，可承担示范角色", "统一作业标准，降低整体生产成本", "中高，重视示范"],
    ["农机服务组织", "提供代耕代管服务，按亩收费，设备利用率高", "提高单机作业效率与作业质量", "高，设备利用率高、回本快"],
    ["农机厂商（前装）", "具备渠道与产能，缺少视觉识别能力", "获得成熟的识别与规划模块，快速形成产品", "高，可批量采购"],
    ["设施与有机基地", "温室大棚、有机认证基地，禁用化学除草", "物理除草方案，避免伤苗", "中，单点价值高"],
  ],
  [20, 30, 30, 20]
));

B(h2("2.4  市场规模测算方法"));
B(p("商业计划书中的市场规模不能只给结论，必须给出可复现的测算口径。本项目建议采用自下而上的方法，从可应用面积出发，逐层收敛到可获得收入，避免直接引用来路不明的行业数字。"));
B(callout("测算公式（请用真实公开数据替换参数）", [
  "潜在市场总额（TAM）= 目标作物种植面积 × 智能除草装备渗透率 × 单套设备价格",
  "可服务市场（SAM）= 目标区域内适合机械化作业的面积 × 渗透率 × 单套设备价格",
  "可获得市场（SOM）= 项目初期可覆盖区域的示范与销售目标 × 单套设备价格",
  "提示：三个口径必须说明数据来源与年份，渗透率必须说明假设依据。",
]));
B(tcap("表 2-3  市场规模测算参数表"));
B(mktable(
  ["参数", "取值", "数据来源 / 假设说明"],
  [
    ["目标作物种植面积", "【____ 万亩】", "建议引用国家统计局或农业农村部最新公开数据，注明作物与年份"],
    ["智能除草装备渗透率", "【____ %】", "需说明假设依据：可参考同类智能农机渗透率或项目调研结果"],
    ["单套设备价格", "【¥____ / 套】", "与第五章定价策略保持一致，不可前后矛盾"],
    ["TAM（潜在市场总额）", "【¥____ 亿元】", "= 上一行三项相乘，请自行核算并核对单位"],
    ["SAM（可服务市场）", "【¥____ 亿元】", "按项目初期可覆盖区域或作物范围收敛"],
    ["SOM（3 年可获得）", "【¥____ 万元】", "须与第六章销量目标、第五章财务预测三处一致"],
  ],
  [26, 20, 54]
));
B(srcnote("说明：本表为测算框架，所有数值均为占位符。撰写商业计划书时，请务必用可追溯的公开统计数据替换，并在页脚标注来源；渗透率等假设参数须在附录中给出推导过程。切勿编造数据，答辩时被追问来源会直接失分。"));

B(h2("2.5  竞争格局与差异化定位"));
B(p("精准除草赛道上的竞争者可以分为四类，各自的强项与短板决定了本项目的切入空间。"));
B(p("第一类是国际农机巨头，优势在于整机集成能力、品牌与渠道，短板是产品价格高、以大型宽幅机具为主，难以覆盖我国小地块、多作物、行距不统一的种植结构。"));
B(p("第二类是国内智能农机厂商，优势是价格与本土渠道，多数从农机本体出发，视觉识别多为外购或弱化处理，识别精度与幼苗保护能力有限。"));
B(p("第三类是视觉除草的创业公司，技术路线与本项目接近，但多采用高算力平台或云端方案，设备成本与功耗偏高，且在国产化替代与供应链自主方面存在短板。"));
B(p("第四类是通用视觉方案商，提供通用检测能力但不理解农艺，缺乏作物生育期、行距、农机作业流程等场景知识，落地效果依赖客户二次开发。"));
B(p("本项目的差异化定位是：以国产边缘计算平台为地基，把“幼苗保护”作为第一优先级的设计目标，用可加装的模块形态切入，把识别能力卖给已经拥有机具与渠道的厂商与合作组织，从而绕开整机制造的重资产环节。"));
B(tcap("表 2-4  竞争格局与差异化对比"));
B(mktable(
  ["竞争类型", "优势", "短板", "本项目差异点"],
  [
    ["国际农机巨头", "整机集成强、品牌与渠道成熟", "价格高、面向大型宽幅机具，不适配小地块", "低成本模块化，适配中小型机具与多种行距"],
    ["国内智能农机厂商", "价格有优势、渠道强", "识别环节多为外购，幼苗保护能力弱", "自主掌握识别内核，可把幼苗误伤率作为核心指标"],
    ["视觉除草创业公司", "技术路线接近、迭代快", "高算力平台或云端方案，成本与功耗高", "端侧低功耗方案，全离线运行，硬件成本可控"],
    ["通用视觉方案商", "算法通用、开发能力强", "不懂农艺，缺少场景知识与数据积累", "聚焦除草场景，积累作物幼苗与杂草的专用数据集"],
  ],
  [19, 24, 28, 29]
));

// ───────────── 第三章 ─────────────
B(h1("第三章  技术方案与创新点"));

B(h2("3.1  系统总体架构"));
B(p("系统自上而下分为感知层、计算层、决策层、执行层与交互支撑层五个层次。感知层负责把田间的光学信息转换为数字图像；计算层在同一块主板上完成模型推理；决策层把识别结果翻译成可执行的作业指令；执行层驱动除草机构完成动作；交互支撑层承担人机交互与数据回流，使模型能够持续迭代。"));
B(p("这种分层设计的关键考虑是解耦：识别算法、作业规划与执行机构之间通过明确定义的接口通信，任一层升级换代都不需要推倒重来。这既降低了研发风险，也让产品能够以模块形式交付给不同客户。"));
B(figure("fig_arch.png", 580, 1079 / 1597));
B(figcap("图 3-1  幼苗—杂草辨识与作业规划系统总体架构"));
B(srcnote("图片来源：本团队自制。该图可直接用于商业计划书与路演 PPT 的技术架构页。"));

B(h2("3.2  硬件方案：RK3576 与 USB 摄像头"));
B(h3("3.2.1  计算平台选型"));
B(p("选择 RK3576 作为计算平台，是综合算力、功耗、成本与国产化程度后的结果。它的 NPU 算力足以支撑轻量级 YOLO 模型的实时推理，同时整板功耗与成本远低于同算力的 GPU 方案，适合车载或电池供电的农机场景。"));
B(tcap("表 3-1  RK3576 主要规格及其在本项目中的作用"));
B(mktable(
  ["规格项", "典型参数", "在本项目中的作用"],
  [
    ["CPU", "8 核：4×Cortex-A72 + 4×Cortex-A53", "承担图像预处理、后处理、作业规划等通用计算任务"],
    ["NPU", "约 6 TOPS 算力，支持 INT4 / INT8 / INT16 量化", "运行量化后的 YOLO 检测模型，是识别实时性的算力保障"],
    ["GPU", "集成图形处理器", "用于人机界面的图形渲染与结果可视化"],
    ["内存与存储", "LPDDR4/4X/5，典型 4GB / 8GB 配置", "承载模型权重、图像缓冲与操作系统运行"],
    ["视频编解码", "支持 H.264 / H.265 硬件编解码", "支持作业过程录像与远程画面回传"],
    ["接口", "USB、MIPI、以太网、UART、GPIO 等", "外接 USB 摄像头；通过 UART/GPIO 与执行机构通信"],
    ["功耗", "典型整板功耗处于低功耗区间", "适配车载供电与电池供电，延长作业时长"],
  ],
  [18, 40, 42]
));
B(srcnote("说明：上表为 RK3576 系列平台的典型规格描述，用于技术方案说明。撰写商业计划书或答辩材料时，请以瑞芯微官方规格书及所选核心板厂商的实际参数为准，并按所选型号补齐准确数值。"));

B(h3("3.2.2  摄像头选型与安装"));
B(p("摄像头是整套系统的信息源头，其选型与安装方式直接决定识别效果的上限。选型时需要权衡的核心参数包括分辨率、帧率、快门方式、接口与防护等级。"));
B(p("分辨率与帧率的取舍取决于作业速度。作业速度越高，单位时间内机具前进的距离越长，需要更高的帧率才能保证不漏检；而分辨率越高，单帧推理耗时越长。两者的平衡点需要通过实测确定，本项目建议以“不漏检”为优先约束，再在满足帧率的前提下提高分辨率。"));
B(p("快门方式的选择同样关键。田间的相对运动会带来运动模糊，卷帘快门在快速行进时会产生果冻效应与几何畸变，影响定位精度；条件允许时优先选用全局快门传感器，或通过降低行进速度、缩短曝光时间来缓解。"));
B(p("安装方面需要确定三个参数：离地高度决定视场覆盖的幅宽；俯仰角决定图像透视变形程度，越接近垂直向下俯拍，坐标映射越简单；遮光与补光设计用于抑制强日照下的反光与阴影干扰，在阴天与清晨傍晚提供稳定照明，这是保证全天候可用性的必要投入。"));

B(h2("3.3  视觉识别算法方案"));
B(p("算法方案围绕“轻量、准、能在端侧跑”三个目标组织，分为数据处理、模型训练与端侧部署三个环节。"));
B(h3("3.3.1  数据集构建与标注"));
B(p("数据质量是识别精度天花板。本项目的数据集按“作物种类 × 生育期 × 光照条件 × 土壤背景”四个维度组织，确保覆盖真实田间的分布。标注采用目标检测的矩形框标注方式，类别上采用“幼苗 / 杂草”二分类；在实践中发现，对同科杂草与作物幼苗形态高度相似的样本，单独标记为难例子集并在训练中加权，比简单增加样本总量更有效。"));
B(p("数据增强策略针对田间特点设计：随机裁剪与缩放模拟不同株距与镜头高度；亮度、对比度、色温扰动模拟光照变化；随机遮挡模拟叶片重叠；伪影与噪声注入模拟摄像头成膜与尘土。这些增强手段在不增加采集成本的前提下显著提升泛化能力。"));
B(h3("3.3.2  模型训练策略"));
B(p("采用 YOLO 系列中的轻量级模型（nano 级）作为基础框架，在检测精度与推理速度之间取得平衡。训练采用迁移学习：以大规模通用检测数据集的预训练权重初始化，再用本项目自建数据集微调，可在样本量有限的情况下获得更好的收敛效果。"));
B(p("输入分辨率的设定是一个关键的工程取舍：分辨率越高，小目标（幼苗期植株在图像中占比很小）的检出率越高，但推理耗时也越长。本项目通过实验确定满足实时性约束下的最高可用分辨率，并对图像中目标密集区域采用高分辨率、稀疏区域采用低分辨率的分级处理策略。"));

B(h3("3.3.3  端侧部署与推理加速"));
B(p("模型训练完成后，需转换为 RK3576 的 RKNN 格式才能在 NPU 上运行。转换过程包括计算图优化、算子替换与量化校准三步。其中量化是最影响精度的环节：采用 INT8 量化可显著提升推理速度并降低内存占用，但会带来精度损失，需要通过代表性校准集来最小化这一损失，并在量化前后对比 mAP 变化，确认精度损失在可接受范围内。"));
B(p("部署阶段的另一项工程优化是多帧时序滤波。单帧检测结果会因光照突变、局部遮挡而出现抖动，导致同一株杂草在相邻帧中被反复识别或在某一帧中丢失。通过引入跨帧的目标关联与投票机制，可以显著降低误检与漏检的抖动，使下发给执行机构的作业指令更加稳定。"));

B(h2("3.4  幼苗与杂草辨识的关键难点及对策"));
B(p("把“区分幼苗与杂草”作为核心命题，必须正视其中的技术难点。这些难点正是本项目的技术价值所在，也是答辩中最可能被追问的部分，因此需要逐条给出清晰的应对逻辑。"));
B(tcap("表 3-2  幼苗—杂草辨识关键难点与对策"));
B(mktable(
  ["难点", "成因", "本项目对策"],
  [
    ["幼苗与杂草形态高度相似", "同科杂草在幼苗期的叶片形状与作物几乎一致", "引入多特征联合判别：叶形、叶脉、叶序、生长点形态，而非仅依赖轮廓；建立难例子集加权训练"],
    ["目标密集与相互遮挡", "出苗期植株密集，叶片相互覆盖", "采用高分辨率输入与时序信息融合，结合多帧关联补全被遮挡目标"],
    ["光照条件剧烈变化", "顺光、逆光、云影、早晚低照度", "训练阶段做光照扰动增强；硬件上增加主动补光与遮光罩；推理阶段做自适应曝光与白平衡"],
    ["目标尺度跨度大", "株距不均、镜头高度变化使目标像素尺寸差异大", "多尺度训练与特征金字塔；必要时按作业速度调整镜头高度或焦距"],
    ["类别不平衡与标注成本高", "杂草样本远多于幼苗，人工标注耗时", "难例挖掘 + 半自动标注：先用模型预标注再人工修正，降低标注成本"],
    ["边缘算力受限", "低成本平台算力有限，难以承载大模型", "选用轻量模型 + INT8 量化 + NPU 加速；通过模型剪枝与算子融合进一步提速"],
    ["误伤幼苗代价高", "一次误判可能直接损失一株作物", "设置置信度安全阈值与幼苗保护缓冲区，低置信度目标一律不作业，宁可漏除不可误伤"],
  ],
  [22, 32, 46]
));

B(h2("3.5  作业规划与执行接口"));
B(p("识别结果本身不等于作业能力。从“看见并认出”到“正确地动手”，中间还存在一系列必须解决的工程问题，这一环节正是本项目区别于纯算法方案的价值所在。"));
B(step("第一步，坐标映射。", "摄像头图像是二维像素平面，而作业机构工作在地面坐标系中，需要通过相机标定与手眼标定建立两者之间的变换关系。标定精度直接决定除草机构的定位精度，是系统精度的关键环节。"));
B(step("第二步，目标去重与聚类。", "同一株杂草在连续多帧中会被重复检测，相邻的多个杂草目标在作业精度允许的范围内也可合并为一次动作。通过目标关联与空间聚类，可以把大量检测框压缩成数量合理的作业点位，降低执行机构的动作频次与机械损耗。"));
B(step("第三步，作业序列规划。", "结合机具行进速度与执行机构的动作响应时间，把作业点位按时间顺序排列，确保每个目标在机具到达其上方时动作恰好完成。这一环节需要与行走速度实时同步，速度变化时自动调整触发时机。"));
B(step("第四步，安全策略。", "这是本项目最重要的设计原则：系统始终以“不误伤幼苗”优先于“除净杂草”。具体措施包括设定置信度安全阈值、在幼苗周围设置保护缓冲区、检测到异常（如图像质量骤降、目标密度异常）时自动暂停作业并提示人工介入。"));
B(step("第五步，执行接口。", "定义统一的作业指令协议，输出“位置 + 动作类型 + 动作强度”的结构化指令，使同一套识别与规划系统能够驱动机械除草部件、变量喷头或激光模组等不同执行机构，实现硬件无关的模块化交付。"));

B(h2("3.6  关键技术指标"));
B(p("技术指标是项目从概念走向可信的凭证。下表列出本项目的指标体系与目标值，建议团队在完成田间测试后，用实测数据替换目标值，并保留测试条件说明（作物种类、生育期、光照条件、作业速度），使数据可被复现与验证。"));
B(tcap("表 3-3  关键技术指标（目标值）"));
B(mktable(
  ["指标类别", "指标项", "目标值", "说明"],
  [
    ["识别精度", "幼苗 / 杂草检测 mAP@0.5", "【≥ ____%】", "在自建验证集与田间实测集上分别给出"],
    ["识别精度", "杂草识别召回率", "【≥ ____%】", "召回率决定漏除率，应优先保证"],
    ["幼苗保护", "幼苗误伤率", "【≤ ____%】", "本项目最核心的差异化指标"],
    ["实时性", "单帧推理时延", "【≤ ____ ms】", "在 RK3576 NPU 上实测"],
    ["实时性", "视频处理帧率", "【≥ ____ FPS】", "需满足作业速度下不漏检的要求"],
    ["作业能力", "作业幅宽", "【____ m】", "由镜头视场角与安装高度决定"],
    ["作业能力", "行进作业速度", "【____ km/h】", "与帧率、执行机构响应共同约束"],
    ["功耗", "整机功耗（不含执行机构）", "【≤ ____ W】", "影响电池供电时长与作业续航"],
    ["成本", "单套硬件成本", "【≤ ¥____】", "决定定价空间与商业模式可行性"],
  ],
  [16, 30, 20, 34]
));
B(srcnote("说明：表中所有数值均为待实测的目标值。请在完成田间试验后替换为实测结果，并保留原始测试记录，答辩时可作为支撑材料提交。切勿直接引用未经测试的数字，这是评审最常核查的环节。"));

B(h2("3.7  主要创新点"));
B(p("本项目的创新性不在单一算法，而在于把边缘计算、视觉识别与农艺需求结合成一个可用、可交付、可负担的系统。具体可归纳为四点："));
B(step("创新点一：以端侧低功耗平台承载实时视觉识别。", "针对田间无网络、供电受限、成本敏感的现实约束，把 YOLO 模型量化部署到 RK3576 的 NPU 上运行，实现全离线实时推理，摆脱对云端算力的依赖，显著降低设备成本与使用门槛。"));
B(step("创新点二：把“幼苗保护”确立为第一优先级的设计目标。", "不同于以检出率或作业效率为唯一目标的技术路线，本项目在安全阈值、保护缓冲区、异常停机等机制上系统性地贯彻“宁漏除、不误伤”的原则，直击农户对伤苗的核心顾虑。"));
B(step("创新点三：面向幼苗期难例的多特征辨识策略。", "针对同科杂草与作物幼苗形态高度相似这一最难场景，采用叶形、叶脉、叶序、生长点形态等多特征联合判别，并配合难例子集加权训练，提升易混淆样本的判别能力。"));
B(step("创新点四：识别与执行解耦的模块化架构。", "通过标准化的作业指令协议把识别规划层与执行机构解耦，使同一模块能够驱动机械除草部件、变量喷头或激光模组，也便于作为前装模块出售给农机厂商，形成可复制的商业模式。"));

B(h2("3.8  技术壁垒与知识产权布局"));
B(p("技术壁垒需要说明“别人为什么不能轻易复制”。本项目构建的壁垒来自三个方面：一是专用数据集，覆盖多作物、多生育期、多光照条件的幼苗与杂草标注数据需要长期积累，无法短期购买获得；二是工程化经验，模型量化、时序滤波、坐标映射与执行接口的调优依赖大量田间实测，属于隐性知识；三是场景理解，把农艺要求转化为算法约束的能力需要跨学科团队。"));
B(tcap("表 3-4  知识产权布局建议"));
B(mktable(
  ["布局方向", "建议形式", "拟保护内容", "当前状态"],
  [
    ["识别方法", "发明专利", "面向幼苗期难例的幼苗—杂草多特征辨识方法", "【已申请 / 拟申请】"],
    ["系统架构", "发明专利", "边缘计算平台上的实时除草作业规划方法与装置", "【已申请 / 拟申请】"],
    ["软件系统", "软件著作权", "幼苗—杂草辨识与作业规划软件", "【已登记 / 拟登记】"],
    ["数据集", "商业秘密", "多作物幼苗—杂草标注数据集", "【保护中】"],
    ["机械结构", "实用新型", "摄像头与执行机构的安装结构、遮光与补光组件", "【已申请 / 拟申请】"],
  ],
  [16, 14, 46, 24]
));
B(srcnote("提示：知识产权是挑战杯评审与商业计划书的重要加分项。建议在参赛前至少完成 1 项发明专利申请与 1 项软件著作权登记，并在文档、PPT 中附上受理通知书编号。"));

// ───────────── 第四章 ─────────────
B(h1("第四章  产品形态与作业流程"));

B(h2("4.1  产品形态与交付方式"));
B(p("为适配不同客户的采购能力与使用习惯，产品设计为三种交付形态，可选其一或组合销售。"));
B(step("形态一：加装模块（切入形态）。", "交付一台包含 RK3576 主板、摄像头、补光与安装支架的识别规划单元，通过标准接口与客户已有的行走机构及除草部件连接。特点是单价低、决策门槛低、可快速铺开，适合作为市场切入产品。"));
B(step("形态二：整机产品（价值形态）。", "提供包含行走底盘、识别规划单元与除草执行机构的完整除草设备。特点是单套价值高、用户体验完整，适合规模化种植主体与农机服务组织，但研发与制造投入大，适合在模块验证成功后推进。"));
B(step("形态三：技术授权与定制（杠杆形态）。", "面向农机厂商提供识别规划模块的前装配套与定制开发，把技术能力嵌入合作方的量产产品。特点是可借助合作方渠道实现规模放量，不占用自有产能，是中期最重要的增长杠杆。"));

B(h2("4.2  标准作业流程"));
B(p("一次完整的作业由八个步骤组成，形成从感知到执行的闭环，并通过低置信度复核机制保证幼苗安全。"));
B(figure("fig_flow.png", 580, 494 / 1753));
B(figcap("图 4-1  标准作业流程"));
B(srcnote("图片来源：本团队自制。该图可直接用于商业计划书与路演 PPT 的产品流程页。"));
B(tcap("表 4-1  标准作业流程说明"));
B(mktable(
  ["步骤", "环节", "主要动作", "关键技术"],
  [
    ["1", "图像采集", "摄像头按固定帧率采集田间图像", "曝光控制、帧同步"],
    ["2", "图像预处理", "去噪、畸变校正、尺寸归一化", "相机标定、图像滤波"],
    ["3", "YOLO 端侧推理", "模型在 NPU 上完成前向计算", "RKNN 部署、INT8 量化"],
    ["4", "幼苗—杂草判别", "输出目标类别与置信度", "多特征判别、时序滤波"],
    ["5", "目标定位聚类", "像素坐标映射到地面坐标", "手眼标定、空间聚类"],
    ["6", "作业序列规划", "生成作业点位与动作指令", "速度同步、动作时序规划"],
    ["7", "定点除草执行", "仅对杂草目标驱动执行机构动作", "标准作业指令协议"],
    ["8", "作业记录回传", "记录作业轨迹，生成作业报告", "数据存储、可视化"],
  ],
  [8, 22, 38, 32]
));
B(srcnote("流程中的闭环机制：第 4 步识别置信度低于安全阈值时，系统标记该目标为待复核并跳过作业，避免误伤幼苗。"));

B(h2("4.3  典型应用场景"));
B(p("项目的适用范围覆盖三类场景，优先级由技术成熟度与市场价值共同决定。建议早期聚焦大田行间除草，形成标准化产品后向设施农业与果园茶园拓展。"));
B(tcap("表 4-2  典型应用场景与推进优先级"));
B(mktable(
  ["应用场景", "作业特点", "技术要求", "推进优先级"],
  [
    ["大田作物行间除草", "行距规则、面积大、作业速度要求高", "高帧率、稳定光照适应", "首选，作为第一批落地场景"],
    ["设施农业（大棚）", "空间封闭、光照可控、地面平整", "高精度定位，可低速作业", "次选，技术难度低，验证精度"],
    ["果园与茶园行间", "行间空间窄、多年生作物、地形起伏", "窄幅作业、避障能力", "三期，需配合机械结构改进"],
    ["有机与绿色认证基地", "禁用化学除草，伤苗零容忍", "极高幼苗保护能力", "示范价值高，作为标杆案例打造"],
  ],
  [24, 28, 26, 22]
));

B(h2("4.4  产品迭代路线"));
B(p("产品演进遵循“先可用、再好用、最后规模化”的逻辑，每一代产品的目标与验证重点各不相同。"));
B(tcap("表 4-3  产品迭代路线"));
B(mktable(
  ["版本", "阶段目标", "核心能力", "验证重点"],
  [
    ["V1.0 原理样机", "打通识别链路", "摄像头取像 + 端侧识别 + 标注显示", "识别精度与速度是否达标"],
    ["V2.0 作业样机", "打通作业闭环", "识别规划 + 执行机构联调 + 定点除草", "幼苗误伤率与作业稳定性"],
    ["V3.0 产品化", "形成可交付产品", "结构防护、人机界面、作业记录与报告", "田间可靠性、易用性与成本"],
    ["V4.0 平台化", "跨场景复制", "多作物模型库、标准化接口、前装配套", "跨作物泛化能力与商业可复制性"],
  ],
  [16, 18, 38, 28]
));

// ───────────── 第五章 ─────────────
B(h1("第五章  商业模式设计"));

B(h2("5.1  商业模式画布"));
B(p("商业模式的核心逻辑是：把识别规划能力作为标准模块，通过三种交付形态分别触达不同客户，用硬件收入覆盖成本、用服务与授权收入提升毛利，用积累的田间数据持续加固技术壁垒。"));
B(tcap("表 5-1  商业模式画布"));
B(mktable(
  ["模块", "内容"],
  [
    ["客户细分", "种植大户与家庭农场、农业合作社、农机服务组织、农机厂商、设施农业与有机基地"],
    ["价值主张", "用低成本端侧视觉识别实现精准除草：减药（替代化学除草）、减工（替代人工识别）、保苗（不误伤幼苗）"],
    ["渠道通路", "农机经销商与农机合作社、农技推广站与示范基地、农机展会展销、农机厂商前装配套、短视频与农业新媒体"],
    ["客户关系", "设备销售 + 安装培训 + 作业季技术支持 + 软件与模型升级服务"],
    ["收入来源", "硬件销售（模块 / 整机）、前装配套与技术授权、软件与模型升级服务费、按亩作业服务费"],
    ["核心资源", "幼苗—杂草辨识算法与模型、标注数据集、RK3576 端侧部署工程能力、跨学科团队"],
    ["关键业务", "算法研发与模型迭代、硬件集成与量产、示范推广与渠道建设、田间试验与数据积累"],
    ["重要伙伴", "核心板与摄像头供应商、农机厂商与经销商、农业示范基地与合作社、高校与科研院所"],
    ["成本结构", "硬件物料与装配、研发人力、田间试验与示范、渠道与服务、生产与售后"],
  ],
  [18, 82]
));

B(h2("5.2  收入模式"));
B(p("收入由四部分构成，早期以硬件销售为主，中期逐步提高服务与授权的收入占比，以改善整体毛利结构。"));
B(step("一、硬件销售。", "包括识别规划模块与整机产品。这是早期的主要收入来源，特点是单价明确、易于核算，但毛利受硬件成本约束。"));
B(step("二、前装配套与技术授权。", "面向农机厂商按套收取模块费用或按项目收取授权费。这是中期最重要的规模杠杆，可借助合作方渠道放量，且研发边际成本低。"));
B(step("三、软件与模型升级服务。", "按年收取模型更新、作物种类扩展与功能升级的服务费。特点是持续性收入、毛利高，且能增强客户粘性。"));
B(step("四、按亩作业服务费。", "与农机服务组织合作，按实际作业亩数收费。特点是客户无需一次性投入，决策门槛最低，适合用作市场教育手段。"));

B(h2("5.3  定价策略"));
B(p("定价的基本依据是客户的投资回收周期。只要设备投入能在客户可接受的时间内通过节省的人工与农药成本收回，采购决策就会自然成立。因此定价需要与第六章的效益测算相互印证，不能孤立给出。"));
B(tcap("表 5-2  定价策略框架"));
B(mktable(
  ["产品形态", "定价方式", "建议价格", "定价依据"],
  [
    ["识别规划模块", "按套一次性收费", "【¥____ / 套】", "硬件物料成本 + 合理毛利；对标人工除草年支出"],
    ["整机产品", "按台一次性收费", "【¥____ / 台】", "整机成本 + 渠道费用 + 毛利；对标农机购置预算"],
    ["前装配套", "按套批量供货价", "【¥____ / 套】", "批量折扣 + 长期合作协议"],
    ["模型升级服务", "按年订阅", "【¥____ / 年】", "研发投入摊销 + 服务成本"],
    ["按亩作业服务", "按亩计费", "【¥____ / 亩】", "对标当地人工除草市场价"],
  ],
  [20, 22, 22, 36]
));
B(srcnote("提示：定价必须与 2.4 节的市场规模测算、5.6 节的财务预测保持一致。三处数字互相矛盾是商业计划书评审最常见的扣分点。"));

B(h2("5.4  渠道与客户获取"));
B(p("农业客户的采购决策高度依赖“看得见的效果”，因此渠道策略以示范驱动为核心，而非单纯的广告投放。"));
B(step("示范先行。", "与农技推广站、示范基地、种植大户合作建立示范田，在真实作业季展示除草效果与幼苗保护数据，用可量化的对比结果说服客户。"));
B(step("渠道借力。", "通过农机经销商与农机合作社触达终端客户。这类渠道已经具备农机销售与售后能力，可复用其客户关系与服务体系，降低自建渠道的成本。"));
B(step("厂商合作。", "与农机厂商建立前装配套关系，把识别模块嵌入其量产机具。这是规模化最快、但谈判周期较长的路径，建议在示范效果确立后启动。"));
B(step("内容营销。", "通过短视频与农业新媒体发布田间实测视频，直观展示“识别幼苗、只除杂草”的过程。农业领域的内容传播转化率较高，是低成本的获客手段。"));

B(h2("5.5  成本结构与单位经济模型"));
B(p("单位经济模型回答一个核心问题：每卖出一套设备，能赚多少钱。这是投资人与评审判断商业模式是否成立的关键，必须给出清晰的成本拆解。"));
B(tcap("表 5-3  成本结构拆解"));
B(mktable(
  ["成本项", "构成内容", "金额 / 占比", "说明"],
  [
    ["硬件物料（BOM）", "RK3576 核心板与底板、USB 摄像头、补光模块、结构件、线束、电源", "【¥____ / 套】", "最大单项成本，随批量上升有下降空间"],
    ["执行机构", "机械除草部件 / 变量喷头 / 激光模组", "【¥____ / 套】", "整机形态才包含；模块形态由客户自备"],
    ["装配与测试", "整机装配、标定、老化测试", "【¥____ / 套】", "随量产规模摊薄"],
    ["渠道费用", "经销商折扣与返点", "【____ %】", "参考农机行业通行比例"],
    ["研发摊销", "研发人力与试验成本按预期销量摊销", "【¥____ / 套】", "销量越大，摊销越低"],
    ["售后与服务", "安装培训、保修与技术支持", "【¥____ / 套】", "按保修期与故障率估算"],
    ["单套毛利", "售价 − 上述成本合计", "【¥____ / 套】", "需给出毛利率并说明与同行对比是否合理"],
  ],
  [20, 36, 20, 24]
));

B(h2("5.6  三年财务预测框架"));
B(p("财务预测不宜给出脱离假设的漂亮数字，而应把假设写在明处，让读者能够自行判断合理性。下表给出预测框架，所有数值需由团队依据市场规模测算与产能规划填写。"));
B(tcap("表 5-4  三年财务预测框架"));
B(mktable(
  ["项目", "第一年", "第二年", "第三年", "关键假设说明"],
  [
    ["模块销量（套）", "【____】", "【____】", "【____】", "依据示范推广进度与渠道覆盖能力"],
    ["整机销量（台）", "【____】", "【____】", "【____】", "依据产能与客户开发节奏"],
    ["营业收入（万元）", "【____】", "【____】", "【____】", "= 各形态销量 × 对应单价"],
    ["营业成本（万元）", "【____】", "【____】", "【____】", "= 销量 × 单套成本"],
    ["毛利（万元）", "【____】", "【____】", "【____】", "= 营业收入 − 营业成本"],
    ["毛利率", "【____ %】", "【____ %】", "【____ %】", "需说明随规模上升而改善的原因"],
    ["研发费用（万元）", "【____】", "【____】", "【____】", "算法迭代与新产品开发投入"],
    ["期间费用（万元）", "【____】", "【____】", "【____】", "人员、渠道、市场与售后"],
    ["净利润（万元）", "【____】", "【____】", "【____】", "= 毛利 − 研发 − 期间费用"],
    ["融资需求（万元）", "【____】", "【____】", "【____】", "需说明资金用途与出让股权比例"],
  ],
  [22, 14, 14, 14, 36]
));
B(srcnote("提示：财务预测必须与 2.4 节的 SOM、5.3 节的定价、第六章的路线图三处保持一致。建议同时准备一张“假设-结果”对照表放在商业计划书附录，便于答辩时快速解释数字来源。"));

// ───────────── 第六章 ─────────────
B(h1("第六章  团队与实施计划"));

B(h2("6.1  团队构成与分工"));
B(p("项目的跨学科属性决定了团队需要覆盖算法、硬件、农艺与商业四个方向。请在提交材料前把下表替换为真实成员信息，并突出每位成员与分工直接相关的经历、技能或成果。"));
B(tcap("表 6-1  团队构成与分工"));
B(mktable(
  ["角色", "姓名", "专业 / 年级", "主要职责", "相关经历或成果"],
  [
    ["项目负责人", "【姓名】", "【专业 / 年级】", "总体方案设计、进度管理、对外汇报", "【相关项目、竞赛或论文经历】"],
    ["算法负责人", "【姓名】", "【专业 / 年级】", "数据集构建、模型训练与调优、精度指标", "【相关算法项目或成果】"],
    ["硬件负责人", "【姓名】", "【专业 / 年级】", "RK3576 平台搭建、摄像头与电路、结构设计", "【相关硬件项目或成果】"],
    ["部署与工程负责人", "【姓名】", "【专业 / 年级】", "模型量化部署、NPU 加速、系统联调", "【相关嵌入式开发经历】"],
    ["农艺顾问", "【姓名】", "【专业 / 单位】", "作物与杂草识别知识、田间试验设计", "【相关农业科研或推广经历】"],
    ["商业与财务", "【姓名】", "【专业 / 年级】", "市场调研、商业模式、财务测算与计划书", "【相关商赛或调研经历】"],
    ["指导教师", "【姓名】", "【职称 / 单位】", "技术指导、资源协调", "【研究方向与代表性成果】"],
  ],
  [16, 12, 16, 30, 26]
));

B(h2("6.2  研发与产业化路线图"));
B(p("路线图把技术研发与市场落地两条线索并行推进，每个阶段都设置明确的交付物与验收标准，避免出现“技术做完了但没人用”或“有订单但做不出来”的脱节。"));
B(tcap("表 6-2  研发与产业化路线图"));
B(mktable(
  ["阶段", "时间", "技术目标", "市场目标", "交付物"],
  [
    ["第一阶段", "【____】", "完成识别精度与实时性达标；确定最佳输入分辨率", "完成 1 个示范点洽谈", "测试报告、视频"],
    ["第二阶段", "【____】", "打通识别与执行机构联调；幼苗误伤率达标", "建立 1–2 个示范田并完成实测", "作业样机、田间测试数据"],
    ["第三阶段", "【____】", "完成产品化设计：防护结构、人机界面、作业报告", "取得首批试点订单", "样机、用户手册"],
    ["第四阶段", "【____】", "扩展作物种类模型库；开放标准接口", "签订前装配套合作或区域代理", "定型、合作协议"],
  ],
  [12, 12, 32, 24, 20]
));

B(h2("6.3  里程碑与关键节点"));
B(p("里程碑是判断项目是否按计划推进的客观标尺。建议在商业计划书中以时间轴形式呈现，并突出已经完成的部分，以证明项目具备执行力而非停留在设想阶段。"));
B(step("里程碑一：识别链路打通。", "完成从摄像头取像到屏幕标注输出的完整演示，验证技术路线可行。"));
B(step("里程碑二：精度指标达标。", "在真实田间条件下完成精度与误伤率测试，形成可佐证的测试报告。"));
B(step("里程碑三：作业闭环完成。", "识别规划模块与执行机构联调成功，实现完整的自动除草作业。"));
B(step("里程碑四：示范田落地。", "在示范基地完成一个完整作物季的作业验证，取得用户反馈与对比数据。"));
B(step("里程碑五：首批订单。", "取得首批试点订单或前装配套意向协议，验证商业模式的可行性。"));

B(h2("6.4  资源需求与经费预算"));
B(tcap("表 6-3  经费预算框架"));
B(mktable(
  ["预算科目", "用途说明", "金额（万元）", "备注"],
  [
    ["硬件与器件", "RK3576 主板、摄像头、执行机构、结构与测试器件", "【____】", "含备件与损耗"],
    ["数据采集与标注", "田间图像采集差旅、标注劳务", "【____】", "数据规模决定投入"],
    ["测试与试验", "田间试验、场地与第三方检测", "【____】", "含多作物、多生育期测试"],
    ["软件与云资源", "训练算力租用、开发工具", "【____】", "训练阶段算力需求"],
    ["知识产权", "专利申请、软件著作权登记", "【____】", "建议优先保证发明专利申请"],
    ["差旅与推广", "示范推广、渠道对接、参展", "【____】", "示范点是关键投入"],
    ["其他", "耗材、资料、不可预见费", "【____】", "预留一定比例"],
    ["合计", "—", "【____】", "与融资需求保持一致"],
  ],
  [20, 40, 18, 22]
));

// ───────────── 第七章 ─────────────
B(h1("第七章  风险分析与应对"));
B(p("风险分析的价值在于展示团队对困难的清醒认识，而非罗列免责条款。下表逐项说明风险的表现、影响、应对措施与验证方式，其中“验证方式”是最容易被忽略却最能体现可信度的部分。"));
B(tcap("表 7-1  风险识别、应对与验证"));
B(mktable(
  ["风险类别", "风险表现", "影响", "应对措施", "验证方式"],
  [
    ["技术风险", "同科杂草与幼苗难以区分，识别精度不达标", "高", "多特征联合判别、难例子集加权训练、扩大数据覆盖", "在含同科杂草的测试集上单独评估精度"],
    ["技术风险", "田间光照剧烈变化导致识别不稳定", "中高", "主动补光与遮光设计、光照增强训练、自适应曝光", "在顺光 / 逆光 / 阴天多条件下重复测试"],
    ["技术风险", "边缘平台算力不足，实时性不达标", "中", "轻量模型、INT8 量化、算子融合与分级处理", "实测单帧时延与帧率，验证是否满足作业速度要求"],
    ["技术风险", "误伤幼苗造成用户信任危机", "高", "安全阈值、保护缓冲区、异常停机、低置信度跳过", "实测幼苗误伤率，并做长时间连续作业测试"],
    ["市场风险", "农户对智能设备接受度低、采购意愿不足", "中高", "示范田直观展示效果、推出按亩服务降低决策门槛", "统计示范点转化率与客户访谈反馈"],
    ["市场风险", "设备价格超出客户承受范围", "中高", "模块化降低单价、争取农机补贴目录、分期与服务模式", "对标人工除草年支出核算回本周期"],
    ["竞争风险", "大企业或同类创业公司快速进入", "中", "聚焦幼苗保护与端侧低成本差异点，快速积累数据与专利", "跟踪竞品动态，保持指标领先并形成专利壁垒"],
    ["供应链风险", "核心板或摄像头供应波动、成本上升", "中", "多供应商备选、关键器件提前备货、设计兼容替代方案", "建立备选物料清单并完成兼容性验证"],
    ["合规风险", "数据采集涉及隐私或土地使用许可", "低", "与基地签订数据使用协议，获取作业许可", "留存协议与许可证明"],
    ["团队风险", "成员毕业或调动导致研发中断", "中", "文档化技术资产、明确交接机制、指导教师在岗保障", "模块两人以上熟悉，建立代码与文档规范"],
  ],
  [13, 24, 10, 30, 23]
));

B(h2("7.1  关键风险的验证计划"));
B(p("在上述风险中，识别精度、幼苗误伤率与实时性三项是决定项目成败的关键。建议团队在参赛前集中资源完成这三项的实测，并把测试条件、样本量、评价方法完整记录下来。这不仅是应对评审追问的最佳准备，也是后续融资时最有力的技术凭证。"));

// ───────────── 第八章 ─────────────
B(h1("第八章  社会价值与育人价值"));
B(p("挑战杯评审不仅关注项目的商业价值，同样关注项目的社会意义与育人成效。本章内容可直接作为商业计划书的社会价值章节与路演结尾页素材。"));
B(h2("8.1  经济效益"));
B(p("对使用者而言，项目的经济效益来自三处节省：节省除草人工投入、减少化学除草剂支出、通过降低伤苗率保住产量。若能给出“每亩节约成本”与“设备回本周期”两个可核算的数字，说服力会显著增强。"));
B(step("节约人工：", "除草人工按当地日工价与亩均用工量估算，得到每亩可节省的人工成本【¥____ / 亩】。"));
B(step("减少药耗：", "按化学除草每亩药剂与施药成本【¥____ / 亩】估算，精准物理除草可显著降低甚至免除该项支出。"));
B(step("保住产量：", "降低伤苗率直接提高保苗密度，按作物亩产与单价折算为【¥____ / 亩】的产量收益。"));
B(step("回本周期：", "综合上述收益，单套设备回本周期约为【____ 亩作业量 / ____ 个种植季】，这是客户决策的核心依据。"));
B(h2("8.2  社会效益"));
B(p("项目的社会效益体现在三个方面。一是缓解农业劳动力短缺压力，把重复性、劳动强度大的除草工序交给设备承担，有助于应对农村劳动力老龄化。二是推动农业生产的智能化转型，通过低成本方案降低智能装备的使用门槛，让中小规模经营主体也能用上智能农机。三是服务于农业绿色发展与食品安全，减少化学除草剂使用，直接降低农产品残留风险与农业面源污染。"));
B(h2("8.3  生态效益"));
B(p("精准物理除草替代化学除草，可减少除草剂进入土壤与水体，有利于保护农田生物多样性与土壤微生物群落，符合农业绿色低碳发展的方向。这一效益在有机农业与绿色认证基地尤为突出，也是此类客户愿意支付溢价的根本原因。"));
B(h2("8.4  育人价值"));
B(p("项目对团队自身的成长价值同样值得在参赛材料中体现。项目跨越计算机视觉、嵌入式系统、机械设计与农学多个学科，需要团队在真实约束（成本、功耗、可靠性、农时）下做工程取舍，这是课堂难以提供的训练。在与种植户、农机服务组织的接触中，团队需要理解真实需求、调整技术方案，完成从技术思维到用户思维的转变。这些经历本身即是创新创业教育的重要成果，建议在答辩中结合具体事例讲述。"));
B(tcap("表 8-1  效益测算维度汇总"));
B(mktable(
  ["效益维度", "测算指标", "测算口径", "结果"],
  [
    ["客户经济收益", "每亩节约成本", "节约人工 + 减少药耗 + 保住产量", "【¥____ / 亩】"],
    ["客户投资回报", "设备回本周期", "设备投入 ÷ 每亩收益", "【____ 个种植季】"],
    ["劳动替代", "替代除草用工", "设备作业效率相当于人工工时", "【____ 工时 / 亩】"],
    ["农药减量", "除草剂使用量下降", "精准物理除草替代比例", "【____ %】"],
    ["生态效益", "减少农药入土入水量", "按替代比例折算药剂用量", "【____ kg / 亩】"],
  ],
  [20, 22, 36, 22]
));
B(srcnote("说明：效益测算的假设参数（当地日工价、亩均用工量、药剂成本、作物亩产与单价）必须来自团队实地调研，并在商业计划书附录中列出调研方法与样本量。"));

// ───────────── 附录 A ─────────────
B(h1("附录 A  商业计划书撰写指南", true));
B(p("本附录解决一个问题：如何把前面八章的素材，组装成一份能被评审与投资人认真读完的商业计划书。"));

B(h2("A.1  商业计划书标准结构与篇幅"));
B(p("创业计划竞赛的商业计划书通常为 30–45 页正文，结构上建议采用下表的标准十章框架，并把摘要放在最前、财务与融资放在靠后位置。"));
B(tcap("表 A-1  商业计划书标准结构与篇幅分配"));
B(mktable(
  ["序号", "章节", "建议页数", "核心任务"],
  [
    ["1", "项目摘要", "1–2", "用一页说清做什么、解决什么问题、凭什么能做成、要多少钱"],
    ["2", "项目背景与痛点", "3–4", "证明问题真实存在且足够痛，现有方案为何不够好"],
    ["3", "产品与技术方案", "6–8", "讲清产品形态、技术路线、架构与创新点，附架构图与流程图"],
    ["4", "市场分析", "4–5", "给出市场规模测算口径与目标客户画像，说明切入路径"],
    ["5", "竞争分析", "3–4", "四类竞争者对比，明确差异化与壁垒，避免只讲自己"],
    ["6", "商业模式", "4–5", "画布、收入模式、定价、渠道，说明钱怎么赚"],
    ["7", "团队介绍", "2–3", "突出与分工直接相关的经历与能力，说明团队完整性"],
    ["8", "实施计划与里程碑", "2–3", "路线图与已完成进展，证明执行力"],
    ["9", "财务预测与融资需求", "3–4", "预测表 + 假设说明 + 资金用途与股权安排"],
    ["10", "风险与应对", "2–3", "识别关键风险并给出可验证的应对措施"],
  ],
  [8, 26, 14, 52]
));

B(h2("A.2  本简介到商业计划书的素材映射"));
B(p("下表说明本简介的哪些章节可以直接迁移到商业计划书的哪个部分，以及还需要补充什么。建议按此表逐项核对，避免出现内容缺失或前后矛盾。"));
B(tcap("表 A-2  本简介 → 商业计划书素材映射表"));
B(mktable(
  ["商业计划书章节", "本简介对应章节", "需要补充或加工的内容"],
  [
    ["项目摘要", "1.1 一句话介绍", "压缩成一页：痛点、方案、技术亮点、市场、团队、融资需求各一段"],
    ["项目背景与痛点", "1.2 项目背景与需求痛点", "补充实地调研数据、访谈记录、当地用工与药耗成本"],
    ["产品与技术方案", "1.3、第三章、第四章", "补充实物照片、演示视频链接、架构图与流程图（图 3-1、图 4-1）"],
    ["市场分析", "第二章", "用公开统计数据替换 2.4 节全部占位符，补充调研样本说明"],
    ["竞争分析", "2.5 竞争格局", "补充具体竞品名称、参数对比、价格区间"],
    ["商业模式", "第五章", "补充定价调研依据、渠道洽谈进展、单位经济模型核算"],
    ["团队介绍", "6.1 团队构成", "替换为真实信息，补充成员简历式简介与获奖经历"],
    ["实施计划", "1.4、6.2、6.3", "补充时间轴图表，标注已完成节点的佐证材料"],
    ["财务预测", "5.5、5.6、6.4", "补充完整三年损益表与现金流表，附假设说明附录"],
    ["风险与应对", "第七章", "结合项目实际细化，删去不适用项，补充验证进展"],
  ],
  [22, 26, 52]
));

B(h2("A.3  各章节撰写要点与常见失分点"));
B(tcap("表 A-3  撰写要点与常见失分点"));
B(mktable(
  ["章节", "撰写要点", "常见失分点"],
  [
    ["项目摘要", "一页讲完，数据具体，结论前置", "写成背景介绍，看完不知道产品是什么"],
    ["背景与痛点", "用调研数据说明痛点强度与普遍性", "全篇行业趋势，没有本项目的目标客户的具体痛点"],
    ["产品与技术", "用图说话，指标可验证，创新点对应具体技术", "堆砌技术名词，无法说明与现有方案的本质差别"],
    ["市场分析", "测算口径透明，参数有来源", "引用来源不明的行业数字，口径前后矛盾"],
    ["竞争分析", "客观列出竞争对手并说明差异化", "声称“没有竞争对手”，暴露对行业不了解"],
    ["商业模式", "收入来源清晰，单位经济模型可核算", "只讲愿景不讲怎么收钱，毛利结构说不清"],
    ["团队介绍", "经历与分工强相关，说明团队无短板", "只列姓名与专业，看不出能力与项目的关系"],
    ["实施计划", "已完成的部分要有佐证", "全是未来计划，无法证明执行力"],
    ["财务预测", "假设写在明处，数字与市场、定价一致", "数字突兀且无假设说明，三处数据互相矛盾"],
    ["风险与应对", "风险真实、应对具体、有验证方式", "回避关键风险，或应对措施空泛无力"],
  ],
  [18, 40, 42]
));

B(h2("A.4  项目摘要写作模板"));
B(callout("可直接套用的摘要模板（把【】替换为项目实际内容）", [
  "【项目名称】是一套面向【目标场景】的【产品定位】。针对【目标客户】在【具体工序】中面临的【痛点一】【痛点二】【痛点三】，项目以【核心技术一】与【核心技术二】为支撑，实现了【可量化能力，如“在边缘计算平台上实时区分作物幼苗与杂草，幼苗误伤率低于 ____%”】。",
  "产品采用【交付形态】方式交付，通过【渠道方式】触达客户，收入来自【收入来源】。经测算，目标市场【SAM 口径】规模约【____ 亿元】，项目三年内可实现营业收入【____ 万元】、净利润【____ 万元】。",
  "团队由【人数】名【专业构成】成员组成，在【相关经历】方面具备【具体优势】，已取得【专利 / 软著 / 获奖 / 测试数据】等成果，并与【合作单位】建立合作关系。",
  "本轮计划融资【____ 万元】，出让【____%】股权，资金主要用于【用途一】【用途二】【用途三】，预计在【时间】内完成【里程碑】。",
]));

// ───────────── 附录 B ─────────────
B(h1("附录 B  路演 PPT 编制指南", true));

B(h2("B.1  PPT 整体框架与页数分配"));
B(p("建议路演 PPT 控制在 16–18 页，每页只讲一件事，整体节奏为“问题 → 方案 → 证据 → 商业 → 团队 → 诉求”。答辩评委平均每页停留时间不足一分钟，因此页面的信息密度必须克制，图表优于文字，数据优于形容。"));
B(callout("PPT 结构主线（一句话逻辑）", [
  "先让评委相信问题真实存在且足够痛 → 再让他们相信你的方案真的能解决问题 → 然后用数据和成果证明你做得到 → 最后说明这事能赚钱且团队做得成。",
]));

B(h2("B.2  逐页内容大纲"));
B(tcap("表 B-1  路演 PPT 逐页大纲"));
B(mktable(
  ["页码", "页面标题", "核心内容（一句话）", "视觉建议", "素材来源"],
  [
    ["1", "封面", "项目名称 + 一句话定位 + 团队与学校", "项目主视觉，深色底 + 强调色", "1.1 节一句话介绍"],
    ["2", "痛点", "除草环节的三重困境：费工、有残留、会伤苗", "三栏对比图 + 真实田间照片", "1.2 节 + 表 1-1"],
    ["3", "解决方案", "给除草机装上会认苗的眼睛", "设备实物照片 + 识别效果截图", "1.1、1.3 节"],
    ["4", "产品演示", "现场识别演示视频或动图：框出幼苗与杂草", "15 秒演示视频 / GIF", "团队自录演示素材"],
    ["5", "系统架构", "感知—计算—决策—执行—交互五层架构", "直接用图 3-1", "图 3-1"],
    ["6", "技术方案", "RK3576 端侧推理 + YOLO 幼苗杂草识别", "硬件实物照 + 参数卡", "表 3-1、3.3 节"],
    ["7", "难点与对策", "幼苗与同科杂草形似，我们如何区分", "难点—对策对照图，突出多特征判别", "表 3-2"],
    ["8", "关键指标", "识别精度、误伤率、推理时延三项实测数据", "三个大数字 + 单位，配测试条件说明", "表 3-3（替换为实测值）"],
    ["9", "创新点", "端侧低功耗、幼苗保护优先", "四个图标卡片", "3.7 节"],
    ["10", "市场空间", "目标市场规模与切入路径", "漏斗图：TAM → SAM → SOM", "2.4 节（替换为真实数据）"],
    ["11", "竞争分析", "四类竞争者对比，我们的差异化位置", "二维定位图或对比表", "表 2-4"],
    ["12", "商业模式", "三种交付形态 + 四种收入来源", "商业模式画布简化版", "表 5-1、5.2 节"],
    ["13", "落地进展", "已完成的工作与示范合作进展", "时间轴 + 佐证照片", "1.4、6.3 节"],
    ["14", "团队", "跨学科团队与核心成员优势", "成员照片 + 一句话亮点", "表 6-1"],
    ["15", "实施计划", "四阶段路线图与里程碑", "横向时间轴", "表 6-2"],
    ["16", "财务与融资", "三年预测与融资需求、用途", "柱状图 + 融资用途饼图", "表 5-4、6-3"],
    ["17", "社会价值", "减药、减工、保苗带来的经济与生态效益", "收益换算为直观数字", "第八章"],
    ["18", "结尾", "愿景陈述 + 联系方式", "一句话愿景 + 二维码", "团队自拟"],
  ],
  [8, 15, 30, 24, 23]
));
B(srcnote("建议：第 4 页的产品演示视频是全片最有说服力的一页。若能展示“同一画面中幼苗与杂草被分别框出、且幼苗未被作业”的连续画面，远胜任何文字描述。请务必提前录制并测试现场播放环境。"));

B(h2("B.3  演示时间分配与讲稿要点"));
B(tcap("表 B-2  8 分钟路演时间分配"));
B(mktable(
  ["环节", "对应页码", "建议时长", "讲稿要点"],
  [
    ["开场与痛点", "1–2", "60 秒", "用一句具体的田间场景切入，不要念公司简介"],
    ["方案与演示", "3–4", "90 秒", "先说结论再说原理；演示视频要提前打开"],
    ["技术方案", "5–8", "120 秒", "重点讲创新点与实测指标，跳过通用技术细节"],
    ["市场与竞争", "10–11", "60 秒", "给出测算口径，主动说明差异化位置"],
    ["商业模式", "12", "60 秒", "讲清钱怎么赚，重点讲单位经济模型"],
    ["进展与团队", "13–14", "50 秒", "强调已完成成果，团队只讲与项目相关的优势"],
    ["计划与财务", "15–16", "60 秒", "路线图要具体到时间，融资用途要明确"],
    ["结尾与诉求", "17–18", "20 秒", "一句话愿景收尾，明确说明需要什么支持"],
  ],
  [16, 12, 12, 60]
));
B(p("讲稿撰写有三条实用原则。第一，每页只留一句核心信息，讲稿围绕这句话展开，不要复述页面文字。第二，技术部分先讲“解决了什么问题”，再讲“用了什么技术”，避免一开口就是术语。第三，全文控制在 1400–1600 字，按每分钟 180–200 字的语速，留出停顿与切换页面的时间。"));

B(h2("B.4  答辩常见问题与参考回答"));
B(p("答辩环节通常追问三个方向：技术可行性、商业可行性、团队执行力。下表整理高频问题与回答要点，回答的共同原则是：先给结论，再给证据，最后承认边界——坦诚说明局限比强行辩解更能赢得信任。"));
B(tcap("表 B-3  答辩高频问题与回答要点"));
B(mktable(
  ["类别", "问题", "回答要点"],
  [
    ["技术", "幼苗和杂草长得几乎一样，你们怎么区分？", "承认这是最难的问题，说明采用多特征联合判别（叶形、叶脉、叶序、生长点形态）而非仅靠轮廓，并建立了难例子集加权训练；给出在含同科杂草测试集上的实测精度"],
    ["技术", "阴天、清晨、傍晚光照不足时怎么办？", "三重手段：硬件上加主动补光与遮光罩；训练时做光照扰动增强；推理时做自适应曝光。并说明已做的多光照条件测试结果"],
    ["技术", "如果误判把幼苗当成杂草除了怎么办？", "强调系统以幼苗保护为第一优先级：设置置信度安全阈值、幼苗保护缓冲区、低置信度目标一律跳过；给出实测幼苗误伤率，说明“宁漏除不误伤”的设计原则"],
    ["技术", "为什么不用云端算力？端侧算力够吗？", "说明田间无稳定网络、供电受限、成本敏感、需实时响应四条现实约束；给出 RK3576 NPU 上的实测单帧时延与帧率，证明端侧足以满足作业速度要求"],
    ["技术", "训练数据从哪来？够不够？", "数据来自自主采集与合作基地，按作物种类、生育期、光照、土壤背景四维度组织；标注采用模型预标注加人工修正以控制成本；坦诚说明当前数据规模与下一步扩充计划"],
    ["技术", "识别一株到执行动作的延迟有多大？会不会漏除？", "说明从识别到执行的全链路时延构成（推理 + 规划 + 通信 + 机构响应），说明规划模块如何按行进速度提前触发动作以保证不漏除"],
    ["商业", "设备多少钱？农户买得起吗？", "给出模块与整机两档价格，并给出回本周期测算（每亩节约成本 × 年作业亩数），把价格问题转化为投资回报问题"],
    ["商业", "农民会愿意用智能设备吗？", "说明目标客户不是分散小农户而是规模化主体与农机服务组织，后者的决策基于成本核算；同时说明按亩服务模式可降低使用门槛"],
    ["商业", "大公司或现有农机厂商做这个怎么办？", "说明差异点在幼苗保护与端侧低成本，且已布局专利与数据集壁垒；同时说明更愿意与农机厂商合作而非正面竞争"],
    ["商业", "怎么卖出去？渠道在哪里？", "说明示范驱动（示范基地 + 现场对比）+ 渠道借力（农机经销商与合作社）+ 厂商前装配套三条路径及其推进顺序"],
    ["商业", "收入从哪里来？毛利结构如何？", "说明四种收入来源及其占比演进，重点讲单位经济模型：单套成本构成、售价、毛利与毛利率，说明随量产毛利改善的逻辑"],
    ["财务", "这些财务数字是怎么算出来的？", "主动说明假设：销量依据渠道覆盖能力、单价依据 5.3 节定价、成本依据 BOM 拆分；承诺可提供假设对照表，避免被追问时无法解释"],
    ["团队", "团队里有人懂农业吗？", "说明跨学科配置与农艺顾问的角色，说明田间试验是由懂农艺的成员与合作基地共同设计执行的"],
    ["团队", "你们能持续做下去吗？会不会毕业就散了？", "技术资产已文档化、指导教师与实验室提供延续保障、核心成员有持续投入的规划，以及已建立的知识产权归属安排"],
    ["价值", "项目的社会价值体现在哪？", "用三个可量化数字回答：每亩减少的除草剂用量、每亩节省的人工成本、降低的伤苗率带来的产量收益"],
  ],
  [10, 34, 56]
));

B(h2("B.5  PPT 制作禁忌清单"));
B(step("禁忌一：文字堆砌。", "单页超过 100 字即为失败。把段落改成图表、数字或图示，讲稿承担解释职责。"));
B(step("禁忌二：用默认模板。", "直接套用软件自带模板会显得敷衍。建议按项目主色（本项目为石墨深色 + 橙色强调）统一设计一套版式。"));
B(step("禁忌三：数据无来源。", "任何引用的行业数字必须在页脚标注来源与年份，否则宁可删除。"));
B(step("禁忌四：指标没有测试条件。", "只给精度数字不给测试条件（作物、生育期、光照、速度）会被追问到无法回答，务必标注。"));
B(step("禁忌五：前后数字矛盾。", "市场规模、定价、销量、收入三处必须一致，建议定稿前做一次全面核对。"));
B(step("禁忌六：演示素材未测试。", "视频、动图、动画必须提前在答辩电脑上测试，现场播放失败是最可惜的失分。"));
B(step("禁忌七：配色超过三种。", "主色 + 强调色 + 中性色即可，超过三种会显得杂乱。"));
B(step("禁忌八：最后一页写“谢谢”。", "结尾应放愿景陈述与明确的诉求（融资、合作、政策支持），而非空白致谢页。"));

// ───────────── 附录 C ─────────────
B(h1("附录 C  关键数据与待补信息速查", true));

B(h2("C.1  一页纸项目速览"));
B(p("本表用于快速核对项目核心信息，可直接作为商业计划书摘要页与 PPT 首页的信息底稿。凡标注占位符处，请在提交前全部替换。"));
B(tcap("表 C-1  项目一页纸速览"));
B(mktable(
  ["维度", "内容"],
  [
    ["项目名称", "除草机器人幼苗—杂草辨识与作业规划系统"],
    ["一句话定位", "在 RK3576 边缘计算平台上跑 YOLO 视觉识别，实时区分作物幼苗与杂草，只除杂草、不伤幼苗"],
    ["目标客户", "种植大户与家庭农场、农业合作社、农机服务组织、农机厂商"],
    ["核心痛点", "人工除草成本高、化学除草有残留、机械除草会伤苗、现有智能设备太贵"],
    ["技术方案", "USB 摄像头采集 → RK3576 NPU 端侧 YOLO 推理 → 幼苗杂草判别 → 坐标映射与作业规划 → 定点执行"],
    ["核心指标", "识别精度【____%】、幼苗误伤率【____%】、单帧时延【____ms】（均为待实测目标值）"],
    ["创新点", "端侧低功耗实时识别；幼苗保护优先的安全机制；面向难例的多特征判别；识别与执行解耦的模块化架构"],
    ["商业模式", "模块销售 + 整机销售 + 前装授权 + 模型升级服务 + 按亩作业服务"],
    ["市场空间", "TAM【____亿元】/ SAM【____亿元】/ SOM【____万元】（需用公开数据替换）"],
    ["团队", "【____人，专业构成 ____，指导教师 ____】"],
    ["当前进展", "已完成端侧识别链路验证，正在进行田间数据扩充与执行机构联调"],
    ["融资需求", "【____万元，出让 ____%，资金用途 ____】"],
  ],
  [20, 80]
));

B(h2("C.2  待团队补充确认清单"));
B(p("本清单列出全文所有需要团队用真实信息替换或补充材料的位置。建议按顺序逐项完成并打勾，全部完成后本文档即可直接支撑商业计划书与路演 PPT 的撰写。"));
B(tcap("表 C-2  待补充信息与材料清单"));
B(mktable(
  ["序号", "待补充事项", "所在章节", "完成标准"],
  [
    ["1", "团队真实信息：成员姓名、专业、分工、相关经历；指导教师信息", "6.1、表 1-2、表 C-1", "替换全部占位符，并准备成员简历"],
    ["2", "项目当前阶段的准确描述与佐证材料", "1.4、表 1-2", "附实物照片、演示视频、代码或测试记录"],
    ["3", "田间图像数据集扩充及规模说明", "1.4.2、3.3.1", "给出图像张数、作物种类、标注类别数"],
    ["4", "关键技术指标实测值（精度、误伤率、时延、帧率）", "表 3-3、表 C-1", "附测试报告，注明测试条件与样本量"],
    ["5", "市场规模测算参数：种植面积、渗透率、单价，并标注数据来源", "2.4、表 2-3", "所有参数可追溯至公开统计或调研记录"],
    ["6", "政策依据：具体文件名称、发文机关、年份与相关条款", "2.2、表 2-1", "列出政策清单，至少 3 条具体文件"],
    ["7", "竞争分析：具体竞品名称、参数与价格区间", "2.5、表 2-4", "补充至少 3 个具体竞品的对比数据"],
    ["8", "定价策略与成本拆解的完整核算", "5.3、5.5", "给出 BOM 明细与毛利率计算过程"],
    ["9", "三年财务预测的完整测算表与假设说明", "5.6、6.4", "附假设对照表，确保三处数据一致"],
    ["10", "知识产权进展：专利与软著申请号或受理通知书", "3.8、表 3-4", "提交受理通知书或申请号"],
    ["11", "田间试验结果与合作基地信息", "1.4.2、6.3", "附试验方案、原始数据与合作意向证明"],
    ["12", "示范案例或用户反馈材料", "5.4、6.3", "附种植户访谈记录或使用证明"],
    ["13", "经费预算的完整科目与金额", "6.4、表 6-3", "与融资需求金额保持一致"],
    ["14", "路演演示视频与 PPT 定稿", "附录 B", "视频可正常播放，PPT 页数 16–18 页"],
  ],
  [8, 39, 23, 30]
));
B(srcnote("建议：完成上表 1–6 项后，即可着手撰写商业计划书；完成 7–14 项后，项目材料基本达到参赛提交标准。建议按表中顺序推进，因为后面的核算与材料都依赖前面的基础数据。"));

// ─────────────────────────── 文档装配 ───────────────────────────
const doc = new Document({
  creator: "项目团队",
  title: "除草机器人幼苗—杂草辨识与作业规划系统 项目简介",
  description: "挑战杯参赛项目简介，含商业计划书与路演PPT编制指南",
  styles: {
    default: {
      document: {
        run: { font: FONT, size: 24, color: C.body },
        paragraph: { spacing: { line: 312 } },
      },
      heading1: {
        run: { font: FONT, size: 32, bold: true, color: C.graph },
        paragraph: { spacing: { before: 400, after: 200, line: 340 } },
      },
      heading2: {
        run: { font: FONT, size: 28, bold: true, color: C.graph },
        paragraph: { spacing: { before: 300, after: 130, line: 320 } },
      },
      heading3: {
        run: { font: FONT, size: 24, bold: true, color: C.sub },
        paragraph: { spacing: { before: 220, after: 110, line: 312 } },
      },
    },
  },
  sections: [
    // ── 第 1 区：封面（无页码） ──
    {
      properties: {
        page: { size: PG, margin: { top: 0, bottom: 0, left: 0, right: 0 } },
      },
      children: buildCover({
        englishLabel: "PRECISION WEEDING ROBOT SYSTEM",
        title: "除草机器人幼苗—杂草辨识与作业规划系统",
        subtitle: "项目简介 · 商业计划书与路演PPT编制指南",
        metaLines: [
          "硬件平台：RK3576 边缘计算主板 + USB 摄像头",
          "核心算法：YOLO 目标检测（幼苗 / 杂草辨识）",
          "应用场景：大田与设施农业的精准除草作业",
          "编制单位：【学校 / 学院名称】    团队：【团队名称】",
          "文档版本：V1.0        编制日期：2026 年 10 月",
        ],
        footerLeft: "挑战杯参赛项目材料",
        footerRight: "项目简介与编制指南",
      }),
    },
    // ── 第 2 区：前置部分（目录，罗马页码） ──
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: PG, margin: MG, pageNumbers: { start: 1, formatType: NumberFormat.UPPER_ROMAN } },
      },
      footers: { default: pageNumFooter() },
      children: [
        new Paragraph({
          alignment: AlignmentType.CENTER,
          spacing: { before: 240, after: 320 },
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
      ],
    },
    // ── 第 3 区：正文（阿拉伯页码，从 1 开始） ──
    {
      properties: {
        type: SectionType.NEXT_PAGE,
        page: { size: PG, margin: MG, pageNumbers: { start: 1, formatType: NumberFormat.DECIMAL } },
      },
      headers: { default: headerBar() },
      footers: { default: pageNumFooter() },
      children: body,
    },
  ],
});

Packer.toBuffer(doc).then((buf) => {
  const out = path.join(DIR, "..", "除草机器人幼苗-杂草辨识与作业规划系统_项目简介.docx");
  fs.writeFileSync(out, buf);
  console.log("已生成：" + out);
});
