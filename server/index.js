const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Papa = require('papaparse');
const { invertZ, shiftData, rotateData } = require('./utils/transformations');
const { importanceSampling, poissonDiskSampling } = require('./utils/sampling');
const { generateReport } = require('./utils/generateReport');
const { parseMetadataToObject, convertObjectToMetadataLines, getDefaultMetadata } = require('./utils/metadataParser');

const app = express();
const PORT = process.env.PORT || 5000;

// Regular expression to detect invalid control characters in metadata
// Allows only printable characters, newlines (\n), and tabs (\t)
// Blocks all other control characters (0x00-0x08, 0x0B-0x0C, 0x0E-0x1F, 0x7F)
const INVALID_CONTROL_CHARS_REGEX = /[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/;

// Middleware - Configure CORS to allow Codespaces URLs
const corsOptions = {
  origin: function (origin, callback) {
    // Allow requests with no origin (like mobile apps or curl requests)
    if (!origin) return callback(null, true);
    
    // Allow all Codespaces URLs and localhost
    if (
      origin.includes('app.github.dev') ||
      origin.includes('localhost') ||
      origin.includes('127.0.0.1')
    ) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  optionsSuccessStatus: 200
};

app.use(cors(corsOptions));
app.use(express.json({ limit: '500mb' }));
app.use(express.urlencoded({ extended: true, limit: '500mb' }));

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const uploadDir = path.join(__dirname, '../uploads');
    if (!fs.existsSync(uploadDir)) {
      fs.mkdirSync(uploadDir, { recursive: true });
    }
    cb(null, uploadDir);
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: { 
    fileSize: 500 * 1024 * 1024, // 500MB limit
    fieldSize: 50 * 1024 * 1024  // 50MB for fields
  },
  fileFilter: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    if (ext !== '.csv' && ext !== '.xyz' && ext !== '.txt') {
      return cb(new Error('Only .csv, .xyz, and .txt files are allowed'));
    }
    cb(null, true);
  }
});

// Parse XYZ/CSV file
function parsePointCloudFile(filePath) {
  return new Promise((resolve, reject) => {
    console.log(`[Parser] Reading file: ${path.basename(filePath)}`);
    const parseStartTime = Date.now();
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    const ext = path.extname(filePath).toLowerCase();
    const fileSize = fileContent.length;
    console.log(`[Parser] File size: ${(fileSize / 1024 / 1024).toFixed(2)} MB, Format: ${ext}`);
    
    let points = [];
    
    if (ext === '.xyz' || ext === '.txt') {
      // Parse XYZ format (space or tab separated)
      const lines = fileContent.split('\n');
      for (let line of lines) {
        line = line.trim();
        if (!line || line.startsWith('#')) continue;
        
        const parts = line.split(/[\s,]+/);
        if (parts.length >= 3) {
          const x = parseFloat(parts[0]);
          const y = parseFloat(parts[1]);
          const z = parseFloat(parts[2]);
          
          if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
            points.push({ x, y, z });
          }
        }
      }
      const parseTime = Date.now() - parseStartTime;
      console.log(`[Parser] Parsed ${points.length.toLocaleString()} points in ${parseTime}ms`);
      resolve(points);
    } else if (ext === '.csv') {
      // Parse CSV format
      Papa.parse(fileContent, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true,
        complete: (results) => {
          points = results.data.map(row => {
            // Try different common column names
            const x = row.x || row.X || row.easting || row.Easting || row[0];
            const y = row.y || row.Y || row.northing || row.Northing || row[1];
            const z = row.z || row.Z || row.elevation || row.Elevation || row[2];
            
            if (x !== undefined && y !== undefined && z !== undefined) {
              return { x: parseFloat(x), y: parseFloat(y), z: parseFloat(z) };
            }
            return null;
          }).filter(p => p !== null && !isNaN(p.x) && !isNaN(p.y) && !isNaN(p.z));
          
          const parseTime = Date.now() - parseStartTime;
          console.log(`[Parser] Parsed ${points.length.toLocaleString()} points from CSV in ${parseTime}ms`);
          resolve(points);
        },
        error: (error) => {
          reject(error);
        }
      });
    } else {
      reject(new Error('Unsupported file format'));
    }
  });
}

