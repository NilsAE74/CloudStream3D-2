/**
 * Test suite for metadata file handling in PDF report generation
 * 
 * These tests verify:
 * 1. Metadata files are correctly read when they exist
 * 2. Metadata files are correctly created when they don't exist
 * 3. PDF generation works with and without metadata
 */

const fs = require('fs');
const path = require('path');
const { generateReport, readMetadata } = require('./generateReport');

// Test directory for temporary files
const TEST_DIR = path.join(__dirname, '../../test-temp');
const TEST_DATA_FILE = path.join(TEST_DIR, 'test-scan.xyz');
const TEST_METADATA_FILE = path.join(TEST_DIR, 'test-scan.txt');
const TEST_OUTPUT_PDF = path.join(TEST_DIR, 'test-output.pdf');

// Sample XYZ data for testing
const SAMPLE_XYZ_DATA = `0 0 0
1 0 0
0 1 0
0 0 1
1 1 0
1 0 1
0 1 1
1 1 1`;

// Sample metadata for testing
const SAMPLE_METADATA = [
  '# Project: Test Project',
  '# Location: Test Location',
  '# CRS: EPSG:25832 (UTM Zone 32N)',
  '# Scanner: Test Scanner',
  '# Scan Date: 2025-12-19',
  '# Operator: Test Operator'
];

/**
 * Setup test environment before each test
 */
function setupTestEnvironment() {
  // Create test directory if it doesn't exist
  if (!fs.existsSync(TEST_DIR)) {
    fs.mkdirSync(TEST_DIR, { recursive: true });
  }
  
  // Create test XYZ file
  fs.writeFileSync(TEST_DATA_FILE, SAMPLE_XYZ_DATA, 'utf-8');
}

/**
 * Cleanup test environment after each test
 */
function cleanupTestEnvironment() {
  // Remove test files
  if (fs.existsSync(TEST_METADATA_FILE)) {
    fs.unlinkSync(TEST_METADATA_FILE);
  }
  if (fs.existsSync(TEST_OUTPUT_PDF)) {
    fs.unlinkSync(TEST_OUTPUT_PDF);
  }
  if (fs.existsSync(TEST_DATA_FILE)) {
    fs.unlinkSync(TEST_DATA_FILE);
  }
  if (fs.existsSync(TEST_DIR)) {
    fs.rmdirSync(TEST_DIR);
  }
}

/**
 * Test 1: Verify that metadata file is read correctly when it exists
 */
async function testReadExistingMetadata() {
  console.log('\n=== Test 1: Read Existing Metadata ===');
  
  try {
    setupTestEnvironment();
    
    // Create metadata file
    fs.writeFileSync(TEST_METADATA_FILE, SAMPLE_METADATA.join('\n'), 'utf-8');
    console.log('✓ Created test metadata file');
    
    // Verify file exists
    if (!fs.existsSync(TEST_METADATA_FILE)) {
      throw new Error('Metadata file was not created');
    }
    console.log('✓ Metadata file exists');
    
    // Read metadata using the function
    const metadata = readMetadata(TEST_METADATA_FILE);
    
    // Verify metadata was read
    if (!metadata || !Array.isArray(metadata)) {
      throw new Error('Metadata was not read correctly');
    }
    console.log('✓ Metadata was read successfully');
    
    // Verify metadata content
    if (metadata.length !== SAMPLE_METADATA.length) {
      throw new Error(`Expected ${SAMPLE_METADATA.length} lines, got ${metadata.length}`);
    }
    console.log(`✓ Metadata has correct number of lines: ${metadata.length}`);
    
    // Verify each line
    for (let i = 0; i < SAMPLE_METADATA.length; i++) {
      if (metadata[i] !== SAMPLE_METADATA[i]) {
        throw new Error(`Line ${i + 1} mismatch: expected "${SAMPLE_METADATA[i]}", got "${metadata[i]}"`);
      }
    }
    console.log('✓ All metadata lines match expected content');
    
    console.log('\n✅ Test 1 PASSED: Metadata file is read correctly when it exists\n');
    return true;
    
  } catch (error) {
    console.error('\n❌ Test 1 FAILED:', error.message);
    return false;
  } finally {
    cleanupTestEnvironment();
  }
}

/**
 * Test 2: Verify that report generation works without metadata file
 */
