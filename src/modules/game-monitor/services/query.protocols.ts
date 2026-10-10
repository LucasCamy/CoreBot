import net from 'net';
import dgram from 'dgram';

export interface ServerQueryResult {
  online: boolean;
  pingMs: number;
  host: string;
  port: number;
  playersOnline?: number;
  playersMax?: number;
  playerNames?: string[];
  version?: string;
  motd?: string;
  mapName?: string;
  error?: string;
}

/**
 * Generic TCP Ping
 */
export async function queryGenericTcp(
  host: string,
  port: number,
  timeoutMs = 3000,
): Promise<ServerQueryResult> {
  const start = Date.now();
  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;

    socket.setTimeout(timeoutMs);

    socket.on('connect', () => {
      if (resolved) return;
      resolved = true;
      const pingMs = Date.now() - start;
      socket.destroy();
      resolve({
        online: true,
        pingMs,
        host,
        port,
      });
    });

    socket.on('timeout', () => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({
        online: false,
        pingMs: 0,
        host,
        port,
        error: 'Connection timed out',
      });
    });

    socket.on('error', (err) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve({
        online: false,
        pingMs: 0,
        host,
        port,
        error: err.message,
      });
    });

    socket.connect(port, host);
  });
}

/**
 * Minecraft Java Server List Ping (SLP) Protocol
 */
export async function queryMinecraft(
  host: string,
  port: number,
  timeoutMs = 4000,
): Promise<ServerQueryResult> {
  const start = Date.now();

  return new Promise((resolve) => {
    const socket = new net.Socket();
    let resolved = false;
    let receivedData = Buffer.alloc(0);

    socket.setTimeout(timeoutMs);

    const finish = (result: ServerQueryResult) => {
      if (resolved) return;
      resolved = true;
      socket.destroy();
      resolve(result);
    };

    socket.on('connect', () => {
      // 1. Handshake Packet (Protocol 47 = 1.8+, supports up to modern servers)
      const hostBuffer = Buffer.from(host, 'utf-8');
      const handshake = Buffer.concat([
        Buffer.from([0x00]), // Packet ID 0x00
        Buffer.from([0x2f]), // Protocol version 47 (VarInt)
        Buffer.from([hostBuffer.length]), // Host string length
        hostBuffer,
        Buffer.from([(port >> 8) & 0xff, port & 0xff]), // Port (short)
        Buffer.from([0x01]), // Next state: 1 (status)
      ]);

      const handshakeWithLength = Buffer.concat([Buffer.from([handshake.length]), handshake]);

      // 2. Status Request Packet
      const requestPacket = Buffer.from([0x01, 0x00]);

      socket.write(Buffer.concat([handshakeWithLength, requestPacket]));
    });

    socket.on('data', (chunk) => {
      receivedData = Buffer.concat([receivedData, chunk]);

      // Try to extract JSON response
      const jsonStart = receivedData.indexOf('{');
      const jsonEnd = receivedData.lastIndexOf('}');

      if (jsonStart !== -1 && jsonEnd !== -1 && jsonEnd > jsonStart) {
        try {
          const jsonStr = receivedData.subarray(jsonStart, jsonEnd + 1).toString('utf-8');
          const data = JSON.parse(jsonStr);
          const pingMs = Date.now() - start;

          const motd =
            typeof data.description === 'string'
              ? data.description
              : data.description?.text || 'Minecraft Server';

          const playersOnline = data.players?.online ?? 0;
          const playersMax = data.players?.max ?? 0;
          const playerNames = Array.isArray(data.players?.sample)
            ? data.players.sample.map((p: { name: string }) => p.name)
            : [];

          finish({
            online: true,
            pingMs,
            host,
            port,
            playersOnline,
            playersMax,
            playerNames,
            version: data.version?.name || 'Java Edition',
            motd: motd.replace(/§[0-9a-fk-or]/gi, '').trim(), // strip MC color codes
          });
        } catch {
          // Keep waiting for more chunks
        }
      }
    });

    socket.on('timeout', async () => {
      // Fallback to basic TCP test if SLP packet timed out
      const fallback = await queryGenericTcp(host, port, 1500);
      finish(fallback);
    });

    socket.on('error', () => {
      finish({
        online: false,
        pingMs: 0,
        host,
        port,
        error: 'Unable to connect to Minecraft server',
      });
    });
  });
}

