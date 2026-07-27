
export default function Footer() {
  return (
    <footer className="border-t border-white/10 bg-[#06080A]">
      <div className="mx-auto max-w-[1400px] px-4 md:px-8 py-12">
        <div className="flex flex-col md:flex-row justify-between items-center md:items-start gap-12 border-b border-white/10 pb-12">
          <div className="flex flex-col items-center md:items-start gap-4">
            <a href="/" className="font-display text-2xl text-white tracking-tight">Flamingo aur Maina</a>
            <p className="text-white/50 text-sm max-w-xs text-center md:text-left leading-relaxed">
              A sanctuary of refined luxury and untold stories amidst nature's embrace.
            </p>
          </div>
          <div className="flex gap-16 text-center md:text-left">
            <div className="flex flex-col gap-4">
              <h4 className="text-white/40 font-medium text-xs mb-2 tracking-widest uppercase">Explore</h4>
              <a href="/" className="text-white/50 hover:text-white transition-colors text-sm">Home</a>
              <a href="/pages/rooms" className="text-white/50 hover:text-white transition-colors text-sm">Rooms</a>
              <a href="/pages/life" className="text-white/50 hover:text-white transition-colors text-sm">Life at FAM</a>
              <a href="/pages/explore" className="text-white/50 hover:text-white transition-colors text-sm">Explore</a>
              <a href="/pages/gallery" className="text-white/50 hover:text-white transition-colors text-sm">Gallery</a>
            </div>
            <div className="flex flex-col gap-4">
              <h4 className="text-white/40 font-medium text-xs mb-2 tracking-widest uppercase">Connect</h4>
              <a href="/pages/amenities" className="text-white/50 hover:text-white transition-colors text-sm">Amenities</a>
              <a href="tel:9876575673" className="text-white/50 hover:text-white transition-colors text-sm">98765 75673</a>
              <a href="mailto:hello@flamingoaurmaina.com" className="text-white/50 hover:text-white transition-colors text-sm">hello@flamingoaurmaina.com</a>
              <a href="https://www.instagram.com/flamingoaurmaina?igsh=ejFucDV1MWkzam5x" target="_blank" rel="noopener noreferrer" className="text-white/50 hover:text-white transition-colors text-sm">Instagram</a>
            </div>
          </div>
        </div>
        <div className="mt-8 flex flex-col md:flex-row justify-between items-center gap-4 text-xs text-white/30">
          <p>&copy; {new Date().getFullYear()} Flamingo aur Maina. All rights reserved.</p>
        </div>
      </div>
    </footer>
  )
}
