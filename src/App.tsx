import React, { useState, useRef, useCallback } from 'react';
import { removeBackground } from '@imgly/background-removal';

function App() {
  const [originalImage, setOriginalImage] = useState<string | null>(null);
  const [processedImage, setProcessedImage] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);

  const handleImageUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

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
          const noBackgroundImage = await removeBackground(resizedImage);

          // Create blurred background
          const blurCanvas = document.createElement('canvas');
          blurCanvas.width = width;
          blurCanvas.height = height;
          const blurCtx = blurCanvas.getContext('2d');
          
          if (blurCtx) {
            blurCtx.filter = 'blur(10px)';
            const blurImg = new Image();
            blurImg.onload = () => {
              blurCtx.drawImage(blurImg, 0, 0, width, height);
              
              // Overlay the no-background image
              const noBackImg = new Image();
              noBackImg.onload = () => {
                blurCtx.drawImage(noBackImg, 0, 0, width, height);
                setProcessedImage(blurCanvas.toDataURL('image/jpeg'));
                setIsProcessing(false);
              };
              noBackImg.src = URL.createObjectURL(noBackgroundImage);
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
    reader.readAsDataURL(file);
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
    <div className="min-h-screen bg-gray-100 py-8 px-4">
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold text-center mb-8">Image Background Processor</h1>
        
        <div className="bg-white rounded-lg shadow-lg p-6">
          <div className="mb-6">
            <label className="block text-gray-700 text-sm font-bold mb-2">
              Upload Image
            </label>
            <input
              type="file"
              accept="image/*"
              onChange={handleImageUpload}
              className="w-full text-sm text-gray-500 file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-blue-50 file:text-blue-700 hover:file:bg-blue-100"
            />
          </div>

          {isProcessing && (
            <div className="text-center py-4">
              <p className="text-gray-600">Processing image...</p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {originalImage && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Original Image</h2>
                <img
                  src={originalImage}
                  alt="Original"
                  className="w-full rounded-lg"
                />
              </div>
            )}

            {processedImage && (
              <div>
                <h2 className="text-lg font-semibold mb-2">Processed Image</h2>
                <img
                  src={processedImage}
                  alt="Processed"
                  className="w-full rounded-lg"
                />
                <button
                  onClick={handleDownload}
                  className="mt-4 bg-blue-500 text-white px-4 py-2 rounded-lg hover:bg-blue-600 transition-colors"
                >
                  Download Processed Image
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
