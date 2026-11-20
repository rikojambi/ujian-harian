import mammoth from 'mammoth';
import type { ImportDraftQuestion, ImportReport } from '@/types';
import { nanoid } from '@/utils/id';

const OPTION_REGEX = /^\s*([A-Ea-e])[\.\)]\s*(.*)$/;
const NUMBER_REGEX = /^\s*(?:Soal\s*)?(\d{1,3})\s*[\.\)]\s*(.*)$/;
const KEY_REGEX = /^\s*(?:Kunci\s*(?:Jawaban)?|Jawaban|Key)\s*[:=]\s*(.*)$/i;
const EXPLANATION_REGEX = /^\s*(?:Pembahasan|Penjelasan|Explanation)\s*[:=]\s*(.*)$/i;
const TP_REGEX = /^\s*(?:TP|Tujuan\s+Pembelajaran|LO)\s*[:=]\s*(.*)$/i;

function htmlToText(html: string, unprocessedMedia: string[]): string {
  const document = new DOMParser().parseFromString(html, 'text/html');
  document.querySelectorAll('img').forEach((image) => {
    const name = image.getAttribute('data-file-name') || `gambar-${unprocessedMedia.length + 1}`;
    unprocessedMedia.push(name);
    image.replaceWith(document.createTextNode(`[GAMBAR: ${name}]`));
  });
  const blocks = Array.from(document.body.children);
  return blocks.map((block) => block.textContent?.replace(/\s+/g, ' ').trim() ?? '').filter(Boolean).join('\n');
}

/** Parser RTF ringan: mendukung teks, \uN (Unicode), \par, dan grup dasar. Tidak mengekstrak gambar. */
export function parseRtfToText(rtf: string, unprocessedMedia: string[]): string {
  let output = '';
  let i = 0;
  let depth = 0;
  while (i < rtf.length) {
    const char = rtf[i];
    if (char === '{') { depth += 1; i += 1; continue; }
    if (char === '}') { depth = Math.max(0, depth - 1); i += 1; continue; }
    if (char === '\\') {
      i += 1;
      if (i >= rtf.length) break;
      if (rtf[i] === 'u') {
        i += 1;
        let digits = '';
        while (i < rtf.length && /\d/.test(rtf[i]) && digits.length < 6) { digits += rtf[i]; i += 1; }
        if (rtf[i] === '?') i += 1;
        const code = Number(digits);
        output += Number.isFinite(code) ? String.fromCharCode(code < 0 ? code + 65536 : code) : '';
        continue;
      }
      if (/[*']/.test(rtf[i])) { i += 1; continue; }
      let word = '';
      while (i < rtf.length && /[a-zA-Z]/.test(rtf[i])) { word += rtf[i]; i += 1; }
      if (/^\d+/.test(rtf.slice(i))) {
        let numeric = '';
        while (i < rtf.length && /\d/.test(rtf[i])) { numeric += rtf[i]; i += 1; }
        if (word === 'u') output += String.fromCharCode(Number(numeric));
      }
      if (rtf[i] === ' ') i += 1;
      if (word === 'par' || word === 'line' || word === 'tab') { output += '\n'; continue; }
      if (word === 'pict') {
        unprocessedMedia.push(`gambar-rtf-${unprocessedMedia.length + 1}`);
        continue;
      }
      continue;
    }
    if (char === '\r' || char === '\n') { i += 1; continue; }
    output += char;
    i += 1;
  }
  return output.split('\n').map((line) => line.trim()).filter(Boolean).join('\n');
}

interface ParsedBlock { number: number; lines: string[] }

function splitBlocks(text: string): ParsedBlock[] {
  const lines = text.split('\n');
  const blocks: ParsedBlock[] = [];
  let current: ParsedBlock | null = null;
  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;
    const match = line.match(NUMBER_REGEX);
    if (match && Number(match[1]) > 0) {
      current = { number: Number(match[1]), lines: [] };
      blocks.push(current);
      const rest = match[2].trim();
      if (rest) current.lines.push(rest);
    } else if (current) {
      current.lines.push(line);
    }
  }
  return blocks;
}

export function parseQuestionText(text: string, fileName: string, format: ImportReport['format']): ImportReport {
  const unprocessedMedia: string[] = [];
  const warnings: string[] = [];
  const mediaMatches = Array.from(text.matchAll(/\[GAMBAR:\s*([^\]]+)\]/g)).map((match) => match[1]);
  unprocessedMedia.push(...mediaMatches);
  const blocks = splitBlocks(text);
  if (!blocks.length) warnings.push('Tidak ada soal bernomor yang terdeteksi. Periksa format dokumen.');

  const questions: ImportDraftQuestion[] = blocks.map((block) => {
    const options: ImportDraftQuestion['options'] = [];
    const answerKeys: string[] = [];
    const explanationParts: string[] = [];
    const promptParts: string[] = [];
    let learningObjectiveCode: string | undefined;
    let section: 'prompt' | 'explanation' = 'prompt';

    for (const line of block.lines) {
      const option = line.match(OPTION_REGEX);
      const keyMatch = line.match(KEY_REGEX);
      const explanation = line.match(EXPLANATION_REGEX);
      const tp = line.match(TP_REGEX);
      if (option) {
        options.push({
          key: option[1].toUpperCase(),
          text: option[2].replace(/\[GAMBAR:\s*([^\]]+)\]/g, '').trim(),
          imageName: option[2].match(/\[GAMBAR:\s*([^\]]+)\]/)?.[1]
        });
        section = 'prompt';
      } else if (keyMatch) {
        const keys = keyMatch[1].toUpperCase().match(/[A-E]\b/g);
        if (keys) answerKeys.push(...keys);
        else {
          const words = keyMatch[1].trim().split(/[,;|]/).map((part) => part.trim()).filter(Boolean);
          answerKeys.push(...words);
        }
        section = 'prompt';
      } else if (explanation) {
        section = 'explanation';
        if (explanation[1].trim()) explanationParts.push(explanation[1].trim());
      } else if (tp) {
        learningObjectiveCode = tp[1].trim();
        section = 'prompt';
      } else if (section === 'explanation') {
        explanationParts.push(line);
      } else {
        promptParts.push(line);
      }
    }

    const localWarnings: string[] = [];
    if (!promptParts.length) localWarnings.push('Pertanyaan tidak terbaca.');
    if (options.length && !answerKeys.length) localWarnings.push('Kunci jawaban tidak ditemukan.');
    if (options.length < 2 && !localWarnings.length) localWarnings.push('Jumlah opsi kurang dari dua.');
    const mediaNames = block.lines.flatMap((line) => Array.from(line.matchAll(/\[GAMBAR:\s*([^\]]+)\]/g)).map((match) => match[1]));
    const type = options.length >= 2 ? (answerKeys.length > 1 ? 'multiple_response' : 'multiple_choice') : 'completion';
    return {
      tempId: nanoid(8), number: block.number,
      prompt: promptParts.join(' ').trim() || '(pertanyaan belum terbaca)',
      options,
      answerKeys: Array.from(new Set(answerKeys)),
      explanation: explanationParts.join(' ').trim(),
      learningObjectiveCode,
      type,
      mediaNames,
      warnings: localWarnings
    };
  });

  return { fileName, format, questions, unprocessedMedia, warnings };
}

