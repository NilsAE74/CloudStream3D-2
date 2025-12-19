/**
 * Point Cloud Analysis and PDF Report Generator (JavaScript version)
 * 
 * This module analyzes XYZ point cloud data and generates a comprehensive
 * one-page PDF report in English with:
 * - Statistical analysis (count, extent, mean, std dev)
 * - Z-value histogram
 * - 3D visualization with Z-based coloring
 * - Average nearest neighbor distance
 * 
 * The PDF is optimized to stay under 2 MB through image compression.
 */

const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const { ChartJSNodeCanvas } = require('chartjs-node-canvas');

/**
 * Parse XYZ point cloud file
 * @param {string} filepath - Path to the XYZ/TXT/CSV file
 * @returns {Array<{x: number, y: number, z: number}>} Array of point objects
 */
function parseXYZFile(filepath) {
  console.log(`[Parser] Reading file: ${path.basename(filepath)}`);
  
  const fileContent = fs.readFileSync(filepath, 'utf-8');
  const lines = fileContent.split('\n');
  const points = [];
  
  for (const line of lines) {
    const trimmed = line.trim();
    // Skip empty lines and comments
    if (!trimmed || trimmed.startsWith('#')) continue;
    
    // Split by whitespace or comma
    const parts = trimmed.replace(/,/g, ' ').split(/\s+/);
    if (parts.length >= 3) {
      const x = parseFloat(parts[0]);
      const y = parseFloat(parts[1]);
      const z = parseFloat(parts[2]);
      
      if (!isNaN(x) && !isNaN(y) && !isNaN(z)) {
        points.push({ x, y, z });
      }
    }
  }
  
  if (points.length === 0) {
    throw new Error('No valid points found in file');
  }
  
  console.log(`[Parser] Loaded ${points.length} points`);
  return points;
}

/**
 * Calculate comprehensive statistics for the point cloud
 * @param {Array<{x: number, y: number, z: number}>} points - Array of points
 * @returns {Object} Statistics object
 */
function calculateStatistics(points) {
  console.log('[Analysis] Calculating statistics...');
  
  if (points.length === 0) {
    return {
      count: 0,
      xMin: 0, xMax: 0, yMin: 0, yMax: 0, zMin: 0, zMax: 0,
      xExtent: 0, yExtent: 0, zExtent: 0,
      xMean: 0, yMean: 0, zMean: 0,
      xStd: 0, yStd: 0, zStd: 0
    };
  }
  
  // Calculate min, max, and extract values in a single pass to avoid stack overflow
  let xMin = Infinity, xMax = -Infinity;
  let yMin = Infinity, yMax = -Infinity;
  let zMin = Infinity, zMax = -Infinity;
  
  for (const point of points) {
    if (point.x < xMin) xMin = point.x;
    if (point.x > xMax) xMax = point.x;
    if (point.y < yMin) yMin = point.y;
    if (point.y > yMax) yMax = point.y;
    if (point.z < zMin) zMin = point.z;
    if (point.z > zMax) zMax = point.z;
  }
  
  // Extract coordinates for mean/std calculations
  const xValues = points.map(p => p.x);
  const yValues = points.map(p => p.y);
  const zValues = points.map(p => p.z);
  
  // Calculate means
  const xMean = xValues.reduce((a, b) => a + b, 0) / points.length;
  const yMean = yValues.reduce((a, b) => a + b, 0) / points.length;
  const zMean = zValues.reduce((a, b) => a + b, 0) / points.length;
  
  // Calculate standard deviations
  const xStd = Math.sqrt(xValues.reduce((sum, val) => sum + Math.pow(val - xMean, 2), 0) / points.length);
  const yStd = Math.sqrt(yValues.reduce((sum, val) => sum + Math.pow(val - yMean, 2), 0) / points.length);
  const zStd = Math.sqrt(zValues.reduce((sum, val) => sum + Math.pow(val - zMean, 2), 0) / points.length);
  
  const stats = {
    count: points.length,
    xMin, xMax, yMin, yMax, zMin, zMax,
    xExtent: xMax - xMin,
    yExtent: yMax - yMin,
    zExtent: zMax - zMin,
    xMean, yMean, zMean,
    xStd, yStd, zStd
  };
  
  console.log(`[Analysis] Total points: ${stats.count}`);
  return stats;
}

