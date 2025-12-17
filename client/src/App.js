import React, { useState, useCallback } from 'react';
import { Box, CssBaseline, ThemeProvider, createTheme } from '@mui/material';
import LeftPanel from './components/LeftPanel/LeftPanel';
import CenterPanel from './components/CenterPanel/CenterPanel';
import RightPanel from './components/RightPanel/RightPanel';
import './App.css';

// Create Material-UI theme
const theme = createTheme({
  palette: {
    mode: 'dark',
    primary: {
      main: '#2196f3',
    },
    secondary: {
      main: '#f50057',
    },
    background: {
      default: '#0a1929',
      paper: '#1e293b',
    },
  },
});

function App() {
  // State management
  const [pointCloudData, setPointCloudData] = useState(null);
  const [filteredData, setFilteredData] = useState(null);
  const [statistics, setStatistics] = useState(null);
  const [filterRanges, setFilterRanges] = useState(null);
  const [selectedPoints, setSelectedPoints] = useState([]);
  const [measurementMode, setMeasurementMode] = useState(false);
  const [colorMode, setColorMode] = useState('height'); // 'height' or 'uniform'

  // Handle file upload success
  const handleFileUploaded = useCallback((data) => {
    setPointCloudData(data);
    setFilteredData(data.points);
    setStatistics(data.statistics);
    
    // Initialize filter ranges
    setFilterRanges({
      xMin: data.statistics.minX,
      xMax: data.statistics.maxX,
      yMin: data.statistics.minY,
      yMax: data.statistics.maxY,
      zMin: data.statistics.minZ,
      zMax: data.statistics.maxZ,
    });
  }, []);

  // Handle filter changes
  const handleFilterChange = useCallback((newRanges) => {
    setFilterRanges(newRanges);
    
    if (!pointCloudData) return;
    
    // Filter points locally for better performance
    const filtered = pointCloudData.points.filter(point => 
      point.x >= newRanges.xMin && point.x <= newRanges.xMax &&
      point.y >= newRanges.yMin && point.y <= newRanges.yMax &&
      point.z >= newRanges.zMin && point.z <= newRanges.zMax
    );
    
    setFilteredData(filtered);
    
    // Recalculate statistics for filtered data
    if (filtered.length > 0) {
      const newStats = {
        count: filtered.length,
        minX: Math.min(...filtered.map(p => p.x)),
        maxX: Math.max(...filtered.map(p => p.x)),
        minY: Math.min(...filtered.map(p => p.y)),
        maxY: Math.max(...filtered.map(p => p.y)),
        minZ: Math.min(...filtered.map(p => p.z)),
        maxZ: Math.max(...filtered.map(p => p.z)),
      };
      setStatistics(newStats);
    }
  }, [pointCloudData]);

  // Handle transformation
  const handleTransform = useCallback((transformedData) => {
    setPointCloudData({
      ...pointCloudData,
      points: transformedData.points
    });
    setFilteredData(transformedData.points);
    setStatistics(transformedData.statistics);
    
    // Update filter ranges
    setFilterRanges({
      xMin: transformedData.statistics.minX,
      xMax: transformedData.statistics.maxX,
      yMin: transformedData.statistics.minY,
      yMax: transformedData.statistics.maxY,
      zMin: transformedData.statistics.minZ,
      zMax: transformedData.statistics.maxZ,
    });
  }, [pointCloudData]);

  // Handle point selection for measurement
  const handlePointSelect = useCallback((point) => {
    if (!measurementMode) return;
    
    setSelectedPoints(prev => {
      if (prev.length >= 2) {
        return [point];
      }
      return [...prev, point];
    });
  }, [measurementMode]);

  // Toggle measurement mode
  const toggleMeasurementMode = useCallback(() => {
    setMeasurementMode(prev => !prev);
    setSelectedPoints([]);
  }, []);

  return (
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <Box sx={{ 
        display: 'flex', 
        height: '100vh', 
        overflow: 'hidden',
        bgcolor: 'background.default'
      }}>
        {/* Left Panel - File Upload */}
        <Box sx={{ 
          width: 300, 
          flexShrink: 0,
          borderRight: '1px solid rgba(255, 255, 255, 0.12)'
        }}>
          <LeftPanel onFileUploaded={handleFileUploaded} />
        </Box>

        {/* Center Panel - 3D Visualization */}
        <Box sx={{ flex: 1, position: 'relative' }}>
          <CenterPanel 
            points={filteredData}
            statistics={statistics}
            onPointSelect={handlePointSelect}
            measurementMode={measurementMode}
            toggleMeasurementMode={toggleMeasurementMode}
            selectedPoints={selectedPoints}
            colorMode={colorMode}
            setColorMode={setColorMode}
          />
        </Box>

        {/* Right Panel - Analysis and Controls */}
        <Box sx={{ 
          width: 350, 
          flexShrink: 0,
          borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
          overflowY: 'auto'
        }}>
          <RightPanel 
            statistics={statistics}
            points={filteredData}
            allPoints={pointCloudData?.points}
            filterRanges={filterRanges}
            onFilterChange={handleFilterChange}
            onTransform={handleTransform}
            selectedPoints={selectedPoints}
          />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
