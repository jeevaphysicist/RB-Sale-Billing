import React from "react";

export class ErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, errorInfo) {
    console.error("Error logged:", error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: null });
    window.location.reload(); // Refresh the page
  };

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center min-h-screen bg-gray-100 p-6">
          <h1 className="text-3xl font-bold text-red-600 mb-4">Oops! Something went wrong.</h1>
          <p className="text-gray-700 mb-2">An unexpected error occurred. Please try again.</p>
          <pre className="bg-red-100 text-red-700 p-3 rounded-md text-sm w-full max-w-lg overflow-auto">
            {this.state.error?.toString()}
          </pre>
          <button
            onClick={this.handleRetry}
            className="mt-4 px-5 py-2 bg-blue-600 text-white font-semibold rounded-lg shadow-md hover:bg-blue-700 transition"
          >
            Try Again
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