/**
 * Calculate average nearest neighbor distance using simplified approach
 * @param {Array<{x: number, y: number, z: number}>} points - Array of points
 * @param {number} sampleSize - Maximum number of points to sample
 * @returns {number} Average nearest neighbor distance
 */
function calculateNearestNeighborDistance(points, sampleSize = 1000) {
  console.log('[Analysis] Calculating nearest neighbor distance...');
  
  // Sample points if dataset is large
  let samplePoints = points;
  if (points.length > sampleSize) {
    samplePoints = [];
    const step = Math.floor(points.length / sampleSize);
    for (let i = 0; i < points.length; i += step) {
      samplePoints.push(points[i]);
    }
    console.log(`[Analysis] Using ${samplePoints.length} sampled points for NN calculation`);
  }
  
  let totalDistance = 0;
  
  // For each point, find its nearest neighbor
  for (let i = 0; i < samplePoints.length; i++) {
    let minDist = Infinity;
    const p1 = samplePoints[i];
    
    for (let j = 0; j < samplePoints.length; j++) {
      if (i === j) continue;
      const p2 = samplePoints[j];
      
      const dist = Math.sqrt(
        Math.pow(p1.x - p2.x, 2) +
        Math.pow(p1.y - p2.y, 2) +
        Math.pow(p1.z - p2.z, 2)
      );
      
      if (dist < minDist) {
        minDist = dist;
      }
    }
    
    totalDistance += minDist;
  }
  
  const avgDistance = totalDistance / samplePoints.length;
  console.log(`[Analysis] Average nearest neighbor distance: ${avgDistance.toFixed(4)}`);
  
  return avgDistance;
}

/**
 * Create Z-value histogram as PNG buffer
 * @param {Array<{x: number, y: number, z: number}>} points - Array of points
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function createZHistogram(points) {
  console.log('[Visualization] Creating Z-histogram...');
  
  // Find min/max without spread operator to avoid stack overflow
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const point of points) {
    if (point.z < zMin) zMin = point.z;
    if (point.z > zMax) zMax = point.z;
  }
  
  const binCount = 20;
  const binSize = (zMax - zMin) / binCount;
  
  // Create bins
  const bins = new Array(binCount).fill(0);
  const labels = [];
  
  // Generate labels
  for (let i = 0; i < binCount; i++) {
    const binStart = zMin + i * binSize;
    labels.push(binStart.toFixed(2));
  }
  
  // Bin the points in a single pass
  for (const point of points) {
    const z = point.z;
    let binIndex = Math.floor((z - zMin) / binSize);
    
    // Handle edge case for maximum value
    if (binIndex >= binCount) binIndex = binCount - 1;
    if (binIndex < 0) binIndex = 0;
    
    bins[binIndex]++;
  }
  
  // Create chart
  const width = 600;
  const height = 350;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
  
  const configuration = {
    type: 'bar',
    data: {
      labels: labels,
      datasets: [{
        label: 'Z-value Distribution',
        data: bins,
        backgroundColor: 'rgba(33, 150, 243, 0.6)',
        borderColor: 'rgba(33, 150, 243, 1)',
        borderWidth: 1
      }]
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: 'Z-value Distribution',
          font: { size: 14, weight: 'bold' }
        },
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'Z-value (meters)',
            font: { size: 12 }
          },
          ticks: {
            maxRotation: 45,
            minRotation: 45,
            font: { size: 9 }
          }
        },
        y: {
          title: {
            display: true,
            text: 'Frequency (count)',
            font: { size: 12 }
          },
          ticks: {
            font: { size: 10 }
          }
        }
      }
    },
    plugins: [{
      id: 'background',
      beforeDraw: (chart) => {
        const ctx = chart.ctx;
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
      }
    }]
  };
  
  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  console.log('[Visualization] Z-histogram created');
  
  return buffer;
}

/**
 * Create 3D visualization as PNG buffer (simplified 2D projection)
 * @param {Array<{x: number, y: number, z: number}>} points - Array of points
 * @returns {Promise<Buffer>} PNG image buffer
 */
