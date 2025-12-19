import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  TextField,
  Box,
  Typography,
  CircularProgress,
  Alert
} from '@mui/material';

/**
 * MetadataDialog component
 * Displays a form for users to enter project metadata information
 * The metadata will be saved to a .txt file and included in the PDF report
 */
function MetadataDialog({ open, onClose, onSave, loading }) {
  // Default template for metadata fields
  const defaultMetadata = [
    '# Project: ',
    '# Location: ',
    '# CRS: EPSG:25832 (UTM Zone 32N)',
    '# Scanner: ',
    '# Scan Date: ',
    '# Operator: ',
    '# Weather: ',
    '# Accuracy: ',
    '# Software: ',
    '# Notes: ',
    '# Point Format: ',
    '# Units: '
  ];

  const [metadataLines, setMetadataLines] = useState(defaultMetadata);
  const [error, setError] = useState(null);

  // Reset form when dialog opens
  useEffect(() => {
    if (open) {
      setMetadataLines(defaultMetadata);
      setError(null);
    }
  }, [open]);

  // Handle input change for a specific line
  const handleLineChange = (index, value) => {
    const newLines = [...metadataLines];
    newLines[index] = value;
    setMetadataLines(newLines);
  };

  // Handle form submission
  const handleSubmit = () => {
    // Validate that at least some fields have been filled
    const hasContent = metadataLines.some(line => {
      const afterColon = line.split(':')[1] || '';
      return afterColon.trim() !== '';
    });

    if (!hasContent) {
      setError('Please fill in at least one field');
      return;
    }

    setError(null);
    onSave(metadataLines);
  };

  return (
    <Dialog 
      open={open} 
      onClose={onClose} 
      maxWidth="md" 
      fullWidth
      PaperProps={{
        sx: {
          bgcolor: '#1e1e1e',
          color: '#fff'
        }
      }}
    >
      <DialogTitle>
        <Typography variant="h6">
          Enter Project Metadata
        </Typography>
        <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
          Fill in the project information below. This will be saved to a .txt file
          and included in your PDF report.
        </Typography>
      </DialogTitle>
      
      <DialogContent>
        <Box sx={{ mt: 2 }}>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          )}
          
          {metadataLines.map((line, index) => {
            // Split by first colon to get label and value
            const colonIndex = line.indexOf(':');
            const label = colonIndex !== -1 ? line.substring(0, colonIndex + 1) : line;
            const value = colonIndex !== -1 ? line.substring(colonIndex + 1).trim() : '';
            
            return (
              <TextField
                key={index}
                fullWidth
                label={label}
                value={value}
                onChange={(e) => {
                  const newValue = label + ' ' + e.target.value;
                  handleLineChange(index, newValue);
                }}
                margin="normal"
                variant="outlined"
                size="small"
                sx={{
                  '& .MuiOutlinedInput-root': {
                    color: '#fff',
                    '& fieldset': {
                      borderColor: '#555',
                    },
                    '&:hover fieldset': {
                      borderColor: '#777',
                    },
                    '&.Mui-focused fieldset': {
                      borderColor: '#2196f3',
                    },
                  },
                  '& .MuiInputLabel-root': {
                    color: '#aaa',
                  },
                  '& .MuiInputLabel-root.Mui-focused': {
                    color: '#2196f3',
                  },
                }}
              />
            );
          })}
        </Box>
      </DialogContent>
      
      <DialogActions sx={{ p: 2 }}>
        <Button 
          onClick={onClose} 
          disabled={loading}
          sx={{ color: '#aaa' }}
        >
          Cancel
        </Button>
        <Button 
          onClick={handleSubmit} 
          variant="contained"
          disabled={loading}
          startIcon={loading ? <CircularProgress size={16} /> : null}
        >
          {loading ? 'Saving...' : 'Save & Generate Report'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

export default MetadataDialog;
