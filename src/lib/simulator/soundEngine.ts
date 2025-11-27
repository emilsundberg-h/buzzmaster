// Ljudmotor för kommentarer och publikljud
export class SoundEngine {
  audioContext: AudioContext | null;
  crowdNoise: AudioBufferSourceNode | null;
  crowdGainNode: GainNode | null;
  baseVolume: number;
  enabled: boolean;
  voicesLoaded: boolean;
  isIOS: boolean;
  speechInitialized: boolean;
  
  constructor() {
    this.audioContext = null;
    this.crowdNoise = null;
    this.crowdGainNode = null;
    this.baseVolume = 0.3;
    this.enabled = false;
    this.voicesLoaded = false;
    this.speechInitialized = false;
    
    // Detektera iOS
    this.isIOS = typeof window !== 'undefined' && /iPad|iPhone|iPod/.test(navigator.userAgent);
    console.log('SoundEngine: iOS detected:', this.isIOS);
    
    // Ladda röster
    this.loadVoices();
  }

  // Ladda tillgängliga röster
  loadVoices() {
    if (typeof window === 'undefined') return;
    if ('speechSynthesis' in window) {
      // Vissa webbläsare laddar röster asynkront
      window.speechSynthesis.getVoices();
      
      window.speechSynthesis.onvoiceschanged = () => {
        this.voicesLoaded = true;
        console.log('Available voices:', window.speechSynthesis.getVoices().map(v => v.name));
      };
    }
  }

  // Initiera Web Audio API
  async initialize() {
    if (typeof window === 'undefined') return;
    
    try {
      this.audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      this.crowdGainNode = this.audioContext.createGain();
      this.crowdGainNode.connect(this.audioContext.destination);
      this.crowdGainNode.gain.value = this.baseVolume;
      this.enabled = true;
      
      // Starta bakgrundsljud
      this.startCrowdNoise();
      
      // iOS-specifik initialisering för speech
      if (this.isIOS && 'speechSynthesis' in window) {
        console.log('SoundEngine: Initializing iOS speech synthesis');
        // Trigga speech synthesis med en tom utterance för att "väcka" den
        const utterance = new SpeechSynthesisUtterance('');
        utterance.volume = 0;
        window.speechSynthesis.speak(utterance);
        this.speechInitialized = true;
      }
    } catch (error) {
      console.error('Kunde inte initiera ljudmotor:', error);
    }
  }

  // Skapa syntetiskt publikljud
  startCrowdNoise() {
    if (!this.audioContext) return;

    const bufferSize = this.audioContext.sampleRate * 2;
    const buffer = this.audioContext.createBuffer(1, bufferSize, this.audioContext.sampleRate);
    const data = buffer.getChannelData(0);
    
    // Generera vitt brus filtrerat för att låta som publikmuller
    for (let i = 0; i < bufferSize; i++) {
      data[i] = (Math.random() * 2 - 1) * 0.3;
    }
    
    // Skapa och starta ljudkälla
    this.crowdNoise = this.audioContext.createBufferSource();
    this.crowdNoise.buffer = buffer;
    this.crowdNoise.loop = true;
    
    // Lägg till filter för att göra ljudet mer realistiskt
    const filter = this.audioContext.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = 800;
    
    this.crowdNoise.connect(filter);
    filter.connect(this.crowdGainNode!);
    this.crowdNoise.start();
  }

  // Öka publikljud (vid mål eller spännande händelser)
  increaseCrowdNoise(duration: number = 3000) {
    if (!this.crowdGainNode || !this.audioContext) return;

    const currentTime = this.audioContext.currentTime;
    this.crowdGainNode.gain.cancelScheduledValues(currentTime);
    this.crowdGainNode.gain.setValueAtTime(this.crowdGainNode.gain.value, currentTime);
    this.crowdGainNode.gain.linearRampToValueAtTime(0.8, currentTime + 0.2);
    this.crowdGainNode.gain.linearRampToValueAtTime(this.baseVolume, currentTime + duration / 1000);
  }

  // Stoppa publikljud mjukt (fade out)
  stopCrowdNoise() {
    if (!this.crowdGainNode || !this.audioContext) return;

    const currentTime = this.audioContext.currentTime;
    this.crowdGainNode.gain.cancelScheduledValues(currentTime);
    this.crowdGainNode.gain.setValueAtTime(this.crowdGainNode.gain.value, currentTime);
    // Fade out över 2 sekunder
    this.crowdGainNode.gain.linearRampToValueAtTime(0, currentTime + 2);
    
    // Stoppa ljudkällan efter fade out
    setTimeout(() => {
      if (this.crowdNoise) {
        try {
          this.crowdNoise.stop();
          this.crowdNoise = null;
        } catch (e) {
          // Already stopped
        }
      }
    }, 2000);
  }

  // Spela jubel vid mål
  playGoalCelebration() {
    this.increaseCrowdNoise(4000);
    this.playBeep(440, 0.3, 0.2); // A4
    setTimeout(() => this.playBeep(554.37, 0.3, 0.2), 200); // C#5
    setTimeout(() => this.playBeep(659.25, 0.3, 0.3), 400); // E5
  }

  // Spela ett enkelt pip-ljud
  playBeep(frequency: number, duration: number, volume: number = 0.3) {
    if (!this.audioContext) return;

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();
    
    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);
    
    oscillator.frequency.value = frequency;
    oscillator.type = 'sine';
    
