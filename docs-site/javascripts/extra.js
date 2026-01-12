/* FreshTrack Pro Documentation - Custom JavaScript */

// Add version info to footer if available
document.addEventListener('DOMContentLoaded', function() {
  // Try to load version metadata
  fetch('/freshtrack-pro/_meta/version.json')
    .then(response => response.ok ? response.json() : null)
    .then(data => {
      if (data && data.appVersion !== 'dev') {
        const footer = document.querySelector('.md-footer-meta');
        if (footer) {
          const versionInfo = document.createElement('div');
          versionInfo.className = 'version-info';
          versionInfo.innerHTML = `
            Docs Version: ${data.docsVersion} |
            Commit: ${data.gitShortCommit || data.gitCommit?.substring(0, 7)} |
            Built: ${new Date(data.builtAt).toLocaleDateString()}
          `;
          footer.prepend(versionInfo);
        }
      }
    })
    .catch(() => {
      // Silently fail - version info is optional
    });
});

// Initialize Mermaid if present
if (typeof mermaid !== 'undefined') {
  mermaid.initialize({
    startOnLoad: true,
    theme: document.body.getAttribute('data-md-color-scheme') === 'slate' ? 'dark' : 'default',
    securityLevel: 'loose',
    flowchart: {
      useMaxWidth: true,
      htmlLabels: true,
      curve: 'basis'
    }
  });
}

// Theme change handler for Mermaid
const observer = new MutationObserver(function(mutations) {
  mutations.forEach(function(mutation) {
    if (mutation.attributeName === 'data-md-color-scheme' && typeof mermaid !== 'undefined') {
      const theme = document.body.getAttribute('data-md-color-scheme') === 'slate' ? 'dark' : 'default';
      mermaid.initialize({ theme: theme });
      // Re-render mermaid diagrams
      document.querySelectorAll('.mermaid').forEach(function(el) {
        el.removeAttribute('data-processed');
      });
      mermaid.init();
    }
  });
});

observer.observe(document.body, { attributes: true });
