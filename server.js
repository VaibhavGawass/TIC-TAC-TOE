const WebSocket = require('ws');
const http = require('http');

// Simple UUID v4 generator
function generateUUID() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    const r = (Math.random() * 16) | 0;
    const v = c === 'x' ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

const PORT = 8080;
const server = http.createServer();
const wss = new WebSocket.Server({ server });

// Store active games
const games = new Map();
const playerToRoom = new Map();

class Game {
  constructor(roomId) {
    this.roomId = roomId;
    this.board = Array(9).fill(null);
    this.isXNext = true;
    this.winner = null;
    this.players = new Map(); // playerId -> { ws, symbol }
    this.spectators = new Set();
  }

  calculateWinner(squares) {
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

    for (let i = 0; i < lines.length; i++) {
      const [a, b, c] = lines[i];
      if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
        return squares[a];
      }
    }
    return null;
  }

  makeMove(index, playerId) {
    // Validate move
    if (this.board[index] !== null) return { success: false, error: 'Square already filled' };
    
    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found' };

    const expectedSymbol = this.isXNext ? 'X' : 'O';
    if (player.symbol !== expectedSymbol) {
      return { success: false, error: 'Not your turn' };
    }

    // Make the move
    this.board[index] = expectedSymbol;
    this.winner = this.calculateWinner(this.board);
    this.isXNext = !this.isXNext;

    return { success: true };
  }

  getState() {
    return {
      board: this.board,
      isXNext: this.isXNext,
      winner: this.winner,
      players: Array.from(this.players.entries()).map(([id, player]) => ({
        id,
        symbol: player.symbol,
        connected: player.ws.readyState === WebSocket.OPEN,
      })),
    };
  }

  broadcast(message) {
    const data = JSON.stringify(message);
    this.players.forEach((player) => {
      if (player.ws.readyState === WebSocket.OPEN) {
        player.ws.send(data);
      }
    });
    this.spectators.forEach((ws) => {
      if (ws.readyState === WebSocket.OPEN) {
        ws.send(data);
      }
    });
  }
}

wss.on('connection', (ws) => {
  let playerId = generateUUID();
  let currentRoom = null;

  ws.on('message', (data) => {
    try {
      const message = JSON.parse(data);

      if (message.type === 'create_room') {
        // Create a new game room
        const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
        const game = new Game(roomId);
        
        game.players.set(playerId, { ws, symbol: 'X' });
        games.set(roomId, game);
        playerToRoom.set(playerId, roomId);
        currentRoom = roomId;

        ws.send(JSON.stringify({
          type: 'room_created',
          roomId,
          playerId,
          symbol: 'X',
          state: game.getState(),
        }));
      }

      if (message.type === 'join_room') {
        const { roomId } = message;
        const game = games.get(roomId);

        if (!game) {
          ws.send(JSON.stringify({ type: 'error', error: 'Room not found' }));
          return;
        }

        if (game.players.size >= 2) {
          // Join as spectator
          game.spectators.add(ws);
          playerToRoom.set(playerId, roomId);
          currentRoom = roomId;

          ws.send(JSON.stringify({
            type: 'room_joined',
            role: 'spectator',
            roomId,
            playerId,
            state: game.getState(),
          }));
        } else {
          // Join as player
          const symbol = game.players.size === 0 ? 'X' : 'O';
          game.players.set(playerId, { ws, symbol });
          playerToRoom.set(playerId, roomId);
          currentRoom = roomId;

          ws.send(JSON.stringify({
            type: 'room_joined',
            role: 'player',
            roomId,
            playerId,
            symbol,
            state: game.getState(),
          }));

          // Notify others
          game.broadcast({
            type: 'player_joined',
            state: game.getState(),
          });
        }
      }

      if (message.type === 'move') {
        const game = games.get(currentRoom);
        if (!game) return;

        const result = game.makeMove(message.index, playerId);
        if (result.success) {
          game.broadcast({
            type: 'move_made',
            state: game.getState(),
          });
        } else {
          ws.send(JSON.stringify({
            type: 'error',
            error: result.error,
          }));
        }
      }

      if (message.type === 'reset_game') {
        const game = games.get(currentRoom);
        if (!game) return;

        game.board = Array(9).fill(null);
        game.isXNext = true;
        game.winner = null;

        game.broadcast({
          type: 'game_reset',
          state: game.getState(),
        });
      }
    } catch (error) {
      console.error('Error processing message:', error);
    }
  });

  ws.on('close', () => {
    if (currentRoom) {
      const game = games.get(currentRoom);
      if (game) {
        game.players.delete(playerId);
        game.spectators.delete(ws);

        if (game.players.size === 0 && game.spectators.size === 0) {
          games.delete(currentRoom);
        } else {
          game.broadcast({
            type: 'player_disconnected',
            state: game.getState(),
          });
        }
      }
    }
    playerToRoom.delete(playerId);
  });
});

server.listen(PORT, () => {
  console.log(`WebSocket server running on ws://localhost:${PORT}`);
});
