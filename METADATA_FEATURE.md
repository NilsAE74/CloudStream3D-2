# Metadata Feature Documentation

## Overview

This document describes the metadata feature added to the PDF report generation functionality. The feature allows users to include project information in PDF reports by either reading from existing metadata files or collecting information through an interactive form.

## Feature Description

When generating a PDF report for a point cloud file (.xyz, .csv, or .txt), the system now:

1. **Automatically checks** for a metadata file with the same name as the data file but with a `.txt` extension
2. **Reads and includes** the metadata in the PDF report if the file exists
3. **Prompts the user** to fill in a metadata form if no file exists
4. **Saves the metadata** to a `.txt` file for future use

## Workflow

### Scenario 1: Metadata File Already Exists

```
User clicks "Generate PDF Report"
  ↓
System checks for metadata file (e.g., scan-data.txt)
  ↓
Metadata file found
  ↓
System reads metadata lines
  ↓
PDF generated with metadata included
  ↓
PDF downloaded to user's computer
```

### Scenario 2: No Metadata File Exists

```
User clicks "Generate PDF Report"
  ↓
System checks for metadata file
  ↓
Metadata file not found
  ↓
System shows metadata form to user
  ↓
User fills in project information
  ↓
User clicks "Save & Generate Report"
  ↓
System saves metadata to .txt file
  ↓
PDF generated with metadata included
  ↓
PDF downloaded to user's computer
```

## Technical Implementation

### Backend Components

#### 1. Modified Files

- **`server/utils/generateReport.js`**
  - Added `readMetadata()` function to read metadata from .txt files
  - Modified `generatePDFReport()` to include metadata section in PDF
  - Modified `generateReport()` to check for and read metadata files
  - Added comprehensive comments explaining each step

- **`server/index.js`**
  - Added `/api/check-metadata` endpoint to check if metadata file exists
  - Added `/api/save-metadata` endpoint to save metadata to .txt files
  - Implemented input validation and sanitization for security

#### 2. New API Endpoints

**`POST /api/check-metadata`**

Request body:
```json
{
  "fileId": "uploaded-file-name.xyz"
}
```

Response:
```json
{
  "exists": true,
  "metadataFilePath": "/path/to/uploaded-file-name.txt",
  "metadata": [
    "# Project: Example Project",
    "# Location: Berlin, Germany",
    ...
  ]
}
```

**`POST /api/save-metadata`**

Request body:
```json
{
  "fileId": "uploaded-file-name.xyz",
  "metadata": [
    "# Project: Example Project",
    "# Location: Berlin, Germany",
    ...
  ]
}
```

Response:
```json
{
  "success": true,
  "metadataFilePath": "/path/to/uploaded-file-name.txt",
  "message": "Metadata saved successfully"
}
```

#### 3. Security Features

- **Input Validation**: All metadata lines are validated for:
  - Type (must be strings)
  - Length (max 500 characters per line)
  - Count (max 100 lines)
  - Content (no control characters except newline and tab)
  
- **File System Protection**: Metadata is only saved to files in the uploads directory with validated filenames

### Frontend Components

#### 1. New Component

**`client/src/components/MetadataDialog/MetadataDialog.js`**
- React dialog component for collecting metadata
- Pre-populated with default template fields:
  - Project
  - Location
  - CRS (Coordinate Reference System)
  - Scanner
  - Scan Date
  - Operator
  - Weather
  - Accuracy
  - Software
  - Notes
  - Point Format
  - Units

#### 2. Modified Component

**`client/src/components/LeftPanel/LeftPanel.js`**
- Updated `handleGenerateReport()` to check for metadata first
- Added `handleSaveMetadata()` to save metadata from form
- Added `generatePDFReport()` to perform actual PDF generation
- Integrated MetadataDialog component
- Added comprehensive comments explaining the workflow

## Metadata File Format

Metadata files should be plain text files with the `.txt` extension and the same base name as the data file.

### Example

For a data file named `scan-2025-12-19.xyz`, the metadata file should be named `scan-2025-12-19.txt`.

### Content Format

```
# Project: Highway Bridge Inspection
# Location: Berlin, Germany
# CRS: EPSG:25832 (UTM Zone 32N)
# Scanner: Leica ScanStation P50
# Scan Date: 2025-12-19
# Operator: John Doe
# Weather: Clear, sunny
# Accuracy: ±2mm
# Software: Cyclone REGISTER 360
# Notes: High-quality scan with no obstructions
# Point Format: XYZ
# Units: Meters
```

Each line typically starts with `#` followed by a field name, colon, and value. However, the format is flexible and any text content is supported.

## PDF Report Output

When metadata is included, the PDF report contains a new section titled "Project Information" that appears before the statistical summary. All metadata lines are displayed in order as provided in the .txt file.

### Report Structure with Metadata

