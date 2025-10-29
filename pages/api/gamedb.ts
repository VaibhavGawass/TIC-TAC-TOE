import type { NextApiRequest, NextApiResponse } from 'next';
import { db } from '../../lib/firebase';
import { ref, set, get, update, remove } from 'firebase/database';

function calculateWinner(board: (string | null)[]): string | null {
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
    if (board[a] && board[a] === board[b] && board[a] === board[c]) {
      return board[a];
    }
  }
  return null;
}

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { action, roomId, playerId, index } = req.body;

    if (action === 'create') {
      const newRoomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const newPlayerId = Math.random().toString(36).substring(2, 10);

      const gameData = {
        board: Array(9).fill(null),
        isXNext: true,
        winner: null,
        players: {
          [newPlayerId]: 'X',
        },
        createdAt: Date.now(),
      };

      await set(ref(db, `games/${newRoomId}`), gameData);

      return res.json({
        success: true,
        roomId: newRoomId,
        playerId: newPlayerId,
        symbol: 'X',
        state: {
          board: gameData.board,
          isXNext: gameData.isXNext,
          winner: gameData.winner,
          players: Object.entries(gameData.players).map(([id, symbol]) => ({
            id,
            symbol,
          })),
        },
      });
    }

    if (action === 'join') {
      const gameRef = ref(db, `games/${roomId}`);
      const snapshot = await get(gameRef);

      if (!snapshot.exists()) {
        return res.json({ success: false, error: 'Room not found' });
      }

      const game = snapshot.val();
      const playerIds = Object.keys(game.players || {});

      if (playerIds.length >= 2) {
        return res.json({ success: false, error: 'Room is full' });
      }

      const newPlayerId = Math.random().toString(36).substring(2, 10);
      const newSymbol = playerIds.length === 0 ? 'X' : 'O';

      await update(gameRef, {
        [`players/${newPlayerId}`]: newSymbol,
      });

      const updatedSnapshot = await get(gameRef);
      const updatedGame = updatedSnapshot.val();

      return res.json({
        success: true,
        roomId,
        playerId: newPlayerId,
        symbol: newSymbol,
        state: {
          board: updatedGame.board,
          isXNext: updatedGame.isXNext,
          winner: updatedGame.winner,
          players: Object.entries(updatedGame.players).map(([id, symbol]: any) => ({
            id,
            symbol,
          })),
        },
      });
    }

    if (action === 'move') {
      const gameRef = ref(db, `games/${roomId}`);
      const snapshot = await get(gameRef);

      if (!snapshot.exists()) {
        return res.json({ success: false, error: 'Room not found' });
      }

      const game = snapshot.val();
      const playerSymbol = game.players[playerId];

      if (!playerSymbol) {
        return res.json({ success: false, error: 'Not a player in this room' });
      }

      if (game.board[index] !== null) {
        return res.json({ success: false, error: 'Square already filled' });
      }

      const expectedSymbol = game.isXNext ? 'X' : 'O';
      if (playerSymbol !== expectedSymbol) {
        return res.json({ success: false, error: 'Not your turn' });
      }

      const newBoard = [...game.board];
      newBoard[index] = expectedSymbol;
      const winner = calculateWinner(newBoard);

      await update(gameRef, {
        board: newBoard,
        isXNext: !game.isXNext,
        winner: winner,
      });

      const updatedSnapshot = await get(gameRef);
      const updatedGame = updatedSnapshot.val();

      return res.json({
        success: true,
        state: {
          board: updatedGame.board,
          isXNext: updatedGame.isXNext,
          winner: updatedGame.winner,
          players: Object.entries(updatedGame.players).map(([id, symbol]: any) => ({
            id,
            symbol,
          })),
        },
      });
    }

    if (action === 'reset') {
      const gameRef = ref(db, `games/${roomId}`);
      const snapshot = await get(gameRef);

      if (!snapshot.exists()) {
        return res.json({ success: false, error: 'Room not found' });
      }

      await update(gameRef, {
        board: Array(9).fill(null),
        isXNext: true,
        winner: null,
      });

      const updatedSnapshot = await get(gameRef);
      const updatedGame = updatedSnapshot.val();

      return res.json({
        success: true,
        state: {
          board: updatedGame.board,
          isXNext: updatedGame.isXNext,
          winner: updatedGame.winner,
          players: Object.entries(updatedGame.players).map(([id, symbol]: any) => ({
            id,
            symbol,
          })),
        },
      });
    }

    if (action === 'getState') {
      const gameRef = ref(db, `games/${roomId}`);
      const snapshot = await get(gameRef);

      if (!snapshot.exists()) {
        return res.json({ success: false, error: 'Room not found' });
      }

      const game = snapshot.val();

      return res.json({
        success: true,
        state: {
          board: game.board,
          isXNext: game.isXNext,
          winner: game.winner,
          players: Object.entries(game.players).map(([id, symbol]: any) => ({
            id,
            symbol,
          })),
        },
      });
    }

    return res.status(400).json({ error: 'Invalid action' });
  } catch (error: any) {
    console.error('Error:', error);
    return res.json({ success: false, error: error.message || 'Server error' });
  }
}