async function create3DVisualization(points) {
  console.log('[Visualization] Creating 3D point cloud visualization...');
  
  // Downsample for visualization if needed
  let visPoints = points;
  if (points.length > 50000) {
    visPoints = [];
    const step = Math.ceil(points.length / 50000);
    for (let i = 0; i < points.length; i += step) {
      visPoints.push(points[i]);
    }
    console.log(`[Visualization] Downsampled to ${visPoints.length} points for visualization`);
  }
  
  // Get Z range for coloring without spread operator to avoid stack overflow
  let zMin = Infinity;
  let zMax = -Infinity;
  for (const point of visPoints) {
    if (point.z < zMin) zMin = point.z;
    if (point.z > zMax) zMax = point.z;
  }
  const zRange = zMax - zMin || 1;
  
  // Create scatter plot with color based on Z
  const width = 600;
  const height = 450;
  const chartJSNodeCanvas = new ChartJSNodeCanvas({ width, height });
  
  // Prepare data with colors based on Z values
  const data = visPoints.map(p => {
    // Normalize Z to 0-1 range
    const normalized = (p.z - zMin) / zRange;
    // Use viridis-like color gradient (simplified)
    const r = Math.floor(255 * Math.max(0, Math.min(1, 1.5 - Math.abs(normalized - 0.5) * 2)));
    const g = Math.floor(255 * normalized);
    const b = Math.floor(255 * (1 - normalized));
    const color = `rgba(${r}, ${g}, ${b}, 0.6)`;
    
    return {
      x: p.x,
      y: p.y,
      backgroundColor: color,
      borderColor: color
    };
  });
  
  const configuration = {
    type: 'scatter',
    data: {
      datasets: [{
        label: 'Point Cloud',
        data: data,
        pointRadius: 2,
        pointBackgroundColor: data.map(d => d.backgroundColor),
        pointBorderColor: data.map(d => d.borderColor)
      }]
    },
    options: {
      responsive: false,
      plugins: {
        title: {
          display: true,
          text: '3D Point Cloud Visualization (X-Y Projection)',
          font: { size: 14, weight: 'bold' }
        },
        legend: {
          display: false
        }
      },
      scales: {
        x: {
          title: {
            display: true,
            text: 'X (meters)',
            font: { size: 11 }
          },
          ticks: {
            font: { size: 9 }
          }
        },
        y: {
          title: {
            display: true,
            text: 'Y (meters)',
            font: { size: 11 }
          },
          ticks: {
            font: { size: 9 }
          }
        }
      }
    },
    plugins: [{
      id: 'background',
      beforeDraw: (chart) => {
        const ctx = chart.ctx;
        ctx.save();
        ctx.fillStyle = 'white';
        ctx.fillRect(0, 0, chart.width, chart.height);
        ctx.restore();
      }
    },
    {
      id: 'colorLegend',
      afterDraw: (chart) => {
        const ctx = chart.ctx;
        const chartArea = chart.chartArea;
        
        // Legend dimensions and position
        const legendWidth = 20;
        const legendHeight = 200;
        const legendX = chartArea.right - legendWidth - 10;
        const legendY = chartArea.top + (chartArea.bottom - chartArea.top - legendHeight) / 2;
        
        // Draw gradient
        const gradient = ctx.createLinearGradient(legendX, legendY + legendHeight, legendX, legendY);
        
        // Create color stops matching the viridis-like gradient used in the data
        const steps = 20;
        for (let i = 0; i <= steps; i++) {
          const normalized = i / steps;
          const r = Math.floor(255 * Math.max(0, Math.min(1, 1.5 - Math.abs(normalized - 0.5) * 2)));
          const g = Math.floor(255 * normalized);
          const b = Math.floor(255 * (1 - normalized));
          gradient.addColorStop(i / steps, `rgb(${r}, ${g}, ${b})`);
        }
        
        ctx.save();
        ctx.fillStyle = gradient;
        ctx.fillRect(legendX, legendY, legendWidth, legendHeight);
        
        // Draw border
        ctx.strokeStyle = '#333';
        ctx.lineWidth = 1;
        ctx.strokeRect(legendX, legendY, legendWidth, legendHeight);
        
        // Add labels
        ctx.fillStyle = '#333';
        ctx.font = '10px sans-serif';
        ctx.textAlign = 'left';
        
        // Max depth label (top)
        const maxLabel = `${zMax.toFixed(2)} m`;
        ctx.fillText(maxLabel, legendX + legendWidth + 5, legendY + 5);
        
        // Min depth label (bottom)
        const minLabel = `${zMin.toFixed(2)} m`;
        ctx.fillText(minLabel, legendX + legendWidth + 5, legendY + legendHeight);
        
        // Middle label
        const midZ = (zMin + zMax) / 2;
        const midLabel = `${midZ.toFixed(2)} m`;
        ctx.fillText(midLabel, legendX + legendWidth + 5, legendY + legendHeight / 2);
        
        // "Depth (Z)" label
        ctx.save();
        ctx.translate(legendX - 5, legendY + legendHeight / 2);
        ctx.rotate(-Math.PI / 2);
        ctx.font = 'bold 11px sans-serif';
        ctx.textAlign = 'center';
        ctx.fillText('Depth (Z)', 0, 0);
        ctx.restore();
        
        ctx.restore();
      }
    }]
  };
  
  const buffer = await chartJSNodeCanvas.renderToBuffer(configuration);
  console.log('[Visualization] 3D visualization created');
  
  return buffer;
}

