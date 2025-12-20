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
  Description,
  Assessment
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

function LeftPanel({ onFileUploaded, onVisibleFilesChange, onFileSelect, selectedFile, maxDisplayPoints, downsamplingEnabled, samplingAlgorithm }) {
  const [files, setFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState(null);
  const [dragActive, setDragActive] = useState(false);
  const [visibleFiles, setVisibleFiles] = useState(new Set());
  const [generatingReport, setGeneratingReport] = useState(false);
  const [selectedFileForReport, setSelectedFileForReport] = useState(null);
  
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

    // Validate all file types
    const validExtensions = ['.csv', '.xyz', '.txt'];
    const files = Array.from(selectedFiles);
    
    for (const file of files) {
      const fileExt = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
      if (!validExtensions.includes(fileExt)) {
        setError('Invalid file type. Please upload CSV, XYZ, or TXT files.');
        return;
      }
    }
    
    // Find the point cloud file (.xyz or .csv)
    const pointCloudFile = files.find(f => {
      const ext = f.name.toLowerCase().substring(f.name.lastIndexOf('.'));
      return ext === '.xyz' || ext === '.csv';
    });
    
    if (!pointCloudFile) {
      setError('Please select at least one .xyz or .csv file.');
      return;
    }
    
    const file = pointCloudFile;

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
      // Append all files (point cloud + metadata if present)
      files.forEach(f => {
        formData.append('files', f);
      });

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
      if (response.data.hasMetadata) {
        console.log('✓ Metadata file loaded successfully');
      }
      console.log('===========================\n');
      
      setFiles(prev => [...prev, newFile]);
      
      // Automatically make new file visible
      setVisibleFiles(prev => {
        const newVisible = new Set(prev);
        newVisible.add(response.data.fileId);
        return newVisible;
      });
      
      // Automatically select the new file for metadata editing
      if (onFileSelect) {
        onFileSelect(newFile);
      }

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
    // Clear selected file if it's the one being removed
    if (selectedFile && selectedFile.id === fileId && onFileSelect) {
      onFileSelect(null);
    }
    // useEffect will automatically call onVisibleFilesChange
  }, [selectedFile, onFileSelect]);
  
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
  
  // Handle file selection for metadata panel
  const handleSelectFile = useCallback((file) => {
    if (onFileSelect) {
      onFileSelect(file);
    }
  }, [onFileSelect]);
  
  /**
   * Handle PDF report generation button click
   * 
   * Updated workflow: No longer shows metadata dialog.
   * The metadata is already available in the MetadataPanel, so we just generate the report directly.
   * The backend will automatically include the metadata if a .txt file exists.
   * 
   * @param {Object} file - The file object for which to generate the report
   */
  const handleGenerateReport = useCallback(async (file) => {
    setSelectedFileForReport(file.id);
    setError(null);
    
    try {
      console.log('Generating PDF report for file:', file.name, 'ID:', file.id);
      
      // Generate the PDF report directly
      // The backend will automatically include metadata if a .txt file exists
      await generatePDFReport(file);
      
    } catch (err) {
      console.error('Error generating report:', err);
      setError('Failed to generate report. Please try again.');
      setSelectedFileForReport(null);
    }
  }, []);
  
  /**
   * Generate PDF report (actual PDF generation)
   * 
   * This function calls the backend API to generate a PDF report.
   * The backend will automatically include metadata if a .txt file exists.
   * When the PDF is ready, it's automatically downloaded to the user's computer.
   * 
   * @param {Object} file - The file object for which to generate the report
   */
  const generatePDFReport = useCallback(async (file) => {
    setGeneratingReport(true);
    
    try {
      console.log('Generating PDF report for file:', file.name, 'ID:', file.id);
      
      // Step 1: Call the backend API to generate the PDF
      // The response will be a binary PDF file (blob)
      const response = await axios.post(
        `${API_URL}/api/generate-report`,
        {
          fileId: file.id,
          originalFilename: file.name
        },
        {
          responseType: 'blob', // Important for receiving PDF file
          timeout: 300000 // 5 minutes timeout
        }
      );
      
      // Step 2: Create a download link for the PDF
      const blob = new Blob([response.data], { type: 'application/pdf' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      
      // Step 3: Set the filename for the download
      const baseFilename = file.name.replace(/\.[^/.]+$/, '');
      link.download = `pointcloud_${baseFilename}.pdf`;
      
      // Step 4: Trigger the download
      document.body.appendChild(link);
      link.click();
      
      // Step 5: Cleanup
      document.body.removeChild(link);
      window.URL.revokeObjectURL(url);
      
      console.log('Report generated and downloaded successfully');
      
    } catch (err) {
      console.error('Report generation error:', err);
      
      let errorMessage = 'Failed to generate report. Please try again.';
      
      if (err.code === 'ECONNABORTED' || err.message.includes('timeout')) {
        errorMessage = 'Report generation timeout. The file may be too large. Please try a smaller file.';
      } else if (err.response?.data) {
        // Try to extract error message from blob response
        try {
          const text = await err.response.data.text();
          const errorData = JSON.parse(text);
          errorMessage = errorData.error || errorMessage;
        } catch (e) {
          // If we can't parse it, use default message
        }
      }
      
      setError(errorMessage);
    } finally {
      setGeneratingReport(false);
      setSelectedFileForReport(null);
    }
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
        <Typography variant="caption" color="text.secondary" display="block">
          Supported formats: CSV, XYZ, TXT
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ fontStyle: 'italic' }}>
          Tip: Select both .xyz and .txt files together to upload with metadata
        </Typography>
        
        <input
          id="file-input"
          type="file"
          accept=".csv,.xyz,.txt"
          multiple
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
          multiple
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
                sx={{ 
                  flexDirection: 'column',
                  alignItems: 'stretch',
                  py: 1.5,
                  bgcolor: selectedFile?.id === file.id ? 'rgba(33, 150, 243, 0.1)' : 'transparent',
                  borderLeft: selectedFile?.id === file.id ? '3px solid #2196f3' : '3px solid transparent',
                  cursor: 'pointer',
                  '&:hover': {
                    bgcolor: 'rgba(33, 150, 243, 0.05)'
                  }
                }}
                onClick={() => handleSelectFile(file)}
              >
                <Box sx={{ display: 'flex', alignItems: 'center', width: '100%' }}>
                  <Checkbox
                    checked={visibleFiles.has(file.id)}
                    onChange={(e) => {
                      e.stopPropagation();
                      handleToggleVisibility(file.id);
                    }}
                    onClick={(e) => e.stopPropagation()}
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
                    sx={{ flex: 1 }}
                  />
                  <IconButton 
                    edge="end" 
                    aria-label="delete"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleRemoveFile(file.id);
                    }}
                  >
                    <Delete />
                  </IconButton>
                </Box>
                <Box sx={{ mt: 1, width: '100%' }}>
                  <Button
                    variant="outlined"
                    size="small"
                    fullWidth
                    startIcon={
                      generatingReport && selectedFileForReport === file.id 
                        ? <CircularProgress size={16} /> 
                        : <Assessment />
                    }
                    disabled={generatingReport}
                    onClick={(e) => {
                      e.stopPropagation();
                      handleGenerateReport(file);
                    }}
                    sx={{ 
                      textTransform: 'none',
                      fontSize: '0.75rem'
                    }}
                  >
                    {generatingReport && selectedFileForReport === file.id
                      ? 'Generating Report...'
                      : 'Generate PDF Report'}
                  </Button>
                </Box>
              </ListItem>
            ))
          )}
        </List>
      </Paper>
    </Box>
  );
}

export default LeftPanel;
