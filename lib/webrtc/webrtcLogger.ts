/**
 * WebRTC Diagnostic Logging Helper
 *
 * Provides real-time, comprehensive logging for all WebRTC lifecycle stages:
 * - getUserMedia constraints & track capabilities
 * - PeerConnection state transitions
 * - Signaling and SDP offer/answer exchanges
 * - ICE gathering, candidate generation, queueing, and candidate types (host/srflx/relay)
 * - Remote track attachment (ontrack)
 * - Periodic WebRTC stats inspection
 */

export type IceCandidateType = "host" | "srflx" | "relay" | "prflx" | "unknown";

export function parseCandidateType(candidateStr: string): {
  type: IceCandidateType;
  protocol: string;
  ip: string;
  port: string;
} {
  const parts = candidateStr.trim().split(" ");
  let type: IceCandidateType = "unknown";
  let protocol = "udp";
  let ip = "";
  let port = "";

  for (let i = 0; i < parts.length; i++) {
    if (parts[i] === "typ" && i + 1 < parts.length) {
      type = parts[i + 1] as IceCandidateType;
    }
  }

  if (parts.length >= 6) {
    protocol = parts[2] || "udp";
    ip = parts[4] || "";
    port = parts[5] || "";
  }

  return { type, protocol, ip, port };
}

class WebRtcDiagnosticLogger {
  private prefix = "[WebRTC-Diag]";
  private isTwaDetected: boolean = false;

  constructor() {
    if (typeof window !== "undefined") {
      this.isTwaDetected =
        document.referrer.includes("android-app://") ||
        window.matchMedia("(display-mode: standalone)").matches ||
        (window.navigator as any).standalone === true;
    }
  }

  public getEnvContext(): string {
    return this.isTwaDetected ? "[TWA/Standalone]" : "[Browser]";
  }

  public log(message: string, ...args: any[]): void {
    console.log(
      `%c${this.prefix} ${this.getEnvContext()} %c${message}`,
      "color: #06b6d4; font-weight: bold;",
      "color: inherit;",
      ...args
    );
  }

  public warn(message: string, ...args: any[]): void {
    console.warn(
      `%c${this.prefix} ${this.getEnvContext()} ⚠️ %c${message}`,
      "color: #f59e0b; font-weight: bold;",
      "color: inherit;",
      ...args
    );
  }

  public error(message: string, ...args: any[]): void {
    console.error(
      `%c${this.prefix} ${this.getEnvContext()} ❌ %c${message}`,
      "color: #ef4444; font-weight: bold;",
      "color: inherit;",
      ...args
    );
  }

  public logCandidate(action: string, candidateStr: string): void {
    const { type, protocol, ip, port } = parseCandidateType(candidateStr);
    const badgeColor =
      type === "relay"
        ? "background: #8b5cf6; color: white;"
        : type === "srflx"
        ? "background: #10b981; color: white;"
        : "background: #3b82f6; color: white;";

    console.log(
      `%c${this.prefix} ${action}: %c[${type.toUpperCase()}]%c ${protocol} ${ip}:${port}`,
      "color: #06b6d4; font-weight: bold;",
      `${badgeColor} padding: 1px 5px; border-radius: 4px; font-weight: bold;`,
      "color: inherit;"
    );
  }

  public inspectPeerStats(pc: RTCPeerConnection): void {
    if (!pc) return;
    pc.getStats()
      .then((stats) => {
        let activePair: any = null;
        let localCand: any = null;
        let remoteCand: any = null;

        stats.forEach((report) => {
          if (report.type === "transport" && report.selectedCandidatePairId) {
            activePair = stats.get(report.selectedCandidatePairId);
          } else if (
            report.type === "candidate-pair" &&
            (report.nominated || report.state === "succeeded")
          ) {
            activePair = report;
          }
        });

        if (activePair) {
          localCand = stats.get(activePair.localCandidateId);
          remoteCand = stats.get(activePair.remoteCandidateId);
          this.log("Active Candidate Pair Stats:", {
            state: activePair.state,
            rtt: activePair.currentRoundTripTime
              ? `${(activePair.currentRoundTripTime * 1000).toFixed(1)}ms`
              : "N/A",
            bytesSent: activePair.bytesSent,
            bytesReceived: activePair.bytesReceived,
            local: localCand
              ? `${localCand.candidateType} (${localCand.protocol} ${localCand.address}:${localCand.port})`
              : "unknown",
            remote: remoteCand
              ? `${remoteCand.candidateType} (${remoteCand.protocol} ${remoteCand.address}:${remoteCand.port})`
              : "unknown",
          });
        }
      })
      .catch(() => {});
  }
}

export const webrtcLogger = new WebRtcDiagnosticLogger();
