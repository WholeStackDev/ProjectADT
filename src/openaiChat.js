// openaiChat.js
require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function chatWithAI(messages) {
  const chatCompletion = await openai.createChatCompletion({
    model: "gpt-4o",
    messages: messages,
    temperature: 0.2,
  });

  return chatCompletion.data.choices[0].message.content;
}

module.exports = chatWithAI;
