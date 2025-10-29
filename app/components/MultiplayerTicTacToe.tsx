'use client';

import { useState, useEffect, useRef } from 'react';

type Player = 'X' | 'O' | null;

interface GameState {
  board: Player[];
  isXNext: boolean;
  winner: Player;
  players: Array<{ id: string; symbol: string; connected: boolean }>;
}

export default function MultiplayerTicTacToe() {
  const [gameState, setGameState] = useState<GameState>({
    board: Array(9).fill(null),
    isXNext: true,
    winner: null,
    players: [],
  });
  const [roomId, setRoomId] = useState<string | null>(null);
  const [playerId, setPlayerId] = useState<string | null>(null);
  const [symbol, setSymbol] = useState<'X' | 'O' | null>(null);
  const [role, setRole] = useState<'player' | 'spectator' | null>(null);
  const [inputRoomId, setInputRoomId] = useState('');
  const [message, setMessage] = useState('');
  const wsRef = useRef<WebSocket | null>(null);

  useEffect(() => {
    // Connect to WebSocket server
    wsRef.current = new WebSocket('ws://localhost:8080');

    wsRef.current.onopen = () => {
      console.log('Connected to WebSocket server');
    };

    wsRef.current.onmessage = (event) => {
      const data = JSON.parse(event.data);

      if (data.type === 'room_created') {
        setRoomId(data.roomId);
        setPlayerId(data.playerId);
        setSymbol(data.symbol);
        setRole('player');
        setGameState(data.state);
        setMessage(`Room created! Share this code: ${data.roomId}`);
      }

      if (data.type === 'room_joined') {
        setRoomId(data.roomId);
        setPlayerId(data.playerId);
        if (data.role === 'player') {
          setSymbol(data.symbol);
          setMessage(`Joined as Player ${data.symbol}`);
        } else {
          setMessage('Joined as Spectator');
        }
        setRole(data.role);
        setGameState(data.state);
      }

      if (data.type === 'move_made' || data.type === 'player_joined' || data.type === 'game_reset') {
        setGameState(data.state);
      }

      if (data.type === 'player_disconnected') {
        setGameState(data.state);
        setMessage('Opponent disconnected');
      }

      if (data.type === 'error') {
        setMessage(`Error: ${data.error}`);
      }
    };

    wsRef.current.onerror = () => {
      setMessage('Connection error. Make sure the WebSocket server is running.');
    };

    wsRef.current.onclose = () => {
      console.log('Disconnected from WebSocket server');
    };

    return () => {
      if (wsRef.current) {
        wsRef.current.close();
      }
    };
  }, []);

  const createRoom = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'create_room' }));
    }
  };

  const joinRoom = () => {
    if (!inputRoomId.trim()) {
      setMessage('Please enter a room code');
      return;
    }
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(
        JSON.stringify({
          type: 'join_room',
          roomId: inputRoomId.toUpperCase(),
        })
      );
    }
  };

  const handleClick = (index: number) => {
    // Only allow moves if you're a player and it's your turn
    if (role !== 'player' || !symbol) return;
    if (gameState.winner) return;
    if (gameState.board[index] !== null) return;

    const isMyTurn =
      (symbol === 'X' && gameState.isXNext) || (symbol === 'O' && !gameState.isXNext);
    if (!isMyTurn) {
      setMessage('Not your turn');
      return;
    }

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'move', index }));
    }
  };

  const resetGame = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'reset_game' }));
    }
  };

  const copyRoomCode = () => {
    if (roomId) {
      navigator.clipboard.writeText(roomId);
      setMessage('Room code copied to clipboard!');
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
              className="w-full bg-green-500 hover:bg-green-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
            >
              Create Room
            </button>

            <div className="flex gap-2">
              <input
                type="text"
                value={inputRoomId}
                onChange={(e) => setInputRoomId(e.target.value)}
                placeholder="Enter room code"
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <button
                onClick={joinRoom}
                className="bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded-lg transition-colors"
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

  const isBoardFull = gameState.board.every((square) => square !== null);
  const isDraw = isBoardFull && !gameState.winner;

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600 p-4">
      <div className="bg-white rounded-lg shadow-2xl p-8">
        <h1 className="text-4xl font-bold text-center mb-2 text-gray-800">Tic Tac Toe</h1>

        <div className="text-center mb-4">
          <p className="text-gray-600 font-semibold">
            Room: <span className="text-blue-600 text-lg">{roomId}</span>
            <button
              onClick={copyRoomCode}
              className="ml-2 text-xs bg-blue-500 text-white px-2 py-1 rounded hover:bg-blue-600"
            >
              Copy
            </button>
          </p>
          <p className="text-gray-600 text-sm mt-1">
            You are: <span className="font-bold">{role === 'player' ? `Player ${symbol}` : 'Spectator'}</span>
          </p>
        </div>

        {/* Players Status */}
        <div className="mb-4 text-center">
          <p className="text-sm text-gray-600 mb-2">Players:</p>
          <div className="flex justify-center gap-4">
            {gameState.players.map((p) => (
              <div
                key={p.id}
                className={`px-3 py-1 rounded text-sm font-semibold ${
                  p.connected
                    ? 'bg-green-100 text-green-800'
                    : 'bg-red-100 text-red-800'
                }`}
              >
                {p.symbol} {!p.connected && '(disconnected)'}
              </div>
            ))}
          </div>
        </div>

        {/* Status */}
        <div className="text-center mb-6 text-lg font-semibold">
          {gameState.winner ? (
            <p className="text-green-600">🎉 Player {gameState.winner} Wins!</p>
          ) : isDraw ? (
            <p className="text-yellow-600">🤝 It's a Draw!</p>
          ) : (
            <p className="text-blue-600">
              Current Player: <span className="text-2xl">{gameState.isXNext ? 'X' : 'O'}</span>
              {symbol && (symbol === (gameState.isXNext ? 'X' : 'O'))
                ? ' (Your turn!)'
                : ' (Waiting...)'}
            </p>
          )}
        </div>

        {/* Board */}
        <div className="grid grid-cols-3 gap-2 mb-8 bg-gray-200 p-2 rounded">
          {gameState.board.map((value, index) => (
            <button
              key={index}
              onClick={() => handleClick(index)}
              disabled={role !== 'player' || gameState.winner !== null}
              className={`w-20 h-20 text-3xl font-bold rounded-lg border-2 border-gray-300 transition-colors ${
                role === 'player'
                  ? 'bg-white hover:bg-gray-100 cursor-pointer'
                  : 'bg-gray-100 cursor-not-allowed'
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        {/* Reset Button */}
        {(role === 'player') && (
          <button
            onClick={resetGame}
            className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors mb-4"
          >
            New Game
          </button>
        )}

        {/* Leave Button */}
        <button
          onClick={() => window.location.reload()}
          className="w-full bg-red-500 hover:bg-red-600 text-white font-bold py-3 px-4 rounded-lg transition-colors"
        >
          Leave Game
        </button>

        {message && (
          <div className="mt-4 bg-blue-50 border-l-4 border-blue-500 p-4 rounded">
            <p className="text-blue-700 text-sm">{message}</p>
          </div>
        )}
      </div>
    </div>
  );
}
