import 'dotenv/config';
import express, { Request, Response } from 'express';
import {
  InteractionType,
  InteractionResponseType
} from 'discord-interactions';
import { VerifyDiscordRequest, getRandomEmoji, sendMessage, getAllGuilds, getAllChannels, sendResponseMessage, getAllNonBotMembers } from './utils.js';
import * as discord from 'discord.js';
import connectDatabase from './db.js';
import AutoPing from './schemas/AutoPing.js';
import RandomAutoPing from './schemas/RandomAutoPing.js';

const { PermissionsBitField } = discord;

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;

// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY as string) }));

const activePingers: { [key: string]: any } = {};
const activeRandomPingers: { [key: string]: any } = {};

/**
 * Interactions endpoint URL where Discord will send HTTP requests
 */
app.post('/interactions', async function (req: Request, res: Response) {
  // Interaction type and data
  const { type, data, member, channel } = req.body;
  
  /**
   * Handle verification requests
   */
  if (type === InteractionType.PING) {
    return res.send({ type: InteractionResponseType.PONG });
  }

  /**
   * Handle slash command requests
   * See https://discord.com/developers/docs/interactions/application-commands#slash-commands
   */
  if (type === InteractionType.APPLICATION_COMMAND) {
    const { name } = data;

    // "test" command
    if (name === 'test') {
      // Send a message into the channel where command was triggered from
      return res.send({
        type: InteractionResponseType.CHANNEL_MESSAGE_WITH_SOURCE,
        data: {
          // Fetches a random emoji to send from a helper function
          content: 'hello world ' + getRandomEmoji(),
        },
      });
    }

    // "start" command
    if (name === 'start') {
      // Check if member has permission to manage the server
      if ((BigInt(member.permissions) & PermissionsBitField.Flags.ManageGuild) === BigInt(0)) {
        return sendResponseMessage(res, ':octagonal_sign: Nope! You can\'t use this command.');
      }

      const memberToPing = data.options[0].value;
      const interval = data.options[1].value;

      if (activePingers[channel.id]) {
        clearInterval(activePingers[channel.id]);
      }

      const autoPing = await AutoPing.findOneAndUpdate(
        { guildId: channel.guild_id, channelId: channel.id },
        { memberId: memberToPing, interval: interval, active: true },
        { upsert: true, new: true }
      );

      // Send 1st ping immediately
      sendMessage(`<@${autoPing.memberId}> ${getRandomEmoji()}`, autoPing.channelId);

      // Then send pings every interval seconds
      activePingers[channel.id] = setInterval(
        () => sendMessage(`<@${autoPing.memberId}> ${getRandomEmoji()}`, autoPing.channelId),
        autoPing.interval * 1000
      );

      return sendResponseMessage(res, `Okay! This channel will now get "refilled" with <@${autoPing.memberId}> every ${autoPing.interval} seconds.`);
    }

    if (name === 'stop') {
      // Check if member has permission to manage the server
      if ((BigInt(member.permissions) & PermissionsBitField.Flags.ManageGuild) === BigInt(0)) {
        return sendResponseMessage(res, ':octagonal_sign: Nope! You can\'t use this command.');
      }

      if (!activePingers[channel.id]) {
        return sendResponseMessage(res, 'What are you trying to stop? There\'s nothing going on here.');
      }

      // delete from database
      await AutoPing.deleteOne({ guildId: channel.guild_id, channelId: channel.id });

      clearInterval(activePingers[channel.id]);
      delete activePingers[channel.id];

      return sendResponseMessage(res, 'Okay! I\'ll stop pinging on this channel.');
    }

    if (name === 'startrandomping') {
      // Check if member has permission to manage the server
      if ((BigInt(member.permissions) & PermissionsBitField.Flags.ManageGuild) === BigInt(0)) {
        return sendResponseMessage(res, ':octagonal_sign: Nope! You can\'t use this command.');
      }

      const interval = data.options[0].value;

      if (activeRandomPingers[channel.id]) {
        clearInterval(activeRandomPingers[channel.id]);
      }

      const members = await getAllNonBotMembers(channel.guild_id);
      const randomMember = () => members[Math.floor(Math.random() * members.length)];

      // Save to database
      const randomAutoPing = await RandomAutoPing.findOneAndUpdate(
        { guildId: channel.guild_id, channelId: channel.id },
        { interval: interval, active: true },
        { upsert: true, new: true }
      );

      // Send 1st ping immediately
      sendMessage(`<@${randomMember().user.id}> ${getRandomEmoji()}`, randomAutoPing.channelId);

      activeRandomPingers[channel.id] = setInterval(
        () => sendMessage(`<@${randomMember().user.id}> ${getRandomEmoji()}`, randomAutoPing.channelId),
        interval * 1000
      );

      return sendResponseMessage(res, `Okay! A random member will get pinged every ${randomAutoPing.interval} seconds on this channel.`);
    }

    if (name === 'stoprandomping') {
      // Check if member has permission to manage the server
      if ((BigInt(member.permissions) & PermissionsBitField.Flags.ManageGuild) === BigInt(0)) {
        return sendResponseMessage(res, ':octagonal_sign: Nope! You can\'t use this command.');
      }

      if (!activeRandomPingers[channel.id]) {
        return sendResponseMessage(res, 'What are you trying to stop? There\'s nothing going on here.');
      }

      // delete from database
      await RandomAutoPing.deleteOne({ guildId: channel.guild_id, channelId: channel.id });

      clearInterval(activeRandomPingers[channel.id]);
      delete activeRandomPingers[channel.id];

      return sendResponseMessage(res, 'Okay! I\'ll stop random pinging on this channel.');
    }
  }
});

