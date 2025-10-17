import { Home, LogIn } from "lucide-react";
import { ArchiveRestore } from 'lucide-react';

export default function Navbar({ pageTitle = "Downloads" }) {
  return (
    <header className="bg-white/95 backdrop-blur-sm border-b border-gray-200 shadow-lg rounded-t-lg fixed w-full top-0 z-50 h-16">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-full flex items-center justify-between">
        <div className="flex items-center space-x-2 sm:space-x-3">
          <div className="w-8 h-8 bg-green-600 rounded-lg flex items-center justify-center transition-transform hover:scale-105">
            <span className="text-primary-foreground font-bold text-sm  ">
              <ArchiveRestore/>
            </span>
          </div>
          <span className="text-lg sm:text-xl font-bold text-foreground font-sans">{pageTitle}</span>
        </div>
        <nav role="navigation" aria-label="Main navigation" className="flex items-center space-x-2 sm:space-x-4 md:space-x-6 p-1 sm:p-2">
          <a href="/" className="flex items-center space-x-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-300 ease-in-out px-2 py-2 rounded-lg group" aria-label="Go to Home page">
            <Home className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
            <span className="hidden sm:inline">Home</span>
           
          </a>
          <a href="/login" className="flex items-center space-x-1.5 text-muted-foreground hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 transition-all duration-300 ease-in-out px-2 py-2 rounded-lg group" aria-label="Go to Login page">
            <LogIn className="w-4 h-4 group-hover:scale-110 transition-transform duration-300" />
            <span className="hidden sm:inline">Login</span>
            
          </a>
         
        </nav>
      </div>
    </header>
  );
}