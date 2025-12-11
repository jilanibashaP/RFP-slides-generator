import React, { useState, useEffect, useRef } from 'react';
import { Upload, Send, FileText, Sparkles, Download, BarChart3 } from 'lucide-react';

const API_BASE = 'http://localhost:5000';

export default function RFPSlideGenerator() {
  // State
  const [rfpFiles, setRfpFiles] = useState([]);
  const [brandGuides, setBrandGuides] = useState([]);
  const [selectedRfp, setSelectedRfp] = useState('');
  const [selectedBrand, setSelectedBrand] = useState('');
  const [slideCount, setSlideCount] = useState(5);
  const [generatedSlides, setGeneratedSlides] = useState(null);
  const [isLoading, setIsLoading] = useState(false);
  const [apiStatus, setApiStatus] = useState('checking');
  const [uploadType, setUploadType] = useState('rfp');
  
  const fileInputRef = useRef(null);

  // Check API health
  useEffect(() => {
    checkApiHealth();
    loadFiles();
  }, []);

  const checkApiHealth = async () => {
    try {
      const response = await fetch(`${API_BASE}/check`);
      if (response.ok) {
        setApiStatus('connected');
      } else {
        setApiStatus('error');
      }
    } catch (error) {
      setApiStatus('error');
    }
  };

  const loadFiles = async () => {
    try {
      const response = await fetch(`${API_BASE}/files`);
      if (response.ok) {
        const data = await response.json();
        setRfpFiles(data.data.rfpDocuments || []);
        setBrandGuides(data.data.brandGuides || []);
      }
    } catch (error) {
      console.error('Failed to load files:', error);
    }
  };

  const handleFileUpload = async (event) => {
    const file = event.target.files[0];
    if (!file) return;

    if (file.type !== 'application/pdf') {
      alert('Please upload a PDF file only.');
      return;
    }

    setIsLoading(true);

    try {
      const formData = new FormData();
      formData.append('pdf', file);
      formData.append('documentType', uploadType);

      const response = await fetch(`${API_BASE}/upload`, {
        method: 'POST',
        body: formData,
      });

      const result = await response.json();

      if (response.ok) {
        alert(`✅ Successfully uploaded ${uploadType === 'rfp' ? 'RFP' : 'Brand Guide'}: "${file.name}"`);
        loadFiles();
      } else {
        alert(`❌ Upload failed: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Upload error: ${error.message}`);
    } finally {
      setIsLoading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = '';
      }
    }
  };

  const handleGenerateSlides = async () => {
    if (!selectedRfp) {
      alert('Please select an RFP document first.');
      return;
    }

    setIsLoading(true);
    setGeneratedSlides(null);

    try {
      const response = await fetch(`${API_BASE}/generate-slides`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          rfpFilename: selectedRfp,
          brandGuideFilename: selectedBrand || null,
          slideCount: slideCount,
        }),
      });

      const result = await response.json();

      if (response.ok && result.success) {
        setGeneratedSlides(result.data);
      } else {
        alert(`❌ Generation failed: ${result.error}`);
      }
    } catch (error) {
      alert(`❌ Generation error: ${error.message}`);
    } finally {
      setIsLoading(false);
    }
  };

  const downloadAsJSON = () => {
    if (!generatedSlides) return;
    
    const dataStr = JSON.stringify(generatedSlides, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `slides_${generatedSlides.rfpFilename}_${Date.now()}.json`;
    link.click();
  };

  const renderSlideContent = (slide) => {
    if (Array.isArray(slide.content)) {
      return (
        <ul className="list-disc list-inside space-y-2 text-slate-700">
          {slide.content.map((item, idx) => (
            <li key={idx}>{item}</li>
          ))}
        </ul>
      );
    }
    return <p className="text-slate-700 leading-relaxed">{slide.content}</p>;
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-purple-50 to-pink-50">
      {/* Header */}
      <div className="bg-white/80 backdrop-blur-sm shadow-lg border-b border-slate-200 p-6">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
          <div className="flex items-center space-x-4">
            <div className="bg-gradient-to-r from-indigo-600 to-purple-600 p-3 rounded-xl shadow-lg">
              <Sparkles className="w-7 h-7 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-slate-800 tracking-tight">
                RFP to Slide Generator
              </h1>
              <div className="flex items-center space-x-6 text-sm text-slate-600 mt-1">
                <span className={`flex items-center space-x-2 font-medium ${apiStatus === 'connected' ? 'text-green-600' : 'text-red-600'}`}>
                  <div className={`w-2 h-2 rounded-full ${apiStatus === 'connected' ? 'bg-green-500' : 'bg-red-500'} animate-pulse`}></div>
                  <span>{apiStatus === 'connected' ? 'Connected' : 'Disconnected'}</span>
                </span>
                <span className="flex items-center space-x-2 bg-slate-100 px-3 py-1 rounded-full">
                  <FileText className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">{rfpFiles.length} RFPs</span>
                </span>
                <span className="flex items-center space-x-2 bg-slate-100 px-3 py-1 rounded-full">
                  <BarChart3 className="w-4 h-4 text-slate-500" />
                  <span className="font-medium">{brandGuides.length} Guides</span>
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6">
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Left Panel - Configuration */}
          <div className="space-y-6 overflow-visible">
            {/* Upload Section */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 p-6 overflow-visible">
              <h2 className="text-lg font-bold text-slate-800 mb-4">📤 Upload Documents</h2>
              
              <div className="space-y-4">
                <div className="flex space-x-4">
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadType"
                      value="rfp"
                      checked={uploadType === 'rfp'}
                      onChange={(e) => setUploadType(e.target.value)}
                      className="w-4 h-4 text-indigo-600"
                    />
                    <span className="text-sm font-medium text-slate-700">RFP Document</span>
                  </label>
                  <label className="flex items-center space-x-2 cursor-pointer">
                    <input
                      type="radio"
                      name="uploadType"
                      value="brand-guide"
                      checked={uploadType === 'brand-guide'}
                      onChange={(e) => setUploadType(e.target.value)}
                      className="w-4 h-4 text-purple-600"
                    />
                    <span className="text-sm font-medium text-slate-700">Brand Guide</span>
                  </label>
                </div>

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf"
                  onChange={handleFileUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isLoading || apiStatus !== 'connected'}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-3 bg-gradient-to-r from-indigo-600 to-purple-600 text-white rounded-xl hover:from-indigo-700 hover:to-purple-700 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl font-medium"
                >
                  <Upload className="w-5 h-5" />
                  <span>Upload {uploadType === 'rfp' ? 'RFP' : 'Brand Guide'}</span>
                </button>
              </div>
            </div>

            {/* Generation Settings */}
            <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 p-6 overflow-visible">
              <h2 className="text-lg font-bold text-slate-800 mb-4">🎨 Configure Slides</h2>
              
              <div className="space-y-4 overflow-visible">
                <div className="relative" style={{zIndex: 9999}}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Select RFP Document *
                  </label>
                  <select
                    value={selectedRfp}
                    onChange={(e) => setSelectedRfp(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-indigo-500 focus:border-indigo-500 bg-white text-slate-900 font-medium cursor-pointer"
                  >
                    <option value="">-- Select RFP --</option>
                    {rfpFiles.map((file, idx) => (
                      <option key={idx} value={file.filename}>
                        {file.filename}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="relative" style={{zIndex: 9998}}>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Brand Guide (Optional)
                  </label>
                  <select
                    value={selectedBrand}
                    onChange={(e) => setSelectedBrand(e.target.value)}
                    className="w-full px-4 py-3 border-2 border-slate-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-purple-500 bg-white text-slate-900 font-medium cursor-pointer"
                  >
                    <option value="">-- Default Style --</option>
                    {brandGuides.map((guide, idx) => (
                      <option key={idx} value={guide.filename}>
                        {guide.brandName || guide.filename}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="block text-sm font-medium text-slate-700 mb-2">
                    Number of Slides: {slideCount}
                  </label>
                  <input
                    type="range"
                    min="3"
                    max="15"
                    value={slideCount}
                    onChange={(e) => setSlideCount(parseInt(e.target.value))}
                    className="w-full"
                  />
                  <div className="flex justify-between text-xs text-slate-500 mt-1">
                    <span>3</span>
                    <span>15</span>
                  </div>
                </div>

                <button
                  onClick={handleGenerateSlides}
                  disabled={isLoading || !selectedRfp || apiStatus !== 'connected'}
                  className="w-full flex items-center justify-center space-x-2 px-6 py-4 bg-gradient-to-r from-pink-600 to-purple-600 text-white rounded-xl hover:from-pink-700 hover:to-purple-700 disabled:opacity-50 transition-all duration-200 shadow-lg hover:shadow-xl font-bold text-lg"
                >
                  {isLoading ? (
                    <>
                      <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                      <span>Generating...</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="w-5 h-5" />
                      <span>Generate Slides</span>
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>

          {/* Right Panel - Preview */}
          <div className="bg-white/80 backdrop-blur-sm rounded-2xl shadow-xl border border-slate-200 p-6">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-bold text-slate-800">📊 Generated Slides</h2>
              {generatedSlides && (
                <button
                  onClick={downloadAsJSON}
                  className="flex items-center space-x-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-all text-sm font-medium"
                >
                  <Download className="w-4 h-4" />
                  <span>Download JSON</span>
                </button>
              )}
            </div>

            {!generatedSlides && (
              <div className="text-center py-16">
                <div className="bg-gradient-to-r from-indigo-100 to-purple-100 w-20 h-20 rounded-2xl flex items-center justify-center mx-auto mb-6">
                  <FileText className="w-10 h-10 text-indigo-600" />
                </div>
                <h3 className="text-xl font-bold text-slate-800 mb-2">No Slides Yet</h3>
                <p className="text-slate-600">
                  Upload an RFP and click "Generate Slides" to start
                </p>
              </div>
            )}

            {generatedSlides && (
              <div className="space-y-4 max-h-[70vh] overflow-y-auto">
                <div className="bg-indigo-50 rounded-lg p-4 mb-4">
                  <p className="text-sm text-indigo-800">
                    <strong>RFP:</strong> {generatedSlides.rfpFilename}
                  </p>
                  <p className="text-sm text-indigo-800">
                    <strong>Brand:</strong> {generatedSlides.brandGuideFilename}
                  </p>
                  <p className="text-sm text-indigo-800">
                    <strong>Slides:</strong> {generatedSlides.slideCount}
                  </p>
                </div>

                {generatedSlides.slides.map((slide) => (
                  <div key={slide.slideNumber} className="bg-white rounded-xl shadow-md border border-slate-200 p-6">
                    <div className="flex items-start justify-between mb-4">
                      <div className="flex-1">
                        <div className="text-sm font-bold text-indigo-600 mb-2">
                          Slide {slide.slideNumber}
                        </div>
                        <h3 className="text-xl font-bold text-slate-900 mb-2">
                          {slide.title}
                        </h3>
                        <span className="inline-block px-3 py-1 bg-purple-100 text-purple-800 rounded-full text-xs font-semibold">
                          {slide.contentType}
                        </span>
                      </div>
                    </div>
                    
                    <div className="mb-4">
                      {renderSlideContent(slide)}
                    </div>

                    {slide.notes && (
                      <div className="mt-4 pt-4 border-t border-slate-200">
                        <p className="text-xs font-semibold text-slate-500 mb-1">PRESENTER NOTES:</p>
                        <p className="text-sm text-slate-600 italic">{slide.notes}</p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
