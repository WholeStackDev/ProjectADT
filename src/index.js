require("dotenv").config();
const chatWithAI = require("./openaiChat");
const languageNameMappings = require("./languageNameMappings");

const token = process.env.DISCORD_TOKEN;
const languageCodes = ["en", "fa", "de", "fr", "es"];

const { Client, Events, GatewayIntentBits, Collection } = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on(Events.MessageCreate, async (message) => {
	if (message.author.bot) return; // Ignore messages from bots
	if (!message.guild) return; // Ignore DMs

	// if(message.attachments.size > 0) {
	// 	const possibleAudio = message.attachments.first();
	// 	const test = speechToText(possibleAudio);
	// 	console.log(test);
	// }

	let originLanguageCode = getLangCode(message.channel);

	const channelsToSendTranslation = getAllChannelsToSendTranslation(message);

	for (const channel of channelsToSendTranslation) {
		const destinationLanguageCode = getLangCode(channel);
		if (originLanguageCode === destinationLanguageCode) return;
		const translation = await translate(originLanguageCode, destinationLanguageCode, message.content);
		channel.send(translation);
	}
});

client.once(Events.ClientReady, (c) => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.login(token);

async function translate(from, to, text) {
	return await chatWithAI(`Please translate the following message from ${from} to ${to} and do not send anything else except the translation since this is being used with an API: ${text}`);
}

function textToSpeech(text, lang) {
	return `Pretend this is audio in ${lang}`;
}

function speechToText(audioFile, lang) {
	return `Pretend this is a text in ${lang} that came from an audio clip`;
}

function getAllChannelsToSendTranslation(message) {
	let channelsGroupedByBaseName = getGroupedChannels(message.guild);
	let baseName = getBaseName(message.channel);
	if (!getLangCode(message.channel)) return null; // If the message's channel does not have a language code, do nothing

	let matchingChannels = channelsGroupedByBaseName[baseName].filter((x) => x.id !== message.channel.id);
	if (!matchingChannels) return null;
	return matchingChannels;
}

function getIsSpoken(channel) {
	let channelName = channel.name;
	let isSpoken = channelName.endsWith("-s");
	if (!isSpoken && channel.parent.name.includes("Spoken")) {
		isSpoken = true;
	}
	return isSpoken;
}

function getChannelRegexMatches(channelName) {
	const pattern = /^(.*?)(?:-([a-z]{2})(?:-(s))?)?$/;
	const match = channelName.match(pattern);
	const [_, baseName, languageCode] = match;
	return { baseName, languageCode };
}

function getLangCode(channel) {
	const { languageCode } = getChannelRegexMatches(channel.name);
	if (languageCodes.includes(languageCode)) {
		return languageCode;
	}
	if (channel.parent && languageCodes.includes(channel.parent.name)) {
		return channel.parent.name;
	}
	if (channel.parent) {
		for (let language in languageNameMappings) {
			if (channel.parent.name.includes(language)) {
				return languageNameMappings[language];
			}
		}
	}
	return null;
}

function getBaseName(channel) {
	const { baseName } = getChannelRegexMatches(channel.name);
	if (languageCodes.includes(languageCode)) {
		return baseName;
	}
	return channel.name;
}

function getGroupedChannels(guild) {
	let channelsGroupedByBaseName = {};

	// Get all text channels
	let textChannels = guild.channels.cache.filter((channel) => channel.type === 0);

	textChannels.each((channel) => {
		let baseName = getBaseName(channel);
		// If the base name doesn't exist in the object yet, create an empty array for it
		if (!channelsGroupedByBaseName[baseName]) {
			channelsGroupedByBaseName[baseName] = [];
		}

		// Add the channel to its group
		channelsGroupedByBaseName[baseName].push(channel);
	});

	return channelsGroupedByBaseName;
}
