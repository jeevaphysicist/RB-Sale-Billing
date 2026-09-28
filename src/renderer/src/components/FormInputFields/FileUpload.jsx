import { Package } from "lucide-react";

const FileUpload = ({ onChange, accept = "image/*" }) => (
  <div className="relative">
    <input
      type="file"
      accept={accept}
      onChange={onChange}
      className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
    />
    <div className="border-2 border-dashed border-gray-300 rounded-xl p-6 text-center hover:border-blue-500 transition-colors cursor-pointer bg-gray-50">
      <Package className="w-10 h-10 mx-auto mb-2 text-gray-400" />
      <p className="text-sm text-gray-600">Click to upload image</p>
      <p className="text-xs text-gray-400 mt-1">PNG, JPG up to 5MB</p>
    </div>
  </div>
);
export default FileUpload;