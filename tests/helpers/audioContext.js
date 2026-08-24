class RecordingAudioParam {
  constructor(value = 0) {
    this.value = value;
    this.events = [];
  }

  setValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: 'set', value, time });
  }

  exponentialRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: 'exponentialRamp', value, time });
  }

  linearRampToValueAtTime(value, time) {
    this.value = value;
    this.events.push({ type: 'linearRamp', value, time });
  }
}

class RecordingNode {
  constructor(type) {
    this.type = type;
    this.connections = [];
    this.started = [];
    this.stopped = [];
    this.disconnected = false;
    this.onended = null;
  }

  connect(node) {
    this.connections.push(node);
    return node;
  }

  disconnect() {
    this.disconnected = true;
  }

  start(time) {
    this.started.push(time);
  }

  stop(time) {
    this.stopped.push(time);
  }

  emitEnded() {
    if (typeof this.onended === 'function') {
      this.onended({ target: this, type: 'ended' });
    }
  }
}

class RecordingOscillator extends RecordingNode {
  constructor() {
    super('sine');
    this.frequency = new RecordingAudioParam();
  }
}

class RecordingGain extends RecordingNode {
  constructor() {
    super('gain');
    this.gain = new RecordingAudioParam();
  }
}

class RecordingBufferSource extends RecordingNode {
  constructor() {
    super('bufferSource');
    this.buffer = null;
    this.loop = false;
  }
}

export class RecordingAudioContext {
  static instances = [];

  constructor() {
    this.currentTime = 0;
    this.destination = { type: 'destination' };
    this.oscillators = [];
    this.gains = [];
    this.bufferSources = [];
    this.closed = false;
    RecordingAudioContext.instances.push(this);
  }

  createOscillator() {
    const oscillator = new RecordingOscillator();
    this.oscillators.push(oscillator);
    return oscillator;
  }

  createGain() {
    const gain = new RecordingGain();
    this.gains.push(gain);
    return gain;
  }

  createBufferSource() {
    const source = new RecordingBufferSource();
    this.bufferSources.push(source);
    return source;
  }

  decodeAudioData(arrayBuffer) {
    return Promise.resolve({ arrayBuffer });
  }

  close() {
    this.closed = true;
    return Promise.resolve();
  }
}

export function installRecordingAudioContext() {
  RecordingAudioContext.instances = [];
  globalThis.AudioContext = RecordingAudioContext;
  return RecordingAudioContext;
}