// Calculate statistics
function calculateStatistics(points) {
  if (points.length === 0) {
    return {
      count: 0,
      minX: 0, maxX: 0,
      minY: 0, maxY: 0,
      minZ: 0, maxZ: 0
    };
  }
  
  let minX = points[0].x, maxX = points[0].x;
  let minY = points[0].y, maxY = points[0].y;
  let minZ = points[0].z, maxZ = points[0].z;
  
  for (let point of points) {
    minX = Math.min(minX, point.x);
    maxX = Math.max(maxX, point.x);
    minY = Math.min(minY, point.y);
    maxY = Math.max(maxY, point.y);
    minZ = Math.min(minZ, point.z);
    maxZ = Math.max(maxZ, point.z);
  }
  
  return {
    count: points.length,
    minX, maxX,
    minY, maxY,
    minZ, maxZ
  };
}

// Routes

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'Server is running' });
});

// Upload file
app.post('/api/upload', upload.single('file'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }
    
    const filePath = req.file.path;
    const points = await parsePointCloudFile(filePath);
    
    if (points.length === 0) {
      return res.status(400).json({ error: 'No valid points found in file' });
    }
    
    const statistics = calculateStatistics(points);
    
    // For large datasets, downsample for initial display
    let displayPoints = points;
    
    // Get parameters from query string (more reliable than FormData body with multer)
    const downsamplingEnabled = req.query.downsamplingEnabled === 'true';
    const MAX_DISPLAY_POINTS = parseInt(req.query.maxDisplayPoints) || 2500000;
    const samplingAlgorithm = req.query.samplingAlgorithm || 'simple';
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`FILE UPLOAD PROCESSING`);
    console.log(`${'='.repeat(60)}`);
    console.log(`File: ${req.file.originalname}`);
    console.log(`File size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total points parsed: ${points.length.toLocaleString()}`);
    console.log(`\nSettings:`);
    console.log(`  - Downsampling enabled: ${downsamplingEnabled}`);
    console.log(`  - Max display points: ${MAX_DISPLAY_POINTS.toLocaleString()}`);
    console.log(`  - Sampling algorithm: ${samplingAlgorithm}`);
    
    let downsamplingApplied = false;
    if (downsamplingEnabled && points.length > MAX_DISPLAY_POINTS) {
      downsamplingApplied = true;
      const samplingStartTime = Date.now();
      
      switch(samplingAlgorithm) {
        case 'importance':
          console.log(`\n⚠️  IMPORTANCE SAMPLING:`);
          displayPoints = importanceSampling(points, MAX_DISPLAY_POINTS);
          break;
          
        case 'poisson':
          console.log(`\n⚠️  POISSON DISK SAMPLING:`);
          displayPoints = poissonDiskSampling(points, MAX_DISPLAY_POINTS);
          break;
          
        case 'simple':
        default:
          console.log(`\n⚠️  SIMPLE DOWNSAMPLING:`);
          const step = Math.ceil(points.length / MAX_DISPLAY_POINTS);
          displayPoints = points.filter((_, index) => index % step === 0);
          console.log(`  - Step size: ${step} (keeping every ${step}th point)`);
          break;
      }
      
      const samplingTime = Date.now() - samplingStartTime;
      const ratio = ((displayPoints.length / points.length) * 100).toFixed(1);
      console.log(`  - Points after downsampling: ${displayPoints.length.toLocaleString()}`);
      console.log(`  - Percentage retained: ${ratio}%`);
      console.log(`  - Points removed: ${(points.length - displayPoints.length).toLocaleString()}`);
      console.log(`  - Sampling time: ${samplingTime}ms`);
    } else {
      console.log(`\n✓ No downsampling applied - sending all ${points.length.toLocaleString()} points`);
    }
    
    const memoryEstimate = (displayPoints.length * 3 * 8) / 1024 / 1024; // 3 coords * 8 bytes per float64
    console.log(`\nMemory estimate for display: ~${memoryEstimate.toFixed(2)} MB`);
    console.log(`${'='.repeat(60)}\n`);
    
    res.json({
      filename: req.file.originalname,
      fileId: path.basename(filePath),
      points: displayPoints,
      allPoints: points.length <= MAX_DISPLAY_POINTS ? points : null,
      statistics,
      totalPoints: points.length,
      displayedPoints: displayPoints.length,
      downsamplingApplied: downsamplingApplied
    });
  } catch (error) {
    console.error('Upload error:', error);
    res.status(500).json({ error: error.message || 'Error processing file' });
  }
});