/**
 * Valve Source Engine Query (A2S_INFO) Protocol via UDP
 */
export async function querySource(
  host: string,
  port: number,
  timeoutMs = 3500,
): Promise<ServerQueryResult> {
  const start = Date.now();

  return new Promise((resolve) => {
    const client = dgram.createSocket('udp4');
    let resolved = false;

    const finish = (result: ServerQueryResult) => {
      if (resolved) return;
      resolved = true;
      try {
        client.close();
      } catch {
        // Ignore close error
      }
      resolve(result);
    };

    const timer = setTimeout(() => {
      finish({
        online: false,
        pingMs: 0,
        host,
        port,
        error: 'UDP query timed out',
      });
    }, timeoutMs);

    client.on('error', (err) => {
      clearTimeout(timer);
      finish({
        online: false,
        pingMs: 0,
        host,
        port,
        error: err.message,
      });
    });

    client.on('message', (msg) => {
      clearTimeout(timer);
      const pingMs = Date.now() - start;

      try {
        // A2S_INFO response begins with 4 bytes of 0xFF followed by header 0x49 ('I')
        if (msg.length > 5 && msg.readInt32LE(0) === -1) {
          const header = msg.readUInt8(4);

          // If response is challenge request (0x41 'A'), resend with challenge
          if (header === 0x41 && msg.length >= 9) {
            const challenge = msg.subarray(5, 9);
            const queryWithChallenge = Buffer.concat([
              Buffer.from('\xFF\xFF\xFF\xFFTSource Engine Query\x00', 'binary'),
              challenge,
            ]);
            client.send(queryWithChallenge, port, host);
            return;
          }

          if (header === 0x49) {
            let offset = 6; // skip header (0x49) + protocol (1 byte)

            // Read Server Name (null-terminated string)
            const nameEnd = msg.indexOf(0x00, offset);
            const serverName = msg.subarray(offset, nameEnd).toString('utf-8');
            offset = nameEnd + 1;

            // Read Map Name
            const mapEnd = msg.indexOf(0x00, offset);
            const mapName = msg.subarray(offset, mapEnd).toString('utf-8');
            offset = mapEnd + 1;

            // Read Folder
            const folderEnd = msg.indexOf(0x00, offset);
            offset = folderEnd + 1;

            // Read Game Name
            const gameEnd = msg.indexOf(0x00, offset);
            offset = gameEnd + 1;

            // Skip ID (short)
            offset += 2;

            const playersOnline = msg.readUInt8(offset);
            const playersMax = msg.readUInt8(offset + 1);

            finish({
              online: true,
              pingMs,
              host,
              port,
              motd: serverName,
              mapName,
              playersOnline,
              playersMax,
            });
            return;
          }
        }

        // Generic positive UDP response
        finish({
          online: true,
          pingMs,
          host,
          port,
        });
      } catch (err: unknown) {
        const errorMsg = err instanceof Error ? err.message : String(err);
        finish({
          online: true,
          pingMs,
          host,
          port,
          error: errorMsg,
        });
      }
    });

    // Send initial A2S_INFO packet
    const a2sPacket = Buffer.from('\xFF\xFF\xFF\xFFTSource Engine Query\x00', 'binary');
    client.send(a2sPacket, port, host, (err) => {
      if (err) {
        clearTimeout(timer);
        finish({ online: false, pingMs: 0, host, port, error: err.message });
      }
    });
  });
}

/**
 * Dispatcher for all supported game queries
 */
export async function queryServer(
  gameType: string,
  host: string,
  port: number,
  queryPort?: number | null,
): Promise<ServerQueryResult> {
  const targetPort = queryPort || port;

  if (gameType === 'minecraft') {
    return queryMinecraft(host, targetPort);
  }

  if (gameType === 'source') {
    return querySource(host, targetPort);
  }

  return queryGenericTcp(host, targetPort);
}
