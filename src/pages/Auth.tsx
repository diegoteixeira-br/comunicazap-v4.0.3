import { useState, useEffect } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/sessionClient';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/useAuth';
import { useRecaptcha } from '@/hooks/useRecaptcha';
import { Eye, EyeOff, ArrowLeft, Info, Shield } from 'lucide-react';
import { ForceLightTheme } from '@/components/ForceLightTheme';
import { formatDocument, validateDocument, cleanDocument } from '@/lib/document';

const Auth = () => {
  const [searchParams] = useSearchParams();
  const mode = searchParams.get('mode');
  const [isLogin, setIsLogin] = useState(mode !== 'signup');
  const [forgotPasswordMode, setForgotPasswordMode] = useState(false);
  const [resetEmailSent, setResetEmailSent] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [document, setDocument] = useState('');
  const [documentError, setDocumentError] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const navigate = useNavigate();
  const { user } = useAuth();
  const { executeRecaptcha, isLoaded: recaptchaLoaded } = useRecaptcha();
  const isResetMode = mode === 'reset';

  useEffect(() => {
    if (user && !isResetMode) {
      navigate('/dashboard');
    }
  }, [user, navigate, isResetMode]);

  const handleDocumentChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    const formatted = formatDocument(value);
    setDocument(formatted);
    setDocumentError('');
  };

  const checkDocumentExists = async (doc: string): Promise<boolean> => {
    const cleanDoc = cleanDocument(doc);
    const { data } = await supabase
      .from('profiles')
      .select('id')
      .eq('document', cleanDoc)
      .maybeSingle();
    return !!data;
  };

  const verifyRecaptcha = async (action: string): Promise<boolean> => {
    const token = await executeRecaptcha(action);
    
    if (!token) {
      toast({
        title: "Erro de verificação",
        description: "Não foi possível verificar. Recarregue a página e tente novamente.",
        variant: "destructive",
      });
      return false;
    }

    try {
      const response = await supabase.functions.invoke('verify-recaptcha', {
        body: { token, expectedAction: action }
      });

      if (response.error || !response.data?.success) {
        toast({
          title: "Verificação falhou",
          description: response.data?.error || "Atividade suspeita detectada. Tente novamente.",
          variant: "destructive",
        });
        return false;
      }

      return true;
    } catch (error) {
      console.error('reCAPTCHA verification error:', error);
      toast({
        title: "Erro de verificação",
        description: "Erro ao verificar. Tente novamente.",
        variant: "destructive",
      });
      return false;
    }
  };

  const handleAuth = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      // Verify reCAPTCHA first
      const action = isLogin ? 'login' : 'signup';
      const isHuman = await verifyRecaptcha(action);
      
      if (!isHuman) {
        setLoading(false);
        return;
      }

      if (isLogin) {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });

        if (error) throw error;

        toast({
          title: "Login realizado!",
          description: "Bem-vindo de volta!",
        });
        
        navigate('/dashboard');
      } else {
        // Validações de cadastro
        if (password !== confirmPassword) {
          toast({
            title: "Erro",
            description: "As senhas não coincidem.",
            variant: "destructive",
          });
          return;
        }

        // Validar documento
        const cleanDoc = cleanDocument(document);
        if (!cleanDoc) {
          setDocumentError('CPF ou CNPJ é obrigatório');
          return;
        }

        if (!validateDocument(cleanDoc)) {
          setDocumentError('CPF ou CNPJ inválido');
          return;
        }

        // Verificar se documento já existe
        const exists = await checkDocumentExists(document);
        if (exists) {
          setDocumentError('Este CPF/CNPJ já está vinculado a outra conta');
          toast({
            title: "Documento já cadastrado",
            description: "Este CPF/CNPJ já está vinculado a outra conta. Faça login ou use outro documento.",
            variant: "destructive",
          });
          return;
        }

        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/dashboard`,
            data: {
              full_name: fullName,
              document: cleanDoc,
            },
          },
        });

        if (error) throw error;

        toast({
          title: "Cadastro realizado!",
          description: "Você pode fazer login agora.",
        });

        setIsLogin(true);
      }
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleForgotPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo: `${window.location.origin}/auth?mode=reset`,
      });

      if (error) throw error;

      setResetEmailSent(true);
      toast({
        title: "Email enviado!",
        description: "Verifique sua caixa de entrada para redefinir sua senha.",
      });
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  const handleUpdatePassword = async (e: React.FormEvent) => {
    e.preventDefault();

    if (password !== confirmPassword) {
      toast({
        title: "Erro",
        description: "As senhas não coincidem.",
        variant: "destructive",
      });
      return;
    }

    setLoading(true);

    try {
      const { error } = await supabase.auth.updateUser({
        password: password,
      });

      if (error) throw error;

      toast({
        title: "Senha atualizada!",
        description: "Sua senha foi alterada com sucesso.",
      });

      navigate('/dashboard');
    } catch (error: any) {
      toast({
        title: "Erro",
        description: error.message,
        variant: "destructive",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <ForceLightTheme>
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-purple-100 to-indigo-100 text-slate-900 p-4">
      <div className="w-full max-w-md">
        <div className="flex items-center justify-center mb-4">
          <Button
            variant="ghost"
            onClick={() => navigate('/')}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar à Página Inicial
          </Button>
        </div>
        <div className="bg-white rounded-lg shadow-lg p-8">
          {isResetMode ? (
            <>
              <h1 className="text-3xl font-bold text-center mb-2">
                Redefinir Senha
              </h1>
              <p className="text-muted-foreground text-center mb-6">
                Digite sua nova senha
              </p>

              <form onSubmit={handleUpdatePassword} className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="password">Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="password"
                      type={showPassword ? "text" : "password"}
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirmPassword">Confirmar Nova Senha</Label>
                  <div className="relative">
                    <Input
                      id="confirmPassword"
                      type={showConfirmPassword ? "text" : "password"}
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      required
                      placeholder="••••••••"
                      minLength={6}
                      className="pr-10"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                      aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                    >
                      {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                    </button>
                  </div>
                </div>

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading}
                >
                  {loading ? 'Atualizando...' : 'Atualizar Senha'}
                </Button>
              </form>
            </>
          ) : forgotPasswordMode ? (
            <>
              <h1 className="text-3xl font-bold text-center mb-2">
                Recuperar Senha
              </h1>
              <p className="text-muted-foreground text-center mb-6">
                {resetEmailSent
                  ? 'Email enviado! Verifique sua caixa de entrada.'
                  : 'Digite seu email para receber o link de recuperação'}
              </p>

              {resetEmailSent ? (
                <div className="text-center space-y-4">
                  <div className="flex justify-center">
                    <div className="h-16 w-16 rounded-full bg-primary/10 flex items-center justify-center">
                      <svg
                        className="h-8 w-8 text-primary"
                        fill="none"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth="2"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                      >
                        <path d="M5 13l4 4L19 7"></path>
                      </svg>
                    </div>
                  </div>
                  <Button
                    onClick={() => {
                      setForgotPasswordMode(false);
                      setResetEmailSent(false);
                      setEmail('');
                    }}
                    variant="outline"
                    className="w-full"
                  >
                    Voltar ao Login
                  </Button>
                </div>
              ) : (
                <form onSubmit={handleForgotPassword} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="email">Email</Label>
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      required
                      placeholder="seu@email.com"
                    />
                  </div>

                  <Button
                    type="submit"
                    className="w-full"
                    disabled={loading}
                  >
                    {loading ? 'Enviando...' : 'Enviar Link de Recuperação'}
                  </Button>

                  <button
                    type="button"
                    onClick={() => {
                      setForgotPasswordMode(false);
                      setEmail('');
                    }}
                    className="w-full text-sm text-muted-foreground hover:text-foreground transition-colors"
                  >
                    Voltar ao Login
                  </button>
                </form>
              )}
            </>
          ) : (
            <>
              <h1 className="text-3xl font-bold text-center mb-2">
                {isLogin ? 'Entrar' : 'Cadastrar'}
              </h1>
              <p className="text-muted-foreground text-center mb-6">
                {isLogin
                  ? 'Faça login para acessar sua conta'
                  : 'Crie sua conta para começar'}
              </p>

              <form onSubmit={handleAuth} className="space-y-4">
            {!isLogin && (
              <>
                <div className="space-y-2">
                  <Label htmlFor="fullName">Nome Completo</Label>
                  <Input
                    id="fullName"
                    type="text"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    required={!isLogin}
                    placeholder="Seu nome completo"
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="document">CPF ou CNPJ *</Label>
                  <Input
                    id="document"
                    type="text"
                    value={document}
                    onChange={handleDocumentChange}
                    required={!isLogin}
                    placeholder="000.000.000-00"
                    maxLength={18}
                    className={documentError ? 'border-destructive' : ''}
                  />
                  {documentError ? (
                    <p className="text-xs text-destructive">{documentError}</p>
                  ) : (
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Info className="h-3 w-3" />
                      Usado para evitar contas duplicadas e garantir segurança
                    </p>
                  )}
                </div>
              </>
            )}

            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="seu@email.com"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  minLength={6}
                  className="pr-10"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                  aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                >
                  {showPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                </button>
              </div>
            </div>

            {!isLogin && (
              <div className="space-y-2">
                <Label htmlFor="confirmPassword">Confirmar Senha</Label>
                <div className="relative">
                  <Input
                    id="confirmPassword"
                    type={showConfirmPassword ? "text" : "password"}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    required={!isLogin}
                    placeholder="••••••••"
                    minLength={6}
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                    aria-label={showConfirmPassword ? "Ocultar senha" : "Mostrar senha"}
                  >
                    {showConfirmPassword ? <EyeOff size={20} /> : <Eye size={20} />}
                  </button>
                </div>
              </div>
            )}

                <Button
                  type="submit"
                  className="w-full"
                  disabled={loading || !recaptchaLoaded}
                >
                  {loading ? 'Verificando...' : !recaptchaLoaded ? 'Carregando proteção...' : isLogin ? 'Entrar' : 'Cadastrar'}
                </Button>

                <div className="flex items-center justify-center gap-1 text-xs text-muted-foreground mt-2">
                  <Shield className="h-3 w-3" />
                  <span>Protegido por reCAPTCHA</span>
                </div>
              </form>

              {isLogin && (
                <div className="mt-4 text-center">
                  <button
                    onClick={() => setForgotPasswordMode(true)}
                    className="text-sm text-primary hover:underline"
                  >
                    Esqueceu sua senha?
                  </button>
                </div>
              )}

              <div className="mt-6 text-center">
                <button
                  onClick={() => setIsLogin(!isLogin)}
                  className="text-sm text-primary hover:underline"
                >
                  {isLogin
                    ? 'Não tem uma conta? Cadastre-se'
                    : 'Já tem uma conta? Faça login'}
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
    </ForceLightTheme>
  );
};

export default Auth;