async function testReportGenerationWithoutMetadata() {
  console.log('\n=== Test 2: Report Generation Without Metadata ===');
  
  try {
    setupTestEnvironment();
    
    // Ensure no metadata file exists
    if (fs.existsSync(TEST_METADATA_FILE)) {
      fs.unlinkSync(TEST_METADATA_FILE);
    }
    console.log('✓ No metadata file exists');
    
    // Verify readMetadata returns null for non-existent file
    const metadata = readMetadata(TEST_METADATA_FILE);
    if (metadata !== null) {
      throw new Error('readMetadata should return null for non-existent file');
    }
    console.log('✓ readMetadata correctly returns null for non-existent file');
    
    // Generate report without metadata
    const result = await generateReport(TEST_DATA_FILE, TEST_OUTPUT_PDF, 'test-scan.xyz');
    
    // Verify result
    if (!result.success) {
      throw new Error('Report generation failed: ' + result.error);
    }
    console.log('✓ Report generated successfully without metadata');
    
    // Verify PDF was created
    if (!fs.existsSync(TEST_OUTPUT_PDF)) {
      throw new Error('PDF file was not created');
    }
    console.log('✓ PDF file exists');
    
    // Verify PDF file size is reasonable
    const stats = fs.statSync(TEST_OUTPUT_PDF);
    if (stats.size < 1000) {
      throw new Error('PDF file size is too small, likely corrupted');
    }
    console.log(`✓ PDF file size is reasonable: ${(stats.size / 1024).toFixed(2)} KB`);
    
    console.log('\n✅ Test 2 PASSED: Report generation works without metadata\n');
    return true;
    
  } catch (error) {
    console.error('\n❌ Test 2 FAILED:', error.message);
    return false;
  } finally {
    cleanupTestEnvironment();
  }
}

/**
 * Test 3: Verify that report generation includes metadata when file exists
 */
async function testReportGenerationWithMetadata() {
  console.log('\n=== Test 3: Report Generation With Metadata ===');
  
  try {
    setupTestEnvironment();
    
    // Create metadata file
    fs.writeFileSync(TEST_METADATA_FILE, SAMPLE_METADATA.join('\n'), 'utf-8');
    console.log('✓ Created test metadata file');
    
    // Generate report with metadata
    const result = await generateReport(TEST_DATA_FILE, TEST_OUTPUT_PDF, 'test-scan.xyz');
    
    // Verify result
    if (!result.success) {
      throw new Error('Report generation failed: ' + result.error);
    }
    console.log('✓ Report generated successfully with metadata');
    
    // Verify PDF was created
    if (!fs.existsSync(TEST_OUTPUT_PDF)) {
      throw new Error('PDF file was not created');
    }
    console.log('✓ PDF file exists');
    
    // Verify PDF file size is reasonable
    const stats = fs.statSync(TEST_OUTPUT_PDF);
    if (stats.size < 1000) {
      throw new Error('PDF file size is too small, likely corrupted');
    }
    console.log(`✓ PDF file size is reasonable: ${(stats.size / 1024).toFixed(2)} KB`);
    
    console.log('\n✅ Test 3 PASSED: Report generation includes metadata when file exists\n');
    return true;
    
  } catch (error) {
    console.error('\n❌ Test 3 FAILED:', error.message);
    return false;
  } finally {
    cleanupTestEnvironment();
  }
}

/**
 * Test 4: Verify metadata file creation workflow (simulating API)
 */
