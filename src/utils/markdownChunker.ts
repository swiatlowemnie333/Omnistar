export interface ManuscriptChunk {
  index: number;
  title: string;
  wordCount: number;
  text: string;
}

/**
 * Splits a Pandoc Markdown manuscript into chunks based on `# ` and `## ` headings.
 * Ensures chunks do not exceed roughly maxWords (~1500 words).
 */
export function splitManuscriptIntoChunks(markdown: string, maxWords: number = 1500): ManuscriptChunk[] {
  if (!markdown || !markdown.trim()) return [];

  const lines = markdown.split(/\r?\n/);
  const sections: { title: string; lines: string[] }[] = [];
  let currentTitle = 'Wstęp / Frontmatter';
  let currentLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const isH1 = /^#\s+/.test(line);
    const isH2 = /^##\s+/.test(line);

    if (isH1 || isH2) {
      if (currentLines.length > 0) {
        sections.push({
          title: currentTitle,
          lines: currentLines
        });
      }
      currentTitle = line.replace(/^#{1,2}\s+/, '').replace(/\{[^}]*\}$/, '').trim() || `Sekcja ${sections.length + 1}`;
      currentLines = [line];
    } else {
      currentLines.push(line);
    }
  }

  if (currentLines.length > 0) {
    sections.push({
      title: currentTitle,
      lines: currentLines
    });
  }

  // Now subdivide sections if any exceed maxWords
  const chunks: ManuscriptChunk[] = [];
  let chunkIdx = 0;

  for (const sec of sections) {
    const secText = sec.lines.join('\n');
    const words = secText.split(/\s+/).filter(Boolean);

    if (words.length <= maxWords || sec.lines.length <= 15) {
      chunks.push({
        index: chunkIdx++,
        title: sec.title,
        wordCount: words.length,
        text: secText
      });
    } else {
      // Split section by paragraphs or smaller chunks
      const paragraphs = secText.split(/\n\s*\n/);
      let subLines: string[] = [];
      let subWordCount = 0;
      let partNum = 1;

      for (const p of paragraphs) {
        const pWords = p.split(/\s+/).filter(Boolean).length;
        if (subWordCount + pWords > maxWords && subLines.length > 0) {
          chunks.push({
            index: chunkIdx++,
            title: `${sec.title} (cz. ${partNum++})`,
            wordCount: subWordCount,
            text: subLines.join('\n\n')
          });
          subLines = [p];
          subWordCount = pWords;
        } else {
          subLines.push(p);
          subWordCount += pWords;
        }
      }

      if (subLines.length > 0) {
        chunks.push({
          index: chunkIdx++,
          title: partNum > 1 ? `${sec.title} (cz. ${partNum})` : sec.title,
          wordCount: subWordCount,
          text: subLines.join('\n\n')
        });
      }
    }
  }

  return chunks;
}