app.get('/ping', (req, res) => {
  res.send('pong');
});

app.get('/server-details', async (req, res) => {
  const guilds = await getAllGuilds();

  const guild = guilds.find((guild: any) => guild.name === "Fugitives from Fugitives");
  const channels = await getAllChannels(guild.id);
  const channel = channels.find((channel: any) => channel.name === "general" && channel.type === 0);
  const members = await getAllNonBotMembers(guild.id);

  return res.send({ guild, channel, channels, members });
});

(async () => {
  // Connect to database
  await connectDatabase();

  app.listen(PORT, async () => {
    console.log('Listening on port', PORT);

    console.log('Current active pingers and random pingers in memory:');
    console.log('activePingers', activePingers);
    console.log('activeRandomPingers', activeRandomPingers);

    // clear pingers from memory
    Object.keys(activePingers).forEach((channelId) => {
      clearInterval(activePingers[channelId]);
      delete activePingers[channelId];
    });

    Object.keys(activeRandomPingers).forEach((channelId) => {
      clearInterval(activeRandomPingers[channelId]);
      delete activeRandomPingers[channelId];
    });

    const activePings = await AutoPing.find({ active: true });
    const activeRandomPings = await RandomAutoPing.find({ active: true });

    if (activePings.length) {
      console.log(`Found ${activePings.length} active pings in database, starting pingers...`);

      activePings.forEach((autoPing) => {
        activePingers[autoPing.channelId] = setInterval(
          () => sendMessage(`<@${autoPing.memberId}> ${getRandomEmoji()}`, autoPing.channelId),
          autoPing.interval * 1000
        );
      });

      console.log('Started pingers!');
    }

    if (activeRandomPings.length) {
      console.log(`Found ${activeRandomPings.length} active random pings in database, starting pingers...`);

      const members = await getAllNonBotMembers(activeRandomPings[0].guildId);
      const randomMember = () => members[Math.floor(Math.random() * members.length)];

      activeRandomPings.forEach((randomAutoPing) => {
        activeRandomPingers[randomAutoPing.channelId] = setInterval(
          () => sendMessage(`<@${randomMember().user.id}> ${getRandomEmoji()}`, randomAutoPing.channelId),
          randomAutoPing.interval * 1000
        );
      });

      console.log('Started random pingers!');
    }
  });
})();
