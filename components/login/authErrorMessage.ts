import { ApiError } from "@/src/api/client";

export function authErrorMessage(e: unknown, fallback: string): string {
  if (e instanceof ApiError) {
    if (e.status === 0) {
      return e.message;
    }
    if (e.status === 400) {
      return "Confira os dados informados. A senha precisa ter pelo menos 8 caracteres.";
    }
    if (e.status === 401) {
      return "E-mail ou senha inválidos.";
    }
    if (e.status === 409) {
      return "Este e-mail já possui uma conta. Faça login ou use outro e-mail.";
    }
    if (e.status >= 500) {
      return "Falha interna no servidor. Tente novamente em instantes.";
    }
  }
  return e instanceof Error ? e.message : fallback;
}