/**
 * Read metadata from .txt file
 * 
 * This function checks if a metadata .txt file exists in the same folder as the
 * imported .xyz file with the same name. If found, it reads all non-empty lines
 * from the file and returns them as an array.
 * 
 * Expected metadata format (example):
 * # Project: Test Project Name
 * # Location: Berlin, Germany
 * # CRS: EPSG:25832 (UTM Zone 32N)
 * # Scanner: Leica ScanStation P50
 * # Scan Date: 2025-12-19
 * # Operator: John Doe
 * # Weather: Clear, sunny
 * # Accuracy: ±2mm
 * # Software: Cyclone REGISTER 360
 * # Notes: High-quality scan with no obstructions
 * # Point Format: XYZ
 * # Units: Meters
 * 
 * @param {string} metadataFilePath - Path to the metadata .txt file
 * @returns {Array<string>|null} Array of metadata lines if file exists, null otherwise
 */
function readMetadata(metadataFilePath) {
  console.log(`[Metadata] Reading metadata from: ${metadataFilePath}`);
  
  try {
    // Step 1: Check if the metadata file exists
    if (fs.existsSync(metadataFilePath)) {
      // Step 2: Read the file content as UTF-8 text
      const content = fs.readFileSync(metadataFilePath, 'utf-8');
      
      // Step 3: Split content into lines and filter out empty lines
      const lines = content.split('\n').filter(line => line.trim() !== '');
      
      console.log(`[Metadata] Found ${lines.length} lines of metadata`);
      return lines;
    } else {
      // No metadata file found - this is not an error, just log it
      console.log('[Metadata] No metadata file found');
      return null;
    }
  } catch (error) {
    // Handle any errors during file reading (e.g., permission issues)
    console.error('[Metadata] Error reading metadata file:', error.message);
    return null;
  }
}

/**
 * Generate PDF report
 * @param {Array<{x: number, y: number, z: number}>} points - Array of points
 * @param {Object} stats - Statistics object
 * @param {number} avgNNDistance - Average nearest neighbor distance
 * @param {Buffer} histogramBuffer - Histogram image buffer
 * @param {Buffer} vizBuffer - 3D visualization image buffer
 * @param {string} outputPath - Path where PDF will be saved
 * @param {string} originalFilename - Original input filename
 * @param {Array<string>|null} metadata - Optional metadata lines to include in report
 * @returns {Promise<string>} Output path
 */
