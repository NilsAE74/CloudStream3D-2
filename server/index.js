const express = require('express');
const cors = require('cors');
const multer = require('multer');
const path = require('path');
const fs = require('fs');
const Papa = require('papaparse');
const { invertZ, shiftData, rotateData } = require('./utils/transformations');

const app = express();
const PORT = process.env.PORT || 5000;

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
    
    console.log(`\n${'='.repeat(60)}`);
    console.log(`FILE UPLOAD PROCESSING`);
    console.log(`${'='.repeat(60)}`);
    console.log(`File: ${req.file.originalname}`);
    console.log(`File size: ${(req.file.size / 1024 / 1024).toFixed(2)} MB`);
    console.log(`Total points parsed: ${points.length.toLocaleString()}`);
    console.log(`\nSettings:`);
    console.log(`  - Downsampling enabled: ${downsamplingEnabled}`);
    console.log(`  - Max display points: ${MAX_DISPLAY_POINTS.toLocaleString()}`);
    
    let downsamplingApplied = false;
    if (downsamplingEnabled && points.length > MAX_DISPLAY_POINTS) {
      const step = Math.ceil(points.length / MAX_DISPLAY_POINTS);
      displayPoints = points.filter((_, index) => index % step === 0);
      downsamplingApplied = true;
      const ratio = ((displayPoints.length / points.length) * 100).toFixed(1);
      console.log(`\n⚠️  DOWNSAMPLING APPLIED:`);
      console.log(`  - Step size: ${step} (keeping every ${step}th point)`);
      console.log(`  - Points after downsampling: ${displayPoints.length.toLocaleString()}`);
      console.log(`  - Percentage retained: ${ratio}%`);
      console.log(`  - Points removed: ${(points.length - displayPoints.length).toLocaleString()}`);
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

// Start server
const server = app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

// Increase timeout for large file uploads (10 minutes)
server.timeout = 600000;
server.keepAliveTimeout = 610000;
server.headersTimeout = 620000;
