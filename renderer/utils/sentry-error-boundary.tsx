import React from 'react';
import * as Sentry from '@sentry/browser';

const SENTRY_PUBLIC_DSN = 'https://2dffdbd619f34418817f4db3309299ce@sentry.io/255536';

class SentryErrorBoundary extends React.Component<{children: React.ReactNode}> {
  async componentDidMount() {
    const isDev = await window.kap.ipc.invoke('kap:app:isDevelopment');
    const allowAnalytics = await window.kap.ipc.invoke('settings:get', 'allowAnalytics');

    if (!isDev && allowAnalytics) {
      const name = await window.kap.app.getName();
      const version = await window.kap.app.getVersion();
      const release = `${name}@${version}`.toLowerCase();
      Sentry.init({dsn: SENTRY_PUBLIC_DSN, release});
    }
  }

  componentDidCatch(error, errorInfo) {
    console.log(error, errorInfo);
    Sentry.configureScope(scope => {
      for (const [key, value] of Object.entries(errorInfo)) {
        scope.setExtra(key, value);
      }
    });

    Sentry.captureException(error);

    // This is needed to render errors correctly in development / production
    super.componentDidCatch(error, errorInfo);
  }

  render() {
    return this.props.children;
  }
}

export default SentryErrorBoundary;
