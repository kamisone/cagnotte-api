import { Injectable, Logger, OnModuleInit } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { initializeApp, cert, App } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import * as fs from 'fs';

@Injectable()
export class FirebaseService implements OnModuleInit {
  private app: App | null = null;
  private readonly logger = new Logger(FirebaseService.name);

  constructor(private readonly config: ConfigService) {}

  onModuleInit() {
    const serviceAccount = this.loadServiceAccount();
    if (!serviceAccount) {
      this.logger.warn('Firebase service account not found — push notifications disabled');
      return;
    }

    try {
      this.app = initializeApp({ credential: cert(serviceAccount) }, 'cagnotte');
      this.logger.log('Firebase Admin SDK initialized');
    } catch (err) {
      this.logger.error(`Firebase init failed: ${(err as Error).message}`);
    }
  }

  private loadServiceAccount(): object | null {
    // Production: JSON content stored directly in env var
    const json = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_JSON');
    if (json) {
      try {
        return JSON.parse(json);
      } catch {
        this.logger.error('FIREBASE_SERVICE_ACCOUNT_JSON is not valid JSON');
        return null;
      }
    }

    // Local dev: path to the JSON file
    const path = this.config.get<string>('FIREBASE_SERVICE_ACCOUNT_PATH');
    if (path && fs.existsSync(path)) {
      return JSON.parse(fs.readFileSync(path, 'utf8'));
    }

    return null;
  }

  get isReady(): boolean {
    return this.app !== null;
  }

  async sendToToken(
    token: string,
    notification: { title: string; body: string },
    data: Record<string, string> = {},
  ): Promise<boolean> {
    if (!this.app) return false;
    try {
      await getMessaging(this.app).send({
        token,
        notification: { title: notification.title, body: notification.body },
        data,
        android: { priority: 'high' },
        apns: { payload: { aps: { sound: 'default', badge: 1 } } },
      });
      return true;
    } catch (err) {
      const msg: string = (err as Error)?.message ?? '';
      if (
        msg.includes('registration-token-not-registered') ||
        msg.includes('invalid-registration-token')
      ) {
        return false; // stale token — caller should deactivate it
      }
      // Transient error (network, quota, etc.) — log but don't signal as stale
      this.logger.error(`FCM send failed: ${msg}`);
      throw err;
    }
  }

  async sendMulticast(
    tokens: string[],
    notification: { title: string; body: string },
    data: Record<string, string> = {},
  ): Promise<{ successCount: number; failureCount: number; staleTokens: string[] }> {
    if (!this.app || tokens.length === 0) {
      return { successCount: 0, failureCount: 0, staleTokens: [] };
    }

    const results = await Promise.allSettled(
      tokens.map((token) =>
        this.sendToToken(token, notification, data).then((ok) => ({ token, ok })),
      ),
    );

    const staleTokens: string[] = [];
    let successCount = 0;

    for (const result of results) {
      if (result.status === 'fulfilled') {
        if (result.value.ok) successCount++;
        else staleTokens.push(result.value.token); // ok === false means stale token
        // (transient errors are rejected — not counted as stale)
      }
    }

    return { successCount, failureCount: tokens.length - successCount, staleTokens };
  }
}
