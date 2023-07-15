require("dotenv").config();
const token = process.env.DISCORD_TOKEN;

// Require the necessary discord.js classes
const { Client, Events, GatewayIntentBits, Collection } = require("discord.js");
const client = new Client({ intents: [GatewayIntentBits.Guilds, GatewayIntentBits.GuildMessages, GatewayIntentBits.MessageContent] });

client.on(Events.MessageCreate, async (message) => {
	if (message.author.bot) return;
	console.log("Message received: ", message.content);

	if (message.attachments.size > 0) {
		console.log("Message has attachments");
		const audio = message.attachments.first();

		//Function to use microsoft speech to text here

		//Function to use chatgpt Translation here

		//Function to use microsoft text to speech here

		//Pass the audio file to the user
		await message.reply({
			content: "Here is your audio file!",
			embeds: [
				{
					url: audio.url,
					title: "Audio File",
				},
			],
		});
	}
});

client.once(Events.ClientReady, (c) => {
	console.log(`Ready! Logged in as ${c.user.tag}`);
});

client.login(token);
