import type { NextApiRequest, NextApiResponse } from 'next';

interface GameState {
  board: (string | null)[];
  isXNext: boolean;
  winner: string | null;
  players: Array<{ id: string; symbol: string }>;
}

interface GameRoom {
  board: (string | null)[];
  isXNext: boolean;
  winner: string | null;
  players: Map<string, string>;
}

const games = new Map<string, GameRoom>();

function calculateWinner(squares: (string | null)[]): string | null {
  const lines = [
    [0, 1, 2],
    [3, 4, 5],
    [6, 7, 8],
    [0, 3, 6],
    [1, 4, 7],
    [2, 5, 8],
    [0, 4, 8],
    [2, 4, 6],
  ];

  for (const [a, b, c] of lines) {
    if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
      return squares[a];
    }
  }
  return null;
}

function getGameState(game: GameRoom): GameState {
  return {
    board: game.board,
    isXNext: game.isXNext,
    winner: game.winner,
    players: Array.from(game.players.entries()).map(([id, symbol]) => ({ id, symbol })),
  };
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method === 'POST') {
    const { action, roomId, playerId, symbol, index } = req.body;

    if (action === 'create') {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newPlayerId = Math.random().toString(36).substring(2, 10);

      games.set(newRoomId, {
        board: Array(9).fill(null),
        isXNext: true,
        winner: null,
        players: new Map([[newPlayerId, 'X']]),
      });

      return res.json({
        success: true,
        roomId: newRoomId,
        playerId: newPlayerId,
        symbol: 'X',
        state: getGameState(games.get(newRoomId)!),
      });
    }

    if (action === 'join') {
      const game = games.get(roomId);
      if (!game) {
        return res.status(404).json({ success: false, error: 'Room not found' });
      }

      if (game.players.size >= 2) {
        return res.json({ success: false, error: 'Room is full' });
      }

      const newPlayerId = Math.random().toString(36).substring(2, 10);
      const newSymbol = game.players.size === 0 ? 'X' : 'O';
      game.players.set(newPlayerId, newSymbol);

      return res.json({
        success: true,
        roomId,
        playerId: newPlayerId,
        symbol: newSymbol,
        state: getGameState(game),
      });
    }

    if (action === 'move') {
      const game = games.get(roomId);
      if (!game) {
        return res.status(404).json({ success: false, error: 'Room not found' });
      }

      const playerSymbol = game.players.get(playerId);
      if (!playerSymbol) {
        return res.status(403).json({ success: false, error: 'Not a player in this room' });
      }

      if (game.board[index] !== null) {
        return res.json({ success: false, error: 'Square already filled' });
      }

      const expectedSymbol = game.isXNext ? 'X' : 'O';
      if (playerSymbol !== expectedSymbol) {
        return res.json({ success: false, error: 'Not your turn' });
      }

      game.board[index] = expectedSymbol;
      game.winner = calculateWinner(game.board);
      game.isXNext = !game.isXNext;

      return res.json({
        success: true,
        state: getGameState(game),
      });
    }

    if (action === 'reset') {
      const game = games.get(roomId);
      if (!game) {
        return res.status(404).json({ success: false, error: 'Room not found' });
      }

      game.board = Array(9).fill(null);
      game.isXNext = true;
      game.winner = null;

      return res.json({
        success: true,
        state: getGameState(game),
      });
    }

    if (action === 'getState') {
      const game = games.get(roomId);
      if (!game) {
        return res.status(404).json({ success: false, error: 'Room not found' });
      }

      return res.json({
        success: true,
        state: getGameState(game),
      });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