// Apply transformations
app.post('/api/transform', (req, res) => {
  try {
    const { points, operations } = req.body;
    
    if (!points || !Array.isArray(points)) {
      return res.status(400).json({ error: 'Invalid points data' });
    }
    
    let transformedPoints = [...points];
    
    // Apply operations in sequence
    if (operations) {
      if (operations.invertZ) {
        transformedPoints = invertZ(transformedPoints);
      }
      
      if (operations.shift) {
        const { dx, dy, dz } = operations.shift;
        transformedPoints = shiftData(transformedPoints, dx || 0, dy || 0, dz || 0);
      }
      
      if (operations.rotate) {
        const { rx, ry, rz } = operations.rotate;
        transformedPoints = rotateData(transformedPoints, rx || 0, ry || 0, rz || 0);
      }
    }
    
    const statistics = calculateStatistics(transformedPoints);
    
    res.json({
      points: transformedPoints,
      statistics
    });
  } catch (error) {
    console.error('Transform error:', error);
    res.status(500).json({ error: error.message || 'Error transforming data' });
  }
});

// Filter points
app.post('/api/filter', (req, res) => {
  try {
    const { points, ranges } = req.body;
    
    if (!points || !Array.isArray(points)) {
      return res.status(400).json({ error: 'Invalid points data' });
    }
    
    const { xMin, xMax, yMin, yMax, zMin, zMax } = ranges;
    
    const filteredPoints = points.filter(point => {
      return point.x >= xMin && point.x <= xMax &&
             point.y >= yMin && point.y <= yMax &&
             point.z >= zMin && point.z <= zMax;
    });
    
    const statistics = calculateStatistics(filteredPoints);
    
    res.json({
      points: filteredPoints,
      statistics,
      filteredCount: filteredPoints.length,
      originalCount: points.length
    });
  } catch (error) {
    console.error('Filter error:', error);
    res.status(500).json({ error: error.message || 'Error filtering data' });
  }
});

// Export filtered data
app.post('/api/export', (req, res) => {
  try {
    const { points, format = 'csv' } = req.body;
    
    if (!points || !Array.isArray(points)) {
      return res.status(400).json({ error: 'Invalid points data' });
    }
    
    let content;
    let filename;
    let contentType;
    
    if (format === 'csv') {
      content = 'X,Y,Z\n';
      points.forEach(point => {
        content += `${point.x},${point.y},${point.z}\n`;
      });
      filename = `pointcloud_${Date.now()}.csv`;
      contentType = 'text/csv';
    } else if (format === 'xyz') {
      content = '';
      points.forEach(point => {
        content += `${point.x} ${point.y} ${point.z}\n`;
      });
      filename = `pointcloud_${Date.now()}.xyz`;
      contentType = 'text/plain';
    } else {
      return res.status(400).json({ error: 'Invalid format' });
    }
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(content);
  } catch (error) {
    console.error('Export error:', error);
    res.status(500).json({ error: error.message || 'Error exporting data' });
  }
});

