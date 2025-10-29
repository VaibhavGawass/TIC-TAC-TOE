'use client';

import { useState, useEffect } from 'react';

type Player = 'X' | 'O' | null;

interface GameState {
  board: Player[];
  isXNext: boolean;
  winner: Player;
  players: Array<{ id: string; symbol: string }>;
}

export default function PollingTicTacToe() {
  const [gameState, setGameState] = useState<GameState>({
    board: Array(9).fill(null),
    isXNext: true,
    winner: null,
    players: [],
  });
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [symbol, setSymbol] = useState<'X' | 'O' | null>(null);
  const [inputRoomId, setInputRoomId] = useState('');
  const [message, setMessage] = useState('');

  // Poll for game state updates
  useEffect(() => {
    if (!roomId) return;

    const interval = setInterval(async () => {
      try {
        const res = await fetch('/api/game', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action: 'getState', roomId }),
        });
        const data = await res.json();
        if (data.success && data.state) {
          setGameState(data.state);
        }
      } catch (err) {
        console.error('Polling error:', err);
      }
    }, 500);

    return () => clearInterval(interval);
  }, [roomId]);

  const createRoom = async () => {
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'create' }),
      });
      const data = await res.json();
      if (data.success) {
        setRoomId(data.roomId);
        setPlayerId(data.playerId);
        setSymbol(data.symbol);
        setGameState(data.state);
        setMessage(`Room created! Share code: ${data.roomId}`);
      }
    } catch (err) {
      setMessage('Error creating room');
    }
  };

  const joinRoom = async () => {
    if (!inputRoomId.trim()) {
      setMessage('Enter a room code');
      return;
    }
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'join', roomId: inputRoomId.toUpperCase() }),
      });
      const data = await res.json();
      if (data.success) {
        setRoomId(inputRoomId.toUpperCase());
        setPlayerId(data.playerId);
        setSymbol(data.symbol);
        setGameState(data.state);
        setMessage(`Joined as Player ${data.symbol}`);
      } else {
        setMessage(data.error || 'Failed to join');
      }
    } catch (err) {
      setMessage('Error joining room');
    }
  };

  const handleClick = async (index: number) => {
    if (!roomId || !playerId || !symbol) return;
    if (gameState.winner) return;
    if (gameState.board[index] !== null) return;

    const isMyTurn =
      (symbol === 'X' && gameState.isXNext) || (symbol === 'O' && !gameState.isXNext);
    if (!isMyTurn) {
      setMessage('Not your turn');
      return;
    }

    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'move', roomId, playerId, index }),
      });
      const data = await res.json();
      if (data.success) {
        setGameState(data.state);
        setMessage('');
      } else {
        setMessage(data.error);
      }
    } catch (err) {
      setMessage('Error making move');
    }
  };

  const resetGame = async () => {
    if (!roomId) return;
    try {
      const res = await fetch('/api/game', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ action: 'reset', roomId }),
      });
      const data = await res.json();
      if (data.success) {
        setGameState(data.state);
      }
    } catch (err) {
      setMessage('Error resetting game');
    }
  };

  const copyRoomCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setMessage('Room code copied!');
    }
  };

  if (!roomId) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
        <div className="bg-white rounded-lg shadow-2xl p-8 w-96">
          <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">Tic Tac Toe</h1>

          <div className="space-y-4">
            <button
              onClick={createRoom}
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg"
            >
              Create Room
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value.toUpperCase())}
                placeholder="Enter room code"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none"
              />
              <button
                onClick={joinRoom}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold px-4 rounded-lg"
              >
                Join
              </button>
            </div>

            {message && (
              <div className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
                <p className="text-blue-700">{message}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    );
  }

  const isBoardFull = gameState.board.every((s) => s !== null);
  const isDraw = isBoardFull && !gameState.winner;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">Tic Tac Toe</h1>

        <div className="text-center mb-4">
          <p className="text-gray-600 font-semibold">
            Room: <span className="text-blue-600">{roomId}</span>
            <button
              onClick={copyRoomCode}
              className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded"
            >
              Copy
            </button>
          </p>
          <p className="text-sm text-gray-600 mt-1">You: {symbol}</p>
        </div>

        <div className="text-center mb-6 text-lg font-semibold">
          {gameState.winner ? (
            <p className="text-green-600">🎉 Player {gameState.winner} Wins!</p>
          ) : isDraw ? (
            <p className="text-yellow-600">🤝 Draw!</p>
          ) : (
            <p className="text-blue-600">
              Turn: {gameState.isXNext ? 'X' : 'O'}
              {symbol === (gameState.isXNext ? 'X' : 'O') ? ' (Your turn)' : ''}
            </p>
          )}
        </div>

        <div className="grid grid-cols-3 gap-2 mb-8 bg-gray-200 p-2 rounded">
          {gameState.board.map((value, index) => (
            <button
              key={index}
              onClick={() => handleClick(index)}
              className="w-20 h-20 text-3xl font-bold bg-white rounded-lg border-2 border-gray-300"
            >
              {value}
            </button>
          ))}
        </div>

        <button
          onClick={resetGame}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg mb-2"
        >
          New Game
        </button>
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg"
        >
          Leave
        </button>

        {message && (
          <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-3 rounded">
            <p className="text-sm text-blue-700">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
