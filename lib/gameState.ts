interface GameRoom {
  board: (string | null)[];
  isXNext: boolean;
  winner: string | null;
  players: Map<string, string>;
  createdAt: number;
}

class GameStateManager {
  private games: Map<string, GameRoom> = new Map();

  createRoom(): string {
    const roomId = Math.random().toString(36).substring(2, 8).toUpperCase();
    const newPlayerId = Math.random().toString(36).substring(2, 10);

    this.games.set(roomId, {
      board: Array(9).fill(null),
      isXNext: true,
      winner: null,
      players: new Map([[newPlayerId, 'X']]),
      createdAt: Date.now(),
    });

    return roomId;
  }

  getRoom(roomId: string): GameRoom | null {
    return this.games.get(roomId) || null;
  }

  joinRoom(roomId: string): string | null {
    const game = this.games.get(roomId);
    if (!game) return null;

    if (game.players.size >= 2) return null;

    const newPlayerId = Math.random().toString(36).substring(2, 10);
    const symbol = game.players.size === 0 ? 'X' : 'O';
    game.players.set(newPlayerId, symbol);

    return newPlayerId;
  }

  makeMove(roomId: string, playerId: string, index: number): boolean {
    const game = this.games.get(roomId);
    if (!game) return false;

    const playerSymbol = game.players.get(playerId);
    if (!playerSymbol) return false;

    if (game.board[index] !== null) return false;

    const expectedSymbol = game.isXNext ? 'X' : 'O';
    if (playerSymbol !== expectedSymbol) return false;

    game.board[index] = expectedSymbol;
    game.winner = this.calculateWinner(game.board);
    game.isXNext = !game.isXNext;

    return true;
  }

  resetGame(roomId: string): boolean {
    const game = this.games.get(roomId);
    if (!game) return false;

    game.board = Array(9).fill(null);
    game.isXNext = true;
    game.winner = null;

    return true;
  }

  deleteRoom(roomId: string): void {
    this.games.delete(roomId);
  }

  private calculateWinner(squares: (string | null)[]): string | null {
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

  getGameState(roomId: string) {
    const game = this.games.get(roomId);
    if (!game) return null;

    return {
      board: game.board,
      isXNext: game.isXNext,
      winner: game.winner,
      players: Array.from(game.players.entries()).map(([id, symbol]) => ({ id, symbol })),
    };
  }

  // Cleanup old games after 24 hours
  cleanupOldGames(): void {
    const now = Date.now();
    const maxAge = 24 * 60 * 60 * 1000;

    for (const [roomId, game] of this.games.entries()) {
      if (now - game.createdAt > maxAge) {
        this.games.delete(roomId);
      }
    }
  }
}

// Global singleton instance
let instance: GameStateManager | null = null;

export function getGameStateManager(): GameStateManager {
  if (!instance) {
    instance = new GameStateManager();
  }
  return instance;
}
