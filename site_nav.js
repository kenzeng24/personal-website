const sections = document.querySelectorAll('#story, #publications, #contact');
const navLinks = document.querySelectorAll('#site-nav a');

const observer = new IntersectionObserver(entries => {
    entries.forEach(entry => {
        if (entry.isIntersecting) {
            navLinks.forEach(l => l.classList.remove('active'));
            const link = document.querySelector(`#site-nav a[href="#${entry.target.id}"]`);
            if (link) link.classList.add('active');
        }
    });
}, {
    rootMargin: '-20% 0px -60% 0px'
});

sections.forEach(s => observer.observe(s));

// contact sits at the bottom of the page and may never enter the
// observer's zone, so activate it when the user scrolls to the end
window.addEventListener('scroll', () => {
    if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 60) {
        navLinks.forEach(l => l.classList.remove('active'));
        document.querySelector('#site-nav a[href="#contact"]').classList.add('active');
    }
}, {
    passive: true
});