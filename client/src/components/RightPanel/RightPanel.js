import React, { useState, useCallback, useMemo } from 'react';
import {
  Box,
  Paper,
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
  Alert
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

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function RightPanel({ 
  statistics, 
  points, 
  allPoints,
  filterRanges, 
  onFilterChange, 
  onTransform,
  selectedPoints
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

  // Update local ranges when filterRanges prop changes
  React.useEffect(() => {
    if (filterRanges) {
      setLocalRanges(filterRanges);
    }
  }, [filterRanges]);

  // Calculate histogram data
  const histogramData = useMemo(() => {
    if (!points || points.length === 0) return null;

    const zValues = points.map(p => p.z);
    const minZ = Math.min(...zValues);
    const maxZ = Math.max(...zValues);
    const range = maxZ - minZ;
    const binCount = 20;
    const binSize = range / binCount;

    const bins = Array(binCount).fill(0);
    const labels = [];

    for (let i = 0; i < binCount; i++) {
      const binStart = minZ + i * binSize;
      const binEnd = binStart + binSize;
      labels.push(binStart.toFixed(2));
      
      zValues.forEach(z => {
        if (z >= binStart && z < binEnd) {
          bins[i]++;
        }
      });
    }

    // Last bin includes the max value
    zValues.forEach(z => {
      if (z === maxZ) {
        bins[binCount - 1]++;
      }
    });

    return {
      labels,
      datasets: [
        {
          label: 'Z-value Distribution',
          data: bins,
          backgroundColor: 'rgba(33, 150, 243, 0.6)',
          borderColor: 'rgba(33, 150, 243, 1)',
          borderWidth: 1,
        },
      ],
    };
  }, [points]);

  // Handle filter slider change
  const handleSliderChange = useCallback((axis, type) => (event, newValue) => {
    setLocalRanges(prev => ({
      ...prev,
      [`${axis}${type}`]: newValue
    }));
  }, []);

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
        <Accordion>
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
