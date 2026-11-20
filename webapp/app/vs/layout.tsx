// All /vs/* comparison pages are marketing pages — always render in light mode
// regardless of the user's dark-mode preference. The inline script runs before
// paint (same pattern as the dark-mode toggle in the root layout) so there is
// no flash.
export default function VsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <script
        dangerouslySetInnerHTML={{
          __html: `(function(){try{document.documentElement.classList.remove('dark')}catch(e){}})();`,
        }}
      />
      {children}
    </>
  )
}
