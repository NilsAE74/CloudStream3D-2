import React, { useMemo, useRef, useEffect, useState } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { Box, Typography, Paper } from '@mui/material';
import * as THREE from 'three';

// Animated Sine Wave Surface Component
function SineWaveSurface({ time }) {
  const meshRef = useRef();
  
  // Create the sine wave geometry
  const geometry = useMemo(() => {
    const size = 20;
    const segments = 100;
    const geometry = new THREE.PlaneGeometry(size, size, segments, segments);
    
    return geometry;
  }, []);

  // Update the geometry based on time for animation
  useFrame(() => {
    if (!meshRef.current) return;
    if (!meshRef.current.geometry.attributes.position) return;
    if (!meshRef.current.geometry.attributes.color) return;
    
    const positions = meshRef.current.geometry.attributes.position.array;
    const colors = meshRef.current.geometry.attributes.color.array;
    
    const size = 20;
    const segments = 100;
    const step = size / segments;
    
    let minZ = Infinity;
    let maxZ = -Infinity;
    
    // First pass: calculate all z values to find min/max
    const zValues = [];
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= segments; j++) {
        const x = -size / 2 + j * step;
        const y = -size / 2 + i * step;
        const z = Math.sin(x * 0.5 + time * 0.5) * Math.cos(y * 0.5 + time * 0.3) * 2;
        zValues.push(z);
        minZ = Math.min(minZ, z);
        maxZ = Math.max(maxZ, z);
      }
    }
    
    const zRange = maxZ - minZ || 1;
    
    // Second pass: set positions and colors
    let idx = 0;
    for (let i = 0; i <= segments; i++) {
      for (let j = 0; j <= segments; j++) {
        const z = zValues[idx];
        
        // Update position
        positions[idx * 3 + 2] = z;
        
        // Calculate color based on height
        const t = (z - minZ) / zRange;
        
        // Blue (low) to Green to Red (high) gradient
        colors[idx * 3] = t; // R
        colors[idx * 3 + 1] = Math.sin(t * Math.PI); // G (peaks in the middle)
        colors[idx * 3 + 2] = 1 - t; // B
        
        idx++;
      }
    }
    
    meshRef.current.geometry.attributes.position.needsUpdate = true;
    meshRef.current.geometry.attributes.color.needsUpdate = true;
    meshRef.current.geometry.computeVertexNormals();
  });

  // Initialize colors
  useEffect(() => {
    if (!geometry) return;
    
    const segments = 100;
    const count = (segments + 1) * (segments + 1);
    const colors = new Float32Array(count * 3);
    
    for (let i = 0; i < count; i++) {
      colors[i * 3] = 0.5;
      colors[i * 3 + 1] = 0.5;
      colors[i * 3 + 2] = 1.0;
    }
    
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3));
  }, [geometry]);

  return (
    <mesh ref={meshRef} geometry={geometry} rotation={[0, 0, 0]}>
      <meshStandardMaterial 
        vertexColors={true}
        side={THREE.DoubleSide}
        wireframe={false}
        flatShading={false}
      />
    </mesh>
  );
}

// Reference Sphere Component
function ReferenceSphere() {
  return (
    <mesh position={[0, 0, 3]}>
      <sphereGeometry args={[0.5, 32, 32]} />
      <meshStandardMaterial color="#ff9800" emissive="#ff9800" emissiveIntensity={0.5} />
    </mesh>
  );
}

