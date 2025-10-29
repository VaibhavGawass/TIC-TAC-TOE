'use client';

import { useState } from 'react';

type Player = 'X' | 'O' | null;

export default function TicTacToe() {
  const [board, setBoard] = useState<Player[]>(Array(9).fill(null));
  const [isXNext, setIsXNext] = useState(true);
  const [gameOver, setGameOver] = useState(false);

  // Calculate winner
  const calculateWinner = (squares: Player[]): Player => {
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
  };

  const winner = calculateWinner(board);
  const isBoardFull = board.every(square => square !== null);
  const isDraw = isBoardFull && !winner;

  const handleClick = (index: number) => {
    // Don't allow moves if game is over or square is already filled
    if (board[index] || winner) return;

    const newBoard = [...board];
    newBoard[index] = isXNext ? 'X' : 'O';
    setBoard(newBoard);
    setIsXNext(!isXNext);

    if (calculateWinner(newBoard)) {
      setGameOver(true);
    }
  };

  const resetGame = () => {
    setBoard(Array(9).fill(null));
    setIsXNext(true);
    setGameOver(false);
  };

  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-gradient-to-br from-blue-500 to-purple-600">
      <div className="bg-white rounded-lg shadow-2xl p-8">
        <h1 className="text-4xl font-bold text-center mb-8 text-gray-800">
          Tic Tac Toe
        </h1>

        {/* Status */}
        <div className="text-center mb-6 text-lg font-semibold">
          {winner ? (
            <p className="text-green-600">🎉 Player {winner} Wins!</p>
          ) : isDraw ? (
            <p className="text-yellow-600">🤝 It's a Draw!</p>
          ) : (
            <p className="text-blue-600">Current Player: <span className="text-2xl">{isXNext ? 'X' : 'O'}</span></p>
          )}
        </div>

        {/* Board */}
        <div className="grid grid-cols-3 gap-2 mb-8 bg-gray-200 p-2 rounded">
          {board.map((value, index) => (
            <button
              key={index}
              onClick={() => handleClick(index)}
              className="w-20 h-20 bg-white text-3xl font-bold rounded-lg hover:bg-gray-100 transition-colors duration-200 border-2 border-gray-300"
            >
              {value}
            </button>
          ))}
        </div>

        {/* Reset Button */}
        <button
          onClick={resetGame}
          className="w-full bg-blue-500 hover:bg-blue-600 text-white font-bold py-3 px-4 rounded-lg transition-colors duration-200"
        >
          New Game
        </button>
      </div>
    </div>
  );
}
