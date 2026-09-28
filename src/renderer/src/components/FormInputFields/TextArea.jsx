const Textarea = ({ value, onChange, ...props }) => (
  <textarea
    value={value}
    onChange={onChange}
    {...props}
    className="w-full px-4 py-3 border border-gray-200 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all resize-none placeholder:text-gray-400"
    rows="4"
  />
);

export default Textarea;