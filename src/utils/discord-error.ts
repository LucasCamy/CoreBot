import { DiscordAPIError, RESTJSONErrorCodes } from 'discord.js';

export interface DiscordChannelErrorInfo {
  isChannelError: boolean;
  code?: number | string;
  isUnknownChannel: boolean;
  isMissingAccess: boolean;
}

/**
 * Checks if an error corresponds to a missing channel or missing access in Discord REST API.
 */
export function isDiscordChannelError(error: unknown): DiscordChannelErrorInfo {
  if (!error || typeof error !== 'object') {
    return { isChannelError: false, isUnknownChannel: false, isMissingAccess: false };
  }

  let code: number | string | undefined;

  if (error instanceof DiscordAPIError) {
    code = error.code;
  } else if (
    'code' in error &&
    (typeof (error as { code: unknown }).code === 'number' ||
      typeof (error as { code: unknown }).code === 'string')
  ) {
    code = (error as { code: number | string }).code;
  }

  const numericCode = typeof code === 'string' ? parseInt(code, 10) : code;

  const isUnknownChannel =
    numericCode === RESTJSONErrorCodes.UnknownChannel || numericCode === 10003;
  const isMissingAccess =
    numericCode === RESTJSONErrorCodes.MissingAccess ||
    numericCode === RESTJSONErrorCodes.MissingPermissions ||
    numericCode === 50001 ||
    numericCode === 50013;

  return {
    isChannelError: isUnknownChannel || isMissingAccess,
    code,
    isUnknownChannel,
    isMissingAccess,
  };
}