async function generatePDFReport(points, stats, avgNNDistance, histogramBuffer, vizBuffer, outputPath, originalFilename, metadata = null) {
  console.log('[Report] Generating PDF report...');
  
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({
        size: 'LETTER',
        margins: { top: 36, bottom: 36, left: 43, right: 43 }
      });
      
      const stream = fs.createWriteStream(outputPath);
      doc.pipe(stream);
      
      // Title
      doc.fontSize(16)
         .font('Helvetica-Bold')
         .fillColor('#1a1a1a')
         .text('Point Cloud Analysis Report', { align: 'center' });
      
      doc.moveDown(0.3);
      
      // Subtitle
      const now = new Date();
      const dateStr = now.toISOString().split('T')[0] + ' ' + now.toTimeString().split(' ')[0];
      doc.fontSize(9)
         .font('Helvetica-Oblique')
         .fillColor('#2c3e50')
         .text(`File: ${originalFilename} | Generated: ${dateStr}`, { align: 'left' });
      
      doc.moveDown(0.5);
      
      // Description
      doc.fontSize(9)
         .font('Helvetica')
         .text(
           'This report provides a statistical analysis and visualization of the uploaded point cloud data, ' +
           'including spatial extent, distribution metrics, and 3D visualization with height-based coloring.',
           { align: 'left' }
         );
      
      doc.moveDown(0.5);
      
      // ========================================
      // METADATA SECTION
      // ========================================
      // Add Project Information section if metadata was provided
      // Metadata is read from a .txt file with the same name as the .xyz file
      // This section includes project details like location, scanner, operator, etc.
      if (metadata && metadata.length > 0) {
        // Section title
        doc.fontSize(11)
           .font('Helvetica-Bold')
           .fillColor('#2c3e50')
           .text('Project Information');
        
        doc.moveDown(0.3);
        
        // Display each metadata line in a formatted way
        doc.fontSize(8)
           .font('Helvetica')
           .fillColor('#2c3e50');
        
        // Iterate through all metadata lines and add them to the PDF
        metadata.forEach(line => {
          doc.text(line, { align: 'left' });
        });
        
        doc.moveDown(0.5);
      }
      
      // Statistics Section
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#2c3e50')
         .text('Statistical Summary');
      
      doc.moveDown(0.3);
      
      // Create statistics table
      const tableTop = doc.y;
      const colWidth = 130;
      const rowHeight = 20;
      const col1X = 50;
      const col2X = col1X + colWidth;
      const col3X = col2X + colWidth;
      const col4X = col3X + colWidth;
      
      // Helper function to draw table row
      function drawTableRow(y, values, isBold = false, bgColor = null) {
        if (bgColor) {
          doc.rect(col1X, y, colWidth * 4, rowHeight).fill(bgColor);
        }
        
        const font = isBold ? 'Helvetica-Bold' : 'Helvetica';
        const fontSize = isBold ? 9 : 8;
        
        doc.fontSize(fontSize)
           .font(font)
           .fillColor('#2c3e50');
        
        if (values[0]) doc.text(values[0], col1X + 5, y + 5, { width: colWidth - 10, height: rowHeight });
        if (values[1]) doc.text(values[1], col2X + 5, y + 5, { width: colWidth - 10, height: rowHeight });
        if (values[2]) doc.text(values[2], col3X + 5, y + 5, { width: colWidth - 10, height: rowHeight });
        if (values[3]) doc.text(values[3], col4X + 5, y + 5, { width: colWidth - 10, height: rowHeight });
        
        // Draw borders
        doc.strokeColor('#888888')
           .lineWidth(0.5)
           .rect(col1X, y, colWidth * 4, rowHeight)
           .stroke();
      }
      
      // Header row
      drawTableRow(tableTop, ['Metric', 'Value', 'Metric', 'Value'], true, '#3498db');
      doc.fillColor('white');
      doc.text('Metric', col1X + 5, tableTop + 5, { width: colWidth - 10 });
      doc.text('Value', col2X + 5, tableTop + 5, { width: colWidth - 10 });
      doc.text('Metric', col3X + 5, tableTop + 5, { width: colWidth - 10 });
      doc.text('Value', col4X + 5, tableTop + 5, { width: colWidth - 10 });
      
      // Data rows
      let currentY = tableTop + rowHeight;
      const rows = [
        ['Total Points', stats.count.toLocaleString(), 'X Extent (m)', stats.xExtent.toFixed(3)],
        ['X Mean (m)', stats.xMean.toFixed(3), 'Y Extent (m)', stats.yExtent.toFixed(3)],
        ['Y Mean (m)', stats.yMean.toFixed(3), 'Z Extent (m)', stats.zExtent.toFixed(3)],
        ['Z Mean (m)', stats.zMean.toFixed(3), 'X Std Dev (m)', stats.xStd.toFixed(3)],
        ['Y Std Dev (m)', stats.yStd.toFixed(3), 'Z Std Dev (m)', stats.zStd.toFixed(3)],
        ['Avg NN Distance (m)', avgNNDistance.toFixed(4), '', '']
      ];
      
      rows.forEach(row => {
        drawTableRow(currentY, row, false, '#ecf0f1');
        currentY += rowHeight;
      });
      
      doc.moveDown(1.5);
      
      // Visualizations Section
      doc.y = currentY + 10;
      doc.fontSize(11)
         .font('Helvetica-Bold')
         .fillColor('#2c3e50')
         .text('Visualizations');
      
      doc.moveDown(0.5);
      
      // Place images side by side
      const imgWidth = 240;
      const imgHeight1 = 180;
      const imgHeight2 = 220;
      const imgY = doc.y;
      
      doc.image(histogramBuffer, col1X, imgY, { width: imgWidth, height: imgHeight1 });
      doc.image(vizBuffer, col1X + imgWidth + 20, imgY, { width: imgWidth, height: imgHeight2 });
      
      doc.end();
      
      stream.on('finish', () => {
        const stats = fs.statSync(outputPath);
        const fileSizeMB = stats.size / (1024 * 1024);
        console.log(`[Report] PDF generated successfully: ${outputPath}`);
        console.log(`[Report] File size: ${fileSizeMB.toFixed(2)} MB`);
        
        if (fileSizeMB > 2.0) {
          console.log('[Report] WARNING: File size exceeds 2 MB limit!');
        }
        
        resolve(outputPath);
      });
      
      stream.on('error', reject);
      
    } catch (error) {
      reject(error);
    }
  });
}

