// Issue: <add GitHub issue link>
// A custom x-user-token header made the browser block /chat requests before
// the API could answer, so the assistant showed a network error and no history.
import { beforeEach, describe, expect, it } from 'vitest';
import { API } from '../../lib/api';

describe('assistant chat requests', () => {
  beforeEach(() => {
    sessionStorage.clear();
  });

  it('sends the account token only as Authorization', async () => {
    sessionStorage.setItem('enlight_token', 'test-token');
    let seen: { headers?: { get?: (name: string) => unknown } } | undefined;
    const previous = API.defaults.adapter;
    API.defaults.adapter = async (config) => {
      seen = config;
      return {
        data: { ok: true },
        status: 200,
        statusText: 'OK',
        headers: {},
        config,
      };
    };

    try {
      await API.post('/chat/message', { message: 'hi' });
    } finally {
      API.defaults.adapter = previous;
    }

    expect(seen?.headers?.get?.('x-user-token')).toBeFalsy();
    expect(seen?.headers?.get?.('Authorization')).toBe('Bearer test-token');
  });
});
