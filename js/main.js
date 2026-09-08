/*
  MAIN - boots everything, in order, once the page has loaded.

  1. bake the font atlases
  2. bake every sprite into an offscreen canvas
  3. hand the canvas to the engine (which sets up input and the scaler)
  4. push the title screen and start the loop

  Audio deliberately does NOT start here - the AudioContext is created on the
  player's first keypress, because browsers block it otherwise.
*/
(function () {
  function boot() {
    var canvas = document.getElementById('game');
    if (!canvas) { return; }

    ML.font.init();
    ML.sprites.init();
    ML.engine.init(canvas);
    ML.engine.push(ML.ui.titleScene());
    ML.engine.start();

    // Handy for poking at things from the browser console.
    window.MLDEBUG = {
      go: function (key) {
        ML.engine.reset(ML.events[key].scene({ mode: 'freeplay' }));
      },
      events: Object.keys(ML.events || {})
    };
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', boot);
  } else {
    boot();
  }
})();
