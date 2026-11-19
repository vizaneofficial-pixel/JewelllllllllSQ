export interface StoppableAudioSource {
  stop: (when?: number) => void;
  disconnect: () => void;
}

export class VoicePlaybackRegistry {
  private activeSources = new Set<StoppableAudioSource>();
  public nextStartTime = 0;

  get activeCount(): number {
    return this.activeSources.size;
  }

  registerSource(source: StoppableAudioSource): void {
    this.activeSources.add(source);
  }

  releaseSource(source: StoppableAudioSource): void {
    this.activeSources.delete(source);
  }

  stopAll(currentTime = 0): number {
    let stopped = 0;
    for (const src of this.activeSources) {
      try {
        src.stop(0);
      } catch {
        // Source may already be stopped
      }
      try {
        src.disconnect();
      } catch {
        // Ignore disconnect errors
      }
      stopped += 1;
    }
    this.activeSources.clear();
    this.nextStartTime = currentTime;
    return stopped;
  }
}

export class VoiceTurnGate {
  private connectionGen = 0;
  private turnGen = 0;

  nextConnection(): number {
    this.connectionGen += 1;
    this.turnGen += 1;
    return this.connectionGen;
  }

  invalidateAll(): void {
    this.connectionGen += 1;
    this.turnGen += 1;
  }

  isCurrentConnection(gen: number): boolean {
    return gen === this.connectionGen;
  }

  nextTurn(): number {
    this.turnGen += 1;
    return this.turnGen;
  }

  isCurrentTurn(gen: number): boolean {
    return gen === this.turnGen;
  }
}

export function shouldSuppressMicFrame(params: {
  echoShieldEnabled: boolean;
  activeSourceCount: number;
  outputCurrentTime: number;
  nextStartTime: number;
  tailBufferSec?: number;
}): boolean {
  if (!params.echoShieldEnabled) return false;
  if (params.activeSourceCount > 0) return true;
  const tail = params.tailBufferSec ?? 0.24;
  return params.outputCurrentTime < params.nextStartTime + tail;
}
