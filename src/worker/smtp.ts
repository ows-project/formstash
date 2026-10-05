import { connect } from "cloudflare:sockets";
import { buildMessage, smtpAuthPlain, type EmailContent } from "./smtp-message";

export type { EmailContent } from "./smtp-message";

export interface SmtpConfig {
  host: string;
  port: number;
  security: "tls" | "starttls";
  username: string;
  password: string;
  fromName: string;
  fromEmail: string;
}

const encoder = new TextEncoder();

class SmtpSession {
  private readonly reader;
  private readonly writer;
  private buffer = "";
  private readonly decoder = new TextDecoder();

  constructor(private readonly socket: Socket) {
    this.reader = socket.readable.getReader();
    this.writer = socket.writable.getWriter();
  }

  private async line(): Promise<string> {
    while (!this.buffer.includes("\n")) {
      const { value, done } = await this.reader.read();
      if (done) throw new Error("SMTP server closed the connection");
      this.buffer += this.decoder.decode(value, { stream: true });
    }
    const index = this.buffer.indexOf("\n");
    const line = this.buffer.slice(0, index + 1).replace(/\r?\n$/, "");
    this.buffer = this.buffer.slice(index + 1);
    return line;
  }

  async response(expected: number[]): Promise<string[]> {
    const lines: string[] = [];
    let code = 0;
    do {
      const line = await this.line();
      lines.push(line);
      code = Number(line.slice(0, 3));
    } while (lines.at(-1)?.[3] === "-");
    if (!expected.includes(code)) throw new Error(`SMTP ${code}: ${lines.join(" ").slice(0, 400)}`);
    return lines;
  }

  async command(command: string, expected: number[]): Promise<string[]> {
    await this.writer.write(encoder.encode(`${command}\r\n`));
    return this.response(expected);
  }

  release(): void {
    this.reader.releaseLock();
    this.writer.releaseLock();
  }

  close(): void {
    this.release();
    this.socket.close();
  }
}

export async function sendSmtp(config: SmtpConfig, content: EmailContent): Promise<void> {
  if (!config.host || !config.fromEmail || !content.to) throw new Error("SMTP host, sender, and recipient are required");
  let socket = connect({ hostname: config.host, port: config.port }, {
    secureTransport: config.security === "tls" ? "on" : "starttls",
    allowHalfOpen: false,
  });
  let session = new SmtpSession(socket);

  try {
    await session.response([220]);
    await session.command("EHLO formstash", [250]);
    if (config.security === "starttls") {
      await session.command("STARTTLS", [220]);
      session.release();
      socket = socket.startTls();
      session = new SmtpSession(socket);
      await session.command("EHLO formstash", [250]);
    }
    if (config.username) {
      await session.command(`AUTH PLAIN ${smtpAuthPlain(config.username, config.password)}`, [235]);
    }
    await session.command(`MAIL FROM:<${config.fromEmail}>`, [250]);
    await session.command(`RCPT TO:<${content.to}>`, [250, 251]);
    await session.command("DATA", [354]);
    await session.command(`${buildMessage(config, content)}\r\n.`, [250]);
    await session.command("QUIT", [221]);
  } finally {
    try { session.close(); } catch { /* connection already closed */ }
  }
}
