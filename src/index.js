require("dotenv").config();
const chatWithAI = require('./openaiChat');
const languageNameMappings = require('./languageNameMappings');

const token = process.env.DISCORD_TOKEN;
const languageCodes = ['en', 'fa', 'de', 'fr', 'es'];

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

	var { languageCode: originalLanguageCode } = getBaseNameAndLangCode(message.channel);

	const channelsToSendTranslation = getAllChannelsToSendTranslation(message);

	for (const channel of channelsToSendTranslation) {
		const { languageCode: newLanguageCode } = getBaseNameAndLangCode(channel);
		var translation = '';
		if(originalLanguageCode != newLanguageCode) {
			translation = await translate(originalLanguageCode, newLanguageCode, message.content);
		}
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

function speechToText(audioFile, lang){
	return `Pretend this is a text in ${lang} that came from an audio clip`;
}











function getAllChannelsToSendTranslation(message) {
	let channelsGroupedByBaseName = getGroupedChannels(message.guild);
	let { baseName } = getBaseNameAndLangCode(message.channel) || null;
	if (!baseName) return null; // If the message's channel does not have a language code, do nothing

	let matchingChannels = channelsGroupedByBaseName[baseName].filter(x => x.id !== message.channel.id);
    if (!matchingChannels) return null;
	return matchingChannels;
}


function getBaseNameAndLangCode(channel) {
    let channelName = channel.name;
    let isSpoken = channelName.endsWith('-s');

    // Remove the spoken flag '-s' if present
    if (isSpoken) {
        channelName = channelName.slice(0, -2);
    }

    let possibleLanguageCode = channelName.slice(-2); // Get the last two characters
    let possibleDash = channelName.charAt(channelName.length - 3); // Get the third last character
    let baseName;
    let languageCode;

    if (possibleDash === '-' && languageCodes.includes(possibleLanguageCode)) {
        baseName = channelName.slice(0, -3); // Strip the last three characters off the channel name
        languageCode = possibleLanguageCode;
	} else if (channel.parent && languageCodes.includes(channel.parent.name)) {
        baseName = channelName;
        languageCode = channel.parent.name;
    } else if (channel.parent) {
        for (let language in languageNameMappings) {
            if (channel.parent.name.includes(language)) {
                baseName = channelName;
                languageCode = languageNameMappings[language];
                break;
            }
        }
        if (!isSpoken && channel.parent.name.includes('Spoken')) {
            isSpoken = true;
        }
    }
    return { baseName, languageCode, isSpoken };
}

function getGroupedChannels(guild) {
    let channelsGroupedByBaseName = {};

    // Get all text channels
    let textChannels = guild.channels.cache.filter(channel => channel.type === 0);
    
    textChannels.each(channel => {
        let { baseName } = getBaseNameAndLangCode(channel);
        if (baseName != null) {
            // If the base name doesn't exist in the object yet, create an empty array for it
            if (!channelsGroupedByBaseName[baseName]) {
                channelsGroupedByBaseName[baseName] = [];
            }

            // Add the channel to its group
            channelsGroupedByBaseName[baseName].push(channel);
        }
    });

    return channelsGroupedByBaseName;
}