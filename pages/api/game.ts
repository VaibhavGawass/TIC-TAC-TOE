import type { NextApiRequest, NextApiResponse } from 'next';
import { getGameStateManager } from '../../lib/gameState';

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  const gameManager = getGameStateManager();

  if (req.method === 'POST') {
    const { action, roomId, playerId, index } = req.body;

    if (action === 'create') {
      const newRoomId = gameManager.createRoom();
      const room = gameManager.getRoom(newRoomId);
      const newPlayerId = Array.from(room!.players.keys())[0];

      return res.json({
        success: true,
        roomId: newRoomId,
        playerId: newPlayerId,
        symbol: 'X',
        state: gameManager.getGameState(newRoomId),
      });
    }

    if (action === 'join') {
      const game = gameManager.getRoom(roomId);
      if (!game) {
        return res.json({ success: false, error: 'Room not found' });
      }

      if (game.players.size >= 2) {
        return res.json({ success: false, error: 'Room is full' });
      }

      const newPlayerId = gameManager.joinRoom(roomId);
      if (!newPlayerId) {
        return res.json({ success: false, error: 'Failed to join room' });
      }

      const updatedGame = gameManager.getRoom(roomId)!;
      const symbol = updatedGame.players.get(newPlayerId);

      return res.json({
        success: true,
        roomId,
        playerId: newPlayerId,
        symbol,
        state: gameManager.getGameState(roomId),
      });
    }

    if (action === 'move') {
      const success = gameManager.makeMove(roomId, playerId, index);
      if (!success) {
        return res.json({ success: false, error: 'Invalid move' });
      }

      return res.json({
        success: true,
        state: gameManager.getGameState(roomId),
      });
    }

    if (action === 'reset') {
      const success = gameManager.resetGame(roomId);
      if (!success) {
        return res.json({ success: false, error: 'Room not found' });
      }

      return res.json({
        success: true,
        state: gameManager.getGameState(roomId),
      });
    }

    if (action === 'getState') {
      const state = gameManager.getGameState(roomId);
      if (!state) {
        return res.json({ success: false, error: 'Room not found' });
      }

      return res.json({
        success: true,
        state,
      });
    }
  }

  res.status(405).json({ error: 'Method not allowed' });
}
