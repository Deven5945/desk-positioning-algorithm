export class Renderer {
  constructor(canvas, classroom) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d');
    this.classroom = classroom;
  }

  render(students) {
    const { ctx, canvas, classroom } = this;
    const { rows, cols } = classroom;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cellWidth = canvas.width / cols;
    const cellHeight = canvas.height / rows;

    ctx.fillStyle = '#eef2ff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.strokeStyle = '#cbd5e1';
    ctx.lineWidth = 2;
    for (let row = 0; row <= rows; row += 1) {
      ctx.beginPath();
      ctx.moveTo(0, row * cellHeight);
      ctx.lineTo(canvas.width, row * cellHeight);
      ctx.stroke();
    }

    for (let col = 0; col <= cols; col += 1) {
      ctx.beginPath();
      ctx.moveTo(col * cellWidth, 0);
      ctx.lineTo(col * cellWidth, canvas.height);
      ctx.stroke();
    }

    for (const student of students) {
      if (!student.goal) continue;
      const goalX = (student.goal.col / 2) * cellWidth;
      const goalY = (student.goal.row / 2) * cellHeight;
      ctx.fillStyle = 'rgba(245, 158, 11, 0.35)';
      ctx.fillRect(goalX + 4, goalY + 4, cellWidth - 8, cellHeight - 8);
      ctx.fillStyle = '#b45309';
      ctx.font = 'bold 12px Segoe UI';
      ctx.textAlign = 'right';
      ctx.textBaseline = 'top';
      ctx.fillText(`${student.id}`, goalX + cellWidth - 9, goalY + 8);
    }

    for (const student of students) {
      const x = student.current.col * (canvas.width - cellWidth) / (classroom.movementCols - 1) + cellWidth / 2;
      const y = student.current.row * (canvas.height - cellHeight) / (classroom.movementRows - 1) + cellHeight / 2;
      const deskWidth = cellWidth * 0.62;
      const deskHeight = cellHeight * 0.62;
      ctx.fillStyle = '#2563eb';
      ctx.fillRect(x - deskWidth / 2, y - deskHeight / 2, deskWidth, deskHeight);
      ctx.fillStyle = 'white';
      ctx.font = 'bold 18px Segoe UI';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(`${student.id}`, x, y);
    }
  }
}
