import { SOUND_PREF_KEY, VOLUME_PREF_KEY } from './config.js';
import { soundMuted, mokugyoVolume, audioCtx, updateSoundMuted, updateMokugyoVolume, updateAudioCtx } from './state.js';

function getAudioContext() {
    if (!audioCtx) {
        updateAudioCtx(new (window.AudioContext || window.webkitAudioContext)());
    }
    return audioCtx;
}

function playMokugyo(intensity) {
    if (soundMuted) return;
    intensity = intensity || 0.7;
    try {
        var ctx = getAudioContext();
        var t = ctx.currentTime;
        var masterVol = 1.2 * Math.pow(mokugyoVolume / 100, 1.5);

        var bufferSize = Math.floor(ctx.sampleRate * 0.02);
        var noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        var data = noiseBuffer.getChannelData(0);
        for (var i = 0; i < bufferSize; i++) {
            data[i] = (Math.random() * 2 - 1);
        }
        var noiseSrc = ctx.createBufferSource();
        noiseSrc.buffer = noiseBuffer;

        var bpFilter = ctx.createBiquadFilter();
        bpFilter.type = 'bandpass';
        bpFilter.frequency.value = 2400;
        bpFilter.Q.value = 4;

        var noiseGain = ctx.createGain();
        noiseGain.gain.setValueAtTime(masterVol * 0.8 * intensity, t);
        noiseGain.gain.exponentialRampToValueAtTime(0.001, t + 0.03 * intensity);

        noiseSrc.connect(bpFilter);
        bpFilter.connect(noiseGain);
        noiseGain.connect(ctx.destination);
        noiseSrc.start(t);
        noiseSrc.stop(t + 0.04 * intensity);

        var bufferSize2 = Math.floor(ctx.sampleRate * 0.4);
        var noiseBuffer2 = ctx.createBuffer(1, bufferSize2, ctx.sampleRate);
        var data2 = noiseBuffer2.getChannelData(0);
        for (var j = 0; j < bufferSize2; j++) {
            data2[j] = (Math.random() * 2 - 1);
        }
        var noiseSrc2 = ctx.createBufferSource();
        noiseSrc2.buffer = noiseBuffer2;

        var bodyFilter = ctx.createBiquadFilter();
        bodyFilter.type = 'bandpass';
        bodyFilter.frequency.value = 880;
        bodyFilter.Q.value = 5;

        var bodyGain = ctx.createGain();
        bodyGain.gain.setValueAtTime(masterVol * 0.45 * intensity, t + 0.003);
        bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.35 * intensity);

        noiseSrc2.connect(bodyFilter);
        bodyFilter.connect(bodyGain);
        bodyGain.connect(ctx.destination);
        noiseSrc2.start(t);
        noiseSrc2.stop(t + 0.4 * intensity);

        var res1 = ctx.createOscillator();
        res1.type = 'sine';
        res1.frequency.setValueAtTime(760, t);
        var gain1 = ctx.createGain();
        gain1.gain.setValueAtTime(masterVol * 0.32 * intensity, t);
        gain1.gain.exponentialRampToValueAtTime(0.001, t + 0.28 * intensity);
        res1.connect(gain1);
        gain1.connect(ctx.destination);
        res1.start(t);
        res1.stop(t + 0.3 * intensity);

        var res2 = ctx.createOscillator();
        res2.type = 'sine';
        res2.frequency.setValueAtTime(1520, t);
        var gain2 = ctx.createGain();
        gain2.gain.setValueAtTime(masterVol * 0.1 * intensity, t);
        gain2.gain.exponentialRampToValueAtTime(0.001, t + 0.12 * intensity);
        res2.connect(gain2);
        gain2.connect(ctx.destination);
        res2.start(t);
        res2.stop(t + 0.14 * intensity);

        var reverbGain = ctx.createGain();
        reverbGain.gain.value = 0.3;
        reverbGain.connect(ctx.destination);

        var reverbLen = ctx.sampleRate * 1.8;
        var reverbBuf = ctx.createBuffer(1, reverbLen, ctx.sampleRate);
        var reverbData = reverbBuf.getChannelData(0);
        for (var k = 0; k < reverbLen; k++) {
            reverbData[k] = (Math.random() * 2 - 1) * Math.pow(1 - k / reverbLen, 2.5);
        }
        var conv = ctx.createConvolver();
        conv.buffer = reverbBuf;
        var dryGain = ctx.createGain();
        dryGain.gain.value = 0.75;
        var wetGain = ctx.createGain();
        wetGain.gain.value = 0.25;
        conv.connect(wetGain);
        wetGain.connect(reverbGain);
        dryGain.connect(reverbGain);

        var ethereal = ctx.createOscillator();
        ethereal.type = 'sine';
        ethereal.frequency.setValueAtTime(1520, t);
        var ethGain = ctx.createGain();
        ethGain.gain.setValueAtTime(masterVol * 0.06 * intensity, t);
        ethGain.gain.exponentialRampToValueAtTime(0.001, t + 0.8 * intensity);
        ethereal.connect(ethGain);
        ethGain.connect(conv);
        ethGain.connect(dryGain);
        ethereal.start(t);
        ethereal.stop(t + 0.85 * intensity);

        var subEthereal = ctx.createOscillator();
        subEthereal.type = 'sine';
        subEthereal.frequency.setValueAtTime(380, t);
        var subGain = ctx.createGain();
        subGain.gain.setValueAtTime(masterVol * 0.04 * intensity, t);
        subGain.gain.exponentialRampToValueAtTime(0.001, t + 1.2 * intensity);
        subEthereal.connect(subGain);
        subGain.connect(conv);
        subGain.connect(dryGain);
        subEthereal.start(t);
        subEthereal.stop(t + 1.25 * intensity);
    } catch(e) {}
}

var Sounds = {
    phaseStart: function() {
        playMokugyo(0.5);
        setTimeout(function() { playMokugyo(0.6); }, 250);
    },
    phaseComplete: function() {
        playMokugyo(1.0);
    },
    focusCheck: function() {
        playMokugyo(0.7);
        setTimeout(function() { playMokugyo(0.8); }, 120);
        setTimeout(function() { playMokugyo(0.9); }, 240);
    },
    sessionComplete: function() {
        for (var i = 0; i < 5; i++) {
            (function(idx) {
                setTimeout(function() { playMokugyo(0.5 + idx * 0.1); }, idx * 180);
            })(i);
        }
    },
    countdownTick: function() {
        playMokugyo(0.3);
    }
};

function toggleSound() {
    updateSoundMuted(!soundMuted);
    localStorage.setItem(SOUND_PREF_KEY, soundMuted.toString());
    document.getElementById('btnSound').textContent = soundMuted ? '🔇' : '🔊';
    if (!soundMuted) Sounds.phaseStart();
}

export { getAudioContext, playMokugyo, Sounds, toggleSound };
