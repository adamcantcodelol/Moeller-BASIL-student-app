import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Moeller BASIL Protein Platform",
  description:
    "Educational bioinformatics platform for the Molecular Biology Research Course at Archbishop Moeller High School.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
