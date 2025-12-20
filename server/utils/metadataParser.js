/**
 * Metadata Parser Utility
 * 
 * This module provides functions to parse metadata between two formats:
 * 1. Array of strings (file format): ["# Project: Value", "# Location: Value", ...]
 * 2. Structured object (API format): { project: "Value", location: "Value", ... }
 * 
 * This allows the frontend to work with a structured object while maintaining
 * compatibility with the existing file-based metadata storage format.
 */

// Default CRS commonly used in Germany for UTM Zone 32N
// This can be customized based on your project's geographic location
const DEFAULT_CRS = 'EPSG:25832 (UTM Zone 32N)';

/**
 * Parse metadata lines into a structured object
 * 
 * Converts metadata from file format to API format:
 * Input:  ["# Project: Highway Bridge", "# Location: Berlin", ...]
 * Output: { project: "Highway Bridge", location: "Berlin", ... }
 * 
 * @param {Array<string>} metadataLines - Array of metadata lines from file
 * @returns {Object} Structured metadata object
 */
function parseMetadataToObject(metadataLines) {
  const metadata = {
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
  };

  if (!metadataLines || !Array.isArray(metadataLines)) {
    return metadata;
  }

  metadataLines.forEach(line => {
    const trimmed = line.trim();
    if (!trimmed || !trimmed.startsWith('#')) return;

    // Remove leading '#' and split by first ':'
    const withoutHash = trimmed.substring(1).trim();
    const colonIndex = withoutHash.indexOf(':');
    
    if (colonIndex === -1) return;

    const key = withoutHash.substring(0, colonIndex).trim().toLowerCase();
    const value = withoutHash.substring(colonIndex + 1).trim();

    // Map the key to the corresponding field in our object
    // Handle variations in naming
    switch (key) {
      case 'project':
        metadata.project = value;
        break;
      case 'location':
        metadata.location = value;
        break;
      case 'crs':
        metadata.crs = value;
        break;
      case 'scanner':
        metadata.scanner = value;
        break;
      case 'scan date':
        metadata.scanDate = value;
        break;
      case 'operator':
        metadata.operator = value;
        break;
      case 'weather':
        metadata.weather = value;
        break;
      case 'accuracy':
        metadata.accuracy = value;
        break;
      case 'software':
        metadata.software = value;
        break;
      case 'notes':
        metadata.notes = value;
        break;
      case 'point format':
        metadata.pointFormat = value;
        break;
      case 'units':
        metadata.units = value;
        break;
    }
  });

  return metadata;
}

/**
 * Convert structured metadata object back to metadata lines
 * 
 * Converts metadata from API format back to file format:
 * Input:  { project: "Highway Bridge", location: "Berlin", ... }
 * Output: ["# Project: Highway Bridge", "# Location: Berlin", ...]
 * 
 * @param {Object} metadataObj - Structured metadata object
 * @returns {Array<string>} Array of metadata lines for file storage
 */
function convertObjectToMetadataLines(metadataObj) {
  const lines = [];

  // Define the order and labels for metadata fields
  const fieldMap = [
    { key: 'project', label: 'Project' },
    { key: 'location', label: 'Location' },
    { key: 'crs', label: 'CRS' },
    { key: 'scanner', label: 'Scanner' },
    { key: 'scanDate', label: 'Scan Date' },
    { key: 'operator', label: 'Operator' },
    { key: 'weather', label: 'Weather' },
    { key: 'accuracy', label: 'Accuracy' },
    { key: 'software', label: 'Software' },
    { key: 'notes', label: 'Notes' },
    { key: 'pointFormat', label: 'Point Format' },
    { key: 'units', label: 'Units' }
  ];

  fieldMap.forEach(({ key, label }) => {
    const value = metadataObj[key] || '';
    lines.push(`# ${label}: ${value}`);
  });

  return lines;
}

/**
 * Get default/empty metadata object
 * 
 * @returns {Object} Empty metadata object with all fields
 */
function getDefaultMetadata() {
  return {
    project: '',
    location: '',
    crs: DEFAULT_CRS,
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
}

module.exports = {
  parseMetadataToObject,
  convertObjectToMetadataLines,
  getDefaultMetadata,
  DEFAULT_CRS
};
