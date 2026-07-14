export class Classroom {
  constructor(rows = 5, cols = 6) {
    this.rows = rows;
    this.cols = cols;
    this.cells = rows * cols;
    this.movementRows = rows * 2 - 1;
    this.movementCols = cols * 2 - 1;
  }

  insideGrid(position) {
    return (
      position.row >= 0 && position.row < this.rows &&
      position.col >= 0 && position.col < this.cols
    );
  }

  index(position) {
    return position.row * this.cols + position.col;
  }

  neighbors(position) {
    return this.movementNeighbors(position);
  }

  insideMovementGrid(position) {
    return (
      position.row >= 0 && position.row < this.movementRows &&
      position.col >= 0 && position.col < this.movementCols
    );
  }

  movementNeighbors(position) {
    const directions = [
      { row: -1, col: 0 },
      { row: 1, col: 0 },
      { row: 0, col: -1 },
      { row: 0, col: 1 },
    ];
    return directions
      .map((dir) => ({ row: position.row + dir.row, col: position.col + dir.col }))
      .filter((pos) => this.insideMovementGrid(pos));
  }

  toMovementPosition(seatPosition) {
    if (!this.insideGrid(seatPosition)) {
      throw new Error('Seat position is outside the classroom grid.');
    }
    return { row: seatPosition.row * 2, col: seatPosition.col * 2 };
  }

  getAllPositions() {
    const positions = [];
    for (let row = 0; row < this.rows; row += 1) {
      for (let col = 0; col < this.cols; col += 1) {
        positions.push({ row, col });
      }
    }
    return positions;
  }
}
