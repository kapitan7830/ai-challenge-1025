import axios from 'axios';

export class PerplexityAdapter {
  constructor(apiKey) {
    this.apiKey = apiKey;
    this.baseUrl = 'https://api.perplexity.ai';
  }

  async search(request) {
    const response = await axios.post(
      `${this.baseUrl}/search`,
      request,
      {
        headers: {
          Authorization: `Bearer ${this.apiKey}`,
          'Content-Type': 'application/json',
        },
      }
    );
    return response.data;
  }
}