/**
 * Main function to generate report
 * @param {string} inputFile - Path to input XYZ file
 * @param {string} outputFile - Path to output PDF file
 * @param {string} originalFilename - Original filename for display in report
 * @returns {Promise<Object>} Result object with success status
 */
async function generateReport(inputFile, outputFile, originalFilename = null) {
  console.log('\n' + '='.repeat(60));
  console.log('POINT CLOUD ANALYSIS AND REPORT GENERATION (JavaScript)');
  console.log('='.repeat(60));
  
  try {
    // Parse input file
    const points = parseXYZFile(inputFile);
    
    // Calculate statistics
    const stats = calculateStatistics(points);
    
    // Calculate average nearest neighbor distance
    const avgNNDistance = calculateNearestNeighborDistance(points);
    
    // Create visualizations
    const histogramBuffer = await createZHistogram(points);
    const vizBuffer = await create3DVisualization(points);
    
    // ========================================
    // METADATA FILE HANDLING
    // ========================================
    // Step 1: Check for metadata file
    // The metadata file should have the same name as the input file but with .txt extension
    // For example, if input is "scan-data.xyz", look for "scan-data.txt"
    
    // Get the directory where the input file is located
    const inputDir = path.dirname(inputFile);
    
    // Get the base filename without extension (e.g., "scan-data.xyz" -> "scan-data")
    const inputBasename = path.basename(inputFile, path.extname(inputFile));
    
    // Construct the full path to the metadata file
    const metadataFilePath = path.join(inputDir, inputBasename + '.txt');
    
    console.log(`[Metadata] Checking for metadata file: ${metadataFilePath}`);
    
    // Step 2: Read metadata if the file exists
    // If the file doesn't exist, readMetadata() will return null and the report
    // will be generated without the Project Information section
    const metadata = readMetadata(metadataFilePath);
    
    // Step 3: Generate PDF report with or without metadata
    const displayFilename = originalFilename || path.basename(inputFile);
    await generatePDFReport(
      points, stats, avgNNDistance,
      histogramBuffer, vizBuffer,
      outputFile, displayFilename, metadata
    );
    
    console.log('='.repeat(60));
    console.log('REPORT GENERATION COMPLETED SUCCESSFULLY');
    console.log('='.repeat(60) + '\n');
    
    const fileStats = fs.statSync(outputFile);
    return {
      success: true,
      outputFile: outputFile,
      fileSizeMB: parseFloat((fileStats.size / (1024 * 1024)).toFixed(2)),
      pointCount: stats.count
    };
    
  } catch (error) {
    console.error('ERROR:', error.message);
    return {
      success: false,
      error: error.message
    };
  }
}

// If run directly (not imported as module)
if (require.main === module) {
  const args = process.argv.slice(2);
  
  if (args.length < 2) {
    console.error('Usage: node generateReport.js <input_file> <output_file>');
    process.exit(1);
  }
  
  const [inputFile, outputFile] = args;
  
  generateReport(inputFile, outputFile)
    .then(result => {
      console.log('JSON_RESULT:' + JSON.stringify(result));
      process.exit(result.success ? 0 : 1);
    })
    .catch(error => {
      console.error('ERROR:', error);
      console.log('JSON_RESULT:' + JSON.stringify({ success: false, error: error.message }));
      process.exit(1);
    });
}

module.exports = { generateReport, readMetadata };
