/**
 * Traduz e sanitiza mensagens de erro de autenticação e rede para mensagens amigáveis em português.
 */
export function formatAuthError(error: any): string {
  if (!error) return 'Ocorreu um erro desconhecido ao realizar o login.';

  const message = typeof error === 'string' ? error : error.message || String(error);
  const lower = message.toLowerCase();

  // Erros de conexão / rede ("Failed to fetch", "Load failed", CORS, Timeout)
  if (
    lower.includes('failed to fetch') ||
    lower.includes('load failed') ||
    lower.includes('networkerror') ||
    lower.includes('network error') ||
    lower.includes('fetch failed') ||
    lower.includes('websocket error') ||
    lower.includes('timeout')
  ) {
    if (typeof navigator !== 'undefined' && !navigator.onLine) {
      return 'Você está sem conexão com a internet. Verifique sua rede Wi-Fi ou dados móveis e tente novamente.';
    }
    return 'Não foi possível conectar ao servidor. Verifique sua conexão com a internet ou tente novamente em alguns instantes.';
  }

  // Erros de credenciais
  if (lower.includes('invalid login credentials') || lower.includes('invalid_credentials')) {
    return 'E-mail ou senha incorretos. Verifique suas credenciais e tente novamente.';
  }

  // Erro de e-mail não confirmado
  if (lower.includes('email not confirmed')) {
    return 'Seu e-mail ainda não foi confirmado. Verifique sua caixa de entrada e spam.';
  }

  // Limite de tentativas (Rate limit)
  if (lower.includes('too many requests') || lower.includes('rate limit exceeded')) {
    return 'Muitas tentativas de login em sequência. Por favor, aguarde 1 minuto e tente novamente.';
  }

  // Usuário não encontrado
  if (lower.includes('user not found')) {
    return 'Usuário não encontrado. Verifique o e-mail digitado.';
  }

  // Senha fraca / curta
  if (lower.includes('password should be at least')) {
    return 'A senha deve conter no mínimo 6 caracteres.';
  }

  return message;
}

/**
 * Executa uma função assíncrona com mecanismo de tentativas (retry) para lidar com oscilações temporárias de rede.
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  retries = 2,
  delayMs = 800
): Promise<T> {
  let lastError: any;
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fn();
    } catch (err: any) {
      lastError = err;
      const msg = (err?.message || '').toLowerCase();
      const isNetworkErr =
        msg.includes('failed to fetch') ||
        msg.includes('load failed') ||
        msg.includes('network') ||
        msg.includes('timeout');

      if (isNetworkErr && attempt < retries) {
        await new Promise((res) => setTimeout(res, delayMs * (attempt + 1)));
      } else {
        throw err;
      }
    }
  }
  throw lastError;
}
