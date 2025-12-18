import React, { useMemo, useRef, useCallback } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Box, Typography, Paper } from '@mui/material';
import ToolBar from '../ToolBar/ToolBar';
import * as THREE from 'three';

// Point Cloud Component - Memoized for performance
const PointCloud = React.memo(function PointCloud({ points, colorMode, statistics, color, pointSize, onPointClick, measurementMode, colorGamma = 1.0, colorPercentileLow = 0, colorPercentileHigh = 0 }) {
  const meshRef = useRef();

  // Handle click on point cloud
  const handleClick = useCallback((event) => {
    if (! measurementMode || !onPointClick || ! meshRef.current) return;
    
    event.stopPropagation();
    
    // Get the intersected point index
    const index = event.index;
    if (index !== undefined && points[index]) {
      onPointClick(points[index]);
    }
  }, [measurementMode, onPointClick, points]);

  // Create point cloud geometry and material
  const { geometry, material } = useMemo(() => {
    if (!points || points.length === 0) {
      console.log('[PointCloud] No points to render');
      return { geometry: null, material: null };
    }

    console.log(`[PointCloud] Creating geometry for ${points.length. toLocaleString()} points`);
    const startTime = performance.now();

    try {
      const geometry = new THREE.BufferGeometry();
      const positions = new Float32Array(points.length * 3);
      const colors = new Float32Array(points.length * 3);
      
      console.log(`[PointCloud] Allocated Float32Array buffers: ${((positions.length + colors.length) * 4 / 1024 / 1024).toFixed(2)} MB`);

    // Find Z range for color mapping with percentile cutoffs
    let zValues = points.map(p => p.z).sort((a, b) => a - b);
    
    // Apply percentile cutoffs
    const lowCutoffIndex = Math.floor(zValues.length * (colorPercentileLow / 100));
    const highCutoffIndex = Math.ceil(zValues.length * (1 - colorPercentileHigh / 100));
    
    const zMin = zValues[lowCutoffIndex] || zValues[0];
    const zMax = zValues[Math.min(highCutoffIndex, zValues.length - 1)] || zValues[zValues. length - 1];
    const zRange = zMax - zMin || 1;

      // Parse custom color if provided
      let customColor = null;
      if (color) {
        customColor = new THREE.Color(color);
      }

      // Populate buffers - optimized loop
      for (let i = 0; i < points.length; i++) {
        const point = points[i];
        const idx3 = i * 3;
        
        // Set positions
        positions[idx3] = point.x;
        positions[idx3 + 1] = point.y;
        positions[idx3 + 2] = point.z;

        // Set colors based on mode
        if (customColor) {
          // Use custom color for this file
          colors[idx3] = customColor.r;
          colors[idx3 + 1] = customColor.g;
          colors[idx3 + 2] = customColor.b;
        } else if (colorMode === 'height') {
          // Color based on Z value (elevation) with gamma correction
          let t = Math.max(0, Math.min(1, (point.z - zMin) / zRange));
          
          // Apply gamma/power curve
          t = Math.pow(t, colorGamma);
          
          // Blue (low) to Red (high) gradient
          colors[idx3] = t; // R
          colors[idx3 + 1] = 1 - Math.abs(t - 0.5) * 2; // G
          colors[idx3 + 2] = 1 - t; // B
        } else {
          // Uniform color
          colors[idx3] = 0.5;
          colors[idx3 + 1] = 0.8;
          colors[idx3 + 2] = 1.0;
        }
      }
      
      console.log(`[PointCloud] Populated ${points.length.toLocaleString()} positions and colors`);

      // Set attributes on geometry
      geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
      geometry.setAttribute('color', new THREE. BufferAttribute(colors, 3));
      
      console.log(`[PointCloud] Computing bounding sphere... `);
      geometry.computeBoundingSphere();

      const material = new THREE.PointsMaterial({
        size: pointSize || 0.1,
        vertexColors: true,
        sizeAttenuation: true,
        transparent: false,
        opacity: 1.0,
      });

      const endTime = performance.now();
      const duration = (endTime - startTime).toFixed(2);
      console.log(`[PointCloud] ✓ Geometry created successfully! `);
      console.log(`[PointCloud]   - Points: ${points.length.toLocaleString()}`);
      console.log(`[PointCloud]   - Time: ${duration}ms`);
      console.log(`[PointCloud]   - Buffer sizes: positions=${positions.length. toLocaleString()}, colors=${colors.length.toLocaleString()}`);
      console.log(`[PointCloud]   - Memory estimate: ~${((positions.length * 4 + colors.length * 4) / 1024 / 1024).toFixed(2)} MB`);
      
      // Warn if this is a large point cloud
      if (points.length > 1000000) {
        console.warn(`[PointCloud] ⚠️  Large point cloud (${(points.length / 1000000).toFixed(1)}M points) may impact performance`);
      }

      return { geometry, material };
    } catch (error) {
      console.error('[PointCloud] ❌ Failed to create geometry:', error);
      console.error(`[PointCloud] Error details: ${error.message}`);
      return { geometry: null, material: null };
    }
  }, [points, colorMode, color, pointSize, colorGamma, colorPercentileLow, colorPercentileHigh]);

  // Cleanup effect to dispose geometry and material when component unmounts
  React.useEffect(() => {
    return () => {
      if (geometry) {
        console.log('[PointCloud] Disposing geometry');
        geometry.dispose();
      }
      if (material) {
        console.log('[PointCloud] Disposing material');
        material.dispose();
      }
    };
  }, [geometry, material]);

  if (!geometry || !material) return null;

  return (
    <points 
      ref={meshRef}
      geometry={geometry} 
      material={material}
      onClick={handleClick}
      frustumCulled={true}
    />
  );
});