```
┌─────────────────────────────────────┐
│  Point Cloud Analysis Report       │
│                                     │
│  File: scan-data.xyz               │
│  Generated: 2025-12-19 14:50:00    │
│                                     │
│  [Description]                      │
│                                     │
│  Project Information                │
│  # Project: ...                     │
│  # Location: ...                    │
│  ...                                │
│                                     │
│  Statistical Summary                │
│  [Statistics table]                 │
│                                     │
│  Visualizations                     │
│  [Histogram] [3D Visualization]     │
└─────────────────────────────────────┘
```

## Usage Instructions

### For End Users

1. **Upload a point cloud file** (CSV, XYZ, or TXT) using the web interface
2. **Click "Generate PDF Report"** button next to the uploaded file
3. If prompted with a metadata form:
   - Fill in the relevant project information fields
   - Click "Save & Generate Report"
4. Wait for the PDF to be generated and downloaded

### For Developers

#### Creating Metadata Files Manually

You can create metadata files manually by:
1. Creating a `.txt` file with the same name as your data file
2. Adding metadata lines in the desired format
3. Placing the file in the same directory as the data file

#### Programmatic Access

```javascript
// Check if metadata exists
const response = await axios.post('/api/check-metadata', {
  fileId: 'my-scan.xyz'
});

if (!response.data.exists) {
  // Save new metadata
  await axios.post('/api/save-metadata', {
    fileId: 'my-scan.xyz',
    metadata: [
      '# Project: My Project',
      '# Location: City, Country'
    ]
  });
}
```

## Testing

### Automated Test Suite

A comprehensive test suite has been created to verify metadata functionality. The test suite includes:

1. **Test 1: Read Existing Metadata** - Verifies that metadata files are correctly read when they exist
2. **Test 2: Report Generation Without Metadata** - Verifies report generation works without metadata
3. **Test 3: Report Generation With Metadata** - Verifies metadata is included in reports when available
4. **Test 4: Metadata File Creation** - Verifies the workflow for creating new metadata files
5. **Test 5: Empty Metadata File Handling** - Verifies handling of empty metadata files

#### Running the Tests

```bash
# Run all metadata tests
npm test

# Or run directly
npm run test:metadata

# Or run the test file directly
node server/utils/generateReport.test.js
```

#### Test Output

When all tests pass, you'll see:

```
============================================================
METADATA FUNCTIONALITY TEST SUITE
============================================================

=== Test 1: Read Existing Metadata ===
✓ Created test metadata file
✓ Metadata file exists
✓ Metadata was read successfully
✓ Metadata has correct number of lines: 6
✓ All metadata lines match expected content
✅ Test 1 PASSED: Metadata file is read correctly when it exists

[... additional tests ...]

============================================================
TEST SUMMARY
============================================================

Total tests: 5
Passed: 5
Failed: 0

🎉 All tests PASSED!
```

### Manual Testing

1. **Test with existing metadata:**
   ```bash
   # Create test files
   cp sample-data.xyz uploads/test-with-metadata.xyz
   echo "# Project: Test Project" > uploads/test-with-metadata.txt
   
   # Generate report
   node server/utils/generateReport.js uploads/test-with-metadata.xyz uploads/test-report.pdf
   ```

2. **Test without metadata:**
   ```bash
   # Create test file without metadata
   cp sample-data.xyz uploads/test-no-metadata.xyz
   
   # Generate report (will work without metadata)
   node server/utils/generateReport.js uploads/test-no-metadata.xyz uploads/test-report.pdf
   ```

### API Testing

```bash
# Test check-metadata endpoint
curl -X POST http://localhost:5000/api/check-metadata \
  -H "Content-Type: application/json" \
  -d '{"fileId": "test-data.xyz"}'

# Test save-metadata endpoint
curl -X POST http://localhost:5000/api/save-metadata \
  -H "Content-Type: application/json" \
  -d '{"fileId": "test-data.xyz", "metadata": ["# Project: Test", "# Location: Test City"]}'
```

## Limitations and Considerations

1. **File Size**: Metadata files are kept small (max 100 lines, 500 chars per line) to ensure fast loading and processing
2. **Character Encoding**: Files are saved as UTF-8 text
3. **Overwriting**: Saving metadata will overwrite any existing metadata file with the same name
4. **Rate Limiting**: The API endpoints do not currently have rate limiting - consider adding this for production deployments with public access
5. **Validation**: While input is validated, users should still review metadata before generating reports

## Future Enhancements

Potential improvements for future versions:

1. **Metadata Templates**: Allow users to save and reuse metadata templates
2. **Metadata Editing**: Add ability to edit existing metadata through the UI
3. **Format Validation**: Validate specific fields (e.g., date format, CRS format)
4. **Metadata Preview**: Show metadata preview before generating report
5. **Bulk Operations**: Apply same metadata to multiple files
6. **Rate Limiting**: Add rate limiting to API endpoints for production use
7. **Metadata History**: Track changes to metadata over time

## Support

For issues or questions related to the metadata feature, please refer to:
- Main README.md for general application information
- Code comments in modified files for technical details
- GitHub issues for bug reports and feature requests
