import type { ParsedSection } from './parsers/types.js';

const AVG_CHARS_PER_TOKEN = 4;

export interface Chunk {
  content: string;
  startLine: number;
  endLine: number;
  sectionTitles: string[];
  tokenEstimate: number;
  index: number;
}

export interface ChunkerOptions {
  maxTokens?: number;
  overlapTokens?: number;
}

function estimateTokens(text: string): number {
  return Math.ceil(text.length / AVG_CHARS_PER_TOKEN);
}

/**
 * Splits parsed sections into overlapping chunks.
 * - Target: 2,000 tokens per chunk
 * - Overlap: 200 tokens between chunks
 * - Splits on section boundaries when possible
 */
export function chunkSections(
  sections: ParsedSection[],
  options: ChunkerOptions = {},
): Chunk[] {
  const maxTokens = options.maxTokens ?? 2000;
  const overlapTokens = options.overlapTokens ?? 200;
  const maxChars = maxTokens * AVG_CHARS_PER_TOKEN;
  const overlapChars = overlapTokens * AVG_CHARS_PER_TOKEN;

  if (sections.length === 0) return [];

  const chunks: Chunk[] = [];
  let currentContent = '';
  let currentStartLine = sections[0]!.startLine;
  let currentEndLine = sections[0]!.startLine;
  let currentTitles: string[] = [];
  let overlapBuffer = '';

  for (const section of sections) {
    const sectionText = section.title
      ? `## ${section.title}\n${section.content}`
      : section.content;

    const sectionTokens = estimateTokens(sectionText);

    // If single section exceeds max, split it into sub-chunks
    if (sectionTokens > maxTokens) {
      // Flush current chunk first
      if (currentContent.length > 0) {
        chunks.push(buildChunk(currentContent, currentStartLine, currentEndLine, currentTitles, chunks.length));
        overlapBuffer = currentContent.slice(-overlapChars);
        currentContent = '';
        currentTitles = [];
      }

      const subChunks = splitLargeText(sectionText, maxChars, overlapChars, section, chunks.length);
      chunks.push(...subChunks);

      overlapBuffer = subChunks.length > 0
        ? subChunks[subChunks.length - 1]!.content.slice(-overlapChars)
        : '';
      currentStartLine = section.endLine + 1;
      currentEndLine = section.endLine;
      continue;
    }

    // Check if adding this section would exceed the limit
    const combined = currentContent + (currentContent ? '\n\n' : '') + sectionText;
    if (estimateTokens(combined) > maxTokens && currentContent.length > 0) {
      // Flush current chunk
      chunks.push(buildChunk(currentContent, currentStartLine, currentEndLine, currentTitles, chunks.length));
      overlapBuffer = currentContent.slice(-overlapChars);

      // Start new chunk with overlap
      currentContent = overlapBuffer + '\n\n' + sectionText;
      currentStartLine = section.startLine;
      currentEndLine = section.endLine;
      currentTitles = section.title ? [section.title] : [];
    } else {
      // Accumulate
      if (currentContent.length === 0 && overlapBuffer.length > 0) {
        currentContent = overlapBuffer + '\n\n' + sectionText;
      } else {
        currentContent = combined;
      }
      if (currentContent === sectionText || currentContent === combined) {
        if (chunks.length === 0) currentStartLine = section.startLine;
      }
      currentEndLine = section.endLine;
      if (section.title && !currentTitles.includes(section.title)) {
        currentTitles.push(section.title);
      }
    }
  }

  // Flush remaining content
  if (currentContent.trim().length > 0) {
    chunks.push(buildChunk(currentContent, currentStartLine, currentEndLine, currentTitles, chunks.length));
  }

  return chunks;
}

function buildChunk(
  content: string,
  startLine: number,
  endLine: number,
  titles: string[],
  index: number,
): Chunk {
  return {
    content: content.trim(),
    startLine,
    endLine,
    sectionTitles: [...titles],
    tokenEstimate: estimateTokens(content),
    index,
  };
}

function splitLargeText(
  text: string,
  maxChars: number,
  overlapChars: number,
  section: ParsedSection,
  startIndex: number,
): Chunk[] {
  const chunks: Chunk[] = [];
  const lines = text.split('\n');
  let currentChunk = '';
  let chunkStartLine = section.startLine;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i]!;
    const next = currentChunk + (currentChunk ? '\n' : '') + line;

    if (next.length > maxChars && currentChunk.length > 0) {
      const lineOffset = section.startLine + i;
      chunks.push(buildChunk(
        currentChunk,
        chunkStartLine,
        lineOffset - 1,
        section.title ? [section.title] : [],
        startIndex + chunks.length,
      ));

      // Start next chunk with overlap
      const overlap = currentChunk.slice(-overlapChars);
      currentChunk = overlap + '\n' + line;
      chunkStartLine = lineOffset;
    } else {
      currentChunk = next;
    }
  }

  if (currentChunk.trim().length > 0) {
    chunks.push(buildChunk(
      currentChunk,
      chunkStartLine,
      section.endLine,
      section.title ? [section.title] : [],
      startIndex + chunks.length,
    ));
  }

  return chunks;
}
