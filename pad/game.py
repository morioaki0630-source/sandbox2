"""Command line interface for the simplified Puzzle & Dragons game."""
from __future__ import annotations

import argparse
from dataclasses import dataclass
from typing import Iterable, List, Tuple

from .board import Board, ResolutionResult


@dataclass
class GameStats:
    turns: int = 0
    score: int = 0
    total_combos: int = 0
    total_orbs: int = 0

    def record_resolution(self, result: ResolutionResult) -> None:
        self.turns += 1
        self.score += result.score
        self.total_combos += len(result.combos)
        self.total_orbs += result.orbs_cleared


def parse_position_pair(tokens: Iterable[str]) -> Tuple[Tuple[int, int], Tuple[int, int]]:
    values = [int(token) for token in tokens]
    if len(values) != 4:
        raise ValueError("Expected four integers: row1 col1 row2 col2")
    r1, c1, r2, c2 = values
    return (r1 - 1, c1 - 1), (r2 - 1, c2 - 1)


def describe_resolution(result: ResolutionResult) -> List[str]:
    lines: List[str] = []
    if not result.combos:
        lines.append("No combos this turn... but the board has changed!")
        return lines

    combo_word = "combo" if len(result.combos) == 1 else "combos"
    lines.append(f"{len(result.combos)} {combo_word}! Cascades: {result.cascades}")
    for idx, combo in enumerate(result.combos, start=1):
        lines.append(f"  {idx:>2}: {Board.COLOR_NAMES.get(combo.color, combo.color)} x{combo.size}")
    lines.append(f"Score gained: {result.score}")
    return lines


def create_board(args: argparse.Namespace) -> Board:
    return Board(rows=args.rows, cols=args.cols)


def main(argv: Iterable[str] | None = None) -> None:
    parser = argparse.ArgumentParser(description="Play a bite-sized Puzzle & Dragons style puzzle.")
    parser.add_argument("--rows", type=int, default=5, help="Number of rows in the board (default: 5)")
    parser.add_argument("--cols", type=int, default=6, help="Number of columns in the board (default: 6)")
    parser.add_argument("--turns", type=int, default=10, help="Maximum number of turns before the game ends")
    args = parser.parse_args(list(argv) if argv is not None else None)

    board = create_board(args)
    stats = GameStats()

    print("Welcome to the Puzzle & Dragons inspired puzzle!")
    print("Swap adjacent orbs to make matches of three or more.")
    print("Enter moves as: row1 col1 row2 col2 (1-indexed). Type 'q' to quit.\n")

    while stats.turns < args.turns:
        print(board.render())
        raw = input(f"Turn {stats.turns + 1}/{args.turns} - move: ").strip()
        if not raw:
            print("Please enter a move like '1 1 1 2'.")
            continue
        if raw.lower() in {"q", "quit", "exit"}:
            break
        try:
            src, dst = parse_position_pair(raw.split())
            board.swap(src, dst)
        except ValueError as exc:
            print(f"Invalid move: {exc}")
            continue

        result = board.resolve_matches()
        stats.record_resolution(result)
        for line in describe_resolution(result):
            print(line)
        print()

    print("Game over!\n")
    print(board.render())
    print(f"Turns taken: {stats.turns}")
    print(f"Total combos: {stats.total_combos}")
    print(f"Orbs cleared: {stats.total_orbs}")
    print(f"Final score: {stats.score}")


if __name__ == "__main__":
    main()
