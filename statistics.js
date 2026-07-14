export class Statistics {
  static calculate(students, currentTime, termination = 'completed') {
    const completed = students.filter((s) => s.completed).length;
    const collisions = students.reduce((acc, student) => acc + (student.collisionCount || 0), 0);
    const totalDistance = students.reduce((acc, student) => acc + student.distance, 0);
    const totalWait = students.reduce((acc, student) => acc + student.waitTime, 0);
    const avgWait = students.length ? totalWait / students.length : 0;
    return {
      totalTime: currentTime,
      collisions,
      averageWait: avgWait,
      totalDistance,
      completed,
      studentCount: students.length,
      termination,
      isComplete: completed === students.length,
    };
  }
}
