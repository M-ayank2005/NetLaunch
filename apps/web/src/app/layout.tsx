import type { Metadata } from "next";
import { Inter, JetBrains_Mono } from "next/font/google";
import "./globals.css";
import Link from "next/link";
import { Terminal, Github, Plus, Layers, BookOpen } from "lucide-react";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });
const jetbrains = JetBrains_Mono({ subsets: ["latin"], variable: "--font-jetbrains" });

export const metadata: Metadata = {
  title: "NetLaunch | Enterprise Cloud Deployment Engine",
  description: "Next-generation distributed deployment platform with isolated Docker builds, BullMQ queues, and Glassmorphism control plane.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${inter.variable} ${jetbrains.variable} dark`}>
      <body className="min-h-screen flex flex-col bg-[#09090b] text-zinc-100 selection:bg-blue-600/30">
        {/* Subtle ambient grid pattern for depth without colorful AI gradients */}
        <div className="fixed inset-0 ambient-grid pointer-events-none opacity-80" />

        {/* Top Control Plane Navigation Bar */}
        <header className="sticky top-0 z-50 border-b border-zinc-800/80 bg-zinc-900/40 backdrop-blur-xl">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-6">
            <div className="flex items-center space-x-8">
              <Link href="/" className="flex items-center space-x-3 group">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-zinc-800/80 border border-zinc-700/80 text-white shadow-lg transition-transform duration-200 group-hover:scale-105">
                  <Terminal className="h-5 w-5 text-emerald-400" />
                </div>
                <div className="flex flex-col">
                  <span className="font-bold tracking-tight text-base leading-none text-white">NetLaunch</span>
                  <span className="text-[10px] tracking-widest uppercase text-zinc-500 font-mono mt-0.5">Control Plane</span>
                </div>
              </Link>

              <nav className="hidden md:flex items-center space-x-1 text-sm font-medium">
                <Link
                  href="/dashboard"
                  className="flex items-center space-x-2 rounded-xl px-3.5 py-2 text-zinc-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  <Layers className="h-4 w-4 text-zinc-400" />
                  <span>Dashboard</span>
                </Link>
                <Link
                  href="/new"
                  className="flex items-center space-x-2 rounded-xl px-3.5 py-2 text-zinc-300 transition-colors hover:bg-white/[0.04] hover:text-white"
                >
                  <Plus className="h-4 w-4 text-emerald-400" />
                  <span>New Project</span>
                </Link>
              </nav>
            </div>

            <div className="flex items-center space-x-4">
              <div className="hidden sm:flex items-center space-x-2 rounded-full border border-zinc-800 bg-zinc-900/60 px-3 py-1 text-xs text-zinc-400">
                <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                <span>Docker Engine Active</span>
              </div>

              <a
                href="http://localhost:4000/api/v1/auth/github"
                className="inline-flex items-center space-x-2 rounded-xl border border-zinc-700/80 bg-zinc-800/80 px-4 py-2 text-sm font-medium text-white shadow-lg backdrop-blur-md transition-all hover:bg-zinc-700 hover:border-zinc-600 active:scale-95"
              >
                <Github className="h-4 w-4" />
                <span>GitHub Login</span>
              </a>
            </div>
          </div>
        </header>

        {/* Main Workspace Content Area */}
        <main className="relative z-10 flex-1 max-w-7xl mx-auto w-full px-6 py-8">
          {children}
        </main>

        {/* Minimal Footer */}
        <footer className="relative z-10 border-t border-zinc-800/60 bg-zinc-950/60 py-6 text-center text-xs text-zinc-500 font-mono">
          NetLaunch Distributed System Architecture • Built from first principles
        </footer>
      </body>
    </html>
  );
}