    gainNode.gain.setValueAtTime(volume, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + duration);
    
    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + duration);
  }

  // Hitta bästa engelska rösten
  getBestEnglishVoice(): SpeechSynthesisVoice | null {
    if (typeof window === 'undefined') return null;
    
    const voices = window.speechSynthesis.getVoices();
    
    // Prioritera röster i ordning av kvalitet
    const preferredVoices = [
      'Google UK English Male',
      'Google US English Male', 
      'Google UK English Female',
      'Google US English Female',
      'Daniel',
      'Samantha',
      'Alex',
      'Microsoft David',
      'Microsoft Mark'
    ];
    
    // Försök hitta en prioriterad röst
    for (const preferred of preferredVoices) {
      const voice = voices.find(v => v.name.includes(preferred));
      if (voice) return voice;
    }
    
    // Fallback: hitta någon engelsk röst
    return voices.find(v => v.lang.startsWith('en-')) || voices[0] || null;
  }

  // Text-to-speech kommentar - dela upp i mindre delar för att undvika buggar
  async speak(text: string, lang: string = 'en-GB', onProgress?: (read: number, total: number) => void) {
    if (typeof window === 'undefined') return;
    if (!('speechSynthesis' in window)) {
      console.error('SoundEngine: speechSynthesis not supported');
      return;
    }
    
    // Vänta på att röster är laddade
    await this.ensureVoicesLoaded();
    
    console.log('SoundEngine: Speaking', text.length, 'characters');
    console.log('SoundEngine: iOS mode:', this.isIOS);
    
    // iOS-specifik workaround: Pausa och återuppta för att undvika att speech "fastnar"
    if (this.isIOS) {
      window.speechSynthesis.cancel();
      // Kort delay för att låta cancel slutföras
      await new Promise(resolve => setTimeout(resolve, 50));
    }
    
    // Dela upp texten i meningar (max ~200 tecken per chunk för säkerhet)
    const chunks = this.splitIntoChunks(text, 200);
    console.log('SoundEngine: Split into', chunks.length, 'chunks');
    
    // Använd bästa tillgängliga engelska rösten
    const voice = this.getBestEnglishVoice();
    console.log('SoundEngine: Using voice:', voice?.name || 'default', voice?.lang || 'unknown');
    
    let totalRead = 0;
    
    // Spela varje chunk i följd
    for (let i = 0; i < chunks.length; i++) {
      console.log(`SoundEngine: Speaking chunk ${i + 1}/${chunks.length}`);
      
      // iOS workaround: Kontrollera om speech är pausad och återuppta
      if (this.isIOS && window.speechSynthesis.paused) {
        console.log('SoundEngine: iOS speech was paused, resuming...');
        window.speechSynthesis.resume();
      }
      
      await this.speakChunk(chunks[i], voice, lang);
      
      // Uppdatera progress efter varje chunk
      totalRead += chunks[i].length;
      if (onProgress) {
        onProgress(totalRead, text.length);
      }
      
      // Liten paus mellan chunks för att undvika att de krockar
      if (i < chunks.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 100));
      }
    }
    
    console.log('SoundEngine: All speech completed!');
  }
  
  // Dela upp text i chunks baserat på meningar
  splitIntoChunks(text: string, maxLength: number): string[] {
    const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
    const chunks: string[] = [];
    let currentChunk = '';
    
    for (const sentence of sentences) {
      if (currentChunk.length + sentence.length > maxLength && currentChunk.length > 0) {
        chunks.push(currentChunk.trim());
        currentChunk = sentence;
      } else {
        currentChunk += sentence;
      }
    }
    
    if (currentChunk.length > 0) {
      chunks.push(currentChunk.trim());
    }
    
    return chunks;
  }
  
  // Spela en enskild chunk
  speakChunk(text: string, voice: SpeechSynthesisVoice | null, lang: string): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    
    return new Promise((resolve, reject) => {
      const utterance = new SpeechSynthesisUtterance(text);
      
      if (voice) {
        utterance.voice = voice;
      }
      
      utterance.lang = lang;
      utterance.rate = 1.15;
      utterance.pitch = 1.05;
      utterance.volume = 1.0;
      
      utterance.onerror = (event) => {
        console.error('SoundEngine: Speech error:', event.error, event);
        resolve(); // Fortsätt ändå
      };
      
      utterance.onend = () => {
        console.log('SoundEngine: Chunk completed');
        resolve();
      };
      
      utterance.onstart = () => {
        console.log('SoundEngine: Chunk started');
      };
      
      console.log('SoundEngine: Calling speechSynthesis.speak()');
      window.speechSynthesis.speak(utterance);
      
      // iOS workaround: Sätt en timeout för att undvika att fastna
      if (this.isIOS) {
        const timeout = setTimeout(() => {
          console.warn('SoundEngine: iOS speech timeout, forcing resolve');
          resolve();
        }, text.length * 100); // ~100ms per tecken
        
        // Rensa timeout när utterance är klar
        const originalOnEnd = utterance.onend;
        utterance.onend = (event) => {
          clearTimeout(timeout);
          if (originalOnEnd) originalOnEnd.call(utterance, event);
        };
      }
    });
  }
  
  // Säkerställ att röster är laddade
  ensureVoicesLoaded(): Promise<void> {
    if (typeof window === 'undefined') return Promise.resolve();
    
    return new Promise((resolve) => {
      const voices = window.speechSynthesis.getVoices();
      if (voices.length > 0) {
        resolve();
        return;
      }
      
      // Vänta på att röster laddas
      window.speechSynthesis.onvoiceschanged = () => {
        resolve();
      };
      
      // Timeout efter 1 sekund
      setTimeout(resolve, 1000);
    });
  }
  
  // Rensa alla kommentarer (för reset)
  clearSpeech() {
    if (typeof window === 'undefined') return;
    if ('speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
  }


  // Stoppa allt ljud
  stop() {
    if (this.audioContext) {
      this.clearSpeech();
      if (this.crowdNoise) {
        this.crowdNoise.stop();
      }
      this.audioContext.close();
    }
  }
}
