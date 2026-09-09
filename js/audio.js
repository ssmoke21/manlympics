/*
  AUDIO - every sound is synthesized with WebAudio. There are no audio files.

  ML.sfx.play('chop')          one-shot
  ML.sfx.startLoop('mow')      looping sound (the mower)
  ML.sfx.stopLoop('mow')
  ML.sfx.toggleMute()          also bound to the M key in engine.js

  The AudioContext is created on the first key the player presses, because
  browsers refuse to start audio before a user gesture.

  TUNING: every sound lives in the SOUNDS table at the bottom. Volume of the
  whole game is MASTER_VOLUME.
*/
window.ML = window.ML || {};

ML.sfx = (function () {
  var MASTER_VOLUME = 0.35;

  var actx = null, master = null, noiseBuf = null;
  var muted = false;
  var loops = {};

  function ensure() {
    if (actx) return true;
    var AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return false;
    actx = new AC();
    master = actx.createGain();
    master.gain.value = muted ? 0 : MASTER_VOLUME;
    master.connect(actx.destination);

    // one second of white noise, reused by every noisy sound
    var len = Math.floor(actx.sampleRate);
    noiseBuf = actx.createBuffer(1, len, actx.sampleRate);
    var d = noiseBuf.getChannelData(0);
    for (var i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
    return true;
  }

  function now() { return actx.currentTime; }

  // A single oscillator note with an attack/decay envelope.
  function tone(o) {
    var t0 = now() + (o.delay || 0);
    var osc = actx.createOscillator();
    var g = actx.createGain();
    osc.type = o.type || 'square';
    osc.frequency.setValueAtTime(o.freq, t0);
    if (o.freqTo) osc.frequency.exponentialRampToValueAtTime(Math.max(1, o.freqTo), t0 + o.dur);
    var vol = (o.vol === undefined ? 0.3 : o.vol);
    var atk = (o.atk === undefined ? 0.005 : o.atk);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + atk);
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    var node = osc;
    if (o.filter) {
      var f = actx.createBiquadFilter();
      f.type = o.filter;
      f.frequency.value = o.filterFreq || 1200;
      osc.connect(f); f.connect(g);
    } else {
      osc.connect(g);
    }
    g.connect(master);
    osc.start(t0);
    osc.stop(t0 + o.dur + 0.02);
    return node;
  }

  // A burst of filtered white noise.
  function noise(o) {
    var t0 = now() + (o.delay || 0);
    var src = actx.createBufferSource();
    src.buffer = noiseBuf;
    src.loop = true;
    var f = actx.createBiquadFilter();
    f.type = o.filter || 'bandpass';
    f.frequency.setValueAtTime(o.freq || 1000, t0);
    if (o.freqTo) f.frequency.exponentialRampToValueAtTime(Math.max(20, o.freqTo), t0 + o.dur);
    f.Q.value = o.q === undefined ? 1 : o.q;
    var g = actx.createGain();
    var vol = (o.vol === undefined ? 0.3 : o.vol);
    g.gain.setValueAtTime(0.0001, t0);
    g.gain.exponentialRampToValueAtTime(vol, t0 + (o.atk === undefined ? 0.005 : o.atk));
    g.gain.exponentialRampToValueAtTime(0.0001, t0 + o.dur);
    src.connect(f); f.connect(g); g.connect(master);
    src.start(t0);
    src.stop(t0 + o.dur + 0.02);
  }

  function notes(list, type, vol, filterFreq) {
    for (var i = 0; i < list.length; i++) {
      tone({
        freq: list[i][0], dur: list[i][2] || 0.13, delay: list[i][1],
        type: type || 'square', vol: vol === undefined ? 0.25 : vol,
        filter: filterFreq ? 'lowpass' : null, filterFreq: filterFreq
      });
    }
  }

  // ------------------------------------------------------------------ sounds

  var SOUNDS = {
    blip: function () {
      tone({ freq: 620, dur: 0.05, type: 'square', vol: 0.16 });
    },
    confirm: function () {
      tone({ freq: 520, dur: 0.08, type: 'square', vol: 0.22 });
      tone({ freq: 790, dur: 0.12, type: 'square', vol: 0.22, delay: 0.07 });
    },
    back: function () {
      tone({ freq: 400, dur: 0.07, type: 'square', vol: 0.2 });
      tone({ freq: 260, dur: 0.11, type: 'square', vol: 0.2, delay: 0.06 });
    },
    chop: function () {
      noise({ freq: 2600, freqTo: 700, dur: 0.14, vol: 0.42, q: 0.8 });
      tone({ freq: 150, freqTo: 45, dur: 0.22, type: 'sine', vol: 0.4 });
    },
    thud: function () {
      noise({ freq: 700, freqTo: 240, dur: 0.12, vol: 0.28, q: 0.7 });
      tone({ freq: 110, freqTo: 55, dur: 0.16, type: 'sine', vol: 0.3 });
    },
    stick: function () {
      noise({ freq: 1400, freqTo: 300, dur: 0.3, vol: 0.3, q: 2 });
      tone({ freq: 220, freqTo: 90, dur: 0.35, type: 'sawtooth', vol: 0.16, filter: 'lowpass', filterFreq: 800 });
    },
    whiff: function () {
      noise({ freq: 900, freqTo: 2400, dur: 0.18, vol: 0.16, q: 0.6 });
    },
    // pitch 1 = a cold patty just gone on, 2 = one about to catch fire.
    // Grill Sergeant leans on this: rising pitch is one of the doneness tells.
    sizzle: function (o) {
      var p = (o && o.pitch) || 1;
      noise({ filter: 'highpass', freq: 2400 * p, dur: 0.45, vol: 0.10 + 0.05 * (p - 1), q: 0.5 });
    },
    flip: function () {
      noise({ freq: 1800, freqTo: 3200, dur: 0.12, vol: 0.2 });
      tone({ freq: 300, freqTo: 620, dur: 0.12, type: 'triangle', vol: 0.16 });
    },
    pour: function () {
      noise({ filter: 'lowpass', freq: 1200, freqTo: 700, dur: 0.5, vol: 0.16, q: 0.4 });
    },
    fizz: function () {
      noise({ filter: 'highpass', freq: 4200, dur: 0.7, vol: 0.12, q: 0.4 });
    },
    shatter: function () {
      noise({ freq: 5200, freqTo: 1800, dur: 0.35, vol: 0.3, q: 1.2 });
      for (var i = 0; i < 5; i++) {
        tone({ freq: 1800 + Math.random() * 2200, dur: 0.09, type: 'triangle', vol: 0.12, delay: i * 0.035 });
      }
    },
    honk: function () {
      tone({ freq: 420, dur: 0.35, type: 'sawtooth', vol: 0.2, filter: 'lowpass', filterFreq: 1400 });
      tone({ freq: 330, dur: 0.35, type: 'sawtooth', vol: 0.2, filter: 'lowpass', filterFreq: 1400 });
    },
    bark: function () {
      tone({ freq: 480, freqTo: 170, dur: 0.16, type: 'sawtooth', vol: 0.28, filter: 'lowpass', filterFreq: 1500 });
      noise({ freq: 1100, freqTo: 500, dur: 0.14, vol: 0.2 });
    },
    crash: function () {
      noise({ freq: 900, freqTo: 180, dur: 0.6, vol: 0.4, q: 0.5 });
      tone({ freq: 90, freqTo: 40, dur: 0.5, type: 'sine', vol: 0.4 });
    },
    crowd_cheer: function () {
      noise({ filter: 'bandpass', freq: 900, freqTo: 1600, dur: 1.1, vol: 0.3, q: 0.6, atk: 0.15 });
      noise({ filter: 'highpass', freq: 2600, dur: 1.0, vol: 0.1, atk: 0.25 });
    },
    crowd_groan: function () {
      noise({ filter: 'bandpass', freq: 700, freqTo: 260, dur: 1.0, vol: 0.26, q: 0.9, atk: 0.2 });
      tone({ freq: 190, freqTo: 120, dur: 0.9, type: 'sawtooth', vol: 0.08, filter: 'lowpass', filterFreq: 500 });
    },
    fanfare: function () {
      notes([[523, 0], [659, 0.12], [784, 0.24], [1046, 0.36, 0.4]], 'square', 0.22);
      notes([[262, 0], [330, 0.12], [392, 0.24], [523, 0.36, 0.4]], 'triangle', 0.16);
    },
    sax_riff: function () {
      var seq = [[466, 0.00, 0.18], [523, 0.16, 0.18], [622, 0.32, 0.20], [587, 0.52, 0.22], [466, 0.74, 0.45]];
      for (var i = 0; i < seq.length; i++) {
        tone({
          freq: seq[i][0], dur: seq[i][2], delay: seq[i][1], type: 'sawtooth',
          vol: 0.2, atk: 0.03, filter: 'lowpass', filterFreq: 1500
        });
      }
    },
    // the vacuum seal letting go: a hollow pop with a little air behind it
    thunk: function () {
      tone({ freq: 90, freqTo: 320, dur: 0.11, type: 'sine', vol: 0.5 });
      tone({ freq: 240, freqTo: 120, dur: 0.16, type: 'triangle', vol: 0.28, delay: 0.02 });
      noise({ filter: 'bandpass', freq: 1400, freqTo: 500, dur: 0.18, vol: 0.22, q: 1.4, delay: 0.03 });
    },
    // paper handles giving out: a dry crumple, then a thump on the drive
    bagdrop: function () {
      noise({ filter: 'bandpass', freq: 2600, freqTo: 900, dur: 0.22, vol: 0.22, q: 0.7 });
      tone({ freq: 150, freqTo: 60, dur: 0.18, type: 'sine', vol: 0.30, delay: 0.04 });
    },
    // a dozen eggs meeting the path. Wet, low, and final.
    splat: function () {
      noise({ filter: 'lowpass', freq: 900, freqTo: 180, dur: 0.30, vol: 0.42, q: 0.4 });
      tone({ freq: 200, freqTo: 55, dur: 0.26, type: 'triangle', vol: 0.34 });
      noise({ filter: 'bandpass', freq: 420, freqTo: 160, dur: 0.45, vol: 0.16, q: 2.2, delay: 0.05 });
    },
    // the spring on a screen door, complaining
    creak: function () {
      tone({ freq: 260, freqTo: 900, dur: 0.50, type: 'sawtooth', vol: 0.10, filter: 'lowpass', filterFreq: 1300 });
      noise({ filter: 'bandpass', freq: 1700, freqTo: 2600, dur: 0.50, vol: 0.07, q: 3.0 });
    },
    tick: function () {
      tone({ freq: 900, dur: 0.03, type: 'square', vol: 0.12 });
    },
    reveal: function () {
      tone({ freq: 700, freqTo: 1100, dur: 0.09, type: 'square', vol: 0.18 });
    }
  };

  // ------------------------------------------------------------------- loops

  var LOOPS = {
    mow: function () {
      var src = actx.createBufferSource();
      src.buffer = noiseBuf; src.loop = true;
      var f = actx.createBiquadFilter();
      f.type = 'lowpass'; f.frequency.value = 520; f.Q.value = 6;
      var g = actx.createGain();
      g.gain.value = 0.0001;
      g.gain.exponentialRampToValueAtTime(0.22, now() + 0.15);
      // engine wobble
      var lfo = actx.createOscillator(); lfo.type = 'sine'; lfo.frequency.value = 11;
      var lfoGain = actx.createGain(); lfoGain.gain.value = 160;
      lfo.connect(lfoGain); lfoGain.connect(f.frequency);
      src.connect(f); f.connect(g); g.connect(master);
      src.start(); lfo.start();
      return { stop: function () { try { src.stop(); lfo.stop(); } catch (e) {} }, gain: g };
    }
  };

  return {
    // opts is optional; a few sounds (sizzle) read a `pitch` out of it.
    play: function (name, opts) {
      if (!ensure() || muted) return;
      var s = SOUNDS[name];
      if (!s) return;
      try { s(opts); } catch (e) { /* never let a sound break the game */ }
    },

    startLoop: function (name) {
      if (!ensure() || muted) return;
      if (loops[name]) return;
      var mk = LOOPS[name];
      if (!mk) return;
      try { loops[name] = mk(); } catch (e) {}
    },

    stopLoop: function (name) {
      if (!loops[name]) return;
      try { loops[name].stop(); } catch (e) {}
      delete loops[name];
    },

    stopAllLoops: function () {
      for (var k in loops) if (loops.hasOwnProperty(k)) this.stopLoop(k);
    },

    isMuted: function () { return muted; },

    toggleMute: function () {
      muted = !muted;
      if (master) master.gain.value = muted ? 0 : MASTER_VOLUME;
      if (muted) this.stopAllLoops();
      return muted;
    },

    // called by the input manager on the first keypress
    unlock: function () {
      if (!ensure()) return;
      if (actx.state === 'suspended') actx.resume();
    }
  };
})();
