import { getSignInUrl } from '../lib/auth.ts'
import './SignInPrompt.css'

export function SignInPrompt() {
  return (
    <div class="sign-in-prompt">
      <p class="sign-in-prompt-message">You're signed out, so this page has no data to show.</p>
      <a class="sign-in-prompt-link" href={getSignInUrl()}>
        Sign in
      </a>
    </div>
  )
}
