import { useState } from 'react';
import { Eye, EyeOff, Loader2 } from 'lucide-react';
import type { UserRole } from '../types';

interface LoginPageProps {
  onLogin: (role: UserRole) => void;
}

export default function LoginPage({ onLogin }: LoginPageProps) {
  const [showPassword, setShowPassword] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    try {
      // Dynamically import to avoid circular deps at module load
      const { default: useAuthStore } = await import('../../store/authStore');
      const result = await useAuthStore.getState().login(email, password);

      if (result.success) {
        const role = useAuthStore.getState().role as UserRole;
        onLogin(role || 'employee');
      } else {
        setError(result.error || 'Login failed. Please check your credentials.');
      }
    } catch (err: any) {
      setError('Something went wrong. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };


  const handleMicrosoftLogin = async () => {
    try {
      const { default: useAuthStore } = await import('../../store/authStore');
      await useAuthStore.getState().loginWithAzure();
    } catch (err: any) {
      setError(err.message || 'Failed to initialize Microsoft login.');
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8FAF9] p-6">
      <div className="w-full max-w-5xl flex rounded-2xl overflow-hidden shadow-2xl">
        {/* Left Panel - Decorative */}
        <div className="hidden lg:flex lg:w-1/2 bg-[#0F6E56] p-12 flex-col justify-between relative overflow-hidden">
          <div
            className="absolute inset-0 opacity-10"
            style={{
              backgroundImage: 'radial-gradient(circle, white 1px, transparent 1px)',
              backgroundSize: '24px 24px'
            }}
          />

          <div className="relative z-10">
            <div className="text-white mb-8">
              <h1 className="text-4xl mb-2">
                Atom<span className="text-[#1D9E75]">Quest</span>
              </h1>
            </div>
            <p className="text-white/90 text-xl leading-relaxed">
              Set goals. Track progress.<br />Grow together.
            </p>
          </div>

          <div className="relative z-10">
            <div className="flex gap-3 items-end">
              <div className="w-12 h-32 bg-white/20 rounded-lg" />
              <div className="w-12 h-40 bg-white/30 rounded-lg" />
              <div className="w-12 h-48 bg-white/40 rounded-lg" />
              <div className="w-12 h-56 bg-[#1D9E75] rounded-lg" />
            </div>
          </div>
        </div>

        {/* Right Panel - Login Form */}
        <div className="w-full lg:w-1/2 bg-white p-12">
          <div className="max-w-md mx-auto">
            <div className="lg:hidden mb-8">
              <h1 className="text-3xl">
                Atom<span className="text-[#1D9E75]">Quest</span>
              </h1>
            </div>

            <div className="mb-8">
              <h2 className="text-2xl mb-2">Welcome back</h2>
              <p className="text-gray-600">Sign in to your goal portal</p>
            </div>

            {error && (
              <div className="mb-4 p-3 rounded-lg bg-red-50 border border-red-200 text-red-700 text-sm">
                {error}
              </div>
            )}

            <form onSubmit={handleSubmit} className="space-y-5">
              <div>
                <label htmlFor="email" className="block text-sm mb-2 text-gray-700">
                  Email
                </label>
                <input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent"
                  placeholder="you@company.com"
                  required
                  disabled={isLoading}
                />
              </div>

              <div>
                <label htmlFor="password" className="block text-sm mb-2 text-gray-700">
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#1D9E75] focus:border-transparent pr-12"
                    placeholder="••••••••"
                    required
                    disabled={isLoading}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-700"
                  >
                    {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-[#1D9E75] text-white py-3 rounded-lg font-medium hover:bg-[#178f68] transition-colors disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isLoading ? <><Loader2 size={18} className="animate-spin" /> Signing in…</> : 'Sign In'}
              </button>

              <div className="relative my-6">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-gray-300" />
                </div>
                <div className="relative flex justify-center text-sm">
                  <span className="px-3 bg-white text-gray-500">or</span>
                </div>
              </div>

              <button
                type="button"
                onClick={handleMicrosoftLogin}
                className="w-full bg-white border-2 border-[#2563eb] text-gray-700 py-3 rounded-lg font-medium hover:bg-gray-50 transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-5 h-5" viewBox="0 0 24 24">
                  <path fill="#f25022" d="M0 0h11.377v11.372H0z"/>
                  <path fill="#00a4ef" d="M12.623 0H24v11.372H12.623z"/>
                  <path fill="#7fba00" d="M0 12.628h11.377V24H0z"/>
                  <path fill="#ffb900" d="M12.623 12.628H24V24H12.623z"/>
                </svg>
                Sign in with Microsoft
              </button>

              <p className="text-center text-sm text-gray-600 mt-6">
                Having trouble? <span className="text-[#1D9E75] cursor-pointer hover:underline">Contact HR</span>
              </p>
            </form>


          </div>
        </div>
      </div>
    </div>
  );
}
