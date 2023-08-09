import 'dotenv/config';
import fetch from 'node-fetch';
import { InteractionResponseType, verifyKey } from 'discord-interactions';
import { Response } from 'express';
import emojis from './emojis.js';

export function VerifyDiscordRequest(clientKey: string) {
  return function (req: any, res: any, buf: any, encoding: any) {
    const signature = req.get('X-Signature-Ed25519');
    const timestamp = req.get('X-Signature-Timestamp');

    const isValidRequest = verifyKey(buf, signature, timestamp, clientKey);
    if (!isValidRequest) {
      res.status(401).send('Bad request signature');
      throw new Error('Bad request signature');
    }
  };
}

export async function DiscordRequest(endpoint: string, options: any = {}) {
  // append endpoint to root API URL
  const url = 'https://discord.com/api/v10/' + endpoint;
  // Stringify payloads
  if (options.body) options.body = JSON.stringify(options.body);

  // console all the request details
  console.log('Making request to: ', url);
  console.log('With options: ', options);

  // Use node-fetch to make requests
  const res = await fetch(url, {
    headers: {
      Authorization: `Bot ${process.env.DISCORD_TOKEN}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'User-Agent': 'DiscordBot (https://github.com/discord/discord-example-app, 1.0.0)',
    },
    ...options
  });
  // throw API errors
  if (!res.ok) {
    const data = await res.json();
    console.log(res.status);
    throw new Error(JSON.stringify(data));
  }
  // return original response
  return res;
}

export async function InstallGlobalCommands(appId: string, commands: any[]) {
  // API endpoint to overwrite global commands
  const endpoint = `applications/${appId}/commands`;

  try {
    // This is calling the bulk overwrite endpoint: https://discord.com/developers/docs/interactions/application-commands#bulk-overwrite-global-application-commands
    await DiscordRequest(endpoint, { method: 'PUT', body: commands });
  } catch (err) {
    console.error(err);
  }
}

// Simple method that returns a random emoji from list
export function getRandomEmoji() {
  return emojis[Math.floor(Math.random() * emojis.length)];
}

export function capitalize(str: string) {
  return str.charAt(0).toUpperCase() + str.slice(1);
}

export async function sendMessage(message: string, channelId: string, image?: string) {
  const endpoint = `channels/${channelId}/messages`;

  try {
    await DiscordRequest(endpoint, {
      method: 'POST',
      body: {
        content: message,
        ...image ? {
          embeds: [{
            image: { url: image }
          }]
        } : {}
      },
    });
  } catch (err) {
    console.error('Error sending message: ', err);
  }
}

export async function getAllGuilds() {
  const endpoint = `users/@me/guilds`;
  try {
    const res = await DiscordRequest(endpoint);
    return await res.json() as any[];
  } catch (err) {
    console.error('Error getting guilds: ', err);
    throw err;
  }
}

export async function getAllChannels(guildId: string) {
  const endpoint = `guilds/${guildId}/channels`;
  try {
    const res = await DiscordRequest(endpoint);
    return await res.json() as any[];
  } catch (err) {
    console.error('Error getting channels: ', err);
    return [];
  }
}

export async function getAllMembers(guildId: string) {
  const endpoint = `guilds/${guildId}/members?limit=1000`;
  try {
    const res = await DiscordRequest(endpoint);
    return await res.json() as any[];
  } catch (err) {
    console.error('Error getting members: ', err);
    return [];
  }
}

// write a function to get all members of a guild who are not bots
export async function getAllNonBotMembers(guildId: string) {
  const members = await getAllMembers(guildId);
  return members.filter(member => !member.user.bot);
}

export function sendResponseMessage(res: Response, message: string) {
  res.send({
    type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
    data: {
      content: message,
    }
  });
}

export async function getRandomGif() {
  const url = `https://api.giphy.com/v1/gifs/random?api_key=${process.env.GIPHY_API_KEY}&tag=dank meme`;
  try {
    const res = await fetch(url);
    const data = await res.json();
    return (data as any).data.images.original.url;
  } catch (err) {
    console.error('Error getting random gif: ', err);
    return '';
  }
}