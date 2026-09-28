const FormField = ({ label, icon: Icon, children, required }) => (
  <div className="mb-5">
    <label className="flex items-center gap-2 text-sm font-semibold text-gray-700 mb-2">
      {Icon && <Icon className="w-4 h-4 text-gray-500" />}
      {label}
      {required && <span className="text-red-500">*</span>}
    </label>
    {children}
  </div>
);

export default FormField;