export async function parseDocxFile(file: File): Promise<ImportReport> {
  const unprocessedMedia: string[] = [];
  const result = await mammoth.convertToHtml(
    { arrayBuffer: await file.arrayBuffer() },
    {
      convertImage: mammoth.images.imgElement(async (image) => ({
        src: '',
        'data-file-name': (image as { filename?: string }).filename || `gambar-${unprocessedMedia.length + 1}`
      }))
    }
  );
  const html = result.value;
  // mammoth menaruh atribut pada <img>; pindahkan ke placeholder teks sebelum ekstraksi.
  const withPlaceholders = html.replace(/<img[^>]*data-file-name="([^"]*)"[^>]*>/g, (_all, name: string) => {
    unprocessedMedia.push(name);
    return `<p>[GAMBAR: ${name}]</p>`;
  });
  const text = htmlToText(withPlaceholders, unprocessedMedia);
  const report = parseQuestionText(text, file.name, 'docx');
  report.unprocessedMedia = Array.from(new Set([...unprocessedMedia, ...report.unprocessedMedia]));
  if (result.messages.length) {
    report.warnings.push(...result.messages.slice(0, 10).map((message) => `Mammoth: ${message.message}`));
  }
  return report;
}

export async function parseRtfFile(file: File): Promise<ImportReport> {
  const text = await file.text();
  const unprocessedMedia: string[] = [];
  const plain = parseRtfToText(text, unprocessedMedia);
  const report = parseQuestionText(plain, file.name, 'rtf');
  report.unprocessedMedia = Array.from(new Set([...unprocessedMedia, ...report.unprocessedMedia]));
  report.warnings.push('Parser RTF hanya mengekstrak teks; gambar tidak dapat diimpor otomatis.');
  return report;
}

export async function parseJsonFile(file: File): Promise<ImportReport> {
  const raw = JSON.parse(await file.text()) as { questions?: ImportDraftQuestion[] };
  if (!Array.isArray(raw.questions)) throw new Error('Format JSON tidak dikenali. Diharapkan objek dengan field "questions".');
  return {
    fileName: file.name, format: 'json', questions: raw.questions,
    unprocessedMedia: [], warnings: ['Soal dari JSON tetap harus ditinjau sebelum disimpan.']
  };
}

export async function parseImportFile(file: File): Promise<ImportReport> {
  const extension = file.name.split('.').pop()?.toLowerCase();
  if (extension === 'docx') return parseDocxFile(file);
  if (extension === 'rtf') return parseRtfFile(file);
  if (extension === 'json') return parseJsonFile(file);
  throw new Error('Format tidak didukung. Gunakan DOCX, RTF, atau JSON.');
}
