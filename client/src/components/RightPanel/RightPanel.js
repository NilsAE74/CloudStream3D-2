import React, { useState, useCallback, useMemo, useEffect, useRef } from 'react';
import {
  Box,
  Typography,
  Accordion,
  AccordionSummary,
  AccordionDetails,
  TextField,
  Slider,
  Button,
  Switch,
  FormControlLabel,
  Divider,
  Alert,
  FormControl,
  InputLabel,
  Select,
  MenuItem
} from '@mui/material';
import {
  ExpandMore,
  Download,
  Transform,
  FilterAlt,
  Assessment,
  Straighten
} from '@mui/icons-material';
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend,
} from 'chart.js';
import { Bar } from 'react-chartjs-2';
import axios from 'axios';

// Register Chart.js components
ChartJS.register(
  CategoryScale,
  LinearScale,
  BarElement,
  Title,
  Tooltip,
  Legend
);

// Use environment variable or construct from window location in Codespaces
const getApiUrl = () => {
  if (process.env.REACT_APP_API_URL) {
    return process.env.REACT_APP_API_URL;
  }
  // Check if running in Codespaces
  const hostname = window.location.hostname;
  if (hostname.includes('app.github.dev')) {
    // Replace port 3000 with 5000 in the hostname
    return `https://${hostname.replace('-3000', '-5000')}`;
  }
  return 'http://localhost:5000';
};

const API_URL = getApiUrl();

