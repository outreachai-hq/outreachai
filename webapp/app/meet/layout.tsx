export default function MeetLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <head>
        {/* Force light mode — this is a public booking page, always shown light */}
        <script dangerouslySetInnerHTML={{ __html: `(function(){try{document.documentElement.classList.remove('dark')}catch(e){}})();` }} />
      </head>
      <body style={{ margin: 0, fontFamily: 'system-ui, sans-serif' }}>{children}</body>
    </html>
  )
}
