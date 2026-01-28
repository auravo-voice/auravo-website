import React from 'react';

interface QuizErrorBoundaryProps {
  children: React.ReactNode;
}

interface QuizErrorBoundaryState {
  hasError: boolean;
}

class QuizErrorBoundary extends React.Component<QuizErrorBoundaryProps, QuizErrorBoundaryState> {
  constructor(props: QuizErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): QuizErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    // You can wire this to your logging/monitoring if needed
    console.error('QuizErrorBoundary caught an error:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen min-h-[100svh] flex items-center justify-center bg-neutral-950 px-6 py-16">
          <div className="max-w-lg text-center">
            <h1 className="text-h2 text-neutral-100 mb-4">Quiz under maintenance</h1>
            <p className="text-body text-neutral-400 mb-6">
              The quiz is currently under maintenance. Please try again later.
            </p>
            <a href="/" className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-gradient-to-r from-neon-blue to-neon-purple text-white hover:shadow-glow">
              Go back to homepage
            </a>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}

export default QuizErrorBoundary;

