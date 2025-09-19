import pytest

from pad.board import Board


class DummyRng:
    def __init__(self, sequence):
        self.sequence = list(sequence)
        self.index = 0

    def choice(self, options):
        value = self.sequence[self.index % len(self.sequence)]
        self.index += 1
        if value not in options:
            return options[0]
        return value


def test_find_matches_horizontal_and_vertical():
    grid = [
        ["R", "R", "R", "B"],
        ["G", "B", "G", "B"],
        ["G", "B", "G", "B"],
        ["L", "L", "L", "D"],
    ]
    board = Board(rows=4, cols=4, grid=grid)

    matches = board.find_matches()

    expected = {
        (0, 0), (0, 1), (0, 2),  # Horizontal red match
        (3, 0), (3, 1), (3, 2),  # Horizontal light match
        (0, 3), (1, 3), (2, 3),  # Vertical blue match
    }
    assert matches == expected


def test_swap_requires_adjacent_positions():
    grid = [
        ["R", "B", "G"],
        ["L", "D", "H"],
        ["R", "B", "G"],
    ]
    board = Board(rows=3, cols=3, grid=grid)

    with pytest.raises(ValueError):
        board.swap((0, 0), (2, 2))


def test_resolve_matches_returns_combos():
    grid = [
        ["R", "R", "R", "B"],
        ["G", "L", "D", "H"],
        ["G", "L", "D", "H"],
        ["B", "B", "B", "H"],
    ]
    board = Board(rows=4, cols=4, grid=grid, rng=DummyRng("RGBLDH"))

    result = board.resolve_matches()

    assert result.cascades >= 1
    combos = [(combo.color, combo.size) for combo in result.combos]
    assert combos.count(("R", 3)) >= 1
    assert combos.count(("B", 3)) >= 1
    assert result.orbs_cleared >= 6
