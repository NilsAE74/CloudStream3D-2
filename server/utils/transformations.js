/**
 * Utility functions for point cloud transformations
 */

/**
 * Invert Z values of all points
 */
function invertZ(points) {
  return points.map(point => ({
    x: point.x,
    y: point.y,
    z: -point.z
  }));
}

/**
 * Shift all points by given deltas
 */
function shiftData(points, dx, dy, dz) {
  return points.map(point => ({
    x: point.x + dx,
    y: point.y + dy,
    z: point.z + dz
  }));
}

/**
 * Rotate points around X, Y, Z axes
 * @param {Array} points - Array of {x, y, z} objects
 * @param {number} rx - Rotation around X axis in degrees
 * @param {number} ry - Rotation around Y axis in degrees
 * @param {number} rz - Rotation around Z axis in degrees
 */
function rotateData(points, rx, ry, rz) {
  // Convert degrees to radians
  const rxRad = (rx * Math.PI) / 180;
  const ryRad = (ry * Math.PI) / 180;
  const rzRad = (rz * Math.PI) / 180;
  
  // Precompute sin and cos values
  const cosX = Math.cos(rxRad);
  const sinX = Math.sin(rxRad);
  const cosY = Math.cos(ryRad);
  const sinY = Math.sin(ryRad);
  const cosZ = Math.cos(rzRad);
  const sinZ = Math.sin(rzRad);
  
  return points.map(point => {
    let { x, y, z } = point;
    
    // Rotate around X axis
    if (rx !== 0) {
      const y1 = y * cosX - z * sinX;
      const z1 = y * sinX + z * cosX;
      y = y1;
      z = z1;
    }
    
    // Rotate around Y axis
    if (ry !== 0) {
      const x1 = x * cosY + z * sinY;
      const z1 = -x * sinY + z * cosY;
      x = x1;
      z = z1;
    }
    
    // Rotate around Z axis
    if (rz !== 0) {
      const x1 = x * cosZ - y * sinZ;
      const y1 = x * sinZ + y * cosZ;
      x = x1;
      y = y1;
    }
    
    return { x, y, z };
  });
}

/**
 * Calculate distance between two 3D points
 */
function calculateDistance(point1, point2) {
  const dx = point2.x - point1.x;
  const dy = point2.y - point1.y;
  const dz = point2.z - point1.z;
  return Math.sqrt(dx * dx + dy * dy + dz * dz);
}

module.exports = {
  invertZ,
  shiftData,
  rotateData,
  calculateDistance
};
