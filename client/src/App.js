import React, { useState, useCallback } from 'react';
import { Box, CssBaseline, ThemeProvider, createTheme, Button } from '@mui/material';
import LeftPanel from './components/LeftPanel/LeftPanel';
import CenterPanel from './components/CenterPanel/CenterPanel';
import RightPanel from './components/RightPanel/RightPanel';
import MetadataPanel from './components/MetadataPanel/MetadataPanel';
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
  const [visibleFiles, setVisibleFiles] = useState([]);
  const [pointSize, setPointSize] = useState(0.1);
  const [maxDisplayPoints, setMaxDisplayPoints] = useState(2500000);
  const [downsamplingEnabled, setDownsamplingEnabled] = useState(false);
  const [samplingAlgorithm, setSamplingAlgorithm] = useState('simple');
  
  // Color mapping controls
  const [colorGamma, setColorGamma] = useState(1.0);
  const [colorPercentileLow, setColorPercentileLow] = useState(0);
  const [colorPercentileHigh, setColorPercentileHigh] = useState(0);
  
  // Filter box visibility
  const [filteringActive, setFilteringActive] = useState(false);
  const [previewRanges, setPreviewRanges] = useState(null);

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
      // Use reduce for large arrays to avoid stack overflow
      const newStats = {
        count: filtered.length,
        minX: filtered.reduce((min, p) => Math.min(min, p.x), Infinity),
        maxX: filtered.reduce((max, p) => Math.max(max, p.x), -Infinity),
        minY: filtered.reduce((min, p) => Math.min(min, p.y), Infinity),
        maxY: filtered.reduce((max, p) => Math.max(max, p.y), -Infinity),
        minZ: filtered.reduce((min, p) => Math.min(min, p.z), Infinity),
        maxZ: filtered.reduce((max, p) => Math.max(max, p.z), -Infinity),
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
  
  // Handle visible files change
  const handleVisibleFilesChange = useCallback((files) => {
    setVisibleFiles(files);
  }, []);

  // State for selected file (for metadata panel)
  const [selectedFile, setSelectedFile] = useState(null);
  
  // State for metadata panel expansion (default collapsed)
  const [metadataPanelExpanded, setMetadataPanelExpanded] = useState(false);

  // Handle file selection for metadata
  const handleFileSelect = useCallback((file) => {
    setSelectedFile(file);
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
          <LeftPanel 
            onFileUploaded={handleFileUploaded}
            onVisibleFilesChange={handleVisibleFilesChange}
            onFileSelect={handleFileSelect}
            selectedFile={selectedFile}
            maxDisplayPoints={maxDisplayPoints}
            downsamplingEnabled={downsamplingEnabled}
            samplingAlgorithm={samplingAlgorithm}
          />
        </Box>

        {/* Metadata Panel - Attached to right of LeftPanel (collapsible) */}
        {selectedFile && metadataPanelExpanded && (
          <Box sx={{ 
            width: 350, 
            flexShrink: 0,
            borderRight: '1px solid rgba(255, 255, 255, 0.12)',
            overflowY: 'auto',
            bgcolor: 'background.paper'
          }}>
            <MetadataPanel 
              selectedFile={selectedFile}
              expanded={metadataPanelExpanded}
              onToggleExpanded={() => setMetadataPanelExpanded(!metadataPanelExpanded)}
              onMetadataChange={(metadata) => {
                console.log('Metadata changed:', metadata);
              }}
            />
          </Box>
        )}
        
        {/* Metadata Panel Toggle Button (when collapsed) */}
        {selectedFile && !metadataPanelExpanded && (
          <Box sx={{ 
            width: 48,
            flexShrink: 0,
            borderRight: '1px solid rgba(255, 255, 255, 0.12)',
            bgcolor: 'background.paper',
            display: 'flex',
            alignItems: 'flex-start',
            pt: 2
          }}>
            <Button
              onClick={() => setMetadataPanelExpanded(true)}
              sx={{
                minWidth: 48,
                width: 48,
                height: 48,
                p: 0,
                writingMode: 'vertical-rl',
                textOrientation: 'mixed',
                fontSize: '0.75rem',
                color: 'text.secondary',
                '&:hover': {
                  bgcolor: 'rgba(255, 255, 255, 0.08)'
                }
              }}
            >
              📋 Metadata
            </Button>
          </Box>
        )}

        {/* Center Panel - 3D Visualization */}
        <Box sx={{ 
          flex: 1, 
          position: 'relative',
          minWidth: 0, // Allow flexbox to shrink below content size
          overflow: 'hidden'
        }}>
          <CenterPanel 
            points={filteredData}
            statistics={statistics}
            onPointSelect={handlePointSelect}
            measurementMode={measurementMode}
            toggleMeasurementMode={toggleMeasurementMode}
            selectedPoints={selectedPoints}
            colorMode={colorMode}
            setColorMode={setColorMode}
            visibleFiles={visibleFiles}
            pointSize={pointSize}
            colorGamma={colorGamma}
            colorPercentileLow={colorPercentileLow}
            colorPercentileHigh={colorPercentileHigh}
            filterRanges={previewRanges || filterRanges}
            filteringActive={filteringActive}
          />
        </Box>

        {/* Right Panel - Analysis and Controls (Always visible) */}
        <Box sx={{ 
          width: 350, 
          flexShrink: 0,
          borderLeft: '1px solid rgba(255, 255, 255, 0.12)',
          overflowY: 'auto',
          bgcolor: 'background.paper'
        }}>
          <RightPanel 
            statistics={statistics}
            points={filteredData}
            allPoints={pointCloudData?.points}
            filterRanges={filterRanges}
            onFilterChange={handleFilterChange}
            onTransform={handleTransform}
            selectedPoints={selectedPoints}
            visibleFiles={visibleFiles}
            pointSize={pointSize}
            setPointSize={setPointSize}
            maxDisplayPoints={maxDisplayPoints}
            setMaxDisplayPoints={setMaxDisplayPoints}
            downsamplingEnabled={downsamplingEnabled}
            setDownsamplingEnabled={setDownsamplingEnabled}
            samplingAlgorithm={samplingAlgorithm}
            setSamplingAlgorithm={setSamplingAlgorithm}
            colorGamma={colorGamma}
            setColorGamma={setColorGamma}
            colorPercentileLow={colorPercentileLow}
            setColorPercentileLow={setColorPercentileLow}
            colorPercentileHigh={colorPercentileHigh}
            setColorPercentileHigh={setColorPercentileHigh}
            onFilteringActiveChange={setFilteringActive}
            onLocalRangesChange={setPreviewRanges}
          />
        </Box>
      </Box>
    </ThemeProvider>
  );
}

export default App;
