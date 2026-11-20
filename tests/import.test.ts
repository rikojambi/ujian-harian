import { describe, expect, it } from 'vitest';
import { parseImportFile, parseJsonFile, parseQuestionText, parseRtfToText } from '@/services/questions/import';

const sample = [
  '1. Apa ibu kota Indonesia?',
  'A. Jakarta',
  'B. Bandung',
  'C. Surabaya',
  'D. Medan',
  'Kunci Jawaban: A',
  'Pembahasan: Jakarta adalah ibu kota Indonesia.',
  'TP: TP1',
  '[GAMBAR: peta.png]',
  '',
  '2. Sebutkan dua warna primer!',
  'Kunci: merah, kuning',
  'Pembahasan: Warna primer adalah merah, kuning, dan biru.'
].join('\n');

function fakeFile(name: string, contents: string): File {
  return { name, text: async () => contents } as File;
}

describe('impor soal', () => {
  it('memecah teks bernomor menjadi draf soal lengkap', () => {
    const report = parseQuestionText(sample, 'soal.txt', 'docx');
    expect(report.fileName).toBe('soal.txt');
    expect(report.format).toBe('docx');
    expect(report.questions).toHaveLength(2);
    expect(report.unprocessedMedia).toContain('peta.png');
    expect(report.warnings).toEqual([]);

    const first = report.questions[0];
    expect(first.number).toBe(1);
    expect(first.type).toBe('multiple_choice');
    expect(first.prompt).toContain('Apa ibu kota Indonesia?');
    expect(first.prompt).toContain('[GAMBAR: peta.png]');
    expect(first.options.map((option) => option.key)).toEqual(['A', 'B', 'C', 'D']);
    expect(first.options[0].text).toBe('Jakarta');
    expect(first.answerKeys).toEqual(['A']);
    expect(first.explanation).toBe('Jakarta adalah ibu kota Indonesia.');
    expect(first.learningObjectiveCode).toBe('TP1');
    expect(first.mediaNames).toContain('peta.png');
    expect(first.warnings).toEqual([]);

    const second = report.questions[1];
    expect(second.type).toBe('completion');
    expect(second.answerKeys).toEqual(['merah', 'kuning']);
    expect(second.prompt).toBe('Sebutkan dua warna primer!');
    expect(second.explanation).toContain('Warna primer');
  });

  it('mendeteksi multiple response dari banyak kunci', () => {
    const report = parseQuestionText(
      '1. Pilih bilangan genap!\nA. 2\nB. 3\nC. 4\nD. 5\nKunci: A, C\n',
      'soal.txt',
      'rtf'
    );
    expect(report.questions[0].type).toBe('multiple_response');
    expect(report.questions[0].answerKeys).toEqual(['A', 'C']);
  });

  it('memberi peringatan untuk dokumen tanpa soal bernomor', () => {
    const report = parseQuestionText('Panduan umum tanpa nomor soal.', 'panduan.txt', 'docx');
    expect(report.questions).toHaveLength(0);
    expect(report.warnings).toContain('Tidak ada soal bernomor yang terdeteksi. Periksa format dokumen.');
  });

  it('mengurai RTF dasar termasuk Unicode dan pemisah paragraf', () => {
    const media: string[] = [];
    const text = parseRtfToText('{\\rtf1\\ansi Halo \\u233 dunia\\par Baris kedua\\par}', media);
    expect(text).toContain('Halo');
    expect(text).toContain('é');
    expect(text).toContain('Baris kedua');
    expect(text).toContain('\n');
    expect(media).toEqual([]);
  });

  it('membaca JSON yang sudah berisi draf soal', async () => {
    const payload = {
      questions: [{
        tempId: 'abc', number: 1, prompt: '2 + 2 = ?', options: [], answerKeys: ['4'],
        explanation: 'Empat', type: 'completion', mediaNames: [], warnings: []
      }]
    };
    const report = await parseJsonFile(fakeFile('soal.json', JSON.stringify(payload)));
    expect(report.format).toBe('json');
    expect(report.questions[0].prompt).toBe('2 + 2 = ?');
    expect(report.warnings).toContain('Soal dari JSON tetap harus ditinjau sebelum disimpan.');
  });

  it('menolak JSON dengan struktur salah dan format berkas tidak dikenal', async () => {
    await expect(parseJsonFile(fakeFile('soal.json', '{}'))).rejects.toThrow('Format JSON tidak dikenali');
    await expect(parseImportFile(fakeFile('soal.pdf', ''))).rejects.toThrow('Format tidak didukung');
  });
});