/**
 * API Endpoint: Check if metadata file exists for a given file
 * 
 * This endpoint checks if a .txt metadata file exists in the same folder
 * as the uploaded .xyz file with the same name.
 * 
 * Request body:
 *   - fileId: The ID of the uploaded file (filename in uploads directory)
 * 
 * Response:
 *   - exists: Boolean indicating if metadata file exists
 *   - metadataFilePath: Full path to the metadata file
 *   - metadata: Array of metadata lines if file exists, null otherwise
 */
app.post('/api/check-metadata', (req, res) => {
  try {
    const { fileId } = req.body;
    
    // Validate request
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }
    
    // Step 1: Construct path to uploaded file
    const uploadDir = path.join(__dirname, '../uploads');
    const inputFile = path.join(uploadDir, fileId);
    
    // Step 2: Verify that the original file exists
    if (!fs.existsSync(inputFile)) {
      return res.status(404).json({ error: 'Input file not found' });
    }
    
    // Step 3: Determine metadata file path
    // Get base filename without extension and append .txt
    const inputBasename = path.basename(inputFile, path.extname(inputFile));
    const metadataFilePath = path.join(uploadDir, inputBasename + '.txt');
    
    // Step 4: Check if metadata file exists
    const metadataExists = fs.existsSync(metadataFilePath);
    
    // Step 5: If metadata exists, read and return its content
    let metadata = null;
    if (metadataExists) {
      try {
        const content = fs.readFileSync(metadataFilePath, 'utf-8');
        metadata = content.split('\n').filter(line => line.trim() !== '');
      } catch (error) {
        console.error('Error reading metadata:', error);
      }
    }
    
    // Step 6: Return response
    res.json({
      exists: metadataExists,
      metadataFilePath: metadataFilePath,
      metadata: metadata
    });
    
  } catch (error) {
    console.error('Check metadata error:', error);
    res.status(500).json({ error: error.message || 'Error checking metadata' });
  }
});

/**
 * API Endpoint: Save metadata to a .txt file
 * 
 * This endpoint creates a new .txt file with the same name as the uploaded
 * .xyz file and saves the provided metadata lines to it. The metadata will
 * then be included in future PDF reports.
 * 
 * Request body:
 *   - fileId: The ID of the uploaded file (filename in uploads directory)
 *   - metadata: Array of metadata lines (strings) to save
 * 
 * Response:
 *   - success: Boolean indicating if save was successful
 *   - metadataFilePath: Full path to the saved metadata file
 *   - message: Success message
 */
app.post('/api/save-metadata', (req, res) => {
  try {
    const { fileId, metadata } = req.body;
    
    // Validate request
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }
    
    if (!metadata || !Array.isArray(metadata)) {
      return res.status(400).json({ error: 'Metadata must be an array of strings' });
    }
    
    // Validate metadata content
    // Check that each line is a string and has reasonable length
    const MAX_LINE_LENGTH = 500;
    const MAX_LINES = 100;
    
    if (metadata.length > MAX_LINES) {
      return res.status(400).json({ error: `Too many metadata lines (max ${MAX_LINES})` });
    }
    
    for (let i = 0; i < metadata.length; i++) {
      const line = metadata[i];
      
      // Ensure each item is a string
      if (typeof line !== 'string') {
        return res.status(400).json({ error: `Metadata line ${i + 1} must be a string` });
      }
      
      // Check line length
      if (line.length > MAX_LINE_LENGTH) {
        return res.status(400).json({ 
          error: `Metadata line ${i + 1} exceeds maximum length of ${MAX_LINE_LENGTH} characters` 
        });
      }
      
      // Sanitize: Remove any control characters except newline and tab
      // This prevents potential file system attacks
      if (INVALID_CONTROL_CHARS_REGEX.test(line)) {
        return res.status(400).json({ 
          error: `Metadata line ${i + 1} contains invalid control characters` 
        });
      }
    }
    
    // Step 1: Construct path to uploaded file
    const uploadDir = path.join(__dirname, '../uploads');
    const inputFile = path.join(uploadDir, fileId);
    
    // Step 2: Verify that the original file exists
    if (!fs.existsSync(inputFile)) {
      return res.status(404).json({ error: 'Input file not found' });
    }
    
    // Step 3: Determine metadata file path
    // Get base filename without extension and append .txt
    const inputBasename = path.basename(inputFile, path.extname(inputFile));
    const metadataFilePath = path.join(uploadDir, inputBasename + '.txt');
    
    // Step 4: Write metadata to file
    // Join all metadata lines with newline characters
    const content = metadata.join('\n');
    fs.writeFileSync(metadataFilePath, content, 'utf-8');
    
    console.log(`[Metadata] Saved metadata to: ${metadataFilePath}`);
    
    // Step 5: Return success response
    res.json({
      success: true,
      metadataFilePath: metadataFilePath,
      message: 'Metadata saved successfully'
    });
    
  } catch (error) {
    console.error('Save metadata error:', error);
    res.status(500).json({ error: error.message || 'Error saving metadata' });
  }
});

