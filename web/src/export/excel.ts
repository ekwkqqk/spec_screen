import type { Anchor, Borders, Fill, Font, Worksheet } from 'exceljs';
import { imageUrl } from '../api';
import type { ProjectExport, Screen } from '../types';
import { formatDateTime, today } from '../util';

const FONT: Partial<Font> = { name: '맑은 고딕', size: 10 };
const thin = { style: 'thin' as const, color: { argb: 'FFBFC5CF' } };
const BORDER: Partial<Borders> = { top: thin, left: thin, bottom: thin, right: thin };
const HEAD_FILL: Fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFEEF1F5' } };
const MARKER_COLOR = '#e11d48';
/** 시트에 넣는 이미지의 최대 표시 너비(px) — 아래 열 너비 합과 비슷하게 맞춘다 */
const IMAGE_MAX_WIDTH = 860;
/** 이미지 영역 행 높이 15pt = 20px(96dpi 기준) */
const ROW_PX = 20;
const EMU_PER_PX = 9525;
/** 화면별 시트의 열 너비(문자 수). 기본 글꼴(Calibri 11) 기준 1문자 ≈ 7px */
const SCREEN_COLS = [6, 22, 12, 62, 22];
const COL_PX = SCREEN_COLS.map((w) => Math.round(w * 7));

/** 시트 왼쪽 위에서 x, y px 떨어진 지점을 셀 기준 위치(열·행 + 오프셋)로 바꾼다 */
function anchorAt(x: number, row0: number, rowsPx: number): Anchor {
  let col = 0;
  while (col < COL_PX.length - 1 && x > COL_PX[col]) x -= COL_PX[col++];
  return {
    nativeCol: col,
    nativeColOff: Math.round(x * EMU_PER_PX),
    nativeRow: row0 + Math.floor(rowsPx / ROW_PX),
    nativeRowOff: Math.round((rowsPx % ROW_PX) * EMU_PER_PX),
  } as Anchor;
}

/** 엑셀 시트 이름 규칙(31자, 일부 특수문자 금지, 중복 불가)에 맞춘다 */
function sheetNames(screens: Screen[]): string[] {
  const used = new Set(['화면목록']);
  return screens.map((s, i) => {
    const raw = `${i + 1}. ${s.screenCode || s.name}`.replace(/[\\/?*:[\]]/g, '_').slice(0, 31);
    let name = raw;
    for (let n = 2; used.has(name); n++) name = `${raw.slice(0, 27)}(${n})`;
    used.add(name);
    return name;
  });
}

/** 화면 이미지 위에 번호 마커를 그려 PNG로 만든다 */
async function markedImage(src: string, screen: Screen): Promise<{ dataUrl: string; width: number; height: number }> {
  const img = new Image();
  img.src = src;
  await img.decode();
  const scale = Math.min(1, 1600 / img.naturalWidth);
  const width = Math.round(img.naturalWidth * scale);
  const height = Math.round(img.naturalHeight * scale);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(img, 0, 0, width, height);

  const r = Math.max(11, Math.round(width / 70));
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `bold ${Math.round(r * 1.05)}px "Malgun Gothic", sans-serif`;
  screen.items.forEach((it, i) => {
    if (it.x == null || it.y == null) return;
    const cx = it.x * width;
    const cy = it.y * height;
    ctx.beginPath();
    ctx.arc(cx, cy, r, 0, Math.PI * 2);
    ctx.fillStyle = MARKER_COLOR;
    ctx.fill();
    ctx.lineWidth = Math.max(2, r * 0.18);
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.fillText(String(i + 1), cx, cy + 1);
  });
  return { dataUrl: canvas.toDataURL('image/png'), width, height };
}

function styleRange(ws: Worksheet, row: number, fromCol: number, toCol: number, head = false) {
  for (let c = fromCol; c <= toCol; c++) {
    const cell = ws.getCell(row, c);
    cell.border = BORDER;
    cell.font = { ...FONT, bold: head };
    cell.alignment = { vertical: 'top', wrapText: true, horizontal: head ? 'center' : undefined };
    if (head) cell.fill = HEAD_FILL;
  }
}

function sectionTitle(ws: Worksheet, row: number, text: string) {
  const cell = ws.getCell(row, 1);
  cell.value = text;
  cell.font = { ...FONT, size: 11, bold: true };
}

