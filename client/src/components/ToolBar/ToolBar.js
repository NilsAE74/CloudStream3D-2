import React from 'react';
import {
  Paper,
  ToggleButton,
  //ToggleButtonGroup,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Refresh,
  Straighten,
  Palette,
  Layers,
  GridOn,
  GridOff,
  ClearIcon
} from '@mui/icons-material';

function ToolBar({ 
  measurementMode, 
  toggleMeasurementMode, 
  colorMode, 
  setColorMode,
  onResetView,
  showGrid,
  toggleGrid,
  showAxis,
  toggleAxis
}) {
  const toggleColorMode = () => {
    setColorMode(colorMode === 'height' ? 'uniform' : 'height');
  };
  
  return (
    <Paper
      sx={{
        position:  'absolute',
        top:  10,
        left: '50%',
        transform: 'translateX(-50%)',
        display: 'flex',
        alignItems: 'center',
        gap: 1,
        p: 1,
        zIndex: 10,
        bgcolor: 'rgba(30, 41, 59, 0.9)',
        backdropFilter: 'blur(5px)',
      }}
    >
      {/* Reset View */}
      <Tooltip title="Reset View">
        <IconButton onClick={onResetView} color="primary">
          <Refresh />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

     {/* Color Mode Toggle */}
      <Tooltip title={colorMode === 'height' ?  "Height Colors" : "Uniform Color"}>
        <IconButton 
          onClick={toggleColorMode}
          color={colorMode === 'height' ? "primary" : "default"}
        >
          <Palette fontSize="small" />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      {/* Grid Toggle */}
      <Tooltip title={showGrid ? "Hide Grid" : "Show Grid"}>
        <IconButton 
          onClick={toggleGrid}
          color={showGrid ? "primary" : "default"}
        >
          {showGrid ? <GridOn /> : <GridOff />}
        </IconButton>
      </Tooltip>

      {/* Axis Toggle */}
      <Tooltip title={showAxis ? "Hide Axis" : "Show Axis"}>
        <IconButton 
          onClick={toggleAxis}
          color={showAxis ? "primary" : "default"}
        >
          <ClearIcon />
        </IconButton>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      {/* Measurement Tool */}
      <Tooltip title={measurementMode ?  "Disable Measurement" : "Enable Measurement"}>
        <IconButton 
          onClick={toggleMeasurementMode}
          color={measurementMode ? "secondary" : "default"}
        >
          <Straighten />
        </IconButton>
      </Tooltip>
    </Paper>
  );
}

export default ToolBar;
