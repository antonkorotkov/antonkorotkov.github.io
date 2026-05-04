/* =========================================================================
   Elastron — landing page interactions
   No frameworks, no jQuery. Vanilla all the way.
   ========================================================================= */

(() => {
    const REPO = 'antonkorotkov/elastron';
    const RELEASES_PAGE = `https://github.com/${REPO}/releases/latest`;

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    // ---------------------------------------------------------------------
    // Nav: solidify on scroll, mobile menu toggle
    // ---------------------------------------------------------------------
    const nav = document.getElementById('nav');
    if (nav) {
        const updateNavState = () => {
            nav.classList.toggle('is-scrolled', window.scrollY > 16);
        };
        updateNavState();
        window.addEventListener('scroll', updateNavState, { passive: true });

        const toggle = nav.querySelector('.nav-toggle');
        if (toggle) {
            toggle.addEventListener('click', () => nav.classList.toggle('is-open'));
            nav.querySelectorAll('.nav-links a').forEach(a => {
                a.addEventListener('click', () => nav.classList.remove('is-open'));
            });
        }
    }

    // ---------------------------------------------------------------------
    // Cluster constellation: schedule yellow pulses along random edges
    // ---------------------------------------------------------------------
    const cluster = document.querySelector('.cluster svg');
    if (cluster && !reduceMotion) {
        const edges = Array.from(cluster.querySelectorAll('.edge'));
        if (edges.length) {
            const NS = 'http://www.w3.org/2000/svg';
            const pulseLayer = cluster.querySelector('.pulses') || cluster;

            const firePulse = () => {
                const edge = edges[Math.floor(Math.random() * edges.length)];
                const len = edge.getTotalLength();
                if (!len) return;

                const pulse = document.createElementNS(NS, 'path');
                pulse.setAttribute('d', edge.getAttribute('d'));
                pulse.setAttribute('class', 'edge-pulse');
                const dash = Math.min(70, len * 0.35);
                pulse.style.strokeDasharray = `${dash} ${len}`;
                pulse.style.strokeDashoffset = String(dash);
                pulseLayer.appendChild(pulse);

                void pulse.getBoundingClientRect();

                const duration = 900 + Math.random() * 600;
                pulse.style.transition = `stroke-dashoffset ${duration}ms cubic-bezier(0.65, 0, 0.35, 1), opacity 200ms ease`;
                pulse.style.strokeDashoffset = String(-len);

                setTimeout(() => { pulse.style.opacity = '0'; }, duration - 180);
                setTimeout(() => pulse.remove(), duration + 220);
            };

            const tick = () => {
                firePulse();
                if (Math.random() < 0.35) setTimeout(firePulse, 220);
                const next = 1400 + Math.random() * 1800;
                setTimeout(tick, next);
            };
            setTimeout(tick, 600);
        }
    }

    // ---------------------------------------------------------------------
    // Subtle mouse parallax on hero stage
    // ---------------------------------------------------------------------
    const stage = document.querySelector('.hero-stage');
    if (stage && !reduceMotion && window.matchMedia('(min-width: 1024px)').matches) {
        const clusterEl = stage.querySelector('.cluster');
        const windowEl = stage.querySelector('.window');
        let raf = 0;
        let tx = 0, ty = 0;

        const apply = () => {
            raf = 0;
            if (clusterEl) clusterEl.style.transform = `translate3d(${tx * -10}px, ${ty * -8}px, 0)`;
            if (windowEl) windowEl.style.transform = `rotateY(${-9 + tx * 2}deg) rotateX(${5 + ty * -1.5}deg)`;
        };
        stage.addEventListener('mousemove', (e) => {
            const r = stage.getBoundingClientRect();
            tx = (e.clientX - r.left) / r.width - 0.5;
            ty = (e.clientY - r.top) / r.height - 0.5;
            if (!raf) raf = requestAnimationFrame(apply);
        });
        stage.addEventListener('mouseleave', () => { tx = 0; ty = 0; apply(); });
    }

    // ---------------------------------------------------------------------
    // Bento card cursor-tracked glow
    // ---------------------------------------------------------------------
    document.querySelectorAll('.card').forEach(card => {
        card.addEventListener('mousemove', (e) => {
            const r = card.getBoundingClientRect();
            card.style.setProperty('--mx', `${((e.clientX - r.left) / r.width) * 100}%`);
            card.style.setProperty('--my', `${((e.clientY - r.top) / r.height) * 100}%`);
        });
    });

    // ---------------------------------------------------------------------
    // FAQ accordion
    // ---------------------------------------------------------------------
    document.querySelectorAll('.faq-item').forEach(item => {
        const btn = item.querySelector('.faq-q');
        if (!btn) return;
        btn.addEventListener('click', () => {
            const open = item.classList.toggle('is-open');
            btn.setAttribute('aria-expanded', String(open));
        });
    });

    // ---------------------------------------------------------------------
    // Scroll reveals (IntersectionObserver)
    // ---------------------------------------------------------------------
    const reveals = document.querySelectorAll('.reveal');
    if (reveals.length && 'IntersectionObserver' in window) {
        const io = new IntersectionObserver((entries) => {
            entries.forEach(entry => {
                if (entry.isIntersecting) {
                    entry.target.classList.add('is-in');
                    io.unobserve(entry.target);
                }
            });
        }, { threshold: 0.15, rootMargin: '0px 0px -10% 0px' });
        reveals.forEach(el => io.observe(el));
    } else {
        reveals.forEach(el => el.classList.add('is-in'));
    }

    // ---------------------------------------------------------------------
    // GitHub: stars + latest version (best-effort, fails silently)
    // ---------------------------------------------------------------------
    const formatStars = (n) => {
        if (n >= 1000) return (n / 1000).toFixed(n >= 10000 ? 0 : 1).replace(/\.0$/, '') + 'k';
        return String(n);
    };
    const fetchRepoMeta = async () => {
        try {
            const cached = sessionStorage.getItem('elastron:repo');
            if (cached) return JSON.parse(cached);
            const res = await fetch(`https://api.github.com/repos/${REPO}`);
            if (!res.ok) throw new Error('repo http ' + res.status);
            const data = await res.json();
            const meta = { stars: data.stargazers_count };
            sessionStorage.setItem('elastron:repo', JSON.stringify(meta));
            return meta;
        } catch (_) { return null; }
    };
    let releaseCache = null;
    const fetchReleaseMeta = async () => {
        if (releaseCache) return releaseCache;
        try {
            const cached = sessionStorage.getItem('elastron:release');
            if (cached) { releaseCache = JSON.parse(cached); return releaseCache; }
            const res = await fetch(`https://api.github.com/repos/${REPO}/releases/latest`);
            if (!res.ok) throw new Error('release http ' + res.status);
            const data = await res.json();
            releaseCache = {
                tag: data.tag_name,
                publishedAt: data.published_at,
                assets: (data.assets || []).map(a => ({
                    name: a.name, url: a.browser_download_url, size: a.size,
                })),
            };
            sessionStorage.setItem('elastron:release', JSON.stringify(releaseCache));
            return releaseCache;
        } catch (_) { return null; }
    };

    (async () => {
        const repoMeta = await fetchRepoMeta();
        if (repoMeta && typeof repoMeta.stars === 'number') {
            document.querySelectorAll('[data-star-count]').forEach(el => {
                el.textContent = formatStars(repoMeta.stars);
            });
        }
    })();

    // ---------------------------------------------------------------------
    // Downloads
    // ---------------------------------------------------------------------
    const detectPlatform = () => {
        const uad = navigator.userAgentData;
        if (uad && uad.platform) {
            const p = uad.platform.toLowerCase();
            if (p.includes('mac')) return 'mac';
            if (p.includes('win')) return 'win';
            if (p.includes('linux')) return 'linux';
        }
        const ua = (navigator.userAgent || '').toLowerCase();
        if (ua.includes('mac')) return 'mac';
        if (ua.includes('windows')) return 'win';
        if (ua.includes('linux')) return 'linux';
        return 'mac';
    };

    const platformLabel = (p) => ({ mac: 'macOS', win: 'Windows', linux: 'Linux' }[p] || 'macOS');

    const isInstaller = (name) =>
        /\.(dmg|exe|appimage)$/i.test(name) && !/blockmap/i.test(name);

    const platformOf = (filename) => {
        const n = filename.toLowerCase();
        if (n.endsWith('.dmg')) return 'mac';
        if (n.endsWith('.exe')) return 'win';
        if (n.endsWith('.appimage')) return 'linux';
        return 'other';
    };

    const formatOf = (filename) => {
        const n = filename.toLowerCase();
        if (n.endsWith('.dmg')) return { label: 'Universal disk image', ext: '.dmg' };
        if (n.endsWith('.exe')) return { label: 'Installer', ext: '.exe' };
        if (n.endsWith('.appimage')) return { label: 'AppImage', ext: '.AppImage' };
        return { label: filename, ext: '' };
    };

    const platformIcon = (p) => ({
        mac: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M16.4 1.5c.1 1.2-.4 2.4-1.1 3.2-.8.9-2 1.5-3.2 1.4-.1-1.2.5-2.4 1.2-3.2.8-.8 2-1.4 3.1-1.4zm4 17c-.5 1.1-.7 1.6-1.4 2.6-.9 1.4-2.2 3.1-3.8 3.1-1.4 0-1.8-.9-3.7-.9-1.9 0-2.4.9-3.7.9-1.6 0-2.9-1.6-3.8-3-2.5-3.8-2.7-8.3-1.2-10.7 1.1-1.7 2.8-2.7 4.4-2.7 1.6 0 2.7.9 4 .9 1.3 0 2.1-.9 4-.9 1.4 0 2.9.8 4 2.1-3.6 1.9-3 7.1.2 8.6z"/></svg>',
        win: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M3 5.5l7.7-1v8.7H3V5.5zm0 13L10.7 19v-8.5H3v8zm8.6 1l9.4 1.3V10.5h-9.4v9zm0-15v8.5H21V3.7l-9.4 1.3z"/></svg>',
        linux: '<svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 2c-2 0-3 1.5-3 4 0 1.5.4 2.4 1 3.5-1.7 1.5-3 4-3 6.5 0 1 .3 1.7.7 2.3-1 .5-1.7 1.3-1.7 2.2 0 1.4 1.7 1.5 3.4 1.5h5.2c1.7 0 3.4-.1 3.4-1.5 0-1-.7-1.7-1.7-2.2.4-.6.7-1.3.7-2.3 0-2.5-1.3-5-3-6.5.6-1 1-2 1-3.5 0-2.5-1-4-3-4zm-1.4 3.6a.6.6 0 110 1.2.6.6 0 010-1.2zm2.8 0a.6.6 0 110 1.2.6.6 0 010-1.2z"/></svg>',
    }[p] || '');

    const formatBytes = (n) => {
        if (!n) return '';
        if (n >= 1e6) return (n / 1e6).toFixed(1) + ' MB';
        if (n >= 1e3) return Math.round(n / 1e3) + ' KB';
        return n + ' B';
    };

    const setupDownloads = async () => {
        const platform = detectPlatform();
        document.querySelectorAll('[data-platform-label]').forEach(el => {
            el.textContent = platformLabel(platform);
        });
        document.querySelectorAll('[data-platform-icon]').forEach(el => {
            el.innerHTML = platformIcon(platform);
        });

        const primaries = document.querySelectorAll('[data-download-primary]');
        const release = await fetchReleaseMeta();
        const match = release && release.assets.find(a =>
            isInstaller(a.name) && platformOf(a.name) === platform
        );
        const resolvedHref = (match && match.url) || RELEASES_PAGE;
        primaries.forEach(p => { p.href = resolvedHref; });

        if (release && release.tag) {
            document.querySelectorAll('[data-version]').forEach(el => {
                el.textContent = `v${String(release.tag).replace(/^v/, '')}`;
            });
            if (release.publishedAt) {
                const d = new Date(release.publishedAt);
                const formatted = d.toLocaleDateString(undefined, { month: 'short', year: 'numeric' });
                document.querySelectorAll('[data-version-date]').forEach(el => { el.textContent = formatted; });
            }
        }

        const allList = document.querySelector('[data-downloads-all]');
        if (allList) {
            if (release && release.assets && release.assets.length) {
                const installers = release.assets.filter(a => isInstaller(a.name));
                const order = ['mac', 'win', 'linux'];
                const sorted = installers.sort((a, b) =>
                    order.indexOf(platformOf(a.name)) - order.indexOf(platformOf(b.name))
                );
                const arrow = '<svg class="dl-arrow" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 5v14M5 12l7 7 7-7"/></svg>';
                allList.innerHTML = sorted.map(a => {
                    const p = platformOf(a.name);
                    const fmt = formatOf(a.name);
                    return `<a class="dl-row" href="${a.url}" target="_blank" rel="noopener">
            <span class="dl-icon">${platformIcon(p)}</span>
            <span class="dl-meta">
              <span class="dl-platform">${platformLabel(p)}</span>
              <span class="dl-format">${fmt.label} · <code>${fmt.ext}</code></span>
            </span>
            <span class="dl-size">${formatBytes(a.size)}</span>
            ${arrow}
          </a>`;
                }).join('');
            } else {
                allList.innerHTML = `<a class="dl-row dl-row--fallback" href="${RELEASES_PAGE}" target="_blank" rel="noopener"><span class="dl-meta"><span class="dl-platform">View all releases on GitHub</span></span></a>`;
            }
        }
    };
    setupDownloads();

    // ---------------------------------------------------------------------
    // Smooth scroll for in-page anchor links (with fixed-nav offset)
    // ---------------------------------------------------------------------
    document.querySelectorAll('a[href^="#"]').forEach(a => {
        a.addEventListener('click', (e) => {
            const id = a.getAttribute('href').slice(1);
            if (!id) return;
            const target = document.getElementById(id);
            if (!target) return;
            e.preventDefault();
            const top = target.getBoundingClientRect().top + window.scrollY - 64;
            window.scrollTo({ top, behavior: reduceMotion ? 'auto' : 'smooth' });
        });
    });
})();
