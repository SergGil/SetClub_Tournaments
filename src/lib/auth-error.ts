// Auth.js error codes: https://authjs.dev/reference/core/errors
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  Configuration: "Проблема з налаштуваннями входу на сервері. Спробуйте пізніше або повідомте адміністратора.",
  AccessDenied: "Доступ заборонено.",
  Verification: "Посилання для входу застаріло або вже використане.",
  OAuthAccountNotLinked: "Цей email вже пов'язаний з іншим способом входу.",
  OAuthCallback: "Не вдалося завершити вхід через Google. Спробуйте ще раз.",
  OAuthSignin: "Не вдалося почати вхід через Google. Спробуйте ще раз.",
  Default: "Не вдалося увійти. Спробуйте ще раз.",
};

/** A friendly Ukrainian message for an Auth.js `error` search param, or null if there isn't one. */
export function authErrorMessage(code: string | undefined): string | null {
  if (!code) return null;
  return AUTH_ERROR_MESSAGES[code] ?? AUTH_ERROR_MESSAGES.Default;
}
