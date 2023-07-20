// openaiChat.js
require("dotenv").config();
const { Configuration, OpenAIApi } = require("openai");

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

async function chatWithAI(prompt) {

  const chatCompletion = await openai.createChatCompletion({
    model: "gpt-4",
    messages: [{role: "user", content: prompt}],
    temperature: 0.2
  });

  // This will return the model's response
  return chatCompletion.data.choices[0].message.content;
}

// async function getTranslation(file) {
//   const translationResponse = await openai.createTranslation({
//     file: file,
//     model: 'whisper-1'
//   })
//   return translationResponse;
// }



module.exports = chatWithAI;
// module.exports = getTranslation;