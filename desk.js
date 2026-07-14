export class Desk {
  constructor(id, position) {
    this.id = id;
    this.position = { ...position };
  }

  clone() {
    return new Desk(this.id, { row: this.position.row, col: this.position.col });
  }
}
