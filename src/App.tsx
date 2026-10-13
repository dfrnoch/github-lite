import { Title } from '@solidjs/meta';
import { useLocation } from '@solidjs/router';
import { Errored, Loading, Show } from 'solid-js';
import '@unocss/reset/tailwind.css';
import '@primer/primitives/dist/css/functional/themes/light.css';
import '@primer/primitives/dist/css/functional/themes/dark.css';
import 'github-markdown-css/github-markdown.css';
import './styles/primer.css';
import 'virtual:uno.css';
import AppHeader from './components/layout/AppHeader';
import Footer from './components/layout/Footer';
import { ErrorView, PageSpinner, Toasts } from './components/ui';
import { isSignedIn } from './lib/auth';
import LoginPage from './routes/login/index';
import { Router } from './router';

export default function App() {
  return (
    <Router>
      {(props) => {
        const location = useLocation();
        const isAuthRoute = () => location.pathname.startsWith('/login');
        return (
          <>
            <Title>GitHub</Title>
            <Show
              when={isSignedIn() || isAuthRoute()}
              // Signed out: show the login form in place, at the requested URL —
              // signing in then simply renders the page that was asked for.
              fallback={<LoginPage />}
            >
              <Show when={!isAuthRoute()}>
                <AppHeader />
              </Show>
              <main class="min-h-[calc(100vh-200px)]">
                <Errored fallback={(err, reset) => <ErrorView error={err()} reset={reset} />}>
                  <Loading fallback={<PageSpinner />}>{props.children}</Loading>
                </Errored>
              </main>
              <Footer />
            </Show>
            <Toasts />
          </>
        );
      }}
    </Router>
  );
}
