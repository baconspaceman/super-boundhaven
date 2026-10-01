import { parseLevel } from '../level';

/**
 * Test playground. Left to right:
 *  spawn -> 4-step ramp up to a plateau and back down -> 5-tile pit (run-jump)
 *  -> bounce pad under a high platform (hold jump) -> stair platforms
 *  -> 4-tile wall (run-jump) -> 6-tile wall (needs a friend's head).
 */
function build(): string[] {
  const W = 100;
  const H = 14;
  const g: string[][] = Array.from({ length: H }, () => Array<string>(W).fill('.'));
  const fill = (r1: number, r2: number, c1: number, c2: number, ch: string) => {
    for (let r = r1; r <= r2; r++) for (let c = c1; c <= c2; c++) g[r][c] = ch;
  };

  fill(12, 13, 0, W - 1, '#'); // ground
  g[11][3] = 'S';

  for (let i = 0; i < 4; i++) {
    g[11 - i][20 + i] = '/';
    fill(12 - i, 11, 20 + i, 20 + i, '#');
  }
  fill(8, 11, 24, 27, '#'); // plateau
  for (let i = 0; i < 4; i++) {
    g[8 + i][28 + i] = '\\';
    fill(9 + i, 11, 28 + i, 28 + i, '#');
  }

  fill(12, 13, 40, 44, '.'); // pit

  g[11][50] = 'B'; // bounce pad
  fill(4, 4, 52, 55, '#'); // high platform (needs a held-jump pad bounce)
  fill(9, 9, 58, 61, '#'); // stairs
  fill(6, 6, 64, 67, '#');

  fill(8, 11, 74, 74, '#'); // 4-tile wall
  fill(6, 11, 84, 84, '#'); // 6-tile wall (co-op)
  fill(6, 6, 85, 88, '#'); // landing shelf beyond the co-op wall

  return g.map((row) => row.join(''));
}

export const PLAYGROUND = parseLevel('playground', build());