/**
 * API Endpoint: Get metadata for a file (structured object format)
 * 
 * This endpoint retrieves metadata for a file and returns it as a structured
 * object rather than raw lines, making it easier for the frontend to work with.
 * 
 * Request params:
 *   - fileId: The ID of the uploaded file (filename in uploads directory)
 * 
 * Response:
 *   - exists: Boolean indicating if metadata file exists
 *   - metadata: Structured metadata object with all fields
 */
app.get('/api/metadata/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;
    
    // Validate request
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }
    
    // Step 1: Construct path to uploaded file
    const uploadDir = path.join(__dirname, '../uploads');
    const inputFile = path.join(uploadDir, fileId);
    
    // Step 2: Verify that the original file exists
    if (!fs.existsSync(inputFile)) {
      return res.status(404).json({ error: 'Input file not found' });
    }
    
    // Step 3: Determine metadata file path
    const inputBasename = path.basename(inputFile, path.extname(inputFile));
    const metadataFilePath = path.join(uploadDir, inputBasename + '.txt');
    
    // Step 4: Check if metadata file exists
    const metadataExists = fs.existsSync(metadataFilePath);
    
    let metadata;
    if (metadataExists) {
      // Step 5: Read and parse metadata
      try {
        const content = fs.readFileSync(metadataFilePath, 'utf-8');
        const lines = content.split('\n').filter(line => line.trim() !== '');
        metadata = parseMetadataToObject(lines);
      } catch (error) {
        console.error('Error reading metadata:', error);
        metadata = getDefaultMetadata();
      }
    } else {
      // Return default empty metadata
      metadata = getDefaultMetadata();
    }
    
    // Step 6: Return response
    res.json({
      exists: metadataExists,
      metadata: metadata
    });
    
  } catch (error) {
    console.error('Get metadata error:', error);
    res.status(500).json({ error: error.message || 'Error retrieving metadata' });
  }
});

/**
 * API Endpoint: Update metadata for a file
 * 
 * This endpoint updates metadata for a file. It accepts a structured metadata
 * object, converts it to the line-based format, and saves it to the .txt file.
 * 
 * Request params:
 *   - fileId: The ID of the uploaded file (filename in uploads directory)
 * 
 * Request body:
 *   - metadata: Structured metadata object with fields
 * 
 * Response:
 *   - success: Boolean indicating if save was successful
 *   - message: Success message
 */
