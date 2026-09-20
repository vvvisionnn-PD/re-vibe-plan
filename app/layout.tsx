import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "대주단 제출용 사업계획서",
  description: "입력한 값으로 시행사가 대주단에 제출할 사업계획서를 만든다",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="ko" className="h-full antialiased">
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
