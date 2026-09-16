// Vercel entry point. Vercel gives each request to this handler; Express
// treats it as an ordinary (req, res) pair, so the same app serves both
// `npm start` locally and the deployed functions.
export { default } from '../server.js';
