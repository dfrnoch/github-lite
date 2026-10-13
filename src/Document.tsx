import type { ParentProps } from 'solid-js';
import { HydrationScript } from '@solidjs/web';

// Applies the saved color mode before first paint (Primer's token sheets key
// off <html data-color-mode>), so dark-mode users never see a light flash.
const themeScript = `try{var m=localStorage.getItem('gh-lite:color-mode');if(m)document.documentElement.dataset.colorMode=m}catch(e){}`;

export default function Document(props: ParentProps) {
  return (
    <html lang="en" data-color-mode="auto" data-light-theme="light" data-dark-theme="dark">
      <head>
        <meta charset="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <link rel="icon" href="/favicon.svg" type="image/svg+xml" />
        <title>GitHub</title>
        {/* oxlint-disable-next-line solid/no-innerhtml -- static inline script */}
        <script innerHTML={themeScript} />
        <HydrationScript />
      </head>
      <body>{props.children}</body>
    </html>
  );
}
