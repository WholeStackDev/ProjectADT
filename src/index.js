require("dotenv").config();
const chatWithAI = require("./openaiChat");
const languageNameMappings = require("./languageNameMappings");

	// if(message.attachments.size > 0) {
	// 	const possibleAudio = message.attachments.first();
	// 	const test = speechToText(possibleAudio);
	// 	console.log(test);
	// }

const token = process.env.DISCORD_TOKEN;
const languageCodes = ["en", "fa", "de", "fr", "es"];

const { Client, Events, GatewayIntentBits, EmbedBuilder, Collection } = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on(Events.MessageCreate, async (message) => {
	if (message.author.bot) return; // Ignore messages from bots
	if (!message.guild) return; // Ignore DMs

	const originLanguageCode = getLangCode(message.channel);
	const channelsToSendTranslation = getAllChannelsToSendTranslation(message);
    if(channelsToSendTranslation.length === 0) return;

	for (const destinationChannel of channelsToSendTranslation) {
		const destinationLanguageCode = getLangCode(destinationChannel);
        const destinationIsSpoken = getIsSpoken(destinationChannel);

        let messageText = message.content;
		if (originLanguageCode !== destinationLanguageCode) {
            const translation = await translate(originLanguageCode, destinationLanguageCode, message.content);
            if(translation) messageText = translation;
        }
		destinationChannel.send(getFormattedMessage(messageText, message, true));
	}
});

client.once(Events.ClientReady, (c) => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.login(token);

function getFormattedMessage(text, originalMessage, isSpoken) {
    let displayName = originalMessage.member.nickname ? originalMessage.member.nickname : originalMessage.author.username;
	// if(isSpoken) {
	// 	text = `${text}
		
	// 	[Listen here](https://file-examples.com/storage/fee472ce6e64b122ba0c8b3/2017/11/file_example_MP3_700KB.mp3)
	// 	`
	// }

    const exampleEmbed = new EmbedBuilder()
    .setColor(0x0099FF)
    .setDescription(text)
    .setAuthor({ name: displayName, iconURL: originalMessage.author.displayAvatarURL(), url: 'https://discord.js.org' });

    return { embeds: [exampleEmbed] };
}

async function translate(from, to, text) {
	let response;
	if(from === "fa") {
		response = await chatWithAI(`
		Please translate the following message after the dashes from Dari to ${to}, and do not send anything else except the translation since this is being used with an API.
		Keep in mind to not translate compound words or phrases individually, always consider the overall context of the sentence.
		If something is wrapped in brakets like [this], then do not change it or translate it at all. Just leave it in the position where it appeared in the text in the original language and in the original language's text direction.
		If the user says "درست است", assume that means "OK" instead of "That is correct" unless there is a very good reason from the context to decide otherwise
		-----------------------
		${text}`);
	} else {
		response = await chatWithAI(`
		Please translate the following message after the dashes from ${from} to ${to}, and do not send anything else except the translation since this is being used with an API.
		If something is wrapped in brakets like [this], then do not change it or translate it at all. Just leave it in the position where it appeared in the text in the original language and in the original language's text direction.
		-----------------------
		${text}`);
	}
    return response;
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
	if (languageCodes.includes(getLangCode(channel))) {
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
