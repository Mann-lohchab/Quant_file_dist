import { useState } from "react";
import { useStore } from "../stores/adminStore";
import { AlertCircle } from "lucide-react";

export default function LoginPage() {
  const { login, loading, error: storeError } = useStore();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [localError, setLocalError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLocalError("");

    if (!username.trim() || !password.trim()) {
      setLocalError("Please enter both username and password");
      return;
    }

    try {
      const data = await login(username, password);
      // On success, redirect (token already stored in store)
      window.location.href = "/admin";
    } catch (err) {
      setLocalError(err.message || "Login failed. Please try again.");
    }
  };

  const error = localError || storeError;

  return (
    <div className="min-h-screen bg-background flex items-center justify-center py-12 px-4 sm:px-6 lg:px-8">
      <div className="max-w-4xl w-full flex flex-col items-center">
        {/* Hero Section */}
        <div className="text-center mb-12 max-w-2xl">
          <h1 className="text-4xl md:text-5xl font-light text-gray-900 mb-6">
            Admin Login,{' '}
            <span className="text-emerald-500 font-normal">the secure way.</span>
          </h1>
          <p className="text-lg text-gray-600 leading-relaxed">
            Access the admin panel to manage your file server with full security and control.
          </p>
        </div>

        {/* Login Form */}
        <form onSubmit={handleSubmit} className="max-w-md w-full space-y-8">
          <div className="bg-white rounded-lg shadow-lg p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6" role="alert" aria-live="assertive">
                <div className="flex items-center">
                  <AlertCircle className="w-5 h-5 text-red-400 mr-2 flex-shrink-0" />
                  <span className="text-red-700">
                    {error}
                  </span>
                </div>
              </div>
            )}
            <div className="space-y-6">
              <div>
                <label htmlFor="username" className="block text-sm font-medium text-gray-700 mb-2">
                  Username
                </label>
                <input
                  id="username"
                  type="text"
                  placeholder="Enter your username"
                  value={username}
                  onChange={e => setUsername(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  disabled={loading}
                  required
                  aria-required="true"
                />
              </div>
              <div>
                <label htmlFor="password" className="block text-sm font-medium text-gray-700 mb-2">
                  Password
                </label>
                <input
                  id="password"
                  type="password"
                  placeholder="Enter your password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:border-emerald-500 bg-white text-gray-900 placeholder-gray-500 disabled:opacity-50 disabled:cursor-not-allowed transition-all"
                  disabled={loading}
                  required
                  aria-required="true"
                />
              </div>
              <button
                type="submit"
                disabled={loading || !username.trim() || !password.trim()}
                className="w-full py-3 px-4 bg-emerald-500 hover:bg-emerald-600 focus:outline-none focus:ring-2 focus:ring-emerald-500 focus:ring-offset-2 text-white font-medium rounded-lg disabled:opacity-50 disabled:cursor-not-allowed transition-all flex items-center justify-center space-x-2"
                role="button"
                aria-label="Login to admin panel"
              >
                {loading ? (
                  <>
                    <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                    <span>Logging in...</span>
                  </>
                ) : (
                  <>
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 16l-4-4m0 0l4-4m-4 4h14m-5 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h7a3 3 0 013 3v1" />
                    </svg>
                    <span>Login</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
