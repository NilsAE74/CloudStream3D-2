import React, { useState, useCallback } from 'react';
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
  IconButton
} from '@mui/material';
import {
  CloudUpload,
  Delete,
  Description
} from '@mui/icons-material';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000';

function LeftPanel({ onFileUploaded }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);

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

    setUploading(true);
    setError(null);

    try {
      const formData = new FormData();
      formData.append('file', file);

      const response = await axios.post(`${API_URL}/api/upload`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
      });

      // Add file to list
      setFiles(prev => [...prev, {
        id: response.data.fileId,
        name: response.data.filename,
        points: response.data.totalPoints,
        data: response.data
      }]);

      // Notify parent component
      if (onFileUploaded) {
        onFileUploaded(response.data);
      }

    } catch (err) {
      console.error('Upload error:', err);
      setError(err.response?.data?.error || 'Failed to upload file. Please try again.');
    } finally {
      setUploading(false);
    }
  }, [onFileUploaded]);

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
                <Description sx={{ mr: 2 }} />
                <ListItemText
                  primary={file.name}
                  secondary={`${file.points.toLocaleString()} points`}
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
