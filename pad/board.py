"""Core board logic for a simplified Puzzle & Dragons style game."""
from __future__ import annotations

from dataclasses import dataclass
from typing import Iterable, List, Optional, Sequence, Set, Tuple
import random

Position = Tuple[int, int]


@dataclass(frozen=True)
class Combo:
    """Represents a group of connected orbs cleared in one cascade."""

    color: str
    size: int


@dataclass
class ResolutionResult:
    """Information about what happened when resolving matches."""

    combos: List[Combo]
    cascades: int
    orbs_cleared: int

    @property
    def score(self) -> int:
        """Return a lightweight score for the resolution."""

        combo_bonus = sum(combo.size for combo in self.combos)
        cascade_bonus = max(0, self.cascades - 1) * 5
        combo_count_bonus = max(0, len(self.combos) - 1) * 3
        return combo_bonus + cascade_bonus + combo_count_bonus


class Board:
    """Represents the puzzle board and encapsulates the game rules."""

    COLORS = ("R", "B", "G", "L", "D", "H")
    COLOR_NAMES = {
        "R": "Red",
        "B": "Blue",
        "G": "Green",
        "L": "Light",
        "D": "Dark",
        "H": "Heart",
    }

    def __init__(
        self,
        rows: int = 5,
        cols: int = 6,
        *,
        grid: Optional[Sequence[Sequence[str]]] = None,
        rng: Optional[random.Random] = None,
    ) -> None:
        self.rows = rows
        self.cols = cols
        self.rng = rng or random.Random()
        if grid is not None:
            self.grid: List[List[str]] = [list(row) for row in grid]
        else:
            self.grid = self._generate_board_without_initial_matches()

    # ------------------------------------------------------------------
    # Rendering helpers
    def render(self) -> str:
        """Return a user-friendly string representation of the board."""

        header = "    " + "  ".join(f"{c+1}" for c in range(self.cols))
        rows = [header]
        for idx, row in enumerate(self.grid):
            rendered_row = "  ".join(row)
            rows.append(f"{idx + 1:>2}  {rendered_row}")
        return "\n".join(rows)

    # ------------------------------------------------------------------
    # Core mechanics
    def swap(self, src: Position, dst: Position) -> None:
        """Swap two adjacent orbs on the board.

        Raises:
            ValueError: if either position is invalid or the positions are not
                orthogonally adjacent.
        """

        if not self._is_valid_position(src) or not self._is_valid_position(dst):
            raise ValueError("Positions must be inside the board.")
        if not self._are_adjacent(src, dst):
            raise ValueError("Positions must be adjacent (up, down, left or right).")

        sr, sc = src
        dr, dc = dst
        self.grid[sr][sc], self.grid[dr][dc] = self.grid[dr][dc], self.grid[sr][sc]

    def resolve_matches(self) -> ResolutionResult:
        """Resolve all combos currently present on the board."""

        total_cleared = 0
        cascades = 0
        combos: List[Combo] = []

        while True:
            matches = self.find_matches()
            if not matches:
                break

            cascades += 1
            combos.extend(self._group_matches(matches))
            total_cleared += len(matches)
            self._clear_matches(matches)
            self._collapse_columns()

        return ResolutionResult(combos=combos, cascades=cascades, orbs_cleared=total_cleared)

    def find_matches(self) -> Set[Position]:
        """Return the set of positions that form part of a match of three or more."""

        matches: Set[Position] = set()

        # Horizontal matches
        for r in range(self.rows):
            streak_color: Optional[str] = None
            streak_start = 0
            streak_len = 0
            for c in range(self.cols):
                color = self.grid[r][c]
                if color == streak_color:
                    streak_len += 1
                else:
                    if streak_len >= 3 and streak_color is not None:
                        matches.update((r, cc) for cc in range(streak_start, streak_start + streak_len))
                    streak_color = color
                    streak_start = c
                    streak_len = 1
            if streak_len >= 3 and streak_color is not None:
                matches.update((r, cc) for cc in range(streak_start, streak_start + streak_len))

        # Vertical matches
        for c in range(self.cols):
            streak_color = None
            streak_start = 0
            streak_len = 0
            for r in range(self.rows):
                color = self.grid[r][c]
                if color == streak_color:
                    streak_len += 1
                else:
                    if streak_len >= 3 and streak_color is not None:
                        matches.update((rr, c) for rr in range(streak_start, streak_start + streak_len))
                    streak_color = color
                    streak_start = r
                    streak_len = 1
            if streak_len >= 3 and streak_color is not None:
                matches.update((rr, c) for rr in range(streak_start, streak_start + streak_len))

        return matches

    # ------------------------------------------------------------------
    # Internal helpers
    def _generate_board_without_initial_matches(self) -> List[List[str]]:
        grid: List[List[str]] = []
        for r in range(self.rows):
            row: List[str] = []
            for c in range(self.cols):
                candidates = list(self.COLORS)
                if len(row) >= 2 and row[-1] == row[-2]:
                    candidates = [color for color in candidates if color != row[-1]]
                if r >= 2 and grid[r - 1][c] == grid[r - 2][c]:
                    candidates = [color for color in candidates if color != grid[r - 1][c]]
                row.append(self.rng.choice(candidates))
            grid.append(row)
        return grid

    def _group_matches(self, matches: Set[Position]) -> Iterable[Combo]:
        visited: Set[Position] = set()
        for position in matches:
            if position in visited:
                continue
            stack = [position]
            group: List[Position] = []
            color = self.grid[position[0]][position[1]]
            while stack:
                current = stack.pop()
                if current in visited:
                    continue
                visited.add(current)
                group.append(current)
                r, c = current
                for neighbor in ((r - 1, c), (r + 1, c), (r, c - 1), (r, c + 1)):
                    if neighbor in matches and neighbor not in visited:
                        nr, nc = neighbor
                        if self.grid[nr][nc] == color:
                            stack.append(neighbor)
            yield Combo(color=color, size=len(group))

    def _clear_matches(self, matches: Iterable[Position]) -> None:
        for r, c in matches:
            self.grid[r][c] = ""

    def _collapse_columns(self) -> None:
        for c in range(self.cols):
            column: List[str] = []
            for r in range(self.rows - 1, -1, -1):
                color = self.grid[r][c]
                if color:
                    column.append(color)
            # Fill with new random orbs at the top.
            while len(column) < self.rows:
                column.append(self._generate_orb())
            for r in range(self.rows):
                self.grid[self.rows - 1 - r][c] = column[r]

    def _generate_orb(self) -> str:
        return self.rng.choice(self.COLORS)

    def _is_valid_position(self, position: Position) -> bool:
        r, c = position
        return 0 <= r < self.rows and 0 <= c < self.cols

    def _are_adjacent(self, a: Position, b: Position) -> bool:
        ar, ac = a
        br, bc = b
        return abs(ar - br) + abs(ac - bc) == 1

