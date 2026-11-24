// BlueStep's real sign-in page already exists on this site's own domain under
// the reserved `/shared/` prefix (confirmed live: `/shared/login.jsp`, per
// bluestep-reference's git-site-spa.md). The app never collects credentials
// itself — it only links out to that page, with `desturl` so a successful
// sign-in returns the user to the page they were on (observed on the login
// page's own "Sign in with a global account" link).

export function getSignInUrl(): string {
  const dest = `${window.location.pathname}${window.location.search}`
  return `/shared/login.jsp?desturl=${encodeURIComponent(dest)}`
}
