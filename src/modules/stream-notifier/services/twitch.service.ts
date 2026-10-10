import { env } from '../../../config/env.js';
import { logger } from '../../../utils/logger.js';

export interface TwitchStreamData {
  id: string;
  userId: string;
  userLogin: string;
  userName: string;
  gameName: string;
  title: string;
  viewerCount: number;
  startedAt: string;
  thumbnailUrl: string;
}

interface TwitchTokenResponse {
  access_token: string;
  expires_in: number;
  token_type: string;
}

interface TwitchStreamApiResponse {
  data: Array<{
    id: string;
    user_id: string;
    user_login: string;
    user_name: string;
    game_name: string;
    title: string;
    viewer_count: number;
    started_at: string;
    thumbnail_url: string;
  }>;
}

export class TwitchService {
  private static accessToken: string | null = null;
  private static tokenExpiresAt: number = 0;
  private static readonly ONE_HOUR_MS = 60 * 60 * 1000;

  /**
   * Securely acquires or refreshes OAuth2 App Access Token with automatic renewal
   * if expiring in less than 1 hour, and exponential backoff retry on network failure.
   */
  private async getValidToken(forceRefresh: boolean = false): Promise<string | null> {
    const clientId = env.TWITCH_CLIENT_ID;
    const clientSecret = env.TWITCH_CLIENT_SECRET;

    if (!clientId || !clientSecret) {
      logger.debug(
        'Twitch credentials not configured in environment. Skipping Helix API requests.',
      );
      return null;
    }

    // Return cached token if still valid for more than 1 hour
    if (
      !forceRefresh &&
      TwitchService.accessToken &&
      Date.now() < TwitchService.tokenExpiresAt - TwitchService.ONE_HOUR_MS
    ) {
      return TwitchService.accessToken;
    }

    const MAX_RETRIES = 3;
    let lastError: Error | null = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
      try {
        const tokenUrl = new URL('https://id.twitch.tv/oauth2/token');
        tokenUrl.searchParams.set('client_id', clientId);
        tokenUrl.searchParams.set('client_secret', clientSecret);
        tokenUrl.searchParams.set('grant_type', 'client_credentials');

        const response = await fetch(tokenUrl.toString(), {
          method: 'POST',
        });

        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        const data = (await response.json()) as TwitchTokenResponse;
        TwitchService.accessToken = data.access_token;
        TwitchService.tokenExpiresAt = Date.now() + data.expires_in * 1000;

        logger.info(
          {
            expiresInSeconds: data.expires_in,
            validUntil: new Date(TwitchService.tokenExpiresAt).toISOString(),
          },
          'Twitch OAuth2 App Access Token refreshed successfully',
        );

        return TwitchService.accessToken;
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));
        logger.warn(
          { attempt, maxRetries: MAX_RETRIES, error: lastError.message },
          'Failed to acquire Twitch OAuth token, retrying with exponential backoff...',
        );

        if (attempt < MAX_RETRIES) {
          const delayMs = Math.pow(2, attempt) * 500; // 1s, 2s
          await new Promise((resolve) => setTimeout(resolve, delayMs));
        }
      }
    }

    logger.error(
      { error: lastError?.message },
      'Exhausted all retries acquiring Twitch OAuth2 App Access Token',
    );
    return null;
  }

  /**
   * Public interface to get valid token.
   */
  public async getAppAccessToken(): Promise<string | null> {
    return this.getValidToken(false);
  }

  /**
   * Fetches stream information for multiple logins in batches of up to 100.
   * Handles 401 Unauthorized by force-refreshing the token and retrying once.
   */
  public async fetchLiveStreams(logins: string[]): Promise<Map<string, TwitchStreamData>> {
    const results = new Map<string, TwitchStreamData>();
    if (logins.length === 0) return results;

    let token = await this.getValidToken();
    if (!token) return results;

    const clientId = env.TWITCH_CLIENT_ID;
    const CHUNK_SIZE = 100;

    for (let i = 0; i < logins.length; i += CHUNK_SIZE) {
      const chunk = logins.slice(i, i + CHUNK_SIZE);
      const url = new URL('https://api.twitch.tv/helix/streams');

      for (const login of chunk) {
        url.searchParams.append('user_login', login.toLowerCase());
      }

      try {
        let response = await fetch(url.toString(), {
          headers: {
            'Client-Id': clientId,
            Authorization: `Bearer ${token}`,
          },
        });

        // If 401 Unauthorized, force-refresh token and retry request once
        if (response.status === 401) {
          logger.warn(
            'Twitch Helix returned 401 Unauthorized. Force refreshing App Access Token...',
          );
          token = await this.getValidToken(true);
          if (token) {
            response = await fetch(url.toString(), {
              headers: {
                'Client-Id': clientId,
                Authorization: `Bearer ${token}`,
              },
            });
          }
        }

        if (!response.ok) {
          logger.warn(
            { status: response.status, statusText: response.statusText },
            'Twitch Helix streams endpoint error',
          );
          continue;
        }

        const body = (await response.json()) as TwitchStreamApiResponse;

        for (const stream of body.data) {
          results.set(stream.user_login.toLowerCase(), {
            id: stream.id,
            userId: stream.user_id,
            userLogin: stream.user_login.toLowerCase(),
            userName: stream.user_name,
            gameName: stream.game_name || 'Diversos',
            title: stream.title || 'Sem título',
            viewerCount: stream.viewer_count,
            startedAt: stream.started_at,
            thumbnailUrl: stream.thumbnail_url
              .replace('{width}', '1280')
              .replace('{height}', '720'),
          });
        }
      } catch (error) {
        const err = error instanceof Error ? error : new Error(String(error));
        logger.error({ error: err.message }, 'Error fetching streams from Twitch Helix API');
      }
    }

    return results;
  }
}
