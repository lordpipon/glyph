import type { Metadata, Viewport } from "next";
import {
  Figtree,
  Geist_Mono,
  IBM_Plex_Sans,
  Inter,
  Literata,
  Manrope,
  Newsreader,
  Space_Grotesk, Geist } from "next/font/google";
import "./globals.css";
import { cn } from "@/lib/utils";

const geist = Geist({subsets:['latin'],variable:'--font-sans'});

/**
 * Every typeface offered in Settings is loaded once, as a variable font, and
 * exposed as a CSS variable. Only the chosen family is ever painted, so the
 * browser fetches a single file per visit.
 */
const inter = Inter({ variable: "--f-inter", subsets: ["latin"] });
const figtree = Figtree({ variable: "--f-figtree", subsets: ["latin"] });
const manrope = Manrope({ variable: "--f-manrope", subsets: ["latin"] });
const grotesk = Space_Grotesk({ variable: "--f-grotesk", subsets: ["latin"] });
const plex = IBM_Plex_Sans({
  variable: "--f-plex",
  subsets: ["latin"],
  weight: ["400", "500", "600"],
});
const literata = Literata({ variable: "--f-literata", subsets: ["latin"] });
const newsreader = Newsreader({ variable: "--f-newsreader", subsets: ["latin"] });

const mono = Geist_Mono({ variable: "--font-mono", subsets: ["latin"] });

const fontClass = [
  inter.variable,
  figtree.variable,
  manrope.variable,
  grotesk.variable,
  plex.variable,
  literata.variable,
  newsreader.variable,
  mono.variable,
].join(" ");

export const metadata: Metadata = {
  title: {
    default: "Glyph Text Editor",
    template: "%s — Glyph Text Editor",
  },
  description:
    "A local-first markdown editor with inline rendering, wikilinks, tags and folders.",
  applicationName: "Glyph",
};

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#17161c" },
    { media: "(prefers-color-scheme: light)", color: "#fbfbfd" },
  ],
};

/** Paint the stored theme and font before the first frame, so nothing flashes. */
const bootstrap = `try{
var p=JSON.parse(localStorage.getItem("glyph.prefs.v1")||"{}");
var t=p.theme||"system";
if(t==="aluminium"){t="system"}
document.documentElement.dataset.theme=t;
var f=localStorage.getItem("glyph.font");
if(f&&/^[a-z-]+$/.test(f)){document.documentElement.dataset.font=f}
}catch(e){}`;

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="en" suppressHydrationWarning className={cn(fontClass, "font-sans", geist.variable)} data-font="inter">
      <body>
        <script dangerouslySetInnerHTML={{ __html: bootstrap }} />
        {children}
      </body>
    </html>
  );
}