// Measurement Line Component
function MeasurementLine({ points }) {
  const lineGeometry = useMemo(() => {
    if (!points || points.length < 2) return null;
    
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      points[0].x, points[0].y, points[0].z,
      points[1].x, points[1]. y, points[1].z
    ]);
    geometry.setAttribute('position', new THREE. BufferAttribute(positions, 3));
    return geometry;
  }, [points]);

  if (!lineGeometry) return null;

  return (
    <line geometry={lineGeometry}>
      <lineBasicMaterial color="#ff0000" linewidth={2} />
    </line>
  );
}

// Selected Points Markers
function PointMarkers({ points }) {
  return (
    <>
      {points.map((point, index) => (
        <mesh key={index} position={[point.x, point.y, point.z]}>
          <sphereGeometry args={[0.5, 16, 16]} />
          <meshBasicMaterial color="#ff0000" />
        </mesh>
      ))}
    </>
  );
}

// Grid Helper
function Grid({ statistics, visible }) {
  if (!statistics || ! visible) return null;

  const size = Math.max(
    statistics.maxX - statistics.minX,
    statistics.maxY - statistics.minY
  );

  const centerX = (statistics.maxX + statistics.minX) / 2;
  const centerY = (statistics.maxY + statistics.minY) / 2;
  const centerZ = statistics.minZ;

  return (
    <group position={[centerX, centerY, centerZ]}>
      <gridHelper args={[size * 1.2, 20, '#444', '#222']} rotation={[Math.PI / 2, 0, 0]} />
    </group>
  );
}

// Axis Helper
function AxisHelper({ statistics, visible }) {
  if (!statistics || !visible) return null;

  const size = Math.max(
    statistics.maxX - statistics.minX,
    statistics.maxY - statistics.minY,
    statistics.maxZ - statistics.minZ
  );

  const centerX = (statistics.maxX + statistics.minX) / 2;
  const centerY = (statistics.maxY + statistics.minY) / 2;
  const centerZ = (statistics.maxZ + statistics.minZ) / 2;

  return (
    <group position={[centerX, centerY, centerZ]}>
      <axesHelper args={[size * 0.6]} />
    </group>
  );
}

