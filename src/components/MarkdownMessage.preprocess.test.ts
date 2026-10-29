import { describe, expect, it } from 'vitest';
import { preprocessMarkdown } from './MarkdownMessage';

describe('preprocessMarkdown starred specs', () => {
  it('keeps thickness*width*length stars visible to the markdown parser', () => {
    const processed = preprocessMarkdown('MS pistons (5*250*3000) and MS bush (6*250*3000)');
    expect(processed).toContain('5\\*250\\*3000');
    expect(processed).toContain('6\\*250\\*3000');
  });
});
