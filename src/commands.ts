import 'dotenv/config';
// import { getRPSChoices } from './game';
import { capitalize, InstallGlobalCommands } from './utils.js';

// // Get the game choices from game.js
// function createCommandChoices() {
//   const choices = getRPSChoices();
//   const commandChoices = [];

//   for (let choice of choices) {
//     commandChoices.push({
//       name: capitalize(choice),
//       value: choice.toLowerCase(),
//     });
//   }

//   return commandChoices;
// }

// Simple test command
const TEST_COMMAND = {
  name: 'test',
  description: 'Basic command',
  type: 1,
};

// // Command containing options
// const CHALLENGE_COMMAND = {
//   name: 'challenge',
//   description: 'Challenge to a match of rock paper scissors',
//   options: [
//     {
//       type: 3,
//       name: 'object',
//       description: 'Pick your object',
//       required: true,
//       choices: createCommandChoices(),
//     },
//   ],
//   type: 1,
// };

// // Set Rifu user
// const SET_RIFU_COMMAND = {
//   name: 'setrifu',
//   description: 'Tell me who Rifu is',
//   options: [
//     {
//       "name": "member",
//       "description": "The member to set",
//       "type": 6,
//       "required": true
//     }
//   ]
// }

// Start pinging
const START_COMMAND = {
  name: 'start',
  description: 'Start pinging Rifu on this channel',
  type: 1,
  options: [
    {
      type: 6,
      description: 'Tell me who Rifu is',
      name: 'member',
      required: true,
    },
    {
      type: 4,
      name: 'interval',
      description: 'Time between each ping in seconds',
      required: true,
    },
  ],
};

// Stop pinging
const STOP_COMMAND = {
  name: 'stop',
  description: 'Stop pinging Rifu on this channel',
  type: 1,
};

// Start random pinging
const START_RANDOM_PING_COMMAND = {
  name: 'startrandomping',
  description: 'Start pinging random people on this channel',
  type: 1,
  options: [
    {
      type: 4,
      name: 'interval',
      description: 'Time between each ping in seconds',
      required: true,
    },
  ],
};

// Stop random pinging
const STOP_RANDOM_PING_COMMAND = {
  name: 'stoprandomping',
  description: 'Stop pinging random people on this channel',
  type: 1,
};

const ALL_COMMANDS = [START_COMMAND, STOP_COMMAND, START_RANDOM_PING_COMMAND, STOP_RANDOM_PING_COMMAND];

InstallGlobalCommands(process.env.APP_ID as string, ALL_COMMANDS);