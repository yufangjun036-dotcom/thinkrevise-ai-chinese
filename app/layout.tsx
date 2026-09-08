import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "ThinkRevise AI (Chinese)｜学术英语修改教练",
  description: "帮助多语言大学生练习写作、修改学术英语并反思学习过程。",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html
      lang="zh-CN"
      className="h-full antialiased"
    >
      <body className="min-h-full flex flex-col">{children}</body>
    </html>
  );
}
