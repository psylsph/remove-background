import React, { useState, useCallback } from 'react';
import { removeBackground } from '@imgly/background-removal';
import heic2any from 'heic2any';


function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

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
        const imageUrl = e.target?.result as string;
        setOriginalImage(imageUrl);
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

          // Create container for the processed image
          const container = document.createElement('div');
          container.style.width = `${width}px`;
          container.style.height = `${height}px`;
          container.style.position = 'relative';
          container.style.overflow = 'hidden';
          document.body.appendChild(container);

          try {
            // Remove background
            const noBackgroundImageBlob = await removeBackground(e.target?.result as string);
            const noBackgroundUrl = URL.createObjectURL(noBackgroundImageBlob);

            // Create foreground image
            const foregroundImg = new Image();
            foregroundImg.onload = () => {
              const imgAspect = foregroundImg.width / foregroundImg.height;
              const containerAspect = width / height;
              
              // Calculate dimensions to maintain aspect ratio
              let drawWidth = width;
              let drawHeight = height;
              
              if (imgAspect > containerAspect) {
                drawHeight = width / imgAspect;
              } else {
                drawWidth = height * imgAspect;
              }

              // Create a canvas for the final image
              const canvas = document.createElement('canvas');
              canvas.width = width;
              canvas.height = height;
              const ctx = canvas.getContext('2d');
              
              if (ctx) {
                // Clear the canvas with transparency
                ctx.clearRect(0, 0, width, height);
                
                // Draw the image centered
                const x = (width - drawWidth) / 2;
                const y = (height - drawHeight) / 2;
                ctx.drawImage(foregroundImg, x, y, drawWidth, drawHeight);
                
                // Convert to PNG to preserve transparency
                setProcessedImage(canvas.toDataURL('image/png'));
              }
              setIsProcessing(false);
            };
            foregroundImg.src = noBackgroundUrl;
            foregroundImg.crossOrigin = 'anonymous';

          } catch (error) {
            console.error('Error removing background:', error);
            setIsProcessing(false);
            document.body.removeChild(container);
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
      link.download = 'processed-image.png';
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
        
        <div className="flex flex-col items-center justify-center">
          <div
            className={`w-full max-w-2xl h-80 border-2 border-dashed rounded-lg mb-8 flex items-center justify-center relative overflow-hidden ${
              isDragging ? 'border-blue-500 bg-blue-50/10' : 'border-gray-600 hover:border-gray-500'
            }`}
            onDragEnter={handleDragEnter}
            onDragLeave={handleDragLeave}
            onDragOver={handleDragOver}
            onDrop={handleDrop}
          >
            {isProcessing ? (
              <div className="text-center">
                <div className="inline-block animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500 mb-2"></div>
                <p>Processing...</p>
              </div>
            ) : processedImage ? (
              <div className="relative w-full h-full">
                {/* Checkerboard pattern for transparency */}
                <div 
                  className="absolute inset-0"
                  style={{
                    backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' viewBox='0 0 16 16'%3E%3Cpath fill='%23f0f0f0' d='M0 0h8v8H0zM8 8h8v8H8z'/%3E%3Cpath fill='%23e0e0e0' d='M8 0h8v8H8zM0 8h8v8H0z'/%3E%3C/svg%3E")`,
                    backgroundSize: '16px 16px'
                  }}
                />
                {/* Blurred background */}
                {originalImage && (
                  <div 
                    className="absolute inset-0"
                    style={{
                      backgroundImage: `url(${originalImage})`,
                      backgroundSize: 'cover',
                      backgroundPosition: 'center',
                      filter: 'blur(20px) brightness(0.8)',
                      transform: 'scale(1.1)'
                    }}
                  />
                )}
                {/* Processed image */}
                <img
                  src={processedImage}
                  alt="Processed"
                  className="absolute inset-0 w-full h-full object-contain"
                />
              </div>
            ) : (
              <div className="text-center p-6">
                <input
                  type="file"
                  accept="image/*,.heic,.heif"
                  onChange={handleImageUpload}
                  className="hidden"
                  id="fileInput"
                />
                <label
                  htmlFor="fileInput"
                  className="cursor-pointer text-blue-500 hover:text-blue-400"
                >
                  Click to upload
                </label>
                <p className="mt-2 text-gray-400">or drag and drop</p>
                <p className="text-sm text-gray-500 mt-1">
                  Supports: JPG, PNG, WEBP, HEIC
                </p>
              </div>
            )}
          </div>
          
          {processedImage && (
            <button
              onClick={handleDownload}
              className="bg-blue-500 hover:bg-blue-600 text-white font-semibold py-2 px-6 rounded-lg transition-colors"
            >
              Download
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
