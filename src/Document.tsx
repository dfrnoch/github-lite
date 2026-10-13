import type { ParentProps } from 'solid-js';
import { HydrationScript } from '@solidjs/web';

// Applies the saved theme before first paint, mirroring themeAttributes() in
// src/lib/theme.ts: sets <html data-color-mode/-light-theme/-dark-theme> and
// writes a render-blocking <link> for non-default themes (dimmed, high
// contrast, colorblind…), so no page ever flashes in the wrong theme.
const themeScript = `try{
var s=JSON.parse(localStorage.getItem('gh-lite:theme')||'null');
if(!s){var m=localStorage.getItem('gh-lite:color-mode');s=m==='light'||m==='dark'?{mode:'single',single:m}:{}}
var d={mode:'sync',single:'light',day:'light',night:'dark',contrast:{light:false,dark:false}},k,a,b,c;
for(k in d)if(s[k]==null)s[k]=d[k];
function dk(t){return t.indexOf('dark')===0}
function r(t){return s.contrast[dk(t)?'dark':'light']?t+'_high_contrast':t}
if(s.mode==='single'){a=dk(s.single)?'dark':'light';b=c=r(s.single)}else{a='auto';b=r(s.day);c=r(s.night)}
var e=document.documentElement;e.dataset.colorMode=a;e.dataset.lightTheme=b;e.dataset.darkTheme=c;
(b===c?[b]:[b,c]).forEach(function(t){if(t!=='light'&&t!=='dark')document.write('<link id="primer-theme-'+t+'" rel="stylesheet" href="/themes/'+t.replace(/_/g,'-')+'.css">')});
}catch(x){}`;

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
