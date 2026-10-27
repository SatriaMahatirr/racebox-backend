/**
 * RACEBOX MOBILE & RESPONSIVE NAVIGATION ENGINE
 * Native app-like drawer, bottom bar, touch helpers, and chart resize
 */

(function () {
  'use strict';

  function initMobileNav() {
    var toggleBtn = document.getElementById('rbMobileMenuBtn');
    var drawer = document.getElementById('rbMobileDrawer');
    var backdrop = document.getElementById('rbDrawerBackdrop');
    var closeBtn = document.getElementById('rbDrawerCloseBtn');

    if (!drawer) return;

    function openDrawer() {
      drawer.classList.add('active');
      if (backdrop) backdrop.classList.add('active');
      if (toggleBtn) toggleBtn.classList.add('active');
      document.body.classList.add('rb-no-scroll');
    }

    function closeDrawer() {
      drawer.classList.remove('active');
      if (backdrop) backdrop.classList.remove('active');
      if (toggleBtn) toggleBtn.classList.remove('active');
      document.body.classList.remove('rb-no-scroll');
    }

    if (toggleBtn) {
      toggleBtn.addEventListener('click', function (e) {
        e.preventDefault();
        if (drawer.classList.contains('active')) {
          closeDrawer();
        } else {
          openDrawer();
        }
      });
    }

    if (closeBtn) closeBtn.addEventListener('click', closeDrawer);
    if (backdrop) backdrop.addEventListener('click', closeDrawer);

    // Close drawer on ESC key
    document.addEventListener('keydown', function (e) {
      if (e.key === 'Escape' && drawer.classList.contains('active')) {
        closeDrawer();
      }
    });

    // Close drawer when clicking a link inside it
    var drawerLinks = drawer.querySelectorAll('a');
    drawerLinks.forEach(function (link) {
      link.addEventListener('click', function () {
        closeDrawer();
      });
    });

    // Mobile table scroll hint auto-dismiss
    var tableWraps = document.querySelectorAll('.rb-table-wrap, .rb-table-container');
    tableWraps.forEach(function (wrap) {
      var hint = wrap.parentNode.querySelector('.rb-table-hint');
      if (!hint) return;
      wrap.addEventListener('scroll', function () {
        if (wrap.scrollLeft > 20) {
          hint.style.opacity = '0.3';
        } else {
          hint.style.opacity = '1';
        }
      }, { passive: true });
    });

    // Handle orientation and window resize for ECharts
    window.addEventListener('orientationchange', function () {
      setTimeout(function () {
        window.dispatchEvent(new Event('resize'));
      }, 300);
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileNav);
  } else {
    initMobileNav();
  }
})();
