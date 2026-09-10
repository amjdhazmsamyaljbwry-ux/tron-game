export { GameRoom } from './game-room.js';

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    if (url.pathname === '/ws') {
      const code = (url.searchParams.get('code') || '').trim();
      const action = url.searchParams.get('action');
      if (!/^[0-9]{4}$/.test(code) || (action !== 'create' && action !== 'join')) {
        return new Response('bad request', { status: 400 });
      }
      const id = env.GAME_ROOM.idFromName(code);
      const stub = env.GAME_ROOM.get(id);
      const forwardUrl = new URL(request.url);
      forwardUrl.searchParams.set('code', code);
      return stub.fetch(new Request(forwardUrl, request));
    }

    return env.ASSETS.fetch(request);
  },
};