export async function exportExcel(pid: string, data: ProjectExport): Promise<void> {
  const { default: ExcelJS } = await import('exceljs');
  const { project, screens } = data;
  const wb = new ExcelJS.Workbook();
  wb.created = new Date();
  const names = sheetNames(screens);

  // ---------- 화면 목록 ----------
  const list = wb.addWorksheet('화면목록', { views: [{ state: 'frozen', ySplit: 4 }] });
  list.columns = [6, 16, 30, 32, 8, 8, 18, 12].map((width) => ({ width }));
  list.mergeCells('A1:H1');
  list.getCell('A1').value = `${project.name} 화면설계서`;
  list.getCell('A1').font = { ...FONT, size: 16, bold: true };
  list.mergeCells('A2:H2');
  list.getCell('A2').value = [project.description, `출력일 ${today()} · 화면 ${screens.length}개`].filter(Boolean).join('\n');
  list.getCell('A2').font = { ...FONT, color: { argb: 'FF6B7380' } };
  list.getCell('A2').alignment = { wrapText: true, vertical: 'top' };
  if (project.description) list.getRow(2).height = 15 * (project.description.split('\n').length + 1);
  const head = ['No', '화면ID', '화면명', '메뉴경로', '버전', '항목수', '최종 수정', '수정자'];
  list.getRow(4).values = head;
  styleRange(list, 4, 1, head.length, true);
  screens.forEach((s, i) => {
    const row = 5 + i;
    list.getRow(row).values = [i + 1, s.screenCode, s.name, s.menuPath, s.version, s.items.length, formatDateTime(s.updatedAt), s.updatedBy];
    styleRange(list, row, 1, head.length);
    // 화면명을 누르면 해당 시트로 이동
    list.getCell(row, 3).value = { text: s.name, hyperlink: `#'${names[i]}'!A1` };
    list.getCell(row, 3).font = { ...FONT, color: { argb: 'FF2563EB' }, underline: true };
  });
  list.autoFilter = { from: { row: 4, column: 1 }, to: { row: 4, column: head.length } };

  // ---------- 화면별 시트 ----------
  for (const [i, s] of screens.entries()) {
    const ws = wb.addWorksheet(names[i]);
    ws.columns = SCREEN_COLS.map((width) => ({ width }));
    ws.pageSetup = { paperSize: 9, orientation: 'portrait', fitToPage: true, fitToWidth: 1, fitToHeight: 0 };

    ws.mergeCells('A1:D1');
    ws.getCell('A1').value = `${s.screenCode ? `[${s.screenCode}] ` : ''}${s.name}`;
    ws.getCell('A1').font = { ...FONT, size: 14, bold: true };
    ws.getCell('E1').value = { text: '← 화면목록', hyperlink: "#'화면목록'!A1" };
    ws.getCell('E1').font = { ...FONT, color: { argb: 'FF2563EB' }, underline: true };
    ws.getCell('E1').alignment = { horizontal: 'right' };

    // 기본 정보: 라벨(A:B 병합) / 값(C:E 병합)
    const info: [string, string][] = [
      ['화면ID', s.screenCode],
      ['화면명', s.name],
      ['메뉴경로', s.menuPath],
      ['작성자', s.author],
      ['버전', s.version],
      ['최종 수정', `${formatDateTime(s.updatedAt)}${s.updatedBy ? ` (${s.updatedBy})` : ''}`],
      ['화면 설명', s.description],
    ];
    let row = 3;
    for (const [label, value] of info) {
      ws.mergeCells(row, 1, row, 2);
      ws.mergeCells(row, 3, row, 5);
      ws.getCell(row, 1).value = label;
      ws.getCell(row, 3).value = value;
      styleRange(ws, row, 1, 5);
      ws.getCell(row, 1).font = { ...FONT, bold: true };
      ws.getCell(row, 1).fill = HEAD_FILL;
      const lines = value.split('\n').length;
      if (lines > 1) ws.getRow(row).height = 15 * lines;
      row++;
    }

    // 화면 이미지 (마커 포함)
    row++;
    sectionTitle(ws, row, '화면');
    row++;
    if (s.image) {
      try {
        const img = await markedImage(imageUrl(pid, s.image.file), s);
        const w = Math.min(IMAGE_MAX_WIDTH, img.width);
        const h = Math.round((img.height * w) / img.width);
        const id = wb.addImage({ base64: img.dataUrl, extension: 'png' });
        // 크기(px)만 주면 Excel의 DPI·버전에 따라 이미지가 확보한 행보다 길게 보여 아래 표를 가린다.
        // 시작과 끝을 모두 셀에 고정해서, 이미지가 항상 확보한 행 안에서 끝나게 한다
        const rows = Math.ceil(h / ROW_PX);
        for (let r = row; r < row + rows; r++) ws.getRow(r).height = 15;
        ws.addImage(id, {
          tl: anchorAt(0, row - 1, 0),
          br: anchorAt(w, row - 1, h),
          editAs: 'oneCell',
        });
        row += rows + 1;
      } catch {
        ws.getCell(row, 1).value = '(이미지를 불러오지 못했습니다)';
        row += 2;
      }
    } else {
      ws.getCell(row, 1).value = '(등록된 화면 이미지 없음)';
      row += 2;
    }

    // 기능 설명
    row++;
    sectionTitle(ws, row, '기능 설명');
    row++;
    ws.getRow(row).values = ['No', '항목명', '유형', '설명', '비고'];
    styleRange(ws, row, 1, 5, true);
    row++;
    for (const [n, it] of s.items.entries()) {
      ws.getRow(row).values = [n + 1, it.name, it.type, it.description, it.remark];
      styleRange(ws, row, 1, 5);
      ws.getCell(row, 1).alignment = { vertical: 'top', horizontal: 'center' };
      const lines = Math.max(it.description.split('\n').length, Math.ceil(it.description.length / 30), 1);
      if (lines > 1) ws.getRow(row).height = 15 * lines;
      row++;
    }
    if (s.items.length === 0) ws.getCell(row++, 1).value = '(등록된 항목 없음)';

    // 변경 이력 (최신순)
    row++;
    sectionTitle(ws, row, '변경 이력');
    row++;
    ws.getRow(row).values = ['No', '일자', '버전', '변경 내용', '작성자'];
    styleRange(ws, row, 1, 5, true);
    row++;
    [...s.history].reverse().forEach((h, n) => {
      ws.getRow(row).values = [n + 1, h.date, h.version, h.summary, h.by];
      styleRange(ws, row, 1, 5);
      ws.getCell(row, 1).alignment = { vertical: 'top', horizontal: 'center' };
      row++;
    });
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `${project.name.replace(/[\\/:*?"<>|]/g, '_')}_화면설계서_${today()}.xlsx`;
  a.click();
  setTimeout(() => URL.revokeObjectURL(a.href), 1000);
}