// Filter Box Component - Visualizes filter boundaries
function FilterBox({ filterRanges, statistics, filteringActive }) {
  if (!filterRanges || !statistics || !filteringActive) return null;
  
  const width = filterRanges.xMax - filterRanges.xMin;
  const height = filterRanges.yMax - filterRanges.yMin;
  const depth = filterRanges. zMax - filterRanges. zMin;
  
  const centerX = (filterRanges.xMax + filterRanges.xMin) / 2;
  const centerY = (filterRanges.yMax + filterRanges.yMin) / 2;
  const centerZ = (filterRanges.zMax + filterRanges.zMin) / 2;
  
  return (
    <mesh position={[centerX, centerY, centerZ]}>
      <boxGeometry args={[width, height, depth]} />
      <meshBasicMaterial 
        color="#00ff00" 
        transparent 
        opacity={0.1} 
        wireframe={false}
        side={THREE.DoubleSide}
      />
      {/* Add wireframe overlay for better visibility */}
      <lineSegments>
        <edgesGeometry args={[new THREE.BoxGeometry(width, height, depth)]} />
        <lineBasicMaterial color="#00ff00" opacity={0.6} transparent />
      </lineSegments>
    </mesh>
  );
}

function CenterPanel({ 
  points, 
  statistics, 
  onPointSelect, 
  measurementMode, 
  toggleMeasurementMode,
  selectedPoints,
  colorMode,
  setColorMode,
  visibleFiles,
  pointSize,
  colorGamma = 1.0,
  colorPercentileLow = 0,
  colorPercentileHigh = 0,
  filterRanges,
  filteringActive
}) {
  const [cameraReset, setCameraReset] = React.useState(0);
  const [showGrid, setShowGrid] = React.useState(true);
  const [showAxis, setShowAxis] = React.useState(true);
  
  // Log render information
  React.useEffect(() => {
    console.log('\n=== CenterPanel Render Update ===');
    if (visibleFiles && visibleFiles.length > 0) {
      console.log(`Visible files: ${visibleFiles. length}`);
      visibleFiles.forEach((file, idx) => {
        console.log(`  [${idx}] ${file.name}:  ${file.data.points.length. toLocaleString()} points`);
      });
      const totalPoints = visibleFiles.reduce((sum, f) => sum + f.data.points.length, 0);
      console.log(`Total points across all files: ${totalPoints.toLocaleString()}`);
    } else if (points) {
      console.log(`Single point cloud: ${points.length.toLocaleString()} points`);
    } else {
      console.log('No point data to render');
    }
    console.log('=================================\n');
  }, [points, visibleFiles]);
  
  // Define distinct colors for each file
  const fileColors = ['#2196f3', '#f50057', '#4caf50', '#ff9800', '#9c27b0', '#00bcd4'];
  
  // Calculate combined statistics for all visible files
  const combinedStatistics = useMemo(() => {
    if (!visibleFiles || visibleFiles.length === 0) return statistics;
    
    let minX = Infinity, maxX = -Infinity;
    let minY = Infinity, maxY = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;
    let totalPoints = 0;
    
    visibleFiles.forEach(file => {
      const stats = file.data.statistics;
      minX = Math. min(minX, stats.minX);
      maxX = Math.max(maxX, stats. maxX);
      minY = Math.min(minY, stats.minY);
      maxY = Math.max(maxY, stats.maxY);
      minZ = Math.min(minZ, stats.minZ);
      maxZ = Math.max(maxZ, stats.maxZ);
      totalPoints += file.data.totalPoints;
    });
    
    return { count: totalPoints, minX, maxX, minY, maxY, minZ, maxZ };
  }, [visibleFiles, statistics]);

  // Calculate camera position based on point cloud bounds
  const cameraPosition = useMemo(() => {
    const stats = combinedStatistics || statistics;
    if (!stats) return [10, 10, 10];

    const rangeX = stats.maxX - stats.minX;
    const rangeY = stats.maxY - stats.minY;
    const rangeZ = stats.maxZ - stats. minZ;
    const maxRange = Math.max(rangeX, rangeY, rangeZ);

    // Calculate center of the point cloud
    const centerX = (stats.maxX + stats.minX) / 2;
    const centerY = (stats.maxY + stats.minY) / 2;
    const centerZ = (stats.maxZ + stats.minZ) / 2;

    // Position camera at a distance to see the entire cloud
    const distance = maxRange * 1.5;
    
    // Position camera from the side with Z-axis pointing up
    // Camera looks from negative Y direction towards center
    return [
      centerX,
      centerY - distance,
      centerZ + distance * 0.5
    ];
  }, [combinedStatistics, statistics]);

  const targetPosition = useMemo(() => {
    const stats = combinedStatistics || statistics;
    if (! stats) return [0, 0, 0];

    return [
      (stats.maxX + stats.minX) / 2,
      (stats.maxY + stats. minY) / 2,
      (stats.maxZ + stats.minZ) / 2
    ];
  }, [combinedStatistics, statistics]);

  const handleResetView = () => {
    setCameraReset(prev => prev + 1);
  };

  const toggleGrid = () => {
    setShowGrid(prev => !prev);
  };

  const toggleAxis = () => {
    setShowAxis(prev => !prev);
  };

  return (
    <Box sx={{ width: '100%', height: '100%', position: 'relative', bgcolor: '#000' }}>
      {/* Toolbar */}
      <ToolBar
        measurementMode={measurementMode}
        toggleMeasurementMode={toggleMeasurementMode}
        colorMode={colorMode}
        setColorMode={setColorMode}
        onResetView={handleResetView}
        showGrid={showGrid}
        toggleGrid={toggleGrid}
        showAxis={showAxis}
        toggleAxis={toggleAxis}
      />

      {/* Info Overlay */}
      {(statistics || combinedStatistics) && (
        <Paper
          sx={{
            position: 'absolute',
            top: 70,
            left: 10,
            p: 1.5,
            bgcolor: 'rgba(30, 41, 59, 0.9)',
            backdropFilter: 'blur(5px)',
            zIndex: 10
          }}
        >
          {visibleFiles && visibleFiles.length > 0 ?  (
            <>
              <Typography variant="caption" display="block" fontWeight="bold">
                Visible Files:  {visibleFiles.length}
              </Typography>
              {visibleFiles.map((file, index) => (
                <Typography 
                  key={file.id} 
                  variant="caption" 
                  display="block"
                  sx={{ color: fileColors[index % fileColors.length] }}
                >
                  • {file.name}: {file. points.toLocaleString()} pts
                </Typography>
              ))}
              <Typography variant="caption" display="block" sx={{ mt: 1 }}>
                Range X: {combinedStatistics.minX.toFixed(2)} to {combinedStatistics.maxX.toFixed(2)}
              </Typography>
              <Typography variant="caption" display="block">
                Range Y: {combinedStatistics.minY.toFixed(2)} to {combinedStatistics.maxY.toFixed(2)}
              </Typography>
              <Typography variant="caption" display="block">
                Range Z:  {combinedStatistics.minZ.toFixed(2)} to {combinedStatistics.maxZ. toFixed(2)}
              </Typography>
            </>
          ) : (
            <>
              <Typography variant="caption" display="block">
                Points: {points?. length. toLocaleString() || 0}
              </Typography>
              <Typography variant="caption" display="block">
                Range X: {statistics. minX.toFixed(2)} to {statistics.maxX.toFixed(2)}
              </Typography>
              <Typography variant="caption" display="block">
                Range Y: {statistics.minY. toFixed(2)} to {statistics.maxY.toFixed(2)}
              </Typography>
              <Typography variant="caption" display="block">
                Range Z: {statistics.minZ.toFixed(2)} to {statistics.maxZ.toFixed(2)}
              </Typography>
            </>
          )}
        </Paper>
      )}

      {/* 3D Canvas */}
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
          stencil: false,
          depth: true,
        }}
        dpr={window.devicePixelRatio || 1}
        performance={{ min: 0.5 }}
        frameloop="demand"
      >
        <PerspectiveCamera 
          makeDefault 
          position={cameraPosition}
          up={[0, 0, 1]}
          key={cameraReset}
        />
        <OrbitControls 
          target={targetPosition}
          enableDamping={true}
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
          panSpeed={0.8}
          minDistance={1}
          maxDistance={10000}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2}
          screenSpacePanning={false}
          makeDefault
        />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={0.5} />
        
        {/* Grid and Axis helpers with visibility toggle */}
        <Grid statistics={combinedStatistics || statistics} visible={showGrid} />
        <AxisHelper statistics={combinedStatistics || statistics} visible={showAxis} />
        
        {/* Filter Box Visualization */}
        <FilterBox filterRanges={filterRanges} statistics={statistics} filteringActive={filteringActive} />
        
        {/* Render multiple visible files */}
        {visibleFiles && visibleFiles.length > 0 ?  (
          visibleFiles.map((file, index) => (
            <PointCloud
              key={file.id}
              points={file.data. points}
              colorMode={visibleFiles.length > 1 ? 'uniform' : colorMode}
              statistics={file.data.statistics}
              color={visibleFiles.length > 1 ? fileColors[index % fileColors.length] : null}
              pointSize={pointSize}
              onPointClick={onPointSelect}
              measurementMode={measurementMode}
              colorGamma={colorGamma}
              colorPercentileLow={colorPercentileLow}
              colorPercentileHigh={colorPercentileHigh}
            />
          ))
        ) : (
          /* Fallback to single point cloud */
          points && points.length > 0 && (
            <PointCloud
              points={points}
              colorMode={colorMode}
              statistics={statistics}
              pointSize={pointSize}
              onPointClick={onPointSelect}
              measurementMode={measurementMode}
              colorGamma={colorGamma}
              colorPercentileLow={colorPercentileLow}
              colorPercentileHigh={colorPercentileHigh}
            />
          )
        )}
        
        {selectedPoints && selectedPoints.length > 0 && (
          <>
            <PointMarkers points={selectedPoints} />
            {selectedPoints.length === 2 && (
              <MeasurementLine points={selectedPoints} />
            )}
          </>
        )}
      </Canvas>

      {/* Measurement Instructions */}
      {measurementMode && (
        <Paper
          sx={{
            position:  'absolute',
            bottom: 20,
            left:  '50%',
            transform: 'translateX(-50%)',
            p: 2,
            bgcolor: 'rgba(30, 41, 59, 0.9)',
            backdropFilter: 'blur(5px)',
            zIndex: 10
          }}
        >
          <Typography variant="body2">
            {selectedPoints.length === 0 
              ? 'Click on a point in the cloud to start measurement'
              : selectedPoints.length === 1
              ? 'Click on a second point to measure distance'
              : 'Measurement complete. Click measure button again to exit. '}
          </Typography>
        </Paper>
      )}

      {/* Instructions */}
      {! points && (
        <Paper
          sx={{
            position: 'absolute',
            top: '50%',
            left: '50%',
            transform: 'translate(-50%, -50%)',
            p: 3,
            textAlign: 'center'
          }}
        >
          <Typography variant="h6" gutterBottom>
            No Data Loaded
          </Typography>
          <Typography variant="body2" color="text.secondary">
            Upload a point cloud file to visualize
          </Typography>
        </Paper>
      )}
    </Box>
  );
}

export default CenterPanel;
