import React, { useState, useRef, useCallback } from 'react';
import { removeBackground } from '@imgly/background-removal';
import heic2any from 'heic2any';

function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [noBackgroundImage, setNoBackgroundImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const convertHeicToJpeg = async (file: File): Promise<File> => {
    try {
      const conversionResult = await heic2any({
        blob: file,
        toType: 'image/jpeg',
        quality: 0.9
      });

      // Handle both single file and array result
      const jpegBlob = Array.isArray(conversionResult) ? conversionResult[0] : conversionResult;
      return new File([jpegBlob], file.name.replace(/\.(heic|heif)$/i, '.jpg'), {
        type: 'image/jpeg'
      });
    } catch (error) {
      console.error('Error converting HEIC/HEIF:', error);
      throw new Error('Failed to convert HEIC/HEIF image');
    }
  };

  const processImage = async (file: File) => {
    if (!file) return;

    try {
      setIsProcessing(true);
      
      // Convert HEIC/HEIF to JPEG if necessary
      const processableFile = /\.(heic|heif)$/i.test(file.name) 
        ? await convertHeicToJpeg(file)
        : file;

      // Create URL for original image
      const reader = new FileReader();
      reader.onload = async (e) => {
        const img = new Image();
        img.onload = async () => {
          // Resize image if too large
          const maxWidth = 800;
          const maxHeight = 800;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth || height > maxHeight) {
            const ratio = Math.min(maxWidth / width, maxHeight / height);
            width *= ratio;
            height *= ratio;
          }

          // Draw original image to canvas for resizing
          const canvas = document.createElement('canvas');
          canvas.width = width;
          canvas.height = height;
          const ctx = canvas.getContext('2d');
          ctx?.drawImage(img, 0, 0, width, height);

          // Get resized image as base64
          const resizedImage = canvas.toDataURL('image/jpeg');
          setOriginalImage(resizedImage);

          try {
            setIsProcessing(true);
            // Remove background
            const noBackgroundImageBlob = await removeBackground(resizedImage);
            
            // Convert blob to URL for display
            const noBackgroundUrl = URL.createObjectURL(noBackgroundImageBlob);
            setNoBackgroundImage(noBackgroundUrl);

            // Create blurred background
            const blurCanvas = document.createElement('canvas');
            blurCanvas.width = width;
            blurCanvas.height = height;
            const blurCtx = blurCanvas.getContext('2d');
            
            if (blurCtx) {
              // First draw and blur the original image
              blurCtx.filter = 'blur(15px) brightness(0.8)';
              const blurImg = new Image();
              blurImg.onload = () => {
                // Scale the blur image to match foreground size more closely
                const scale = 1.05;
                const scaledWidth = width * scale;
                const scaledHeight = height * scale;
                const offsetX = (width - scaledWidth) / 2;
                const offsetY = (height - scaledHeight) / 2;
                
                blurCtx.drawImage(blurImg, offsetX, offsetY, scaledWidth, scaledHeight);
                
                // Reset the filter before drawing the foreground
                blurCtx.filter = 'none';
                
                // Overlay the no-background image
                const noBackImg = new Image();
                noBackImg.onload = () => {
                  // Calculate dimensions to maintain aspect ratio and fill the canvas
                  const imgAspect = noBackImg.width / noBackImg.height;
                  const canvasAspect = width / height;
                  let drawWidth = width;
                  let drawHeight = height;
                  let offsetX = 0;
                  let offsetY = 0;

                  if (imgAspect > canvasAspect) {
                    // Image is wider than canvas
                    drawHeight = width / imgAspect;
                    offsetY = (height - drawHeight) / 2;
                  } else {
                    // Image is taller than canvas
                    drawWidth = height * imgAspect;
                    offsetX = (width - drawWidth) / 2;
                  }

                  blurCtx.drawImage(noBackImg, offsetX, offsetY, drawWidth, drawHeight);
                  setProcessedImage(blurCanvas.toDataURL('image/jpeg'));
                  setIsProcessing(false);
                };
                noBackImg.src = noBackgroundUrl;
              };
              blurImg.src = resizedImage;
            }
          } catch (error) {
            console.error('Error processing image:', error);
            setIsProcessing(false);
          }
        };
        img.src = e.target?.result as string;
      };
      reader.readAsDataURL(processableFile);
    } catch (error) {
      console.error('Error processing image:', error);
      setIsProcessing(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      processImage(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = async (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const files = Array.from(e.dataTransfer.files);
    const imageFile = files.find(file => 
      file.type.startsWith('image/') || 
      /\.(heic|heif)$/i.test(file.name)
    );
    
    if (imageFile) {
      processImage(imageFile);
    }
  };

  const handleDownload = useCallback(() => {
    if (processedImage) {
      const link = document.createElement('a');
      link.href = processedImage;
      link.download = 'processed-image.jpg';
      link.click();
    }
  }, [processedImage]);

  return (
    <div className="min-h-screen bg-[#0f172a] text-white py-12 px-4">
      <div className="max-w-7xl mx-auto">
        <div className="text-center mb-12">
          <h1 className="text-5xl font-bold mb-4 bg-gradient-to-r from-blue-400 to-purple-500 text-transparent bg-clip-text">
            Background Remover
          </h1>
          <p className="text-gray-400 text-lg">Transform your images with one click</p>
        </div>
        
        <div className="bg-[#1e293b] rounded-3xl shadow-2xl p-8 backdrop-blur-xl border border-gray-700">
          <div className="mb-12">
            <div className="flex flex-col items-center justify-center w-full">
              <div 
                onDragEnter={handleDragEnter}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-2xl cursor-pointer transition-all duration-300 group ${
                  isDragging 
                    ? 'border-blue-500 bg-[#0f172a]/70' 
                    : 'border-gray-600 bg-[#0f172a]/50 hover:bg-[#0f172a]/70 hover:border-blue-500'
                }`}
              >
                <label 
                  htmlFor="dropzone-file" 
                  className="flex flex-col items-center justify-center w-full h-full cursor-pointer"
                >
                  <div className="flex flex-col items-center justify-center pt-5 pb-6">
                    <svg 
                      className={`w-12 h-12 mb-4 transition-colors ${
                        isDragging ? 'text-blue-500' : 'text-gray-400 group-hover:text-blue-500'
                      }`} 
                      fill="none" 
                      stroke="currentColor" 
                      viewBox="0 0 24 24" 
                      xmlns="http://www.w3.org/2000/svg"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    <p className="mb-2 text-lg text-gray-400 group-hover:text-gray-300">
                      <span className="font-semibold">{isDragging ? 'Drop it here!' : 'Drop your image here'}</span>
                    </p>
                    <p className="text-sm text-gray-500">or click to browse</p>
                  </div>
                  <input
                    id="dropzone-file"
                    type="file"
                    className="hidden"
                    accept="image/*,.heic,.heif"
                    onChange={handleImageUpload}
                  />
                </label>
              </div>
            </div>
          </div>

          {isProcessing && (
            <div className="flex items-center justify-center py-12">
              <div className="relative">
                <div className="w-16 h-16 border-4 border-blue-500/30 border-t-blue-500 rounded-full animate-spin"></div>
                <div className="absolute inset-0 flex items-center justify-center">
                  <div className="w-8 h-8 border-4 border-purple-500/30 border-t-purple-500 rounded-full animate-spin"></div>
                </div>
              </div>
              <p className="ml-6 text-gray-400 text-lg font-medium">Processing your image...</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-12">
            {originalImage && (
              <div className="flex flex-col group">
                <h2 className="text-xl font-semibold mb-4 text-gray-300">Original Image</h2>
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#0f172a] ring-1 ring-gray-700 group-hover:ring-blue-500/50 transition-all duration-300">
                  <img
                    src={originalImage}
                    alt="Original"
                    className="w-full h-full object-contain"
                  />
                </div>
              </div>
            )}

            {noBackgroundImage && (
              <div className="flex flex-col group">
                <h2 className="text-xl font-semibold mb-4 text-gray-300">No Background</h2>
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#0f172a] ring-1 ring-gray-700 group-hover:ring-blue-500/50 transition-all duration-300">
                  <div className="absolute inset-0 bg-[url('data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIyMCIgaGVpZ2h0PSIyMCI+CiAgPHJlY3Qgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMWUyOTNiIj48L3JlY3Q+CiAgPHJlY3QgeD0iMTAiIHk9IjEwIiB3aWR0aD0iMTAiIGhlaWdodD0iMTAiIGZpbGw9IiMxZTI5M2IiPjwvcmVjdD4KICA8cmVjdCB4PSIxMCIgd2lkdGg9IjEwIiBoZWlnaHQ9IjEwIiBmaWxsPSIjMGYxNzJhIj48L3JlY3Q+CiAgPHJlY3QgeT0iMTAiIHdpZHRoPSIxMCIgaGVpZ2h0PSIxMCIgZmlsbD0iIzBmMTcyYSI+PC9yZWN0Pgo8L3N2Zz4=')] opacity-30"></div>
                  <img
                    src={noBackgroundImage}
                    alt="No Background"
                    className="w-full h-full object-contain relative z-10"
                  />
                </div>
              </div>
            )}

            {processedImage && (
              <div className="flex flex-col group">
                <h2 className="text-xl font-semibold mb-4 text-gray-300">Final Result</h2>
                <div className="relative aspect-square rounded-2xl overflow-hidden bg-[#0f172a] ring-1 ring-gray-700 group-hover:ring-blue-500/50 transition-all duration-300">
                  <img
                    src={processedImage}
                    alt="Processed"
                    className="w-full h-full object-contain"
                  />
                </div>
                <button
                  onClick={handleDownload}
                  className="mt-6 w-full bg-gradient-to-r from-blue-500 to-purple-500 text-white px-6 py-4 rounded-xl hover:from-blue-600 hover:to-purple-600 transition-all duration-300 flex items-center justify-center font-medium group relative overflow-hidden"
                >
                  <div className="absolute inset-0 bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.1)_50%,transparent_75%)] bg-[length:250%_250%] animate-shimmer"></div>
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                  </svg>
                  Download Result
                </button>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;