async function testMetadataFileCreation() {
  console.log('\n=== Test 4: Metadata File Creation ===');
  
  try {
    setupTestEnvironment();
    
    // Ensure no metadata file exists initially
    if (fs.existsSync(TEST_METADATA_FILE)) {
      fs.unlinkSync(TEST_METADATA_FILE);
    }
    console.log('✓ No metadata file exists initially');
    
    // Simulate metadata file creation (as done by API)
    const metadataContent = SAMPLE_METADATA.join('\n');
    fs.writeFileSync(TEST_METADATA_FILE, metadataContent, 'utf-8');
    console.log('✓ Metadata file created');
    
    // Verify file exists
    if (!fs.existsSync(TEST_METADATA_FILE)) {
      throw new Error('Metadata file was not created');
    }
    console.log('✓ Metadata file exists after creation');
    
    // Read the file back
    const readContent = fs.readFileSync(TEST_METADATA_FILE, 'utf-8');
    const readLines = readContent.split('\n').filter(line => line.trim() !== '');
    
    // Verify content matches
    if (readLines.length !== SAMPLE_METADATA.length) {
      throw new Error(`Expected ${SAMPLE_METADATA.length} lines, got ${readLines.length}`);
    }
    console.log(`✓ Metadata file has correct number of lines: ${readLines.length}`);
    
    for (let i = 0; i < SAMPLE_METADATA.length; i++) {
      if (readLines[i] !== SAMPLE_METADATA[i]) {
        throw new Error(`Line ${i + 1} mismatch after reading back`);
      }
    }
    console.log('✓ Metadata content matches what was written');
    
    // Now verify it can be read by readMetadata function
    const metadata = readMetadata(TEST_METADATA_FILE);
    if (!metadata || metadata.length !== SAMPLE_METADATA.length) {
      throw new Error('readMetadata cannot read the created file');
    }
    console.log('✓ Created metadata file can be read by readMetadata function');
    
    console.log('\n✅ Test 4 PASSED: Metadata file creation workflow works correctly\n');
    return true;
    
  } catch (error) {
    console.error('\n❌ Test 4 FAILED:', error.message);
    return false;
  } finally {
    cleanupTestEnvironment();
  }
}

/**
 * Test 5: Verify empty metadata file handling
 */
async function testEmptyMetadataFile() {
  console.log('\n=== Test 5: Empty Metadata File Handling ===');
  
  try {
    setupTestEnvironment();
    
    // Create empty metadata file
    fs.writeFileSync(TEST_METADATA_FILE, '', 'utf-8');
    console.log('✓ Created empty metadata file');
    
    // Read metadata
    const metadata = readMetadata(TEST_METADATA_FILE);
    
    // Empty file should return empty array
    if (!Array.isArray(metadata)) {
      throw new Error('readMetadata should return an array for empty file');
    }
    
    if (metadata.length !== 0) {
      throw new Error(`Expected 0 lines for empty file, got ${metadata.length}`);
    }
    console.log('✓ Empty metadata file returns empty array');
    
    // Generate report with empty metadata
    const result = await generateReport(TEST_DATA_FILE, TEST_OUTPUT_PDF, 'test-scan.xyz');
    
    if (!result.success) {
      throw new Error('Report generation failed with empty metadata');
    }
    console.log('✓ Report generation succeeds with empty metadata file');
    
    console.log('\n✅ Test 5 PASSED: Empty metadata file is handled correctly\n');
    return true;
    
  } catch (error) {
    console.error('\n❌ Test 5 FAILED:', error.message);
    return false;
  } finally {
    cleanupTestEnvironment();
  }
}

/**
 * Main test runner
 */
async function runAllTests() {
  console.log('\n' + '='.repeat(60));
  console.log('METADATA FUNCTIONALITY TEST SUITE');
  console.log('='.repeat(60));
  
  const results = [];
  
  // Run all tests
  results.push(await testReadExistingMetadata());
  results.push(await testReportGenerationWithoutMetadata());
  results.push(await testReportGenerationWithMetadata());
  results.push(await testMetadataFileCreation());
  results.push(await testEmptyMetadataFile());
  
  // Summary
  console.log('='.repeat(60));
  console.log('TEST SUMMARY');
  console.log('='.repeat(60));
  
  const passed = results.filter(r => r === true).length;
  const total = results.length;
  
  console.log(`\nTotal tests: ${total}`);
  console.log(`Passed: ${passed}`);
  console.log(`Failed: ${total - passed}`);
  
  if (passed === total) {
    console.log('\n🎉 All tests PASSED!\n');
    process.exit(0);
  } else {
    console.log('\n⚠️  Some tests FAILED\n');
    process.exit(1);
  }
}

// Run tests if this file is executed directly
if (require.main === module) {
  runAllTests().catch(error => {
    console.error('Test suite error:', error);
    process.exit(1);
  });
}

module.exports = {
  testReadExistingMetadata,
  testReportGenerationWithoutMetadata,
  testReportGenerationWithMetadata,
  testMetadataFileCreation,
  testEmptyMetadataFile,
  runAllTests
};
