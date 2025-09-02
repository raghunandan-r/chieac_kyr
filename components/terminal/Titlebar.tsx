import { GitIcon, LinkedInIcon, GmailIcon, FileIcon } from '@/components/icons';

export default function Titlebar() {
  return (
    <div className="titlebar">
      <nav className="nav">
        <a href="https://www.linkedin.com/in/chieacdan/" target="_blank" className="social-link" rel="noreferrer">
          <LinkedInIcon />
          linkedin
        </a>
      </nav>
    </div>
  );
}


