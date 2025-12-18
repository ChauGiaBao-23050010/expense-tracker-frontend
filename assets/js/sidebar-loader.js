(async function(){
    // Load sidebar partial and inject into page
    try {
        const res = await fetch('./_sidebar.html');
        if (!res.ok) throw new Error('Failed to load sidebar partial');
        const html = await res.text();
        const root = document.getElementById('sidebar-root');
        if (!root) return; // no sidebar placeholder on this page
        root.innerHTML = html;

        // Set active nav-link based on current pathname
        const current = (window.location.pathname.split('/').pop() || 'index.html');
        const links = root.querySelectorAll('a.nav-link');
        links.forEach(a => a.classList.remove('active'));
        let matched = false;
        links.forEach(a => {
            const href = a.getAttribute('href');
            if (!href) return;
            if (href === current || (href === 'index.html' && (current === '' || current === 'index.html' || current === '/'))) {
                a.classList.add('active');
                matched = true;
            }
        });

        // Accessibility: ensure overlay toggle works when sidebar inserted
        // (toggleSidebar is defined in pages)

    } catch (e) {
        console.error('sidebar-loader:', e);
    }
})();