// Applies the right background before React mounts to prevent the
// black-screen flash on iOS standalone launch. Reads the persisted theme
// from localStorage and falls back to the system preference.
// Kept as an external file (not inline) so the CSP can forbid inline scripts.
try {
  var s = JSON.parse(localStorage.getItem('budget-app-store') || '{}')
  var t = s && s.state && s.state.settings && s.state.settings.theme
  var dark = t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme:dark)').matches)
  if (dark) document.documentElement.classList.add('dark')
} catch (e) {}
