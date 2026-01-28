import React from 'react';

const Footer = () => {
  const currentYear = new Date().getFullYear();

  return (
    <footer id="contact" className="py-16 bg-gradient-to-br from-neutral-950 via-neutral-900 to-neutral-950 text-white relative overflow-hidden border-t border-neutral-800/50">
      {/* Background decoration */}
      <div className="absolute top-0 right-0 w-64 h-64 bg-gradient-to-bl from-neon-blue/10 to-transparent rounded-full blur-3xl"></div>
      <div className="absolute bottom-0 left-0 w-96 h-96 bg-gradient-to-tr from-neon-purple/10 to-transparent rounded-full blur-3xl"></div>
      
      <div className="max-w-container mx-auto px-6 relative z-10">
        <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12 animate-fade-in-up">
          {/* Brand Section */}
          <div className="lg:col-span-2 animate-slide-in-left">
            <h3 className="text-2xl font-bold bg-gradient-to-r from-neon-blue to-neon-purple bg-clip-text text-transparent mb-4 transition-all duration-300">Auravo</h3>
            <p className="text-neutral-400 mb-6 leading-relaxed hover:text-neutral-300 transition-colors duration-300 max-w-md">
              The premium, calming AI for future-focused minds. Elevate your voice, presence, and digital experience.
            </p>
            
            {/* Download Auravo Section */}
            <div className="mb-6">
              <h4 className="text-sm font-semibold text-neutral-300 mb-3">Download Auravo</h4>
              <div className="flex gap-3">
                {/* iOS App Store Placeholder */}
                <a 
                  href="#" 
                  className="group flex items-center gap-2 px-4 py-2.5 bg-neutral-900/60 border border-neutral-800/50 rounded-lg hover:bg-neutral-900/80 hover:border-neon-blue/30 hover:shadow-glow-soft transition-all duration-300 backdrop-blur-sm"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-lg flex items-center justify-center group-hover:from-neon-blue/20 group-hover:to-neon-purple/20 transition-all duration-300">
                    <svg className="w-5 h-5 text-neutral-300 group-hover:text-neon-blue" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M17.05 20.28c-.98.95-2.05.88-3.08.4-1.09-.5-2.08-.96-3.24-.96-1.24 0-1.81.66-2.87.66-1.18 0-2.06-.91-3.13-1.93-1.37-1.29-2.42-3.25-2.42-5.21 0-3.18 2.07-4.84 4.03-4.84 1.08 0 1.96.72 2.96.72 1 0 1.78-.73 2.99-.73 1.38 0 2.35.96 3.09 1.78-2.72 1.51-2.28 5.4.45 6.69-.55.38-1.18.6-1.84.98v.01c-.19.09-.39.19-.58.3-.72.4-1.48.82-2.12 1.4zM12.03.01c.13 1.19.81 2.19 1.87 2.91 1.05.72 2.34 1.01 3.51.79-.15 1.22-.84 2.38-1.9 3.09-1.05.72-2.33 1.01-3.5.79.13-1.19.81-2.19 1.87-2.91 1.05-.72 2.34-1.01 3.51-.79z"/>
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-neutral-400 group-hover:text-neutral-300">Download on the</span>
                    <span className="text-sm font-semibold text-neutral-200 group-hover:text-neon-blue">App Store</span>
                  </div>
                </a>
                
                {/* Google Play Store Placeholder */}
                <a 
                  href="#" 
                  className="group flex items-center gap-2 px-4 py-2.5 bg-neutral-900/60 border border-neutral-800/50 rounded-lg hover:bg-neutral-900/80 hover:border-neon-purple/30 hover:shadow-glow-soft transition-all duration-300 backdrop-blur-sm"
                >
                  <div className="w-8 h-8 bg-gradient-to-br from-neutral-700 to-neutral-800 rounded-lg flex items-center justify-center group-hover:from-neon-purple/20 group-hover:to-neon-blue/20 transition-all duration-300">
                    <svg className="w-5 h-5 text-neutral-300 group-hover:text-neon-purple" fill="currentColor" viewBox="0 0 24 24">
                      <path d="M3,20.5V3.5C3,2.91 3.34,2.39 3.84,2.15L13.69,12L3.84,21.85C3.34,21.6 3,21.09 3,20.5M16.81,15.12L6.05,21.34L14.54,12.85L16.81,15.12M20.16,10.81C20.5,11.08 20.75,11.5 20.75,12C20.75,12.5 20.5,12.92 20.16,13.19L6.05,21.34L14.54,12.85L20.16,10.81M6.05,2.66L16.81,8.88L14.54,11.15L6.05,2.66Z"/>
                    </svg>
                  </div>
                  <div className="flex flex-col">
                    <span className="text-xs text-neutral-400 group-hover:text-neutral-300">Get it on</span>
                    <span className="text-sm font-semibold text-neutral-200 group-hover:text-neon-purple">Google Play</span>
                  </div>
                </a>
              </div>
            </div>

            {/* Social Links */}
            <div className="flex gap-3">
              <a href="#" className="w-10 h-10 bg-neutral-900/60 border border-neutral-800/50 rounded-lg flex items-center justify-center hover:bg-neon-blue/20 hover:border-neon-blue hover:scale-110 hover:shadow-glow-blue transition-all duration-300 transform backdrop-blur-sm">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M24 4.557c-.883.392-1.832.656-2.828.775 1.017-.609 1.798-1.574 2.165-2.724-.951.564-2.005.974-3.127 1.195-.897-.957-2.178-1.555-3.594-1.555-3.179 0-5.515 2.966-4.797 6.045-4.091-.205-7.719-2.165-10.148-5.144-1.29 2.213-.669 5.108 1.523 6.574-.806-.026-1.566-.247-2.229-.616-.054 2.281 1.581 4.415 3.949 4.89-.693.188-1.452.232-2.224.084.626 1.956 2.444 3.379 4.6 3.419-2.07 1.623-4.678 2.348-7.29 2.04 2.179 1.397 4.768 2.212 7.548 2.212 9.142 0 14.307-7.721 13.995-14.646.962-.695 1.797-1.562 2.457-2.549z"/>
                </svg>
              </a>
              <a href="#" className="w-10 h-10 bg-neutral-900/60 border border-neutral-800/50 rounded-lg flex items-center justify-center hover:bg-neon-purple/20 hover:border-neon-purple hover:scale-110 hover:shadow-glow-purple transition-all duration-300 transform backdrop-blur-sm">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/>
                </svg>
              </a>
              <a href="#" className="w-10 h-10 bg-neutral-900/60 border border-neutral-800/50 rounded-lg flex items-center justify-center hover:bg-neon-cyan/20 hover:border-neon-cyan hover:scale-110 hover:shadow-glow transition-all duration-300 transform backdrop-blur-sm">
                <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24">
                  <path d="M12.017 0C5.396 0 .029 5.367.029 11.987c0 5.079 3.158 9.417 7.618 11.174-.105-.949-.199-2.403.041-3.439.219-.937 1.406-5.957 1.406-5.957s-.359-.72-.359-1.781c0-1.663.967-2.911 2.168-2.911 1.024 0 1.518.769 1.518 1.688 0 1.029-.653 2.567-.992 3.992-.285 1.193.6 2.165 1.775 2.165 2.128 0 3.768-2.245 3.768-5.487 0-2.861-2.063-4.869-5.008-4.869-3.41 0-5.409 2.562-5.409 5.199 0 1.033.394 2.143.889 2.741.097.118.112.215.085.334-.09.375-.293 1.199-.334 1.363-.053.225-.172.271-.402.165-1.495-.69-2.433-2.878-2.433-4.646 0-3.776 2.748-7.252 7.92-7.252 4.158 0 7.392 2.967 7.392 6.923 0 4.135-2.607 7.462-6.233 7.462-1.214 0-2.357-.629-2.748-1.378 0 0-.599 2.282-.744 2.840-.282 1.084-1.064 2.456-1.549 3.235C9.584 23.815 10.77 24.001 12.017 24.001c6.624 0 11.99-5.367 11.99-11.988C24.007 5.367 18.641.001 12.017.001z"/>
                </svg>
              </a>
            </div>
          </div>

          {/* Quick Links */}
          <div className="animate-fade-in-up" style={{ animationDelay: "0.4s" }}>
            <h4 className="font-semibold text-neutral-100 mb-4 hover:text-neon-blue transition-colors duration-300">Quick Links</h4>
            <ul className="space-y-2.5">
              <li>
                <a href="#about" className="text-neutral-400 hover:text-neon-blue hover:translate-x-1 transition-all duration-300 inline-block">
                  About Auravo
                </a>
              </li>
              <li>
                <a href="#programs" className="text-neutral-400 hover:text-neon-blue hover:translate-x-1 transition-all duration-300 inline-block">
                  Programs
                </a>
              </li>
              <li>
                <a href="#workshops" className="text-neutral-400 hover:text-neon-blue hover:translate-x-1 transition-all duration-300 inline-block">
                  Workshops
                </a>
              </li>
              <li>
                <a href="/book-workshop" className="text-neutral-400 hover:text-neon-blue hover:translate-x-1 transition-all duration-300 inline-block">
                  Book a Workshop
                </a>
              </li>
            </ul>
          </div>

          {/* Contact Info */}
          <div className="animate-fade-in-up" style={{ animationDelay: "0.6s" }}>
            <h4 className="font-semibold text-neutral-100 mb-4 hover:text-neon-purple transition-colors duration-300">Contact</h4>
            <ul className="space-y-2.5 text-neutral-400">
              <li>
                <a href="mailto:contact@auravo.com" className="hover:text-neon-blue transition-colors duration-300">
                  contact@auravo.com
                </a>
              </li>
              <li className="hover:text-neutral-300 transition-colors duration-300">
                Available worldwide
              </li>
              <li className="hover:text-neutral-300 transition-colors duration-300">
                Virtual & on-site sessions
              </li>
            </ul>
          </div>
        </div>

        {/* Legal Links */}
        <div className="border-t border-neutral-800/50 pt-8 flex flex-col md:flex-row justify-between items-center animate-fade-in-up" style={{ animationDelay: "0.8s" }}>
          <p className="text-neutral-500 hover:text-neutral-400 transition-colors duration-300 text-sm">
            © {currentYear} Auravo. All rights reserved.
          </p>
          <div className="flex gap-6 mt-4 md:mt-0">
            <a href="/privacy" className="text-neutral-500 hover:text-neon-blue transition-colors duration-300 text-sm">
              Privacy Policy
            </a>
            <a href="/terms" className="text-neutral-500 hover:text-neon-blue transition-colors duration-300 text-sm">
              Terms of Service
            </a>
          </div>
        </div>
      </div>
    </footer>
  );
};

export default Footer;