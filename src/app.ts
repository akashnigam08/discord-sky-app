import 'dotenv/config';
import express, { Request, Response } from 'express';
import {
  InteractionType,
  InteractionResponseType
} from 'discord-interactions';
import { VerifyDiscordRequest, getRandomEmoji, sendMessage, getAllGuilds, getAllChannels, sendResponseMessage, getAllNonBotMembers, getRandomGif } from './utils.js';
import * as discord from 'discord.js';
import connectDatabase from './db.js';
import AutoPing from './schemas/AutoPing.js';
import RandomAutoPing from './schemas/RandomAutoPing.js';
import GlobalSettings, { createDefaultGlobalSettings } from './schemas/GlobalSettings.js';
import RandomGifPing from './schemas/RandomGifPing.js';

const { PermissionsBitField } = discord;

// Create an express app
const app = express();
// Get port, or default to 3000
const PORT = process.env.PORT || 3000;

// Parse request body and verifies incoming requests using discord-interactions package
app.use(express.json({ verify: VerifyDiscordRequest(process.env.PUBLIC_KEY as string) }));

const activePingers: { [key: string]: any } = {};
const activeRandomPingers: { [key: string]: any } = {};
const activeGifPingers: { [key: string]: any } = {};

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

    if (name === 'startgifping') {
      // Check if member has permission to manage the server
      if ((BigInt(member.permissions) & PermissionsBitField.Flags.ManageGuild) === BigInt(0)) {
        return sendResponseMessage(res, ':octagonal_sign: Nope! You can\'t use this command.');
      }

      // check if interval is greater than or equal to 5 minutes
      const interval = data.options[0].value;
      if (interval < 300) {
        return sendResponseMessage(res, 'Interval must be greater than or equal to 300 seconds (5 minutes).');
      }

      // get gifsperhour from database
      const globalSettings = await GlobalSettings.findOne({});
      if (!globalSettings) {
        return sendResponseMessage(res, 'Something went wrong, please try again.');
      }
      let gifsPerHour = globalSettings.globalGifsPerHour;

      // check if random gif pings already exist for this channel. If so, subtract the existing gifsperhour from the global gifsperhour
      const existingRandomGifPing = await RandomGifPing.findOne({ guildId: channel.guild_id, channelId: channel.id });
      if (existingRandomGifPing) {
        gifsPerHour = gifsPerHour - Math.floor((60 * 60) / existingRandomGifPing.interval);
        if (gifsPerHour < 0) {
          return sendResponseMessage(res, 'Something went wrong, please try again.');
        }
      }

      const gifsPerHourLimit = parseInt(process.env.GIFS_PER_HOUR_LIMIT as string);
      const newGifsPerHour = gifsPerHour + Math.floor((60 * 60) / interval);
      if (newGifsPerHour > gifsPerHourLimit) {
        return sendResponseMessage(res, 'Sorry, the given interval exceeds my current GIFs per hour limit. Please try again with a higher interval.');
      }

      // update gifsperhour in database
      await GlobalSettings.updateOne({}, { globalGifsPerHour: newGifsPerHour });

      if (activeGifPingers[channel.id]) {
        clearInterval(activeGifPingers[channel.id]);
      }

      const members = await getAllNonBotMembers(channel.guild_id);
      const randomMember = () => members[Math.floor(Math.random() * members.length)];

      // Save to database
      const randomGifPing = await RandomGifPing.findOneAndUpdate(
        { guildId: channel.guild_id, channelId: channel.id },
        { interval: interval, active: true },
        { upsert: true, new: true }
      );

      activeGifPingers[channel.id] = setInterval(
        async () => sendMessage(`<@${randomMember().user.id}>`, randomGifPing.channelId, await getRandomGif()),
        interval * 1000
      );

      // Send 1st ping immediately
      sendMessage(`<@${randomMember().user.id}>`, randomGifPing.channelId, await getRandomGif());

      return sendResponseMessage(res, `Okay! A random member will get pinged with a random gif every ${interval} seconds on this channel.`);
    }

    //write down the code for stopping random gif ping
    if (name === 'stopgifping') {
      // Check if member has permission to manage the server
      if ((BigInt(member.permissions) & PermissionsBitField.Flags.ManageGuild) === BigInt(0)) {
        return sendResponseMessage(res, ':octagonal_sign: Nope! You can\'t use this command.');
      }

      if (!activeGifPingers[channel.id]) {
        return sendResponseMessage(res, 'What are you trying to stop? There\'s nothing going on here.');
      }

      // delete the gifsperhour from database
      const globalSettings = await GlobalSettings.findOne({});
      if (!globalSettings) {
        return sendResponseMessage(res, 'Something went wrong, please try again.');
      }

      const randomGifPing = await RandomGifPing.findOne({ guildId: channel.guild_id, channelId: channel.id });
      if (!randomGifPing) {
        return sendResponseMessage(res, 'Something went wrong, please try again.');
      }

      const gifsPerHour = globalSettings.globalGifsPerHour;
      const newGifsPerHour = gifsPerHour - Math.floor((60 * 60) / randomGifPing.interval);
      if (newGifsPerHour < 0) {
        return sendResponseMessage(res, 'Something went wrong, please try again.');
      }

      // delete from database
      await RandomGifPing.deleteOne({ guildId: channel.guild_id, channelId: channel.id });

      // update gifsperhour in database
      await GlobalSettings.updateOne({}, { globalGifsPerHour: newGifsPerHour });

      clearInterval(activeGifPingers[channel.id]);
      delete activeGifPingers[channel.id];

      return sendResponseMessage(res, 'Okay! I\'ll stop random gif pinging on this channel.');
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

    await createDefaultGlobalSettings();

    console.log('Current active pingers and random pingers in memory:');
    console.log('activePingers', activePingers);
    console.log('activeRandomPingers', activeRandomPingers);
    console.log('activeGifPingers', activeGifPingers);

    // clear pingers from memory
    Object.keys(activePingers).forEach((channelId) => {
      clearInterval(activePingers[channelId]);
      delete activePingers[channelId];
    });

    Object.keys(activeRandomPingers).forEach((channelId) => {
      clearInterval(activeRandomPingers[channelId]);
      delete activeRandomPingers[channelId];
    });

    Object.keys(activeGifPingers).forEach((channelId) => {
      clearInterval(activeGifPingers[channelId]);
      delete activeGifPingers[channelId];
    });

    const activePings = await AutoPing.find({ active: true });
    const activeRandomPings = await RandomAutoPing.find({ active: true });
    const activeGifPings = await RandomGifPing.find({ active: true });

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

    if (activeGifPings.length) {
      console.log(`Found ${activeGifPings.length} active random gif pings in database, starting pingers...`);

      const members = await getAllNonBotMembers(activeGifPings[0].guildId);
      const randomMember = () => members[Math.floor(Math.random() * members.length)];

      activeGifPings.forEach((randomGifPing) => {
        activeGifPingers[randomGifPing.channelId] = setInterval(
          async () => sendMessage(`<@${randomMember().user.id}>`, randomGifPing.channelId, await getRandomGif()),
          randomGifPing.interval * 1000
        );
      });

      console.log('Started random gif pingers!');
    }
  });
})();