// Main Demo Component
function SineWaveDemo() {
  const [time, setTime] = useState(0);
  const [cameraReset, setCameraReset] = useState(0);

  // Animate time
  useEffect(() => {
    const interval = setInterval(() => {
      setTime(t => t + 0.016); // ~60 FPS
    }, 16);
    
    return () => clearInterval(interval);
  }, []);

  // Handle keyboard shortcuts
  useEffect(() => {
    const handleKeyDown = (event) => {
      if (event.key === 'r' || event.key === 'R') {
        setCameraReset(prev => prev + 1);
      }
    };
    
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  return (
    <Box sx={{ width: '100vw', height: '100vh', position: 'relative', bgcolor: '#000' }}>
      {/* Title */}
      <Paper
        sx={{
          position: 'absolute',
          top: 20,
          left: '50%',
          transform: 'translateX(-50%)',
          p: 2,
          bgcolor: 'rgba(30, 41, 59, 0.9)',
          backdropFilter: 'blur(5px)',
          zIndex: 10,
          textAlign: 'center'
        }}
      >
        <Typography variant="h5" fontWeight="bold">
          3D Navigation Demo - Sinusbølge
        </Typography>
        <Typography variant="caption" color="text.secondary">
          z = sin(x) × cos(y)
        </Typography>
      </Paper>

      {/* Navigation Instructions */}
      <Paper
        sx={{
          position: 'absolute',
          top: 20,
          right: 20,
          p: 2,
          bgcolor: 'rgba(30, 41, 59, 0.9)',
          backdropFilter: 'blur(5px)',
          zIndex: 10,
          minWidth: 250
        }}
      >
        <Typography variant="subtitle2" fontWeight="bold" gutterBottom>
          Navigasjonsinstrukser:
        </Typography>
        <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
          <strong>Rotere:</strong> Klikk og dra / Høyreklikk og dra
        </Typography>
        <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
          <strong>Zoom:</strong> Scrollhjul / Pinch
        </Typography>
        <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
          <strong>Pan:</strong> Midtklikk og dra / Shift + dra
        </Typography>
        <Typography variant="caption" display="block" sx={{ mb: 0.5 }}>
          <strong>Reset view:</strong> Trykk <kbd style={{ 
            padding: '2px 6px', 
            backgroundColor: 'rgba(255,255,255,0.1)', 
            borderRadius: '3px',
            border: '1px solid rgba(255,255,255,0.3)'
          }}>R</kbd>
        </Typography>
      </Paper>

      {/* Legend */}
      <Paper
        sx={{
          position: 'absolute',
          bottom: 20,
          left: 20,
          p: 2,
          bgcolor: 'rgba(30, 41, 59, 0.9)',
          backdropFilter: 'blur(5px)',
          zIndex: 10
        }}
      >
        <Typography variant="caption" display="block" fontWeight="bold" gutterBottom>
          Fargegradient:
        </Typography>
        <Box sx={{ 
          display: 'flex', 
          alignItems: 'center', 
          gap: 1,
          mb: 0.5
        }}>
          <Box sx={{ 
            width: 20, 
            height: 20, 
            background: 'linear-gradient(to right, blue, cyan, green, yellow, red)',
            borderRadius: 0.5
          }} />
          <Typography variant="caption">
            Lav → Høy (z-verdi)
          </Typography>
        </Box>
        <Typography variant="caption" display="block" sx={{ mt: 1 }}>
          <Box component="span" sx={{ 
            display: 'inline-block',
            width: 12,
            height: 12,
            backgroundColor: '#ff9800',
            borderRadius: '50%',
            mr: 0.5,
            verticalAlign: 'middle'
          }} />
          Referansekule (for rotasjon)
        </Typography>
      </Paper>

      {/* 3D Canvas */}
      <Canvas
        gl={{
          antialias: true,
          alpha: false,
          powerPreference: "high-performance",
        }}
        dpr={window.devicePixelRatio || 1}
      >
        <PerspectiveCamera 
          makeDefault 
          position={[15, 15, 15]}
          up={[0, 0, 1]}
          key={cameraReset}
        />
        <OrbitControls 
          target={[0, 0, 0]}
          enableDamping={true}
          dampingFactor={0.05}
          rotateSpeed={0.5}
          zoomSpeed={0.8}
          panSpeed={0.8}
          minDistance={5}
          maxDistance={50}
          makeDefault
        />
        
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 10]} intensity={0.6} />
        <directionalLight position={[-10, -10, 5]} intensity={0.3} />
        
        {/* Grid */}
        <gridHelper args={[30, 30, '#444', '#222']} rotation={[0, 0, 0]} />
        
        {/* Coordinate axes */}
        <axesHelper args={[12]} />
        
        {/* Animated Sine Wave Surface */}
        <SineWaveSurface time={time} />
        
        {/* Reference Sphere */}
        <ReferenceSphere />
      </Canvas>
    </Box>
  );
}

export default SineWaveDemo;
