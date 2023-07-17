// otherFile.js
const chatWithAI = require('./openaiChat');

async function main() {
  const prompt = "Hello world";
  const response = await chatWithAI(prompt);

//   console.log(response);
}

main().catch(console.error);
