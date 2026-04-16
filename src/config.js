import 'dotenv/config';

export default {
  port: parseInt(process.env.PORT, 10) || 3000,
  env: process.env.NODE_ENV || 'development',

  db: {
    connectionString: process.env.DATABASE_URL,
  },

  ebay: {
    appId: process.env.EBAY_APP_ID,
    certId: process.env.EBAY_CERT_ID,
    devId: process.env.EBAY_DEV_ID,
  },

  bricklink: {
    consumerKey: process.env.BRICKLINK_CONSUMER_KEY,
    consumerSecret: process.env.BRICKLINK_CONSUMER_SECRET,
    token: process.env.BRICKLINK_TOKEN,
    tokenSecret: process.env.BRICKLINK_TOKEN_SECRET,
  },

  rebrickable: {
    apiKey: process.env.REBRICKABLE_API_KEY,
  },

  llm: {
    provider: process.env.LLM_PROVIDER,
    apiKey: process.env.LLM_API_KEY,
    model: process.env.LLM_MODEL,
  },
};
