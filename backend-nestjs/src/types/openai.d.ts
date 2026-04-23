declare module 'openai' {
  export default class OpenAI {
    constructor(options?: { apiKey: string });
    chat: {
      completions: {
        create(options: {
          model: string;
          messages: Array<{
            role: 'system' | 'user' | 'assistant';
            content: string;
          }>;
          temperature?: number;
          max_tokens?: number;
          response_format?: { type: 'json_object' };
        }): Promise<{
          choices: Array<{
            message: {
              content: string;
            };
          }>;
        }>;
      };
    };
  }
}