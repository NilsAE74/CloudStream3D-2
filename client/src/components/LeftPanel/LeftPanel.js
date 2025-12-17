import React, { useState, useCallback, useEffect } from 'react';
import {
  Box,
  Paper,
  Typography,
  Button,
  List,
  ListItem,
  ListItemText,
  CircularProgress,
  Alert,
  IconButton,
  Checkbox
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Description
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

function LeftPanel({ onFileUploaded, onVisibleFilesChange, maxDisplayPoints, downsamplingEnabled, samplingAlgorithm }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [visibleFiles, setVisibleFiles] = useState(new Set());
  
  // Notify parent whenever visibleFiles changes
  useEffect(() => {
    if (onVisibleFilesChange) {
      const visibleFilesList = files.filter(f => visibleFiles.has(f.id));
      onVisibleFilesChange(visibleFilesList);
    }
  }, [files, visibleFiles, onVisibleFilesChange]);

  // Handle file selection
  const handleFileSelect = useCallback(async (selectedFiles) => {
    if (!selectedFiles || selectedFiles.length === 0) return;

    const file = selectedFiles[0];
    
    // Validate file type
    const validExtensions = ['.csv', '.xyz', '.txt'];
    const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
    
    if (!validExtensions.includes(fileExt)) {
      setError('Invalid file type. Please upload CSV, XYZ, or TXT files.');
      return;
    }

    // Warn about file size limits in Codespaces
    const fileSizeMB = file.size / (1024 * 1024);
    if (fileSizeMB > 50) {
      const confirmUpload = window.confirm(
        `Warning: File size is ${fileSizeMB.toFixed(1)}MB. ` +
        `Large files may fail to upload in GitHub Codespaces due to proxy limits. ` +
        `For files over 50MB, consider running the app locally. Continue anyway?`
      );
      if (!confirmUpload) {
        return;
      }
    }

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      // Send parameters as query string for reliability
      const params = new URLSearchParams({
        maxDisplayPoints: maxDisplayPoints || 2500000,
        downsamplingEnabled: downsamplingEnabled ? 'true' : 'false',
        samplingAlgorithm: samplingAlgorithm || 'simple'
      });

      const response = await axios.post(`${API_URL}/api/upload?${params.toString()}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 300000, // 5 minutes timeout for large files
        maxContentLength: Infinity,
        maxBodyLength: Infinity
      });

      // Add file to list
      const newFile = {
        id: response.data.fileId,
        name: response.data.filename,
        points: response.data.totalPoints,
        displayedPoints: response.data.displayedPoints,
        downsamplingApplied: response.data.downsamplingApplied,
        data: response.data
      };
      
      console.log('\n=== File Upload Success ===');
      console.log(`File: ${response.data.filename}`);
      console.log(`Total points in file: ${response.data.totalPoints.toLocaleString()}`);
      console.log(`Points sent to client: ${response.data.displayedPoints.toLocaleString()}`);
      console.log(`Downsampling applied: ${response.data.downsamplingApplied}`);
      if (response.data.downsamplingApplied) {
        const ratio = ((response.data.displayedPoints / response.data.totalPoints) * 100).toFixed(1);
        console.log(`⚠️  Only ${ratio}% of points will be displayed`);
        console.log(`Increase "Max Display Points" in settings to show more points`);
      }
      console.log('===========================\n');
      
      setFiles(prev => [...prev, newFile]);
      
      // Automatically make new file visible
      setVisibleFiles(prev => {
        const newVisible = new Set(prev);
        newVisible.add(response.data.fileId);
        return newVisible;
      });

      // Notify parent component
      if (onFileUploaded) {
        onFileUploaded(response.data);
      }
      
      // useEffect will automatically call onVisibleFilesChange when visibleFiles updates

    } catch (err) {
      console.error('Upload error:', err);
      
      // Provide specific error messages
      let errorMessage = 'Failed to upload file. Please try again.';
      
      if (err.response?.status === 413) {
        errorMessage = 'File is too large for GitHub Codespaces. Please run the app locally for files over 50MB, or try a smaller file/sample.';
      } else if (err.response?.data?.error) {
        errorMessage = err.response.data.error;
      } else if (err.code === 'ERR_NETWORK') {
        errorMessage = 'Network error. File may be too large for Codespaces proxy. Try a smaller file or run locally.';
      }
      
      setError(errorMessage);
    } finally {
      setUploading(false);
    }
  }, [onFileUploaded, maxDisplayPoints, downsamplingEnabled, samplingAlgorithm]);

  // Handle drag events
  const handleDrag = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  // Handle drop
  const handleDrop = useCallback((e) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);

    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      handleFileSelect(e.dataTransfer.files);
    }
  }, [handleFileSelect]);

  // Handle file input change
  const handleInputChange = useCallback((e) => {
    if (e.target.files && e.target.files.length > 0) {
      handleFileSelect(e.target.files);
    }
  }, [handleFileSelect]);

  // Remove file from list
  const handleRemoveFile = useCallback((fileId) => {
    setFiles(prev => prev.filter(f => f.id !== fileId));
    setVisibleFiles(prev => {
      const newVisible = new Set(prev);
      newVisible.delete(fileId);
      return newVisible;
    });
    // useEffect will automatically call onVisibleFilesChange
  }, []);
  
  // Toggle file visibility
  const handleToggleVisibility = useCallback((fileId) => {
    setVisibleFiles(prev => {
      const newVisible = new Set(prev);
      if (newVisible.has(fileId)) {
        newVisible.delete(fileId);
      } else {
        newVisible.add(fileId);
      }
      return newVisible;
    });
    // useEffect will automatically call onVisibleFilesChange
  }, []);

  return (
    <Box sx={{ height: '100%', display: 'flex', flexDirection: 'column', p: 2 }}>
      <Typography variant="h6" gutterBottom>
        File Upload
      </Typography>

      {/* Drag and Drop Area */}
      <Paper
        sx={{
          p: 3,
          mb: 2,
          textAlign: 'center',
          border: dragActive ? '2px dashed #2196f3' : '2px dashed #555',
          bgcolor: dragActive ? 'rgba(33, 150, 243, 0.1)' : 'background.paper',
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          '&:hover': {
            borderColor: '#2196f3',
            bgcolor: 'rgba(33, 150, 243, 0.05)',
          }
        }}
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => document.getElementById('file-input').click()}
      >
        <CloudUpload sx={{ fontSize: 48, color: 'primary.main', mb: 1 }} />
        <Typography variant="body1" gutterBottom>
          Drag & Drop files here
        </Typography>
        <Typography variant="body2" color="text.secondary" gutterBottom>
          or click to browse
        </Typography>
        <Typography variant="caption" color="text.secondary">
          Supported formats: CSV, XYZ, TXT
        </Typography>
        
        <input
          id="file-input"
          type="file"
          accept=".csv,.xyz,.txt"
          style={{ display: 'none' }}
          onChange={handleInputChange}
        />
      </Paper>

      {/* Upload Button */}
      <Button
        variant="contained"
        component="label"
        startIcon={uploading ? <CircularProgress size={20} /> : <CloudUpload />}
        disabled={uploading}
        fullWidth
        sx={{ mb: 2 }}
      >
        {uploading ? 'Uploading...' : 'Choose File'}
        <input
          type="file"
          hidden
          accept=".csv,.xyz,.txt"
          onChange={handleInputChange}
          disabled={uploading}
        />
      </Button>

      {/* Error Message */}
      {error && (
        <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError(null)}>
          {error}
        </Alert>
      )}
      
      {/* Downsampling Warning */}
      {files.some(f => f.downsamplingApplied) && (
        <Alert severity="warning" sx={{ mb: 2 }}>
          <Typography variant="caption" display="block" fontWeight="bold">
            Point Downsampling Active
          </Typography>
          <Typography variant="caption" display="block">
            Some files show reduced points for performance. Increase "Max Display Points" in the right panel to show more points on next upload.
          </Typography>
        </Alert>
      )}

      {/* File List */}
      <Typography variant="subtitle2" gutterBottom>
        Uploaded Files ({files.length})
      </Typography>
      
      <Paper sx={{ flex: 1, overflow: 'auto' }}>
        <List>
          {files.length === 0 ? (
            <ListItem>
              <ListItemText 
                primary="No files uploaded"
                secondary="Upload a file to get started"
              />
            </ListItem>
          ) : (
            files.map((file) => (
              <ListItem
                key={file.id}
                secondaryAction={
                  <IconButton 
                    edge="end" 
                    aria-label="delete"
                    onClick={() => handleRemoveFile(file.id)}
                  >
                    <Delete />
                  </IconButton>
                }
              >
                <Checkbox
                  checked={visibleFiles.has(file.id)}
                  onChange={() => handleToggleVisibility(file.id)}
                  sx={{ mr: 1 }}
                />
                <Description sx={{ mr: 2 }} />
                <ListItemText
                  primary={file.name}
                  secondary={
                    file.downsamplingApplied
                      ? `${file.displayedPoints.toLocaleString()} / ${file.points.toLocaleString()} points (downsampled)`
                      : `${file.points.toLocaleString()} points`
                  }
                />
              </ListItem>
            ))
          )}
        </List>
      </Paper>
    </Box>
  );
}

export default LeftPanel;
