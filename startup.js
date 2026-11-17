// A readable exit when WebGL, script loading, or startup fails.
(() => {
  function recover() {
    const show = () => {
      if (document.body.classList.contains('ready')) return;
      document.body.classList.add('startup-failed');
      const message = document.querySelector('#load .msg');
      if (message) message.textContent = 'The 3D watch is unavailable here. You can still read my experience, projects, writing, and photos.';
    };
    if (document.readyState === 'loading') addEventListener('DOMContentLoaded', show, {once:true}); else show();
  }
  addEventListener('error', event => {
    if (event.target === window || event.target?.tagName === 'SCRIPT') recover();
  }, true);
  addEventListener('unhandledrejection', recover);
  addEventListener('DOMContentLoaded', () => {
    if (document.body.classList.contains('nogl')) recover();
    setTimeout(recover, 20000);
  }, {once:true});
})();
