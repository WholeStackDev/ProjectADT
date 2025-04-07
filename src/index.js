require("dotenv").config();
const chatWithAI = require("./openaiChat");
const languageNameMappings = require("./languageNameMappings");

const token = process.env.DISCORD_TOKEN;
const languageCodes = ["en", "fa", "de", "fr", "es"];

const { Client, Events, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

const chatHistories = {};
const MAX_HISTORY_LENGTH = 10;

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return;
    if (!message.guild) return;

    const originLanguageCode = getLangCode(message.channel);
    const channelsToSendTranslation = getAllChannelsToSendTranslation(message);
    if (!originLanguageCode || !channelsToSendTranslation || channelsToSendTranslation.length === 0) return;

    const hasText = message.content.trim() !== '';
    const hasAttachments = message.attachments.size > 0;

    if (!hasText && !hasAttachments) return;

    for (const destinationChannel of channelsToSendTranslation) {
        const destinationLanguageCode = getLangCode(destinationChannel);
        if (!destinationLanguageCode) continue;

        let textToSend = null;

        if (hasText) {
            if (originLanguageCode !== destinationLanguageCode) {
                if (!chatHistories[message.channel.id]) {
                    chatHistories[message.channel.id] = [{
                        role: "system",
                        content: `
                            You are a translation assistant. Your job is to translate messages from ${languageNameMappings[originLanguageCode] || originLanguageCode} to ${languageNameMappings[destinationLanguageCode] || destinationLanguageCode} while preserving the meaning and context. Follow these guidelines:
                            - Understand the user's intent and the context of the conversation.
                            - Focus on translating the overall meaning rather than word-for-word translation.
                            - If the user's message is grammatically incorrect or unclear, make an educated guess to translate it in a coherent and grammatically correct manner.
                            - If something is wrapped in brackets like [this], do not change or translate it. Just leave it as it is.
                            - If the user says "درست است", translate it as "OK" unless context suggests otherwise.
                        `,
                    }];
                }

                const translation = await translate(originLanguageCode, destinationLanguageCode, message.content, message.channel.id);
                if (translation) textToSend = translation;
            } else {
                textToSend = message.content;
            }
        }

        const embed = getFormattedMessageEmbed(textToSend, message);
        const payload = { embeds: [embed] };

        if (hasAttachments) {
            payload.files = message.attachments.map(a => a.url);
        }

        destinationChannel.send(payload).catch(console.error);
    }
});

client.once(Events.ClientReady, (c) => {
    console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.login(token);

function getFormattedMessageEmbed(text, originalMessage) {
    let displayName = originalMessage.member?.nickname || originalMessage.author.username;

    const embed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setAuthor({ name: displayName, iconURL: originalMessage.author.displayAvatarURL(), url: 'https://discord.js.org' });

    if (text) {
        embed.setDescription(text);
    }

    return embed;
}

async function translate(from, to, text, channelId) {
    if (!chatHistories[channelId]) {
         console.warn(`Chat history for channel ${channelId} was not initialized before translate call.`);
         chatHistories[channelId] = [{ role: "system", content: `Translate from ${from} to ${to}.` }];
    }

    chatHistories[channelId].push({ role: "user", content: text });

    if (chatHistories[channelId].length > MAX_HISTORY_LENGTH) {
        const startIndex = chatHistories[channelId].length - (MAX_HISTORY_LENGTH -1);
        chatHistories[channelId] = [
            chatHistories[channelId][0],
            ...chatHistories[channelId].slice(startIndex)
        ];
    }

    try {
        const response = await chatWithAI(chatHistories[channelId]);
        chatHistories[channelId].push({ role: "assistant", content: response });
        return response;
    } catch (error) {
        console.error("Error calling OpenAI API:", error);
        return null;
    }
}

function getAllChannelsToSendTranslation(message) {
    let channelsGroupedByBaseName = getGroupedChannels(message.guild);
    let baseName = getBaseName(message.channel);
    if (!baseName || !channelsGroupedByBaseName[baseName]) return [];

    let matchingChannels = channelsGroupedByBaseName[baseName].filter(ch =>
        ch.id !== message.channel.id && getLangCode(ch)
    );

    return matchingChannels;
}

function getIsSpoken(channel) {
    let channelName = channel.name;
    let isSpoken = channelName.endsWith("-s");
    if (!isSpoken && channel.parent?.name.toLowerCase().includes("spoken")) {
        isSpoken = true;
    }
    return isSpoken;
}

function getChannelRegexMatches(channelName) {
    const pattern = /^(.*?)(?:-([a-z]{2})(?:-(s))?)?$/;
    const match = channelName.match(pattern);
    if (!match) {
        return { baseName: channelName, languageCode: null };
    }
    const baseName = match[1] || channelName;
    const languageCode = match[2] || null;

    return { baseName, languageCode };
}

function getLangCode(channel) {
    const { languageCode: nameLangCode } = getChannelRegexMatches(channel.name);
    if (nameLangCode && languageCodes.includes(nameLangCode)) {
        return nameLangCode;
    }
    if (channel.parent && languageCodes.includes(channel.parent.name)) {
        return channel.parent.name;
    }
    if (channel.parent) {
        for (let languageName in languageNameMappings) {
            if (channel.parent.name.toLowerCase().includes(languageName.toLowerCase())) {
                return languageNameMappings[languageName];
            }
        }
    }
    return null;
}

function getBaseName(channel) {
    const { baseName, languageCode } = getChannelRegexMatches(channel.name);
    const parentLangCode = getLangCode(channel);

    if ((languageCode && languageCodes.includes(languageCode)) || (!languageCode && parentLangCode)) {
        return baseName.replace(/-$/, '');
    }

    return channel.name;
}

function getGroupedChannels(guild) {
    let channelsGroupedByBaseName = {};

    let textChannels = guild.channels.cache.filter((channel) => channel.type === 0);

    textChannels.each((channel) => {
        if (!getLangCode(channel)) {
            return;
        }

        let baseName = getBaseName(channel);
        if (!channelsGroupedByBaseName[baseName]) {
            channelsGroupedByBaseName[baseName] = [];
        }

        channelsGroupedByBaseName[baseName].push(channel);
    });

    return channelsGroupedByBaseName;
}