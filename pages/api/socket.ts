import type { NextApiRequest, NextApiResponse } from 'next';
import type { Socket as NetSocket } from 'net';

interface SocketWithData extends NetSocket {
  gameRoom?: string;
  playerId?: string;
}

const games = new Map();
const playerConnections = new Map();

class Game {
  roomId: string;
  board: (string | null)[];
  isXNext: boolean;
  winner: string | null;
  players: Map<string, { symbol: string }>;

  constructor(roomId: string) {
    this.roomId = roomId;
    this.board = Array(9).fill(null);
    this.isXNext = true;
    this.winner = null;
    this.players = new Map();
  }

  calculateWinner(squares: (string | null)[]): string | null {
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

  getState() {
    return {
      board: this.board,
      isXNext: this.isXNext,
      winner: this.winner,
      players: Array.from(this.players.entries()).map(([id, player]) => ({
        id,
        symbol: player.symbol,
      })),
    };
  }
}

export default function handler(req: NextApiRequest, res: NextApiResponse) {
  if (!res.socket) return res.status(400).end('No socket');

  const socket = res.socket as SocketWithData;

  socket.on('data', (buffer) => {
    try {
      const message = JSON.parse(buffer.toString());

      if (message.type === 'create_room') {
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const game = new Game(roomId);
        const playerId = Math.random().toString(36).substring(2, 10);

        game.players.set(playerId, { symbol: 'X' });
        games.set(roomId, game);
        playerConnections.set(playerId, socket);

        socket.gameRoom = roomId;
        socket.playerId = playerId;

        socket.write(
          JSON.stringify({
            type: 'room_created',
            roomId,
            playerId,
            symbol: 'X',
            state: game.getState(),
          }) + '\n'
        );
      }

      if (message.type === 'join_room') {
        const roomId = message.roomId;
        const game = games.get(roomId);

        if (!game) {
          socket.write(JSON.stringify({ type: 'error', error: 'Room not found' }) + '\n');
          return;
        }

        const playerId = Math.random().toString(36).substring(2, 10);
        const symbol = game.players.size === 0 ? 'X' : 'O';

        game.players.set(playerId, { symbol });
        playerConnections.set(playerId, socket);

        socket.gameRoom = roomId;
        socket.playerId = playerId;

        socket.write(
          JSON.stringify({
            type: 'room_joined',
            roomId,
            playerId,
            symbol,
            state: game.getState(),
          }) + '\n'
        );

        // Notify other player
        const otherPlayer = Array.from(game.players.entries()).find(([id]) => id !== playerId);
        if (otherPlayer) {
          const otherSocket = playerConnections.get(otherPlayer[0]);
          if (otherSocket) {
            otherSocket.write(
              JSON.stringify({
                type: 'player_joined',
                state: game.getState(),
              }) + '\n'
            );
          }
        }
      }

      if (message.type === 'move' && socket.gameRoom && socket.playerId) {
        const game = games.get(socket.gameRoom);
        if (!game) return;

        const player = game.players.get(socket.playerId);
        if (!player) return;

        const { index } = message;
        if (game.board[index] !== null) return;

        const expectedSymbol = game.isXNext ? 'X' : 'O';
        if (player.symbol !== expectedSymbol) return;

        game.board[index] = expectedSymbol;
        game.winner = game.calculateWinner(game.board);
        game.isXNext = !game.isXNext;

        // Broadcast to both players
        const state = game.getState();
        for (const [, playerId] of game.players) {
          const playerSocket = playerConnections.get(playerId);
          if (playerSocket) {
            playerSocket.write(JSON.stringify({ type: 'move_made', state }) + '\n');
          }
        }
      }

      if (message.type === 'reset_game' && socket.gameRoom) {
        const game = games.get(socket.gameRoom);
        if (!game) return;

        game.board = Array(9).fill(null);
        game.isXNext = true;
        game.winner = null;

        for (const [, playerId] of game.players) {
          const playerSocket = playerConnections.get(playerId);
          if (playerSocket) {
            playerSocket.write(JSON.stringify({ type: 'game_reset', state: game.getState() }) + '\n');
          }
        }
      }
    } catch (error) {
      console.error('Error:', error);
    }
  });

  socket.on('end', () => {
    if (socket.playerId) {
      playerConnections.delete(socket.playerId);
      if (socket.gameRoom) {
        const game = games.get(socket.gameRoom);
        if (game) {
          game.players.delete(socket.playerId);
          if (game.players.size === 0) {
            games.delete(socket.gameRoom);
          }
        }
      }
    }
  });

  res.end();
}
