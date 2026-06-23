import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Batch Creative — AI Social Posts",
  description: "Batch product → styled social posts, streamed as they generate.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  );
}
