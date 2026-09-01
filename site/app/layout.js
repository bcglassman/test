import './globals.css';

export const metadata = {
  title: {
    default: 'Meet in Motion — active things to do in Singapore, alone or not',
    template: '%s · Meet in Motion',
  },
  description:
    'Runs, padel, pickleball, bouldering and club sessions across Singapore — ' +
    'with the one thing other listings leave out: whether you can turn up on your own.',
};

export const viewport = { themeColor: '#0B5563' };

export default function RootLayout({ children }) {
  return (
    <html lang="en-SG">
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link
          rel="stylesheet"
          href="https://fonts.googleapis.com/css2?family=Bricolage+Grotesque:opsz,wght@12..96,500;12..96,700&family=Source+Serif+4:ital,opsz,wght@0,8..60,400;0,8..60,600;1,8..60,400&family=IBM+Plex+Mono:wght@400;500&display=swap"
        />
      </head>
      <body>
        <header className="site-header">
          <div className="wrap">
            <a className="brand" href="/">Meet in <span className="mark">Motion</span></a>
            <nav>
              <a href="/browse">Browse</a>
              <a href="/coaches">Coaches</a>
            </nav>
          </div>
        </header>
        <main>{children}</main>
        <footer className="site-footer">
          <div className="wrap">
            Meet in Motion — active social events in Singapore.{' '}
            Listings are checked by a person before they appear here.
          </div>
        </footer>
      </body>
    </html>
  );
}
