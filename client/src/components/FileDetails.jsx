import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FileDetailsSection from './FileDetailsSection';
import MetadataViewer from './MetadataViewer';
import ErrorAlert from './ErrorAlert';
import SuccessAlert from './SuccessAlert';

export default function FileDetails({ file, onDelete, onExport, onGenerateReport }) {
  const navigate = useNavigate();
  const [isExporting, setIsExporting] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);

  const handleExport = async () => {
    setIsExporting(true);
    setError(null);
    setSuccess(null);
    
    try {
      await onExport(file.id);
      setSuccess('Data exported successfully!');
    } catch (err) {
      setError('Failed to export data');
    } finally {
      setIsExporting(false);
    }
  };

  const handleGenerateReport = async () => {
    setIsGeneratingReport(true);
    setError(null);
    setSuccess(null);
    
    try {
      await onGenerateReport(file.id);
      setSuccess('Report generated successfully!');
    } catch (err) {
      setError('Failed to generate report');
    } finally {
      setIsGeneratingReport(false);
    }
  };

  return (
    <div className="p-6 bg-white rounded-lg shadow-md">
      <h1 className="text-2xl font-semibold mb-4">{file.name}</h1>
      
      {/* Action Buttons */}
      <div className="mt-6 flex gap-4">
        <button
          onClick={() => navigate(`/visualize/${file.id}`)}
          className="flex-1 bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors font-medium"
        >
          Visualize in 3D
        </button>
        
        <div className="flex gap-4">
          <button
            onClick={handleExport}
            disabled={isExporting}
            className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isExporting ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Exporting...
              </>
            ) : (
              'Export Data'
            )}
          </button>

          <button
            onClick={handleGenerateReport}
            disabled={isGeneratingReport}
            className="bg-purple-600 text-white px-6 py-3 rounded-lg hover:bg-purple-700 transition-colors font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {isGeneratingReport ? (
              <>
                <svg className="animate-spin h-5 w-5" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                Generating...
              </>
            ) : (
              'Generate PDF Report'
            )}
          </button>
        </div>
      </div>
      
      {/* File Details Section */}
      <FileDetailsSection file={file} />
      
      {/* Metadata Viewer - only show if metadata exists */}
      {file.metadata && file.metadata.length > 0 && (
        <div className="mt-8">
          <h2 className="text-xl font-semibold mb-4">Metadata</h2>
          <MetadataViewer metadata={file.metadata} />
        </div>
      )}
      
      {/* Error and Success Messages */}
      {error && (
        <ErrorAlert message={error} onClose={() => setError(null)} />
      )}
      {success && (
        <SuccessAlert message={success} onClose={() => setSuccess(null)} />
      )}
    </div>
  );
}