import OpenAI from 'openai';
import dotenv from 'dotenv';

dotenv.config();

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

async function listModels() {
  try {
    const models = await openai.models.list();
    const modelsList = [];

    for await (const model of models) {
      modelsList.push(model);
    }
    
    modelsList.sort((a, b) => a.created - b.created);
    
    
    console.log('Available OpenAI Models:\n');

    for (const model of modelsList) {
      console.log(model.id);
    }
  } catch (error) {
    console.error('Error fetching models:', error.message);
  }
}

listModels();

