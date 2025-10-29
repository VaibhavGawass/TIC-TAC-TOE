import { Server } from 'socket.io';

// Store active games
const games = new Map();
const playerToRoom = new Map();

class Game {
  constructor(roomId) {
    this.roomId = roomId;
    this.board = Array(9).fill(null);
    this.isXNext = true;
    this.winner = null;
    this.players = new Map();
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
    if (this.board[index] !== null) return { success: false, error: 'Square already filled' };

    const player = this.players.get(playerId);
    if (!player) return { success: false, error: 'Player not found' };

    const expectedSymbol = this.isXNext ? 'X' : 'O';
    if (player.symbol !== expectedSymbol) {
      return { success: false, error: 'Not your turn' };
    }

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
        connected: true,
      })),
    };
  }

  broadcast(io, message) {
    const room = this.roomId;
    io.to(room).emit('game_update', message);
  }
}

export default function SocketHandler(req, res) {
  if (res.socket.server.io) {
    console.log('Socket.io already attached');
    res.end();
    return;
  }

  const io = new Server(res.socket.server, {
    cors: { origin: '*' },
    transports: ['websocket', 'polling'],
  });

  res.socket.server.io = io;

  io.on('connection', (socket) => {
    console.log('Client connected:', socket.id);
    let currentRoom = null;
    let playerId = socket.id;

    socket.on('create_room', () => {
      const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
      const game = new Game(roomId);

      game.players.set(playerId, { symbol: 'X' });
      games.set(roomId, game);
      playerToRoom.set(playerId, roomId);
      currentRoom = roomId;

      socket.join(roomId);

      socket.emit('room_created', {
        type: 'room_created',
        roomId,
        playerId,
        symbol: 'X',
        state: game.getState(),
      });

      console.log('Room created:', roomId);
    });

    socket.on('join_room', ({ roomId }) => {
      const game = games.get(roomId);

      if (!game) {
        socket.emit('error', { type: 'error', error: 'Room not found' });
        return;
      }

      socket.join(roomId);

      if (game.players.size >= 2) {
        game.spectators.add(socket.id);
        playerToRoom.set(playerId, roomId);
        currentRoom = roomId;

        socket.emit('room_joined', {
          type: 'room_joined',
          role: 'spectator',
          roomId,
          playerId,
          state: game.getState(),
        });
      } else {
        const symbol = game.players.size === 0 ? 'X' : 'O';
        game.players.set(playerId, { symbol });
        playerToRoom.set(playerId, roomId);
        currentRoom = roomId;

        socket.emit('room_joined', {
          type: 'room_joined',
          role: 'player',
          roomId,
          playerId,
          symbol,
          state: game.getState(),
        });

        io.to(roomId).emit('player_joined', {
          type: 'player_joined',
          state: game.getState(),
        });
      }

      console.log('Player joined room:', roomId);
    });

    socket.on('move', ({ index }) => {
      const game = games.get(currentRoom);
      if (!game) return;

      const result = game.makeMove(index, playerId);
      if (result.success) {
        io.to(currentRoom).emit('move_made', {
          type: 'move_made',
          state: game.getState(),
        });
      } else {
        socket.emit('error', {
          type: 'error',
          error: result.error,
        });
      }
    });

    socket.on('reset_game', () => {
      const game = games.get(currentRoom);
      if (!game) return;

      game.board = Array(9).fill(null);
      game.isXNext = true;
      game.winner = null;

      io.to(currentRoom).emit('game_reset', {
        type: 'game_reset',
        state: game.getState(),
      });
    });

    socket.on('disconnect', () => {
      if (currentRoom) {
        const game = games.get(currentRoom);
        if (game) {
          game.players.delete(playerId);
          game.spectators.delete(socket.id);

          if (game.players.size === 0 && game.spectators.size === 0) {
            games.delete(currentRoom);
          } else {
            io.to(currentRoom).emit('player_disconnected', {
              type: 'player_disconnected',
              state: game.getState(),
            });
          }
        }
      }
      playerToRoom.delete(playerId);
      console.log('Client disconnected:', socket.id);
    });
  });

  res.end();
}
