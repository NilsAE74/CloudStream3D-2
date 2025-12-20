import React, { useState, useEffect, useCallback } from 'react';
import {
  Box,
  Paper,
  Typography,
  TextField,
  Button,
  CircularProgress,
  Alert,
  Divider
} from '@mui/material';
import {
  Save,
  Undo,
  Delete as ClearIcon
} from '@mui/icons-material';
import axios from 'axios';

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

/**
 * MetadataPanel Component
 * 
 * Displays and allows editing of metadata for a selected file.
 * Metadata is always visible and editable when a file is selected.
 * 
 * Features:
 * - Loads metadata automatically when file is selected
 * - Inline editing of all metadata fields
 * - Manual save with visual feedback
 * - Unsaved changes indicator
 * - Revert changes functionality
 * - Clear all metadata
 */
function MetadataPanel({ selectedFile, onMetadataChange }) {
  const [metadata, setMetadata] = useState({
    project: '',
    location: '',
    crs: '',
    scanner: '',
    scanDate: '',
    operator: '',
    weather: '',
    accuracy: '',
    software: '',
    notes: '',
    pointFormat: '',
    units: ''
  });

  const [originalMetadata, setOriginalMetadata] = useState(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState(null);
  const [saveSuccess, setSaveSuccess] = useState(false);
  const [lastSaved, setLastSaved] = useState(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);

  // Load metadata when selectedFile changes
  useEffect(() => {
    if (selectedFile) {
      loadMetadata(selectedFile.id);
    } else {
      // Clear metadata when no file is selected
      resetMetadata();
    }
  }, [selectedFile]);

  // Check for unsaved changes
  useEffect(() => {
    if (!originalMetadata) {
      setHasUnsavedChanges(false);
      return;
    }

    const changed = Object.keys(metadata).some(
      key => metadata[key] !== originalMetadata[key]
    );
    setHasUnsavedChanges(changed);
  }, [metadata, originalMetadata]);

  /**
   * Load metadata from server
   */
  const loadMetadata = useCallback(async (fileId) => {
    setLoading(true);
    setError(null);
    setSaveSuccess(false);

    try {
      const response = await axios.get(`${API_URL}/api/metadata/${fileId}`, {
        timeout: 10000
      });

      const loadedMetadata = response.data.metadata;
      setMetadata(loadedMetadata);
      setOriginalMetadata(loadedMetadata);
      
      if (response.data.exists) {
        console.log('Loaded existing metadata for file:', fileId);
      } else {
        console.log('No metadata found, showing empty fields for file:', fileId);
      }

    } catch (err) {
      console.error('Error loading metadata:', err);
      setError('Failed to load metadata. Please try again.');
      // Set default metadata on error
      resetMetadata();
    } finally {
      setLoading(false);
    }
  }, []);

  /**
   * Reset metadata to default empty state
   */
  const resetMetadata = () => {
    const defaultMeta = {
      project: '',
      location: '',
      crs: 'EPSG:25832 (UTM Zone 32N)',
      scanner: '',
      scanDate: '',
      operator: '',
      weather: '',
      accuracy: '',
      software: '',
      notes: '',
      pointFormat: '',
      units: ''
    };
    setMetadata(defaultMeta);
    setOriginalMetadata(null);
    setHasUnsavedChanges(false);
    setLastSaved(null);
    setError(null);
    setSaveSuccess(false);
  };

  /**
   * Handle field change
   */
  const handleFieldChange = (field, value) => {
    setMetadata(prev => ({
      ...prev,
      [field]: value
    }));
    setSaveSuccess(false);
  };

  /**
   * Save metadata to server
   */
  const handleSaveMetadata = async () => {
    if (!selectedFile) return;

    setSaving(true);
    setError(null);
    setSaveSuccess(false);

    try {
      await axios.put(
        `${API_URL}/api/metadata/${selectedFile.id}`,
        { metadata },
        { timeout: 10000 }
      );

      setOriginalMetadata(metadata);
      setHasUnsavedChanges(false);
      setSaveSuccess(true);
      setLastSaved(new Date());
      
      console.log('Metadata saved successfully for file:', selectedFile.id);

      // Notify parent component if callback provided
      if (onMetadataChange) {
        onMetadataChange(metadata);
      }

      // Clear success message after 3 seconds
      setTimeout(() => {
        setSaveSuccess(false);
      }, 3000);

    } catch (err) {
      console.error('Error saving metadata:', err);
      setError('Failed to save metadata. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  /**
   * Revert changes to original metadata
   */
  const handleRevertChanges = () => {
    if (originalMetadata) {
      setMetadata(originalMetadata);
      setHasUnsavedChanges(false);
      setSaveSuccess(false);
      setError(null);
    }
  };

  /**
   * Clear all metadata fields
   */
  const handleClearAll = () => {
    if (window.confirm('Are you sure you want to clear all metadata fields? This will not delete saved metadata until you click Save.')) {
      setMetadata({
        project: '',
        location: '',
        crs: '',
        scanner: '',
        scanDate: '',
        operator: '',
        weather: '',
        accuracy: '',
        software: '',
        notes: '',
        pointFormat: '',
        units: ''
      });
      setSaveSuccess(false);
    }
  };

  /**
   * Format last saved time
   */
  const getLastSavedText = () => {
    if (!lastSaved) return null;

    const now = new Date();
    const diffMs = now - lastSaved;
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 1) return 'just now';
    if (diffMins === 1) return '1 minute ago';
    if (diffMins < 60) return `${diffMins} minutes ago`;
    
    const diffHours = Math.floor(diffMins / 60);
    if (diffHours === 1) return '1 hour ago';
    return `${diffHours} hours ago`;
  };

  // Don't render if no file is selected
  if (!selectedFile) {
    return null;
  }

  return (
    <Paper sx={{ p: 2, mt: 2 }}>
      <Box sx={{ display: 'flex', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" sx={{ flex: 1 }}>
          📋 Project Metadata
        </Typography>
        {hasUnsavedChanges && (
          <Typography 
            variant="caption" 
            sx={{ 
              color: 'warning.main',
              fontWeight: 'bold'
            }}
          >
            • Unsaved changes
          </Typography>
        )}
      </Box>

      <Divider sx={{ mb: 2 }} />

      {loading ? (
        <Box sx={{ display: 'flex', justifyContent: 'center', py: 4 }}>
          <CircularProgress />
        </Box>
      ) : (
        <>
          {error && (
            <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
              {error}
            </Alert>
          )}

          {saveSuccess && (
            <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaveSuccess(false)}>
              Metadata saved successfully!
            </Alert>
          )}

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1.5 }}>
            <TextField
              label="Project"
              value={metadata.project}
              onChange={(e) => handleFieldChange('project', e.target.value)}
              placeholder="e.g., Highway Bridge Inspection"
              size="small"
              fullWidth
            />

            <TextField
              label="Location"
              value={metadata.location}
              onChange={(e) => handleFieldChange('location', e.target.value)}
              placeholder="e.g., Berlin, Germany"
              size="small"
              fullWidth
            />

            <TextField
              label="CRS (Coordinate Reference System)"
              value={metadata.crs}
              onChange={(e) => handleFieldChange('crs', e.target.value)}
              placeholder="e.g., EPSG:25832 (UTM Zone 32N)"
              size="small"
              fullWidth
            />

            <TextField
              label="Scanner"
              value={metadata.scanner}
              onChange={(e) => handleFieldChange('scanner', e.target.value)}
              placeholder="e.g., Leica ScanStation P50"
              size="small"
              fullWidth
            />

            <TextField
              label="Scan Date"
              value={metadata.scanDate}
              onChange={(e) => handleFieldChange('scanDate', e.target.value)}
              placeholder="e.g., 2025-12-19"
              size="small"
              fullWidth
            />

            <TextField
              label="Operator"
              value={metadata.operator}
              onChange={(e) => handleFieldChange('operator', e.target.value)}
              placeholder="e.g., John Doe"
              size="small"
              fullWidth
            />

            <TextField
              label="Weather"
              value={metadata.weather}
              onChange={(e) => handleFieldChange('weather', e.target.value)}
              placeholder="e.g., Clear, sunny"
              size="small"
              fullWidth
            />

            <TextField
              label="Accuracy"
              value={metadata.accuracy}
              onChange={(e) => handleFieldChange('accuracy', e.target.value)}
              placeholder="e.g., ±2mm"
              size="small"
              fullWidth
            />

            <TextField
              label="Software"
              value={metadata.software}
              onChange={(e) => handleFieldChange('software', e.target.value)}
              placeholder="e.g., Cyclone REGISTER 360"
              size="small"
              fullWidth
            />

            <TextField
              label="Point Format"
              value={metadata.pointFormat}
              onChange={(e) => handleFieldChange('pointFormat', e.target.value)}
              placeholder="e.g., XYZ"
              size="small"
              fullWidth
            />

            <TextField
              label="Units"
              value={metadata.units}
              onChange={(e) => handleFieldChange('units', e.target.value)}
              placeholder="e.g., Meters"
              size="small"
              fullWidth
            />

            <TextField
              label="Notes"
              value={metadata.notes}
              onChange={(e) => handleFieldChange('notes', e.target.value)}
              placeholder="e.g., High-quality scan with no obstructions"
              size="small"
              fullWidth
              multiline
              rows={2}
            />
          </Box>

          <Divider sx={{ my: 2 }} />

          <Box sx={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            {lastSaved && (
              <Typography variant="caption" color="text.secondary">
                💾 Last saved: {getLastSavedText()}
              </Typography>
            )}

            <Box sx={{ display: 'flex', gap: 1 }}>
              <Button
                variant="contained"
                startIcon={saving ? <CircularProgress size={16} /> : <Save />}
                onClick={handleSaveMetadata}
                disabled={saving || !hasUnsavedChanges}
                fullWidth
              >
                {saving ? 'Saving...' : 'Save Changes'}
              </Button>

              <Button
                variant="outlined"
                startIcon={<Undo />}
                onClick={handleRevertChanges}
                disabled={!hasUnsavedChanges}
              >
                Revert
              </Button>

              <Button
                variant="outlined"
                color="error"
                startIcon={<ClearIcon />}
                onClick={handleClearAll}
              >
                Clear
              </Button>
            </Box>
          </Box>
        </>
      )}
    </Paper>
  );
}

export default MetadataPanel;
