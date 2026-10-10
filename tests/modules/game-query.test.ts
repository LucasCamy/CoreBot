import { describe, it, expect } from 'vitest';
import { queryGenericTcp } from '../../src/modules/game-monitor/services/query.protocols.js';

describe('Game Query Protocols', () => {
  it('should return offline status when connection fails or times out to unused port', async () => {
    // 127.0.0.1 on a random high unused port with short timeout
    const result = await queryGenericTcp('127.0.0.1', 59999, 500);
    expect(result.online).toBe(false);
    expect(result.port).toBe(59999);
    expect(result.host).toBe('127.0.0.1');
  });
});
