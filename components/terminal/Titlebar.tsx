import { ChieacIcon, ImmigrantJusticeIcon } from '@/components/icons';

export default function Titlebar() {
  return (
    <div className="titlebar">
      <nav className="nav">
        <a href="https://chieac.org/" target="_blank" className="social-link" rel="noreferrer">
          <ChieacIcon />          
        </a>
      </nav>
      <nav className="nav">
        <a href="http://immigrantjustice.org/" target="_blank" className="social-link" rel="noreferrer">
          <ImmigrantJusticeIcon />          
        </a>
      </nav>
    </div>
  );
}


