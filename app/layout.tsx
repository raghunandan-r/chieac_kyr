import { Analytics } from '@vercel/analytics/next';
import { SpeedInsights } from "@vercel/speed-insights/next"
export const metadata = { title: 'Know Your Rights with CHIEAC', description: 'Know Your Rights' };
import './globals.css';

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        <style
          dangerouslySetInnerHTML={{
            __html:
              `
                html, body { height: 100%; margin: 0; }
                body { background: #000; color: #fff; font: 14px/1.4 ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; }
                * { box-sizing: border-box; }
              `,
          }}
        />
      </head>
      <body>
        {children}
        <Analytics />
        <SpeedInsights />
      </body>
    </html>
  );
}