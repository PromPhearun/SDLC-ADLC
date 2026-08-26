import React, { useState, useEffect } from "react";

interface CodePreviewProps {
  files: string[];
  activeFile?: string;
  onFileSelect?: (file: string) => void;
}

export const CodePreview: React.FC<CodePreviewProps> = ({ files, activeFile, onFileSelect }) => {
  const [selectedFile, setSelectedFile] = useState<string>(activeFile || files[0] || "");

  useEffect(() => {
    if (activeFile) setSelectedFile(activeFile);
  }, [activeFile]);

  const handleFileClick = (file: string) => {
    setSelectedFile(file);
    onFileSelect?.(file);
  };

  return (
    <div className="flex h-full border rounded-lg overflow-hidden bg-gray-900">
      {/* File tree */}
      <div className="w-64 border-r border-gray-700 bg-gray-800 overflow-y-auto">
        <div className="p-3 border-b border-gray-700">
          <h3 className="text-sm font-semibold text-gray-300">Generated Files</h3>
        </div>
        <div className="p-2">
          {files.map((file) => (
            <button
              key={file}
              onClick={() => handleFileClick(file)}
              className={`w-full text-left px-3 py-2 text-sm rounded ${
                selectedFile === file
                  ? "bg-blue-600 text-white"
                  : "text-gray-300 hover:bg-gray-700"
              }`}
            >
              {file.split("/").pop()}
            </button>
          ))}
        </div>
      </div>

      {/* Code view */}
      <div className="flex-1 overflow-auto">
        <div className="p-4">
          <pre className="text-sm text-gray-300 font-mono whitespace-pre-wrap">
            {"// Select a file to preview"}
          </pre>
        </div>
      </div>
    </div>
  );
};

export default CodePreview;
