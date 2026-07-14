export class Student {
  constructor(id, startPosition) {
    this.id = id;
    this.start = { ...startPosition };
    this.current = { ...startPosition };
    this.goal = null;
    this.previous = null;
    this.path = [];
    this.waitTime = 0;
    this.distance = 0;
    this.completed = false;
  }

  setGoal(goalPosition) {
    this.goal = { ...goalPosition };
    this.previous = null;
    this.path = [];
    this.completed = false;
    this.waitTime = 0;
    this.distance = 0;
  }

  moveTo(position) {
    if (position.row === this.current.row && position.col === this.current.col) {
      this.waitTime += 1;
      return false;
    }
    this.previous = { ...this.current };
    this.current = { ...position };
    // A movement-grid cell is half the distance between neighbouring seats.
    this.distance += 0.5;
    return true;
  }
}
