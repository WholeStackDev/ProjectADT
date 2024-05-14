require("dotenv").config();
const chatWithAI = require("./openaiChat");
const languageNameMappings = require("./languageNameMappings");

const token = process.env.DISCORD_TOKEN;
const languageCodes = ["en", "fa", "de", "fr", "es"];

const { Client, Events, GatewayIntentBits, EmbedBuilder } = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

// Initialize chat history storage
const chatHistories = {};
const MAX_HISTORY_LENGTH = 10; // Limit the chat history to the last 10 messages

client.on(Events.MessageCreate, async (message) => {
    if (message.author.bot) return; // Ignore messages from bots
    if (!message.guild) return; // Ignore DMs

    const originLanguageCode = getLangCode(message.channel);
    const channelsToSendTranslation = getAllChannelsToSendTranslation(message);
    if (channelsToSendTranslation.length === 0) return;

    for (const destinationChannel of channelsToSendTranslation) {
        const destinationLanguageCode = getLangCode(destinationChannel);
        const destinationIsSpoken = getIsSpoken(destinationChannel);

        let messageText = message.content;
        if (originLanguageCode !== destinationLanguageCode) {
            // Initialize chat history if it doesn't exist
            if (!chatHistories[message.channel.id]) {
                chatHistories[message.channel.id] = [{
                    role: "system",
                    content: `
                        You are a translation assistant. Your job is to translate messages from ${originLanguageCode} to ${destinationLanguageCode} while preserving the meaning and context. Follow these guidelines:
                        - Understand the user's intent and the context of the conversation.
                        - Focus on translating the overall meaning rather than word-for-word translation.
                        - If the user's message is grammatically incorrect or unclear, make an educated guess to translate it in a coherent and grammatically correct manner.
                        - If something is wrapped in brackets like [this], do not change or translate it. Just leave it as it is.
                        - If the user says "درست است", translate it as "OK" unless context suggests otherwise.
                    `,
                }];
            }

            const translation = await translate(originLanguageCode, destinationLanguageCode, message.content, message.channel.id);
            if (translation) messageText = translation;
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

    const exampleEmbed = new EmbedBuilder()
        .setColor(0x0099FF)
        .setDescription(text)
        .setAuthor({ name: displayName, iconURL: originalMessage.author.displayAvatarURL(), url: 'https://discord.js.org' });

    return { embeds: [exampleEmbed] };
}

async function translate(from, to, text, channelId) {
    // Add user message to chat history
    chatHistories[channelId].push({ role: "user", content: text });

    // Truncate history if it exceeds the maximum length
    if (chatHistories[channelId].length > MAX_HISTORY_LENGTH) {
        chatHistories[channelId].splice(1, chatHistories[channelId].length - MAX_HISTORY_LENGTH); // Keep system message and the last few messages
    }

    // Ensure the messages array is properly formatted
    const messages = chatHistories[channelId].map(msg => ({
        role: msg.role,
        content: msg.content
    }));

    // Get AI response
    const response = await chatWithAI(messages);

    // Add AI response to chat history
    chatHistories[channelId].push({ role: "assistant", content: response });

    return response;
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
