/**
 * Advanced sampling algorithms for point cloud downsampling
 * @module sampling
 */

// Constants for importance sampling
const IMPORTANCE_EPSILON = 0.001; // Small value to avoid zero weights
const MAX_SAMPLING_ATTEMPTS_MULTIPLIER = 20; // Maximum attempts = targetCount * this value

/**
 * Importance Sampling Algorithm
 * Samples points based on local z-variation (importance score).
 * Points in areas with high z-variation are more likely to be selected.
 * 
 * @param {Array<{x: number, y: number, z: number}>} points - Input point cloud
 * @param {number} targetCount - Desired number of points after sampling
 * @param {Object} options - Sampling options
 * @param {number} [options.k=12] - Number of neighbors to consider for importance calculation
 * @param {number} [options.gridResolution=50] - Grid resolution for spatial indexing
 * @param {number} [options.importanceExponent=2.0] - Exponent to emphasize high-importance areas
 * @returns {Array<{x: number, y: number, z: number}>} - Sampled points
 */
function importanceSampling(points, targetCount, options = {}) {
  const startTime = Date.now();
  const {
    k = 12,
    gridResolution = 50,
    importanceExponent = 2.0
  } = options;
  
  console.log(`[ImportanceSampling] Starting with ${points.length.toLocaleString()} points, target: ${targetCount.toLocaleString()}`);
  
  if (points.length <= targetCount) {
    console.log(`[ImportanceSampling] No sampling needed`);
    return points;
  }
  
  // Step 1: Calculate bounding box
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  
  // Step 2: Build spatial grid for fast neighbor lookup
  const cellSizeX = rangeX / gridResolution;
  const cellSizeY = rangeY / gridResolution;
  const grid = new Map();
  
  points.forEach((point, index) => {
    const cellX = Math.floor((point.x - minX) / cellSizeX);
    const cellY = Math.floor((point.y - minY) / cellSizeY);
    const cellKey = `${cellX},${cellY}`;
    
    if (!grid.has(cellKey)) {
      grid.set(cellKey, []);
    }
    grid.get(cellKey).push({ point, index });
  });
  
  console.log(`[ImportanceSampling] Built spatial grid with ${grid.size} cells`);
  
  // Step 3: Calculate importance score for each point
  const importanceScores = new Array(points.length).fill(0);
  
  for (let i = 0; i < points.length; i++) {
    const point = points[i];
    const cellX = Math.floor((point.x - minX) / cellSizeX);
    const cellY = Math.floor((point.y - minY) / cellSizeY);
    
    // Get neighbors from current cell and adjacent cells
    const neighbors = [];
    for (let dx = -1; dx <= 1; dx++) {
      for (let dy = -1; dy <= 1; dy++) {
        const neighborKey = `${cellX + dx},${cellY + dy}`;
        if (grid.has(neighborKey)) {
          neighbors.push(...grid.get(neighborKey));
        }
      }
    }
    
    // Calculate distances and get k-nearest neighbors
    const distances = neighbors.map(({ point: p2, index: idx }) => ({
      index: idx,
      distance: Math.sqrt(
        Math.pow(point.x - p2.x, 2) + 
        Math.pow(point.y - p2.y, 2) + 
        Math.pow(point.z - p2.z, 2)
      ),
      z: p2.z
    }));
    
    distances.sort((a, b) => a.distance - b.distance);
    const kNearest = distances.slice(1, k + 1); // Skip self (distance 0)
    
    if (kNearest.length > 1) {
      // Calculate z-variation (standard deviation) among neighbors
      const zValues = kNearest.map(n => n.z);
      const meanZ = zValues.reduce((sum, z) => sum + z, 0) / zValues.length;
      const variance = zValues.reduce((sum, z) => sum + Math.pow(z - meanZ, 2), 0) / zValues.length;
      const stdDev = Math.sqrt(variance);
      
      importanceScores[i] = stdDev;
    }
  }
  
  // Step 4: Normalize importance scores to [0, 1]
  const maxScore = Math.max(...importanceScores);
  const minScore = Math.min(...importanceScores);
  const scoreRange = maxScore - minScore;
  
  if (scoreRange > 0) {
    for (let i = 0; i < importanceScores.length; i++) {
      importanceScores[i] = (importanceScores[i] - minScore) / scoreRange;
    }
  }
  
  console.log(`[ImportanceSampling] Calculated importance scores (min: ${minScore.toFixed(4)}, max: ${maxScore.toFixed(4)})`);
  
  // Step 5: Weighted random sampling based on importance scores
  // Apply exponent to emphasize high-importance areas
  // Add small epsilon to avoid zero weights
  const weights = importanceScores.map(score => Math.pow(score + IMPORTANCE_EPSILON, importanceExponent));
  const totalWeight = weights.reduce((sum, w) => sum + w, 0);
  
  // Create array of indices with their weights
  const indexWeightPairs = weights.map((weight, index) => ({ index, weight }));
  
  // Sort by weight descending for better sampling
  indexWeightPairs.sort((a, b) => b.weight - a.weight);
  
  // Normalize weights to probabilities
  const probabilities = weights.map(w => w / totalWeight);
  
  // Cumulative probability distribution
  const cumulativeProb = [];
  let cumSum = 0;
  for (const prob of probabilities) {
    cumSum += prob;
    cumulativeProb.push(cumSum);
  }
  
  // Sample points using weighted random selection with replacement prevention
  const sampledIndices = new Set();
  const sampledPoints = [];
  
  // If target is close to total points, use a simpler approach
  if (targetCount >= points.length * 0.8) {
    // Just return most important points
    for (let i = 0; i < Math.min(targetCount, indexWeightPairs.length); i++) {
      sampledPoints.push(points[indexWeightPairs[i].index]);
    }
  } else {
    // Weighted random sampling
    let attempts = 0;
    const maxAttempts = targetCount * MAX_SAMPLING_ATTEMPTS_MULTIPLIER;
    
    while (sampledPoints.length < targetCount && attempts < maxAttempts) {
      attempts++;
      const rand = Math.random();
      
      // Binary search for the index
      let left = 0;
      let right = cumulativeProb.length - 1;
      while (left < right) {
        const mid = Math.floor((left + right) / 2);
        if (cumulativeProb[mid] < rand) {
          left = mid + 1;
        } else {
          right = mid;
        }
      }
      
      const selectedIndex = left;
      if (!sampledIndices.has(selectedIndex)) {
        sampledIndices.add(selectedIndex);
        sampledPoints.push(points[selectedIndex]);
      }
    }
    
    // If we still don't have enough points, add highest importance ones
    if (sampledPoints.length < targetCount) {
      for (const { index } of indexWeightPairs) {
        if (!sampledIndices.has(index)) {
          sampledIndices.add(index);
          sampledPoints.push(points[index]);
          if (sampledPoints.length >= targetCount) break;
        }
      }
    }
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[ImportanceSampling] Completed in ${elapsed}ms, sampled ${sampledPoints.length.toLocaleString()} points`);
  
  return sampledPoints;
}

/**
 * Poisson Disk Sampling Algorithm
 * Uses Bridson's algorithm to ensure minimum distance between selected points.
 * Results in evenly distributed points with natural spacing.
 * 
 * @param {Array<{x: number, y: number, z: number}>} points - Input point cloud
 * @param {number} targetCount - Desired number of points after sampling
 * @param {Object} options - Sampling options
 * @param {number} [options.maxAttempts=30] - Maximum attempts per active point
 * @param {number} [options.distanceMultiplier=1.0] - Multiplier for minimum distance (1.0-2.0)
 * @returns {Array<{x: number, y: number, z: number}>} - Sampled points
 */
function poissonDiskSampling(points, targetCount, options = {}) {
  const startTime = Date.now();
  const {
    maxAttempts = 30,
    distanceMultiplier = 1.0
  } = options;
  
  console.log(`[PoissonDiskSampling] Starting with ${points.length.toLocaleString()} points, target: ${targetCount.toLocaleString()}`);
  
  if (points.length <= targetCount) {
    console.log(`[PoissonDiskSampling] No sampling needed`);
    return points;
  }
  
  // Step 1: Calculate bounding box and area
  let minX = Infinity, maxX = -Infinity;
  let minY = Infinity, maxY = -Infinity;
  
  for (const p of points) {
    minX = Math.min(minX, p.x);
    maxX = Math.max(maxX, p.x);
    minY = Math.min(minY, p.y);
    maxY = Math.max(maxY, p.y);
  }
  
  const rangeX = maxX - minX;
  const rangeY = maxY - minY;
  const area = rangeX * rangeY;
  
  // Step 2: Calculate minimum distance based on target density
  // Area per point = totalArea / targetCount
  // Minimum distance = sqrt(area_per_point / π) * distanceMultiplier
  const minDistance = Math.sqrt(area / (targetCount * Math.PI)) * distanceMultiplier;
  const cellSize = minDistance / Math.sqrt(2);
  
  console.log(`[PoissonDiskSampling] Min distance: ${minDistance.toFixed(4)}, Cell size: ${cellSize.toFixed(4)}`);
  
  // Step 3: Build spatial grid
  const gridWidth = Math.ceil(rangeX / cellSize);
  const gridHeight = Math.ceil(rangeY / cellSize);
  const grid = new Array(gridWidth * gridHeight).fill(null);
  
  const getGridIndex = (x, y) => {
    const cellX = Math.floor((x - minX) / cellSize);
    const cellY = Math.floor((y - minY) / cellSize);
    if (cellX < 0 || cellX >= gridWidth || cellY < 0 || cellY >= gridHeight) {
      return -1;
    }
    return cellY * gridWidth + cellX;
  };
  
  // Step 4: Start with a random point from the dataset
  const startIdx = Math.floor(Math.random() * points.length);
  const firstPoint = points[startIdx];
  const sampledPoints = [firstPoint];
  const activeList = [0]; // Indices into sampledPoints
  
  const gridIdx = getGridIndex(firstPoint.x, firstPoint.y);
  if (gridIdx >= 0) {
    grid[gridIdx] = 0; // Store index in sampledPoints
  }
  
  // Helper function to check if a point is valid (far enough from existing points)
  const isValidPoint = (x, y) => {
    const cellX = Math.floor((x - minX) / cellSize);
    const cellY = Math.floor((y - minY) / cellSize);
    
    // Check neighboring cells
    for (let dy = -2; dy <= 2; dy++) {
      for (let dx = -2; dx <= 2; dx++) {
        const nx = cellX + dx;
        const ny = cellY + dy;
        
        if (nx < 0 || nx >= gridWidth || ny < 0 || ny >= gridHeight) continue;
        
        const neighborIdx = ny * gridWidth + nx;
        const pointIdx = grid[neighborIdx];
        
        if (pointIdx !== null) {
          const neighbor = sampledPoints[pointIdx];
          const dist = Math.sqrt(
            Math.pow(x - neighbor.x, 2) + 
            Math.pow(y - neighbor.y, 2)
          );
          
          if (dist < minDistance) {
            return false;
          }
        }
      }
    }
    
    return true;
  };
  
  // Helper function to find nearest point in dataset to target coordinates
  // Uses spatial grid to limit search to nearby cells for efficiency
  const findNearestPoint = (targetX, targetY, searchRadius) => {
    let nearest = null;
    let minDist = Infinity;
    
    const centerCellX = Math.floor((targetX - minX) / cellSize);
    const centerCellY = Math.floor((targetY - minY) / cellSize);
    const cellRadius = Math.ceil(searchRadius / cellSize);
    
    // Build temporary spatial grid for point lookup if not exists
    if (!pointsGrid) {
      pointsGrid = new Array(gridWidth * gridHeight).fill(null).map(() => []);
      points.forEach(point => {
        const cellX = Math.floor((point.x - minX) / cellSize);
        const cellY = Math.floor((point.y - minY) / cellSize);
        if (cellX >= 0 && cellX < gridWidth && cellY >= 0 && cellY < gridHeight) {
          pointsGrid[cellY * gridWidth + cellX].push(point);
        }
      });
    }
    
    // Search only nearby cells within searchRadius
    for (let dy = -cellRadius; dy <= cellRadius; dy++) {
      for (let dx = -cellRadius; dx <= cellRadius; dx++) {
        const cellX = centerCellX + dx;
        const cellY = centerCellY + dy;
        
        if (cellX < 0 || cellX >= gridWidth || cellY < 0 || cellY >= gridHeight) continue;
        
        const cellIndex = cellY * gridWidth + cellX;
        const cellPoints = pointsGrid[cellIndex];
        
        for (const point of cellPoints) {
          const dist = Math.sqrt(
            Math.pow(point.x - targetX, 2) + 
            Math.pow(point.y - targetY, 2)
          );
          
          if (dist < minDist) {
            minDist = dist;
            nearest = point;
          }
        }
      }
    }
    
    return nearest;
  };
  
  // Initialize points grid for efficient nearest point lookup
  let pointsGrid = null;
  
  // Step 5: Bridson's algorithm - generate points around active points
  while (activeList.length > 0 && sampledPoints.length < targetCount) {
    // Pick random active point
    const activeIdx = Math.floor(Math.random() * activeList.length);
    const pointIdx = activeList[activeIdx];
    const activePoint = sampledPoints[pointIdx];
    
    let found = false;
    
    // Try to generate new points around this active point
    for (let attempt = 0; attempt < maxAttempts; attempt++) {
      // Generate point at distance [minDistance, 2*minDistance] from active point
      const angle = Math.random() * 2 * Math.PI;
      const radius = minDistance * (1 + Math.random());
      const targetX = activePoint.x + radius * Math.cos(angle);
      const targetY = activePoint.y + radius * Math.sin(angle);
      
      // Check bounds
      if (targetX < minX || targetX > maxX || targetY < minY || targetY > maxY) {
        continue;
      }
      
      // Check if position is valid
      if (isValidPoint(targetX, targetY)) {
        // Find nearest actual point from dataset
        const nearestPoint = findNearestPoint(targetX, targetY, minDistance);
        
        if (nearestPoint && isValidPoint(nearestPoint.x, nearestPoint.y)) {
          const newIdx = sampledPoints.length;
          sampledPoints.push(nearestPoint);
          activeList.push(newIdx);
          
          const gridIdx = getGridIndex(nearestPoint.x, nearestPoint.y);
          if (gridIdx >= 0) {
            grid[gridIdx] = newIdx;
          }
          
          found = true;
          break;
        }
      }
    }
    
    // If no valid point found, remove from active list
    if (!found) {
      activeList.splice(activeIdx, 1);
    }
  }
  
  const elapsed = Date.now() - startTime;
  console.log(`[PoissonDiskSampling] Completed in ${elapsed}ms, sampled ${sampledPoints.length.toLocaleString()} points`);
  
  return sampledPoints;
}

module.exports = {
  importanceSampling,
  poissonDiskSampling
};