function RightPanel({ 
  statistics, 
  points, 
  allPoints,
  filterRanges, 
  onFilterChange, 
  onTransform,
  selectedPoints,
  visibleFiles,
  pointSize,
  setPointSize,
  maxDisplayPoints,
  setMaxDisplayPoints,
  downsamplingEnabled,
  setDownsamplingEnabled,
  samplingAlgorithm,
  setSamplingAlgorithm,
  colorGamma,
  setColorGamma,
  colorPercentileLow,
  setColorPercentileLow,
  colorPercentileHigh,
  setColorPercentileHigh,
  onFilteringActiveChange,
  onLocalRangesChange
}) {
  // Transformation state
  const [invertZ, setInvertZ] = useState(false);
  const [shiftX, setShiftX] = useState(0);
  const [shiftY, setShiftY] = useState(0);
  const [shiftZ, setShiftZ] = useState(0);
  const [rotateX, setRotateX] = useState(0);
  const [rotateY, setRotateY] = useState(0);
  const [rotateZ, setRotateZ] = useState(0);
  const [transforming, setTransforming] = useState(false);

  // Local filter state
  const [localRanges, setLocalRanges] = useState(filterRanges || {});
  const [filteringActive, setFilteringActive] = useState(false);
  
  // Debounced slider state
  const [sliderValue, setSliderValue] = useState(maxDisplayPoints);
  const debounceTimerRef = useRef(null);

  // Update local ranges when filterRanges prop changes
  React.useEffect(() => {
    if (filterRanges) {
      setLocalRanges(filterRanges);
    }
  }, [filterRanges]);
  
  // Notify parent of local range changes for real-time visualization
  React.useEffect(() => {
    if (onLocalRangesChange && filteringActive) {
      onLocalRangesChange(localRanges);
    }
  }, [localRanges, filteringActive, onLocalRangesChange]);
  
  // Sync slider value with maxDisplayPoints prop
  useEffect(() => {
    setSliderValue(maxDisplayPoints);
  }, [maxDisplayPoints]);
  
  // Calculate total points from visible files or statistics
  const totalPoints = useMemo(() => {
    if (visibleFiles && visibleFiles.length > 0) {
      return visibleFiles.reduce((sum, file) => sum + (file.points || 0), 0);
    }
    return statistics?.count || 0;
  }, [visibleFiles, statistics]);
  
  // Calculate dynamic slider parameters based on total points
  const sliderConfig = useMemo(() => {
    if (totalPoints === 0) {
      return {
        min: 10000,
        max: 5000000,
        step: 100000,
        marks: [
          { value: 100000, label: '100k' },
          { value: 1000000, label: '1M' },
          { value: 2500000, label: '2.5M' },
          { value: 5000000, label: '5M' }
        ]
      };
    }
    
    const min = Math.max(10000, Math.floor(totalPoints * 0.01));
    const max = totalPoints;
    const step = Math.ceil(totalPoints / 100);
    
    // Generate marks dynamically
    const marks = [];
    marks.push({ value: min, label: `${(min / 1000).toFixed(0)}k` });
    
    if (totalPoints >= 1000000) {
      const midPoints = [0.25, 0.5, 0.75].map(ratio => Math.floor(totalPoints * ratio));
      midPoints.forEach(val => {
        marks.push({ 
          value: val, 
          label: val >= 1000000 ? `${(val / 1000000).toFixed(1)}M` : `${(val / 1000).toFixed(0)}k` 
        });
      });
    } else {
      const quarter = Math.floor(totalPoints * 0.25);
      const half = Math.floor(totalPoints * 0.5);
      const threeQuarters = Math.floor(totalPoints * 0.75);
      marks.push({ value: quarter, label: `${(quarter / 1000).toFixed(0)}k` });
      marks.push({ value: half, label: `${(half / 1000).toFixed(0)}k` });
      marks.push({ value: threeQuarters, label: `${(threeQuarters / 1000).toFixed(0)}k` });
    }
    
    marks.push({ 
      value: max, 
      label: max >= 1000000 ? `${(max / 1000000).toFixed(1)}M` : `${(max / 1000).toFixed(0)}k` 
    });
    
    return { min, max, step, marks };
  }, [totalPoints]);
  
  // Debounced slider change handler
  const handleSliderChange = useCallback((e, value) => {
    setSliderValue(value); // Immediate UI update
    
    // Clear existing timer
    if (debounceTimerRef.current) {
      clearTimeout(debounceTimerRef.current);
    }
    
    // Set new timer for debounced update
    debounceTimerRef.current = setTimeout(() => {
      setMaxDisplayPoints(value);
    }, 400);
  }, [setMaxDisplayPoints]);
  
  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => {
      if (debounceTimerRef.current) {
        clearTimeout(debounceTimerRef.current);
      }
    };
  }, []);

  // Calculate histogram data from all visible files
  const histogramData = useMemo(() => {
    let allZValues = [];
    
    // Collect Z values from all visible files
    if (visibleFiles && visibleFiles.length > 0) {
      visibleFiles.forEach(file => {
        const fileZValues = file.data.points.map(p => p.z);
        allZValues = allZValues.concat(fileZValues);
      });
    } else if (points && points.length > 0) {
      // Fallback to single point cloud
      allZValues = points.map(p => p.z);
    }
    
    if (allZValues.length === 0) return null;

    // Use reduce for large arrays to avoid stack overflow with spread operator
    const minZ = allZValues.reduce((min, val) => Math.min(min, val), Infinity);
    const maxZ = allZValues.reduce((max, val) => Math.max(max, val), -Infinity);
    const range = maxZ - minZ;
    const binCount = 20;
    const binSize = range / binCount;

    const bins = Array(binCount).fill(0);
    const labels = [];

    for (let i = 0; i < binCount; i++) {
      const binStart = minZ + i * binSize;
      const binEnd = binStart + binSize;
      labels.push(binStart.toFixed(2));
      
      allZValues.forEach(z => {
        if (z >= binStart && z < binEnd) {
          bins[i]++;
        }
      });
    }

    // Last bin includes the max value
    allZValues.forEach(z => {
      if (z === maxZ) {
        bins[binCount - 1]++;
      }
    });

    return {
      labels,
      datasets: [
        {
          label: `Z-value Distribution${visibleFiles && visibleFiles.length > 1 ? ` (${visibleFiles.length} files)` : ''}`,
          data: bins,
          backgroundColor: 'rgba(33, 150, 243, 0.6)',
          borderColor: 'rgba(33, 150, 243, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [points, visibleFiles]);

  // Apply filters
  const handleApplyFilter = useCallback(() => {
    if (onFilterChange) {
      onFilterChange(localRanges);
    }
  }, [localRanges, onFilterChange]);

  // Apply transformations
  const handleApplyTransform = useCallback(async () => {
    if (!allPoints || allPoints.length === 0) return;

    setTransforming(true);
    try {
      const operations = {
        invertZ: invertZ,
        shift: { dx: shiftX, dy: shiftY, dz: shiftZ },
        rotate: { rx: rotateX, ry: rotateY, rz: rotateZ }
      };

      const response = await axios.post(`${API_URL}/api/transform`, {
        points: allPoints,
        operations
      });

      if (onTransform) {
        onTransform(response.data);
      }

      // Reset transformation values
      setInvertZ(false);
      setShiftX(0);
      setShiftY(0);
      setShiftZ(0);
      setRotateX(0);
      setRotateY(0);
      setRotateZ(0);

    } catch (error) {
      console.error('Transform error:', error);
    } finally {
      setTransforming(false);
    }
  }, [allPoints, invertZ, shiftX, shiftY, shiftZ, rotateX, rotateY, rotateZ, onTransform]);

  // Export data
  const handleExport = useCallback(async (format) => {
    if (!points || points.length === 0) return;

    try {
      const response = await axios.post(`${API_URL}/api/export`, {
        points: points,
        format: format
      }, {
        responseType: 'blob'
      });

      // Create download link
      const url = window.URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = url;
      link.setAttribute('download', `pointcloud_${Date.now()}.${format}`);
      document.body.appendChild(link);
      link.click();
      link.parentNode.removeChild(link);

    } catch (error) {
      console.error('Export error:', error);
    }
  }, [points]);

  // Calculate measurement distance
  const measurementDistance = useMemo(() => {
    if (!selectedPoints || selectedPoints.length !== 2) return null;

    const p1 = selectedPoints[0];
    const p2 = selectedPoints[1];
    const dx = p2.x - p1.x;
    const dy = p2.y - p1.y;
    const dz = p2.z - p1.z;

    return Math.sqrt(dx * dx + dy * dy + dz * dz);
  }, [selectedPoints]);

  return (
    <Box sx={{ height: '100%', overflow: 'auto', p: 2 }}>
      <Typography variant="h6" gutterBottom>
        Analysis & Controls
      </Typography>

      {/* Display Controls */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <FilterAlt sx={{ mr: 1 }} />
          <Typography>Display Settings</Typography>
        </AccordionSummary>
        <AccordionDetails>
          <Box>
            {/* Point Size Control */}
            <Box sx={{ mb: 3 }}>
              <Typography variant="subtitle2" gutterBottom>
                Point Size
              </Typography>
              <Slider
                value={pointSize}
                onChange={(e, value) => setPointSize(value)}
                min={0.01}
                max={1.0}
                step={0.01}
                valueLabelDisplay="auto"
                marks={[
                  { value: 0.01, label: '0.01' },
                  { value: 0.1, label: '0.1' },
                  { value: 0.5, label: '0.5' },
                  { value: 1.0, label: '1.0' }
                ]}
              />
            </Box>

            {/* Downsampling Controls - Only show when files are loaded */}
            {(visibleFiles?.length > 0 || statistics?.count > 0) && (
              <>
                {/* Downsampling Toggle */}
                <Box sx={{ mb: 2 }}>
                  <FormControlLabel
                    control={
                      <Switch
                        checked={downsamplingEnabled}
                        onChange={(e) => setDownsamplingEnabled(e.target.checked)}
                      />
                    }
                    label="Enable Point Downsampling"
                  />
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem', ml: 4 }}>
                    Automatically reduce points in large files for better performance
                  </Typography>
                </Box>

                {/* Sampling Algorithm Selector */}
                <Box sx={{ mb: 3 }}>
                  <FormControl fullWidth size="small">
                    <InputLabel>Downsampling Algorithm</InputLabel>
                    <Select
                      value={samplingAlgorithm}
                      onChange={(e) => setSamplingAlgorithm(e.target.value)}
                      disabled={!downsamplingEnabled}
                      label="Downsampling Algorithm"
                    >
                      <MenuItem value="simple">Simple (Every Nth point)</MenuItem>
                      <MenuItem value="importance">Importance Sampling</MenuItem>
                      <MenuItem value="poisson">Poisson Disk Sampling</MenuItem>
                    </Select>
                  </FormControl>
                  <Typography variant="caption" color="text.secondary" display="block" sx={{ fontSize: '0.65rem', mt: 0.5 }}>
                    Choose how points are selected when downsampling
                  </Typography>
                </Box>

                {/* Max Display Points Control */}
                <Box sx={{ mb: 3 }}>
                  <Typography variant="subtitle2" gutterBottom>
                    Max Display Points {totalPoints > 0 && `(File: ${totalPoints.toLocaleString()} points)`}
                  </Typography>
                  <Slider
                    value={sliderValue}
                    onChange={handleSliderChange}
                    min={sliderConfig.min}
                    max={sliderConfig.max}
                    step={sliderConfig.step}
                    valueLabelDisplay="auto"
                    valueLabelFormat={(value) => value >= 1000000 ? `${(value / 1000000).toFixed(1)}M` : `${(value / 1000).toFixed(0)}k`}
                    marks={sliderConfig.marks}
                    disabled={!downsamplingEnabled}
                  />
                  <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                    Higher values may affect performance. Changes apply to newly loaded files.
                  </Typography>
                </Box>
              </>
            )}

            <Divider sx={{ my: 2 }} />

            {/* Color Mapping Controls */}
            <Box>
              <Typography variant="subtitle2" gutterBottom>
                Color Mapping
              </Typography>
              
              {/* Gamma/Power Slider */}
              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" display="block" gutterBottom>
                  Color Gradient Curve (Gamma)
                </Typography>
                <Slider
                  value={colorGamma}
                  onChange={(e, value) => setColorGamma(value)}
                  min={0.1}
                  max={3.0}
                  step={0.1}
                  valueLabelDisplay="auto"
                  marks={[
                    { value: 0.1, label: '0.1' },
                    { value: 1.0, label: '1.0' },
                    { value: 2.0, label: '2.0' },
                    { value: 3.0, label: '3.0' }
                  ]}
                />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  &lt; 1.0: More color in lower heights | &gt; 1.0: More color in higher heights
                </Typography>
              </Box>

              {/* Percentile Cutoffs */}
              <Box sx={{ mt: 3 }}>
                <Typography variant="caption" display="block" gutterBottom>
                  Lower Percentile Cutoff (%)
                </Typography>
                <Slider
                  value={colorPercentileLow}
                  onChange={(e, value) => setColorPercentileLow(value)}
                  min={0}
                  max={25}
                  step={1}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}%`}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 5, label: '5%' },
                    { value: 10, label: '10%' },
                    { value: 25, label: '25%' }
                  ]}
                />
              </Box>

              <Box sx={{ mt: 2 }}>
                <Typography variant="caption" display="block" gutterBottom>
                  Upper Percentile Cutoff (%)
                </Typography>
                <Slider
                  value={colorPercentileHigh}
                  onChange={(e, value) => setColorPercentileHigh(value)}
                  min={0}
                  max={25}
                  step={1}
                  valueLabelDisplay="auto"
                  valueLabelFormat={(value) => `${value}%`}
                  marks={[
                    { value: 0, label: '0%' },
                    { value: 5, label: '5%' },
                    { value: 10, label: '10%' },
                    { value: 25, label: '25%' }
                  ]}
                />
                <Typography variant="caption" color="text.secondary" sx={{ fontSize: '0.65rem' }}>
                  Ignore extreme values at top/bottom of height range
                </Typography>
              </Box>
            </Box>
          </Box>
        </AccordionDetails>
      </Accordion>

      {/* Statistics Section */}
      <Accordion defaultExpanded>
        <AccordionSummary expandIcon={<ExpandMore />}>
          <Assessment sx={{ mr: 1 }} />
          <Typography>Statistics</Typography>
        </AccordionSummary>
        <AccordionDetails>
          {statistics ? (
            <Box>
              <Typography variant="body2" gutterBottom>
                <strong>Point Count:</strong> {statistics.count.toLocaleString()}
              </Typography>
              <Divider sx={{ my: 1 }} />
              <Typography variant="body2">
                <strong>X Range:</strong> {statistics.minX.toFixed(3)} to {statistics.maxX.toFixed(3)}
              </Typography>
              <Typography variant="body2">
                <strong>Y Range:</strong> {statistics.minY.toFixed(3)} to {statistics.maxY.toFixed(3)}
              </Typography>
              <Typography variant="body2">
                <strong>Z Range:</strong> {statistics.minZ.toFixed(3)} to {statistics.maxZ.toFixed(3)}
              </Typography>
            </Box>
          ) : (
            <Typography variant="body2" color="text.secondary">
              No data loaded
            </Typography>
          )}
        </AccordionDetails>
      </Accordion>

      {/* Measurement Section */}
      {selectedPoints && selectedPoints.length > 0 && (
        <Accordion defaultExpanded>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Straighten sx={{ mr: 1 }} />
            <Typography>Measurement</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              <Typography variant="body2" gutterBottom>
                Selected Points: {selectedPoints.length}
              </Typography>
              {selectedPoints.map((point, index) => (
                <Typography key={index} variant="caption" display="block">
                  Point {index + 1}: ({point.x.toFixed(3)}, {point.y.toFixed(3)}, {point.z.toFixed(3)})
                </Typography>
              ))}
              {measurementDistance !== null && (
                <Alert severity="info" sx={{ mt: 1 }}>
                  <Typography variant="body2">
                    <strong>Distance:</strong> {measurementDistance.toFixed(3)} units
                  </Typography>
                </Alert>
              )}
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Histogram Section */}
      {histogramData && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Assessment sx={{ mr: 1 }} />
            <Typography>Z-value Histogram</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Bar
              data={histogramData}
              options={{
                responsive: true,
                maintainAspectRatio: true,
                plugins: {
                  legend: {
                    display: false,
                  },
                  title: {
                    display: false,
                  },
                },
                scales: {
                  y: {
                    beginAtZero: true,
                    title: {
                      display: true,
                      text: 'Count'
                    }
                  },
                  x: {
                    title: {
                      display: true,
                      text: 'Z Value'
                    }
                  }
                }
              }}
            />
          </AccordionDetails>
        </Accordion>
      )}

      {/* Filtering Section */}
      {statistics && (
        <Accordion 
          expanded={filteringActive}
          onChange={(e, expanded) => {
            setFilteringActive(expanded);
            if (onFilteringActiveChange) {
              onFilteringActiveChange(expanded);
            }
          }}
        >
          <AccordionSummary expandIcon={<ExpandMore />}>
            <FilterAlt sx={{ mr: 1 }} />
            <Typography>Data Filtering</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              {/* X Range */}
              <Typography variant="body2" gutterBottom>
                X Range: {localRanges.xMin?.toFixed(2)} - {localRanges.xMax?.toFixed(2)}
              </Typography>
              <Slider
                value={[localRanges.xMin || statistics.minX, localRanges.xMax || statistics.maxX]}
                onChange={(e, newValue) => {
                  setLocalRanges(prev => ({
                    ...prev,
                    xMin: newValue[0],
                    xMax: newValue[1]
                  }));
                }}
                min={statistics.minX}
                max={statistics.maxX}
                step={(statistics.maxX - statistics.minX) / 100}
                valueLabelDisplay="auto"
                sx={{ mb: 2 }}
              />

              {/* Y Range */}
              <Typography variant="body2" gutterBottom>
                Y Range: {localRanges.yMin?.toFixed(2)} - {localRanges.yMax?.toFixed(2)}
              </Typography>
              <Slider
                value={[localRanges.yMin || statistics.minY, localRanges.yMax || statistics.maxY]}
                onChange={(e, newValue) => {
                  setLocalRanges(prev => ({
                    ...prev,
                    yMin: newValue[0],
                    yMax: newValue[1]
                  }));
                }}
                min={statistics.minY}
                max={statistics.maxY}
                step={(statistics.maxY - statistics.minY) / 100}
                valueLabelDisplay="auto"
                sx={{ mb: 2 }}
              />

              {/* Z Range */}
              <Typography variant="body2" gutterBottom>
                Z Range: {localRanges.zMin?.toFixed(2)} - {localRanges.zMax?.toFixed(2)}
              </Typography>
              <Slider
                value={[localRanges.zMin || statistics.minZ, localRanges.zMax || statistics.maxZ]}
                onChange={(e, newValue) => {
                  setLocalRanges(prev => ({
                    ...prev,
                    zMin: newValue[0],
                    zMax: newValue[1]
                  }));
                }}
                min={statistics.minZ}
                max={statistics.maxZ}
                step={(statistics.maxZ - statistics.minZ) / 100}
                valueLabelDisplay="auto"
                sx={{ mb: 2 }}
              />

              <Button
                variant="contained"
                fullWidth
                onClick={handleApplyFilter}
              >
                Apply Filter
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Transformation Section */}
      {allPoints && allPoints.length > 0 && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Transform sx={{ mr: 1 }} />
            <Typography>Transformations</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box>
              {/* Invert Z */}
              <FormControlLabel
                control={
                  <Switch
                    checked={invertZ}
                    onChange={(e) => setInvertZ(e.target.checked)}
                  />
                }
                label="Invert Z-values"
              />

              <Divider sx={{ my: 2 }} />

              {/* Shift Controls */}
              <Typography variant="subtitle2" gutterBottom>
                Shift Data
              </Typography>
              <TextField
                label="ΔX"
                type="number"
                value={shiftX}
                onChange={(e) => setShiftX(parseFloat(e.target.value) || 0)}
                fullWidth
                size="small"
                sx={{ mb: 1 }}
              />
              <TextField
                label="ΔY"
                type="number"
                value={shiftY}
                onChange={(e) => setShiftY(parseFloat(e.target.value) || 0)}
                fullWidth
                size="small"
                sx={{ mb: 1 }}
              />
              <TextField
                label="ΔZ"
                type="number"
                value={shiftZ}
                onChange={(e) => setShiftZ(parseFloat(e.target.value) || 0)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
              />

              <Divider sx={{ my: 2 }} />

              {/* Rotation Controls */}
              <Typography variant="subtitle2" gutterBottom>
                Rotate Data (degrees)
              </Typography>
              <TextField
                label="Rotate X"
                type="number"
                value={rotateX}
                onChange={(e) => setRotateX(parseFloat(e.target.value) || 0)}
                fullWidth
                size="small"
                sx={{ mb: 1 }}
              />
              <TextField
                label="Rotate Y"
                type="number"
                value={rotateY}
                onChange={(e) => setRotateY(parseFloat(e.target.value) || 0)}
                fullWidth
                size="small"
                sx={{ mb: 1 }}
              />
              <TextField
                label="Rotate Z"
                type="number"
                value={rotateZ}
                onChange={(e) => setRotateZ(parseFloat(e.target.value) || 0)}
                fullWidth
                size="small"
                sx={{ mb: 2 }}
              />

              <Button
                variant="contained"
                fullWidth
                onClick={handleApplyTransform}
                disabled={transforming}
              >
                {transforming ? 'Applying...' : 'Apply Transformations'}
              </Button>
            </Box>
          </AccordionDetails>
        </Accordion>
      )}

      {/* Export Section */}
      {points && points.length > 0 && (
        <Accordion>
          <AccordionSummary expandIcon={<ExpandMore />}>
            <Download sx={{ mr: 1 }} />
            <Typography>Export Data</Typography>
          </AccordionSummary>
          <AccordionDetails>
            <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={() => handleExport('csv')}
                fullWidth
              >
                Export as CSV
              </Button>
              <Button
                variant="outlined"
                startIcon={<Download />}
                onClick={() => handleExport('xyz')}
                fullWidth
              >
                Export as XYZ
              </Button>
              <Typography variant="caption" color="text.secondary" sx={{ mt: 1 }}>
                Exports currently filtered data ({points.length.toLocaleString()} points)
              </Typography>
            </Box>
          </AccordionDetails>
        </Accordion>
      )}
    </Box>
  );
}

export default RightPanel;
