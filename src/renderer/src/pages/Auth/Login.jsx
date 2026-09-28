import WindowControls from '../../components/WindowControls';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../contexts/authContext';
import { useTranslation } from 'react-i18next';
import { toast } from 'sonner';
import Plant from '../../assets/plant.png'
import { LogIn, User, Lock, Loader2, Eye, EyeOff, Mail, Receipt } from 'lucide-react';
import FontSizeControls from '../../components/FontSizeControls';

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [formData, setFormData] = useState({
    username: '',
    password: ''
  });
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({
      ...prev,
      [name]: value
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.username || !formData.password) {
      toast.error(t('auth.enterBothCredentials'));
      return;
    }

    setIsLoading(true);

    try {
      const result = await login(formData.username, formData.password);
      
      if (result.success) {
        toast.success(t('auth.loginSuccess'));
        // Navigate to dashboard after successful login
        navigate('/', { replace: true });
      } else {
        toast.error(result.message || t('auth.loginFailed'));
      }
    } catch (error) {
      toast.error(t('auth.loginError'));
      console.error('Login error:', error);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex w-full font-sans bg-[#ffffff] dark:bg-[#101322] text-slate-900 dark:text-white transition-colors duration-200">
      <WindowControls 
        showNav={false}
        showFontControls={true}
        className="absolute top-0 left-0 right-0 z-50 bg-slate-900 text-white" 
        title={t('appTitle')} 
      />
      
      {/* Left Side - Image & Branding */}
      <div className="hidden lg:flex lg:w-1/2 relative flex-col bg-slate-900 overflow-hidden">
        <div className="absolute inset-0 z-0">
          <img 
            alt="Abstract data flow and billing illustration" 
            className="h-full w-full object-cover opacity-60 mix-blend-overlay" 
            src={Plant}
          />
          <div className="absolute inset-0 bg-gradient-to-br from-[#0f2cb8]/80 via-[#1337ec]/50 to-slate-900/90 mix-blend-multiply"></div>
          <div className="absolute inset-0 bg-gradient-to-t from-slate-900/90 via-transparent to-transparent"></div>
        </div>
        
        <div className="relative z-20 p-12 flex flex-col h-full justify-between mt-8">
          <div className="flex items-center gap-2">
            {/* <div className="w-8 h-8 rounded bg-white/10 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight text-white">Rabtoise</span> */}
          </div>
          <div className="mb-12">
            <h2 className="text-3xl font-bold text-white mb-4">Rabtoise Offline Billing Software</h2>
            <p className="text-blue-100 max-w-md text-lg leading-relaxed font-light opacity-90">
              Smart, secure and seamless billing for growing businesses
            </p>
          </div>
        </div>
      </div>

      {/* Right Side - Login Form */}
      <div className="w-full lg:w-1/2 flex flex-col justify-center px-6 py-12 lg:px-20 xl:px-24 bg-[#ffffff] dark:bg-[#101322]">
        <div className="w-full max-w-md mx-auto mt-10 lg:mt-0">
          <div className="lg:hidden flex items-center gap-2 mb-10 text-slate-900 dark:text-white">
            <div className="w-8 h-8 rounded bg-[#1337ec] flex items-center justify-center text-white">
              <Receipt className="w-5 h-5" />
            </div>
            <span className="text-xl font-bold tracking-tight">Rabtoise</span>
          </div>
          

          <div className="mb-10">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900 dark:text-white mb-2">{t('auth.signIn')}</h1>
            <p className="text-slate-500 dark:text-slate-400">{t('auth.signInToContinue')}</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Username/Email Field */}
            <div>
              <label htmlFor="username" className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-200">
                {t('auth.username')}
              </label>
              <div className="mt-2 relative">
                <input
                  id="username"
                  name="username"
                  type="text"
                  autoComplete="username"
                  required
                  value={formData.username}
                  onChange={handleChange}
                  className="block w-full rounded-lg border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-[#1337ec] dark:bg-[#1a1d2d] dark:ring-slate-700 dark:text-white sm:text-sm sm:leading-6 bg-[#f8f9fc]"
                  placeholder="name@company.com"
                />
                <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center pr-3">
                  <Mail className="h-5 w-5 text-slate-400" />
                </div>
              </div>
            </div>

            {/* Password Field */}
            <div>
              <label htmlFor="password" className="block text-sm font-medium leading-6 text-slate-900 dark:text-slate-200">
                {t('auth.password')}
              </label>
              <div className="mt-2 relative">
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={formData.password}
                  onChange={handleChange}
                  className="block w-full rounded-lg border-0 py-3 px-4 text-slate-900 shadow-sm ring-1 ring-inset ring-slate-300 placeholder:text-slate-400 focus:ring-2 focus:ring-inset focus:ring-[#1337ec] dark:bg-[#1a1d2d] dark:ring-slate-700 dark:text-white sm:text-sm sm:leading-6 bg-[#f8f9fc]"
                  placeholder="••••••••"
                />
                <div 
                  className="absolute inset-y-0 right-0 flex items-center pr-3 cursor-pointer hover:text-slate-600"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? (
                    <EyeOff className="h-5 w-5 text-slate-400" />
                  ) : (
                    <Eye className="h-5 w-5 text-slate-400" />
                  )}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-between">
              <div className="flex items-center">
                <input
                  id="remember-me"
                  name="remember-me"
                  type="checkbox"
                  className="h-4 w-4 rounded border-slate-300 text-[#1337ec] focus:ring-[#1337ec] dark:border-slate-600 dark:bg-[#1a1d2d]"
                />
                <label htmlFor="remember-me" className="ml-2 block text-sm text-slate-600 dark:text-slate-300">
                  Remember me
                </label>
              </div>
              <span 
                onClick={() => window.api?.openExternal ? window.api.openExternal('https://rabtoise.org/contact-us') : window.open('https://rabtoise.org/contact-us', '_blank')} 
                className="text-blue-600 hover:text-blue-700 cursor-pointer hover:underline text-sm transition-colors"
              >
                Contact Support
              </span>
            </div>

            <div>
              <button
                type="submit"
                disabled={isLoading}
                className="flex w-full justify-center rounded-lg bg-[#1337ec] px-3 py-3.5 text-sm font-semibold leading-6 text-white shadow-sm hover:bg-[#0f2cb8] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#1337ec] transition-all duration-200 ease-in-out disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isLoading ? (
                  <>
                    <Loader2 className="w-5 h-5 animate-spin mr-2" />
                    {t('auth.signingIn')}
                  </>
                ) : (
                  t('auth.signIn')
                )}
              </button>
            </div>
          </form>

          <div className="mt-12 border-t border-slate-200 dark:border-slate-800 pt-6">
            <p className="text-center text-xs text-slate-400 dark:text-slate-500">
              &copy; {new Date().getFullYear()} <span 
                onClick={() => window.api?.openExternal ? window.api.openExternal('https://rabtoise.org') : window.open('https://rabtoise.org', '_blank')} 
                className="text-blue-600 hover:text-blue-700 cursor-pointer hover:underline font-medium transition-colors"
              >
                Rabtoise Technologies
              </span>. All rights reserved.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Login;
