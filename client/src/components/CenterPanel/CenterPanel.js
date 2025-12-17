import React, { useRef, useMemo, useEffect } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Box, Typography, Paper } from '@mui/material';
import ToolBar from '../ToolBar/ToolBar';
import * as THREE from 'three';

// Point Cloud Component
function PointCloud({ points, colorMode, onPointClick, measurementMode, statistics }) {
  const pointsRef = useRef();
  const raycaster = useRef(new THREE.Raycaster());
  const mouse = useRef(new THREE.Vector2());

  // Create point cloud geometry and material
  const { geometry, material } = useMemo(() => {
    if (!points || points.length === 0) return { geometry: null, material: null };

    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array(points.length * 3);
    const colors = new Float32Array(points.length * 3);

    // Find Z range for color mapping
    const zMin = statistics?.minZ || Math.min(...points.map(p => p.z));
    const zMax = statistics?.maxZ || Math.max(...points.map(p => p.z));
    const zRange = zMax - zMin || 1;

    points.forEach((point, i) => {
      positions[i * 3] = point.x;
      positions[i * 3 + 1] = point.y;
      positions[i * 3 + 2] = point.z;

      // Color based on mode
      if (colorMode === 'height') {
        // Color based on Z value (elevation)
        const t = (point.z - zMin) / zRange;
        // Blue (low) to Red (high) gradient
        colors[i * 3] = t; // R
        colors[i * 3 + 1] = 1 - Math.abs(t - 0.5) * 2; // G
        colors[i * 3 + 2] = 1 - t; // B
      } else {
        // Uniform color
        colors[i * 3] = 0.5;
        colors[i * 3 + 1] = 0.8;
        colors[i * 3 + 2] = 1.0;
      }
    });

    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
    geometry.computeBoundingSphere();

    const material = new THREE.PointsMaterial({
      size: 0.1,
      vertexColors: true,
      sizeAttenuation: true,
    });

    return { geometry, material };
  }, [points, colorMode, statistics]);

  // Handle click for measurement
  const handleClick = (event) => {
    if (!measurementMode || !pointsRef.current) return;

    const canvas = event.target;
    const rect = canvas.getBoundingClientRect();
    mouse.current.x = ((event.clientX - rect.left) / rect.width) * 2 - 1;
    mouse.current.y = -((event.clientY - rect.top) / rect.height) * 2 + 1;

    raycaster.current.setFromCamera(mouse.current, event.camera);
    const intersects = raycaster.current.intersectObject(pointsRef.current);

    if (intersects.length > 0) {
      const point = intersects[0].point;
      onPointClick({ x: point.x, y: point.y, z: point.z });
    }
  };

  if (!geometry || !material) return null;

  return (
    <points ref={pointsRef} geometry={geometry} material={material} onClick={handleClick} />
  );
}

// Measurement Line Component
function MeasurementLine({ points }) {
  if (!points || points.length < 2) return null;

  const lineGeometry = useMemo(() => {
    const geometry = new THREE.BufferGeometry();
    const positions = new Float32Array([
      points[0].x, points[0].y, points[0].z,
      points[1].x, points[1].y, points[1].z
    ]);
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geometry;
  }, [points]);

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
function Grid({ statistics }) {
  if (!statistics) return null;

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

function CenterPanel({ 
  points, 
  statistics, 
  onPointSelect, 
  measurementMode, 
  toggleMeasurementMode,
  selectedPoints,
  colorMode,
  setColorMode
}) {
  const [cameraReset, setCameraReset] = React.useState(0);

  // Calculate camera position based on point cloud bounds
  const cameraPosition = useMemo(() => {
    if (!statistics) return [10, 10, 10];

    const rangeX = statistics.maxX - statistics.minX;
    const rangeY = statistics.maxY - statistics.minY;
    const rangeZ = statistics.maxZ - statistics.minZ;
    const maxRange = Math.max(rangeX, rangeY, rangeZ);

    const distance = maxRange * 2;
    return [distance, distance, distance];
  }, [statistics]);

  const targetPosition = useMemo(() => {
    if (!statistics) return [0, 0, 0];

    return [
      (statistics.maxX + statistics.minX) / 2,
      (statistics.maxY + statistics.minY) / 2,
      (statistics.maxZ + statistics.minZ) / 2
    ];
  }, [statistics]);

  const handleResetView = () => {
    setCameraReset(prev => prev + 1);
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
      />

      {/* Info Overlay */}
      {statistics && (
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
          <Typography variant="caption" display="block">
            Points: {points?.length.toLocaleString() || 0}
          </Typography>
          <Typography variant="caption" display="block">
            Range X: {statistics.minX.toFixed(2)} to {statistics.maxX.toFixed(2)}
          </Typography>
          <Typography variant="caption" display="block">
            Range Y: {statistics.minY.toFixed(2)} to {statistics.maxY.toFixed(2)}
          </Typography>
          <Typography variant="caption" display="block">
            Range Z: {statistics.minZ.toFixed(2)} to {statistics.maxZ.toFixed(2)}
          </Typography>
        </Paper>
      )}

      {/* 3D Canvas */}
      <Canvas>
        <PerspectiveCamera 
          makeDefault 
          position={cameraPosition}
          key={cameraReset}
        />
        <OrbitControls 
          target={targetPosition}
          enableDamping
          dampingFactor={0.05}
        />
        
        <ambientLight intensity={0.5} />
        <directionalLight position={[10, 10, 5]} intensity={0.5} />
        
        {statistics && <Grid statistics={statistics} />}
        
        {points && points.length > 0 && (
          <PointCloud
            points={points}
            colorMode={colorMode}
            onPointClick={onPointSelect}
            measurementMode={measurementMode}
            statistics={statistics}
          />
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

      {/* Instructions */}
      {!points && (
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