app.put('/api/metadata/:fileId', (req, res) => {
  try {
    const { fileId } = req.params;
    const { metadata } = req.body;
    
    // Validate request
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }
    
    if (!metadata || typeof metadata !== 'object') {
      return res.status(400).json({ error: 'Metadata must be an object' });
    }
    
    // Step 1: Construct path to uploaded file
    const uploadDir = path.join(__dirname, '../uploads');
    const inputFile = path.join(uploadDir, fileId);
    
    // Step 2: Verify that the original file exists
    if (!fs.existsSync(inputFile)) {
      return res.status(404).json({ error: 'Input file not found' });
    }
    
    // Step 3: Convert metadata object to lines format
    const metadataLines = convertObjectToMetadataLines(metadata);
    
    // Step 4: Validate metadata content
    const MAX_LINE_LENGTH = 500;
    for (let i = 0; i < metadataLines.length; i++) {
      const line = metadataLines[i];
      
      if (line.length > MAX_LINE_LENGTH) {
        return res.status(400).json({ 
          error: `Metadata line ${i + 1} exceeds maximum length of ${MAX_LINE_LENGTH} characters` 
        });
      }
      
      // Sanitize: Remove any control characters except newline and tab
      if (/[\x00-\x08\x0B-\x0C\x0E-\x1F\x7F]/.test(line)) {
        return res.status(400).json({ 
          error: `Metadata line ${i + 1} contains invalid control characters` 
        });
      }
    }
    
    // Step 5: Determine metadata file path
    const inputBasename = path.basename(inputFile, path.extname(inputFile));
    const metadataFilePath = path.join(uploadDir, inputBasename + '.txt');
    
    // Step 6: Write metadata to file
    const content = metadataLines.join('\n');
    fs.writeFileSync(metadataFilePath, content, 'utf-8');
    
    console.log(`[Metadata] Updated metadata for file: ${fileId}`);
    
    // Step 7: Return success response
    res.json({
      success: true,
      message: 'Metadata updated successfully'
    });
    
  } catch (error) {
    console.error('Update metadata error:', error);
    res.status(500).json({ error: error.message || 'Error updating metadata' });
  }
});

// Generate PDF report
app.post('/api/generate-report', async (req, res) => {
  try {
    const { fileId, originalFilename } = req.body;
    
    if (!fileId) {
      return res.status(400).json({ error: 'File ID is required' });
    }
    
    // Construct path to uploaded file
    const uploadDir = path.join(__dirname, '../uploads');
    const inputFile = path.join(uploadDir, fileId);
    
    // Check if file exists
    if (!fs.existsSync(inputFile)) {
      return res.status(404).json({ error: 'Input file not found' });
    }
    
    // Generate output filename based on original filename
    const baseFilename = originalFilename 
      ? originalFilename.replace(/\.[^/.]+$/, '') // Remove extension
      : 'pointcloud';
    const outputFilename = `pointcloud_${baseFilename}.pdf`;
    const outputFile = path.join(uploadDir, outputFilename);
    
    console.log('\n' + '='.repeat(60));
    console.log('PDF REPORT GENERATION REQUEST');
    console.log('='.repeat(60));
    console.log(`Input file: ${fileId}`);
    console.log(`Original filename: ${originalFilename}`);
    console.log(`Output file: ${outputFilename}`);
    console.log('='.repeat(60));
    
    // Call JavaScript report generator
    const result = await generateReport(inputFile, outputFile, originalFilename);
    
    if (!result.success) {
      console.error('Report generation failed:', result.error);
      return res.status(500).json({ 
        error: 'Failed to generate report', 
        details: result.error
      });
    }
    
    // Check if output file was created
    if (!fs.existsSync(outputFile)) {
      return res.status(500).json({ error: 'Report file was not generated' });
    }
    
    console.log('\n' + '='.repeat(60));
    console.log('PDF REPORT GENERATION COMPLETED');
    console.log('='.repeat(60) + '\n');
    
    // Send the PDF file
    res.download(outputFile, outputFilename, (err) => {
      if (err) {
        console.error('Error sending file:', err);
        if (!res.headersSent) {
          res.status(500).json({ error: 'Error sending report file' });
        }
      }
      
      // Optional: Clean up the PDF file after sending
      // Uncomment the following lines if you want to delete the PDF after download
      // setTimeout(() => {
      //   if (fs.existsSync(outputFile)) {
      //     fs.unlinkSync(outputFile);
      //   }
      // }, 1000);
    });
    
  } catch (error) {
    console.error('Report generation error:', error);
    res.status(500).json({ error: error.message || 'Error generating report' });
  }
});

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Increase timeout for large file uploads (10 minutes)
server.timeout = 600000;
server.keepAliveTimeout = 610000;
server.headersTimeout = 620000;
