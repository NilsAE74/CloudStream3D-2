import React from 'react';
import {
  Paper,
  ToggleButton,
  ToggleButtonGroup,
  IconButton,
  Tooltip,
  Divider
} from '@mui/material';
import {
  Refresh,
  Straighten,
  Palette,
  Layers
} from '@mui/icons-material';

function ToolBar({ 
  measurementMode, 
  toggleMeasurementMode, 
  colorMode, 
  setColorMode,
  onResetView
}) {
  return (
    <Paper
      sx={{
        position: 'absolute',
        top: 10,
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

      {/* Color Mode */}
      <Tooltip title="Color Mode">
        <ToggleButtonGroup
          value={colorMode}
          exclusive
          onChange={(e, newMode) => {
            if (newMode !== null) {
              setColorMode(newMode);
            }
          }}
          size="small"
        >
          <ToggleButton value="height" aria-label="height coloring">
            <Palette fontSize="small" />
          </ToggleButton>
          <ToggleButton value="uniform" aria-label="uniform coloring">
            <Layers fontSize="small" />
          </ToggleButton>
        </ToggleButtonGroup>
      </Tooltip>

      <Divider orientation="vertical" flexItem />

      {/* Measurement Tool */}
      <Tooltip title={measurementMode ? "Disable Measurement" : "Enable Measurement"}>
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
