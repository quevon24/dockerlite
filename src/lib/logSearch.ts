export interface LogMatch {
  lineId: number;
  start: number;
  end: number;
}

/** Stable identity of a match, surviving ring-buffer rotation. */
export function matchKey(m: LogMatch): string {
  return `${m.lineId}:${m.start}`;
}

/**
 * Find every non-overlapping occurrence of query in the lines' text, in
 * display order. Matching is literal (no regex) and case-insensitive unless
 * caseSensitive is set.
 */
export function findLogMatches(
  lines: readonly { id: number; text: string }[],
  query: string,
  caseSensitive: boolean,
): LogMatch[] {
  if (!query) return [];
  const needle = caseSensitive ? query : query.toLowerCase();
  const matches: LogMatch[] = [];
  for (const line of lines) {
    const haystack = caseSensitive ? line.text : line.text.toLowerCase();
    let from = 0;
    for (;;) {
      const start = haystack.indexOf(needle, from);
      if (start === -1) break;
      matches.push({ lineId: line.id, start, end: start + needle.length });
      from = start + needle.length;
    }
  }
  return matches;
}
